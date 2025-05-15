use std::collections::HashMap;

use actix_web::{
    error::{self, ErrorUnauthorized},
    get, post,
    web::{self, Json},
    HttpMessage, HttpRequest, Scope,
};
use keycloak::{
    types::{CredentialRepresentation, UserRepresentation},
    KeycloakAdmin,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    middleware::auth::AuthResponse,
    organisation::application::Application,
    organisation::Organisation,
    types::AppState,
    utils::keycloak::{decode_jwt_token, get_token},
};

pub fn add_routes() -> Scope {
    web::scope("")
        .service(create_user)
        .service(login)
        .service(get_user)
}

/*
 * User DB Schema
 * User Id | User | Password
 * User Id : Unique Identifier for each user, Assigned by the system
 * User : Name of the user provided during account creation
 * Password : Password of the user provided during account creation
 */

/*
 * ACL DB Schema
 * ACL Id | ACL | ACL Level | ACL Owner
 * ACL Id : Unique Identifier for each ACL, Assigned by the system
 * ACL : access control list for this id
 * ACL Level : ACL is applicable for this level; Can be Originisation, Application, User, Server
 * ACL Owner : Id based on level in ACL Level column
 */

#[derive(Serialize, Deserialize)]
struct UserCredentials {
    name: String,
    password: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct UserToken {
    access_token: String,
    token_type: String,
    expires_in: i64,
    refresh_token: String,
    refresh_expires_in: i64,
}

#[post("create")]
async fn create_user(
    req: Json<UserCredentials>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<User>> {
    println!("[CREATE_USER] Attempting to create user: {}", req.name);

    // Get Keycloak Admin Token
    let client = reqwest::Client::new();
    let admin_token = get_token(state.env.clone(), client)
        .await
        .map_err(error::ErrorInternalServerError)?;
    println!("[CREATE_USER] Got admin token successfully");

    let client = reqwest::Client::new();
    let admin = KeycloakAdmin::new(&state.env.keycloak_url.clone(), admin_token, client);
    let realm = state.env.realm.clone();

    //Extract the user name and password
    let req = req.into_inner();

    // See if there is an API to directly check, rather than getting all users
    let users = admin
        .realm_users_get(
            &realm.clone(),
            None,
            None,
            None,
            Some(true),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(req.name.clone()),
        )
        .await
        .map_err(error::ErrorInternalServerError)?;

    println!("[CREATE_USER] Checking if user already exists");
    // Reject if user is present in db
    let exists = users.iter().any(|user| user.id == Some(req.name.clone()));
    if exists {
        println!("[CREATE_USER] User {} already exists", req.name);
        return Err(error::ErrorBadRequest(Json(
            json!({"Error" : "User already Exists"}),
        )));
    }

    println!("[CREATE_USER] Creating new user in Keycloak: {}", req.name);
    // If not present in keycloak create a new user in keycloak
    let user = UserRepresentation {
        username: Some(req.name.clone()),
        credentials: Some(vec![CredentialRepresentation {
            value: Some(req.password.clone()),
            temporary: Some(false),
            type_: Some("password".to_string()),
            ..Default::default()
        }]),
        enabled: Some(true),
        ..Default::default()
    };
    admin
        .realm_users_post(&realm, user)
        .await
        .map_err(error::ErrorInternalServerError)?;

    login_implementation(req, state).await
}

#[post("login")]
async fn login(
    req: Json<UserCredentials>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<User>> {
    login_implementation(req.into_inner(), state).await
}

async fn login_implementation(
    req: UserCredentials,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<User>> {
    println!("[LOGIN] Login attempt for user: {}", req.name);

    // Move ENVs to App State
    let url = state.env.keycloak_url.clone();
    let client_id = state.env.client_id.clone();
    let secret = state.env.secret.clone();
    let realm = state.env.realm.clone();

    let url = format!("{}/realms/{}/protocol/openid-connect/token", url, realm);
    println!("[LOGIN] Attempting Keycloak login at URL: {}", url);

    // Keycloak login API
    let client = reqwest::Client::new();
    let params = [
        ("client_id", client_id),
        ("client_secret", secret),
        ("grant_type", "password".to_string()),
        ("username", req.name.clone()),
        ("password", req.password.clone()),
    ];

    let response = client
        .post(&url)
        .form(&params)
        .send()
        .await
        .map_err(error::ErrorInternalServerError)?; // Handle request failure

    if response.status().is_success() {
        println!("[LOGIN] Login successful for user: {}", req.name);
        let token: UserToken = response
            .json()
            .await
            .map_err(error::ErrorInternalServerError)?;

        let token_data = decode_jwt_token(&token.access_token, &state.env.keycloak_public_key, &state.env.client_id)
            .map_err(|e| error::ErrorUnauthorized("Token has expired or is invalid"))?;

        let admin_token = get_token(state.env.clone(), client)
            .await
            .map_err(error::ErrorInternalServerError)?;
        let mut user_resp = get_user_impl(
            AuthResponse {
                sub: token_data.claims.sub,
                admin_token,
                organisation: None,
                application: None,
            },
            state,
        )
        .await?;

        user_resp.user_token = Some(token);
        return Ok(user_resp);
    } else {
        println!("[LOGIN] Login failed for user: {}", req.name);
    }

    // If response is not successful, extract error message
    let error_text = response
        .text()
        .await
        .unwrap_or_else(|_| "Unknown error".to_string());

    Err(error::ErrorUnauthorized(format!(
        "Login failed: {}",
        error_text
    )))
}

#[derive(Serialize, Deserialize)]
struct User {
    user_id: String,
    organisations: Vec<Organisation>,
    user_token: Option<UserToken>,
}

#[get("")]
async fn get_user(req: HttpRequest, state: web::Data<AppState>) -> actix_web::Result<Json<User>> {
    let auth = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(ErrorUnauthorized("Authorization missing or Invalid"))?;
    get_user_impl(auth, state).await
}

async fn get_user_impl(
    authresponse: AuthResponse,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<User>> {
    println!("[GET_USER] Fetching user details for ID: {}", authresponse.sub);

    // Get list of organisations and application in orginisation for each user
    let user_id: String = authresponse.sub;

    // Get Keycloak Admin Token
    let admin_token = authresponse.admin_token;
    let client = reqwest::Client::new();
    let admin = KeycloakAdmin::new(&state.env.keycloak_url.clone(), admin_token, client);
    let realm = state.env.realm.clone();

    let groups = admin
        .realm_users_with_user_id_groups_get(&realm, &user_id, None, None, None, None)
        .await
        .map_err(error::ErrorInternalServerError)?;
    println!("[GET_USER] Retrieved {} groups for user", groups.len());

    // Reject if organisation is present in db
    // If not present in db create entry in db and return success
    Ok(Json(parse_groups(
        user_id,
        groups
            .iter()
            .filter_map(|g| g.path.clone()) // Filters out None values
            .collect(),
    )))
}

fn parse_groups(user_id: String, groups: Vec<String>) -> User {
    println!("[PARSE_GROUPS] Parsing {} groups for user: {}", groups.len(), user_id);
    
    let mut organisations: HashMap<String, Organisation> = HashMap::new();

    for group in groups.iter() {
        println!("[PARSE_GROUPS] Processing group: {}", group);
        let path = group.trim_matches('/'); // Remove leading/trailing slashes
        let parts: Vec<&str> = path.split('/').collect();

        let access = parts.last().unwrap().to_string();

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
                    release_config: None, // Get release config from CAC
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

    println!("[PARSE_GROUPS] Finished parsing. Found {} organisations", organisations.len());
    User {
        user_id,
        organisations: organisations.into_values().collect(),
        user_token: None,
    }
}
