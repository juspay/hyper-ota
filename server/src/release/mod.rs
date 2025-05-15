use actix_web::{
    error, get,
    web::{self, Json},
    Result, Scope,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use superposition_rust_sdk::apis::default_api::get_resolved_config;

use crate::utils::db::schema::hyperotaserver::configs::dsl::{
    app_id as config_app_id, configs as configs_table, org_id as config_org_id,
    version as config_version,
};
use crate::{
    types::AppState,
    utils::db::{
        models::{ConfigEntry, PackageEntryRead},
        schema::hyperotaserver::configs,
    },
};

use crate::utils::db::schema::hyperotaserver::packages::dsl::*;

use diesel::prelude::*;
use diesel::ExpressionMethods;
use diesel::QueryDsl;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(serve_release)
        .service(serve_release_v2)
}

#[derive(Serialize, Debug)]
struct ReleaseConfig {
    config: Config,
    package: Package,
    resources: serde_json::Value,
}

#[derive(Serialize, Debug)]
struct Config {
    version: String,
    release_config_timeout: u32,
    package_timeout: u32,
    properties: ConfigProperties,
}

#[derive(Serialize, Debug)]
struct ConfigProperties {
    tenant_info: serde_json::Value,
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
    properties: serde_json::Value,
}

#[derive(Deserialize, Debug)]
struct InnerPackage {
    version: i32,
}

#[derive(Serialize, Debug)]
struct Package {
    name: String,
    version: String,
    properties: PackagePropertiesV1,
    index: String,
    splits: Vec<String>,
}

fn decode_to_config(value: Value) -> Result<PackageMeta> {
    println!("Decoding config from value: {:?}", value);
    let package_meta: Map<String, Value> = serde_json::from_value(value).unwrap();
    println!("Decoded package_meta: {:?}", package_meta);

    let mut nested = Map::new();
    for (key, value) in package_meta.iter() {
        println!("Processing key-value pair: {} = {:?}", key, value);
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

    println!("Final nested structure: {:?}", nested);

    let config: Option<ConfigMeta> = nested.get("config").and_then(|v| {
        println!("Config value before parsing: {:?}", v);
        let mut config_obj = v.as_object().unwrap().clone();
        // Add properties from root level
        if let Some(props) = nested.get("properties") {
            config_obj.insert("properties".to_string(), props.clone());
        }
        let result = serde_json::from_value(Value::Object(config_obj));
        println!("Config parsing result: {:?}", result);
        result.ok()
    });
    let package: Option<InnerPackage> = nested.get("package").and_then(|v| {
        println!("Package value before parsing: {:?}", v);
        let result = serde_json::from_value(v.clone());
        println!("Package parsing result: {:?}", result);
        result.ok()
    });

    let config_exists = config.is_some();
    let package_exists = package.is_some();

    match (config, package) {
        (Some(config), Some(package)) => Ok(PackageMeta { config, package }),
        _ => {
            println!(
                "Failed to decode - config: {:?}, package: {:?}",
                config_exists, package_exists
            );
            Err(error::ErrorInternalServerError("Failed to decode JSON"))
        }
    }
}

fn decode_to_config_v2(value: Value) -> Result<PackageMeta> {
    let package_meta: Map<String, Value> = serde_json::from_value(value.clone()).unwrap();

    // Extract direct values for config
    let config = ConfigMeta {
        version: package_meta
            .get("config.version")
            .and_then(|v| v.as_str())
            .unwrap_or("0.0.0")
            .to_string(),
        release_config_timeout: package_meta
            .get("config.release_config_timeout")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i32,
        package_timeout: package_meta
            .get("config.package_timeout")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i32,
        properties: package_meta.get("properties").cloned().unwrap_or(json!({})),
    };

    // Extract package version
    let package = InnerPackage {
        version: package_meta
            .get("package.version")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i32,
    };

    Ok(PackageMeta { config, package })
}

#[get("{organisation}/{application}")]
async fn serve_release(
    path: web::Path<(String, String)>,
    state: web::Data<AppState>,
) -> Result<Json<ReleaseConfig>> {
    println!("serve_release : {:?}", path);
    let (organisation, application) = path.into_inner();
    // Check CAC to find which package to use.
    // Read Package from the DB
    // Read Other keys from CAC

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    println!("conn : {:?}", "connection");

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();


    let config = get_resolved_config(
        &state.superposition_configuration,
        &superposition_org_id_from_env,
        &application,
        None,
        None,
        None,
        Some(superposition_rust_sdk::models::MergeStrategy::Merge),
        Some(json!({})), // TODO: Add Find out how to add custom dimesions
    )
    .await
    .map_err(|e| error::ErrorInternalServerError(format!("Failed to get config: {}", e)))?;

    println!("config : {:?}", config);

    let packages_meta = decode_to_config(config)?;
    // TODO: Change CAC type to have package version
    // Add properties based on package settings.
    // TODO : Find out resource structure
    println!("packages_meta : {:?}", packages_meta);

    let package_data = packages
        .filter(
            org_id
                .eq(&organisation)
                .and(app_id.eq(&application))
                .and(version.eq(packages_meta.package.version)),
        )
        .first::<PackageEntryRead>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => {
                println!(
                    "No package found for org: {}, app: {}, version: {}",
                    organisation, application, packages_meta.package.version
                );
                error::ErrorNotFound(format!(
                    "No package found for version {} of application {}",
                    packages_meta.package.version, application
                ))
            }
            _ => {
                println!("Database error while fetching package: {:?}", e);
                error::ErrorInternalServerError(e)
            }
        })?;

    println!("package_data : {:?}", package_data);

    let mut splits = package_data
        .contents
        .iter()
        .filter_map(|s| s.clone())
        .collect::<Vec<String>>();
    let mut package_index = package_data.index.clone();
    if !package_data.use_urls {
        splits = package_data
            .contents
            .iter()
            .filter_map(|opt_file_name| {
                opt_file_name.as_ref().map(|file_name| {
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
            properties: ConfigProperties {
                tenant_info: packages_meta.config.properties,
            },
        },
        package: Package {
            name: package_data.app_id,
            version: packages_meta.package.version.to_string(),
            properties: PackagePropertiesV1 {
                manifest: json!({}),
                manifest_hash: json!({}),
            },
            index: package_index,
            splits,
        },
        resources: json!({}),
    }))
}

