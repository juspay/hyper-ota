use futures::future;
use keycloak::KeycloakAdmin;
use log::{debug, warn};

use crate::{
    middleware::auth::{ADMIN, OWNER, READ, WRITE},
    utils::keycloak::find_role_subgroup,
};

use super::OrgError;

pub fn get_user_highest_level(
    groups: &[keycloak::types::GroupRepresentation],
    org_id: &str,
) -> Option<u8> {
    let mut highest = 0;

    for group in groups {
        if let Some(path) = &group.path {
            if !path.contains(&format!("/{}", org_id)) {
                continue;
            }

            if let Some(role) = path.split('/').last() {
                if let Some(level) = match role {
                    "read" => Some(READ.access),
                    "write" => Some(WRITE.access),
                    "admin" => Some(ADMIN.access),
                    "owner" => Some(OWNER.access),
                    _ => None,
                } {
                    highest = highest.max(level);
                }
            }
        }
    }

    if highest > 0 {
        Some(highest)
    } else {
        None
    }
}

pub async fn check_role_hierarchy(
    admin: &keycloak::KeycloakAdmin,
    realm: &str,
    org_group_id: &str,
    requester_id: &str,
    target_user_id: &str,
) -> Result<(), OrgError> {
    if requester_id == target_user_id {
        return Ok(());
    }

    let (requester_groups_result, target_groups_result) = tokio::join!(
        admin.realm_users_with_user_id_groups_get(realm, requester_id, None, None, None, None),
        admin.realm_users_with_user_id_groups_get(realm, target_user_id, None, None, None, None)
    );

    let requester_groups = requester_groups_result
        .map_err(|e| OrgError::Internal(format!("Failed to get requester groups: {}", e)))?;

    let target_groups = target_groups_result
        .map_err(|e| OrgError::Internal(format!("Failed to get target user groups: {}", e)))?;

    let requester_level =
        get_user_highest_level(&requester_groups, org_group_id).ok_or_else(|| {
            OrgError::Internal("Failed to determine requester's access level".to_string())
        })?;

    let target_level = get_user_highest_level(&target_groups, org_group_id).unwrap_or(0);

    if target_level > requester_level {
        return Err(OrgError::PermissionDenied(
            "Cannot modify users with higher access levels".into(),
        ));
    }

    Ok(())
}

pub async fn update_user_access_level(
    admin: &keycloak::KeycloakAdmin,
    realm: &str,
    org_group_id: &str,
    user_id: &str,
    target_role: &str,
    target_level: u8,
) -> Result<(), OrgError> {
    // Get current user's groups
    let user_groups = admin
        .realm_users_with_user_id_groups_get(realm, user_id, None, None, None, None)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to get user groups: {}", e)))?;

    // Track which groups we need to add/remove the user from
    let access_levels = [
        ("read", READ.access),
        ("write", WRITE.access),
        ("admin", ADMIN.access),
        ("owner", OWNER.access),
    ];

    // First find all group IDs to minimize API calls
    let mut role_groups = Vec::with_capacity(access_levels.len());
    for (role, _) in &access_levels {
        if let Some(role_group) = find_role_subgroup(admin, realm, org_group_id, role)
            .await
            .map_err(|e| OrgError::Internal(format!("Failed to find role group: {}", e)))?
        {
            if let Some(role_group_id) = role_group.id.as_ref() {
                role_groups.push((role.to_string(), role_group_id.clone()));
            }
        }
    }

    // Identify groups user is already in
    let user_group_ids: Vec<_> = user_groups
        .iter()
        .filter_map(|g| g.id.as_ref().map(|id| id.to_string()))
        .collect();

    // Execute all additions in parallel
    let mut add_futures = Vec::new();
    for (role, group_id) in &role_groups {
        let role_level = access_levels
            .iter()
            .find(|(r, _)| r == role)
            .map(|(_, level)| *level)
            .unwrap_or(0);

        if role_level <= target_level && !user_group_ids.contains(group_id) {
            debug!("Adding user to role group: {}", role);
            // Need to add user to this group
            add_futures.push(
                admin.realm_users_with_user_id_groups_with_group_id_put(realm, user_id, group_id),
            );
        }
    }

    // Execute all removals in parallel
    let mut remove_futures = Vec::new();
    for (role, group_id) in &role_groups {
        let role_level = access_levels
            .iter()
            .find(|(r, _)| r == role)
            .map(|(_, level)| *level)
            .unwrap_or(0);

        if role_level > target_level && user_group_ids.contains(group_id) {
            debug!("Removing user from role group: {}", role);
            // Need to remove user from this group
            remove_futures
                .push(admin.realm_users_with_user_id_groups_with_group_id_delete(
                    realm, user_id, group_id,
                ));
        }
    }

    // Wait for all operations to complete
    for result in future::join_all(add_futures).await {
        if let Err(e) = result {
            return Err(OrgError::Internal(format!(
                "Failed to add user to group: {}",
                e
            )));
        }
    }

    for result in future::join_all(remove_futures).await {
        if let Err(e) = result {
            return Err(OrgError::Internal(format!(
                "Failed to remove user from group: {}",
                e
            )));
        }
    }

    Ok(())
}

/// Check if user is the last owner of an organization
pub async fn is_last_owner(
    admin: &keycloak::KeycloakAdmin,
    realm: &str,
    org_group_id: &str,
    user_id: &str,
) -> Result<bool, OrgError> {
    // Find owner group
    let owner_group = find_role_subgroup(admin, realm, org_group_id, "owner")
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to find owner group: {}", e)))?
        .ok_or_else(|| OrgError::Internal("Owner group not found".to_string()))?;

    let owner_group_id = owner_group
        .id
        .as_ref()
        .ok_or_else(|| OrgError::Internal("Owner group has no ID".to_string()))?;

    // Check if user is an owner
    let user_groups = admin
        .realm_users_with_user_id_groups_get(realm, user_id, None, None, None, None)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to get user groups: {}", e)))?;

    let is_owner = user_groups
        .iter()
        .any(|g| g.id.as_ref() == Some(owner_group_id));

    if !is_owner {
        return Ok(false);
    }

    // Count total owners
    let all_owners = admin
        .realm_groups_with_group_id_members_get(realm, owner_group_id, None, None, None)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to get group members: {}", e)))?;

    Ok(all_owners.len() <= 1)
}

/// Validate access level string
pub fn validate_access_level(access: &str) -> Result<(String, u8), OrgError> {
    match access.to_lowercase().as_str() {
        "read" => Ok(("read".to_string(), READ.access)),
        "write" => Ok(("write".to_string(), WRITE.access)),
        "admin" => Ok(("admin".to_string(), ADMIN.access)),
        "owner" => Ok(("owner".to_string(), OWNER.access)),
        _ => Err(OrgError::InvalidAccessLevel(access.to_string())),
    }
}
