import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { context, propagation } from '@opentelemetry/api';
import { ContextAsyncHooks, Logger } from 'traceability';
import { IUser } from '../../../domain/user/interfaces/user.interface';
import { IUserNewProducer } from '../../../domain/user/messaging/user.new.producer';

export interface IParamsUserNewProducerSqs {
  client: SQSClient;
  queueUrl: string;
}

/**
 * SQS implementation of the USER.NEW producer port: injects the current trace
 * context (traceparent/tracestate via OTel, plus the legacy cid) into the
 * message attributes so any consumer can resume the same trace. The cid is
 * always present even when the OTel SDK is disabled.
 */
export class UserNewProducerSqs implements IUserNewProducer {
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor({ client, queueUrl }: IParamsUserNewProducerSqs) {
    this.client = client;
    this.queueUrl = queueUrl;
  }

  async publishUserNew(user: IUser): Promise<void> {
    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);

    // cid precedence: current tracking context > traceparent > generated.
    const currentCid = ContextAsyncHooks.getContext()?.cid;
    const { cid } = ContextAsyncHooks.getTrackId({
      ...carrier,
      ...(typeof currentCid === 'string' ? { cid: currentCid } : {}),
    });
    carrier.cid = cid as string;

    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
        }),
        MessageAttributes: Object.fromEntries(
          Object.entries(carrier).map(([name, value]) => [
            name,
            { DataType: 'String', StringValue: value },
          ]),
        ),
        // On a FIFO queue the user id is the idempotency key: duplicate
        // requests dedup at the queue (5-minute window) and processing is
        // serialized per user. Standard queues reject these fields, and the
        // storage-level guarantees hold either way.
        ...(this.queueUrl.endsWith('.fifo')
          ? { MessageGroupId: user.id, MessageDeduplicationId: user.id }
          : {}),
      }),
    );

    Logger.info('USER.NEW message published', {
      eventName: 'user.new.published',
      userId: user.id,
    });
  }
}
