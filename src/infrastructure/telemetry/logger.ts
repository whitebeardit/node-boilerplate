import { context, isSpanContextValid, trace } from '@opentelemetry/api';
import { format, LoggerTraceability } from 'traceability';

/**
 * Winston format that enriches every log entry with the active OpenTelemetry
 * trace context (trace_id, span_id, trace_flags), enabling log <-> trace
 * correlation. When there is no active span, the entry is left untouched.
 */
export const otelTraceContextFormat = format((info) => {
  const spanContext = trace.getSpanContext(context.active());
  if (spanContext && isSpanContextValid(spanContext)) {
    info.trace_id = spanContext.traceId;
    info.span_id = spanContext.spanId;
    info.trace_flags = `0${spanContext.traceFlags.toString(16)}`;
  }
  return info;
});

/**
 * Reconfigure the traceability Logger so every log line carries the
 * OpenTelemetry trace context in addition to the default cid correlation id.
 */
export function configureLoggerTraceContext(): void {
  const baseOptions = LoggerTraceability.getLoggerOptions();
  LoggerTraceability.configure({
    ...baseOptions,
    format: format.combine(otelTraceContextFormat(), baseOptions.format!),
  });
}
