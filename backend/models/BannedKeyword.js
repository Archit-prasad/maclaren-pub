const mongoose = require('mongoose');

const bannedKeywordSchema = new mongoose.Schema({
  keyword: { type: String, required: true, unique: true, lowercase: true, trim: true },
  added_by: { type: String, default: 'admin' },
}, { timestamps: true });

module.exports = mongoose.model('BannedKeyword', bannedKeywordSchema);
