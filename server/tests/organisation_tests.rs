use actix_web::{
    http::{header, StatusCode},
    test, web, App, HttpMessage,
};
use hyper_ota_server::{
    middleware::auth::AuthResponse,
    organisation::{self, Organisation, OrganisationCreatedRequest},
};
use serde_json::json;
use std::sync::Arc;

// Import shared test modules directly
#[path = "common.rs"]
mod common;
#[path = "mocks.rs"]
mod mocks;

use common::{get_test_app_state, mock_admin_token};
use mocks::{build_test_organisation, mock_keycloak_admin_success};

mod validation_tests {
    use super::*;
    use hyper_ota_server::organisation::validate_organisation_name;

    #[actix_web::test]
    async fn test_validate_organisation_name() {
        // Test valid names
        assert!(validate_organisation_name("Valid Name").is_ok());
        assert!(validate_organisation_name("Valid-Name").is_ok());
        assert!(validate_organisation_name("Valid_Name123").is_ok());

        // Test empty name
        let err = validate_organisation_name("").unwrap_err();
        let err_body = err.as_response_error().error_response().into_body();
        assert!(format!("{:?}", err_body).contains("Organisation name cannot be empty"));

        // Test too long name (over 50 chars)
        let long_name = "a".repeat(51);
        let err = validate_organisation_name(&long_name).unwrap_err();
        let err_body = err.as_response_error().error_response().into_body();
        assert!(format!("{:?}", err_body).contains("Organisation name is too long"));

        // Test invalid characters
        let invalid_names = vec![
            "Invalid@Name",
            "Invalid#Name",
            "Invalid$Name",
            "Invalid%Name",
        ];

        for name in invalid_names {
            let err = validate_organisation_name(name).unwrap_err();
            let err_body = err.as_response_error().error_response().into_body();
            assert!(format!("{:?}", err_body).contains("Organisation name can only contain"));
        }
    }
}

#[actix_web::test]
async fn test_create_organisation_success() {
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
        .insert_header((header::CONTENT_TYPE, "application/json"))
        .set_json(&req_body)
        .to_request();

    // Insert mock auth data directly
    req.extensions_mut().insert(AuthResponse {
        sub: "test-user-id".to_string(),
        admin_token: mock_admin_token(),
        organisation: None,
        application: None,
    });

    // Execute the request
    let resp = test::call_service(&app, req).await;

    // Assert success response
    assert_eq!(resp.status(), StatusCode::OK);

    // Parse and validate response body
    let result: Organisation = test::read_body_json(resp).await;
    assert_eq!(result.name, test_org_name);
    assert!(result.applications.is_empty());
    assert_eq!(result.access, vec!["read", "write", "admin", "owner"]);
}

#[actix_web::test]
async fn test_create_organisation_invalid_name() {
    // Setup test environment
    let app_state = get_test_app_state().await;

    // Create test app
    let app = test::init_service(
        App::new()
            .app_data(web::Data::from(app_state.clone()))
            .service(web::scope("/organisations").service(organisation::create_organisation)),
    )
    .await;

    // Create a long name for testing
    let long_name = "a".repeat(51);

    // Test cases for invalid names with expected error messages
    let test_cases = vec![
        ("", "Organisation name cannot be empty"),
        (long_name.as_str(), "Organisation name is too long"),
        (
            "Invalid@Name",
            "Organisation name can only contain alphanumeric characters",
        ),
    ];

    for (name, expected_error) in test_cases {
        let req_body = json!({
            "name": name
        });

        // Create request with bad name
        let mut req = test::TestRequest::post()
            .uri("/organisations/create")
            .insert_header((header::CONTENT_TYPE, "application/json"))
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

        // Assert error response
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        // Check error message
        let body = test::read_body(resp).await;
        let body_str = std::str::from_utf8(&body).unwrap();
        assert!(
            body_str.contains(expected_error),
            "Expected error message '{}' not found in: {}",
            expected_error,
            body_str
        );
    }
}

#[actix_web::test]
async fn test_create_organisation_name_taken() {
    // Setup test environment
    let app_state = get_test_app_state().await;

    // Create test app
    let app = test::init_service(
        App::new()
            .app_data(web::Data::from(app_state.clone()))
            .service(web::scope("/organisations").service(organisation::create_organisation)),
    )
    .await;

    // Create test data
    let test_org_name = "Existing Organization";
    let req_body = json!({
        "name": test_org_name
    });

    // Create request
    let mut req = test::TestRequest::post()
        .uri("/organisations/create")
        .insert_header((header::CONTENT_TYPE, "application/json"))
        .set_json(&req_body)
        .to_request();

    // Insert mock auth data
    // Mock return of existing group
    req.extensions_mut().insert(AuthResponse {
        sub: "test-user-id".to_string(),
        admin_token: mock_admin_token(),
        organisation: None,
        application: None,
    });

    // This test requires mocking the KeycloakAdmin.realm_groups_get to return a non-empty list
    // This would need to be implemented with a proper mock that can be customized
    // For now, we just note this as a TODO

    // TODO: Complete this test by properly mocking KeycloakAdmin to return existing groups
}

// Test for missing auth data
#[actix_web::test]
async fn test_create_organisation_missing_auth() {
    // Setup test environment
    let app_state = get_test_app_state().await;

    // Create test app
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

    // Create request WITHOUT adding auth data
    let req = test::TestRequest::post()
        .uri("/organisations/create")
        .insert_header((header::CONTENT_TYPE, "application/json"))
        .set_json(&req_body)
        .to_request();

    // Execute the request
    let resp = test::call_service(&app, req).await;

    // Should get unauthorized error
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}
