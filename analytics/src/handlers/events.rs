use axum::{
    extract::{State, ConnectInfo},
    response::Json,
    http::HeaderMap,
};
use chrono::Utc;
use serde_json::json;
use std::net::SocketAddr;
use tracing::{info, warn, error};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{OtaEvent, OtaEventRequest, EventType},
    AppState,
};

pub async fn ingest_event(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(request): Json<OtaEventRequest>,
) -> AppResult<Json<serde_json::Value>> {
    info!("Ingesting OTA event: {:?}", request.event_type);

    // Validate the request
    if request.tenant_id.is_empty() {
        return Err(AppError::Validation("Tenant ID cannot be empty".to_string()));
    }
    if request.device_id.is_empty() {
        return Err(AppError::Validation("Device ID cannot be empty".to_string()));
    }

    // Extract metadata from headers
    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let ip_address = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or("").trim().to_string())
        .or_else(|| Some(addr.ip().to_string()));

    // Create the OTA event
    let event = OtaEvent {
        tenant_id: request.tenant_id,
        org_id: request.org_id,
        app_id: request.app_id,
        device_id: request.device_id,
        session_id: request.session_id,
        event_type: request.event_type,
        event_id: Some(Uuid::new_v4()),
        timestamp: Utc::now(),
        release_id: request.release_id,
        current_js_version: request.current_js_version,
        target_js_version: request.target_js_version,
        rollout_percentage: request.rollout_percentage,
        os_version: request.os_version,
        app_version: request.app_version,
        device_type: request.device_type,
        network_type: request.network_type,
        error_code: request.error_code,
        error_message: request.error_message,
        stack_trace: request.stack_trace,
        download_size_bytes: request.download_size_bytes,
        download_time_ms: request.download_time_ms,
        apply_time_ms: request.apply_time_ms,
        payload: request.payload,
        user_agent,
        ip_address,
    };

    // Send to Kafka for real-time processing
    if let Err(e) = state.kafka.send_ota_event(&event).await {
        error!("Failed to send event to Kafka: {:?}", e);
        // Continue with direct insertion to ClickHouse
    }

    // Also store directly in ClickHouse for immediate availability
    if let Err(e) = state.clickhouse.insert_ota_event(&event).await {
        error!("Failed to insert event to ClickHouse: {:?}", e);
        return Err(AppError::DatabaseError(e.to_string()));
    }

    info!("Successfully ingested OTA event: {:?}", event.event_id);

    Ok(Json(json!({
        "status": "success",
        "message": "OTA event ingested successfully",
        "event_id": event.event_id,
        "timestamp": Utc::now()
    })))
}


