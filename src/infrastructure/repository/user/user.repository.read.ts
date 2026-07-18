import { GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { IPagination } from '../../../domain/common/pagination.interface';
import { IUser } from '../../../domain/user/interfaces/user.interface';
import { IUserRepositoryRead } from '../../../domain/user/repository/user.repository.read';
import { dynamoDocumentClient } from '../../db/dynamo/dynamo.client';
import {
  IMUser,
  toUser,
  USER_EMAIL_INDEX_NAME,
  USER_TABLE_NAME,
} from '../../db/dynamo/tables/user.table';

interface IFilterExpression {
  filterExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, string>;
}

function buildFilterExpression(filter: Partial<IUser>): IFilterExpression {
  const entries = Object.entries(filter).filter(
    ([, value]) => value !== undefined,
  );
  if (entries.length === 0) {
    return {};
  }

  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, string> = {};
  const conditions = entries.map(([field, value]) => {
    expressionAttributeNames[`#${field}`] = field;
    expressionAttributeValues[`:${field}`] =
      value instanceof Date ? value.toISOString() : String(value);
    return `#${field} = :${field}`;
  });

  return {
    filterExpression: conditions.join(' AND '),
    expressionAttributeNames,
    expressionAttributeValues,
  };
}

export class UserRepositoryRead implements IUserRepositoryRead {
  /**
   * Find a user by ID
   * @param id - The user's ID
   * @returns The user or null if not found
   */
  async findUserById(id: string): Promise<IUser | null> {
    const { Item } = await dynamoDocumentClient.send(
      new GetCommand({ TableName: USER_TABLE_NAME, Key: { id } }),
    );
    return Item ? toUser(Item as IMUser) : null;
  }

  /**
   * Find a user by email (query on the email GSI)
   * @param email - The user's email
   * @returns The user or null if not found
   */
  async findUserByEmail(email: string): Promise<IUser | null> {
    const { Items } = await dynamoDocumentClient.send(
      new QueryCommand({
        TableName: USER_TABLE_NAME,
        IndexName: USER_EMAIL_INDEX_NAME,
        KeyConditionExpression: '#email = :email',
        ExpressionAttributeNames: { '#email': 'email' },
        ExpressionAttributeValues: { ':email': email },
        Limit: 1,
      }),
    );
    const item = Items?.[0];
    return item ? toUser(item as IMUser) : null;
  }

  /**
   * List users with pagination. DynamoDB has no native offset, so the scan
   * pages through results and the offset/limit window is applied client-side.
   * @param filter - Optional equality filters for the scan
   * @param pagination - Limit/offset applied to the result set
   * @returns An array of users
   */
  async listUsers(
    filter: Partial<IUser>,
    pagination: IPagination,
  ): Promise<IUser[]> {
    const {
      filterExpression,
      expressionAttributeNames,
      expressionAttributeValues,
    } = buildFilterExpression(filter);

    const wanted = pagination.offset + pagination.limit;
    const matches: IMUser[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const { Items, LastEvaluatedKey } = await dynamoDocumentClient.send(
        new ScanCommand({
          TableName: USER_TABLE_NAME,
          FilterExpression: filterExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      matches.push(...((Items as IMUser[]) ?? []));
      exclusiveStartKey = LastEvaluatedKey;
    } while (exclusiveStartKey && matches.length < wanted);

    return matches.slice(pagination.offset, wanted).map(toUser);
  }
}
