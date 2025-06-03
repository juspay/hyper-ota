use anyhow::Result;
use clickhouse::{Client as ClickHouseClient, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, error};
use chrono::{DateTime, Utc, NaiveDate};
use uuid::Uuid;

use crate::config::ClickHouseConfig;
use crate::models::{
    OtaEvent, OtaEventType, AnalyticsQuery, AnalyticsQueryResult, PageInfo,
    AdoptionMetrics, HourlyInstalls, VersionDistribution, VersionMetrics,
    ActiveDevicesMetrics, DailyActiveDevices, FailureAnalytics, ErrorFrequency, DailyFailures
};

#[derive(Clone)]
pub struct Client {
    client: ClickHouseClient,
    database: String,
}

impl Client {
    pub async fn new(config: &ClickHouseConfig) -> Result<Self> {
        let mut client = ClickHouseClient::default()
            .with_url(&config.url)
            .with_database(&config.database);

        if let Some(username) = &config.username {
            client = client.with_user(username);
        }

        if let Some(password) = &config.password {
            client = client.with_password(password);
        }

        let client_instance = Self {
            client,
            database: config.database.clone(),
        };

        // The schema is now initialized via init-clickhouse.sql
        info!("ClickHouse client initialized for database: {}", config.database);

        Ok(client_instance)
    }

    // Add a method to access the client for health checks
    pub fn query(&self, sql: &str) -> clickhouse::query::Query {
        self.client.query(sql)
    }

    /// Initialize the database schema
    pub async fn init_schema(&self) -> Result<()> {
        info!("Initializing ClickHouse schema for OTA analytics");
        
        // Create main OTA events table if it doesn't exist
        let create_table_sql = r#"
            CREATE TABLE IF NOT EXISTS ota_events_raw (
                tenantId String,
                orgId String,
                appId String,
                deviceId String,
                sessionId Nullable(String),
                eventType String,
                eventId UUID,
                timestamp DateTime64(3, 'UTC'),
                eventDate Date,
                releaseId Nullable(String),
                currentJsVersion Nullable(String),
                targetJsVersion Nullable(String),
                rolloutPercentage Nullable(UInt8),
                osVersion Nullable(String),
                appVersion Nullable(String),
                deviceType Nullable(String),
                networkType Nullable(String),
                errorCode Nullable(String),
                errorMessage Nullable(String),
                stackTrace Nullable(String),
                downloadSizeBytes Nullable(UInt64),
                downloadTimeMs Nullable(UInt64),
                applyTimeMs Nullable(UInt64),
                payload Nullable(String),
                userAgent Nullable(String),
                ipAddress Nullable(String),
                ingestedAt DateTime64(3, 'UTC') DEFAULT now64()
            ) ENGINE = MergeTree()
            PARTITION BY toYYYYMM(eventDate)
            ORDER BY (tenantId, orgId, appId, eventDate, eventType, timestamp)
            SETTINGS index_granularity = 8192
        "#;
        
        self.client.query(create_table_sql).execute().await?;
        info!("OTA events table created/verified");

        Ok(())
    }

