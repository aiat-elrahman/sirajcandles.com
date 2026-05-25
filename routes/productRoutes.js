import express from 'express';

import multer from 'multer';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct, // <-- Import update function
    deleteProduct  // <-- Import delete function
} from '../controllers/ProductController.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Define Routes ---
// ── NEW: Get location stock for a product (including variants) ──
router.get('/:id/location-stock', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const locationStock = {
      simple: {
        online: product.stockOnline || 0,
        sabeel: product.stockSabeel || 0,
        clouds_tex: product.stockCloudsTex || 0,
      },
      variants: product.variants.map(v => ({
        variantName: v.variantName,
        online: v.stockOnline || 0,
        sabeel: v.stockSabeel || 0,
        clouds_tex: v.stockCloudsTex || 0,
      }))
    };
    res.json(locationStock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── NEW: Update location stock for a product (variant or simple) ──
router.put('/:id/location-stock', authenticateToken, async (req, res) => {
  try {
    const { variantName, online, sabeel, clouds_tex } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (variantName) {
      // update variant
      const variant = product.variants.find(v => v.variantName === variantName);
      if (!variant) return res.status(404).json({ error: 'Variant not found' });
      if (online !== undefined) variant.stockOnline = online;
      if (sabeel !== undefined) variant.stockSabeel = sabeel;
      if (clouds_tex !== undefined) variant.stockCloudsTex = clouds_tex;
      // optionally sync legacy stock field (if you still use it)
      variant.stock = variant.stockOnline;
    } else {
      // update simple product
      if (online !== undefined) product.stockOnline = online;
      if (sabeel !== undefined) product.stockSabeel = sabeel;
      if (clouds_tex !== undefined) product.stockCloudsTex = clouds_tex;
      product.stock = product.stockOnline; // sync legacy
    }
    await product.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// GET /api/products
router.get('/', getAllProducts);

// GET /api/products/:id
router.get('/:id', getProductById);

// POST /api/products
router.post('/', upload.array('productImages', 5), createProduct);

// PUT /api/products/:id - Update product
router.put('/:id', upload.array('productImages', 5), updateProduct); // Allow images on update

// DELETE /api/products/:id - Delete product
router.delete('/:id', deleteProduct);

export default router;