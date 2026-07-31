import mongoose from 'mongoose';

const discountSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['percentage', 'fixed', 'free_shipping', 'buyxgety']
    },
    value:          { type: Number, default: 0, min: 0 },
    appliesTo:      { type: String, default: 'entire', enum: ['entire', 'categories'] },
    categories:     [{ type: String }],
    subcategories:  [{ type: String }], // NEW: optional narrowing within `categories` — e.g. "Body Splash" inside "Self Care"
    minOrderValue:  { type: Number, default: 0 },
    maxUses:        { type: Number, default: null },
    usedCount:      { type: Number, default: 0 },
    expiresAt:      { type: Date, default: null },
    status:         { type: String, default: 'active', enum: ['active', 'inactive'] },
    isAutomatic:      { type: Boolean, default: false },
    isStackable:      { type: Boolean, default: false },
    stackCap:         { type: Number, default: 30 },
    buyQuantity:      { type: Number, default: 2 },
    getQuantity:      { type: Number, default: 1 },
    getDiscountPct:   { type: Number, default: 100 },
    buyxgetyCategory: { type: String, default: '' },
    buyxgetySubcategory: { type: String, default: '' }, // NEW: optional narrowing, same idea for Buy X Get Y
}, { timestamps: true });

discountSchema.index({ status: 1 });
export default mongoose.model('Discount', discountSchema);