import mongoose from 'mongoose';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IUser } from '../../domain/user/interfaces/user.interface';

let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    id: new mongoose.Types.ObjectId().toHexString(),
    email: `get-${Date.now()}@email.com`,
    name: 'Whitebeard',
    createdAt: new Date(),
  };
  await Muser.create(existingUser);
});

describe('When we get a user by ID', () => {
  it('should return 200 with the user and no Mongo internal fields', async () => {
    const { body, statusCode } = await supertest(app.app).get(
      `/users/${existingUser.id}`,
    );

    expect(statusCode).toBe(200);
    expect(body).toMatchObject({
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
    });
    expect(body._id).toBeUndefined();
    expect(body.__v).toBeUndefined();
  });
});

describe('When we get a user that does not exist', () => {
  it('should return 404 with the contract error shape', async () => {
    const { body, statusCode } = await supertest(app.app).get(
      `/users/${new mongoose.Types.ObjectId().toHexString()}`,
    );

    expect(statusCode).toBe(404);
    expect(body).toMatchObject({ message: 'User not found', status: 404 });
  });
});

describe('When we list users', () => {
  it('should return 200 with an array containing the existing user', async () => {
    const { body, statusCode } = await supertest(app.app).get('/users');

    expect(statusCode).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: existingUser.id }),
      ]),
    );
  });
});
