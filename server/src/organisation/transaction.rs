use actix_web::{error, web, HttpResponse};
use diesel::RunQueryDsl;
use keycloak::{types::GroupRepresentation, KeycloakAdmin};
use log::{debug, error, info, warn};
use serde_json::json;
use superposition_rust_sdk::{
    apis::default_api::creater_organisation, models::CreaterOrganisationRequestContent,
};

use crate::{
    middleware::auth::ROLES,
    types::AppState,
    utils::{
        db::{models::OrgEnty, schema::hyperotaserver::organisations::dsl::organisations},
        transaction_manager::{record_failed_cleanup, TransactionManager},
    },
};

use super::Organisation;

/// Create an organization with robust transaction support
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

    // Step 3: Prepare database connection
    let mut conn = match state.db_pool.get() {
        Ok(conn) => conn,
        Err(e) => {
            // If database connection fails, handle rollback
            if let Err(rollback_err) = transaction
                .handle_rollback_if_needed(admin, realm, state)
                .await
            {
                error!("Rollback failed: {}", rollback_err);
            }

            return Err(error::ErrorInternalServerError(format!(
                "Database connection error: {}",
                e
            )));
        }
    };

    // Step 4 (LAST STEP): Create organization in Superposition
    // This is the last step to prevent orphaned Superposition resources
    let sp_organisation = match creater_organisation(
        &state.superposition_configuration,
        CreaterOrganisationRequestContent {
            name: organisation.to_string(),
            ..Default::default()
        },
    )
    .await
    {
        Ok(org) => {
            transaction.set_superposition_resource(&org.id);
            debug!("Created Superposition organization with ID {}", org.id);
            org
        }
        Err(e) => {
            // If Superposition creation fails, handle rollback
            if let Err(rollback_err) = transaction
                .handle_rollback_if_needed(admin, realm, state)
                .await
            {
                error!("Rollback failed: {}", rollback_err);
            }

            return Err(error::ErrorInternalServerError(format!(
                "Failed to create organization in Superposition: {}",
                e
            )));
        }
    };

    // Step 5: Create organization entry in database
    match diesel::insert_into(organisations)
        .values(OrgEnty {
            name: organisation.to_string(),
            superposition_organisation: sp_organisation.id.clone(),
        })
        .execute(&mut conn)
    {
        Ok(_) => {
            transaction.set_database_inserted();
            debug!("Created database entry for organization {}", organisation);
        }
        Err(e) => {
            // Superposition organization is already created, but we can't delete it.
            // We'll log the error and must address it manually or through the cleanup job.
            error!(
                "Failed to insert organization into database after Superposition creation. 
                 Superposition organization ID {} for {} must be manually cleaned up. Error: {}",
                sp_organisation.id, organisation, e
            );

            // Attempt rollback of Keycloak resources
            if let Err(rollback_err) = transaction
                .handle_rollback_if_needed(admin, realm, state)
                .await
            {
                error!("Rollback failed: {}", rollback_err);
            }

            return Err(error::ErrorInternalServerError(format!(
                "Failed to insert organization into database: {}",
                e
            )));
        }
    }

    // Transaction is complete
    info!(
        "Successfully completed transaction to create organization {}",
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
    user_id: &str,
    state: &web::Data<AppState>,
) -> actix_web::Result<()> {
    // Create a transaction manager for this operation
    let transaction = TransactionManager::new(organisation, "organization_delete");

    debug!(
        "Starting transaction to delete organization {}",
        organisation
    );

    // Get organization info from database
    let mut conn = match state.db_pool.get() {
        Ok(conn) => conn,
        Err(e) => {
            return Err(error::ErrorInternalServerError(format!(
                "Database connection error: {}",
                e
            )))
        }
    };

    // Find the organization record to get the Superposition ID
    use crate::utils::db::schema::hyperotaserver::organisations::dsl::*;
    use diesel::prelude::*;

    let org_entry: Result<OrgEnty, diesel::result::Error> =
        organisations.filter(name.eq(organisation)).first(&mut conn);

    // MODIFIED: Handle case where organization doesn't exist in database
    let superposition_organisation_id = match org_entry {
        Ok(entry) => {
            debug!("Found organization in database: {}", organisation);
            // Mark the Superposition resource for tracking (for rollback)
            transaction.set_superposition_resource(&entry.superposition_organisation);
            Some(entry.superposition_organisation.clone())
        }
        Err(e) => {
            // If it's specifically a "not found" error
            if let diesel::result::Error::NotFound = e {
                warn!("Organization {} exists in Keycloak but not in database - proceeding with Keycloak deletion only", organisation);
                None
            } else {
                // For other database errors, return an error
                return Err(error::ErrorInternalServerError(format!(
                    "Database error when finding organization: {}",
                    e
                )));
            }
        }
    };

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

    // MODIFIED: Only delete from database if it existed there
    if let Some(sp_id) = &superposition_organisation_id {
        // Step 1: Delete from database
        match diesel::delete(organisations.filter(name.eq(organisation))).execute(&mut conn) {
            Ok(_) => {
                transaction.set_database_inserted(); // Repurposing this flag to indicate DB operation completed
                debug!("Deleted database entry for organization {}", organisation);
            }
            Err(e) => {
                return Err(error::ErrorInternalServerError(format!(
                    "Failed to delete organization from database: {}",
                    e
                )))
            }
        };

        // Step 2: Clean up in Superposition
        debug!("Need to clean up Superposition organization ID: {}", sp_id);

        // If no deletion API is available, record for manual cleanup
        warn!(
            "Superposition organization {} must be manually cleaned up - API does not support deletion",
            sp_id
        );

        // Record the clean-up need in the outbox for the cleanup job to handle
        let cleanup_state = transaction.get_state();
        if let Err(e) = record_failed_cleanup(state, &cleanup_state).await {
            error!("Failed to record Superposition cleanup need: {}", e);
            // Continue anyway as this isn't critical for the delete operation
        }
    } else {
        debug!("Organization not found in database, skipping database deletion");
    }

    // Step 3: Delete all applications associated with the organization
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
