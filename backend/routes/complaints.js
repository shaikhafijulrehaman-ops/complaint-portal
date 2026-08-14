import express from 'express';
import fs from 'fs';
import path from 'path';
import Complaint from '../models/Complaint.js';
import EmailLog from '../models/EmailLog.js';
import Contact from '../models/Contact.js';
import Counter from '../models/Counter.js';
import { protect, adminProtect } from '../middleware/auth.js';
import { sendGrievanceEmail } from '../utils/mailer.js';

const router = express.Router();

// Helper to generate unique sequential complaint ID atomically (Format: MIC-GRV-YYYYMMDD-XXXX)
const generateUniqueId = async () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`; // '20260814'

  const counterId = `complaints-${dateStr}`;
  // Atomically increment the sequence counter for today
  const counter = await Counter.findOneAndUpdate(
    { id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqStr = String(counter.seq).padStart(4, '0');
  return `MIC-GRV-${dateStr}-${seqStr}`;
};

// Category assigned departments mapping
const getAssignedDepartment = (category) => {
  if (category === "Hostel Issues") return "Hostel Committee";
  if (category === "Food Issues") return "Food & Canteen Services";
  if (category === "Campus Issues") return "Campus Infrastructure";
  if (category === "Complaint Against Student") return "Student Affairs";
  if (category === "Complaint Against Faculty") return "Academic Discipline Board";
  if (category === "Bus Issues") return "Bus Management";
  return "General Discipline Committee";
};

// @desc    Submit a new complaint
// @route   POST /api/complaints
// @access  Private (Authenticated students)
router.post('/', protect, async (req, res) => {
  const { category, complaintType, description, attachmentName, attachmentData, busNumber, busRoute } = req.body;

  try {
    if (!category || !complaintType || !description) {
      return res.status(400).json({ message: 'Category, type, and description are required.' });
    }

    const complaintId = await generateUniqueId();
    let attachmentUrl = '';

    // Handle base64 file upload if present
    if (attachmentData && attachmentName) {
      const matches = attachmentData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const fileType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        const fileName = `${Date.now()}_${attachmentName.replace(/\s+/g, '_')}`;
        const uploadDir = path.join(process.cwd(), 'uploads');
        
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        fs.writeFileSync(path.join(uploadDir, fileName), buffer);
        attachmentUrl = `/uploads/${fileName}`; // Relative url, backend prepends host dynamically
      }
    }

    const assignedDepartment = getAssignedDepartment(category);

    // Save to MongoDB FIRST
    const complaint = await Complaint.create({
      complaint_id: complaintId,
      student_email: req.user.email,
      category,
      complaint_type: complaintType,
      description,
      attachment_url: attachmentUrl,
      assigned_department: assignedDepartment,
      bus_number: busNumber || '',
      bus_route: busRoute || '',
      status: 'Pending', // default status
      priority: 'Medium'
    });

    // ----------------------------------------------------
    // Trigger automated email routing via Resend
    // ----------------------------------------------------
    const contactsList = await Contact.find({});
    const contactsMap = {};
    contactsList.forEach(c => {
      contactsMap[c.category] = c.phone;
    });

    const targetRecipient = process.env.DISCIPLINE_HEAD_EMAIL || 'discipline.head@mictech.ac.in';
    let managementContact = null;

    if (category === "Hostel Issues") {
      managementContact = {
        label: "Hostel Warden / Hostel Management",
        phone: contactsMap["Hostel Issues"] || "9959593027"
      };
    } else if (category === "Food Issues") {
      managementContact = {
        label: "Canteen / Cafeteria Management",
        phone: contactsMap["Food Issues"] || "9391781748"
      };
    } else if (category === "Bus Issues") {
      managementContact = {
        label: "Bus Management",
        phone: contactsMap["Bus Issues"] || "7330820239"
      };
    } else if (category === "Campus Issues") {
      managementContact = {
        label: "Respective Branch HOD",
        phone: contactsMap["Campus Issues"] || "N/A"
      };
    }

    // Explicitly sanitizing payload to guarantee NO student identity properties are passed to email builder
    const emailSanitizedComplaint = {
      id: complaintId,
      category,
      complaintType,
      description,
      createdAt: complaint.createdAt,
      status: complaint.status,
      busNumber: category === "Bus Issues" ? (busNumber || '') : undefined,
      busRoute: category === "Bus Issues" ? (busRoute || '') : undefined
    };

    let emailStatus = 'Sent';
    let emailFailureReason = '';

    try {
      await sendGrievanceEmail({
        complaint: emailSanitizedComplaint,
        recipient: targetRecipient,
        managementContact
      });
    } catch (emailError) {
      console.error('[Resend Email Dispatch Error]', emailError);
      emailStatus = 'Failed';
      emailFailureReason = emailError.message || 'Resend transmission failed';
    }

    // Save Email Log (keeping student email hidden from these public outbox logs)
    await EmailLog.create({
      recipient: targetRecipient,
      subject: `[CONFIDENTIAL GRIEVANCE] - ID: ${complaintId} | Category: ${category}`,
      body: `Confidential grievance notification logged for ID: ${complaintId}`, // Avoid exposing full body or student info in logs
      complaintId,
      category,
      status: emailStatus,
      failureReason: emailFailureReason
    });

    if (emailStatus === 'Failed') {
      return res.status(201).json({
        message: 'Your complaint was recorded successfully. Please try again later if you do not see an updated status.',
        complaint
      });
    }

    res.status(201).json({
      message: 'Your complaint has been submitted successfully.',
      complaint
    });
  } catch (error) {
    console.error('[Grievance Submission Error]', error);
    res.status(500).json({ message: 'Unable to submit your complaint right now. Please try again.' });
  }
});

// @desc    Get complaints (Admin gets all, Student gets their own)
// @route   GET /api/complaints
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let complaints;
    if (req.user.role === 'admin') {
      complaints = await Complaint.find({}).select('-student_email').sort({ createdAt: -1 });
    } else {
      complaints = await Complaint.find({ student_email: req.user.email }).sort({ createdAt: -1 });
    }
    res.json(complaints);
  } catch (error) {
    console.error('[Get Complaints Error]', error);
    res.status(500).json({ message: 'Unable to load complaints.' });
  }
});

// @desc    Authenticated endpoint to track single complaint
// @route   GET /api/complaints/track/:id
// @access  Private (Only owner student or Admin can access)
router.get('/track/:id', protect, async (req, res) => {
  const trackerId = req.params.id.trim().toUpperCase();

  try {
    const complaint = await Complaint.findOne({ complaint_id: trackerId });
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint ID not found. Please verify the ID.' });
    }

    // Verify ownership
    if (req.user.role !== 'admin' && complaint.student_email !== req.user.email) {
      return res.status(403).json({ message: 'Unauthorized. You do not own this complaint.' });
    }

    // Return sanitized payload
    const sanitizedComplaint = {
      id: complaint.complaint_id,
      complaint_id: complaint.complaint_id,
      category: complaint.category,
      complaint_type: complaint.complaint_type,
      status: complaint.status,
      priority: complaint.priority,
      description: complaint.description,
      assigned_department: complaint.assigned_department,
      createdAt: complaint.createdAt,
      statusHistory: complaint.statusHistory,
      resolution_notes: complaint.resolution_notes,
      bus_number: complaint.bus_number,
      bus_route: complaint.bus_route,
      attachment_url: complaint.attachment_url
    };

    res.json(sanitizedComplaint);
  } catch (error) {
    console.error('[Track Complaint Error]', error);
    res.status(500).json({ message: 'Unable to track complaint.' });
  }
});

// @desc    Update complaint details (Status, Priority, Resolution Notes)
// @route   PUT /api/complaints/:id
// @access  Private (Admin only)
router.put('/:id', adminProtect, async (req, res) => {
  const { status, priority, resolutionNotes } = req.body;

  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }

    const previousStatus = complaint.status;
    const changedBy = req.user.email || 'admin@mictech.ac.in';

    // Track status history if status changes
    if (status !== undefined && status !== previousStatus) {
      complaint.status = status;
      complaint.statusHistory.push({
        previousStatus,
        newStatus: status,
        changedBy,
        changedAt: new Date()
      });
    }

    if (priority !== undefined) complaint.priority = priority;
    if (resolutionNotes !== undefined) complaint.resolution_notes = resolutionNotes;
    
    complaint.updatedAt = new Date();
    await complaint.save();

    // Sanitize response to ensure student identity remains confidential
    const complaintResponse = complaint.toObject();
    delete complaintResponse.student_email;

    res.json({ message: 'Complaint updated successfully', complaint: complaintResponse });
  } catch (error) {
    console.error('[Update Complaint Error]', error);
    res.status(500).json({ message: 'Unable to update complaint.' });
  }
});

export default router;
