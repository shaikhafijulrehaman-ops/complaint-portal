import express from 'express';
import Complaint from '../models/Complaint.js';
import EmailLog from '../models/EmailLog.js';
import { adminProtect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get dashboard metrics using real MongoDB aggregation counts
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
router.get('/dashboard', adminProtect, async (req, res) => {
  try {
    const total = await Complaint.countDocuments();
    
    // Pending includes Pending, Under Review, In Progress (equivalent to student-facing Submitted, Under Review, Assigned)
    const pending = await Complaint.countDocuments({
      status: { $in: ['Pending', 'Under Review', 'In Progress'] }
    });
    
    // Resolved includes Resolved, Closed, Rejected
    const resolved = await Complaint.countDocuments({
      status: { $in: ['Resolved', 'Closed', 'Rejected'] }
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    
    const today = await Complaint.countDocuments({
      createdAt: { $gte: startOfToday, $lte: endOfToday }
    });

    // Category distribution using MongoDB aggregation pipeline
    const categoryStats = await Complaint.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      }
    ]);

    const categoryDistribution = {};
    categoryStats.forEach(stat => {
      if (stat._id) {
        categoryDistribution[stat._id] = stat.count;
      }
    });

    res.json({
      totalComplaints: total,
      pendingComplaints: pending,
      resolvedComplaints: resolved,
      submittedToday: today,
      categoryDistribution
    });
  } catch (error) {
    console.error('[Admin Dashboard API Error]', error);
    res.status(500).json({ message: 'Internal server error fetching stats.' });
  }
});

// @desc    Get all email outbox routing logs
// @route   GET /api/admin/email-logs
// @access  Private (Admin only)
router.get('/email-logs', adminProtect, async (req, res) => {
  try {
    const logs = await EmailLog.find({}).sort({ createdAt: -1 });
    res.json(logs);
  } catch (error) {
    console.error('[Admin Email Logs API Error]', error);
    res.status(500).json({ message: 'Internal server error fetching email logs.' });
  }
});

export default router;
