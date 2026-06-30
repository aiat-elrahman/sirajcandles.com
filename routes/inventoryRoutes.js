import express from 'express';
import mongoose from 'mongoose';
import InventoryMovement from '../models/InventoryMovement.js';
import Product from '../models/Product.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

const LOCATION_FIELDS = {
  online: 'stockOnline',
  bazaar: 'stockOnline',
  sabeel: 'stockSabeel',
  clouds_tex: 'stockCloudsTex',
};

const escapeCsv = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const productLabel = (product) => product.name_en || product.bundleName || product.name;

const findTarget = (product, variantName) => {
  if (!variantName) return { target: product, variantName: '' };
  const variant = product.variants?.find(v => v.variantName === variantName);
  if (!variant) throw new Error('Variant not found.');
  return { target: variant, variantName };
};

const getStock = (target, location) => {
  const field = LOCATION_FIELDS[location];
  if (!field) throw new Error('Invalid location.');
  return Number(target[field] || 0);
};

const setStock = (product, target, location, quantity) => {
  const field = LOCATION_FIELDS[location];
  if (!field) throw new Error('Invalid location.');
  target[field] = Math.max(0, Number(quantity) || 0);
  if (field === 'stockOnline') target.stock = target.stockOnline;
  if (target !== product && field === 'stockOnline') {
    product.stock = product.variants.reduce((sum, v) => sum + Number(v.stockOnline || 0), 0);
  }
};

router.use(authenticateToken, requireAdmin);

