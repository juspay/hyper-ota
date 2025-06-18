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

use actix_web::web::{Json, ReqData};
use actix_web::{error, Scope};

use actix_web::{post, web};
use keycloak::types::GroupRepresentation;
use keycloak::KeycloakAdmin;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use superposition_rust_sdk::apis::configuration::Configuration;
use superposition_rust_sdk::apis::default_api::{
    create_default_config, create_workspace, CreateDefaultConfigError,
};
use superposition_rust_sdk::models::{
    CreateDefaultConfigRequestContent, CreateDefaultConfigResponseContent,
    CreateWorkspaceRequestContent, WorkspaceStatus,
};

use crate::middleware::auth::{validate_user, AuthResponse, WRITE};
use crate::types::AppState;
use diesel::RunQueryDsl;

use crate::utils::keycloak::get_token;
use crate::utils::transaction_manager::TransactionManager;
use crate::utils::db::schema::hyperotaserver::workspace_names;
use crate::utils::db::models::{NewWorkspaceName, WorkspaceName};

mod config;
mod package;
mod release;
mod dimension;

use diesel::prelude::*;
use diesel::ExpressionMethods;
use diesel::QueryDsl;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(add_application)
        .service(Scope::new("/package").service(package::add_routes()))
        .service(Scope::new("/release").service(release::add_routes()))
        .service(Scope::new("/config").service(config::add_routes()))
        .service(Scope::new("/dimension").service(dimension::add_routes()))
}

#[derive(Serialize, Deserialize)]
pub struct Application {
    pub application: String,
    pub organisation: String,
    pub access: Vec<String>
}

#[derive(Serialize, Deserialize)]
struct ApplicationCreateRequest {
    application: String,
}

fn default_config<T: Clone>(
    superposition_configuration: Configuration,
    workspace_name: String,
    superposition_org: String,
) -> impl AsyncFn(
    String,
    T,
    String,
) -> actix_web::Result<
    CreateDefaultConfigResponseContent,
    superposition_rust_sdk::apis::Error<CreateDefaultConfigError>,
>
where
    Value: From<T>,
{
    async move |key: String, value: T, description: String| {
        create_default_config(
            &superposition_configuration,
            &superposition_org,
            &workspace_name,
            CreateDefaultConfigRequestContent {
                key,
                value: Some(Value::from(value.clone())),
                schema: Some(get_scheme::<T>(value)),
                description,
                change_reason: "Initial value".to_string(),
                ..Default::default()
            },
        )
        .await
    }
}

fn get_scheme<T>(v: T) -> Value
where
    Value: From<T>,
{
    let v = Value::from(v);
    Value::Object(match v {
        // Don't use JSON macro. It is too heavy
        // Change this to Value::Object + Map
        Value::String(_) => Map::from_iter([
            (String::from("pattern"), Value::String(String::from(".*"))),
            (String::from("type"), Value::String(String::from("string"))),
        ]),
        Value::Number(_) => {
            Map::from_iter([(String::from("type"), Value::String(String::from("integer")))])
        }
        Value::Array(_) => Map::from_iter([
            (String::from("type"), Value::String(String::from("array"))),
            (
                String::from("items"),
                Value::Object(Map::from_iter([(
                    String::from("type"),
                    Value::String(String::from("string")),
                )])),
            ),
        ]),
        _ => Map::new(),
    })
}

