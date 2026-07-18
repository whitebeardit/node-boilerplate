import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { ContextAsyncHooks } from 'traceability';
import { UserNewProducerSqs } from '../../infrastructure/messaging/user-new/user.new.producer';
import { IUser } from '../../domain/user/interfaces/user.interface';

const QUEUE_URL = 'http://localhost/000000000000/user-new-test';
const FIFO_QUEUE_URL = 'http://localhost/000000000000/user-new-test.fifo';
const A_CID = 'c1d2c1d2c1d2c1d2c1d2c1d2c1d2c1d2';

const A_USER: IUser = {
  id: 'user-1',
  name: 'Whitebeard',
  email: 'whitebeard@email.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const sqsMock = mockClient(SQSClient);

beforeEach(() => {
  sqsMock.reset();
});

describe('When we publish a USER.NEW message', () => {
  it('should send the serialized user with a cid attribute', async () => {
    const producer = new UserNewProducerSqs({
      client: new SQSClient({}),
      queueUrl: QUEUE_URL,
    });

    await producer.publishUserNew(A_USER);

    const [call] = sqsMock.commandCalls(SendMessageCommand);
    const input = call.args[0].input;
    expect(input.QueueUrl).toBe(QUEUE_URL);
    expect(JSON.parse(input.MessageBody as string)).toEqual({
      id: A_USER.id,
      name: A_USER.name,
      email: A_USER.email,
      createdAt: A_USER.createdAt.toISOString(),
    });
    expect(input.MessageAttributes?.cid?.StringValue).toMatch(
      /^[0-9a-f]{32}$/,
    );
    expect(input.MessageGroupId).toBeUndefined();
    expect(input.MessageDeduplicationId).toBeUndefined();
  });

  it('should use the user id as the FIFO idempotency key on .fifo queues', async () => {
    const producer = new UserNewProducerSqs({
      client: new SQSClient({}),
      queueUrl: FIFO_QUEUE_URL,
    });

    await producer.publishUserNew(A_USER);

    const [call] = sqsMock.commandCalls(SendMessageCommand);
    const input = call.args[0].input;
    expect(input.MessageGroupId).toBe(A_USER.id);
    expect(input.MessageDeduplicationId).toBe(A_USER.id);
  });

  it('should propagate the current tracking cid into the message', async () => {
    const producer = new UserNewProducerSqs({
      client: new SQSClient({}),
      queueUrl: QUEUE_URL,
    });

    await ContextAsyncHooks.asyncLocalStorage.run({ cid: A_CID }, () =>
      producer.publishUserNew(A_USER),
    );

    const [call] = sqsMock.commandCalls(SendMessageCommand);
    const input = call.args[0].input;
    expect(input.MessageAttributes?.cid?.StringValue).toBe(A_CID);
  });
});
