-- This file should undo anything in `up.sql`

-- Revoke comprehensive permissions from DB_USER (hyperotaserver) for hyperotaserver schema

-- 1. Remove comment
COMMENT ON SCHEMA hyperotaserver IS NULL;

-- 2. Revoke permissions on information_schema and pg_catalog
REVOKE SELECT ON ALL TABLES IN SCHEMA pg_catalog FROM hyperotaserver;
REVOKE SELECT ON ALL TABLES IN SCHEMA information_schema FROM hyperotaserver;

-- 3. Revoke specific pgcrypto function permissions
REVOKE EXECUTE ON FUNCTION gen_random_uuid() FROM hyperotaserver;

-- 4. Revoke default privileges for future functions in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM hyperotaserver;

-- 5. Revoke execute on all functions in public schema
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM hyperotaserver;

-- 6. Revoke usage on the public schema
REVOKE USAGE ON SCHEMA public FROM hyperotaserver;

-- 7. Revoke database-level permissions
REVOKE CREATE ON DATABASE hyperotaserver FROM hyperotaserver;
REVOKE TEMPORARY ON DATABASE hyperotaserver FROM hyperotaserver;
-- Note: We don't revoke CONNECT as that would prevent the user from connecting

-- 8. Revoke default privileges for future objects in hyperotaserver schema
ALTER DEFAULT PRIVILEGES IN SCHEMA hyperotaserver REVOKE ALL ON FUNCTIONS FROM hyperotaserver;
ALTER DEFAULT PRIVILEGES IN SCHEMA hyperotaserver REVOKE ALL ON SEQUENCES FROM hyperotaserver;
ALTER DEFAULT PRIVILEGES IN SCHEMA hyperotaserver REVOKE ALL ON TABLES FROM hyperotaserver;

-- 9. Revoke all privileges on existing objects in hyperotaserver schema
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA hyperotaserver FROM hyperotaserver;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA hyperotaserver FROM hyperotaserver;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA hyperotaserver FROM hyperotaserver;

-- 10. Revoke schema-level privileges
REVOKE CREATE ON SCHEMA hyperotaserver FROM hyperotaserver;
REVOKE USAGE ON SCHEMA hyperotaserver FROM hyperotaserver;
