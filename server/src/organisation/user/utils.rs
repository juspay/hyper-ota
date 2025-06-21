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
        if let Some(parent_id) = &group.parent_id {
            if parent_id != org_id {
                continue;
            }

            // Get the role name from the group name instead of path
            if let Some(role) = &group.name {
                if let Some(level) = match role.as_str() {
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
