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

mod transaction;
mod utils;

use actix_web::{
    error, get, post,
    web::{self, Json},
    HttpMessage, HttpRequest, Scope,
};
use log::{debug, info};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::{
    middleware::auth::{
        validate_required_access, validate_user, Access, AuthResponse, ADMIN, READ, WRITE,
    },
    types::AppState,
    utils::keycloak::{find_org_group, find_user_by_username, prepare_user_action},
};

use self::{
    transaction::{
        add_user_with_transaction, get_user_current_role, remove_user_with_transaction,
        update_user_with_transaction,
    },
    utils::{check_role_hierarchy, is_last_owner, validate_access_level},
};

/// Errors that can occur during organization operations
#[derive(Error, Debug)]
pub enum OrgError {
    #[error("User not found: {0}")]
    UserNotFound(String),

    #[error("Organisation not found: {0}")]
    OrgNotFound(String),

    #[error("Invalid access level: {0}")]
    InvalidAccessLevel(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Last owner cannot be modified: {0}")]
    LastOwner(String),
}

impl From<OrgError> for actix_web::Error {
    fn from(err: OrgError) -> Self {
        match err {
            OrgError::UserNotFound(_) => error::ErrorBadRequest(err.to_string()),
            OrgError::OrgNotFound(_) => error::ErrorBadRequest(err.to_string()),
            OrgError::InvalidAccessLevel(_) => error::ErrorBadRequest(err.to_string()),
            OrgError::Internal(_) => error::ErrorInternalServerError(err.to_string()),
            OrgError::Unauthorized(_) => error::ErrorUnauthorized(err.to_string()),
            OrgError::PermissionDenied(_) => error::ErrorForbidden(err.to_string()),
            OrgError::LastOwner(_) => error::ErrorBadRequest(err.to_string()),
        }
    }
}

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(organisation_list_users)
        .service(organisation_add_user)
        .service(organisation_update_user)
        .service(organisation_remove_user)
}

// Request and Response Types

#[derive(Deserialize)]
struct UserRequest {
    user: String,
    access: String,
}

#[derive(Deserialize)]
struct RemoveUserRequest {
    user: String,
}

#[derive(Serialize)]
struct UserOperationResponse {
    user: String,
    success: bool,
    operation: String,
}

#[derive(Serialize)]
struct ListUsersResponse {
    users: Vec<UserInfo>,
}

#[derive(Serialize)]
struct UserInfo {
    username: String,
    email: Option<String>,
    roles: Vec<String>,
}

// Helper structs

struct UserContext {
    user_id: String,
    username: String,
}

struct OrgContext {
    org_id: String,
    group_id: String,
}

/// Get organization context and validate user permissions
async fn get_org_context(
    req: &HttpRequest,
    required_level: Access,
    operation: &str,
) -> Result<(String, AuthResponse), OrgError> {
    let auth = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or_else(|| OrgError::Unauthorized("Missing auth context".to_string()))?;

    validate_required_access(&auth, required_level.access, operation)
        .await
        .map_err(|e| OrgError::Unauthorized(e))?;

    let org_name = validate_user(auth.organisation.clone(), required_level)
        .map_err(|e| OrgError::Unauthorized(e))?;

    Ok((org_name, auth))
}

/// Find a user and extract their ID
async fn find_target_user(
    admin: &keycloak::KeycloakAdmin,
    realm: &str,
    username: &str,
) -> Result<UserContext, OrgError> {
    let target_user = find_user_by_username(&admin, realm, username)
        .await
        .map_err(|e| OrgError::Internal(format!("Keycloak error: {}", e)))?
        .ok_or_else(|| OrgError::UserNotFound(username.to_string()))?;

    let target_user_id = target_user
        .id
        .as_ref()
        .ok_or_else(|| OrgError::Internal("User has no ID".to_string()))?
        .to_string();

    let username = target_user
        .username
        .as_ref()
        .ok_or_else(|| OrgError::Internal("User has no username".to_string()))?
        .to_string();

    Ok(UserContext {
        user_id: target_user_id,
        username,
    })
}

/// Find an organization and extract its ID
async fn find_organization(
    admin: &keycloak::KeycloakAdmin,
    realm: &str,
    org_name: &str,
) -> Result<OrgContext, OrgError> {
    let org_group = find_org_group(&admin, realm, org_name)
        .await
        .map_err(|e| OrgError::Internal(format!("Keycloak error: {}", e)))?
        .ok_or_else(|| OrgError::OrgNotFound(org_name.to_string()))?;

    let org_group_id = org_group
        .id
        .as_ref()
        .ok_or_else(|| OrgError::Internal("Group has no ID".to_string()))?
        .to_string();

    Ok(OrgContext {
        org_id: org_name.to_string(),
        group_id: org_group_id,
    })
}

