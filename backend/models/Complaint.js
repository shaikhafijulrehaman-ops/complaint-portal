import mongoose from 'mongoose';

const ComplaintSchema = new mongoose.Schema({
  complaint_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  student_email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  complaint_type: {
    type: String,
    required: true
  },
  bus_number: {
    type: String,
    default: ''
  },
  bus_route: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    required: true
  },
  attachment_url: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Submitted', 'Under Review', 'Assigned', 'Resolved', 'Closed'],
    default: 'Submitted'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  assigned_department: {
    type: String,
    required: true
  },
  resolution_notes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

const Complaint = mongoose.model('Complaint', ComplaintSchema);
export default Complaint;
