import express from 'express';
import Category from '../models/Category.js';
import ComplaintType from '../models/ComplaintType.js';
import Contact from '../models/Contact.js';
import { adminProtect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public (students need this for registration/complaint submission)
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create a new category
// @route   POST /api/categories
// @access  Private (Admin only)
router.post('/', adminProtect, async (req, res) => {
  const { name } = req.body;
  try {
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    const nameTrim = name.trim();
    const exists = await Category.findOne({ name: nameTrim });
    if (exists) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    const category = await Category.create({ name: nameTrim, isActive: true });
    
    // Also create a default empty helpline contact mapping for this category if none exists
    await Contact.findOneAndUpdate(
      { category: nameTrim },
      { $setOnInsert: { category: nameTrim, department: `${nameTrim} Team`, phone: 'N/A' } },
      { upsert: true }
    );

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private (Admin only)
router.put('/:id', adminProtect, async (req, res) => {
  const { name, isActive } = req.body;
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    const oldName = category.name;
    if (name !== undefined) category.name = name.trim();
    if (isActive !== undefined) category.isActive = isActive;
    
    await category.save();

    // If category name has changed, cascade changes to associated contacts
    if (name && name.trim() !== oldName) {
      await Contact.updateMany({ category: oldName }, { category: name.trim() });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private (Admin only)
router.delete('/:id', adminProtect, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Cascade delete associated complaint types and contacts
    await ComplaintType.deleteMany({ category: category._id });
    await Contact.deleteOne({ category: category.name });
    
    await Category.deleteOne({ _id: req.params.id });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
