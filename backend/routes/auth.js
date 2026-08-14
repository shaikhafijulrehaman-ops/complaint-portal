import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import EmailLog from '../models/EmailLog.js';
import AdminUser from '../models/AdminUser.js';
import { adminProtect } from '../middleware/auth.js';

const router = express.Router();

const generateToken = (id, email, role) => {
  return jwt.sign(
    { id, email, role },
    process.env.JWT_SECRET || 'super_secret_mic_college_grievance_key_2026',
    { expiresIn: '30d' }
  );
};

// @desc    Register a new student
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  const { email, password, acceptsToS } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim.endsWith('@mictech.ac.in')) {
      return res.status(400).json({ message: 'Invalid email format. Please use a valid college email address ending with @mictech.ac.in.' });
    }

    if (!acceptsToS) {
      return res.status(400).json({ message: 'You must accept the Terms of Service & Privacy Policy to register.' });
    }

    // Check duplicate
    const userExists = await User.findOne({ email: emailTrim });
    if (userExists) {
      return res.status(400).json({ message: 'An account with this college email already exists.' });
    }

    // Create user
    const user = await User.create({
      email: emailTrim,
      password,
      tos_accepted: acceptsToS,
      tos_accepted_at: new Date()
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        email: user.email,
        role: 'student'
      }
    });
  } catch (error) {
    console.error('[Registration Error]', error);
    res.status(500).json({ message: 'Unable to complete registration. Please try again.' });
  }
});

// @desc    Authenticate user (student / admin)
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const emailTrim = email.trim().toLowerCase();

    // Admin Auth
    if (role === 'admin') {
      const admin = await AdminUser.findOne({ email: emailTrim });
      if (!admin) {
        return res.status(401).json({ message: 'Invalid college email or password.' });
      }

      const isMatch = await admin.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid college email or password.' });
      }

      return res.json({
        email: admin.email,
        id: admin._id,
        role: 'admin',
        token: generateToken(admin._id, admin.email, 'admin')
      });
    }

    // Student Auth
    const user = await User.findOne({ email: emailTrim });
    if (!user) {
      return res.status(401).json({ message: 'Invalid college email or password.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid college email or password.' });
    }

    res.json({
      email: user.email,
      id: user._id,
      role: 'student',
      token: generateToken(user._id, user.email, 'student')
    });
  } catch (error) {
    console.error('[Login Error]', error);
    res.status(500).json({ message: 'Invalid college email or password.' });
  }
});

// @desc    Check if student email exists for password recovery
// @route   POST /api/auth/check-email
// @access  Public
router.post('/check-email', async (req, res) => {
  const { email } = req.body;
  try {
    const emailTrim = email.trim().toLowerCase();
    const user = await User.findOne({ email: emailTrim });
    res.json({ exists: !!user });
  } catch (error) {
    console.error('[Check Email Error]', error);
    res.status(500).json({ message: 'Unable to check email.' });
  }
});

// @desc    Generate password reset OTP and log email
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const emailTrim = email.trim().toLowerCase();
    
    // Log the OTP email in EmailLog for admin dashboard access
    const emailSubject = `Grievance Portal - Password Recovery OTP`;
    const emailBody = `
      <div style="font-family: Inter, Arial, sans-serif; padding: 20px; color: #1E293B; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 8px;">
          <h2 style="color: #0F4C81; margin-bottom: 16px;">Password Reset Request</h2>
          <p>You requested to reset your password for the DVR & Dr. HS MIC College Student Grievance Portal.</p>
          <p>Please enter the following 6-digit verification code to choose a new password:</p>
          <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
              <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0F4C81;">${otp}</span>
          </div>
          <p style="font-size: 13px; color: #64748B;">This OTP is valid for 15 minutes. If you did not request this, you can safely ignore this email.</p>
          <hr style="border:0; border-top:1px solid #E2E8F0; margin:20px 0;"/>
          <p style="font-size: 11px; color: #94A3B8;">© DVR & Dr. HS MIC College of Technology - Grievance Committee</p>
      </div>
    `;

    await EmailLog.create({
      recipient: emailTrim,
      subject: emailSubject,
      body: emailBody,
      complaintId: 'OTP-RESET',
      category: 'Auth Recovery',
      status: 'Sent'
    });

    res.json({ message: 'OTP logged successfully' });
  } catch (error) {
    console.error('[OTP Generation Error]', error);
    res.status(500).json({ message: 'Unable to dispatch OTP.' });
  }
});

// @desc    Reset student password
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', async (req, res) => {
  const { email, password } = req.body;

  try {
    const emailTrim = email.trim().toLowerCase();
    const user = await User.findOne({ email: emailTrim });
    if (!user) {
      return res.status(404).json({ message: 'User account not found.' });
    }

    user.password = password;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('[Password Reset Error]', error);
    res.status(500).json({ message: 'Unable to reset password.' });
  }
});

// @desc    Change administrator password
// @route   POST /api/auth/change-password
// @access  Private (Admin only)
router.post('/change-password', adminProtect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    const admin = await AdminUser.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: 'Administrator account not found.' });
    }

    const isMatch = await admin.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password.' });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('[Change Password Error]', error);
    res.status(500).json({ message: 'Unable to update password. Please try again.' });
  }
});

export default router;
