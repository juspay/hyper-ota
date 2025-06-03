use axum::{
    extract::{Query, State},
    response::Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::{
    models::{AdoptionMetrics, VersionDistribution, ActiveDevicesMetrics, FailureMetrics, PerformanceMetrics},
    AppState,
    error::{AppError, AppResult}
};

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    pub tenant_id: String,
    pub org_id: Option<String>,
    pub app_id: Option<String>,
    pub days: Option<u32>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsResponse<T> {
    pub success: bool,
    pub data: T,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl<T> AnalyticsResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data,
            timestamp: chrono::Utc::now(),
        }
    }
}

pub async fn get_adoption_metrics(
    State(state): State<AppState>,
    Query(params): Query<AnalyticsQuery>,
) -> AppResult<Json<AnalyticsResponse<AdoptionMetrics>>> {
    info!("Fetching adoption metrics for tenant: {}", params.tenant_id);

    let days = params.days.unwrap_or(30);

    let metrics = state
        .clickhouse
        .get_adoption_metrics(
            &params.tenant_id,
            params.org_id.as_deref().unwrap_or("default"),
            params.app_id.as_deref().unwrap_or("default"),
            "default", // release_id placeholder
            days,
        )
        .await
        .map_err(|e| {
            error!("Failed to fetch adoption metrics: {:?}", e);
            AppError::DatabaseError(e.to_string())
        })?;

    Ok(Json(AnalyticsResponse::success(metrics)))
}

pub async fn get_version_distribution(
    State(state): State<AppState>,
    Query(params): Query<AnalyticsQuery>,
) -> AppResult<Json<AnalyticsResponse<Vec<VersionDistribution>>>> {
    info!("Fetching version distribution for tenant: {}", params.tenant_id);

    let days = params.days.unwrap_or(30);

    let distribution = state
        .clickhouse
        .get_version_distribution(
            &params.tenant_id,
            params.org_id.as_deref().unwrap_or("default"),
            params.app_id.as_deref().unwrap_or("default"),
            days,
        )
        .await
        .map_err(|e| {
            error!("Failed to fetch version distribution: {:?}", e);
            AppError::DatabaseError(e.to_string())
        })?;

    Ok(Json(AnalyticsResponse::success(vec![distribution])))
}

pub async fn get_active_devices(
    State(state): State<AppState>,
    Query(params): Query<AnalyticsQuery>,
) -> AppResult<Json<AnalyticsResponse<ActiveDevicesMetrics>>> {
    info!("Fetching active devices for tenant: {}", params.tenant_id);

    let days = params.days.unwrap_or(30);

    let metrics = state
        .clickhouse
        .get_active_devices_metrics(
            &params.tenant_id,
            params.org_id.as_deref().unwrap_or("default"),
            params.app_id.as_deref().unwrap_or("default"),
            days,
        )
        .await
        .map_err(|e| {
            error!("Failed to fetch active devices: {:?}", e);
            AppError::DatabaseError(e.to_string())
        })?;

    Ok(Json(AnalyticsResponse::success(metrics)))
}

pub async fn get_failure_metrics(
    State(state): State<AppState>,
    Query(params): Query<AnalyticsQuery>,
) -> AppResult<Json<AnalyticsResponse<FailureMetrics>>> {
    info!("Fetching failure metrics for tenant: {}", params.tenant_id);

    let days = params.days.unwrap_or(30);

    let metrics = state
        .clickhouse
        .get_failure_analytics(
            &params.tenant_id,
            params.org_id.as_deref().unwrap_or("default"),
            params.app_id.as_deref().unwrap_or("default"),
            None, // release_id
            days,
        )
        .await
        .map_err(|e| {
            error!("Failed to fetch failure analytics: {:?}", e);
            AppError::DatabaseError(e.to_string())
        })?;

    // Convert FailureAnalytics to FailureMetrics for consistency
    let failure_metrics = FailureMetrics {
        tenant_id: metrics.tenant_id,
        org_id: metrics.org_id,
        app_id: metrics.app_id,
        release_id: metrics.release_id,
        total_failures: metrics.total_failures,
        failure_rate: if metrics.total_failures > 0 { 100.0 } else { 0.0 },
        common_errors: metrics.common_errors,
    };

    Ok(Json(AnalyticsResponse::success(failure_metrics)))
}

pub async fn get_performance_metrics(
    State(_state): State<AppState>,
    Query(params): Query<AnalyticsQuery>,
) -> AppResult<Json<AnalyticsResponse<PerformanceMetrics>>> {
    info!("Fetching performance metrics for tenant: {}", params.tenant_id);

    let _days = params.days.unwrap_or(30);

    // For now, return a placeholder response for performance metrics
    let metrics = PerformanceMetrics {
        tenant_id: params.tenant_id.clone(),
        org_id: params.org_id.clone().unwrap_or_else(|| "default".to_string()),
        app_id: params.app_id.clone().unwrap_or_else(|| "default".to_string()),
        release_id: None,
        avg_download_time_ms: 0.0,
        avg_apply_time_ms: 0.0,
        avg_download_size_bytes: 0.0,
    };

    Ok(Json(AnalyticsResponse::success(metrics)))
}
