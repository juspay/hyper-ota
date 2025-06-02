-- This is required for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Your SQL goes here
CREATE TABLE hyperotaserver.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INT NOT NULL,
    app_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    index TEXT NOT NULL,
    version_splits Boolean NOT NULL DEFAULT false,
    use_urls Boolean NOT NULL DEFAULT false,
    contents TEXT[] NOT NULL
);