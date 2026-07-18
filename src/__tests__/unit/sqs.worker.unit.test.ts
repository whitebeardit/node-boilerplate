import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { SqsWorker } from '../../infrastructure/messaging/sqs/sqs.worker';
import {
  ISqsMessageHandler,
  TMessageDecision,
} from '../../infrastructure/messaging/worker.interface';

const QUEUE_URL = 'http://localhost/000000000000/queue-under-test';
const sqsMock = mockClient(SQSClient);

function buildWorker(decision: TMessageDecision | Error) {
  const handler: jest.Mocked<ISqsMessageHandler> = {
    handle:
      decision instanceof Error
        ? jest.fn().mockRejectedValue(decision)
        : jest.fn().mockResolvedValue(decision),
  };
  const worker = new SqsWorker({
    client: new SQSClient({}),
    queueUrl: QUEUE_URL,
    handler,
    pollErrorBackoffMilliseconds: 0,
  });
  return { worker, handler };
}

// Resolves once the mocked client has served `count` receive calls, so tests
// can deterministically wait for full poll iterations before stopping.
async function waitForReceiveCalls(count: number) {
  while (sqsMock.commandCalls(ReceiveMessageCommand).length < count) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

// Queues the given batches and then throttled empty polls: an instantly
// resolving default would let the poll loop free-run (the 20s long poll is
// what paces it in production).
function mockReceiveBatches(...batches: Message[][]) {
  let stub = sqsMock.on(ReceiveMessageCommand);
  for (const batch of batches) {
    stub = stub.resolvesOnce({ Messages: batch });
  }
  stub.callsFake(
    () =>
      new Promise((resolve) =>
        setTimeout(() => resolve({ Messages: [] }), 25),
      ),
  );
}

beforeEach(() => {
  sqsMock.reset();
});

describe('When the worker receives a message and the handler acks', () => {
  it('should long-poll with tracking attributes and delete the message', async () => {
    mockReceiveBatches([
      { MessageId: 'message-1', ReceiptHandle: 'receipt-1' },
    ]);

    const { worker, handler } = buildWorker('ack');
    worker.start();
    await waitForReceiveCalls(2);
    await worker.stop();

    expect(handler.handle).toHaveBeenCalledWith(
      expect.objectContaining({ MessageId: 'message-1' }),
    );
    expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
      QueueUrl: QUEUE_URL,
      WaitTimeSeconds: 20,
      MaxNumberOfMessages: 10,
      MessageAttributeNames: ['traceparent', 'tracestate', 'cid'],
    });
    expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
      QueueUrl: QUEUE_URL,
      ReceiptHandle: 'receipt-1',
    });
  });
});

describe('When the handler decides to retry', () => {
  it('should leave the message on the queue', async () => {
    mockReceiveBatches([
      { MessageId: 'message-1', ReceiptHandle: 'receipt-1' },
    ]);

    const { worker } = buildWorker('retry');
    worker.start();
    await waitForReceiveCalls(2);
    await worker.stop();

    expect(sqsMock).not.toHaveReceivedCommand(DeleteMessageCommand);
  });
});

describe('When a receive returns no messages', () => {
  it('should keep polling without calling the handler', async () => {
    mockReceiveBatches();

    const { worker, handler } = buildWorker('ack');
    worker.start();
    await waitForReceiveCalls(3);
    await worker.stop();

    expect(handler.handle).not.toHaveBeenCalled();
  });
});

describe('When a receive fails with a transient error', () => {
  it('should log, back off and keep polling', async () => {
    sqsMock
      .on(ReceiveMessageCommand)
      .rejectsOnce(new Error('network down'))
      .callsFake(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ Messages: [] }), 25),
          ),
      );

    const { worker } = buildWorker('ack');
    worker.start();
    await waitForReceiveCalls(2);
    await worker.stop();

    expect(
      sqsMock.commandCalls(ReceiveMessageCommand).length,
    ).toBeGreaterThanOrEqual(2);
  });
});

describe('When we stop the worker mid-batch', () => {
  it('should drain the current batch before resolving', async () => {
    mockReceiveBatches([
      { MessageId: 'message-1', ReceiptHandle: 'receipt-1' },
      { MessageId: 'message-2', ReceiptHandle: 'receipt-2' },
    ]);

    const handler: jest.Mocked<ISqsMessageHandler> = {
      handle: jest.fn().mockResolvedValue('ack'),
    };
    const worker = new SqsWorker({
      client: new SQSClient({}),
      queueUrl: QUEUE_URL,
      handler,
      pollErrorBackoffMilliseconds: 0,
    });

    worker.start();
    worker.start(); // idempotent — a second start must not spawn another loop
    await waitForReceiveCalls(1);
    await worker.stop();
    await worker.stop(); // idempotent

    expect(handler.handle).toHaveBeenCalledTimes(2);
    expect(sqsMock.commandCalls(DeleteMessageCommand)).toHaveLength(2);
  });
});
