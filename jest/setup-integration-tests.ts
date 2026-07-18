import { bootstrapTest } from '../src/__tests__/testUtils';
import { Server } from '../src/interfaces/http/server';
import { IDatabase } from '../src/infrastructure/db/database.interface';

let dbInstance: IDatabase;
export let app: Server;

beforeAll(async () => {
  const bootstrap = await bootstrapTest();
  dbInstance = bootstrap.dbInstance;
  app = bootstrap.app;
});

afterAll(async () => {
  await dbInstance?.close();
});
