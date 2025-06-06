# Juspay CLI Builder

**Juspay CLI Builder** is a simple Node.js command‑line tool that generates a new CLI on top of a Smithy‑generated TypeScript client. It reads your Smithy project configuration and scaffolds a custom CLI with the name and description you specify.

## Features

* Reads `smithy-build.json` to extract:

  * `namespace` and `service` identifiers
  * NPM module name and version
  * Model and client paths
* Generates a new CLI project by invoking `startBuilder(...)` with:

  * `namespace`, `service`, `modelsJSON`, `clientPath`, `endpointURL`
  * `nModule`, `nModuleVersion`
  * `cliName`, `cliDescription`

## Prerequisites

* Node.js v18 or higher
* A built Smithy project with `build/smithy/typescript-sdk` artifacts
* `smithy-build.json` present in your Smithy project root

## Installation

Clone this repository and install dependencies:

```bash
git clone https://github.com/yourorg/juspay-cli-builder.git
cd juspay-cli-builder
npm install
chmod +x index.js      # ensure the script is executable
```

To use it globally:

```bash
npm link            # or: npm install -g .
```

## Usage

```bash
juspay-cli-builder \
  endpointUrl=<API_BASE_URL> \
  smithyProjectPath=<PATH/TO/SMITHY/> \
  cliName=<YOUR_CLI_NAME> \
  cliDescription="<YOUR_CLI_DESCRIPTION>"
```

## Example Usage

```bash
juspay-cli-builder \
  endpointUrl=http://127.0.0.1:9000 \
  smithyProjectPath="/Users/yuvraj.singh/Documents/repositories/ota/hyper-ota-server/smithy/" \
  cliName="Juspay OTA" \
  cliDescription="Juspay OTA"
```

### Parameters

* `endpointUrl` (string) – Base URL of your API (e.g. `https://api.example.com`).
* `smithyProjectPath` (string) – Path to the root of your Smithy project (must contain `smithy-build.json`).
* `cliName` (string) – Desired NPM package name and binary name for the generated CLI.
* `cliDescription` (string) – Short description for the generated CLI’s help output.

This will:

1. Read `/Users/yuvraj.singh/Documents/repositories/ota/hyper-ota-server/smithy/smithy-build.json`.
2. Extract service metadata (namespace, service, module name/version).
3. Call `startBuilder(...)`, which scaffolds a new CLI under `clientPath`.
4. Exit with code `0` on success or `1` on error.

## Advanced Use Cases

### File Upload

To have the support for uploading files, your model needs to have some additional traits
1. Add these on the top of Smithy file:
```smithy
use smithy.api#http
use smithy.api#mediaType
use smithy.api#streaming
use smithy.api#httpPayload
use smithy.api#httpLabel
use smithy.api#httpHeader
```
2. Create an alias for `@streaming` trait with the following structure (Make sure the structure name `FileStream` is as it is):
```smithy
/// Alias for a streaming blob of raw bytes
@streaming
structure FileStream {
  /// The raw file bytes go in the HTTP body
  @httpPayload
  @mediaType("application/octet-stream")
  data: Blob
}
```
3. You can use this trait in your input of the http:
```smithy
/// Input to our upload operation
structure UploadFileRequest {
  /// Logical file identifier, e.g. a path or UUID
  @httpLabel
  fileId: String

  /// The file’s binary contents
  @httpPayload
  file: FileStream

  /// Original filename (sent as a header)
  @httpHeader("Content-Disposition")
  filename: String
}
```

## Troubleshooting

* **Missing parameters**: Ensure all four `key=value` pairs are supplied.
* **Smithy not built**: Run `smithy build` in your Smithy project before invoking the builder.
* **Invalid path**: Verify `smithyProjectPath` ends with a `/` and points to the correct directory.
* **Permission errors**: Ensure `index.js` is executable (`chmod +x index.js`).
* **Running Generated CLI**: Make sure to have a file ~/.your-cli, if you have authenticated routes you can put your token in this file or else leave it empty
* **Running Generated CLI**: To run the generated CLI, you can `cd build` => `npm link` => `your-cli`.

