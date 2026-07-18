import { randomUUID } from 'crypto';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { UserNewWorkerFactory } from '../../infrastructure/config/factories/messaging/user.new.worker.factory';
import { UserRepositoryRead } from '../../infrastructure/repository/user/user.repository.read';

const userRepositoryRead = new UserRepositoryRead();
const sqsMock = mockClient(SQSClient);

async function waitForDeleteCalls(count: number) {
  while (sqsMock.commandCalls(DeleteMessageCommand).length < count) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

const emptyReceiveAfterDelay = () =>
  new Promise<{ Messages: never[] }>((resolve) =>
    setTimeout(() => resolve({ Messages: [] }), 25),
  );

describe('When a user creation flows from the REST API to the database', () => {
  it('should carry the cid from the request through the queue into the stored item', async () => {
    sqsMock.reset();
    const paramsCreate = {
      id: randomUUID(),
      email: `e2e-${randomUUID()}@email.com`,
      name: 'Whitebeard',
      createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    };

    // 1. REST API accepts and publishes USER.NEW with the request cid.
    const { body, statusCode } = await supertest(app.app)
      .post('/users')
      .send(paramsCreate);
    expect(statusCode).toBe(202);
    const { cid } = body;
    expect(typeof cid).toBe('string');

    // Capture the published message BEFORE resetting the mock.
    const [sendCall] = sqsMock.commandCalls(SendMessageCommand);
    const sent = sendCall.args[0].input;
    expect(sent.MessageAttributes?.cid?.StringValue).toBe(cid);

    // 2. The worker consumes exactly what the API published.
    sqsMock.reset();
    sqsMock
      .on(ReceiveMessageCommand)
      .resolvesOnce({
        Messages: [
          {
            MessageId: 'e2e-message-1',
            ReceiptHandle: 'e2e-receipt-1',
            Body: sent.MessageBody,
            MessageAttributes: sent.MessageAttributes,
          },
        ],
      })
      .callsFake(emptyReceiveAfterDelay);

    const worker = UserNewWorkerFactory.create();
    worker.start();
    await waitForDeleteCalls(1);
    await worker.stop();

    // 3. The user is in DynamoDB, indexed by the same cid.
    const usersByCid = await userRepositoryRead.listUsersByCid(cid);
    expect(usersByCid).toEqual([
      {
        id: paramsCreate.id,
        name: paramsCreate.name,
        email: paramsCreate.email,
        createdAt: new Date(paramsCreate.createdAt),
      },
    ]);

    // 4. The ops route finds the user by correlation id over HTTP.
    const opsResponse = await supertest(app.app).get(`/ops/users?cid=${cid}`);
    expect(opsResponse.statusCode).toBe(200);
    expect(opsResponse.body).toEqual({
      cid,
      items: [
        {
          id: paramsCreate.id,
          name: paramsCreate.name,
          email: paramsCreate.email,
          createdAt: paramsCreate.createdAt,
        },
      ],
    });
  });
});
