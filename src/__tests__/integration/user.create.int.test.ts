import { randomUUID } from 'crypto';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { UserRepositoryRead } from '../../infrastructure/repository/user/user.repository.read';
import { IUser } from '../../domain/user/interfaces/user.interface';

const userRepositoryRead = new UserRepositoryRead();
const sqsMock = mockClient(SQSClient);
let paramsCreate: IUser;

beforeEach(async () => {
  sqsMock.reset();
  paramsCreate = {
    id: randomUUID(),
    email: `create-${randomUUID()}@email.com`,
    name: 'Whitebeard',
    createdAt: new Date(),
  };
});

describe('When we try to create a valid user', () => {
  it('should accept the request and publish USER.NEW with the request cid', async () => {
    const { body, statusCode, headers } = await supertest(app.app)
      .post(`/users`)
      .send(paramsCreate);

    expect(statusCode).toBe(202);
    expect(body.message).toBe('User creation accepted');
    expect(body.cid).toBe(headers.cid);

    const [call] = sqsMock.commandCalls(SendMessageCommand);
    const input = call.args[0].input;
    expect(JSON.parse(input.MessageBody as string)).toEqual({
      ...paramsCreate,
      createdAt: paramsCreate.createdAt.toISOString(),
    });
    expect(input.MessageAttributes?.cid?.StringValue).toBe(body.cid);

    // Nothing is persisted synchronously — the consumer does that.
    await expect(
      userRepositoryRead.findUserById(paramsCreate.id),
    ).resolves.toBeNull();
  });
});

describe('When we create a user without providing createdAt', () => {
  it('should accept it and publish a server-generated createdAt', async () => {
    const { id, name, email } = paramsCreate;
    const { statusCode } = await supertest(app.app)
      .post(`/users`)
      .send({ id, name, email });

    expect(statusCode).toBe(202);
    const [call] = sqsMock.commandCalls(SendMessageCommand);
    const published = JSON.parse(call.args[0].input.MessageBody as string);
    expect(new Date(published.createdAt).getTime()).not.toBeNaN();
  });
});

describe('When we try to create a user with an invalid email', () => {
  it('should return 400 rejected by the contract validation', async () => {
    const { statusCode } = await supertest(app.app)
      .post(`/users`)
      .send({ ...paramsCreate, email: 'not-an-email' });

    expect(statusCode).toBe(400);
    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
  });
});
