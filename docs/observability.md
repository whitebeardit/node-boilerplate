# Observabilidade — OpenTelemetry + logs estruturados

Requisito do projeto: tracing distribuído com OpenTelemetry e logs estruturados
JSON com o **`trace_id` do OTel em cada linha de log** (correlação log ↔ trace).

## Arquitetura

| Arquivo | Papel |
| --- | --- |
| `src/infrastructure/telemetry/tracing.ts` | Inicializa o `NodeSDK` (auto-instrumentations + OTLP HTTP exporter) e chama `configureLoggerTraceContext()`. Registra shutdown gracioso em `SIGTERM`/`SIGINT`. |
| `src/infrastructure/telemetry/logger.ts` | `otelTraceContextFormat` — format winston que injeta `trace_id`, `span_id` e `trace_flags` do span ativo em cada log; `configureLoggerTraceContext()` reconfigura o `Logger` da lib `traceability` preservando o format original (cid + timestamp + json). |

### Ordem de inicialização (crítico)

```ts
// src/main.ts — PRIMEIRA linha, antes de qualquer import de express/mongoose:
import './infrastructure/telemetry/tracing';
```

A auto-instrumentação funciona por *patch* de módulos no `require` — se express ou
mongoose forem carregados antes, não há spans. Nunca mova esse import.

### Variáveis de ambiente (ver `.env.example`)

| Variável | Efeito |
| --- | --- |
| `OTEL_SDK_DISABLED=true` | Desliga o SDK por completo (usado em `.env.test`) |
| `OTEL_SERVICE_NAME` | `service.name` do resource (default: `node-boilerplate`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint OTLP HTTP do collector (default do SDK: `http://localhost:4318`) |

## Correlação log ↔ trace

Dois identificadores convivem em cada linha de log:

- **`trace_id` / `span_id`** — contexto OpenTelemetry do span ativo (W3C Trace Context,
  propagado entre serviços via header `traceparent`). Use-os para pular do log para o
  trace no Jaeger/Tempo/Datadog.
- **`cid`** — correlation id legado da lib `traceability`, criado pelo middleware
  `ContextAsyncHooks.getExpressMiddlewareTracking()` em `server.ts`. Mantido por
  compatibilidade com o ecossistema whitebeardit.

Linha de log real emitida durante um request HTTP:

```json
{"eventName":"ping.received","level":"info","message":"ping received","span_id":"e3f91c2cded0db80","timestamp":"2026-07-18T11:44:59.032Z","trace_flags":"01","trace_id":"3c060d79abe804651b8e5b18f0ee6c81"}
```

Fora de um span ativo (ex.: boot da aplicação), os campos de trace simplesmente
não aparecem — o format é no-op sem span válido.

## Regras de logging (obrigatórias)

1. **Nunca `console.log`**. Sempre:
   ```ts
   import { Logger } from 'traceability';
   ```
2. Message curta e humana + metadata estruturada com `eventName` no padrão
   `<contexto>.<evento>`:
   ```ts
   Logger.info('User created', { eventName: 'user.created', userId: user.id });
   Logger.error(err.message, { eventName: 'server.error', stack: err.stack });
   ```
3. **Nunca `JSON.stringify` dentro da message** — os campos devem ser pesquisáveis
   como atributos do JSON de log.
4. Não logar dados sensíveis (senhas, tokens, PII desnecessária).

## Spans

A auto-instrumentação (`@opentelemetry/auto-instrumentations-node`, com
`instrumentation-fs` desabilitada) já cria spans para: HTTP server/client, rotas
Express (incl. middlewares) e operações Mongoose/MongoDB.

Para operações de negócio relevantes, crie spans manuais no service:

```ts
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('user-service');

async createUser(params: IParamsCreateUser): Promise<IUser> {
  return tracer.startActiveSpan('UserService.createUser', async (span) => {
    try {
      // ... lógica existente ...
      return result;
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

Todo `Logger.*` chamado dentro de `startActiveSpan` herda o `trace_id`/`span_id`
automaticamente.

## Testes

- `.env.test` define `OTEL_SDK_DISABLED=true` — nenhum exporter/span nos testes.
- O format de correlação tem teste unitário em
  `src/__tests__/unit/telemetry.unit.test.ts`. Ele registra um
  `AsyncLocalStorageContextManager` manualmente (papel que o NodeSDK cumpre em
  produção) e usa `trace.wrapSpanContext()` para simular um span ativo.

## Verificação local

1. Suba um collector com UI:
   ```bash
   docker run --rm -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
   ```
2. `cp .env.example .env` (ajuste `DATABASE_URI` se necessário) e `yarn dev`.
3. Faça um request (`curl http://localhost:3000/users`) e confira:
   - o log JSON no stdout contém `trace_id`/`span_id`;
   - o trace aparece em `http://localhost:16686` com o mesmo `trace_id`.

Sem collector rodando, a aplicação funciona normalmente — o exporter apenas
registra warnings de export falho.
