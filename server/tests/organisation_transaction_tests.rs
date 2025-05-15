use actix_web::{test, web, App, HttpMessage};
use hyper_ota_server::{middleware::auth::AuthResponse, organisation, types::AppState};
use keycloak::types::GroupRepresentation;
use reqwest::Error as ReqwestError;
use serde_json::json;
use std::sync::Arc;
use superposition_rust_sdk::apis::Error as SuperpositionError;

// Import shared test modules directly
#[path = "common.rs"]
mod common;
#[path = "mocks.rs"]
mod mocks;

use common::{get_test_app_state, mock_admin_token};
use mocks::{build_test_organisation, MockKeycloakAdmin};

// Helper to create a reqwest::Error for testing without the need for http crate
fn mock_reqwest_error() -> reqwest::Error {
    // Create a connect error as a simple way to get a reqwest::Error
    let client = reqwest::Client::new();
    let bad_url = "http://non-existent-domain-123456789.invalid";
    match client.get(bad_url).build() {
        Ok(req) => {
            // We should never reach here with an invalid domain
            panic!("Expected to create an error")
        }
        Err(e) => e,
    }
}

// Test helper to simulate a failed Keycloak group creation
fn mock_keycloak_group_post_failure() -> MockKeycloakAdmin {
    let mut mock = MockKeycloakAdmin::new();

    // Group check succeeds with empty result
    mock.expect_realm_groups_get()
        .returning(|_, _, _, _, _, _, _, _| Ok(vec![]));

    // Group creation fails
    mock.expect_realm_groups_post()
        .returning(|_, _| Err(mock_reqwest_error()));

    mock
}

// Test helper to simulate a failed Keycloak role group creation
fn mock_keycloak_role_group_post_failure() -> MockKeycloakAdmin {
    let mut mock = MockKeycloakAdmin::new();

    // Group check succeeds with empty result
    mock.expect_realm_groups_get()
        .returning(|_, _, _, _, _, _, _, _| Ok(vec![]));

    // Group creation succeeds
    mock.expect_realm_groups_post()
        .returning(|_, _| Ok(Some("parent-group-id".to_string())));

    // Role group creation fails
    mock.expect_realm_groups_with_group_id_children_post()
        .returning(|_, _, _| Err(mock_reqwest_error()));

    // Parent group deletion for cleanup should be called
    mock.expect_realm_groups_with_group_id_delete()
        .returning(|_, _| Ok(()));

    mock
}

// Test helper to simulate a failed user group assignment
fn mock_keycloak_user_group_assignment_failure() -> MockKeycloakAdmin {
    let mut mock = MockKeycloakAdmin::new();

    // Group check succeeds with empty result
    mock.expect_realm_groups_get()
        .returning(|_, _, _, _, _, _, _, _| Ok(vec![]));

    // Group creation succeeds
    mock.expect_realm_groups_post()
        .returning(|_, _| Ok(Some("parent-group-id".to_string())));

    // Role group creation succeeds
    mock.expect_realm_groups_with_group_id_children_post()
        .returning(|_, _, _| Ok(Some("role-group-id".to_string())));

    // User group assignment fails
    mock.expect_realm_users_with_user_id_groups_with_group_id_put()
        .returning(|_, _, _| Err(mock_reqwest_error()));

    // Group deletions for cleanup should be called
    mock.expect_realm_groups_with_group_id_delete()
        .times(2) // Called for both parent and role groups
        .returning(|_, _| Ok(()));

    mock
}

// Test to verify successful transaction flow
#[actix_web::test]
async fn test_create_org_transaction_success() {
    // Setup test environment
    let app_state = get_test_app_state().await;

    // Create test app with the route handlers
    let app = test::init_service(
        App::new()
            .app_data(web::Data::from(app_state.clone()))
            .service(web::scope("/organisations").service(organisation::create_organisation)),
    )
    .await;

    // Create test data
    let test_org_name = "Test Organization";
    let req_body = json!({
        "name": test_org_name
    });

    // Create request
    let mut req = test::TestRequest::post()
        .uri("/organisations/create")
        .insert_header(("content-type", "application/json"))
        .set_json(&req_body)
        .to_request();

    // Insert mock auth data
    req.extensions_mut().insert(AuthResponse {
        sub: "test-user-id".to_string(),
        admin_token: mock_admin_token(),
        organisation: None,
        application: None,
    });

    // Execute the request
    let resp = test::call_service(&app, req).await;

    // Assert success
    assert_eq!(resp.status(), 200);

    // Check response body structure
    let body: organisation::Organisation = test::read_body_json(resp).await;
    assert_eq!(body.name, test_org_name);
    assert!(body.applications.is_empty());
    assert_eq!(body.access.len(), 4);
}

// Test to verify that the transaction is rolled back on Keycloak group creation failure
#[actix_web::test]
async fn test_create_org_transaction_keycloak_group_failure() {
    // This test requires injecting a mock Keycloak admin that fails on group creation
    // For now we'll leave it as a placeholder - in a real implementation, we'd need
    // a way to inject the KeycloakAdmin mock

    // TODO: Implement mock injection to test transaction rollback on Keycloak failure
}

// Test to verify that the transaction is rolled back on Superposition API failure
#[actix_web::test]
async fn test_create_org_transaction_superposition_failure() {
    // This test requires injecting a mock Superposition API that fails on organization creation
    // Similar to the above test, this is a placeholder

    // TODO: Implement mock injection to test transaction rollback on Superposition failure
}

// Test to verify the transaction is rolled back on database failure
#[actix_web::test]
async fn test_create_org_transaction_database_failure() {
    // This test requires injecting a mock database connection that fails on insertion
    // Similar to the above tests, this is a placeholder

    // TODO: Implement mock injection to test transaction rollback on database failure
}
