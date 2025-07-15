import { IUser } from '../../../domain/user/interfaces/user.interface';
import { Muser } from '../../db/mongo/models/user.model';

export class UserRepositoryWrite {
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
}
