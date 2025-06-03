use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub kafka: KafkaConfig,
    pub clickhouse: ClickHouseConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KafkaConfig {
    pub brokers: String,
    pub topic: String,
    pub consumer_group: String,
    pub security_protocol: Option<String>,
    pub sasl_mechanisms: Option<String>,
    pub sasl_username: Option<String>,
    pub sasl_password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClickHouseConfig {
    pub url: String,
    pub database: String,
    pub username: Option<String>,
    pub password: Option<String>,
}

impl Config {
    pub fn load() -> Result<Self> {
        dotenv::dotenv().ok(); // Load .env file if it exists

        let config = Config {
            server: ServerConfig {
                port: env::var("SERVER_PORT")
                    .unwrap_or_else(|_| "6400".to_string())
                    .parse()
                    .unwrap_or(6400),
            },
            kafka: KafkaConfig {
                brokers: env::var("KAFKA_BROKERS")
                    .unwrap_or_else(|_| "localhost:9092".to_string()),
                topic: env::var("KAFKA_TOPIC")
                    .unwrap_or_else(|_| "ota-events".to_string()),
                consumer_group: env::var("KAFKA_CONSUMER_GROUP")
                    .unwrap_or_else(|_| "ota-analytics-consumer".to_string()),
                security_protocol: env::var("KAFKA_SECURITY_PROTOCOL").ok(),
                sasl_mechanisms: env::var("KAFKA_SASL_MECHANISMS").ok(),
                sasl_username: env::var("KAFKA_SASL_USERNAME").ok(),
                sasl_password: env::var("KAFKA_SASL_PASSWORD").ok(),
            },
            clickhouse: ClickHouseConfig {
                url: env::var("CLICKHOUSE_URL")
                    .unwrap_or_else(|_| "http://localhost:8123".to_string()),
                database: env::var("CLICKHOUSE_DATABASE")
                    .unwrap_or_else(|_| "analytics".to_string()),
                username: env::var("CLICKHOUSE_USERNAME").ok(),
                password: env::var("CLICKHOUSE_PASSWORD").ok(),
            },
        };

        Ok(config)
    }
}
