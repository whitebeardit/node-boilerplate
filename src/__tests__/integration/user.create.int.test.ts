import mongoose from 'mongoose';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IUser } from '../../domain/user/interfaces/user.interface';
let paramsCreate: IUser;

beforeEach(async () => {
  paramsCreate = {
    id: new mongoose.Types.ObjectId().toHexString(),
    email: 'whitebeard@email.com',
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
    expect(statusCode).toBe(201);
    expect(userInDb).toMatchObject({ ...paramsCreate });
  });
});
