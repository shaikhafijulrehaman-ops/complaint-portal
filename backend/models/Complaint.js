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
    enum: ['Pending', 'Under Review', 'In Progress', 'Resolved', 'Rejected', 'Closed'],
    default: 'Pending'
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
  statusHistory: [
    {
      previousStatus: {
        type: String,
        required: true
      },
      newStatus: {
        type: String,
        required: true
      },
      changedBy: {
        type: String,
        required: true
      },
      changedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
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

// Performance indexing
ComplaintSchema.index({ category: 1 });
ComplaintSchema.index({ status: 1 });
ComplaintSchema.index({ createdAt: -1 });

const Complaint = mongoose.model('Complaint', ComplaintSchema);
export default Complaint;
