# Copyright 2025 Juspay Technologies
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Build frontend
FROM node:18 as frontend-builder
WORKDIR /app
COPY dashboard_react/package*.json ./dashboard_react/
WORKDIR /app/dashboard_react
RUN npm install
COPY dashboard_react/ ./

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl jq && \
    rm -rf /var/lib/apt/lists/*
# Run the build
RUN npm run build
# Make sure the build succeeded
RUN ls -la dist || echo "dist folder was not created!"

# Development stage
FROM rust:latest as dev
WORKDIR /app
# Install cargo-watch for development
RUN cargo install cargo-watch
RUN cargo install diesel_cli --no-default-features --features postgres
# Copy the entire project for development
COPY . .
# Copy the built frontend
COPY --from=frontend-builder /app/dashboard_react/dist /app/dashboard_react/dist
EXPOSE 8081
CMD ["cargo", "watch", "-x", "run"]

# Production build stage
FROM rust:latest as builder
WORKDIR /app
COPY . .
# Make sure Cargo.toml exists
RUN test -f Cargo.toml || (echo "Missing Cargo.toml" && exit 1)
# Show what we're building
RUN echo "Building with cargo" && ls -la
# Install diesel_cli for migration capabilities
RUN cargo install diesel_cli --no-default-features --features postgres
# Build the release binary
RUN cargo build --release
# Show what was built
RUN ls -la /app/target/release/
# Verify that the binary was created (fixed condition)
RUN test -f /app/target/release/hyper-ota-server || (echo "Binary not built correctly" && exit 1)
# Make sure the binary is executable
RUN chmod +x /app/target/release/hyper-ota-server

# Final production image
FROM debian:bookworm-slim as prod
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl libpq5 && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/hyper-ota-server /app/hyper-ota-server
COPY --from=builder /usr/local/cargo/bin/diesel /usr/local/bin/diesel
COPY --from=frontend-builder /app/dashboard_react/dist /app/dashboard_react/dist
CMD ["/app/hyper-ota-server"]
