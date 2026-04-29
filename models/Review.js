import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name:    { type: String, required: true },
    email:   { type: String },
    rating:  { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    photos:  [{ type: String }],
}, { timestamps: true });

export default mongoose.model('Review', reviewSchema);