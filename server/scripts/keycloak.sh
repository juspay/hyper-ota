#!/bin/sh
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

set -e

echo "===== KEYCLOAK INITIALIZATION SCRIPT STARTED ====="
echo "Using Keycloak host: ${KEYCLOAK_HOST}"
echo "Using realm: ${KEYCLOAK_REALM}"
echo "Using client ID: ${CLIENT_ID}"

# Wait for Keycloak to be ready with better logging
echo "Waiting for Keycloak to be ready..."

# Simple check - just try to access the master realm instead of the health endpoint
until curl -s -f "${KEYCLOAK_HOST}/realms/master" > /dev/null; do
    echo "Keycloak not ready yet, waiting 5 seconds..."
    sleep 5
done

echo "Keycloak is ready! Now getting admin token..."
# Rest of script remains the same...

# Get admin token with better error handling
ADMIN_TOKEN_RESPONSE=$(curl -v -s -X POST "${KEYCLOAK_HOST}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USERNAME}" \
  -d "password=${ADMIN_PASSWORD}" \
  -d "grant_type=password" \
  -d "client_id=admin-cli")

echo "Token response: $ADMIN_TOKEN_RESPONSE"

ADMIN_TOKEN=$(echo "$ADMIN_TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
    echo "ERROR: Failed to get admin token"
    exit 1
fi

echo "Successfully got admin token!"

# Get client ID with better error handling
# Get client ID with better error handling
echo "Getting client UUID for client ID: ${CLIENT_ID}..."
CLIENT_LIST_RESPONSE=$(curl -s "${KEYCLOAK_HOST}/admin/realms/${KEYCLOAK_REALM}/clients" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

echo "Client list response: $CLIENT_LIST_RESPONSE"

# Use jq to correctly parse the CLIENT_UUID
if command -v jq >/dev/null 2>&1; then
    CLIENT_UUID=$(echo "$CLIENT_LIST_RESPONSE" | jq -r --arg cid "$CLIENT_ID" '.[] | select(.clientId == $cid) | .id')
else
    echo "ERROR: jq command not found, which is required for reliable JSON parsing. Please install jq."
    exit 1 # Or attempt a more robust shell-only parse if jq is absolutely not an option.
fi


if [ -z "$CLIENT_UUID" ]; then
    echo "ERROR: Failed to get client UUID for client: ${CLIENT_ID}"
    if ! command -v jq >/dev/null 2>&1; then
        echo "Note: jq was not found, and the fallback method (if any) also failed or was not implemented."
    fi
    exit 1
fi

echo "Successfully got client UUID: $CLIENT_UUID"

# Get client secret with better error handling
echo "Getting client secret..."
echo "KEYLOCAK_REALM: $KEYCLOAK_REALM"
echo "CLIENT_UUID: $CLIENT_UUID"
SECRET_RESPONSE=$(curl -s "${KEYCLOAK_HOST}/admin/realms/${KEYCLOAK_REALM}/clients/${CLIENT_UUID}/client-secret" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

echo "Secret response: $SECRET_RESPONSE"

# Extract the value field using jq if available, or fallback to grep
if command -v jq >/dev/null 2>&1; then
    # Use jq for better JSON parsing
    CLIENT_SECRET=$(echo "$SECRET_RESPONSE" | jq -r '.value // empty')
else
    # Fallback to grep pattern but look specifically for "value" field
    CLIENT_SECRET=$(echo "$SECRET_RESPONSE" | grep -o '"value":"[^"]*' | cut -d'"' -f4)
fi

# If still empty, try to extract using a different pattern
if [ -z "$CLIENT_SECRET" ]; then
    # Try another pattern that might match
    CLIENT_SECRET=$(echo "$SECRET_RESPONSE" | sed -n 's/.*"value"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi

# If still empty, use the hardcoded value from the UI
if [ -z "$CLIENT_SECRET" ]; then
    echo "Could not extract secret from response, using hardcoded value"
    EOF
fi

echo "Using client secret: $CLIENT_SECRET"

# Get realm public key with better error handling
echo "Getting realm public key..."
REALM_RESPONSE=$(curl -s "${KEYCLOAK_HOST}/realms/${KEYCLOAK_REALM}")

echo "Realm response: $REALM_RESPONSE"

PUBLIC_KEY=$(echo "$REALM_RESPONSE" | grep -o '"public_key":"[^"]*' | cut -d'"' -f4)

# Create environment file
echo "Creating .env.keycloak file..."
cat > /workspace/.env.keycloak << EOF
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=${KEYCLOAK_REALM}
KEYCLOAK_CLIENT_ID=${CLIENT_ID}
KEYCLOAK_SECRET=${CLIENT_SECRET}
KEYCLOAK_PUBLIC_KEY=${PUBLIC_KEY}
DB_PASSWORD=postgres
DB_MIGRATION_PASSWORD=postgres
EOF

# Create environment file in scripts directory too (for redundancy)
cat > /scripts/.env.keycloak << EOF
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=${KEYCLOAK_REALM}
KEYCLOAK_CLIENT_ID=${CLIENT_ID}
KEYCLOAK_SECRET=${CLIENT_SECRET}
KEYCLOAK_PUBLIC_KEY=${PUBLIC_KEY}
DB_PASSWORD=postgres
DB_MIGRATION_PASSWORD=postgres
EOF

echo "✅ Keycloak environment variables saved to .env.keycloak"
echo "===== KEYCLOAK INITIALIZATION SCRIPT COMPLETED ====="

# Show content of the file for debugging
echo "Content of .env.keycloak:"
cat /workspace/.env.keycloak

# Keep the container running for debugging
echo "Script completed. Container will exit now."
