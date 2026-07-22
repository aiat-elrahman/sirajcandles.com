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
 * the rest so duplicates can never silently reappear). Also self-heals a rare
 * race where two requests both try to create the singleton at once.
 */
async function getSingletonSettings() {
  let settings = await SiteSettings.findById(SETTINGS_ID);
  if (settings) return settings;

  try {
    const existing = await SiteSettings.findOne({ _id: { $ne: SETTINGS_ID } }).sort({ updatedAt: -1 });
    const data = existing ? existing.toObject() : {};
    delete data._id;
    delete data.__v;
    settings = await SiteSettings.create({ _id: SETTINGS_ID, ...data });
    if (existing) {
      await SiteSettings.deleteMany({ _id: { $ne: SETTINGS_ID } });
    }
    return settings;
  } catch (err) {
    // Someone else's request won the race and already created it — just fetch it
    const retry = await SiteSettings.findById(SETTINGS_ID);
    if (retry) return retry;
    throw err;
  }
}

// GET site settings (public — used by frontend)
router.get('/', async (req, res) => {
  try {
    await getSingletonSettings();
    const settings = await SiteSettings.findById(SETTINGS_ID).populate(GIFT_POPULATE_PATH, GIFT_POPULATE_FIELDS);
    res.json(settings);
  } catch (err) {
    console.error('GET /api/site-settings error:', err);
    res.status(500).json({ message: err.message });
  }
});

// PUT update site settings (admin only)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await getSingletonSettings();

    // Strip fields that shouldn't ever be reassigned — the admin form round-trips
    // whatever the last GET returned (including _id/__v/timestamps), and blindly
    // re-applying those onto an existing document is what was causing save() to fail.
    const incoming = { ...req.body };
    delete incoming._id;
    delete incoming.__v;
    delete incoming.createdAt;
    delete incoming.updatedAt;

    // freeGift.giftProducts arrives as populated product objects (from the last GET) —
    // Mongoose can cast those back down to ObjectIds via their _id, but only if they're
    // actually shaped as expected. Normalize defensively so a save never breaks on this.
    if (incoming.freeGift?.giftProducts) {
      incoming.freeGift.giftProducts = incoming.freeGift.giftProducts
        .map(g => (typeof g === 'string' ? g : g?._id))
        .filter(Boolean);
    }

    Object.assign(settings, incoming);
    if (incoming.freeGift) {
      settings.freeGift = { ...settings.freeGift, ...incoming.freeGift };
    }
    await settings.save();

    const updated = await SiteSettings.findById(SETTINGS_ID).populate(GIFT_POPULATE_PATH, GIFT_POPULATE_FIELDS);
    res.json({ success: true, settings: updated });
  } catch (err) {
    console.error('PUT /api/site-settings error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;