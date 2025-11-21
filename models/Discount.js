import mongoose from 'mongoose';

const discountSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed']
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  appliesTo: {
    type: String,
    default: 'entire',
    enum: ['entire', 'categories', 'products']
  },
  categories: [{
    type: String
  }],
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  status: {
    type: String,
    default: 'active',
    enum: ['active', 'inactive']
  }
}, {
  timestamps: true
});


discountSchema.index({ status: 1 });

export default mongoose.model('Discount', discountSchema);