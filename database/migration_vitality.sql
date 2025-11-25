-- Add vitality columns to platform_memory_cache
ALTER TABLE platform_memory_cache 
ADD COLUMN IF NOT EXISTS vitality DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS last_decay_at TIMESTAMP DEFAULT NOW();
