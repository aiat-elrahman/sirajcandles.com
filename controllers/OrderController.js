import Order from "../models/Order.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";

/**
 * Endpoint: POST /api/orders (Frontend checkout)
 */
export const createOrder = async (req, res) => {
    // Start a transaction session to ensure data integrity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { customerInfo, items, subtotal, shippingFee, totalAmount, paymentMethod } = req.body;

        // 1. Basic Validation
        if (!items || items.length === 0) {
            return res.status(400).json({ message: "No order items" });
        }
        if (!customerInfo || !customerInfo.name || !customerInfo.email || !customerInfo.phone || !customerInfo.address || !customerInfo.city) {
            return res.status(400).json({ message: "Missing required customer information" });
        }

        // 2. Stock Deduction Logic
        for (const item of items) {
            if (!item.productId) {
                throw new Error(`Product ID is missing for item: ${item.name}`);
            }

            // Find the product and lock it for this transaction
            const product = await Product.findById(item.productId).session(session);

            if (!product) {
                throw new Error(`Product not found in database: ${item.name}`);
            }

            // --- A. Variant Stock Deduction (Priority) ---
            if (item.variantName) {
                // Find the specific variant (e.g., "100g", "Red") inside the product
                const variant = product.variants.find(v => v.variantName === item.variantName);

                if (!variant) {
                    throw new Error(`Variant '${item.variantName}' not found for product '${item.name}'`);
                }

                // Check Variant Stock
                if (variant.stock < item.quantity) {
                    throw new Error(`Not enough stock for ${item.name} (${item.variantName}). Available: ${variant.stock}, Requested: ${item.quantity}`);
                }

                // Deduct Variant Stock
                variant.stock -= item.quantity;
            }

            // --- B. Main Stock Deduction (Fallback/Total) ---
            // We also check/deduct the main stock count to keep the "total inventory" accurate
            if (product.stock < item.quantity) {
                throw new Error(`Not enough total stock for: ${item.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
            }

            product.stock -= item.quantity;

            // Save the product updates within the transaction
            await product.save({ session });
        }

        // 3. Create the Order
        const order = new Order({
            customerInfo,
            items,
            subtotal,
            shippingFee,
            totalAmount,
            paymentMethod,
            status: 'Pending', // Default status
        });

        const createdOrder = await order.save({ session });

        // 4. Commit Transaction (Everything succeeded)
        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            message: "Order created successfully",
            orderId: createdOrder._id
        });

    } catch (error) {
        // 5. Abort Transaction (Something failed, roll back all changes)
        await session.abortTransaction();
        session.endSession();

        console.error("Error creating order:", error);
        res.status(500).json({ 
            message: error.message || "Server error creating order" 
        });
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