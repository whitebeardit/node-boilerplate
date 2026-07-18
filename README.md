# Node Boilerplate

This repository demonstrates a Node.js + TypeScript application structured
following Clean Architecture. The layered separation makes testing and
maintenance easier.

## Folder Architecture

- **src/domain** – Entities, domain errors and repository/service contracts.
- **src/interfaces** – Input/output adapters (e.g. HTTP).
- **src/infrastructure** – Concrete implementations (DynamoDB, factories, telemetry, env).
- **src/contracts** – OpenAPI spec that documents and validates the API.
- **src/\_\_tests\_\_** – Unit and integration tests.
- **main.ts** – Entry point that wires telemetry and instantiates the server.

## Running Locally

1. Install the dependencies:

```bash
yarn install
```

2. Create a `.env` file from the example (`cp .env.example .env`) and adjust
   `AWS_REGION`, `DYNAMODB_ENDPOINT`, `PORT` and the `OTEL_*` variables.
3. Start in development mode:

```bash
yarn dev
```

4. To compile and run the built version:

```bash
yarn build
yarn start
```

5. Tests and linter:

```bash
yarn test
yarn lint
```

## Adding New Features

1. Define entities and interfaces in `src/domain`.
2. Create the implementations in `src/infrastructure`.
3. Expose routes or adapters in `src/interfaces`.
4. Register the dependencies in `src/infrastructure/config/factories` and update
   `main.ts` (and `src/__tests__/configApp.ts` for the integration tests).
5. Document the routes in `src/contracts/service.yaml`.
6. Write tests in `src/__tests__`.

The `src/contracts/service.yaml` file is the source of truth for the API
documentation and must reflect any route or contract change.

## Observability

The project ships instrumented with **OpenTelemetry** (distributed tracing via
`@opentelemetry/sdk-node` + auto-instrumentations) and **structured JSON logs**
(`traceability`/winston). Every log line emitted inside a request automatically
carries the `trace_id`/`span_id` of the active trace, enabling direct
correlation between logs and traces.

- Initialization in `src/infrastructure/telemetry/tracing.ts` (imported on the
  first line of `src/main.ts`).
- Configuration via `OTEL_*` variables (see `.env.example`).
- Full guide in [docs/observability.md](docs/observability.md).

## Documentation

- [CLAUDE.md](CLAUDE.md) — contribution guide for AI agents (Claude Code)
- [docs/architecture.md](docs/architecture.md) — layers, flow and dependency injection
- [docs/conventions.md](docs/conventions.md) — naming and code patterns
- [docs/testing.md](docs/testing.md) — testing strategy and conventions
- [docs/observability.md](docs/observability.md) — OpenTelemetry and logging
