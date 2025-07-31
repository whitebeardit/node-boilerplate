# `Agents.md` – Standards & TypeScript Stubs for Node.js + TypeScript REST APIs

This guide defines **architecture, naming conventions, folder layout, testing, linting, and code stubs** so that developers *and* AI agents (e.g. Codex, Copilot) can contribute to any Node.js + TypeScript REST‑API repository in a predictable, maintainable way.

---

## 1  Folder Structure (Recommended)

| Layer / Category        | Path                                                                                      | Purpose / Examples                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Domain**              | `src/domain`                                                                              | Pure business logic: entity interfaces (`IUser`), value objects, domain services, repository contracts (`IUserRepository`) |
| **Application**         | `src/application`                                                                         | HTTP controllers (Express/Fastify), GraphQL resolvers, schedulers, background workers                                      |
| **Infrastructure**      | `src/infrastructure`                                                                      | External concerns: database, cache, messaging, HTTP clients, cloud SDKs                                                    |
| ├─ DB (Mongo)           | `src/infrastructure/db/mongo/{schema,models}`                                             | Mongoose schemas & models                                                                                                  |
| ├─ Messaging            | `src/infrastructure/messaging/<event>`                                                    | Kafka/Rabbit producers & consumers                                                                                         |
| ├─ External Services    | `src/infrastructure/external/services`                                                    | HTTP/GRPC clients for third‑party APIs                                                                                     |
| **Configuration**       | `src/configurations`                                                                      | Dependency‑injection factories, env loaders, feature flags                                                                 |
| ├─ Factories Root       | `src/configurations/factory`                                                              | All factories for controllers, services, repositories, workers (centralized composition root)                              |
| ├─ Controller Factories | `src/configurations/factory/<feature>.controller.factory.ts`                              | Controller wiring                                                                                                          |
| ├─ Service Factories    | `src/configurations/factory/<feature>.service.factory.ts`                                 | Service wiring (inject repos, producers, external services)                                                                |
| ├─ Worker Factories     | `src/configurations/factory/messaging/<event>.worker.factory.ts`                          | Messaging worker wiring                                                                                                    |
| **Contracts**           | `src/contracts`                                                                           | Specifications: **REST:** `openapi.yaml` (required) · **Kafka (Async):** `asyncapi.yaml` (required)                        |
| **Factories (Domain)**  | `src/domain/<context>/factories` *(optional)*                                             | Pure domain object factories (no I/O) for creating aggregates/value objects                                                |
| **Tests (root)**        | `src/__tests__`                                                                           | Test root (mirrors `src` layout)                                                                                           |
| ├─ Unit Tests           | `src/__tests__/unit/<mirrors-src>`                                                        | Fast, isolated tests (pure functions, services with mocked dependencies)                                                   |
| ├─ Integration Tests    | `src/__tests__/integration/<context>`                                                     | Test real integrations: controller + HTTP, repository + DB (using test DB), messaging flows                                |
| ├─ Shared Test Utils    | `src/__tests__/__utils__`                                                                 | Reusable helpers (mock builders, in-memory servers, custom matchers)                                                       |
| ├─ Test Factories       | `src/__tests__/__factories__` OR feature‑scoped: `src/__tests__/unit/<feature>/factories` | Data builders / object mother patterns producing valid & edge‑case domain objects                                          |
| **Fixtures**            | `src/__tests__/__fixtures__`                                                              | Static JSON, sample payloads                                                                                               |
| **Scripts**             | `scripts`                                                                                 | One‑off maintenance, seeding, migrations (Node scripts)                                                                    |
| **Root Config**         | `./`                                                                                      | `package.json`, `tsconfig.json`, `jest.config.ts`, `.eslintrc.js`, `.prettierrc`, `.env.example`                           |

> **Tip:** Keep *all* composition (wiring actual implementations) in `src/configurations/factory` to maintain a clear separation from pure domain logic.

---

## 2  Naming Conventions

### 2.1 Interfaces & Enums

| Type                                    | Prefix | Casing | Example                                    |
| --------------------------------------- | ------ | ------ | ------------------------------------------ |
| **Domain interface**                    | `I`    | Pascal | `IUser`, `IOrderService`                   |
| **Persistence interface** (Mongo model) | `IM`   | Pascal | `IMUser`, `IMOrder`                        |
| **Enum**                                | `E`    | Pascal | `EStatus` with members `ACTIVE`, `PENDING` |

