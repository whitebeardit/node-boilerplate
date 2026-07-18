import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { Logger } from 'traceability';
import { configureLoggerTraceContext } from './logger';

configureLoggerTraceContext();

const OTEL_SDK_DISABLED = process.env.OTEL_SDK_DISABLED === 'true';

if (!OTEL_SDK_DISABLED) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'node-boilerplate',
    }),
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  Logger.info('OpenTelemetry SDK started', {
    eventName: 'telemetry.started',
    process: 'Telemetry',
  });

  const shutdown = async () => {
    try {
      await sdk.shutdown();
      Logger.info('OpenTelemetry SDK shut down', {
        eventName: 'telemetry.shutdown',
        process: 'Telemetry',
      });
    } catch (error) {
      Logger.error(
        `Error shutting down OpenTelemetry SDK: ${(error as Error).message}`,
        { eventName: 'telemetry.shutdown.error', process: 'Telemetry' },
      );
    }
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
