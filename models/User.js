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
}, { timestamps: true });

export default mongoose.model('User', userSchema);