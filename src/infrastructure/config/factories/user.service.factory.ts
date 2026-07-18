import { UserService } from '../../../domain/user/service/user.service';
import { UserRepositoryRead } from '../../repository/user/user.repository.read';
import { UserRepositoryWrite } from '../../repository/user/user.repository.write';
import { UserNewProducerSqs } from '../../messaging/user-new/user.new.producer';
import { sqsClient } from '../../messaging/sqs/sqs.client';
import { env } from '../env';

export class UserServiceFactory {
  static create() {
    const repoRead = new UserRepositoryRead();
    const repoWrite = new UserRepositoryWrite();
    const userNewProducer = new UserNewProducerSqs({
      client: sqsClient,
      queueUrl: env.sqsUserNewQueueUrl,
    });

    return new UserService({
      userRepositoryRead: repoRead,
      userRepositoryWrite: repoWrite,
      userNewProducer,
    });
  }
}
