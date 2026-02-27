-- Migration 011: Add survey type fields to surveys
ALTER TABLE surveys
  ADD COLUMN IF NOT EXISTS survey_type TEXT NOT NULL DEFAULT 'classique'
    CHECK (survey_type IN ('classique', 'pulse')),
  ADD COLUMN IF NOT EXISTS sample_percentage NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}';
