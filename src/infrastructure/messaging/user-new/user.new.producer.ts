import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { context, propagation } from '@opentelemetry/api';
import { ContextAsyncHooks, Logger } from 'traceability';
import { IUser } from '../../../domain/user/interfaces/user.interface';

export interface IUserNewProducerSqs {
  publishUserNew(user: IUser): Promise<void>;
}

export interface IParamsUserNewProducerSqs {
  client: SQSClient;
  queueUrl: string;
}

/**
 * Reference producer for USER.NEW: injects the current trace context
 * (traceparent/tracestate via OTel, plus the legacy cid) into the message
 * attributes so any consumer can resume the same trace. The cid is always
 * present even when the OTel SDK is disabled.
 */
export class UserNewProducerSqs implements IUserNewProducerSqs {
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
      }),
    );

    Logger.info('USER.NEW message published', {
      eventName: 'user.new.published',
      userId: user.id,
    });
  }
}
