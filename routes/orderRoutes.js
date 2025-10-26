import express from "express";
import {
    createOrder,
    getAllOrders,      // <-- Import new function
    getOrderById,      // <-- Import new function
    updateOrderStatus  // <-- Import new function
} from "../controllers/OrderController.js";

const router = express.Router();

// POST /api/orders - Create a new order (from frontend checkout)
router.post("/", createOrder);

// GET /api/orders - Get all orders (for admin)
router.get("/", getAllOrders);

// GET /api/orders/:id - Get a single order by ID (for admin)
router.get("/:id", getOrderById);

// PUT /api/orders/:id/status - Update order status (for admin)
router.put("/:id/status", updateOrderStatus);

export default router;