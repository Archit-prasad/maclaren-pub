import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import PubFloorMap from '../components/PubFloorMap';
import TableChatbox from '../components/TableChatbox';
import DrinkCoaster from '../components/DrinkCoaster';
import EntryModal from '../components/EntryModal';
import ThePlaybook from '../components/ThePlaybook';
import BarMenuModal from '../components/BarMenuModal';
import WingmanModal from '../components/WingmanModal';

const WASHROOM_TYPES = new Set(["Men's Washroom", "Women's Washroom"]);

// ── Public (General) Bar Chat ─────────────────────────────────────────────────
function GeneralChat({ socket }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    socket.emit('pub:enter');
    const onMsg = (msg) => { if (msg.table_id === 'pub_general') setMessages(m => [...m.slice(-200), msg]); };
    socket.on('chat:message', onMsg);
    return () => socket.off('chat:message', onMsg);
  }, [socket]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || !socket) return;
    socket.emit('chat:send', { table_id: 'pub_general', content: text, type: 'text' });
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-[#0e0b03]">
      <div className="px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(180,120,40,0.15)' }}>
        <p className="text-amber-400/70 text-xs font-semibold tracking-widest uppercase">MacLaren's Bar</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {messages.length === 0 && <p className="text-white/15 text-xs text-center pt-4 italic">The bar is quiet... for now.</p>}
        {messages.map((msg, i) => (
          <div key={msg._id ?? i} className="flex gap-2 items-start">
            <span className="text-amber-600/70 text-[10px] font-semibold flex-shrink-0 mt-0.5">{msg.display_name}</span>
            <span className="text-white/70 text-xs">{msg.content}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="px-3 py-2 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid rgba(180,120,40,0.15)' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Shout across the bar..."
          className="flex-1 bg-[#1a1208] border border-amber-900/25 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none" />
        <button onClick={send} disabled={!input.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30"
          style={{ background: '#FFD800', color: '#000' }}>Send</button>
      </div>
    </div>
  );
}

// ─── PubPage ──────────────────────────────────────────────────────────────────
export default function PubPage() {
  const { user, token, updateUser } = useAuth();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();

  const [pendingHotspot, setPendingHotspot] = useState(null);
  const [activeTable, setActiveTable] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);  // users at current table (for coaster offer list)
  const [roomCounts, setRoomCounts] = useState({});
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [barMenuOpen, setBarMenuOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat');
  const [myStatus, setMyStatus] = useState('active');
  const [userStatuses, setUserStatuses] = useState(new Map());
  const [pendingOffer, setPendingOffer] = useState(null); // incoming wingman offer
  const [isShaking, setIsShaking] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);   // intervention freeze
  const shakeTimerRef = useRef(null);
  const freezeTimerRef = useRef(null);

  useEffect(() => { if (!token) navigate('/login', { replace: true }); }, [token]);

  // ── Screen shake ───────────────────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    setIsShaking(true);
    clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => setIsShaking(false), 600);
  }, []);

  // ── Intervention freeze ────────────────────────────────────────────────────
  const triggerFreeze = useCallback(() => {
    setIsFrozen(true);
    addToast('🔴 INTERVENTION! Step away from the bar!', 'error');
    clearTimeout(freezeTimerRef.current);
    freezeTimerRef.current = setTimeout(() => setIsFrozen(false), 3000);
  }, []);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onStatusChanged = ({ user_id, display_name, status, self }) => {
      if (self) setMyStatus(status);
      else setUserStatuses(prev => { const n = new Map(prev); n.set(String(user_id), { display_name, status }); return n; });
    };
    const onOfferIncoming = (offer) => setPendingOffer(offer);
    const onOfferCancelled = ({ message }) => { setPendingOffer(null); addToast(message, 'warn'); };
    const onInterventionFreeze = () => triggerFreeze();
    const onUserJoined = ({ users }) => setRoomUsers(users ?? []);
    const onUserLeft = ({ users }) => setRoomUsers(users ?? []);

    socket.on('user:status_changed', onStatusChanged);
    socket.on('drink:offer_incoming', onOfferIncoming);
    socket.on('drink:offer_cancelled', onOfferCancelled);
    socket.on('intervention:freeze', onInterventionFreeze);
    socket.on('room:user_joined', onUserJoined);
    socket.on('room:user_left', onUserLeft);

    return () => {
      socket.off('user:status_changed', onStatusChanged);
      socket.off('drink:offer_incoming', onOfferIncoming);
      socket.off('drink:offer_cancelled', onOfferCancelled);
      socket.off('intervention:freeze', onInterventionFreeze);
      socket.off('room:user_joined', onUserJoined);
      socket.off('room:user_left', onUserLeft);
    };
  }, [socket]);

  // ── Hotspot / entry handlers ───────────────────────────────────────────────
  const handleHotspotClick = (hotspot) => setPendingHotspot(hotspot);

  const handleEntryConfirm = () => {
    const hotspot = pendingHotspot;
    setPendingHotspot(null);
    if (WASHROOM_TYPES.has(hotspot.type)) {
      if (activeTable) setActiveTable(null);
      socket?.emit('table:join', { table_id: hotspot.id, table_type: hotspot.type, table_name: hotspot.name },
        ({ error }) => { if (error) addToast(error, 'error'); });
    } else {
      setActiveTable(hotspot);
      setRoomUsers([]);
    }
  };

  const handleLeaveTable = () => { setActiveTable(null); setRoomUsers([]); socket?.emit('table:leave'); };
  const handleLeaveWashroom = () => { socket?.emit('table:leave'); setMyStatus('active'); };

  // ── Wingman accept / decline ───────────────────────────────────────────────
  const acceptOffer = () => {
    if (!socket || !pendingOffer) return;
    socket.emit('drink:offer_accept', { offer_id: pendingOffer.offer_id }, (res) => {
      if (res.error) addToast(res.error, 'error');
      else { updateUser({ offered_inventory: res.offered_inventory ?? user?.offered_inventory }); addToast('🍻 Round accepted!', 'success'); }
    });
    setPendingOffer(null);
  };
  const declineOffer = () => {
    if (!socket || !pendingOffer) return;
    socket.emit('drink:offer_decline', { offer_id: pendingOffer.offer_id }, () => {});
    setPendingOffer(null);
  };

  const TABS = [{ id: 'chat', label: '💬 Chat' }, { id: 'map', label: '🗺 Floor' }, { id: 'coaster', label: '🧾 Coaster' }];

  const floorMap = (
    <PubFloorMap onHotspotClick={handleHotspotClick} roomCounts={roomCounts}
      activeTableId={activeTable?.id} addToast={addToast} onBarOpen={() => setBarMenuOpen(true)} />
  );
  const chatPanel = activeTable
    ? <TableChatbox table={activeTable} onLeave={handleLeaveTable} addToast={addToast} userStatuses={userStatuses} />
    : <GeneralChat socket={socket} />;
  const coasterPanel = <DrinkCoaster roomUsers={roomUsers} addToast={addToast} />;

  return (
    <div className={`h-screen flex flex-col bg-[#0a0d07] overflow-hidden ${isShaking ? 'screen-shake' : ''}`}>

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2 flex-shrink-0 z-20"
        style={{ borderBottom: '1px solid rgba(180,120,40,0.2)', background: '#0d0f08' }}>
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-sm tracking-wide">MacLaren's Pub</span>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        <div className="flex items-center gap-3">
          {myStatus !== 'active' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(255,216,0,0.12)', border: '1px solid rgba(255,216,0,0.3)', color: '#FFD800' }}>
              <span>
                {(myStatus === 'idle' || myStatus === 'eating_sandwich') && '🥪 Eating a sandwich'}
                {myStatus === 'waiting' && '⏳ Waiting at entrance'}
              </span>
              {(myStatus === 'idle' || myStatus === 'eating_sandwich') && (
                <button onClick={handleLeaveWashroom} className="ml-1 text-white/40 hover:text-white/80" title="Leave washroom">✕</button>
              )}
            </div>
          )}
          <span className="text-amber-400/60 text-xs hidden sm:block">🪙 {user?.gnb_coin_balance ?? 0}</span>
          <span className="text-white/50 text-xs hidden sm:block">{user?.display_name}</span>
          <button onClick={() => setPlaybookOpen(true)} className="text-amber-400/60 hover:text-amber-400 text-sm transition-colors" title="The Playbook">📖</button>
        </div>
      </header>

      {/* ── Intervention freeze overlay ──────────────────────────────────────── */}
      {isFrozen && (
        <div className="fixed inset-0 z-[55] pointer-events-none">
          <div className="absolute inset-0 bg-red-900/15 animate-pulse" />
        </div>
      )}

      {/* ── Desktop (md+): 3-column ──────────────────────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden" style={{ borderRight: '1px solid rgba(180,120,40,0.15)' }}>{floorMap}</div>
        <div className="w-[320px] flex-shrink-0 overflow-hidden" style={{ borderRight: '1px solid rgba(180,120,40,0.15)' }}>{chatPanel}</div>
        <div className="w-[200px] flex-shrink-0 overflow-hidden">{coasterPanel}</div>
      </div>

      {/* ── Mobile: tabs ──────────────────────────────────────────────────────── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {mobileTab === 'chat' && chatPanel}
          {mobileTab === 'map' && floorMap}
          {mobileTab === 'coaster' && coasterPanel}
        </div>
        <div className="flex flex-shrink-0" style={{ borderTop: '1px solid rgba(180,120,40,0.2)', background: '#0d0f08' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setMobileTab(tab.id)}
              className="flex-1 py-3 text-xs font-medium transition-colors"
              style={{ color: mobileTab === tab.id ? '#FFD800' : 'rgba(255,255,255,0.3)', borderTop: mobileTab === tab.id ? '2px solid #FFD800' : '2px solid transparent' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <EntryModal hotspot={pendingHotspot} onConfirm={handleEntryConfirm} onCancel={() => setPendingHotspot(null)} />
      <ThePlaybook isOpen={playbookOpen} onClose={() => setPlaybookOpen(false)} addToast={addToast} triggerShake={triggerShake} />
      <BarMenuModal isOpen={barMenuOpen && !isFrozen} onClose={() => setBarMenuOpen(false)} addToast={addToast} triggerShake={triggerShake} triggerFreeze={triggerFreeze} />
      <WingmanModal offer={pendingOffer} onAccept={acceptOffer} onDecline={declineOffer} />
      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
