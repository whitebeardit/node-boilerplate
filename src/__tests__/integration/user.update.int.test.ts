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
    email: `update-${randomUUID()}@email.com`,
    name: 'Whitebeard',
    createdAt: new Date(),
  };
  await userRepositoryWrite.createUser(existingUser);
});

describe('When we update an existing user', () => {
  it('should return 200 with the updated user and persist the change', async () => {
    const { body, statusCode } = await supertest(app.app)
      .put(`/users/${existingUser.id}`)
      .send({ name: 'Edward Newgate' });

    expect(statusCode).toBe(200);
    expect(body.name).toBe('Edward Newgate');
    expect(body.email).toBe(existingUser.email);

    const userInDb = await userRepositoryRead.findUserById(existingUser.id);
    expect(userInDb?.name).toBe('Edward Newgate');
  });
});

describe('When we update a user that does not exist', () => {
  it('should return 404 with the contract error shape', async () => {
    const { body, statusCode } = await supertest(app.app)
      .put(`/users/${randomUUID()}`)
      .send({ name: 'Nobody' });

    expect(statusCode).toBe(404);
    expect(body).toMatchObject({ message: 'User not found', status: 404 });
  });
});
