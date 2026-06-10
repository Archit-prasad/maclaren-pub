const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/coins/claim — daily GNB claim
router.post('/claim', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const now = new Date();
    if (user.last_daily_claim_at) {
      const diff = now - user.last_daily_claim_at;
      if (diff < 86_400_000) {
        const remaining = 86_400_000 - diff;
        const h = Math.floor(remaining / 3_600_000);
        const m = Math.floor((remaining % 3_600_000) / 60_000);
        return res.status(429).json({ message: `Daily claim not available yet. Come back in ${h}h ${m}m.` });
      }
    }

    const isLuckyPenny = Math.random() < 0.05;
    const amount = isLuckyPenny ? 110 : 100;

    user.gnb_coin_balance += amount;
    user.last_daily_claim_at = now;
    user.transaction_ledger.push({ description: isLuckyPenny ? 'Daily Claim — Lucky Penny! 🪙' : 'Daily Claim', amount, timestamp: now });
    await user.save();

    res.json({ amount, is_lucky_penny: isLuckyPenny, gnb_coin_balance: user.gnb_coin_balance });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/coins/ledger
router.get('/ledger', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id).select('transaction_ledger gnb_coin_balance session_spend_total');
    res.json({ transaction_ledger: user.transaction_ledger, gnb_coin_balance: user.gnb_coin_balance, session_spend_total: user.session_spend_total });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/coins/ledger — Shreddit
router.delete('/ledger', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.user_id, { $set: { transaction_ledger: [] } });
    res.json({ message: 'Corporate compliance achieved. No paper trail remains.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/coins/aldrin_justice — roll back last purchase
router.post('/aldrin_justice', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id);
    // Find the most recent negative transaction (a purchase)
    const lastPurchaseIdx = [...user.transaction_ledger].reverse().findIndex(t => t.amount < 0);
    if (lastPurchaseIdx === -1) return res.status(400).json({ message: 'No transactions to reverse.' });

    const realIdx = user.transaction_ledger.length - 1 - lastPurchaseIdx;
    const tx = user.transaction_ledger[realIdx];
    const refund = Math.abs(tx.amount);

    user.gnb_coin_balance += refund;
    user.transaction_ledger.splice(realIdx, 1);
    user.transaction_ledger.push({ description: `Aldrin Justice: Refunded "${tx.description}"`, amount: refund, timestamp: new Date() });
    await user.save();

    res.json({ refunded: refund, gnb_coin_balance: user.gnb_coin_balance, transaction_ledger: user.transaction_ledger });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
