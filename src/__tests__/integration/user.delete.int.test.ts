import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { UserRepositoryRead } from '../../infrastructure/repository/user/user.repository.read';
import { UserRepositoryWrite } from '../../infrastructure/repository/user/user.repository.write';
import { IUser } from '../../domain/user/interfaces/user.interface';

const userRepositoryRead = new UserRepositoryRead();
const userRepositoryWrite = new UserRepositoryWrite();
let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    id: randomUUID(),
    email: `delete-${randomUUID()}@email.com`,
    name: 'Whitebeard',
    createdAt: new Date(),
  };
  await userRepositoryWrite.createUser(existingUser);
});

describe('When we delete an existing user', () => {
  it('should return 200 and remove the user from the database', async () => {
    const { body, statusCode } = await supertest(app.app).delete(
      `/users/${existingUser.id}`,
    );

    expect(statusCode).toBe(200);
    expect(body).toMatchObject({ message: 'User deleted successfully' });

    const userInDb = await userRepositoryRead.findUserById(existingUser.id);
    expect(userInDb).toBeNull();
  });
});

describe('When we delete a user that does not exist', () => {
  it('should return 404 with the contract error shape', async () => {
    const { body, statusCode } = await supertest(app.app).delete(
      `/users/${randomUUID()}`,
    );

    expect(statusCode).toBe(404);
    expect(body).toMatchObject({ message: 'User not found', status: 404 });
  });
});
