import mongoose from 'mongoose';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IUser } from '../../domain/user/interfaces/user.interface';
let paramsCreate: IUser;

beforeEach(async () => {
  paramsCreate = {
    id: new mongoose.Types.ObjectId().toHexString(),
    email: `create-${new mongoose.Types.ObjectId().toHexString()}@email.com`,
    name: 'Whitebeard',
    createdAt: new Date(),
  };
});

describe('When we try to create a valid user', () => {
  it('should return success when we try to create a valid user', async () => {
    const { body, statusCode } = await supertest(app.app)
      .post(`/users`)
      .send(paramsCreate);

    const userInDb = await Muser.findOne({ id: paramsCreate.id });

    expect(body).toMatchObject({
      ...paramsCreate,
      createdAt: paramsCreate.createdAt.toISOString(),
    });
    expect(body._id).toBeUndefined();
    expect(statusCode).toBe(201);
    expect(userInDb).toMatchObject({ ...paramsCreate });
  });
});

describe('When we try to create a user with an email already in use', () => {
  it('should return 409 with the contract error shape', async () => {
    await supertest(app.app).post(`/users`).send(paramsCreate);

    const { body, statusCode } = await supertest(app.app)
      .post(`/users`)
      .send({ ...paramsCreate, id: new mongoose.Types.ObjectId().toHexString() });

    expect(statusCode).toBe(409);
    expect(body).toMatchObject({
      message: 'A user with this email already exists',
      status: 409,
    });
  });
});
