import { IUser } from '../../domain/user/user.interface';
import { Muser } from '../db/mongo/models/user.model';

export class UserRepository {
  /**
   * Create a new user in the database
   * @param userData - The user data to create
   * @returns The created user document
   */
  async createUser(userData: IUser): Promise<IUser> {
    try {
      const user = new Muser(userData);
      return await user.save();
    } catch (error) {
      throw new Error(`Error creating user: ${(error as Error).message}`);
    }
  }

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
   * Update a user by ID
   * @param id - The user's ID
   * @param updateData - The data to update
   * @returns The updated user document or null if not found
   */
  async updateUserById(
    id: string,
    updateData: Partial<IUser>,
  ): Promise<IUser | null> {
    try {
      return await Muser.findOneAndUpdate({ id }, updateData, {
        new: true,
      });
    } catch (error) {
      throw new Error(`Error updating user by ID: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a user by ID
   * @param id - The user's ID
   * @returns The deleted user document or null if not found
   */
  async deleteUserById(id: string): Promise<IUser | null> {
    try {
      return await Muser.findOneAndDelete({ id });
    } catch (error) {
      throw new Error(`Error deleting user by ID: ${(error as Error).message}`);
    }
  }

  /**
   * List all users
   * @param filter - Optional filters for the query
   * @returns An array of user documents
   */
  async listUsers(filter: Partial<IUser> = {}): Promise<IUser[]> {
    try {
      return await Muser.find(filter);
    } catch (error) {
      throw new Error(`Error listing users: ${(error as Error).message}`);
    }
  }
}
