-- Add visual identity columns to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_color TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS secondary_color TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS font_family TEXT;

-- Fix the CHECK constraint to include 'societe'
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_type_check
  CHECK (type IN ('societe', 'direction', 'department', 'service'));
