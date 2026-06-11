require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const corsConfig = require('./config/cors');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const coinsRoutes = require('./routes/coins');
const createAdminRouter = require('./routes/admin');
const Message = require('./models/Message');
const Table = require('./models/Table');
const User = require('./models/User');
const { ITEM_MAP } = require('./data/barMenuData');
const registerPhase4 = require('./sockets/phase4');
const { checkMurtaugh, trackDailySpend } = require('./sockets/phase4');
const { loadKeywords, censorText } = require('./middleware/grinchFilter');

const app = express();
const httpServer = http.createServer(app);

app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'https://maclaren-pub.vercel.app'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/coins', coinsRoutes);
// Admin router is mounted after io is created so it can receive the io reference
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Capacity matrix ─────────────────────────────────────────────────────────
const CAPACITY = {
  'Big Corner Sofa': 13, 'Standard Sofa': 7, 'Long Table A': 6, 'Long Table B': 5,
  'Medium Table': 4, 'Small Table': 3, 'Solo Table': 2, 'Waiting Sofa': 2,
  "Men's Washroom": Infinity, "Women's Washroom": Infinity,
  'Bar Counter': null, 'Jukebox': null,
};

// ─── Shared in-memory state ───────────────────────────────────────────────────
const state = {
  bfhStats: { total: 0, accepted: 0, declined: 0, refunded: 0 },
  rooms:              new Map(), // table_id → { users: Map<socketId, info>, type }
  socketTable:        new Map(), // socketId → table_id
  lastActivity:       new Map(), // socketId → timestamp
  afkFlags:           new Map(), // socketId → bool
  userStatuses:       new Map(), // socketId → status
  userSocketMap:      new Map(), // userId(string) → socketId
  pendingOffers:      new Map(), // offerId → offer obj
  sandwichTimers:     new Map(), // userId → timeoutId
  pendingBFH:         new Map(), // proposalId → bfh obj
  bfhTimers:          new Map(), // proposalId → timeoutId
  bfhWingmanWindows:  new Map(), // proposalId → Set of wingman socketIds shown
  pendingBroRequests: new Map(), // requestId → req obj
  dibsLocks:          new Map(), // lockKey → { userId, expiry }
  sessionBeerCount:   new Map(), // socketId → Number
};
const { rooms, socketTable, lastActivity, afkFlags, userStatuses, userSocketMap,
        pendingOffers, sandwichTimers } = state;

function updateActivity(socketId) {
  lastActivity.set(socketId, Date.now());
  if (afkFlags.get(socketId)) afkFlags.set(socketId, false);
}
function getRoomUsers(table_id) {
  return rooms.has(table_id) ? [...rooms.get(table_id).users.values()] : [];
}
function emitStatusChanged(socket, status, extraRoomId = null) {
  const io = global._io;
  if (!io || !socket?.user) return;
  const payload = { user_id: socket.user.user_id, display_name: socket.user.display_name, status };
  try { socket.emit('user:status_changed', { ...payload, self: true }); } catch {}
  io.to('pub_general').emit('user:status_changed', payload);
  if (extraRoomId) io.to(extraRoomId).emit('user:status_changed', payload);
}
async function leaveRoom(socket) {
  const table_id = socketTable.get(socket.id);
  if (!table_id) return;
  const room = rooms.get(table_id);
  if (room) { room.users.delete(socket.id); if (room.users.size === 0) rooms.delete(table_id); }
  socketTable.delete(socket.id);
  socket.leave(table_id);
  socket.to(table_id).emit('room:user_left', {
    user_id: socket.user.user_id, display_name: socket.user.display_name, users: getRoomUsers(table_id),
  });
  userStatuses.set(socket.id, 'active');
  emitStatusChanged(socket, 'active');
}
function cancelPendingOffersForSender(socketId) {
  for (const [offerId, offer] of pendingOffers) {
    if (offer.senderSocketId !== socketId) continue;
    global._io?.to(offer.recipientSocketId).emit('drink:offer_cancelled', {
      offer_id: offerId, message: 'The offer was withdrawn — your tablemate disconnected',
    });
    pendingOffers.delete(offerId);
  }
}
async function executeUserBan(userId, reason) {
  console.warn(`[MOCK BAN] user_id=${userId} reason="${reason}"`);
}
async function checkIntervention(socket, user) {
  if (user.session_overdraft_count < 3) return;
  const table_id = socketTable.get(socket.id);
  if (!table_id) return;
  socket.emit('intervention:freeze');
  global._io?.to(table_id).emit('chat:message', {
    _id: `int_${Date.now()}`, table_id, type: 'system',
    user_id: socket.user.user_id, display_name: socket.user.display_name, createdAt: new Date(),
    content: `🔴 INTERVENTION! The gang has gathered because ${socket.user.display_name} is hoarding too many drinks. Step away from the bar!`,
  });
}

