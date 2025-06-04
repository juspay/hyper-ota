--keep track workspace details(names) per organization ..
CREATE TABLE hyperotaserver.workspace_names (
    id SERIAL PRIMARY KEY,
    organization_id TEXT NOT NULL,
    workspace_name TEXT NOT NULL,
    UNIQUE(workspace_name)
); 