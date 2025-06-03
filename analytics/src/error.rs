use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use serde_json::json;
use thiserror::Error;

use crate::models::ErrorResponse;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] clickhouse::error::Error),
    
    #[error("Database error: {0}")]
    DatabaseError(String),
    
    #[error("Kafka error: {0}")]
    Kafka(#[from] rdkafka::error::KafkaError),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Configuration error: {0}")]
    Config(#[from] anyhow::Error),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Internal server error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            AppError::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error"),
            AppError::DatabaseError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error"),
            AppError::Kafka(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Message queue error"),
            AppError::Serialization(_) => (StatusCode::BAD_REQUEST, "Invalid request format"),
            AppError::Config(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Configuration error"),
            AppError::Validation(_) => (StatusCode::BAD_REQUEST, "Validation error"),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "Resource not found"),
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"),
        };

        let error_response = ErrorResponse {
            error: error_message.to_string(),
            message: self.to_string(),
            timestamp: Utc::now(),
            trace_id: None,
        };

        (status, Json(error_response)).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
