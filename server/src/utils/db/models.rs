use chrono::{DateTime, Utc};
use diesel::deserialize::Queryable;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::utils::db::schema::hyperotaserver::{
    cleanup_outbox, configs, packages, releases, workspace_names,
};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct File {
    pub url: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = packages)]
pub struct PackageEntry {
    pub version: i32,
    pub app_id: String,
    pub org_id: String,
    pub index: String,
    pub version_splits: bool,
    pub use_urls: bool,
    pub important: serde_json::Value,
    pub lazy: serde_json::Value,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub properties: serde_json::Value,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub resources: serde_json::Value,
}

#[derive(Queryable, Selectable, Debug)]
#[diesel(table_name = packages)]
pub struct PackageEntryRead {
    pub id: uuid::Uuid,
    pub version: i32,
    pub app_id: String,
    pub org_id: String,
    pub index: String,
    pub version_splits: bool,
    pub use_urls: bool,
    pub important: serde_json::Value,
    pub lazy: serde_json::Value,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub properties: serde_json::Value,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub resources: serde_json::Value,
}

#[derive(Queryable, Insertable, Debug, Selectable)]
#[diesel(table_name = configs)]
pub struct ConfigEntry {
    pub org_id: String,
    pub app_id: String,
    pub version: i32,
    pub config_version: String,
    pub release_config_timeout: i32,
    pub package_timeout: i32,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub tenant_info: serde_json::Value,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub properties: serde_json::Value,
}

#[derive(Queryable, Insertable, Debug)]
#[diesel(table_name = cleanup_outbox)]
pub struct CleanupOutboxEntry {
    pub transaction_id: String,
    pub entity_name: String,
    pub entity_type: String,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub state: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub attempts: i32,
    pub last_attempt: Option<DateTime<Utc>>,
}

#[derive(Queryable, Insertable, Debug, Selectable)]
#[diesel(table_name = releases)]
pub struct ReleaseEntry {
    pub id: uuid::Uuid,
    pub org_id: String,
    pub app_id: String,
    pub package_version: i32,
    pub config_version: String,
    pub created_at: DateTime<Utc>,
    pub created_by: String,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub metadata: serde_json::Value,
}

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug)]
#[diesel(table_name = workspace_names)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct WorkspaceName {
    pub id: i32,
    pub organization_id: String,
    pub workspace_name: String,
    // pub created_at: DateTime<Utc>,
}

#[derive(Insertable, Selectable)]
#[diesel(table_name = workspace_names)]
pub struct NewWorkspaceName<'a> {
    pub organization_id: &'a str,
    pub workspace_name: &'a str,
}
