import express from 'express';
import mongoose from 'mongoose';
import Bazaarsale from '../models/Bazaarsale.js';
import Product from '../models/Product.js';
import InventoryMovement from '../models/InventoryMovement.js';
import { authenticateToken, isAdminUser, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Constants ─────────────────────────────────────────────────────────────────
// Default edit window in seconds (1 hour). Admin can override per-request.
const DEFAULT_EDIT_WINDOW_SECONDS = 3600;

// ── Helpers ───────────────────────────────────────────────────────────────────
const getStockField = (location) => {
  switch (location) {
    case 'bazaar':     return 'stockOnline';
    case 'sabeel':     return 'stockSabeel';
    case 'clouds_tex': return 'stockCloudsTex';
    default:           return 'stockOnline';
  }
};

const syncLegacyOnlineStock = (product) => {
  if (product.variants?.length) {
    product.stock = product.variants.reduce((sum, v) => sum + Number(v.stockOnline || 0), 0);
  } else {
    product.stock = product.stockOnline || 0;
  }
};

const itemKey = (item) => `${item.productId?.toString?.() || item.productId}:${item.variantName || ''}`;

const lineTotal = (item) => (item.isFreeGift ? 0 : (Number(item.salePrice) || 0) * (Number(item.quantity) || 0));

const mergeSaleItems = (items) => {
  const byKey = new Map();
  for (const item of items) {
    const key = itemKey(item);
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity += Number(item.quantity) || 0;
      existing.itemNote = [existing.itemNote, item.itemNote].filter(Boolean).join(' | ');
    } else {
      byKey.set(key, { ...item, quantity: Number(item.quantity) || 0 });
    }
  }
  return Array.from(byKey.values()).filter(item => item.quantity > 0);
};

// Deduct stock for one item. Throws if insufficient.
const deductStock = async (product, variantName, stockField, quantity, session, movementCtx = {}) => {
  let stockBefore;
  if (variantName) {
    const variant = product.variants?.find(v => v.variantName === variantName);
    if (variant) {
      stockBefore = variant[stockField] || 0;
      if (stockBefore < quantity)
        throw new Error(`Not enough stock for ${product.name_en || product.name} (${variantName}). Available: ${stockBefore}`);
      variant[stockField] -= quantity;
      if (stockField === 'stockOnline') {
        variant.stock = variant.stockOnline;
        syncLegacyOnlineStock(product);
      }
    } else {
      stockBefore = product[stockField] || 0;
      if (stockBefore < quantity)
        throw new Error(`Not enough stock for ${product.name_en || product.name}. Available: ${stockBefore}`);
      product[stockField] -= quantity;
      if (stockField === 'stockOnline') syncLegacyOnlineStock(product);
    }
  } else {
    stockBefore = product[stockField] || 0;
    if (stockBefore < quantity)
      throw new Error(`Not enough stock for ${product.name_en || product.name}. Available: ${stockBefore}`);
    product[stockField] -= quantity;
    if (stockField === 'stockOnline') syncLegacyOnlineStock(product);
  }
  await product.save({ session });

  // Record movement (non-blocking on missing context — safe default)
  if (movementCtx.movementType) {
    const location = stockField === 'stockOnline' ? 'online' : stockField === 'stockSabeel' ? 'sabeel' : 'clouds_tex';
    const variant   = variantName ? product.variants?.find(v => v.variantName === variantName) : null;
    const costPrice = variant?.costPrice || product.costPrice || 0;
    await InventoryMovement.record({
      productId:     product._id,
      productName:   product.name_en || product.bundleName || product.name,
      variantName:   variantName || '',
      location,
      quantityChange: -quantity,
      currentStockBefore: stockBefore,
      movementType:  movementCtx.movementType,
      reason:        movementCtx.reason || '',
      sourceType:    movementCtx.sourceType || 'bazaar_sale',
      sourceId:      movementCtx.sourceId   || '',
      createdBy:     movementCtx.createdBy     || '',
      createdByRole: movementCtx.createdByRole || '',
      salePrice:     movementCtx.salePrice  || 0,
      costPrice,
    }, session);
  }
};

