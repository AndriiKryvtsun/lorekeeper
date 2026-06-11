# typed-env

## Purpose

Defines a single typed environment module that validates all server-only and
public environment variables with Zod, serves as the only place runtime code
reads `process.env`, and fails fast when configuration is missing or invalid.

## Requirements

### Requirement: Single typed env module
The system SHALL provide a typed env module at `~/env` (built with `@t3-oss/env-nextjs`
and Zod) that validates all server-only variables and all `NEXT_PUBLIC_` variables. This
module SHALL be the ONLY place application runtime code reads `process.env`; all other
runtime modules import their configuration from `~/env`. (Build/CLI tooling such as
`prisma.config.ts` is not application runtime and is exempt.)

#### Scenario: Runtime code reads env only through the module
- **WHEN** application runtime code needs an environment variable
- **THEN** it imports the typed value from `~/env` rather than reading `process.env` directly

#### Scenario: Server-only variables are not exposed to the client
- **WHEN** the env schema is defined
- **THEN** server-only variables (e.g. the service-role key) are declared as server vars and never placed under the client/`NEXT_PUBLIC_` schema

### Requirement: Env validation fails fast
The system SHALL validate environment variables against the Zod schema at startup/import
time and FAIL FAST with a clear error when a required variable is missing or invalid,
rather than allowing the app to run with bad configuration.

#### Scenario: Missing required variable is rejected
- **WHEN** a required variable is absent and the env module is imported
- **THEN** validation throws an error identifying the offending variable and the app does not start

#### Scenario: Invalid variable value is rejected
- **WHEN** a variable is present but fails its Zod rule (e.g. a non-URL where a URL is required)
- **THEN** validation throws an error identifying the offending variable
