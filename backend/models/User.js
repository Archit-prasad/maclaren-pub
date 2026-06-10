const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  item_id: String,
  item_name: String,
  item_category: String,
  gulps_remaining: { type: Number, default: 4 },
  acquired_at: { type: Date, default: Date.now },
}, { _id: false });

const transactionSchema = new mongoose.Schema({
  description: String,
  amount: Number,
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const userSchema = new mongoose.Schema({
  display_name: { type: String, required: true, unique: true, trim: true },
  gender: { type: String, enum: ['Male', 'Female'], required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  avatar_url: { type: String, default: '' },
  gnb_coin_balance: { type: Number, default: 500 },
  bro_registry: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    validate: { validator: (v) => v.length <= 50, message: 'Bro Registry max 50 entries' },
    default: [],
  },
  personal_inventory: {
    type: [inventoryItemSchema],
    validate: { validator: (v) => v.length <= 6, message: 'Personal inventory max 6 items' },
    default: [],
  },
  offered_inventory: {
    type: [inventoryItemSchema],
    validate: { validator: (v) => v.length <= 2, message: 'Offered inventory max 2 items' },
    default: [],
  },
  transaction_ledger: { type: [transactionSchema], default: [] },
  murtaugh_list_progress: {
    type: Object,
    default: () => ({
      level_1: false, level_2: false, level_3: false, level_4: false, level_5: false,
      level_6: false, level_7: false, level_8: false, level_9: false, level_10: false,
    }),
  },
  last_dibs_used_at: { type: Date, default: null },
  last_horn_received_at: { type: Date, default: null },
  last_daily_claim_at: { type: Date, default: null },
  has_eternal_horn_title: { type: Boolean, default: false },
  is_first_login: { type: Boolean, default: true },
  is_admin: { type: Boolean, default: false },
  is_banned: { type: Boolean, default: false },
  session_overdraft_count: { type: Number, default: 0 },
  session_spend_total: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
