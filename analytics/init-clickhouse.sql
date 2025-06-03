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
    timestamp           DateTime64(3, 'UTC'),
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
    ingestedAt          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(eventDate)
ORDER BY (tenantId, orgId, appId, eventType, timestamp)
TTL eventDate + INTERVAL 365 DAY  -- Keep raw data for 1 year
SETTINGS index_granularity = 8192;

-- =============================================================================
-- 2. MATERIALIZED VIEWS FOR ANALYTICS
-- =============================================================================

-- 2.1 Hourly installs aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_installs
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, event_hour, release_id)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    toHour(timestamp) as event_hour,
    releaseId as release_id,
    targetJsVersion as target_js_version,
    count() as install_count
FROM ota_events_raw
WHERE eventType = 'install_success'
GROUP BY tenant_id, org_id, app_id, event_date, event_hour, release_id, target_js_version;

-- 2.2 Daily active devices aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_active_devices
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    uniqState(deviceId) as unique_devices
FROM ota_events_raw
GROUP BY tenant_id, org_id, app_id, event_date;

-- 2.3 Version distribution aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS version_distribution
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, current_js_version)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    currentJsVersion as current_js_version,
    uniq(deviceId) as device_count
FROM ota_events_raw
WHERE currentJsVersion IS NOT NULL
GROUP BY tenant_id, org_id, app_id, event_date, current_js_version;

-- 2.4 Error frequency aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS error_frequency
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, error_code, event_type)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    errorCode as error_code,
    eventType as event_type,
    errorMessage as error_message,
    count() as error_count
FROM ota_events_raw
WHERE eventType IN ('download_failed', 'install_failed', 'rollback_triggered')
  AND errorCode IS NOT NULL
GROUP BY tenant_id, org_id, app_id, event_date, error_code, event_type, error_message;

-- 2.5 Performance metrics aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS performance_metrics
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, event_type)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    eventType as event_type,
    avg(downloadTimeMs) as avg_download_time_ms,
    avg(applyTimeMs) as avg_apply_time_ms,
    avg(downloadSizeBytes) as avg_download_size_bytes,
    count() as event_count
FROM ota_events_raw
WHERE eventType IN ('download_progress', 'download_completed', 'install_success')
  AND (downloadTimeMs IS NOT NULL OR applyTimeMs IS NOT NULL OR downloadSizeBytes IS NOT NULL)
GROUP BY tenant_id, org_id, app_id, event_date, event_type;

-- =============================================================================
-- 3. INDEXES FOR QUERY OPTIMIZATION
-- =============================================================================

-- Add additional indexes for common query patterns
ALTER TABLE ota_events_raw ADD INDEX IF NOT EXISTS idx_device_timestamp (deviceId, timestamp) TYPE minmax GRANULARITY 3;
ALTER TABLE ota_events_raw ADD INDEX IF NOT EXISTS idx_release_timestamp (releaseId, timestamp) TYPE minmax GRANULARITY 3;
ALTER TABLE ota_events_raw ADD INDEX IF NOT EXISTS idx_event_type (eventType) TYPE set(0) GRANULARITY 1;
