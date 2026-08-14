import express from 'express';
import mongoose from 'mongoose';
import ComplaintType from '../models/ComplaintType.js';
import Category from '../models/Category.js';
import { adminProtect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get all complaint types
// @route   GET /api/complaint-types
// @access  Public
router.get('/', async (req, res) => {
  try {
    // Populate Category info if needed, but returning it populated makes it easier to filter by category name
    const types = await ComplaintType.find({}).populate('category', 'name').sort({ name: 1 });
    
    // Format response to map category ObjectId to category name string for easy consumption
    const formattedTypes = types.map(t => ({
      _id: t._id,
      name: t.name,
      category: t.category ? t.category.name : 'Unknown',
      categoryId: t.category ? t.category._id : null,
      isActive: t.isActive
    }));
    
    res.json(formattedTypes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create a new complaint type
// @route   POST /api/complaint-types
// @access  Private (Admin only)
router.post('/', adminProtect, async (req, res) => {
  const { category, name } = req.body;
  try {
    if (!category || !name) {
      return res.status(400).json({ message: 'Category and type name are required' });
    }
    
    const nameTrim = name.trim();
    
    // Resolve category (can be passed as Name or ObjectId)
    let catDoc;
    if (mongoose.Types.ObjectId.isValid(category)) {
      catDoc = await Category.findById(category);
    } else {
      catDoc = await Category.findOne({ name: category });
    }

    if (!catDoc) {
      return res.status(400).json({ message: 'Associated category does not exist' });
    }

    const exists = await ComplaintType.findOne({ name: nameTrim, category: catDoc._id });
    if (exists) {
      return res.status(400).json({ message: 'Complaint type already exists under this category' });
    }

    const typeObj = await ComplaintType.create({
      category: catDoc._id,
      name: nameTrim,
      isActive: true
    });

    res.status(201).json({
      _id: typeObj._id,
      name: typeObj.name,
      category: catDoc.name,
      categoryId: catDoc._id,
      isActive: typeObj.isActive
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update a complaint type
// @route   PUT /api/complaint-types/:id
// @access  Private (Admin only)
router.put('/:id', adminProtect, async (req, res) => {
  const { name, category, isActive } = req.body;
  try {
    const typeObj = await ComplaintType.findById(req.params.id);
    if (!typeObj) {
      return res.status(404).json({ message: 'Complaint type not found' });
    }

    if (name !== undefined) typeObj.name = name.trim();
    if (isActive !== undefined) typeObj.isActive = isActive;

    if (category !== undefined) {
      let catDoc;
      if (mongoose.Types.ObjectId.isValid(category)) {
        catDoc = await Category.findById(category);
      } else {
        catDoc = await Category.findOne({ name: category });
      }

      if (!catDoc) {
        return res.status(400).json({ message: 'Associated category does not exist' });
      }
      typeObj.category = catDoc._id;
    }

    await typeObj.save();
    
    // Return formatted result
    const populated = await typeObj.populate('category', 'name');
    res.json({
      _id: populated._id,
      name: populated.name,
      category: populated.category ? populated.category.name : 'Unknown',
      categoryId: populated.category ? populated.category._id : null,
      isActive: populated.isActive
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a complaint type
// @route   DELETE /api/complaint-types/:id
// @access  Private (Admin only)
router.delete('/:id', adminProtect, async (req, res) => {
  try {
    const typeObj = await ComplaintType.findById(req.params.id);
    if (!typeObj) {
      return res.status(404).json({ message: 'Complaint type not found' });
    }
    await ComplaintType.deleteOne({ _id: req.params.id });
    res.json({ message: 'Complaint type deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
