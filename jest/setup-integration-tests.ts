import { MongooseDatabase } from "./setup-db";

let dbInstance: MongooseDatabase;

beforeAll(async () => {
  dbInstance = new MongooseDatabase(
    process.env.DATABASE_URI || '',
    String(process.env.MONGODB_DATABASE),
  );
  await dbInstance.start();
});

afterAll(async () => {
  await dbInstance?.close();
});


