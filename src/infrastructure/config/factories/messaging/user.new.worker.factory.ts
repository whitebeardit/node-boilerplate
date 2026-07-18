import { IWorker } from '../../../messaging/worker.interface';
import { SqsWorker } from '../../../messaging/sqs/sqs.worker';
import { sqsClient } from '../../../messaging/sqs/sqs.client';
import { UserNewConsumer } from '../../../messaging/user-new/user.new.consumer';
import { UserServiceFactory } from '../user.service.factory';
import { env } from '../../env';

export class UserNewWorkerFactory {
  static create(): IWorker {
    const handler = new UserNewConsumer(UserServiceFactory.create());

    return new SqsWorker({
      client: sqsClient,
      queueUrl: env.sqsUserNewQueueUrl,
      handler,
    });
  }
}
