# CLAUDE.md

Guia de orientação para o Claude Code evoluir este projeto. **O código real prevalece
sobre qualquer documento** (inclusive `Agents.md` — ver "Divergências conhecidas").

## O que é

Boilerplate de REST API em Node.js 20 + TypeScript (strict, CommonJS) com Clean
Architecture, contract-first (OpenAPI valida request **e** response em runtime),
MongoDB via Mongoose, observabilidade com OpenTelemetry + logs estruturados
(winston via lib `traceability`) com `trace_id` em cada linha de log.

## Comandos

```bash
yarn dev            # ts-node-dev com --env-file=.env
yarn build          # tsc + copia src/contracts/*.yaml para dist (copy-essentials)
yarn start          # node dist/src/main.js
yarn test:unit      # jest, apenas *.unit.test.ts
yarn test:int       # jest --runInBand, apenas *.int.test.ts (usa mongodb-memory-server; não precisa de Mongo local)
yarn lint           # eslint
yarn prettier       # prettier --write em src/
```

**Checklist obrigatório antes de entregar qualquer alteração** (Agents.md §6.5):

```bash
yarn prettier && yarn lint && yarn build && yarn test
```

## Mapa de camadas

| Caminho | Responsabilidade |
| --- | --- |
| `src/domain/<feature>/` | Lógica de negócio pura (sem I/O): entity, interfaces, contratos de repositório, service |
| `src/domain/errors/` | Erros de domínio (`DomainError`, `NotFoundError` 404, `ConflictError` 409) — mapeados para HTTP pelo error handler central do `server.ts` |
| `src/interfaces/http/` | `server.ts` (Express + middlewares) e `controllers/` (adaptadores HTTP finos) |
| `src/infrastructure/repository/<feature>/` | Implementações dos contratos de repositório (Mongoose) |
| `src/infrastructure/db/mongo/{schema,models}/` | Schemas e models Mongoose |
| `src/infrastructure/config/factories/` | Composition root — DI manual via factories estáticas |
| `src/infrastructure/telemetry/` | OpenTelemetry (`tracing.ts`) e injeção de trace context no logger (`logger.ts`) |
| `src/contracts/service.yaml` | OpenAPI 3.0.2 — fonte de verdade da API, validada em runtime |
| `src/__tests__/{unit,integration}/` | Testes (sufixos obrigatórios `.unit.test.ts` / `.int.test.ts`) |
| `src/main.ts` | Entry point: importa telemetria (1ª linha), instancia `Server` com factories |

**Regra de dependência:** `domain` não importa nada de `infrastructure` nem de
`interfaces`. Controllers delegam para services; services recebem repositórios via
construtor (objeto `IParams*`); composição acontece **somente** nas factories.

## Adicionando uma feature (ordem exata, espelhe o slice `user`)

1. `src/domain/<feature>/interfaces/<feature>.interface.ts` — `I<Feature>`
2. `src/domain/<feature>/interfaces/<feature>.service.interface.ts` — `I<Feature>Service`, `IParamsCreate<Feature>`, `IParams<Feature>Service`…
3. `src/domain/<feature>/repository/<feature>.repository.read.ts` e `.write.ts` — contratos `I<Feature>RepositoryRead/Write`
4. `src/domain/<feature>/<feature>.entity.ts` — classe `<Feature>`
5. `src/domain/<feature>/service/<feature>.service.ts` — `<Feature>Service implements I<Feature>Service`; regras de negócio lançam erros de `src/domain/errors/` (`NotFoundError`, `ConflictError`) — nunca decidir status HTTP no service
6. `src/infrastructure/db/mongo/schema/<feature>.schema.ts` — `export const <feature>Schema`
7. `src/infrastructure/db/mongo/models/<feature>.model.ts` — `export const M<feature>` (ex.: `Muser`)
8. `src/infrastructure/repository/<feature>/<feature>.repository.read.ts` e `.write.ts` — implementações (mesmos nomes de arquivo dos contratos, diretórios diferentes)
9. `src/interfaces/http/controllers/<feature>.controller.ts` — `<Feature>Controller implements IController`, recebe `I<Feature>Service` (a interface, não a classe); erros vão para `next(error)` — o error handler central responde no formato do contrato
10. `src/infrastructure/config/factories/<feature>.service.factory.ts` e `<feature>.controller.factory.ts` — `static create()`
11. Registrar o controller em **dois lugares**: `src/main.ts` e `src/__tests__/configApp.ts`
12. Atualizar `src/contracts/service.yaml` com os novos endpoints (request e response)
13. Testes: `src/__tests__/unit/<feature>.*.unit.test.ts` e `src/__tests__/integration/<feature>.*.int.test.ts`

Detalhes em [docs/architecture.md](docs/architecture.md).

## Convenções críticas (resumo)