Other rules:

* **Classes / functions** → PascalCase / camelCase (no prefix) as appropriate.
* **Variables / properties** → `camelCase`.
* **Constants** → `UPPER_SNAKE_CASE` (e.g. `JWT_PUBLIC_KEY`).

### 2.2 IM Interfaces Pattern

Persistence documents often need Mongo‑specific fields (`_id: ObjectId`, `createdAt`, etc.). Model interfaces therefore **extend** domain interfaces:

```ts
import { IUser } from "../../domain/user/interfaces/user.interface";
import { Types } from "mongoose";

export interface IMUser extends IUser {
  _id: Types.ObjectId;       // Mongo‑specific
  createdAt: Date;
  updatedAt: Date;
}
```

Use `IM*` in:

* `mongoose.Schema<IMUser>` type parameter.
* `model<IMUser>("User", UserSchema)` generic.

---

## 3  Code Stubs

### 3.1 Domain (Entity & Repository Contract)

`src/domain/user/interfaces/user.interface.ts`

```ts
export interface IUser {
  id: string;          // exposed id (string – can be different from Mongo ObjectId)
  name: string;
  email: string;
}
```

`src/domain/user/repositories/user.repository.interface.ts`

```ts
export interface IUserRepository {
  findById(id: string): Promise<IUser | null>;
  create(user: IUser): Promise<void>;
}
```

### 3.2 Mongoose Schema & Model

`src/infrastructure/db/mongo/schema/user.schema.ts`

```ts
import { Schema } from "mongoose";
import { IMUser } from "../models/user.model";

export const UserSchema = new Schema<IMUser>({
  name:  { type: String, required: true },
  email: { type: String, required: true, unique: true },
}, { timestamps: true });
```

`src/infrastructure/db/mongo/models/user.model.ts`

```ts
import { model } from "mongoose";
import { IMUser } from "./user.model";          // circular‑free import pattern
import { UserSchema } from "../schema/user.schema";

export const UserModel = model<IMUser>("User", UserSchema);
```

### 3.3 External HTTP Service

`src/infrastructure/external/services/auth.external.service.ts`

```ts
export interface IAuthExternalService {
  validateToken(token: string): Promise<IUser | null>;
}

export class AuthExternalService implements IAuthExternalService {
  async validateToken(token: string) {
    return httpClient.post(`${AUTH_API}/validate`, { token });
  }
}
```

### 3.4 Messaging (Kafka example)

`src/infrastructure/messaging/user-created/producer.ts`

```ts
export class UserCreatedProducer {
  async publish(payload: IUser): Promise<void> {
    await kafkaProducer.produce({
      topic: "user.events",
      key: payload.id,
      value: JSON.stringify({ type: "USER_CREATED", data: payload }),
    });
  }
}
```

---

## 4  Dependency Injection (Factory Example)

`src/configurations/user-service.factory.ts`

```ts
export class UserServiceFactory {
  static create(): IUserService {
    return new UserService({
      userRepository: new UserRepository(),
      authExternalService: new AuthExternalService(),
      userCreatedProducer: new UserCreatedProducer(),
    });
  }
}
```

### 4.1 Application Bootstrap with Factories

Use a single **app entry point** (`src/app.ts`) to wire the HTTP server and background workers through their **factory‑created** instances. Keep the composition‑root thin—only wiring, no business logic.

```ts
import path from 'node:path';
import { Server } from './domain/server/server';
import { AppointmentControllerFactory } from './configurations/factory/appointment.controller.factory';
import { ConsumerWorkerFactory } from './configurations/factory/messaging/consumer.worker.factory';

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  './contracts/openapi.yaml',
);

const app = new Server({
  port: Number(process.env.PORT) || 3000,
  controllers: [AppointmentControllerFactory.create()],
  databaseURI: process.env.DATABASE_URI,
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
});

async function start() {
  // 1️⃣  DB connection & indexes
  await app.databaseSetup();

  // 2️⃣  Start HTTP server
  app.listen();

  // 3️⃣  Background workers (Kafka, BullMQ, etc.)
  const worker = ConsumerWorkerFactory.create();
  worker.startWorkers();
}

start().catch((err) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
```

