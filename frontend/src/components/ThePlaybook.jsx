import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const G = '#d4a843';
const Gf = (o) => `rgba(212,168,67,${o})`;

// Ordered level entries — explicit order guarantees level_1 through level_10 always render
const MURTAUGH_LEVELS = [
  { key: 'level_1',  label: 'Stay idle for more than 6 hours.' },
  { key: 'level_2',  label: "Consume a 'Sandwich' from inventory 3 separate times." },
  { key: 'level_3',  label: 'Buy 6 cheap beers in a single session.' },
  { key: 'level_4',  label: 'Have a personal drink offer rejected by another user (Lawyered!).' },
  { key: 'level_5',  label: 'Trigger the 6-drink Personal Cap Rule OR Overdraft penalty 3 times.' },
  { key: 'level_6',  label: 'Get rejected for offering the Blue French Horn.' },
  { key: 'level_7',  label: 'Hoard 4+ items simultaneously on the drink coaster.' },
  { key: 'level_8',  label: "Use 'Act as Wingman' to support a bro." },
  { key: 'level_9',  label: 'Cumulative spending over 500 GNB in a single calendar day.' },
  { key: 'level_10', label: 'Fail AND succeed the Naked Man protocol at least once each.' },
];

const DEFAULT_MURTAUGH = {
  level_1: false, level_2: false, level_3: false, level_4: false, level_5: false,
  level_6: false, level_7: false, level_8: false, level_9: false, level_10: false,
};

