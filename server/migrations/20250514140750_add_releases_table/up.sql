-- Create releases table for tracking application release history
CREATE TABLE IF NOT EXISTS hyperotaserver.releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    package_version INTEGER NOT NULL,
    config_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Add indexes for faster querying
CREATE INDEX idx_releases_org_app ON hyperotaserver.releases (org_id, app_id);
CREATE INDEX idx_releases_created_at ON hyperotaserver.releases (created_at); 