**Guidelines**

* Perform bootstrap‑phase I/O (DB, queues) **inside** `start()` not at module load time.
* Order: **database → HTTP server → background workers**.
* Export only what’s necessary for tests (e.g., `app` or `Server` instance). Avoid leaking worker threads globally.

### 4.2 Factory Directory Structure

| Artifact Type                 | Recommended Path & Naming                                        | Example File                                                      |
| ----------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Controller Factory**        | `src/configurations/factory/<feature>.controller.factory.ts`     | `src/configurations/factory/appointment.controller.factory.ts`    |
| **Service Factory**           | `src/configurations/factory/<feature>.service.factory.ts`        | `src/configurations/factory/appointment.service.factory.ts`       |
| **Worker / Consumer Factory** | `src/configurations/factory/messaging/<event>.worker.factory.ts` | `src/configurations/factory/messaging/consumer.worker.factory.ts` |

**Rules**

1. Factories live **only** under `src/configurations/factory` to keep composition centralized.
2. Messaging worker factories stay under `factory/messaging` for discoverability.
3. Each factory exposes a static `create()` returning the fully wired instance.
4. Factories must *never* perform I/O at module‑load time—side‑effects belong in `create()`.

---

## 5  Testing & Linting Standards

| Tool         | Purpose                               | Command (yarn)                |
| ------------ | ------------------------------------- | ----------------------------- |
| **Jest**     | Unit + integration tests              | `yarn test`                   |
| **Coverage** | Ensure ≥ 80 % lines/branches          | `yarn test:coverage`          |
| **ESLint**   | Linting with Airbnb/TypeScript rules  | `yarn lint` / `yarn lint:fix` |
| **Prettier** | Code formatting (optional but common) | `yarn format`                 |

> Enforce CI gates (GitHub Actions, GitLab CI) to fail if coverage or lint rules are not met.

### 5.1 Test Directory Layout

```
src/
  __tests__/
    unit/          # Unit tests (pure functions, services with mocked deps)
    integration/   # Integration tests (controllers, repos hitting test DB, messaging with test broker, etc.)
```

*The directory layout inside each (****`unit/`**\*\*\*\*\*\*\*\*, **********`integration/`**********) should mirror the **********`src/`********** feature structure for easy navigation.*

### 5.2 Test File Naming (MANDATORY)

| Test Type       | Suffix          | Example Filename              |
| --------------- | --------------- | ----------------------------- |
| **Unit**        | `.unit.test.ts` | `user.service.unit.test.ts`   |
| **Integration** | `.int.test.ts`  | `user.controller.int.test.ts` |

**Rules**

1. Every test file **must** end with the appropriate suffix (`.unit.test.ts` or `.int.test.ts`).
2. Do **not** mix unit and integration specs in the same file.
3. Filenames should start with the subject under test (e.g. `user.repository.int.test.ts`).
4. Avoid generic names like `index.unit.test.ts`—make the intent explicit.

### 5.3 Factories & Test Utilities

| Purpose                   | Location                                                 | Notes                                                           |
| ------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| **Domain object factory** | `src/__tests__/factories/<feature>.factory.ts`           | Pure object builders returning plain JS objects (no I/O).       |
| **Mongo doc factory**     | `src/__tests__/factories/mongo/<feature>.doc.factory.ts` | Optionally persists to an in‑memory / test DB when needed.      |
| **Shared test utils**     | `src/__tests__/utils/`                                   | E.g. DB setup/teardown, Kafka test harness, auth token helpers. |

*Factories must never hide assertions; they only create data. Use explicit values in assertions to avoid brittle tests.*

### 5.4 Unit Test Guidelines

* Mock all external side‑effects (DB, network, queues).
* Focus on deterministic, fast execution (<100 ms per test ideal).
* One behavior / scenario per `it()` block.

### 5.5 Integration Test Guidelines

* Use real adapters (Mongoose models, HTTP layer) against test containers or in‑memory servers.
* Reset DB state between tests (drop collections or use transactions when supported).
* Assert on observable outcomes (HTTP status, DB records, produced messages via spy/harness).

