-- Create the cleanup_outbox table for transaction failure tracking
CREATE TABLE IF NOT EXISTS hyperotaserver.cleanup_outbox (
    transaction_id TEXT PRIMARY KEY,
    entity_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt TIMESTAMPTZ
);

-- Add index for better performance on frequent queries
CREATE INDEX idx_cleanup_outbox_attempts ON hyperotaserver.cleanup_outbox(attempts);
CREATE INDEX idx_cleanup_outbox_created_at ON hyperotaserver.cleanup_outbox(created_at); 