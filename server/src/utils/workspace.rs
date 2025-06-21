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

use crate::utils::db::schema::hyperotaserver::workspace_names;
use diesel::prelude::*;

/// Get the workspace name for Superposition based on organization and application
/// This retrieves the workspace name that was created during application setup
/// which follows the format: {application_name}{generated_id}
pub async fn get_workspace_name_for_application(
    application: &str,
    organisation: &str,
    conn: &mut diesel::PgConnection,
) -> Result<String, actix_web::Error> {
    use crate::utils::db::models::WorkspaceName;

    let workspace: WorkspaceName = workspace_names::table
        .filter(workspace_names::organization_id.eq(organisation))
        .order(workspace_names::id.desc())
        .first(conn)
        .map_err(|e| {
            println!(
                "Failed to get workspace name for application {}: {}",
                application, e
            );
            actix_web::error::ErrorInternalServerError(format!(
                "Failed to get workspace name: {}",
                e
            ))
        })?;

    Ok(workspace.workspace_name)
}
