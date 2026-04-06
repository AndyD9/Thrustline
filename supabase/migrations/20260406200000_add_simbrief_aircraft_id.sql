-- Add SimBrief saved aircraft ID to link fleet aircraft to SimBrief profiles
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS simbrief_aircraft_id text;
-- Registration code (e.g., F-GKXS)
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS registration text;
