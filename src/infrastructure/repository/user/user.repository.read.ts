import { GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  IPaginatedResult,
  IPagination,
} from '../../../domain/common/pagination.interface';
import { IUser } from '../../../domain/user/interfaces/user.interface';
import { IUserRepositoryRead } from '../../../domain/user/repository/user.repository.read';
import { dynamoDocumentClient } from '../../db/dynamo/dynamo.client';
import { decodeCursor, encodeCursor } from '../../db/dynamo/dynamo.cursor';
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
   * List users with cursor pagination: the scan resumes from the decoded
   * cursor (ExclusiveStartKey) and pages until the limit is filled or the
   * table is exhausted. The next cursor points at the last returned item's
   * key, so the following page resumes exactly after it even when a filter
   * discards part of a scanned page.
   * @param filter - Optional equality filters for the scan
   * @param pagination - Limit and optional cursor from the previous page
   * @returns The page of users plus the cursor for the next page, if any
   * @throws BadRequestError when the cursor is malformed
   */
  async listUsers(
    filter: Partial<IUser>,
    pagination: IPagination,
  ): Promise<IPaginatedResult<IUser>> {
    const {
      filterExpression,
      expressionAttributeNames,
      expressionAttributeValues,
    } = buildFilterExpression(filter);

    const matches: IMUser[] = [];
    let exclusiveStartKey = pagination.cursor
      ? decodeCursor(pagination.cursor)
      : undefined;
    let scanExhausted = false;

    // May report hasMore when the remaining pages hold no matches — the next
    // request then returns an empty page without a cursor, mirroring how
    // native DynamoDB pagination behaves. Cheaper than scanning ahead.
    while (matches.length < pagination.limit && !scanExhausted) {
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
      scanExhausted = !LastEvaluatedKey;
    }

    const pageItems = matches.slice(0, pagination.limit);
    const hasMore = !scanExhausted || matches.length > pagination.limit;
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor =
      hasMore && lastItem ? encodeCursor({ id: lastItem.id }) : undefined;

    return { items: pageItems.map(toUser), nextCursor };
  }
}
