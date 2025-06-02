# Tech Context

## Technologies Used

*   **Programming Languages:** Rust (backend), TypeScript/JavaScript (frontend dashboard_react), Shell (init scripts).
*   **Frameworks & Libraries:**
    *   Backend: Actix Web, Diesel (ORM), Serde (serialization/deserialization), Tokio (async runtime).
    *   Frontend: React (via Vite).
    *   Superposition SDK: `superposition_rust_sdk`.
    *   Keycloak Client: `keycloak` crate.
    *   AWS SDKs: `aws-sdk-s3`, `aws-sdk-kms`, `aws-config`.
    *   Scripting: `curl`, `jq` (for init scripts).
*   **Databases:** PostgreSQL (for Hyper OTA server, Keycloak, and Superposition).
*   **Infrastructure & Cloud Services:**
    *   Docker, Docker Compose (for local development and containerization).
    *   AWS S3 (for package storage).
    *   AWS KMS (for secret encryption).
    *   LocalStack (for local AWS service emulation).
*   **Build Tools:** Cargo (Rust), npm (Node.js/frontend).
*   **Version Control:** Git.
*   **Testing Tools:** (Details to be filled as project evolves - e.g., Rust's built-in testing, potentially others).
*   **Other Key Tools:**
    *   `dotenvy` for environment variable loading.
    *   `log` crate for logging.

## Development Setup

*   **Prerequisites:**
    *   Rust (latest stable recommended).
    *   Node.js (e.g., v20 or later for frontend, as used in `frontend` Docker service).
    *   Docker Desktop (or Docker engine + Docker Compose).
    *   Diesel CLI (`cargo install diesel_cli --no-default-features --features postgres`).
    *   AWS CLI (optional, for interacting with LocalStack directly).
    *   `jq` (for `keycloak.sh` and the new `init-superposition-org.sh` script).
    *   `curl` (for the new `init-superposition-org.sh` script).
*   **Environment Variables:**
    *   Refer to `server/.env.example` and `server/superposition/.env.example` for base variables.
    *   Key variables for Hyper OTA server (`server/scripts/.env` or `server/scripts/.env.encrypted` after KMS encryption):
        *   `DATABASE_URL`: Connection string for Hyper OTA's PostgreSQL.
        *   `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_SECRET`, `KEYCLOAK_PUBLIC_KEY`.
        *   `SUPERPOSITION_URL`: URL for the Superposition service (e.g., `http://superposition:8080` from within Docker network).
        *   `SUPERPOSITION_ORG_ID`: **(New)** ID of the Superposition organization. This will be *dynamically populated* by an initialization script (e.g., `init-superposition-org.sh`) that calls the Superposition API at startup.
        *   `SUPERPOSITION_DEFAULT_ORG_NAME`: (New - for init script) Name of the default organization to create in Superposition if it doesn't exist (e.g., "DefaultHyperOTAOrg").
        *   `AWS_BUCKET`, `AWS_ENDPOINT_URL` (for LocalStack), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`.
        *   `PUBLIC_ENDPOINT`: Publicly accessible base URL for assets.
    *   Secrets like `KEYCLOAK_SECRET` and `DB_PASSWORD` (within `DATABASE_URL`) are intended to be encrypted via AWS KMS and stored in `.env.encrypted`. The `server/scripts/encrypt_env.sh` script handles this.
*   **Setup Steps:**
    1.  Clone the repository.
    2.  Ensure the `server/superposition` submodule/directory is populated.
    3.  Navigate to the `server` directory.
    4.  Run `sh run.sh dev build` (or `sh run.sh dev nobuild`). This script will be updated to:
        *   Stop existing services.
        *   Start Superposition service.
        *   Start Keycloak, PostgreSQL for Keycloak, and LocalStack.
        *   Run `keycloak-init` service.
        *   **(New)** Run a `superposition-org-init` service which executes a script (`init-superposition-org.sh`) to:
            *   Check if an organization named `SUPERPOSITION_DEFAULT_ORG_NAME` exists in Superposition via API.
            *   If not, create it via API.
            *   Retrieve its ID.
            *   Make this ID available as `SUPERPOSITION_ORG_ID` (e.g., write to a shared `.env` file).
        *   Run `localstack-init` service.
        *   Start the Hyper OTA backend service, which will now read the `SUPERPOSITION_ORG_ID`.
        *   **(New)** Start the `frontend` service (using Node 20):
            *   Runs `npm install && npm run dev` for `dashboard_react`.
            *   `CHOKIDAR_USEPOLLING=true` is set for file watching.
            *   Vite is configured with `server.proxy` to forward API calls to the `backend` service.
    *   The Hyper OTA server's database migrations (including `20250520181200_drop_organisations_table`) are applied.
*   **Common Issues & Troubleshooting:**
    *   (As before)
    *   The `superposition-org-init` script failing: Check `curl` commands, JSON parsing with `jq`, Superposition API availability and authentication (though likely none needed for internal calls).
    *   Frontend HMR not working:
        *   Verify `server.host`, `server.hmr`, and `server.proxy` settings in `vite.config.ts`.
        *   Ensure `server.watch.usePolling: true` in `vite.config.ts` and/or `CHOKIDAR_USEPOLLING=true` in `docker-compose.yml` for the `frontend` service are active.
        *   Check Docker port mappings for the `frontend` service (e.g., `5173:5173`).
        *   Confirm no firewall is blocking connections to the Vite dev server port (5173).
        *   Inspect browser console for HMR connection errors (e.g., WebSocket connection failures).
        *   Verify API calls from frontend (served on 5173) are correctly proxied by Vite to the backend (service `backend`, port 9000).
    *   `EBADENGINE` warnings from npm: Ensure the Node.js version in the `frontend` Docker service matches dependency requirements (currently Node 20).

## Technical Constraints

*   (As before)

## Dependencies

*   (As before)

## Tool Usage Patterns

*   (As before)