### 5.6 Coverage Targets

* Minimum 80% lines & branches global.
* Critical domain services ≥90% recommended.
* Exclude generated code or pure type declaration files via Jest config (`coveragePathIgnorePatterns`).

### 5.7 Lint & Formatting Enforcement

* Run `yarn lint` and `yarn test` in pre‑push or CI pipeline.
* Reject PRs lacking required suffix naming or missing test coverage for new code paths.

### 5.8 Example Jest Config Snippet

```ts
// jest.config.ts
export default {
  roots: ['<rootDir>/src/__tests__/'],
  testMatch: [
    '**/__tests__/**/?(*.)+(unit.test.ts|int.test.ts)',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/utils/jest.setup.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/index.ts',
    '!src/**/contracts/**',
    '!src/__tests__/**',
  ],
};
```

---

## 6  Codex Contribution Checklist ✅

  Codex Contribution Checklist ✅

When generating or editing code, **always**:

1. **Naming & Files**

   * Use `I*` for domain, `IM*` for persistence docs, `E*` for enums.
   * Place Mongoose schemas in `infrastructure/db/mongo/schema/`.
   * Place Mongoose models in `infrastructure/db/mongo/models/`.
   * External service clients in `infrastructure/external/services/`.
   * Event producers/consumers under `infrastructure/messaging/<event>/`.
   * Test factories under `src/__tests__/__factories__` or feature local `factories/` folders.
2. **Architecture**

   * Keep controllers thin—delegate to services.
   * Inject all dependencies via factories (`src/configurations/factory`).
3. **Quality**

   * Add/maintain tests in correct folder (`unit` vs `integration`) to keep coverage ≥ 80%.
   * Ensure ESLint & Prettier pass.
4. **Docs**

   * Update **REST API spec** in `src/contracts/openapi.yaml` when endpoints change **and** keep **Kafka messaging spec** updated in `src/contracts/asyncapi.yaml` whenever topics, messages, or schemas change.
5. **Always, before finish the coding, you must execute with success the following commands:**

   1. yarn prettier
   2. yarn lint
   3. yarn build
   4. yarn test
       

Follow this guide to ensure contributions are **consistent, testable, and production‑ready** — and easy for humans *and* AI assistants to understand.

---

## 7  Messaging Producer Checklist (Kafka)

When introducing **Kafka producer functionality**:

1. **Interface & Implementation** – Create an interface (`IJourneyProducerKafka`) + class (`JourneyProducerKafka`) inside `src/infrastructure/messaging/<event>/`.
2. **Service Integration** – Inject the producer interface via constructor in the related service (`src/domain/<context>/service/`).
3. **Factory Registration** – Register the concrete producer in the factory file (`src/configurations/factory/<context>.service.factory.ts`).
4. **Method Naming** – Use descriptive names like `scheduleUserJourneyExpiration(userJourneyId, endDate)`.
5. **Service Layer Calls** – Call producer methods *after* successful repository operations.
6. **Integration Tests** – Add tests under `src/__tests__/integration/<context>/controller/` using `jest.spyOn()` to assert invocation with correct parameters.

---

## 8  Layered Responsibilities & Route Conventions

### 8.1 Controller Layer

* Extract data from `req` and delegate to services.
* **No** business branching logic.
* Perform only basic presence validation.
* Map errors without embedding domain rules.

### 8.2 Service Layer

* Central hub for business rules and validations.
* Implement idempotency safeguards.
* Handle race conditions via DB constraints and translate DB errors into domain errors.

### 8.3 Repository Layer

* Provide thin CRUD wrappers.
* Do **not** embed domain logic.
* Rely on DB constraints (unique indexes, etc.) for integrity.

### 8.4 Route Naming

* Pattern: `/authorizers/{resource-name}/{action}` (adapt per bounded context).
* Use **kebab‑case** for multi‑word resource names.

### 8.5 Descriptive Naming

* Avoid generic names like `mapFunction`.
* Prefer intent‑revealing identifiers, e.g., `missionConditionHandlers`.

> Adhering to these conventions ensures clear separation of concerns, promotes maintainability, and simplifies testing.
