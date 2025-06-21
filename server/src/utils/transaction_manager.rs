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
use chrono::{DateTime, Utc};
use diesel::RunQueryDsl;
use keycloak::KeycloakAdmin;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use crate::types::AppState;
use crate::utils::db::models::CleanupOutboxEntry;
use crate::utils::db::schema::hyperotaserver::cleanup_outbox::dsl::cleanup_outbox;

/// Represents a resource in Keycloak that needs to be tracked for transaction management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeycloakResource {
    pub resource_type: String,
    pub resource_id: String,
}

/// Represents the state of a distributed transaction across multiple systems
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionState {
    /// Unique identifier for the transaction
    pub transaction_id: String,
    /// Name of the entity being created/modified
    pub entity_name: String,
    /// Type of entity (e.g., "organization", "application")
    pub entity_type: String,
    /// IDs of Keycloak resources created as part of this transaction
    pub keycloak_resource_ids: Vec<KeycloakResource>,
    /// ID of the Superposition resource if created
    pub superposition_resource_id: Option<String>,
    /// Whether the database insert was completed
    pub database_inserted: bool,
    /// Timestamp when the transaction was started
    pub created_at: DateTime<Utc>,
}

/// Manager for distributed transactions across multiple systems
pub struct TransactionManager {
    state: Arc<Mutex<TransactionState>>,
}

impl TransactionManager {
    pub fn new(entity_name: &str, entity_type: &str) -> Self {
        let transaction_id = Uuid::new_v4().to_string();
        TransactionManager {
            state: Arc::new(Mutex::new(TransactionState {
                transaction_id,
                entity_name: entity_name.to_string(),
                entity_type: entity_type.to_string(),
                keycloak_resource_ids: Vec::new(),
                superposition_resource_id: None,
                database_inserted: false,
                created_at: Utc::now(),
            })),
        }
    }

    pub fn add_keycloak_resource(&self, resource_type: &str, resource_id: &str) {
        let mut state = self.state.lock().unwrap();
        state.keycloak_resource_ids.push(KeycloakResource {
            resource_type: resource_type.to_string(),
            resource_id: resource_id.to_string(),
        });
    }

    pub fn add_keycloak_group(&self, group_id: &str) {
        self.add_keycloak_resource("group", group_id);
    }

    pub fn set_superposition_resource(&self, resource_id: &str) {
        let mut state = self.state.lock().unwrap();
        state.superposition_resource_id = Some(resource_id.to_string());
    }

    pub fn set_database_inserted(&self) {
        let mut state = self.state.lock().unwrap();
        state.database_inserted = true;
    }

    pub fn get_state(&self) -> TransactionState {
        self.state.lock().unwrap().clone()
    }

    pub fn is_complete(&self) -> bool {
        let state = self.state.lock().unwrap();
        state.database_inserted && state.superposition_resource_id.is_some()
    }

    pub async fn handle_rollback_if_needed(
        &self,
        admin: &KeycloakAdmin,
        realm: &str,
        app_state: &web::Data<AppState>,
    ) -> Result<bool, actix_web::Error> {
        if self.is_complete() {
            return Ok(false);
        }

        let tx_state = self.get_state();

        info!(
            "Rolling back incomplete transaction {} for {} {}",
            tx_state.transaction_id, tx_state.entity_type, tx_state.entity_name
        );

        // Keycloak cleanp
        for resource in tx_state.keycloak_resource_ids.iter().rev() {
            match resource.resource_type.as_str() {
                "group" => {
                    if let Err(e) = admin
                        .realm_groups_with_group_id_delete(realm, &resource.resource_id)
                        .await
                    {
                        warn!(
                            "Failed to delete Keycloak group {}: {}",
                            resource.resource_id, e
                        );
                    }
                }
                // Add other resource types as needed
                _ => warn!("Unknown Keycloak resource type: {}", resource.resource_type),
            }
        }

        // Superposition cleanup
        if let Some(sp_id) = &tx_state.superposition_resource_id {
            if let Err(e) = cleanup_superposition_resource(sp_id, &tx_state.entity_type).await {
                warn!("Failed to clean up Superposition resource: {}", e);
                // Record the failed cleanup for later reconciliation
                if let Err(e) = record_failed_cleanup(app_state, &tx_state).await {
                    error!("CRITICAL: Failed to record cleanup job: {}", e);
                }
            }
        }

        Ok(true)
    }
}

