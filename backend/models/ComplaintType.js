import mongoose from 'mongoose';

const ComplaintTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure uniqueness of type name within a category
ComplaintTypeSchema.index({ name: 1, category: 1 }, { unique: true });

const ComplaintType = mongoose.model('ComplaintType', ComplaintTypeSchema, 'complaintTypes');
export default ComplaintType;
