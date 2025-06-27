# `Agents.md` – Standards & TypeScript Stubs for Node.js + TypeScript REST APIs

This guide defines **architecture, naming conventions, folder layout, testing, linting, and code stubs** so that developers *and* AI agents (e.g. Codex, Copilot) can contribute to any Node.js + TypeScript REST‑API repository in a predictable, maintainable way.

---

## 1  Folder Structure (Recommended)

| Layer              | Path                                          | Purpose / Examples                                                                                                         |
| ------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Domain**         | `src/domain`                                  | Pure business logic: entity interfaces (`IUser`), DTOs, service & repository contracts (`IUserService`, `IUserRepository`) |
| **Application**    | `src/application`                             | Express/Fastify controllers, GraphQL resolvers, background workers                                                         |
| **Infrastructure** | `src/infrastructure`                          | External concerns: database, cache, messaging, HTTP clients, cloud SDKs                                                    |
|   └─ DB (Mongo)    | `src/infrastructure/db/mongo/{schema,models}` | Mongoose schemas & models                                                                                                  |
|   └─ Messaging     | `src/infrastructure/messaging/<event>`        | Kafka/Rabbit producers & consumers                                                                                         |
|   └─ Services      | `src/infrastructure/external/services`        | HTTP/GRPC clients for third‑party APIs                                                                                     |
| **Configuration**  | `src/configurations`                          | Dependency‑injection factories, env loaders, feature flags                                                                 |
| **Contracts**      | `src/contracts`                               | OpenAPI / Swagger YAML or JSON                                                                                             |
| **Tests**          | `tests`                                       | Unit + integration tests (mirrors src layout)                                                                              |

> **Tip:** adjust path casing (`infrastructure` vs `infraestructure`) to your team’s preference—stay consistent.

---

## 2  Naming Conventions

### 2.1 Interfaces & Enums

| Type                                    | Prefix | Casing | Example                                    |
| --------------------------------------- | ------ | ------ | ------------------------------------------ |
| **Domain interface**                    | `I`    | Pascal | `IUser`, `IOrderService`                   |
| **Persistence interface** (Mongo model) | `IM`   | Pascal | `IMUser`, `IMOrder`                        |
| **Enum**                                | `E`    | Pascal | `EStatus` with members `ACTIVE`, `PENDING` |

Other rules

* **Classes / functions** → PascalCase / camelCase (no prefix).
* **Variables / properties** → `camelCase`.
* **Constants** → `UPPER_SNAKE_CASE` (e.g. `JWT_SECRET`).

### 2.2 IM Interfaces Pattern

Persistence documents often need Mongo‑specific fields (`_id: ObjectId`, `createdAt`, etc.). Model interfaces therefore **extend** or **wrap** domain interfaces:

```ts
import { IUser } from "../../domain/user/interfaces/user.interface";

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
  './contracts/your-service.yaml',
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
* Export only what’s necessary for tests (e.g., `app` or `Server` instance).
  Avoid leaking worker threads globally.

### 4.2 Factory Directory Structure Factory Directory Structure

| Artifact Type                 | Recommended Path & Naming                                        | Example File                                                      |
| ----------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Controller Factory**        | `src/configurations/factory/<feature>.controller.factory.ts`     | `src/configurations/factory/appointment.controller.factory.ts`    |
| **Service Factory**           | `src/configurations/factory/<feature>.service.factory.ts`        | `src/configurations/factory/appointment.service.factory.ts`       |
| **Worker / Consumer Factory** | `src/configurations/factory/messaging/<event>.worker.factory.ts` | `src/configurations/factory/messaging/consumer.worker.factory.ts` |

**Rules**

1. Factories live **only** under `src/configurations/factory` to keep the composition‑root logic centralized.
2. Messaging‑related worker factories are nested inside `factory/messaging` for quick discoverability.
3. Each factory exposes a static `create()` method returning the fully wired instance.
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

---

## 6  Codex Contribution Checklist ✅

When generating or editing code, **always**:

1. **Naming & Files**

   * Use `I*` for domain, `IM*` for persistence docs, `E*` for enums.
   * Place Mongoose schemas in `infrastructure/db/mongo/schema/`.
   * Place Mongoose models in `infrastructure/db/mongo/models/`.
   * Locate external service clients in `infrastructure/external/services/`.
   * Put event producers/consumers under `infrastructure/messaging/<event>/`.
2. **Architecture**

   * Keep controllers thin—delegate to services.
   * Inject all dependencies via factories (`src/configurations`).
3. **Quality**

   * Add/maintain tests (`tests/`) to keep coverage ≥ 80 %.
   * Pass ESLint & Prettier.
4. **Docs**

   * Update OpenAPI specs in `src/contracts` as endpoints change.

Follow this guide to ensure contributions are **consistent, testable, and production‑ready** — and easy for humans *and* AI assistants to understand.

---

## 7  Messaging Producer Checklist (Kafka)

When introducing **Kafka producer functionality**:

1. **Interface & Implementation**
   *Create* an interface (`IJourneyProducerKafka`) and a concrete class (`JourneyProducerKafka`) inside `src/infrastructure/messaging/<event>/`.
2. **Service Integration**
   Inject the producer interface via constructor dependency injection inside the related service located at `src/domain/<context>/service/`.
3. **Factory Registration**
   Register the concrete producer in the corresponding factory file (e.g. `src/configurations/factory/<context>/service.factory.ts`).
4. **Method Naming**
   Use descriptive names such as `scheduleUserJourneyExpiration(userJourneyId, endDate)`.
5. **Service Layer Calls**
   Call producer methods *after* successful repository operations (e.g. `await this.repository.create(...)`).
6. **Integration Tests**
   Add tests under `tests/integration/<context>/controller/` with `jest.spyOn()` to assert that the producer method is executed with the correct parameters.

---

## 8  Layered Responsibilities & Route Conventions

### 8.1 Controller Layer

* Extract data from `req` and delegate to services.
* **No** conditional or business logic.
* Perform only basic presence validation.
* Map errors without embedding business branches.

### 8.2 Service Layer

* Central hub for business rules and validations.
* Implement idempotency safeguards.
* Handle race conditions through DB constraints and translate DB errors into domain errors.

### 8.3 Repository Layer

* Provide thin CRUD wrappers.
* Do **not** embed domain logic.
* Rely on DB constraints (unique indexes, etc.) for integrity enforcement.

### 8.4 Route Naming

* Pattern: `/authorizers/{resource-name}/{action}`.
* Use **kebab‑case** for multi‑word resource names.

### 8.5 Descriptive Naming

* Avoid generic names like `mapFunction`.
* Prefer intent‑revealing identifiers, e.g., `missionConditionHandlers`.

> Adhering to these conventions ensures clear separation of concerns, promotes maintainability, and simplifies testing.
