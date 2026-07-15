import mongoose from "mongoose";

const bundleItemSchema = new mongoose.Schema({
  subProductName:   { type: String, required: true },
  size:             { type: String, default: '' },
  allowedScents:    { type: String, default: '' },
  linkedProductId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  linkedProductName:{ type: String, default: '' },
}, { _id: false });

const variantSchema = new mongoose.Schema({
  variantName:  { type: String, required: true },
  variantType:  { type: String, required: true },
  price:        { type: Number, required: true, min: 0 },
  costPrice:    { type: Number, default: 0, min: 0 },
  stock:        { type: Number, default: 0, min: 0 },          // online stock (legacy)
  sku:          String,
  // location stocks for this variant
  stockOnline:      { type: Number, default: 0 },
  stockSabeel:      { type: Number, default: 0 },
  stockCloudsTex:   { type: Number, default: 0 },
});

const productSchema = new mongoose.Schema(
  {
    name:   { type: String, required: true },
    price:  { type: Number, required: true },

    variants: [variantSchema],

    productType:  { type: String, enum: ["Single", "Bundle"], required: true },
    category:     { type: String, required: true },
    subcategory:  { type: String, default: '' },
    price_egp:    { type: Number, required: true },
    costPrice:    { type: Number, default: 0, min: 0 },
    stock:        { type: Number, default: 0, required: true },   // online stock (legacy)
    status:       { type: String, enum: ["Active", "Inactive"], default: "Active" },
    featured:     { type: Boolean, default: false },
    imagePaths:   [{ type: String }],

    // sale price shown with strikethrough + SALE badge when < price_egp
    salePrice:      { type: Number, default: 0, min: 0 },
    // "pairs well with" product for the pairing popup
    pairedProduct:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },

    // CRITICAL SEO UPGRADE: Short URL Slugs
    slug: { type: String, unique: true, sparse: true, trim: true },

    // location stocks for simple products (no variants)
    stockOnline:      { type: Number, default: 0 },
    stockSabeel:      { type: Number, default: 0 },
    stockCloudsTex:   { type: Number, default: 0 },

    name_en:          { type: String },
    description_en:   { type: String },
    scents:           { type: String },
    size:             { type: String },

    scentOptions:     { type: String },
    sizeOptions:      { type: String },
    weightOptions:    { type: String },
    typeOptions:      { type: String },
    shapeOptions:     { type: String },

    formattedDescription: { type: String },
    burnTime:       { type: String },
    wickType:       { type: String },
    coverageSpace:  { type: String },
    skinType:       { type: String },
    keyIngredients: { type: String },
    featureBenefit: { type: String },
    soapWeight:     { type: String },
    color:          { type: String },
    oilWeight:      { type: String },
    massageWeight:  { type: String },
    dimensions:     { type: String },
    material:       { type: String },
    fizzySpecs:     { type: String },

    bundleName:         { type: String },
    bundleDescription:  { type: String },
    bundlePrice:        { type: Number, default: 0 },
    bundleOriginalPrice:{ type: Number, default: 0 },
    bundleItems:        [bundleItemSchema],

    images: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);