/// Check if the user can be modified (not the last owner)
async fn check_user_modifiable(
    admin: &keycloak::KeycloakAdmin,
    realm: &str,
    org_group_id: &str,
    target_user_id: &str,
    new_role: &str,
) -> Result<(), OrgError> {
    // Only check if we're changing from owner role
    if new_role != "owner" {
        let is_last = is_last_owner(&admin, realm, org_group_id, target_user_id)
            .await
            .map_err(|e| OrgError::Internal(e.to_string()))?;

        if is_last {
            return Err(OrgError::LastOwner(
                "Cannot modify the last owner. Add another owner first.".to_string(),
            ));
        }
    }
    Ok(())
}

#[post("/create")]
async fn organisation_add_user(
    req: HttpRequest,
    body: Json<UserRequest>,
    state: web::Data<AppState>,
) -> Result<Json<UserOperationResponse>, actix_web::Error> {
    let body = body.into_inner();

    // Get organization context and validate requester's permissions
    let (organisation, auth) = get_org_context(&req, WRITE, "add user").await?;
    let requester_id = &auth.sub;

    // Prepare Keycloak admin client
    let (admin, realm) = prepare_user_action(&req, state.clone())
        .await
        .map_err(|e| OrgError::Internal(e.to_string()))?;

    // Validate access level
    let (role_name, role_level) = validate_access_level(&body.access)?;

    // Additional permission check for admin/owner assignments
    if role_level >= ADMIN.access {
        if let Some(org_access) = &auth.organisation {
            if org_access.level < ADMIN.access {
                return Err(OrgError::PermissionDenied(
                    "Admin permission required to assign admin or owner roles".into(),
                )
                .into());
            }
        } else {
            return Err(OrgError::Unauthorized("No organization access".to_string()).into());
        }
    }

    // Find target user and organization in parallel
    let (target_user, org_context) = tokio::join!(
        find_target_user(&admin, &realm, &body.user),
        find_organization(&admin, &realm, &organisation)
    );

    let target_user = target_user?;
    let org_context = org_context?;

    // Check role hierarchy
    check_role_hierarchy(
        &admin,
        &realm,
        &org_context.group_id,
        requester_id,
        &target_user.user_id,
    )
    .await?;

    debug!(
        "Adding user {} to org {} with access level {}",
        body.user, organisation, role_name
    );

    // Use transaction function to add user
    add_user_with_transaction(&admin, &realm, &org_context, &target_user, &role_name).await?;

    info!(
        "Successfully added user {} to org {} with access level {}",
        body.user, organisation, role_name
    );

    Ok(Json(UserOperationResponse {
        user: body.user,
        success: true,
        operation: "add".to_string(),
    }))
}

#[post("/update")]
async fn organisation_update_user(
    req: HttpRequest,
    body: Json<UserRequest>,
    state: web::Data<AppState>,
) -> Result<Json<UserOperationResponse>, actix_web::Error> {
    let request = body.into_inner();

    // Get organization context and validate requester's permissions
    let (org_name, auth) = get_org_context(&req, ADMIN, "update user").await?;
    let requester_id = &auth.sub;

    // Prepare Keycloak admin client
    let (admin, realm) = prepare_user_action(&req, state.clone())
        .await
        .map_err(|e| OrgError::Internal(e.to_string()))?;

    // Validate the requested access level
    let (role_name, _access_level) = validate_access_level(&request.access)?;

    // Find target user and organization
    let target_user = find_target_user(&admin, &realm, &request.user).await?;
    let org_context = find_organization(&admin, &realm, &org_name).await?;

    // Check if this is the last owner and we're trying to change their role
    check_user_modifiable(
        &admin,
        &realm,
        &org_context.group_id,
        &target_user.user_id,
        &role_name,
    )
    .await?;

    // Check if requester has permission to modify this user (hierarchy check)
    check_role_hierarchy(
        &admin,
        &realm,
        &org_context.group_id,
        requester_id,
        &target_user.user_id,
    )
    .await?;

    // Get the user's current role for the transaction
    let current_role =
        get_user_current_role(&admin, &realm, &org_context, &target_user.user_id).await?;

    // Use transaction function to update user
    update_user_with_transaction(
        &admin,
        &realm,
        &org_context,
        &target_user,
        &role_name,
        &current_role,
        &state,
    )
    .await?;

    info!(
        "Successfully updated user {} in org {} to role {}",
        request.user, org_name, role_name
    );

    Ok(Json(UserOperationResponse {
        user: request.user,
        success: true,
        operation: "update".to_string(),
    }))
}

