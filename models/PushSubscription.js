import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth:   { type: String, required: true },
  },
  createdBy: { type: String, default: '' }, // admin username, from the JWT
}, { timestamps: true });

export default mongoose.model('PushSubscription', pushSubscriptionSchema);