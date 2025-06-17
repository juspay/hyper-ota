# Airborne Server

The Airborne Server is a robust backend system designed to power the Software-as-a-Service (SaaS) offering of the Airborne SDK. It provides comprehensive management capabilities for users, organizations, applications, software packages, configurations, and release cycles, enabling seamless and controlled Over-The-Air (OTA) updates for client applications.

## Key Features

*   **Multi-Tenant Architecture:** Securely manage multiple organizations and their respective applications.
*   **Granular Access Control:** Leverages Keycloak for fine-grained user permissions and roles.
*   **Flexible Package Management:** Supports versioning and distribution of application packages.
*   **Dynamic Configuration:** Manage application configurations and release-specific settings.
*   **Controlled Releases:** Facilitates staged rollouts and management of application releases.
*   **Transactional Integrity:** Ensures consistency across distributed operations involving Keycloak, Superposition, and S3.
*   **Admin Dashboard:** A React-based user interface for server administration and monitoring.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [User Management](#user-management)
  - [Organization Management](#organization-management)
  - [Application Management](#application-management)
  - [Package Management](#package-management)
  - [Configuration Management](#configuration-management)
  - [Release Management (Application Level)](#release-management-application-level)
  - [Public Release Endpoints](#public-release-endpoints)
  - [Dashboard Access](#dashboard-access)
- [Database Architecture](#database-architecture)
- [Keycloak Integration](#keycloak-integration)
- [Development Environment](#development-environment)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Database Migrations](#database-migrations)
  - [Running the Server](#running-the-server)
  - [Services Started](#services-started)
  - [Development Workflow](#development-workflow)
- [Contributing](#contributing)
- [License](#license)

## Overview

The Airborne Server acts as the central nervous system for delivering updates to applications. It handles the complexities of storing package assets (via AWS S3), managing configurations (via Superposition and its internal database), and authenticating/authorizing users (via Keycloak). This allows development teams to focus on building features while relying on a stable platform for update distribution.

## API Reference

All API endpoints are versioned and adhere to RESTful principles. Authentication is primarily handled through JWT Bearer tokens issued by Keycloak. Specific permissions are required for various operations, as detailed below.
The base path for all API routes is implicitly defined by the Actix web server configuration in `main.rs`.

### Authentication
Authentication is managed via Keycloak. Most endpoints require a valid JWT Bearer token.

### User Management
Base Path: `/users` (for creation/login), `/user` (for fetching authenticated user details)

*   **`POST /users/create`**: Registers a new user.
    *   **Request Body**: `application/json` - `{ "name": "username", "password": "userpassword" }`
    *   **Response**: `application/json` - User details including a JWT token.
*   **`POST /users/login`**: Authenticates an existing user.
    *   **Request Body**: `application/json` - `{ "name": "username", "password": "userpassword" }`
    *   **Response**: `application/json` - User details including a JWT token.
*   **`GET /user`**: Retrieves details for the currently authenticated user, including their organizational affiliations.
    *   **Authentication**: Required.
    *   **Response**: `application/json` - User profile and organization data.

### Organization Management
Base Path: `/organisations`

*   **`POST /organisations/create`**: Establishes a new organization.
    *   **Authentication**: Required.
    *   **Request Body**: `application/json` - `{ "name": "organisation_name" }`
    *   **Response**: `application/json` - Details of the newly created organization.
*   **`DELETE /organisations/{org_name}`**: Removes an existing organization.
    *   **Authentication**: Required (Owner/Admin permissions for the organization).
    *   **Path Parameter**: `org_name` (string) - The name of the organization to delete.
    *   **Response**: `application/json` - Success confirmation.
*   **`GET /organisations`**: Lists all organizations accessible to the authenticated user.
    *   **Authentication**: Required.
    *   **Response**: `application/json` - Array of organization objects.

#### Organization User Management
Base Path: `/organisation/user` (Operations are scoped to the organization context derived from the user's token)

*   **`POST /organisation/user/create`**: Adds a user to the current organization with a specified access role.
    *   **Authentication**: Required (Write permissions for the organization).
    *   **Request Body**: `application/json` - `{ "user": "username", "access": "read|write|admin|owner" }`
    *   **Response**: `application/json` - Success confirmation.
*   **`POST /organisation/user/update`**: Modifies a user's access role within the current organization.
    *   **Authentication**: Required (Admin permissions for the organization).
    *   **Request Body**: `application/json` - `{ "user": "username", "access": "read|write|admin|owner" }`
    *   **Response**: `application/json` - Success confirmation.
*   **`POST /organisation/user/remove`**: Removes a user from the current organization.
    *   **Authentication**: Required (Admin permissions for the organization).
    *   **Request Body**: `application/json` - `{ "user": "username" }`
    *   **Response**: `application/json` - Success confirmation.
*   **`GET /organisation/user/list`**: Retrieves a list of all users within the current organization, including their roles.
    *   **Authentication**: Required (Read permissions for the organization).
    *   **Response**: `application/json` - Array of user information objects.

### Application Management
Base Path: `/organisations/applications` (Scoped to the organization context from the user's token)

*   **`POST /organisations/applications/create`**: Creates a new application within the current organization.
    *   **Authentication**: Required (Write permissions for the organization).
    *   **Request Body**: `application/json` - `{ "application": "application_name" }`
    *   **Response**: `application/json` - Details of the newly created application.

### Package Management
Base Path: `/organisations/applications/package` (Scoped to the organization and application context from the user's token)

*   **`GET /organisations/applications/package`**: Lists all software packages for the current application.
    *   **Authentication**: Required (Read permissions for the application).
    *   **Response**: `application/json` - Array of package detail objects.
*   **`POST /organisations/applications/package/create_json`**: Creates a new package version using a comprehensive JSON manifest.
    *   **Authentication**: Required (Write permissions for the application).
    *   **Request Body**: `application/json` - Detailed JSON structure defining package configuration and manifest.
    *   **Response**: `application/json` - `{ "version": new_package_version }`.
*   **`POST /organisations/applications/package/create_package_json_v1`**: Creates a new package version using a V1 JSON structure.
    *   **Authentication**: Required (Write permissions for the application).
    *   **Request Body**: `application/json` - JSON defining package information and associated resources.
    *   **Response**: `application/json` - `{ "version": new_package_version }`.
*   **`POST /organisations/applications/package/create_json_v1_multipart`**: Creates a new package version using a V1 JSON structure, supporting an optional index file upload via multipart/form-data.
    *   **Authentication**: Required (Write permissions for the application).
    *   **Request Body**: `multipart/form-data`
        *   `json` (Text): JSON string containing package details.
        *   `index` (File, Optional): The main index file for the package.
    *   **Response**: `application/json` - `{ "version": new_package_version }`.

### Configuration Management
Base Path: `/organisations/applications/config` (Scoped to the organization and application context from the user's token)

*   **`POST /organisations/applications/config/create_json_v1`**: Creates a new configuration associated with the latest package version.
    *   **Authentication**: Required (Write permissions for the application).
    *   **Request Body**: `application/json` - JSON defining configuration version, timeouts, and properties.
    *   **Response**: `application/json` - `{ "version": package_version, "config_version": "config_version_string" }`.
*   **`POST /organisations/applications/config/create_json_v1/multipart`**: Creates a new configuration via multipart/form-data (primarily for JSON payload).
    *   **Authentication**: Required (Write permissions for the application).
    *   **Request Body**: `multipart/form-data` - `json` (Text): JSON string for the configuration.
    *   **Response**: `application/json` - `{ "version": package_version, "config_version": "config_version_string" }`.

### Release Management (Application Level)
Base Path: `/organisations/applications/release` (Scoped to the organization and application context from the user's token)

*   **`POST /organisations/applications/release/create`**: Initiates a new release for an application, linking a package version with its configuration.
    *   **Authentication**: Required (Write permissions for the application).
    *   **Request Body**: `application/json` - `{ "version_id": "optional_package_version_id", "metadata": { ... } }` (If `version_id` is omitted, the latest package is used).
    *   **Response**: `application/json` - Details of the created release.
*   **`GET /organisations/applications/release/history`**: Retrieves the release history for the current application.
    *   **Authentication**: Required (Read permissions for the application).
    *   **Response**: `application/json` - Array of release history entries.

### Public Release Endpoints
Base Path: `/release` (These endpoints are typically public and consumed by client SDKs)

*   **`GET /release/{organisation}/{application}`**: Serves the live release configuration for a specified organization and application. (Legacy endpoint)
    *   **Response**: `application/json` - Combined release configuration, including package details and resources.
*   **`GET /release/v2/{organisation}/{application}`**: Serves the V2 live release configuration. This version resolves the workspace name to fetch configuration from Superposition and defaults to the latest package if version "0" is specified in Superposition.
    *   **Response**: `application/json` - Combined V2 release configuration.

### Dashboard Access
Base Path: `/dashboard`

*   **`GET /dashboard/*`**: Serves static assets for the Airborne Server's administrative dashboard (React application).
    *   Requests to paths under `/dashboard` will serve files from the `./dashboard_react/dist` directory, with `index.html` as the default fallback for client-side routing.

## Database Architecture

The server utilizes a PostgreSQL database, `airborneserver`, to persist its operational data. The schema is organized as follows:

1.  **`packages`**: Manages versions of application software packages.
    *   **Purpose**: Stores metadata and asset information for each package version deployable via OTA updates.
    *   **Key Columns**:
        *   `id` (UUID, PK): Unique identifier.
        *   `version` (Integer): Package version number, scoped to `app_id`.
        *   `app_id` (Text): Foreign key to the application.
        *   `org_id` (Text): Foreign key to the organization.
        *   `index` (Text): Path/name of the package's main entry file (e.g., `index.jsa`).
        *   `version_splits` (Boolean): Indicates if assets are stored in version-specific S3 paths.
        *   `use_urls` (Boolean): Determines if `important`/`lazy` fields contain full URLs or relative paths.
        *   `important` (JSONB): Array of critical file objects (`{ "url": "...", "filePath": "..." }`).
        *   `lazy` (JSONB): Array of on-demand file objects (`{ "url": "...", "filePath": "..." }`).
        *   `properties` (JSONB): Custom metadata (e.g., manifest, hashes).
        *   `resources` (JSONB): Additional associated resources.

2.  **`configs`**: Stores configurations linked to specific package versions.
    *   **Purpose**: Allows for versioned configurations that can be applied to different package releases.
    *   **Key Columns**:
        *   `id` (Integer, PK, Auto-increment): Unique identifier.
        *   `org_id` (Text): Foreign key to the organization.
        *   `app_id` (Text): Foreign key to the application.
        *   `version` (Integer): Package version this configuration applies to.
        *   `config_version` (Text): User-defined version string for this configuration content.
        *   `release_config_timeout` (Integer): Timeout (ms) for fetching release configuration.
        *   `package_timeout` (Integer): Timeout (ms) for downloading the package.
        *   `tenant_info` (JSONB): Tenant-specific settings.
        *   `properties` (JSONB): General configuration properties.
        *   `created_at` (Timestamp): Creation timestamp.

3.  **`releases`**: Logs official software releases for applications.
    *   **Purpose**: Tracks the history of deployed releases, linking packages and configurations.
    *   **Key Columns**:
        *   `id` (UUID, PK): Unique identifier.
        *   `org_id` (Text): Foreign key to the organization.
        *   `app_id` (Text): Foreign key to the application.
        *   `package_version` (Integer): Version of the `packages` entry used.
        *   `config_version` (Text): `config_version` from the `configs` entry used.
        *   `created_at` (Timestamptz): Release creation timestamp.
        *   `created_by` (Text): ID of the user who initiated the release.
        *   `metadata` (JSONB): Custom metadata for the release.

4.  **`cleanup_outbox`**: Facilitates transactional consistency for distributed operations.
    *   **Purpose**: Implements an outbox pattern to manage rollbacks or retries for operations spanning multiple services (Keycloak, Superposition, S3).
    *   **Key Columns**:
        *   `transaction_id` (Text, PK): Unique transaction identifier.
        *   `entity_name` (Text): Identifier of the primary entity involved (e.g., org name).
        *   `entity_type` (Text): Type of operation (e.g., "organisation_create").
        *   `state` (JSONB): Stores information about created resources for potential rollback.
        *   `created_at` (Timestamptz): Transaction initiation time.
        *   `attempts` (Integer): Number of processing attempts.
        *   `last_attempt` (Nullable Timestamptz): Timestamp of the last attempt.

5.  **`workspace_names`**: Ensures unique Superposition workspace names.
    *   **Purpose**: Maps an internal auto-incrementing ID to an organization and a generated Superposition workspace name, preventing naming conflicts.
    *   **Key Columns**:
        *   `id` (Integer, PK, Auto-increment): Unique internal ID.
        *   `organization_id` (Text): Associated organization ID.
        *   `workspace_name` (Text): The unique workspace name (e.g., "workspace123").

## Keycloak Integration

Keycloak is integral to the Airborne Server's security and operational model. It serves the following critical functions:

-   **Identity and Access Management (IAM)**: Provides robust user authentication (username/password) and manages user identities.
-   **Token-Based Authentication**: Issues JSON Web Tokens (JWTs) upon successful login. These tokens are used as Bearer tokens to authenticate API requests to protected endpoints.
-   **Authorization and Permissions**: Manages user roles and permissions through a group-based hierarchy. Organizations and applications are represented as groups in Keycloak, with sub-groups defining access levels (e.g., `owner`, `admin`, `write`, `read`).
-   **Service Accounts**: Utilized for server-to-server communication between the Airborne Server and Keycloak for administrative tasks like user creation or group management, without requiring user credentials.

The server validates incoming JWTs, extracts user identity and associated permissions (derived from group memberships), and enforces access control rules for all protected resources and operations.

## Development Environment

### Prerequisites

To set up the development environment for the Airborne Server, you will need the following software installed:

*   **Docker and Docker Compose**: Essential for running the containerized services (Keycloak, PostgreSQL, LocalStack, Superposition).
*   **Git**: For version control and cloning the repository.
*   **Rust Toolchain**: Required for building and running the Actix-based server application. Ensure you have `cargo` and `rustc` installed.

### Environment Variables

The server relies on a set of environment variables for its configuration. These are typically managed in a `.env` file at the root of the `server/` directory. Critical variables include:

*   `KEYCLOAK_URL`: URL of the Keycloak instance.
*   `KEYCLOAK_CLIENT_ID`: Client ID for the Airborne Server in Keycloak.
*   `KEYCLOAK_SECRET`: Client secret (typically KMS encrypted for production).
*   `KEYCLOAK_REALM`: Keycloak realm name.
*   `KEYCLOAK_PUBLIC_KEY`: Public key for validating JWTs issued by Keycloak.
*   `SUPERPOSITION_URL`: URL of the Superposition service.
*   `SUPERPOSITION_ORG_ID`: The organization ID within Superposition used by the server.
*   `AWS_BUCKET`: Name of the S3 bucket for storing package assets.
*   `PUBLIC_ENDPOINT`: The public-facing URL for accessing assets stored in S3.
*   `DATABASE_URL`: Connection string for the PostgreSQL database (typically KMS encrypted for production).
*   AWS Credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`): For S3 and KMS access. `AWS_ENDPOINT_URL` may be needed for LocalStack.

Refer to the provided `.env.example` or existing setup scripts (`scripts/encrypt_env.sh`, `scripts/generate_env.sh`) for guidance on populating these variables.

### Database Migrations

Database schema changes are managed using Diesel CLI.

*   **Applying Migrations**: To apply pending migrations, use the command:
    ```bash
    diesel migration run --database-url <your_decrypted_postgresql_connection_string>
    ```
*   **Automatic Migrations**: The server application is configured to attempt to run any pending migrations automatically upon startup.

### Running the Server

The `run.sh` script orchestrates the setup and execution of the Airborne Server and its dependent services using Docker Compose.

1.  **Clone the Repository**:
    ```bash
    git clone <repository-url>
    cd hyper-ota/server
    ```

2.  **Configure Environment**: Create and populate the `.env` file as described in the "Environment Variables" section.

3.  **Start Services**: Use the `run.sh` script with the desired options:
    *   **Development Mode (with hot-reloading for the backend)**:
        ```bash
        ./run.sh dev
        ```
    *   **Development Mode (forcing Docker image rebuilds)**:
        ```bash
        ./run.sh dev build
        ```
    *   **Production Mode**:
        ```bash
        ./run.sh prod
        ```
    *   **Detached Mode (run services in the background)**:
        ```bash
        ./run.sh dev nobuild detach
        # or
        ./run.sh prod detach
        ```

    **`run.sh` Usage**:
    ```
    ./run.sh [mode] [build_option] [detach_option]
    ```
    *   `mode`: `dev` (default) or `prod`.
    *   `build_option`: `build` or `nobuild` (default).
    *   `detach_option`: `detach` or `nodetach` (default).

### Services Started

The `run.sh` script, through Docker Compose, typically starts the following services:

*   **Airborne Backend API**: The core Rust application. Accessible typically on `http://localhost:9000` (as configured in `main.rs`), though Docker Compose might expose it on a different port (e.g., `8081`).
*   **Keycloak**: IAM service. Accessible at `http://localhost:8180` (Default admin credentials: `admin/admin`).
*   **LocalStack**: Emulates AWS services (S3, KMS) for local development.
*   **Superposition**: Configuration management service.
*   **PostgreSQL Databases**:
    *   `airborneserver`: Main application database.
    *   `config`: Potentially for Superposition or other configurations.
    *   `keycloak-db`: Database used by Keycloak.

### Development Workflow

When running in `dev` mode (`./run.sh dev`):

*   **Hot Reloading**: Changes to the backend Rust code trigger automatic recompilation and server restart.
*   **Service Stability**: Docker Compose attempts to restart services if they crash.
*   **Logging**: Debug-level logging is typically enabled for easier troubleshooting.
*   **Configurations**: Development-specific configurations (e.g., LocalStack endpoints) are generally active.

## License

The Airborne Server is licensed under the Apache License, Version 2.0. See the [LICENSE](../LICENSE) file for more details.