export default function ThePlaybook({ isOpen, onClose, addToast, triggerShake }) {
  const { user, token, logout, updateUser } = useAuth();
  const [section, setSection] = useState('profile');
  const [ledger, setLedger] = useState([]);
  const [claiming, setClaiming] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(user?.gnb_coin_balance ?? 0);
  // Murtaugh progress fetched fresh from server when tab opens
  const [murtaughProgress, setMurtaughProgress] = useState(null);
  const [murtaughLoading, setMurtaughLoading] = useState(false);
  // Sacred Texts accordion state — keys are section titles
  const [openSections, setOpenSections] = useState({});
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

  // Fetch fresh murtaugh progress from server when tab opens
  useEffect(() => {
    if (section !== 'murtaugh' || !token) return;
    setMurtaughLoading(true);
    axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const progress = r.data.user?.murtaugh_list_progress;
        if (progress && typeof progress === 'object') {
          setMurtaughProgress({ ...DEFAULT_MURTAUGH, ...progress });
        }
        // Also sync profile_title in case it changed
        if (r.data.user?.profile_title !== undefined) {
          updateUser({ profile_title: r.data.user.profile_title, murtaugh_list_progress: r.data.user.murtaugh_list_progress });
        }
      })
      .catch(() => {})
      .finally(() => setMurtaughLoading(false));
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

  const SECTIONS = ['profile', 'account', 'ledger', 'bros', 'murtaugh', 'sacred_texts'];
  const SECTION_LABELS = {
    profile: '👤 Profile',
    account: '⚙️ Account',
    ledger: '📊 Ledger',
    bros: '🤝 Bros',
    murtaugh: '👴 Murtaugh',
    sacred_texts: '📖 Texts',
  };

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
        <div className="flex px-4 pt-4 gap-1.5 overflow-x-auto">
          {SECTIONS.map(s => (
            <button key={s} onClick={() => setSection(s)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 min-w-fit"
              style={{ background: section === s ? Gf(0.2) : 'transparent', color: section === s ? G : Gf(0.4), border: section === s ? `1px solid ${Gf(0.35)}` : '1px solid transparent' }}>
              {SECTION_LABELS[s]}
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

          {/* ── Bro Registry ──────────────────────────────────────────── */}
          {section === 'bros' && <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest" style={{ color: Gf(0.5) }}>Bro Registry</p>
              <span className="text-xs font-bold" style={{ color: G }}>{user?.bro_registry?.length ?? 0} / 50</span>
            </div>
            {(user?.bro_registry?.length ?? 0) === 0 && (
              <p className="text-white/20 text-xs text-center py-4 italic">No Bros yet. Go to a table and send a Bro Request!</p>
            )}
            <div className="space-y-2">
              {(user?.bro_registry ?? []).map((id, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: Gf(0.05), border: `1px solid ${Gf(0.12)}` }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: Gf(0.15), color: G }}>🤝</div>
                  <span className="text-white/70 text-xs truncate">{String(id).slice(-8)}</span>
                  <span className="text-white/30 text-[9px] ml-auto">10% discount on offers</span>
                </div>
              ))}
            </div>
            <p className="text-xs pt-2" style={{ color: Gf(0.3) }}>Bros get a 10% discount when you offer them drinks from your coaster. Bros Before Hoes — Article 1.</p>
          </div>}

          {/* ── Murtaugh List ─────────────────────────────────────────── */}
          {section === 'murtaugh' && (() => {
            // Resolution order: server-fetched → user context → hardcoded default
            const progress = murtaughProgress
              ?? (user?.murtaugh_list_progress && typeof user.murtaugh_list_progress === 'object' && Object.keys(user.murtaugh_list_progress).length > 0
                  ? { ...DEFAULT_MURTAUGH, ...user.murtaugh_list_progress }
                  : DEFAULT_MURTAUGH);
            const allDone = MURTAUGH_LEVELS.every(({ key }) => progress[key] === true);
            const completedCount = MURTAUGH_LEVELS.filter(({ key }) => progress[key] === true).length;
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-widest" style={{ color: Gf(0.5) }}>The Murtaugh List</p>
                  <span className="text-xs font-bold" style={{ color: allDone ? '#FFD700' : Gf(0.6) }}>
                    {completedCount} / 10
                  </span>
                </div>

                {murtaughLoading && (
                  <p className="text-white/30 text-xs text-center py-2">Loading...</p>
                )}

                {allDone && (
                  <div className="px-3 py-2 rounded-xl text-xs text-center font-bold mb-2"
                    style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.4)' }}>
                    🏆 [Too Old For This] — All 10 complete!
                  </div>
                )}

                {MURTAUGH_LEVELS.map(({ key, label }, i) => {
                  const done = progress[key] === true;
                  return (
                    <div key={key}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
                      style={{
                        background: done ? 'rgba(34,197,94,0.08)' : Gf(0.04),
                        border: `1px solid ${done ? 'rgba(34,197,94,0.25)' : Gf(0.1)}`,
                      }}
                    >
                      <span className="text-base flex-shrink-0 mt-0.5">{done ? '✅' : '⬜'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold mb-0.5"
                          style={{ color: done ? '#86efac' : 'rgba(255,255,255,0.7)' }}>
                          Level {i + 1}
                        </p>
                        <p className="text-[10px] leading-snug"
                          style={{ color: done ? 'rgba(134,239,172,0.8)' : 'rgba(255,255,255,0.4)' }}>
                          {label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Sacred Texts ──────────────────────────────────────────────── */}
          {section === 'sacred_texts' && <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: Gf(0.5) }}>The Sacred Texts</p>
            {[
              {
                title: '📖 The Bro Code',
                items: [
                  '50-Bro capacity limit per user',
                  'Thumb-lick acceptance process required',
                  '10% automatic discount on offers from Bros',
                  'Article 1: BFH blocked if Bro has empty inventory',
                ],
              },
              {
                title: '🎺 The Grand Gesture (BFH)',
                items: [
                  'Costs 2,000 GNB to initiate',
                  'Requires opposite gender between sender & recipient',
                  '3-month (90-day) cooldown on recipient after acceptance',
                  'Zero GNB refund if recipient declines',
                  '3-day blue theme lock on recipient\'s UI after acceptance',
                ],
              },
              {
                title: '🌍 Global Environmental Modifiers',
                items: [
                  'Nothing Good Happens After 2 AM: 2:00–5:00 AM window applies 20% surcharge to orders over 100 GNB',
                  'Article 37 Dibs Clause: 60-second seat lock, 7-day cooldown per user',
                ],
              },
              {
                title: '👴 The Murtaugh List',
                items: [
                  'Level 1: Stay idle for 6+ hours',
                  'Level 2: Consume a Sandwich 3 times',
                  'Level 3: Buy 6 cheap beers in one session',
                  'Level 4: Have an offer rejected',
                  'Level 5: Trigger Cap/Overdraft 3 times',
                  'Level 6: BFH proposal rejected',
                  'Level 7: Hoard 4+ items on coaster',
                  'Level 8: Act as Wingman',
                  'Level 9: Spend 500+ GNB in one day',
                  'Level 10: Both succeed and fail Naked Man',
                  'All 10 complete: Badge [Too Old For This]',
                ],
              },
            ].map((section, i) => {
              const isOpen = openSections[section.title] ?? (i === 0);
              return (
                <button
                  key={i}
                  onClick={() => setOpenSections(s => ({ ...s, [section.title]: !s[section.title] }))}
                  className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
                  style={{
                    background: isOpen ? Gf(0.1) : Gf(0.04),
                    border: `1px solid ${isOpen ? Gf(0.25) : Gf(0.12)}`,
                  }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: G }}>{section.title}</span>
                    <span style={{ color: Gf(0.5) }}>{isOpen ? '▼' : '▶'}</span>
                  </div>
                  {isOpen && (
                    <div className="mt-2.5 space-y-1.5 text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {section.items.map((item, j) => (
                        <div key={j} className="flex gap-2">
                          <span className="flex-shrink-0">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>}
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
