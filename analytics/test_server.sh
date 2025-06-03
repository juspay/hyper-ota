#!/bin/bash

# Test script for OTA Analytics Server
echo "=== Testing OTA Analytics Server ==="

# Start server on different port
export SERVER_PORT=8081
cargo run &
SERVER_PID=$!

echo "Started server with PID: $SERVER_PID"
sleep 5

echo "Testing health endpoint..."
curl -s http://localhost:8081/health | jq '.'

echo -e "\nTesting event ingestion endpoint..."
curl -s -X POST http://localhost:8081/events \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant",
    "org_id": "test-org", 
    "app_id": "test-app",
    "device_id": "test-device-123",
    "session_id": "session-456",
    "event_type": "update_started",
    "timestamp": "2024-01-15T10:30:00Z",
    "device_info": {
      "os": "Android",
      "os_version": "13",
      "model": "Pixel 7",
      "manufacturer": "Google"
    },
    "release_info": {
      "current_version": "1.0.0",
      "target_version": "1.1.0"
    }
  }' | jq '.'

echo -e "\nTesting analytics endpoints..."

echo "- Adoption metrics:"
curl -s "http://localhost:8081/analytics/adoption?tenant_id=test-tenant&days=30" | jq '.'

echo -e "\n- Version distribution:"
curl -s "http://localhost:8081/analytics/versions?tenant_id=test-tenant" | jq '.'

echo -e "\n- Active devices:"
curl -s "http://localhost:8081/analytics/active-devices?tenant_id=test-tenant&days=7" | jq '.'

echo -e "\n- Failure metrics:"
curl -s "http://localhost:8081/analytics/failures?tenant_id=test-tenant&days=30" | jq '.'

echo -e "\n- Performance metrics:"
curl -s "http://localhost:8081/analytics/performance?tenant_id=test-tenant&days=30" | jq '.'

echo -e "\n=== Test completed ==="

# Stop server
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null
echo "Server stopped"
