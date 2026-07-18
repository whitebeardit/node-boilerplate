import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { env } from '../../config/env';

// Credentials come from the default AWS provider chain; for local development
// and tests, point DYNAMODB_ENDPOINT to DynamoDB Local/dynalite and export
// dummy AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY values.
export const dynamoClient = new DynamoDBClient({
  region: env.awsRegion,
  ...(env.dynamodbEndpoint ? { endpoint: env.dynamodbEndpoint } : {}),
});

export const dynamoDocumentClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});
