import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { UserRepositoryWrite } from '../../infrastructure/repository/user/user.repository.write';
import { IUser } from '../../domain/user/interfaces/user.interface';

const userRepositoryWrite = new UserRepositoryWrite();
let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    id: randomUUID(),
    email: `get-${randomUUID()}@email.com`,
    name: 'Whitebeard',
    createdAt: new Date(),
  };
  await userRepositoryWrite.createUser(existingUser);
});

describe('When we get a user by ID', () => {
  it('should return 200 with the user and no storage internal fields', async () => {
    const { body, statusCode } = await supertest(app.app).get(
      `/users/${existingUser.id}`,
    );

    expect(statusCode).toBe(200);
    expect(body).toEqual({
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
      createdAt: existingUser.createdAt.toISOString(),
    });
  });
});

describe('When we get a user that does not exist', () => {
  it('should return 404 with the contract error shape', async () => {
    const { body, statusCode } = await supertest(app.app).get(
      `/users/${randomUUID()}`,
    );

    expect(statusCode).toBe(404);
    expect(body).toMatchObject({ message: 'User not found', status: 404 });
  });
});

describe('When we list users', () => {
  it('should return 200 with a page containing the existing user', async () => {
    const { body, statusCode } = await supertest(app.app).get('/users');

    expect(statusCode).toBe(200);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: existingUser.id }),
      ]),
    );
  });

  it('should respect the limit and expose a cursor for the next page', async () => {
    const { body, statusCode } = await supertest(app.app).get('/users?limit=1');

    expect(statusCode).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(typeof body.nextCursor).toBe('string');
  });

  it('should resume from the cursor without repeating items', async () => {
    const firstPage = await supertest(app.app).get('/users?limit=1');
    const { body, statusCode } = await supertest(app.app).get(
      `/users?limit=1&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`,
    );

    expect(statusCode).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).not.toBe(firstPage.body.items[0].id);
  });

  it('should return 400 when the cursor is malformed', async () => {
    const { body, statusCode } = await supertest(app.app).get(
      '/users?cursor=not-a-valid-cursor',
    );

    expect(statusCode).toBe(400);
    expect(body).toMatchObject({
      message: 'Invalid pagination cursor',
      status: 400,
    });
  });

  it('should return 400 when the limit is above the contract maximum', async () => {
    const { statusCode } = await supertest(app.app).get('/users?limit=101');

    expect(statusCode).toBe(400);
  });
});
