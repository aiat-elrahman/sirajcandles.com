import mongoose from 'mongoose';

const heroSettingsSchema = new mongoose.Schema({
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