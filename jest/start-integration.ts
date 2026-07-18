import dynalite from 'dynalite';
import { AddressInfo } from 'net';
import { Server } from 'http';
import { Logger } from 'traceability';

async function getDynamoDBInMemoryAndStartDB() {
  const dynaliteServer = dynalite({
    createTableMs: 0,
    deleteTableMs: 0,
    updateTableMs: 0,
  });

  await new Promise<void>((resolve) => dynaliteServer.listen(0, resolve));
  const { port } = dynaliteServer.address() as AddressInfo;

  process.env.DYNAMODB_ENDPOINT = `http://127.0.0.1:${port}`;
  process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'local';
  process.env.AWS_SECRET_ACCESS_KEY =
    process.env.AWS_SECRET_ACCESS_KEY || 'local';

  (
    global as typeof global & { __DYNALITE_INSTANCE: Server }
  ).__DYNALITE_INSTANCE = dynaliteServer;
}

export default async function globalSetup() {
  Logger.info('START INTEGRATION SETUP');
  await getDynamoDBInMemoryAndStartDB();
}
