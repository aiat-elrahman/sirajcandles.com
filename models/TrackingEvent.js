import mongoose from 'mongoose';

const trackingEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['page_view', 'view_content', 'add_to_cart', 'begin_checkout', 'purchase'],
      required: true,
      index: true,
    },
    sessionId: { type: String, required: true, index: true },
    path: { type: String, default: '' },
    referrer: { type: String, default: '' },
    utmSource: { type: String, default: '' },
    utmMedium: { type: String, default: '' },
    utmCampaign: { type: String, default: '' },
    value: { type: Number, default: 0 },
    currency: { type: String, default: 'EGP' },
    orderId: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

trackingEventSchema.index({ createdAt: -1 });
trackingEventSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model('TrackingEvent', trackingEventSchema);
