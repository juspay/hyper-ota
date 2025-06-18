ALTER TABLE hyperotaserver.packages
ALTER COLUMN index TYPE TEXT USING index->>'url';
