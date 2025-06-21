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

use std::collections::HashMap;

use actix_web::{
    error::{self},
    get,
    web::{self, Json},
    Result, Scope,
};
use aws_smithy_types::Document;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use superposition_rust_sdk::operation::get_resolved_config::GetResolvedConfigOutput;

use crate::utils::{
    db::schema::hyperotaserver::configs::dsl::{
        app_id as config_app_id, configs as configs_table, org_id as config_org_id,
        version as config_version,
    },
    workspace::get_workspace_name_for_application,
    document::document_to_json_value,
};
use crate::{
    types::AppState,
    utils::db::models::{ConfigEntry, PackageEntryRead},
};

use crate::utils::db::schema::hyperotaserver::packages::dsl::*;

use diesel::prelude::*;
use diesel::ExpressionMethods;
use diesel::QueryDsl;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(serve_release)
        .service( 
            Scope::new("/v2")
                .service(serve_release),
        )
}

#[derive(Serialize, Debug)]
struct ReleaseConfig {
    version: String,
    config: Config,
    package: Package,
    resources: serde_json::Value,
}

#[derive(Serialize, Debug)]
struct Config {
    version: String,
    release_config_timeout: u32,
    boot_timeout: u32,
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

#[derive(Debug, Deserialize, Serialize)]
struct File {
    url: String,
    #[serde(rename = "filePath")]
    file_path: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct Package {
    name: String,
    version: String,
    properties: serde_json::Value,
    index: File,
    important: Vec<File>,
    lazy: Vec<File>,
}

fn decode_to_config_v2(value: GetResolvedConfigOutput) -> Result<PackageMeta> {
    if let Some(package_meta) = value.config.map(|doc| {
        document_to_json_value(&doc)
            .as_object()
            .map(|a| a.clone())
            .unwrap_or_else(|| Map::new())
    }) {
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
    } else {
        println!("Failed to decode package_meta from GetResolvedConfigOutput");
        Err(error::ErrorInternalServerError("Failed to decode JSON"))
    }
}

fn parse_kv_string(input: &str) -> HashMap<String, Value> {
    input
        .split(';')
        .filter(|pair| !pair.is_empty())
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let key = parts.next()?.trim();
            let value = parts.next()?.trim();
            Some((key.to_string(), Value::String(value.to_string())))
        })
        .collect()
}

#[get("{organisation}/{application}")]
async fn serve_release(
    path: web::Path<(String, String)>,
    query: web::Query<std::collections::HashMap<String, String>>,
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
) -> Result<Json<ReleaseConfig>> {
    let (organisation, application) = path.into_inner();
    println!(
        "Serving release for org: {}, app: {}",
        organisation, application
    );
    println!("Query parameters: {:?}", query);


    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to get workspace name: {}", e))
        })?;

    let context: HashMap<String, Value> =req
        .headers()
        .get("x-dimension")
        .and_then(|val| val.to_str().ok())
        .map(|val| parse_kv_string(val))
        .unwrap_or_else(|| HashMap::new());

    println!("context: {:?}", context);

    println!("workspace_name: {}", workspace_name);
    println!(
        "superposition_org_id_from_env: {}",
        superposition_org_id_from_env
    );

    let applicable_variants =
        context.iter().fold(
            state
                .superposition_client
                .applicable_variants()
                .workspace_id(workspace_name.clone())
                .org_id(superposition_org_id_from_env.clone())
                .toss(-1)
                .context("dummy", Document::from("dummy_value")),
            |builder, (key, value)| {
                builder.context(key.clone(), Document::String(value.as_str().unwrap_or("").to_string()))
            },
        );
    let applicable_variants =
        applicable_variants
        .send()
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to get applicable variants: {}", e))
        })?;

    println!("applicable_variants: {:?}", applicable_variants);

    let applicable_variants_ids = applicable_variants
        .data
        .iter()
        .map(|v| Document::from(v.id.clone()))
        .collect::<Vec<_>>();

    let resolved_config_builder = context.iter().fold(
        state
            .superposition_client
            .get_resolved_config()
            .workspace_id(workspace_name.clone())
            .org_id(superposition_org_id_from_env.clone())
            .context("region", Document::from("tamilnadu"))
            .context("variantIds", Document::from(applicable_variants_ids)),
        |builder, (key, value)| builder.context(key.clone(), Document::String(value.as_str().unwrap_or("").to_string())),
    );

    let config = resolved_config_builder.send().await.map_err(|e| {
        error::ErrorInternalServerError(format!("Failed to get resolved config: {}", e))
    })?;

    println!("config from superposition: {:?}", config);

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

    Ok(Json(ReleaseConfig {
        version: config_data.version.to_string(),
        config: Config {
            version: config_data.config_version,
            release_config_timeout: config_data.release_config_timeout as u32,
            boot_timeout: config_data.package_timeout as u32,
            properties: ConfigProperties {
                tenant_info: config_data.tenant_info,
            },
        },
        package: Package {
            name: package_data.app_id,
            version: config_data.version.to_string(),
            properties: json!({"hello" : "world"}), // TODO: Add properties based on package settings.
            index: File {
                url: package_data.index,
                file_path: "index.android.bundle".to_string(),
            },
            important: important_files,
            lazy: lazy_files,
        },
        resources: package_data.resources,
    }))
}
