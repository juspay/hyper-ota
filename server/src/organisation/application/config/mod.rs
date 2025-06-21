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

use actix_multipart::form::{text::Text, MultipartForm};
use actix_web::{
    error, post,
    web::{self, Json, ReqData},
    Result, Scope,
};
use diesel::prelude::*;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    middleware::auth::{validate_user, AuthResponse, WRITE},
    types::AppState,
    utils::db::{
        models::ConfigEntry, schema::hyperotaserver::configs::dsl::configs as configs_table,
    },
};

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_config_json_v1)
        .service(create_config_json_v1_multipart)
}

#[derive(Debug, Deserialize, Serialize)]
struct ConfigJsonV1Request {
    config: ConfigV1,
    tenant_info: Option<serde_json::Value>,
    properties: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize)]
struct ConfigV1 {
    version: String,
    release_config_timeout: i32,
    package_timeout: i32,
    #[serde(flatten)]
    properties: serde_json::Value,
}

#[derive(Debug, MultipartForm)]
struct ConfigJsonV1MultipartRequest {
    #[multipart(rename = "json")]
    json: Text<String>,
}

#[derive(Serialize)]
struct Response {
    version: i32,
    config_version: String,
}

#[post("/create_json_v1")]
async fn create_config_json_v1(
    req: Json<ConfigJsonV1Request>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Response>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    // Find the package version to associate with the config
    let latest_version = crate::utils::db::schema::hyperotaserver::packages::dsl::packages
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
        .map_err(error::ErrorInternalServerError)?;

    let ver = latest_version.unwrap_or(0);

    // Extract tenant_info, either from specific field or from properties
    let tenant_info = req
        .tenant_info
        .clone()
        .or_else(|| {
            req.config
                .properties
                .get("tenant_info")
                .and_then(|v| v.as_object())
                .map(|obj| json!(obj))
        })
        .unwrap_or_else(|| json!({}));

    // Extract properties
    let properties = req.properties.clone().unwrap_or_else(|| json!({}));

    // Store config data
    diesel::insert_into(configs_table)
        .values(ConfigEntry {
            org_id: organisation,
            app_id: application,
            version: ver,
            config_version: req.config.version.clone(),
            release_config_timeout: req.config.release_config_timeout,
            package_timeout: req.config.package_timeout,
            tenant_info,
            properties,
        })
        .execute(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    Ok(Json(Response {
        version: ver,
        config_version: req.config.version.clone(),
    }))
}

#[post("/create_json_v1/multipart")]
async fn create_config_json_v1_multipart(
    MultipartForm(form): MultipartForm<ConfigJsonV1MultipartRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Response>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    // Parse the JSON request
    let req: ConfigJsonV1Request = serde_json::from_str(&form.json.into_inner())
        .map_err(|e| error::ErrorBadRequest(format!("Invalid JSON: {}", e)))?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    // Find the package version to associate with the config
    let latest_version = crate::utils::db::schema::hyperotaserver::packages::dsl::packages
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
        .map_err(error::ErrorInternalServerError)?;

    let ver = latest_version.unwrap_or(0);

    // Extract tenant_info, either from specific field or from properties
    let tenant_info = req
        .tenant_info
        .clone()
        .or_else(|| {
            req.config
                .properties
                .get("tenant_info")
                .and_then(|v| v.as_object())
                .map(|obj| json!(obj))
        })
        .unwrap_or_else(|| json!({}));

    // Extract properties
    let properties = req.properties.clone().unwrap_or_else(|| json!({}));

    // Store config data
    diesel::insert_into(configs_table)
        .values(ConfigEntry {
            org_id: organisation,
            app_id: application,
            version: ver,
            config_version: req.config.version.clone(),
            release_config_timeout: req.config.release_config_timeout,
            package_timeout: req.config.package_timeout,
            tenant_info,
            properties,
        })
        .execute(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    Ok(Json(Response {
        version: ver,
        config_version: req.config.version.clone(),
    }))
}
