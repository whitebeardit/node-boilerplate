# Convenções de código

Todos os exemplos abaixo são nomes reais do repositório. Novas features devem
seguir exatamente estes padrões.

## Nomenclatura de arquivos

Minúsculas com pontos como separador de tipo: `<feature>.<tipo>[.<variante>].ts`.

| Tipo de arquivo | Padrão | Exemplo real |
| --- | --- | --- |
| Entity | `<feature>.entity.ts` | `src/domain/user/user.entity.ts` |
| Interface de domínio | `<feature>.interface.ts` | `src/domain/user/interfaces/user.interface.ts` |
| Interface de service | `<feature>.service.interface.ts` | `src/domain/user/interfaces/user.service.interface.ts` |
| Erro de domínio | `<nome>.error.ts` | `src/domain/errors/not-found.error.ts` |
| Contrato de repositório | `<feature>.repository.read.ts` / `.write.ts` | `src/domain/user/repository/user.repository.read.ts` |
| Service | `<feature>.service.ts` | `src/domain/user/service/user.service.ts` |
| Implementação de repositório | `<feature>.repository.read.ts` / `.write.ts` | `src/infrastructure/repository/user/user.repository.write.ts` |
| Schema Mongoose | `<feature>.schema.ts` | `src/infrastructure/db/mongo/schema/user.schema.ts` |
| Model Mongoose | `<feature>.model.ts` | `src/infrastructure/db/mongo/models/user.model.ts` |
| Controller | `<feature>.controller.ts` | `src/interfaces/http/controllers/user.controller.ts` |
| Factory | `<feature>.<tipo>.factory.ts` | `src/infrastructure/config/factories/user.service.factory.ts` |
| Teste unitário | `<assunto>.unit.test.ts` | `src/__tests__/unit/telemetry.unit.test.ts` |
| Teste de integração | `<assunto>.<ação>.int.test.ts` | `src/__tests__/integration/user.create.int.test.ts` |

Exceção histórica: `src/interfaces/http/controllers/IController.ts` (PascalCase).
Não criar novas exceções.

## Nomenclatura de símbolos

| Símbolo | Padrão | Exemplos reais |
| --- | --- | --- |
| Interface de domínio | `I` + PascalCase | `IUser`, `IUserService`, `IController` |
| Interface de parâmetros | `IParams` + ação/contexto | `IParamsCreateUser`, `IParamsUpdateUser`, `IParamsUserService` |
| Contrato de repositório | `I<Feature>Repository<Read\|Write>` | `IUserRepositoryRead`, `IUserRepositoryWrite` |
| Classe | PascalCase, sem prefixo | `UserService`, `UserController`, `Server`, `User` |
| Factory | `<Feature><Tipo>Factory` | `UserServiceFactory`, `UserControllerFactory` |
| Model Mongoose | `M` + minúscula | `Muser` |
| Schema Mongoose | camelCase + `Schema` | `userSchema` |
| Variáveis/propriedades | camelCase | `userRepositoryRead`, `apiSpecLocation` |
| Constantes | UPPER_SNAKE_CASE | `OPEN_API_SPEC_FILE_LOCATION`, `TWENTY_SECONDS_OF_TIMEOUT` |
| Enum (Agents.md, ainda sem exemplo no código) | `E` + PascalCase, membros UPPER | `EStatus.ACTIVE` |

Métodos com nomes que revelam intenção: `findUserByEmail`, `updateUserById`,
`listUsers` — nunca genéricos como `get` ou `handle`.

## Padrões de código

- **Sempre `async/await`** com `try/catch`; nunca `.then()` encadeado.
- **Controllers**: métodos como *arrow function properties* (`createUser = async (req, res) => {...}`),
  rotas registradas em `initRoutes()`, classe implementa `IController` e expõe `getRoutes(): Router`.
- **Controllers são finos**: extraem dados do `req`, chamam o service e mapeiam a resposta.
  Sem regra de negócio.
