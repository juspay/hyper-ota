-- Drop indices first
DROP INDEX IF EXISTS hyperotaserver.idx_cleanup_outbox_attempts;
DROP INDEX IF EXISTS hyperotaserver.idx_cleanup_outbox_created_at;

-- Drop the table
DROP TABLE IF EXISTS hyperotaserver.cleanup_outbox; 