#[post("/create")]
async fn add_application(
    body: Json<ApplicationCreateRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<Application>> {
    // Get organisation and application names
    let body = body.into_inner();
    let application = body.application;

    // Check if the user token is still valid
    let auth_response = auth_response.into_inner();
    let sub = &auth_response.sub;

    let organisation = auth_response.organisation;

    println!("Validating organisation: {:?}", organisation);
    let organisation = validate_user(organisation, WRITE).map_err(|e| {
        println!("Error validating organisation: {:?}", e);
        error::ErrorUnauthorized(e)
    })?;
    println!("Organisation validated successfully.");

    // Create a transaction manager to track resources
    let transaction = TransactionManager::new(&application, "application_create");

    // Get DB connection
    let mut conn = state.db_pool.get()
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to get database connection: {}", e))
        })?;

    // Get Keycloak Admin Token
    let client = reqwest::Client::new();
    let admin_token = get_token(state.env.clone(), client).await.map_err(|e| {
        println!("Error retrieving Keycloak admin token: {:?}", e);
        error::ErrorInternalServerError(e)
    })?;
    println!("Admin token retrieved successfully.");
    let client = reqwest::Client::new();
    let admin = KeycloakAdmin::new(&state.env.keycloak_url.clone(), admin_token, client);
    let realm = state.env.realm.clone();

    let groups = admin
        .realm_groups_get(
            &realm,
            None,
            Some(true), // Exact Match
            None,
            Some(2), // Check only one group; Should be 5xx if more than 1
            Some(false),
            None,
            Some(organisation.clone()),
        )
        .await
        .map_err(error::ErrorInternalServerError)?;

    if groups.is_empty() {
        Err(error::ErrorBadRequest(Json(
            json!({"Error" : "Organisation not found"}),
        )))
    }
    // It is possible that application group comes up in this query; Change to path
    // else if groups.len() != 1 {
    //     return Err(error::ErrorInternalServerError(Json(json!({"Error" : "Inconsistant database entries"}))));
    // }
    else {
        // Reject if application already exists
        if groups[0]
            .sub_groups
            .clone()
            .unwrap_or_default()
            .iter()
            .any(|g| g.name == Some(application.clone()))
        {
            return Err(error::ErrorConflict("Application already exists"));
        }

        // Step 1: Create application group in Keycloak
        let parent_group_id = match admin
            .realm_groups_with_group_id_children_post(
                &realm,
                &groups[0].id.clone().unwrap_or_default().clone(),
                GroupRepresentation {
                    name: Some(application.clone()),
                    ..Default::default()
                },
            )
            .await
        {
            Ok(id) => {
                let group_id = id.unwrap_or_default();
                // Record this resource in the transaction
                transaction.add_keycloak_group(&group_id);
                println!("Created application group with ID: {}", group_id);
                group_id
            }
            Err(e) => {
                // No rollback needed yet - this is the first operation
                return Err(error::ErrorInternalServerError(format!(
                    "Failed to create application group: {}",
                    e
                )));
            }
        };

        // Step 2: Create role groups and add user to them
        let roles = ["read", "write", "admin"];
        for role in roles {
            match admin
                .realm_groups_with_group_id_children_post(
                    &realm,
                    &parent_group_id,
                    GroupRepresentation {
                        name: Some(role.to_string()),
                        ..Default::default()
                    },
                )
                .await
            {
                Ok(id) => {
                    let role_group_id = id.unwrap_or_default();
                    // Record this resource in the transaction
                    transaction.add_keycloak_group(&role_group_id);
                    println!("Created role group {} with ID: {}", role, role_group_id);

                    // Add the user to the role-specific group
                    match admin
                        .realm_users_with_user_id_groups_with_group_id_put(
                            &realm,
                            sub,
                            &role_group_id,
                        )
                        .await
                    {
                        Ok(_) => {
                            // Record this user-group relationship in the transaction
                            transaction.add_keycloak_resource(
                                "user_group_membership",
                                &format!("{}:{}", sub, role_group_id),
                            );
                            println!("Added user to role group: {}", role);
                        }
                        Err(e) => {
                            // Handle rollback and return error
                            if let Err(rollback_err) = transaction
                                .handle_rollback_if_needed(&admin, &realm, &state)
                                .await
                            {
                                println!("Rollback failed: {}", rollback_err);
                            }

                            return Err(error::ErrorInternalServerError(format!(
                                "Failed to add user to role group: {}",
                                e
                            )));
                        }
                    }
                }
                Err(e) => {
                    // Handle rollback and return error
                    if let Err(rollback_err) = transaction
                        .handle_rollback_if_needed(&admin, &realm, &state)
                        .await
                    {
                        println!("Rollback failed: {}", rollback_err);
                    }

                    return Err(error::ErrorInternalServerError(format!(
                        "Failed to create role group: {}",
                        e
                    )));
                }
            }
        }

        // Store workspace name in our database with a placeholder, then update to "workspace{id}"
        let new_workspace_name = NewWorkspaceName {
            organization_id: &organisation,
            workspace_name: "pending",
        };

        let superposition_org_id_from_env = state.env.superposition_org_id.clone();
        println!("Using Superposition Org ID from environment: {}", superposition_org_id_from_env);
        // Insert and get the inserted row (to get the id)
        let inserted_workspace: WorkspaceName = diesel::insert_into(workspace_names::table)
            .values(&new_workspace_name)
            .get_result(&mut conn)
            .map_err(|e| error::ErrorInternalServerError(format!("Failed to store workspace name: {}", e)))?;

        let generated_id = inserted_workspace.id;
        let generated_workspace_name = format!("workspace{}", generated_id);

        // Update the workspace_name to "workspace{id}"
        diesel::update(workspace_names::table.filter(workspace_names::id.eq(generated_id)))
            .set(workspace_names::workspace_name.eq(&generated_workspace_name))
            .execute(&mut conn)
            .map_err(|e| error::ErrorInternalServerError(format!("Failed to update workspace name: {}", e)))?;

        // Step 4: Create workspace in Superposition
        let workspace = match create_workspace(
            &state.superposition_configuration,
            &superposition_org_id_from_env, // Use ID from env
            CreateWorkspaceRequestContent {
                workspace_admin_email: "pp-sdk@juspay.in".to_string(),
                workspace_name: generated_workspace_name.clone(),
                workspace_status: Some(WorkspaceStatus::Enabled),
                workspace_strict_mode: false
            },
        )
        .await
        {
            Ok(workspace) => {
                // Record Superposition resource using workspace name as the ID
                transaction.set_superposition_resource(&workspace.workspace_name);
                println!("Created workspace in Superposition: {:?}", workspace);
                workspace
            }
            Err(e) => {
                // Handle rollback and return error
                if let Err(rollback_err) = transaction
                    .handle_rollback_if_needed(&admin, &realm, &state)
                    .await
                {
                    println!("Rollback failed: {}", rollback_err);
                }

                return Err(error::ErrorInternalServerError(format!(
                    "Failed to create workspace in Superposition: {}",
                    e
                )));
            }
        };

        // Step 5: Create default configurations
        let create_default_config_string = default_config::<String>(
            state.superposition_configuration.clone(),
            generated_workspace_name.clone(),
            superposition_org_id_from_env.clone(), // Use ID from env
        );
        let create_default_config_int = default_config::<i32>(
            state.superposition_configuration.clone(),
            generated_workspace_name.clone(),
            superposition_org_id_from_env.clone(), // Use ID from env
        );

        // Helper function to create default config with error handling
        async fn create_config_with_tx<T, E>(
            create_fn: impl futures::Future<Output = Result<T, E>>,
            key: &str,
            transaction: &TransactionManager,
            admin: &KeycloakAdmin,
            realm: &str,
            state: &web::Data<AppState>,
        ) -> Result<T, actix_web::Error>
        where
            E: std::fmt::Display,
        {
            match create_fn.await {
                Ok(result) => {
                    println!("Created configuration for key: {}", key);
                    Ok(result)
                }
                Err(e) => {
                    // Handle rollback
                    if let Err(rollback_err) = transaction
                        .handle_rollback_if_needed(admin, realm, state)
                        .await
                    {
                        println!("Rollback failed: {}", rollback_err);
                    }

                    Err(error::ErrorInternalServerError(format!(
                        "Failed to create configuration for {}: {}",
                        key, e
                    )))
                }
            }
        }

        // Create all configurations with transaction-aware error handling
        create_config_with_tx(
            create_default_config_string(
                "config.version".to_string(),
                "0.0.0".to_string(),
                "Value indicating the version of the release config".to_string(),
            ),
            "config.version",
            &transaction,
            &admin,
            &realm,
            &state,
        )
        .await?;

        create_config_with_tx(
            create_default_config_int(
                "config.release_config_timeout".to_string(),
                1000,
                "Value indicating the version of the release config".to_string(),
            ),
            "config.release_config_timeout",
            &transaction,
            &admin,
            &realm,
            &state,
        )
        .await?;

        create_config_with_tx(
            create_default_config_int(
                "config.package_timeout".to_string(),
                1000,
                "Indicating the timeout for downloading the package block".to_string(),
            ),
            "config.package_timeout",
            &transaction,
            &admin,
            &realm,
            &state,
        )
        .await?;

        println!(
            "Creating default configuration (string): key=package.name, value={}",
            generated_workspace_name
        );
        create_config_with_tx(
            create_default_config_string(
                "package.name".to_string(),
                generated_workspace_name.clone(),
                "Value indicating the version of the release config".to_string(),
            ),
            "package.name",
            &transaction,
            &admin,
            &realm,
            &state,
        )
        .await?;

        create_config_with_tx(
            create_default_config_int(
                "package.version".to_string(),
                0,
                "Value indicating the version of the package".to_string(),
            ),
            "package.version",
            &transaction,
            &admin,
            &realm,
            &state,
        )
        .await?;

        // Mark transaction as complete since all operations have succeeded
        transaction.set_database_inserted();

        actix_web::Result::Ok(Json(Application {
            application,
            organisation,
            access: roles.iter().map(|&s| s.to_string()).collect()
        }))
    }
}

// Create package
// Create a package entry