router.get('/movements', async (req, res) => {
  try {
    const {
      productId,
      variantName,
      location,
      movementType,
      sourceType,
      from,
      to,
      limit = 200,
    } = req.query;

    const query = {};
    if (productId) query.productId = productId;
    if (variantName) query.variantName = variantName;
    if (location) query.location = location;
    if (movementType) query.movementType = movementType;
    if (sourceType) query.sourceType = sourceType;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const movements = await InventoryMovement.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 200, 1000));

    res.json(movements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/export.csv', async (req, res) => {
  try {
    const movements = await InventoryMovement.find().sort({ createdAt: -1 }).limit(5000);
    const rows = [
      ['Date', 'Product', 'Variant', 'Location', 'Type', 'Qty Change', 'Before', 'After', 'Reason', 'Source', 'User'],
      ...movements.map(m => [
        m.createdAt?.toISOString?.() || '',
        m.productName,
        m.variantName,
        m.location,
        m.movementType,
        m.quantityChange,
        m.currentStockBefore,
        m.currentStockAfter,
        m.reason,
        `${m.sourceType || ''}:${m.sourceId || ''}`,
        m.createdBy,
      ]),
    ];
    const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('inventory-movements.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { from, to, location } = req.query;
    const match = {};
    if (location) match.location = location;
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const byType = await InventoryMovement.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$movementType',
          quantity: { $sum: '$quantityChange' },
          retailValue: { $sum: '$totalRetailValue' },
          costValue: { $sum: '$totalCostValue' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const topProducts = await InventoryMovement.aggregate([
      { $match: { ...match, quantityChange: { $lt: 0 } } },
      {
        $group: {
          _id: { productName: '$productName', variantName: '$variantName' },
          quantitySold: { $sum: { $abs: '$quantityChange' } },
          retailValue: { $sum: '$totalRetailValue' },
        },
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 20 },
    ]);

    res.json({ byType, topProducts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/adjustment', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { productId, variantName, location, quantity, reason = 'Manual adjustment' } = req.body;
    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error('Product not found.');

    const { target } = findTarget(product, variantName);
    const before = getStock(target, location);
    const after = Math.max(0, Number(quantity) || 0);
    setStock(product, target, location, after);
    await product.save({ session });

    const movement = await InventoryMovement.record({
      productId: product._id,
      productName: productLabel(product),
      variantName: variantName || '',
      location,
      quantityChange: after - before,
      currentStockBefore: before,
      movementType: 'manual_adjustment',
      reason,
      sourceType: 'manual',
      createdBy: req.user?.username || '',
      createdByRole: req.user?.role || '',
      costPrice: target.costPrice || product.costPrice || 0,
    }, session);

    await session.commitTransaction();
    res.json({ success: true, product, movement });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

router.post('/restock', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { productId, variantName, location, quantity, reason = 'Restock' } = req.body;
    const addQty = Number(quantity) || 0;
    if (addQty <= 0) throw new Error('Restock quantity must be greater than zero.');

    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error('Product not found.');

    const { target } = findTarget(product, variantName);
    const before = getStock(target, location);
    setStock(product, target, location, before + addQty);
    await product.save({ session });

    const movement = await InventoryMovement.record({
      productId: product._id,
      productName: productLabel(product),
      variantName: variantName || '',
      location,
      quantityChange: addQty,
      currentStockBefore: before,
      movementType: 'restock',
      reason,
      sourceType: 'restock',
      createdBy: req.user?.username || '',
      createdByRole: req.user?.role || '',
      costPrice: target.costPrice || product.costPrice || 0,
    }, session);

    await session.commitTransaction();
    res.json({ success: true, product, movement });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

router.post('/transfer', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { productId, variantName, fromLocation, toLocation, quantity, reason = 'Stock transfer' } = req.body;
    const moveQty = Number(quantity) || 0;
    if (moveQty <= 0) throw new Error('Transfer quantity must be greater than zero.');
    if (fromLocation === toLocation) throw new Error('Source and destination must be different.');

    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error('Product not found.');

    const { target } = findTarget(product, variantName);
    const sourceBefore = getStock(target, fromLocation);
    const destBefore = getStock(target, toLocation);
    if (sourceBefore < moveQty) throw new Error(`Insufficient stock at ${fromLocation}.`);

    setStock(product, target, fromLocation, sourceBefore - moveQty);
    setStock(product, target, toLocation, destBefore + moveQty);
    await product.save({ session });

    const base = {
      productId: product._id,
      productName: productLabel(product),
      variantName: variantName || '',
      reason,
      sourceType: 'transfer',
      sourceId: `${Date.now()}`,
      createdBy: req.user?.username || '',
      createdByRole: req.user?.role || '',
      costPrice: target.costPrice || product.costPrice || 0,
    };

    const outMovement = await InventoryMovement.record({
      ...base,
      location: fromLocation,
      quantityChange: -moveQty,
      currentStockBefore: sourceBefore,
      movementType: 'stock_transfer_out',
    }, session);
    const inMovement = await InventoryMovement.record({
      ...base,
      location: toLocation,
      quantityChange: moveQty,
      currentStockBefore: destBefore,
      movementType: 'stock_transfer_in',
    }, session);

    await session.commitTransaction();
    res.json({ success: true, product, movements: [outMovement, inMovement] });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

router.post('/snapshot', async (req, res) => {
  try {
    const products = await Product.find({ status: 'Active' });
    let count = 0;
    for (const product of products) {
      const locations = ['online', 'sabeel', 'clouds_tex'];
      if (product.variants?.length) {
        for (const variant of product.variants) {
          for (const location of locations) {
            const before = getStock(variant, location);
            await InventoryMovement.record({
              productId: product._id,
              productName: productLabel(product),
              variantName: variant.variantName,
              location,
              quantityChange: 0,
              currentStockBefore: before,
              movementType: 'snapshot',
              reason: 'Inventory snapshot',
              sourceType: 'snapshot',
              createdBy: req.user?.username || '',
              createdByRole: req.user?.role || '',
              costPrice: variant.costPrice || product.costPrice || 0,
            });
            count += 1;
          }
        }
      } else {
        for (const location of locations) {
          const before = getStock(product, location);
          await InventoryMovement.record({
            productId: product._id,
            productName: productLabel(product),
            variantName: '',
            location,
            quantityChange: 0,
            currentStockBefore: before,
            movementType: 'snapshot',
            reason: 'Inventory snapshot',
            sourceType: 'snapshot',
            createdBy: req.user?.username || '',
            createdByRole: req.user?.role || '',
            costPrice: product.costPrice || 0,
          });
          count += 1;
        }
      }
    }
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
