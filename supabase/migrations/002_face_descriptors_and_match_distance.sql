-- Migration 002: Face descriptors, match distance, and company face match settings

-- 1. Add face_descriptors to employees (stores 5x 128-float biometric vectors)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS face_descriptors JSONB;

-- 2. Add face_match_distance to attendance table (stores Euclidean distance of check-in match)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS face_match_distance NUMERIC(6, 4);

-- 3. Add face match settings to company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS require_face_match BOOLEAN DEFAULT TRUE;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS face_match_max_distance NUMERIC(4, 3) DEFAULT 0.55;
