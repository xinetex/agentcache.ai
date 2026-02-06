-- 015: Tool Safety Scanner — Trust Registry
-- Stores scan results so agents can skip re-scanning known tools.

CREATE TABLE IF NOT EXISTS tool_scan_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash    TEXT NOT NULL UNIQUE,
    tool_name       TEXT,
    language        TEXT,                   -- 'javascript' | 'python' | 'unknown'
    trust_score     REAL NOT NULL DEFAULT 1.0,
    verdict         TEXT NOT NULL DEFAULT 'trusted',  -- 'trusted' | 'caution' | 'dangerous'
    findings        JSONB DEFAULT '[]'::jsonb,
    manifest        JSONB,
    scanned_by      TEXT,                   -- agent ID or API key prefix
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tool_scan_hash_idx ON tool_scan_results (content_hash);
CREATE INDEX IF NOT EXISTS tool_scan_verdict_idx ON tool_scan_results (verdict);
CREATE INDEX IF NOT EXISTS tool_scan_score_idx ON tool_scan_results (trust_score);