// ─── Doppelganger check ───────────────────────────────────────────────────────
async function checkDoppelganger(joiningSocket, table_id) {
  const io = global._io;
  if (!io) return;
  const roomUses = getRoomUsers(table_id);
  const joiningUser = await User.findById(joiningSocket.user.user_id).select('profile_title last_horn_received_at');
  const joiningBadge = joiningUser?.profile_title ?? '';
  const joiningStatus = userStatuses.get(joiningSocket.id) ?? 'active';

  for (const tu of roomUses) {
    if (String(tu.user_id) === String(joiningSocket.user.user_id)) continue;
    const other = await User.findById(tu.user_id).select('profile_title last_horn_received_at');
    if (!other) continue;
    const otherBadge = other.profile_title ?? '';
    const otherStatus = userStatuses.get(tu.socket_id) ?? 'active';
    if (joiningBadge === otherBadge && joiningStatus === otherStatus && joiningBadge !== '') {
      // Doppelganger found — pay both and broadcast
      await User.updateMany(
        { _id: { $in: [joiningSocket.user.user_id, tu.user_id] } },
        { $inc: { gnb_coin_balance: 50 } }
      );
      io.emit('doppelganger:spotted', {
        user_a: joiningSocket.user.display_name, user_b: tu.display_name, table_id, payout: 50,
      });
      io.to(table_id).emit('chat:message', {
        _id: `dop_${Date.now()}`, table_id, type: 'system',
        user_id: joiningSocket.user.user_id, display_name: 'System', createdAt: new Date(),
        content: `🚨 DOPPELGANGER SPOTTED! The space-time continuum is collapsing. ${joiningSocket.user.display_name} and ${tu.display_name} look exactly the same! Both receive 50 GNB!`,
      });
    }
  }
}

// ─── AFK + Murtaugh L1 watchdog ──────────────────────────────────────────────
setInterval(async () => {
  const now = Date.now();
  const TEN_MIN = 600_000;
  const SIX_HR = 21_600_000;
  for (const [socketId, socket] of (global._io?.sockets?.sockets ?? new Map())) {
    if ((userStatuses.get(socketId) ?? 'active') === 'idle') continue;
    const last = lastActivity.get(socketId) ?? now;
    const isAfk = now - last >= TEN_MIN;
    const wasAfk = afkFlags.get(socketId) ?? false;
    if (isAfk !== wasAfk) {
      afkFlags.set(socketId, isAfk);
      const table_id = socketTable.get(socketId);
      const afkPayload = { user_id: socket.user?.user_id, display_name: socket.user?.display_name, afk: isAfk };
      if (table_id) socket.to(table_id).emit('user:afk', afkPayload);
      socket.emit('user:afk', { ...afkPayload, self: true });
      emitStatusChanged(socket, isAfk ? 'eating_sandwich' : 'active', table_id);
    }
    // Murtaugh level 1: idle 6+ hours
    if (now - last >= SIX_HR) {
      await checkMurtaugh(socket.user?.user_id, 'level_1').catch(() => {});
    }
  }
}, 60_000);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: corsConfig,
});
global._io = io;

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('AUTH_MISSING'));
  try { socket.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { next(new Error('AUTH_INVALID')); }
});

