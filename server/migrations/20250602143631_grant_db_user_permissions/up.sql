-- Only execute permission grants if the hyperotaserver user exists
DO $$
BEGIN
    -- Check if the hyperotaserver user exists
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_user WHERE usename = 'hyperotaserver') THEN
        
        RAISE NOTICE 'DB_USER "hyperotaserver" found. Granting permissions...';
        
        -- 1. Grant usage on the hyperotaserver schema
        GRANT USAGE ON SCHEMA hyperotaserver TO hyperotaserver;

        -- 2. Grant all privileges on the hyperotaserver schema itself
        GRANT CREATE ON SCHEMA hyperotaserver TO hyperotaserver;

        -- 3. Grant all privileges on all existing tables in hyperotaserver schema
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hyperotaserver TO hyperotaserver;

        -- 4. Grant all privileges on all sequences in hyperotaserver schema
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA hyperotaserver TO hyperotaserver;

        -- 5. Grant all privileges on all functions in hyperotaserver schema
        GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA hyperotaserver TO hyperotaserver;

        -- 6-8. Set default privileges
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA hyperotaserver GRANT ALL ON TABLES TO hyperotaserver';
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA hyperotaserver GRANT ALL ON SEQUENCES TO hyperotaserver';
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA hyperotaserver GRANT ALL ON FUNCTIONS TO hyperotaserver';

        -- 9. Grant database-level permissions
        GRANT CONNECT ON DATABASE hyperotaserver TO hyperotaserver;
        GRANT TEMPORARY ON DATABASE hyperotaserver TO hyperotaserver;
        GRANT CREATE ON DATABASE hyperotaserver TO hyperotaserver;

        -- 10-12. Public schema & pgcrypto
        GRANT USAGE ON SCHEMA public TO hyperotaserver;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO hyperotaserver;
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO hyperotaserver';

        -- 13. Try to grant gen_random_uuid, but ignore if missing
        BEGIN
            GRANT EXECUTE ON FUNCTION gen_random_uuid() TO hyperotaserver;
        EXCEPTION
            WHEN undefined_function THEN
                RAISE NOTICE 'Function gen_random_uuid() not found. Skipping specific grant.';
        END;

        -- Comment for tracking
        COMMENT ON SCHEMA hyperotaserver IS 'Schema with full permissions granted to hyperotaserver user via migration 2025-06-02-143631';

    ELSE
        RAISE NOTICE 'DB_USER "hyperotaserver" not found. Skipping grant.';
    END IF;
END
$$;