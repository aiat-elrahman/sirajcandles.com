import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name:      { type: String, required: true },
    email:     { type: String, default: '' },
    phone:     { type: String, default: '' },
    rating:    { type: Number, required: true, min: 1, max: 5 },
    comment:   { type: String },
    photos:    [{ type: String }],
    isAdminCreated: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Review', reviewSchema);