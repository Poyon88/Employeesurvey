-- Migration 010: Add demographic columns to anonymous_tokens
ALTER TABLE anonymous_tokens
  ADD COLUMN IF NOT EXISTS sexe TEXT,
  ADD COLUMN IF NOT EXISTS date_naissance DATE,
  ADD COLUMN IF NOT EXISTS date_entree DATE,
  ADD COLUMN IF NOT EXISTS fonction TEXT,
  ADD COLUMN IF NOT EXISTS lieu_travail TEXT,
  ADD COLUMN IF NOT EXISTS type_contrat TEXT,
  ADD COLUMN IF NOT EXISTS temps_travail TEXT,
  ADD COLUMN IF NOT EXISTS cost_center TEXT;

-- Partial indexes on each demographic column (only index non-null values)
CREATE INDEX IF NOT EXISTS idx_tokens_sexe ON anonymous_tokens (sexe) WHERE sexe IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_date_naissance ON anonymous_tokens (date_naissance) WHERE date_naissance IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_date_entree ON anonymous_tokens (date_entree) WHERE date_entree IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_fonction ON anonymous_tokens (fonction) WHERE fonction IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_lieu_travail ON anonymous_tokens (lieu_travail) WHERE lieu_travail IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_type_contrat ON anonymous_tokens (type_contrat) WHERE type_contrat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_temps_travail ON anonymous_tokens (temps_travail) WHERE temps_travail IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_cost_center ON anonymous_tokens (cost_center) WHERE cost_center IS NOT NULL;
