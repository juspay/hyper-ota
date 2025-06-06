.PHONY: help build run test clean docker-build docker-run dev-up dev-down

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the application
	cargo build

build-release: ## Build the application in release mode
	cargo build --release

run: ## Run the application
	cargo run

test: ## Run tests
	cargo test

test-verbose: ## Run tests with verbose output
	cargo test -- --nocapture

fmt: ## Format code
	cargo fmt

clippy: ## Run clippy linter
	cargo clippy -- -D warnings

clean: ## Clean build artifacts
	cargo clean

# Development environment
dev-up: ## Start development environment (Kafka, ClickHouse)
	docker-compose up -d
	@echo "Development environment started!"
	@echo "Kafka UI: http://localhost:8080"
	@echo "ClickHouse: http://localhost:8123"

dev-down: ## Stop development environment
	docker-compose down

dev-logs: ## Show logs from development environment
	docker-compose logs -f

# Docker
docker-build: ## Build Docker image
	docker build -t analytics-server .

docker-run: ## Run Docker container
	docker run -p 8080:8080 --env-file .env analytics-server

# Database operations
clickhouse-shell: ## Connect to ClickHouse shell
	docker exec -it clickhouse clickhouse-client

kafka-topics: ## List Kafka topics
	docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --list

kafka-console-consumer: ## Start Kafka console consumer
	docker exec -it kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic analytics-events --from-beginning

# API testing
test-health: ## Test health endpoint
	curl -X GET http://localhost:8080/health | jq .

test-ingest: ## Test event ingestion
	curl -X POST http://localhost:8080/events \
		-H "Content-Type: application/json" \
		-d '{"event_name": "test_event", "user_id": "test_user", "properties": {"test": "data"}}' | jq .

test-query: ## Test event querying
	curl -X POST http://localhost:8080/events/query \
		-H "Content-Type: application/json" \
		-d '{"event_name": "test_event", "limit": 10}' | jq .

# Setup
setup: ## Initial setup for development
	@echo "Setting up development environment..."
	cp .env.example .env
	make dev-up
	@echo "Waiting for services to be ready..."
	sleep 10
	@echo "Setup complete! You can now run 'make run' to start the server."