// Restore stock for one item (reverse of deductStock).
const restoreStock = async (product, variantName, stockField, quantity, session, movementCtx = {}) => {
  let stockBefore;
  if (variantName) {
    const variant = product.variants?.find(v => v.variantName === variantName);
    if (variant) {
      stockBefore = variant[stockField] || 0;
      variant[stockField] = stockBefore + quantity;
      if (stockField === 'stockOnline') {
        variant.stock = variant.stockOnline;
        syncLegacyOnlineStock(product);
      }
    } else {
      stockBefore = product[stockField] || 0;
      product[stockField] = stockBefore + quantity;
      if (stockField === 'stockOnline') syncLegacyOnlineStock(product);
    }
  } else {
    stockBefore = product[stockField] || 0;
    product[stockField] = stockBefore + quantity;
    if (stockField === 'stockOnline') syncLegacyOnlineStock(product);
  }
  await product.save({ session });

  if (movementCtx.movementType) {
    const location = stockField === 'stockOnline' ? 'online' : stockField === 'stockSabeel' ? 'sabeel' : 'clouds_tex';
    const variant   = variantName ? product.variants?.find(v => v.variantName === variantName) : null;
    const costPrice = variant?.costPrice || product.costPrice || 0;
    await InventoryMovement.record({
      productId:     product._id,
      productName:   product.name_en || product.bundleName || product.name,
      variantName:   variantName || '',
      location,
      quantityChange: quantity,
      currentStockBefore: stockBefore,
      movementType:  movementCtx.movementType,
      reason:        movementCtx.reason || '',
      sourceType:    movementCtx.sourceType || 'bazaar_sale',
      sourceId:      movementCtx.sourceId   || '',
      createdBy:     movementCtx.createdBy     || '',
      createdByRole: movementCtx.createdByRole || '',
      salePrice:     0,
      costPrice,
    }, session);
  }
};

// Check if the one-hour edit window is still open for a sale.
// Admin bypasses the window. Employees are restricted.
const isEditWindowOpen = (sale, user, windowSeconds = DEFAULT_EDIT_WINDOW_SECONDS) => {
  if (isAdminUser(user)) return true;
  const createdAt = new Date(sale.createdAt).getTime();
  const now       = Date.now();
  return (now - createdAt) <= windowSeconds * 1000;
};

