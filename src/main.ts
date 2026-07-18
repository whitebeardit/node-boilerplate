// OpenTelemetry must be initialized before any instrumented module (express,
// aws-sdk, http) is imported. Keep this import as the first line.
import './infrastructure/telemetry/tracing';
import path from 'path';
import { Logger } from 'traceability';
import { Server } from './interfaces/http/server';
import { env } from './infrastructure/config/env';
import { DynamoDatabase } from './infrastructure/db/dynamo/dynamo.database';

import { UserControllerFactory } from './infrastructure/config/factories/user.controller.factory';
import { OpsControllerFactory } from './infrastructure/config/factories/ops.controller.factory';
import { UserNewWorkerFactory } from './infrastructure/config/factories/messaging/user.new.worker.factory';

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  './contracts/service.yaml',
);

const SHUTDOWN_TIMEOUT_MILLISECONDS = 10000;

const app = new Server({
  port: env.port,
  controllers: [UserControllerFactory.create(), OpsControllerFactory.create()],
  database: new DynamoDatabase(),
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
});

async function start() {
  await app.databaseSetup();
  const httpServer = app.listen();
  const userNewWorker = UserNewWorkerFactory.create();
  userNewWorker.start();

  const shutdown = (signal: string) => {
    Logger.info(`Received ${signal}, shutting down gracefully`, {
      eventName: 'app.shutdown',
      process: 'Application',
    });
    // Stop pulling messages and drain the in-flight batch before closing the
    // HTTP server and the database.
    void userNewWorker.stop().then(() => {
      httpServer.close(async () => {
        await app.closeDatabase();
        process.exit(0);
      });
    });
    // Failsafe: force exit if connections refuse to drain
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MILLISECONDS).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  Logger.error((error as Error).message, {
    eventName: 'app.bootstrap_error',
    stack: (error as Error).stack,
  });
  process.exit(1);
});
