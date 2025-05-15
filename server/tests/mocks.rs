use hyper_ota_server::organisation::Organisation;
use keycloak::types::GroupRepresentation;
use mockall::predicate::*;
use mockall::*;
use std::sync::{Arc, Mutex};
use superposition_rust_sdk::models::CreaterOrganisationRequestContent;
// Define our own SuperpositionOrg struct to use in the mock
#[derive(Default)]
struct SuperpositionOrg {
    id: String,
    name: String,
}

// Mock for KeycloakAdmin
mock! {
    pub KeycloakAdmin {
        pub async fn realm_groups_get(
            &self,
            realm: &str,
            brief_rep: Option<bool>,
            exact: Option<bool>,
            first: Option<i32>,
            max: Option<i32>,
            search: Option<bool>,
            q: Option<String>,
            search_query: Option<String>,
        ) -> Result<Vec<GroupRepresentation>, reqwest::Error>;

        pub async fn realm_groups_post(
            &self,
            realm: &str,
            group: GroupRepresentation,
        ) -> Result<Option<String>, reqwest::Error>;

        pub async fn realm_groups_with_group_id_children_post(
            &self,
            realm: &str,
            group_id: &str,
            group: GroupRepresentation,
        ) -> Result<Option<String>, reqwest::Error>;

        pub async fn realm_users_with_user_id_groups_with_group_id_put(
            &self,
            realm: &str,
            user_id: &str,
            group_id: &str,
        ) -> Result<(), reqwest::Error>;

        pub async fn realm_groups_with_group_id_delete(
            &self,
            realm: &str,
            group_id: &str,
        ) -> Result<(), reqwest::Error>;
    }
}

// Helper to create a preconfigured KeycloakAdmin mock for successful organization creation
pub fn mock_keycloak_admin_success() -> MockKeycloakAdmin {
    let mut mock = MockKeycloakAdmin::new();

    // Mock group check - empty result means no existing group
    mock.expect_realm_groups_get()
        .returning(|_, _, _, _, _, _, _, _| Ok(vec![]));

    // Mock parent group creation
    mock.expect_realm_groups_post()
        .returning(|_, _| Ok(Some("parent-group-id".to_string())));

    // Mock role group creation - called 4 times for the 4 roles
    mock.expect_realm_groups_with_group_id_children_post()
        .returning(|_, _, _| Ok(Some("role-group-id".to_string())));

    // Mock adding user to role group - called 4 times
    mock.expect_realm_users_with_user_id_groups_with_group_id_put()
        .returning(|_, _, _| Ok(()));

    mock
}

// Global mutable state to track calls to the mock Superposition API
pub struct SuperpositionMockState {
    pub created_orgs: Vec<String>,
}

// Static mock state available throughout the tests
lazy_static::lazy_static! {
    pub static ref SUPERPOSITION_MOCK_STATE: Arc<Mutex<SuperpositionMockState>> = Arc::new(Mutex::new(
        SuperpositionMockState {
            created_orgs: Vec::new(),
        }
    ));
}

// Helper function to mock the Superposition API calls
pub async fn mock_superposition_create_org(
    name: &str,
) -> Result<SuperpositionOrg, superposition_rust_sdk::apis::Error<()>> {
    // Record the creation
    let mut state = SUPERPOSITION_MOCK_STATE.lock().unwrap();
    state.created_orgs.push(name.to_string());

    // Return a mock Organization
    Ok(SuperpositionOrg {
        id: format!("sp-org-id-{}", name),
        name: name.to_string(),
        ..Default::default()
    })
}

// Helper function to mock database operations
pub fn mock_db_operations() -> impl Fn(&str) -> Result<(), diesel::result::Error> {
    move |_: &str| Ok(())
}

// Helper to build a test organization object
pub fn build_test_organisation(name: &str) -> Organisation {
    Organisation {
        name: name.to_string(),
        applications: vec![],
        access: vec![
            "read".to_string(),
            "write".to_string(),
            "admin".to_string(),
            "owner".to_string(),
        ],
    }
}
