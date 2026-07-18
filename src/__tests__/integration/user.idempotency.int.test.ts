import { randomUUID } from 'crypto';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import '../../../jest/setup-integration-tests';
import { dynamoDocumentClient } from '../../infrastructure/db/dynamo/dynamo.client';
import {
  toEmailGuardKey,
  USER_EMAIL_TABLE_NAME,
} from '../../infrastructure/db/dynamo/tables/user-email.table';
import { UserRepositoryRead } from '../../infrastructure/repository/user/user.repository.read';
import { UserRepositoryWrite } from '../../infrastructure/repository/user/user.repository.write';
import { ConflictError } from '../../domain/errors/conflict.error';
import { IUser } from '../../domain/user/interfaces/user.interface';

const userRepositoryRead = new UserRepositoryRead();
const userRepositoryWrite = new UserRepositoryWrite();

function buildUser(email?: string): IUser {
  return {
    id: randomUUID(),
    name: 'Whitebeard',
    email: email ?? `idem-${randomUUID()}@email.com`,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('When two different users claim the same email', () => {
  it('should reject the second create and keep a single user', async () => {
    const first = buildUser();
    await userRepositoryWrite.createUser(first);

    await expect(
      userRepositoryWrite.createUser(buildUser(first.email)),
    ).rejects.toThrow(ConflictError);

    const page = await userRepositoryRead.listUsers(
      { email: first.email },
      { limit: 10 },
    );
    expect(page.items).toHaveLength(1);
  });

  it('should reject a case-variant of an already claimed email', async () => {
    const first = buildUser(`Case-${randomUUID()}@Email.com`);
    await userRepositoryWrite.createUser(first);

    await expect(
      userRepositoryWrite.createUser(buildUser(first.email.toLowerCase())),
    ).rejects.toThrow(ConflictError);
  });
});

describe('When the same create is retried (duplicate message or request)', () => {
  it('should reject the replay on the id condition and keep a single user', async () => {
    const user = buildUser();
    await userRepositoryWrite.createUser(user);

    await expect(userRepositoryWrite.createUser(user)).rejects.toThrow(
      ConditionalCheckFailedException,
    );

    const page = await userRepositoryRead.listUsers(
      { email: user.email },
      { limit: 10 },
    );
    expect(page.items).toHaveLength(1);
  });
});

describe('When a crash left an orphan email guard behind', () => {
  it('should self-heal on the retry of the same user', async () => {
    const user = buildUser();
    // Simulates a crash after the guard claim and before the user put.
    await dynamoDocumentClient.send(
      new PutCommand({
        TableName: USER_EMAIL_TABLE_NAME,
        Item: { email: toEmailGuardKey(user.email), userId: user.id },
      }),
    );

    await expect(userRepositoryWrite.createUser(user)).resolves.toEqual(user);
  });
});

describe('When a user is deleted', () => {
  it('should release the email for reuse by another user', async () => {
    const first = buildUser();
    await userRepositoryWrite.createUser(first);
    await userRepositoryWrite.deleteUserById(first.id);

    await expect(
      userRepositoryWrite.createUser(buildUser(first.email)),
    ).resolves.toMatchObject({ email: first.email });
  });

  it('should still delete the user when the guard release fails', async () => {
    const user = buildUser();
    await userRepositoryWrite.createUser(user);

    const originalSend = dynamoDocumentClient.send.bind(dynamoDocumentClient);
    const sendSpy = jest
      .spyOn(dynamoDocumentClient, 'send')
      .mockImplementation(((command: unknown) => {
        if (
          command instanceof DeleteCommand &&
          command.input.TableName === USER_EMAIL_TABLE_NAME
        ) {
          return Promise.reject(new Error('guard table unavailable'));
        }
        return originalSend(command as never);
      }) as never);

    await expect(userRepositoryWrite.deleteUserById(user.id)).resolves.toEqual(
      user,
    );

    sendSpy.mockRestore();
  });
});

describe('When a user changes their email', () => {
  it('should release the old email and claim the new one', async () => {
    const user = buildUser();
    const newEmail = `swap-${randomUUID()}@email.com`;
    await userRepositoryWrite.createUser(user);

    const updated = await userRepositoryWrite.updateUserById(user.id, {
      email: newEmail,
    });
    expect(updated?.email).toBe(newEmail);

    // Old email is free again; new email is now taken.
    await expect(
      userRepositoryWrite.createUser(buildUser(user.email)),
    ).resolves.toMatchObject({ email: user.email });
    await expect(
      userRepositoryWrite.createUser(buildUser(newEmail)),
    ).rejects.toThrow(ConflictError);
  });

  it('should reject an update to an email owned by another user', async () => {
    const owner = buildUser();
    const other = buildUser();
    await userRepositoryWrite.createUser(owner);
    await userRepositoryWrite.createUser(other);

    await expect(
      userRepositoryWrite.updateUserById(other.id, { email: owner.email }),
    ).rejects.toThrow(ConflictError);
  });

  it('should return null without claiming anything for a missing user', async () => {
    const email = `ghost-${randomUUID()}@email.com`;

    await expect(
      userRepositoryWrite.updateUserById(randomUUID(), { email }),
    ).resolves.toBeNull();

    // The email was never claimed, so a create with it succeeds.
    await expect(
      userRepositoryWrite.createUser(buildUser(email)),
    ).resolves.toMatchObject({ email });
  });

  it('should keep the guard on a case-only email change', async () => {
    const user = buildUser(`only-case-${randomUUID()}@email.com`);
    await userRepositoryWrite.createUser(user);

    const updated = await userRepositoryWrite.updateUserById(user.id, {
      email: user.email.toUpperCase(),
    });
    expect(updated?.email).toBe(user.email.toUpperCase());

    // Uniqueness still enforced under the same normalized key.
    await expect(
      userRepositoryWrite.createUser(buildUser(user.email)),
    ).rejects.toThrow(ConflictError);
  });
});
