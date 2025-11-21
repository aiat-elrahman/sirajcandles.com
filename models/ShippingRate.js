import mongoose from 'mongoose';

const shippingRateSchema = new mongoose.Schema({
  city: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  shippingFee: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('ShippingRate', shippingRateSchema);