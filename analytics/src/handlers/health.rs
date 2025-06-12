use axum::{extract::State, response::Json};
use chrono::Utc;

use crate::{
    error::AppResult,
    models::{HealthResponse, ServiceHealthCheck},
    AppState,
};

pub async fn health_check(State(state): State<AppState>) -> AppResult<Json<HealthResponse>> {
    // Check ClickHouse connection
    let clickhouse_healthy = match state.clickhouse.query("SELECT 1").fetch_one::<u8>().await {
        Ok(_) => true,
        Err(e) => {
            tracing::warn!("ClickHouse health check failed: {:?}", e);
            false
        }
    };

    // For Kafka, we'll assume it's healthy if the producer was created successfully
    // In a real implementation, you might want to send a test message
    let kafka_healthy = true;

    let health_response = HealthResponse {
        status: if clickhouse_healthy && kafka_healthy {
            "healthy".to_string()
        } else {
            "unhealthy".to_string()
        },
        timestamp: Utc::now(),
        services: ServiceHealthCheck {
            clickhouse: clickhouse_healthy,
            kafka: kafka_healthy,
            consumer_lag: None, // Placeholder for consumer lag
        },
        metrics: crate::models::SystemMetrics {
            events_processed_last_hour: 0,
            active_tenants: 1,
            storage_size_gb: 0.0,
        },
    };

    Ok(Json(health_response))
}
