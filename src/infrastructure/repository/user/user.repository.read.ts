import { IUser } from '../../../domain/user/interfaces/user.interface';
import { IUserRepositoryRead } from '../../../domain/user/repository/user.repository.read';
import { Muser } from '../../db/mongo/models/user.model';
import { HIDE_MONGO_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';

export class UserRepositoryRead implements IUserRepositoryRead {
  /**
   * Find a user by ID
   * @param id - The user's ID
   * @returns The user or null if not found
   */
  async findUserById(id: string): Promise<IUser | null> {
    return Muser.findOne({ id }, HIDE_MONGO_INTERNAL_FIELDS).lean<IUser>();
  }

  /**
   * Find a user by email
   * @param email - The user's email
   * @returns The user or null if not found
   */
  async findUserByEmail(email: string): Promise<IUser | null> {
    return Muser.findOne({ email }, HIDE_MONGO_INTERNAL_FIELDS).lean<IUser>();
  }

  /**
   * List all users
   * @param filter - Optional filters for the query
   * @returns An array of users
   */
  async listUsers(filter: Partial<IUser>): Promise<IUser[]> {
    return Muser.find(filter, HIDE_MONGO_INTERNAL_FIELDS).lean<IUser[]>();
  }
}
