#!/bin/bash
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

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Init script starting with PID $$"
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Current LocalStack container ID: $(hostname)"

# Check if LocalStack is the same container as when we started
CONTAINER_ID=$(curl -s http://localstack:4566/_localstack/health | grep -o '"container_id":"[^"]*' | cut -d'"' -f4)
echo "[$(date +"%Y-%m-%d %H:%M:%S")] LocalStack container reports ID: $CONTAINER_ID"

# List any existing keys before we do anything
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Checking for existing keys..."
aws --endpoint-url=http://localstack:4566 kms list-keys

echo "Initializing AWS resources in LocalStack..."

# Set up AWS environment variables
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL="http://localstack:4566"
export AWS_SESSION_TOKEN=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_ACCESS_KEY_ID=test

echo "Configured AWS environment variables:"
env | grep AWS_

# Wait for services to be ready
echo "Waiting for LocalStack services to be ready..."
sleep 2

# Test connectivity to localstack
echo "Testing LocalStack connectivity..."
curl -v http://localstack:4566

# Create the KMS key and get the ID
echo "Creating KMS key..."
KEYID=$(aws kms create-key \
  --description "Key for encrypting environment variables" \
  --query 'KeyMetadata.KeyId' \
  --output text)

echo "Created KMS key with ID: $KEYID"

# Check if alias exists and update it if needed
echo "Creating or updating KMS alias..."
if aws kms list-aliases | grep -q "alias/my-local-key"; then
  echo "Alias already exists, updating it to point to the new key..."
  aws kms update-alias \
    --alias-name alias/my-local-key \
    --target-key-id "$KEYID"
else
  echo "Creating new alias..."
  aws kms create-alias \
    --alias-name alias/my-local-key \
    --target-key-id "$KEYID"
fi

# Create S3 bucket
echo "Creating S3 bucket..."
aws s3 mb s3://test || echo "Bucket may already exist"

echo "AWS resources initialized successfully!"

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Created KMS key with ID: $KEYID"
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Checking all current keys:"
aws --endpoint-url=http://localstack:4566 kms list-keys
