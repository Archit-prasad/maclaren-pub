const express = require('express');
const multer = require('multer');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');
const { uploadAvatar, ALLOWED_MIMES } = require('../lib/cloudinary');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/chat/:table_id/history?before=<messageId>&limit=50
router.get('/:table_id/history', authMiddleware, async (req, res) => {
  try {
    const { table_id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const query = { table_id };
    if (req.query.before) {
      query._id = { $lt: req.query.before };
    }
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ messages: messages.reverse(), has_more: messages.length === limit });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch history.' });
  }
});

// POST /api/chat/upload — upload image for Polaroid, returns Cloudinary URL
router.post('/upload', authMiddleware, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file provided.' });
  if (!ALLOWED_MIMES.includes(req.file.mimetype)) {
    return res.status(400).json({ message: 'Carl only allows photos. No documents at the bar.' });
  }
  try {
    const url = await uploadAvatar(req.file.buffer, req.file.mimetype, `chat_${Date.now()}`);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: 'Upload failed.' });
  }
});

module.exports = router;
