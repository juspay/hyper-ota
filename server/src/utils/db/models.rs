use diesel::prelude::*;

use crate::utils::db::schema::hyperotaserver::{organisations, packages};

#[derive(Insertable, Queryable)]
#[diesel(table_name = organisations)]
pub struct OrgEnty {
    pub name: String,
    pub superposition_organisation: String,
}

#[derive(Insertable)]
#[diesel(table_name = packages)]
pub struct PackageEntry {
    pub version: i32,
    pub app_id: String,
    pub org_id: String,
    pub index: String,
    pub version_splits: bool,
    pub contents: Vec<String>,
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = packages)]
pub struct PackageEntryRead {
    pub id: uuid::Uuid,
    pub version: i32,
    pub app_id: String,
    pub org_id: String,
    pub index: String,
    pub version_splits: bool,
    pub use_urls: bool,
    pub contents: Vec<String>,
}
