#!/bin/bash

# Example script showing how to send OTA events and query analytics

BASE_URL="http://localhost:8080"

echo "=== OTA Analytics Server Example ==="

# Function to send an OTA event
send_event() {
    local event_type=$1
    local device_id=$2
    local version_from=$3
    local version_to=$4
    
    curl -s -X POST "$BASE_URL/events" \
        -H "Content-Type: application/json" \
        -d "{
            \"tenant_id\": \"acme-corp\",
            \"org_id\": \"mobile-team\",
            \"app_id\": \"my-mobile-app\",
            \"device_id\": \"$device_id\",
            \"session_id\": \"session-$(date +%s)\",
            \"event_type\": \"$event_type\",
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
            \"device_info\": {
                \"os\": \"Android\",
                \"os_version\": \"13\",
                \"model\": \"Pixel 7\",
                \"manufacturer\": \"Google\"
            },
            \"release_info\": {
                \"current_version\": \"$version_from\",
                \"target_version\": \"$version_to\",
                \"release_notes\": \"Bug fixes and performance improvements\"
            },
            \"network_info\": {
                \"connection_type\": \"WiFi\",
                \"bandwidth_mbps\": 50.0
            },
            \"performance_metrics\": {
                \"download_speed_mbps\": 25.5,
                \"install_duration_seconds\": 120,
                \"battery_level\": 75,
                \"storage_available_mb\": 2048
            }
        }"
}

echo "1. Sending sample OTA events..."

# Simulate an update flow for different devices
for i in {1..5}; do
    device_id="device-$i"
    
    echo "  - Device $device_id: Update started"
    send_event "update_started" "$device_id" "1.0.0" "1.1.0"
    
    echo "  - Device $device_id: Update downloading"
    send_event "update_downloading" "$device_id" "1.0.0" "1.1.0"
    
    echo "  - Device $device_id: Update downloaded"
    send_event "update_downloaded" "$device_id" "1.0.0" "1.1.0"
    
    if [ $((i % 2)) -eq 0 ]; then
        echo "  - Device $device_id: Update installed (success)"
        send_event "update_installed" "$device_id" "1.0.0" "1.1.0"
    else
        echo "  - Device $device_id: Update failed"
        send_event "update_failed" "$device_id" "1.0.0" "1.1.0"
    fi
done

echo -e "\n2. Querying analytics..."

echo "Health check:"
curl -s "$BASE_URL/health" | jq '.status'

echo -e "\nAdoption metrics (last 30 days):"
curl -s "$BASE_URL/analytics/adoption?tenant_id=acme-corp&days=30" | jq '.data.total_updates'

echo -e "\nVersion distribution:"
curl -s "$BASE_URL/analytics/versions?tenant_id=acme-corp" | jq '.data.versions[:3]'

echo -e "\nActive devices (last 7 days):"
curl -s "$BASE_URL/analytics/active-devices?tenant_id=acme-corp&days=7" | jq '.data.total_devices'

echo -e "\nFailure metrics (last 30 days):"
curl -s "$BASE_URL/analytics/failures?tenant_id=acme-corp&days=30" | jq '.data.failure_rate'

echo -e "\nPerformance metrics (last 30 days):"
curl -s "$BASE_URL/analytics/performance?tenant_id=acme-corp&days=30" | jq '.data.avg_download_speed'

echo -e "\n=== Example completed ==="
