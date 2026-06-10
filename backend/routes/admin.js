const express = require('express');
const User = require('../models/User');
const Message = require('../models/Message');
const BannedKeyword = require('../models/BannedKeyword');
const authMiddleware = require('../middleware/auth');
const { loadKeywords } = require('../middleware/grinchFilter');

module.exports = function createAdminRouter(state, io) {
  const router = express.Router();

  function adminOnly(req, res, next) {
    if (!req.user?.is_admin) return res.status(403).json({ message: 'Access denied. Boardroom requires admin credentials.' });
    next();
  }
  router.use(authMiddleware, adminOnly);

  // ── Tab 1: Analytics ────────────────────────────────────────────────────────

  // Live table population map
  router.get('/tables', (req, res) => {
    const tables = [];
    for (const [table_id, room] of state.rooms) {
      tables.push({
        table_id, type: room.type, user_count: room.users.size,
        users: [...room.users.values()].map(u => ({ display_name: u.display_name, status: u.status })),
      });
    }
    res.json({ tables, total_online: state.userSocketMap.size });
  });

  // BFH statistics
  router.get('/bfh-stats', (req, res) => {
    res.json(state.bfhStats ?? { total: 0, accepted: 0, declined: 0, refunded: 0 });
  });

  // Recent GNB transactions (last 100 across all users)
  router.get('/transactions', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);
    const users = await User.find({}, 'display_name transaction_ledger').lean();
    const allTx = [];
    for (const u of users) {
      for (const tx of u.transaction_ledger ?? []) {
        allTx.push({ display_name: u.display_name, ...tx });
      }
    }
    allTx.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ transactions: allTx.slice(0, limit) });
  });

  // Daily consumption per user
  router.get('/consumption', async (req, res) => {
    const { user: displayName, date } = req.query;
    const query = {};
    if (displayName) query.display_name = new RegExp(displayName, 'i');
    const users = await User.find(query, 'display_name transaction_ledger').lean();
    const results = [];
    for (const u of users) {
      const dayTx = (u.transaction_ledger ?? []).filter(tx => {
        const txDate = new Date(tx.timestamp).toISOString().slice(0, 10);
        return !date || txDate === date;
      });
      const purchases = dayTx.filter(tx => tx.amount < 0 && tx.description?.startsWith('Purchased'));
      if (purchases.length > 0 || !displayName) {
        results.push({ display_name: u.display_name, purchase_count: purchases.length, total_spent: purchases.reduce((s, t) => s + Math.abs(t.amount), 0), transactions: purchases });
      }
    }
    res.json({ results });
  });

  // ── Tab 2: Grinch Filter ────────────────────────────────────────────────────

  router.get('/keywords', async (req, res) => {
    const keywords = await BannedKeyword.find({}).sort({ createdAt: -1 }).lean();
    res.json({ keywords });
  });

  router.post('/keywords', async (req, res) => {
    const { keyword } = req.body;
    if (!keyword?.trim()) return res.status(400).json({ message: 'Keyword required.' });
    try {
      const doc = await BannedKeyword.create({ keyword: keyword.trim(), added_by: req.user.display_name });
      await loadKeywords(); // refresh cache
      res.status(201).json({ keyword: doc });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'Keyword already banned.' });
      res.status(500).json({ message: 'Failed to add keyword.' });
    }
  });

  router.delete('/keywords/:id', async (req, res) => {
    await BannedKeyword.findByIdAndDelete(req.params.id);
    await loadKeywords();
    res.json({ success: true });
  });

  // ── Tab 3: Intervention Board ────────────────────────────────────────────────

  router.get('/users/search', async (req, res) => {
    const { q } = req.query;
    if (!q?.trim()) return res.json({ users: [] });
    const users = await User.find(
      { display_name: new RegExp(q.trim(), 'i') },
      'display_name email gnb_coin_balance is_banned is_admin bro_registry personal_inventory offered_inventory session_overdraft_count transaction_ledger'
    ).limit(10).lean();
    res.json({ users });
  });

  // Commissioner's Fine
  router.post('/users/:id/fine', async (req, res) => {
    const { amount, reason } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid amount required.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const deduct = Math.min(amount, user.gnb_coin_balance);
    user.gnb_coin_balance -= deduct;
    user.transaction_ledger.push({ description: reason || 'Slap Bet Commissioner Fine', amount: -deduct, timestamp: new Date() });
    await user.save();

    // Notify user if online
    const socketId = state.userSocketMap.get(String(user._id));
    if (socketId) {
      io.to(socketId).emit('system:fine', {
        message: `System Warning: The Slap Bet Commissioner has seized ${deduct} GNB Coins from your account due to an Intervention.`,
        new_balance: user.gnb_coin_balance,
      });
    }

    // Emit to admin feed
    io.to('admin_feed').emit('admin:fine_applied', { display_name: user.display_name, amount: deduct, reason });
    res.json({ success: true, gnb_coin_balance: user.gnb_coin_balance });
  });

  // Call Doug the Bouncer (Ban)
  router.post('/users/:id/ban', async (req, res) => {
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { is_banned: true } }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Sever their connection immediately
    const socketId = state.userSocketMap.get(String(user._id));
    if (socketId) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) {
        sock.emit('system:banned', { message: "🚪 Doug the Bouncer threw you out into the alley. Your account has been permanently banned." });
        setTimeout(() => sock.disconnect(true), 500);
      }
    }

    io.to('admin_feed').emit('admin:user_banned', { display_name: user.display_name });
    res.json({ success: true, display_name: user.display_name });
  });

  // Unban
  router.post('/users/:id/unban', async (req, res) => {
    await User.findByIdAndUpdate(req.params.id, { $set: { is_banned: false } });
    res.json({ success: true });
  });

  return router;
};
