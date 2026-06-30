import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Discount from "../models/Discount.js";
import InventoryMovement from "../models/InventoryMovement.js";

// --- 1. CREATE ORDER (User Side) ---
export const createOrder = async (req, res) => {
    try {
        console.log("--- INCOMING ORDER REQUEST ---", req.body);
        const { customerInfo, items, paymentMethod, discountCode, discountAmount, shippingFee } = req.body;

        if (!items || items.length === 0) {
            console.error("Order failed: No items provided");
            return res.status(400).json({ message: "No order items provided" });
        }

        let calculatedSubtotal = 0;
        const finalItems = [];
        const pendingOrderId = new mongoose.Types.ObjectId(); // pre-generated so movement links to the order

        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                console.error(`Order failed: Product not found (${item.name})`);
                return res.status(404).json({ message: `Product not found: ${item.name}` });
            }

            let priceToUse = product.price_egp;
            let variantFound = false;

            // --- Variant Logic ---
            if (item.variantName) {
                const variant = product.variants.find(v => v.variantName === item.variantName);
                if (variant) {
                    // Use stockOnline for online orders (fallback to stock if not set)
                    const stockAvailable = variant.stockOnline !== undefined ? variant.stockOnline : variant.stock;
                    if (stockAvailable < item.quantity) {
                        throw new Error(`Insufficient stock for ${product.name} (${item.variantName}).`);
                    }
                    // Deduct from stockOnline (or stock if stockOnline not set)
                    if (variant.stockOnline !== undefined) {
                        variant.stockOnline -= item.quantity;
                    } else {
                        variant.stock -= item.quantity;
                    }
                    // Keep legacy stock synced for backward compatibility
                    variant.stock = variant.stockOnline !== undefined ? variant.stockOnline : variant.stock;
                    priceToUse = variant.price;
                    variantFound = true;
                    // Also sync main stock so listing page reflects reality
                    product.stock = product.variants.reduce((sum, v) => sum + (v.stockOnline !== undefined ? v.stockOnline : v.stock), 0);

                    // Record inventory movement for this variant deduction
                    await InventoryMovement.record({
                        productId:     product._id,
                        productName:   product.name_en || product.bundleName || product.name,
                        variantName:   item.variantName,
                        location:      'online',
                        quantityChange: -item.quantity,
                        currentStockBefore: stockAvailable,
                        movementType:  'web_order',
                        sourceType:    'web_order',
                        sourceId:      pendingOrderId.toString(),
                        createdBy:     'website',
                        createdByRole: 'customer',
                        salePrice:     variant.price,
                        costPrice:     variant.costPrice || product.costPrice || 0,
                    });
                }
            }

            // --- Main Stock Logic (no variant) ---
            if (!variantFound) {
                const stockAvailable = product.stockOnline !== undefined ? product.stockOnline : product.stock;
                if (stockAvailable < item.quantity) {
                    console.error(`Order failed: Insufficient stock for product ${product.name}`);
                    return res.status(400).json({ message: `Insufficient stock for ${product.name}.` });
                }
                if (product.stockOnline !== undefined) {
                    product.stockOnline -= item.quantity;
                } else {
                    product.stock -= item.quantity;
                }
                product.stock = product.stockOnline !== undefined ? product.stockOnline : product.stock;

                // Record inventory movement for this product deduction
                await InventoryMovement.record({
                    productId:     product._id,
                    productName:   product.name_en || product.bundleName || product.name,
                    variantName:   '',
                    location:      'online',
                    quantityChange: -item.quantity,
                    currentStockBefore: stockAvailable,
                    movementType:  'web_order',
                    sourceType:    'web_order',
                    sourceId:      pendingOrderId.toString(),
                    createdBy:     'website',
                    createdByRole: 'customer',
                    salePrice:     priceToUse,
                    costPrice:     product.costPrice || 0,
                });
            }

            await product.save();
            calculatedSubtotal += priceToUse * item.quantity;

            // --- Deduct Inventory from Linked Bundle Items ---
            if (product.productType === 'Bundle' && product.bundleItems && product.bundleItems.length > 0) {
                for (const bItem of product.bundleItems) {
                    if (bItem.linkedProductId) {
                        const linkedProd = await Product.findById(bItem.linkedProductId);
                        if (linkedProd) {
                            let linkedVariantDeducted = false;
                            if (item.customization && item.customization.length > 0) {
                                for (const custString of item.customization) {
                                    for (const v of linkedProd.variants) {
                                        if (custString.includes(v.variantName)) {
                                            const linkedStock = v.stockOnline !== undefined ? v.stockOnline : v.stock;
                                            if (linkedStock >= item.quantity) {
                                                if (v.stockOnline !== undefined) v.stockOnline -= item.quantity;
                                                else v.stock -= item.quantity;
                                                if (v.stockOnline !== undefined) v.stock = v.stockOnline;
                                                linkedVariantDeducted = true;

                                                await InventoryMovement.record({
                                                    productId:     linkedProd._id,
                                                    productName:   linkedProd.name_en || linkedProd.bundleName || linkedProd.name,
                                                    variantName:   v.variantName,
                                                    location:      'online',
                                                    quantityChange: -item.quantity,
                                                    currentStockBefore: linkedStock,
                                                    movementType:  'web_order',
                                                    sourceType:    'web_order',
                                                    sourceId:      pendingOrderId.toString(),
                                                    reason:        `Bundle component: ${bItem.subProductName}`,
                                                    createdBy:     'website',
                                                    createdByRole: 'customer',
                                                    salePrice:     0, // bundle component — no individual sale price
                                                    costPrice:     v.costPrice || linkedProd.costPrice || 0,
                                                });

                                                break;
                                            }
                                        }
                                    }
                                    if (linkedVariantDeducted) break;
                                }
                            }
                            if (!linkedVariantDeducted) {
                                const linkedStock = linkedProd.stockOnline !== undefined ? linkedProd.stockOnline : linkedProd.stock;
                                if (linkedStock >= item.quantity) {
                                    if (linkedProd.stockOnline !== undefined) linkedProd.stockOnline -= item.quantity;
                                    else linkedProd.stock -= item.quantity;
                                    linkedProd.stock = linkedProd.stockOnline !== undefined ? linkedProd.stockOnline : linkedProd.stock;

                                    await InventoryMovement.record({
                                        productId:     linkedProd._id,
                                        productName:   linkedProd.name_en || linkedProd.bundleName || linkedProd.name,
                                        variantName:   '',
                                        location:      'online',
                                        quantityChange: -item.quantity,
                                        currentStockBefore: linkedStock,
                                        movementType:  'web_order',
                                        sourceType:    'web_order',
                                        sourceId:      pendingOrderId.toString(),
                                        reason:        `Bundle component: ${bItem.subProductName}`,
                                        createdBy:     'website',
                                        createdByRole: 'customer',
                                        salePrice:     0,
                                        costPrice:     linkedProd.costPrice || 0,
                                    });
                                } else {
                                    throw new Error(`Insufficient stock for bundle item ${bItem.subProductName}`);
                                }
                            }
                            await linkedProd.save();
                        }
                    }
                }
            }

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

        // --- Shipping & Discount Enforcement ---
        let finalShippingFee = 0;
        if (calculatedSubtotal >= 2000) {
            finalShippingFee = 0;
        } else {
            finalShippingFee = Number(shippingFee) || 50;
        }
        
        const finalDiscountAmount = Number(discountAmount) || 0;
        const totalAmount = Math.max(0, calculatedSubtotal + finalShippingFee - finalDiscountAmount);

        console.log("Saving order to DB...");
        const order = new Order({
            _id: pendingOrderId,
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

        const createdOrder = await order.save();
        console.log("✅ ORDER SAVED SUCCESSFULLY! ID:", createdOrder._id);

        res.status(201).json({ message: "Order created successfully", orderId: createdOrder._id });

    } catch (error) {
        console.error("❌ CRITICAL ORDER ERROR:", error);
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