const https = require('https');

// --- Rate Limiting (in-memory, per IP) ---
const rateLimits = new Map();
const RATE_LIMIT = 15; // requests per minute per IP
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// --- Model Whitelist ---
const ALLOWED_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-20250414',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307',
];

// --- CORS Origins ---
const ALLOWED_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,  // dev
  /^https:\/\/.*\.vercel\.app$/,  // Vercel previews
];

module.exports = async function handler(req, res) {
  // Cleanup old rate-limit entries (prevent memory leak in serverless)
  if (rateLimits.size > 10000) {
    const now = Date.now();
    for (const [ip, entry] of rateLimits) {
      if (now > entry.resetAt) rateLimits.delete(ip);
    }
  }

  // --- CORS headers (tightened) ---
  const origin = req.headers.origin;
  const corsOrigin = !origin ? '*' :  // No origin = native app
    ALLOWED_ORIGINS.some(p => p.test(origin)) ? origin :
    'https://vercel-deploy-mauve-six.vercel.app'; // default fallback

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version, anthropic-beta');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // --- Rate limit check ---
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }

  // --- Body validation ---
  if (!req.body) {
    return res.status(400).json({ error: 'Request body required' });
  }

  const bodyStr = JSON.stringify(req.body);
  if (bodyStr.length > 200000) { // ~200KB limit
    return res.status(413).json({ error: 'Request body too large' });
  }

  if (req.body.model && !ALLOWED_MODELS.includes(req.body.model)) {
    return res.status(400).json({ error: 'Model not allowed' });
  }

  // Cap max_tokens
  if (req.body.max_tokens && req.body.max_tokens > 4096) {
    req.body.max_tokens = 4096;
  }

  try {
    const body = JSON.stringify(req.body);
    const isStreaming = req.body && req.body.stream === true;

    const headers = {
      'content-type': 'application/json',
      'x-api-key': req.headers['x-api-key'] || process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
      'Content-Length': Buffer.byteLength(body),
    };

    // Forward optional beta header for prompt caching
    if (req.headers['anthropic-beta']) {
      headers['anthropic-beta'] = req.headers['anthropic-beta'];
    }

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers,
    };

    if (isStreaming) {
      // Stream SSE events directly through to the client
      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': corsOrigin,
        });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('Proxy streaming error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: err.message });
        } else {
          res.end();
        }
      });

      proxyReq.write(body);
      proxyReq.end();
    } else {
      // Non-streaming: buffer and forward as JSON
      const data = await new Promise((resolve, reject) => {
        const request = https.request(options, (response) => {
          let chunks = '';
          response.on('data', (chunk) => { chunks += chunk; });
          response.on('end', () => {
            try {
              resolve({ status: response.statusCode, body: JSON.parse(chunks) });
            } catch {
              resolve({ status: response.statusCode, body: { error: chunks } });
            }
          });
        });

        request.on('error', reject);
        request.write(body);
        request.end();
      });

      res.status(data.status).json(data.body);
    }
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
