import mongoose from 'mongoose';

const bazaarItemSchema = new mongoose.Schema({
  productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName:  { type: String, required: true },
  variantName:  { type: String, default: '' },
  originalPrice:{ type: Number, required: true },
  salePrice:    { type: Number, required: true }, // after per-item discount
  quantity:     { type: Number, required: true, min: 1 },
  isFreeGift:   { type: Boolean, default: false },
  itemNote:     { type: String, default: '' },
}, { _id: false });

const bazaarSaleSchema = new mongoose.Schema({
  customerName:    { type: String, default: 'Walk-in' },
  customerPhone:   { type: String, default: '' },
  items:           [bazaarItemSchema],
  subtotal:        { type: Number, required: true },
  orderDiscount:   { type: Number, default: 0 }, 
  discountPct: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['Cash', 'InstaPay'], default: 'Cash' },
  totalAmount:     { type: Number, required: true },
  note:            { type: String, default: '' },
  bazaarDay:       { type: String, default: '' }, 
  saleDate:        { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('BazaarSale', bazaarSaleSchema);