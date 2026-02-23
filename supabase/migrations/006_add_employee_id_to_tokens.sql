-- Add employee_id column to anonymous_tokens for unique employee identification
ALTER TABLE anonymous_tokens ADD COLUMN IF NOT EXISTS employee_id TEXT;

-- Create unique index on employee_id (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_anonymous_tokens_employee_id
  ON anonymous_tokens(employee_id) WHERE employee_id IS NOT NULL;
