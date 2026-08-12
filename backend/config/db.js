import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/complaint_portal');
    console.log(`[MongoDB Connected] Host: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[MongoDB Connection Error] ${error.message}`);
    console.warn('[Database Offline] Server remains active. Ensure MongoDB is started locally on port 27017.');
  }
};

export default connectDB;
