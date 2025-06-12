# OTA Analytics Server

A high-performance, enterprise-ready Rust-based OTA analytics platform that leverages **Kafka** for event streaming and **ClickHouse** for analytical storage. Built specifically for Over-The-Air (OTA) update analytics across multi-tenant mobile applications.

## 🏗️ Architecture Overview

```
[ React Native OTA Client ]
        ↓ (HTTP POST)
[ Ingestion Service / API ]
        ↓ (Publish to Kafka topic "ota-events")
[ Kafka Cluster ]
        ↓ (Consumer group "clickhouse-writers")
[ Stream Consumer / ETL Service ]
        ↓ (Batch inserts)
[ ClickHouse Cluster ]
        ↓ (Materialized views & aggregations)
[ Analytics API & Dashboard Layer ]
```

### Key Components

1. **Event Ingestion API**: RESTful endpoints for receiving OTA events from mobile clients
2. **Kafka Producer**: Streams events to Kafka topics for decoupled processing
3. **Kafka Consumer**: Processes events in batches and stores in ClickHouse
4. **ClickHouse Storage**: Columnar OLAP database with materialized views for fast analytics
5. **Analytics API**: Query endpoints for adoption metrics, failure analysis, and performance insights
6. **Multi-Tenant Support**: Complete isolation with tenant/org/app hierarchy

## 🚀 Features

- **📊 Multi-tenant Analytics**: Complete data isolation per tenant/organization/application
- **⚡ Real-time Event Streaming**: Kafka-based event pipeline with automatic batching
- **🔍 High-performance Queries**: ClickHouse-powered sub-second analytics responses
- **📈 Comprehensive OTA Metrics**: 
  - Adoption rates and installation trends
  - Version distribution across devices
  - Active device tracking
  - Failure analysis and error tracking
  - Performance metrics (download speeds, install times)
- **🛡️ Production Ready**: Structured logging, error handling, graceful shutdown
- **🔄 Auto-Schema Management**: Automatic ClickHouse table and view creation
- **📱 Mobile-Optimized**: Purpose-built for React Native OTA update analytics

## 📱 OTA Event Types

The system tracks the complete OTA update lifecycle:

| Event Type | Description | Typical Payload |
|------------|-------------|-----------------|
| `update_started` | Update process initiated | `current_version`, `target_version` |
| `update_downloading` | Downloading update package | `progress`, `download_speed` |
| `update_downloaded` | Download completed | `package_size`, `download_duration` |
| `update_installing` | Installation in progress | `install_progress` |
| `update_installed` | Installation completed successfully | `install_duration`, `success_metrics` |
| `update_failed` | Update process failed | `error_code`, `error_message`, `failure_stage` |
| `update_cancelled` | Update cancelled by user | `cancellation_reason` |
| `rollback_started` | Rollback initiated | `rollback_reason` |
| `rollback_completed` | Rollback completed | `rollback_duration` |

## 🛠️ Quick Start

### Prerequisites

- **Rust 1.70+** 
- **Docker & Docker Compose** (for local development)
- **ClickHouse 23.0+**
- **Apache Kafka 2.8+**

### 🐳 Local Development Setup

