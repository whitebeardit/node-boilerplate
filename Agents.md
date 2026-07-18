# `Agents.md` – Standards & TypeScript Stubs for Node.js + TypeScript REST APIs

This guide defines **architecture, naming conventions, folder layout, testing,
linting, observability and code stubs** so that developers *and* AI agents can
contribute to any Node.js + TypeScript REST-API repository in a predictable,
maintainable way. The `node-boilerplate` repository is the **reference
implementation** of this standard — every stub below mirrors its real code.

---

## 1  Folder Structure

| Layer / Category | Path | Purpose / Examples |
| --- | --- | --- |
| **Domain** | `src/domain/<feature>/` | Pure business logic per feature: entity, interfaces, repository contracts, service |
| ├─ Interfaces | `src/domain/<feature>/interfaces/` | `I<Feature>`, `I<Feature>Service`, `IParams*` |
| ├─ Repository contracts | `src/domain/<feature>/repository/` | `I<Feature>RepositoryRead`, `I<Feature>RepositoryWrite` |
| ├─ Service | `src/domain/<feature>/service/` | `<Feature>Service implements I<Feature>Service` |
| ├─ Entity | `src/domain/<feature>/<feature>.entity.ts` | `<Feature> implements I<Feature>` with `readonly` props |
| **Domain errors** | `src/domain/errors/` | `DomainError` (base with `status`), `NotFoundError` (404), `ConflictError` (409) |
| **Shared domain types** | `src/domain/common/` | Cross-feature types (e.g. `IPagination`) |
| **HTTP layer** | `src/interfaces/http/` | `server.ts` (Express + middlewares + central error handler) |
| ├─ Controllers | `src/interfaces/http/controllers/` | Thin adapters implementing `IController` (`controller.interface.ts`) |
| **Infrastructure** | `src/infrastructure/` | External concerns |
| ├─ Repository implementations | `src/infrastructure/repository/<feature>/` | Same file names as the domain contracts |
| ├─ DB (Mongo) | `src/infrastructure/db/mongo/{schema,models}/` | Typed Mongoose schemas (`Schema<IM*>`) & models (`model<IM*>`) |
| ├─ Config | `src/infrastructure/config/` | `env.ts` (fail-fast env validation) |
| ├─ Factories (composition root) | `src/infrastructure/config/factories/` | `<feature>.controller.factory.ts`, `<feature>.service.factory.ts` |
| ├─ Telemetry | `src/infrastructure/telemetry/` | OpenTelemetry SDK bootstrap + trace-context log injection |
| ├─ Messaging *(when needed)* | `src/infrastructure/messaging/<event>/` | Kafka/Rabbit producers & consumers |
| ├─ External services *(when needed)* | `src/infrastructure/external/services/` | HTTP/GRPC clients for third-party APIs |
| **Contracts** | `src/contracts/service.yaml` | OpenAPI 3.0 spec — validated at runtime (requests **and** responses) |
| **Tests** | `src/__tests__/{unit,integration}/` | Mandatory suffixes `.unit.test.ts` / `.int.test.ts` |
| **Test bootstrap** | `jest/` (outside `src/`) | Jest configs, mongodb-memory-server setup |
| **Entry point** | `src/main.ts` | Telemetry import (first line) → env → `Server` → graceful shutdown |
| **Root config** | `./` | `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `commitlint.config.js`, `.env.example`, `Dockerfile`, `.github/workflows/ci.yml` |

> **Tip:** Keep *all* composition (wiring actual implementations) in
> `src/infrastructure/config/factories` to maintain a clear separation from
> pure domain logic.

---

## 2  Naming Conventions

### 2.1 Files

Lowercase with dots as the type separator — `<feature>.<type>[.<variant>].ts`:
`user.service.ts`, `user.repository.read.ts`, `user.controller.factory.ts`,
`controller.interface.ts`, `not-found.error.ts`. **No exceptions.**

### 2.2 Interfaces & Enums

| Type | Prefix | Casing | Example |
| --- | --- | --- | --- |
| **Domain interface** | `I` | Pascal | `IUser`, `IUserService`, `IPagination` |
| **Parameter object** | `IParams` | Pascal | `IParamsCreateUser`, `IParamsUserService` |
| **Persistence interface** (Mongo) | `IM` | Pascal | `IMUser extends IUser` |
| **Enum** | `E` | Pascal | `EStatus` with members `ACTIVE`, `PENDING` |

Other rules:

* **Classes / functions** → PascalCase / camelCase (no prefix).
* **Variables / properties** → `camelCase`.
* **Constants** → `UPPER_SNAKE_CASE` (e.g. `DEFAULT_LIST_LIMIT`).
* **Everything in English** — code, comments, tests, docs and commit messages.

### 2.3 IM Interfaces Pattern

Persistence documents need Mongo-specific fields. The `IM*` interface extends
the domain interface and lives **in the schema file** (not the model file) to
keep the schema → model import direction free of cycles:

```ts
// src/infrastructure/db/mongo/schema/user.schema.ts
import mongoose, { Types } from 'mongoose';
import { IUser } from '../../../../domain/user/interfaces/user.interface';

