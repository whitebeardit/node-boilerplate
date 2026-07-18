import { DynamoDatabase } from '../infrastructure/db/dynamo/dynamo.database';
import { app } from './configApp';

export async function bootstrapTest() {
  const dbInstance = new DynamoDatabase();

  await dbInstance.start();

  return {
    dbInstance,
    app,
  };
}
