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
// ❤️ Health Check Route (Root Path)
// =============================
app.get("/", (req, res) => {
    res.send("Siraj backend is running 🚀");
});


// =========================================================================
// 🔥 FIX APPLIED: FRONTEND STATIC FILE SERVING (MIME Type Fix & Route Fix)
// 
// This block serves your HTML, CSS, and JS files. It must be AFTER 
// your specific API routes to ensure those are prioritized.
// *** Points to 'siraj-frontend' based on your folder structure.
// =========================================================================
const FRONTEND_BUILD_PATH = path.join(__dirname, 'siraj-frontend');
app.use(express.static(FRONTEND_BUILD_PATH));


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
