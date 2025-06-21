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

use std::sync::Arc;

use actix_web::{web, App, HttpServer};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

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
use superposition_rust_sdk::config::Config as SrsConfig;
use utils::{db, kms::decrypt_kms, transaction_manager::start_cleanup_job};

const MIGRATIONS: EmbeddedMigrations = embed_migrations!();

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load Environment variables
    dotenv().ok(); // Load .env file
    let url = std::env::var("KEYCLOAK_URL").expect("KEYCLOAK_URL must be set");
    let keycloak_external_url = std::env::var("KEYCLOAK_EXTERNAL_URL")
        .unwrap_or_else(|_| url.replace("keycloak:8080", "localhost:8180"));
    let client_id = std::env::var("KEYCLOAK_CLIENT_ID").expect("KEYCLOAK_CLIENT_ID must be set");
    let enc_sec = std::env::var("KEYCLOAK_SECRET").expect("KEYCLOAK_SECRET must be set"); // Move this to AWS KMS
    let realm = std::env::var("KEYCLOAK_REALM").expect("KEYCLOAK_REALM must be set");
    let publickey = std::env::var("KEYCLOAK_PUBLIC_KEY").expect("KEYCLOAK_PUBLIC_KEY must be set");
    let cac_url = std::env::var("SUPERPOSITION_URL").expect("SUPERPOSITION_URL must be set");
    let superposition_org_id_env =
        std::env::var("SUPERPOSITION_ORG_ID").expect("SUPERPOSITION_ORG_ID must be set");
    let bucket_name = std::env::var("AWS_BUCKET").expect("AWS_BUCKET must be set");
    let public_url = std::env::var("PUBLIC_ENDPOINT").expect("PUBLIC_ENDPOINT must be set");
    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "9000".to_string())
        .parse()
        .expect("PORT must be a valid number");

    //Need to check if this ENV exists on pod
    let uses_local_stack = std::env::var("AWS_ENDPOINT_URL");
    let mut force_path_style = false;
    if uses_local_stack.is_ok() {
        force_path_style = true;
    }

    let shared_config = aws_config::from_env().load().await;

    let aws_kms_client = aws_sdk_kms::Client::new(&shared_config);

    let mut conn = db::establish_connection(&aws_kms_client).await;
    conn.run_pending_migrations(MIGRATIONS)
        .expect("Failed to run pending migrations");
    // Initialize DB pool
    let pool = db::establish_pool(&aws_kms_client).await;
    let secret = decrypt_kms(&aws_kms_client, enc_sec).await;

    let env = types::Environment {
        public_url,
        keycloak_url: url,
        keycloak_external_url,
        keycloak_public_key: format!(
            "-----BEGIN PUBLIC KEY-----\n{}\n-----END PUBLIC KEY-----",
            publickey
        ),
        client_id,
        secret: secret.clone(),
        realm,
        bucket_name,
        superposition_org_id: superposition_org_id_env,
    };

    // This is required for localStack
    // Create an S3 client with path-style enforced
    let s3_config = Builder::from(&shared_config)
        .force_path_style(force_path_style)
        .build();

    let aws_s3_client = aws_sdk_s3::Client::from_conf(s3_config);

    // Create a shared state for the application
    let superposition_client = superposition_rust_sdk::Client::from_conf(
        SrsConfig::builder()
            .endpoint_url(cac_url.clone())
            .behavior_version_latest()
            .bearer_token("your_bearer_token_here".into())
            .build(),
    );

    let app_state = Arc::new(types::AppState {
        env: env.clone(),
        db_pool: pool,
        s3_client: aws_s3_client,
        superposition_client,
    });

    // Start the background cleanup job for transaction reconciliation
    let app_state_data = web::Data::from(app_state.clone());
    let _cleanup_handle = start_cleanup_job(app_state_data.clone());
    println!("Started transaction cleanup background job");

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
                web::scope("/organisation/user")
                    .wrap(Auth { env: env.clone() })
                    .service(organisation::user::add_routes()),
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
    .bind(("0.0.0.0", port))? // Listen on all interfaces
    .run()
    .await
}

// Create Workspace
// Update Worspace
// Middleware for authentication via CAC key cloak