/// Clean up a Superposition resource
async fn cleanup_superposition_resource(
    resource_id: &str,
    resource_type: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Implement based on resource type
    match resource_type {
        "organization_create" => {
            // Note: If the Superposition SDK doesn't provide a delete organization method,
            // log this as something that needs manual cleanup
            warn!(
                "Superposition resource {} of type {} requires manual cleanup. SDK does not support deletion.",
                resource_id, resource_type
            );
            // Return Ok since we can't automatically clean this up
            Ok(())
        }
        "organization_user" | "organization_user_update" | "organization_user_remove" => {
            // User operations don't have their own Superposition resources
            // so there's nothing to clean up here
            Ok(())
        }
        _ => {
            warn!("Unknown Superposition resource type: {}", resource_type);
            Ok(())
        }
    }
}

/// Record a failed cleanup to the outbox for later reconciliation
pub async fn record_failed_cleanup(
    app_state: &web::Data<AppState>,
    tx_state: &TransactionState,
) -> Result<(), actix_web::Error> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        error::ErrorInternalServerError(format!("Database connection error: {}", e))
    })?;

    let state_json = serde_json::to_value(tx_state).map_err(|e| {
        error::ErrorInternalServerError(format!("Failed to serialize transaction state: {}", e))
    })?;

    let outbox_entry = CleanupOutboxEntry {
        transaction_id: tx_state.transaction_id.clone(),
        entity_name: tx_state.entity_name.clone(),
        entity_type: tx_state.entity_type.clone(),
        state: state_json,
        created_at: tx_state.created_at,
        attempts: 0,
        last_attempt: None,
    };

    diesel::insert_into(cleanup_outbox)
        .values(&outbox_entry)
        .execute(&mut conn)
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to insert cleanup job: {}", e))
        })?;

    info!(
        "Recorded cleanup job for transaction {} to outbox",
        tx_state.transaction_id
    );

    Ok(())
}

/// Process the cleanup outbox to retry failed cleanups
pub async fn process_cleanup_outbox(
    app_state: &web::Data<AppState>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use crate::utils::db::schema::hyperotaserver::cleanup_outbox::dsl::*;
    use chrono::Utc;
    use diesel::prelude::*;

    // Constants for cleanup job configuration
    const MAX_ATTEMPTS: i32 = 5;
    const MAX_JOBS_PER_RUN: i64 = 10;
    const MIN_RETRY_INTERVAL_SECS: i64 = 300; // 5 minutes

    info!("Starting cleanup outbox processing");

    // Get a database connection
    let mut conn = app_state.db_pool.get()?;

    // Get the current time
    let current_time = Utc::now();
    let min_retry_time = current_time - chrono::Duration::seconds(MIN_RETRY_INTERVAL_SECS);

    // Query for jobs that need processing:
    // 1. Less than MAX_ATTEMPTS
    // 2. Either never attempted (last_attempt is null) or last attempted more than MIN_RETRY_INTERVAL_SECS ago
    // 3. Limit to MAX_JOBS_PER_RUN to avoid overloading the system
    let pending_jobs: Vec<crate::utils::db::models::CleanupOutboxEntry> = cleanup_outbox
        .filter(attempts.lt(MAX_ATTEMPTS as i32))
        .filter(last_attempt.is_null().or(last_attempt.lt(min_retry_time)))
        .order_by(created_at.asc())
        .limit(MAX_JOBS_PER_RUN)
        .load::<crate::utils::db::models::CleanupOutboxEntry>(&mut conn)?;

    if pending_jobs.is_empty() {
        debug!("No pending cleanup jobs found");
        return Ok(());
    }

    info!(
        "Found {} pending cleanup jobs to process",
        pending_jobs.len()
    );

    // Process each job
    for job in pending_jobs {
        info!(
            "Processing cleanup job {} for {} {}",
            job.transaction_id, job.entity_type, job.entity_name
        );

        // Deserialize the transaction state
        let tx_state: Result<TransactionState, _> = serde_json::from_value(job.state.clone());

        if let Err(e) = tx_state {
            error!(
                "Failed to deserialize transaction state for job {}: {}",
                job.transaction_id, e
            );

            // Update the job with an incremented attempt count
            diesel::update(cleanup_outbox.find(&job.transaction_id))
                .set((attempts.eq(job.attempts + 1), last_attempt.eq(current_time)))
                .execute(&mut conn)?;

            continue;
        }

        let tx_state = tx_state.unwrap();

        // Attempt to clean up resources based on entity type
        let cleanup_result = match job.entity_type.as_str() {
            "organization_create"
            | "organization_user"
            | "organization_user_update"
            | "organization_user_remove" => {
                process_organization_cleanup(app_state, &tx_state).await
            }
            // Add more entity types as needed
            _ => {
                warn!("Unknown entity type for cleanup: {}", job.entity_type);
                Err("Unknown entity type".into())
            }
        };

        match cleanup_result {
            Ok(_) => {
                info!(
                    "Successfully cleaned up job {} for {} {}",
                    job.transaction_id, job.entity_type, job.entity_name
                );

                // Delete the job as it's been successfully processed
                diesel::delete(cleanup_outbox.find(&job.transaction_id)).execute(&mut conn)?;
            }
            Err(e) => {
                warn!(
                    "Failed to clean up job {} for {} {}: {}",
                    job.transaction_id, job.entity_type, job.entity_name, e
                );

                // Update the job with an incremented attempt count
                diesel::update(cleanup_outbox.find(&job.transaction_id))
                    .set((attempts.eq(job.attempts + 1), last_attempt.eq(current_time)))
                    .execute(&mut conn)?;
            }
        }
    }

    info!("Completed cleanup outbox processing");
    Ok(())
}

