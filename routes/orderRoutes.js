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
// GET /api/orders/track/:phone - Track orders by phone (public)
router.get("/track/:phone", async (req, res) => {
    try {
        const orders = await import('../models/Order.js').then(m => m.default.find({ 
            "customerInfo.phone": req.params.phone 
        }).sort({ createdAt: -1 }));
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Error tracking orders" });
    }
});
export default router;