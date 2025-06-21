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

use crate::middleware::auth::AuthResponse;
use crate::types::AppState;
use actix_web::{
    delete, error, get, post,
    web::{self, Json, Path},
    HttpMessage, HttpRequest, Scope,
};
use application::Application;
use keycloak::KeycloakAdmin;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;

pub mod application;
pub mod transaction;
pub mod user;

// Constants
const MAX_ORG_NAME_LENGTH: usize = 50;

// Routes
pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_organisation)
        .service(delete_organisation)
        .service(list_organisations)
        .service(Scope::new("/applications").service(application::add_routes()))
        .service(Scope::new("/user").service(user::add_routes()))
}

// Structs
#[derive(Serialize, Deserialize)]
pub struct Organisation {
    pub name: String,
    pub applications: Vec<Application>,
    pub access: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct OrganisationCreatedRequest {
    pub name: String,
}

// API Implementations

#[post("/create")]
async fn create_organisation(
    req: HttpRequest,
    body: Json<OrganisationCreatedRequest>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<Organisation>> {
    let organisation = body.name.clone();

    // Validate organization name
    validate_organisation_name(&organisation)?;

    // Get Keycloak Admin Token
    let auth_response = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(error::ErrorUnauthorized("Token Parse Failed"))?;
    let admin_token = auth_response.admin_token.clone();
    let sub = &auth_response.sub;
    let client = reqwest::Client::new();
    let admin = KeycloakAdmin::new(&state.env.keycloak_url.clone(), admin_token, client);
    let realm = state.env.realm.clone();

    // Check if organization already exists
    let groups = admin
        .realm_groups_get(
            &realm,
            None,
            Some(true),
            None,
            Some(2),
            Some(false),
            None,
            Some(organisation.clone()),
        )
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to check existing groups: {}", e))
        })?;

    if !groups.is_empty() {
        return Err(error::ErrorBadRequest(Json(
            json!({"Error" : "Organisation name is taken"}),
        )));
    }

    // Create the organization using the transaction manager
    let org = transaction::create_organisation_with_transaction(
        &organisation,
        &admin,
        &realm,
        sub,
        &state,
    )
    .await?;

    Ok(Json(org))
}

#[delete("/{org_name}")]
async fn delete_organisation(
    req: HttpRequest,
    path: Path<String>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<serde_json::Value>> {
    let organisation = path.into_inner();

    // Validate organization name
    validate_organisation_name(&organisation)?;

    // Get Keycloak Admin Token
    let auth_response = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(error::ErrorUnauthorized("Token Parse Failed"))?;
    let admin_token = auth_response.admin_token.clone();
    let client = reqwest::Client::new();
    let admin = KeycloakAdmin::new(&state.env.keycloak_url.clone(), admin_token, client);
    let realm = state.env.realm.clone();

    // Check if organization exists
    let groups = admin
        .realm_groups_get(
            &realm,
            None,
            Some(true),
            None,
            Some(2),
            Some(false),
            None,
            Some(organisation.clone()),
        )
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to check existing groups: {}", e))
        })?;

    if groups.is_empty() {
        return Err(error::ErrorBadRequest(Json(
            json!({"Error" : "Organisation does not exist"}),
        )));
    }

    // Check if user has permissions to delete organization
    if auth_response.organisation.as_ref().map_or(false, |org| {
        org.name == organisation && org.is_admin_or_higher()
    }) {
        // Delete the organization using the transaction manager
        transaction::delete_organisation_with_transaction(&organisation, &admin, &realm, &state)
            .await?;

        Ok(Json(
            json!({"Success" : "Organisation deleted successfully"}),
        ))
    } else {
        Err(error::ErrorForbidden(Json(
            json!({"Error" : "You do not have permission to delete this organisation"}),
        )))
    }
}

#[get("")]
async fn list_organisations(
    req: HttpRequest,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<Vec<Organisation>>> {
    // Get Keycloak Admin Token
    let auth_response = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(error::ErrorUnauthorized("Token Parse Failed"))?;
    let admin_token = auth_response.admin_token.clone();
    let sub = &auth_response.sub;
    let client = reqwest::Client::new();
    let admin = KeycloakAdmin::new(&state.env.keycloak_url.clone(), admin_token, client);
    let realm = state.env.realm.clone();

    // Get user's groups
    let groups = admin
        .realm_users_with_user_id_groups_get(&realm, sub, None, None, None, None)
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to fetch user groups: {}", e))
        })?;

    // Extract group paths
    let group_paths: Vec<String> = groups.iter().filter_map(|g| g.path.clone()).collect();

    // Parse groups into organizations
    let organizations = parse_user_organizations(group_paths);

    Ok(Json(organizations))
}

// Helper function to parse Keycloak groups into organizations
fn parse_user_organizations(groups: Vec<String>) -> Vec<Organisation> {
    let mut organisations: HashMap<String, Organisation> = HashMap::new();

    for group in groups {
        let path = group.trim_matches('/'); // Remove leading/trailing slashes
        let parts: Vec<&str> = path.split('/').collect();

        if parts.is_empty() {
            continue;
        }

        let access = parts.last().unwrap_or(&"").to_string();

        // Skip if no organization name found
        if parts.is_empty() {
            continue;
        }

        let organisation_name = parts[0].to_string();
        let application_name = if parts.len() == 3 {
            Some(parts[1].to_string())
        } else {
            None
        };

        if let Some(app_name) = application_name {
            // Handle application-level access
            let organisation =
                organisations
                    .entry(organisation_name.clone())
                    .or_insert(Organisation {
                        name: organisation_name.clone(),
                        applications: vec![],
                        access: vec![],
                    });

            let app = organisation
                .applications
                .iter_mut()
                .find(|app| app.application == app_name);

            if let Some(app) = app {
                app.access.push(access);
            } else {
                organisation.applications.push(Application {
                    application: app_name,
                    organisation: organisation_name.clone(),
                    access: vec![access],
                    release_config: None,
                });
            }
        } else {
            // Handle organisation-level access
            let organisation =
                organisations
                    .entry(organisation_name.clone())
                    .or_insert(Organisation {
                        name: organisation_name.clone(),
                        applications: vec![],
                        access: vec![],
                    });

            organisation.access.push(access);
        }
    }

    organisations.into_values().collect()
}

/// Validate organization name for security and usability
pub fn validate_organisation_name(name: &str) -> actix_web::Result<()> {
    let trimmed = name.trim();

    if trimmed.is_empty() {
        return Err(error::ErrorBadRequest(Json(
            json!({"Error" : "Organisation name cannot be empty"}),
        )));
    }

    if trimmed.len() > MAX_ORG_NAME_LENGTH {
        return Err(error::ErrorBadRequest(Json(
            json!({"Error" : "Organisation name is too long"}),
        )));
    }

    // Basic pattern matching for valid organization name
    if !trimmed
        .chars()
        .all(|c| c.is_alphanumeric() || c == ' ' || c == '-' || c == '_')
    {
        return Err(error::ErrorBadRequest(Json(
            json!({"Error" : "Organisation name can only contain alphanumeric characters, spaces, hyphens, and underscores"}),
        )));
    }

    Ok(())
}
