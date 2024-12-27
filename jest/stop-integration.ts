import { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function globalTeardown() {
  const instance: MongoMemoryReplSet = (global as any).__MONGOINSTANCE;
  await instance.stop();
}
