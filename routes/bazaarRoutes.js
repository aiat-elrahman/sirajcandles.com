import express from 'express';
import mongoose from 'mongoose';
import Bazaarsale from '../models/BazaarSale.js';
import Product from '../models/Product.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all bazaar sales (admin) — supports ?day= filter
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = {};
    if (req.query.day) query.bazaarDay = req.query.day;
    const sales = await BazaarSale.find(query).sort({ createdAt: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create a bazaar sale — deducts stock
router.post('/', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
  const { customerName, customerPhone, items, orderDiscount, discountPct, paymentMethod, note, bazaarDay } = req.body;


    if (!items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No items in sale.' });
    }

    let subtotal = 0;
    const finalItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`Product not found: ${item.productName}`);

      // Deduct stock — variant or main stock
      if (item.variantName) {
        const variant = product.variants.find(v => v.variantName === item.variantName);
        if (variant) {
          if (variant.stock < item.quantity) throw new Error(`Not enough stock for ${product.name} (${item.variantName})`);
          variant.stock -= item.quantity;
        } else {
          if (product.stock < item.quantity) throw new Error(`Not enough stock for ${product.name}`);
          product.stock -= item.quantity;
        }
      } else {
        if (product.stock < item.quantity) throw new Error(`Not enough stock for ${product.name}`);
        product.stock -= item.quantity;
      }

      await product.save({ session });

      const lineTotal = item.isFreeGift ? 0 : item.salePrice * item.quantity;
      subtotal += lineTotal;

      finalItems.push({
        productId: product._id,
        productName: item.productName,
        variantName: item.variantName || '',
        originalPrice: item.originalPrice,
        salePrice: item.isFreeGift ? 0 : item.salePrice,
        quantity: item.quantity,
        isFreeGift: item.isFreeGift || false,
        itemNote: item.itemNote || '',
      });
    }

    const totalAmount = Math.max(0, subtotal - (orderDiscount || 0));

    const sale = new BazaarSale({
      customerName: customerName || 'Walk-in',
      customerPhone: customerPhone || '',
      items: finalItems,
      subtotal,
      orderDiscount: orderDiscount || 0,
      discountPct: discountPct || 0,
      paymentMethod: paymentMethod || 'Cash',
      totalAmount,
      note: note || '',
      bazaarDay: bazaarDay || 'Day 1',
    });

    await sale.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true, sale });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
});

// DELETE a sale (admin — does NOT restore stock, intentional)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await BazaarSale.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;