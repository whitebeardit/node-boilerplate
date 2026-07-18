import { Message } from '@aws-sdk/client-sqs';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { ContextAsyncHooks, Logger } from 'traceability';
import { IUserService } from '../../../domain/user/interfaces/user.service.interface';
import { BadRequestError } from '../../../domain/errors/bad-request.error';
import { ConflictError } from '../../../domain/errors/conflict.error';
import { ISqsMessageHandler, TMessageDecision } from '../worker.interface';
import { parseUserNewPayload } from './user.new.payload';

const tracer = trace.getTracer('user-new-consumer');

function isNonRetryable(error: unknown): boolean {
  return (
    error instanceof BadRequestError ||
    error instanceof ConflictError ||
    error instanceof ConditionalCheckFailedException
  );
}

/**
 * Thin message adapter (the messaging analog of a controller): re-establishes
 * the tracking context that came in the message and delegates to the domain
 * service. Business rules stay in the service; delivery semantics (delete vs
 * redrive) stay in the worker — this class only decides ack/retry.
 */
export class UserNewConsumer implements ISqsMessageHandler {
  private readonly userService: IUserService;

  constructor(userService: IUserService) {
    this.userService = userService;
  }

  async handle(message: Message): Promise<TMessageDecision> {
    const carrier: Record<string, string> = {};
    for (const name of ['traceparent', 'tracestate', 'cid']) {
      const value = message.MessageAttributes?.[name]?.StringValue;
      if (value) {
        carrier[name] = value;
      }
    }

    // cid precedence: explicit attribute > traceparent trace-id > generated.
    const { cid } = ContextAsyncHooks.getTrackId(carrier);
    const extractedContext = propagation.extract(context.active(), carrier);

    // The AsyncLocalStorage scope plus the consumer span wrap the whole
    // service -> repository -> SDK chain: every log line gains cid and
    // trace_id/span_id, and the DynamoDB spans become children of this one.
    return ContextAsyncHooks.asyncLocalStorage.run({ cid }, () =>
      tracer.startActiveSpan(
        'USER.NEW process',
        {
          kind: SpanKind.CONSUMER,
          attributes: {
            'messaging.system': 'aws_sqs',
            'messaging.operation': 'process',
            'messaging.message_id': message.MessageId,
          },
        },
        extractedContext,
        async (span) => {
          try {
            const params = parseUserNewPayload(message.Body);
            const user = await this.userService.createUser(params);
            Logger.info('USER.NEW message consumed', {
              eventName: 'user.new.consumed',
              userId: user.id,
              messageId: message.MessageId,
            });
            return 'ack';
          } catch (error) {
            if (isNonRetryable(error)) {
              Logger.warn(
                `USER.NEW message dropped: ${(error as Error).message}`,
                {
                  eventName: 'user.new.dropped',
                  messageId: message.MessageId,
                  body: message.Body,
                },
              );
              return 'ack';
            }
            Logger.error(
              `USER.NEW processing failed: ${(error as Error).message}`,
              {
                eventName: 'user.new.failed',
                messageId: message.MessageId,
                stack: (error as Error).stack,
              },
            );
            span.recordException(error as Error);
            span.setStatus({ code: SpanStatusCode.ERROR });
            return 'retry';
          } finally {
            span.end();
          }
        },
      ),
    );
  }
}
