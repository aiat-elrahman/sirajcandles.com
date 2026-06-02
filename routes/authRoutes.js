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
    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'This account is disabled. Please contact the admin.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, store: user.store, displayName: user.displayName },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ success: true, token, role: user.role, store: user.store, displayName: user.displayName });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/setup-employees-temp', async (req, res) => {
  res.status(410).json({ message: 'Temporary employee setup is disabled. Use the admin Employee Accounts page.' });
});

export default router;
