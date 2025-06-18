// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use actix_web::{
    error, get,
    web::{self, Json},
    Result, Scope,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use superposition_rust_sdk::apis::default_api::{applicable_variants, get_resolved_config};

use crate::utils::{db::schema::hyperotaserver::configs::dsl::{
    app_id as config_app_id, configs as configs_table, org_id as config_org_id,
    version as config_version,
}, workspace::get_workspace_name_for_application};
use crate::{
    types::AppState,
    utils::db::{
        models::{ConfigEntry, PackageEntryRead},
    },
};

use crate::utils::db::schema::hyperotaserver::packages::dsl::*;

use diesel::prelude::*;
use diesel::ExpressionMethods;
use diesel::QueryDsl;

pub fn add_routes() -> Scope {
    Scope::new("")
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

#[derive(Debug, Deserialize, Serialize, Default)]
struct File {
    url: String,
    #[serde(rename = "filePath")]
    file_path: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct Package {
    name: String,
    version: String,
    #[serde(flatten)]
    properties: serde_json::Value,
    index: File,
    important: Vec<File>,
    lazy: Vec<File>,
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


#[get("v2/{organisation}/{application}")]
async fn serve_release_v2(
    path: web::Path<(String, String)>,
    query: web::Query<std::collections::HashMap<String, String>>,
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

    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn).await
        .map_err(|e| error::ErrorInternalServerError(format!("Failed to get workspace name: {}", e)))?;

    // Extract context from query if provided
    let context = if let Some(context) = query.get("context") {
        serde_json::from_str(context).unwrap_or(json!({}))
    } else {
        json!({})
    };

    println!("workspace_name: {}", workspace_name);
    println!("superposition_org_id_from_env: {}", superposition_org_id_from_env);

    println!("Using context: {:?}", context);

    let applicable_variants  = applicable_variants( 
        &state.superposition_configuration,
        &superposition_org_id_from_env,
        &workspace_name)
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to get applicable variants: {}", e))
        })?;

    let mut context_with_variants = context.as_object().unwrap_or(&serde_json::Map::new()).clone();
    context_with_variants.insert("variants".to_string(), json!(applicable_variants));
    let final_context = serde_json::Value::Object(context_with_variants);

    let config = get_resolved_config(
        &state.superposition_configuration,
        &superposition_org_id_from_env,
        &workspace_name,
        None,
        None,
        None,
        Some(superposition_rust_sdk::models::MergeStrategy::Merge),
        Some(final_context),
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

    // Convert important and lazy files from JSON back to Vec<File>
    let important_files: Vec<File> = 
        serde_json::from_value(package_data.important.clone()).unwrap_or_default();
    let lazy_files: Vec<File> = 
        serde_json::from_value(package_data.lazy.clone()).unwrap_or_default();
    let index_file: File = 
        serde_json::from_value(package_data.index.clone()).unwrap_or_default();

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
            properties: config_data.properties.clone(),
            index: index_file,
            important: important_files,
            lazy: lazy_files,
        },
        resources: package_data.resources,
    }))
}
