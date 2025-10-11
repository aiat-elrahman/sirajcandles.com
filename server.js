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
// 🧩 CORS Configuration (Confirmed)
// This list explicitly allows your deployed frontend URL.
// =============================
const allowedOrigins = [
  "https://siraj-frontend.onrender.com", // ✅ Your Deployed Render Frontend
  "http://localhost:5173", // For local development testing
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like health checks or cURL)
      // or if the origin is in our allowed list
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // If an unauthorized domain tries to access, log the error
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
// 📂 Serve Static Uploads
// =============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =============================
// 🛠 API Routes
// =============================
// Note: Frontend calls will look like: https://siraj-backend.onrender.com/api/products/...
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
    // The following options are deprecated in recent Mongoose versions,
    // but often included for compatibility.
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
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
