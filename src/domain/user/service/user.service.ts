import { IUserRepositoryRead } from '../repository/user.repository.read';
import { IUserRepositoryWrite } from '../repository/user.repository.write';
import { IUserNewProducer } from '../messaging/user.new.producer';
import { IUser } from '../interfaces/user.interface';
import {
  IParamsCreateUser,
  IParamsUpdateUser,
  IParamsUserService,
  IUserService,
} from '../interfaces/user.service.interface';
import { ConflictError } from '../../errors/conflict.error';
import { NotFoundError } from '../../errors/not-found.error';
import {
  IPaginatedResult,
  IPagination,
} from '../../common/pagination.interface';
import { User } from '../user.entity';

const DEFAULT_LIST_LIMIT = 20;

export class UserService implements IUserService {
  private userRepositoryRead: IUserRepositoryRead;
  private userRepositoryWrite: IUserRepositoryWrite;
  private userNewProducer: IUserNewProducer;

  constructor({
    userRepositoryRead,
    userRepositoryWrite,
    userNewProducer,
  }: IParamsUserService) {
    this.userRepositoryRead = userRepositoryRead;
    this.userRepositoryWrite = userRepositoryWrite;
    this.userNewProducer = userNewProducer;
  }

  /**
   * Enqueue a user creation: publishes USER.NEW and returns once the message
   * is on the queue. Persistence (and the email-uniqueness rule) happens
   * asynchronously when the consumer processes the message.
   * @param params - The user data to enqueue
   */
  async enqueueUserCreation(params: IParamsCreateUser): Promise<void> {
    const user = new User(
      params.id,
      params.name,
      params.email,
      params.createdAt,
    );
    await this.userNewProducer.publishUserNew(user);
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

    const user = new User(
      params.id,
      params.name,
      params.email,
      params.createdAt,
    );
    return this.userRepositoryWrite.createUser(user);
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
   * List users with optional filters and cursor pagination
   * @param filter - Filters for the query
   * @param pagination - Optional limit (default: 20) and cursor from the previous page
   * @returns The page of users plus the cursor for the next page, if any
   */
  async listUsers(
    filter: Partial<IUser> = {},
    pagination: Partial<IPagination> = {},
  ): Promise<IPaginatedResult<IUser>> {
    const { limit = DEFAULT_LIST_LIMIT, cursor } = pagination;
    return this.userRepositoryRead.listUsers(filter, { limit, cursor });
  }
}
