# Testing the Hyper OTA Server

This directory contains tests for the Hyper OTA Server application.

## Test Structure

- `mod.rs` - Main test module that includes all test modules
- `common.rs` - Common utilities for testing, including mock AppState and Auth middleware
- `mocks.rs` - Mock implementations of external dependencies
- `organisation_tests.rs` - Tests for the organization endpoints
- `organisation_transaction_tests.rs` - Tests for transaction-like behavior in organization creation

## Running Tests

To run all tests:

```sh
cargo test
```

To run tests with output:

```sh
cargo test -- --nocapture
```

To run a specific test:

```sh
cargo test test_create_organisation_success
```

## Test Environment

Tests use a separate `.env.test` file in the project root for test-specific environment variables.

## Setting Up a Test Database

The tests can use a separate test database. By default, they will try to connect to:

```
postgres://postgres:postgres@localhost:5433/test_hyperotaserver
```

You can override this by setting the `TEST_DATABASE_URL` environment variable.

### Creating the Test Database

```sh
psql -U postgres -c "CREATE DATABASE test_hyperotaserver;"
```

Then run the migrations:

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5433/test_hyperotaserver diesel migration run
```

## Mock External Services

The tests use mocks to simulate external services like Keycloak and Superposition.

### Keycloak

Tests mock the KeycloakAdmin using mockall.

### Superposition API

Tests mock the Superposition API calls.

## Test Data

The tests create isolated test data that is not persisted between test runs.
