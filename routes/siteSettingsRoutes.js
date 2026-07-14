import express from 'express';
import SiteSettings from '../models/SiteSettings.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET site settings (public — used by frontend)
router.get('/', async (req, res) => {
  try {
    let settings = await SiteSettings.findOne()
      .populate('freeGift.giftProducts', 'name_en imagePaths category price_egp salePrice stock');
    if (!settings) {
      settings = await SiteSettings.create({});
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update site settings (admin only)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings(req.body);
    } else {
      Object.assign(settings, req.body);
      if (req.body.freeGift) {
        settings.freeGift = { ...settings.freeGift, ...req.body.freeGift };
      }
    }
    await settings.save();
    settings = await SiteSettings.findById(settings._id)
      .populate('freeGift.giftProducts', 'name_en imagePaths category price_egp salePrice stock');
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;