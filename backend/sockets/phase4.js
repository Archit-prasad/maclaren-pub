const User = require('../models/User');
const Table = require('../models/Table');

// ─── Murtaugh helper ──────────────────────────────────────────────────────────
async function checkMurtaugh(userId, level) {
  const key = `murtaugh_list_progress.${level}`;
  const updated = await User.findOneAndUpdate(
    { _id: userId, [key]: false },
    { $set: { [key]: true } },
    { new: true }
  );
  if (!updated) return;
  const all10 = Object.values(updated.murtaugh_list_progress).every(v => v === true);
  if (all10) {
    await User.findByIdAndUpdate(userId, {
      $set: { profile_title: '[Too Old For This]' }
    });
  }
}

// ─── BFH expired / left at altar ─────────────────────────────────────────────
async function bfhExpire(proposalId, state, io) {
  const proposal = state.pendingBFH.get(proposalId);
  if (!proposal) return;
  state.pendingBFH.delete(proposalId);
  clearTimeout(state.bfhTimers.get(proposalId));
  state.bfhTimers.delete(proposalId);
  io.emit('bfh:global_broadcast_clear', { proposal_id: proposalId });

  await User.findByIdAndUpdate(proposal.senderUserId, {
    $inc: { gnb_coin_balance: 2000 },
    $push: { transaction_ledger: { description: 'BFH Refund — Left at the Altar', amount: 2000, timestamp: new Date() } },
  });

  const senderSock = io.sockets.sockets.get(proposal.senderSocketId);
  senderSock?.emit('bfh:left_at_altar', {
    message: "👰 Network Disruption! You've been left at the altar. The recipient disappeared into thin air. Your 2,000 GNB coins have been safely refunded.",
    gnb_refund: 2000,
  });
  if (proposal.recipientSocketId) {
    io.to(proposal.recipientSocketId).emit('bfh:proposal_expired', { proposal_id: proposalId });
  }
}

// ─── Daily spend tracker ──────────────────────────────────────────────────────
async function trackDailySpend(userId, amount) {
  const today = new Date().toISOString().slice(0, 10);
  const user = await User.findById(userId).select('daily_spend_total last_spend_date murtaugh_list_progress');
  const dailyTotal = user.last_spend_date === today ? user.daily_spend_total + amount : amount;
  await User.findByIdAndUpdate(userId, { $set: { daily_spend_total: dailyTotal, last_spend_date: today } });
  if (dailyTotal >= 500) await checkMurtaugh(userId, 'level_9');
}

