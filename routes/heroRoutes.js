import express from 'express';
import mongoose from 'mongoose';
import HeroSettings from '../models/HeroSettings.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Fixed, permanent ID — same fix as SiteSettings, prevents duplicate documents
// from racing GET requests and causing saved changes to "disappear" on refresh.
const HERO_ID = new mongoose.Types.ObjectId('000000000000000000000002');

const DEFAULT_SLIDE = {
  backgroundImage: 'https://res.cloudinary.com/dvr195vfw/image/upload/f_auto,q_auto,w_1200/v1765150425/Your_paragraph_text_1_ck0hsl.png',
  buttonText: 'Shop Now',
  buttonLink: '/products.html',
  title: 'Illuminate Your Space',
  subtitle: 'Handcrafted Candles & Self-care Luxuries'
};

/**
 * Returns the single hero settings document, creating it on first-ever request,
 * or self-healing if older duplicate documents exist (adopts the most recently
 * updated one's data, then deletes the rest).
 */
async function getSingletonHero() {
  let settings = await HeroSettings.findById(HERO_ID);
  if (settings) return settings;

  const existing = await HeroSettings.findOne().sort({ updatedAt: -1 });
  if (existing) {
    const data = existing.toObject();
    delete data._id;
    delete data.__v;
    settings = await HeroSettings.create({ _id: HERO_ID, ...data });
    await HeroSettings.deleteMany({ _id: { $ne: HERO_ID } });
  } else {
    settings = await HeroSettings.create({ _id: HERO_ID, slides: [DEFAULT_SLIDE], autoplaySpeed: 5000 });
  }

  // One-time migration: fold old single-slide fields into the new array, if needed
  if ((!settings.slides || settings.slides.length === 0) && settings.backgroundImage) {
    settings.slides = [{
      backgroundImage: settings.backgroundImage,
      title: settings.title,
      subtitle: settings.subtitle,
      buttonText: settings.buttonText,
      buttonLink: settings.buttonLink,
    }];
    await settings.save();
  }

  return settings;
}

// GET hero settings (public)
router.get('/', async (req, res) => {
  try {
    const settings = await getSingletonHero();
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
    const settings = await getSingletonHero();

    if (Array.isArray(slides)) settings.slides = slides;
    if (autoplaySpeed) settings.autoplaySpeed = autoplaySpeed;
    settings.updatedAt = Date.now();
    await settings.save();

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error saving hero settings:', error);
    res.status(500).json({ error: 'Failed to save hero settings' });
  }
});

export default router;