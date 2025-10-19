import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Import 
import productRoutes from "./routes/productRoutes.js";
import bundleRoutes from "./routes/bundleRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// 🧩 CORS Configuration 

const allowedOrigins = [
  "https://siraj-candles-website.netlify.app/", 
  "http://localhost:5173", 
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


app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// API Routes

app.use("/api/products", productRoutes);
app.use("/api/bundles", bundleRoutes);

// route path
app.get("/", (req, res) => {
    res.send("Siraj backend is running 🚀");
});



const FRONTEND_BUILD_PATH = path.join(__dirname, 'siraj-frontend');
app.use(express.static(FRONTEND_BUILD_PATH));



//Database 
mongoose
  .connect(process.env.MONGO_URI, {
    
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
