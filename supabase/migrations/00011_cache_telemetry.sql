-- Add cache telemetry columns to ai_usage_events
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS cache_read_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS cache_creation_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS cache_hit boolean NOT NULL DEFAULT false;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS intent text;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS context_type text;

-- Add index for cache analysis queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_cache_hit ON ai_usage_events (cache_hit) WHERE cache_hit = true;
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_intent ON ai_usage_events (intent) WHERE intent IS NOT NULL;
