import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const G = '#d4a843';
const Gf = (o) => `rgba(212,168,67,${o})`;

export default function ThePlaybook({ isOpen, onClose, addToast, triggerShake }) {
  const { user, token, logout, updateUser } = useAuth();
  const [section, setSection] = useState('profile');
  const [ledger, setLedger] = useState([]);
  const [claiming, setClaiming] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(user?.gnb_coin_balance ?? 0);
  const animRef = useRef(null);

  // Keep displayed balance in sync + count-up animation
  useEffect(() => {
    const target = user?.gnb_coin_balance ?? 0;
    const start = displayBalance;
    if (start === target) return;
    const diff = target - start;
    const steps = 25;
    let step = 0;
    clearInterval(animRef.current);
    animRef.current = setInterval(() => {
      step++;
      setDisplayBalance(Math.round(start + (diff * step) / steps));
      if (step >= steps) clearInterval(animRef.current);
    }, 18);
    return () => clearInterval(animRef.current);
  }, [user?.gnb_coin_balance]);

  // Load ledger when section opens
  useEffect(() => {
    if (section !== 'ledger' || !token) return;
    axios.get('/api/coins/ledger', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { setLedger(r.data.transaction_ledger ?? []); updateUser({ gnb_coin_balance: r.data.gnb_coin_balance, session_spend_total: r.data.session_spend_total }); })
      .catch(() => {});
  }, [section, token]);

  const claim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const { data } = await axios.post('/api/coins/claim', {}, { headers: { Authorization: `Bearer ${token}` } });
      updateUser({ gnb_coin_balance: data.gnb_coin_balance });
      if (data.is_lucky_penny) {
        addToast?.('You found a 1939 Lucky Penny! You got 110 GNB instead of 100. Don\'t miss your flight!', 'success');
      } else {
        addToast?.('High Six! +100 GNB claimed! 🙌', 'success');
      }
      // Refresh ledger
      const r = await axios.get('/api/coins/ledger', { headers: { Authorization: `Bearer ${token}` } });
      setLedger(r.data.transaction_ledger ?? []);
    } catch (err) {
      addToast?.(err.response?.data?.message ?? 'Claim failed.', 'warn');
    } finally {
      setClaiming(false);
    }
  };

  const shreddit = async () => {
    try {
      await axios.delete('/api/coins/ledger', { headers: { Authorization: `Bearer ${token}` } });
      setLedger([]);
      addToast?.('Corporate compliance achieved. No paper trail remains.', 'success');
    } catch { addToast?.('Shreddit failed.', 'error'); }
  };

  const aldrinJustice = async () => {
    try {
      const { data } = await axios.post('/api/coins/aldrin_justice', {}, { headers: { Authorization: `Bearer ${token}` } });
      updateUser({ gnb_coin_balance: data.gnb_coin_balance });
      setLedger(data.transaction_ledger ?? []);
      addToast?.('Aldrin Justice Administered. Coins Returned.', 'success');
    } catch (err) { addToast?.(err.response?.data?.message ?? 'No transactions to reverse.', 'warn'); }
  };

  const buyABar = () => {
    triggerShake?.();
    addToast?.('YOU ARE RUINING MY LIFE! - Artillery Arthur', 'error');
    setTimeout(() => addToast?.('GNB Overdraft Protection: Insufficient funds to execute this transaction.', 'error'), 250);
  };

  if (!isOpen) return null;

  const SECTIONS = ['profile', 'account', 'ledger'];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-80 z-50 flex flex-col shadow-2xl"
        style={{ background: 'linear-gradient(160deg,#2c1a0e 0%,#1a0f06 40%,#110900 100%)', borderLeft: `2px solid ${Gf(0.35)}`, fontFamily: '"Georgia","Times New Roman",serif' }}>

        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${Gf(0.4)}` }}>
          <div>
            <h2 className="text-lg font-bold tracking-wide" style={{ color: G }}>The Playbook</h2>
            <p className="text-xs mt-0.5" style={{ color: Gf(0.55) }}>Personal Settings</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-lg" style={{ color: Gf(0.6), border: `1px solid ${Gf(0.2)}` }}>✕</button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-4 gap-1.5">
          {SECTIONS.map(s => (
            <button key={s} onClick={() => setSection(s)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
              style={{ background: section === s ? Gf(0.2) : 'transparent', color: section === s ? G : Gf(0.4), border: section === s ? `1px solid ${Gf(0.35)}` : '1px solid transparent' }}>
              {s}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Profile ───────────────────────────────────────────────────── */}
          {section === 'profile' && <>
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full overflow-hidden" style={{ border: `2px solid ${Gf(0.5)}`, background: '#2c1a0e' }}>
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ color: G }}>{user?.display_name?.[0]?.toUpperCase()}</div>}
              </div>
              <p className="font-bold text-base" style={{ color: G }}>{user?.display_name}</p>
              <span className="px-3 py-0.5 rounded-full text-xs" style={{ background: Gf(0.15), color: G, border: `1px solid ${Gf(0.3)}` }}>{user?.gender ?? 'Not set'}</span>
            </div>

            <div className="rounded-xl p-4 space-y-3" style={{ background: Gf(0.05), border: `1px solid ${Gf(0.15)}` }}>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: Gf(0.55) }}>GNB Coins</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: G }}>{displayBalance} 🪙{(user?.gnb_coin_balance ?? 1) === 0 && <span className="text-white/25 ml-1 text-[9px]">Dowisetrepla</span>}</span>
              </div>
              <StatRow label="Bro Registry" value={`${user?.bro_registry?.length ?? 0} / 50`} />
              <StatRow label="Account" value={user?.is_admin ? 'Admin' : 'Member'} />
            </div>
          </>}

          {/* ── Account ───────────────────────────────────────────────────── */}
          {section === 'account' && <div className="space-y-4">
            <Field label="Email" value={user?.email ?? '—'} />
            <Field label="Display Name" value={user?.display_name ?? '—'} />
            <Field label="Gender" value={user?.gender ?? 'Not set'} />
            <p className="text-xs mt-2" style={{ color: Gf(0.35) }}>Profile editing coming in Phase 5.</p>
          </div>}

          {/* ── Ledger ────────────────────────────────────────────────────── */}
          {section === 'ledger' && <>
            {/* Daily claim */}
            <button onClick={claim} disabled={claiming}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: '#FFD800', color: '#000' }}>
              {claiming ? 'Claiming...' : '🪙 Daily Claim (+100 GNB)'}
            </button>

            {/* Balance */}
            <div className="text-center py-1">
              <p className="text-2xl font-black tabular-nums" style={{ color: G }}>{displayBalance}</p>
              <p className="text-xs" style={{ color: Gf(0.45) }}>GNB Balance</p>
              {(user?.gnb_coin_balance ?? 1) === 0 && <p className="text-white/20 text-[9px] italic mt-0.5">Current Location: Dowisetrepla</p>}
            </div>

            {/* Box of shame warning */}
            {(user?.session_spend_total ?? 0) > 700 && (
              <div className="px-3 py-2 rounded-xl text-xs text-yellow-300 bg-yellow-900/25 border border-yellow-700/30">
                ⚠️ Warning: Spending limits approaching. Do not make us open the Box of Shame.
              </div>
            )}

            {/* Transaction list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-widest" style={{ color: Gf(0.5) }}>Transactions</p>
                {ledger.length > 0 && (
                  <button onClick={shreddit} className="text-[10px] px-2 py-0.5 rounded transition-colors" style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                    🗑 Shreddit
                  </button>
                )}
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {ledger.length === 0 && <p className="text-white/20 text-xs text-center py-4 italic">No transactions yet.</p>}
                {[...ledger].reverse().map((tx, i) => (
                  <div key={i} className="flex justify-between items-center text-xs px-2 py-1.5 rounded-lg" style={{ background: Gf(0.04) }}>
                    <span className="text-white/60 truncate flex-1 mr-2">{tx.description}</span>
                    <span className={`font-bold flex-shrink-0 ${tx.amount > 0 ? 'text-green-400' : tx.amount < 0 ? 'text-red-400' : 'text-white/30'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Test buttons */}
            <div className="space-y-2">
              <button onClick={aldrinJustice}
                className="w-full py-2 rounded-xl text-xs font-semibold transition-colors"
                style={{ background: Gf(0.08), color: G, border: `1px solid ${Gf(0.2)}` }}>
                ⚖️ Trigger Failed Transaction (Aldrin Justice)
              </button>
              <button onClick={buyABar}
                className="w-full py-2 rounded-xl text-xs font-semibold transition-colors"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }}>
                🏦 Buy a Bar (Puzzles) — 100,000,000 GNB
              </button>
            </div>

            {/* GNB footer */}
            <p className="text-[9px] text-center pt-2" style={{ color: Gf(0.2), lineHeight: '1.5' }}>
              Goliath National Bank is a subsidiary of AltruCell Corporation. Member FDIC.<br/>
              Goliath National Bank: We care about... your money.
            </p>
          </>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4" style={{ borderTop: `1px solid ${Gf(0.25)}` }}>
          <button onClick={logout} className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: 'rgba(220,50,50,0.15)', color: 'rgba(255,120,120,0.8)', border: '1px solid rgba(220,50,50,0.25)' }}>
            Leave the Pub
          </button>
        </div>
      </div>
    </>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs" style={{ color: 'rgba(212,168,67,0.55)' }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color: '#d4a843' }}>{value}</span>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: 'rgba(212,168,67,0.45)' }}>{label}</p>
      <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(212,168,67,0.06)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.12)' }}>{value}</p>
    </div>
  );
}
