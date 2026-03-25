const https = require('https');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
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
          'Access-Control-Allow-Origin': '*',
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
