const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const User = require('../models/User');
const { uploadAvatar } = require('../lib/cloudinary');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function signToken(user) {
  return jwt.sign(
    { user_id: user._id, display_name: user.display_name, is_admin: user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', upload.single('avatar'), async (req, res) => {
  try {
    const { display_name, gender, email, password } = req.body;

    if (!display_name || !gender || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    if (!['Male', 'Female'].includes(gender)) {
      return res.status(400).json({ message: 'Gender must be Male or Female.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ $or: [{ email }, { display_name }] });
    if (existing) {
      const field = existing.email === email.toLowerCase() ? 'Email' : 'Display name';
      return res.status(409).json({ message: `${field} already taken.` });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({ display_name, gender, email, password_hash });

    if (req.file) {
      try {
        const avatarUrl = await uploadAvatar(req.file.buffer, req.file.mimetype, user._id.toString());
        user.avatar_url = avatarUrl;
        await user.save();
      } catch (err) {
        if (err.code === 'INVALID_MIME') {
          await User.deleteOne({ _id: user._id });
          return res.status(400).json({ message: err.message });
        }
        // Non-fatal: continue without avatar
      }
    }

    const token = signToken(user);
    res.status(201).json({
      token,
      user: {
        user_id: user._id,
        display_name: user.display_name,
        gender: user.gender,
        email: user.email,
        avatar_url: user.avatar_url,
        gnb_coin_balance: user.gnb_coin_balance,
        is_first_login: user.is_first_login,
        is_admin: user.is_admin,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials.' });
    if (user.is_banned) return res.status(403).json({ message: 'Your account has been banned from MacLaren\'s.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials.' });

    // Reset session counters on login
    user.session_overdraft_count = 0;
    user.session_spend_total = 0;
    await user.save();

    const token = signToken(user);
    res.json({
      token,
      user: {
        user_id: user._id,
        display_name: user.display_name,
        gender: user.gender,
        email: user.email,
        avatar_url: user.avatar_url,
        gnb_coin_balance: user.gnb_coin_balance,
        is_first_login: user.is_first_login,
        is_admin: user.is_admin,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

module.exports = router;
