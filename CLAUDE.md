# CLAUDE.md

Guidance for Claude Code when evolving this project. **The real code takes
precedence over any document** (including `Agents.md` — see "Known divergences").

## What this is

A REST API boilerplate in Node.js 20 + TypeScript (strict, CommonJS) with Clean
Architecture, contract-first design (OpenAPI validates requests **and** responses
at runtime), DynamoDB via the AWS SDK v3, an **asynchronous write path** over
SQS (`POST /users` publishes `USER.NEW` and answers 202; the consumer
persists — asyncapi.yaml contract), and observability with OpenTelemetry plus
structured logs (winston via the `traceability` lib) carrying the `trace_id` on
every log line.

## Commands

```bash
yarn dev            # ts-node-dev with --env-file=.env
yarn build          # tsc + copies src/contracts/*.yaml to dist (copy-essentials)
yarn start          # node dist/src/main.js
yarn test:unit      # jest, only *.unit.test.ts
yarn test:int      # jest --runInBand, only *.int.test.ts (dynalite in-memory DynamoDB; no local database needed)
yarn lint           # eslint
yarn lint:fix       # eslint --fix
yarn prettier       # prettier --write on src/
```

**Mandatory checklist before delivering any change** (Agents.md §7):

```bash
yarn prettier && yarn lint && yarn build && yarn test
```

## Layer map

| Path | Responsibility |
| --- | --- |
| `src/domain/<feature>/` | Pure business logic (no I/O): entity, interfaces, repository contracts, service |
| `src/domain/errors/` | Domain errors (`DomainError`, `BadRequestError` 400, `NotFoundError` 404, `ConflictError` 409) — mapped to HTTP by the central error handler in `server.ts` |
| `src/domain/common/` | Cross-feature domain types (e.g. `IPagination`) |
| `src/domain/ops/` | Operational slice: `IOpsService` (DLQ redrive, search by cid) and the `IDlqRedriver` port |
| `src/interfaces/http/` | `server.ts` (Express + middlewares) and `controllers/` (thin HTTP adapters) |
| `src/infrastructure/repository/<feature>/` | Repository contract implementations (DynamoDB) |
| `src/infrastructure/db/dynamo/` | DynamoDB client, `DynamoDatabase` lifecycle adapter and `tables/` (table definitions + item mappers) |
| `src/infrastructure/messaging/` | `worker.interface.ts` (`IWorker`, `ISqsMessageHandler`), `sqs/` (client, generic `SqsWorker` long-poller, `SqsDlqRedriver`) and `user-new/` (payload parser, `UserNewConsumer`, `UserNewProducerSqs`) |
| `src/infrastructure/config/` | `env.ts` (fail-fast env validation) and `factories/` (composition root — manual DI via static factories) |
| `src/infrastructure/telemetry/` | OpenTelemetry (`tracing.ts`) and trace-context injection into the logger (`logger.ts`) |
| `src/contracts/service.yaml` | OpenAPI 3.0.2 — source of truth for the API, validated at runtime |
| `src/contracts/asyncapi.yaml` | AsyncAPI 3.0 — contract of the SQS messages (USER.NEW payload, tracking attributes, ack/DLQ policy) |
| `src/__tests__/{unit,integration}/` | Tests (mandatory suffixes `.unit.test.ts` / `.int.test.ts`) |
| `src/main.ts` | Entry point: imports telemetry (first line), instantiates `Server` with factories, graceful shutdown |

**Dependency rule:** `domain` imports nothing from `infrastructure` or
`interfaces`. Controllers delegate to services; services receive repositories via
constructor (an `IParams*` object); composition happens **only** in factories.

## Adding a feature (exact order — mirror the `user` slice)

