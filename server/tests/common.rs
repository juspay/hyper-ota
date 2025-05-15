use actix_web::{
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    error, test, web, Error, HttpMessage,
};
use aws_config;
use aws_sdk_s3;
use diesel::r2d2::{self, ConnectionManager};
use diesel::PgConnection;
use futures::future::{ready, Ready};
use keycloak::KeycloakAdminToken;
use reqwest::Client;
use serde_json::json;
use std::future::Future;
use std::pin::Pin;
use std::rc::Rc;
use std::sync::Arc;
use superposition_rust_sdk::apis::configuration::Configuration;

use hyper_ota_server::{
    middleware::auth::{Auth, AuthResponse},
    organisation,
    types::{AppState, Environment},
    utils::db::DbPool,
};

// Mock environment for testing
pub fn get_test_environment() -> Environment {
    Environment {
        public_url: "http://localhost:9000".to_string(),
        keycloak_url: "http://mock-keycloak:8080".to_string(),
        keycloak_public_key: "mock-public-key".to_string(),
        client_id: "mock-client".to_string(),
        secret: "mock-secret".to_string(),
        realm: "test-realm".to_string(),
        bucket_name: "test-bucket".to_string(),
    }
}

// Mock AppState for testing
pub async fn get_test_app_state() -> Arc<AppState> {
    let env = get_test_environment();

    // Create a test database connection pool
    let db_pool = setup_test_db_pool().await;

    // Create a mock S3 client
    let s3_client = mock_s3_client().await;

    Arc::new(AppState {
        env: env.clone(),
        db_pool,
        superposition_configuration: Configuration {
            base_path: "http://mock-superposition:8083".to_string(),
            client: Client::new(),
            ..Default::default()
        },
        s3_client,
    })
}

// Mock DB pool for testing
async fn setup_test_db_pool() -> DbPool {
    // For testing, we'll use an environment variable or a default test DB
    let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
        "postgres://postgres:postgres@localhost:5433/test_hyperotaserver".to_string()
    });

    let manager = ConnectionManager::<PgConnection>::new(database_url);
    r2d2::Pool::builder()
        .max_size(2)
        .build(manager)
        .expect("Failed to create test DB pool")
}

// Mock S3 client
async fn mock_s3_client() -> aws_sdk_s3::Client {
    // For testing, we create a minimal S3 client with default config
    let shared_config = aws_config::from_env().load().await;
    let s3_config = aws_sdk_s3::config::Builder::from(&shared_config)
        .force_path_style(true) // Typically needed for minio/localstack
        .build();

    aws_sdk_s3::Client::from_conf(s3_config)
}

// Create a mock admin token for testing
pub fn mock_admin_token() -> KeycloakAdminToken {
    // Create a JSON representation of the token
    let token_json = serde_json::json!({
        "access_token": "mock-access-token",
        "expires_in": 300,
        "refresh_expires_in": 1800,
        "refresh_token": "mock-refresh-token",
        "token_type": "bearer",
        "not-before-policy": 0,
        "session_state": "mock-session",
        "scope": "mock-scope"
    });

    // Deserialize into a KeycloakAdminToken
    serde_json::from_value(token_json).expect("Failed to create mock token")
}

// Mock Auth middleware for testing
pub struct MockAuth {
    pub env: Environment,
}

impl<S, B> Transform<S, ServiceRequest> for MockAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = MockAuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(MockAuthMiddleware {
            service: Rc::new(service),
            env: self.env.clone(),
        }))
    }
}

pub struct MockAuthMiddleware<S> {
    service: Rc<S>,
    env: Environment,
}

impl<S, B> Service<ServiceRequest> for MockAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(
        &self,
        ctx: &mut core::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.service.poll_ready(ctx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();

        // Instead of real auth, we inject a mock AuthResponse
        Box::pin(async move {
            // Get the organization from header if provided
            let org_header = req.headers().get("x-organisation");
            let org = org_header.and_then(|h| h.to_str().ok()).map(String::from);

            // Get the application from header if provided
            let app_header = req.headers().get("x-application");
            let app = app_header.and_then(|h| h.to_str().ok()).map(String::from);

            // Create mock AuthResponse
            let auth_response = AuthResponse {
                sub: "test-user-id".to_string(),
                admin_token: mock_admin_token(),
                organisation: org.map(|name| hyper_ota_server::middleware::auth::AccessLevel {
                    name,
                    level: 4, // Owner level for testing
                }),
                application: app.map(|name| hyper_ota_server::middleware::auth::AccessLevel {
                    name,
                    level: 4, // Owner level for testing
                }),
            };

            // Insert mock auth response
            req.extensions_mut().insert(auth_response);

            // Call the actual service
            service.call(req).await
        })
    }
}

#[actix_web::test]
async fn test_some_functionality() {
    // Get test state
    let app_state = get_test_app_state().await;

    // Create test app
    let app = test::init_service(
        actix_web::App::new()
            .app_data(web::Data::from(app_state.clone()))
            .service(
                web::scope("/organisations")
                    .wrap(MockAuth {
                        env: app_state.env.clone(),
                    })
                    .service(organisation::add_routes()),
            ),
    )
    .await;

    // Run tests with the app...
}
