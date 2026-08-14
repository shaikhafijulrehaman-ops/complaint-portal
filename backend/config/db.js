import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { seedDatabase } from './seed.js';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('[MongoDB Config Error] MONGODB_URI is not set in backend env file.');
      return;
    }

    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
    });
    console.log(`[MongoDB Connected] Host: ${conn.connection.host}`);
    
    // Run dynamic idempotent seed
    await seedDatabase();
  } catch (error) {
    console.error(`[MongoDB Connection Fatal Error] ${error.message}`);
    console.warn('[Database Offline] Express server remains running. Connection pooling will attempt reconnects.');
  }
};

export default connectDB;
