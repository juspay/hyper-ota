#!/usr/bin/env bash
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

KMS_KEY_ID="alias/my-local-key"
OUTPUT_FILE=".env"
> "$OUTPUT_FILE"

# Define variable names
CONFIG_KEYS=(
  DB_USER
  DB_HOST
  DB_NAME
  DB_PASSWORD
  DATABASE_POOL_SIZE
  KEYCLOAK_URL
  KEYCLOAK_SECRET
  KEYCLOAK_CLIENT_ID
  KEYCLOAK_REALM
  KEYCLOAK_PUBLIC_KEY
  SUPERPOSITION_URL
  AWS_BUCKET
  AWS_ENDPOINT_URL
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_SESSION_TOKEN
  AWS_REGION
  PUBLIC_ENDPOINT
)

# Indices of sensitive variables (0-based)
SECRET_INDICES=(3 6)

# Default values for some keys
get_default() {
  case "$1" in
    DB_USER) echo "user" ;;
    DB_HOST) echo "localhost:5432" ;;
    DB_NAME) echo "hyperotaserver" ;;
    DATABASE_POOL_SIZE) echo "2" ;;
    KEYCLOAK_URL) echo "http://localhost:8080" ;;
    KEYCLOAK_CLIENT_ID) echo "hyper-ota-server" ;;
    KEYCLOAK_REALM) echo "hyperOTA" ;;
    SUPERPOSITION_URL) echo "http://localhost:8083" ;;
    AWS_BUCKET) echo "test" ;;
    AWS_ACCESS_KEY_ID) echo "test" ;;
    AWS_SECRET_ACCESS_KEY) echo "test" ;;
    AWS_SESSION_TOKEN) echo "test" ;;
    AWS_ENDPOINT_URL) echo "http://localhost:4566" ;;
    AWS_REGION) echo "us-east-1" ;;
    PUBLIC_ENDPOINT) echo "http://localhost:5000" ;;
    *) echo "" ;;
  esac
}

is_secret() {
  local idx=$1
  for secret_idx in "${SECRET_INDICES[@]}"; do
    if [[ "$secret_idx" == "$idx" ]]; then
      return 0
    fi
  done
  return 1
}

echo "🔐 Generating encrypted .env.enc using AWS KMS..."
echo "Using KMS Key ID: $KMS_KEY_ID"
echo

for i in "${!CONFIG_KEYS[@]}"; do
  KEY=${CONFIG_KEYS[$i]}
  if is_secret "$i"; then
    read -s -p "Enter secret for $KEY: " SECRET_VALUE
    echo
    TMP_FILE=$(mktemp)
    printf %s "$SECRET_VALUE" > "$TMP_FILE"
    ENCRYPTED_VALUE=$(aws --endpoint-url=http://localhost:4566 kms encrypt \
      --key-id "$KMS_KEY_ID" \
      --plaintext fileb://"$TMP_FILE" \
      --query CiphertextBlob \
      --output text)
    rm "$TMP_FILE"
        echo "$KEY=$ENCRYPTED_VALUE" >> "$OUTPUT_FILE"
  else
    read -p "Enter value for $KEY (or press enter to use default): " VALUE
    FINAL_VALUE=${VALUE:-$(get_default "$KEY")}
    echo "$KEY=$FINAL_VALUE" >> "$OUTPUT_FILE"
  fi
done

echo
echo "✅ Done! Encrypted environment saved to $OUTPUT_FILE"
