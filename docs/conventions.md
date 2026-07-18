# Code conventions

All examples below are real names from this repository. New features must
follow these patterns exactly. **Everything is written in English**: code,
variable names, comments, tests and documentation.

## File naming

Lowercase with dots as the type separator: `<feature>.<type>[.<variant>].ts`.

| File type | Pattern | Real example |
| --- | --- | --- |
| Entity | `<feature>.entity.ts` | `src/domain/user/user.entity.ts` |
| Domain interface | `<feature>.interface.ts` | `src/domain/user/interfaces/user.interface.ts` |
| Service interface | `<feature>.service.interface.ts` | `src/domain/user/interfaces/user.service.interface.ts` |
| Domain error | `<name>.error.ts` | `src/domain/errors/not-found.error.ts` |
| Shared domain type | `<name>.interface.ts` | `src/domain/common/pagination.interface.ts` |
| Repository contract | `<feature>.repository.read.ts` / `.write.ts` | `src/domain/user/repository/user.repository.read.ts` |
| Service | `<feature>.service.ts` | `src/domain/user/service/user.service.ts` |
| Repository implementation | `<feature>.repository.read.ts` / `.write.ts` | `src/infrastructure/repository/user/user.repository.write.ts` |
| DynamoDB table definition | `<feature>.table.ts` | `src/infrastructure/db/dynamo/tables/user.table.ts` |
| Controller | `<feature>.controller.ts` | `src/interfaces/http/controllers/user.controller.ts` |
| Controller interface | `controller.interface.ts` | `src/interfaces/http/controllers/controller.interface.ts` |
| Factory | `<feature>.<type>.factory.ts` | `src/infrastructure/config/factories/user.service.factory.ts` |
| Unit test | `<subject>.unit.test.ts` | `src/__tests__/unit/user.service.unit.test.ts` |
| Integration test | `<subject>.<action>.int.test.ts` | `src/__tests__/integration/user.create.int.test.ts` |

No exceptions — every file follows the pattern above.

## Symbol naming

| Symbol | Pattern | Real examples |
| --- | --- | --- |
| Domain interface | `I` + PascalCase | `IUser`, `IUserService`, `IController`, `IPagination` |
| Parameter interface | `IParams` + action/context | `IParamsCreateUser`, `IParamsUpdateUser`, `IParamsUserService` |
| Repository contract | `I<Feature>Repository<Read\|Write>` | `IUserRepositoryRead`, `IUserRepositoryWrite` |
| Persistence interface | `IM` + PascalCase, derived from the domain interface | `IMUser extends Omit<IUser, 'createdAt'>` (dates stored as ISO strings; lives in the table file) |
| Class | PascalCase, no prefix | `UserService`, `UserController`, `Server`, `User` |
| Factory | `<Feature><Type>Factory` | `UserServiceFactory`, `UserControllerFactory` |
| Table definition | camelCase + `TableDefinition` | `userTableDefinition: CreateTableCommandInput` |
| Item mappers | `to<Feature>` / `to<Feature>Item` | `toUser(item: IMUser): IUser`, `toUserItem(user: IUser): IMUser` |
| Variables/properties | camelCase | `userRepositoryRead`, `apiSpecLocation` |
| Constants | UPPER_SNAKE_CASE | `OPEN_API_SPEC_FILE_LOCATION`, `USER_TABLE_NAME`, `DEFAULT_LIST_LIMIT` |
| Enum (Agents.md, no example in code yet) | `E` + PascalCase, UPPER members | `EStatus.ACTIVE` |

Methods have intent-revealing names: `findUserByEmail`, `updateUserById`,
`listUsers` — never generic ones like `get` or `handle`.

## Code patterns

- **Always `async/await`**; never chained `.then()`.
- **Controllers**: methods as arrow function properties (`createUser = async (req, res, next) => {...}`),
  routes registered in `initRoutes()`, class implements `IController` and exposes `getRoutes(): Router`.
- **Controllers are thin**: extract data from `req`, call the service and map the
  success response. No business rules and no error mapping — errors go to `next(error)`.
