import { OpsService } from '../../../domain/ops/service/ops.service';
import { UserRepositoryRead } from '../../repository/user/user.repository.read';
import { SqsDlqRedriver } from '../../messaging/sqs/sqs.dlq.redriver';
import { sqsClient } from '../../messaging/sqs/sqs.client';
import { env } from '../env';

export class OpsServiceFactory {
  static create() {
    const dlqRedriver = new SqsDlqRedriver({
      client: sqsClient,
      dlqArn: env.sqsUserNewDlqArn,
    });

    return new OpsService({
      dlqRedriver,
      userRepositoryRead: new UserRepositoryRead(),
    });
  }
}
