use anyhow::Result;
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{CommitMode, Consumer as KafkaConsumer, StreamConsumer};
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::Message;
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};

use crate::config::KafkaConfig;
use crate::models::OtaEvent;
use crate::clickhouse;

#[derive(Clone)]
pub struct Producer {
    producer: FutureProducer,
    topic: String,
}

impl Producer {
    pub async fn new(config: &KafkaConfig) -> Result<Self> {
        let mut client_config = ClientConfig::new();
        client_config.set("bootstrap.servers", &config.brokers);
        client_config.set("message.timeout.ms", "5000");
        client_config.set("batch.size", "65536");  // 64KB batches for better throughput
        client_config.set("linger.ms", "10");      // Small delay to allow batching
        client_config.set("compression.type", "snappy");  // Compression for efficiency

        // Add security configuration if provided
        if let Some(security_protocol) = &config.security_protocol {
            client_config.set("security.protocol", security_protocol);

            if let (Some(username), Some(password)) = (&config.sasl_username, &config.sasl_password) {
                client_config.set("sasl.username", username);
                client_config.set("sasl.password", password);
            }

            if let Some(mechanisms) = &config.sasl_mechanisms {
                client_config.set("sasl.mechanisms", mechanisms);
            }
        }

        let producer: FutureProducer = client_config.create()?;

        Ok(Self {
            producer,
            topic: config.topic.clone(),
        })
    }

    pub async fn send_ota_event(&self, event: &OtaEvent) -> Result<()> {
        let payload = serde_json::to_string(event)?;
        
        // Use a combination of tenant_id, org_id, app_id for partitioning
        // This ensures events from the same app go to the same partition
        let key = format!("{}:{}:{}", event.tenant_id, event.org_id, event.app_id);

        let record = FutureRecord::to(&self.topic)
            .key(&key)
            .payload(&payload)
            .headers(rdkafka::message::OwnedHeaders::new()
                .insert(rdkafka::message::Header {
                    key: "event_type",
                    value: Some(&event.event_type.to_string()),
                })
                .insert(rdkafka::message::Header {
                    key: "tenant_id", 
                    value: Some(&event.tenant_id),
                })
                .insert(rdkafka::message::Header {
                    key: "org_id",
                    value: Some(&event.org_id),
                })
                .insert(rdkafka::message::Header {
                    key: "app_id",
                    value: Some(&event.app_id),
                }));

        match self.producer.send(record, Duration::from_secs(5)).await {
            Ok(delivery) => {
                info!(
                    "OTA event sent successfully: {} for {}/{}/{} - {:?}", 
                    event.event_type.to_string(),
                    event.tenant_id,
                    event.org_id, 
                    event.app_id,
                    delivery
                );
                Ok(())
            }
            Err((e, _)) => {
                error!(
                    "Failed to send OTA event: {} for {}/{}/{} - {:?}", 
                    event.event_type.to_string(),
                    event.tenant_id,
                    event.org_id,
                    event.app_id,
                    e
                );
                Err(e.into())
            }
        }
    }

    /// Send multiple events in a batch for better performance
    pub async fn send_ota_events_batch(&self, events: &[OtaEvent]) -> Result<Vec<Result<(), anyhow::Error>>> {
        let mut results = Vec::new();
        
        for event in events {
            results.push(self.send_ota_event(event).await);
        }
        
        Ok(results)
    }
}

pub struct Consumer {
    consumer: StreamConsumer,
    topic: String,
    clickhouse: Arc<clickhouse::Client>,
}

impl Consumer {
    pub async fn new(config: &KafkaConfig, clickhouse: Arc<clickhouse::Client>) -> Result<Self> {
        use rdkafka::consumer::Consumer as _;  // Import trait methods
        
        let mut client_config = ClientConfig::new();
        client_config.set("group.id", &config.consumer_group);
        client_config.set("bootstrap.servers", &config.brokers);
        client_config.set("enable.partition.eof", "false");
        client_config.set("session.timeout.ms", "6000");
        client_config.set("enable.auto.commit", "false");  // Manual commit for better control
        client_config.set("auto.offset.reset", "earliest");
        client_config.set("fetch.min.bytes", "1048576");  // 1MB minimum fetch for efficiency
        client_config.set("fetch.wait.max.ms", "500");    // Max 500ms wait

        // Add security configuration if provided
        if let Some(security_protocol) = &config.security_protocol {
            client_config.set("security.protocol", security_protocol);

            if let (Some(username), Some(password)) = (&config.sasl_username, &config.sasl_password) {
                client_config.set("sasl.username", username);
                client_config.set("sasl.password", password);
            }

            if let Some(mechanisms) = &config.sasl_mechanisms {
                client_config.set("sasl.mechanisms", mechanisms);
            }
        }

        let consumer: StreamConsumer = client_config.create()?;
        consumer.subscribe(&[&config.topic])?;

        Ok(Self {
            consumer,
            topic: config.topic.clone(),
            clickhouse,
        })
    }

