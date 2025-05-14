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
-- ===================================

-- 2.1 Hourly installs aggregation
-- CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_installs
-- ENGINE = SummingMergeTree()
-- PARTITION BY toYYYYMM(event_date)
-- ORDER BY (tenant_id, org_id, app_id, event_date, event_hour, release_id)
-- POPULATE
-- AS
-- SELECT
--     tenantId                       AS tenant_id,
--     orgId                          AS org_id,
--     appId                          AS app_id,
--     eventDate                      AS event_date,
--     toHour(timestamp)              AS event_hour,
--     -- Wrap releaseId in ifNull(…, '') so it is non-nullable here:
--     ifNull(releaseId, '')          AS release_id,
--     targetJsVersion                AS target_js_version,
--     count()                        AS install_count
-- FROM ota_events_raw
-- WHERE eventType = 'DOWNLOAD_COMPLETED'
-- GROUP BY
--     tenant_id,
--     org_id,
--     app_id,
--     event_date,
--     event_hour,
--     release_id,
--     target_js_version;

-- 2.1 Hourly downloads aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_downloads
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
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as download_count
FROM ota_events_raw
WHERE eventType = 'DOWNLOAD_COMPLETED'
GROUP BY tenant_id, org_id, app_id, event_date, event_hour, release_id, target_js_version;

-- 2.2 Daily downloads aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_downloads
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, release_id)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as download_count
FROM ota_events_raw
WHERE eventType = 'DOWNLOAD_COMPLETED'
GROUP BY tenant_id, org_id, app_id, event_date, release_id, target_js_version;

-- Hourly download failures aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_download_failures
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
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as download_failure_count
FROM ota_events_raw
WHERE eventType = 'DOWNLOAD_FAILED'
GROUP BY tenant_id, org_id, app_id, event_date, event_hour, release_id, target_js_version;

-- 2.4 Daily download failures aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_download_failures
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, release_id)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as download_failure_count
FROM ota_events_raw
WHERE eventType = 'DOWNLOAD_FAILED'
GROUP BY tenant_id, org_id, app_id, event_date, release_id, target_js_version;

-- Hourly OTA apply aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_applies
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
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as apply_count
FROM ota_events_raw
WHERE eventType = 'APPLY_SUCCESS'
GROUP BY tenant_id, org_id, app_id, event_date, event_hour, release_id, target_js_version;

-- Daily OTA apply aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_applies
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, release_id)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as apply_count
FROM ota_events_raw
WHERE eventType = 'APPLY_SUCCESS'
GROUP BY tenant_id, org_id, app_id, event_date, release_id, target_js_version;

-- Hourly OTA apply failures aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_apply_failures
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
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as apply_failure_count
FROM ota_events_raw
WHERE eventType = 'APPLY_FAILURE'
GROUP BY tenant_id, org_id, app_id, event_date, event_hour, release_id, target_js_version;

-- Daily OTA apply failures aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_apply_failures
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, release_id)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as apply_failure_count
FROM ota_events_raw
WHERE eventType = 'APPLY_FAILURE'
GROUP BY tenant_id, org_id, app_id, event_date, release_id, target_js_version;

-- Hourly OTA update checks aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_update_checks
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
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as update_check_count
FROM ota_events_raw
WHERE eventType = 'UPDATE_CHECK'
GROUP BY tenant_id, org_id, app_id, event_date, event_hour, release_id, target_js_version;

-- Daily OTA update checks aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_update_checks
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, release_id)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as update_check_count
FROM ota_events_raw
WHERE eventType = 'UPDATE_CHECK'
GROUP BY tenant_id, org_id, app_id, event_date, release_id, target_js_version;

-- Hourly OTA update checks aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_update_availables
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
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as update_availability_count
FROM ota_events_raw
WHERE eventType = 'UPDATE_AVAILABLE'
GROUP BY tenant_id, org_id, app_id, event_date, event_hour, release_id, target_js_version;

-- Daily OTA update checks aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_update_availables
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, release_id)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as update_availability_count
FROM ota_events_raw
WHERE eventType = 'UPDATE_AVAILABLE'
GROUP BY tenant_id, org_id, app_id, event_date, release_id, target_js_version;

-- Hourly OTA rollback initiated aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_rollback_initiates
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
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as rollback_initiate_count
FROM ota_events_raw
WHERE eventType = 'ROLLBACK_INITIATED'
GROUP BY tenant_id, org_id, app_id, event_date, event_hour, release_id, target_js_version;

-- Daily OTA rollback initiated aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_rollback_initiates
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, release_id)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as rollback_initiate_count
FROM ota_events_raw
WHERE eventType = 'ROLLBACK_INITIATED'
GROUP BY tenant_id, org_id, app_id, event_date, release_id, target_js_version;

