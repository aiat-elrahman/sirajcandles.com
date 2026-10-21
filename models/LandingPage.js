import mongoose from 'mongoose';

const benefitSchema = new mongoose.Schema({
  icon:  { type: String, default: 'fa-heart' },   // Font Awesome class, e.g. "fa-leaf"
  title: { type: String, default: '' },
  text:  { type: String, default: '' },
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  name:   { type: String, default: '' },
  text:   { type: String, default: '' },
  rating: { type: Number, default: 5, min: 1, max: 5 },
}, { _id: false });

const stepSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  text:  { type: String, default: '' },
}, { _id: false });

const faqSchema = new mongoose.Schema({
  q: { type: String, default: '' },
  a: { type: String, default: '' },
}, { _id: false });

const landingPageSchema = new mongoose.Schema({
  slug:        { type: String, required: true, unique: true, trim: true, lowercase: true },
  internalName:{ type: String, default: '' },          // admin-only label, e.g. "Wax Melts - Oct campaign"
  isPublished: { type: Boolean, default: false },

  // SEO / share
  metaTitle:       { type: String, default: '' },
  metaDescription: { type: String, default: '' },

  // Hero
  eyebrow:     { type: String, default: '' },
  headline:    { type: String, default: '' },
  subheadline: { type: String, default: '' },
  heroImage:   { type: String, default: '' },
  offerBadge:  { type: String, default: '' },
  ctaText:     { type: String, default: 'Shop Now' },

  // Products / bundles, in display order
  productsHeading: { type: String, default: '' },
  productIds:      { type: [String], default: [] },

  benefits: { type: [benefitSchema], default: [] },
  reviews:  { type: [reviewSchema],  default: [] },

  // "How ordering works" (deposit -> label photo -> balance). Fully editable.
  howItWorksEnabled: { type: Boolean, default: true },
  howItWorksHeading: { type: String, default: '' },
  howItWorksSteps:   { type: [stepSchema], default: [] },

  faq: { type: [faqSchema], default: [] },

  // Pixel label for ViewContent
  contentName: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('LandingPage', landingPageSchema);