import express from 'express';
import CareInstruction from '../models/CareInstruction.js';

const router = express.Router();

// GET all care instructions
router.get('/', async (req, res) => {
  try {
    const careInstructions = await CareInstruction.find().sort({ category: 1 });
    res.json(careInstructions);
  } catch (error) {
    console.error('Error fetching care instructions:', error);
    res.status(500).json({ message: 'Error fetching care instructions', error: error.message });
  }
});

// GET care instruction by category
router.get('/category/:category', async (req, res) => {
  try {
    const careInstruction = await CareInstruction.findOne({ category: req.params.category });
    if (!careInstruction) {
      return res.status(404).json({ message: 'Care instructions not found for this category' });
    }
    res.json(careInstruction);
  } catch (error) {
    console.error('Error fetching care instruction:', error);
    res.status(500).json({ message: 'Error fetching care instruction', error: error.message });
  }
});

// POST create new care instruction
router.post('/', async (req, res) => {
  try {
    const { category, careTitle, careContent } = req.body;
    
    // Check if category already exists
    const existingCare = await CareInstruction.findOne({ category });
    if (existingCare) {
      return res.status(400).json({ message: 'Care instructions for this category already exist' });
    }

    const newCareInstruction = new CareInstruction({
      category: category.trim(),
      careTitle: careTitle.trim(),
      careContent: careContent.trim()
    });

    const savedCare = await newCareInstruction.save();
    res.status(201).json(savedCare);
  } catch (error) {
    console.error('Error creating care instruction:', error);
    res.status(500).json({ message: 'Error creating care instruction', error: error.message });
  }
});

// PUT update care instruction
router.put('/:id', async (req, res) => {
  try {
    const { category, careTitle, careContent } = req.body;
    
    const updatedCare = await CareInstruction.findByIdAndUpdate(
      req.params.id,
      { 
        category: category?.trim(),
        careTitle: careTitle?.trim(),
        careContent: careContent?.trim()
      },
      { new: true, runValidators: true }
    );

    if (!updatedCare) {
      return res.status(404).json({ message: 'Care instructions not found' });
    }

    res.json(updatedCare);
  } catch (error) {
    console.error('Error updating care instruction:', error);
    res.status(500).json({ message: 'Error updating care instruction', error: error.message });
  }
});

// DELETE care instruction
router.delete('/:id', async (req, res) => {
  try {
    const deletedCare = await CareInstruction.findByIdAndDelete(req.params.id);
    
    if (!deletedCare) {
      return res.status(404).json({ message: 'Care instructions not found' });
    }

    res.json({ message: 'Care instructions deleted successfully' });
  } catch (error) {
    console.error('Error deleting care instruction:', error);
    res.status(500).json({ message: 'Error deleting care instruction', error: error.message });
  }
});

export default router;