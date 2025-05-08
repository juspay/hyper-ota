use actix_web::{
    error, post,
    web::{Json, ReqData},
    Scope,
};
use serde::Deserialize;

use crate::middleware::auth::{validate_user, AuthResponse, WRITE};

pub fn add_routes() -> Scope {
    Scope::new("") //.service(create).service(list)
}

#[derive(Deserialize)]
struct CreateRequest {
    version_id: String,
    // Add resources
}

#[post("/create")]
async fn create(
    req: Json<CreateRequest>,
    auth_response: ReqData<AuthResponse>,
) -> actix_web::Result<String> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;
    let version = req.version_id.clone();

    Ok("Hello".to_string())
}
