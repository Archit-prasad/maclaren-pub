import React, {
  useState, useEffect, useRef, useMemo, useCallback,
} from 'react';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const URL_REGEX = /(https?:\/\/|www\.)[^\s]+/i;
const TILT = ['rotate-[-2deg]','rotate-[-1deg]','rotate-[0deg]','rotate-[1deg]','rotate-[2deg]'];

function polaroidTilt(id) {
  const hash = String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return TILT[hash % TILT.length];
}

// ─── AvatarMenu ───────────────────────────────────────────────────────────────
function AvatarMenu({ user, isMuted, onMute, onIntervention, onClose }) {
  return (
    <div className="absolute top-10 left-0 z-20 bg-[#1a1208] border border-amber-900/40 rounded-xl shadow-2xl p-2 min-w-[170px]" onClick={(e) => e.stopPropagation()}>
      <p className="text-amber-400/70 text-xs px-2 py-1 border-b border-amber-900/30 mb-1 truncate">{user.display_name}</p>
      <button
        onClick={() => { onMute(); onClose(); }}
        className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 hover:bg-white/5 flex items-center gap-2"
      >
        <span className="text-lg">🥽</span>
        {isMuted ? 'Remove Sensory Deprivator' : 'Equip Sensory Deprivator'}
      </button>
      <button
        onClick={() => { onIntervention(); onClose(); }}
        className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 hover:bg-white/5 flex items-center gap-2"
      >
        <span className="text-lg">📋</span>
        Intervention
      </button>
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn, isMuted, onDoubleClick, slapBet }) {
  if (isMuted) return null;

  if (msg.type === 'system') {
    return (
      <div className="text-center text-amber-500/60 text-xs py-1 italic">{msg.content}</div>
    );
  }

  return (
    <div className={`flex gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full overflow-hidden bg-amber-900/40 flex-shrink-0 self-end">
        {msg.avatar_url
          ? <img src={msg.avatar_url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-amber-400">{msg.display_name?.[0]?.toUpperCase()}</div>
        }
      </div>

      <div className={`flex flex-col max-w-[72%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && (
          <span className="text-amber-400/60 text-[10px] mb-1 px-1">{msg.display_name}</span>
        )}

        {msg.type === 'image' && msg.image_url ? (
          /* Polaroid */
          <div
            className={`relative bg-white p-2 pb-6 shadow-lg ${polaroidTilt(msg._id)} cursor-pointer hover:scale-105 transition-transform`}
            onDoubleClick={() => onDoubleClick(msg._id)}
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
          >
            <img src={msg.image_url} alt="polaroid" className="w-36 h-36 object-cover block" />
            {slapBet && (
              <span className="absolute bottom-1 right-1 text-base">🤚</span>
            )}
          </div>
        ) : (
          <div
            className={`relative px-3 py-2 rounded-2xl text-sm cursor-pointer
              ${isOwn
                ? 'bg-amber-700/50 text-white rounded-br-sm'
                : 'bg-[#1e1409] text-white/90 rounded-bl-sm border border-amber-900/30'}`}
            onDoubleClick={() => onDoubleClick(msg._id)}
          >
            {msg.content}
            {slapBet && (
              <span className="absolute -bottom-2 -right-1 text-sm">🤚</span>
            )}
          </div>
        )}

        <span className="text-white/20 text-[9px] mt-0.5 px-1">
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TableChatbox({ table, onLeave, addToast, userStatuses = new Map() }) {
  const { socket } = useSocket();
  const { user, token } = useAuth();

  const [messages, setMessages] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const [input, setInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(true);
  const [showLegendary, setShowLegendary] = useState(false);
  const [urlWarning, setUrlWarning] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [mutedUsers, setMutedUsers] = useState(new Set());
  const [slapBets, setSlapBets] = useState(new Set());
  const [showIntervention, setShowIntervention] = useState(false);
  const [avatarMenu, setAvatarMenu] = useState(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  const showPineapple = useMemo(() => Math.random() < 0.01, []);

  // ── Join room on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !table) return;
    socket.emit('table:join', {
      table_id: table.id,
      table_type: table.type,
      table_name: table.name,
    }, ({ success, error, history, users }) => {
      if (error) { addToast?.(error, 'error'); onLeave?.(); return; }
      setMessages(history ?? []);
      setRoomUsers(users ?? []);
      setHasOlderMessages((history ?? []).length === 50);
      setIsConnecting(false);
      setTimeout(() => { setShowLegendary(true); setTimeout(() => setShowLegendary(false), 600); }, 50);
    });

    const onMessage = (msg) => setMessages((m) => [...m, msg]);
    const onUserJoined = ({ user: u, users }) => {
      setRoomUsers(users);
      setMessages((m) => [...m, { _id: Date.now(), type: 'system', content: `${u.display_name} entered the pub 🍺`, createdAt: new Date() }]);
    };
    const onUserLeft = ({ display_name, users }) => {
      setRoomUsers(users);
      setMessages((m) => [...m, { _id: Date.now() + 1, type: 'system', content: `${display_name} left the pub`, createdAt: new Date() }]);
    };
    const onTyping = ({ user_id, display_name, is_typing }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (is_typing) next.set(user_id, display_name);
        else next.delete(user_id);
        return next;
      });
    };
    const onCarlBan = () => {
      addToast?.("Carl caught you. You've been flagged.", 'error');
    };
    const onAfk = ({ display_name, afk, self }) => {
      if (afk) {
        const label = self ? 'You are' : `${display_name} is`;
        setMessages((m) => [...m, { _id: Date.now() + 2, type: 'system', content: `${label} eating a sandwich 🥪`, createdAt: new Date() }]);
      }
    };

    socket.on('chat:message', onMessage);
    socket.on('room:user_joined', onUserJoined);
    socket.on('room:user_left', onUserLeft);
    socket.on('chat:typing', onTyping);
    socket.on('chat:carl_ban', onCarlBan);
    socket.on('user:afk', onAfk);

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('room:user_joined', onUserJoined);
      socket.off('room:user_left', onUserLeft);
      socket.off('chat:typing', onTyping);
      socket.off('chat:carl_ban', onCarlBan);
      socket.off('user:afk', onAfk);
    };
  }, [socket, table?.id]);

  // ── Disconnect drink-offer cleanup via socket on unmount ──────────────────
  useEffect(() => {
    return () => { socket?.emit('table:leave'); };
  }, [socket]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── URL warning ───────────────────────────────────────────────────────────
  useEffect(() => {
    setUrlWarning(URL_REGEX.test(input));
  }, [input]);

  // ── Typing emit ───────────────────────────────────────────────────────────
  const emitTyping = useCallback((value) => {
    if (!socket) return;
    if (!isTypingRef.current && value) {
      isTypingRef.current = true;
      socket.emit('chat:typing', { table_id: table.id, is_typing: true });
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('chat:typing', { table_id: table.id, is_typing: false });
    }, 1800);
  }, [socket, table?.id]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    emitTyping(e.target.value);
  };

  // ── Send text ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !socket) return;
    if (urlWarning) {
      addToast?.("Carl the bartender is watching. Don't drop flyers in the bar.", 'warn');
      return;
    }
    socket.emit('chat:send', { table_id: table.id, content: text, type: 'text' });
    setInput('');
    isTypingRef.current = false;
    socket.emit('chat:typing', { table_id: table.id, is_typing: false });
  }, [input, socket, table?.id, urlWarning]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg','image/png','image/gif','image/webp'];
    if (!allowed.includes(file.type)) {
      addToast?.('Carl only allows photos. No documents at the bar.', 'warn');
      return;
    }
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const { data } = await axios.post('/api/chat/upload', form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      socket.emit('chat:send', { table_id: table.id, image_url: data.url, type: 'image' });
    } catch {
      addToast?.('Image upload failed.', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // ── Load older messages ───────────────────────────────────────────────────
  const loadOlder = () => {
    if (!socket || loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    socket.emit('chat:load_older', { table_id: table.id, before_id: messages[0]._id }, ({ messages: older, has_more }) => {
      setMessages((m) => [...older, ...m]);
      setHasOlderMessages(has_more);
      setLoadingOlder(false);
    });
  };

  // ── Slap Bet double-click ─────────────────────────────────────────────────
  const handleDoubleClick = (msgId) => {
    setSlapBets((s) => { const n = new Set(s); n.add(msgId); return n; });
  };

  // ── Intervention banner ───────────────────────────────────────────────────
  const triggerIntervention = () => {
    setShowIntervention(true);
    setTimeout(() => setShowIntervention(false), 3000);
  };

  // ── Typing display string ─────────────────────────────────────────────────
  const typingDisplay = [...typingUsers.values()]
    .filter((n) => n !== user?.display_name)
    .slice(0, 2);

  if (isConnecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#100c04]">
        <p className="text-amber-400 text-xl font-bold tracking-widest animate-pulse">
          Wait for it...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#100c04] relative overflow-hidden">

      {/* ── "Legendary!" flash ─────────────────────────────────────────────── */}
      {showLegendary && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <p className="text-[#FFD800] text-4xl font-black tracking-widest" style={{ textShadow: '0 0 30px #FFD80088' }}>
            LEGENDARY!
          </p>
        </div>
      )}

      {/* ── Intervention banner ────────────────────────────────────────────── */}
      {showIntervention && (
        <div
          className="absolute top-0 left-0 right-0 z-40 flex items-center justify-center py-4"
          style={{
            background: '#f5f0e8',
            animation: 'interventionDrop 0.4s cubic-bezier(0.16,1,0.3,1)',
            borderBottom: '4px solid #333',
          }}
        >
          <p className="text-black text-3xl font-black tracking-[0.15em]" style={{ fontFamily: 'Impact, sans-serif' }}>
            INTERVENTION
          </p>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(180,120,40,0.2)', background: '#130f03' }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-semibold text-sm truncate">{table?.name}</span>
            {showPineapple && <span className="text-base" title="">🍍</span>}
          </div>
          <p className="text-amber-600/50 text-[10px]">{table?.type}</p>
        </div>

        {/* Avatar row */}
        <div className="flex items-center -space-x-2 flex-shrink-0">
          {roomUsers.slice(0, 6).map((u) => (
            <div
              key={u.user_id}
              className="relative w-7 h-7 rounded-full border-2 overflow-hidden cursor-pointer flex-shrink-0"
              style={{ borderColor: mutedUsers.has(u.user_id) ? '#6b7280' : '#92400e', background: '#1a1208' }}
              onClick={(e) => { e.stopPropagation(); setAvatarMenu((prev) => prev?.user_id === u.user_id ? null : u); }}
            >
              {u.avatar_url
                ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-amber-500">{u.display_name?.[0]?.toUpperCase()}</div>
              }
              {mutedUsers.has(u.user_id) && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[8px]">🥽</div>
              )}
              {/* Status badge — sandwich for AFK/idle */}
              {(() => {
                const st = userStatuses.get(String(u.user_id))?.status;
                if (st === 'eating_sandwich') return (
                  <div className="absolute -bottom-1 -right-1 text-[9px] leading-none pointer-events-none" title="Eating a sandwich 🥪">🥪</div>
                );
                return null;
              })()}
            </div>
          ))}
          {roomUsers.length > 6 && (
            <div className="w-7 h-7 rounded-full bg-amber-900/40 flex items-center justify-center text-[10px] text-amber-400 border-2 border-amber-900/50 flex-shrink-0">
              +{roomUsers.length - 6}
            </div>
          )}
        </div>

        {/* Avatar menu */}
        {avatarMenu && (
          <AvatarMenu
            user={avatarMenu}
            isMuted={mutedUsers.has(avatarMenu.user_id)}
            onMute={() => setMutedUsers((s) => {
              const n = new Set(s);
              n.has(avatarMenu.user_id) ? n.delete(avatarMenu.user_id) : n.add(avatarMenu.user_id);
              return n;
            })}
            onIntervention={triggerIntervention}
            onClose={() => setAvatarMenu(null)}
          />
        )}

        {/* Leave button */}
        <button
          onClick={onLeave}
          className="text-xs text-red-400/60 hover:text-red-400 transition-colors ml-1 flex-shrink-0"
        >
          Leave
        </button>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
        {hasOlderMessages && (
          <button
            onClick={loadOlder}
            disabled={loadingOlder}
            className="w-full text-center text-amber-600/50 text-xs py-2 hover:text-amber-500 transition-colors"
          >
            {loadingOlder ? 'Loading...' : '↑ Load older messages'}
          </button>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg._id}
            msg={msg}
            isOwn={String(msg.user_id) === String(user?.user_id)}
            isMuted={mutedUsers.has(String(msg.user_id))}
            slapBet={slapBets.has(msg._id)}
            onDoubleClick={handleDoubleClick}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Typing indicator ────────────────────────────────────────────────── */}
      {typingDisplay.length > 0 && (
        <div className="px-4 pb-1">
          <p className="text-amber-600/50 text-[10px] italic">
            {typingDisplay.join(', ')} {typingDisplay.length === 1 ? 'is' : 'are'} telling a story...
          </p>
        </div>
      )}

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-3 py-3"
        style={{ borderTop: '1px solid rgba(180,120,40,0.2)', background: '#130f03' }}
      >
        {urlWarning && (
          <p className="text-red-400 text-[10px] mb-1.5 px-1">
            Carl the bartender is watching. Don't drop flyers in the bar.
          </p>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Say something legendary..."
              className="w-full resize-none rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 outline-none transition-all"
              style={{
                background: '#1a1208',
                border: urlWarning ? '1px solid #ef4444' : '1px solid rgba(180,120,40,0.25)',
                maxHeight: '80px',
                lineHeight: '1.4',
                boxShadow: urlWarning ? '0 0 0 2px rgba(239,68,68,0.2)' : undefined,
              }}
            />
          </div>

          {/* Image attach */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base transition-colors flex-shrink-0"
            style={{ background: '#1a1208', border: '1px solid rgba(180,120,40,0.25)', color: isUploading ? '#f59e0b' : 'rgba(180,120,40,0.6)' }}
            title="Attach Polaroid"
          >
            {isUploading ? '⏳' : '📷'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageUpload} />

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || urlWarning}
            className="h-9 px-4 rounded-xl text-sm font-bold transition-all flex-shrink-0 disabled:opacity-30"
            style={{ background: '#FFD800', color: '#000' }}
          >
            Send
          </button>
        </div>
      </div>

      {/* Intervention keyframe injected inline */}
      <style>{`
        @keyframes interventionDrop {
          from { transform: translateY(-100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
