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

use actix_web::{error, web};
use keycloak::{types::GroupRepresentation, KeycloakAdmin};
use log::{debug, error, info, warn};

use crate::{
    middleware::auth::ROLES, types::AppState, utils::transaction_manager::TransactionManager,
};

use super::Organisation;

pub async fn create_organisation_with_transaction(
    organisation: &str,
    admin: &KeycloakAdmin,
    realm: &str,
    user_id: &str,
    state: &web::Data<AppState>,
) -> actix_web::Result<Organisation> {
    // Create a transaction manager for this operation
    let transaction = TransactionManager::new(organisation, "organization_create");

    debug!(
        "Starting transaction to create organization {}",
        organisation
    );

    // Step 1: Create parent group in Keycloak
    let group_id = match admin
        .realm_groups_post(
            realm,
            GroupRepresentation {
                name: Some(organisation.to_string()),
                ..Default::default()
            },
        )
        .await
    {
        Ok(id) => {
            let group_id = id.unwrap_or_default();
            // Record this resource in the transaction
            transaction.add_keycloak_group(&group_id);
            debug!("Created organization parent group {}", group_id);
            group_id
        }
        Err(e) => {
            return Err(error::ErrorInternalServerError(format!(
                "Failed to create organization group: {}",
                e
            )))
        }
    };

    // Step 2: Create role groups and add user to them
    for role in ROLES {
        match admin
            .realm_groups_with_group_id_children_post(
                realm,
                &group_id,
                GroupRepresentation {
                    name: Some(role.to_string()),
                    ..Default::default()
                },
            )
            .await
        {
            Ok(id) => {
                let role_id = id.unwrap_or_default();
                transaction.add_keycloak_group(&role_id);
                debug!("Created role group {} for organization", role);

                // Add the user to the role-specific group
                if let Err(e) = admin
                    .realm_users_with_user_id_groups_with_group_id_put(realm, user_id, &role_id)
                    .await
                {
                    // If adding user fails, handle rollback via transaction manager
                    if let Err(rollback_err) = transaction
                        .handle_rollback_if_needed(admin, realm, state)
                        .await
                    {
                        error!("Rollback failed: {}", rollback_err);
                    }

                    return Err(error::ErrorInternalServerError(format!(
                        "Failed to add user to role group: {}",
                        e
                    )));
                }
            }
            Err(e) => {
                // If role group creation fails, handle rollback via transaction manager
                if let Err(rollback_err) = transaction
                    .handle_rollback_if_needed(admin, realm, state)
                    .await
                {
                    error!("Rollback failed: {}", rollback_err);
                }

                return Err(error::ErrorInternalServerError(format!(
                    "Failed to create role group: {}",
                    e
                )));
            }
        }
    }

    transaction.set_database_inserted();
    debug!(
        "Organization {} uses pre-configured Superposition organization ID from environment.",
        organisation
    );

    // Transaction is complete for Keycloak group creation
    info!(
        "Successfully completed transaction to create Keycloak groups for organization {}",
        organisation
    );

    Ok(Organisation {
        name: organisation.to_string(),
        applications: vec![],
        access: ROLES.iter().map(|&s| s.to_string()).collect(),
    })
}

/// Delete an organization with robust transaction support
pub async fn delete_organisation_with_transaction(
    organisation: &str,
    admin: &KeycloakAdmin,
    realm: &str,
    // user_id: &str,
    state: &web::Data<AppState>,
) -> actix_web::Result<()> {
    // Create a transaction manager for this operation
    let transaction = TransactionManager::new(organisation, "organization_delete");

    debug!(
        "Starting transaction to delete organization {}",
        organisation
    );

    debug!("Organization {} uses pre-configured Superposition organization ID from environment. This delete operation will focus on Keycloak resources.", organisation);

    // Find and track all groups to delete
    // First, get the organization parent group
    let groups = match admin
        .realm_groups_get(
            realm,
            None,
            Some(true),
            None,
            Some(2),
            Some(false),
            None,
            Some(organisation.to_string()),
        )
        .await
    {
        Ok(groups) => groups,
        Err(e) => {
            return Err(error::ErrorInternalServerError(format!(
                "Failed to retrieve organization groups: {}",
                e
            )))
        }
    };

    // Find the parent group ID
    let parent_group_id = match groups
        .iter()
        .find(|g| g.name == Some(organisation.to_string()))
    {
        Some(group) => match &group.id {
            Some(id) => id.clone(),
            None => {
                return Err(error::ErrorInternalServerError(
                    "Parent group has no ID".to_string(),
                ))
            }
        },
        None => {
            return Err(error::ErrorInternalServerError(
                "Parent group not found".to_string(),
            ))
        }
    };

    // Track the parent group for potential rollback (in case we need to restore)
    transaction.add_keycloak_group(&parent_group_id);

    debug!(
        "Skipping local database deletion for organization {} as table is removed.",
        organisation
    );
    warn!("The pre-configured Superposition organization (ID from env) is not affected by this Keycloak group deletion operation.");
    transaction.set_database_inserted(); // Signifies this phase is complete (no actual DB delete for org)

    // Step 3: Delete all applications associated with the organization (Concept might remain if apps are tied to Keycloak group)
    // This would involve finding all applications and deleting them
    // Omitted for brevity, but would be needed in a complete implementation

    // Step 4: Delete the Keycloak group (this will cascade delete all child groups)
    match admin
        .realm_groups_with_group_id_delete(realm, &parent_group_id)
        .await
    {
        Ok(_) => {
            debug!("Deleted organization group in Keycloak");
        }
        Err(e) => {
            // If Keycloak deletion fails, handle rollback (restore DB entry)
            if let Err(rollback_err) = transaction
                .handle_rollback_if_needed(admin, realm, state)
                .await
            {
                error!("Rollback failed: {}", rollback_err);
            }

            return Err(error::ErrorInternalServerError(format!(
                "Failed to delete organization groups in Keycloak: {}",
                e
            )));
        }
    }

    // Transaction is complete
    info!(
        "Successfully completed transaction to delete organization {}",
        organisation
    );

    Ok(())
}
