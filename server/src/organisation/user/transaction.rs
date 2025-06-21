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

use actix_web::web;
use keycloak::KeycloakAdmin;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};

use crate::{
    organisation::user::OrgError,
    types::AppState,
    utils::{
        keycloak::find_role_subgroup,
        transaction_manager::{record_failed_cleanup, TransactionManager},
    },
};

use super::{OrgContext, UserContext};

/// Represents the operation being performed on a user in an organization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserOperation {
    Add,
    Update,
    Remove,
}

/// Add a user to an organization with transaction management
pub async fn add_user_with_transaction(
    admin: &KeycloakAdmin,
    realm: &str,
    org_context: &OrgContext,
    target_user: &UserContext,
    role_name: &str,
    // state: &web::Data<AppState>,
) -> Result<(), OrgError> {
    // Create a new transaction manager for this operation
    let transaction = TransactionManager::new(&org_context.org_id, "organization_user");

    debug!(
        "Starting transaction to add user {} to org {} with role {}",
        target_user.username, org_context.org_id, role_name
    );

    // Find the role group
    let role_group = find_role_subgroup(admin, realm, &org_context.group_id, role_name)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to find role group: {}", e)))?
        .ok_or_else(|| OrgError::Internal(format!("Role group {} not found", role_name)))?;

    let role_group_id = role_group
        .id
        .as_ref()
        .ok_or_else(|| OrgError::Internal("Role group has no ID".to_string()))?
        .to_string();

    // Step 1: Add user to role group
    match admin
        .realm_users_with_user_id_groups_with_group_id_put(
            realm,
            &target_user.user_id,
            &role_group_id,
        )
        .await
    {
        Ok(_) => {
            // Record this resource in the transaction
            transaction.add_keycloak_resource(
                "user_group_membership",
                &format!("{}:{}", target_user.user_id, role_group_id),
            );
            debug!(
                "Added user {} to role group {}",
                target_user.username, role_name
            );
        }
        Err(e) => {
            // If this fails, there's nothing to roll back yet
            return Err(OrgError::Internal(format!(
                "Failed to add user to role group: {}",
                e
            )));
        }
    }

    // Mark the transaction as complete since there are no database or Superposition resources involved
    transaction.set_database_inserted();

    info!(
        "Successfully completed transaction to add user {} to org {} with role {}",
        target_user.username, org_context.org_id, role_name
    );

    Ok(())
}

/// Update a user's role in an organization with transaction management
pub async fn update_user_with_transaction(
    admin: &KeycloakAdmin,
    realm: &str,
    org_context: &OrgContext,
    target_user: &UserContext,
    new_role_name: &str,
    current_role: &str,
    state: &web::Data<AppState>,
) -> Result<(), OrgError> {
    // Create a new transaction manager
    let transaction = TransactionManager::new(&org_context.org_id, "organization_user_update");

    debug!(
        "Starting transaction to update user {} in org {} from role {} to {}",
        target_user.username, org_context.org_id, current_role, new_role_name
    );

    // Find current role group
    let current_role_group = find_role_subgroup(admin, realm, &org_context.group_id, current_role)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to find current role group: {}", e)))?
        .ok_or_else(|| {
            OrgError::Internal(format!("Current role group {} not found", current_role))
        })?;

    let current_role_id = current_role_group
        .id
        .as_ref()
        .ok_or_else(|| OrgError::Internal("Current role group has no ID".to_string()))?
        .to_string();

    // Find new role group
    let new_role_group = find_role_subgroup(admin, realm, &org_context.group_id, new_role_name)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to find new role group: {}", e)))?
        .ok_or_else(|| OrgError::Internal(format!("New role group {} not found", new_role_name)))?;

    let new_role_id = new_role_group
        .id
        .as_ref()
        .ok_or_else(|| OrgError::Internal("New role group has no ID".to_string()))?
        .to_string();

    // Step 1: Add user to new role group
    match admin
        .realm_users_with_user_id_groups_with_group_id_put(
            realm,
            &target_user.user_id,
            &new_role_id,
        )
        .await
    {
        Ok(_) => {
            // Record this action in the transaction
            transaction.add_keycloak_resource(
                "user_group_membership",
                &format!("{}:{}", target_user.user_id, new_role_id),
            );
            debug!(
                "Added user {} to new role group {}",
                target_user.username, new_role_name
            );
        }
        Err(e) => {
            // If this fails, nothing to roll back yet
            return Err(OrgError::Internal(format!(
                "Failed to add user to new role group: {}",
                e
            )));
        }
    }

    // Step 2: Remove user from old role group
    match admin
        .realm_users_with_user_id_groups_with_group_id_delete(
            realm,
            &target_user.user_id,
            &current_role_id,
        )
        .await
    {
        Ok(_) => {
            debug!(
                "Removed user {} from old role group {}",
                target_user.username, current_role
            );
        }
        Err(e) => {
            warn!(
                "Failed to remove user from old role group: {}. Attempting rollback...",
                e
            );

            // Attempt to rollback by removing from new role group
            if let Err(rollback_err) = admin
                .realm_users_with_user_id_groups_with_group_id_delete(
                    realm,
                    &target_user.user_id,
                    &new_role_id,
                )
                .await
            {
                error!("Rollback failed: {}", rollback_err);
                // Record for future cleanup
                if let Err(record_err) =
                    record_failed_cleanup(state, &transaction.get_state()).await
                {
                    error!("Failed to record cleanup job: {}", record_err);
                }
            }

            return Err(OrgError::Internal(format!(
                "Failed to remove user from old role group: {}",
                e
            )));
        }
    }

    // Mark transaction as complete
    transaction.set_database_inserted();

    info!(
        "Successfully completed transaction to update user {} in org {} from role {} to {}",
        target_user.username, org_context.org_id, current_role, new_role_name
    );

    Ok(())
}

