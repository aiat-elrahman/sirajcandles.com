import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Employee login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, store: user.store },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ success: true, token, role: user.role, store: user.store });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get('/setup-employees-temp', async (req, res) => {
  try {
    const password = await bcrypt.hash('store123', 10);
    
    await User.findOneAndUpdate(
      { username: 'sabeel_employee' },
      { password, role: 'sabeel_employee', store: 'sabeel' },
      { upsert: true, new: true }
    );
    
    await User.findOneAndUpdate(
      { username: 'clouds_tex_employee' },
      { password, role: 'clouds_tex_employee', store: 'clouds_tex' },
      { upsert: true, new: true }
    );
    
    res.send('✅ Employees created successfully!');
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});
export default router;