CREATE TABLE IF NOT EXISTS hyperotaserver.configs (
    id SERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    config_version TEXT NOT NULL,
    release_config_timeout INTEGER NOT NULL,
    package_timeout INTEGER NOT NULL,
    tenant_info JSONB NOT NULL,
    properties JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, app_id, version)
);