- **Erros de domínio** em `src/domain/errors/`: `DomainError` (base, carrega `status`),
  `NotFoundError` (404), `ConflictError` (409). Services lançam esses erros
  (`throw new NotFoundError('User not found')`) e **nunca** decidem status HTTP;
  o error handler central em `server.ts` faz o mapeamento. Controllers apenas
  repassam com `next(error)`. Não re-embrulhar erros em `new Error(string)` —
  isso perde tipo e stack.
- **JSDoc** nos métodos públicos de services, repositórios e controllers
  (`@param`, `@returns`) — padrão observado em todo o slice `user`.
- **Import de tipos**: caminhos relativos, sem aliases de path.

## Respostas HTTP (padrão do slice `user`)

Todas as respostas de erro seguem os schemas `Error`/`ValidationError` do contrato
(`{ message, status, ... }`) e são produzidas **somente** pelo error handler central:

| Situação | Status | Body | Origem |
| --- | --- | --- | --- |
| Criação com sucesso | 201 | entidade criada | controller |
| Leitura/atualização com sucesso | 200 | entidade | controller |
| Deleção com sucesso | 200 | `{ message: 'User deleted successfully' }` | controller |
| Payload inválido (contrato) | 400 | `{ message, status, errors[] }` | OpenApiValidator → handler |
| Não encontrado | 404 | `{ message: 'User not found', status: 404 }` | `NotFoundError` → handler |
| Conflito (ex.: email duplicado) | 409 | `{ message, status: 409 }` | `ConflictError` → handler |
| Erro inesperado | 500 | `{ message: 'Internal Server Error', status: 500 }` | handler (com log estruturado) |

## Contrato OpenAPI (`src/contracts/service.yaml`)

Regras de nomenclatura do knowledge base (`backend/contracts/CONTRACTS_LAYER.md`),
compatíveis com o contrato atual:

- Schemas/entidades: PascalCase (`User`, `Error`)
- Propriedades: camelCase (`createdAt`, `email`)
- Recursos de rota: kebab-case no plural (`/users`, `/user-profiles`) — este repo não usa prefixo `/api`
- Todo endpoint documentado com exemplos de sucesso **e** erro; tipos com formatos
  específicos (`format: email`, `date-time`) e limites quando aplicável

## Estilo e ferramentas

- **Prettier**: `singleQuote: true`, `trailingComma: 'all'` (`.prettierrc`). Rodar `yarn prettier`.
- **ESLint 9 flat config** (`eslint.config.mjs`): `typescript-eslint` recommended;
  variáveis/args não usados só são permitidos com prefixo `_`.
- **TypeScript strict** (`tsconfig.json`): target es2016, CommonJS, `esModuleInterop`.
- **Husky pre-commit**: roda `yarn lint`.

## Commits, branches e release

- **Conventional Commits obrigatório** — o semantic-release analisa as mensagens para
  versionar (branches `main` e `stage`). Tipos e impacto (guia completo em
  `.cursor/rules/ai_knowledge_base/code-versioning/commits/`):
  - `feat:` → minor · `fix:` → patch · `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:` → sem bump
  - Formato: `<type>[scope opcional]: <descrição>` (ex.: `feat(user): add email uniqueness check`)
- **Branches**: `<type>/<descrição-kebab-case>` — `feature/add-user-authentication`,
  `bugfix/fix-login-error`, `hotfix/patch-security-issue`, `release/v1.2.0`.
- PRs via GitHub; merge em `main` dispara o fluxo de release (CI usa `GITHUB_REF_NAME`).

## Comentários

Padrão do knowledge base da organização (`backend/AGENTS.md`):

- Comentar apenas quando agrega valor real — explicar o **porquê**, nunca o óbvio.
- Nunca deixar código comentado (dead code).
- Preferir código autoexplicativo: nomes descritivos, funções pequenas, tipos explícitos.

## Checklist antes de finalizar qualquer alteração

```bash
yarn prettier && yarn lint && yarn build && yarn test
```

Os quatro comandos precisam passar. `yarn test` roda unit + integração.