#[post("/remove")]
async fn organisation_remove_user(
    req: HttpRequest,
    body: Json<RemoveUserRequest>,
    state: web::Data<AppState>,
) -> Result<Json<UserOperationResponse>, actix_web::Error> {
    let request = body.into_inner();

    // Get organization context and validate requester's permissions
    let (org_name, auth) = get_org_context(&req, ADMIN, "remove user").await?;
    let requester_id = &auth.sub;

    // Prepare Keycloak admin client
    let (admin, realm) = prepare_user_action(&req, state.clone())
        .await
        .map_err(|e| OrgError::Internal(e.to_string()))?;

    // Find target user and organization
    let target_user = find_target_user(&admin, &realm, &request.user).await?;
    let org_context = find_organization(&admin, &realm, &org_name).await?;

    // Check if this user is the last owner (can't remove them)
    let is_last = is_last_owner(&admin, &realm, &org_context.group_id, &target_user.user_id)
        .await
        .map_err(|e| OrgError::Internal(e.to_string()))?;

    if is_last {
        return Err(OrgError::LastOwner(
            "Cannot remove the last owner from the organization".to_string(),
        )
        .into());
    }

    // Check if requester has permission to modify this user (hierarchy check)
    check_role_hierarchy(
        &admin,
        &realm,
        &org_context.group_id,
        requester_id,
        &target_user.user_id,
    )
    .await?;

    // Get user's current groups
    let user_groups = admin
        .realm_users_with_user_id_groups_get(&realm, &target_user.user_id, None, None, None, None)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to get user groups: {}", e)))?;

    // Use transaction function to remove user
    remove_user_with_transaction(
        &admin,
        &realm,
        &org_context,
        &target_user,
        &user_groups,
        &state,
    )
    .await?;

    info!(
        "Successfully removed user {} from organization {}",
        request.user, org_name
    );

    Ok(Json(UserOperationResponse {
        user: request.user,
        success: true,
        operation: "remove".to_string(),
    }))
}

#[get("/list")]
async fn organisation_list_users(
    req: HttpRequest,
    state: web::Data<AppState>,
) -> Result<Json<ListUsersResponse>, actix_web::Error> {
    // Get organization context and validate requester's permissions
    let (org_name, _) = get_org_context(&req, READ, "list users").await?;

    // Prepare Keycloak admin client
    let (admin, realm) = prepare_user_action(&req, state)
        .await
        .map_err(|e| OrgError::Internal(e.to_string()))?;

    // Find the organization
    let org_context = find_organization(&admin, &realm, &org_name).await?;

    debug!(
        "Listing users for organization: {} (ID: {})",
        org_name, org_context.group_id
    );

    // Get all users in the realm
    let all_users = admin
        .realm_users_get(
            &realm,
            Some(true), // briefRepresentation
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to get users: {}", e)))?;

    // Collect information about users in this organization
    let mut user_infos = Vec::new();
    let org_path = format!("/{}/", org_name);

    for user in all_users {
        if let Some(user_id) = user.id.as_ref() {
            // Get groups for this user
            let user_groups = admin
                .realm_users_with_user_id_groups_get(&realm, user_id, None, None, None, None)
                .await
                .map_err(|e| OrgError::Internal(format!("Failed to get user groups: {}", e)))?;

            // Check if user is in this organization
            let is_member = user_groups.iter().any(|group| {
                group
                    .path
                    .as_ref()
                    .map_or(false, |path| path.contains(&org_path))
            });

            if is_member {
                let username = user
                    .username
                    .as_ref()
                    .ok_or_else(|| OrgError::Internal("User has no username".to_string()))?;

                // Extract roles from group paths
                let roles = user_groups
                    .iter()
                    .filter_map(|group| {
                        if let Some(path) = &group.path {
                            if path.starts_with(&format!("/{}/", org_name)) {
                                return path.split('/').last().map(String::from);
                            }
                        }
                        None
                    })
                    .collect();

                user_infos.push(UserInfo {
                    username: username.clone(),
                    email: user.email.clone(),
                    roles,
                });
            }
        }
    }

    info!(
        "Found {} users in organization {}",
        user_infos.len(),
        org_name
    );

    Ok(Json(ListUsersResponse { users: user_infos }))
}
