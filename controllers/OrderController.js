import Order from "../models/Order.js";

/**
 * Endpoint: POST /api/orders (Frontend checkout)
 */
export const createOrder = async (req, res) => {
    try {
        const { customerInfo, items, subtotal, shippingFee, totalAmount, paymentMethod } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: "No order items" });
        }
        if (!customerInfo || !customerInfo.name || !customerInfo.email || !customerInfo.phone || !customerInfo.address || !customerInfo.city) {
            return res.status(400).json({ message: "Missing required customer information" });
        }

        const order = new Order({
            customerInfo,
            items,
            subtotal,
            shippingFee,
            totalAmount,
            paymentMethod,
            status: 'Pending', // Explicitly set initial status
        });

        const createdOrder = await order.save();

        res.status(201).json({
            message: "Order created successfully",
            orderId: createdOrder._id
        });

    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: "Server error creating order", error: error.message });
    }
};


/**
 * Endpoint: GET /api/orders (Admin panel list)
 */
export const getAllOrders = async (req, res) => {
    try {
        // Fetch orders, sort by newest first
        const orders = await Order.find().sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Server error fetching orders", error: error.message });
    }
};


/**
 * Endpoint: GET /api/orders/:id (Admin panel view details)
 */
export const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        res.status(200).json(order);

    } catch (error) {
        console.error('Error fetching order by ID:', error);
        if (error.kind === 'ObjectId') {
             return res.status(400).json({ message: 'Invalid order ID format.' });
        }
        res.status(500).json({ message: 'Failed to fetch order details.', error: error.message });
    }
};


/**
 * Endpoint: PUT /api/orders/:id/status (Admin panel update status)
 */
export const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body; // Expecting { "status": "NewStatus" } in body
        const allowedStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        order.status = status;
        const updatedOrder = await order.save();

        res.status(200).json({
            message: 'Order status updated successfully!',
            order: updatedOrder
        });

    } catch (error) {
        console.error('Error updating order status:', error);
         if (error.kind === 'ObjectId') {
             return res.status(400).json({ message: 'Invalid order ID format.' });
        }
        res.status(500).json({ message: 'Failed to update order status.', error: error.message });
    }
};