import { randomUUID } from 'crypto';
import { SQSClient, StartMessageMoveTaskCommand } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import supertest from 'supertest';
import { ContextAsyncHooks } from 'traceability';
import { app } from '../../../jest/setup-integration-tests';
import { UserRepositoryWrite } from '../../infrastructure/repository/user/user.repository.write';
import { IUser } from '../../domain/user/interfaces/user.interface';

const userRepositoryWrite = new UserRepositoryWrite();
const sqsMock = mockClient(SQSClient);

beforeEach(() => {
  sqsMock.reset();
});

describe('When we force a redrive of the USER.NEW dead-letter queue', () => {
  it('should start the move task on the configured DLQ and return 202', async () => {
    sqsMock
      .on(StartMessageMoveTaskCommand)
      .resolves({ TaskHandle: 'task-1' });

    const { body, statusCode } = await supertest(app.app).post(
      '/ops/user-new/redrive',
    );

    expect(statusCode).toBe(202);
    expect(body).toEqual({
      message: 'DLQ redrive started',
      taskHandle: 'task-1',
    });
    expect(sqsMock).toHaveReceivedCommandWith(StartMessageMoveTaskCommand, {
      SourceArn: 'arn:aws:sqs:us-east-1:000000000000:user-new-dlq-test',
    });
  });
});

describe('When we search users by correlation id', () => {
  it('should return the users created under the cid', async () => {
    const cid = randomUUID().replace(/-/g, '');
    const user: IUser = {
      id: randomUUID(),
      name: 'Whitebeard',
      email: `ops-${randomUUID()}@email.com`,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    await ContextAsyncHooks.asyncLocalStorage.run({ cid }, () =>
      userRepositoryWrite.createUser(user),
    );

    const { body, statusCode } = await supertest(app.app).get(
      `/ops/users?cid=${cid}`,
    );

    expect(statusCode).toBe(200);
    expect(body).toEqual({
      cid,
      items: [{ ...user, createdAt: user.createdAt.toISOString() }],
    });
  });

  it('should return an empty list for an unknown cid', async () => {
    const { body, statusCode } = await supertest(app.app).get(
      `/ops/users?cid=unknown-${randomUUID()}`,
    );

    expect(statusCode).toBe(200);
    expect(body.items).toEqual([]);
  });

  it('should return 400 when the cid parameter is missing', async () => {
    const { statusCode } = await supertest(app.app).get('/ops/users');

    expect(statusCode).toBe(400);
  });
});
