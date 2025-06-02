-- This file should undo anything in `up.sql`

-- Revert back to the original contents column
ALTER TABLE hyperotaserver.packages 
DROP COLUMN important,
DROP COLUMN lazy,
DROP COLUMN properties,
DROP COLUMN resources,
ADD COLUMN contents TEXT[] DEFAULT '{}';
