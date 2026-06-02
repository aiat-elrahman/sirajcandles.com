import express from 'express';
import Store from '../models/Store.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all active stores (public — used by stores.html)
router.get('/', async (req, res) => {
  try {
    const { admin } = req.query;
    const query = admin === 'true' ? {} : { status: 'active' };
    const stores = await Store.find(query).sort({ sortOrder: 1, createdAt: 1 });
    res.json(stores);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create store (admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const store = new Store(req.body);
    await store.save();
    res.status(201).json(store);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update store (admin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const store = await Store.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!store) return res.status(404).json({ message: 'Store not found' });
    res.json(store);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE store (admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const store = await Store.findByIdAndDelete(req.params.id);
    if (!store) return res.status(404).json({ message: 'Store not found' });
    res.json({ message: 'Store deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
