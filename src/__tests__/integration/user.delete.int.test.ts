import mongoose from 'mongoose';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IUser } from '../../domain/user/interfaces/user.interface';

let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    id: new mongoose.Types.ObjectId().toHexString(),
    email: `delete-${Date.now()}@email.com`,
    name: 'Whitebeard',
    createdAt: new Date(),
  };
  await Muser.create(existingUser);
});

describe('When we delete an existing user', () => {
  it('should return 200 and remove the user from the database', async () => {
    const { body, statusCode } = await supertest(app.app).delete(
      `/users/${existingUser.id}`,
    );

    expect(statusCode).toBe(200);
    expect(body).toMatchObject({ message: 'User deleted successfully' });

    const userInDb = await Muser.findOne({ id: existingUser.id });
    expect(userInDb).toBeNull();
  });
});

describe('When we delete a user that does not exist', () => {
  it('should return 404 with the contract error shape', async () => {
    const { body, statusCode } = await supertest(app.app).delete(
      `/users/${new mongoose.Types.ObjectId().toHexString()}`,
    );

    expect(statusCode).toBe(404);
    expect(body).toMatchObject({ message: 'User not found', status: 404 });
  });
});
