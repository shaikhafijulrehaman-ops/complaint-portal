import mongoose from 'mongoose';

const EmailLogSchema = new mongoose.Schema({
  recipient: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  subject: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  complaintId: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Sent', 'Failed'],
    default: 'Sent'
  },
  failureReason: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Performance indexing
EmailLogSchema.index({ createdAt: -1 });

const EmailLog = mongoose.model('EmailLog', EmailLogSchema);
export default EmailLog;
