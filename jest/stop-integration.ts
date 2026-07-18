import { Server } from 'http';

export default async function globalTeardown() {
  const instance: Server = (
    global as unknown as { __DYNALITE_INSTANCE: Server }
  ).__DYNALITE_INSTANCE;
  await new Promise<void>((resolve, reject) =>
    instance.close((error) => (error ? reject(error) : resolve())),
  );
}