- **Domain errors** in `src/domain/errors/`: `DomainError` (base, carries `status`),
  `NotFoundError` (404), `ConflictError` (409). Services throw these
  (`throw new NotFoundError('User not found')`) and **never** decide HTTP status;
  the central error handler in `server.ts` does the mapping. Do not re-wrap
  errors in `new Error(string)` — that loses the type and the stack.
- **Entities** implement their domain interface with `readonly` properties
  (immutability) and are instantiated by services.
- **JSDoc** on public methods of services, repositories and controllers
  (`@param`, `@returns`, `@throws`) — the pattern used across the `user` slice.
- **Type imports**: relative paths, no path aliases.

## HTTP responses (the `user` slice pattern)

All error responses follow the contract's `Error`/`ValidationError` schemas
(`{ message, status, ... }`) and are produced **only** by the central error handler:

| Situation | Status | Body | Origin |
| --- | --- | --- | --- |
| Created | 201 | created entity | controller |
| Read/updated | 200 | entity | controller |
| Deleted | 200 | `{ message: 'User deleted successfully' }` | controller |
| Invalid payload (contract) | 400 | `{ message, status, errors[] }` | OpenApiValidator → handler |
| Not found | 404 | `{ message: 'User not found', status: 404 }` | `NotFoundError` → handler |
| Conflict (e.g. duplicated email) | 409 | `{ message, status: 409 }` | `ConflictError` → handler |
| Unexpected error | 500 | `{ message: 'Internal Server Error', status: 500 }` | handler (with structured log) |

## OpenAPI contract (`src/contracts/service.yaml`)

Naming rules from the knowledge base (`playbooks/engineering/backend/contracts/CONTRACTS_LAYER.md`),
compatible with the current contract:

- Schemas/entities: PascalCase (`User`, `Error`)
- Properties: camelCase (`createdAt`, `email`)
- Route resources: kebab-case, plural (`/users`, `/user-profiles`) — this repo does not use an `/api` prefix
- Every endpoint documented with success **and** error examples; types with
  specific formats (`format: email`, `date-time`) and limits where applicable
- List endpoints take `limit`/`offset` query params with sensible bounds

## Style and tooling

- **Prettier**: `singleQuote: true`, `trailingComma: 'all'` (`.prettierrc`). Run `yarn prettier`.
- **ESLint 9 flat config** (`eslint.config.mjs`): `typescript-eslint` recommended;
  unused variables/args are only allowed with a `_` prefix.
- **TypeScript strict** (`tsconfig.json`): target es2016, CommonJS, `esModuleInterop`.
- **Husky**: `pre-commit` runs `yarn lint`; `commit-msg` runs commitlint
  (`commitlint.config.js`, based on the organization standard — KB types,
  lowercase subject, header ≤ 72 chars).

## Commits, branches and release

- **Conventional Commits required** — semantic-release parses messages to
  version (branches `main` and `stage`). Types and impact (full guide in
  `.cursor/rules/ai_knowledge_base/playbooks/engineering/code-versioning/commits/`):
  - `feat:` → minor · `fix:` → patch · `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:` → no bump
  - Format: `<type>[optional scope]: <description>` (e.g. `feat(user): add email uniqueness check`)
- **Branches**: `<type>/<kebab-case-description>` — `feature/add-user-authentication`,
  `bugfix/fix-login-error`, `hotfix/patch-security-issue`, `release/v1.2.0`.
- PRs via GitHub; merging into `main` triggers the release flow (CI uses `GITHUB_REF_NAME`).

## Comments

Organization knowledge base standard (`playbooks/engineering/backend/AGENTS.md`):

- Comment only when it adds real value — explain the **why**, never the obvious.
- Never leave commented-out code (dead code).
- Prefer self-documenting code: descriptive names, small functions, explicit types.

## Checklist before finishing any change

```bash
yarn prettier && yarn lint && yarn build && yarn test
```

All four commands must pass. `yarn test` runs unit + integration.
