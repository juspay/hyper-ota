// @generated automatically by Diesel CLI.

pub mod hyperotaserver {
    diesel::table! {
        hyperotaserver.cleanup_outbox (transaction_id) {
            transaction_id -> Text,
            entity_name -> Text,
            entity_type -> Text,
            state -> Jsonb,
            created_at -> Timestamptz,
            attempts -> Int4,
            last_attempt -> Nullable<Timestamptz>,
        }
    }

    diesel::table! {
        hyperotaserver.configs (id) {
            id -> Int4,
            org_id -> Text,
            app_id -> Text,
            version -> Int4,
            config_version -> Text,
            release_config_timeout -> Int4,
            package_timeout -> Int4,
            tenant_info -> Jsonb,
            properties -> Jsonb,
            created_at -> Timestamp,
        }
    }

    diesel::table! {
        hyperotaserver.packages (id) {
            id -> Uuid,
            version -> Int4,
            app_id -> Text,
            org_id -> Text,
            index -> Jsonb,
            version_splits -> Bool,
            use_urls -> Bool,
            important -> Jsonb,
            lazy -> Jsonb,
            properties -> Jsonb,
            resources -> Jsonb,
        }
    }

    diesel::table! {
        hyperotaserver.releases (id) {
            id -> Uuid,
            org_id -> Text,
            app_id -> Text,
            package_version -> Int4,
            config_version -> Text,
            created_at -> Timestamptz,
            created_by -> Text,
            metadata -> Jsonb,
        }
    }

    diesel::table! {
        hyperotaserver.workspace_names (id) {
            id -> Int4,
            organization_id -> Text,
            workspace_name -> Text,
        }
    }

    diesel::allow_tables_to_appear_in_same_query!(
        cleanup_outbox,
        configs,
        packages,
        releases,
        workspace_names,
    );
}
