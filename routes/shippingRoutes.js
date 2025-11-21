import express from 'express';
import ShippingRate from '../models/ShippingRate.js';

const router = express.Router();

// GET all shipping rates
router.get('/', async (req, res) => {
  try {
    const shippingRates = await ShippingRate.find().sort({ city: 1 });
    res.json(shippingRates);
  } catch (error) {
    console.error('Error fetching shipping rates:', error);
    res.status(500).json({ message: 'Error fetching shipping rates', error: error.message });
  }
});

// GET shipping rate by city
router.get('/city/:city', async (req, res) => {
  try {
    const shippingRate = await ShippingRate.findOne({ city: req.params.city });
    if (!shippingRate) {
      return res.status(404).json({ message: 'Shipping rate not found for this city' });
    }
    res.json(shippingRate);
  } catch (error) {
    console.error('Error fetching shipping rate:', error);
    res.status(500).json({ message: 'Error fetching shipping rate', error: error.message });
  }
});

// POST create new shipping rate
router.post('/', async (req, res) => {
  try {
    const { city, shippingFee } = req.body;
    
    // Check if city already exists
    const existingRate = await ShippingRate.findOne({ city });
    if (existingRate) {
      return res.status(400).json({ message: 'Shipping rate for this city already exists' });
    }

    const newShippingRate = new ShippingRate({
      city: city.trim(),
      shippingFee: parseFloat(shippingFee)
    });

    const savedRate = await newShippingRate.save();
    res.status(201).json(savedRate);
  } catch (error) {
    console.error('Error creating shipping rate:', error);
    res.status(500).json({ message: 'Error creating shipping rate', error: error.message });
  }
});

// PUT update shipping rate
router.put('/:id', async (req, res) => {
  try {
    const { city, shippingFee } = req.body;
    
    const updatedRate = await ShippingRate.findByIdAndUpdate(
      req.params.id,
      { 
        city: city?.trim(), 
        shippingFee: shippingFee ? parseFloat(shippingFee) : undefined 
      },
      { new: true, runValidators: true }
    );

    if (!updatedRate) {
      return res.status(404).json({ message: 'Shipping rate not found' });
    }

    res.json(updatedRate);
  } catch (error) {
    console.error('Error updating shipping rate:', error);
    res.status(500).json({ message: 'Error updating shipping rate', error: error.message });
  }
});

// DELETE shipping rate
router.delete('/:id', async (req, res) => {
  try {
    const deletedRate = await ShippingRate.findByIdAndDelete(req.params.id);
    
    if (!deletedRate) {
      return res.status(404).json({ message: 'Shipping rate not found' });
    }

    res.json({ message: 'Shipping rate deleted successfully' });
  } catch (error) {
    console.error('Error deleting shipping rate:', error);
    res.status(500).json({ message: 'Error deleting shipping rate', error: error.message });
  }
});

export default router;