io.on('connection', (socket) => {
  updateActivity(socket.id);
  userSocketMap.set(String(socket.user.user_id), socket.id);
  state.sessionBeerCount.set(socket.id, 0);
  socket.join('pub_general');
  if (socket.user.is_admin) socket.join('admin_feed');
  io.to('admin_feed').emit('admin:user_connected', { display_name: socket.user.display_name, total_online: userSocketMap.size });
  console.log(`+ ${socket.user.display_name}`);

  // Register Phase 4 events
  registerPhase4(socket, io, state);

  socket.on('pub:enter', () => updateActivity(socket.id));

  // ── table:join ─────────────────────────────────────────────────────────────
  socket.on('table:join', async ({ table_id, table_type, table_name }, callback) => {
    updateActivity(socket.id);
    if (!table_id || !table_type) return callback?.({ error: 'Invalid table.' });

    if (!rooms.has(table_id)) rooms.set(table_id, { users: new Map(), type: table_type });
    const room = rooms.get(table_id);
    const cap = CAPACITY[table_type];

    // Full-table handling + Naked Man check
    if (cap !== null && cap !== Infinity && room.users.size >= cap) {
      // Check naked_man availability
      try {
        let tableDoc = await Table.findOne({ table_id });
        const nakedManAvailable = !tableDoc?.naked_man_last_used_at ||
          Date.now() - tableDoc.naked_man_last_used_at >= 86_400_000;
        return callback?.({ error: 'This table is currently full.', naked_man_available: nakedManAvailable });
      } catch {
        return callback?.({ error: 'This table is currently full.', naked_man_available: false });
      }
    }

    // Dibs check for non-washroom tables
    const dibsKey = `${table_id}_dibs`;
    if (state.dibsLocks.has(dibsKey)) {
      const lock = state.dibsLocks.get(dibsKey);
      if (String(lock.userId) !== String(socket.user.user_id) && Date.now() < lock.expiry)
        return callback?.({ error: '🪑 Dibs has been declared on this seat. Wait for it to expire.' });
    }

    const previousTableId = socketTable.get(socket.id);
    await leaveRoom(socket);

    socket.join(table_id);
    const statusMap = { "Men's Washroom": 'idle', "Women's Washroom": 'idle', 'Waiting Sofa': 'waiting' };
    const userInfo = {
      socket_id: socket.id, user_id: socket.user.user_id,
      display_name: socket.user.display_name, avatar_url: socket.user.avatar_url ?? '',
      status: statusMap[table_type] ?? 'active',
    };
    room.users.set(socket.id, userInfo);
    socketTable.set(socket.id, table_id);
    userStatuses.set(socket.id, userInfo.status);

    if (userInfo.status === 'idle') {
      emitStatusChanged(socket, 'eating_sandwich', previousTableId);
      if (previousTableId) {
        io.to(previousTableId).emit('chat:message', {
          _id: `sys_${Date.now()}`, table_id: previousTableId, type: 'system',
          user_id: socket.user.user_id, display_name: socket.user.display_name, createdAt: new Date(),
          content: `${socket.user.display_name} is eating a sandwich 🥪`,
        });
      }
    }

    const history = await Message.find({ table_id }).sort({ createdAt: -1 }).limit(50).lean();
    socket.to(table_id).emit('room:user_joined', { user: userInfo, users: getRoomUsers(table_id) });

    // Doppelganger check
    await checkDoppelganger(socket, table_id).catch(() => {});

    callback?.({ success: true, history: history.reverse(), users: getRoomUsers(table_id) });
  });

  // ── table:naked_man ────────────────────────────────────────────────────────
  socket.on('table:naked_man', async ({ table_id, table_type }, callback) => {
    updateActivity(socket.id);
    if (!rooms.has(table_id)) rooms.set(table_id, { users: new Map(), type: table_type });
    const room = rooms.get(table_id);

    // Verify still full before proceeding
    const cap = CAPACITY[table_type] ?? Infinity;
    let tableDoc = await Table.findOneAndUpdate(
      { table_id }, { table_id, name: table_id, type: table_type }, { upsert: true, new: true }
    );

    const nakedManAvailable = !tableDoc.naked_man_last_used_at ||
      Date.now() - tableDoc.naked_man_last_used_at >= 86_400_000;
    if (!nakedManAvailable) return callback?.({ error: 'Naked Man already used at this table recently.' });

    // Update timestamp
    tableDoc.naked_man_last_used_at = new Date();
    await tableDoc.save();

    const rng = Math.random();
    const success = rng < 0.666;

    if (success) {
      // Ghost chair — join the room ignoring capacity
      const userInfo = {
        socket_id: socket.id, user_id: socket.user.user_id,
        display_name: socket.user.display_name, avatar_url: socket.user.avatar_url ?? '', status: 'active',
      };
      room.users.set(socket.id, userInfo);
      socketTable.set(socket.id, table_id);
      userStatuses.set(socket.id, 'active');
      socket.join(table_id);

      const history = await Message.find({ table_id }).sort({ createdAt: -1 }).limit(50).lean();
      io.to(table_id).emit('chat:message', {
        _id: `nm_s_${Date.now()}`, table_id, type: 'system',
        user_id: socket.user.user_id, display_name: 'System', createdAt: new Date(),
        content: `🕴️ The Naked Man works again! ${socket.user.display_name} has joined the table.`,
      });
      socket.to(table_id).emit('room:user_joined', { user: userInfo, users: getRoomUsers(table_id) });
      await checkMurtaugh(socket.user.user_id, 'level_10_success').catch(() => {});
      await User.findByIdAndUpdate(socket.user.user_id, { $set: { naked_man_success_recorded: true } }).catch(() => {});
      callback?.({ success: true, history: history.reverse(), users: getRoomUsers(table_id) });
    } else {
      // Failure — 5-min cooldown note (in-memory)
      io.to(table_id).emit('chat:message', {
        _id: `nm_f_${Date.now()}`, table_id, type: 'system',
        user_id: socket.user.user_id, display_name: 'System', createdAt: new Date(),
        content: `❌ DISASTER! The Naked Man failed. ${socket.user.display_name} has been kicked out of the room to go find some clothes.`,
      });
      await checkMurtaugh(socket.user.user_id, 'level_10_fail').catch(() => {});
      await User.findByIdAndUpdate(socket.user.user_id, { $set: { naked_man_fail_recorded: true } }).catch(() => {});
      callback?.({ error: 'naked_man_failed', cooldown_seconds: 300 });
    }

    // Check Murtaugh level 10 completion (need both fail and success)
    const user = await User.findById(socket.user.user_id).select('naked_man_fail_recorded naked_man_success_recorded');
    if (user?.naked_man_fail_recorded && user?.naked_man_success_recorded) {
      await checkMurtaugh(socket.user.user_id, 'level_10');
    }
  });

  // ── table:leave ────────────────────────────────────────────────────────────
  socket.on('table:leave', async (_, callback) => {
    updateActivity(socket.id);
    await leaveRoom(socket);
    callback?.({ success: true });
  });

  // ── chat:send ──────────────────────────────────────────────────────────────
  socket.on('chat:send', async ({ table_id, content, image_url, type = 'text' }, callback) => {
    updateActivity(socket.id);
    if (socketTable.get(socket.id) !== table_id && table_id !== 'pub_general') return;
    if (type === 'text') {
      if (/(https?:\/\/|www\.)[^\s]+/i.test(content ?? '')) {
        await executeUserBan(socket.user.user_id, 'URL submission');
        socket.emit('chat:carl_ban');
        return callback?.({ error: 'Banned by Carl.' });
      }
    }
    // Apply Grinch Filter (censor banned keywords)
    const cleanContent = type === 'text' ? censorText(content?.trim() ?? '') : (content?.trim() ?? '');
    const message = await Message.create({
      table_id, user_id: socket.user.user_id,
      display_name: socket.user.display_name, avatar_url: socket.user.avatar_url ?? '',
      content: cleanContent, image_url: image_url ?? '', type,
    });
    io.to(table_id).emit('chat:message', message.toObject());
    callback?.({ success: true, message_id: message._id });
  });

  socket.on('chat:typing', ({ table_id, is_typing }) => {
    updateActivity(socket.id);
    socket.to(table_id).emit('chat:typing', { user_id: socket.user.user_id, display_name: socket.user.display_name, is_typing });
  });
  socket.on('chat:load_older', async ({ table_id, before_id }, callback) => {
    const msgs = await Message.find({ table_id, _id: { $lt: before_id } }).sort({ createdAt: -1 }).limit(50).lean();
    callback?.({ messages: msgs.reverse(), has_more: msgs.length === 50 });
  });

  // ── bar:purchase ───────────────────────────────────────────────────────────
  socket.on('bar:purchase', async ({ item_id, quantity = 1 }, callback) => {
    updateActivity(socket.id);
    const item = ITEM_MAP.get(item_id);
    if (!item) return callback?.({ error: 'Item not found.' });
    const qty = Math.max(1, Math.min(6, parseInt(quantity)));
    const totalCost = item.price * qty;

    try {
      const user = await User.findById(socket.user.user_id);
      if (!user) return callback?.({ error: 'User not found.' });

      if (user.gnb_coin_balance < totalCost) {
        user.session_overdraft_count += 1;
        await user.save();
        await checkIntervention(socket, user);
        if (user.session_overdraft_count >= 3) await checkMurtaugh(user._id, 'level_5');
        return callback?.({ error: 'artillery_arthur', message: 'YOU ARE RUINING MY LIFE! - Artillery Arthur', sub: 'GNB Overdraft Protection: Insufficient funds.', session_overdraft_count: user.session_overdraft_count });
      }
      if (user.personal_inventory.length + qty > 6) {
        user.session_overdraft_count += 1;
        await user.save();
        await checkIntervention(socket, user);
        if (user.session_overdraft_count >= 3) await checkMurtaugh(user._id, 'level_5');
        const msgs = [
          'Carl the Bartender is cutting you off! If you buy another drink right now, you are going to wake up with a literal pineapple in your bed and zero memory of how it got there.',
          "CHALLENGE DECLINED. Your coaster is at max capacity. If you keep drinking like this, you're going to end up on the Last Drunk Train out of Manhattan.",
        ];
        return callback?.({ error: 'personal_cap', message: msgs[Math.floor(Math.random() * 2)], session_overdraft_count: user.session_overdraft_count });
      }

      user.gnb_coin_balance -= totalCost;
      user.session_spend_total += totalCost;
      for (let i = 0; i < qty; i++)
        user.personal_inventory.push({ item_id, item_name: item.name, item_category: item.category, gulps_remaining: 4, acquired_at: new Date() });
      user.transaction_ledger.push({ description: `Purchased ${qty}x ${item.name}`, amount: -totalCost, timestamp: new Date() });

      // Murtaugh Level 7: 4+ items simultaneously
      if (user.personal_inventory.length >= 4) await checkMurtaugh(user._id, 'level_7');

      // Murtaugh Level 3: cheap beers in session
      if (item.category === 'beer' && item.price < 200) {
        const cnt = (state.sessionBeerCount.get(socket.id) ?? 0) + qty;
        state.sessionBeerCount.set(socket.id, cnt);
        if (cnt >= 6) await checkMurtaugh(user._id, 'level_3');
      }
      // Murtaugh Level 2: sandwich 3x
      if (item.special === 'sandwich') {
        user.murtaugh_sandwich_count = (user.murtaugh_sandwich_count ?? 0) + 1;
        if (user.murtaugh_sandwich_count >= 3) await checkMurtaugh(user._id, 'level_2');
      }

      await user.save();
      await trackDailySpend(user._id, totalCost);

      // Special effects
      const table_id = socketTable.get(socket.id);
      const displayName = socket.user.display_name;
      if (item.special === 'woo_pitcher' && table_id) {
        io.to(table_id).emit('chat:message', { _id: `woo_${Date.now()}`, table_id, type: 'woo', user_id: socket.user.user_id, display_name: displayName, content: `${displayName} just ordered a Woo! Pitcher! WOOOOOOOOO!`, createdAt: new Date() });
      }
      if (item.special === 'glen_mckenna' && table_id) {
        io.to(table_id).emit('chat:message', { _id: `glen_${Date.now()}`, table_id, type: 'system', user_id: socket.user.user_id, display_name: displayName, content: `${displayName} just opened a bottle of Glen McKenna. Code Red, bro!`, createdAt: new Date() });
      }
      if (item.special === 'best_burger' && table_id) {
        io.to(table_id).emit('chat:message', { _id: `burg_${Date.now()}`, table_id, type: 'system', user_id: socket.user.user_id, display_name: displayName, content: `${displayName} is eating the Best Burger in New York. Regis Philbin wants to know the location.`, createdAt: new Date() });
      }
      if (item.special === 'sandwich') {
        userStatuses.set(socket.id, 'idle');
        emitStatusChanged(socket, 'eating_sandwich', table_id);
        const uid = String(socket.user.user_id);
        clearTimeout(sandwichTimers.get(uid));
        sandwichTimers.set(uid, setTimeout(() => { sandwichTimers.delete(uid); userStatuses.set(socket.id, 'active'); emitStatusChanged(socket, 'active', table_id); }, 600_000));
      }

      io.to('admin_feed').emit('admin:transaction', { display_name: socket.user.display_name, description: `Purchased ${qty}x ${item.name}`, amount: -totalCost, timestamp: new Date() });
      callback?.({ success: true, gnb_coin_balance: user.gnb_coin_balance, personal_inventory: user.personal_inventory, session_spend_total: user.session_spend_total, transaction_ledger: user.transaction_ledger, item });
    } catch (err) {
      console.error('bar:purchase', err);
      callback?.({ error: 'Purchase failed.' });
    }
  });

  // ── coaster:gulp ───────────────────────────────────────────────────────────
  socket.on('coaster:gulp', async ({ item_index, inv_type = 'personal' }, callback) => {
    updateActivity(socket.id);
    try {
      const user = await User.findById(socket.user.user_id);
      const inv = inv_type === 'offered' ? user.offered_inventory : user.personal_inventory;
      if (!inv[item_index]) return callback?.({ error: 'Item not found.' });
      const item = inv[item_index];
      item.gulps_remaining = Math.max(0, item.gulps_remaining - 1);
      const finished = item.gulps_remaining === 0;
      const itemName = item.item_name;
      if (finished) { inv.splice(item_index, 1); user.transaction_ledger.push({ description: `Finished ${itemName}`, amount: 0, timestamp: new Date() }); }
      await user.save();
      const table_id = socketTable.get(socket.id);
      if (table_id) socket.to(table_id).emit('coaster:gulp_update', { user_id: socket.user.user_id, display_name: socket.user.display_name, item_index, inv_type, gulps_remaining: finished ? 0 : item.gulps_remaining, finished, item_name: itemName });
      callback?.({ success: true, personal_inventory: user.personal_inventory, offered_inventory: user.offered_inventory, finished });
    } catch { callback?.({ error: 'Gulp failed.' }); }
  });

  // ── drink:offer_send ───────────────────────────────────────────────────────
  socket.on('drink:offer_send', async ({ recipient_user_id, item_index }, callback) => {
    updateActivity(socket.id);
    try {
      const recipientSocketId = userSocketMap.get(String(recipient_user_id));
      if (!recipientSocketId) return callback?.({ error: 'Recipient is not online.' });
      const [sender, recipient] = await Promise.all([User.findById(socket.user.user_id), User.findById(recipient_user_id)]);
      if (!sender || !recipient) return callback?.({ error: 'User not found.' });
      if (recipient.offered_inventory.length >= 2) return callback?.({ error: 'Transaction failed. Their offered slots are full. They must finish their pending rounds first!' });
      const item = sender.personal_inventory[item_index];
      if (!item) return callback?.({ error: 'Item not found in your inventory.' });

      // Bro discount (10%)
      const isBro = sender.bro_registry.some(id => String(id) === String(recipient_user_id));
      const discount = isBro ? 0.10 : 0;

      // Robin Scherbatsky rule
      let displayItemName = item.item_name;
      if (item.item_name.includes('Minnesota Tidal Wave') && recipient.gender === 'Female') displayItemName = 'Robin Scherbatsky';

      const offerId = `offer_${socket.id}_${Date.now()}`;
      pendingOffers.set(offerId, { senderSocketId: socket.id, senderUserId: String(socket.user.user_id), recipientSocketId, recipientUserId: String(recipient_user_id), item: { ...item.toObject(), item_name: displayItemName }, item_index, inv_type: 'personal', discount });
      io.to(recipientSocketId).emit('drink:offer_incoming', { offer_id: offerId, sender_name: socket.user.display_name, item: { ...item.toObject(), item_name: displayItemName }, is_bro: isBro });
      callback?.({ success: true, offer_id: offerId });
    } catch { callback?.({ error: 'Offer failed.' }); }
  });

  // ── drink:offer_accept ─────────────────────────────────────────────────────
  socket.on('drink:offer_accept', async ({ offer_id }, callback) => {
    const offer = pendingOffers.get(offer_id);
    if (!offer) return callback?.({ error: 'Offer expired.' });
    pendingOffers.delete(offer_id);
    try {
      const [sender, recipient] = await Promise.all([User.findById(offer.senderUserId), User.findById(offer.recipientUserId)]);
      if (!sender || !recipient) return callback?.({ error: 'Users not found.' });
      const item = sender.personal_inventory[offer.item_index];
      if (!item) return callback?.({ error: 'Item no longer available.' });
      sender.personal_inventory.splice(offer.item_index, 1);
      sender.transaction_ledger.push({ description: `Offered ${offer.item.item_name} to ${recipient.display_name}`, amount: 0, timestamp: new Date() });
      recipient.offered_inventory.push({ ...item.toObject() });
      recipient.transaction_ledger.push({ description: `Received ${offer.item.item_name} from ${sender.display_name}`, amount: 0, timestamp: new Date() });
      await Promise.all([sender.save(), recipient.save()]);
      io.to(offer.senderSocketId).emit('drink:offer_resolved', { offer_id, accepted: true, personal_inventory: sender.personal_inventory, message: `${recipient.display_name} accepted the round!` });
      socket.emit('drink:offer_resolved', { offer_id, accepted: true, offered_inventory: recipient.offered_inventory });
      const table_id = socketTable.get(socket.id) ?? socketTable.get(offer.senderSocketId);
      if (table_id) io.to(table_id).emit('chat:message', { _id: `acc_${Date.now()}`, table_id, type: 'system', user_id: socket.user.user_id, display_name: socket.user.display_name, content: `🍻 ${recipient.display_name} accepted the round! Bottoms up!`, createdAt: new Date() });
      callback?.({ success: true });
    } catch { callback?.({ error: 'Accept failed.' }); }
  });

  // ── drink:offer_decline ────────────────────────────────────────────────────
  socket.on('drink:offer_decline', async ({ offer_id }, callback) => {
    const offer = pendingOffers.get(offer_id);
    if (!offer) return callback?.({ error: 'Offer expired.' });
    pendingOffers.delete(offer_id);
    await checkMurtaugh(offer.senderUserId, 'level_4');
    const recip = await User.findById(offer.recipientUserId).select('display_name');
    io.to(offer.senderSocketId).emit('drink:offer_resolved', { offer_id, accepted: false, message: 'LAWYERED! Your motion to slide a drink has been struck from the record.' });
    const table_id = socketTable.get(socket.id) ?? socketTable.get(offer.senderSocketId);
    if (table_id) io.to(table_id).emit('chat:message', { _id: `dec_${Date.now()}`, table_id, type: 'system', user_id: socket.user.user_id, display_name: socket.user.display_name, content: `🙅 ${recip?.display_name ?? 'Someone'} hit Decline. Denied! Go sit in the corner.`, createdAt: new Date() });
    callback?.({ success: true });
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    console.log(`- ${socket.user.display_name}`);
    // Cancel pending BFH proposals where this socket is recipient
    for (const [pid, proposal] of state.pendingBFH) {
      if (proposal.recipientSocketId === socket.id) {
        require('./sockets/phase4').bfhExpire(pid, state, io).catch(() => {});
      }
    }
    cancelPendingOffersForSender(socket.id);
    await leaveRoom(socket);
    lastActivity.delete(socket.id);
    afkFlags.delete(socket.id);
    userStatuses.delete(socket.id);
    userSocketMap.delete(String(socket.user.user_id));
    state.sessionBeerCount.delete(socket.id);
    clearTimeout(sandwichTimers.get(String(socket.user.user_id)));
    sandwichTimers.delete(String(socket.user.user_id));
  });
});

// ─── MongoDB + start ──────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected');
    // Mount admin router (needs io reference) and load keyword cache
    app.use('/api/admin', createAdminRouter(state, io));
    await loadKeywords();
    console.log('Grinch filter loaded');
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => console.log(`Server on :${PORT}`));
  })
  .catch(err => { console.error('MongoDB error:', err); process.exit(1); });
