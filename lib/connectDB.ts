// import mongoose from 'mongoose';

// const MONGODB_URI = process.env.MONGO_URI!;

// const connectDB = async () => {
//   if (mongoose.connections[0].readyState) return;
//   await mongoose.connect(MONGODB_URI);
// };

// export default connectDB;

import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!, {
      dbName: 'codeEditor',
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
export default connectDB;