#[derive(Debug, Deserialize, Serialize)]
struct PackagePropertiesV1 {
    manifest: serde_json::Value,
    manifest_hash: serde_json::Value,
}

#[get("v2/{organisation}/{application}")]
async fn serve_release_v2(
    path: web::Path<(String, String)>,
    state: web::Data<AppState>,
) -> Result<Json<ReleaseConfig>> {
    let (organisation, application) = path.into_inner();
    println!(
        "Serving release for org: {}, app: {}",
        organisation, application
    );

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let config = get_resolved_config(
        &state.superposition_configuration,
        &superposition_org_id_from_env,
        &application,
        None,
        None,
        None,
        Some(superposition_rust_sdk::models::MergeStrategy::Merge),
        Some(json!({})),
    )
    .await
    .map_err(|e| error::ErrorInternalServerError(format!("Failed to get config: {}", e)))?;

    println!("Got resolved config from Superposition: {:?}", config);

    let packages_meta = decode_to_config_v2(config)?;
    println!("Successfully decoded packages meta: {:?}", packages_meta);

    // If version is 0, get the latest version
    let package_version = if packages_meta.package.version == 0 {
        packages
            .filter(org_id.eq(&organisation).and(app_id.eq(&application)))
            .select(diesel::dsl::max(version))
            .first::<Option<i32>>(&mut conn)
            .map_err(|e| {
                error::ErrorInternalServerError(format!("Failed to get latest version: {}", e))
            })?
            .ok_or_else(|| error::ErrorNotFound("No packages found"))?
    } else {
        packages_meta.package.version
    };

    // Get both package and config data
    let package_data = packages
        .filter(
            org_id
                .eq(&organisation)
                .and(app_id.eq(&application))
                .and(version.eq(package_version)),
        )
        .first::<PackageEntryRead>(&mut conn)
        .map_err(|_| error::ErrorNotFound("Package not found"))?;

    let config_data = configs_table
        .filter(
            config_org_id
                .eq(&organisation)
                .and(config_app_id.eq(&application))
                .and(config_version.eq(package_version)),
        )
        .select(ConfigEntry::as_select())
        .first::<ConfigEntry>(&mut conn)
        .map_err(|_| error::ErrorNotFound("Config not found"))?;

    Ok(Json(ReleaseConfig {
        config: Config {
            version: config_data.config_version,
            release_config_timeout: config_data.release_config_timeout as u32,
            package_timeout: config_data.package_timeout as u32,
            properties: ConfigProperties {
                tenant_info: config_data.tenant_info,
            },
        },
        package: Package {
            name: package_data.app_id,
            version: config_data.version.to_string(),
            properties: PackagePropertiesV1 {
                manifest: config_data
                    .properties
                    .get("manifest")
                    .cloned()
                    .unwrap_or_default(),
                manifest_hash: config_data
                    .properties
                    .get("manifest_hash")
                    .cloned()
                    .unwrap_or_default(),
            },
            index: package_data.index,
            splits: package_data
                .contents
                .iter()
                .filter_map(|s| s.clone())
                .collect(),
        },
        resources: json!({}),
    }))
}