    /// Insert OTA event into the raw events table
    pub async fn insert_ota_event(&self, event: &OtaEvent) -> Result<()> {
        #[derive(Row, Serialize)]
        struct OtaEventRow {
            #[serde(rename = "tenantId")]
            tenant_id: String,
            #[serde(rename = "orgId")]
            org_id: String,
            #[serde(rename = "appId")]
            app_id: String,
            #[serde(rename = "deviceId")]
            device_id: String,
            #[serde(rename = "sessionId")]
            session_id: Option<String>,
            #[serde(rename = "eventType")]
            event_type: String,
            #[serde(rename = "eventId")]
            event_id: uuid::Uuid,
            timestamp: DateTime<Utc>,
            #[serde(rename = "eventDate")]
            event_date: chrono::NaiveDate,
            #[serde(rename = "releaseId")]
            release_id: Option<String>,
            #[serde(rename = "currentJsVersion")]
            current_js_version: Option<String>,
            #[serde(rename = "targetJsVersion")]
            target_js_version: Option<String>,
            #[serde(rename = "rolloutPercentage")]
            rollout_percentage: Option<u8>,
            #[serde(rename = "osVersion")]
            os_version: Option<String>,
            #[serde(rename = "appVersion")]
            app_version: Option<String>,
            #[serde(rename = "deviceType")]
            device_type: Option<String>,
            #[serde(rename = "networkType")]
            network_type: Option<String>,
            #[serde(rename = "errorCode")]
            error_code: Option<String>,
            #[serde(rename = "errorMessage")]
            error_message: Option<String>,
            #[serde(rename = "stackTrace")]
            stack_trace: Option<String>,
            #[serde(rename = "downloadSizeBytes")]
            download_size_bytes: Option<u64>,
            #[serde(rename = "downloadTimeMs")]
            download_time_ms: Option<u64>,
            #[serde(rename = "applyTimeMs")]
            apply_time_ms: Option<u64>,
            payload: String,
            #[serde(rename = "userAgent")]
            user_agent: Option<String>,
            #[serde(rename = "ipAddress")]
            ip_address: Option<String>,
            #[serde(rename = "ingestedAt")]
            ingested_at: DateTime<Utc>,
        }

        let row = OtaEventRow {
            tenant_id: event.tenant_id.clone(),
            org_id: event.org_id.clone(),
            app_id: event.app_id.clone(),
            device_id: event.device_id.clone(),
            session_id: event.session_id.clone(),
            event_type: event.event_type.to_string(),
            event_id: event.event_id.unwrap_or_else(|| uuid::Uuid::new_v4()),
            timestamp: event.timestamp,
            event_date: event.timestamp.date_naive(),
            release_id: event.release_id.clone(),
            current_js_version: event.current_js_version.clone(),
            target_js_version: event.target_js_version.clone(),
            rollout_percentage: event.rollout_percentage,
            os_version: event.os_version.clone(),
            app_version: event.app_version.clone(),
            device_type: event.device_type.clone(),
            network_type: event.network_type.clone(),
            error_code: event.error_code.clone(),
            error_message: event.error_message.clone(),
            stack_trace: event.stack_trace.clone(),
            download_size_bytes: event.download_size_bytes,
            download_time_ms: event.download_time_ms,
            apply_time_ms: event.apply_time_ms,
            payload: event.payload.as_ref()
                .map(|p| serde_json::to_string(p).unwrap_or_default())
                .unwrap_or_else(|| "{}".to_string()),
            user_agent: event.user_agent.clone(),
            ip_address: event.ip_address.clone(),
            ingested_at: Utc::now(),
        };

        let mut insert = self.client.insert("ota_events_raw")?;
        insert.write(&row).await?;
        insert.end().await?;

        info!("OTA event inserted: {} for tenant {}", event.event_type.to_string(), event.tenant_id);
        Ok(())
    }

