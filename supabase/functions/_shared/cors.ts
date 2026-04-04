// ── CORS Headers for Edge Functions ─────────────────────────────────

const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8081',
  'exp://',
];

function getAllowedOrigins(): string[] {
  const env = Deno.env.get('ALLOWED_ORIGINS');
  if (env) {
    return env.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return DEFAULT_ORIGINS;
}

/**
 * Check whether `origin` is on the whitelist.
 * Supports prefix matches so `exp://` covers `exp://192.168.1.5:8081`.
 */
function isOriginAllowed(origin: string): boolean {
  return getAllowedOrigins().some(
    (allowed) => origin === allowed || origin.startsWith(allowed),
  );
}

// ── Per-request origin cache ────────────────────────────────────────
// Deno edge functions invoke the handler once per request, so a
// module-level variable is safe here.  `handleCors` is always called
// first, which resolves the origin for the rest of the request.
let _resolvedOrigin: string | null = null;

function resolveOrigin(req: Request): string | null {
  const origin = req.headers.get('Origin');
  if (!origin) return null;           // mobile / server — no Origin header
  if (isOriginAllowed(origin)) return origin;
  return '';                           // present but not whitelisted
}

/**
 * Build CORS headers using the resolved origin for this request.
 */
function buildCorsHeaders(): Record<string, string> {
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  if (_resolvedOrigin) {
    // Whitelisted origin — reflect it back.
    base['Access-Control-Allow-Origin'] = _resolvedOrigin;
  }
  // If _resolvedOrigin is null (no Origin header) or '' (not whitelisted),
  // we omit Access-Control-Allow-Origin so the browser blocks the call.

  return base;
}

/**
 * Return the CORS headers appropriate for `req`.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  _resolvedOrigin = resolveOrigin(req);
  return buildCorsHeaders();
}

/**
 * Handle CORS preflight requests.
 * Returns a Response for OPTIONS, or null if the request should proceed.
 *
 * MUST be called before `jsonResponse` / `errorResponse` so the origin
 * is resolved for the rest of the request.
 */
export function handleCors(req: Request): Response | null {
  // Resolve & cache the origin for all subsequent helper calls.
  _resolvedOrigin = resolveOrigin(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders() });
  }
  return null;
}

/**
 * Create a JSON response with CORS headers.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...buildCorsHeaders(),
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error response with CORS headers.
 */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
