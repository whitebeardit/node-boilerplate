import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Logger } from 'traceability';

async function getMongoDBInMemoryAndStartDB() {
  const mongoMemoryServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  process.env.DATABASE_URI = mongoMemoryServer.getUri();

  (
    global as typeof global & { __MONGOINSTANCE: MongoMemoryReplSet }
  ).__MONGOINSTANCE = mongoMemoryServer;
}

export default async function globalSetup() {
  Logger.info('START INTEGRATION SETUP');
  await getMongoDBInMemoryAndStartDB();
}
