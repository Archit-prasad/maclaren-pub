require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const coinsRoutes = require('./routes/coins');
const Message = require('./models/Message');
const User = require('./models/User');
const { ITEM_MAP } = require('./data/barMenuData');

const app = express();
const httpServer = http.createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  process.env.VERCEL_FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/coins', coinsRoutes);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Capacity matrix ─────────────────────────────────────────────────────────
const CAPACITY = {
  'Big Corner Sofa':  13, 'Standard Sofa': 7,
  'Long Table A':     6,  'Long Table B':  5,
  'Medium Table':     4,  'Small Table':   3,
  'Solo Table':       2,  'Waiting Sofa':  2,
  "Men's Washroom":   Infinity, "Women's Washroom": Infinity,
  'Bar Counter': null, 'Jukebox': null,
};

// ─── In-memory state ──────────────────────────────────────────────────────────
const rooms         = new Map(); // table_id → { users: Map<socketId, info>, type }
const socketTable   = new Map(); // socketId → table_id
const lastActivity  = new Map(); // socketId → timestamp
const afkFlags      = new Map(); // socketId → bool
const userStatuses  = new Map(); // socketId → status string
const userSocketMap = new Map(); // userId(string) → socketId
const pendingOffers = new Map(); // offerId → { senderSocketId, recipientSocketId, item, item_index, inv_type }
const sandwichTimers = new Map(); // userId(string) → timeoutId

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
  if (room) {
    room.users.delete(socket.id);
    if (room.users.size === 0) rooms.delete(table_id);
  }
  socketTable.delete(socket.id);
  socket.leave(table_id);
  socket.to(table_id).emit('room:user_left', {
    user_id: socket.user.user_id,
    display_name: socket.user.display_name,
    users: getRoomUsers(table_id),
  });
  userStatuses.set(socket.id, 'active');
  emitStatusChanged(socket, 'active');
}

function cancelPendingOffersForSender(socketId) {
  for (const [offerId, offer] of pendingOffers) {
    if (offer.senderSocketId !== socketId) continue;
    const io = global._io;
    io?.to(offer.recipientSocketId).emit('drink:offer_cancelled', {
      offer_id: offerId,
      message: 'The offer was withdrawn — your tablemate disconnected',
    });
    pendingOffers.delete(offerId);
  }
}

async function executeUserBan(userId, reason) {
  console.warn(`[MOCK BAN] user_id=${userId} reason="${reason}"`);
}

// ─── AFK watchdog ─────────────────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  const TEN_MIN = 600_000;
  for (const [socketId, socket] of (global._io?.sockets?.sockets ?? new Map())) {
    if ((userStatuses.get(socketId) ?? 'active') === 'idle') continue;
    const last = lastActivity.get(socketId) ?? now;
    const isAfk = now - last >= TEN_MIN;
    const wasAfk = afkFlags.get(socketId) ?? false;
    if (isAfk === wasAfk) continue;
    afkFlags.set(socketId, isAfk);
    const status = isAfk ? 'eating_sandwich' : 'active';
    const table_id = socketTable.get(socketId);
    const afkPayload = { user_id: socket.user?.user_id, display_name: socket.user?.display_name, afk: isAfk };
    if (table_id) socket.to(table_id).emit('user:afk', afkPayload);
    socket.emit('user:afk', { ...afkPayload, self: true });
    emitStatusChanged(socket, status, table_id);
  }
}, 60_000);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});
global._io = io;

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('AUTH_MISSING'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('AUTH_INVALID'));
  }
});

