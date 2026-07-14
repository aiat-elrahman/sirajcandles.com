import mongoose from 'mongoose';

const heroSlideSchema = new mongoose.Schema({
  backgroundImage: { type: String, default: '' },
  title:           { type: String, default: '' },
  subtitle:        { type: String, default: '' },
  buttonText:      { type: String, default: 'Shop Now' },
  buttonLink:      { type: String, default: '/products.html' },
}, { _id: false });

const heroSettingsSchema = new mongoose.Schema({
  // NEW: unlimited carousel slides
  slides:        { type: [heroSlideSchema], default: [] },
  autoplaySpeed: { type: Number, default: 5000 }, // ms between slides

  // LEGACY single-slide fields — kept only so old data can be migrated into
  // `slides` on first load (see heroRoutes.js). Not written to anymore.
  backgroundImage: { type: String, default: '' },
  buttonText: { type: String, default: 'Shop Now' },
  buttonLink: { type: String, default: '/products.html' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

export default mongoose.model('HeroSettings', heroSettingsSchema);