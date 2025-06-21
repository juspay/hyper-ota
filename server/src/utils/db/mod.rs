pub mod models;
pub mod schema;

use aws_sdk_kms::Client;
use diesel::Connection;

use crate::utils::kms::decrypt_kms;
use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool};
use std::env;
use urlencoding::encode;

// Type alias for Diesel's connection pool
pub type DbPool = Pool<ConnectionManager<PgConnection>>;

pub async fn get_database_url(userkey: &str, passwordkey: &str, kms_client: &Client) -> String {
    let db_user: String = env::var(userkey).expect("DB_USER must be set");

    // Check if DATABASE_URL is set - use it directly if available for local development
    if let Ok(database_url) = env::var("DATABASE_URL") {
        return database_url;
    }

    let x = decrypt_kms(
        kms_client,
        env::var(passwordkey).expect("DB_PASSWORD must be set"),
    )
    .await;

    let db_password = encode(&x);

    let db_host: String = env::var("DB_HOST").expect("DB_HOST must be set");
    let db_name: String = env::var("DB_NAME").expect("DB_NAME must be set");

    let url = format!("postgres://{db_user}:{db_password}@{db_host}/{db_name}");

    url
}

// Function to create a new connection pool
pub async fn establish_pool(kms_client: &Client) -> DbPool {
    let database_url = get_database_url("DB_USER", "DB_PASSWORD", kms_client).await;
    let max_connections: u32 = env::var("DATABASE_POOL_SIZE")
        .unwrap_or_else(|_| "4".to_string()) // Default to "4" if not set
        .parse()
        .expect("DATABASE_POOL_SIZE must be a valid number");

    println!(
        "Creating database pool with max_connections: {}",
        max_connections
    );

    let manager = ConnectionManager::<PgConnection>::new(database_url);

    match Pool::builder().max_size(max_connections).build(manager) {
        Ok(pool) => {
            // Test the connection
            match pool.get() {
                Ok(_) => println!("Successfully connected to the database"),
                Err(e) => println!("Warning: Could not get a test connection: {}", e),
            }
            pool
        }
        Err(e) => {
            panic!("Failed to create DB pool: {}", e);
        }
    }
}

pub async fn establish_connection(kms_client: &Client) -> PgConnection {
    // Have a different user with higher access for DB migrations
    let database_url =
        get_database_url("DB_MIGRATION_USER", "DB_MIGRATION_PASSWORD", kms_client).await;
    PgConnection::establish(&database_url).expect("Failed to connect to database")
}
