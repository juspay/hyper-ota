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
    error, get, post,
    web::{self, Json, ReqData},
    Result, Scope,
};
use aws_smithy_types::Document;
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use superposition_rust_sdk::types::builders::VariantBuilder;
use uuid::Uuid;

use crate::{
    middleware::auth::{validate_user, AuthResponse, READ, WRITE},
    types::AppState,
    utils::{
        db::{
            models::{PackageEntryRead, ReleaseEntry},
            schema::hyperotaserver::releases::dsl::*,
        },
        workspace::get_workspace_name_for_application,
    },
};

pub fn add_routes() -> Scope {
    Scope::new("").service(create).service(list_releases)
}

#[derive(Debug, Deserialize)]
struct CreateRequest {
    version_id: Option<String>,
    metadata: Option<serde_json::Value>,
    context: Option<serde_json::Value>, // Changed to accept JsonLogic format directly
}

#[derive(Serialize)]
struct CreateResponse {
    id: String,
    created_at: DateTime<Utc>,
    package_version: i32,
    config_version: String,
}

#[derive(Serialize)]
struct ReleaseHistoryResponse {
    releases: Vec<ReleaseHistoryEntry>,
}

#[derive(Serialize)]
struct ReleaseHistoryEntry {
    id: String,
    package_version: i32,
    config_version: String,
    created_at: DateTime<Utc>,
    created_by: String,
    metadata: serde_json::Value,
}

