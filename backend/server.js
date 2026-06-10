require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const Message = require('./models/Message');

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
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Capacity matrix ─────────────────────────────────────────────────────────
const CAPACITY = {
  'Big Corner Sofa':  13,
  'Standard Sofa':    7,
  'Long Table A':     6,
  'Long Table B':     5,
  'Medium Table':     4,
  'Small Table':      3,
  'Solo Table':       2,
  'Waiting Sofa':     2,
  "Men's Washroom":   Infinity,
  "Women's Washroom": Infinity,
  'Bar Counter':      null,
  'Jukebox':          null,
};

// ─── In-memory room state ─────────────────────────────────────────────────────
// table_id → { users: Map<socketId, userInfo>, type: string }
const rooms = new Map();
// socketId → table_id
const socketTable = new Map();
// socketId → last activity timestamp
const lastActivity = new Map();
// socketId → boolean (afk flag, to avoid repeat broadcasts)
const afkFlags = new Map();
// socketId → 'active' | 'idle' | 'waiting' | 'eating_sandwich'
const userStatuses = new Map();

function updateActivity(socketId) {
  lastActivity.set(socketId, Date.now());
  if (afkFlags.get(socketId)) afkFlags.set(socketId, false);
}

// Broadcast a status change to the socket itself, pub_general, and optionally one extra room
function emitStatusChanged(socket, status, extraRoomId = null) {
  const io = global._io;
  if (!io || !socket?.user) return;
  const payload = { user_id: socket.user.user_id, display_name: socket.user.display_name, status };
  try { socket.emit('user:status_changed', { ...payload, self: true }); } catch {}
  io.to('pub_general').emit('user:status_changed', payload);
  if (extraRoomId) io.to(extraRoomId).emit('user:status_changed', payload);
}

function getRoomUsers(table_id) {
  return rooms.has(table_id) ? [...rooms.get(table_id).users.values()] : [];
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
  // Reset status to active and notify
  userStatuses.set(socket.id, 'active');
  emitStatusChanged(socket, 'active');
}

// Mock ban — Phase 5 admin dashboard will connect this to DB
async function executeUserBan(userId, reason) {
  console.warn(`[MOCK BAN] user_id=${userId} reason="${reason}"`);
}

// ─── AFK watchdog — runs every 60 s ──────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  const TEN_MIN = 10 * 60 * 1000;
  for (const [socketId, socket] of (global._io?.sockets?.sockets ?? new Map())) {
    // Washroom (idle) users are already showing the sandwich status via immediate emit on join
    if ((userStatuses.get(socketId) ?? 'active') === 'idle') continue;

    const last = lastActivity.get(socketId) ?? now;
    const isAfk = now - last >= TEN_MIN;
    const wasAfk = afkFlags.get(socketId) ?? false;
    if (isAfk === wasAfk) continue;

    afkFlags.set(socketId, isAfk);
    const status = isAfk ? 'eating_sandwich' : 'active';
    const table_id = socketTable.get(socketId);

    // user:afk drives the system message in TableChatbox
    const afkPayload = { user_id: socket.user?.user_id, display_name: socket.user?.display_name, afk: isAfk };
    if (table_id) socket.to(table_id).emit('user:afk', afkPayload);
    socket.emit('user:afk', { ...afkPayload, self: true });

    // user:status_changed drives the status badge in PubPage / TableChatbox
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
  console.log(`+ ${socket.user.display_name} (${socket.id})`);

  // Auto-join pub general channel
  socket.join('pub_general');

  // ── pub:enter ──────────────────────────────────────────────────────────────
  socket.on('pub:enter', () => {
    updateActivity(socket.id);
  });

  // ── table:join ─────────────────────────────────────────────────────────────
  socket.on('table:join', async ({ table_id, table_type, table_name }, callback) => {
    updateActivity(socket.id);
    if (!table_id || !table_type) return callback?.({ error: 'Invalid table.' });

    // Capacity check
    if (!rooms.has(table_id)) rooms.set(table_id, { users: new Map(), type: table_type });
    const room = rooms.get(table_id);
    const cap = CAPACITY[table_type];
    if (cap !== null && cap !== Infinity && room.users.size >= cap) {
      return callback?.({ error: 'This table is currently full.' });
    }

    // Capture previous room before leaving (for targeted status broadcast)
    const previousTableId = socketTable.get(socket.id);

    // Leave current table first (emits 'active' status internally)
    await leaveRoom(socket);

    // Join
    socket.join(table_id);
    const statusMap = {
      "Men's Washroom": 'idle', "Women's Washroom": 'idle', 'Waiting Sofa': 'waiting',
    };
    const userInfo = {
      socket_id: socket.id,
      user_id: socket.user.user_id,
      display_name: socket.user.display_name,
      avatar_url: socket.user.avatar_url ?? '',
      status: statusMap[table_type] ?? 'active',
    };
    room.users.set(socket.id, userInfo);
    socketTable.set(socket.id, table_id);
    userStatuses.set(socket.id, userInfo.status);

    // Idle (washroom) → immediately becomes "eating a sandwich" per spec
    if (userInfo.status === 'idle') {
      emitStatusChanged(socket, 'eating_sandwich', previousTableId);
      // Also inject a system message into the previous table's chat so tablemates see it
      if (previousTableId) {
        global._io?.to(previousTableId).emit('chat:message', {
          _id: `sys_${Date.now()}`,
          table_id: previousTableId,
          user_id: socket.user.user_id,
          display_name: socket.user.display_name,
          content: `${socket.user.display_name} is eating a sandwich 🥪`,
          type: 'system',
          createdAt: new Date(),
        });
      }
    }

    // Fetch last 50 messages
    const history = await Message.find({ table_id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

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
    // Must be in the room they're sending to
    if (socketTable.get(socket.id) !== table_id && table_id !== 'pub_general') return;

    // Carl URL block
    if (type === 'text') {
      const urlPattern = /(https?:\/\/|www\.)[^\s]+/i;
      if (urlPattern.test(content ?? '')) {
        await executeUserBan(socket.user.user_id, 'URL submission in chat');
        socket.emit('chat:carl_ban');
        return callback?.({ error: 'Banned by Carl.' });
      }
    }

    const message = await Message.create({
      table_id,
      user_id: socket.user.user_id,
      display_name: socket.user.display_name,
      avatar_url: socket.user.avatar_url ?? '',
      content: content?.trim() ?? '',
      image_url: image_url ?? '',
      type,
    });

    io.to(table_id).emit('chat:message', message.toObject());
    callback?.({ success: true, message_id: message._id });
  });

  // ── chat:typing ────────────────────────────────────────────────────────────
  socket.on('chat:typing', ({ table_id, is_typing }) => {
    updateActivity(socket.id);
    socket.to(table_id).emit('chat:typing', {
      user_id: socket.user.user_id,
      display_name: socket.user.display_name,
      is_typing,
    });
  });

  // ── chat:load_older ────────────────────────────────────────────────────────
  socket.on('chat:load_older', async ({ table_id, before_id }, callback) => {
    const msgs = await Message.find({ table_id, _id: { $lt: before_id } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    callback?.({ messages: msgs.reverse(), has_more: msgs.length === 50 });
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    console.log(`- ${socket.user.display_name} (${socket.id})`);
    await leaveRoom(socket);
    lastActivity.delete(socket.id);
    afkFlags.delete(socket.id);
    userStatuses.delete(socket.id);
  });
});

// ─── MongoDB + start ──────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => console.log(`Server on :${PORT}`));
  })
  .catch((err) => { console.error('MongoDB error:', err); process.exit(1); });
