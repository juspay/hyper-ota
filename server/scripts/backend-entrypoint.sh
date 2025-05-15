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

# Execute the original command passed as arguments to this script
echo "Executing command: $@"
exec "$@"
