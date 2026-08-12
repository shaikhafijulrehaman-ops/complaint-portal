import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/db.js';

// Route Imports
import authRoutes from './routes/auth.js';
import complaintRoutes from './routes/complaints.js';
import logRoutes from './routes/logs.js';
import contactRoutes from './routes/contacts.js';

// Load env vars
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middlewares
app.use(cors());
// Set high JSON body limit to support Base64 file attachments safely
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Static directory for file uploads
const __dirname = path.resolve();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database availability validation middleware
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'Database is currently offline. Please ensure MongoDB is started locally (port 27017) or update the MONGODB_URI connection string inside backend/.env.'
    });
  }
  next();
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/contacts', contactRoutes);

// Base route test
app.get('/', (req, res) => {
  res.send('DVR & Dr. HS MIC College Grievance Portal API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[Express Server Running] Server active on port: ${PORT}`);
});
