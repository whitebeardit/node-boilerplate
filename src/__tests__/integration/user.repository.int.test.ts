import { randomUUID } from 'crypto';
import '../../../jest/setup-integration-tests';
import { UserRepositoryRead } from '../../infrastructure/repository/user/user.repository.read';
import { UserRepositoryWrite } from '../../infrastructure/repository/user/user.repository.write';
import { IUser } from '../../domain/user/interfaces/user.interface';

const userRepositoryRead = new UserRepositoryRead();
const userRepositoryWrite = new UserRepositoryWrite();
let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    id: randomUUID(),
    email: `repository-${randomUUID()}@email.com`,
    name: `name-${randomUUID()}`,
    createdAt: new Date(),
  };
  await userRepositoryWrite.createUser(existingUser);
});

describe('When we list users filtering by attributes', () => {
  it('should return only the users matching every filter', async () => {
    const users = await userRepositoryRead.listUsers(
      { name: existingUser.name, createdAt: existingUser.createdAt },
      { limit: 10, offset: 0 },
    );

    expect(users).toEqual([existingUser]);
  });

  it('should return an empty array when no user matches', async () => {
    const users = await userRepositoryRead.listUsers(
      { name: `absent-${randomUUID()}` },
      { limit: 10, offset: 0 },
    );

    expect(users).toEqual([]);
  });
});

describe('When we update a user with an empty payload', () => {
  it('should return the user unchanged when it exists', async () => {
    const user = await userRepositoryWrite.updateUserById(existingUser.id, {});

    expect(user).toEqual(existingUser);
  });

  it('should return null when the user does not exist', async () => {
    const user = await userRepositoryWrite.updateUserById(randomUUID(), {});

    expect(user).toBeNull();
  });
});

describe('When we update a user with a date attribute', () => {
  it('should persist the new date value', async () => {
    const newCreatedAt = new Date('2026-01-01T00:00:00.000Z');

    const user = await userRepositoryWrite.updateUserById(existingUser.id, {
      createdAt: newCreatedAt,
    });

    expect(user?.createdAt).toEqual(newCreatedAt);
  });
});
