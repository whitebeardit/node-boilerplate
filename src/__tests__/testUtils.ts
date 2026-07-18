import { MongooseDatabase } from '../../jest/setup-db';
import { app } from './configApp';

export async function bootstrapTest() {
  const DATABASE_URI = String(process.env.DATABASE_URI || '');
  const DB_NAME = String(process.env.MONGODB_DATABASE);
  const dbInstance = new MongooseDatabase(DATABASE_URI, DB_NAME);

  await dbInstance.start();

  return {
    dbInstance,
    app,
  };
}
