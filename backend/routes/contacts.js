import express from 'express';
import Contact from '../models/Contact.js';
import { protect, adminProtect } from '../middleware/auth.js';

const router = express.Router();

const defaultContacts = [
  { category: "Hostel Issues", department: "Hostel Management / Discipline Head", phone: "9959593027" },
  { category: "Food Issues", department: "Canteen / Food Management", phone: "9391781748" },
  { category: "Bus Issues", department: "Bus Management", phone: "7330820239" },
  { category: "Campus Issues", department: "Respective HOD", phone: "N/A" },
  { category: "Complaint Against Student", department: "Discipline Committee", phone: "N/A" },
  { category: "Complaint Against Faculty", department: "Discipline Committee", phone: "N/A" }
];

// Seed contacts helper
const seedContacts = async () => {
  const count = await Contact.countDocuments();
  if (count === 0) {
    await Contact.insertMany(defaultContacts);
    console.log('[Contacts Seeded] Default department helpline numbers added.');
  }
};

// @desc    Get all contacts
// @route   GET /api/contacts
// @access  Private (or Public)
router.get('/', protect, async (req, res) => {
  try {
    await seedContacts();
    const contacts = await Contact.find({});
    
    // Map list to contact dictionary format exactly matching the state shape
    const contactsMap = {};
    contacts.forEach(c => {
      contactsMap[c.category] = c.phone;
    });
    res.json(contactsMap);
  } catch (error) {
    console.error('[Get Contacts Error]', error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update contact phone number for a category
// @route   PUT /api/contacts/:category
// @access  Private (Admin only)
router.put('/:category', adminProtect, async (req, res) => {
  const { phone } = req.body;
  const { category } = req.params;

  try {
    await seedContacts();
    let contact = await Contact.findOne({ category });
    
    if (contact) {
      contact.phone = phone;
      await contact.save();
    } else {
      contact = await Contact.create({
        category,
        department: category + " Committee",
        phone
      });
    }

    // Return the updated full mapping
    const allContacts = await Contact.find({});
    const contactsMap = {};
    allContacts.forEach(c => {
      contactsMap[c.category] = c.phone;
    });
    
    res.json({ message: 'Contact updated successfully', contacts: contactsMap });
  } catch (error) {
    console.error('[Update Contact Error]', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
