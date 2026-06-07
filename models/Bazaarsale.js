import mongoose from 'mongoose';

// ── Item inside a sale ────────────────────────────────────────────────────────
const bazaarItemSchema = new mongoose.Schema({
  productId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName:   { type: String, required: true },
  variantName:   { type: String, default: '' },
  originalPrice: { type: Number, required: true },
  salePrice:     { type: Number, required: true },
  quantity:      { type: Number, required: true, min: 1 },
  isFreeGift:    { type: Boolean, default: false },
  itemNote:      { type: String, default: '' },
}, { _id: false });

// ── Item returned in an exchange (what customer gave back) ────────────────────
const exchangeReturnItemSchema = new mongoose.Schema({
  productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName:  { type: String, required: true },
  variantName:  { type: String, default: '' },
  quantity:     { type: Number, required: true, min: 1 },
  salePrice:    { type: Number, required: true }, // price at which it was originally sold
}, { _id: false });

// ── Main sale schema ──────────────────────────────────────────────────────────
const bazaarSaleSchema = new mongoose.Schema({

  // ── Identity / event ───────────────────────────────────────────────────────
  eventId:       { type: String },
  eventName:     { type: String },
  eventLocation: { type: String },

  // ── Customer ───────────────────────────────────────────────────────────────
  customerName:  { type: String, default: 'Walk-in' },
  customerPhone: { type: String, default: '' },

  // ── Items sold ─────────────────────────────────────────────────────────────
  items:         [bazaarItemSchema],

  // ── Pricing ────────────────────────────────────────────────────────────────
  subtotal:      { type: Number, required: true },
  orderDiscount: { type: Number, default: 0 },
  discountPct:   { type: Number, default: 0 },
  totalAmount:   { type: Number, required: true },

  // ── Payment ────────────────────────────────────────────────────────────────
  paymentMethod: {
    type: String,
    enum: ['Cash', 'InstaPay'],
    default: 'Cash'
  },

  // ── Additional payment for exchange price difference ──────────────────────
  // e.g. customer swapped 250 EGP item for 450 EGP item → paid 200 EGP extra
  additionalPayment: {
    amount:        { type: Number, default: 0 },
    method:        { type: String, enum: ['Cash', 'InstaPay', 'none'], default: 'none' },
    note:          { type: String, default: '' },
  },

  // ── Exchange — items customer returned ────────────────────────────────────
  // Populated only when status = 'exchanged'
  returnedItems: [exchangeReturnItemSchema],

  // ── Note ──────────────────────────────────────────────────────────────────
  note: { type: String, default: '' },

  // ── Sale status ───────────────────────────────────────────────────────────
  // completed → normal sale, included in all totals
  // edited    → sale was modified after creation
  // voided    → cancelled, stock restored, excluded from revenue totals
  // exchanged → items swapped, stock adjusted both ways
  status: {
    type: String,
    enum: ['completed', 'edited', 'voided', 'exchanged'],
    default: 'completed',
  },

  // ── Audit trail ───────────────────────────────────────────────────────────
  editedAt:   { type: Date, default: null },
  editedBy:   { type: String, default: null },   // username of who edited
  voidedAt:   { type: Date, default: null },
  voidedBy:   { type: String, default: null },   // username of who voided
  voidReason: { type: String, default: '' },

  // ── Date / time fields ─────────────────────────────────────────────────────
  bazaarDay:   { type: String, default: '' },     // YYYY-MM-DD string
  dayOfWeek:   { type: String, required: true },
  dayOfMonth:  { type: Number, required: true },
  saleDate:    { type: Date, default: Date.now },
  startDate:   { type: Date, default: null },     // event start date
  endDate:     { type: Date, default: null },     // event end date
  actualDate:  { type: Date, default: null },     // exact date of this sale

  // ── Location ──────────────────────────────────────────────────────────────
  location: {
    type: String,
    enum: ['bazaar', 'sabeel', 'clouds_tex'],
    default: 'bazaar',
  },

  // ── Who created this sale ─────────────────────────────────────────────────
  createdBy:     { type: String, default: '' },   // username
  createdByRole: { type: String, default: '' },   // role

}, { timestamps: true });

// ── Index for fast queries ────────────────────────────────────────────────────
bazaarSaleSchema.index({ location: 1, status: 1, createdAt: -1 });
bazaarSaleSchema.index({ eventId: 1 });
bazaarSaleSchema.index({ 'customerPhone': 1 });

export default mongoose.model('Bazaarsale', bazaarSaleSchema);