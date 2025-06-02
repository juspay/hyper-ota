-- Remove the old contents column and add new important and lazy columns
ALTER TABLE hyperotaserver.packages 
DROP COLUMN contents,
ADD COLUMN important JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN lazy JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN properties JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN resources JSONB NOT NULL DEFAULT '[]'::jsonb;

