import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { UserRepositoryRead } from '../../infrastructure/repository/user/user.repository.read';
import { IUser } from '../../domain/user/interfaces/user.interface';

const userRepositoryRead = new UserRepositoryRead();
let paramsCreate: IUser;

beforeEach(async () => {
  paramsCreate = {
    id: randomUUID(),
    email: `create-${randomUUID()}@email.com`,
    name: 'Whitebeard',
    createdAt: new Date(),
  };
});

describe('When we try to create a valid user', () => {
  it('should return success when we try to create a valid user', async () => {
    const { body, statusCode } = await supertest(app.app)
      .post(`/users`)
      .send(paramsCreate);

    const userInDb = await userRepositoryRead.findUserById(paramsCreate.id);

    expect(body).toMatchObject({
      ...paramsCreate,
      createdAt: paramsCreate.createdAt.toISOString(),
    });
    expect(statusCode).toBe(201);
    expect(userInDb).toMatchObject({ ...paramsCreate });
  });
});

describe('When we create a user without providing createdAt', () => {
  it('should return 201 with a server-generated createdAt', async () => {
    const { id, name, email } = paramsCreate;
    const { body, statusCode } = await supertest(app.app)
      .post(`/users`)
      .send({ id, name, email });

    expect(statusCode).toBe(201);
    expect(new Date(body.createdAt).getTime()).not.toBeNaN();
  });
});

describe('When we try to create a user with an invalid email', () => {
  it('should return 400 rejected by the contract validation', async () => {
    const { statusCode } = await supertest(app.app)
      .post(`/users`)
      .send({ ...paramsCreate, email: 'not-an-email' });

    expect(statusCode).toBe(400);
  });
});

describe('When we try to create a user with an email already in use', () => {
  it('should return 409 with the contract error shape', async () => {
    await supertest(app.app).post(`/users`).send(paramsCreate);

    const { body, statusCode } = await supertest(app.app)
      .post(`/users`)
      .send({ ...paramsCreate, id: randomUUID() });

    expect(statusCode).toBe(409);
    expect(body).toMatchObject({
      message: 'A user with this email already exists',
      status: 409,
    });
  });
});
