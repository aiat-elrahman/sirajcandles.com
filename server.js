import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Import the router using the correct, lowercase filename
import productRoutes from "./routes/productRoutes.js"; 

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Setup ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🧩 CORS Configuration (Kept from your original file)
const allowedOrigins = [
  "https://siraj-candles-website.netlify.app", 
  "http://localhost:5173", 
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`❌ CORS Error: Origin ${origin} is not allowed.`);
        // For security, do not expose the internal error message to the client
        callback(new Error("Not allowed by CORS policy.")); 
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Middleware
app.use(express.json());

// Serving static files (Kept for compatibility, though Cloudinary is used for products)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Routes
// Note: Only using productRoutes now, as it handles both Products and Bundles
app.use("/api/products", productRoutes);

// route path
app.get("/", (req, res) => {
    res.send("Siraj backend is running 🚀");
});

// Serve frontend build static assets (assuming 'siraj-frontend' is at the root)
const FRONTEND_BUILD_PATH = path.join(__dirname, 'siraj-frontend');
app.use(express.static(FRONTEND_BUILD_PATH));

// Database 
mongoose
  .connect(process.env.MONGO_URI) // Removed obsolete options
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
