use actix_web::{
    error, post,
    web::{self, Json},
    HttpMessage, HttpRequest, Scope,
};
use serde::{Deserialize, Serialize};

use crate::{middleware::auth::AuthResponse, types::AppState};

pub fn add_routes() -> Scope {
    Scope::new("")
    //   .service(organisation_add_user)
    //   .service(organisation_update_user)
    //   .service(organisation_remove_user)
}

#[derive(Deserialize)]
struct AddUserRequest {
    user: String,
    access: String,
}

#[derive(Deserialize)]
struct RemoveUserRequest {
    user: String,
}

#[derive(Serialize)]
struct AddUserResponse {
    user: String,
    added: bool,
}

#[post("/create")]
async fn organisation_add_user(
    req: HttpRequest,
    body: Json<AddUserRequest>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<AddUserResponse>> {
    // Check if the user token is still valid
    let auth_response = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(error::ErrorUnauthorized("Token Parse Failed"))?;
    let sub = &auth_response.sub;

    // Should I create a user roles in the application call?
    // Does not seem ideal to do it here

    // Find the user group with exact path
    // Add that user to that group

    // Remove from other groups
    // Should I add the user to all access?

    // Add to all roles till listed role;
    // Remove if present in others

    let req = body.into_inner();
    Ok(Json(AddUserResponse {
        user: req.user,
        added: true,
    }))
}

#[post("/update")]
async fn organisation_update_user(
    req: HttpRequest,
    body: Json<AddUserRequest>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<AddUserResponse>> {
    // Check if the user token is still valid
    let auth_response = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(error::ErrorUnauthorized("Token Parse Failed"))?;
    let sub = &auth_response.sub;
    let req = body.into_inner();
    Ok(Json(AddUserResponse {
        user: req.user,
        added: true,
    }))
}

#[post("/remove")]
async fn organisation_remove_user(
    req: HttpRequest,
    body: Json<AddUserRequest>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<AddUserResponse>> {
    // Check if the user token is still valid
    let auth_response = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(error::ErrorUnauthorized("Token Parse Failed"))?;
    let sub = &auth_response.sub;

    let req = body.into_inner();
    Ok(Json(AddUserResponse {
        user: req.user,
        added: true,
    }))
}
