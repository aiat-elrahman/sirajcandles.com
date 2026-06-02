import express from "express";
import {
    createOrder,
    getAllOrders,      // <-- Import new function
    getOrderById,      // <-- Import new function
    updateOrderStatus  // <-- Import new function
} from "../controllers/OrderController.js";
import Order from "../models/Order.js";
import { authenticateToken, requireAdmin } from "../middleware/authMiddleware.js";
const router = express.Router();

// POST /api/orders - Create a new order (from frontend checkout)
router.post("/", createOrder);

// GET /api/orders - Get all orders (for admin)
router.get("/", authenticateToken, requireAdmin, getAllOrders);

// GET /api/orders/track/:phone - Public order tracking by phone
router.get('/track/:phone', async (req, res) => {
    try {
        // Normalize: strip +, spaces, dashes so 01012345678 and +201012345678 both work
        const raw = decodeURIComponent(req.params.phone).trim();
        const normalized = raw.replace(/[\s\-\+]/g, '');

        // Build variants to search: local (01...) and international (201...)
        const variants = [
            normalized,
            normalized.startsWith('2') ? normalized.slice(1) : '0' + normalized,
            '+' + normalized
        ];

        const orders = await Order.find({
            'customerInfo.phone': { $in: variants.map(v => new RegExp(v.replace(/\+/g, '\\+'), 'i')) }
        })
        .sort({ createdAt: -1 })
        .select('_id status totalAmount createdAt items shippingFee customerInfo');

        res.json(orders);
    } catch (error) {
        console.error('Tracking error:', error);
        res.status(500).json({ message: 'Failed to fetch orders.' });
    }
});
// GET /api/orders/:id - Get a single order by ID (for admin)
router.get("/:id", authenticateToken, requireAdmin, getOrderById);

// PUT /api/orders/:id/status - Update order status (for admin)
router.put("/:id/status", authenticateToken, requireAdmin, updateOrderStatus);
// GET /api/orders/track/:phone - Track orders by phone (public)


export default router;
