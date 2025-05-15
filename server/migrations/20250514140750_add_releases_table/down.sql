-- Drop indexes first to avoid dependency issues
DROP INDEX IF EXISTS hyperotaserver.idx_releases_org_app;
DROP INDEX IF EXISTS hyperotaserver.idx_releases_created_at;

-- Drop the table
DROP TABLE IF EXISTS hyperotaserver.releases; 