export interface IMUser extends IUser {
  _id: Types.ObjectId;
}

export const userSchema = new mongoose.Schema<IMUser>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, required: true, default: Date.now },
});
```

```ts
// src/infrastructure/db/mongo/models/user.model.ts
import mongoose from 'mongoose';
import { IMUser, userSchema } from '../schema/user.schema';

export const Muser = mongoose.model<IMUser>('user', userSchema);
```

Models are prefixed with `M` (`Muser`). Repositories return plain domain
objects: reads use `.lean<IUser>()` with a projection that hides `_id`/`__v`.

---

## 3  Code Stubs

### 3.1 Domain (Interfaces & Repository Contracts)

```ts
// src/domain/user/interfaces/user.interface.ts
export interface IUser {
  id: string; // exposed id (string — not the Mongo ObjectId)
  name: string;
  email: string;
  createdAt: Date;
}
```

```ts
// src/domain/user/repository/user.repository.read.ts
export interface IUserRepositoryRead {
  findUserByEmail(email: string): Promise<IUser | null>;
  findUserById(id: string): Promise<IUser | null>;
  listUsers(filter: Partial<IUser>, pagination: IPagination): Promise<IUser[]>;
}
```

Write contracts live in `user.repository.write.ts` (`IUserRepositoryWrite`).
The read/write split keeps queries and mutations separately swappable.

### 3.2 Domain Errors

```ts
// src/domain/errors/domain.error.ts
export class DomainError extends Error {
  public readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}
```

`NotFoundError` (404) and `ConflictError` (409) extend it. Services throw these
typed errors; **only** the central error handler in `server.ts` maps them to
HTTP responses in the contract shape (`{ message, status }`).

### 3.3 Service (business rules)

```ts
// src/domain/user/service/user.service.ts
export class UserService implements IUserService {
  constructor({ userRepositoryRead, userRepositoryWrite }: IParamsUserService) { ... }

  async createUser(params: IParamsCreateUser): Promise<IUser> {
    const existingUser = await this.userRepositoryRead.findUserByEmail(params.email);
    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }
    const user = new User(params.id, params.name, params.email, params.createdAt);
    return this.userRepositoryWrite.createUser(user);
  }
}
```

Never re-wrap errors in `new Error(string)` — that loses the type and stack.

### 3.4 Controller (thin adapter)

```ts
// src/interfaces/http/controllers/user.controller.ts
export class UserController implements IController {
  constructor(private readonly userService: IUserService) { ... } // interface, not class

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newUser = await this.userService.createUser({ ...req.body });
      res.status(201).json(newUser);
    } catch (error) {
      next(error); // central error handler answers in contract shape
    }
  };
}
```

---

## 4  Dependency Injection (Factories)

| Artifact | Path & Naming | Example |
| --- | --- | --- |
| **Controller factory** | `src/infrastructure/config/factories/<feature>.controller.factory.ts` | `UserControllerFactory` |
| **Service factory** | `src/infrastructure/config/factories/<feature>.service.factory.ts` | `UserServiceFactory` |
| **Worker factory** *(when needed)* | `src/infrastructure/config/factories/messaging/<event>.worker.factory.ts` | `ConsumerWorkerFactory` |

```ts
export class UserServiceFactory {
  static create() {
    return new UserService({
      userRepositoryRead: new UserRepositoryRead(),
      userRepositoryWrite: new UserRepositoryWrite(),
    });
  }
}
```

**Rules**

1. Factories live **only** under `src/infrastructure/config/factories`.
2. Each factory exposes a static `create()` returning the fully wired instance.
3. Factories must *never* perform I/O at module-load time.

### 4.1 Application Bootstrap (`src/main.ts`)

```ts
// OpenTelemetry must load before any instrumented module — keep as first line.
import './infrastructure/telemetry/tracing';
import { env } from './infrastructure/config/env'; // fail-fast validation

const app = new Server({
  port: env.port,
  controllers: [UserControllerFactory.create()],
  databaseURI: env.databaseUri,
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
});

async function start() {
  await app.databaseSetup();
  const httpServer = app.listen();
  // graceful shutdown: SIGTERM/SIGINT → close server → close db → exit 0
}

