-- Add job_transcripts table for Engine V2
-- Run with: npx tsx scripts/run_migration.ts (or directly in Neon console)

CREATE TABLE IF NOT EXISTS job_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT NOT NULL,
    lane TEXT NOT NULL,
    agent TEXT NOT NULL,
    logs JSONB NOT NULL DEFAULT '[]',
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,
    status TEXT DEFAULT 'running'
);

-- Index for quick lookups by job_id
CREATE INDEX IF NOT EXISTS idx_job_transcripts_job_id ON job_transcripts(job_id);

-- Index for lane filtering
CREATE INDEX IF NOT EXISTS idx_job_transcripts_lane ON job_transcripts(lane);
