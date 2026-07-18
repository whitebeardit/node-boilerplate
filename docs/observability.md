# Observability — OpenTelemetry + structured logs

Project requirement: distributed tracing with OpenTelemetry and structured JSON
logs with the **OTel `trace_id` on every log line** (log ↔ trace correlation).

## Architecture

| File | Role |
| --- | --- |
| `src/infrastructure/telemetry/tracing.ts` | Initializes the `NodeSDK` (auto-instrumentations + OTLP HTTP exporter) and calls `configureLoggerTraceContext()`. Registers graceful shutdown on `SIGTERM`/`SIGINT`. |
| `src/infrastructure/telemetry/logger.ts` | `otelTraceContextFormat` — a winston format that injects `trace_id`, `span_id` and `trace_flags` from the active span into every log; `configureLoggerTraceContext()` reconfigures the `traceability` `Logger` preserving its original format (cid + timestamp + json). |

### Initialization order (critical)

```ts
// src/main.ts — FIRST line, before any express/mongoose import:
import './infrastructure/telemetry/tracing';
```

Auto-instrumentation works by patching modules at `require` time — if express or
mongoose load first, there are no spans. Never move this import.

### Environment variables (see `.env.example`)

| Variable | Effect |
| --- | --- |
| `OTEL_SDK_DISABLED=true` | Disables the SDK entirely (used in `.env.test`) |
| `OTEL_SERVICE_NAME` | Resource `service.name` (default: `node-boilerplate`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP HTTP collector endpoint (SDK default: `http://localhost:4318`) |

## Log ↔ trace correlation

Two identifiers coexist on every log line:

- **`trace_id` / `span_id`** — the OpenTelemetry context of the active span (W3C
  Trace Context, propagated between services via the `traceparent` header). Use
  them to jump from a log to the trace in Jaeger/Tempo/Datadog.
- **`cid`** — the legacy correlation id from the `traceability` lib, created by
  the `ContextAsyncHooks.getExpressMiddlewareTracking()` middleware in
  `server.ts`. Kept for compatibility with the whitebeardit ecosystem.

A real log line emitted during an HTTP request:

```json
{"eventName":"ping.received","level":"info","message":"ping received","span_id":"e3f91c2cded0db80","timestamp":"2026-07-18T11:44:59.032Z","trace_flags":"01","trace_id":"3c060d79abe804651b8e5b18f0ee6c81"}
```

Outside an active span (e.g. application boot), the trace fields are simply
absent — the format is a no-op without a valid span.

## Logging rules (mandatory)

1. **Never `console.log`**. Always:
   ```ts
   import { Logger } from 'traceability';
   ```
2. Short human message + structured metadata with an `eventName` in the
   `<context>.<event>` pattern:
   ```ts
   Logger.info('User created', { eventName: 'user.created', userId: user.id });
   Logger.error(err.message, { eventName: 'server.error', stack: err.stack });
   ```
3. **Never `JSON.stringify` inside the message** — fields must be searchable
   as attributes of the log JSON.
4. Do not log sensitive data (passwords, tokens, unnecessary PII).

## Spans

Auto-instrumentation (`@opentelemetry/auto-instrumentations-node`, with
`instrumentation-fs` disabled) already creates spans for: HTTP server/client,
Express routes (including middlewares) and Mongoose/MongoDB operations.

For relevant business operations, create manual spans in the service:

```ts
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('user-service');

async createUser(params: IParamsCreateUser): Promise<IUser> {
  return tracer.startActiveSpan('UserService.createUser', async (span) => {
    try {
      // ... existing logic ...
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

Every `Logger.*` call inside `startActiveSpan` inherits the `trace_id`/`span_id`
automatically.

## Tests

- `.env.test` sets `OTEL_SDK_DISABLED=true` — no exporter/spans in tests.
- The correlation format has a unit test in
  `src/__tests__/unit/telemetry.unit.test.ts`. It registers an
  `AsyncLocalStorageContextManager` manually (the role the NodeSDK plays in
  production) and uses `trace.wrapSpanContext()` to simulate an active span.

## Local verification

1. Start a collector with a UI:
   ```bash
   docker run --rm -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
   ```
2. `cp .env.example .env` (adjust `DATABASE_URI` if needed) and `yarn dev`.
3. Make a request (`curl http://localhost:3000/users`) and check:
   - the JSON log on stdout contains `trace_id`/`span_id`;
   - the trace shows up at `http://localhost:16686` with the same `trace_id`.

Without a running collector the application works normally — the exporter only
logs failed-export warnings.
