import mongoose from 'mongoose';

// Each subcategory has a name and an optional image
const subcategorySchema = new mongoose.Schema({
    name:  { type: String, required: true, trim: true },
    image: { type: String, default: '' },
}, { _id: false });

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
    subcategories: [subcategorySchema]   // ← objects with name + image
}, {
    timestamps: true
});

export default mongoose.model('Category', categorySchema);