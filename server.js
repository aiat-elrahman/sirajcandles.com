import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import productRoutes from "./routes/productRoutes.js";
import bundleRoutes from "./routes/bundleRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// =============================
// 🧩 CORS Configuration
// =============================
const allowedOrigins = [
  "https://siraj-frontend.onrender.com", // ✅ your Render frontend
  "http://localhost:5173", // for local testing (optional)
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
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
// 📂 Serve Static Uploads
// =============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =============================
// 🛠 API Routes
// =============================
app.use("/api/products", productRoutes);
app.use("/api/bundles", bundleRoutes);

// =============================
// ❤️ Health Check Route
// =============================
app.get("/", (req, res) => {
  res.send("Siraj backend is running 🚀");
});

// =============================
// ⚙️ Database Connection
// =============================
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
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
