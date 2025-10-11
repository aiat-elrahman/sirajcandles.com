import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Import your route files
import productRoutes from "./routes/productRoutes.js";
import bundleRoutes from "./routes/bundleRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// =============================
// ⚙️ PATH SETUP (Required for ES Modules)
// =============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================
// 🧩 CORS Configuration (Confirmed)
// =============================
const allowedOrigins = [
  "https://siraj-frontend.onrender.com", // ✅ Your Deployed Render Frontend
  "http://localhost:5173", // For local development testing
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`❌ CORS Error: Origin ${origin} is not allowed.`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Middleware
app.use(express.json());

// =========================================================================
// 🔥 FIX APPLIED: FRONTEND STATIC FILE SERVING (MIME Type Fix)
// 
// This block serves your HTML, CSS, and JS files and sets the correct 
// MIME types (e.g., 'text/css' for stylesheets).
// 
// *** CRUCIAL CHANGE: Now points to 'siraj-frontend' as per your confirmation.
// =========================================================================
const FRONTEND_BUILD_PATH = path.join(__dirname, 'siraj-frontend'); // <-- CHANGED HERE
app.use(express.static(FRONTEND_BUILD_PATH));

// =============================
// 📂 Serve Static Uploads (Backend Images)
// =============================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =============================
// 🛠 API Routes
// =============================
app.use("/api/products", productRoutes);
app.use("/api/bundles", bundleRoutes);

// =============================
// ❤️ Health Check Route & Frontend Fallback
// =============================
// Serve the main index.html for all non-API and non-static file requests (SPA fallback)
app.get("*", (req, res) => {
    // Keep the root route for health check, but serve index.html otherwise
    if (req.path === '/') {
        res.send("Siraj backend is running 🚀");
    } else {
        // This serves the frontend index.html for client-side routing
        // This assumes index.html is directly inside the 'siraj-frontend' folder
        res.sendFile(path.join(FRONTEND_BUILD_PATH, 'index.html'));
    }
});


// =============================
// ⚙️ Database Connection
// =============================
mongoose
  .connect(process.env.MONGO_URI, {
    // Options removed as per Mongoose best practices
  })
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