// ─── Register all Phase 4 socket events ──────────────────────────────────────
module.exports = function registerPhase4Events(socket, io, state) {
  const { rooms, socketTable, userSocketMap, pendingBFH, bfhTimers, bfhWingmanWindows,
          pendingBroRequests, dibsLocks, sessionBeerCount } = state;

  function getRoomUsers(table_id) {
    return rooms.has(table_id) ? [...rooms.get(table_id).users.values()] : [];
  }

  // ─── BFH: INITIATE ─────────────────────────────────────────────────────────
  socket.on('bfh:initiate', async ({ recipient_user_id }, callback) => {
    try {
      if (String(socket.user.user_id) === String(recipient_user_id))
        return callback({ error: 'You cannot propose to yourself. Even Ted had limits.' });

      const [sender, recipient] = await Promise.all([
        User.findById(socket.user.user_id),
        User.findById(recipient_user_id),
      ]);
      if (!sender || !recipient) return callback({ error: 'User not found.' });

      if (!sender.gender || !recipient.gender)
        return callback({ error: 'Please set your gender in The Playbook settings to use this feature.' });
      if (sender.gender === recipient.gender)
        return callback({ error: 'Error: The Blue French Horn is strictly reserved for cross-gender, over-the-top grand romantic gestures.' });
      if (recipient.last_horn_received_at && Date.now() - recipient.last_horn_received_at < 90 * 86400000)
        return callback({ error: 'Transaction Blocked: The Platinum Rule dictates this user is on a 3-month romantic cooldown period.' });
      if (sender.gnb_coin_balance < 2000)
        return callback({ error: 'artillery_arthur', message: 'YOU ARE RUINING MY LIFE! - Artillery Arthur', sub: 'GNB Overdraft Protection: Insufficient funds to execute this transaction.' });

      // Article 1: Bros Before Hoes check
      const table_id = socketTable.get(socket.id);
      if (table_id) {
        const senderBroIds = sender.bro_registry.map(id => String(id));
        for (const tu of getRoomUsers(table_id)) {
          if (!senderBroIds.includes(String(tu.user_id))) continue;
          const bro = await User.findById(tu.user_id).select('personal_inventory offered_inventory');
          if (bro && bro.personal_inventory.length === 0 && bro.offered_inventory.length === 0)
            return callback({ error: 'Article 1 Violation: You are prioritizing a romantic gesture over your Bro. Barney is watching.' });
        }
      }

      // Deduct 2000 GNB
      sender.gnb_coin_balance -= 2000;
      sender.transaction_ledger.push({ description: 'Blue French Horn Proposal', amount: -2000, timestamp: new Date() });
      await sender.save();
      await trackDailySpend(sender._id, 2000);

      const proposalId = `bfh_${socket.id}_${Date.now()}`;
      const recipientSocketId = userSocketMap.get(String(recipient_user_id));

      pendingBFH.set(proposalId, {
        proposalId, senderSocketId: socket.id,
        senderUserId: String(socket.user.user_id), senderName: socket.user.display_name,
        recipientSocketId, recipientUserId: String(recipient_user_id),
        recipientName: recipient.display_name, table_id, wingmanVouchers: [],
      });

      // 30-second timeout
      bfhTimers.set(proposalId, setTimeout(() => bfhExpire(proposalId, state, io), 30000));

      // Global broadcast to all sockets
      io.emit('bfh:global_broadcast', {
        proposal_id: proposalId,
        sender_name: socket.user.display_name,
        recipient_name: recipient.display_name,
        active: true,
      });

      // Emit proposal to recipient
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('bfh:proposal', { proposal_id: proposalId, sender_name: socket.user.display_name });
      }

      // Article 100: Wingman button to bros at same table
      if (table_id) {
        const senderBroIds = sender.bro_registry.map(id => String(id));
        for (const tu of getRoomUsers(table_id)) {
          if (senderBroIds.includes(String(tu.user_id)) && tu.socket_id !== socket.id) {
            io.to(tu.socket_id).emit('bfh:wingman_available', {
              proposal_id: proposalId, sender_name: socket.user.display_name, recipient_name: recipient.display_name,
            });
          }
        }
      }

      if (state.bfhStats) state.bfhStats.total++;
      io.to('admin_feed').emit('admin:bfh_event', { type: 'initiated', sender: socket.user.display_name, recipient: recipient.display_name });
      callback({ success: true, gnb_coin_balance: sender.gnb_coin_balance });
    } catch (err) {
      console.error('bfh:initiate', err);
      callback({ error: 'BFH initiation failed.' });
    }
  });

  // ─── BFH: RESPOND ─────────────────────────────────────────────────────────
  socket.on('bfh:respond', async ({ proposal_id, accepted }, callback) => {
    const proposal = pendingBFH.get(proposal_id);
    if (!proposal) return callback?.({ error: 'Proposal expired or not found.' });

    clearTimeout(bfhTimers.get(proposal_id));
    bfhTimers.delete(proposal_id);
    pendingBFH.delete(proposal_id);
    io.emit('bfh:global_broadcast_clear', { proposal_id });

    const table_id = proposal.table_id;
    try {
      if (accepted) {
        const threeDays = new Date(Date.now() + 3 * 86400000);
        await User.findByIdAndUpdate(proposal.recipientUserId, {
          $set: {
            last_horn_received_at: new Date(),
            profile_title: '[Blue french horn reciever]',
            bfh_theme_locked_until: threeDays,
          },
        });

        if (table_id) {
          io.to(table_id).emit('chat:message', {
            _id: `bfh_acc_${Date.now()}`, table_id, type: 'bfh_accept',
            user_id: proposal.senderUserId, display_name: 'System', createdAt: new Date(),
            content: `🎯 THE BLUE FRENCH HORN HAS DELIVERED! ${proposal.senderName} went full Ted Mosby and stole the restaurant decor. ${proposal.recipientName} accepted! True love wins, or whatever. Cue the string instruments!`,
          });
        }

        // Push theme lock to recipient's session
        io.to(proposal.recipientSocketId).emit('bfh:theme_locked', {
          locked_until: threeDays.toISOString(),
          profile_title: '[Blue french horn reciever]',
        });
        if (state.bfhStats) state.bfhStats.accepted++;
        io.to('admin_feed').emit('admin:bfh_event', { type: 'accepted', sender: proposal.senderName, recipient: proposal.recipientName });
        io.to(proposal.senderSocketId).emit('bfh:accepted_notify', { recipient_name: proposal.recipientName });

      } else {
        // Declined — zero refund, Murtaugh level 6 for sender
        if (state.bfhStats) state.bfhStats.declined++;
        io.to('admin_feed').emit('admin:bfh_event', { type: 'declined', sender: proposal.senderName, recipient: proposal.recipientName });
        await checkMurtaugh(proposal.senderUserId, 'level_6');
        if (table_id) {
          io.to(table_id).emit('chat:message', {
            _id: `bfh_dec_${Date.now()}`, table_id, type: 'system',
            user_id: proposal.senderUserId, display_name: 'System', createdAt: new Date(),
            content: `💔 CLASSIC SCHMOSBY! ${proposal.senderName} confessed their love on the first date and ${proposal.recipientName} was not having it. The horn has been returned to the wall.`,
          });
        }
        io.to(proposal.senderSocketId).emit('bfh:declined_notify', { recipient_name: proposal.recipientName });
      }
      callback?.({ success: true });
    } catch (err) {
      callback?.({ error: 'Response failed.' });
    }
  });

  // ─── BFH: WINGMAN ─────────────────────────────────────────────────────────
  socket.on('bfh:wingman', async ({ proposal_id }, callback) => {
    const proposal = pendingBFH.get(proposal_id);
    if (!proposal) return callback?.({ error: 'Proposal expired.' });

    const wingman = await User.findById(socket.user.user_id);
    if (!wingman || wingman.gnb_coin_balance < 100)
      return callback?.({ error: 'artillery_arthur', message: 'YOU ARE RUINING MY LIFE! - Artillery Arthur', sub: 'Insufficient funds for wingman support.' });

    wingman.gnb_coin_balance -= 100;
    wingman.transaction_ledger.push({ description: 'Act as Wingman (BFH)', amount: -100, timestamp: new Date() });
    await wingman.save();

    proposal.wingmanVouchers.push(socket.user.display_name);

    // Update recipient's modal
    if (proposal.recipientSocketId) {
      io.to(proposal.recipientSocketId).emit('bfh:wingman_vouched', {
        proposal_id, wingman_name: socket.user.display_name,
        message: `${socket.user.display_name} vouches for this gesture! He's a good guy, accept it!`,
      });
    }

    // Murtaugh level 8
    await checkMurtaugh(socket.user.user_id, 'level_8');
    callback?.({ success: true, gnb_coin_balance: wingman.gnb_coin_balance });
  });

  // ─── BFH: BYSTANDER REACT ─────────────────────────────────────────────────
  socket.on('bfh:bystander_react', ({ proposal_id, reaction_type }) => {
    const table_id = socketTable.get(socket.id) ?? 'pub_general';
    const content = reaction_type === 'clap'
      ? `👏 ${socket.user.display_name} applauds the gesture!`
      : `${socket.user.display_name}: "Honestly, that thing looks like a Smurf penis."`;
    io.to(table_id).emit('chat:message', {
      _id: `byst_${Date.now()}`, table_id, type: 'system',
      user_id: socket.user.user_id, display_name: socket.user.display_name, createdAt: new Date(), content,
    });
  });

  // ─── BRO: REQUEST ─────────────────────────────────────────────────────────
  socket.on('bro:request', async ({ target_user_id }, callback) => {
    const myTableId = socketTable.get(socket.id);
    const targetSocketId = userSocketMap.get(String(target_user_id));
    const targetTableId = targetSocketId ? socketTable.get(targetSocketId) : null;

    if (!targetSocketId || myTableId !== targetTableId || !myTableId)
      return callback?.({ error: 'You can only send a Bro Request to someone at the same table.' });

    const [me, target] = await Promise.all([
      User.findById(socket.user.user_id),
      User.findById(target_user_id),
    ]);
    if (!me || !target) return callback?.({ error: 'User not found.' });
    if (me.bro_registry.length >= 50) return callback?.({ error: 'Your Bro Registry is full (50 max).' });
    if (target.bro_registry.length >= 50) return callback?.({ error: "Their Bro Registry is full." });

    const requestId = `bro_${socket.id}_${Date.now()}`;
    pendingBroRequests.set(requestId, {
      requestId, senderSocketId: socket.id,
      senderUserId: String(socket.user.user_id), senderName: socket.user.display_name,
      targetSocketId, targetUserId: String(target_user_id),
    });

    io.to(targetSocketId).emit('bro:request_incoming', {
      request_id: requestId, sender_name: socket.user.display_name,
    });
    callback?.({ success: true });
  });

  // ─── BRO: RESPOND ─────────────────────────────────────────────────────────
  socket.on('bro:respond', async ({ request_id, accepted }, callback) => {
    const req = pendingBroRequests.get(request_id);
    if (!req) return callback?.({ error: 'Request expired.' });
    pendingBroRequests.delete(request_id);

    if (!accepted) {
      io.to(req.senderSocketId).emit('bro:request_declined', { sender_name: req.senderName });
      return callback?.({ success: true });
    }

    const [me, sender] = await Promise.all([
      User.findById(req.targetUserId),
      User.findById(req.senderUserId),
    ]);
    if (!me || !sender) return callback?.({ error: 'User not found.' });

    const senderObjId = sender._id;
    const meObjId = me._id;
    if (!me.bro_registry.some(id => String(id) === String(senderObjId)))
      me.bro_registry.push(senderObjId);
    if (!sender.bro_registry.some(id => String(id) === String(meObjId)))
      sender.bro_registry.push(meObjId);

    await Promise.all([me.save(), sender.save()]);

    io.to(req.senderSocketId).emit('bro:request_accepted', {
      display_name: me.display_name,
      bro_registry_count: sender.bro_registry.length,
    });
    socket.emit('bro:request_accepted_self', {
      display_name: sender.display_name,
      bro_registry_count: me.bro_registry.length,
    });

    const table_id = socketTable.get(socket.id);
    if (table_id) {
      io.to(table_id).emit('chat:message', {
        _id: `bro_${Date.now()}`, table_id, type: 'system',
        user_id: socket.user.user_id, display_name: 'System', createdAt: new Date(),
        content: `🤝 ${req.senderName} and ${me.display_name} are now official Bros! The thumb-lick oath has been sworn.`,
      });
    }
    callback?.({ success: true });
  });

  // ─── DIBS: DECLARE ────────────────────────────────────────────────────────
  socket.on('dibs:declare', async ({ table_id }, callback) => {
    const me = await User.findById(socket.user.user_id).select('last_dibs_used_at');
    if (me.last_dibs_used_at && Date.now() - me.last_dibs_used_at < 7 * 86400000)
      return callback?.({ error: 'You have already declared Dibs this week. Wait for the cooldown.' });

    const lockKey = `${table_id}_dibs`;
    if (dibsLocks.has(lockKey))
      return callback?.({ error: 'Dibs is already active on this table.' });

    me.last_dibs_used_at = new Date();
    await me.save();

    dibsLocks.set(lockKey, { userId: String(socket.user.user_id), expiry: Date.now() + 60000 });
    setTimeout(() => dibsLocks.delete(lockKey), 60000);

    io.to(table_id).emit('chat:message', {
      _id: `dibs_${Date.now()}`, table_id, type: 'system',
      user_id: socket.user.user_id, display_name: socket.user.display_name, createdAt: new Date(),
      content: `🪑 Dibs has been declared over the seat. It is reserved for a minute.`,
    });
    io.to(table_id).emit('dibs:active', { table_id, declared_by: socket.user.display_name, expires_in: 60 });
    callback?.({ success: true });
  });

  // ─── MURTAUGH: EXTERNAL TRIGGERS (called from server.js handlers) ─────────
  // Export helpers for server.js to call
  socket._checkMurtaugh = checkMurtaugh;
  socket._trackDailySpend = trackDailySpend;
};

// Export helpers for use in server.js top-level handlers
module.exports.checkMurtaugh = checkMurtaugh;
module.exports.trackDailySpend = trackDailySpend;
module.exports.bfhExpire = bfhExpire;
