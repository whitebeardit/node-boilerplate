import { randomUUID } from 'crypto';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import '../../../jest/setup-integration-tests';
import { UserNewWorkerFactory } from '../../infrastructure/config/factories/messaging/user.new.worker.factory';
import { UserRepositoryRead } from '../../infrastructure/repository/user/user.repository.read';
import { IUser } from '../../domain/user/interfaces/user.interface';

const userRepositoryRead = new UserRepositoryRead();
const sqsMock = mockClient(SQSClient);

const A_CID = 'c1d2c1d2c1d2c1d2c1d2c1d2c1d2c1d2';

function buildUserNewMessage(user: IUser) {
  return {
    MessageId: `message-${user.id}`,
    ReceiptHandle: `receipt-${user.id}`,
    Body: JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    }),
    MessageAttributes: {
      cid: { DataType: 'String', StringValue: A_CID },
    },
  };
}

async function waitForDeleteCalls(count: number) {
  while (sqsMock.commandCalls(DeleteMessageCommand).length < count) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

// Throttled empty poll as the default: an instantly resolving mock would let
// the poll loop free-run (the 20s long poll paces it in production).
const emptyReceiveAfterDelay = () =>
  new Promise<{ Messages: never[] }>((resolve) =>
    setTimeout(() => resolve({ Messages: [] }), 25),
  );

beforeEach(() => {
  sqsMock.reset();
});

describe('When a USER.NEW message arrives on the queue', () => {
  it('should persist the user in DynamoDB and acknowledge the message', async () => {
    const user: IUser = {
      id: randomUUID(),
      name: 'Whitebeard',
      email: `worker-${randomUUID()}@email.com`,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    sqsMock
      .on(ReceiveMessageCommand)
      .resolvesOnce({ Messages: [buildUserNewMessage(user)] })
      .callsFake(emptyReceiveAfterDelay);

    const worker = UserNewWorkerFactory.create();
    worker.start();
    await waitForDeleteCalls(1);
    await worker.stop();

    const userInDb = await userRepositoryRead.findUserById(user.id);
    expect(userInDb).toEqual(user);
    expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
      ReceiptHandle: `receipt-${user.id}`,
    });
  });
});

describe('When the same USER.NEW message is delivered twice', () => {
  it('should ack the duplicate and keep a single user', async () => {
    const user: IUser = {
      id: randomUUID(),
      name: 'Whitebeard',
      email: `worker-dup-${randomUUID()}@email.com`,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    sqsMock
      .on(ReceiveMessageCommand)
      .resolvesOnce({ Messages: [buildUserNewMessage(user)] })
      .resolvesOnce({ Messages: [buildUserNewMessage(user)] })
      .callsFake(emptyReceiveAfterDelay);

    const worker = UserNewWorkerFactory.create();
    worker.start();
    await waitForDeleteCalls(2);
    await worker.stop();

    const page = await userRepositoryRead.listUsers(
      { email: user.email },
      { limit: 10 },
    );
    expect(page.items).toHaveLength(1);
    expect(sqsMock.commandCalls(DeleteMessageCommand)).toHaveLength(2);
  });
});
