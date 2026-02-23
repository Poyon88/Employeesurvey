-- Add active flag to anonymous_tokens for soft-deactivation on re-import
ALTER TABLE anonymous_tokens ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_anonymous_tokens_active ON anonymous_tokens(active);
