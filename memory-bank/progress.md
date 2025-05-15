# Progress

## What Works

*   (To be filled as project features are implemented and tested)
*   Local development environment setup using Docker Compose (`run.sh`).
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
*   (Other specific project features based on `projectbrief.md`)

## Current Status

*   Core backend infrastructure and service integrations (Keycloak, Superposition, S3, PostgreSQL) are established.
*   **Recent Major Refactor (May 2025):** The handling of Superposition organizations within the Hyper OTA server has been significantly changed. The server no longer manages its own `OrgEnty` table for Superposition orgs. Instead, it will rely on a Superposition organization ID dynamically obtained via an API call during Docker setup and passed via an environment variable. This simplifies the Hyper OTA server's data model. The `OrgEnty` struct and related DB table have been removed from the Hyper OTA server codebase.
*   Development is ongoing for API endpoint implementation and frontend.

## Known Issues & Bugs

*   (To be filled as issues are identified)
*   The `server/superposition/docker-compose/postgres/db_init.sql` script is quite large and contains schema definitions for multiple workspaces (`localorg_test`, `localorg_dev`). This is Superposition's own setup and was not modified as per the latest plan.

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

## Future Considerations / Roadmap

*   (To be filled based on `projectbrief.md` and further planning)
