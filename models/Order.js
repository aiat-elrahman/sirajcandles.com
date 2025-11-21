import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  customization: { type: [String], default: null },
});

const customerInfoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  notes: { type: String },
});

const orderSchema = new mongoose.Schema(
  {
    customerInfo: customerInfoSchema,
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, required: true, default: 'Cash on Delivery' },
    status: { type: String, required: true, default: 'Pending' },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;