-- Migration: Add saas and government sectors to valid_sector constraint
-- Date: 2025-11-27
-- Purpose: Support all 10 market sectors in pipeline templates

-- Drop old constraint
ALTER TABLE pipelines DROP CONSTRAINT IF EXISTS valid_sector;

-- Add new constraint with all 10 sectors
ALTER TABLE pipelines ADD CONSTRAINT valid_sector CHECK (
  sector IN (
    'healthcare', 
    'finance', 
    'legal', 
    'education', 
    'ecommerce', 
    'enterprise', 
    'developer', 
    'datascience',
    'government',  -- NEW
    'saas',        -- NEW
    'general'
  )
);