start().catch((error) => {
  Logger.error((error as Error).message, { eventName: 'app.bootstrap_error' });
  process.exit(1);
});
```

Order: **telemetry → env → database → HTTP server → background workers**.
Bootstrap-phase I/O happens **inside** `start()`, never at module load.

---

## 5  Observability

* **Never `console.log`** — always `import { Logger } from 'traceability'`.
* Every log carries structured metadata:
  `Logger.info('User created', { eventName: 'user.created', userId })`.
  Never `JSON.stringify` inside the message.
* OpenTelemetry (`src/infrastructure/telemetry/`) auto-instruments Express,
  Mongoose and HTTP. Every log emitted inside a span automatically gains
  `trace_id`/`span_id`/`trace_flags` alongside the legacy `cid`.
* Tests run with `OTEL_SDK_DISABLED=true`.

---

## 6  Testing & Linting Standards

| Tool | Purpose | Command (yarn) |
| --- | --- | --- |
| **Jest** | Unit + integration tests | `yarn test` |
| **Coverage** | ≥ 80% lines/branches on the **merged** report (nyc) | `yarn test:coverage` |
| **ESLint** | Linting (flat config) | `yarn lint` / `yarn lint:fix` |
| **Prettier** | Formatting | `yarn prettier` |
| **commitlint** | Conventional Commits (husky `commit-msg`) | automatic on commit |

### 6.1 Test File Naming (MANDATORY)

| Test type | Suffix | Example |
| --- | --- | --- |
| **Unit** | `.unit.test.ts` | `user.service.unit.test.ts` |
| **Integration** | `.int.test.ts` | `user.create.int.test.ts` |

1. Filenames start with the subject under test; never generic names.
2. Do not mix unit and integration specs in one file.
3. Blocks read `describe('When we ...')` / `it('should ...')`.

### 6.2 Guidelines

* **Unit**: mock all side-effects via the `I*` contracts (`jest.Mocked<I*>`);
  deterministic, <100ms per test.
* **Integration**: real HTTP through supertest against the `Server` from
  `jest/setup-integration-tests.ts`; mongodb-memory-server (no local Mongo);
  data persists across suites — use unique ids/emails; assert Mongo internals
  do not leak (`expect(body._id).toBeUndefined()`).
* Coverage is enforced on the merged unit+int report because each suite covers
  different layers; runtime bootstrap (`main.ts`, telemetry SDK) is excluded.

---

## 7  Contribution Checklist ✅

When generating or editing code, **always**:

1. **Naming & files** — `I*` domain, `IM*` persistence (in the schema file),
   `E*` enums, `M*` models; files lowercase-with-dots.
2. **Architecture** — thin controllers (`next(error)`), business rules and
   typed domain errors in services, thin repositories, wiring only in factories.
3. **Contract-first** — update `src/contracts/service.yaml` in the same change
   as any endpoint/payload edit (requests *and* responses are validated).
4. **Register twice** — new controllers go in `src/main.ts` **and**
   `src/__tests__/configApp.ts`.
5. **Quality gates** — before finishing, run with success:

   ```bash
   yarn prettier && yarn lint && yarn build && yarn test
   ```

---

## 8  Layered Responsibilities & Route Conventions

### 8.1 Controller layer
* Extract data from `req`, delegate to services, map only success responses.
* **No** business branching and **no** error-to-status mapping (`next(error)`).

### 8.2 Service layer
* Central hub for business rules; throws typed domain errors.
* Handle race conditions via DB constraints (unique indexes) and translate DB
  conflicts into domain errors.

### 8.3 Repository layer
* Thin CRUD wrappers; no domain logic, no try/catch re-wrapping.
* Return plain domain objects (`.lean<IUser>()` + projection hiding `_id`/`__v`).

### 8.4 Route naming
* Resources in **kebab-case**, plural, no `/api` prefix: `/users`,
  `/user-profiles`. List endpoints take `limit`/`offset` query params.

### 8.5 Descriptive naming
* Prefer intent-revealing identifiers (`findUserByEmail`), never generic ones.

---

## 9  Messaging Producer Checklist (Kafka) *(when the project adds messaging)*

1. **Interface & implementation** — `I<Event>ProducerKafka` + class inside `src/infrastructure/messaging/<event>/`.
2. **Service integration** — inject the producer interface via constructor.
3. **Factory registration** — wire it in `src/infrastructure/config/factories/<feature>.service.factory.ts`.
4. **Contract** — keep `src/contracts/asyncapi.yaml` updated with topics and schemas.
5. **Service-layer calls** — call producers *after* successful repository operations.
6. **Tests** — integration tests assert invocation via `jest.spyOn()`.

---

Follow this guide to ensure contributions are **consistent, testable, and
production-ready** — and easy for humans *and* AI agents to understand.
