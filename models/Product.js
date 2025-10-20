import mongoose from "mongoose";

// --- Sub-Schema for Bundle Components ---
// Defines the items a customer can customize within a bundle
const BundleItemSchema = new mongoose.Schema({
    subProductName: { type: String, required: true }, // e.g., 'Big Jar Candle'
    size: { type: String, required: true },          // e.g., '200 gm' - Uses variable text input
    allowedScents: { type: String, required: true }   // Comma-separated list of available scents
}, { _id: false }); 

// --- Main Product Schema ---
const ProductSchema = new mongoose.Schema({
    // --- 1. CORE TYPE & CATEGORY (Common) ---
    productType: { 
        type: String, 
        enum: ['Single', 'Bundle'], 
        required: true 
    },
    category: { type: String, required: true },
    
    // --- 2. PRICING, INVENTORY & STATUS (Common) ---
    price_egp: { type: Number, required: true }, // Used to be 'price'
    stock: { type: Number, default: 0, min: 0 }, 
    status: { type: String, enum: ['Active', 'Inactive'], default: "Active", required: true },
    featured: { type: Boolean, default: false },

    // --- 3. IMAGES (Common) ---
    imagePaths: [{ type: String, required: true }], // Used to be 'images' - Stores Cloudinary URLs

    // --- 4. SINGLE PRODUCT FIELDS (Sparse/Optional) ---
    name_en: { type: String, trim: true, sparse: true }, // Used to be 'name'
    description_en: { type: String, sparse: true }, // Used to be 'description'
    
    // Admin Fields for Single Product
    scents: { type: String, sparse: true },       // Available scents (comma-separated string)
    size: { type: String, sparse: true },         // e.g., '200 gm', '125 gm'

    // Formatted content for the detail page
    formattedDescription: { type: String, sparse: true },
    
    // NEW ADMIN SPEC FIELDS
    burnTime: { type: String, sparse: true },       
    wickType: { type: String, sparse: true },       
    coverageSpace: { type: String, sparse: true },  

    // --- 5. BUNDLE FIELDS (Sparse/Optional) ---
    bundleName: { type: String, trim: true, sparse: true },
    bundleDescription: { type: String, sparse: true },
    bundleItems: { type: [BundleItemSchema], default: [], sparse: true }
}, {
    timestamps: true 
});

const Product = mongoose.model('Product', ProductSchema);
export default Product;