-- Hourly OTA rollback completed aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_rollback_completes
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
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as rollback_complete_count
FROM ota_events_raw
WHERE eventType = 'ROLLBACK_COMPLETED'
GROUP BY tenant_id, org_id, app_id, event_date, event_hour, release_id, target_js_version;

-- Daily OTA rollback completed aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_rollback_completes
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, release_id)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as rollback_complete_count
FROM ota_events_raw
WHERE eventType = 'ROLLBACK_COMPLETED'
GROUP BY tenant_id, org_id, app_id, event_date, release_id, target_js_version;

-- Hourly OTA rollback failure aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_rollback_failures
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
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as rollback_failures_count
FROM ota_events_raw
WHERE eventType = 'ROLLBACK_FAILED'
GROUP BY tenant_id, org_id, app_id, event_date, event_hour, release_id, target_js_version;

-- Daily OTA rollback failure aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_rollback_failures
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, release_id)
POPULATE
AS
SELECT 
    tenantId as tenant_id,
    orgId as org_id,
    appId as app_id,
    eventDate as event_date,
    ifNull(releaseId, 'default') as release_id,
    targetJsVersion as target_js_version,
    count() as rollback_failures_count
FROM ota_events_raw
WHERE eventType = 'ROLLBACK_FAILED'
GROUP BY tenant_id, org_id, app_id, event_date, release_id, target_js_version;





-- 2.2 Daily active devices aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_active_devices
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date)
POPULATE
AS
SELECT
    tenantId               AS tenant_id,
    orgId                  AS org_id,
    appId                  AS app_id,
    eventDate              AS event_date,
    uniqState(deviceId)    AS unique_devices
FROM ota_events_raw
GROUP BY
    tenant_id,
    org_id,
    app_id,
    event_date;

-- 2.3 Version distribution aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS version_distribution
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, current_js_version)
POPULATE
AS
SELECT
    tenantId                            AS tenant_id,
    orgId                               AS org_id,
    appId                               AS app_id,
    eventDate                           AS event_date,
    -- Wrap currentJsVersion to make it non-nullable:
    ifNull(currentJsVersion, '')        AS current_js_version,
    uniq(deviceId)                      AS device_count
FROM ota_events_raw
WHERE currentJsVersion IS NOT NULL
GROUP BY
    tenant_id,
    org_id,
    app_id,
    event_date,
    current_js_version;

-- 2.4 Error frequency aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS error_frequency
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, error_code, event_type)
POPULATE
AS
SELECT
    tenantId                          AS tenant_id,
    orgId                             AS org_id,
    appId                             AS app_id,
    eventDate                         AS event_date,
    -- Wrap errorCode in ifNull(…, '') so it is non-nullable:
    ifNull(errorCode, '')             AS error_code,
    eventType                         AS event_type,
    errorMessage                      AS error_message,
    count()                           AS error_count
FROM ota_events_raw
WHERE eventType IN ('DOWNLOAD_FAILED', 'APPLY_FAILURE', 'ROLLBACK_INITIATED')
  AND errorCode IS NOT NULL
GROUP BY
    tenant_id,
    org_id,
    app_id,
    event_date,
    error_code,
    event_type,
    error_message;

-- 2.5 Performance metrics aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS performance_metrics
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, event_date, event_type)
POPULATE
AS
SELECT
    tenantId                    AS tenant_id,
    orgId                       AS org_id,
    appId                       AS app_id,
    eventDate                   AS event_date,
    eventType                   AS event_type,
    avg(downloadTimeMs)         AS avg_download_time_ms,
    avg(applyTimeMs)            AS avg_apply_time_ms,
    avg(downloadSizeBytes)      AS avg_download_size_bytes,
    count()                     AS event_count
FROM ota_events_raw
WHERE eventType IN ('DOWNLOAD_PROGRESS', 'DOWNLOAD_COMPLETED', 'DOWNLOAD_STARTED')
  AND (downloadTimeMs IS NOT NULL OR applyTimeMs IS NOT NULL OR downloadSizeBytes IS NOT NULL)
GROUP BY
    tenant_id,
    org_id,
    app_id,
    event_date,
    event_type;

-- =============================================================================
-- 3. INDEXES FOR QUERY OPTIMIZATION
-- =============================================================================

ALTER TABLE ota_events_raw
    ADD INDEX IF NOT EXISTS idx_device_timestamp (deviceId, timestamp) TYPE minmax GRANULARITY 3;

ALTER TABLE ota_events_raw
    ADD INDEX IF NOT EXISTS idx_release_timestamp (releaseId, timestamp) TYPE minmax GRANULARITY 3;

ALTER TABLE ota_events_raw
    ADD INDEX IF NOT EXISTS idx_event_type (eventType) TYPE set(0) GRANULARITY 1;
