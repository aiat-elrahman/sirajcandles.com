import express from 'express';
import mongoose from 'mongoose';
import SiteSettings from '../models/SiteSettings.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Fixed, permanent ID for the one-and-only settings document. Using a real
// document (not a query filter) guarantees there can never be more than one —
// MongoDB enforces uniqueness on _id automatically.
const SETTINGS_ID = new mongoose.Types.ObjectId('000000000000000000000001');

const GIFT_POPULATE_PATH = 'freeGift.giftProducts';
const GIFT_POPULATE_FIELDS = 'name_en imagePaths category price_egp salePrice stock';

/**
 * Returns the single settings document, creating it if this is the very first
 * request ever, or self-healing if older "duplicate" documents exist from
 * before this fix (adopts the most recently updated one's data, then deletes
 * the rest so duplicates can never silently reappear).
 */
async function getSingletonSettings() {
  let settings = await SiteSettings.findById(SETTINGS_ID);
  if (settings) return settings;

  const existing = await SiteSettings.findOne().sort({ updatedAt: -1 });
  if (existing) {
    const data = existing.toObject();
    delete data._id;
    delete data.__v;
    settings = await SiteSettings.create({ _id: SETTINGS_ID, ...data });
    await SiteSettings.deleteMany({ _id: { $ne: SETTINGS_ID } });
  } else {
    settings = await SiteSettings.create({ _id: SETTINGS_ID });
  }
  return settings;
}

// GET site settings (public — used by frontend)
router.get('/', async (req, res) => {
  try {
    await getSingletonSettings();
    const settings = await SiteSettings.findById(SETTINGS_ID).populate(GIFT_POPULATE_PATH, GIFT_POPULATE_FIELDS);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update site settings (admin only)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await getSingletonSettings();
    Object.assign(settings, req.body);
    if (req.body.freeGift) {
      settings.freeGift = { ...settings.freeGift, ...req.body.freeGift };
    }
    await settings.save();

    const updated = await SiteSettings.findById(SETTINGS_ID).populate(GIFT_POPULATE_PATH, GIFT_POPULATE_FIELDS);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;