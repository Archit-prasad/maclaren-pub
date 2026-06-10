import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import PubFloorMap from '../components/PubFloorMap';
import TableChatbox from '../components/TableChatbox';
import CoasterPlaceholder from '../components/CoasterPlaceholder';
import EntryModal from '../components/EntryModal';
import ThePlaybook from '../components/ThePlaybook';

const WASHROOM_TYPES = new Set(["Men's Washroom", "Women's Washroom"]);

// ── Public (General) Chat using pub_general room ──────────────────────────────
function GeneralChat({ socket, user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    socket.emit('pub:enter');
    const onMsg = (msg) => setMessages((m) => [...m.slice(-200), msg]);
    socket.on('chat:message', (msg) => {
      if (msg.table_id === 'pub_general') onMsg(msg);
    });
    return () => socket.off('chat:message');
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
        {messages.length === 0 && (
          <p className="text-white/15 text-xs text-center pt-4 italic">The bar is quiet... for now.</p>
        )}
        {messages.map((msg, i) => (
          <div key={msg._id ?? i} className="flex gap-2 items-start">
            <span className="text-amber-600/70 text-[10px] font-semibold flex-shrink-0 mt-0.5">{msg.display_name}</span>
            <span className="text-white/70 text-xs">{msg.content}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="px-3 py-2 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid rgba(180,120,40,0.15)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Shout across the bar..."
          className="flex-1 bg-[#1a1208] border border-amber-900/25 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none"
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 transition-colors"
          style={{ background: '#FFD800', color: '#000' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ─── PubPage ──────────────────────────────────────────────────────────────────
export default function PubPage() {
  const { user, token } = useAuth();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();

  const [pendingHotspot, setPendingHotspot] = useState(null);
  const [activeTable, setActiveTable] = useState(null);
  const [roomCounts, setRoomCounts] = useState({});
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat');
  // 'active' | 'idle' | 'waiting' | 'eating_sandwich'
  const [myStatus, setMyStatus] = useState('active');
  // userId(string) → { display_name, status }
  const [userStatuses, setUserStatuses] = useState(new Map());

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token]);

  // Listen for status changes from the server
  useEffect(() => {
    if (!socket) return;
    const onStatusChanged = ({ user_id, display_name, status, self }) => {
      if (self) {
        setMyStatus(status);
      } else {
        setUserStatuses((prev) => {
          const next = new Map(prev);
          next.set(String(user_id), { display_name, status });
          return next;
        });
      }
    };
    socket.on('user:status_changed', onStatusChanged);
    return () => socket.off('user:status_changed', onStatusChanged);
  }, [socket]);

  // Bar Counter + Jukebox are fully handled inside PubFloorMap and never reach here
  const handleHotspotClick = (hotspot) => {
    setPendingHotspot(hotspot);
  };

  const handleEntryConfirm = () => {
    const hotspot = pendingHotspot;
    setPendingHotspot(null);

    if (WASHROOM_TYPES.has(hotspot.type)) {
      // Emit table:join for status tracking — no chatbox opens
      if (activeTable) setActiveTable(null); // leave current table visually
      socket?.emit('table:join', {
        table_id: hotspot.id,
        table_type: hotspot.type,
        table_name: hotspot.name,
      }, ({ error }) => {
        if (error) addToast(error, 'error');
        // myStatus will update via user:status_changed → 'eating_sandwich'
      });
    } else {
      setActiveTable(hotspot);
    }
  };

  const handleLeaveTable = () => {
    setActiveTable(null);
    socket?.emit('table:leave');
  };

  const handleLeaveWashroom = () => {
    socket?.emit('table:leave');
    setMyStatus('active');
  };

  const TABS = [
    { id: 'chat',    label: '💬 Chat' },
    { id: 'map',     label: '🗺 Floor' },
    { id: 'coaster', label: '🧾 Coaster' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#0a0d07] overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-4 py-2 flex-shrink-0 z-20"
        style={{ borderBottom: '1px solid rgba(180,120,40,0.2)', background: '#0d0f08' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-sm tracking-wide">MacLaren's Pub</span>
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors ${connected ? 'bg-green-500' : 'bg-red-500'}`}
            title={connected ? 'Connected' : 'Disconnected'}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Status pill — only visible when not 'active' */}
          {myStatus !== 'active' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(255,216,0,0.12)', border: '1px solid rgba(255,216,0,0.3)', color: '#FFD800' }}
            >
              <span>
                {myStatus === 'idle' || myStatus === 'eating_sandwich' ? '🥪 Eating a sandwich' : ''}
                {myStatus === 'waiting' ? '⏳ Waiting at entrance' : ''}
              </span>
              {(myStatus === 'idle' || myStatus === 'eating_sandwich') && (
                <button
                  onClick={handleLeaveWashroom}
                  className="ml-1 text-white/40 hover:text-white/80 leading-none transition-colors"
                  title="Leave washroom"
                >✕</button>
              )}
            </div>
          )}
          <span className="text-amber-400/60 text-xs hidden sm:block">
            🪙 {user?.gnb_coin_balance ?? 0}
          </span>
          <span className="text-white/50 text-xs hidden sm:block">{user?.display_name}</span>
          <button
            onClick={() => setPlaybookOpen(true)}
            className="text-amber-400/60 hover:text-amber-400 text-sm transition-colors"
            title="The Playbook"
          >
            📖
          </button>
        </div>
      </header>

      {/* ── Desktop layout (md+): floor map | chat | coaster ─────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Floor map */}
        <div className="flex-1 overflow-hidden" style={{ borderRight: '1px solid rgba(180,120,40,0.15)' }}>
          <PubFloorMap
            onHotspotClick={handleHotspotClick}
            roomCounts={roomCounts}
            activeTableId={activeTable?.id}
            addToast={addToast}
          />
        </div>

        {/* Chat panel — general or table */}
        <div className="w-[320px] flex flex-col overflow-hidden flex-shrink-0" style={{ borderRight: '1px solid rgba(180,120,40,0.15)' }}>
          {activeTable ? (
            <TableChatbox
              table={activeTable}
              onLeave={handleLeaveTable}
              addToast={addToast}
              userStatuses={userStatuses}
            />
          ) : (
            <GeneralChat socket={socket} user={user} />
          )}
        </div>

        {/* Coaster */}
        <div className="w-[160px] overflow-hidden flex-shrink-0">
          <CoasterPlaceholder />
        </div>
      </div>

      {/* ── Mobile layout (<md): tab interface ───────────────────────────────── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === 'chat' && (
            activeTable
              ? <TableChatbox table={activeTable} onLeave={handleLeaveTable} addToast={addToast} />
              : <GeneralChat socket={socket} user={user} />
          )}
          {mobileTab === 'map' && (
            <PubFloorMap
              onHotspotClick={handleHotspotClick}
              roomCounts={roomCounts}
              activeTableId={activeTable?.id}
              addToast={addToast}
            />
          )}
          {mobileTab === 'coaster' && <CoasterPlaceholder />}
        </div>

        {/* Bottom tab bar */}
        <div
          className="flex flex-shrink-0"
          style={{ borderTop: '1px solid rgba(180,120,40,0.2)', background: '#0d0f08' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className="flex-1 py-3 text-xs font-medium transition-colors"
              style={{
                color: mobileTab === tab.id ? '#FFD800' : 'rgba(255,255,255,0.3)',
                borderTop: mobileTab === tab.id ? '2px solid #FFD800' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Modals & overlays ─────────────────────────────────────────────────── */}
      <EntryModal
        hotspot={pendingHotspot}
        onConfirm={handleEntryConfirm}
        onCancel={() => setPendingHotspot(null)}
      />
      <ThePlaybook isOpen={playbookOpen} onClose={() => setPlaybookOpen(false)} />
      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
