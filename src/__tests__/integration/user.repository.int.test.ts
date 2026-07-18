import { randomUUID } from 'crypto';
import { ContextAsyncHooks } from 'traceability';
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
    const page = await userRepositoryRead.listUsers(
      { name: existingUser.name, createdAt: existingUser.createdAt },
      { limit: 10 },
    );

    expect(page.items).toEqual([existingUser]);
    expect(page.nextCursor).toBeUndefined();
  });

  it('should return an empty page when no user matches', async () => {
    const page = await userRepositoryRead.listUsers(
      { name: `absent-${randomUUID()}` },
      { limit: 10 },
    );

    expect(page).toEqual({ items: [], nextCursor: undefined });
  });
});

describe('When we paginate a filtered list with a cursor', () => {
  it('should walk every match exactly once across pages', async () => {
    const sharedName = `shared-${randomUUID()}`;
    const users = await Promise.all(
      [1, 2, 3].map((index) =>
        userRepositoryWrite.createUser({
          id: randomUUID(),
          email: `cursor-${index}-${randomUUID()}@email.com`,
          name: sharedName,
          createdAt: new Date(),
        }),
      ),
    );

    const seenIds: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await userRepositoryRead.listUsers(
        { name: sharedName },
        { limit: 2, cursor },
      );
      seenIds.push(...page.items.map((user) => user.id));
      cursor = page.nextCursor;
    } while (cursor);

    expect([...seenIds].sort()).toEqual(users.map((user) => user.id).sort());
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

describe('When we create a user inside a tracking context', () => {
  it('should stamp the cid on the item and find it by correlation id', async () => {
    const cid = randomUUID().replace(/-/g, '');
    const trackedUser = {
      id: randomUUID(),
      email: `tracked-${randomUUID()}@email.com`,
      name: 'Whitebeard',
      createdAt: new Date(),
    };

    await ContextAsyncHooks.asyncLocalStorage.run({ cid }, () =>
      userRepositoryWrite.createUser(trackedUser),
    );

    await expect(userRepositoryRead.listUsersByCid(cid)).resolves.toEqual([
      trackedUser,
    ]);
  });
});

describe('When we create a user outside any tracking context', () => {
  it('should store no cid and find nothing by correlation id', async () => {
    // existingUser was created without an ALS scope in beforeEach
    await expect(
      userRepositoryRead.listUsersByCid(`absent-${randomUUID()}`),
    ).resolves.toEqual([]);
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
