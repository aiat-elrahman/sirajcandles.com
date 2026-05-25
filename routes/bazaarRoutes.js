import express from 'express';
import mongoose from 'mongoose';
import Bazaarsale from '../models/Bazaarsale.js';
import Product from '../models/Product.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── GET all bazaar sales (with optional filters) ──────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = {};
    if (req.query.eventId) query.eventId = req.query.eventId;
    if (req.query.day)     query.bazaarDay = req.query.day;
    const sales = await Bazaarsale.find(query).sort({ createdAt: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET unique events list (for selectors) ────────────────────────────────────
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const events = await Bazaarsale.aggregate([
      {
        $group: {
          _id:           '$eventId',
          eventName:     { $first: '$eventName' },
          eventLocation: { $first: '$eventLocation' },
          totalRevenue:  { $sum: '$totalAmount' },
          saleCount:     { $sum: 1 },
          createdAt:     { $min: '$createdAt' },
        }
      },
      { $sort: { createdAt: -1 } }
    ]);
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET analytics for a specific event ───────────────────────────────────────
// e.g. GET /api/bazaar/analytics?eventId=xxx
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const matchStage = req.query.eventId ? { $match: { eventId: req.query.eventId } } : { $match: {} };

    // Revenue by day
    const byDay = await Bazaarsale.aggregate([
      matchStage,
      { $group: {
          _id:     '$bazaarDay',
          revenue: { $sum: '$totalAmount' },
          cash:    { $sum: { $cond: [{ $eq: ['$paymentMethod', 'Cash'] }, '$totalAmount', 0] } },
          instapay:{ $sum: { $cond: [{ $eq: ['$paymentMethod', 'InstaPay'] }, '$totalAmount', 0] } },
          sales:   { $sum: 1 },
          discounts:{ $sum: '$orderDiscount' },
      }},
      { $sort: { _id: 1 } }
    ]);

    // Top products for this event
    const topProducts = await Bazaarsale.aggregate([
      matchStage,
      { $unwind: '$items' },
      { $group: {
          _id:      '$items.productName',
          qty:      { $sum: '$items.quantity' },
          revenue:  { $sum: { $multiply: ['$items.salePrice', '$items.quantity'] } },
          gifts:    { $sum: { $cond: ['$items.isFreeGift', '$items.quantity', 0] } },
      }},
      { $sort: { revenue: -1 } },
      { $limit: 20 }
    ]);

    // Overall totals
    const totals = await Bazaarsale.aggregate([
      matchStage,
      { $group: {
          _id:        null,
          revenue:    { $sum: '$totalAmount' },
          cash:       { $sum: { $cond: [{ $eq: ['$paymentMethod', 'Cash'] }, '$totalAmount', 0] } },
          instapay:   { $sum: { $cond: [{ $eq: ['$paymentMethod', 'InstaPay'] }, '$totalAmount', 0] } },
          saleCount:  { $sum: 1 },
          discounts:  { $sum: '$orderDiscount' },
          gifts:      { $sum: { $reduce: { input: '$items', initialValue: 0,
            in: { $add: ['$$value', { $cond: ['$$this.isFreeGift', '$$this.quantity', 0] }] } } } },
          customers:  { $addToSet: '$customerPhone' },
      }}
    ]);

    const t = totals[0] || {};

    res.json({
      byDay,
      topProducts: topProducts.map(p => ({ name: p._id, qty: p.qty, revenue: p.revenue, gifts: p.gifts })),
      totals: {
        revenue:    t.revenue    || 0,
        cash:       t.cash       || 0,
        instapay:   t.instapay   || 0,
        saleCount:  t.saleCount  || 0,
        discounts:  t.discounts  || 0,
        gifts:      t.gifts      || 0,
        uniqueCustomers: (t.customers || []).filter(Boolean).length,
      }
    });
  } catch (err) {
    console.error('Bazaar analytics error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST create a bazaar sale & deduct stock ──────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      eventId, eventName, eventLocation,
      customerName, customerPhone,
      items, orderDiscount, discountPct, paymentMethod, note, bazaarDay
    } = req.body;

    const finalEventId       = eventId       || 'walkin';
    const finalEventName     = eventName     || 'Bazaar Sale';
    const finalEventLocation = eventLocation || 'On-site';

    if (!items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No items in sale.' });
    }

    let subtotal = 0;
    const finalItems = [];
    const now        = new Date();
    const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayOfWeek  = daysOfWeek[now.getDay()];
    const dayOfMonth = now.getDate();

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`Product not found: ${item.productName}`);

      // Deduct stock — variant first, fallback to main stock
      if (item.variantName) {
        const variant = product.variants?.find(v => v.variantName === item.variantName);
        if (variant) {
    if (variant.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name} (${item.variantName}).`);
    }
    variant.stock -= item.quantity;
    
    // Also sync main stock so listing page reflects reality
    product.stock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
}else {
          if (product.stock < item.quantity)
            throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}`);
          product.stock -= item.quantity;
        }
      } else {
        if (product.stock < item.quantity)
          throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}`);
        product.stock -= item.quantity;
      }

      await product.save({ session });

      const lineTotal = item.isFreeGift ? 0 : item.salePrice * item.quantity;
      subtotal += lineTotal;

      finalItems.push({
        productId:     product._id,
        productName:   item.productName,
        variantName:   item.variantName  || '',
        originalPrice: item.originalPrice,
        salePrice:     item.isFreeGift ? 0 : item.salePrice,
        quantity:      item.quantity,
        isFreeGift:    item.isFreeGift   || false,
        itemNote:      item.itemNote     || '',
      });
    }

    const totalAmount = Math.max(0, subtotal - (orderDiscount || 0));

    const sale = new Bazaarsale({
      eventId:       finalEventId,
      eventName:     finalEventName,
      eventLocation: finalEventLocation,
      customerName:  customerName  || 'Walk-in',
      customerPhone: customerPhone || '',
      items:         finalItems,
      subtotal,
      orderDiscount: orderDiscount || 0,
      discountPct:   discountPct   || 0,
      paymentMethod: paymentMethod || 'Cash',
      totalAmount,
      note:          note     || '',
      bazaarDay:     bazaarDay || 'Day 1',
      dayOfWeek,
      dayOfMonth,
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

// ── DELETE a sale (does NOT restore stock) ────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await Bazaarsale.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Sale not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;