# Active Context

## Current Focus

*   Refactor the Hyper OTA server to remove the `OrgEnty` struct and its associated database table (`organisations`).
*   Modify the server to use a Superposition organization ID obtained by an API call during Docker setup, instead of creating organizations at runtime within Hyper OTA or relying on a pre-seeded ID in Superposition's `db_init.sql`.
*   Ensure all parts of the application that previously relied on `OrgEnty` now use this dynamically obtained Superposition organization ID from an environment variable.
*   **Enable Frontend Hot Reloading in Docker:** Configured Vite and Docker Compose to allow live updates to the `dashboard_react` frontend without manual restarts when running in Docker.

## Recent Changes

*   **`server/docker-compose.yml`**:
    *   Added `SUPERPOSITION_ORG_ID` environment variable to the `backend` service (its value will be populated by a new init script).
    *   *(Correction: The value is not hardcoded to "123" anymore in the compose file directly, it will be sourced from the init script's output).*
    *   **`frontend` service updates (2025-05-30):**
        *   Changed base image to `node:20-alpine` (from `node:18-alpine`).
        *   Added `CHOKIDAR_USEPOLLING: "true"` environment variable.
    *   Added a new `frontend` service to run the Vite development server (initial setup).
    *   Configured volume mounts for `dashboard_react` source code and `node_modules` (initial setup).
    *   Removed the `develop.watch` configuration for `dashboard_react` from the `backend` service (initial setup).
*   **`server/dashboard_react/vite.config.ts` (Updated - 2025-05-30):**
    *   Updated `server` configuration:
        *   `host: '0.0.0.0'` to allow external connections.
        *   `port: 5173` (default Vite port).
        *   `hmr` (Hot Module Replacement) settings configured for Docker (protocol `ws`, host `localhost`, port `5173`).
        *   `watch.usePolling: true` for reliable file change detection in Docker.
        *   **Added `proxy` configuration** to forward API requests (e.g., `/organisations`, `/user`, `/release`) to the `backend:9000` service.
*   **`server/migrations`**: Created a new migration `20250520181200_drop_organisations_table` to remove the `organisations` table from the Hyper OTA server's database. (This change remains valid).
*   **`server/src/utils/db/models.rs`**: Removed the `OrgEnty` struct definition and its import from `schema.rs`. (This change remains valid).
*   **`server/src/utils/db/schema.rs`**: Removed the `organisations` table definition and its inclusion in `allow_tables_to_appear_in_same_query!`. (This change remains valid).
*   **`server/src/organisation/transaction.rs`**:
    *   Removed logic for creating organizations in Superposition via SDK.
    *   Removed logic for inserting/deleting `OrgEnty` from the local database.
    *   Removed direct dependencies on `OrgEnty` and the `organisations` table schema. (These changes remain valid).
*   **`server/src/utils/transaction_manager.rs`**: Removed unused import of `OrgEnty`. (This change remains valid).
*   **`server/src/types/mod.rs`**: Added `superposition_org_id: String` field to the `Environment` struct. (This change remains valid).
*   **`server/src/main.rs`**:
    *   Modified to read the `SUPERPOSITION_ORG_ID` environment variable.
    *   Populates the `superposition_org_id` field in the `Environment` struct instance. (This change remains valid).
*   **`server/src/organisation/application/mod.rs`**, **`server/src/organisation/application/package/mod.rs`**, **`server/src/release/mod.rs`**:
    *   Updated to use `state.env.superposition_org_id` when interacting with the Superposition SDK, instead of fetching from a local `OrgEnty`. (These changes remain valid).
*   **`server/src/organisation/application/config/mod.rs`**:
    *   Removed unused imports of `OrgEnty` and `organisations::dsl::*`. (This change remains valid).
*   **`server/superposition/docker-compose/postgres/db_init.sql`**:
    *   **Reverted** previous modifications. This file will **not** be changed to pre-seed the "123" organization. It will remain in its original state (likely only creating "localorg").

## Next Steps

*   **Define and implement an initialization script** (e.g., `server/scripts/init-superposition-org.sh`) that:
    *   Calls the Superposition API (`POST /superposition/organisations`) to create a default organization (e.g., "DefaultHyperOTAOrg").
    *   Retrieves the generated ID of this new organization.
    *   Makes this ID available to the Hyper OTA `backend` service (e.g., by writing to an `.env` file that the backend service sources).
*   **Update `server/docker-compose.yml`** to:
    *   Include a new service that runs the `init-superposition-org.sh` script.
    *   Ensure the `backend` service depends on this new init service.
    *   Ensure the `SUPERPOSITION_ORG_ID` for the `backend` is correctly populated from the init script's output.
*   Update the remaining Memory Bank files (`systemPatterns.md`, `techContext.md`, `progress.md`) to reflect this API-call-based approach and the new frontend Docker setup.
*   **Diagnose and fix Superposition schema issue:** The `experiment_type` column is missing from the `experiments` table in dynamically created Superposition workspace schemas (e.g., `orgid173658260243484677_hyperpay`). This is due to an issue in `server/superposition/workspace_template.sql` where the final `DO ... END` block that adds this column is not executing correctly.
    *   **Permanent Fix:** Modify `server/superposition/workspace_template.sql` to include `experiment_type` and other relevant columns directly in the main `CREATE TABLE experiments` statement. Ensure `public.experiment_type` ENUM creation is robust and happens before table creation.
    *   **(Temporary Fix Applied Manually via PSQL on 2025-05-30):** Manually added `experiment_type` column to affected schemas (`orgid173658260243484677_hyperpay`, `localorg_test`, `localorg_dev`) to unblock API calls. This needs to be made permanent by fixing the template.
*   Verify all linter errors are resolved after these new changes.
*   Present the completion of the task.

## Active Decisions & Considerations

*   The Hyper OTA server will operate under a single Superposition organization, whose ID is determined at Docker compose startup time by calling the Superposition API.
*   Superposition's own `db_init.sql` will not be modified.
*   Authentication for the API call from the init script to Superposition needs to be handled (likely no explicit auth needed if called from within the Docker network, as tested with `curl`).

## Important Patterns & Preferences

*   Dynamic provisioning of necessary external resources (like the Superposition org) during service setup.
*   Configuration-driven behavior: The Superposition organization ID is sourced via an environment variable, populated by an init script.
*   Frontend Development in Docker:
    *   Requires a dedicated service for the dev server (e.g., Vite).
    *   Proper volume mounting for source code is essential.
    *   Specific HMR/server configurations in tools like Vite (`host`, `hmr`, `watch.usePolling`) are needed.
    *   **Vite proxy** is useful for routing API calls from the Vite dev server to a separate backend service during development, allowing frontend code to use relative API paths.
    *   Using compatible Node.js versions (e.g., via `node:<version>-alpine` Docker image) for frontend tools and dependencies is important to avoid `EBADENGINE` errors.
    *   Environment variables like `CHOKIDAR_USEPOLLING=true` can enhance file watching reliability in some Docker setups.

## Learnings & Insights

*   Initial assumptions about pre-seeding data directly into a dependent service's database might not always be feasible or the best approach; using the service's own API for setup is often cleaner.
*   Clear communication on constraints (like not changing Superposition's `db_init.sql`) is crucial.
*   **Discrepancy in Schema Initialization (2025-05-30):** Superposition's method for initializing schemas for dynamically created workspaces (via `workspace_template.sql`) can lead to different results than its main `db_init.sql` (used for initial DB setup and predefined workspaces). In this case, `workspace_template.sql` failed to add the `experiment_type` column to the `experiments` table, likely due to an issue with a `DO ... END` block or the handling of the `public.experiment_type` ENUM. This was not an issue in pre-Docker environments, suggesting environmental factors (PostgreSQL version, user permissions, ENUM state) in Docker might affect the execution of complex SQL batch scripts.
*   **Robust Schema Templates:** For dynamic schema generation from templates, it's more robust to include all columns in the initial `CREATE TABLE` statements rather than relying on a series of subsequent `ALTER TABLE` commands, especially if those `ALTER` commands are conditional or within complex blocks.
