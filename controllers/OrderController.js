import Order from "../models/Order.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";
import Discount from "../models/Discount.js"; // Added missing import

// --- 1. CREATE ORDER (User Side) ---
export const createOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Extract shippingFee from frontend
        const { customerInfo, items, paymentMethod, discountCode, shippingFee } = req.body;

        if (!items || items.length === 0) throw new Error("No order items provided");

        let calculatedSubtotal = 0;
        const finalItems = [];

        for (const item of items) {
            const product = await Product.findById(item.productId).session(session);
            if (!product) throw new Error(`Product not found: ${item.name}`);

            let priceToUse = product.price_egp;
            let variantFound = false;

            // --- Variant Logic ---
            if (item.variantName) {
                const variant = product.variants.find(v => v.variantName === item.variantName);
                if (variant) {
                    if (variant.stock < item.quantity) {
                        throw new Error(`Insufficient stock for ${product.name} (${item.variantName}).`);
                    }
                    variant.stock -= item.quantity;
                    priceToUse = variant.price; // Use SERVER price
                    variantFound = true;
                }
            }

            // --- Main Stock Logic ---
            if (!variantFound) {
                if (product.stock < item.quantity) {
                    throw new Error(`Insufficient stock for ${product.name}.`);
                }
                product.stock -= item.quantity;
            }

            await product.save({ session });
            calculatedSubtotal += priceToUse * item.quantity;

            finalItems.push({
                productId: product._id,
                name: product.productType === 'Bundle' ? product.bundleName : product.name_en,
                quantity: item.quantity,
                price: priceToUse,
                variantName: item.variantName || null,
                customization: item.customization || []
            });
        }

        // --- Shipping Logic (Dynamic) ---
        // If subtotal > 2000, free shipping. Otherwise use city rate (or default 50)
        let finalShippingFee = 0;
        if (calculatedSubtotal >= 2000) {
            finalShippingFee = 0;
        } else {
            finalShippingFee = Number(shippingFee) || 50;
        }

        // --- Discount Logic ---
        let discountAmount = 0;
        if (discountCode) {
            const discount = await Discount.findOne({ code: discountCode.toUpperCase(), status: 'active' }).session(session);
            if (discount) {
                discountAmount = discount.type === 'percentage' 
                    ? calculatedSubtotal * (discount.value / 100) 
                    : discount.value;
            }
        }

        const totalAmount = Math.max(0, calculatedSubtotal + finalShippingFee - discountAmount);

        const order = new Order({
            customerInfo,
            items: finalItems,
            subtotal: calculatedSubtotal,
            shippingFee: finalShippingFee,
            totalAmount,
            paymentMethod,
            status: 'Pending',
        });

        const createdOrder = await order.save({ session });
        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ message: "Order created successfully", orderId: createdOrder._id });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Order Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// --- 2. GET ALL ORDERS (Admin Side) ---
export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Server error fetching orders", error: error.message });
    }
};

// --- 3. GET ORDER BY ID (Admin Side) ---
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

// --- 4. UPDATE STATUS (Admin Side) ---
export const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
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