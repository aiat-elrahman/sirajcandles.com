import express from 'express';
import Review from '../models/Review.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all reviews for a product (public)
router.get('/:productId', async (req, res) => {
    try {
        const reviews = await Review.find({ productId: req.params.productId }).sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET all reviews (admin)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const reviews = await Review.find().sort({ createdAt: -1 }).populate('productId', 'name_en bundleName');
        res.json(reviews);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST submit review (public - requires email + phone)
router.post('/:productId', async (req, res) => {
    try {
        const { name, email, phone, rating, comment, photos } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required.' });
        if (!phone) return res.status(400).json({ message: 'Phone number is required.' });
        const review = new Review({ productId: req.params.productId, name, email, phone, rating, comment, photos });
        await review.save();
        res.status(201).json(review);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// POST create review as admin (with optional screenshot)
router.post('/admin/create', authenticateToken, async (req, res) => {
    try {
        const { productId, name, email, phone, rating, comment, photos, isAdminCreated } = req.body;
        const review = new Review({ productId, name, email, phone, rating, comment, photos, isAdminCreated: true });
        await review.save();
        res.status(201).json(review);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// DELETE review (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const deleted = await Review.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Review not found' });
        res.json({ message: 'Review deleted' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;