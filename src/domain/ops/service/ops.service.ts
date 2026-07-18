import { IUser } from '../../user/interfaces/user.interface';
import { IUserRepositoryRead } from '../../user/repository/user.repository.read';
import { IDlqRedriver, IRedriveResult } from '../messaging/dlq.redriver';
import {
  IOpsService,
  IParamsOpsService,
} from '../interfaces/ops.service.interface';

export class OpsService implements IOpsService {
  private dlqRedriver: IDlqRedriver;
  private userRepositoryRead: IUserRepositoryRead;

  constructor({ dlqRedriver, userRepositoryRead }: IParamsOpsService) {
    this.dlqRedriver = dlqRedriver;
    this.userRepositoryRead = userRepositoryRead;
  }

  /**
   * Force a redrive of the USER.NEW dead-letter queue back to its source
   * @returns The handle of the started move task, when the queue reports one
   */
  async redriveUserNewDlq(): Promise<IRedriveResult> {
    return this.dlqRedriver.redrive();
  }

  /**
   * Find the users created under a correlation id
   * @param cid - The correlation id propagated from the original request
   * @returns The matching users — an empty list is a valid answer
   */
  async findUsersByCid(cid: string): Promise<IUser[]> {
    return this.userRepositoryRead.listUsersByCid(cid);
  }
}
