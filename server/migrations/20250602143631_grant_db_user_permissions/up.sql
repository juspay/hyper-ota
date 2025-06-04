-- Grant comprehensive permissions to DB_USER (hyperotaserver) for hyperotaserver schema

-- 1. Grant usage on the hyperotaserver schema
GRANT USAGE ON SCHEMA hyperotaserver TO hyperotaserver;

-- 2. Grant all privileges on the hyperotaserver schema itself
GRANT CREATE ON SCHEMA hyperotaserver TO hyperotaserver;

-- 3. Grant all privileges on all existing tables in hyperotaserver schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hyperotaserver TO hyperotaserver;

-- 4. Grant all privileges on all sequences in hyperotaserver schema (for SERIAL columns)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA hyperotaserver TO hyperotaserver;

-- 5. Grant all privileges on all functions in hyperotaserver schema
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA hyperotaserver TO hyperotaserver;

-- 6. Set default privileges for future tables created in hyperotaserver schema
ALTER DEFAULT PRIVILEGES IN SCHEMA hyperotaserver GRANT ALL ON TABLES TO hyperotaserver;

-- 7. Set default privileges for future sequences created in hyperotaserver schema
ALTER DEFAULT PRIVILEGES IN SCHEMA hyperotaserver GRANT ALL ON SEQUENCES TO hyperotaserver;

-- 8. Set default privileges for future functions created in hyperotaserver schema
ALTER DEFAULT PRIVILEGES IN SCHEMA hyperotaserver GRANT ALL ON FUNCTIONS TO hyperotaserver;

-- 9. Grant database-level permissions
GRANT CONNECT ON DATABASE hyperotaserver TO hyperotaserver;
GRANT TEMPORARY ON DATABASE hyperotaserver TO hyperotaserver;
GRANT CREATE ON DATABASE hyperotaserver TO hyperotaserver;

-- 10. Grant usage on the public schema (for extensions like pgcrypto)
GRANT USAGE ON SCHEMA public TO hyperotaserver;

-- 11. Grant execute on all functions in public schema (for pgcrypto functions like gen_random_uuid)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO hyperotaserver;

-- 12. Set default privileges for future functions in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO hyperotaserver;

-- 13. Specifically grant usage on the pgcrypto extension functions
-- This ensures access to gen_random_uuid() and other crypto functions
GRANT EXECUTE ON FUNCTION gen_random_uuid() TO hyperotaserver;

-- Add a comment to track this migration
COMMENT ON SCHEMA hyperotaserver IS 'Schema with full permissions granted to hyperotaserver user via migration 2025-06-02-143631';
