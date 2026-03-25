import express from 'express';
import HeroSettings from '../models/HeroSettings.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET hero settings (public)
router.get('/', async (req, res) => {
  try {
    let settings = await HeroSettings.findOne();
    if (!settings) {
      settings = await HeroSettings.create({
        backgroundImage: 'https://res.cloudinary.com/dvr195vfw/image/upload/f_auto,q_auto,w_1200/v1765150425/Your_paragraph_text_1_ck0hsl.png',
        buttonText: 'Shop Now',
        buttonLink: '/products.html',
        title: 'Illuminate Your Space',
        subtitle: 'Handcrafted Candles & Self-care Luxuries'
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching hero settings:', error);
    res.status(500).json({ error: 'Failed to fetch hero settings' });
  }
});

// POST update hero settings (protected)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { backgroundImage, buttonText, buttonLink, title, subtitle } = req.body;
    
    let settings = await HeroSettings.findOne();
    if (settings) {
      settings.backgroundImage = backgroundImage || settings.backgroundImage;
      settings.buttonText = buttonText || settings.buttonText;
      settings.buttonLink = buttonLink || settings.buttonLink;
      settings.title = title || settings.title;
      settings.subtitle = subtitle || settings.subtitle;
      settings.updatedAt = Date.now();
      await settings.save();
    } else {
      settings = await HeroSettings.create({
        backgroundImage,
        buttonText,
        buttonLink,
        title,
        subtitle
      });
    }
    
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error saving hero settings:', error);
    res.status(500).json({ error: 'Failed to save hero settings' });
  }
});

export default router;