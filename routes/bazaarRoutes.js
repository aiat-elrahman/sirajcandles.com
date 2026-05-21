import express from 'express';
import mongoose from 'mongoose';
import Bazaarsale from '../models/Bazaarsale.js';
import Product from '../models/Product.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all bazaar sales with optional filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = {};
    if (req.query.eventId) query.eventId = req.query.eventId;
    if (req.query.day) query.bazaarDay = req.query.day;
    const sales = await Bazaarsale.find(query).sort({ createdAt: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET list of unique events for menu selectors
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const events = await Bazaarsale.aggregate([
      {
        $group: {
          _id: "$eventId",
          eventName: { $first: "$eventName" },
          eventLocation: { $first: "$eventLocation" },
          createdAt: { $min: "$createdAt" }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create a bazaar sale & deduct stock safely
router.post('/', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { 
  eventId, eventName, eventLocation, customerName, customerPhone, 
  items, orderDiscount, discountPct, paymentMethod, note, bazaarDay 
} = req.body;

// Provide defaults if missing
const finalEventId = eventId || 'walkin';
const finalEventName = eventName || 'Bazaar Sale';
const finalEventLocation = eventLocation || 'On-site';

    if (!items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No items in sale.' });
    }

    let subtotal = 0;
    const finalItems = [];
    const dateObj = new Date();
    
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = daysOfWeek[dateObj.getDay()];
    const dayOfMonth = dateObj.getDate();

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`Product not found: ${item.productName}`);

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

  const sale = new Bazaarsale({
  eventId: finalEventId,
  eventName: finalEventName,
  eventLocation: finalEventLocation,
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
      dayOfWeek,
      dayOfMonth
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

// DELETE a sale record
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await Bazaarsale.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;