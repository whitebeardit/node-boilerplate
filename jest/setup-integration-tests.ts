import { bootstrapTest } from '../src/__tests__/testUtils';
import { Server } from '../src/domain/server/server';
import { MongooseDatabase } from './setup-db';

let dbInstance: MongooseDatabase;
export let app: Server;

beforeAll(async () => {
  const bootstrap = await bootstrapTest();
  dbInstance = bootstrap.dbInstance;
  app = bootstrap.app;
});

afterAll(async () => {
  await dbInstance?.close();
});