#[post("/create")]
async fn create(
    req: Json<CreateRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<CreateResponse>> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let pkg_version = if let Some(version_str) = req.version_id.clone() {
        version_str.parse::<i32>().map_err(|_| {
            error::ErrorBadRequest(format!("Invalid version ID format: {}", version_str))
        })?
    } else {
        crate::utils::db::schema::hyperotaserver::packages::dsl::packages
            .filter(
                crate::utils::db::schema::hyperotaserver::packages::dsl::org_id
                    .eq(&organisation)
                    .and(
                        crate::utils::db::schema::hyperotaserver::packages::dsl::app_id
                            .eq(&application),
                    ),
            )
            .select(diesel::dsl::max(
                crate::utils::db::schema::hyperotaserver::packages::dsl::version,
            ))
            .first::<Option<i32>>(&mut conn)
            .map_err(error::ErrorInternalServerError)?
            .ok_or_else(|| error::ErrorNotFound("No packages found for this application"))?
    };

    // Verify package exists
    crate::utils::db::schema::hyperotaserver::packages::dsl::packages
        .filter(
            crate::utils::db::schema::hyperotaserver::packages::dsl::org_id
                .eq(&organisation)
                .and(
                    crate::utils::db::schema::hyperotaserver::packages::dsl::app_id
                        .eq(&application),
                )
                .and(
                    crate::utils::db::schema::hyperotaserver::packages::dsl::version
                        .eq(pkg_version),
                ),
        )
        .first::<PackageEntryRead>(&mut conn)
        .map_err(|_| error::ErrorNotFound(format!("Package version {} not found", pkg_version)))?;

    let config = crate::utils::db::schema::hyperotaserver::configs::dsl::configs
        .filter(
            crate::utils::db::schema::hyperotaserver::configs::dsl::org_id
                .eq(&organisation)
                .and(
                    crate::utils::db::schema::hyperotaserver::configs::dsl::app_id.eq(&application),
                )
                .and(
                    crate::utils::db::schema::hyperotaserver::configs::dsl::version.eq(pkg_version),
                ),
        )
        .select(crate::utils::db::models::ConfigEntry::as_select())
        .first(&mut conn)
        .map_err(|_| {
            error::ErrorNotFound(format!(
                "Config for package version {} not found",
                pkg_version
            ))
        })?;

    let release_id = Uuid::new_v4();
    let now = Utc::now();
    let user_id = auth_response.sub.clone();

    // Use superposition_org_id from environment
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    println!(
        "Using Superposition Org ID from environment for create release: {}",
        superposition_org_id_from_env
    );

    // Get workspace name for this application
    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to get workspace name: {}", e))
        })?;
    println!(
        "Using workspace name for create release: {}",
        workspace_name
    );

    // Create context and variants for the experiment
    let mut context_map: std::collections::HashMap<String, serde_json::Value> =
        std::collections::HashMap::new();
    if let Some(context) = &req.context {
        context_map =
            serde_json::from_value(context.clone()).map_err(error::ErrorInternalServerError)?;
    }

    // Create control variant with release configuration
    let mut control_overrides = std::collections::HashMap::new();
    control_overrides.insert(
        "package.version".to_string(),
        Document::from(pkg_version),
    );
    // control_overrides.insert("package.name".to_string(), serde_json::json!(application.clone()));
    // control_overrides.insert("release.id".to_string(), serde_json::json!(release_id.to_string()));
    // control_overrides.insert("release.config_version".to_string(), serde_json::json!(config.config_version.clone()));

    // Create experimental variant with same overrides
    let experimental_overrides = control_overrides.clone();

    let control_variant = VariantBuilder::default()
        .id("control".to_string())
        .variant_type(superposition_rust_sdk::types::VariantType::Control)
        .overrides(Document::from(control_overrides))
        .build()
        .map_err(error::ErrorInternalServerError)?;


    let experimental_variant = VariantBuilder::default()
        .id("experimental_{}".to_string())
        .variant_type(superposition_rust_sdk::types::VariantType::Experimental)
        .overrides(Document::from(experimental_overrides))
        .build()
        .map_err(error::ErrorInternalServerError)?;

    let created_experiment_response = state.superposition_client
        .create_experiment()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .variants(control_variant)
        .variants(experimental_variant)
        .context("TODO", Document::String("TODO".to_string()))
        .send()
        .await
        .map_err(|e| {
            eprintln!("Failed to create experiment: {:?}", e); // Log the detailed error
            error::ErrorInternalServerError(format!("Failed to create experiment in Superposition"))
        })?;
        
    // Assuming 'id' is the field in CreateExperimentResponseContent and it has to_string()
    // The actual type of created_experiment_response.id is models::ExperimentId (likely i64 or similar)
    let experiment_id_for_ramping = created_experiment_response.id.to_string();

    println!(
        "Experiment {} created. Attempting to ramp to 100% traffic.",
        experiment_id_for_ramping
    );

    state.superposition_client
        .ramp_experiment()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .id(experiment_id_for_ramping.clone())
        .traffic_percentage(50)
        .change_reason(format!(
            "Auto-activating and ramping experiment for release {} (pkg_version {}) to 100% traffic.",
            release_id, pkg_version
        ))
        .send()
        .await
        .map_err(error::ErrorInternalServerError)?;

    let new_release = ReleaseEntry {
        id: release_id,
        org_id: organisation,
        app_id: application,
        package_version: pkg_version,
        config_version: config.config_version.clone(),
        created_at: now,
        created_by: user_id,
        metadata: req
            .metadata
            .clone()
            .unwrap_or_else(|| serde_json::json!({})),
    };

    diesel::insert_into(releases)
        .values(&new_release)
        .execute(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    Ok(Json(CreateResponse {
        id: release_id.to_string(),
        created_at: now,
        package_version: pkg_version,
        config_version: config.config_version,
    }))
}

#[get("/history")]
async fn list_releases(
    state: web::Data<AppState>,
    auth_response: ReqData<AuthResponse>,
) -> Result<Json<ReleaseHistoryResponse>> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, READ).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, READ).map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let release_entries = releases
        .filter(org_id.eq(&organisation).and(app_id.eq(&application)))
        .order_by(created_at.desc())
        .load::<ReleaseEntry>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    let release_history = release_entries
        .into_iter()
        .map(|entry| ReleaseHistoryEntry {
            id: entry.id.to_string(),
            package_version: entry.package_version,
            config_version: entry.config_version,
            created_at: entry.created_at,
            created_by: entry.created_by,
            metadata: entry.metadata,
        })
        .collect();

    Ok(Json(ReleaseHistoryResponse {
        releases: release_history,
    }))
}
