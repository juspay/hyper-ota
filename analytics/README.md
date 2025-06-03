# OTA Analytics Server

A high-performance, enterprise-ready Rust-based OTA analytics server that uses Kafka for event streaming and ClickHouse for analytical storage.

## Features

- **Multi-tenant Analytics**: Support for multiple tenants, organizations, and applications
- **Real-time Event Ingestion**: Kafka-based event streaming with automatic batching
- **High-performance Analytics**: ClickHouse-powered analytical queries
- **Comprehensive Metrics**: Adoption, version distribution, active devices, failures, and performance
- **RESTful API**: Clean HTTP endpoints for event ingestion and analytics queries
- **Production Ready**: Structured logging, error handling, and graceful shutdown
- **Automatic Schema Management**: Database schema is created and managed automatically

## Architecture

```
Client → REST API → Kafka Producer → ClickHouse
                 ↘ Kafka Consumer → ClickHouse
```

Events are:
1. Received via REST API
2. Stored directly in ClickHouse for immediate availability
3. Also sent to Kafka for real-time processing and additional consumers

## Quick Start

### Prerequisites

- Rust 1.70+ 
- Docker and Docker Compose (for local development)

### Local Development Setup

1. **Start the infrastructure services:**
   ```bash
   docker-compose up -d
   ```

   This will start:
   - Kafka and Zookeeper
   - ClickHouse database
   - Kafka UI (accessible at http://localhost:8080)

2. **Copy environment configuration:**
   ```bash
   cp .env.example .env
   ```

3. **Build and run the server:**
   ```bash
   cargo run
   ```

The server will start on `http://localhost:8080` (or the port specified in your `.env` file).

## API Endpoints

### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-06-03T10:00:00Z",
  "services": {
    "clickhouse": true,
    "kafka": true
  }
}
```

### Ingest Event
```bash
POST /events
Content-Type: application/json

{
  "event_name": "page_view",
  "user_id": "user123",
  "session_id": "session456",
  "properties": {
    "page": "/dashboard",
    "referrer": "https://google.com"
  }
}
```

### Query Events
```bash
POST /events/query
Content-Type: application/json

{
  "event_name": "page_view",
  "user_id": "user123",
  "start_time": "2025-06-01T00:00:00Z",
  "end_time": "2025-06-03T23:59:59Z",
  "limit": 100
}
```

## Configuration

Configuration is handled through environment variables. See `.env.example` for all available options.

### Key Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | Server port | `8080` |
| `KAFKA_BROKERS` | Kafka broker addresses | `localhost:9092` |
| `KAFKA_TOPIC` | Kafka topic name | `analytics-events` |
| `CLICKHOUSE_URL` | ClickHouse server URL | `http://localhost:8123` |
| `CLICKHOUSE_DATABASE` | ClickHouse database name | `analytics` |

### Kafka Authentication (Optional)

For production deployments with Kafka authentication:

```bash
KAFKA_SECURITY_PROTOCOL=SASL_SSL
KAFKA_SASL_MECHANISMS=PLAIN
KAFKA_SASL_USERNAME=your_username
KAFKA_SASL_PASSWORD=your_password
```

## Database Schema

The server automatically creates the following ClickHouse schema:

### Events Table
```sql
CREATE TABLE events (
    id UUID DEFAULT generateUUIDv4(),
    event_name String,
    user_id Nullable(String),
    session_id Nullable(String),
    timestamp DateTime64(3) DEFAULT now64(3),
    properties Map(String, String),
    user_agent Nullable(String),
    ip_address Nullable(String),
    created_at DateTime64(3) DEFAULT now64(3)
) ENGINE = MergeTree()
ORDER BY (timestamp, event_name)
PARTITION BY toYYYYMM(timestamp)
```

### Materialized Views

The server also creates materialized views for common aggregations:

- `hourly_event_stats`: Hourly event counts and unique users per event

## Development

### Running Tests
```bash
cargo test
```

### Code Formatting
```bash
cargo fmt
```

### Linting
```bash
cargo clippy
```

### Building for Production
```bash
cargo build --release
```

## Docker Deployment

### Building the Docker Image
```bash
docker build -t analytics-server .
```

### Running with Docker
```bash
docker run -p 8080:8080 \
  -e KAFKA_BROKERS=your-kafka-brokers \
  -e CLICKHOUSE_URL=your-clickhouse-url \
  analytics-server
```

## Monitoring and Observability

The server includes:

- **Structured logging** with tracing
- **Health check endpoints** for monitoring
- **Request tracing** for debugging
- **Error handling** with proper HTTP status codes

### Accessing Kafka UI

When running locally with Docker Compose, you can access the Kafka UI at:
http://localhost:8080

This allows you to:
- View topics and messages
- Monitor consumer groups
- Debug Kafka connectivity

### ClickHouse Queries

You can connect to ClickHouse directly:

```bash
# Using clickhouse-client
clickhouse-client --host localhost --port 9000

# Using HTTP interface
curl "http://localhost:8123/" -d "SELECT * FROM analytics.events LIMIT 10"
```

## Production Considerations

1. **Resource Limits**: Configure appropriate CPU and memory limits
2. **Monitoring**: Set up monitoring for Kafka lag, ClickHouse performance
3. **Backup**: Configure ClickHouse backup strategies
4. **Security**: Use proper authentication for Kafka and ClickHouse
5. **Scaling**: Consider horizontal scaling for high-throughput scenarios

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[Add your license here]