// ── GET all bazaar sales ──────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = {};
    if (req.query.eventId) query.eventId = req.query.eventId;
    if (req.query.day)     query.bazaarDay = req.query.day;
    if (req.query.status)  query.status = req.query.status;
    // Employees only see their own store's sales
    if (!isAdminUser(req.user)) query.location = req.user.store;

    const sales = await Bazaarsale.find(query).sort({ createdAt: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET unique events list ────────────────────────────────────────────────────
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
          totalRevenue:  { $sum: { $cond: [{ $ne: ['$status', 'voided'] }, '$totalAmount', 0] } },
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
    // Exclude voided sales from revenue analytics
    const baseMatch = { status: { $ne: 'voided' } };
    if (req.query.eventId) baseMatch.eventId = req.query.eventId;
    const matchStage = { $match: baseMatch };

    const byDay = await Bazaarsale.aggregate([
      matchStage,
      { $group: {
          _id:       '$bazaarDay',
          revenue:   { $sum: '$totalAmount' },
          cash:      { $sum: { $cond: [{ $eq: ['$paymentMethod', 'Cash'] }, '$totalAmount', 0] } },
          instapay:  { $sum: { $cond: [{ $eq: ['$paymentMethod', 'InstaPay'] }, '$totalAmount', 0] } },
          sales:     { $sum: 1 },
          discounts: { $sum: '$orderDiscount' },
      }},
      { $sort: { _id: 1 } }
    ]);

    const topProducts = await Bazaarsale.aggregate([
      matchStage,
      { $unwind: '$items' },
      { $group: {
          _id:     '$items.productName',
          qty:     { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.salePrice', '$items.quantity'] } },
          gifts:   { $sum: { $cond: ['$items.isFreeGift', '$items.quantity', 0] } },
      }},
      { $sort: { revenue: -1 } },
      { $limit: 20 }
    ]);

    const totals = await Bazaarsale.aggregate([
      matchStage,
      { $group: {
          _id:       null,
          revenue:   { $sum: '$totalAmount' },
          cash:      { $sum: { $cond: [{ $eq: ['$paymentMethod', 'Cash'] }, '$totalAmount', 0] } },
          instapay:  { $sum: { $cond: [{ $eq: ['$paymentMethod', 'InstaPay'] }, '$totalAmount', 0] } },
          saleCount: { $sum: 1 },
          discounts: { $sum: '$orderDiscount' },
          gifts:     { $sum: { $reduce: { input: '$items', initialValue: 0,
            in: { $add: ['$$value', { $cond: ['$$this.isFreeGift', '$$this.quantity', 0] }] } } } },
          customers: { $addToSet: '$customerPhone' },
      }}
    ]);

    const t = totals[0] || {};
    res.json({
      byDay,
      topProducts: topProducts.map(p => ({ name: p._id, qty: p.qty, revenue: p.revenue, gifts: p.gifts })),
      totals: {
        revenue:         t.revenue    || 0,
        cash:            t.cash       || 0,
        instapay:        t.instapay   || 0,
        saleCount:       t.saleCount  || 0,
        discounts:       t.discounts  || 0,
        gifts:           t.gifts      || 0,
        uniqueCustomers: (t.customers || []).filter(Boolean).length,
      }
    });
  } catch (err) {
    console.error('Bazaar analytics error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST create a new sale ────────────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      eventId, eventName, eventLocation,
      customerName, customerPhone,
      items, orderDiscount, discountPct, paymentMethod, note,
      bazaarDay, startDate, endDate,
      location
    } = req.body;

    const finalLocation = isAdminUser(req.user) ? (location || 'bazaar') : req.user.store;
    if (!finalLocation) {
      await session.abortTransaction(); session.endSession();
      return res.status(403).json({ message: 'Store employee account is missing a store assignment.' });
    }

    if (!items || items.length === 0) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: 'No items in sale.' });
    }

    const stockField     = getStockField(finalLocation);
    const now            = new Date();
    const daysOfWeek     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const saleDate       = bazaarDay ? new Date(bazaarDay) : now;
    let subtotal         = 0;
    const finalItems     = [];
    const pendingSaleId  = new mongoose.Types.ObjectId(); // pre-generated so movement links to the sale

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`Product not found: ${item.productName}`);

      await deductStock(product, item.variantName, stockField, item.quantity, session, {
        movementType:  'sale',
        sourceType:    'bazaar_sale',
        sourceId:      pendingSaleId.toString(),
        createdBy:     req.user?.username || '',
        createdByRole: req.user?.role     || '',
        salePrice:     item.isFreeGift ? 0 : item.salePrice,
      });

      const lineTotal = item.isFreeGift ? 0 : item.salePrice * item.quantity;
      subtotal += lineTotal;
      finalItems.push({
        productId:     product._id,
        productName:   item.productName,
        variantName:   item.variantName   || '',
        originalPrice: item.originalPrice,
        salePrice:     item.isFreeGift ? 0 : item.salePrice,
        quantity:      item.quantity,
        isFreeGift:    item.isFreeGift    || false,
        itemNote:      item.itemNote      || '',
      });
    }

    const totalAmount = Math.max(0, subtotal - (orderDiscount || 0));

    const sale = new Bazaarsale({
      _id:           pendingSaleId,
      eventId:       eventId       || 'walkin',
      eventName:     eventName     || 'Bazaar Sale',
      eventLocation: eventLocation || 'On-site',
      customerName:  customerName  || 'Walk-in',
      customerPhone: customerPhone || '',
      items:         finalItems,
      subtotal,
      orderDiscount: orderDiscount || 0,
      discountPct:   discountPct   || 0,
      paymentMethod: paymentMethod || 'Cash',
      totalAmount,
      note:          note          || '',
      status:        'completed',
      bazaarDay:     saleDate.toISOString().split('T')[0],
      dayOfWeek:     daysOfWeek[saleDate.getDay()],
      dayOfMonth:    saleDate.getDate(),
      startDate:     startDate ? new Date(startDate) : null,
      endDate:       endDate   ? new Date(endDate)   : null,
      actualDate:    saleDate,
      location:      finalLocation,
      createdBy:     req.user?.username   || '',
      createdByRole: req.user?.role       || '',
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

// ── PUT edit an existing sale ─────────────────────────────────────────────────
// For employees: only within the one-hour window, only their own store.
// For admin: no time restriction.
router.put('/:id', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sale = await Bazaarsale.findById(req.params.id).session(session);
    if (!sale) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({ message: 'Sale not found.' });
    }
    if (sale.status === 'voided') {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: 'Voided sales cannot be edited.' });
    }
    if (!isAdminUser(req.user) && sale.location !== req.user.store) {
      await session.abortTransaction(); session.endSession();
      return res.status(403).json({ message: 'You can only edit sales for your own store.' });
    }
    if (!isEditWindowOpen(sale, req.user)) {
      await session.abortTransaction(); session.endSession();
      return res.status(403).json({
        message: 'Edit window has expired. Only admin can correct this sale.',
        expiredAt: new Date(new Date(sale.createdAt).getTime() + DEFAULT_EDIT_WINDOW_SECONDS * 1000),
      });
    }

    const { items, paymentMethod, actualDate, customerName, customerPhone, note, orderDiscount, discountPct } = req.body;
    const stockField = getStockField(sale.location || 'bazaar');

    // 1. Restore stock from old items
    for (const oldItem of sale.items) {
      const product = await Product.findById(oldItem.productId).session(session);
      if (!product) continue;
      await restoreStock(product, oldItem.variantName, stockField, oldItem.quantity, session, {
        movementType:  'sale_edit_restore',
        sourceType:    'bazaar_sale',
        sourceId:      sale._id.toString(),
        reason:        'Old quantity restored before edit',
        createdBy:     req.user?.username || '',
        createdByRole: req.user?.role     || '',
      });
    }

    // 2. Deduct stock for new items
    let newSubtotal = 0;
    const newItems  = [];
    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`Product not found: ${item.productName}`);
      await deductStock(product, item.variantName, stockField, item.quantity, session, {
        movementType:  'sale_edit_deduct',
        sourceType:    'bazaar_sale',
        sourceId:      sale._id.toString(),
        reason:        'New quantity deducted after edit',
        createdBy:     req.user?.username || '',
        createdByRole: req.user?.role     || '',
        salePrice:     item.isFreeGift ? 0 : item.salePrice,
      });
      const lineTotal = item.isFreeGift ? 0 : item.salePrice * item.quantity;
      newSubtotal += lineTotal;
      newItems.push(item);
    }

    const newTotal = Math.max(0, newSubtotal - (orderDiscount || 0));

    sale.items         = newItems;
    sale.subtotal      = newSubtotal;
    sale.totalAmount   = newTotal;
    sale.orderDiscount = orderDiscount || 0;
    sale.discountPct   = discountPct   || 0;
    sale.paymentMethod = paymentMethod || sale.paymentMethod;
    sale.note          = note          !== undefined ? note : sale.note;
    sale.customerName  = customerName  || sale.customerName;
    sale.customerPhone = customerPhone || sale.customerPhone;
    sale.status        = 'edited';
    sale.editedAt      = new Date();
    sale.editedBy      = req.user?.username || '';
    if (actualDate) {
      sale.actualDate = new Date(actualDate);
      sale.bazaarDay  = new Date(actualDate).toISOString().split('T')[0];
    }

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

