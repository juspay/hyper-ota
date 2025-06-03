-- Initialize ClickHouse for OTA Analytics Platform
-- This script sets up the enterprise-ready schema for multi-tenant OTA analytics

-- Create the analytics database if it doesn't exist
CREATE DATABASE IF NOT EXISTS analytics;
USE analytics;

-- =============================================================================
-- 1. RAW EVENTS TABLE - Main table for all OTA events
-- =============================================================================
CREATE TABLE IF NOT EXISTS ota_events_raw
(
    -- Core event identifiers
    tenantId            String,
    orgId               String,
    appId               String,
    deviceId            String,
    sessionId           Nullable(String),
    
    -- Event metadata
    eventType           String,
    eventId             UUID DEFAULT generateUUIDv4(),
    timestamp           DateTime64(3),
    eventDate           Date DEFAULT toDate(timestamp),
    
    -- Release information
    releaseId           Nullable(String),
    currentJsVersion    Nullable(String),
    targetJsVersion     Nullable(String),
    rolloutPercentage   Nullable(UInt8),
    
    -- Device/Environment context
    osVersion           Nullable(String),
    appVersion          Nullable(String),
    deviceType          Nullable(String),
    networkType         Nullable(String),
    
    -- Error information
    errorCode           Nullable(String),
    errorMessage        Nullable(String),
    stackTrace          Nullable(String),
    
    -- Performance metrics
    downloadSizeBytes   Nullable(UInt64),
    downloadTimeMs      Nullable(UInt64),
    applyTimeMs         Nullable(UInt64),
    
    -- Additional event payload as JSON
    payload             String DEFAULT '{}',
    
    -- Request metadata
    userAgent           Nullable(String),
    ipAddress           Nullable(String),
    
    -- Ingestion metadata
    ingestedAt          DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(eventDate)
ORDER BY (tenantId, orgId, appId, eventType, timestamp)
TTL eventDate + INTERVAL 365 DAY  -- Keep raw data for 1 year
SETTINGS index_granularity = 8192;
