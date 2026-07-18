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
  awsRegion: requireEnv('AWS_REGION'),
  // Point to DynamoDB Local/dynalite in dev and tests; unset means real AWS.
  dynamodbEndpoint: process.env.DYNAMODB_ENDPOINT,
  usersTableName: process.env.DYNAMODB_USERS_TABLE || 'users',
  sqsUserNewQueueUrl: requireEnv('SQS_USER_NEW_QUEUE_URL'),
  // Point to a local SQS (elasticmq/localstack) in dev; unset means real AWS.
  sqsEndpoint: process.env.SQS_ENDPOINT,
};
