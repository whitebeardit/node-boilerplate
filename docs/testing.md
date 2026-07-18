# Testes

## Comandos

```bash
yarn test           # unit + integração
yarn test:unit      # jest --config ./jest/jest.config.ts
yarn test:int       # jest --runInBand --forceExit --config ./jest/jest.int-config.ts
yarn test:coverage  # cobertura de ambos (meta: ≥ 80% linhas/branches)
```

O CI (`.github/workflows/ci.yml`) roda lint → build → test:unit → test:int em
pushes para `main`/`stage` e em pull requests.

## Configuração (diretório `jest/`, fora de `src/`)

| Arquivo | Papel |
| --- | --- |
| `jest/jest.config.ts` | Base (unit): `rootDir: '../src'`, `testRegex: '.*\.unit.test\.ts$'`, `setupFiles: ['../jest/setup-tests.ts']`, timeout 20s, `bail: 1` |
| `jest/jest.int-config.ts` | Estende a base: `testRegex: '.*\.int.test\.ts$'`, `globalSetup`/`globalTeardown`, `setupFilesAfterEnv: setup-integration-tests.ts` |
| `jest/setup-tests.ts` | Carrega `.env.test` via dotenv (inclui `OTEL_SDK_DISABLED=true`) |
| `jest/start-integration.ts` / `stop-integration.ts` | Sobe/derruba `mongodb-memory-server` (ReplSet) — não precisa de Mongo local |
| `jest/setup-db.ts` | Classe `MongooseDatabase` (conexão/limpeza) |
| `jest/setup-integration-tests.ts` | `beforeAll` chama `bootstrapTest()` e exporta `app` (instância de `Server`) |

Suporte dentro de `src/`:

- `src/__tests__/configApp.ts` — instância de `Server` para testes. **Todo controller
  novo precisa ser registrado aqui**, além de `src/main.ts`, senão o teste de
  integração devolve 404/erro de contrato.
- `src/__tests__/testUtils.ts` — `bootstrapTest()` conecta o `MongooseDatabase` e devolve `{ dbInstance, app }`.

## Nomenclatura (obrigatória — enforced pelo `testRegex`)

| Tipo | Sufixo | Local | Exemplo real |
| --- | --- | --- | --- |
| Unitário | `.unit.test.ts` | `src/__tests__/unit/` | `telemetry.unit.test.ts` |
| Integração | `.int.test.ts` | `src/__tests__/integration/` | `user.create.int.test.ts` |

- Nome começa pelo assunto testado (`user.create.int.test.ts`), nunca genérico.
- Não misturar unit e integração no mesmo arquivo.
- Blocos: `describe('When we ...')` / `it('should ...')`.

## Teste de integração — anatomia (padrão real de `user.create.int.test.ts`)

```ts
import request from 'supertest';
import { app } from '../configApp';

describe('When we create a user', () => {
  it('should return 201 and persist the user', async () => {
    const response = await request(app.app).post('/users').send({
      id: '123',
      name: 'John Doe',
      email: 'john@example.com',
    });
    expect(response.status).toBe(201);
  });
});
```

Pontos de atenção:

- `app.app` é o `express.Application` dentro da classe `Server`.
- O `mongodb-memory-server` é global (via `globalSetup`); testes rodam com `--runInBand`.
- O OpenApiValidator está ativo nos testes: payloads fora do contrato retornam 400,
  responses fora do contrato retornam 500 — atualize `src/contracts/service.yaml` junto.

## Teste unitário

- Mockar todas as dependências externas (repositórios, producers) — services recebem
  tudo via construtor, então basta passar objetos falsos tipados pelos contratos `I*`.
- Determinístico e rápido (<100ms por teste).
- OTel fica desabilitado (`OTEL_SDK_DISABLED=true` em `.env.test`); para testar código
  sensível a contexto de trace, registre um `AsyncLocalStorageContextManager`
  manualmente como em `src/__tests__/unit/telemetry.unit.test.ts`.

## Cobertura

- Mínimo 80% global (linhas e branches); services de domínio críticos ≥ 90%.
- Exclusões já configuradas: `src/contracts/`, `src/__tests__/` (ver `coveragePathIgnorePatterns`).
