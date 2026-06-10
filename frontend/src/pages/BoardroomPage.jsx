import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

const API = (path, token) => ({ headers: { Authorization: `Bearer ${token}` }, url: `/api/admin${path}` });

function TabBtn({ id, active, onClick, children }) {
  return (
    <button onClick={() => onClick(id)}
      className="px-5 py-2.5 text-sm font-semibold transition-colors"
      style={{ color: active ? '#FFD800' : 'rgba(255,255,255,0.4)', borderBottom: active ? '2px solid #FFD800' : '2px solid transparent' }}>
      {children}
    </button>
  );
}

// ── Tab 1: MacLaren's Ledger ──────────────────────────────────────────────────
function LedgerTab({ token, socket }) {
  const [tables, setTables] = useState([]);
  const [txFeed, setTxFeed] = useState([]);
  const [bfhStats, setBfhStats] = useState({ total: 0, accepted: 0, declined: 0 });
  const [consumptionQuery, setConsumptionQuery] = useState({ user: '', date: '' });
  const [consumptionData, setConsumptionData] = useState([]);
  const feedRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const [t, b, tx] = await Promise.all([
        axios.get('/api/admin/tables', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/admin/bfh-stats', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/admin/transactions', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setTables(t.data.tables ?? []);
      setBfhStats(b.data);
      setTxFeed((tx.data.transactions ?? []).slice(0, 50));
    };
    load().catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    const onTx = (tx) => setTxFeed(f => [tx, ...f].slice(0, 100));
    const onConn = () => axios.get('/api/admin/tables', { headers: { Authorization: `Bearer ${token}` } }).then(r => setTables(r.data.tables ?? [])).catch(() => {});
    const onBFH = ({ type }) => setBfhStats(s => ({
      ...s, total: s.total + (type === 'initiated' ? 1 : 0),
      accepted: s.accepted + (type === 'accepted' ? 1 : 0),
      declined: s.declined + (type === 'declined' ? 1 : 0),
    }));
    socket.on('admin:transaction', onTx);
    socket.on('admin:user_connected', onConn);
    socket.on('admin:bfh_event', onBFH);
    return () => { socket.off('admin:transaction', onTx); socket.off('admin:user_connected', onConn); socket.off('admin:bfh_event', onBFH); };
  }, [socket]);

  const queryConsumption = async () => {
    const { data } = await axios.get('/api/admin/consumption', {
      params: consumptionQuery,
      headers: { Authorization: `Bearer ${token}` },
    });
    setConsumptionData(data.results ?? []);
  };

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Online Users', value: tables.reduce((s, t) => s + t.user_count, 0) },
          { label: 'Active Tables', value: tables.length },
          { label: 'BFH Proposals', value: bfhStats.total },
          { label: 'BFH Accepted', value: `${bfhStats.accepted} / ${bfhStats.total}` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,216,0,0.06)', border: '1px solid rgba(255,216,0,0.15)' }}>
            <p className="text-2xl font-black text-amber-400">{value}</p>
            <p className="text-white/40 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Table population map */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-amber-400/70 text-xs font-semibold tracking-widest uppercase mb-3">Table Population Map</p>
          {tables.length === 0 && <p className="text-white/25 text-xs italic">No active tables.</p>}
          {tables.map(t => (
            <div key={t.table_id} className="flex items-center justify-between py-1.5 border-b border-white/5">
              <div>
                <p className="text-white/70 text-xs">{t.type}</p>
                <p className="text-white/30 text-[10px]">{t.users.map(u => u.display_name).join(', ')}</p>
              </div>
              <span className="text-amber-400 text-xs font-bold">{t.user_count} users</span>
            </div>
          ))}
        </div>

        {/* Live transaction feed */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-amber-400/70 text-xs font-semibold tracking-widest uppercase mb-3">Live GNB Feed</p>
          <div ref={feedRef} className="space-y-1 max-h-52 overflow-y-auto">
            {txFeed.map((tx, i) => (
              <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-white/5">
                <span className="text-white/50 flex-1 truncate mr-2">{tx.display_name} — {tx.description}</span>
                <span className={`font-bold flex-shrink-0 ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>{tx.amount > 0 ? '+' : ''}{tx.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily consumption */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-amber-400/70 text-xs font-semibold tracking-widest uppercase mb-3">Daily Consumption Metrics</p>
        <div className="flex gap-3 mb-3">
          <input value={consumptionQuery.user} onChange={e => setConsumptionQuery(q => ({ ...q, user: e.target.value }))}
            placeholder="Search by username" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none" />
          <input type="date" value={consumptionQuery.date} onChange={e => setConsumptionQuery(q => ({ ...q, date: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none" />
          <button onClick={queryConsumption} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: '#FFD800', color: '#000' }}>Search</button>
        </div>
        {consumptionData.map(r => (
          <div key={r.display_name} className="flex justify-between items-center text-xs py-1.5 border-b border-white/5">
            <span className="text-white/70">{r.display_name}</span>
            <span className="text-amber-400">{r.purchase_count} purchases · {r.total_spent} GNB spent</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab 2: Grinch Filter ─────────────────────────────────────────────────────
function GrinchTab({ token }) {
  const [keywords, setKeywords] = useState([]);
  const [newKw, setNewKw] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => axios.get('/api/admin/keywords', { headers: { Authorization: `Bearer ${token}` } }).then(r => setKeywords(r.data.keywords ?? [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newKw.trim()) return;
    setLoading(true);
    try {
      await axios.post('/api/admin/keywords', { keyword: newKw.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      setNewKw('');
      await load();
    } catch (err) {
      alert(err.response?.data?.message ?? 'Failed to add keyword');
    } finally { setLoading(false); }
  };

  const remove = async (id) => {
    await axios.delete(`/api/admin/keywords/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-amber-400/70 text-xs font-semibold tracking-widest uppercase mb-3">The Grinch Filter</p>
        <p className="text-white/30 text-xs mb-4">Banned keywords are fuzzy-matched (character substitutions, spaces between letters) and replaced with *** in all chat messages before broadcast.</p>
        <div className="flex gap-3 mb-4">
          <input value={newKw} onChange={e => setNewKw(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="New banned keyword..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500/50" />
          <button onClick={add} disabled={loading || !newKw.trim()}
            className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40" style={{ background: '#ef4444', color: '#fff' }}>
            Add Ban
          </button>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {keywords.length === 0 && <p className="text-white/20 text-xs italic">No banned keywords yet.</p>}
          {keywords.map(kw => (
            <div key={kw._id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span className="text-red-300 text-xs font-mono">{kw.keyword}</span>
              <button onClick={() => remove(kw._id)} className="text-red-400/60 hover:text-red-400 text-xs transition-colors">Remove</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Intervention Board ─────────────────────────────────────────────────
function InterventionTab({ token, socket }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [fineAmount, setFineAmount] = useState('');
  const [fineReason, setFineReason] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const search = async () => {
    const { data } = await axios.get('/api/admin/users/search', { params: { q: query }, headers: { Authorization: `Bearer ${token}` } });
    setResults(data.users ?? []);
  };

  const fine = async () => {
    const amt = parseInt(fineAmount);
    if (!amt || amt <= 0 || !selected) return;
    await axios.post(`/api/admin/users/${selected._id}/fine`, { amount: amt, reason: fineReason || undefined }, { headers: { Authorization: `Bearer ${token}` } });
    setActionMsg(`✅ Fined ${selected.display_name} ${amt} GNB.`);
    setFineAmount(''); setFineReason('');
  };

  const ban = async () => {
    if (!selected || !window.confirm(`Ban ${selected.display_name}? This cannot be undone.`)) return;
    await axios.post(`/api/admin/users/${selected._id}/ban`, {}, { headers: { Authorization: `Bearer ${token}` } });
    setActionMsg(`🚪 ${selected.display_name} has been banned and disconnected.`);
    setSelected(null); setResults([]);
  };

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="flex gap-3">
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search by username..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
        <button onClick={search} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: '#FFD800', color: '#000' }}>Search</button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map(u => (
            <button key={u._id} onClick={() => { setSelected(u); setActionMsg(''); }}
              className="w-full text-left px-4 py-3 rounded-xl transition-colors"
              style={{ background: selected?._id === u._id ? 'rgba(255,216,0,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selected?._id === u._id ? 'rgba(255,216,0,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
              <div className="flex justify-between items-center">
                <span className="text-white font-semibold text-sm">{u.display_name}</span>
                <div className="flex gap-2">
                  <span className="text-amber-400 text-xs">🪙 {u.gnb_coin_balance}</span>
                  {u.is_banned && <span className="text-red-400 text-xs">BANNED</span>}
                  {u.is_admin && <span className="text-purple-400 text-xs">ADMIN</span>}
                </div>
              </div>
              <p className="text-white/40 text-xs mt-0.5">{u.email}</p>
            </button>
          ))}
        </div>
      )}

      {/* Selected user actions */}
      {selected && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold">{selected.display_name}</h3>
            <div className="text-xs text-white/40">Overdrafts: {selected.session_overdraft_count}</div>
          </div>

          {/* Commissioner's Fine */}
          <div className="space-y-2">
            <p className="text-amber-400/70 text-xs uppercase tracking-widest">The Commissioner's Fine</p>
            <div className="flex gap-2">
              <input type="number" min="1" value={fineAmount} onChange={e => setFineAmount(e.target.value)}
                placeholder="Amount (GNB)" className="w-32 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none" />
              <input value={fineReason} onChange={e => setFineReason(e.target.value)}
                placeholder="Reason (optional)" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none" />
              <button onClick={fine} disabled={!fineAmount}
                className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                style={{ background: 'rgba(245,158,11,0.8)', color: '#000' }}>
                Deduct GNB
              </button>
            </div>
          </div>

          {/* Ban */}
          <div>
            <p className="text-amber-400/70 text-xs uppercase tracking-widest mb-2">Call Doug the Bouncer</p>
            <button onClick={ban}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-colors"
              style={{ background: selected.is_banned ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: selected.is_banned ? '#86efac' : '#fca5a5', border: `1px solid ${selected.is_banned ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
              {selected.is_banned ? '✅ Already Banned' : '🚪 Ban User'}
            </button>
          </div>

          {actionMsg && <p className="text-green-400 text-xs mt-2">{actionMsg}</p>}
        </div>
      )}
    </div>
  );
}

// ── Main Boardroom Page ───────────────────────────────────────────────────────
export default function BoardroomPage() {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [tab, setTab] = useState('ledger');

  useEffect(() => {
    if (!token) { navigate('/login', { replace: true }); return; }
    if (user && !user.is_admin) { navigate('/', { replace: true }); }
  }, [user, token]);

  if (!user?.is_admin) return null;

  return (
    <div className="min-h-screen bg-[#080a05] text-white">
      <header className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,216,0,0.15)', background: '#0a0d07' }}>
        <div>
          <h1 className="text-amber-400 font-bold text-xl tracking-wide">The Boardroom</h1>
          <p className="text-white/30 text-xs">Admin Dashboard · {user.display_name}</p>
        </div>
        <button onClick={() => navigate('/pub')} className="text-xs text-white/40 hover:text-white/70 transition-colors">← Back to Pub</button>
      </header>

      <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <TabBtn id="ledger" active={tab === 'ledger'} onClick={setTab}>📊 MacLaren's Ledger</TabBtn>
        <TabBtn id="grinch" active={tab === 'grinch'} onClick={setTab}>🎄 Grinch Filter</TabBtn>
        <TabBtn id="intervention" active={tab === 'intervention'} onClick={setTab}>⚖️ Intervention Board</TabBtn>
      </div>

      <div className="px-6 py-6 max-w-5xl mx-auto">
        {tab === 'ledger' && <LedgerTab token={token} socket={socket} />}
        {tab === 'grinch' && <GrinchTab token={token} />}
        {tab === 'intervention' && <InterventionTab token={token} socket={socket} />}
      </div>
    </div>
  );
}