    /// Batch insert multiple OTA events for efficiency
    pub async fn insert_ota_events_batch(&self, events: Vec<OtaEvent>) -> Result<()> {
        if events.is_empty() {
            return Ok(());
        }

        #[derive(Row, Serialize)]
        struct OtaEventRow {
            #[serde(rename = "tenantId")]
            tenant_id: String,
            #[serde(rename = "orgId")]
            org_id: String,
            #[serde(rename = "appId")]
            app_id: String,
            #[serde(rename = "deviceId")]
            device_id: String,
            #[serde(rename = "sessionId")]
            session_id: Option<String>,
            #[serde(rename = "eventType")]
            event_type: String,
            #[serde(rename = "eventId")]
            event_id: uuid::Uuid,
            timestamp: DateTime<Utc>,
            #[serde(rename = "eventDate")]
            event_date: chrono::NaiveDate,
            #[serde(rename = "releaseId")]
            release_id: Option<String>,
            #[serde(rename = "currentJsVersion")]
            current_js_version: Option<String>,
            #[serde(rename = "targetJsVersion")]
            target_js_version: Option<String>,
            #[serde(rename = "rolloutPercentage")]
            rollout_percentage: Option<u8>,
            #[serde(rename = "osVersion")]
            os_version: Option<String>,
            #[serde(rename = "appVersion")]
            app_version: Option<String>,
            #[serde(rename = "deviceType")]
            device_type: Option<String>,
            #[serde(rename = "networkType")]
            network_type: Option<String>,
            #[serde(rename = "errorCode")]
            error_code: Option<String>,
            #[serde(rename = "errorMessage")]
            error_message: Option<String>,
            #[serde(rename = "stackTrace")]
            stack_trace: Option<String>,
            #[serde(rename = "downloadSizeBytes")]
            download_size_bytes: Option<u64>,
            #[serde(rename = "downloadTimeMs")]
            download_time_ms: Option<u64>,
            #[serde(rename = "applyTimeMs")]
            apply_time_ms: Option<u64>,
            payload: String,
            #[serde(rename = "userAgent")]
            user_agent: Option<String>,
            #[serde(rename = "ipAddress")]
            ip_address: Option<String>,
            #[serde(rename = "ingestedAt")]
            ingested_at: DateTime<Utc>,
        }

        let events_len = events.len();
        let rows: Vec<OtaEventRow> = events.into_iter().map(|event| {
            OtaEventRow {
                tenant_id: event.tenant_id,
                org_id: event.org_id,
                app_id: event.app_id,
                device_id: event.device_id,
                session_id: event.session_id,
                event_type: event.event_type.to_string(),
                event_id: event.event_id.unwrap_or_else(|| Uuid::new_v4()),
                timestamp: event.timestamp,
                event_date: event.timestamp.date_naive(),
                release_id: event.release_id,
                current_js_version: event.current_js_version,
                target_js_version: event.target_js_version,
                rollout_percentage: event.rollout_percentage,
                os_version: event.os_version,
                app_version: event.app_version,
                device_type: event.device_type,
                network_type: event.network_type,
                error_code: event.error_code,
                error_message: event.error_message,
                stack_trace: event.stack_trace,
                download_size_bytes: event.download_size_bytes,
                download_time_ms: event.download_time_ms,
                apply_time_ms: event.apply_time_ms,
                payload: event.payload.as_ref()
                    .map(|p| serde_json::to_string(p).unwrap_or_default())
                    .unwrap_or_else(|| "{}".to_string()),
                user_agent: event.user_agent,
                ip_address: event.ip_address,
                ingested_at: Utc::now(),
            }
        }).collect();

        let mut insert = self.client.insert("ota_events_raw")?;
        for row in rows {
            insert.write(&row).await?;
        }
        insert.end().await?;

        info!("Batch inserted {} OTA events", events_len);
        Ok(())
    }

    /// Query OTA events with filters
    pub async fn query_ota_events(&self, query: &AnalyticsQuery) -> Result<AnalyticsQueryResult> {
        let mut sql = String::from("SELECT * FROM ota_events_raw WHERE 1=1");

        // Add tenant filter (required for multi-tenancy)
        sql.push_str(&format!(" AND tenantId = '{}'", query.tenant_id));

        // Add optional filters
        if let Some(org_id) = &query.org_id {
            sql.push_str(&format!(" AND orgId = '{}'", org_id));
        }

        if let Some(app_id) = &query.app_id {
            sql.push_str(&format!(" AND appId = '{}'", app_id));
        }

        if let Some(device_id) = &query.device_id {
            sql.push_str(&format!(" AND deviceId = '{}'", device_id));
        }

        if let Some(event_type) = &query.event_type {
            sql.push_str(&format!(" AND eventType = '{}'", event_type.to_string()));
        }

        if let Some(release_id) = &query.release_id {
            sql.push_str(&format!(" AND releaseId = '{}'", release_id));
        }

        if let Some(start_time) = &query.start_time {
            sql.push_str(&format!(" AND timestamp >= '{}'", start_time.format("%Y-%m-%d %H:%M:%S")));
        }

        if let Some(end_time) = &query.end_time {
            sql.push_str(&format!(" AND timestamp <= '{}'", end_time.format("%Y-%m-%d %H:%M:%S")));
        }

        // Add ordering
        sql.push_str(" ORDER BY timestamp DESC");

        // Add pagination
        if let Some(limit) = query.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }

        if let Some(offset) = query.offset {
            sql.push_str(&format!(" OFFSET {}", offset));
        }

        info!("Executing OTA events query: {}", sql);

        // Execute a simplified query to get count
        let count_sql = sql.replace("SELECT *", "SELECT count() as total");
        let total_count: u64 = self.client.query(&count_sql).fetch_one().await.unwrap_or(0);

