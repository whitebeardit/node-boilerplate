import { IUser } from '../../user/interfaces/user.interface';
import { IUserRepositoryRead } from '../../user/repository/user.repository.read';
import { IDlqRedriver, IRedriveResult } from '../messaging/dlq.redriver';

export interface IParamsOpsService {
  dlqRedriver: IDlqRedriver;
  userRepositoryRead: IUserRepositoryRead;
}

export interface IOpsService {
  redriveUserNewDlq(): Promise<IRedriveResult>;
  findUsersByCid(cid: string): Promise<IUser[]>;
}