1. `src/domain/<feature>/interfaces/<feature>.interface.ts` — `I<Feature>`
2. `src/domain/<feature>/interfaces/<feature>.service.interface.ts` — `I<Feature>Service`, `IParamsCreate<Feature>`, `IParams<Feature>Service`…
3. `src/domain/<feature>/repository/<feature>.repository.read.ts` and `.write.ts` — contracts `I<Feature>RepositoryRead/Write`
4. `src/domain/<feature>/<feature>.entity.ts` — class `<Feature> implements I<Feature>` with `readonly` properties
5. `src/domain/<feature>/service/<feature>.service.ts` — `<Feature>Service implements I<Feature>Service`; business rules throw errors from `src/domain/errors/` (`BadRequestError`, `NotFoundError`, `ConflictError`) — never decide HTTP status in the service
6. `src/infrastructure/db/dynamo/tables/<feature>.table.ts` — `IM<Feature>` (domain interface with storage types: dates as ISO strings), `<FEATURE>_TABLE_NAME`, `<feature>TableDefinition` (register it in `DynamoDatabase` so the table is created on boot) and the `to<Feature>`/`to<Feature>Item` mappers
7. `src/infrastructure/repository/<feature>/<feature>.repository.read.ts` and `.write.ts` — implementations (same file names as the contracts, different directories); always map items through `to<Feature>` so storage internals never leak
8. `src/interfaces/http/controllers/<feature>.controller.ts` — `<Feature>Controller implements IController`, receives `I<Feature>Service` (the interface, not the class); errors go to `next(error)` — the central error handler answers in the contract shape
9. `src/infrastructure/config/factories/<feature>.service.factory.ts` and `<feature>.controller.factory.ts` — `static create()`
10. Register the controller in **two places**: `src/main.ts` and `src/__tests__/configApp.ts`
11. Update `src/contracts/service.yaml` with the new endpoints (request and response)
12. Tests: `src/__tests__/unit/<feature>.*.unit.test.ts` and `src/__tests__/integration/<feature>.*.int.test.ts`

Details in [docs/architecture.md](docs/architecture.md).

## Adding a message consumer (mirror the `user-new` slice)

1. `src/infrastructure/messaging/<event>/<event>.payload.ts` — payload interface + `parse<Event>Payload` (throws `BadRequestError` on invalid input)
2. `src/infrastructure/messaging/<event>/<event>.consumer.ts` — `implements ISqsMessageHandler`, receives the domain service **interface**; re-establishes tracking (cid via `ContextAsyncHooks.asyncLocalStorage.run`, OTel via `propagation.extract` + CONSUMER span) before touching the service; returns `'ack'` for non-retryable failures (invalid payload, duplicates) and `'retry'` for everything else
3. `src/infrastructure/config/factories/messaging/<event>.worker.factory.ts` — `static create(): IWorker` wiring `sqsClient` + service factory + `SqsWorker`
4. Start the worker in `src/main.ts` after `listen()`; stop it **first** in the shutdown handler
5. Update `src/contracts/asyncapi.yaml` (payload + headers + operational notes)
6. Tests: unit for consumer/payload; integration with `aws-sdk-client-mock` on `SQSClient` + real service/repositories/dynalite

## Critical conventions (summary)

