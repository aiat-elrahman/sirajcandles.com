// Create this new file: controllers/OrderController.js
import Order from "../models/Order.js";

// @desc   Create a new order
// @route  POST /api/orders
// @access Public
export const createOrder = async (req, res) => {
  try {
    // All this data comes from your 'site.js' fetch request
    const {
      customerInfo,
      items,
      subtotal,
      shippingFee,
      totalAmount,
      paymentMethod,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No order items" });
    }

    const order = new Order({
      customerInfo,
      items,
      subtotal,
      shippingFee,
      totalAmount,
      paymentMethod,
    });

    const createdOrder = await order.save();

    res.status(201).json({ 
      message: "Order created successfully",
      orderId: createdOrder._id 
    });

  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Server error creating order" });
  }
};