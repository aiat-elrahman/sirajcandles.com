import mongoose from "mongoose";

const bundleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }], 
    image: { type: String }, // single image
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Bundle", bundleSchema);
