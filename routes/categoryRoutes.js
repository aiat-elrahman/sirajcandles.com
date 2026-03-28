// routes/categoryRoutes.js
// Add subcategories field to your category schema

import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

const categorySchema = new mongoose.Schema({
    name:           { type: String, required: true, unique: true, trim: true },
    image:          { type: String, default: '' },
    sortOrder:      { type: Number, default: 0 },
    subcategories:  [{ type: String, trim: true }],   // ← NEW
}, { timestamps: true });

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

// GET all
router.get('/', async (req, res) => {
    try {
        const categories = await Category.find().sort({ sortOrder: 1 });
        res.json(categories);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST create
router.post('/', async (req, res) => {
    try {
        const category = new Category(req.body);
        res.status(201).json(await category.save());
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'Category name already exists.' });
        res.status(400).json({ message: err.message });
    }
});

// PUT update
router.put('/:id', async (req, res) => {
    try {
        const updated = await Category.findByIdAndUpdate(
            req.params.id, req.body, { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: 'Category not found' });
        res.json(updated);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Category.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Category not found' });
        res.json({ message: 'Category deleted' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;