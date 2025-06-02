#!/bin/sh
set -e 

echo "--- backend-entrypoint.sh starting ---"
echo "Arguments received: $@" 

ENV_FILE_TO_SOURCE="/init-data/superposition_org.env"

echo "Checking for $ENV_FILE_TO_SOURCE..."
echo "Listing /init-data directory:"
ls -la /init-data || echo "/init-data directory not found or ls failed"
echo "---"

if [ -f "$ENV_FILE_TO_SOURCE" ]; then
  echo "File $ENV_FILE_TO_SOURCE found. Content:"
  cat "$ENV_FILE_TO_SOURCE"
  echo "---"
  echo "Sourcing environment variables from $ENV_FILE_TO_SOURCE"
  
  # Source the file
  . "$ENV_FILE_TO_SOURCE"
  
  # Explicitly export, though set -a (if used) should have done it.
  # This is more for visibility and ensuring it's marked for export.
  if [ -n "$SUPERPOSITION_ORG_ID" ]; then
    export SUPERPOSITION_ORG_ID
    echo "SUPERPOSITION_ORG_ID sourced and explicitly exported. Value: '$SUPERPOSITION_ORG_ID'"
  else
    echo "WARNING: SUPERPOSITION_ORG_ID was not found in $ENV_FILE_TO_SOURCE after sourcing."
    # This case should ideally not happen if the file has the var.
  fi
else
  echo "ERROR: Environment file $ENV_FILE_TO_SOURCE not found. This is required."
  echo "The superposition-org-init service might have failed to create it, or the volume is not shared correctly."
  exit 1
fi

echo "Current environment in entrypoint (after sourcing):"
env | grep SUPERPOSITION_ORG_ID || echo "SUPERPOSITION_ORG_ID not found in 'env' output after sourcing."
echo "---"

echo "--- backend-entrypoint.sh: Running Diesel migrations ---"

# Ensure DATABASE_URL is set.
# docker-compose.yml provides DB_USER, DB_HOST, DB_PORT, DB_NAME.
# DB_PASSWORD for 'postgres' service is 'postgres' in the docker-compose file.
# If your .env.encrypted provides a decrypted DATABASE_URL or DB_PASSWORD, that will be used due to `env_file` in docker-compose.
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set by env_file. Constructing with default password 'postgres' for migrations."
  # Use DB_PASSWORD from env if available (e.g. from .env.encrypted), otherwise default to 'postgres'
  export DATABASE_URL="postgresql://${DB_USER:-postgres}:postgres@${DB_HOST:-postgres}:${DB_PORT:-5432}/${DB_NAME:-hyperotaserver}"
fi

echo "Using DATABASE_URL for diesel: [Filtered, not logging password for security]"
echo "Attempting to run diesel migration..."

# Run migrations
diesel migration run

# Optional: Check exit code
if [ $? -eq 0 ]; then
  echo "Diesel migrations completed successfully."
else
  echo "ERROR: Diesel migrations failed. Check logs above. Ensure diesel_cli is installed and DATABASE_URL is correct."
  # Consider exiting if migrations are critical for app start
  # exit 1 
fi
echo "--- Diesel migrations complete ---"

# Execute the original command passed as arguments to this script
echo "Executing command: $@"
exec "$@"
