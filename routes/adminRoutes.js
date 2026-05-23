import express from 'express';
import jwt from 'jsonwebtoken';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Bazaarsale from '../models/Bazaarsale.js';
import Review from '../models/Review.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Admin login ───────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ success: true, token, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// ── Verify token ──────────────────────────────────────────────────────────────
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ── Full Analytics endpoint ───────────────────────────────────────────────────
// Returns everything Analytics.jsx needs:
// Web orders, bazaar revenue, cash/instapay split,
// product performance, slow movers, review stats
router.get('/analytics', authenticateToken, async (req, res) => {
  try {

    // ── 1. Web orders ─────────────────────────────────────────────────────
    const totalOrders = await Order.countDocuments();

    const webRevenueResult = await Order.aggregate([
      { $match: { status: { $nin: ['cancelled', 'Cancelled'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const webRevenue = webRevenueResult[0]?.total || 0;

    const customersResult = await Order.aggregate([
      { $group: { _id: '$customerInfo.email' } },
      { $count: 'count' }
    ]);
    const totalCustomers = customersResult[0]?.count || 0;

    const conversionRate = totalOrders > 0 && totalCustomers > 0
      ? ((totalOrders / totalCustomers) * 100).toFixed(1)
      : 0;

    // ── 2. Products ───────────────────────────────────────────────────────
    const totalProducts = await Product.countDocuments({ status: 'Active' });

    // ── 3. Bazaar ─────────────────────────────────────────────────────────
    const bazaarOrdersCount = await Bazaarsale.countDocuments();

    const bazaarRevenueResult = await Bazaarsale.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const bazaarRevenue = bazaarRevenueResult[0]?.total || 0;

    // Cash vs InstaPay split across all bazaar sales
    const paymentSplit = await Bazaarsale.aggregate([
      { $group: { _id: '$paymentMethod', total: { $sum: '$totalAmount' } } }
    ]);
    const cashVault    = paymentSplit.find(v => v._id === 'Cash')?.total    || 0;
    const instapayVault = paymentSplit.find(v => v._id === 'InstaPay')?.total || 0;

    // ── 4. Reviews overview ───────────────────────────────────────────────
    const totalReviews = await Review.countDocuments();
    const ratingResult = await Review.aggregate([
      { $group: { _id: null, avg: { $avg: '$rating' } } }
    ]);
    const avgRating = ratingResult[0]?.avg || 0;

    // ── 5. Product velocity (web orders only — bazaar done client-side) ───
    // Top 5 most sold products by qty across web orders
    const topProductsResult = await Order.aggregate([
      { $unwind: '$items' },
      { $group: {
          _id: '$items.name',
          totalQty:     { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          lastSold:     { $max: '$createdAt' }
      }},
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    // Slow movers — active products with no sale in 30+ days
    const allActiveProducts = await Product.find({ status: 'Active' }).select('_id name name_en bundleName price_egp stock');
    const soldProductNames  = new Set(topProductsResult.map(p => p._id));

    // Build last-sold map from all orders
    const lastSoldMap = await Order.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.name', lastSold: { $max: '$createdAt' } } }
    ]);
    const lastSoldLookup = {};
    lastSoldMap.forEach(p => { lastSoldLookup[p._id] = p.lastSold; });

    const now    = new Date();
    const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const slowMovers = allActiveProducts
      .map(p => {
        const name     = p.name_en || p.bundleName || p.name;
        const lastSold = lastSoldLookup[name];
        const daysSince = lastSold
          ? Math.floor((now - new Date(lastSold)) / (1000 * 60 * 60 * 24))
          : null;
        return { name, price: p.price_egp, stock: p.stock, lastSold, daysSince, neverSold: !lastSold };
      })
      .filter(p => p.neverSold || (p.daysSince !== null && p.daysSince > 30))
      .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999))
      .slice(0, 20);

    // ── 6. Bazaar day-of-month & location stats ───────────────────────────
    const dayOfMonthStats = await Bazaarsale.aggregate([
      { $group: {
          _id:     '$dayOfMonth',
          revenue: { $sum: '$totalAmount' },
          sales:   { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    const locationStats = await Bazaarsale.aggregate([
      { $group: {
          _id:     '$eventLocation',
          revenue: { $sum: '$totalAmount' },
          sales:   { $sum: 1 }
      }},
      { $sort: { revenue: -1 } }
    ]);

    // ── Combined totals ───────────────────────────────────────────────────
    const totalRevenue = webRevenue + bazaarRevenue;
    const totalAllOrders = totalOrders + bazaarOrdersCount;

    res.json({
      // Combined
      totalOrders:      totalAllOrders,
      totalRevenue,
      totalProducts,
      totalCustomers,
      conversionRate:   parseFloat(conversionRate),
      abandonedCart:    0,

      // Split by channel
      webRevenue,
      webOrdersCount:   totalOrders,
      bazaarRevenue,
      bazaarOrdersCount,

      // Payment vault
      cashVault,
      instapayVault,

      // Reviews
      totalReviews,
      avgRating: parseFloat(avgRating.toFixed(2)),

      // Product insights
      topProducts:  topProductsResult.map(p => ({
        name:         p._id,
        totalQty:     p.totalQty,
        totalRevenue: p.totalRevenue,
        lastSold:     p.lastSold,
      })),
      slowMovers,

      // Bazaar insights
      dayOfMonthStats: dayOfMonthStats.map(d => ({ day: d._id, revenue: d.revenue, sales: d.sales })),
      locationStats:   locationStats.map(l => ({ location: l._id || 'Unknown', revenue: l.revenue, sales: l.sales })),
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.json({
      totalOrders: 0, totalRevenue: 0, totalProducts: 0, totalCustomers: 0,
      conversionRate: 0, abandonedCart: 0,
      webRevenue: 0, webOrdersCount: 0, bazaarRevenue: 0, bazaarOrdersCount: 0,
      cashVault: 0, instapayVault: 0,
      totalReviews: 0, avgRating: 0,
      topProducts: [], slowMovers: [], dayOfMonthStats: [], locationStats: [],
    });
  }
});

export default router;