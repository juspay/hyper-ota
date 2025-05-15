Hyper OTA Server

Backend to support SAAS offering of Hyper OTA SDK

Server
- Built Routes
  - /user 
      - GET 
      - return complete user state
      - Queries keycloak for user access level and which orgs and applications he belongs to
    /user/login
      - POST
      - Calls open connect API of key cloak; Forwards the issued token; No caching
      - Calls /user to get user state
    /user/create
      - POST
      - Creates a user in keycloak using service account
      - Calls /login to get required result type
  
  - /organisation/create
      - POST
      - Creates a group in keycloak
      - Creates a owner group in keycloak; As a child to the organisation group
      - Assigns the user as a member of the owner group
      - Creates an organisation in CAC
      - Adds a db entry to map keycloak id to CAC id
    /organisation/application/create
      - POST
      - Creates a group in keycloak; As a child to the organisation group
      - Creates a admin group in keycloak; As a child to the application group
      - Assigns the user as a member of the admin group
      - Creates a workspace in CAC
      - Adds default CAC config

  - /dashboard/*
      - POST
      - Serves admin UI for ota server

- Pending Routes
  - /organisation/application/user/create
  - /organisation/application/user/update
  - /organisation/application/user/delete
  - /organisation/application/delete
  - /organisation/application/users

  - /organisation/user/create
  - /organisation/user/update
  - /organisation/user/delete
  - /organisation/delete
  - /organisation/user/list

  - /organisation/application
    - Indicating that packages can be shared between their clients
  - /organisation/application/package/create
    - This includes uploading files as well
  - /organisation/application/release/create
    - Config and resource updates can be done here
    - Do I have the UI get the entire current value?
  - /organisation/application/release/abort
  - /organisation/application/release/conclude
  - /organisation/application/release/ramp
    - This will be useful for external systems to monitor and increase the stagger percentage
  
  - /organisation/application/create_dimension 
    - Allow the user to add his own dimensions to control
    - Find out how he will send dimensions
  
  - /<org_id>/<app_id>/release-config

  - Settings
      - Application level settings
        - Resource as split - This can be a key in CAC
          - Have files pushed with the resource
      - Package lebel settings
        - Version splits


- Plugins
  - Signature plugin
  - Sign and add header during upload phase;
  - See how to add plugins; Do they come in during complition phase

- Database
  Organisation - TABLE used to map org to super position org; TO BE REMOVED; Use single Org
  - Organisation | Superposition Organisation

  Packages - TABLE used to store a list of packages
  - id | version | app_id | org_id | index | version_splits | use_urls | contents | created by | created at

  Application DB is superposition
  Default config
  - package.version	- Current live package
  - package.name - This is always the application name; Can be removed; Or be replaced as display name
  - config.package_timeout - Download time out for package
  - config.release_config_timeout	- Download timeout for the release config
  - config.version - Version of the release config. Might need to see if this requires semantic or user controlled?

- Isolation
  - Bucket : One bucket for all merchants; Separate folder will be allocated; asset/{org}/{app}/{version}/{file}
  - CAC : Separate workspace for each application
  - DB : Presently there is no isolation here. Might need to see if packages table needs to be in a different schema?

- Security
  - Piggybacking on keycloak
  - Accounts to be issued service accout secrets
  - Details in ACL section

CLI
- Generate Files and Release config
- Provide local and sdk server 


ACL
I'm thinking of a hierarchy where I would have users, organisations and application
A user can be in multiple organisations.

Every user can create an organisation for himself; Where he would get an owner ACL
Other users added to the org can maximum have an admin role
1. create applications
2. change access of other users (other than owner)
3. change organisation settings

The next level of access; Would be single application admin
1. give access to other users to that application
2. change application settings

The next level will be single application write.
1. change application settings

The final level being single application read
1. view application settings


Steps Clear and recreate Database
psql -U <user> -d postgres
DROP DATABASE hyperotaserver;
DROP DATABASE config;

psql postgres
CREATE DATABASE hyperotaserver OWNER <user>;
CREATE DATABASE config OWNER <user>;
GRANT ALL PRIVILEGES ON DATABASE hyperotaserver TO <user>;
GRANT ALL PRIVILEGES ON DATABASE config TO <user>;

diesel migration run 
make db-init # in superposition

delete all users and groups in keycloak under your realm

Steps to setup account in keycloak
1. Login to keycloak
2. Create realm in realm drop down
3. Add KEYCLOAK_REALM in .env as realm name
4. Create Client
    - Type : OpenID Connect
    - ClientID : <any lower case - separated>
    - Rest anything works
5. Capabilty Config
    - Client authentication - On
    - Client authorization - On
    - OAuth 2.0 Device Authorization Grant
    - Direct Access Grant
6. Login Settings
    - Root url, Web Origins : http://localhost:9000
    - Everything else : http://localhost:9000/dashboard/
7. Add KEYCLOAK_CLIENT_ID in env
8. Add KEYCLOAK_SECRET in env from Credentials page under your client
9. Add KEYCLOAK_URL if not done earlier
10. Create a client scope
    - Name : Audience Scope
    - Description : Add correct aud to JWT token issued by keycloak
    - Protocol : OpenIDConnect
11. Add mapper in Client Scope
    - Mapper Type : Audience
    - Name : OTA Server Client Mapper
    - Add to Access Token : On
    - Add to introspection : On
    - Included Client Audience : Client created above
12. Add Audience Scope to Client with Default Assigned type
13. Add Service account roles
    - manage-users
    - query-users
    - view-users
    - More are needed -- TODO find out
13. Add Client roles
    - manage-users
    - query-users
    - view-users
    - More are needed -- TODO find out
14. Goto realm settings; Turn off all required actions

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### One-Command Setup

1. **Clone the Repository**
```bash
git clone <repository-url>
cd hyper-ota/server
```

2. **Start the Server**
```bash
# Development mode
./run.sh dev

# Or with building images
./run.sh dev build

# Production mode
./run.sh prod

# Run in detached mode
./run.sh dev nobuild detach
```

### Usage Options

```bash
./run.sh [mode] [build] [detach]

# Parameters:
mode   - dev|prod (default: dev)
build  - build|nobuild (default: nobuild)
detach - detach|nodetach (default: nodetach)
```

### Services Started

- Backend API (http://localhost:8081)
- Keycloak (http://localhost:8180)
  - Default admin credentials: admin/admin
- LocalStack (AWS services emulator)
- Superposition (Configuration management)
- PostgreSQL databases
  - hyperotaserver
  - config
  - keycloak-db

### Development Workflow

The development mode (`./run.sh dev`) provides:
- Hot-reloading for backend changes
- Automatic service restarts
- Debug logging
- Development-specific configurations
