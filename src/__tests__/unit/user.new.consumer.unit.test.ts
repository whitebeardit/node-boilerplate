import { Message } from '@aws-sdk/client-sqs';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { ContextAsyncHooks } from 'traceability';
import { UserNewConsumer } from '../../infrastructure/messaging/user-new/user.new.consumer';
import { IUserService } from '../../domain/user/interfaces/user.service.interface';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { ConflictError } from '../../domain/errors/conflict.error';

const A_TRACE_ID = '0af7651916cd43dd8448eb211c80319c';
const A_TRACEPARENT = `00-${A_TRACE_ID}-b7ad6b7169203331-01`;
const A_CID = 'c1d2c1d2c1d2c1d2c1d2c1d2c1d2c1d2';

const A_USER: IUser = {
  id: 'user-1',
  name: 'Whitebeard',
  email: 'whitebeard@email.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

let userService: jest.Mocked<IUserService>;
let consumer: UserNewConsumer;

beforeEach(() => {
  userService = {
    createUser: jest.fn(),
    getUserById: jest.fn(),
    getUserByEmail: jest.fn(),
    updateUserById: jest.fn(),
    deleteUserById: jest.fn(),
    listUsers: jest.fn(),
  };
  consumer = new UserNewConsumer(userService);
});

function buildMessage(
  body: string | undefined,
  attributes: Record<string, string> = {},
): Message {
  return {
    MessageId: 'message-1',
    ReceiptHandle: 'receipt-1',
    Body: body,
    MessageAttributes: Object.fromEntries(
      Object.entries(attributes).map(([name, value]) => [
        name,
        { DataType: 'String', StringValue: value },
      ]),
    ),
  };
}

describe('When we consume a valid USER.NEW message', () => {
  it('should create the user with the parsed payload and ack', async () => {
    userService.createUser.mockResolvedValue(A_USER);
    const message = buildMessage(
      JSON.stringify({ ...A_USER, createdAt: A_USER.createdAt.toISOString() }),
    );

    const decision = await consumer.handle(message);

    expect(decision).toBe('ack');
    expect(userService.createUser).toHaveBeenCalledWith({
      id: A_USER.id,
      name: A_USER.name,
      email: A_USER.email,
      createdAt: A_USER.createdAt,
    });
  });

  it('should default createdAt to now when the payload omits it', async () => {
    userService.createUser.mockResolvedValue(A_USER);
    const { id, name, email } = A_USER;

    const decision = await consumer.handle(
      buildMessage(JSON.stringify({ id, name, email })),
    );

    expect(decision).toBe('ack');
    const params = userService.createUser.mock.calls[0][0];
    expect(params.createdAt).toBeInstanceOf(Date);
    expect(Number.isNaN(params.createdAt.getTime())).toBe(false);
  });
});

describe('When the message carries tracking attributes', () => {
  it('should expose the cid attribute to everything the service runs', async () => {
    let cidSeenByService: unknown;
    userService.createUser.mockImplementation(async (params) => {
      cidSeenByService = ContextAsyncHooks.getContext()?.cid;
      return { ...A_USER, ...params };
    });

    await consumer.handle(
      buildMessage(JSON.stringify({ ...A_USER, createdAt: undefined }), {
        cid: A_CID,
        traceparent: A_TRACEPARENT,
      }),
    );

    expect(cidSeenByService).toBe(A_CID);
  });

  it('should derive the cid from the traceparent when no cid attribute exists', async () => {
    let cidSeenByService: unknown;
    userService.createUser.mockImplementation(async (params) => {
      cidSeenByService = ContextAsyncHooks.getContext()?.cid;
      return { ...A_USER, ...params };
    });

    await consumer.handle(
      buildMessage(JSON.stringify({ ...A_USER, createdAt: undefined }), {
        traceparent: A_TRACEPARENT,
      }),
    );

    expect(cidSeenByService).toBe(A_TRACE_ID);
  });
});

describe('When the payload is invalid', () => {
  it('should ack a message with a malformed JSON body', async () => {
    const decision = await consumer.handle(buildMessage('{not-json'));

    expect(decision).toBe('ack');
    expect(userService.createUser).not.toHaveBeenCalled();
  });

  it('should ack a message without a body', async () => {
    const decision = await consumer.handle(buildMessage(undefined));

    expect(decision).toBe('ack');
    expect(userService.createUser).not.toHaveBeenCalled();
  });

  it('should ack a message missing a required field', async () => {
    const decision = await consumer.handle(
      buildMessage(JSON.stringify({ id: 'user-1', name: 'Whitebeard' })),
    );

    expect(decision).toBe('ack');
    expect(userService.createUser).not.toHaveBeenCalled();
  });

  it('should ack a message with an invalid createdAt', async () => {
    const decision = await consumer.handle(
      buildMessage(
        JSON.stringify({
          id: 'user-1',
          name: 'Whitebeard',
          email: 'whitebeard@email.com',
          createdAt: 'not-a-date',
        }),
      ),
    );

    expect(decision).toBe('ack');
    expect(userService.createUser).not.toHaveBeenCalled();
  });
});

describe('When the user already exists', () => {
  it('should ack on a duplicated email (ConflictError)', async () => {
    userService.createUser.mockRejectedValue(
      new ConflictError('A user with this email already exists'),
    );

    const decision = await consumer.handle(
      buildMessage(JSON.stringify({ ...A_USER, createdAt: undefined })),
    );

    expect(decision).toBe('ack');
  });

  it('should ack on a duplicated id (conditional check failure)', async () => {
    userService.createUser.mockRejectedValue(
      new ConditionalCheckFailedException({
        message: 'The conditional request failed',
        $metadata: {},
      }),
    );

    const decision = await consumer.handle(
      buildMessage(JSON.stringify({ ...A_USER, createdAt: undefined })),
    );

    expect(decision).toBe('ack');
  });
});

describe('When processing fails with an unknown error', () => {
  it('should leave the message for retry', async () => {
    userService.createUser.mockRejectedValue(new Error('dynamodb throttled'));

    const decision = await consumer.handle(
      buildMessage(JSON.stringify({ ...A_USER, createdAt: undefined })),
    );

    expect(decision).toBe('retry');
  });
});
