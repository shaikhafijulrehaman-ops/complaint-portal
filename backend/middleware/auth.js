import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_mic_college_grievance_key_2026');

      // Admin Token Check
      if (decoded.role === 'admin') {
        req.user = {
          email: decoded.email,
          role: 'admin',
          id: 'admin_session'
        };
        return next();
      }

      // Find user from token
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'User account not found' });
      }
      req.user.role = 'student'; // Set role context
      
      next();
    } catch (error) {
      console.error('[JWT Verification Error]', error);
      res.status(401).json({ message: 'Not authorized, token verification failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no session token provided' });
  }
};

export const adminProtect = async (req, res, next) => {
  await protect(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ message: 'Access Denied: Requires administrator privileges' });
    }
  });
};
