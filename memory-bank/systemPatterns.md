# System Patterns

## System Architecture Overview

*   The Hyper OTA server integrates with Keycloak for authentication/authorization and Superposition for configuration management and experimentation.
*   It exposes APIs for managing users, organizations (Keycloak groups), applications, packages, and releases.
*   Frontend dashboard interacts with these APIs.
*   S3 is used for storing package assets.
*   Database (PostgreSQL) is used by Hyper OTA for its own metadata (packages, configs, releases, cleanup_outbox) and by Superposition for its data.

    ```mermaid
    graph TD
        UserFE[User via Browser] --> FrontendDevServer[Frontend Dev Server (Vite - Docker Port 5173)]
        FrontendDevServer -.-> HyperOTAServerAPI   HyperOTAServerAPI[Hyper OTA Server API (Backend Service Port 9000)]
        UserSDK[User/Client SDK] --> HyperOTAServerAPI

        subgraph Docker Network
            FrontendDevServer
            HyperOTAServerAPI
            Keycloak[(Keycloak - Docker)]
            HyperOTADb[(Hyper OTA DB - PostgreSQL - Docker)]
        end
        
        HyperOTAServerAPI --> Keycloak
        HyperOTAServerAPI --> Superposition[(Superposition API - External or Docker)]
        HyperOTAServerAPI --> HyperOTADb
        HyperOTAServerAPI --> S3[(AWS S3 - LocalStack/AWS)]
        Superposition ---> SuperpositionDb[(Superposition DB - PostgreSQL)]

        note for FrontendDevServer "Serves UI, HMR. Proxies API calls to Backend Service"
    ```

## Key Technical Decisions
        HyperOTAServer --> Superposition[(Superposition API - External or Docker)]
        HyperOTAServer --> HyperOTADb[(Hyper OTA DB - PostgreSQL - Docker)]
        HyperOTAServer --> S3[(AWS S3 - LocalStack/AWS)]
        Superposition ---> SuperpositionDb[(Superposition DB - PostgreSQL)]
    ```

## Key Technical Decisions

*   **Rust with Actix Web:** For building a performant and robust backend API.
*   **Diesel ORM:** For database interactions with PostgreSQL.
*   **Keycloak Integration:** For centralized identity and access management.
*   **Superposition Integration:** For dynamic configuration and experimentation.
    *   **Recent Change (May 2025):** Shifted from Hyper OTA server managing its own representation of Superposition organizations (`OrgEnty` table) to using a single Superposition organization whose ID is dynamically obtained at Docker startup. An initialization script calls the Superposition API to create a default organization (e.g., "DefaultHyperOTAOrg") and retrieves its generated ID. This ID is then provided to the Hyper OTA server via the `SUPERPOSITION_ORG_ID` environment variable. This simplifies the Hyper OTA server's data model and delegates organization source-of-truth and creation to Superposition's API, while not modifying Superposition's own `db_init.sql`.
*   **Docker & Docker Compose:** For containerization and local development setup.
    *   Includes initialization scripts for service dependencies (Keycloak, Superposition org).
    *   **New (May 2025):** Dedicated `frontend` service for running the Vite development server with hot-reloading.
*   **AWS S3:** For storing release package assets.
*   **AWS KMS:** For encrypting secrets.

## Design Patterns in Use

*   **RESTful API Design:** For client-server communication.
*   **Middleware:** Actix Web middleware is used for authentication (`Auth`) and logging.
*   **Transaction Management:** A custom `TransactionManager` is used to handle distributed operations across Keycloak. Its role in Superposition interaction for org creation is removed, but it's still relevant for other operations like application workspace creation within the designated Superposition org.
*   **Repository Pattern (implied):** Database interactions are generally encapsulated within specific modules/functions.
*   **Environment Configuration:** Application settings are managed via environment variables (loaded from `.env` and potentially KMS), including the dynamically sourced `SUPERPOSITION_ORG_ID`.
*   **Initialization Container Pattern:** A script/container will be used during `docker-compose up` to provision the Superposition organization via API before the main backend starts.

## Component Relationships

*   **Hyper OTA Server:** The core backend.
    *   `main.rs`: Sets up services, environment (including `SUPERPOSITION_ORG_ID`), and HTTP server.
    *   `organisation` module: Handles logic related to Keycloak groups (representing organizations) and applications (workspaces in Superposition).
        *   `transaction.rs`: Manages creation/deletion of Keycloak groups. No longer creates Superposition orgs or local `OrgEnty`.
        *   `application/mod.rs`: Manages application (workspace) creation in Superposition, using the `SUPERPOSITION_ORG_ID` from `AppState`.
    *   `release` module: Serves release configurations, fetching data from Superposition (using `SUPERPOSITION_ORG_ID`) and local DB (packages, configs).
    *   (Other modules as before)
*   **Frontend Service (`dashboard_react`):**
    *   Runs in a separate Docker container using a Node.js 20 image.
    *   Serves the React application using Vite dev server (port 5173).
    *   Configured for hot module replacement (HMR) and live updates.
    *   **Configured with Vite proxy** to forward API requests (e.g., `/organisations`, `/user`) to the `backend:9000` service, allowing frontend to use relative API paths.
    *   Source code is volume-mounted from the host.
    *   Uses `CHOKIDAR_USEPOLLING=true` for reliable file watching.
*   **Superposition Service:** External service. Its `/organisations` API is called by an init script during Docker setup.
*   (Other components as before)

## Critical Implementation Paths

*   **Docker Compose Startup:**
    1.  Superposition service starts.
    2.  A new `superposition-org-init` service runs a script.
    3.  The script calls `POST /superposition/organisations` on the Superposition service to create "DefaultHyperOTAOrg".
    4.  The script extracts the returned organization ID and makes it available as `SUPERPOSITION_ORG_ID` to the Hyper OTA backend.
    5.  Hyper OTA backend service starts and uses this ID.
    6.  Frontend service (`frontend`) starts, running the Vite dev server.
*   **User Authentication:** Via Keycloak, handled by `Auth` middleware (for backend APIs). Frontend interacts with Keycloak for login flows.
*   **Organization/Application Setup (Keycloak Groups & Superposition Workspaces):**
    1.  User requests creation of an "organization" (which now primarily means Keycloak groups).
    2.  `organisation::transaction::create_organisation_with_transaction` creates Keycloak groups.
    3.  User requests creation of an "application" under an organization.
    4.  `organisation::application::add_application` creates a Keycloak subgroup for the application and then creates a corresponding workspace in Superposition under the organization identified by `SUPERPOSITION_ORG_ID`.
*   **Serving Release Configuration:**
    1.  Client requests release for an org/app.
    2.  `release::serve_release` or `serve_release_v2` is called.
    3.  Resolved configuration is fetched from Superposition using the `SUPERPOSITION_ORG_ID` and application name.
    4.  Package data is fetched from Hyper OTA DB.
    5.  Combined release information is returned.

## Data Models

*   **Hyper OTA Server Database:**
    *   `packages`, `configs`, `releases`, `cleanup_outbox` (as before).
    *   ~~`organisations`~~: (REMOVED).
*   **Superposition Database:**
    *   `superposition.organisations`: Stores organization details. Will include "DefaultHyperOTAOrg" created via API call by the init script, and "localorg" from its `db_init.sql`.
    *   (Other tables as before, with schemas created for "DefaultHyperOTAOrg"'s workspaces).
*   **Keycloak:** (As before).
