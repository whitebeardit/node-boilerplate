import { IUserRepositoryRead } from '../repository/user.repository.read';
import { IUserRepositoryWrite } from '../repository/user.repository.write';
import { IUser } from '../interfaces/user.interface';
import {
  IParamsCreateUser,
  IParamsUpdateUser,
  IParamsUserService,
  IUserService,
} from '../interfaces/user.service.interface';

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
   * @returns The created user document
   */
  async createUser(params: IParamsCreateUser): Promise<IUser> {
    try {
      // Business logic (e.g., validation, ID/email uniqueness checks)
      const existingUser = await this.userRepositoryRead.findUserByEmail(
        params.email,
      );
      if (existingUser) {
        throw new Error('A user with this email already exists');
      }

      return await this.userRepositoryWrite.createUser(params);
    } catch (error) {
      throw new Error(`Error creating user: ${(error as Error).message}`);
    }
  }

  /**
   * Get a user by ID
   * @param id - The user's ID
   * @returns The user document or null if not found
   */
  async getUserById(id: string): Promise<IUser | null> {
    try {
      const user = await this.userRepositoryRead.findUserById(id);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      throw new Error(
        `Error retrieving user by ID: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get a user by email
   * @param email - The user's email
   * @returns The user document or null if not found
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    try {
      const user = await this.userRepositoryRead.findUserByEmail(email);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      throw new Error(
        `Error retrieving user by email: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Update a user's information by ID
   * @param id - The user's ID
   * @param updateData - The data to update
   * @returns The updated user document or null if not found
   */
  async updateUserById(
    id: string,
    params: IParamsUpdateUser,
  ): Promise<IUser | null> {
    try {
      const user = await this.userRepositoryRead.findUserById(id);
      if (!user) {
        throw new Error('User not found');
      }

      return await this.userRepositoryWrite.updateUserById(id, params.userData);
    } catch (error) {
      throw new Error(`Error updating user: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a user by ID
   * @param id - The user's ID
   * @returns The deleted user document or null if not found
   */
  async deleteUserById(id: string): Promise<IUser | null> {
    try {
      const user = await this.userRepositoryRead.findUserById(id);
      if (!user) {
        throw new Error('User not found');
      }

      await this.userRepositoryWrite.deleteUserById(id);
      return user;
    } catch (error) {
      throw new Error(`Error deleting user: ${(error as Error).message}`);
    }
  }

  /**
   * List all users with optional filters
   * @param filter - Filters for the query
   * @returns An array of user documents
   */
  async listUsers(filter: Partial<IUser> = {}): Promise<IUser[]> {
    try {
      return await this.userRepositoryRead.listUsers(filter);
    } catch (error) {
      throw new Error(`Error listing users: ${(error as Error).message}`);
    }
  }
}
