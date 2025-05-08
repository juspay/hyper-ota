use actix_web::{
    error, post,
    web::{self, Json},
    HttpMessage, HttpRequest, Scope,
};
use application::Application;
use diesel::RunQueryDsl;
use keycloak::{types::GroupRepresentation, KeycloakAdmin};
use serde::{Deserialize, Serialize};
use serde_json::json;
use superposition_rust_sdk::{
    apis::default_api::creater_organisation, models::CreaterOrganisationRequestContent,
};

use crate::{
    db::schema::hyperotaserver::organisations::dsl::organisations, middleware::auth::AuthResponse,
};
use crate::{types::AppState, utils::db::models::OrgEnty};

pub mod application;
mod user;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_organisation)
        .service(Scope::new("/applications").service(application::add_routes()))
        .service(Scope::new("/user").service(user::add_routes()))
}
#[derive(Serialize, Deserialize)]
pub struct Organisation {
    pub name: String,
    pub applications: Vec<Application>,
    pub access: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct OrganisationCreatedRequest {
    name: String,
}

#[post("/create")]
async fn create_organisation(
    req: HttpRequest,
    body: Json<OrganisationCreatedRequest>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<Organisation>> {
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

    let organisation = body.name.clone();

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
        let group_id = admin
            .realm_groups_post(
                &realm,
                GroupRepresentation {
                    name: Some(organisation.clone()),
                    ..Default::default()
                },
            )
            .await
            .map_err(error::ErrorInternalServerError)?
            .unwrap_or_default();
        let roles = ["read", "write", "admin", "owner"];
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

        let cac_organisation = creater_organisation(
            &state.superposition_configuration,
            CreaterOrganisationRequestContent {
                name: organisation.clone(),
                ..Default::default()
            },
        )
        .await
        .map_err(error::ErrorInternalServerError)?; // TODO :: Need to revert group creation; Else we will get unowner organisations

        let mut conn = state
            .db_pool
            .get()
            .map_err(error::ErrorInternalServerError)?;

        diesel::insert_into(organisations)
            .values(OrgEnty {
                name: organisation.clone(),
                superposition_organisation: cac_organisation.id.clone(),
            })
            .execute(&mut conn)
            .map_err(error::ErrorInternalServerError)?;
        return Ok(Json(Organisation {
            name: organisation,
            applications: vec![],
            access: roles.iter().map(|&s| s.to_string()).collect(),
        }));
    }

    // Reject if organisation is present in keycloak as a group
    Err(error::ErrorBadRequest(Json(
        json!({"Error" : "Organisation name is taken"}),
    )))
}