io.on('connection', (socket) => {
  updateActivity(socket.id);
  userSocketMap.set(String(socket.user.user_id), socket.id);
  socket.join('pub_general');
  console.log(`+ ${socket.user.display_name}`);

  socket.on('pub:enter', () => updateActivity(socket.id));

  // ── table:join ─────────────────────────────────────────────────────────────
  socket.on('table:join', async ({ table_id, table_type, table_name }, callback) => {
    updateActivity(socket.id);
    if (!table_id || !table_type) return callback?.({ error: 'Invalid table.' });

    if (!rooms.has(table_id)) rooms.set(table_id, { users: new Map(), type: table_type });
    const room = rooms.get(table_id);
    const cap = CAPACITY[table_type];
    if (cap !== null && cap !== Infinity && room.users.size >= cap) {
      return callback?.({ error: 'This table is currently full.' });
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
          _id: `sys_${Date.now()}`, table_id: previousTableId,
          user_id: socket.user.user_id, display_name: socket.user.display_name,
          content: `${socket.user.display_name} is eating a sandwich 🥪`, type: 'system', createdAt: new Date(),
        });
      }
    }

    const history = await Message.find({ table_id }).sort({ createdAt: -1 }).limit(50).lean();
    socket.to(table_id).emit('room:user_joined', { user: userInfo, users: getRoomUsers(table_id) });
    callback?.({ success: true, history: history.reverse(), users: getRoomUsers(table_id) });
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
      const urlPattern = /(https?:\/\/|www\.)[^\s]+/i;
      if (urlPattern.test(content ?? '')) {
        await executeUserBan(socket.user.user_id, 'URL submission');
        socket.emit('chat:carl_ban');
        return callback?.({ error: 'Banned by Carl.' });
      }
    }
    const message = await Message.create({
      table_id, user_id: socket.user.user_id,
      display_name: socket.user.display_name, avatar_url: socket.user.avatar_url ?? '',
      content: content?.trim() ?? '', image_url: image_url ?? '', type,
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

      // Artillery Arthur overdraft check
      if (user.gnb_coin_balance < totalCost) {
        user.session_overdraft_count += 1;
        await user.save();
        await checkIntervention(socket, user);
        return callback?.({
          error: 'artillery_arthur',
          message: 'YOU ARE RUINING MY LIFE! - Artillery Arthur',
          sub: 'GNB Overdraft Protection: Insufficient funds to execute this transaction.',
          session_overdraft_count: user.session_overdraft_count,
        });
      }

      // Personal cap check
      if (user.personal_inventory.length + qty > 6) {
        user.session_overdraft_count += 1;
        await user.save();
        await checkIntervention(socket, user);
        const msgs = [
          'Carl the Bartender is cutting you off! If you buy another drink right now, you are going to wake up with a literal pineapple in your bed and zero memory of how it got there.',
          "CHALLENGE DECLINED. Your coaster is at max capacity. If you keep drinking like this, you're going to end up on the Last Drunk Train out of Manhattan.",
        ];
        return callback?.({ error: 'personal_cap', message: msgs[Math.floor(Math.random() * 2)] });
      }

      // Deduct and add to inventory
      user.gnb_coin_balance -= totalCost;
      user.session_spend_total += totalCost;
      for (let i = 0; i < qty; i++) {
        user.personal_inventory.push({ item_id, item_name: item.name, item_category: item.category, gulps_remaining: 4, acquired_at: new Date() });
      }
      user.transaction_ledger.push({ description: `Purchased ${qty}x ${item.name}`, amount: -totalCost, timestamp: new Date() });
      await user.save();

      // Special effects
      const table_id = socketTable.get(socket.id);
      const displayName = socket.user.display_name;
      if (item.special === 'woo_pitcher' && table_id) {
        io.to(table_id).emit('chat:message', {
          _id: `sys_woo_${Date.now()}`, table_id, user_id: socket.user.user_id,
          display_name: displayName, type: 'woo',
          content: `${displayName} just ordered a Woo! Pitcher! WOOOOOOOOO!`, createdAt: new Date(),
        });
      }
      if (item.special === 'glen_mckenna' && table_id) {
        io.to(table_id).emit('chat:message', {
          _id: `sys_glen_${Date.now()}`, table_id, user_id: socket.user.user_id,
          display_name: displayName, type: 'system',
          content: `${displayName} just opened a bottle of Glen McKenna. Code Red, bro!`, createdAt: new Date(),
        });
      }
      if (item.special === 'best_burger' && table_id) {
        io.to(table_id).emit('chat:message', {
          _id: `sys_burger_${Date.now()}`, table_id, user_id: socket.user.user_id,
          display_name: displayName, type: 'system',
          content: `${displayName} is eating the Best Burger in New York. Regis Philbin wants to know the location.`, createdAt: new Date(),
        });
      }
      if (item.special === 'sandwich') {
        // Immediately set eating_sandwich status for 10 minutes
        userStatuses.set(socket.id, 'idle');
        emitStatusChanged(socket, 'eating_sandwich', table_id);
        const userId = String(socket.user.user_id);
        clearTimeout(sandwichTimers.get(userId));
        const timer = setTimeout(() => {
          sandwichTimers.delete(userId);
          userStatuses.set(socket.id, 'active');
          emitStatusChanged(socket, 'active', table_id);
        }, 600_000);
        sandwichTimers.set(userId, timer);
      }

      callback?.({
        success: true,
        gnb_coin_balance: user.gnb_coin_balance,
        personal_inventory: user.personal_inventory,
        session_spend_total: user.session_spend_total,
        transaction_ledger: user.transaction_ledger,
        item,
      });
    } catch (err) {
      console.error('bar:purchase error', err);
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
      if (finished) {
        inv.splice(item_index, 1);
        user.transaction_ledger.push({ description: `Finished ${itemName}`, amount: 0, timestamp: new Date() });
      }
      await user.save();

      const table_id = socketTable.get(socket.id);
      if (table_id) {
        socket.to(table_id).emit('coaster:gulp_update', {
          user_id: socket.user.user_id, display_name: socket.user.display_name,
          item_index, inv_type, gulps_remaining: finished ? 0 : item.gulps_remaining, finished, item_name: itemName,
        });
      }
      callback?.({ success: true, personal_inventory: user.personal_inventory, offered_inventory: user.offered_inventory, finished });
    } catch (err) {
      callback?.({ error: 'Gulp failed.' });
    }
  });

  // ── drink:offer_send ───────────────────────────────────────────────────────
  socket.on('drink:offer_send', async ({ recipient_user_id, item_index }, callback) => {
    updateActivity(socket.id);
    try {
      const recipientSocketId = userSocketMap.get(String(recipient_user_id));
      if (!recipientSocketId) return callback?.({ error: 'Recipient is not online.' });

      const [sender, recipient] = await Promise.all([
        User.findById(socket.user.user_id),
        User.findById(recipient_user_id),
      ]);
      if (!sender || !recipient) return callback?.({ error: 'User not found.' });
      if (recipient.offered_inventory.length >= 2) {
        return callback?.({ error: 'Transaction failed. Their offered slots are full. They must finish their pending rounds first!' });
      }

      const item = sender.personal_inventory[item_index];
      if (!item) return callback?.({ error: 'Item not found in your inventory.' });

      // Robin Scherbatsky rule
      let displayItemName = item.item_name;
      if (item.item_name.includes('Minnesota Tidal Wave') && recipient.gender === 'Female') {
        displayItemName = 'Robin Scherbatsky';
      }

      const offerId = `offer_${socket.id}_${Date.now()}`;
      pendingOffers.set(offerId, {
        senderSocketId: socket.id, senderUserId: String(socket.user.user_id),
        recipientSocketId, recipientUserId: String(recipient_user_id),
        item: { ...item.toObject(), item_name: displayItemName }, item_index, inv_type: 'personal',
      });

      io.to(recipientSocketId).emit('drink:offer_incoming', {
        offer_id: offerId,
        sender_name: socket.user.display_name,
        item: { ...item.toObject(), item_name: displayItemName },
      });
      callback?.({ success: true, offer_id: offerId });
    } catch (err) {
      callback?.({ error: 'Offer failed.' });
    }
  });

  // ── drink:offer_accept ─────────────────────────────────────────────────────
  socket.on('drink:offer_accept', async ({ offer_id }, callback) => {
    const offer = pendingOffers.get(offer_id);
    if (!offer) return callback?.({ error: 'Offer expired.' });
    pendingOffers.delete(offer_id);
    try {
      const [sender, recipient] = await Promise.all([
        User.findById(offer.senderUserId),
        User.findById(offer.recipientUserId),
      ]);
      if (!sender || !recipient) return callback?.({ error: 'Users not found.' });

      const item = sender.personal_inventory[offer.item_index];
      if (!item) return callback?.({ error: 'Item no longer available.' });

      sender.personal_inventory.splice(offer.item_index, 1);
      sender.transaction_ledger.push({ description: `Offered ${offer.item.item_name} to ${recipient.display_name}`, amount: 0, timestamp: new Date() });

      recipient.offered_inventory.push({ ...item.toObject() });
      recipient.transaction_ledger.push({ description: `Received ${offer.item.item_name} from ${sender.display_name}`, amount: 0, timestamp: new Date() });

      await Promise.all([sender.save(), recipient.save()]);

      // Notify sender
      io.to(offer.senderSocketId).emit('drink:offer_resolved', {
        offer_id, accepted: true,
        personal_inventory: sender.personal_inventory,
        message: `${recipient.display_name} accepted the round!`,
      });
      // Notify recipient
      socket.emit('drink:offer_resolved', {
        offer_id, accepted: true,
        offered_inventory: recipient.offered_inventory,
      });

      // Table broadcast
      const table_id = socketTable.get(socket.id) ?? socketTable.get(offer.senderSocketId);
      if (table_id) {
        io.to(table_id).emit('chat:message', {
          _id: `sys_accept_${Date.now()}`, table_id,
          user_id: socket.user.user_id, display_name: socket.user.display_name,
          content: `🍻 ${recipient.display_name} accepted the round! Bottoms up!`, type: 'system', createdAt: new Date(),
        });
      }
      callback?.({ success: true });
    } catch (err) {
      callback?.({ error: 'Accept failed.' });
    }
  });

  // ── drink:offer_decline ────────────────────────────────────────────────────
  socket.on('drink:offer_decline', async ({ offer_id }, callback) => {
    const offer = pendingOffers.get(offer_id);
    if (!offer) return callback?.({ error: 'Offer expired.' });
    pendingOffers.delete(offer_id);

    const recipient = await User.findById(offer.recipientUserId).select('display_name');
    const recipientName = recipient?.display_name ?? 'Someone';

    io.to(offer.senderSocketId).emit('drink:offer_resolved', {
      offer_id, accepted: false,
      message: `LAWYERED! Your motion to slide a drink has been struck from the record.`,
    });

    const table_id = socketTable.get(socket.id) ?? socketTable.get(offer.senderSocketId);
    if (table_id) {
      io.to(table_id).emit('chat:message', {
        _id: `sys_decline_${Date.now()}`, table_id,
        user_id: socket.user.user_id, display_name: socket.user.display_name,
        content: `🙅 ${recipientName} hit Decline. Denied! Go sit in the corner.`, type: 'system', createdAt: new Date(),
      });
    }
    callback?.({ success: true });
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    console.log(`- ${socket.user.display_name}`);
    cancelPendingOffersForSender(socket.id);
    await leaveRoom(socket);
    lastActivity.delete(socket.id);
    afkFlags.delete(socket.id);
    userStatuses.delete(socket.id);
    userSocketMap.delete(String(socket.user.user_id));
    clearTimeout(sandwichTimers.get(String(socket.user.user_id)));
    sandwichTimers.delete(String(socket.user.user_id));
  });
});

// ─── Intervention helper (called after overdraft/cap increments) ─────────────
async function checkIntervention(socket, user) {
  if (user.session_overdraft_count < 3) return;
  const table_id = socketTable.get(socket.id);
  if (!table_id) return;
  // Freeze signal to the offending user
  socket.emit('intervention:freeze');
  // Table-wide broadcast
  io.to(table_id).emit('chat:message', {
    _id: `sys_int_${Date.now()}`, table_id,
    user_id: socket.user.user_id, display_name: socket.user.display_name,
    content: `🔴 INTERVENTION! The gang has gathered because ${socket.user.display_name} is hoarding too many drinks. Step away from the bar!`,
    type: 'system', createdAt: new Date(),
  });
}

// ─── MongoDB + start ──────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => console.log(`Server on :${PORT}`));
  })
  .catch((err) => { console.error('MongoDB error:', err); process.exit(1); });
