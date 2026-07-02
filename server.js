import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import Product from './models/Product.js';
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import shippingRoutes from './routes/shippingRoutes.js';
import discountRoutes from './routes/discountRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import careRoutes from "./routes/careRoutes.js";
import uploadRoutes from './routes/uploadRoutes.js';
import heroRoutes from './routes/heroRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import HeroSettings from './models/HeroSettings.js';
import reviewRoutes from './routes/reviewRoutes.js';
import siteSettingsRoutes from './routes/siteSettingsRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import bazaarRoutes from './routes/bazaarRoutes.js';
import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import { requireAdmin } from './middleware/authMiddleware.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
// Module paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CLOUDINARY CONFIGURATION
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins = [
  "https://sirajcare.com",
  "https://www.sirajcare.com",
  "https://siraj-candles-website.netlify.app",
  "http://localhost:5173",
  "http://127.0.0.1:5500",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`❌ CORS Error: Origin ${origin} is not allowed.`);
        callback(new Error("Not allowed by CORS policy."));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

// Middleware
app.use(express.json());

// ============================================
// MONGODB MODELS (Add these before routes)
// ============================================

// Hero Settings Schema
//const heroSettingsSchema = new mongoose.Schema({
 // backgroundImage: { type: String, default: '' },
 // buttonText: { type: String, default: 'Shop Now' },
  //buttonLink: { type: String, default: '/products.html' },
 // title: { type: String, default: '' },
 // subtitle: { type: String, default: '' },
 // updatedAt: { type: Date, default: Date.now }
//});

//const HeroSettings = mongoose.model('HeroSettings', heroSettingsSchema);
//app.use('/api/upload', uploadRoutes);
// app.use('/api/settings/hero', heroRoutes);
// app.use('/api/admin', adminRoutes);
// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

// ============================================
// API ROUTES (Your existing routes)
// ============================================
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/care", careRoutes);
app.use('/api/shipping-rates', shippingRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/site-settings', siteSettingsRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/bazaar', bazaarRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/tracking', trackingRoutes);
// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.status(200).send('OK');
});