/// Remove a user from an organization with transaction management
pub async fn remove_user_with_transaction(
    admin: &KeycloakAdmin,
    realm: &str,
    org_context: &OrgContext,
    target_user: &UserContext,
    user_groups: &[keycloak::types::GroupRepresentation],
    state: &web::Data<AppState>,
) -> Result<(), OrgError> {
    // Create a new transaction manager
    let transaction = TransactionManager::new(&org_context.org_id, "organization_user_remove");

    debug!(
        "Starting transaction to remove user {} from org {}",
        target_user.username, org_context.org_id
    );

    // Filter groups that belong to this organization
    let org_path = format!("/{}/", org_context.org_id);
    let org_groups: Vec<_> = user_groups
        .iter()
        .filter(|g| g.path.as_ref().map_or(false, |p| p.contains(&org_path)))
        .collect();

    if org_groups.is_empty() {
        return Err(OrgError::Internal(format!(
            "User {} is not a member of any groups in organization {}",
            target_user.username, org_context.org_id
        )));
    }

    // Keep track of groups we've removed the user from (for potential rollback)
    let mut removed_groups = Vec::new();

    // Remove user from all organization groups
    for group in org_groups {
        if let (Some(path), Some(group_id)) = (&group.path, &group.id) {
            debug!(
                "Removing user {} from group: {}",
                target_user.username, path
            );

            match admin
                .realm_users_with_user_id_groups_with_group_id_delete(
                    realm,
                    &target_user.user_id,
                    group_id,
                )
                .await
            {
                Ok(_) => {
                    debug!("Successfully removed user from group: {}", path);
                    removed_groups.push(group.clone());
                    transaction.add_keycloak_resource(
                        "user_group_removal",
                        &format!("{}:{}", target_user.user_id, group_id),
                    );
                }
                Err(e) => {
                    warn!(
                        "Failed to remove user from group {}: {}. Attempting rollback...",
                        path, e
                    );

                    // Attempt to rollback by adding user back to removed groups
                    let mut rollback_failed = false;
                    for removed_group in &removed_groups {
                        if let Some(removed_id) = &removed_group.id {
                            if let Err(rollback_err) = admin
                                .realm_users_with_user_id_groups_with_group_id_put(
                                    realm,
                                    &target_user.user_id,
                                    removed_id,
                                )
                                .await
                            {
                                error!(
                                    "Rollback failed for group {}: {}",
                                    removed_group
                                        .path
                                        .as_ref()
                                        .unwrap_or(&"unknown".to_string()),
                                    rollback_err
                                );
                                rollback_failed = true;
                            }
                        }
                    }

                    // If rollback failed, record for future cleanup
                    if rollback_failed {
                        if let Err(record_err) =
                            record_failed_cleanup(state, &transaction.get_state()).await
                        {
                            error!("Failed to record cleanup job: {}", record_err);
                        }
                    }

                    return Err(OrgError::Internal(format!(
                        "Failed to remove user from group {}: {}",
                        path, e
                    )));
                }
            }
        }
    }

    // Mark transaction as complete
    transaction.set_database_inserted();

    info!(
        "Successfully completed transaction to remove user {} from org {}",
        target_user.username, org_context.org_id
    );

    Ok(())
}

/// Get a user's current role in an organization
pub async fn get_user_current_role(
    admin: &KeycloakAdmin,
    realm: &str,
    org_context: &OrgContext,
    user_id: &str,
) -> Result<String, OrgError> {
    // Get user's groups
    let user_groups = admin
        .realm_users_with_user_id_groups_get(realm, user_id, None, None, None, None)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to get user groups: {}", e)))?;

    // Find role groups under this organization
    let org_path = format!("/{}/", org_context.org_id);

    // Find the role group the user is in
    for group in user_groups {
        if let Some(path) = group.path {
            if path.starts_with(&org_path) && path != org_path {
                // Extract role name from path
                if let Some(role) = path.split('/').last() {
                    if !role.is_empty() {
                        return Ok(role.to_string());
                    }
                }
            }
        }
    }

    Err(OrgError::Internal(format!(
        "User is not a member of any role in organization {}",
        org_context.org_id
    )))
}
