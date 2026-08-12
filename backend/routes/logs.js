import express from 'express';
import EmailLog from '../models/EmailLog.js';
import { adminProtect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get all email outbox logs
// @route   GET /api/logs
// @access  Private (Admin only)
router.get('/', adminProtect, async (req, res) => {
  try {
    const logs = await EmailLog.find({}).sort({ createdAt: -1 });
    res.json(logs);
  } catch (error) {
    console.error('[Get Logs Error]', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
