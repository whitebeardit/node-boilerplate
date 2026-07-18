import { IUser } from '../../../domain/user/interfaces/user.interface';
import { IUserRepositoryWrite } from '../../../domain/user/repository/user.repository.write';
import { Muser } from '../../db/mongo/models/user.model';
import { HIDE_MONGO_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';

export class UserRepositoryWrite implements IUserRepositoryWrite {
  /**
   * Create a new user in the database
   * @param userData - The user data to create
   * @returns The created user
   */
  async createUser(userData: IUser): Promise<IUser> {
    const createdUser = await Muser.create(userData);
    return {
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      createdAt: createdUser.createdAt,
    };
  }

  /**
   * Update a user by ID
   * @param id - The user's ID
   * @param updateData - The data to update
   * @returns The updated user or null if not found
   */
  async updateUserById(
    id: string,
    updateData: Partial<IUser>,
  ): Promise<IUser | null> {
    return Muser.findOneAndUpdate({ id }, updateData, {
      new: true,
      projection: HIDE_MONGO_INTERNAL_FIELDS,
    }).lean<IUser>();
  }

  /**
   * Delete a user by ID
   * @param id - The user's ID
   * @returns The deleted user or null if not found
   */
  async deleteUserById(id: string): Promise<IUser | null> {
    return Muser.findOneAndDelete(
      { id },
      { projection: HIDE_MONGO_INTERNAL_FIELDS },
    ).lean<IUser>();
  }
}
