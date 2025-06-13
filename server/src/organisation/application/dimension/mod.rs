use actix_web::{
    error, post, get, put, delete,
    web::{self, Json, ReqData, Path},
    Result, Scope,
};
use serde::Deserialize;
use superposition_rust_sdk::{
    apis::default_api::{create_dimension, list_dimensions, update_dimension},
    models::{CreateDimensionRequestContent, CreateDimensionResponseContent, ListDimensionsResponseContent, UpdateDimensionRequestContent, UpdateDimensionResponseContent},
};

use crate::{
    middleware::auth::{validate_user, AuthResponse, WRITE},
    types::AppState,
    utils::workspace::get_workspace_name_for_application,
};
use serde_json::Value;


#[derive(Deserialize)]
struct CreateDimensionRequest {
    dimension: String,
    schema: Value,
    description: String,
    function_name: Option<String>,
    mandatory: Option<bool>,
}

#[derive(Deserialize)]
struct ListDimensionsQuery {
    page: Option<f64>,
    count: Option<f64>,
}

#[derive(Deserialize)]
struct UpdateDimensionRequest {
    position: Option<i32>,
    change_reason: String,
}

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_dimension_api)
        .service(list_dimensions_api)
        .service(update_dimension_api)
        .service(delete_dimension_api)
}

#[post("/create")]
async fn create_dimension_api(
    req: Json<CreateDimensionRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<CreateDimensionResponseContent>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation = 
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application = 
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    // Get database connection
    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    // Get workspace name for this application
    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn).await?;

    // Get current dimensions to find the highest position
    let current_dimensions = list_dimensions(
        &state.superposition_configuration,
        &state.env.superposition_org_id,
        &workspace_name,
        None,
        None,
    )
    .await
    .map_err(|e| error::ErrorInternalServerError(format!("Failed to list dimensions: {}", e)))?;

    // Find the highest position using nested match statements
    let highest_position = match &current_dimensions.data {
        Some(dimensions) => {
            match dimensions.iter().map(|d| d.position).max() {
                Some(pos) => pos,
                None => 0
            }
        },
        None => 0
    };

    // Create new dimension with position = highest + 1
    let dimension_request = CreateDimensionRequestContent {
        dimension: req.dimension.clone(),
        position: highest_position + 1,
        schema: req.schema.clone(),
        description: req.description.clone(),
        function_name: None,
        change_reason: "Creating new dimension".to_string(),
    };

    let dimension = create_dimension(
        &state.superposition_configuration,
        &state.env.superposition_org_id,
        &workspace_name,
        dimension_request,
    )
    .await
    .map_err(|e| error::ErrorInternalServerError(format!("Failed to create dimension: {}", e)))?;

    Ok(Json(dimension))
}

#[get("/list")]
async fn list_dimensions_api(
    auth_response: ReqData<AuthResponse>,
    query: web::Query<ListDimensionsQuery>,
    state: web::Data<AppState>,
) -> Result<Json<ListDimensionsResponseContent>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation = 
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application = 
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    // Get database connection
    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    // Get workspace name for this application
    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn).await?;

    // Call Superposition list_dimensions API
    let dimensions = list_dimensions(
        &state.superposition_configuration,
        &state.env.superposition_org_id,
        &workspace_name,
        query.page,
        query.count,
    )
    .await
    .map_err(|e| error::ErrorInternalServerError(format!("Failed to list dimensions: {}", e)))?;

    Ok(Json(dimensions))
}

#[put("/{dimension_name}")]
async fn update_dimension_api(
    path: Path<String>,
    req: Json<UpdateDimensionRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<UpdateDimensionResponseContent>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation = 
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application = 
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    // Get database connection
    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    // Get workspace name for this application
    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn).await?;

    // Create update request
    let dimension_request = UpdateDimensionRequestContent {
        position: req.position,
        schema: None,
        description: None,
        function_name: None,
        change_reason: req.change_reason.clone(),
    };

    // Call Superposition update_dimension API
    let updated_dimension = update_dimension(
        &state.superposition_configuration,
        &path.into_inner(),
        &state.env.superposition_org_id,
        &workspace_name,
        dimension_request,
    )
    .await
    .map_err(|e| error::ErrorInternalServerError(format!("Failed to update dimension: {}", e)))?;

    Ok(Json(updated_dimension))
}

#[delete("/{dimension_name}")]
async fn delete_dimension_api(
    path: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<()>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation = 
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application = 
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    // Get database connection
    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    // Get workspace name for this application
    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn).await?;

    // Call Superposition delete_dimension API
    superposition_rust_sdk::apis::default_api::delete_dimension(
        &state.superposition_configuration,
        &path.into_inner(),
        &state.env.superposition_org_id,
        &workspace_name
    )
    .await
    .map_err(|e| error::ErrorInternalServerError(format!("Failed to delete dimension: {}", e)))?;

    Ok(Json(()))
}