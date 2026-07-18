/**
 * Central, fail-fast access to environment variables. Import this instead of
 * reading process.env directly — missing required variables abort the boot
 * with a clear message instead of failing later at runtime.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  databaseUri: requireEnv('DATABASE_URI'),
};
