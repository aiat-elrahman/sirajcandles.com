import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from './models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    // 1. Connect to the database first
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 2. Hash the password (scoped correctly inside the function)
    const password = await bcrypt.hash('store123', 10); // change 'store123' as needed

    // 3. Upsert Sabeel Employee
    await User.findOneAndUpdate(
      { username: 'sabeel_employee' },
      { password, role: 'sabeel_employee', store: 'sabeel' },
      { upsert: true, new: true }
    );
    console.log('Sabeel employee created/updated.');

    // 4. Upsert Clouds Tex Employee
    await User.findOneAndUpdate(
      { username: 'clouds_tex_employee' },
      { password, role: 'clouds_tex_employee', store: 'clouds_tex' },
      { upsert: true, new: true }
    );
    console.log('Clouds Tex employee created/updated.');

    console.log('✅ All employees processed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

run();