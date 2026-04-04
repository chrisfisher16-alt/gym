// ── AI Photo Analyze Edge Function ──────────────────────────────────
// Photo analysis is handled client-side for privacy and speed.
// This endpoint exists as a stub — any code that hits it gets a clear,
// non-error response pointing to the on-device implementation.

import { handleCors, jsonResponse } from '../_shared/cors.ts';

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  return jsonResponse(
    {
      client_side: true,
      message:
        'Photo analysis runs on-device for privacy and speed. No server round-trip needed.',
    },
    200,
  );
});
