use std::sync::Arc;

use actix_web::{web, App, HttpServer};

mod dashboard;
mod middleware;
mod organisation;
mod release;
mod user;

mod types;
mod utils;

use aws_sdk_s3::config::Builder;
use dotenvy::dotenv;
use middleware::auth::Auth;
use reqwest::Client;
use superposition_rust_sdk::apis::configuration::Configuration;
use utils::{db, kms::decrypt_kms};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load Environment variables
    dotenv().ok(); // Load .env file
    let url = std::env::var("KEYCLOAK_URL").expect("KEYCLOAK_URL must be set");
    let client_id = std::env::var("KEYCLOAK_CLIENT_ID").expect("KEYCLOAK_CLIENT_ID must be set");
    let enc_sec = std::env::var("KEYCLOAK_SECRET").expect("KEYCLOAK_SECRET must be set"); // Move this to AWS KMS
    let realm = std::env::var("KEYCLOAK_REALM").expect("KEYCLOAK_REALM must be set");
    let publickey = std::env::var("KEYCLOAK_PUBLIC_KEY").expect("KEYCLOAK_PUBLIC_KEY must be set");
    let cac_url = std::env::var("SUPERPOSITION_URL").expect("SUPERPOSITION_URL must be set");
    let bucket_name = std::env::var("AWS_BUCKET").expect("AWS_BUCKET must be set");
    let public_url = std::env::var("PUBLIC_ENDPOINT").expect("PUBLIC_ENDPOINT must be set");

    //Need to check if this ENV exists on pod
    let uses_local_stack = std::env::var("AWS_ENDPOINT_URL");
    let mut force_path_style = false;
    if uses_local_stack.is_ok() {
        force_path_style = true;
    }

    let shared_config = aws_config::from_env().load().await;

    let aws_kms_client = aws_sdk_kms::Client::new(&shared_config);

    // Initialize DB pool
    let pool = db::establish_pool(&aws_kms_client).await;
    let secret = decrypt_kms(&aws_kms_client, enc_sec).await;

    let env = types::Environment {
        public_url,
        keycloak_url: url,
        keycloak_public_key: format!(
            "-----BEGIN PUBLIC KEY-----\n{}\n-----END PUBLIC KEY-----",
            publickey
        ),
        client_id,
        secret: secret.clone(),
        realm,
        bucket_name,
    };

    // This is required for localStack
    // Create an S3 client with path-style enforced
    let s3_config = Builder::from(&shared_config)
        .force_path_style(force_path_style)
        .build();

    let aws_s3_client = aws_sdk_s3::Client::from_conf(s3_config);

    // Create a shared state for the application
    let app_state = Arc::new(types::AppState {
        env: env.clone(),
        db_pool: pool,
        superposition_configuration: Configuration {
            base_path: cac_url.clone(),
            client: Client::new(),
            ..Default::default()
        },
        s3_client: aws_s3_client,
    });

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::from(app_state.clone()))
            .wrap(actix_web::middleware::Logger::default())
            .wrap(actix_web::middleware::Compress::default())
            .service(
                // APIs specific to the dashboard
                // These will be all public (or with token as cookie) endpoints which serve dashboard JS code
                // Can eventually be migrated to some server side rendering
                web::scope("/dashboard").service(dashboard::add_routes()),
            )
            .service(
                web::scope("/organisations")
                    .wrap(Auth { env: env.clone() })
                    .service(organisation::add_routes()),
            )
            .service(
                web::scope("/user")
                    .wrap(Auth { env: env.clone() })
                    .service(user::get_user),
            )
            .service(web::scope("/users").service(user::add_routes()))
            .service(
                web::scope("/release").service(release::add_routes()),
                // Decide if this needs auth; Ideally this only needs signature verfication
            )
    })
    .bind(("127.0.0.1", 9000))?
    .run()
    .await
}

// Create Workspace
// Update Worspace
// Middleware for authentication via CAC key cloak
