import express from 'express';
import Review from '../models/Review.js';

const router = express.Router();

router.get('/:productId', async (req, res) => {
    try {
        const reviews = await Review.find({ productId: req.params.productId }).sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:productId', async (req, res) => {
    try {
        const { name, email, rating, comment, photos } = req.body;
        const review = new Review({ productId: req.params.productId, name, email, rating, comment, photos });
        await review.save();
        res.status(201).json(review);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

export default router;