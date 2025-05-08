CREATE SCHEMA IF NOT EXISTS hyperotaserver;

CREATE TABLE hyperotaserver.organisations (
    name TEXT PRIMARY KEY,
    superposition_organisation TEXT NOT NULL CHECK (superposition_organisation <> '')
);
