import mongoose from 'mongoose';

export const userSchema = new mongoose.Schema({
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
