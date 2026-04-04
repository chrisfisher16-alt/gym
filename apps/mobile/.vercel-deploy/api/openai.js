const https = require('https');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

    // Use client-provided key, fall back to server-side key
    const clientAuth = req.headers['authorization'] || '';
    const serverKey = process.env.OPENAI_API_KEY || '';
    const authHeader = clientAuth || (serverKey ? `Bearer ${serverKey}` : '');

    const headers = {
      'content-type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    if (authHeader) {
      headers['authorization'] = authHeader;
    }

    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers,
      };

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
  } catch (err) {
    console.error('OpenAI proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
