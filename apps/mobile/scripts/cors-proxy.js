const express = require('express');
const cors = require('cors');
const https = require('https');
const dns = require('dns');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Resolve the Anthropic API host once at startup, then cache it.
let resolvedIP = null;
dns.resolve4('api.anthropic.com', (err, addresses) => {
  if (!err && addresses.length) {
    resolvedIP = addresses[0];
    console.log(`Resolved api.anthropic.com → ${resolvedIP}`);
  }
});

app.post('/api/anthropic', async (req, res) => {
  try {
    const url = resolvedIP
      ? `https://${resolvedIP}/v1/messages`
      : 'https://api.anthropic.com/v1/messages';

    const headers = {
      'content-type': 'application/json',
      'x-api-key': req.headers['x-api-key'] || '',
      'anthropic-version': '2023-06-01',
      // When connecting via IP, the Host header is required for TLS/SNI
      ...(resolvedIP ? { Host: 'api.anthropic.com' } : {}),
    };

    const body = JSON.stringify(req.body);

    // Use Node https.request for proper SNI support when using IP
    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: resolvedIP || 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
        servername: 'api.anthropic.com', // SNI hostname for TLS
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
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`CORS proxy on http://localhost:${PORT}`));