1. **Start infrastructure services:**
   ```bash
   cd analytics
   docker-compose up -d
   ```

   This starts:
   - ClickHouse (port 8123 HTTP, 9000 native)
   - Kafka & Zookeeper (port 9092)
   - Kafka UI (http://localhost:8080)

2. **Configure environment:**
   ```bash
   # Use defaults for local development
   export CLICKHOUSE_URL="http://localhost:8123"
   export KAFKA_BROKERS="localhost:9092"
   export SERVER_PORT="8081"  # Avoid conflict with Kafka UI
   ```

3. **Build and run:**
   ```bash
   cargo run
   ```

4. **Verify health:**
   ```bash
   curl http://localhost:8081/health
   ```

### 🧪 Quick Test

Run the example script to see the system in action:

```bash
chmod +x example.sh
./example.sh
```

This will send sample OTA events and query the analytics endpoints.

## 🔌 API Endpoints

### Event Ingestion

#### `POST /events` - Ingest OTA Event

Submit OTA events from mobile clients:

```bash
curl -X POST http://localhost:8081/events \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp",
    "org_id": "mobile-team",
    "app_id": "my-mobile-app",
    "device_id": "device-123",
    "session_id": "session-456",
    "event_type": "update_started",
    "timestamp": "2025-06-03T10:30:00Z",
    "device_info": {
      "os": "Android",
      "os_version": "13",
      "model": "Pixel 7",
      "manufacturer": "Google"
    },
    "release_info": {
      "current_version": "1.0.0",
      "target_version": "1.1.0",
      "release_notes": "Bug fixes and improvements"
    },
    "performance_metrics": {
      "download_speed_mbps": 25.5,
      "install_duration_seconds": 120,
      "battery_level": 75,
      "storage_available_mb": 2048
    }
  }'
```

### Analytics Endpoints

#### `GET /analytics/adoption` - Adoption Metrics

Track OTA adoption rates over time:

```bash
curl "http://localhost:8081/analytics/adoption?tenant_id=acme-corp&days=30&app_id=my-app"
```

**Response:**
```json
{
  "data": {
    "total_updates": 15420,
    "successful_updates": 14891,
    "failed_updates": 529,
    "success_rate": 96.57,
    "hourly_installs": [
      {"hour": "2025-06-03T10:00:00Z", "installs": 142, "failures": 8},
      {"hour": "2025-06-03T11:00:00Z", "installs": 156, "failures": 12}
    ]
  }
}
```

#### `GET /analytics/versions` - Version Distribution

Current version spread across active devices:

```bash
curl "http://localhost:8081/analytics/versions?tenant_id=acme-corp&app_id=my-app"
```

**Response:**
```json
{
  "data": {
    "versions": [
      {"version": "1.1.0", "device_count": 8524, "percentage": 67.2},
      {"version": "1.0.0", "device_count": 3891, "percentage": 30.7},
      {"version": "0.9.8", "device_count": 265, "percentage": 2.1}
    ],
    "total_devices": 12680
  }
}
```

#### `GET /analytics/active-devices` - Active Devices

Device activity and engagement metrics:

```bash
curl "http://localhost:8081/analytics/active-devices?tenant_id=acme-corp&days=7"
```

#### `GET /analytics/failures` - Failure Analysis

Detailed failure tracking and error analysis:

```bash
curl "http://localhost:8081/analytics/failures?tenant_id=acme-corp&days=30"
```

#### `GET /analytics/performance` - Performance Metrics

Download speeds, install times, and performance trends:

```bash
curl "http://localhost:8081/analytics/performance?tenant_id=acme-corp&days=30"
```

### System Health

#### `GET /health` - Health Check

```bash
curl http://localhost:8081/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-03T10:00:00Z",
  "services": {
    "clickhouse": {
      "status": "healthy",
      "response_time_ms": 12
    },
    "kafka": {
      "status": "healthy",
      "producer_ready": true,
      "consumer_lag": 0
    }
  },
  "metrics": {
    "events_processed": 156789,
    "events_per_second": 45.2
  }
}
```

## ⚙️ Configuration

Configuration is handled through environment variables with sensible defaults:

### Server Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | HTTP server port | `8080` |

### Kafka Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `KAFKA_BROKERS` | Kafka broker addresses | `localhost:9092` |
| `KAFKA_TOPIC` | Primary OTA events topic | `ota-events` |
| `KAFKA_CONSUMER_GROUP` | Consumer group ID | `ota-analytics-consumer` |

### ClickHouse Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `CLICKHOUSE_URL` | ClickHouse HTTP endpoint | `http://localhost:8123` |
| `CLICKHOUSE_DATABASE` | Database name | `analytics` |
| `CLICKHOUSE_USERNAME` | Database username | (none) |
| `CLICKHOUSE_PASSWORD` | Database password | (none) |

### Security Configuration (Production)

For production deployments with authenticated Kafka:

```bash
export KAFKA_SECURITY_PROTOCOL="SASL_SSL"
export KAFKA_SASL_MECHANISMS="PLAIN"
export KAFKA_SASL_USERNAME="your_username"
export KAFKA_SASL_PASSWORD="your_password"
```

## 🗄️ Database Schema

The server automatically creates and manages the ClickHouse schema optimized for OTA analytics.

### Primary Events Table

```sql
CREATE TABLE ota_events_raw (
    event_id UUID DEFAULT generateUUIDv4(),
    tenant_id String,
    org_id String,
    app_id String,
    device_id String,
    session_id Nullable(String),
    event_type String,
    timestamp DateTime64(3),
    event_date Date MATERIALIZED toDate(timestamp),
    
    -- Device context
    device_os Nullable(String),
    device_os_version Nullable(String),
    device_model Nullable(String),
    device_manufacturer Nullable(String),
    
    -- Release information
    current_version Nullable(String),
    target_version Nullable(String),
    release_notes Nullable(String),
    
    -- Network context
    connection_type Nullable(String),
    bandwidth_mbps Nullable(Float64),
    
    -- Performance metrics
    download_speed_mbps Nullable(Float64),
    install_duration_seconds Nullable(UInt32),
    battery_level Nullable(UInt8),
    storage_available_mb Nullable(UInt32),
    
    -- Error tracking
    error_code Nullable(String),
    error_message Nullable(String),
    
    ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, timestamp, event_type)
TTL event_date + INTERVAL 365 DAY
SETTINGS index_granularity = 8192;
```

### Materialized Views for Fast Analytics

The system automatically creates optimized materialized views:

#### 1. Hourly Installs
```sql
CREATE TABLE hourly_installs (
    tenant_id String,
    org_id String,
    app_id String,
    target_version String,
    hour_slot DateTime,
    installs AggregateFunction(uniqExact, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour_slot)
ORDER BY (tenant_id, org_id, app_id, target_version, hour_slot);
```

#### 2. Daily Active Devices
```sql
CREATE TABLE daily_active_devices (
    tenant_id String,
    org_id String, 
    app_id String,
    stat_date Date,
    active_devices AggregateFunction(uniqExact, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(stat_date)
ORDER BY (tenant_id, org_id, app_id, stat_date);
```

#### 3. Version Distribution
Pre-aggregated version adoption metrics for instant dashboard queries.

#### 4. Failure Analysis
Categorized failure tracking with error codes and failure stages.

## 🚀 Performance & Scalability

### Performance Characteristics

- **Event Ingestion**: >10,000 events/second on modest hardware
- **Query Performance**: Sub-second response times for most analytics queries
- **Storage Efficiency**: 10:1+ compression ratios with ClickHouse columnar storage
- **Memory Usage**: Minimal RAM footprint with efficient Rust implementation

### Scaling Strategies

#### Horizontal Scaling
- **Kafka Partitioning**: Partition by `hash(tenant_id, org_id, app_id)` for load distribution
- **Multiple Consumers**: Run multiple consumer instances for parallel processing
- **ClickHouse Sharding**: Distribute across multiple ClickHouse nodes

#### Optimization Techniques
- **Batch Processing**: Configurable batch sizes (default: 1000 events)
- **Connection Pooling**: Efficient database connection management
- **Materialized Views**: Pre-computed aggregations for instant dashboard queries
- **TTL Policies**: Automatic data lifecycle management

## 🔧 Development

### Project Structure

```
src/
├── main.rs              # Application entry point & server setup
├── config.rs            # Environment-based configuration
├── models.rs            # OTA event models & types
├── error.rs             # Centralized error handling
├── kafka.rs             # Kafka producer/consumer implementation
├── clickhouse.rs        # ClickHouse client & queries
└── handlers/
    ├── events.rs        # Event ingestion endpoints
    ├── analytics.rs     # Analytics query endpoints  
    └── health.rs        # Health check & monitoring
```

### Development Workflow

```bash
# Format code
cargo fmt

# Run linting
cargo clippy

# Run tests
cargo test

# Build for production
cargo build --release

# Run with specific log level
RUST_LOG=debug cargo run
```

### Adding New Analytics

1. **Define Query Parameters**: Add to `AnalyticsQuery` in `models.rs`
2. **Implement ClickHouse Query**: Add method in `clickhouse.rs`
3. **Create HTTP Handler**: Add endpoint in `handlers/analytics.rs`
4. **Register Route**: Update route registration in `main.rs`
5. **Test**: Add integration test and update documentation

## 🐳 Docker Deployment

### Building Production Image

```bash
# Build optimized image
docker build -t ota-analytics:latest .

# Multi-stage build with minimal runtime
docker build --target production -t ota-analytics:prod .
```

### Docker Compose for Production

```yaml
version: '3.8'
services:
  analytics:
    image: ota-analytics:latest
    ports:
      - "8080:8080"
    environment:
      - KAFKA_BROKERS=kafka-cluster:9092
      - CLICKHOUSE_URL=http://clickhouse-cluster:8123
      - KAFKA_SECURITY_PROTOCOL=SASL_SSL
      - KAFKA_SASL_USERNAME=${KAFKA_USERNAME}
      - KAFKA_SASL_PASSWORD=${KAFKA_PASSWORD}
    restart: unless-stopped
    
  clickhouse:
    image: clickhouse/clickhouse-server:23-alpine
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    environment:
      - CLICKHOUSE_DB=analytics
      
volumes:
  clickhouse_data:
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ota-analytics
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ota-analytics
  template:
    metadata:
      labels:
        app: ota-analytics
    spec:
      containers:
      - name: analytics
        image: ota-analytics:latest
        ports:
        - containerPort: 8080
        env:
        - name: KAFKA_BROKERS
          value: "kafka-service:9092"
        - name: CLICKHOUSE_URL
          value: "http://clickhouse-service:8123"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi" 
            cpu: "500m"
```

## 📊 Monitoring & Observability

### Built-in Monitoring

The system provides comprehensive observability:

- **Structured Logging**: JSON-formatted logs with trace IDs
- **Health Endpoints**: Deep health checks for all dependencies
- **Performance Metrics**: Built-in request timing and throughput tracking
- **Error Tracking**: Detailed error context with stack traces

### Key Metrics to Monitor

#### Application Metrics
- Event ingestion rate (events/second)
- Query response times (p50, p95, p99)
- Error rates by endpoint
- Active consumer lag

#### Infrastructure Metrics
- Kafka broker health and partition lag
- ClickHouse query performance and storage usage
- Memory and CPU utilization
- Network I/O and connection pools

### Accessing Kafka UI

For local development, Kafka UI is available at:
**http://localhost:8080**

Features:
- Topic and partition management
- Message browsing and publishing
- Consumer group monitoring
- Cluster health overview

### ClickHouse Monitoring

#### Direct Database Access
```bash
# Using clickhouse-client
clickhouse-client --host localhost --port 9000

# Query via HTTP API
curl "http://localhost:8123/" -d "
  SELECT 
    count() as events,
    uniqExact(device_id) as devices,
    countIf(event_type = 'update_installed') as installs
  FROM ota_events_raw 
  WHERE event_date = today()
"
```

#### Performance Queries
```sql
-- Check table sizes
SELECT 
  database,
  table,
  formatReadableSize(sum(bytes)) as size,
  sum(rows) as rows
FROM system.parts 
WHERE database = 'analytics'
GROUP BY database, table;

-- Monitor query performance
SELECT 
  query_duration_ms,
  query,
  user,
  initial_query_start_time
FROM system.query_log 
WHERE event_date = today()
  AND query_duration_ms > 1000
ORDER BY query_duration_ms DESC
LIMIT 10;
```

## 🔒 Security & Production Considerations

### Authentication & Authorization
- **Kafka SASL/SSL**: Secure broker communication
- **ClickHouse Users**: Role-based database access
- **API Security**: Rate limiting and request validation
- **Multi-tenant Isolation**: Complete data separation

### Data Privacy & Compliance
- **Tenant Data Isolation**: Strict query-level filtering
- **Data Retention**: Configurable TTL policies
- **Audit Logging**: Complete request tracing
- **GDPR Compliance**: Device ID anonymization options

### High Availability Setup
- **Kafka Replication**: Minimum 3 replicas per partition
- **ClickHouse Clustering**: Distributed tables with replicas
- **Load Balancing**: Multiple analytics service instances
- **Failover**: Automatic consumer group rebalancing

### Performance Tuning
```bash
# Kafka producer optimization
KAFKA_BATCH_SIZE=65536
KAFKA_LINGER_MS=10
KAFKA_COMPRESSION_TYPE=snappy

# ClickHouse optimization  
CLICKHOUSE_MAX_MEMORY_USAGE=8000000000
CLICKHOUSE_MAX_THREADS=8
CLICKHOUSE_MAX_EXECUTION_TIME=300
```

## 📚 Use Cases & Examples

### 1. Release Adoption Tracking
Monitor how quickly users adopt new OTA releases:

```bash
# Track adoption for specific release
curl "http://localhost:8081/analytics/adoption?tenant_id=acme&target_version=2.1.0&days=7"
```

### 2. Failure Analysis
Identify and troubleshoot update failures:

```bash
# Get failure breakdown by error code
curl "http://localhost:8081/analytics/failures?tenant_id=acme&days=30&group_by=error_code"
```

### 3. Performance Monitoring
Track download and installation performance:

```bash
# Monitor performance trends
curl "http://localhost:8081/analytics/performance?tenant_id=acme&days=30"
```

### 4. Device Segmentation
Analyze update behavior by device characteristics:

```bash
# Version distribution by device OS
curl "http://localhost:8081/analytics/versions?tenant_id=acme&segment=device_os"
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/hyperota-analytics.git`
3. Create a feature branch: `git checkout -b feature/my-feature`
4. Set up development environment: `docker-compose up -d`
5. Run tests: `cargo test`

### Contribution Guidelines
- **Code Style**: Run `cargo fmt` and `cargo clippy`
- **Testing**: Add tests for new functionality
- **Documentation**: Update README and code comments
- **Commits**: Use conventional commit format

### Areas for Contribution
- Additional analytics endpoints
- Performance optimizations
- Monitoring and alerting improvements
- Documentation and examples
- Multi-region deployment guides

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🚀 Ready to Get Started?

1. **Clone the repository**
2. **Run `docker-compose up -d`** to start infrastructure
3. **Execute `cargo run`** to start the analytics server
4. **Try the example script**: `./example.sh`
5. **Explore the API** with your OTA events

For questions or support, please open an issue on GitHub or refer to the [documentation](docs/).

---

*Built with ❤️ for the mobile development community*
