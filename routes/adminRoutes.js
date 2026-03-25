import express from 'express';
import jwt from 'jsonwebtoken';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Admin login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign(
      { username, role: 'admin' }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    res.json({ 
      success: true, 
      token,
      message: 'Login successful' 
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid username or password' 
    });
  }
});

// Verify token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ 
    valid: true,
    user: req.user 
  });
});

// Analytics endpoint
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    
    const revenueResult = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;
    
    const totalProducts = await Product.countDocuments();
    
    const customersResult = await Order.aggregate([
      { $group: { _id: '$customerInfo.email' } },
      { $count: 'count' }
    ]);
    const totalCustomers = customersResult[0]?.count || 0;
    
    const conversionRate = totalOrders > 0 && totalCustomers > 0 
      ? ((totalOrders / totalCustomers) * 100).toFixed(1) 
      : 0;
    
    res.json({
      totalOrders,
      totalRevenue,
      totalProducts,
      totalCustomers,
      conversionRate: parseFloat(conversionRate),
      abandonedCart: 0
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.json({
      totalOrders: 0,
      totalRevenue: 0,
      totalProducts: 0,
      totalCustomers: 0,
      conversionRate: 0,
      abandonedCart: 0
    });
  }
});

export default router;