import bcrypt from 'bcryptjs';
import User from '@/models/User';
import connectDB from './connectDB';

export const registerUser = async (username: string, email: string, password: string) => {
  await connectDB();
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ username, email, password: hashed });
  await user.save();
  return user;
};

export const loginUser = async (email: string, password: string) => {
  await connectDB();
  const user = await User.findOne({ email });
  if (!user) throw new Error('User not found');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Invalid password');

  return user;
};