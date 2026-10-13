import express from 'express';
import LandingPage from '../models/LandingPage.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

const slugify = (s) => String(s || '')
  .toLowerCase().trim()
  .replace(/[^a-z0-9؀-ۿ]+/g, '-')
  .replace(/^-+|-+$/g, '');

// Never trust round-tripped Mongo fields from the admin form.
const sanitize = (body = {}) => {
  const data = { ...body };
  delete data._id; delete data.__v; delete data.createdAt; delete data.updatedAt;
  if (data.slug !== undefined) data.slug = slugify(data.slug);
  if (Array.isArray(data.productIds)) data.productIds = data.productIds.map(String).filter(Boolean);
  return data;
};

// ADMIN: list all landing pages (declared before '/:slug' so it is not swallowed by it)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pages = await LandingPage.find().sort({ updatedAt: -1 });
    res.json(pages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUBLIC: one published landing page by slug
router.get('/:slug', async (req, res) => {
  try {
    const page = await LandingPage.findOne({ slug: String(req.params.slug).toLowerCase(), isPublished: true });
    if (!page) return res.status(404).json({ message: 'Landing page not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADMIN: create
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const data = sanitize(req.body);
    if (!data.slug) return res.status(400).json({ message: 'A URL slug is required.' });
    const exists = await LandingPage.findOne({ slug: data.slug });
    if (exists) return res.status(409).json({ message: `The slug "${data.slug}" is already used.` });
    const page = await LandingPage.create(data);
    res.status(201).json(page);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ADMIN: update
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const data = sanitize(req.body);
    if (data.slug) {
      const clash = await LandingPage.findOne({ slug: data.slug, _id: { $ne: req.params.id } });
      if (clash) return res.status(409).json({ message: `The slug "${data.slug}" is already used.` });
    }
    const page = await LandingPage.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!page) return res.status(404).json({ message: 'Landing page not found' });
    res.json(page);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ADMIN: delete
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = await LandingPage.findByIdAndDelete(req.params.id);
    if (!page) return res.status(404).json({ message: 'Landing page not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;