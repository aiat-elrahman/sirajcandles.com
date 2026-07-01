import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Discount from "../models/Discount.js";
import nodemailer from "nodemailer";

// ── Notification helpers ──────────────────────────────────────────────────────

// Build a readable order summary used in both Telegram and Email
const buildOrderSummary = (order) => {
  const { customerInfo, items, totalAmount, shippingFee, discountAmount, discountCode, paymentMethod } = order;

  const itemLines = items.map(i =>
    `  • ${i.name}${i.variantName ? ` (${i.variantName})` : ''} × ${i.quantity} — ${(i.price * i.quantity).toFixed(2)} EGP`
  ).join('\n');

  return {
    customerName:  customerInfo?.name  || 'Unknown',
    customerPhone: customerInfo?.phone || '—',
    customerCity:  customerInfo?.city  || '—',
    itemLines,
    total:         totalAmount?.toFixed(2)    || '0.00',
    shipping:      shippingFee?.toFixed(2)    || '0.00',
    discount:      discountAmount?.toFixed(2) || '0.00',
    discountCode:  discountCode || null,
    payment:       paymentMethod || 'COD',
    orderId:       order._id?.toString().slice(-8).toUpperCase(),
  };
};

// Send Telegram notification to the orders group
const sendTelegramNotification = async (order) => {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // silently skip if not configured

  try {
    const s = buildOrderSummary(order);
    const text =
      `🛍️ *New Order — Siraj Candles*\n\n` +
      `👤 ${s.customerName}\n` +
      `📍 ${s.customerCity}\n` +
      `📞 ${s.customerPhone}\n\n` +
      `*Items:*\n${s.itemLines}\n\n` +
      (s.discountCode ? `🏷️ Discount: ${s.discountCode} (-${s.discount} EGP)\n` : '') +
      `🚚 Shipping: ${s.shipping} EGP\n` +
      `💰 *Total: ${s.total} EGP*\n` +
      `💳 Payment: ${s.payment}\n\n` +
      `🔖 Order ID: #${s.orderId}`;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (err) {
    console.error('Telegram notification failed:', err.message);
    // Never block the order response — just log and continue
  }
};

// Send email notification to admin
const sendEmailNotification = async (order) => {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!gmailUser || !gmailPass || !adminEmail) return; // silently skip if not configured

  try {
    const s = buildOrderSummary(order);
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from:    `"Siraj Candles Orders" <${gmailUser}>`,
      to:      adminEmail,
      subject: `🛍️ New Order #${s.orderId} — ${s.customerName} — ${s.total} EGP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #BE185D;">🛍️ New Order — Siraj Candles</h2>
          <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
            <tr><td style="padding:6px; color:#6B4A6E; font-weight:bold;">Customer</td><td style="padding:6px;">${s.customerName}</td></tr>
            <tr><td style="padding:6px; color:#6B4A6E; font-weight:bold;">Phone</td><td style="padding:6px;">${s.customerPhone}</td></tr>
            <tr><td style="padding:6px; color:#6B4A6E; font-weight:bold;">City</td><td style="padding:6px;">${s.customerCity}</td></tr>
            <tr><td style="padding:6px; color:#6B4A6E; font-weight:bold;">Payment</td><td style="padding:6px;">${s.payment}</td></tr>
            <tr><td style="padding:6px; color:#6B4A6E; font-weight:bold;">Order ID</td><td style="padding:6px;">#${s.orderId}</td></tr>
          </table>
          <h3 style="color:#BE185D;">Items Ordered</h3>
          <pre style="background:#FFF0F6; padding:12px; border-radius:8px; font-size:14px;">${s.itemLines}</pre>
          <table style="width:100%; margin-top:12px;">
            ${s.discountCode ? `<tr><td style="color:#059669;">Discount (${s.discountCode})</td><td style="text-align:right; color:#059669;">-${s.discount} EGP</td></tr>` : ''}
            <tr><td>Shipping</td><td style="text-align:right;">${s.shipping} EGP</td></tr>
            <tr style="font-size:18px; font-weight:bold; color:#BE185D;">
              <td>Total</td><td style="text-align:right;">${s.total} EGP</td>
            </tr>
          </table>
          <p style="margin-top:20px; color:#6B4A6E; font-size:12px;">
            Log in to your <a href="https://sirajcare.com/admin-upload" style="color:#BE185D;">admin dashboard</a> to confirm this order.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email notification failed:', err.message);
    // Never block the order response — just log and continue
  }
};


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

        // Fire notifications — non-blocking, never delay the customer response
        sendTelegramNotification(createdOrder).catch(e => console.error('Telegram error:', e));
        sendEmailNotification(createdOrder).catch(e => console.error('Email error:', e));

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