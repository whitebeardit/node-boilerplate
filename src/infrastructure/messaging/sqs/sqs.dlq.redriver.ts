import { SQSClient, StartMessageMoveTaskCommand } from '@aws-sdk/client-sqs';
import { Logger } from 'traceability';
import {
  IDlqRedriver,
  IRedriveResult,
} from '../../../domain/ops/messaging/dlq.redriver';

export interface IParamsSqsDlqRedriver {
  client: SQSClient;
  dlqArn: string;
}

/**
 * Native SQS redrive: StartMessageMoveTask moves the DLQ messages back to
 * their original source queue (no DestinationArn), asynchronously and rate
 * managed by SQS itself.
 */
export class SqsDlqRedriver implements IDlqRedriver {
  private readonly client: SQSClient;
  private readonly dlqArn: string;

  constructor({ client, dlqArn }: IParamsSqsDlqRedriver) {
    this.client = client;
    this.dlqArn = dlqArn;
  }

  async redrive(): Promise<IRedriveResult> {
    const { TaskHandle } = await this.client.send(
      new StartMessageMoveTaskCommand({ SourceArn: this.dlqArn }),
    );
    Logger.info('DLQ redrive started', {
      eventName: 'ops.dlq.redrive_started',
      sourceArn: this.dlqArn,
      taskHandle: TaskHandle,
    });
    return { taskHandle: TaskHandle };
  }
}
