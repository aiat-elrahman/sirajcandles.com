import express from 'express';
import HeroSettings from '../models/HeroSettings.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET hero settings (public)
router.get('/', async (req, res) => {
  try {
    let settings = await HeroSettings.findOne();
    if (!settings) {
      settings = await HeroSettings.create({
        slides: [{
          backgroundImage: 'https://res.cloudinary.com/dvr195vfw/image/upload/f_auto,q_auto,w_1200/v1765150425/Your_paragraph_text_1_ck0hsl.png',
          buttonText: 'Shop Now',
          buttonLink: '/products.html',
          title: 'Illuminate Your Space',
          subtitle: 'Handcrafted Candles & Self-care Luxuries'
        }],
        autoplaySpeed: 5000
      });
    } else if ((!settings.slides || settings.slides.length === 0) && settings.backgroundImage) {
      // One-time migration: fold the old single-slide fields into the new array
      settings.slides = [{
        backgroundImage: settings.backgroundImage,
        title: settings.title,
        subtitle: settings.subtitle,
        buttonText: settings.buttonText,
        buttonLink: settings.buttonLink,
      }];
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching hero settings:', error);
    res.status(500).json({ error: 'Failed to fetch hero settings' });
  }
});

// POST update hero settings (protected)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { slides, autoplaySpeed } = req.body;

    let settings = await HeroSettings.findOne();
    if (settings) {
      if (Array.isArray(slides)) settings.slides = slides;
      if (autoplaySpeed) settings.autoplaySpeed = autoplaySpeed;
      settings.updatedAt = Date.now();
      await settings.save();
    } else {
      settings = await HeroSettings.create({ slides: slides || [], autoplaySpeed: autoplaySpeed || 5000 });
    }

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error saving hero settings:', error);
    res.status(500).json({ error: 'Failed to save hero settings' });
  }
});

export default router;