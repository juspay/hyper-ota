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

# Environment variables (can be overridden in docker-compose.yml)
SUPERPOSITION_API_URL="${SUPERPOSITION_URL:-http://superposition:8080}/superposition" # Added /superposition path
DEFAULT_ORG_NAME="${SUPERPOSITION_DEFAULT_ORG_NAME:-DefaultHyperOTAOrg}"
ORG_ADMIN_EMAIL="${SUPERPOSITION_DEFAULT_ORG_ADMIN_EMAIL:-system@example.com}"
OUTPUT_ENV_FILE="${SUPERPOSITION_ORG_ID_FILE:-scripts/init-data/superposition_org.env}"

echo "Superposition API URL: $SUPERPOSITION_API_URL"
echo "Default Org Name: $DEFAULT_ORG_NAME"
echo "Output Env File: $OUTPUT_ENV_FILE"

# Wait for Superposition to be ready
echo "Waiting for Superposition to be ready at $SUPERPOSITION_API_URL/organisations..."
# Increased retries and timeout, check against a known endpoint that doesn't require auth if possible,
# or an endpoint that fails fast if auth is missing (like /organisations if it's protected).
# A dedicated health check endpoint on Superposition would be better.
# Using a GET request and checking for any 2xx/3xx/401/403 as signs of life.
RETRY_COUNT=0
MAX_RETRIES=90 # Approx 3 minutes, to give Superposition more time
SUCCESS_STATUS=0
until [ $RETRY_COUNT -ge $MAX_RETRIES ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SUPERPOSITION_API_URL/organisations?limit=1") # Query for 1 to be light
    echo "Superposition readiness check (attempt $RETRY_COUNT/$MAX_RETRIES): Status $HTTP_STATUS"
    
    # Consider any of these as "responsive enough" to proceed with actual calls
    # 200: OK (lists orgs)
    # 401/403: Auth error, but server is up
    # 404: Endpoint exists but no data (e.g. if ?limit=1 and no orgs) - less ideal but server is up
    if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 401 ] || [ "$HTTP_STATUS" -eq 403 ] || [ "$HTTP_STATUS" -eq 404 ] ; then
        SUCCESS_STATUS=1
        break
    fi
    echo "Superposition not responsive yet, waiting 2 seconds..."
    sleep 2
done

if [ "$SUCCESS_STATUS" -ne 1 ]; then
    echo "ERROR: Superposition did not become responsive after $MAX_RETRIES attempts. Last status: $HTTP_STATUS"
    exit 1
fi
echo "Superposition is responsive (HTTP Status: $HTTP_STATUS)."

# Check if organization already exists by name
# Superposition's list organisations endpoint might not support filtering by exact name directly in query params.
# A common pattern is to fetch all and filter with jq, or use a specific search param if available.
# Assuming for now we might need to fetch all if no direct name filter.
# If the list can be large, this is inefficient. A dedicated "get by name" or search would be better.

echo "Checking if organization '$DEFAULT_ORG_NAME' already exists..."
ORG_ID=$(curl -s -X GET "$SUPERPOSITION_API_URL/organisations?all=true" \
    -H "Content-Type: application/json" | \
    jq -r --arg NAME "$DEFAULT_ORG_NAME" '.data[] | select(.name == $NAME) | .id' | head -n 1)

if [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ]; then
    echo "Organization '$DEFAULT_ORG_NAME' already exists with ID: $ORG_ID"
else
    echo "Organization '$DEFAULT_ORG_NAME' does not exist. Creating it..."
    CREATE_PAYLOAD=$(cat <<EOF
{
    "name": "$DEFAULT_ORG_NAME",
    "admin_email": "$ORG_ADMIN_EMAIL",
    "country_code": "US",
    "contact_email": "$ORG_ADMIN_EMAIL",
    "contact_phone": "0000000000",
    "sector": "Technology"
}
EOF
)
    echo "Creation payload: $CREATE_PAYLOAD"
    
    RESPONSE=$(curl -s -w "%{http_code}" -X POST "$SUPERPOSITION_API_URL/organisations" \
        -H "Content-Type: application/json" \
        -d "$CREATE_PAYLOAD")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$ d')

    echo "Superposition API response body: $BODY"
    echo "Superposition API response HTTP code: $HTTP_CODE"

    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        ORG_ID=$(echo "$BODY" | jq -r '.id')
        if [ -z "$ORG_ID" ] || [ "$ORG_ID" == "null" ]; then
            echo "ERROR: Failed to parse organization ID from Superposition response."
            echo "Response body: $BODY"
            exit 1
        fi
        echo "Successfully created organization '$DEFAULT_ORG_NAME' with ID: $ORG_ID"
    else
        echo "ERROR: Failed to create organization in Superposition. HTTP Status: $HTTP_CODE"
        echo "Response body: $BODY"
        exit 1
    fi
fi

# Ensure output directory exists
mkdir -p "$(dirname "$OUTPUT_ENV_FILE")"

# Write the ID to the output file for docker-compose to use
echo "SUPERPOSITION_ORG_ID=$ORG_ID" > "$OUTPUT_ENV_FILE"
echo "Successfully wrote SUPERPOSITION_ORG_ID to $OUTPUT_ENV_FILE"
cat "$OUTPUT_ENV_FILE"
