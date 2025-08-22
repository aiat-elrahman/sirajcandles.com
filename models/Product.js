const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    category: String,
    image: String,
    stock: { type: Number, default: 0 }
});

module.exports = mongoose.model('Product', ProductSchema);