import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import connectDB from './config/db.js';
import fs from 'fs';

import { verifyTransporter } from './utils/mailer.js';

// Route Imports
import authRoutes from './routes/auth.js';
import complaintRoutes from './routes/complaints.js';
import logRoutes from './routes/logs.js';
import contactRoutes from './routes/contacts.js';
import categoryRoutes from './routes/categories.js';
import complaintTypeRoutes from './routes/complaintTypes.js';
import adminRoutes from './routes/admin.js';

// Load env vars
dotenv.config();

// Connect to MongoDB & Run Seeding
connectDB();

const app = express();

// Security Headers (Disable CSP to allow flexible local media/script loading safely)
app.use(helmet({
  contentSecurityPolicy: false
}));

// Input sanitization against MongoDB Query Injection
app.use(mongoSanitize());

// CORS configuration (Reject production wildcard)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser requests
    if (!origin) return callback(null, true);
    
    const isLocal = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    if (isLocal || allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS due to security configuration'));
    }
  },
  credentials: true
}));

// Set high JSON body limit to support Base64 file attachments safely
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Static directory for file uploads
const __dirname = path.resolve();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Video Streaming Endpoint (Bypasses database availability check middleware)
app.get('/api/video', (req, res) => {
  const videoPath = req.query.path || process.env.PUBLIC_VIDEO_PATH || "C:\\Users\\shaik\\Downloads\\header video of complaint portal.mp4";
  
  if (!videoPath) {
    return res.status(400).send('Video path is not specified');
  }

  // Security: resolve path and check it is a valid video file
  const resolvedPath = path.resolve(videoPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  if (ext !== '.mp4' && ext !== '.webm' && ext !== '.ogg' && ext !== '.mov') {
    return res.status(403).send('Access denied: Invalid file type');
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).send('Video file not found');
  }

  const stat = fs.statSync(resolvedPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(resolvedPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': `video/${ext === '.mov' ? 'quicktime' : ext.slice(1)}`,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': `video/${ext === '.mov' ? 'quicktime' : ext.slice(1)}`,
    };
    res.writeHead(200, head);
    fs.createReadStream(resolvedPath).pipe(res);
  }
});

// Database availability validation middleware
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'Database connection is currently offline. Please try again in a few moments.'
    });
  }
  next();
});

// Rate limiting for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again after 15 minutes.' }
});

// Mount API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/complaint-types', complaintTypeRoutes);
app.use('/api/admin', adminRoutes);

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
  verifyTransporter();
});
