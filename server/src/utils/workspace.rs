use diesel::prelude::*;
use diesel::{insert_into, PgConnection};
use crate::utils::db::{
    models::{NewWorkspaceName, WorkspaceName},
    schema::hyperotaserver::workspace_names,
};

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
            println!("Failed to get workspace name for application {}: {}", application, e);
            actix_web::error::ErrorInternalServerError(format!("Failed to get workspace name: {}", e))
        })?;
    
    Ok(workspace.workspace_name)
}
