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
  // Existing fields (keep for backward compatibility)
  eventId:         { type: String },
  eventName:       { type: String },
  eventLocation:   { type: String },
  customerName:    { type: String, default: 'Walk-in' },
  customerPhone:   { type: String, default: '' },
  items:           [bazaarItemSchema],
  subtotal:        { type: Number, required: true },
  orderDiscount:   { type: Number, default: 0 }, 
  discountPct:     { type: Number, default: 0 },
  paymentMethod:   { type: String, enum: ['Cash', 'InstaPay'], default: 'Cash' },
  totalAmount:     { type: Number, required: true },
  note:            { type: String, default: '' },
  bazaarDay:       { type: String, default: 'Day 1' },       // will be deprecated
  dayOfWeek:       { type: String, required: true },
  dayOfMonth:      { type: Number, required: true },
  saleDate:        { type: Date, default: Date.now },

  // NEW fields for flexible events
  startDate:       { type: Date, default: null },   // event start date
  endDate:         { type: Date, default: null },   // event end date
  actualDate:      { type: Date, default: null },   // date of this specific sale (overrides saleDate)

  // NEW: store location (bazaar, sabeel, clouds_tex)
  location: {
    type: String,
    enum: ['bazaar', 'sabeel', 'clouds_tex'],
    default: 'bazaar'
  },
}, { timestamps: true });

export default mongoose.model('Bazaarsale', bazaarSaleSchema);