// ── POST void a sale — restores stock, excluded from revenue totals ───────────
router.post('/:id/void', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sale = await Bazaarsale.findById(req.params.id).session(session);
    if (!sale) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({ message: 'Sale not found.' });
    }
    if (sale.status === 'voided') {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: 'Sale is already voided.' });
    }
    if (!isAdminUser(req.user) && sale.location !== req.user.store) {
      await session.abortTransaction(); session.endSession();
      return res.status(403).json({ message: 'You can only void sales for your own store.' });
    }
    if (!isEditWindowOpen(sale, req.user)) {
      await session.abortTransaction(); session.endSession();
      return res.status(403).json({
        message: 'Void window has expired. Only admin can void this sale.',
        expiredAt: new Date(new Date(sale.createdAt).getTime() + DEFAULT_EDIT_WINDOW_SECONDS * 1000),
      });
    }

    const stockField  = getStockField(sale.location || 'bazaar');
    const { reason }  = req.body;

    // Restore all stock
    for (const item of sale.items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) continue;
      await restoreStock(product, item.variantName, stockField, item.quantity, session, {
        movementType:  'sale_void_restore',
        sourceType:    'bazaar_sale',
        sourceId:      sale._id.toString(),
        reason:        reason || 'Sale voided',
        createdBy:     req.user?.username || '',
        createdByRole: req.user?.role     || '',
      });
    }

    sale.status     = 'voided';
    sale.voidedAt   = new Date();
    sale.voidedBy   = req.user?.username || '';
    sale.voidReason = reason || '';

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

