use axum::{
    extract::{Query, State},
    response::Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::{
    error::{AppError, AppResult}, models::{ActiveDevicesMetrics, AdoptionMetrics, AnalyticsInterval, FailureMetrics, PerformanceMetrics, VersionDistribution}, AppState
};

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    pub tenant_id: String,
    pub org_id: Option<String>,
    pub app_id: Option<String>,
    pub release_id: Option<String>,
    pub date: Option<i64>,
    pub days: Option<u32>,
    pub version: Option<String>,
    pub start_date: Option<i64>,
    pub end_date: Option<i64>,
    pub interval: Option<AnalyticsInterval>,
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

    pub fn failure(data: T) -> Self {
        Self {
            success: false,
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

    let date = params.date.unwrap_or(chrono::Utc::now().timestamp());

    if params.tenant_id.is_empty() {
        return Err(AppError::Validation("Tenant ID cannot be empty".to_string()));
    }

    match params.interval {
        Some(AnalyticsInterval::Day) => {
            if params.start_date.is_none() && params.end_date.is_none() {
                return Err(AppError::Validation("start_date and end_date in millis must be specified for daywise metrics.".to_string()));
            }
        },
        Some(AnalyticsInterval::Hour) => {
            if params.date.is_none() {
                return Err(AppError::Validation("date in millis must be specified for hourly metrics.".to_string()));
            }
        },
        _ => {
            return Err(AppError::Validation("Interval must be specified. Allowed intervals: DAY, HOUR".to_string()));
        }
    }

    let metrics = state
        .clickhouse
        .get_adoption_metrics(
            &params.tenant_id,
            params.org_id.as_deref().unwrap_or("default"),
            params.app_id.as_deref().unwrap_or("default"),
            params.release_id.as_deref().unwrap_or("default"),
            date,
            params.interval.unwrap_or(AnalyticsInterval::Day),
            params.start_date.unwrap_or(0),
            params.end_date.unwrap_or(0),
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
        release_id: Some(params.release_id.clone().unwrap_or_else(|| "default".to_string())),
        avg_download_time_ms: 0.0,
        avg_apply_time_ms: 0.0,
        avg_download_size_bytes: 0.0,
    };

    Ok(Json(AnalyticsResponse::success(metrics)))
}
