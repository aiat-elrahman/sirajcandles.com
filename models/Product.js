import mongoose from "mongoose";

// Sub-schema for items within a bundle
const bundleItemSchema = new mongoose.Schema({
  subProductName: { type: String, required: true },
  size: { type: String, required: true },
  allowedScents: { type: String, required: true }, // Storing scents as comma-separated string
}, { _id: false }); // Don't create separate IDs for bundle items

const productSchema = new mongoose.Schema(
  {
    // --- Core Fields (Required by original schema validation) ---
    name: { type: String, required: true }, // Generic name, copied from name_en or bundleName
    price: { type: Number, required: true }, // Generic price, copied from price_egp

    // --- Fields from Admin Panel (Common) ---
    productType: { type: String, enum: ["Single", "Bundle"], required: true },
    category: { type: String, required: true }, // Make category required
    price_egp: { type: Number, required: true }, // Keep the specific price field
    stock: { type: Number, default: 0, required: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    featured: { type: Boolean, default: false },
    imagePaths: [{ type: String }], // Use imagePaths, expecting Cloudinary URLs

    // --- Single Product Specific Fields ---
    name_en: { type: String }, // Specific English name
    description_en: { type: String }, // Specific English description
    scents: { type: String }, // Storing scents as comma-separated string
    size: { type: String },
    formattedDescription: { type: String },
    burnTime: { type: String },
    wickType: { type: String },
    coverageSpace: { type: String },

    // --- Bundle Specific Fields ---
    bundleName: { type: String }, // Specific name for bundles
    bundleDescription: { type: String }, // Specific description for bundles
    bundleItems: [bundleItemSchema], // Array of bundle items using the sub-schema

    // --- Deprecated field (from old routes) ---
    // We keep 'images' temporarily for compatibility if old data exists,
    // but new products will use 'imagePaths'.
    images: [{ type: String }],

  },
  { timestamps: true } // Adds createdAt and updatedAt automatically
);

export default mongoose.model("Product", productSchema);