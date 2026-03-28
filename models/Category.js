import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    image: {
        type: String,
        default: ''
    },
    sortOrder: {
        type: Number,
        required: true,
        default: 0
    },
    subcategories: [{ type: String, trim: true }]   // ← NEW: for cascaded menu
}, {
    timestamps: true
});

export default mongoose.model('Category', categorySchema);