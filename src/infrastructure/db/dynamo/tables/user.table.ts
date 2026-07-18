import { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import { IUser } from '../../../../domain/user/interfaces/user.interface';
import { env } from '../../../config/env';

/**
 * Persistence shape of the user item: the domain interface with the types
 * DynamoDB can store (dates become ISO-8601 strings). Lives next to the table
 * definition so repositories share a single mapping.
 */
export interface IMUser extends Omit<IUser, 'createdAt'> {
  createdAt: string;
}

export const USER_TABLE_NAME = env.usersTableName;
export const USER_EMAIL_INDEX_NAME = 'email-index';

export const userTableDefinition: CreateTableCommandInput = {
  TableName: USER_TABLE_NAME,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'id', AttributeType: 'S' },
    { AttributeName: 'email', AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
  GlobalSecondaryIndexes: [
    {
      IndexName: USER_EMAIL_INDEX_NAME,
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
};

export function toUserItem(user: IUser): IMUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

// Maps field by field so storage-internal attributes never leak into domain
// objects (same role the Mongo projection used to play).
export function toUser(item: IMUser): IUser {
  return {
    id: item.id,
    name: item.name,
    email: item.email,
    createdAt: new Date(item.createdAt),
  };
}
