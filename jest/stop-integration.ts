import { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function globalTeardown() {
  const instance: MongoMemoryReplSet = (
    global as unknown as { __MONGOINSTANCE: MongoMemoryReplSet }
  ).__MONGOINSTANCE;
  await instance.stop();
}
