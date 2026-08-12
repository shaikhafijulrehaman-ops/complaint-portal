import express from 'express';
import fs from 'fs';
import path from 'path';
import Complaint from '../models/Complaint.js';
import EmailLog from '../models/EmailLog.js';
import Contact from '../models/Contact.js';
import { protect, adminProtect } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate unique complaint ID (Format: CMP-XXXXXXXX)
const generateUniqueId = async () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let exists = true;
  let code = '';
  
  while (exists) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const count = await Complaint.countDocuments({ complaint_id: `CMP-${code}` });
    if (count === 0) {
      exists = false;
    }
  }
  return `CMP-${code}`;
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
      status: 'Submitted',
      priority: 'Medium'
    });

    // ----------------------------------------------------
    // Trigger automated email routing log
    // ----------------------------------------------------
    // Fetch custom contacts to see if dynamic numbers are configured
    const contactsList = await Contact.find({});
    const contactsMap = {};
    contactsList.forEach(c => {
      contactsMap[c.category] = c.phone;
    });

    const disciplineHeadEmail = "discipline.head@mictech.ac.in";
    let targetRecipient = disciplineHeadEmail;
    let contactDetailHtml = "";

    if (category === "Hostel Issues") {
      const phone = contactsMap["Hostel Issues"] || "9959593027";
      contactDetailHtml = `<p style="color: #0F4C81; font-weight: bold; margin-top: 15px;">Hostel Warden Contact: ${phone}</p>`;
    } else if (category === "Food Issues") {
      const phone = contactsMap["Food Issues"] || "9391781748";
      contactDetailHtml = `<p style="color: #0F4C81; font-weight: bold; margin-top: 15px;">Canteen/Food Management Contact: ${phone}</p>`;
    } else if (category === "Campus Issues") {
      const hodEmail = "hod.campus@mictech.ac.in";
      targetRecipient = `${disciplineHeadEmail}, ${hodEmail}`;
      const phone = contactsMap["Campus Issues"] || "N/A";
      contactDetailHtml = `<p style="color: #1D70B8; font-weight: bold; margin-top: 15px;">Campus Facilities Support Contact: ${phone} (Forwarded to Campus HOD)</p>`;
    } else if (category === "Complaint Against Faculty") {
      targetRecipient = "discipline.committee@mictech.ac.in";
      contactDetailHtml = `<p style="color: #DC2626; font-weight: bold; margin-top: 15px;">Severity: Confidential - Directed straight to Discipline Committee review.</p>`;
    } else if (category === "Complaint Against Student") {
      targetRecipient = "discipline.committee@mictech.ac.in";
      contactDetailHtml = `<p style="color: #1E293B; font-weight: bold; margin-top: 15px;">Forwarded to Student Affairs / Discipline Committee.</p>`;
    } else if (category === "Bus Issues") {
      targetRecipient = "bus.management@mictech.ac.in";
      const phone = contactsMap["Bus Issues"] || "7330820239";
      contactDetailHtml = `<p style="color: #0F4C81; font-weight: bold; margin-top: 15px;">Bus Management Contact: ${phone}</p>`;
    } else {
      contactDetailHtml = `<p style="color: #1E293B; font-weight: bold; margin-top: 15px;">Forwarded to relevant college administrator.</p>`;
    }

    const emailSubject = `[URGENT GRIEVANCE] - ID: ${complaintId} | Category: ${category}`;
    
    let dynamicRows = `
      <tr style="background-color: #F8FAFC;">
        <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81; width: 35%;">Complaint ID</th>
        <td style="padding: 10px; border: 1px solid #E2E8F0; font-weight: bold; color: #1E293B;">${complaintId}</td>
      </tr>
      <tr>
        <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81;">Category</th>
        <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B;">${category}</td>
      </tr>
      <tr style="background-color: #F8FAFC;">
        <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81;">Complaint Type</th>
        <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B;">${complaintType}</td>
      </tr>
      <tr>
        <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81;">Submitted Date</th>
        <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B;">${new Date().toLocaleString()}</td>
      </tr>
      <tr style="background-color: #F8FAFC;">
        <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81;">Student College Email</th>
        <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: bold;">${req.user.email}</td>
      </tr>
    `;

    if (category === "Bus Issues") {
      const busPhone = contactsMap["Bus Issues"] || "7330820239";
      dynamicRows += `
        <tr>
          <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81; background-color: #FFFDF5;">Bus Number</th>
          <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: bold; background-color: #FFFDF5;">${busNumber || 'N/A'}</td>
        </tr>
        <tr style="background-color: #FFFDF5;">
          <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81;">Bus Route/Area</th>
          <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B;">${busRoute || 'N/A'}</td>
        </tr>
        <tr>
          <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81;">Bus Mgmt Contact</th>
          <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: bold;">${busPhone}</td>
        </tr>
      `;
    }

    const fullAttachmentUrl = attachmentUrl ? `${req.protocol}://${req.get('host')}${attachmentUrl}` : '';

    const emailBody = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #E2E8F0; border-radius: 12px; background-color: #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="border-bottom: 2px solid #0F4C81; padding-bottom: 15px; margin-bottom: 20px; text-align: center;">
          <h2 style="color: #0F4C81; margin: 0; font-size: 22px;">DVR & Dr. HS MIC College of Technology</h2>
          <p style="color: #64748B; margin: 5px 0 0 0; font-size: 14px;">Official Student Grievance Notification</p>
        </div>
        <p style="font-size: 16px; color: #1E293B; line-height: 1.5;">Dear Authority,</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">A new student grievance has been securely submitted on the portal. Under college guidelines, this report requires timely assessment and resolution.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; text-align: left;">
          ${dynamicRows}
        </table>

        <div style="background-color: #F8FAFC; border-left: 4px solid #0F4C81; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <h4 style="margin: 0 0 10px 0; color: #0F4C81; font-size: 14px;">Description:</h4>
          <p style="margin: 0; color: #334155; line-height: 1.6; font-size: 13px;">${description}</p>
        </div>

        ${attachmentUrl ? `
        <div style="margin: 15px 0; padding: 10px; border: 1px dashed #CBD5E1; border-radius: 8px; font-size: 13px;">
          <span style="color: #64748B;">Attachment Uploaded:</span> 
          <a href="${fullAttachmentUrl}" target="_blank" style="color: #1D70B8; text-decoration: underline; font-weight: 500;">
            ${attachmentName || 'View Attachment'}
          </a>
        </div>` : ''}

        ${contactDetailHtml}

        <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 25px 0;"/>
        <p style="font-size: 12px; color: #94A3B8; text-align: center; line-height: 1.4; margin: 0;">
          This email was auto-generated by the MIC Student Grievance Portal. Do not reply to this email directly.
          <br/>
          © DVR & Dr. HS MIC College of Technology - Grievance Committee.
        </p>
      </div>
    `;

    // Log the routed email
    await EmailLog.create({
      recipient: targetRecipient,
      subject: emailSubject,
      body: emailBody,
      complaintId
    });

    res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint
    });
  } catch (error) {
    console.error('[Grievance Submission Error]', error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get complaints (Admin gets all, Student gets their own)
// @route   GET /api/complaints
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let complaints;
    if (req.user.role === 'admin') {
      complaints = await Complaint.find({}).sort({ createdAt: -1 });
    } else {
      complaints = await Complaint.find({ student_email: req.user.email }).sort({ createdAt: -1 });
    }
    res.json(complaints);
  } catch (error) {
    console.error('[Get Complaints Error]', error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Public endpoint to track single complaint
// @route   GET /api/complaints/track/:id
// @access  Public
router.get('/track/:id', async (req, res) => {
  const trackerId = req.params.id.trim().toUpperCase();

  try {
    const complaint = await Complaint.findOne({ complaint_id: trackerId });
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint ID not found. Please verify the ID.' });
    }
    res.json(complaint);
  } catch (error) {
    console.error('[Track Complaint Error]', error);
    res.status(500).json({ message: error.message });
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

    if (status !== undefined) complaint.status = status;
    if (priority !== undefined) complaint.priority = priority;
    if (resolutionNotes !== undefined) complaint.resolution_notes = resolutionNotes;
    
    complaint.updatedAt = new Date();
    await complaint.save();

    res.json({ message: 'Complaint updated successfully', complaint });
  } catch (error) {
    console.error('[Update Complaint Error]', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
