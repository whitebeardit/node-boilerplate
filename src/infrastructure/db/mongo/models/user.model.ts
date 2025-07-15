import mongoose from 'mongoose';
import { userSchema } from '../schema/user.schema';

export const Muser = mongoose.model('user', userSchema);
