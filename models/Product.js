import mongoose from "mongoose";

// Sub-schema for items within a bundle
const bundleItemSchema = new mongoose.Schema({
  subProductName: { type: String, required: true },
  size: { type: String, required: true },
  allowedScents: { type: String, required: true }, // Storing scents as comma-separated string
}, { _id: false });

const productSchema = new mongoose.Schema(
  {
    // --- Core Fields (Required by original schema validation) ---
    name: { type: String, required: true },
    price: { type: Number, required: true },

    // --- Fields from Admin Panel (Common) ---
    variants: [{
  variantName: {  // e.g., "60g", "100g", "200ml", "Red", "Vanilla"
    type: String,
    required: true
  },
  variantType: {  // e.g., "weight", "size", "color", "scent"
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  sku: String  // Optional: Stock Keeping Unit
}],
    productType: { type: String, enum: ["Single", "Bundle"], required: true },
    category: { 
      type: String, 
      required: true,
      enum: [
        "Candles",
        "Pottery Collection", 
        "Wax Burners",
        "Deodorant",
        "Soap",
        "Body Splash", 
        "Shimmering Body Oil",
        "Massage Candles",
        "Fizzy Salts",
        "Fresheners",
        "Wax Melts",
        "Car Diffusers",
        "Reed Diffusers",
        "Sets",
        "Bundles"
      ]
    },
    price_egp: { type: Number, required: true },
    stock: { type: Number, default: 0, required: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    featured: { type: Boolean, default: false },
    imagePaths: [{ type: String }],

    // --- Single Product Specific Fields ---
    name_en: { type: String },
    description_en: { type: String },
    scents: { type: String }, // For products where scent is just text info
    size: { type: String }, // General size field
    
    // --- NEW: Selectable Options Fields (for dropdowns) ---
    scentOptions: { type: String }, // Comma-separated scents for dropdown (Fresheners, Pottery, etc.)
    sizeOptions: { type: String }, // Comma-separated sizes for dropdown (Body Splash)
    weightOptions: { type: String }, // Comma-separated weights for dropdown (Wax Melts)
    typeOptions: { type: String }, // Comma-separated types for dropdown (Wax Burners)
    shapeOptions: { type: String }, // Comma-separated shapes for dropdown (Car Diffusers)

    // --- Product Specifications (Conditional based on category) ---
    formattedDescription: { type: String },
    
    // Candle & Pottery Specifications
    burnTime: { type: String },
    wickType: { type: String },
    coverageSpace: { type: String },
    
    // Deodorant Specifications
    skinType: { type: String },
    keyIngredients: { type: String },
    
    // Soap Specifications  
    featureBenefit: { type: String },
    soapWeight: { type: String }, // Specific weight for soap
    
    // Body Oil Specifications
    color: { type: String },
    oilWeight: { type: String }, // Specific weight for body oil
    
    // Massage Candle Specifications
    massageWeight: { type: String }, // Specific weight for massage candles
    
    // Wax Burner Specifications
    dimensions: { type: String },
    material: { type: String },
    
    // Fizzy Salts (placeholder for future)
    fizzySpecs: { type: String },

    // --- Bundle Specific Fields ---
    bundleName: { type: String },
    bundleDescription: { type: String },
    bundleItems: [bundleItemSchema],

    // --- Deprecated field (from old routes) ---
    images: [{ type: String }],

  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);