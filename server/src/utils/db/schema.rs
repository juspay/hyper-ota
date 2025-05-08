// @generated automatically by Diesel CLI.

pub mod hyperotaserver {
    diesel::table! {
        hyperotaserver.organisations (name) {
            name -> Text,
            superposition_organisation -> Text,
        }
    }

    diesel::table! {
        hyperotaserver.packages (id) {
            id -> Uuid,
            version -> Int4,
            app_id -> Text,
            org_id -> Text,
            index -> Text,
            version_splits -> Bool,
            use_urls -> Bool,
            contents -> Array<Text>,
        }
    }

    diesel::allow_tables_to_appear_in_same_query!(organisations, packages,);
}
