import express from 'express';
import Discount from '../models/Discount.js';

const router = express.Router();

// --- NEW: VALIDATE DISCOUNT (For Frontend Checkout) ---
router.post('/validate', async (req, res) => {
    try {
        const { code } = req.body; // We can also use cartTotal here for logic later

        if (!code) {
            return res.status(400).json({ valid: false, message: 'No code provided' });
        }

        const discount = await Discount.findOne({ 
            code: code.toUpperCase().trim(),
            status: 'active'
        });

        if (!discount) {
            return res.status(404).json({ valid: false, message: 'Invalid or expired code' });
        }

        // Logic: You can add extra checks here (e.g. Minimum purchase amount)
        
        res.json({ 
            valid: true, 
            discount: {
                code: discount.code,
                type: discount.type,
                value: discount.value
            }
        });

    } catch (error) {
        console.error('Error validating discount:', error);
        res.status(500).json({ valid: false, message: 'Server error checking discount' });
    }
});

// GET all discounts (Admin)
router.get('/', async (req, res) => {
  try {
    const discounts = await Discount.find().sort({ createdAt: -1 });
    res.json(discounts);
  } catch (error) {
    console.error('Error fetching discounts:', error);
    res.status(500).json({ message: 'Error fetching discounts', error: error.message });
  }
});

// GET discount by code
router.get('/code/:code', async (req, res) => {
  try {
    const discount = await Discount.findOne({ 
      code: req.params.code.toUpperCase(),
      status: 'active'
    });
    
    if (!discount) {
      return res.status(404).json({ message: 'Discount code not found or inactive' });
    }
    
    res.json(discount);
  } catch (error) {
    console.error('Error fetching discount:', error);
    res.status(500).json({ message: 'Error fetching discount', error: error.message });
  }
});

// POST create new discount
router.post('/', async (req, res) => {
  try {
    const { code, type, value, appliesTo, categories, products, status } = req.body;
    
    // Check if code already exists
    const existingDiscount = await Discount.findOne({ code: code.toUpperCase() });
    if (existingDiscount) {
      return res.status(400).json({ message: 'Discount code already exists' });
    }

    const newDiscount = new Discount({
      code: code.toUpperCase().trim(),
      type,
      value: parseFloat(value),
      appliesTo: appliesTo || 'entire',
      categories: categories || [],
      products: products || [],
      status: status || 'active'
    });

    const savedDiscount = await newDiscount.save();
    res.status(201).json(savedDiscount);
  } catch (error) {
    console.error('Error creating discount:', error);
    res.status(500).json({ message: 'Error creating discount', error: error.message });
  }
});

// PUT update discount
router.put('/:id', async (req, res) => {
  try {
    const { code, type, value, appliesTo, categories, products, status } = req.body;
    
    const updateData = {
      type,
      value: value ? parseFloat(value) : undefined,
      appliesTo,
      categories,
      products,
      status
    };

    // Only update code if provided and different
    if (code) {
      updateData.code = code.toUpperCase().trim();
    }

    const updatedDiscount = await Discount.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedDiscount) {
      return res.status(404).json({ message: 'Discount not found' });
    }

    res.json(updatedDiscount);
  } catch (error) {
    console.error('Error updating discount:', error);
    res.status(500).json({ message: 'Error updating discount', error: error.message });
  }
});

// DELETE discount
router.delete('/:id', async (req, res) => {
  try {
    const deletedDiscount = await Discount.findByIdAndDelete(req.params.id);
    
    if (!deletedDiscount) {
      return res.status(404).json({ message: 'Discount not found' });
    }

    res.json({ message: 'Discount deleted successfully' });
  } catch (error) {
    console.error('Error deleting discount:', error);
    res.status(500).json({ message: 'Error deleting discount', error: error.message });
  }
});

export default router;