        // For now, return dummy data structure
        let events = vec![
            serde_json::json!({
                "message": "Query executed successfully",
                "total_rows": total_count,
                "sql": sql
            })
        ];

        Ok(AnalyticsQueryResult {
            total_count: total_count as usize,
            page_info: PageInfo {
                limit: query.limit.unwrap_or(100),
                offset: query.offset.unwrap_or(0),
                has_next_page: events.len() == query.limit.unwrap_or(100) as usize,
            },
            events,
        })
    }

    /// Get adoption metrics for a release
    pub async fn get_adoption_metrics(
        &self,
        tenant_id: &str,
        org_id: &str,
        app_id: &str,
        release_id: &str,
        days: u32,
    ) -> Result<AdoptionMetrics> {
        // Get hourly installs
        let hourly_sql = format!(
            r#"
            SELECT 
                hourSlot,
                uniqExactMerge(installs) as installs
            FROM hourly_installs 
            WHERE tenantId = '{}' 
              AND orgId = '{}' 
              AND appId = '{}' 
              AND releaseId = '{}'
              AND hourSlot >= subtractDays(now(), {})
            ORDER BY hourSlot
            "#,
            tenant_id, org_id, app_id, release_id, days
        );

        let mut hourly_cursor = self.client.query(&hourly_sql).fetch::<(u64, u64)>()?;
        let mut hourly_breakdown = Vec::new();
        let mut total_installs = 0u64;

        while let Some((timestamp_epoch, installs)) = hourly_cursor.next().await? {
            total_installs += installs;
            // Convert epoch to DateTime for compatibility
            let hour_slot = DateTime::from_timestamp(timestamp_epoch as i64, 0)
                .unwrap_or_else(|| Utc::now());
            hourly_breakdown.push(HourlyInstalls { hour_slot, installs });
        }

        // Get failure and rollback counts
        let failure_sql = format!(
            r#"
            SELECT 
                sumMerge(failureCount) as failures,
                sumMerge(rollbackCount) as rollbacks
            FROM daily_failures_rollbacks 
            WHERE tenantId = '{}' 
              AND orgId = '{}' 
              AND appId = '{}' 
              AND releaseId = '{}'
              AND statDate >= subtractDays(today(), {})
            "#,
            tenant_id, org_id, app_id, release_id, days
        );

        let (failures, rollbacks): (u64, u64) = self.client
            .query(&failure_sql)
            .fetch_one()
            .await
            .unwrap_or((0, 0));

        let total_attempts = total_installs + failures;
        let success_rate = if total_attempts > 0 {
            (total_installs as f64 / total_attempts as f64) * 100.0
        } else {
            0.0
        };

        let failure_rate = if total_attempts > 0 {
            (failures as f64 / total_attempts as f64) * 100.0
        } else {
            0.0
        };

        let rollback_rate = if total_installs > 0 {
            (rollbacks as f64 / total_installs as f64) * 100.0
        } else {
            0.0
        };

        Ok(AdoptionMetrics {
            tenant_id: tenant_id.to_string(),
            org_id: org_id.to_string(),
            app_id: app_id.to_string(),
            release_id: release_id.to_string(),
            total_installs,
            hourly_breakdown,
            success_rate,
            failure_rate,
            rollback_rate,
        })
    }

    /// Get version distribution for an app
    pub async fn get_version_distribution(
        &self,
        tenant_id: &str,
        org_id: &str,
        app_id: &str,
        days: u32,
    ) -> Result<VersionDistribution> {
        let sql = format!(
            r#"
            SELECT 
                jsVersion,
                sum(uniqExactMerge(deviceCount)) as device_count
            FROM daily_version_dist 
            WHERE tenantId = '{}' 
              AND orgId = '{}' 
              AND appId = '{}' 
              AND statDate >= subtractDays(today(), {})
            GROUP BY jsVersion
            ORDER BY device_count DESC
            "#,
            tenant_id, org_id, app_id, days
        );

        let mut cursor = self.client.query(&sql).fetch::<(String, u64)>()?;
        let mut versions = Vec::new();
        let mut total_devices = 0u64;

        while let Some((js_version, device_count)) = cursor.next().await? {
            total_devices += device_count;
            versions.push(VersionMetrics {
                js_version,
                device_count,
                percentage: 0.0, // Will calculate after we know total
            });
        }

        // Calculate percentages
        for version in &mut versions {
            version.percentage = if total_devices > 0 {
                (version.device_count as f64 / total_devices as f64) * 100.0
            } else {
                0.0
            };
        }

        Ok(VersionDistribution {
            tenant_id: tenant_id.to_string(),
            org_id: org_id.to_string(),
            app_id: app_id.to_string(),
            versions,
            total_devices,
        })
    }

    /// Get active devices metrics
    pub async fn get_active_devices_metrics(
        &self,
        tenant_id: &str,
        org_id: &str,
        app_id: &str,
        days: u32,
    ) -> Result<ActiveDevicesMetrics> {
        let sql = format!(
            r#"
            SELECT 
                statDate,
                uniqExactMerge(activeDevices) as active_devices
            FROM daily_active_devices 
            WHERE tenantId = '{}' 
              AND orgId = '{}' 
              AND appId = '{}' 
              AND statDate >= subtractDays(today(), {})
            ORDER BY statDate
            "#,
            tenant_id, org_id, app_id, days
        );

        let mut cursor = self.client.query(&sql).fetch::<(u32, u64)>()?;
        let mut daily_breakdown = Vec::new();
        let mut total_active_devices = 0u64;

        while let Some((date_days, active_devices)) = cursor.next().await? {
            if active_devices > total_active_devices {
                total_active_devices = active_devices;
            }
            // Convert days since epoch to NaiveDate
            let date = NaiveDate::from_num_days_from_ce_opt(date_days as i32 + 719163)
                .unwrap_or_else(|| chrono::Utc::now().date_naive());
            daily_breakdown.push(DailyActiveDevices { date, active_devices });
        }

        Ok(ActiveDevicesMetrics {
            tenant_id: tenant_id.to_string(),
            org_id: org_id.to_string(),
            app_id: app_id.to_string(),
            daily_breakdown,
            total_active_devices,
        })
    }

    /// Get failure analytics
    pub async fn get_failure_analytics(
        &self,
        tenant_id: &str,
        org_id: &str,
        app_id: &str,
        release_id: Option<&str>,
        days: u32,
    ) -> Result<FailureAnalytics> {
        let mut where_clause = format!(
            "tenantId = '{}' AND orgId = '{}' AND appId = '{}' AND statDate >= subtractDays(today(), {})",
            tenant_id, org_id, app_id, days
        );

        if let Some(release_id) = release_id {
            where_clause.push_str(&format!(" AND releaseId = '{}'", release_id));
        }

        // Get total failures and rollbacks
        let totals_sql = format!(
            r#"
            SELECT 
                sumMerge(failureCount) as total_failures,
                sumMerge(rollbackCount) as total_rollbacks
            FROM daily_failures_rollbacks 
            WHERE {}
            "#,
            where_clause
        );

        let (total_failures, total_rollbacks): (u64, u64) = self.client
            .query(&totals_sql)
            .fetch_one()
            .await
            .unwrap_or((0, 0));

        // Get daily breakdown
        let daily_sql = format!(
            r#"
            SELECT 
                statDate,
                sumMerge(failureCount) as failures,
                sumMerge(rollbackCount) as rollbacks
            FROM daily_failures_rollbacks 
            WHERE {}
            GROUP BY statDate
            ORDER BY statDate
            "#,
            where_clause
        );

        let mut daily_cursor = self.client.query(&daily_sql).fetch::<(u32, u64, u64)>()?;
        let mut failure_rate_trend = Vec::new();

        while let Some((date_days, failures, rollbacks)) = daily_cursor.next().await? {
            let date = NaiveDate::from_num_days_from_ce_opt(date_days as i32 + 719163)
                .unwrap_or_else(|| chrono::Utc::now().date_naive());
            failure_rate_trend.push(DailyFailures { date, failures, rollbacks });
        }

        // For now, return empty common_errors - would need more complex query for error aggregation
        let common_errors = Vec::new();

        Ok(FailureAnalytics {
            tenant_id: tenant_id.to_string(),
            org_id: org_id.to_string(),
            app_id: app_id.to_string(),
            release_id: release_id.map(|s| s.to_string()),
            total_failures,
            total_rollbacks,
            common_errors,
            failure_rate_trend,
        })
    }
}
