# Node Boilerplate

Este repositório demonstra uma aplicação Node.js + TypeScript estruturada segundo
a Clean Architecture. A separação em camadas facilita testes e manutenção.

## Arquitetura de Pastas

- **src/domain** – Entidades e contratos de repositório/serviço.
- **src/application** – Opcional para casos de uso ou serviços de aplicação.
- **src/interfaces** – Adaptadores de entrada/saída (ex.: HTTP).
- **src/infrastructure** – Implementações concretas (Mongo, factories etc.).
- **src/contracts** – OpenAPI que documenta e valida a API.
- **src/__tests__** – Testes unitários e de integração.
- **main.ts** – Ponto de entrada que instancia o servidor.

## Executando Localmente

1. Instale as dependências:

```bash
yarn install
```

2. Crie um arquivo `.env` a partir do exemplo (`cp .env.example .env`) e ajuste
   `DATABASE_URI`, `PORT` e as variáveis `OTEL_*`.
3. Inicie em modo desenvolvimento:

```bash
yarn dev
```

4. Para compilar e rodar a versão buildada:

```bash
yarn build
yarn start
```

5. Testes e linter:

```bash
yarn test
yarn lint
```

## Adicionando Novos Recursos

1. Defina entidades e interfaces em `src/domain`.
2. Crie as implementações em `src/infrastructure`.
3. Exponha rotas ou adaptadores em `src/interfaces`.
4. Registre as dependências em `src/infrastructure/config/factories` e ajuste
   `main.ts`.
5. Documente as rotas em `src/contracts/service.yaml`.
6. Escreva testes em `src/__tests__`.

O arquivo `src/contracts/service.yaml` é a fonte de verdade da documentação da
API e deve refletir quaisquer alterações de rota ou contrato.

## Observabilidade

O projeto vem instrumentado com **OpenTelemetry** (tracing distribuído via
`@opentelemetry/sdk-node` + auto-instrumentations) e **logs estruturados JSON**
(lib `traceability`/winston). Cada linha de log emitida dentro de um request
carrega automaticamente o `trace_id`/`span_id` do trace ativo, permitindo
correlação direta entre logs e traces.

- Inicialização em `src/infrastructure/telemetry/tracing.ts` (importado na
  primeira linha de `src/main.ts`).
- Configuração via variáveis `OTEL_*` (ver `.env.example`).
- Guia completo em [docs/observability.md](docs/observability.md).

## Documentação

- [CLAUDE.md](CLAUDE.md) — guia de contribuição para agentes de IA (Claude Code)
- [docs/architecture.md](docs/architecture.md) — camadas, fluxo e injeção de dependência
- [docs/conventions.md](docs/conventions.md) — nomenclatura e padrões de código
- [docs/testing.md](docs/testing.md) — estratégia e convenções de testes
- [docs/observability.md](docs/observability.md) — OpenTelemetry e logging
