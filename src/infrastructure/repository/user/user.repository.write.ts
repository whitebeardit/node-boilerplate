import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ContextAsyncHooks, Logger } from 'traceability';
import { IUser } from '../../../domain/user/interfaces/user.interface';
import { IUserRepositoryWrite } from '../../../domain/user/repository/user.repository.write';
import { ConflictError } from '../../../domain/errors/conflict.error';
import { dynamoDocumentClient } from '../../db/dynamo/dynamo.client';
import {
  IMUser,
  toUser,
  toUserItem,
  USER_TABLE_NAME,
} from '../../db/dynamo/tables/user.table';
import {
  toEmailGuardKey,
  USER_EMAIL_TABLE_NAME,
} from '../../db/dynamo/tables/user-email.table';

export class UserRepositoryWrite implements IUserRepositoryWrite {
  /**
   * Create a new user in the database, atomically enforcing email
   * uniqueness: the email guard is claimed first (re-claims by the same user
   * pass, making retries and message redeliveries idempotent), then the user
   * item is written. A crash between the two steps self-heals on redelivery.
   * The correlation id of the current tracking context is stored on the item.
   * @param userData - The user data to create
   * @returns The created user
   * @throws ConflictError when the email belongs to another user
   */
  async createUser(userData: IUser): Promise<IUser> {
    await this.claimEmailGuard(userData.email, userData.id);

    const cid = ContextAsyncHooks.getContext()?.cid;
    const item: IMUser = {
      ...toUserItem(userData),
      ...(typeof cid === 'string' ? { cid } : {}),
    };
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
   * Update a user by ID. When the email changes, the new email guard is
   * claimed before the update and the old one is released after it, keeping
   * uniqueness intact across updates.
   * @param id - The user's ID
   * @param updateData - The data to update
   * @returns The updated user or null if not found
   * @throws ConflictError when the new email belongs to another user
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

    const newEmail =
      typeof updateData.email === 'string' ? updateData.email : undefined;
    let previousEmail: string | undefined;
    if (newEmail) {
      const { Item } = await dynamoDocumentClient.send(
        new GetCommand({ TableName: USER_TABLE_NAME, Key: { id } }),
      );
      if (!Item) {
        return null;
      }
      const currentEmail = (Item as IMUser).email;
      // Case-only changes keep the same guard key — no swap needed.
      if (toEmailGuardKey(newEmail) !== toEmailGuardKey(currentEmail)) {
        await this.claimEmailGuard(newEmail, id);
        previousEmail = currentEmail;
      }
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
      if (previousEmail) {
        await this.releaseEmailGuard(previousEmail, id);
      }
      return toUser(Attributes as IMUser);
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        // The user vanished between the read and the update: give the newly
        // claimed guard back so the email is not left blocked.
        if (newEmail && previousEmail) {
          await this.releaseEmailGuard(newEmail, id);
        }
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a user by ID and release their email guard so the email can be
   * reused.
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
    if (!Attributes) {
      return null;
    }
    await this.releaseEmailGuard((Attributes as IMUser).email, id);
    return toUser(Attributes as IMUser);
  }

  private async claimEmailGuard(email: string, userId: string): Promise<void> {
    try {
      await dynamoDocumentClient.send(
        new PutCommand({
          TableName: USER_EMAIL_TABLE_NAME,
          Item: { email: toEmailGuardKey(email), userId },
          ConditionExpression: 'attribute_not_exists(email) OR userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
        }),
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new ConflictError('A user with this email already exists');
      }
      throw error;
    }
  }

  // Best-effort: a failed release only blocks the email until fixed by ops,
  // never the operation that already succeeded. The userId condition ensures
  // a guard re-claimed by another user is never stolen.
  private async releaseEmailGuard(
    email: string,
    userId: string,
  ): Promise<void> {
    try {
      await dynamoDocumentClient.send(
        new DeleteCommand({
          TableName: USER_EMAIL_TABLE_NAME,
          Key: { email: toEmailGuardKey(email) },
          ConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
        }),
      );
    } catch (error) {
      Logger.warn(`Email guard release failed: ${(error as Error).message}`, {
        eventName: 'user.email_guard.release_failed',
        userId,
        email,
      });
    }
  }
}
