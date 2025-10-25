// Create this new file: routes/orderRoutes.js
import express from "express";
import { createOrder } from "../controllers/OrderController.js";

const router = express.Router();

// This will match POST requests to /api/orders/
router.post("/", createOrder);

export default router;