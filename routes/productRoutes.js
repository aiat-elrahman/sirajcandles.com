import express from 'express';

import multer from 'multer';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct, // <-- Import update function
    deleteProduct  // <-- Import delete function
} from '../controllers/ProductController.js';
import Product from '../models/Product.js';
import InventoryMovement from '../models/InventoryMovement.js';
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const SITE_URL = 'https://sirajcare.com';

const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
const stripHtml = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const absoluteImageUrl = url => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_URL}/${String(url).replace(/^\/+/, '')}`;
};

const getProductStock = product => {
  if (product.variants?.length) {
    return product.variants.reduce((sum, variant) => sum + Number(variant.stockOnline ?? variant.stock ?? 0), 0);
  }
  return Number(product.stockOnline ?? product.stock ?? 0);
};

const getProductPrice = product => {
  if (product.productType === 'Bundle') return Number(product.bundlePrice || product.price_egp || product.price || 0);
  if (product.variants?.length) return Number(product.variants[0].price || product.price_egp || product.price || 0);
  return Number(product.price_egp || product.price || 0);
};

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
// ── Update location stock for a product (variant or simple) ──
router.put('/:id/location-stock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { variantName, online, sabeel, clouds_tex } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const productName = product.name_en || product.bundleName || product.name;
    const movements    = []; // collect { location, before, after, costPrice } to record after save

    if (variantName) {
      // update variant
      const variant = product.variants.find(v => v.variantName === variantName);
      if (!variant) return res.status(404).json({ error: 'Variant not found' });

      const costPrice = variant.costPrice || product.costPrice || 0;

      // Force conversion to Numbers, fallback to existing stock if undefined
      if (online !== undefined) {
        const before = variant.stockOnline || 0;
        const after  = Number(online) || 0;
        if (before !== after) movements.push({ location: 'online', before, after, costPrice });
        variant.stockOnline = after;
      }
      if (sabeel !== undefined) {
        const before = variant.stockSabeel || 0;
        const after  = Number(sabeel) || 0;
        if (before !== after) movements.push({ location: 'sabeel', before, after, costPrice });
        variant.stockSabeel = after;
      }
      if (clouds_tex !== undefined) {
        const before = variant.stockCloudsTex || 0;
        const after  = Number(clouds_tex) || 0;
        if (before !== after) movements.push({ location: 'clouds_tex', before, after, costPrice });
        variant.stockCloudsTex = after;
      }

      variant.stock = variant.stockOnline; // sync legacy
      product.stock = product.variants.reduce((sum, v) => sum + Number(v.stockOnline || 0), 0);
    } else {
      // update simple product
      const costPrice = product.costPrice || 0;

      if (online !== undefined) {
        const before = product.stockOnline || 0;
        const after  = Number(online) || 0;
        if (before !== after) movements.push({ location: 'online', before, after, costPrice });
        product.stockOnline = after;
      }
      if (sabeel !== undefined) {
        const before = product.stockSabeel || 0;
        const after  = Number(sabeel) || 0;
        if (before !== after) movements.push({ location: 'sabeel', before, after, costPrice });
        product.stockSabeel = after;
      }
      if (clouds_tex !== undefined) {
        const before = product.stockCloudsTex || 0;
        const after  = Number(clouds_tex) || 0;
        if (before !== after) movements.push({ location: 'clouds_tex', before, after, costPrice });
        product.stockCloudsTex = after;
      }

      product.stock = product.stockOnline; // sync legacy
    }

    await product.save();

    // Record one movement per location field that actually changed
    for (const m of movements) {
      await InventoryMovement.record({
        productId:     product._id,
        productName,
        variantName:   variantName || '',
        location:      m.location,
        quantityChange: m.after - m.before,
        currentStockBefore: m.before,
        movementType:  'manual_adjustment',
        reason:        'Stock Manager manual update',
        sourceType:    'manual',
        createdBy:     req.user?.username || '',
        createdByRole: req.user?.role     || '',
        salePrice:     0,
        costPrice:     m.costPrice,
      });
    }

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/catalog-feed.csv', async (req, res) => {
  try {
    const products = await Product.find({ status: 'Active' }).sort({ updatedAt: -1 });
    const header = [
      'id',
      'title',
      'description',
      'availability',
      'condition',
      'price',
      'link',
      'image_link',
      'brand',
      'google_product_category',
    ];

    const rows = products.map(product => {
      const title = product.name_en || product.bundleName || product.name || 'Siraj Candles Product';
      const description = stripHtml(product.description_en || product.bundleDescription || product.formattedDescription || title);
      const price = getProductPrice(product);
      const availability = getProductStock(product) > 0 ? 'in stock' : 'out of stock';
      const image = absoluteImageUrl(product.imagePaths?.[0] || product.images?.[0] || '');

      return [
        product._id,
        title,
        description,
        availability,
        'new',
        `${price.toFixed(2)} EGP`,
        `${SITE_URL}/product.html?id=${product._id}`,
        image,
        'Siraj Candles',
        'Home & Garden > Decor > Home Fragrances > Candles',
      ].map(escapeCsv).join(',');
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send([header.join(','), ...rows].join('\n'));
  } catch (err) {
    console.error('Catalog feed error:', err);
    res.status(500).json({ message: 'Could not generate catalog feed.' });
  }
});
// GET /api/products
router.get('/', getAllProducts);

// GET /api/products/:id
router.get('/:id', getProductById);

// POST /api/products
router.post('/', authenticateToken, requireAdmin, upload.array('productImages', 5), createProduct);

// PUT /api/products/:id - Update product
router.put('/:id', authenticateToken, requireAdmin, upload.array('productImages', 5), updateProduct); // Allow images on update

// DELETE /api/products/:id - Delete product
router.delete('/:id', authenticateToken, requireAdmin, deleteProduct);

export default router;
