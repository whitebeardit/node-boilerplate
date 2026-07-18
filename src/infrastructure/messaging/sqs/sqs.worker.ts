import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { Logger } from 'traceability';
import { ISqsMessageHandler, IWorker } from '../worker.interface';

const DEFAULT_WAIT_TIME_SECONDS = 20;
const DEFAULT_MAX_NUMBER_OF_MESSAGES = 10;
const DEFAULT_POLL_ERROR_BACKOFF_MILLISECONDS = 5000;

// Trace context travels in these attributes; without them the SDK does not
// return message attributes at all.
const TRACKING_MESSAGE_ATTRIBUTE_NAMES = ['traceparent', 'tracestate', 'cid'];

export interface IParamsSqsWorker {
  client: SQSClient;
  queueUrl: string;
  handler: ISqsMessageHandler;
  waitTimeSeconds?: number;
  maxNumberOfMessages?: number;
  pollErrorBackoffMilliseconds?: number;
}

/**
 * Generic long-polling SQS worker. Delivery guarantees live here: a message is
 * deleted only when the handler decides 'ack'; on 'retry' it stays on the
 * queue until the visibility timeout expires and the queue's redrive policy
 * eventually moves it to the DLQ. Transient receive failures never crash the
 * process — the loop logs, backs off and keeps polling.
 */
export class SqsWorker implements IWorker {
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private readonly handler: ISqsMessageHandler;
  private readonly waitTimeSeconds: number;
  private readonly maxNumberOfMessages: number;
  private readonly pollErrorBackoffMilliseconds: number;

  private running = false;
  private loopPromise: Promise<void> = Promise.resolve();
  private abortController = new AbortController();

  constructor({
    client,
    queueUrl,
    handler,
    waitTimeSeconds = DEFAULT_WAIT_TIME_SECONDS,
    maxNumberOfMessages = DEFAULT_MAX_NUMBER_OF_MESSAGES,
    pollErrorBackoffMilliseconds = DEFAULT_POLL_ERROR_BACKOFF_MILLISECONDS,
  }: IParamsSqsWorker) {
    this.client = client;
    this.queueUrl = queueUrl;
    this.handler = handler;
    this.waitTimeSeconds = waitTimeSeconds;
    this.maxNumberOfMessages = maxNumberOfMessages;
    this.pollErrorBackoffMilliseconds = pollErrorBackoffMilliseconds;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.abortController = new AbortController();
    Logger.info('SQS worker started', {
      eventName: 'sqs.worker.started',
      process: 'SqsWorker',
      queueUrl: this.queueUrl,
    });
    this.loopPromise = this.pollLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
    // Cancels the in-flight long poll (up to waitTimeSeconds); the current
    // batch still drains before the loop promise resolves.
    this.abortController.abort();
    await this.loopPromise;
    Logger.info('SQS worker stopped', {
      eventName: 'sqs.worker.stopped',
      process: 'SqsWorker',
      queueUrl: this.queueUrl,
    });
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        const { Messages } = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            WaitTimeSeconds: this.waitTimeSeconds,
            MaxNumberOfMessages: this.maxNumberOfMessages,
            MessageAttributeNames: TRACKING_MESSAGE_ATTRIBUTE_NAMES,
          }),
          { abortSignal: this.abortController.signal },
        );

        for (const message of Messages ?? []) {
          const decision = await this.handler.handle(message);
          if (decision === 'ack') {
            await this.client.send(
              new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: message.ReceiptHandle,
              }),
            );
            Logger.info('SQS message acknowledged', {
              eventName: 'sqs.message.acked',
              process: 'SqsWorker',
              messageId: message.MessageId,
            });
          } else {
            Logger.info('SQS message left for retry', {
              eventName: 'sqs.message.retry',
              process: 'SqsWorker',
              messageId: message.MessageId,
            });
          }
        }
      } catch (error) {
        if (!this.running) {
          break;
        }
        Logger.error(`SQS poll failed: ${(error as Error).message}`, {
          eventName: 'sqs.worker.poll_error',
          process: 'SqsWorker',
          queueUrl: this.queueUrl,
        });
        await new Promise((resolve) =>
          setTimeout(resolve, this.pollErrorBackoffMilliseconds),
        );
      }
    }
  }
}
