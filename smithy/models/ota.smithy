namespace juspay.ota

use smithy.api#jsonName
use aws.protocols#restJson1

@trait(selector: "*")
structure entrypoint {}

// Add this trait to any of the operation to make it a Login API
@trait(selector: "*")
structure authapi {}

// Add this trait to any of the operation to make it an authenticated route, an Authorization Header will be passed along with token
@trait(selector: "*")
structure requiresauth {}

/// Service for managing OTA updates and configurations
@entrypoint
@restJson1
@httpBearerAuth
service OTAService {
    version: "1.0.0",
    operations: [
        PostLogin,
        GetUser,
        CreateUser,
        CreateOrganisation,
        GetRelease,
        GetReleaseV2
    ]
}

/// User credentials for login
structure UserCredentials {
    @required
    name: String,
    @required
    password: String
}

/// User token response
structure UserToken {
    @required
    access_token: String,
    @required
    token_type: String,
    @required
    expires_in: Long,
    @required
    refresh_token: String,
    @required
    refresh_expires_in: Long
}

/// User information
structure User {
    @required
    user_id: String,
    @required
    organisations: Organisations,
    user_token: UserToken
}

/// List of organisations
list Organisations {
    member: Organisation
}

/// Organisation information
structure Organisation {
    @required
    name: String,
    @required
    applications: Applications,
    @required
    access: AccessList
}

/// List of applications
list Applications {
    member: Application
}

/// Application information
structure Application {
    @required
    name: String,
    @required
    version: String
}

/// List of access levels
list AccessList {
    member: String
}

/// Organisation creation request
structure CreateOrganisationRequest {
    @required
    name: String
}

/// Release configuration
structure ReleaseConfig {
    @required
    config: Config,
    @required
    package: Package,
    @required
    resources: Document
}

/// Configuration details
structure Config {
    @required
    version: String,
    @required
    release_config_timeout: Integer,
    @required
    package_timeout: Integer,
    @required
    properties: ConfigProperties
}

/// Configuration properties
structure ConfigProperties {
    @required
    tenant_info: Document
}

/// Package information
structure Package {
    @required
    name: String,
    @required
    version: String,
    @required
    properties: PackageProperties,
    @required
    index: String,
    @required
    splits: Splits
}

/// Package properties
structure PackageProperties {
    @required
    manifest: Document,
    @required
    manifest_hash: Document
}

/// List of splits
list Splits {
    member: String
}

/// Login operation
@http(method: "POST", uri: "/users/login")
@authapi
operation PostLogin {
    input: UserCredentials,
    output: User,
    errors: [UnauthorizedError]
}

/// Get user operation
@http(method: "GET", uri: "/user")
@readonly
@requiresauth
operation GetUser {
    output: User,
    errors: [UnauthorizedError]
}

/// Create user operation
@http(method: "POST", uri: "/users/create")
operation CreateUser {
    input: UserCredentials,
    output: User,
    errors: [BadRequestError]
}

/// Create organisation operation
@http(method: "POST", uri: "/organisations/create")
@requiresauth
operation CreateOrganisation {
    input: CreateOrganisationRequest,
    output: Organisation,
    errors: [UnauthorizedError, BadRequestError]
}

/// Get release operation
@http(method: "GET", uri: "/release/{organisation}/{application}")
@readonly
@requiresauth
operation GetRelease {
    input: GetReleaseInput,
    output: ReleaseConfig,
    errors: [NotFoundError, InternalServerError]
}

/// Get release v2 operation
@http(method: "GET", uri: "/release/v2/{organisation}/{application}")
@readonly
@requiresauth
operation GetReleaseV2 {
    input: GetReleaseInput,
    output: ReleaseConfig,
    errors: [NotFoundError, InternalServerError]
}

/// Input for get release operations
structure GetReleaseInput {
    @required
    @httpLabel
    organisation: String,
    @required
    @httpLabel
    application: String
}

/// Unauthorized error
@error("client")
@httpError(401)
structure UnauthorizedError {
    @required
    message: String
}

/// Bad request error
@error("client")
@httpError(400)
structure BadRequestError {
    @required
    message: String
}

/// Not found error
@error("client")
@httpError(404)
structure NotFoundError {
    @required
    message: String
}

/// Internal server error
@error("server")
@httpError(500)
structure InternalServerError {
    @required
    message: String
} 