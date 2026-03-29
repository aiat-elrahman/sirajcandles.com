import express from 'express';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import DatauriParser from 'datauri/parser.js';
import path from 'path';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const parser = new DatauriParser();

const subcategorySchema = new mongoose.Schema({
    name:  { type: String, required: true, trim: true },
    image: { type: String, default: '' },
}, { _id: false });

const categorySchema = new mongoose.Schema({
    name:          { type: String, required: true, unique: true, trim: true },
    image:         { type: String, default: '' },
    sortOrder:     { type: Number, default: 0 },
    subcategories: [subcategorySchema],
}, { timestamps: true });

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

// GET all
router.get('/', async (req, res) => {
    try {
        res.json(await Category.find().sort({ sortOrder: 1 }));
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

// POST upload subcategory image
// Used by CategoryManager to upload an image for a specific subcategory
router.post('/:id/subcategory-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const dataUri = parser.format(path.extname(req.file.originalname), req.file.buffer);
        const result = await cloudinary.uploader.upload(dataUri.content, {
            folder: 'siraj-categories',
            transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }]
        });

        res.json({ imageUrl: result.secure_url });
    } catch (err) {
        console.error('Subcategory image upload error:', err);
        res.status(500).json({ message: 'Upload failed', error: err.message });
    }
});

export default router;