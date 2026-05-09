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

// GET /api/orders/track/:phone - Public order tracking by phone
router.get('/track/:phone', async (req, res) => {
    try {
        const phone = req.params.phone.trim();
        const orders = await Order.find({ 'customerInfo.phone': phone })
            .sort({ createdAt: -1 })
            .select('_id status totalAmount createdAt items shippingFee customerInfo.name');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch orders.' });
    }
});
// GET /api/orders/:id - Get a single order by ID (for admin)
router.get("/:id", getOrderById);

// PUT /api/orders/:id/status - Update order status (for admin)
router.put("/:id/status", updateOrderStatus);
// GET /api/orders/track/:phone - Track orders by phone (public)


export default router;