- Files: lowercase with dots — `user.service.ts`, `user.repository.read.ts`, `user.controller.factory.ts`, `controller.interface.ts`. No exceptions.
- Interfaces prefixed with `I` (`IUser`, `IUserService`, `IController`); constructor/method parameter objects as `IParams*` (`IParamsCreateUser`, `IParamsUserService`); persistence interfaces as `IM*` (`IMUser`, derived from the domain interface, defined next to the table definition).
- Table definitions in camelCase (`userTableDefinition`); item mappers as `toUser`/`toUserItem`; table/index names as constants (`USER_TABLE_NAME`, `USER_EMAIL_INDEX_NAME`).
- Constants in `UPPER_SNAKE_CASE` (`OPEN_API_SPEC_FILE_LOCATION`).
- Tests: `describe('When we ...')` / `it('should ...')`.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`) — required by semantic-release and enforced by commitlint.
- **Everything in English**: code, variable names, comments, tests, and documentation.
- Full table in [docs/conventions.md](docs/conventions.md).

## Observability (hard rules)

- **Never** use `console.log`. Always `import { Logger } from 'traceability'`.
- Every log with structured metadata: `Logger.info('message', { eventName: 'user.created', ... })`. **Never** `JSON.stringify` inside the message.
- The `import './infrastructure/telemetry/tracing'` **must be the first line** of `src/main.ts` — auto-instrumentation needs to load before express/aws-sdk.
- Every log line emitted inside a request/span automatically gains `trace_id`, `span_id` and `trace_flags` (winston format in `src/infrastructure/telemetry/logger.ts`), in addition to the legacy `cid` from `traceability`.
- Tests run with `OTEL_SDK_DISABLED=true` (set in `.env.test`).
- Details and manual spans in [docs/observability.md](docs/observability.md).

## Pitfalls

- `service.yaml` validates **request and response** (`validateResponses: true`): a new endpoint or field without a contract update fails at runtime (400/500).
- Routes not described in the contract are rejected by the validator (`/health` works because it is registered before the middlewares).
- The build needs `copy-essentials` (yaml is not compiled by tsc) — already part of `yarn build`.
- Integration tests only see controllers registered in `src/__tests__/configApp.ts`.
- Commits go through commitlint (husky `commit-msg` hook): type required, lowercase subject, header ≤ 72 chars.
- `release.config.js` calls `./setup/set-version.sh`, which does not exist in the repo (only runs in CI with `GITHUB_REF_NAME`).
- Required environment variables are validated in `src/infrastructure/config/env.ts` (fail-fast at boot) — read env through it, not via scattered `process.env`.
- List endpoints use cursor pagination (`limit` + opaque `cursor`, response `{ items, nextCursor }`): the cursor is the DynamoDB `ExclusiveStartKey` base64url-encoded in `dynamo.cursor.ts`; a malformed cursor throws `BadRequestError` (400).
- Lookups by non-key attributes need a GSI (e.g. `email-index` for `findUserByEmail`) — add the index to the table definition in the same change.
- `POST /users` is **asynchronous**: it publishes `USER.NEW` and answers 202 `{ message, cid }` — nothing is persisted synchronously and duplicate emails never return 409 (the consumer drops them with a warn). Ports for producers live in the **domain** (`src/domain/user/messaging/`), implementations in `infrastructure/messaging/`.
- The correlation id is stored on the item at write time (`UserRepositoryWrite.createUser` reads the ALS context) and queried via the sparse `cid-index` GSI (`GET /ops/users?cid=`). Existing production tables do **not** gain new GSIs from the boot-time ensure (Describe→Create only) — add them via IaC.
- SQS consumers must **never ack an unknown error** — only non-retryable failures (invalid payload, duplicates) are deleted; everything else stays on the queue for the redrive policy → DLQ (configured in infrastructure, not in code).
- Message handlers must wrap the whole processing in the tracking context (cid ALS + extracted OTel context) **before** the first log or service call, otherwise the trace/cid from the message is lost.

## Organization standards

**`Agents.md` (root) and the organization knowledge base are aligned with this
repository** — both were rewritten to mirror the real code, and this
boilerplate is the **reference implementation** of the standard. If the code
and a standards doc ever drift apart again, the real code prevails; update the
docs in the same change.

The knowledge base lives at `.cursor/rules/ai_knowledge_base/` (submodule —
initialize with `git submodule update --init`), a separate org-wide repository.
Backend guides are under `playbooks/engineering/backend/` (index `AGENTS.md`
plus one guide per layer); commit/branch conventions under
`playbooks/engineering/code-versioning/`; global LLM rules under
`playbooks/engineering/general-rules/AGENTS.md`.

All GitHub access is via **SSH**: `.gitmodules` uses an HTTPS URL, but the
local git has the global rewrite
`url."git@github.com:".insteadOf "https://github.com/"` — never use HTTPS with
credentials for git operations.

Key rules the standards enforce here: `I`/`IParams`/`IM`/`E` prefixes,
factories with `static create()`, thin controllers with no business rules,
typed domain errors with a central handler, contract-first validation,
Conventional Commits, branches `feature/*`, `bugfix/*`, `hotfix/*`,
`release/*`, coverage ≥ 80% (merged), logs with root-level `eventName`
metadata, and comments only when they explain the "why".

## Detailed documentation

- [docs/architecture.md](docs/architecture.md) — layers, request→response flow, DI
- [docs/conventions.md](docs/conventions.md) — naming, errors, style, commits
- [docs/testing.md](docs/testing.md) — Jest, integration with dynalite (in-memory DynamoDB)
- [docs/observability.md](docs/observability.md) — OpenTelemetry, logs, trace_id
