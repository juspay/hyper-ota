# Progress

## What Works

*   (To be filled as project features are implemented and tested)
*   Local development environment setup using Docker Compose (`run.sh`):
    *   Backend services (Rust API, Keycloak, PostgreSQL, LocalStack).
    *   **New (May 2025):** Frontend service (`dashboard_react` with Vite using Node 20) configured for hot-reloading, including API proxying to the backend.
*   Keycloak integration for authentication.
*   Superposition integration for configuration management.
*   Basic API structure for organisations (Keycloak groups), applications (Superposition workspaces), packages, and releases.
*   S3 integration for package storage.
*   KMS for secret encryption.
*   Transaction management framework for some operations.

## What's Left to Build

*   Complete implementation of all API endpoints for CRUD operations on all entities.
*   Frontend dashboard (`dashboard_react`) development and integration.
*   Thorough testing (unit, integration, e2e).
*   Detailed error handling and logging across the application.
*   CI/CD pipeline.
*   Implementation of the Docker-time script (`init-superposition-org.sh`) to create the default Superposition organization via API and populate the `SUPERPOSITION_ORG_ID` environment variable for the backend.
*   Update `docker-compose.yml` to run this new init script and manage its output for the backend service.
*   **Fix Superposition's `workspace_template.sql` (2025-05-30):** Modify `server/superposition/workspace_template.sql` to ensure the `experiment_type` column (and other potentially missing columns like `description`, `change_reason`, `metrics`, `started_at`, `started_by`) are correctly and robustly added to the `experiments` table for dynamically created workspaces. This preferably involves adding them directly to the initial `CREATE TABLE` statement.
*   (Other specific project features based on `projectbrief.md`)

## Current Status

*   Core backend infrastructure and service integrations (Keycloak, Superposition, S3, PostgreSQL) are established.
*   **Recent Major Refactor (May 2025):** The handling of Superposition organizations within the Hyper OTA server has been significantly changed. The server no longer manages its own `OrgEnty` table for Superposition orgs. Instead, it will rely on a Superposition organization ID dynamically obtained via an API call during Docker setup and passed via an environment variable. This simplifies the Hyper OTA server's data model. The `OrgEnty` struct and related DB table have been removed from the Hyper OTA server codebase.
*   Development is ongoing for API endpoint implementation and frontend.
*   **Frontend Hot Reloading (May 2025):** The `dashboard_react` frontend, when run via Docker, now supports hot reloading due to a new dedicated `frontend` service in `docker-compose.yml` and updated Vite configuration.

## Known Issues & Bugs

*   (To be filled as issues are identified)
*   The `server/superposition/docker-compose/postgres/db_init.sql` script is quite large and contains schema definitions for multiple workspaces (`localorg_test`, `localorg_dev`). This is Superposition's own setup and was not modified as per the latest plan.
*   **Missing `experiment_type` column in Superposition (2025-05-30):** Dynamically created Superposition workspace schemas (e.g., for `orgid173658260243484677_hyperpay`) are missing the `experiment_type` column in their `experiments` table. This is caused by an issue in `server/superposition/workspace_template.sql`, where the final `DO ... END` block responsible for adding this column doesn't execute correctly in the Dockerized environment. The `localorg_test.experiments` table (initialized by `db_init.sql`) also showed this column missing in the current environment, indicating a potential systemic issue with this specific schema modification. A temporary fix was applied via direct `psql` commands to add the column to affected schemas. The permanent fix involves correcting `workspace_template.sql`.

## Evolution of Project Decisions

*   **Date:** 2025-05-20
    *   **Decision:** Removed the `OrgEnty` struct and the corresponding `organisations` table from the Hyper OTA server's database. The server will now use a Superposition organization ID identified by the `SUPERPOSITION_ORG_ID` environment variable. This ID will be dynamically obtained by an initialization script that calls the Superposition API during Docker compose startup to create a default organization (e.g., "DefaultHyperOTAOrg"). Superposition's own `db_init.sql` will not be modified to pre-seed this organization.
    *   **Reason:** To simplify the Hyper OTA server's data model and delegate the source of truth and creation of the Superposition organization to Superposition's API, while respecting the constraint not to modify Superposition's internal database schema directly for this purpose.
    *   **Impact:**
        *   Simplified database schema for Hyper OTA server (local `organisations` table dropped).
        *   Code refactoring in several modules (`organisation/transaction.rs`, `organisation/application/mod.rs`, `release/mod.rs`, `main.rs`, `types/mod.rs`, `utils/db/models.rs`, `utils/db/schema.rs`) to remove dependencies on `OrgEnty` and use the environment variable for the Superposition org ID.
        *   `server/docker-compose.yml` will be updated to include an init service for creating the Superposition org and populating `SUPERPOSITION_ORG_ID`.
        *   `server/superposition/docker-compose/postgres/db_init.sql` was reverted to its original state (not pre-seeding the "123" org).
        *   The Hyper OTA server will operate within the context of this dynamically provisioned Superposition organization.
*   **Date:** 2025-05-30
    *   **Decision:** Configured frontend (`dashboard_react`) for hot reloading within Docker.
    *   **Reason:** To improve developer experience by allowing frontend changes to be reflected live in the browser without manual Docker service restarts.
    *   **Impact:**
        *   Added a new `frontend` service to `server/docker-compose.yml` (using `node:20-alpine` and `CHOKIDAR_USEPOLLING=true`) to run the Vite dev server.
        *   Updated `server/dashboard_react/vite.config.ts` with `server.host`, `server.hmr`, `server.watch.usePolling`, and `server.proxy` options suitable for Docker development (proxying API calls to `backend:9000`).
        *   Removed the incorrect `develop.watch` configuration for `dashboard_react` from the `backend` service in `server/docker-compose.yml`.

## Future Considerations / Roadmap

*   (To be filled based on `projectbrief.md` and further planning)