// ============================================
// NEW: UPLOAD ENDPOINT
// ============================================
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'siraj-candles',
          transformation: [
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    res.json({ 
      success: true, 
      imageUrl: result.secure_url 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// ============================================
// NEW: HERO SETTINGS ENDPOINTS
// ============================================
app.get('/api/settings/hero', async (req, res) => {
  try {
    let settings = await HeroSettings.findOne();
    if (!settings) {
      // Create default settings if none exist
      settings = await HeroSettings.create({
        backgroundImage: 'https://res.cloudinary.com/dvr195vfw/image/upload/f_auto,q_auto,w_1200/v1765150425/Your_paragraph_text_1_ck0hsl.png',
        buttonText: 'Shop Now',
        buttonLink: '/products.html',
        title: 'Illuminate Your Space',
        subtitle: 'Handcrafted Candles & Self-care Luxuries'
      });
      console.log('✅ Created default hero settings');
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching hero settings:', error);
    res.status(500).json({ error: 'Failed to fetch hero settings' });
  }
});

app.post('/api/settings/hero', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { backgroundImage, buttonText, buttonLink, title, subtitle } = req.body;
    
    let settings = await HeroSettings.findOne();
    if (settings) {
      // Update existing
      settings.backgroundImage = backgroundImage || settings.backgroundImage;
      settings.buttonText = buttonText || settings.buttonText;
      settings.buttonLink = buttonLink || settings.buttonLink;
      settings.title = title || settings.title;
      settings.subtitle = subtitle || settings.subtitle;
      settings.updatedAt = Date.now();
      await settings.save();
      console.log('✅ Hero settings updated');
    } else {
      // Create new
      settings = await HeroSettings.create({
        backgroundImage,
        buttonText,
        buttonLink,
        title,
        subtitle
      });
      console.log('✅ Hero settings created');
    }
    
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error saving hero settings:', error);
    res.status(500).json({ error: 'Failed to save hero settings' });
  }
});

// ============================================
// NEW: ADMIN AUTHENTICATION
// ============================================
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Check credentials against environment variables
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

app.get('/api/admin/verify', authenticateToken, (req, res) => {
  res.json({ 
    valid: true,
    user: req.user 
  });
});

/////////////csv import 


app.post('/api/products/bulk', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { products } = req.body;
        const results = [];
        for (const p of products) {
            const variants = p.variants ? p.variants.split('|').map(v => {
                const [variantName, price, stock] = v.trim().split(':');
                return { variantName: variantName?.trim(), variantType: 'scent', price: parseFloat(price) || 0, stock: parseInt(stock) || 0 };
            }) : [];

            const doc = {
                productType: p.productType || 'Single',
                name: p.name_en || p.bundleName,
                name_en: p.name_en || '',
                bundleName: p.bundleName || '',
                price: parseFloat(p.price_egp || p.bundlePrice) || 0,
                price_egp: parseFloat(p.price_egp || p.bundlePrice) || 0,
                bundlePrice: parseFloat(p.bundlePrice) || 0,
                bundleOriginalPrice: parseFloat(p.bundleOriginalPrice) || 0,
                category: p.category,
                subcategory: p.subcategory || '',
                stock: parseInt(p.stock) || 0,
                status: p.status || 'Active',
                featured: p.featured === 'true',
                description_en: p.description_en || '',
                bundleDescription: p.bundleDescription || '',
                scentOptions: p.scentOptions ? p.scentOptions.replace(/\|/g, ', ') : '',
                sizeOptions: p.sizeOptions ? p.sizeOptions.replace(/\|/g, ', ') : '',
                weightOptions: p.weightOptions ? p.weightOptions.replace(/\|/g, ', ') : '',
                imagePaths: [],
                variants: variants
            };
            const created = await Product.create(doc);
            results.push(created._id);
        }
        res.json({ success: true, created: results.length });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// ============================================
// NEW: ANALYTICS ENDPOINT
// ============================================
app.get('/api/admin/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const Order = mongoose.model('Order');
    const Product = mongoose.model('Product');
    const Bazaarsale = mongoose.model('Bazaarsale');
    
    // Web Order Calculations
    const webOrdersCount = await Order.countDocuments();
    const webRevenueResult = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const webRevenue = webRevenueResult[0]?.total || 0;

    // Bazaar System Aggregations
    const bazaarOrdersCount = await Bazaarsale.countDocuments();
    const bazaarRevenueResult = await Bazaarsale.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const bazaarRevenue = bazaarRevenueResult[0]?.total || 0;
    
    // Vault Split Cash vs InstaPay totals across all bazaar sessions
    const vaultSplit = await Bazaarsale.aggregate([
      { $group: { _id: "$paymentMethod", total: { $sum: "$totalAmount" } } }
    ]);
    
    const cashVault = vaultSplit.find(v => v._id === 'Cash')?.total || 0;
    const instapayVault = vaultSplit.find(v => v._id === 'InstaPay')?.total || 0;

    const totalOrders = webOrdersCount + bazaarOrdersCount;
    const totalRevenue = webRevenue + bazaarRevenue;
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
      abandonedCart: 0,
      bazaarRevenue,
      webRevenue,
      cashVault,
      instapayVault
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.json({
      totalOrders: 0, totalRevenue: 0, totalProducts: 0, totalCustomers: 0, conversionRate: 0, abandonedCart: 0,
      bazaarRevenue: 0, webRevenue: 0, cashVault: 0, instapayVault: 0
    });
  }
});

// ============================================
// ROOT ROUTE
// ============================================
app.get("/", (req, res) => {
  res.send("Siraj backend is running 🚀");
});

// ============================================
// MONGODB CONNECTION & SERVER START
// ============================================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    app.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// Graceful shutdown for Render
process.on("SIGTERM", async () => {
  console.log("🧹 Shutting down gracefully...");
  await mongoose.connection.close();
  console.log("💾 MongoDB connection closed.");
  process.exit(0);
});
