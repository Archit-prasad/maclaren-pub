const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  table_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  naked_man_last_used_at: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Table', tableSchema);
