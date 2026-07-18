import { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import { env } from '../../../config/env';

/**
 * Email uniqueness guard. DynamoDB GSIs do not enforce uniqueness, so each
 * user's email is claimed here with a conditional put before the user item is
 * written (saga pattern — dynalite has no TransactWriteItems). The claim
 * condition allows re-claims by the same user, which makes retries and
 * message redeliveries idempotent and self-healing.
 */
export interface IMUserEmailGuard {
  email: string;
  userId: string;
}

export const USER_EMAIL_TABLE_NAME = env.usersEmailTableName;

export const userEmailTableDefinition: CreateTableCommandInput = {
  TableName: USER_EMAIL_TABLE_NAME,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
};

// Uniqueness is case-insensitive; user items keep the raw email as provided.
export function toEmailGuardKey(email: string): string {
  return email.trim().toLowerCase();
}
