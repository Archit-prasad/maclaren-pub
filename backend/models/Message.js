const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  table_id: { type: String, required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  display_name: { type: String, required: true },
  avatar_url: { type: String, default: '' },
  content: { type: String, default: '' },
  image_url: { type: String, default: '' },
  type: { type: String, enum: ['text', 'image', 'system'], default: 'text' },
}, { timestamps: true });

messageSchema.index({ table_id: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
