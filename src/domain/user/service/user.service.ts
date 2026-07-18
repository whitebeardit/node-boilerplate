import { IUserRepositoryRead } from '../repository/user.repository.read';
import { IUserRepositoryWrite } from '../repository/user.repository.write';
import { IUser } from '../interfaces/user.interface';
import {
  IParamsCreateUser,
  IParamsUpdateUser,
  IParamsUserService,
  IUserService,
} from '../interfaces/user.service.interface';
import { ConflictError } from '../../errors/conflict.error';
import { NotFoundError } from '../../errors/not-found.error';

export class UserService implements IUserService {
  private userRepositoryRead: IUserRepositoryRead;
  private userRepositoryWrite: IUserRepositoryWrite;

  constructor({ userRepositoryRead, userRepositoryWrite }: IParamsUserService) {
    this.userRepositoryRead = userRepositoryRead;
    this.userRepositoryWrite = userRepositoryWrite;
  }

  /**
   * Create a new user
   * @param params - The user data to create
   * @returns The created user
   * @throws ConflictError when a user with the same email already exists
   */
  async createUser(params: IParamsCreateUser): Promise<IUser> {
    const existingUser = await this.userRepositoryRead.findUserByEmail(
      params.email,
    );
    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    return this.userRepositoryWrite.createUser(params);
  }

  /**
   * Get a user by ID
   * @param id - The user's ID
   * @returns The user
   * @throws NotFoundError when the user does not exist
   */
  async getUserById(id: string): Promise<IUser> {
    const user = await this.userRepositoryRead.findUserById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  /**
   * Get a user by email
   * @param email - The user's email
   * @returns The user
   * @throws NotFoundError when the user does not exist
   */
  async getUserByEmail(email: string): Promise<IUser> {
    const user = await this.userRepositoryRead.findUserByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  /**
   * Update a user's information by ID
   * @param params - The user's ID and the data to update
   * @returns The updated user
   * @throws NotFoundError when the user does not exist
   */
  async updateUserById(params: IParamsUpdateUser): Promise<IUser> {
    const updatedUser = await this.userRepositoryWrite.updateUserById(
      params.id,
      params.userData,
    );
    if (!updatedUser) {
      throw new NotFoundError('User not found');
    }
    return updatedUser;
  }

  /**
   * Delete a user by ID
   * @param id - The user's ID
   * @returns The deleted user
   * @throws NotFoundError when the user does not exist
   */
  async deleteUserById(id: string): Promise<IUser> {
    const deletedUser = await this.userRepositoryWrite.deleteUserById(id);
    if (!deletedUser) {
      throw new NotFoundError('User not found');
    }
    return deletedUser;
  }

  /**
   * List all users with optional filters
   * @param filter - Filters for the query
   * @returns An array of users
   */
  async listUsers(filter: Partial<IUser> = {}): Promise<IUser[]> {
    return this.userRepositoryRead.listUsers(filter);
  }
}
