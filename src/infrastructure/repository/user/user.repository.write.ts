import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { IUser } from '../../../domain/user/interfaces/user.interface';
import { IUserRepositoryWrite } from '../../../domain/user/repository/user.repository.write';
import { dynamoDocumentClient } from '../../db/dynamo/dynamo.client';
import {
  IMUser,
  toUser,
  toUserItem,
  USER_TABLE_NAME,
} from '../../db/dynamo/tables/user.table';

export class UserRepositoryWrite implements IUserRepositoryWrite {
  /**
   * Create a new user in the database
   * @param userData - The user data to create
   * @returns The created user
   */
  async createUser(userData: IUser): Promise<IUser> {
    const item = toUserItem(userData);
    await dynamoDocumentClient.send(
      new PutCommand({
        TableName: USER_TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
    return toUser(item);
  }

  /**
   * Update a user by ID
   * @param id - The user's ID
   * @param updateData - The data to update
   * @returns The updated user or null if not found
   */
  async updateUserById(
    id: string,
    updateData: Partial<IUser>,
  ): Promise<IUser | null> {
    const fields = Object.entries(updateData).filter(
      ([field, value]) => field !== 'id' && value !== undefined,
    );

    if (fields.length === 0) {
      const { Item } = await dynamoDocumentClient.send(
        new GetCommand({ TableName: USER_TABLE_NAME, Key: { id } }),
      );
      return Item ? toUser(Item as IMUser) : null;
    }

    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, string> = {};
    const assignments = fields.map(([field, value]) => {
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] =
        value instanceof Date ? value.toISOString() : String(value);
      return `#${field} = :${field}`;
    });

    try {
      const { Attributes } = await dynamoDocumentClient.send(
        new UpdateCommand({
          TableName: USER_TABLE_NAME,
          Key: { id },
          UpdateExpression: `SET ${assignments.join(', ')}`,
          ConditionExpression: 'attribute_exists(id)',
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        }),
      );
      return toUser(Attributes as IMUser);
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a user by ID
   * @param id - The user's ID
   * @returns The deleted user or null if not found
   */
  async deleteUserById(id: string): Promise<IUser | null> {
    const { Attributes } = await dynamoDocumentClient.send(
      new DeleteCommand({
        TableName: USER_TABLE_NAME,
        Key: { id },
        ReturnValues: 'ALL_OLD',
      }),
    );
    return Attributes ? toUser(Attributes as IMUser) : null;
  }
}
