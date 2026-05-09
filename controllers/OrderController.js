import Order from "../models/Order.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";
import Discount from "../models/Discount.js"; // Added missing import

// --- 1. CREATE ORDER (User Side) ---
// --- 1. CREATE ORDER (User Side) ---
// --- 1. CREATE ORDER (User Side) ---
export const createOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { customerInfo, items, paymentMethod, discountCode, discountAmount, shippingFee } = req.body;

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
                    priceToUse = variant.price; 
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

            // --- NEW: Deduct Inventory from Linked Bundle Items ---
            if (product.productType === 'Bundle' && product.bundleItems && product.bundleItems.length > 0) {
                for (const bItem of product.bundleItems) {
                    if (bItem.linkedProductId) {
                        const linkedProd = await Product.findById(bItem.linkedProductId).session(session);
                        if (linkedProd) {
                            let linkedVariantDeducted = false;
                            
                            // Try to match the customer's chosen customization scent to a linked product variant
                            if (item.customization && item.customization.length > 0) {
                                for (const custString of item.customization) {
                                    for (const v of linkedProd.variants) {
                                        if (custString.includes(v.variantName) && v.stock >= item.quantity) {
                                            v.stock -= item.quantity;
                                            linkedVariantDeducted = true;
                                            break;
                                        }
                                    }
                                    if (linkedVariantDeducted) break;
                                }
                            }
                            
                            // Fallback: Deduct from the main linked product stock
                            if (!linkedVariantDeducted) {
                                linkedProd.stock -= item.quantity;
                            }
                            await linkedProd.save({ session });
                        }
                    }
                }
            }
            // ------------------------------------------------------

            const chosenVariant = item.variantName || item.variant || item.scent || item.selectedVariant || item.selectedScent || null;

            finalItems.push({
                productId: product._id,
                name: product.productType === 'Bundle' ? product.bundleName : product.name_en,
                quantity: item.quantity,
                price: priceToUse,
                variantName: chosenVariant,
                customization: item.customization || []
            });
        }

        const finalShippingFee = Number(shippingFee) || 0;
        const finalDiscountAmount = Number(discountAmount) || 0;
        const totalAmount = Math.max(0, calculatedSubtotal + finalShippingFee - finalDiscountAmount);

        const order = new Order({
            customerInfo,
            items: finalItems,
            subtotal: calculatedSubtotal,
            shippingFee: finalShippingFee,
            discountAmount: finalDiscountAmount,
            discountCode: discountCode || null,
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