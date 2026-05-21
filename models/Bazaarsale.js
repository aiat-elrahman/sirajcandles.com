import mongoose from 'mongoose';

const bazaarItemSchema = new mongoose.Schema({
  productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName:  { type: String, required: true },
  variantName:  { type: String, default: '' },
  originalPrice:{ type: Number, required: true },
  salePrice:    { type: Number, required: true }, 
  quantity:     { type: Number, required: true, min: 1 },
  isFreeGift:   { type: Boolean, default: false },
  itemNote:     { type: String, default: '' },
}, { _id: false });

const bazaarSaleSchema = new mongoose.Schema({
  eventId:         { type: String, required: true }, // Links directly to a unique Event ID
  eventName:       { type: String, required: true }, // e.g., "Spring Design Bazaar"
  eventLocation:   { type: String, required: true }, // e.g., "Maadi Camp"
  customerName:    { type: String, default: 'Walk-in' },
  customerPhone:   { type: String, default: '' },
  items:           [bazaarItemSchema],
  subtotal:        { type: Number, required: true },
  orderDiscount:   { type: Number, default: 0 }, 
  discountPct:     { type: Number, default: 0 },
  paymentMethod:   { type: String, enum: ['Cash', 'InstaPay'], default: 'Cash' },
  totalAmount:     { type: Number, required: true },
  note:            { type: String, default: '' },
  bazaarDay:       { type: String, default: 'Day 1' }, // Day 1, Day 2, Day 3
  dayOfWeek:       { type: String, required: true },   // Friday, Saturday, etc.
  dayOfMonth:      { type: Number, required: true },   // 21, 22, 23
  saleDate:        { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('Bazaarsale', bazaarSaleSchema);