#!/bin/bash
set -e

MODE=${1:-dev}    # dev or prod (default to dev if not provided)
BUILD=${2:-nobuild}   # build or nobuild (default to nobuild)
DETACH=${3:-nodetach}  # detach or nodetach (default to nodetach)

DETACH_FLAG=""
if [ "$DETACH" = "detach" ]; then
    DETACH_FLAG="-d"
fi

BUILD_FLAG=""
if [ "$BUILD" = "build" ]; then
    BUILD_FLAG="--build" # This flag is for 'docker compose up'
fi

# --- Minimal Change: Define Superposition Directory ---
SUPERPOSITION_DIR="./superposition" # Adjust if your superposition clone is elsewhere

# --- Minimal Change: Cleanup function for Superposition ---
cleanup_superposition() {
    echo "Attempting to stop superposition via 'make kill'..."
    if [ -d "$SUPERPOSITION_DIR" ]; then
        (cd "$SUPERPOSITION_DIR" && make kill || echo "Superposition 'make kill' failed or already stopped.")
    else
        echo "Superposition directory '$SUPERPOSITION_DIR' not found, skipping 'make kill'."
    fi
}

# --- Minimal Change: Trap for cleanup ---
# This will call cleanup_superposition AND then the original script would exit,
# leading to Docker Compose services potentially being left.
# A more robust trap would also call 'docker compose down -v'.
# For truly minimal, we'll just add superposition cleanup.
# For a cleaner exit, you'd combine cleanups.
full_cleanup() {
    echo "Executing full cleanup..."
    cleanup_superposition
    echo "Bringing down Docker Compose services..."
    docker compose down -v --remove-orphans # Ensure this is what you want on exit
    echo "Full cleanup complete."
}
trap full_cleanup SIGINT SIGTERM EXIT


if [ "$MODE" = "dev" ] || [ "$MODE" = "prod" ]; then
    export ENVIRONMENT=$MODE
    
    echo "Starting services in clean state..."
    # Initial 'down' is good, will also be called by trap on exit.
    docker compose down -v --remove-orphans # Force clean state

    # --- Minimal Change: Start Superposition ---
    if [ ! -d "$SUPERPOSITION_DIR" ]; then
        echo "ERROR: Superposition directory '$SUPERPOSITION_DIR' not found!"
        echo "Please clone 'juspay/superposition' into that location or update the SUPERPOSITION_DIR variable."
        exit 1
    fi
    echo "Starting superposition from '$SUPERPOSITION_DIR' in the background..."
    (cd "$SUPERPOSITION_DIR" && make run  > superposition.log 2>&1 &)
    echo "Superposition 'make run' initiated. Check '$SUPERPOSITION_DIR/superposition.log'."

    # Actual wait loop for Superposition on the host
    SUPERPOSITION_HOST_URL="http://localhost:8080/health" # Using the API endpoint the init script will use
    echo "Waiting for Superposition to be responsive on $SUPERPOSITION_HOST_URL..."
    MAX_WAIT_RETRIES=90 # Approx 3 minutes
    CURRENT_RETRY=0
    until curl -s -o /dev/null -w "%{http_code}" "$SUPERPOSITION_HOST_URL" | grep -E "200|401|403|404" > /dev/null || [ $CURRENT_RETRY -ge $MAX_WAIT_RETRIES ]; do
        CURRENT_RETRY=$((CURRENT_RETRY + 1))
        printf "Attempt $CURRENT_RETRY/$MAX_WAIT_RETRIES: Superposition not yet responsive at $SUPERPOSITION_HOST_URL. Waiting 10s...\n"
        sleep 10
    done

    if [ $CURRENT_RETRY -ge $MAX_WAIT_RETRIES ]; then
        echo "ERROR: Superposition did not become responsive on $SUPERPOSITION_HOST_URL after $MAX_WAIT_RETRIES attempts."
        echo "Please check '$SUPERPOSITION_DIR/superposition.log' and ensure Superposition is running correctly on localhost:8080."
        exit 1
    fi
    echo "Superposition is responsive on $SUPERPOSITION_HOST_URL."
    # --- Superposition should now be running on host ---

    echo "Starting keycloak-db and keycloak..."
    docker compose up -d $BUILD_FLAG keycloak-db keycloak
    
    echo "Starting localstack..."
    docker compose up -d $BUILD_FLAG localstack
    
    # Sleep to give localstack time to initialize. Consider using healthchecks in compose file.
    echo "Waiting 20 seconds for main localstack to initialize..."
    sleep 20 # This was in your original script

    echo "Running keycloak-init..."
    docker compose run --rm keycloak-init # Will build if --build was passed to 'up' and image is out of date, or if not built yet
    
    echo "Running localstack-init..."
    docker compose run --rm localstack-init
    
    

    echo "Contents of .env.encrypted just before backend starts:"
    # Ensure this file path is correct relative to where run.sh is executed
    if [ -f "./scripts/.env.encrypted" ]; then
        cat ./scripts/.env.encrypted
    else
        echo "./scripts/.env.encrypted not found or path is incorrect."
    fi
    
    echo "Starting remaining services (including backend)..."
    if [ "$MODE" = "dev" ]; then
        # 'docker compose watch' will start services defined with 'develop' section
        # and other services if they are not already up.
        docker compose watch
    else
        # This will start all services in docker-compose.yml not yet running (e.g., backend)
        docker compose up $BUILD_FLAG $DETACH_FLAG
    fi
else
    echo "Usage: ./run.sh [dev|prod] [build|nobuild] [detach|nodetach]"
    exit 1
fi
