import { IUser } from '../../../domain/user/interfaces/user.interface';
import { Muser } from '../../db/mongo/models/user.model';

export class UserRepositoryRead {
  /**
   * Find a user by ID
   * @param id - The user's ID
   * @returns The user document or null if not found
   */
  async findUserById(id: string): Promise<IUser | null> {
    try {
      return await Muser.findOne({ id });
    } catch (error) {
      throw new Error(`Error finding user by ID: ${(error as Error).message}`);
    }
  }

  /**
   * Find a user by email
   * @param email - The user's email
   * @returns The user document or null if not found
   */
  async findUserByEmail(email: string): Promise<IUser | null> {
    try {
      return await Muser.findOne({ email });
    } catch (error) {
      throw new Error(
        `Error finding user by email: ${(error as Error).message}`,
      );
    }
  }

  /**
   * List all users
   * @param filter - Optional filters for the query
   * @returns An array of user documents
   */
  async listUsers(filter: Partial<IUser>): Promise<IUser[]> {
    try {
      return await Muser.find(filter);
    } catch (error) {
      throw new Error(`Error listing users: ${(error as Error).message}`);
    }
  }
}
