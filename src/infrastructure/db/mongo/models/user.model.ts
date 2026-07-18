import mongoose from 'mongoose';
import { IMUser, userSchema } from '../schema/user.schema';

export const Muser = mongoose.model<IMUser>('user', userSchema);
