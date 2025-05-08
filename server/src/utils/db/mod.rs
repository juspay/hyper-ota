pub mod models;
pub mod schema;

use aws_sdk_kms::Client;

use crate::utils::kms::decrypt_kms;
use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool};
use std::env;
use urlencoding::encode;

// Type alias for Diesel's connection pool
pub type DbPool = Pool<ConnectionManager<PgConnection>>;

pub async fn get_database_url(kms_client: &Client) -> String {
    let db_user: String = env::var("DB_USER").expect("DB_USER must be set");
    let x = decrypt_kms(
        kms_client,
        env::var("DB_PASSWORD").expect("DB_PASSWORD must be set"),
    )
    .await;
    let db_password = encode(&x);

    let db_host: String = env::var("DB_HOST").expect("DB_HOST must be set");
    let db_name: String = env::var("DB_NAME").expect("DB_HOST must be set");

    format!("postgres://{db_user}:{db_password}@{db_host}/{db_name}")
}

// Function to create a new connection pool
pub async fn establish_pool(kms_client: &Client) -> DbPool {
    let database_url = get_database_url(kms_client).await;
    let max_connections: u32 = env::var("DATABASE_POOL_SIZE")
        .unwrap_or_else(|_| "4".to_string()) // Default to "4" if not set
        .parse()
        .expect("DATABASE_POOL_SIZE must be a valid number");

    let manager = ConnectionManager::<PgConnection>::new(database_url);
    Pool::builder()
        .max_size(max_connections) // Set max connections (adjust as needed)
        .build(manager)
        .expect("Failed to create DB pool")
}
