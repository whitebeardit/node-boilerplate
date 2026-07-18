import {
  IPaginatedResult,
  IPagination,
} from '../../common/pagination.interface';
import { IUserRepositoryRead } from '../repository/user.repository.read';
import { IUserRepositoryWrite } from '../repository/user.repository.write';
import { IUser } from './user.interface';

export interface IParamsCreateUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface IParamsUpdateUser {
  id: string;
  userData: Partial<Pick<IUser, 'name' | 'email'>>;
}

export interface IParamsUserService {
  userRepositoryRead: IUserRepositoryRead;
  userRepositoryWrite: IUserRepositoryWrite;
}

export interface IUserService {
  createUser(params: IParamsCreateUser): Promise<IUser>;
  getUserById(id: string): Promise<IUser>;
  getUserByEmail(email: string): Promise<IUser>;
  updateUserById(params: IParamsUpdateUser): Promise<IUser>;
  deleteUserById(id: string): Promise<IUser>;
  listUsers(
    filter: Partial<IUser>,
    pagination?: Partial<IPagination>,
  ): Promise<IPaginatedResult<IUser>>;
}
