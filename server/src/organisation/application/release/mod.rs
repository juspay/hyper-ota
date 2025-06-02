use actix_web::{
    error, get, post,
    web::{self, Json, ReqData},
    Result, Scope,
};
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    middleware::auth::{validate_user, AuthResponse, READ, WRITE},
    types::AppState,
    utils::db::{
        models::{PackageEntryRead, ReleaseEntry},
        schema::hyperotaserver::releases::dsl::*,
    },
};

pub fn add_routes() -> Scope {
    Scope::new("").service(create).service(list_releases)
}

#[derive(Deserialize)]
struct CreateRequest {
    version_id: Option<String>,
    metadata: Option<serde_json::Value>,
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

    let package = crate::utils::db::schema::hyperotaserver::packages::dsl::packages
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
