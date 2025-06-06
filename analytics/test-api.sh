#!/bin/bash

# OTA Analytics Server API Test Script

BASE_URL="http://localhost:8080"

echo "🚀 Testing OTA Analytics Server API"
echo "==================================="

# Test health endpoint
echo "📊 Testing health endpoint..."
curl -s -X GET "$BASE_URL/health" | jq . || echo "❌ Health check failed"
echo ""

# Test OTA event ingestion - Update Check
echo "📥 Testing UPDATE_CHECK event..."
curl -s -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp",
    "org_id": "mobile-team",
    "app_id": "my-awesome-app",
    "event_type": "UpdateCheck",
    "device_id": "device_123",
    "session_id": "session_456",
    "current_version": "1.2.0",
    "target_version": "1.3.0",
    "update_id": "update_789",
    "device_info": {
      "platform": "android",
      "os_version": "13.0",
      "app_version": "1.2.0",
      "device_model": "Pixel 7"
    },
    "custom_properties": {
      "user_segment": "premium",
      "region": "us-west"
    }
  }' | jq . || echo "❌ UPDATE_CHECK event failed"
echo ""

# Test OTA event ingestion - Download Started
echo "📥 Testing DOWNLOAD_STARTED event..."
curl -s -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp",
    "org_id": "mobile-team", 
    "app_id": "my-awesome-app",
    "event_type": "DownloadStarted",
    "device_id": "device_123",
    "session_id": "session_456",
    "current_version": "1.2.0",
    "target_version": "1.3.0",
    "update_id": "update_789",
    "device_info": {
      "platform": "android",
      "os_version": "13.0",
      "app_version": "1.2.0",
      "device_model": "Pixel 7"
    },
    "performance_metrics": {
      "download_size_bytes": 15728640,
      "network_type": "wifi"
    }
  }' | jq . || echo "❌ DOWNLOAD_STARTED event failed"
echo ""

# Test OTA event ingestion - Apply Success
echo "📥 Testing APPLY_SUCCESS event..."
curl -s -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp",
    "org_id": "mobile-team",
    "app_id": "my-awesome-app", 
    "event_type": "ApplySuccess",
    "device_id": "device_123",
    "session_id": "session_456",
    "current_version": "1.2.0",
    "target_version": "1.3.0",
    "update_id": "update_789",
    "device_info": {
      "platform": "android",
      "os_version": "13.0",
      "app_version": "1.3.0",
      "device_model": "Pixel 7"
    },
    "performance_metrics": {
      "download_size_bytes": 15728640,
      "download_duration_ms": 30000,
      "apply_duration_ms": 5000,
      "total_duration_ms": 35000
    }
  }' | jq . || echo "❌ APPLY_SUCCESS event failed"
echo ""

# Test OTA event ingestion - Apply Failure  
echo "📥 Testing APPLY_FAILURE event..."
curl -s -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp",
    "org_id": "mobile-team",
    "app_id": "my-awesome-app",
    "event_type": "ApplyFailure", 
    "device_id": "device_456",
    "session_id": "session_789",
    "current_version": "1.2.0",
    "target_version": "1.3.0",
    "update_id": "update_789",
    "device_info": {
      "platform": "android",
      "os_version": "12.0",
      "app_version": "1.2.0",
      "device_model": "Samsung Galaxy S21"
    },
    "error_info": {
      "error_code": "INSUFFICIENT_STORAGE",
      "error_message": "Not enough storage space to apply update",
      "stack_trace": "StorageException: Available: 500MB, Required: 800MB"
    }
  }' | jq . || echo "❌ APPLY_FAILURE event failed"
echo ""

# Wait a moment for events to be processed
echo "⏳ Waiting for events to be processed..."
sleep 3

# Test analytics endpoints
echo "📊 Testing adoption metrics..."
curl -s -X GET "$BASE_URL/analytics/adoption?tenant_id=acme-corp&days=30" | jq . || echo "❌ Adoption metrics failed"
echo ""

echo "📊 Testing version distribution..."
curl -s -X GET "$BASE_URL/analytics/versions?tenant_id=acme-corp&app_id=my-awesome-app&days=30" | jq . || echo "❌ Version distribution failed"
echo ""

echo "📊 Testing active devices..."
curl -s -X GET "$BASE_URL/analytics/active-devices?tenant_id=acme-corp&org_id=mobile-team&days=7" | jq . || echo "❌ Active devices failed"
echo ""

echo "📊 Testing failure metrics..."
curl -s -X GET "$BASE_URL/analytics/failures?tenant_id=acme-corp&days=30" | jq . || echo "❌ Failure metrics failed"
echo ""

echo "📊 Testing performance metrics..."
curl -s -X GET "$BASE_URL/analytics/performance?tenant_id=acme-corp&app_id=my-awesome-app&days=7" | jq . || echo "❌ Performance metrics failed"
echo ""

echo "✅ OTA Analytics API testing complete!"
