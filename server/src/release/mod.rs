use actix_web::{
    error, get,
    web::{self, Json},
    Result, Scope,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use superposition_rust_sdk::apis::default_api::get_resolved_config;

use crate::{
    types::AppState,
    utils::db::models::{OrgEnty, PackageEntryRead},
};

use crate::utils::db::schema::hyperotaserver::organisations::dsl::*;
use crate::utils::db::schema::hyperotaserver::packages::dsl::*;

use diesel::prelude::*;
use diesel::ExpressionMethods;
use diesel::QueryDsl;

pub fn add_routes() -> Scope {
    Scope::new("").service(serve_release)
}

#[derive(Serialize, Debug)]
struct ReleaseConfig {
    config: Config,
    package: Package,
    // resources: Resources
}

#[derive(Serialize, Debug)]
struct Config {
    version: String,
    release_config_timeout: u32,
    package_timeout: u32,
    // properties: Properties
}

#[derive(Deserialize, Debug)]
struct PackageMeta {
    config: ConfigMeta,
    package: InnerPackage,
}

#[derive(Deserialize, Debug)]
struct ConfigMeta {
    version: String,
    release_config_timeout: i32,
    package_timeout: i32,
}

#[derive(Deserialize, Debug)]
struct InnerPackage {
    version: i32,
}

#[derive(Serialize, Debug)]
struct Package {
    name: String,
    version: String,
    // properties: Properties,
    index: String,
    splits: Vec<String>,
}

fn decode_to_config(value: Value) -> Result<PackageMeta> {
    let package_meta: Map<String, Value> = serde_json::from_value(value).unwrap();
    let mut nested = Map::new();
    for (key, value) in package_meta.iter() {
        let parts: Vec<&str> = key.split('.').collect();
        let mut current = &mut nested;
        for (i, part) in parts.iter().enumerate() {
            if i == parts.len() - 1 {
                current.insert((*part).to_string(), value.clone());
            } else {
                current = current
                    .entry(part.to_string())
                    .or_insert_with(|| Value::Object(Map::new()))
                    .as_object_mut()
                    .unwrap();
            }
        }
    }

    let config: Option<ConfigMeta> = nested
        .get("config")
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    let package: Option<InnerPackage> = nested
        .get("package")
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    match (config, package) {
        (Some(config), Some(package)) => Ok(PackageMeta { config, package }),
        _ => Err(error::ErrorInternalServerError("Failed to decode JSON")),
    }
}

#[get("{organisation}/{application}")]
async fn serve_release(
    path: web::Path<(String, String)>,
    state: web::Data<AppState>,
) -> Result<Json<ReleaseConfig>> {
    let (organisation, application) = path.into_inner();
    // Check CAC to find which package to use.
    // Read Package from the DB
    // Read Other keys from CAC

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let org_entry = organisations
        .filter(name.eq(organisation.clone()))
        .first::<OrgEnty>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    let config = get_resolved_config(
        &state.superposition_configuration,
        &org_entry.superposition_organisation,
        &application,
        None,
        None,
        None,
        Some(superposition_rust_sdk::models::MergeStrategy::Merge),
        Some(json!({})), // TODO: Add Find out how to add custom dimesions
    )
    .await
    .map_err(|e| error::ErrorInternalServerError(format!("Failed to get config: {}", e)))?;

    let packages_meta = decode_to_config(config)?;
    // TODO: Change CAC type to have package version
    // Add properties based on package settings.
    // TODO : Find out resource structure

    let package_data = packages
        .filter(
            org_id
                .eq(&organisation)
                .and(app_id.eq(&application))
                .and(version.eq(packages_meta.package.version)),
        )
        .first::<PackageEntryRead>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    let mut splits = package_data.contents.clone();
    let mut package_index = package_data.index.clone();
    if !package_data.use_urls {
        splits = package_data
            .contents
            .iter()
            .map(|file_name| {
                if package_data.version_splits {
                    format!(
                        "{}/assets/{}/{}/{}/{}",
                        &state.env.public_url,
                        &package_data.org_id,
                        &package_data.app_id,
                        package_data.version,
                        file_name
                    )
                } else {
                    format!(
                        "{}/assets/{}/{}/{}",
                        &state.env.public_url,
                        &package_data.org_id,
                        &package_data.app_id,
                        file_name
                    )
                }
            })
            .collect::<Vec<String>>();
        package_index = format!(
            "{}/assets/{}/{}/{}/{}",
            &state.env.public_url,
            &package_data.org_id,
            &package_data.app_id,
            package_data.version,
            package_data.index
        );
    }

    Ok(Json(ReleaseConfig {
        config: Config {
            version: packages_meta.config.version,
            release_config_timeout: packages_meta.config.release_config_timeout as u32,
            package_timeout: packages_meta.config.package_timeout as u32,
        },
        package: Package {
            name: package_data.app_id,
            version: packages_meta.package.version.to_string(),
            index: package_index,
            splits,
        },
    }))
}
