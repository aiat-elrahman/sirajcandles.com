import express from 'express';
import SiteSettings from '../models/SiteSettings.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET site settings (public — used by frontend)
router.get('/', async (req, res) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = await SiteSettings.create({});
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update site settings (admin only)
router.put('/', authenticateToken, async (req, res) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;