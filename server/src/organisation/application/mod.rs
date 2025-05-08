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
use crate::utils::db::schema::hyperotaserver::organisations::dsl::*;

use crate::utils::db::models::OrgEnty;
use crate::utils::keycloak::get_token;

mod package;
mod release;

use diesel::prelude::*;
use diesel::ExpressionMethods;
use diesel::QueryDsl;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(add_application)
        .service(Scope::new("/package").service(package::add_routes()))
        .service(Scope::new("/release").service(release::add_routes()))
}

#[derive(Serialize, Deserialize)]
pub struct Application {
    pub application: String,
    pub organisation: String,
    pub access: Vec<String>,
    pub release_config: Option<ReleaseConfig>, // TODO Add information on the application
                                               // Latest live package
                                               // Latest live resources
}

#[derive(Serialize, Deserialize)]
pub struct ReleaseConfig {
    pub config: ConfigBlock,
    pub package: PackageBlock,
}

#[derive(Serialize, Deserialize)]
pub struct ConfigBlock {
    release_config_timeout: u32,
    package_timeout: u32,
    version: String,
}

#[derive(Serialize, Deserialize)]
pub struct PackageBlock {
    name: String,
    version: String,
    index: String,
    splits: Vec<String>,
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

#[post("create")]
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

    let organisation = validate_user(organisation, WRITE).map_err(error::ErrorUnauthorized)?;

    // Get Keycloak Admin Token
    let client = reqwest::Client::new();
    let admin_token = get_token(state.env.clone(), client)
        .await
        .map_err(error::ErrorInternalServerError)?;
    let client = reqwest::Client::new();
    let admin = KeycloakAdmin::new(&state.env.keycloak_url.clone(), admin_token, client);
    let realm = state.env.realm.clone();

    // Validate if user has access to this organisation
    // I might want to move this to a db; This does not scale
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
        // If not present in db create entry in db and return success
        let group_id = admin
            .realm_groups_with_group_id_children_post(
                &realm,
                &groups[0].id.clone().unwrap_or_default().clone(),
                GroupRepresentation {
                    name: Some(application.clone()),
                    ..Default::default()
                },
            )
            .await
            .map_err(error::ErrorInternalServerError)?
            .unwrap_or_default();
        // Create an admin group for the application
        let roles = ["read", "write", "admin"];
        for role in roles {
            let group_id = admin
                .realm_groups_with_group_id_children_post(
                    &realm,
                    &group_id,
                    GroupRepresentation {
                        name: Some(role.to_string()),
                        ..Default::default()
                    },
                )
                .await
                .map_err(error::ErrorInternalServerError)?
                .unwrap_or_default();
            // Add the user to the role-specific group
            admin
                .realm_users_with_user_id_groups_with_group_id_put(&realm, sub, &group_id)
                .await
                .map_err(error::ErrorInternalServerError)?;
        }

        let mut conn = state
            .db_pool
            .get()
            .map_err(error::ErrorInternalServerError)?;

        let org_entry = organisations
            .filter(name.eq(organisation.clone()))
            .first::<OrgEnty>(&mut conn)
            .map_err(error::ErrorInternalServerError)?;

        let workspace = create_workspace(
            &state.superposition_configuration,
            &org_entry.superposition_organisation,
            CreateWorkspaceRequestContent {
                workspace_admin_email: "pp-sdk@juspay.in".to_string(),
                workspace_name: application.clone(),
                workspace_status: Some(WorkspaceStatus::Enabled),
            },
        )
        .await
        .map_err(error::ErrorInternalServerError)?;

        let create_default_config_string = default_config::<String>(
            state.superposition_configuration.clone(),
            workspace.workspace_name.clone(),
            org_entry.superposition_organisation.clone(),
        );
        let create_default_config_int = default_config::<i32>(
            state.superposition_configuration.clone(),
            workspace.workspace_name.clone(),
            org_entry.superposition_organisation.clone(),
        );

        create_default_config_string(
            "config.version".to_string(),
            "0.0.0".to_string(),
            "Value indicating the version of the release config".to_string(),
        )
        .await
        .map_err(error::ErrorInternalServerError)?;

        create_default_config_int(
            "config.release_config_timeout".to_string(),
            1000,
            "Value indicating the version of the release config".to_string(),
        )
        .await
        .map_err(error::ErrorInternalServerError)?;

        create_default_config_int(
            "config.package_timeout".to_string(),
            1000,
            "Indicating the timeout for downloading the package block".to_string(),
        )
        .await
        .map_err(error::ErrorInternalServerError)?;

        create_default_config_string(
            "package.name".to_string(),
            workspace.workspace_name.clone(),
            "Value indicating the version of the release config".to_string(),
        )
        .await
        .map_err(error::ErrorInternalServerError)?;

        create_default_config_int(
            "package.version".to_string(),
            0,
            "Value indicating the version of the package".to_string(),
        )
        .await
        .map_err(error::ErrorInternalServerError)?;

        actix_web::Result::Ok(Json(Application {
            application,
            organisation,
            access: roles.iter().map(|&s| s.to_string()).collect(),
            release_config: None,
        }))
    }
}

// Create package
// Create a package entry
