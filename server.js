import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
// --- NEW ---
import shippingRoutes from './routes/shippingRoutes.js';
import discountRoutes from './routes/discountRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import careRoutes from "./routes/careRoutes.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

//  Module 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🧩 Updated CORS Configuration
const allowedOrigins = [
  "https://sirajcare.com",         // ✅ live domain
  "https://www.sirajcare.com",       // ✅  www version 
  "https://siraj-candles-website.netlify.app", // Netlify preview domain 
  "http://localhost:5173", // Your local admin app
  "http://127.0.0.1:5500" 
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow mobile apps\ Postman
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`❌ CORS Error: Origin ${origin} is not allowed.`);
        callback(new Error("Not allowed by CORS policy."));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Middleware
app.use(express.json());

// API Routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
// --- NEW ---


app.use("/api/care", careRoutes);
app.use('/api/shipping-rates', shippingRoutes); // Frontend expects /api/shipping-rates
app.use('/api/discounts', discountRoutes);
app.use('/api/categories', categoryRoutes);
// Root route
app.get("/", (req, res) => {
  res.send("Siraj backend is running 🚀");
});

// MongoDB connection
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

// shutdown for Render
process.on("SIGTERM", () => {
  console.log("🧹 Shutting down gracefully...");
  mongoose.connection.close(false, () => {
    console.log("💾 MongoDB connection closed.");
    process.exit(0);
  });
});``