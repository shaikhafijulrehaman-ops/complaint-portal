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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const EmailLog = mongoose.model('EmailLog', EmailLogSchema);
export default EmailLog;
