import { Message } from '@aws-sdk/client-sqs';

export interface IWorker {
  start(): void;
  stop(): Promise<void>;
}

// 'ack' deletes the message; 'retry' leaves it on the queue so the visibility
// timeout expires and the redrive policy eventually moves it to the DLQ.
export type TMessageDecision = 'ack' | 'retry';

export interface ISqsMessageHandler {
  handle(message: Message): Promise<TMessageDecision>;
}
