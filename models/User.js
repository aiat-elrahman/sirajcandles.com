import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // will be hashed
  role: {
    type: String,
    enum: ['admin', 'sabeel_employee', 'clouds_tex_employee'],
    required: true
  },
  store: { type: String, enum: ['sabeel', 'clouds_tex'], default: null }, // for employees
  displayName: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  disabledAt: { type: Date, default: null },
  disabledBy: { type: String, default: null },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
