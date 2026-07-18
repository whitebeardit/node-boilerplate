import mongoose, { Types } from 'mongoose';
import { IUser } from '../../../../domain/user/interfaces/user.interface';

/**
 * Persistence shape of the user document: the domain interface plus the
 * Mongo-specific fields. Lives next to the schema (not in the model file)
 * to keep the schema -> model import direction free of cycles.
 */
export interface IMUser extends IUser {
  _id: Types.ObjectId;
}

export const userSchema = new mongoose.Schema<IMUser>({
  id: {
    type: String,
    required: true,
    unique: true, // Assuming IDs are unique
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true, // Assuming emails are unique
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address',
    ],
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now, // Automatically set the createdAt field if not provided
  },
});
