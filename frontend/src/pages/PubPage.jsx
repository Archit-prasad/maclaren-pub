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
import BFHModal from '../components/BFHModal';
import BFHBanner from '../components/BFHBanner';
import BroRequestModal from '../components/BroRequestModal';
import OnboardingTour from '../components/OnboardingTour';

const WASHROOM_TYPES = new Set(["Men's Washroom", "Women's Washroom"]);
const THREE_DAYS_MS = 3 * 86400000;

// ── Public Bar Chat ───────────────────────────────────────────────────────────
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
        <button onClick={send} disabled={!input.trim()} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30" style={{ background: '#FFD800', color: '#000' }}>Send</button>
      </div>
    </div>
  );
}

// ── BFH Initiation UI ─────────────────────────────────────────────────────────
function BFHInitiatePanel({ socket, addToast, triggerShake, onClose }) {
  const { user } = useAuth();
  const [recipientId, setRecipientId] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = () => {
    if (!socket || !recipientId.trim() || loading) return;
    setLoading(true);
    socket.emit('bfh:initiate', { recipient_user_id: recipientId.trim() }, (res) => {
      setLoading(false);
      if (res.error === 'artillery_arthur') { addToast(res.message, 'error'); triggerShake(); return; }
      if (res.error) { addToast(res.error, 'warn'); return; }
      addToast('🎺 Blue French Horn sent! Awaiting response...', 'success');
      onClose();
    });
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-80 rounded-2xl p-6 shadow-2xl" style={{ background: '#001a4d', border: '2px solid #3b82f6' }} onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">🎺</div>
          <h2 className="text-white font-bold text-lg" style={{ fontFamily: 'Georgia, serif' }}>Blue French Horn</h2>
          <p className="text-blue-300 text-xs mt-1">Cost: 2,000 GNB · Cross-gender only · 90-day cooldown on recipient</p>
          <p className="text-amber-400 text-xs mt-0.5">Your balance: {user?.gnb_coin_balance ?? 0} GNB</p>
        </div>
        <input value={recipientId} onChange={e => setRecipientId(e.target.value)}
          placeholder="Recipient User ID"
          className="w-full bg-white/10 border border-blue-500/40 rounded-lg px-3 py-2 text-white text-sm mb-3 outline-none placeholder-white/30" />
        <div className="flex gap-3">
          <button onClick={submit} disabled={loading || !recipientId.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)', color: '#000' }}>
            {loading ? '...' : 'Steal the Horn'}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-white/10 rounded-xl text-sm text-white/60">Cancel</button>
        </div>
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
  const [roomUsers, setRoomUsers] = useState([]);
  const [roomCounts, setRoomCounts] = useState({});
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [barMenuOpen, setBarMenuOpen] = useState(false);
  const [bfhPanelOpen, setBfhPanelOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat');
  const [myStatus, setMyStatus] = useState('active');
  const [userStatuses, setUserStatuses] = useState(new Map());
  const [pendingOffer, setPendingOffer] = useState(null);         // wingman modal
  const [bfhProposal, setBfhProposal] = useState(null);           // incoming BFH modal
  const [bfhWingmanVouchers, setBfhWingmanVouchers] = useState([]);
  const [bfhBroadcast, setBfhBroadcast] = useState(null);         // global banner
  const [wingmanAvailable, setWingmanAvailable] = useState(null); // proposal_id if we're eligible wingman
  const [broRequest, setBroRequest] = useState(null);             // incoming bro request
  const [nakedManOption, setNakedManOption] = useState(null);     // { table_id, table_type } if naked man available
  const [isShaking, setIsShaking] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const shakeRef = useRef(null);
  const freezeRef = useRef(null);
  const coinBalanceRef = useRef(null);
  const floorMapRef = useRef(null);
  const coasterRef = useRef(null);

  useEffect(() => { if (!token) navigate('/login', { replace: true }); }, [token]);

  // Trigger onboarding tour on first login
  useEffect(() => {
    if (user && user.is_first_login) {
      setOnboardingActive(true);
    }
  }, [user?.is_first_login]);

  // BFH theme lock check
  const bfhLocked = user?.bfh_theme_locked_until && Date.now() < new Date(user.bfh_theme_locked_until).getTime();
  const bfhBadge = user?.last_horn_received_at && Date.now() - new Date(user.last_horn_received_at).getTime() < THREE_DAYS_MS;

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    clearTimeout(shakeRef.current);
    shakeRef.current = setTimeout(() => setIsShaking(false), 600);
  }, []);
  const triggerFreeze = useCallback(() => {
    setIsFrozen(true);
    clearTimeout(freezeRef.current);
    freezeRef.current = setTimeout(() => setIsFrozen(false), 3000);
  }, []);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onStatusChanged = ({ user_id, display_name, status, self }) => {
      if (self) setMyStatus(status);
      else setUserStatuses(p => { const n = new Map(p); n.set(String(user_id), { display_name, status }); return n; });
    };
    const onOfferIncoming = (o) => setPendingOffer(o);
    const onOfferCancelled = ({ message }) => { setPendingOffer(null); addToast(message, 'warn'); };
    const onInterventionFreeze = () => triggerFreeze();
    const onUserJoined = ({ users }) => setRoomUsers(users ?? []);
    const onUserLeft = ({ users }) => setRoomUsers(users ?? []);
    // BFH
    const onBFHProposal = (p) => { setBfhProposal(p); setBfhWingmanVouchers([]); };
    const onBFHExpired = () => { setBfhProposal(null); setBfhWingmanVouchers([]); };
    const onBFHGlobalBroadcast = (b) => setBfhBroadcast(b.active ? b : null);
    const onBFHGlobalClear = () => setBfhBroadcast(null);
    const onBFHWingmanAvailable = (w) => setWingmanAvailable(w);
    const onBFHWingmanVouched = ({ wingman_name }) => setBfhWingmanVouchers(v => [...v, wingman_name]);
    const onBFHLeftAtAltar = ({ message }) => { addToast(message, 'warn'); updateUser({ gnb_coin_balance: (user?.gnb_coin_balance ?? 0) + 2000 }); };
    const onBFHThemeLocked = ({ locked_until, profile_title }) => updateUser({ bfh_theme_locked_until: locked_until, profile_title, last_horn_received_at: new Date().toISOString() });
    const onBFHAcceptedNotify = ({ recipient_name }) => addToast(`🎯 ${recipient_name} accepted the horn! Legendary!`, 'success');
    const onBFHDeclinedNotify = ({ recipient_name }) => addToast(`💔 ${recipient_name} declined. Classic Schmosby.`, 'warn');
    // Bro
    const onBroRequestIncoming = (r) => setBroRequest(r);
    const onBroRequestAccepted = ({ display_name, bro_registry_count }) => {
      addToast(`🤝 ${display_name} accepted your Bro Request!`, 'success');
      updateUser({ bro_registry: Array(bro_registry_count).fill(null) }); // rough sync
    };
    const onBroRequestDeclined = ({ sender_name }) => addToast(`${sender_name} declined the Bro Request.`, 'warn');
    const onBroSelf = ({ display_name, bro_registry_count }) => {
      addToast(`🤝 You and ${display_name} are now official Bros!`, 'success');
    };
    const onDibs = ({ declared_by }) => addToast(`🪑 Dibs declared by ${declared_by}!`, 'info');
    const onDoppelganger = ({ user_a, user_b }) => addToast(`🚨 DOPPELGANGER: ${user_a} and ${user_b} look exactly the same! +50 GNB each!`, 'success');

    socket.on('user:status_changed', onStatusChanged);
    socket.on('drink:offer_incoming', onOfferIncoming);
    socket.on('drink:offer_cancelled', onOfferCancelled);
    socket.on('intervention:freeze', onInterventionFreeze);
    socket.on('room:user_joined', onUserJoined);
    socket.on('room:user_left', onUserLeft);
    socket.on('bfh:proposal', onBFHProposal);
    socket.on('bfh:proposal_expired', onBFHExpired);
    socket.on('bfh:global_broadcast', onBFHGlobalBroadcast);
    socket.on('bfh:global_broadcast_clear', onBFHGlobalClear);
    socket.on('bfh:wingman_available', onBFHWingmanAvailable);
    socket.on('bfh:wingman_vouched', onBFHWingmanVouched);
    socket.on('bfh:left_at_altar', onBFHLeftAtAltar);
    socket.on('bfh:theme_locked', onBFHThemeLocked);
    socket.on('bfh:accepted_notify', onBFHAcceptedNotify);
    socket.on('bfh:declined_notify', onBFHDeclinedNotify);
    socket.on('bro:request_incoming', onBroRequestIncoming);
    socket.on('bro:request_accepted', onBroRequestAccepted);
    socket.on('bro:request_declined', onBroRequestDeclined);
    socket.on('bro:request_accepted_self', onBroSelf);
    socket.on('dibs:active', onDibs);
    socket.on('doppelganger:spotted', onDoppelganger);

    return () => {
      socket.off('user:status_changed', onStatusChanged);
      socket.off('drink:offer_incoming', onOfferIncoming);
      socket.off('drink:offer_cancelled', onOfferCancelled);
      socket.off('intervention:freeze', onInterventionFreeze);
      socket.off('room:user_joined', onUserJoined);
      socket.off('room:user_left', onUserLeft);
      socket.off('bfh:proposal', onBFHProposal);
      socket.off('bfh:proposal_expired', onBFHExpired);
      socket.off('bfh:global_broadcast', onBFHGlobalBroadcast);
      socket.off('bfh:global_broadcast_clear', onBFHGlobalClear);
      socket.off('bfh:wingman_available', onBFHWingmanAvailable);
      socket.off('bfh:wingman_vouched', onBFHWingmanVouched);
      socket.off('bfh:left_at_altar', onBFHLeftAtAltar);
      socket.off('bfh:theme_locked', onBFHThemeLocked);
      socket.off('bfh:accepted_notify', onBFHAcceptedNotify);
      socket.off('bfh:declined_notify', onBFHDeclinedNotify);
      socket.off('bro:request_incoming', onBroRequestIncoming);
      socket.off('bro:request_accepted', onBroRequestAccepted);
      socket.off('bro:request_declined', onBroRequestDeclined);
      socket.off('bro:request_accepted_self', onBroSelf);
      socket.off('dibs:active', onDibs);
      socket.off('doppelganger:spotted', onDoppelganger);
    };
  }, [socket]);

  const handleHotspotClick = (hotspot) => setPendingHotspot(hotspot);

  const handleEntryConfirm = () => {
    const hotspot = pendingHotspot;
    setPendingHotspot(null);
    if (WASHROOM_TYPES.has(hotspot.type)) {
      if (activeTable) setActiveTable(null);
      socket?.emit('table:join', { table_id: hotspot.id, table_type: hotspot.type, table_name: hotspot.name },
        ({ error }) => { if (error) addToast(error, 'error'); });
    } else {
      // For chat tables, let TableChatbox do the join — but intercept the full-table case
      setActiveTable({ ...hotspot, _pendingJoin: true });
      setRoomUsers([]);
    }
  };

  const handleLeaveTable = () => { setActiveTable(null); setRoomUsers([]); socket?.emit('table:leave'); };
  const handleLeaveWashroom = () => { socket?.emit('table:leave'); setMyStatus('active'); };

  // Naked Man
  const handleNakedMan = (hotspot) => {
    setNakedManOption(hotspot);
    setPendingHotspot(null);
  };
  const executeNakedMan = () => {
    const h = nakedManOption;
    setNakedManOption(null);
    socket?.emit('table:naked_man', { table_id: h.id, table_type: h.type }, ({ success, error, cooldown_seconds, history, users }) => {
      if (success) {
        setActiveTable(h);
        setRoomUsers(users ?? []);
        addToast('🕴️ The Naked Man works again!', 'success');
      } else {
        addToast(error, 'error');
        if (cooldown_seconds) addToast(`You have a ${Math.ceil(cooldown_seconds / 60)}-minute joining cooldown.`, 'warn');
      }
    });
  };

  // Wingman action
  const actAsWingman = () => {
    if (!socket || !wingmanAvailable) return;
    socket.emit('bfh:wingman', { proposal_id: wingmanAvailable.proposal_id }, (res) => {
      if (res.error) { addToast(res.error, 'warn'); if (res.error === 'artillery_arthur') triggerShake(); }
      else { addToast('✨ Wingman voucher sent! -100 GNB', 'success'); updateUser({ gnb_coin_balance: res.gnb_coin_balance }); }
      setWingmanAvailable(null);
    });
  };

  // BFH respond
  const acceptBFH = () => {
    if (!socket || !bfhProposal) return;
    socket.emit('bfh:respond', { proposal_id: bfhProposal.proposal_id, accepted: true }, () => {});
    setBfhProposal(null);
  };
  const declineBFH = () => {
    if (!socket || !bfhProposal) return;
    socket.emit('bfh:respond', { proposal_id: bfhProposal.proposal_id, accepted: false }, () => {});
    setBfhProposal(null);
  };

  // Bro respond
  const acceptBro = () => {
    if (!socket || !broRequest) return;
    socket.emit('bro:respond', { request_id: broRequest.request_id, accepted: true }, () => {});
    setBroRequest(null);
  };
  const declineBro = () => {
    if (!socket || !broRequest) return;
    socket.emit('bro:respond', { request_id: broRequest.request_id, accepted: false }, () => {});
    setBroRequest(null);
  };

  // Wingman offer modal
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

  // Theme variables (BFH lock = blue scheme)
  const accent = bfhLocked ? '#0000FF' : undefined;
  const accentGlow = bfhLocked ? '0 0 20px #0000ff44' : undefined;

  const TABS = [{ id: 'chat', label: '💬 Chat' }, { id: 'map', label: '🗺 Floor' }, { id: 'coaster', label: '🧾 Coaster' }];

  const floorMap = (
    <PubFloorMap onHotspotClick={handleHotspotClick} roomCounts={roomCounts}
      activeTableId={activeTable?.id} addToast={addToast} onBarOpen={() => setBarMenuOpen(true)} />
  );
  const chatPanel = activeTable
    ? <TableChatbox table={activeTable} onLeave={handleLeaveTable} addToast={addToast}
        userStatuses={userStatuses} socket={socket}
        wingmanAvailableProposal={wingmanAvailable} onActWingman={actAsWingman}
        onNakedManAvailable={handleNakedMan}
        onBroRequest={(targetUserId) => socket?.emit('bro:request', { target_user_id: targetUserId }, (res) => { if (res.error) addToast(res.error, 'warn'); else addToast('🤝 Bro request sent!', 'success'); })} />
    : <GeneralChat socket={socket} />;
  const coasterPanel = <DrinkCoaster roomUsers={roomUsers} addToast={addToast} broRegistry={user?.bro_registry ?? []} />;

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isShaking ? 'screen-shake' : ''}`}
      style={{ background: bfhLocked ? '#000033' : '#0a0d07', boxShadow: accentGlow }}>

      {/* BFH global banner */}
      <BFHBanner broadcast={bfhBroadcast} onBystander={(type) => socket?.emit('bfh:bystander_react', { proposal_id: bfhBroadcast?.proposal_id, reaction_type: type })} />

      {/* Wingman action button */}
      {wingmanAvailable && (
        <div className="fixed top-16 right-4 z-50">
          <button onClick={actAsWingman}
            className="px-4 py-2 rounded-xl text-sm font-black animate-pulse"
            style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)', color: '#000', boxShadow: '0 0 20px #FFD70080' }}>
            ✨ Act as Wingman (-100 GNB)
          </button>
        </div>
      )}

      {/* Topbar */}
      <header className="flex items-center justify-between px-4 py-2 flex-shrink-0 z-20"
        style={{ borderBottom: `1px solid ${bfhLocked ? 'rgba(0,0,255,0.4)' : 'rgba(180,120,40,0.2)'}`, background: bfhLocked ? '#00001a' : '#0d0f08' }}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-wide" style={{ color: bfhLocked ? '#6699ff' : '#fbbf24' }}>
            MacLaren's Pub
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          {bfhBadge && <span className="text-sm" title="Blue French Horn receiver 🎺">🎯</span>}
          {user?.profile_title && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: bfhLocked ? 'rgba(0,0,255,0.2)' : 'rgba(212,168,67,0.15)', color: bfhLocked ? '#99aaff' : '#d4a843', border: `1px solid ${bfhLocked ? 'rgba(0,0,255,0.3)' : 'rgba(212,168,67,0.3)'}` }}>{user.profile_title}</span>}
        </div>
        <div className="flex items-center gap-2">
          {myStatus !== 'active' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(255,216,0,0.12)', border: '1px solid rgba(255,216,0,0.3)', color: '#FFD800' }}>
              <span>
                {(myStatus === 'idle' || myStatus === 'eating_sandwich') && '🥪 Eating a sandwich'}
                {myStatus === 'waiting' && '⏳ Waiting at entrance'}
              </span>
              {(myStatus === 'idle' || myStatus === 'eating_sandwich') && (
                <button onClick={handleLeaveWashroom} className="ml-1 text-white/40 hover:text-white/80">✕</button>
              )}
            </div>
          )}
          <span ref={coinBalanceRef} className="text-xs hidden sm:block" style={{ color: bfhLocked ? '#6699ff' : 'rgba(251,191,36,0.6)' }}>
            🪙 {user?.gnb_coin_balance ?? 0}
          </span>
          <span className="text-white/50 text-xs hidden sm:block">{user?.display_name}</span>
          {/* BFH button */}
          <button onClick={() => setBfhPanelOpen(true)} className="text-lg transition-colors hover:scale-110" title="Blue French Horn Protocol">🎺</button>
          <button onClick={() => setPlaybookOpen(true)} className="text-sm transition-colors" title="The Playbook"
            style={{ color: bfhLocked ? 'rgba(102,153,255,0.7)' : 'rgba(251,191,36,0.6)' }}>📖</button>
        </div>
      </header>

      {isFrozen && <div className="fixed inset-0 z-[55] pointer-events-none"><div className="absolute inset-0 bg-red-900/15 animate-pulse" /></div>}

      {/* Desktop */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div ref={floorMapRef} className="flex-1 overflow-hidden" style={{ borderRight: `1px solid ${bfhLocked ? 'rgba(0,0,255,0.2)' : 'rgba(180,120,40,0.15)'}` }}>{floorMap}</div>
        <div className="w-[320px] flex-shrink-0 overflow-hidden" style={{ borderRight: `1px solid ${bfhLocked ? 'rgba(0,0,255,0.2)' : 'rgba(180,120,40,0.15)'}` }}>{chatPanel}</div>
        <div ref={coasterRef} className="w-[200px] flex-shrink-0 overflow-hidden">{coasterPanel}</div>
      </div>

      {/* Mobile */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {mobileTab === 'chat' && chatPanel}
          {mobileTab === 'map' && floorMap}
          {mobileTab === 'coaster' && coasterPanel}
        </div>
        <div className="flex flex-shrink-0" style={{ borderTop: `1px solid ${bfhLocked ? 'rgba(0,0,255,0.3)' : 'rgba(180,120,40,0.2)'}`, background: bfhLocked ? '#00001a' : '#0d0f08' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setMobileTab(tab.id)}
              className="flex-1 py-3 text-xs font-medium transition-colors"
              style={{ color: mobileTab === tab.id ? (bfhLocked ? '#0000FF' : '#FFD800') : 'rgba(255,255,255,0.3)', borderTop: mobileTab === tab.id ? `2px solid ${bfhLocked ? '#0000FF' : '#FFD800'}` : '2px solid transparent' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Naked Man option */}
      {nakedManOption && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-80 rounded-2xl p-6 text-center shadow-2xl" style={{ background: '#1a0f06', border: '1px solid rgba(212,168,67,0.3)' }}>
            <div className="text-5xl mb-3">🕴️</div>
            <h2 className="text-amber-400 font-bold text-lg mb-2">The Table is Full!</h2>
            <p className="text-white/60 text-sm mb-4">Would you like to attempt <strong className="text-amber-300">The Naked Man Protocol</strong>? 66.6% success rate. No guarantees.</p>
            <div className="flex gap-3">
              <button onClick={executeNakedMan} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: '#FFD800', color: '#000' }}>
                🕴️ Execute Naked Man
              </button>
              <button onClick={() => setNakedManOption(null)} className="flex-1 py-2.5 bg-white/10 rounded-xl text-sm text-white/60">Back Down</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <EntryModal hotspot={pendingHotspot} onConfirm={handleEntryConfirm} onCancel={() => setPendingHotspot(null)} />
      <ThePlaybook isOpen={playbookOpen} onClose={() => setPlaybookOpen(false)} addToast={addToast} triggerShake={triggerShake} />
      <BarMenuModal isOpen={barMenuOpen && !isFrozen} onClose={() => setBarMenuOpen(false)} addToast={addToast} triggerShake={triggerShake} triggerFreeze={triggerFreeze} />
      <WingmanModal offer={pendingOffer} onAccept={acceptOffer} onDecline={declineOffer} />
      <BFHModal proposal={bfhProposal} onAccept={acceptBFH} onDecline={declineBFH} wingmanVouchers={bfhWingmanVouchers} />
      <BroRequestModal request={broRequest} onAccept={acceptBro} onDecline={declineBro} />
      {bfhPanelOpen && <BFHInitiatePanel socket={socket} addToast={addToast} triggerShake={triggerShake} onClose={() => setBfhPanelOpen(false)} />}
      <Toast toasts={toasts} removeToast={removeToast} />
      <OnboardingTour
        isActive={onboardingActive}
        onComplete={() => { setOnboardingActive(false); updateUser({ is_first_login: false }); }}
        token={token}
        coinBalanceRef={coinBalanceRef}
        floorMapRef={floorMapRef}
        coasterRef={coasterRef}
      />
    </div>
  );
}
