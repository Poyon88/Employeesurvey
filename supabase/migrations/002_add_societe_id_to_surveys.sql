-- Add societe_id to surveys table to link each survey to a specific company
ALTER TABLE surveys ADD COLUMN societe_id UUID REFERENCES organizations(id);

-- Index for filtering surveys by company
CREATE INDEX idx_surveys_societe ON surveys(societe_id);
