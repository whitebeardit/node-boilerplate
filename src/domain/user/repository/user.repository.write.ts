import { IUser } from '../interfaces/user.interface';

export interface IUserRepositoryWrite {
  createUser(userData: IUser): Promise<IUser>;
  updateUserById(id: string, userData: Partial<IUser>): Promise<IUser | null>;
  deleteUserById(id: string): Promise<IUser | null>;
}
