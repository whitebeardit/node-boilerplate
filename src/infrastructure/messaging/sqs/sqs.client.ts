import { SQSClient } from '@aws-sdk/client-sqs';
import { env } from '../../config/env';

// Credentials come from the default AWS provider chain; for local development
// point SQS_ENDPOINT to a local SQS (e.g. elasticmq/localstack) and export
// dummy AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY values.
export const sqsClient = new SQSClient({
  region: env.awsRegion,
  ...(env.sqsEndpoint ? { endpoint: env.sqsEndpoint } : {}),
});
