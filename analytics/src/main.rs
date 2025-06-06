mod config;
mod kafka;
mod clickhouse;
mod handlers;
mod models;
mod error;
mod utils;

use anyhow::Result;
use axum::{
    routing::{get, post},
    Router,
};
use std::{fs, net::SocketAddr};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::handlers::{health, events, analytics};
use crate::utils::strip_sql_comments;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "analytics_server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::load()?;
    info!("Loaded configuration: {:?}", config);

    // Initialize ClickHouse client
    let clickhouse_client = Arc::new(clickhouse::Client::new(&config.clickhouse).await?);
    info!("Connected to ClickHouse");

    // Initialize tables and views
    let sql_text = fs::read_to_string("init-clickhouse.sql")?;
    let stripped_sql = strip_sql_comments(&sql_text);
    for raw_stmt in stripped_sql.split(';') {
        let stmt = raw_stmt.trim();
        if stmt.is_empty() {
            continue;
        }
        info!("Running ClickHouse migrations");
        clickhouse_client
            .query(stmt)
            .execute()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to run statement `{}`: {}", stmt, e))?;
    }

    // Initialize Kafka producer
    let kafka_producer = Arc::new(kafka::Producer::new(&config.kafka).await?);
    info!("Connected to Kafka");

    // Initialize Kafka consumer
    let kafka_consumer = kafka::Consumer::new(&config.kafka, Arc::clone(&clickhouse_client)).await?;
    info!("Kafka consumer initialized");

    // Start Kafka consumer in background
    let consumer_handle = tokio::spawn(async move {
        info!("Starting Kafka consumer...");
        if let Err(e) = kafka_consumer.start_consuming().await {
            error!("Kafka consumer error: {:?}", e);
        }
    });

    // Get server port before moving config
    let server_port = config.server.port;

    // Build the application router
    let app = Router::new()
        .route("/health", get(health::health_check))
        .route("/events", post(events::ingest_event))
        .route("/analytics/adoption", get(analytics::get_adoption_metrics))
        .route("/analytics/versions", get(analytics::get_version_distribution))
        .route("/analytics/active-devices", get(analytics::get_active_devices))
        .route("/analytics/failures", get(analytics::get_failure_metrics))
        .route("/analytics/performance", get(analytics::get_performance_metrics))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(AppState {
            clickhouse: Arc::clone(&clickhouse_client),
            kafka: Arc::clone(&kafka_producer),
            config: Arc::new(config),
        });

    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], server_port));
    info!("OTA Analytics Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    
    // Graceful shutdown handling
    let shutdown_signal = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C signal handler");
        info!("Shutdown signal received, stopping server...");
    };

    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(shutdown_signal)
        .await?;

    // Wait for consumer to finish (should never finish)
    consumer_handle.abort();
    info!("OTA Analytics Server stopped");

    Ok(())
}

#[derive(Clone)]
pub struct AppState {
    pub clickhouse: Arc<clickhouse::Client>,
    pub kafka: Arc<kafka::Producer>,
    pub config: Arc<Config>,
}
