ALTER TABLE hyperotaserver.packages
ALTER COLUMN index TYPE JSONB USING jsonb_build_object('url', index, 'filePath', split_part(index, '/', -1));
