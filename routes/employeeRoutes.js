import express from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

const EMPLOYEE_ROLES = ['sabeel_employee', 'clouds_tex_employee'];
const ROLE_STORE = {
  sabeel_employee: 'sabeel',
  clouds_tex_employee: 'clouds_tex',
};

const sanitizeUser = (user) => ({
  _id: user._id,
  username: user.username,
  displayName: user.displayName,
  role: user.role,
  store: user.store,
  isActive: user.isActive,
  disabledAt: user.disabledAt,
  disabledBy: user.disabledBy,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

router.use(authenticateToken, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const users = await User.find({ role: { $in: EMPLOYEE_ROLES } }).sort({ createdAt: -1 });
    res.json(users.map(sanitizeUser));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, password, role, displayName } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ message: 'Username, password, and role are required.' });
    }
    if (!EMPLOYEE_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid employee role.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ username: username.trim() });
    if (existing) return res.status(400).json({ message: 'Username already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: username.trim(),
      password: passwordHash,
      role,
      store: ROLE_STORE[role],
      displayName: displayName?.trim() || '',
      isActive: true,
    });

    res.status(201).json(sanitizeUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { displayName, role, isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user || !EMPLOYEE_ROLES.includes(user.role)) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    if (displayName !== undefined) user.displayName = displayName.trim();
    if (role !== undefined) {
      if (!EMPLOYEE_ROLES.includes(role)) return res.status(400).json({ message: 'Invalid employee role.' });
      user.role = role;
      user.store = ROLE_STORE[role];
    }
    if (isActive !== undefined) {
      user.isActive = Boolean(isActive);
      user.disabledAt = user.isActive ? null : new Date();
      user.disabledBy = user.isActive ? null : (req.user?.username || 'admin');
    }

    await user.save();
    res.json(sanitizeUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findById(req.params.id);
    if (!user || !EMPLOYEE_ROLES.includes(user.role)) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
