# Active Context

## Current Focus

*   Refactor the Hyper OTA server to remove the `OrgEnty` struct and its associated database table (`organisations`).
*   Modify the server to use a Superposition organization ID obtained by an API call during Docker setup, instead of creating organizations at runtime within Hyper OTA or relying on a pre-seeded ID in Superposition's `db_init.sql`.
*   Ensure all parts of the application that previously relied on `OrgEnty` now use this dynamically obtained Superposition organization ID from an environment variable.

## Recent Changes

*   **`server/docker-compose.yml`**:
    *   Added `SUPERPOSITION_ORG_ID` environment variable to the `backend` service (its value will be populated by a new init script).
    *   *(Correction: The value is not hardcoded to "123" anymore in the compose file directly, it will be sourced from the init script's output).*
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
*   Update the remaining Memory Bank files (`systemPatterns.md`, `techContext.md`, `progress.md`) to reflect this API-call-based approach.
*   Verify all linter errors are resolved after these new changes.
*   Present the completion of the task.

## Active Decisions & Considerations

*   The Hyper OTA server will operate under a single Superposition organization, whose ID is determined at Docker compose startup time by calling the Superposition API.
*   Superposition's own `db_init.sql` will not be modified.
*   Authentication for the API call from the init script to Superposition needs to be handled (likely no explicit auth needed if called from within the Docker network, as tested with `curl`).

## Important Patterns & Preferences

*   Dynamic provisioning of necessary external resources (like the Superposition org) during service setup.
*   Configuration-driven behavior: The Superposition organization ID is sourced via an environment variable, populated by an init script.

## Learnings & Insights

*   Initial assumptions about pre-seeding data directly into a dependent service's database might not always be feasible or the best approach; using the service's own API for setup is often cleaner.
*   Clear communication on constraints (like not changing Superposition's `db_init.sql`) is crucial.
