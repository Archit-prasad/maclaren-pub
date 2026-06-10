import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

const GULP_LABEL = { 4: '100%', 3: '75%', 2: '50%', 1: '25%', 0: 'Empty' };
const GULP_COLOR = { 4: '#22c55e', 3: '#86efac', 2: '#facc15', 1: '#f97316', 0: '#ef4444' };

// ─── Single item on the coaster ───────────────────────────────────────────────
function CoasterItem({ item, index, invType, roomUsers, onGulp, onOffer, isGulping }) {
  const pct = GULP_LABEL[item.gulps_remaining] ?? '0%';
  const color = GULP_COLOR[item.gulps_remaining] ?? '#ef4444';
  const tablemates = (roomUsers ?? []).filter(u => u.user_id !== item.user_id);

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.15)' }}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <p className="text-white text-xs font-semibold leading-tight flex-1">{item.item_name}</p>
        <span className="text-[9px] font-bold flex-shrink-0" style={{ color }}>{pct}</span>
      </div>

      {/* Gulp bar */}
      <div className="w-full h-1.5 rounded-full bg-white/10 mb-2">
        <div
          className="h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(item.gulps_remaining / 4) * 100}%`, background: color }}
        />
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={() => onGulp(index, invType)}
          disabled={item.gulps_remaining === 0 || isGulping}
          className="flex-1 py-1 rounded-lg text-[10px] font-semibold transition-colors disabled:opacity-30"
          style={{ background: item.gulps_remaining > 0 ? 'rgba(34,197,94,0.2)' : 'transparent', color: '#86efac', border: '1px solid rgba(34,197,94,0.25)' }}
        >
          {item.gulps_remaining > 0 ? '👄 Gulp' : 'Finished'}
        </button>
        {invType === 'personal' && tablemates.length > 0 && (
          <OfferButton item={item} index={index} tablemates={tablemates} onOffer={onOffer} />
        )}
      </div>
    </div>
  );
}

function OfferButton({ item, index, tablemates, onOffer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="py-1 px-2 rounded-lg text-[10px] transition-colors"
        style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}
      >
        Offer→
      </button>
      {open && (
        <div
          className="absolute bottom-full right-0 mb-1 rounded-xl py-1 min-w-[140px] z-10 shadow-2xl"
          style={{ background: '#1a0f06', border: '1px solid rgba(212,168,67,0.25)' }}
        >
          {tablemates.map(u => (
            <button
              key={u.user_id}
              onClick={() => { onOffer(index, u.user_id); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 truncate"
            >
              → {u.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main DrinkCoaster ────────────────────────────────────────────────────────
export default function DrinkCoaster({ roomUsers = [], addToast }) {
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();
  const [gulping, setGulping] = useState(false);

  const personalInv = user?.personal_inventory ?? [];
  const offeredInv = user?.offered_inventory ?? [];
  const sessionSpend = user?.session_spend_total ?? 0;
  const cheerleader = personalInv.length >= 4;

  // Gulp handler
  const handleGulp = (index, invType) => {
    if (!socket || gulping) return;
    setGulping(true);
    socket.emit('coaster:gulp', { item_index: index, inv_type: invType }, (res) => {
      setGulping(false);
      if (res.error) { addToast?.(res.error, 'error'); return; }
      updateUser({ personal_inventory: res.personal_inventory, offered_inventory: res.offered_inventory });
      if (res.finished) addToast?.(`✅ Finished that one!`, 'success');
    });
  };

  // Offer handler
  const handleOffer = (itemIndex, recipientUserId) => {
    if (!socket) return;
    socket.emit('drink:offer_send', { recipient_user_id: recipientUserId, item_index: itemIndex }, (res) => {
      if (res.error) { addToast?.(res.error, 'warn'); return; }
      addToast?.('🍺 Wingman Protocol initiated!', 'success');
    });
  };

  // Listen for offer resolved (sender side)
  useEffect(() => {
    if (!socket) return;
    const onResolved = ({ accepted, message, personal_inventory }) => {
      if (message) addToast?.(message, accepted ? 'success' : 'warn');
      if (personal_inventory) updateUser({ personal_inventory });
    };
    socket.on('drink:offer_resolved', onResolved);
    return () => socket.off('drink:offer_resolved', onResolved);
  }, [socket]);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#0e0b03' }}>
      {/* Header */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(180,120,40,0.15)' }}>
        <div className="flex items-center justify-between">
          <p className="text-amber-400/70 text-xs font-semibold tracking-widest uppercase">My Coaster</p>
          <span className="text-amber-400 text-xs font-bold">🪙 {user?.gnb_coin_balance ?? 0}</span>
        </div>
        {sessionSpend > 700 && (
          <div className="mt-2 px-2 py-1 rounded-lg text-[10px] text-yellow-300 bg-yellow-900/30 border border-yellow-700/40">
            ⚠️ Warning: Spending limits approaching. Do not make us open the Box of Shame.
          </div>
        )}
        {(user?.gnb_coin_balance ?? 1) === 0 && (
          <p className="mt-1 text-white/25 text-[9px] text-center italic">Current Location: Dowisetrepla</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {/* Offered inventory */}
        {offeredInv.length > 0 && (
          <>
            <p className="text-white/30 text-[10px] uppercase tracking-widest px-1">Offered Rounds</p>
            {offeredInv.map((item, i) => (
              <CoasterItem key={`off_${i}`} item={item} index={i} invType="offered"
                roomUsers={roomUsers} onGulp={handleGulp} onOffer={handleOffer} isGulping={gulping} />
            ))}
          </>
        )}

        {/* Personal inventory */}
        <p className="text-white/30 text-[10px] uppercase tracking-widest px-1">
          My Drinks ({personalInv.length}/6)
        </p>
        {personalInv.length === 0 && (
          <p className="text-white/15 text-xs text-center py-4 italic">Coaster is empty. Hit the bar!</p>
        )}
        {personalInv.map((item, i) => (
          <CoasterItem key={`per_${i}`} item={item} index={i} invType="personal"
            roomUsers={roomUsers} onGulp={handleGulp} onOffer={handleOffer} isGulping={gulping} />
        ))}

        {/* Cheerleader Effect */}
        {cheerleader && (
          <p className="text-center text-white/30 text-[10px] italic pt-1 px-2">
            Status: The Cheerleader Effect Active (These look way better as a group)
          </p>
        )}
      </div>
    </div>
  );
}
