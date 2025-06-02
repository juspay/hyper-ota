use chrono::{DateTime, Utc};
use diesel::deserialize::Queryable;
use diesel::pg::Pg;
use diesel::prelude::*;
use diesel::sql_types::Json;

use crate::utils::db::schema::hyperotaserver::{
    cleanup_outbox, configs, packages, releases,
};

#[derive(Insertable, Debug)]
#[diesel(table_name = packages)]
pub struct PackageEntry {
    pub version: i32,
    pub app_id: String,
    pub org_id: String,
    pub index: String,
    pub version_splits: bool,
    pub use_urls: bool,
    pub contents: Vec<Option<String>>,
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
    pub contents: Vec<Option<String>>,
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