- Arquivos: minúsculas com pontos — `user.service.ts`, `user.repository.read.ts`, `user.controller.factory.ts`. Exceção existente: `IController.ts`.
- Interfaces com prefixo `I` (`IUser`, `IUserService`, `IController`); parâmetros de construtor/método como `IParams*` (`IParamsCreateUser`, `IParamsUserService`).
- Models Mongoose com prefixo `M` (`Muser`); schemas em camelCase (`userSchema`).
- Constantes em `UPPER_SNAKE_CASE` (`OPEN_API_SPEC_FILE_LOCATION`).
- Testes: `describe('When we ...')` / `it('should ...')`.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`) — exigido pelo semantic-release.
- Tabela completa em [docs/conventions.md](docs/conventions.md).

## Observabilidade (regras duras)

- **Nunca** usar `console.log`. Sempre `import { Logger } from 'traceability'`.
- Todo log com metadata estruturada: `Logger.info('mensagem', { eventName: 'user.created', ... })`. **Nunca** `JSON.stringify` dentro da message.
- O `import './infrastructure/telemetry/tracing'` **deve ser a primeira linha** de `src/main.ts` — a auto-instrumentação precisa carregar antes de express/mongoose.
- Cada linha de log emitida dentro de um request/span ganha `trace_id`, `span_id` e `trace_flags` automaticamente (formato winston em `src/infrastructure/telemetry/logger.ts`), além do `cid` legado do `traceability`.
- Testes rodam com `OTEL_SDK_DISABLED=true` (definido em `.env.test`).
- Detalhes e como criar spans manuais em [docs/observability.md](docs/observability.md).

## Pitfalls

- `service.yaml` valida **request e response** (`validateResponses: true`): endpoint novo ou campo novo sem atualizar o contrato → erro em runtime (400/500).
- Rotas não descritas no contrato são rejeitadas pelo validator (`/health` funciona porque é registrada antes dos middlewares).
- O build precisa do `copy-essentials` (yaml não é compilado pelo tsc) — já embutido em `yarn build`.
- Teste de integração só enxerga controllers registrados em `src/__tests__/configApp.ts`.
- Commits passam pelo commitlint (hook `commit-msg` do husky): tipo obrigatório, subject em minúsculas, header ≤ 72 chars.
- `release.config.js` chama `./setup/set-version.sh`, que não existe no repo (só roda em CI com `GITHUB_REF_NAME`).
- Variáveis de ambiente obrigatórias são validadas em `src/infrastructure/config/env.ts` (fail-fast no boot) — ler env por lá, não via `process.env` espalhado.

## Divergências conhecidas: padrões da organização × código real

`Agents.md` (raiz) e o knowledge base em `.cursor/rules/ai_knowledge_base/`
(submodule — inicializar com `git submodule update --init`) descrevem o padrão
**genérico** da organização whitebeardit. Todo acesso ao GitHub é via **SSH**: o
`.gitmodules` usa URL HTTPS, mas o git local tem o rewrite global
`url."git@github.com:".insteadOf "https://github.com/"` — nunca usar HTTPS com
credenciais para operações git. Onde divergirem deste
repositório, **siga o código real**:

| Padrão da organização diz | Código real deste repo |
| --- | --- |
| Factories em `src/configurations/factory/` | `src/infrastructure/config/factories/` |
| Controllers em `src/application/` (com DTOs, middlewares, validators) | `src/interfaces/http/controllers/` — sem DTOs (validação contract-first via OpenAPI) |
| Domínio agrupado por tipo: `src/domain/{entity,repository,services}/interfaces/` | Domínio por feature: `src/domain/<feature>/{interfaces,repository,service}/` |
| Infra: `src/infrastructure/database/mongo/{models,schemas,repositories}/` | `src/infrastructure/db/mongo/{models,schema}/` + `src/infrastructure/repository/<feature>/` |
| Repositório único `IUserRepository` | Read/write split: `IUserRepositoryRead` + `IUserRepositoryWrite` |
| Contrato `openapi.yaml` / `api-doc.yaml` | `src/contracts/service.yaml` |
| Model `UserModel`/`UserSchema` tipados com `IM*` | `Muser`, `userSchema` não tipado (padrão `IM*` ainda não aplicado) |
| Entry point `src/app.ts` | `src/main.ts` |
| Logs com envelope `data`: `Logger.info('MSG', { data: {...} })` | Metadata no nível raiz: `Logger.info('MSG', { eventName, ... })` — é o que o format de trace/cid espera |
| Rotas com prefixo `/api` (`/api/users`) | Sem prefixo: `/users` |
| Regras em `.cursor/rules/REPO_RULES.md` | Arquivo não existe neste repo |

O que o knowledge base **confirma** e vale seguir aqui: prefixos `I`/`E`, factories
com `static create()`, controllers finos sem regra de negócio, Conventional Commits,
branches `feature/*`, `bugfix/*`, `hotfix/*`, `release/*`, cobertura ≥ 80%, e
comentários apenas quando explicam o "porquê" (nunca código morto ou comentário óbvio).

## Documentação detalhada

- [docs/architecture.md](docs/architecture.md) — camadas, fluxo request→response, DI
- [docs/conventions.md](docs/conventions.md) — nomenclatura, erros, estilo, commits
- [docs/testing.md](docs/testing.md) — Jest, integração com mongodb-memory-server
- [docs/observability.md](docs/observability.md) — OpenTelemetry, logs, trace_id