/// Process cleanup for organization-related transactions
async fn process_organization_cleanup(
    app_state: &web::Data<AppState>,
    tx_state: &TransactionState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Get an admin client for Keycloak using the token retriever
    let client = reqwest::Client::new();

    // Create a token retriever
    let token_retriever =
        keycloak::KeycloakServiceAccountAdminTokenRetriever::create_with_custom_realm(
            &app_state.env.client_id,
            &app_state.env.secret,
            &app_state.env.realm,
            client.clone(),
        );

    // Fetch client level admin token
    let admin_token = token_retriever
        .acquire(&app_state.env.keycloak_url)
        .await
        .map_err(|e| format!("Failed to acquire Keycloak admin token: {}", e))?;

    let admin = keycloak::KeycloakAdmin::new(&app_state.env.keycloak_url, admin_token, client);
    let realm = app_state.env.realm.clone();

    // Check what needs to be cleaned up
    let need_keycloak_cleanup = !tx_state.keycloak_resource_ids.is_empty();
    let need_superposition_cleanup =
        tx_state.superposition_resource_id.is_some() && !tx_state.database_inserted;

    // Clean up Keycloak resources if needed
    if need_keycloak_cleanup {
        for resource in tx_state.keycloak_resource_ids.iter().rev() {
            match resource.resource_type.as_str() {
                "group" => {
                    debug!("Cleaning up Keycloak group: {}", resource.resource_id);
                    if let Err(e) = admin
                        .realm_groups_with_group_id_delete(&realm, &resource.resource_id)
                        .await
                    {
                        warn!(
                            "Failed to delete Keycloak group {}: {}",
                            resource.resource_id, e
                        );
                    }
                }
                "user_group_membership" => {
                    if let Some((user_id, group_id)) = resource.resource_id.split_once(':') {
                        debug!(
                            "Cleaning up user group membership: User {} from group {}",
                            user_id, group_id
                        );
                        if let Err(e) = admin
                            .realm_users_with_user_id_groups_with_group_id_delete(
                                &realm, user_id, group_id,
                            )
                            .await
                        {
                            warn!("Failed to remove user from group: {}", e);
                        }
                    } else {
                        warn!(
                            "Invalid user_group_membership format: {}",
                            resource.resource_id
                        );
                    }
                }
                "user_group_removal" => {
                    // For removals, we need to re-add users to groups
                    if let Some((user_id, group_id)) = resource.resource_id.split_once(':') {
                        debug!(
                            "Restoring user group membership: User {} to group {}",
                            user_id, group_id
                        );
                        if let Err(e) = admin
                            .realm_users_with_user_id_groups_with_group_id_put(
                                &realm, user_id, group_id,
                            )
                            .await
                        {
                            warn!("Failed to add user back to group: {}", e);
                        }
                    } else {
                        warn!(
                            "Invalid user_group_removal format: {}",
                            resource.resource_id
                        );
                    }
                }
                _ => warn!("Unknown Keycloak resource type: {}", resource.resource_type),
            }
        }
    }

    // Clean up Superposition resources if needed
    if need_superposition_cleanup {
        if let Some(sp_id) = &tx_state.superposition_resource_id {
            debug!("Cleaning up Superposition resource: {}", sp_id);
            if let Err(e) = cleanup_superposition_resource(sp_id, &tx_state.entity_type).await {
                warn!("Failed to clean up Superposition resource: {}", e);
                // Return error to trigger retry
                return Err(format!("Failed to clean up Superposition resource: {}", e).into());
            }
        }
    }

    Ok(())
}

pub fn start_cleanup_job(app_state: web::Data<AppState>) -> tokio::task::JoinHandle<()> {
    let state_clone = app_state.clone();
    tokio::spawn(async move {
        loop {
            if let Err(e) = process_cleanup_outbox(&state_clone).await {
                error!("Error processing cleanup outbox: {}", e);
            }

            // Run every minute
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    })
}
