import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    unique: true
  },
  department: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  }
});

const Contact = mongoose.model('Contact', ContactSchema);
export default Contact;
