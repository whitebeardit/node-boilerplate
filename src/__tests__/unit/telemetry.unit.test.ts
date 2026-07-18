import { context, trace, TraceFlags } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { Logform } from 'traceability';
import {
  configureLoggerTraceContext,
  otelTraceContextFormat,
} from '../../infrastructure/telemetry/logger';

const SPAN_CONTEXT = {
  traceId: '0af7651916cd43dd8448eb211c80319c',
  spanId: 'b7ad6b7169203331',
  traceFlags: TraceFlags.SAMPLED,
};

// In production the NodeSDK registers this context manager; tests need it so
// that context.with() actually propagates the active span.
beforeAll(() => {
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable(),
  );
});

afterAll(() => {
  context.disable();
});

describe('When we log inside an active span', () => {
  it('should add trace_id, span_id and trace_flags to the log entry', () => {
    const formatter = otelTraceContextFormat();
    const span = trace.wrapSpanContext(SPAN_CONTEXT);

    const info = context.with(
      trace.setSpan(context.active(), span),
      () =>
        formatter.transform({
          level: 'info',
          message: 'test message',
        }) as Logform.TransformableInfo,
    );

    expect(info.trace_id).toBe(SPAN_CONTEXT.traceId);
    expect(info.span_id).toBe(SPAN_CONTEXT.spanId);
    expect(info.trace_flags).toBe('01');
  });
});

describe('When we log without an active span', () => {
  it('should not add trace fields to the log entry', () => {
    const formatter = otelTraceContextFormat();

    const info = formatter.transform({
      level: 'info',
      message: 'test message',
    }) as Logform.TransformableInfo;

    expect(info.trace_id).toBeUndefined();
    expect(info.span_id).toBeUndefined();
    expect(info.trace_flags).toBeUndefined();
  });
});

describe('When we configure the Logger with trace context', () => {
  it('should not throw and keep the logger usable', () => {
    expect(() => configureLoggerTraceContext()).not.toThrow();
  });
});
