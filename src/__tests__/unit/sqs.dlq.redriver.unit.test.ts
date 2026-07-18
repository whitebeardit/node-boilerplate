import { SQSClient, StartMessageMoveTaskCommand } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { SqsDlqRedriver } from '../../infrastructure/messaging/sqs/sqs.dlq.redriver';

const DLQ_ARN = 'arn:aws:sqs:us-east-1:000000000000:queue-under-test-dlq';
const sqsMock = mockClient(SQSClient);

beforeEach(() => {
  sqsMock.reset();
});

describe('When we start a DLQ redrive', () => {
  it('should move messages back to the source queue and return the task handle', async () => {
    sqsMock
      .on(StartMessageMoveTaskCommand)
      .resolves({ TaskHandle: 'task-1' });
    const redriver = new SqsDlqRedriver({
      client: new SQSClient({}),
      dlqArn: DLQ_ARN,
    });

    const result = await redriver.redrive();

    expect(result).toEqual({ taskHandle: 'task-1' });
    expect(sqsMock).toHaveReceivedCommandWith(StartMessageMoveTaskCommand, {
      SourceArn: DLQ_ARN,
    });
  });

  it('should return no task handle when the queue does not report one', async () => {
    sqsMock.on(StartMessageMoveTaskCommand).resolves({});
    const redriver = new SqsDlqRedriver({
      client: new SQSClient({}),
      dlqArn: DLQ_ARN,
    });

    await expect(redriver.redrive()).resolves.toEqual({
      taskHandle: undefined,
    });
  });
});
