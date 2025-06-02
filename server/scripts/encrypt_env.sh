#!/bin/bash
set -e

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Starting encrypt_env.sh with PID $$"

# Use the KMS key alias
KMS_KEY_ID="alias/my-local-key"
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Using KMS Key ID: $KMS_KEY_ID"

# Before encryption, check what keys exist
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Available KMS keys during encryption:"
aws --endpoint-url=http://localstack:4566 kms list-keys


# Try multiple locations for the input file
if [ -f "/workspace/.env.keycloak" ]; then
  INPUT_FILE="/workspace/.env.keycloak"
  echo "Found input file at /workspace/.env.keycloak"
elif [ -f "/scripts/.env.keycloak" ]; then
  INPUT_FILE="/scripts/.env.keycloak"
  echo "Found input file at /scripts/.env.keycloak"
elif [ -f ".env.keycloak" ]; then
  INPUT_FILE=".env.keycloak"
  echo "Found input file at ./.env.keycloak"
else
  echo "ERROR: Could not find .env.keycloak file"
  exit 1
fi

# Show content of input file for debugging
echo "Content of $INPUT_FILE:"
cat "$INPUT_FILE"

OUTPUT_FILE=".env.encrypted"
echo "Output will be written to $OUTPUT_FILE"

# Ensure output file is empty
> "$OUTPUT_FILE"

# Variables that need encryption
SENSITIVE_VARS=("DB_PASSWORD" "KEYCLOAK_SECRET")
echo "Will encrypt the following variables: ${SENSITIVE_VARS[*]}"

echo "🔐 Encrypting sensitive environment variables using AWS KMS..."
echo

# Read each line from the input file
while IFS= read -r line; do
  # Skip empty lines
  if [ -z "$line" ]; then
    continue
  fi
  
  # Get the key name (everything before the =)
  KEY=$(echo "$line" | cut -d= -f1)
  # Get the value (everything after the =)
  VALUE=$(echo "$line" | cut -d= -f2-)

  # Check if this key needs to be encrypted
  NEEDS_ENCRYPTION=0
  for sensitive in "${SENSITIVE_VARS[@]}"; do
    if [[ "$KEY" == "$sensitive" ]]; then
      NEEDS_ENCRYPTION=1
      break
    fi
  done

  if [[ $NEEDS_ENCRYPTION -eq 1 ]]; then
    echo "Encrypting $KEY..."
    # Write the value to a temporary file
    TMP_FILE=$(mktemp)
    printf "%s" "$VALUE" > "$TMP_FILE"
    
    # Specify the endpoint URL explicitly
    ENCRYPTED_VALUE=$(aws --endpoint-url=http://localstack:4566 kms encrypt \
      --key-id "$KMS_KEY_ID" \
      --plaintext fileb://"$TMP_FILE" \
      --query CiphertextBlob \
      --output text)
    
    # Clean up the temporary file
    rm "$TMP_FILE"
    
    # Write the encrypted value to the output file
    echo "$KEY=$ENCRYPTED_VALUE" >> "$OUTPUT_FILE"
  else
    # Pass through unencrypted values
    echo "$KEY=$VALUE" >> "$OUTPUT_FILE"
  fi
done < "$INPUT_FILE"

echo
echo "✅ Done! Encrypted environment saved to $OUTPUT_FILE"
echo "Content of encrypted file:"
cat "$OUTPUT_FILE"