# Build frontend
FROM node:18 as frontend-builder
WORKDIR /app/frontend
COPY dashboard_react/package*.json ./
RUN npm install
COPY dashboard_react/ .
RUN npm run build

# Build backend
FROM rust:latest as backend-builder
WORKDIR /app
COPY . .
RUN cargo build --release --jobs 1

# Final image
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=backend-builder /app/target/release/hyper-ota-server .
COPY --from=frontend-builder /app/frontend/dist ./static

EXPOSE 8080
CMD ["./hyper-ota-server"]