    pub async fn start_consuming(&self) -> Result<()> {
        use rdkafka::consumer::Consumer as _;  // Import trait methods
        
        info!("Starting Kafka consumer for OTA events topic: {}", self.topic);

        // For batch processing
        let mut batch = Vec::new();
        const BATCH_SIZE: usize = 100;
        let mut last_commit = std::time::Instant::now();
        const COMMIT_INTERVAL: Duration = Duration::from_secs(5);

        loop {
            match self.consumer.recv().await {
                Err(e) => {
                    error!("Kafka receive error: {:?}", e);
                    tokio::time::sleep(Duration::from_secs(1)).await;
                    continue;
                }
                Ok(m) => {
                    let payload = match m.payload_view::<str>() {
                        None => {
                            warn!("Empty message payload");
                            continue;
                        }
                        Some(Ok(s)) => s,
                        Some(Err(e)) => {
                            error!("Message payload is not valid UTF-8: {:?}", e);
                            continue;
                        }
                    };

                    // Parse the OTA event
                    match serde_json::from_str::<OtaEvent>(payload) {
                        Ok(event) => {
                            info!(
                                "Received OTA event: {} for {}/{}/{}", 
                                event.event_type.to_string(),
                                event.tenant_id,
                                event.org_id,
                                event.app_id
                            );
                            
                            batch.push(event);

                            // Process batch when it reaches size limit or commit interval
                            if batch.len() >= BATCH_SIZE || last_commit.elapsed() > COMMIT_INTERVAL {
                                if let Err(e) = self.process_event_batch(&batch).await {
                                    error!("Failed to process event batch: {:?}", e);
                                    // In production, you might want to send failed events to a dead letter queue
                                } else {
                                    // Only commit if batch processing succeeded
                                    if let Err(e) = self.consumer.commit_message(&m, CommitMode::Async) {
                                        error!("Failed to commit message: {:?}", e);
                                    } else {
                                        info!("Successfully processed and committed batch of {} events", batch.len());
                                    }
                                }
                                
                                batch.clear();
                                last_commit = std::time::Instant::now();
                            }
                        }
                        Err(e) => {
                            error!("Failed to parse OTA event: {:?}, payload: {}", e, payload);
                            // Log the failed message for debugging but continue processing
                        }
                    }
                }
            }
        }
    }

    async fn process_event_batch(&self, events: &[OtaEvent]) -> Result<()> {
        info!("Processing batch of {} OTA events", events.len());
        
        // Store events in ClickHouse in batch for efficiency
        if let Err(e) = self.clickhouse.insert_ota_events_batch(events.to_vec()).await {
            error!("Failed to insert batch to ClickHouse: {:?}", e);
            return Err(e.into());
        }
        
        // Process specific event types for real-time alerts and counters
        for event in events {
            match event.event_type {
                crate::models::EventType::ApplyFailure => {
                    warn!(
                        "OTA Apply failure detected for {}/{}/{}: {:?}", 
                        event.tenant_id, event.org_id, event.app_id, event.error_message
                    );
                    // TODO: Trigger alert system
                }
                crate::models::EventType::RollbackInitiated => {
                    warn!(
                        "OTA Rollback initiated for {}/{}/{}", 
                        event.tenant_id, event.org_id, event.app_id
                    );
                    // TODO: Trigger alert system
                }
                crate::models::EventType::ApplySuccess => {
                    info!(
                        "OTA Apply success for {}/{}: {} -> {}", 
                        event.tenant_id, event.app_id,
                        event.current_js_version.as_deref().unwrap_or("unknown"),
                        event.target_js_version.as_deref().unwrap_or("unknown")
                    );
                }
                crate::models::EventType::UpdateCheck => {
                    // Most frequent event, only log at debug level
                    tracing::debug!(
                        "Update check for {}/{} - version: {:?}",
                        event.tenant_id, event.app_id, event.current_js_version
                    );
                }
                _ => {
                    // Handle other event types
                    tracing::debug!("Processed event: {:?}", event.event_type);
                }
            }
        }
        
        Ok(())
    }

    /// Get consumer lag information for monitoring
    pub async fn get_consumer_lag(&self) -> Result<Option<u64>> {
        // This would require additional implementation to fetch metadata
        // For now, return None - implement based on your monitoring needs
        Ok(None)
    }
}
