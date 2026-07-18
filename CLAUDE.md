# CLAUDE.md

Guidance for Claude Code when evolving this project. **The real code takes
precedence over any document** (including `Agents.md` — see "Known divergences").

## What this is

A REST API boilerplate in Node.js 20 + TypeScript (strict, CommonJS) with Clean
Architecture, contract-first design (OpenAPI validates requests **and** responses
at runtime), MongoDB via Mongoose, and observability with OpenTelemetry plus
structured logs (winston via the `traceability` lib) carrying the `trace_id` on
every log line.

## Commands

```bash
yarn dev            # ts-node-dev with --env-file=.env
yarn build          # tsc + copies src/contracts/*.yaml to dist (copy-essentials)
yarn start          # node dist/src/main.js
yarn test:unit      # jest, only *.unit.test.ts
yarn test:int       # jest --runInBand, only *.int.test.ts (mongodb-memory-server; no local Mongo needed)
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
| `src/domain/errors/` | Domain errors (`DomainError`, `NotFoundError` 404, `ConflictError` 409) — mapped to HTTP by the central error handler in `server.ts` |
| `src/domain/common/` | Cross-feature domain types (e.g. `IPagination`) |
| `src/interfaces/http/` | `server.ts` (Express + middlewares) and `controllers/` (thin HTTP adapters) |
| `src/infrastructure/repository/<feature>/` | Repository contract implementations (Mongoose) |
| `src/infrastructure/db/mongo/{schema,models}/` | Mongoose schemas and models |
| `src/infrastructure/config/` | `env.ts` (fail-fast env validation) and `factories/` (composition root — manual DI via static factories) |
| `src/infrastructure/telemetry/` | OpenTelemetry (`tracing.ts`) and trace-context injection into the logger (`logger.ts`) |
| `src/contracts/service.yaml` | OpenAPI 3.0.2 — source of truth for the API, validated at runtime |
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
5. `src/domain/<feature>/service/<feature>.service.ts` — `<Feature>Service implements I<Feature>Service`; business rules throw errors from `src/domain/errors/` (`NotFoundError`, `ConflictError`) — never decide HTTP status in the service
6. `src/infrastructure/db/mongo/schema/<feature>.schema.ts` — `IM<Feature> extends I<Feature>` (adds `_id: Types.ObjectId`) and `export const <feature>Schema = new Schema<IM<Feature>>(...)`
7. `src/infrastructure/db/mongo/models/<feature>.model.ts` — `export const M<feature> = mongoose.model<IM<Feature>>(...)` (e.g. `Muser`)
8. `src/infrastructure/repository/<feature>/<feature>.repository.read.ts` and `.write.ts` — implementations (same file names as the contracts, different directories); use `.lean()` with `HIDE_MONGO_INTERNAL_FIELDS` so `_id`/`__v` never leak
9. `src/interfaces/http/controllers/<feature>.controller.ts` — `<Feature>Controller implements IController`, receives `I<Feature>Service` (the interface, not the class); errors go to `next(error)` — the central error handler answers in the contract shape
10. `src/infrastructure/config/factories/<feature>.service.factory.ts` and `<feature>.controller.factory.ts` — `static create()`
11. Register the controller in **two places**: `src/main.ts` and `src/__tests__/configApp.ts`
12. Update `src/contracts/service.yaml` with the new endpoints (request and response)
13. Tests: `src/__tests__/unit/<feature>.*.unit.test.ts` and `src/__tests__/integration/<feature>.*.int.test.ts`

Details in [docs/architecture.md](docs/architecture.md).

## Critical conventions (summary)

- Files: lowercase with dots — `user.service.ts`, `user.repository.read.ts`, `user.controller.factory.ts`, `controller.interface.ts`. No exceptions.
- Interfaces prefixed with `I` (`IUser`, `IUserService`, `IController`); constructor/method parameter objects as `IParams*` (`IParamsCreateUser`, `IParamsUserService`); persistence interfaces as `IM*` (`IMUser extends IUser`, defined next to the schema).
- Mongoose models prefixed with `M` and typed (`Muser = mongoose.model<IMUser>`); schemas in camelCase and typed (`userSchema = new Schema<IMUser>`).
- Constants in `UPPER_SNAKE_CASE` (`OPEN_API_SPEC_FILE_LOCATION`).
- Tests: `describe('When we ...')` / `it('should ...')`.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`) — required by semantic-release and enforced by commitlint.
- **Everything in English**: code, variable names, comments, tests, and documentation.
- Full table in [docs/conventions.md](docs/conventions.md).

## Observability (hard rules)

- **Never** use `console.log`. Always `import { Logger } from 'traceability'`.
- Every log with structured metadata: `Logger.info('message', { eventName: 'user.created', ... })`. **Never** `JSON.stringify` inside the message.
- The `import './infrastructure/telemetry/tracing'` **must be the first line** of `src/main.ts` — auto-instrumentation needs to load before express/mongoose.
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

## Organization standards

**`Agents.md` (root) is aligned with this repository** — it was rewritten to
mirror the real code, and this boilerplate is the reference implementation of
the standard. Follow it together with the docs below.

The knowledge base at `.cursor/rules/ai_knowledge_base/` (submodule —
initialize with `git submodule update --init`) is a **separate, org-wide
repository** and still describes a generic layout that diverges from this repo.
All GitHub access is via **SSH**: `.gitmodules` uses an HTTPS URL, but the
local git has the global rewrite
`url."git@github.com:".insteadOf "https://github.com/"` — never use HTTPS with
credentials for git operations. Where the knowledge base diverges, **follow the
real code and `Agents.md`**:

| Knowledge base says | Real code in this repo |
| --- | --- |
| Factories in `src/configurations/factory/` | `src/infrastructure/config/factories/` |
| Controllers in `src/application/` (with DTOs, middlewares, validators) | `src/interfaces/http/controllers/` — no DTOs (contract-first validation via OpenAPI) |
| Domain grouped by type: `src/domain/{entity,repository,services}/interfaces/` | Domain by feature: `src/domain/<feature>/{interfaces,repository,service}/` |
| Infra: `src/infrastructure/database/mongo/{models,schemas,repositories}/` | `src/infrastructure/db/mongo/{models,schema}/` + `src/infrastructure/repository/<feature>/` |
| Single repository `IUserRepository` | Read/write split: `IUserRepositoryRead` + `IUserRepositoryWrite` |
| Contract `api-doc.yaml` | `src/contracts/service.yaml` |
| `IM*` interface declared in the model file | Declared in the schema file (`user.schema.ts`) to keep the schema → model import direction cycle-free |
| Logs with a `data` envelope: `Logger.info('MSG', { data: {...} })` | Root-level metadata: `Logger.info('MSG', { eventName, ... })` — what the trace/cid format expects |
| Routes with an `/api` prefix (`/api/users`) | No prefix: `/users` |
| Rules in `.cursor/rules/REPO_RULES.md` | File does not exist in this repo |

What the knowledge base **confirms** and applies here: `I`/`IM`/`E` prefixes,
factories with `static create()`, thin controllers with no business rules,
Conventional Commits, branches `feature/*`, `bugfix/*`, `hotfix/*`, `release/*`,
coverage ≥ 80%, and comments only when they explain the "why" (never dead code
or obvious comments).

## Detailed documentation

- [docs/architecture.md](docs/architecture.md) — layers, request→response flow, DI
- [docs/conventions.md](docs/conventions.md) — naming, errors, style, commits
- [docs/testing.md](docs/testing.md) — Jest, integration with mongodb-memory-server
- [docs/observability.md](docs/observability.md) — OpenTelemetry, logs, trace_id