// ── POST exchange — swap items, handle price difference ───────────────────────
// Returns old items → restores stock.
// Adds new items → deducts stock.
// Records additionalPayment if price difference exists.
router.post('/:id/exchange', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sale = await Bazaarsale.findById(req.params.id).session(session);
    if (!sale) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({ message: 'Sale not found.' });
    }
    if (sale.status === 'voided') {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: 'Cannot exchange a voided sale.' });
    }
    if (!isAdminUser(req.user) && sale.location !== req.user.store) {
      await session.abortTransaction(); session.endSession();
      return res.status(403).json({ message: 'You can only exchange sales for your own store.' });
    }
    if (!isEditWindowOpen(sale, req.user)) {
      await session.abortTransaction(); session.endSession();
      return res.status(403).json({
        message: 'Exchange window has expired. Only admin can process this exchange.',
        expiredAt: new Date(new Date(sale.createdAt).getTime() + DEFAULT_EDIT_WINDOW_SECONDS * 1000),
      });
    }

    const {
      returnedItems,      // items the customer is giving back
      newItems,           // items the customer is getting
      additionalPayment,  // { amount, method } — if new items cost more
      note,
    } = req.body;

    if (!returnedItems?.length && !newItems?.length) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: 'Exchange must have returned items or new items.' });
    }

    const stockField = getStockField(sale.location || 'bazaar');
    const remainingItems = sale.items.map(item => ({ ...(item.toObject?.() || item) }));

    // 1. Restore stock for returned items
    const finalReturnedItems = [];
    for (const item of (returnedItems || [])) {
      const returnQty = Number(item.quantity) || 0;
      if (returnQty <= 0) throw new Error('Returned quantity must be greater than zero.');

      const original = remainingItems.find(existing => itemKey(existing) === itemKey(item));
      if (!original) throw new Error(`Returned item was not found in the original sale: ${item.productName}`);
      if (returnQty > original.quantity) {
        throw new Error(`Cannot return ${returnQty} of ${item.productName}. Original remaining quantity is ${original.quantity}.`);
      }

      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`Returned product not found: ${item.productName}`);
      await restoreStock(product, item.variantName, stockField, returnQty, session, {
        movementType:  'exchange_return',
        sourceType:    'bazaar_sale',
        sourceId:      sale._id.toString(),
        reason:        'Customer returned item in exchange',
        createdBy:     req.user?.username || '',
        createdByRole: req.user?.role     || '',
      });
      original.quantity -= returnQty;
      finalReturnedItems.push({
        productId:   product._id,
        productName: item.productName,
        variantName: item.variantName || '',
        quantity:    returnQty,
        salePrice:   item.salePrice ?? original.salePrice,
      });
    }

    // 2. Deduct stock for new items
    let newSubtotal = 0;
    const finalNewItems = [];
    for (const item of (newItems || [])) {
      const addQty = Number(item.quantity) || 0;
      if (addQty <= 0) throw new Error('New item quantity must be greater than zero.');

      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`New product not found: ${item.productName}`);
      await deductStock(product, item.variantName, stockField, addQty, session, {
        movementType:  'exchange_deduct',
        sourceType:    'bazaar_sale',
        sourceId:      sale._id.toString(),
        reason:        'New item given in exchange',
        createdBy:     req.user?.username || '',
        createdByRole: req.user?.role     || '',
        salePrice:     item.isFreeGift ? 0 : item.salePrice,
      });
      const itemTotal = item.isFreeGift ? 0 : item.salePrice * addQty;
      newSubtotal += itemTotal;
      finalNewItems.push({
        productId:     product._id,
        productName:   item.productName,
        variantName:   item.variantName   || '',
        originalPrice: item.originalPrice || item.salePrice,
        salePrice:     item.isFreeGift ? 0 : item.salePrice,
        quantity:      addQty,
        isFreeGift:    item.isFreeGift    || false,
        itemNote:      item.itemNote      || '',
      });
    }

    // 3. Update sale — replace items with new items, record returned items
    const finalItems = mergeSaleItems([
      ...remainingItems.filter(item => item.quantity > 0),
      ...finalNewItems,
    ]);
    const finalSubtotal = finalItems.reduce((sum, item) => sum + lineTotal(item), 0);

    sale.items         = finalItems;
    sale.returnedItems = finalReturnedItems;
    sale.subtotal      = finalSubtotal;
    sale.totalAmount   = Math.max(0, finalSubtotal - (sale.orderDiscount || 0));
    sale.status        = 'exchanged';
    sale.editedAt      = new Date();
    sale.editedBy      = req.user?.username || '';
    if (note) sale.note = note;
    if (additionalPayment?.amount > 0) {
      sale.additionalPayment = {
        amount: additionalPayment.amount,
        method: additionalPayment.method || 'Cash',
        note:   additionalPayment.note   || '',
      };
    }

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

// ── GET edit window status for a sale (frontend uses this for countdown) ──────
// Returns secondsRemaining so the frontend can show a real-time countdown
// based on server time, not the device clock.
router.get('/:id/edit-window', authenticateToken, async (req, res) => {
  try {
    const sale = await Bazaarsale.findById(req.params.id).select('createdAt status location');
    if (!sale) return res.status(404).json({ message: 'Sale not found.' });

    if (isAdminUser(req.user)) {
      return res.json({ open: true, secondsRemaining: null, adminOverride: true });
    }
    if (sale.location !== req.user.store) {
      return res.status(403).json({ message: 'Not your store.' });
    }

    const elapsed          = (Date.now() - new Date(sale.createdAt).getTime()) / 1000;
    const secondsRemaining = Math.max(0, DEFAULT_EDIT_WINDOW_SECONDS - elapsed);
    const open             = secondsRemaining > 0 && sale.status !== 'voided';

    res.json({
      open,
      secondsRemaining: Math.floor(secondsRemaining),
      windowSeconds:    DEFAULT_EDIT_WINDOW_SECONDS,
      createdAt:        sale.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE — admin hard delete (no stock restore, use void instead) ───────────
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const sale = await Bazaarsale.findByIdAndDelete(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
