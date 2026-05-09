import mongoose from 'mongoose';

const storeSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  address:        { type: String, required: true },
  phone:          { type: String, default: '' },
  hours:          { type: String, default: '' }, // e.g. "Sat–Thu 10am–9pm"
  mapsEmbedUrl:   { type: String, default: '' }, // Google Maps iframe src
  photos:         [{ type: String }],            // Cloudinary URLs, add later
  status:         { type: String, enum: ['active', 'inactive'], default: 'active' },
  sortOrder:      { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('Store', storeSchema);