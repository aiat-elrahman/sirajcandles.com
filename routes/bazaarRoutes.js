import express from 'express';
import mongoose from 'mongoose';
import Bazaarsale from '../models/Bazaarsale.js';
import Product from '../models/Product.js';
import { authenticateToken, isAdminUser, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper: get the correct stock field name based on location
const getStockField = (location) => {
  switch (location) {
    case 'bazaar': return 'stockOnline';
    case 'sabeel': return 'stockSabeel';
    case 'clouds_tex': return 'stockCloudsTex';
    default: return 'stockOnline';
  }
};

// ── GET all bazaar sales (with optional filters) ──────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = {};
    if (req.query.eventId) query.eventId = req.query.eventId;
    if (req.query.day)     query.bazaarDay = req.query.day;
    if (!isAdminUser(req.user)) query.location = req.user.store;
    const sales = await Bazaarsale.find(query).sort({ createdAt: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET unique events list (for selectors) ────────────────────────────────────
router.get('/events', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const events = await Bazaarsale.aggregate([
      {
        $group: {
          _id:           '$eventId',
          eventName:     { $first: '$eventName' },
          eventLocation: { $first: '$eventLocation' },
          startDate:     { $first: '$startDate' },
          endDate:       { $first: '$endDate' },
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
router.get('/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const matchStage = req.query.eventId ? { $match: { eventId: req.query.eventId } } : { $match: {} };
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

// ── POST create a bazaar sale & deduct stock (supports location) ──────────────
router.post('/', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      eventId, eventName, eventLocation,
      customerName, customerPhone,
      items, orderDiscount, discountPct, paymentMethod, note,
      bazaarDay,           // expected: string date (YYYY-MM-DD) for the actual sale day
      startDate, endDate,  // optional: for the first sale of an event
      location             // 'bazaar', 'sabeel', 'clouds_tex'
    } = req.body;

    const finalLocation = isAdminUser(req.user) ? (location || 'bazaar') : req.user.store;
    if (!finalLocation) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Store employee account is missing a store assignment.' });
    }
    const stockField = getStockField(finalLocation);
    const finalEventId = eventId || 'walkin';
    const finalEventName = eventName || 'Bazaar Sale';
    const finalEventLocation = eventLocation || 'On-site';

    if (!items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No items in sale.' });
    }

    let subtotal = 0;
    const finalItems = [];
    const now = new Date();
    const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayOfWeek = daysOfWeek[now.getDay()];
    const dayOfMonth = now.getDate();

    // Use provided bazaarDay (actual date) or fallback to today
    const saleDate = bazaarDay ? new Date(bazaarDay) : now;

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`Product not found: ${item.productName}`);

      if (item.variantName) {
        const variant = product.variants?.find(v => v.variantName === item.variantName);
        if (variant) {
          if (variant[stockField] < item.quantity) {
            throw new Error(`Insufficient stock (${finalLocation}) for ${product.name} (${item.variantName}).`);
          }
          variant[stockField] -= item.quantity;
          // Keep legacy stock field synced only for online (to avoid confusion)
          if (finalLocation === 'bazaar') variant.stock = variant.stockOnline;
          product.stock = product.variants.reduce((sum, v) => sum + (v[stockField] || 0), 0);
        } else {
          if (product[stockField] < item.quantity)
            throw new Error(`Not enough stock (${finalLocation}) for ${product.name}. Available: ${product[stockField]}`);
          product[stockField] -= item.quantity;
          if (finalLocation === 'bazaar') product.stock = product.stockOnline;
        }
      } else {
        if (product[stockField] < item.quantity)
          throw new Error(`Not enough stock (${finalLocation}) for ${product.name}. Available: ${product[stockField]}`);
        product[stockField] -= item.quantity;
        if (finalLocation === 'bazaar') product.stock = product.stockOnline;
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

    // Build sale document
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
      bazaarDay:     saleDate.toISOString().split('T')[0], // store as YYYY-MM-DD
      dayOfWeek,
      dayOfMonth,
      startDate:     startDate ? new Date(startDate) : null,
      endDate:       endDate ? new Date(endDate) : null,
      actualDate:    saleDate,
      location:      finalLocation,
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

// ── PUT – Edit an existing sale (add/remove items, change payment, move date) ──
router.put('/:id', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sale = await Bazaarsale.findById(req.params.id).session(session);
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Sale not found' });
    }
    if (!isAdminUser(req.user) && sale.location !== req.user.store) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'You can only edit sales for your own store.' });
    }

    const { items, paymentMethod, actualDate, customerName, customerPhone, note, orderDiscount, discountPct } = req.body;

    // Determine which stock field to use (based on the sale's original location)
    const stockField = getStockField(sale.location || 'bazaar');

    // 1. Restore old stock (reverse previous deduction)
    for (const oldItem of sale.items) {
      const product = await Product.findById(oldItem.productId).session(session);
      if (!product) continue;
      if (oldItem.variantName) {
        const variant = product.variants.find(v => v.variantName === oldItem.variantName);
        if (variant) {
          variant[stockField] += oldItem.quantity;
          if (stockField === 'stockOnline') variant.stock = variant.stockOnline;
        } else {
          product[stockField] += oldItem.quantity;
          if (stockField === 'stockOnline') product.stock = product.stockOnline;
        }
      } else {
        product[stockField] += oldItem.quantity;
        if (stockField === 'stockOnline') product.stock = product.stockOnline;
      }
      await product.save({ session });
    }

    // 2. Apply new items and deduct new stock
    let newSubtotal = 0;
    const newItems = [];
    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`Product not found: ${item.productName}`);
      if (item.variantName) {
        const variant = product.variants.find(v => v.variantName === item.variantName);
        if (variant) {
          if (variant[stockField] < item.quantity) throw new Error(`Insufficient stock for ${product.name} (${item.variantName})`);
          variant[stockField] -= item.quantity;
          if (stockField === 'stockOnline') variant.stock = variant.stockOnline;
        } else {
          if (product[stockField] < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);
          product[stockField] -= item.quantity;
          if (stockField === 'stockOnline') product.stock = product.stockOnline;
        }
      } else {
        if (product[stockField] < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);
        product[stockField] -= item.quantity;
        if (stockField === 'stockOnline') product.stock = product.stockOnline;
      }
      await product.save({ session });
      const lineTotal = item.isFreeGift ? 0 : item.salePrice * item.quantity;
      newSubtotal += lineTotal;
      newItems.push(item);
    }

    const newTotal = Math.max(0, newSubtotal - (orderDiscount || 0));

    // Update sale document
    sale.items = newItems;
    sale.subtotal = newSubtotal;
    sale.totalAmount = newTotal;
    sale.orderDiscount = orderDiscount || 0;
    sale.discountPct = discountPct || 0;
    sale.paymentMethod = paymentMethod || sale.paymentMethod;
    sale.note = note !== undefined ? note : sale.note;
    sale.customerName = customerName || sale.customerName;
    sale.customerPhone = customerPhone || sale.customerPhone;
    if (actualDate) sale.actualDate = new Date(actualDate);
    // If date changed, update bazaarDay (display date)
    if (actualDate) sale.bazaarDay = new Date(actualDate).toISOString().split('T')[0];
    await sale.save({ session });

    await session.commitTransaction();
    session.endSession();
    res.json({ success: true, sale });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE a sale (does NOT restore stock) ────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const sale = await Bazaarsale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    if (!isAdminUser(req.user) && sale.location !== req.user.store) {
      return res.status(403).json({ message: 'You can only delete sales for your own store.' });
    }
    await Bazaarsale.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
