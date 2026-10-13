import express from 'express';
import mongoose from 'mongoose';
import SiteSettings from '../models/SiteSettings.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Fixed, permanent ID for the one-and-only settings document. Using a real
// document (not a query filter) guarantees there can never be more than one —
// MongoDB enforces uniqueness on _id automatically.
const SETTINGS_ID = new mongoose.Types.ObjectId('000000000000000000000001');

// Keys only the Store Settings page may write (payment + tracking).
const STORE_KEYS = ['payment', 'metaPixelId', 'googleAnalyticsId', 'metaCapiToken', 'metaTestEventCode', 'metaApiVersion'];

const maskToken = (t) => (t ? `${'•'.repeat(Math.max(0, t.length - 4))}${t.slice(-4)}` : '');

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

// GET store settings for the admin Store Settings page (admin only).
// The CAPI token is never sent back in full — only whether it is set and its last 4 characters.
router.get('/store', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await getSingletonSettings();
    const doc = await SiteSettings.findById(SETTINGS_ID).select('+metaCapiToken');
    const obj = doc.toObject();
    const token = obj.metaCapiToken || '';
    res.json({
      payment: obj.payment || {},
      metaPixelId: obj.metaPixelId || '',
      googleAnalyticsId: obj.googleAnalyticsId || '',
      metaTestEventCode: obj.metaTestEventCode || '',
      metaApiVersion: obj.metaApiVersion || 'v23.0',
      metaCapiTokenSet: !!token,
      metaCapiTokenMasked: maskToken(token),
    });
  } catch (err) {
    console.error('GET /api/site-settings/store error:', err);
    res.status(500).json({ message: err.message });
  }
});

// PUT store settings (admin only). Only whitelisted fields are applied.
// metaCapiToken: omitted or empty = keep the saved one; send clearMetaCapiToken:true to remove it.
router.put('/store', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await getSingletonSettings();
    const b = req.body || {};
    const str = (v) => String(v == null ? '' : v).trim();

    if (b.payment && typeof b.payment === 'object') {
      const p = b.payment;
      const current = settings.payment ? settings.payment.toObject() : {};
      const next = { ...current };
      if (p.depositEnabled !== undefined) next.depositEnabled = !!p.depositEnabled;
      if (p.instapayNumber !== undefined) next.instapayNumber = str(p.instapayNumber);
      if (p.instapayAccountName !== undefined) next.instapayAccountName = str(p.instapayAccountName);
      if (p.depositType !== undefined) {
        if (!['percent', 'fixed'].includes(p.depositType)) return res.status(400).json({ message: 'Deposit type must be percent or fixed.' });
        next.depositType = p.depositType;
      }
      if (p.depositValue !== undefined) {
        const v = Number(p.depositValue);
        if (!Number.isFinite(v) || v < 0) return res.status(400).json({ message: 'Deposit amount must be a positive number.' });
        if ((p.depositType || next.depositType) === 'percent' && v > 100) return res.status(400).json({ message: 'A percentage deposit cannot be more than 100.' });
        next.depositValue = v;
      }
      ['policyHeading', 'policyText', 'acknowledgeLabel', 'successMessage'].forEach(k => {
        if (p[k] !== undefined) next[k] = String(p[k]);
      });
      settings.payment = next;
    }

    if (b.metaPixelId !== undefined) {
      const id = str(b.metaPixelId);
      if (id && !/^\d{10,20}$/.test(id)) return res.status(400).json({ message: 'The Pixel ID should be only digits (about 15–16 of them).' });
      settings.metaPixelId = id;
    }
    if (b.googleAnalyticsId !== undefined) settings.googleAnalyticsId = str(b.googleAnalyticsId);
    if (b.metaTestEventCode !== undefined) settings.metaTestEventCode = str(b.metaTestEventCode);
    if (b.metaApiVersion !== undefined) {
      const v = str(b.metaApiVersion);
      if (v && !/^v\d+\.\d+$/.test(v)) return res.status(400).json({ message: 'API version looks like v23.0' });
      settings.metaApiVersion = v || 'v23.0';
    }
    if (b.clearMetaCapiToken === true) settings.metaCapiToken = '';
    else if (b.metaCapiToken && str(b.metaCapiToken) && !str(b.metaCapiToken).includes('•')) settings.metaCapiToken = str(b.metaCapiToken);

    await settings.save();
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/site-settings/store error:', err);
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
    // Payment + tracking credentials are owned by PUT /store (the Store Settings page).
    // Ignoring them here means an older, already-open admin tab can never overwrite them.
    STORE_KEYS.forEach(k => delete incoming[k]);

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