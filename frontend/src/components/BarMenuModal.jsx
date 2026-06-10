import React, { useState, useCallback } from 'react';
import { DRINKS, FOOD } from '../data/barMenu';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

// ─── SVG Illustrations ────────────────────────────────────────────────────────
function BeerSVG() {
  return (
    <svg viewBox="0 0 80 100" className="w-24 h-28 mx-auto">
      <rect x="18" y="22" width="44" height="68" rx="6" fill="#F59E0B" opacity="0.9"/>
      <rect x="18" y="22" width="44" height="14" rx="6" fill="#FEF3C7" opacity="0.95"/>
      <rect x="62" y="35" width="12" height="28" rx="6" fill="#FBBF24" opacity="0.8"/>
      <rect x="22" y="30" width="8" height="50" rx="4" fill="#FDE68A" opacity="0.35"/>
      <ellipse cx="40" cy="24" rx="20" ry="6" fill="white" opacity="0.85"/>
    </svg>
  );
}
function CocktailSVG() {
  return (
    <svg viewBox="0 0 80 100" className="w-24 h-28 mx-auto">
      <polygon points="12,12 68,12 40,58" fill="#EC4899" opacity="0.75"/>
      <polygon points="14,14 40,20 40,58" fill="#F9A8D4" opacity="0.35"/>
      <rect x="37" y="58" width="6" height="28" fill="#A855F7"/>
      <rect x="24" y="84" width="32" height="6" rx="3" fill="#7C3AED"/>
      <circle cx="22" cy="22" r="6" fill="#FDE68A" opacity="0.9"/>
      <circle cx="22" cy="22" r="3" fill="#F59E0B"/>
    </svg>
  );
}
function CoffeeSVG() {
  return (
    <svg viewBox="0 0 80 100" className="w-24 h-28 mx-auto">
      <rect x="16" y="32" width="46" height="48" rx="8" fill="#92400E"/>
      <rect x="20" y="36" width="38" height="40" rx="6" fill="#78350F"/>
      <path d="M62 46 Q78 54 62 62" stroke="#A16207" fill="none" strokeWidth="5" strokeLinecap="round"/>
      <path d="M28 28 Q33 18 38 28" stroke="#D97706" fill="none" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M38 24 Q43 14 48 24" stroke="#D97706" fill="none" strokeWidth="2.5" strokeLinecap="round"/>
      <rect x="16" y="78" width="46" height="10" rx="5" fill="#92400E"/>
      <ellipse cx="39" cy="42" rx="14" ry="5" fill="#A16207" opacity="0.4"/>
    </svg>
  );
}
function FoodSVG() {
  return (
    <svg viewBox="0 0 80 80" className="w-24 h-24 mx-auto">
      <ellipse cx="40" cy="58" rx="34" ry="8" fill="#D97706" opacity="0.25"/>
      <ellipse cx="40" cy="48" rx="32" ry="8" fill="#F5F5F4"/>
      <ellipse cx="40" cy="46" rx="26" ry="6" fill="#E7E5E4"/>
      <circle cx="34" cy="42" r="7" fill="#FCD34D"/>
      <circle cx="46" cy="40" r="6" fill="#86EFAC"/>
      <circle cx="40" cy="36" r="5" fill="#FCA5A5"/>
      <rect x="38" y="12" width="4" height="18" rx="2" fill="#9CA3AF"/>
      <ellipse cx="40" cy="12" rx="6" ry="3" fill="#6B7280"/>
    </svg>
  );
}

function ItemSVG({ category }) {
  if (category === 'beer') return <BeerSVG />;
  if (category === 'coffee') return <CoffeeSVG />;
  if (category === 'food') return <FoodSVG />;
  return <CocktailSVG />;
}

// ─── Item Detail Modal ────────────────────────────────────────────────────────
function ItemDetailModal({ item, onClose, onPurchaseSuccess, addToast, triggerShake, triggerFreeze }) {
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);

  const [nightOwlPending, setNightOwlPending] = useState(false);
  const totalCost = item.price * qty;
  const canAfford = (user?.gnb_coin_balance ?? 0) >= totalCost;

  function isNightOwlHour() {
    const h = new Date().getHours();
    return h >= 2 && h < 5;
  }

  const doPurchase = (surcharge = 1) => {
    if (!socket || loading) return;
    setLoading(true);
    const effectiveCost = Math.ceil(totalCost * surcharge);
    socket.emit('bar:purchase', { item_id: item.id, quantity: qty, night_owl_surcharge: surcharge > 1 }, (res) => {
      setLoading(false);
      if (res.error === 'artillery_arthur') {
        addToast(res.message, 'error');
        if (res.sub) setTimeout(() => addToast(res.sub, 'error'), 200);
        triggerShake?.();
        if ((res.session_overdraft_count ?? 0) >= 3) triggerFreeze?.();
        return;
      }
      if (res.error === 'personal_cap') {
        addToast(res.message, 'warn');
        triggerShake?.();
        if ((res.session_overdraft_count ?? 0) >= 3) triggerFreeze?.();
        return;
      }
      if (res.error) { addToast(res.error, 'error'); return; }
      // Success
      updateUser({
        gnb_coin_balance: res.gnb_coin_balance,
        personal_inventory: res.personal_inventory,
        session_spend_total: res.session_spend_total,
        transaction_ledger: res.transaction_ledger,
      });
      addToast(`🍺 ${qty}x ${item.name} added to your coaster!`, 'success');
      onPurchaseSuccess?.(res);
      onClose();
    });
  };

  const purchase = () => {
    if (!socket || loading) return;
    // Nothing Good Happens After 2 AM
    if (isNightOwlHour() && totalCost > 100) {
      setNightOwlPending(true);
      return;
    }
    doPurchase(1);
  };

  if (nightOwlPending) {
    return (
      <div className="fixed inset-0 z-[75] flex flex-col items-center justify-center bg-black/95">
        <p className="text-white font-black text-3xl mb-3 text-center px-8">Nothing good happens after 2 AM.</p>
        <p className="text-white/50 text-sm mb-8 text-center">Go to sleep, Schmosby.</p>
        <div className="flex gap-4">
          <button onClick={() => { setNightOwlPending(false); onClose(); }}
            className="px-6 py-3 bg-blue-800 hover:bg-blue-700 rounded-xl text-white font-semibold transition-colors">
            Go To Sleep (Exit)
          </button>
          <button onClick={() => { setNightOwlPending(false); doPurchase(1.2); }}
            className="px-6 py-3 bg-red-800 hover:bg-red-700 rounded-xl text-white font-semibold transition-colors">
            I Don't Care, Let's Make a Mistake (+20% surcharge)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-80 rounded-2xl p-6 shadow-2xl"
        style={{ background: '#1a0f06', border: '1px solid rgba(212,168,67,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-4 text-white/30 hover:text-white/60 text-lg">✕</button>

        <ItemSVG category={item.category} />

        <div className="text-center mt-3 mb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <h3 className="text-white font-bold text-base">{item.name}</h3>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${item.type === 'Lore' ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'}`}>
            {item.type}
          </span>
          <p className="text-white/50 text-xs mt-2">{item.desc}</p>
          <p className="text-amber-400 font-bold text-lg mt-1">{item.price} GNB</p>
        </div>

        {/* Qty selector */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-lg transition-colors">−</button>
          <span className="text-white font-bold text-lg w-6 text-center">{qty}</span>
          <button onClick={() => setQty(q => Math.min(6, q + 1))} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-lg transition-colors">+</button>
        </div>

        <p className="text-center text-amber-400/70 text-xs mb-4">
          Total: <strong className="text-amber-400">{totalCost} GNB</strong>
          {!canAfford && <span className="text-red-400 ml-2">(insufficient funds)</span>}
        </p>

        <div className="flex gap-3">
          <button
            onClick={purchase}
            disabled={loading || !canAfford}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: '#FFD800', color: '#000' }}
          >
            {loading ? '...' : 'Confirm Purchase'}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-white/8 hover:bg-white/12 rounded-xl text-sm text-white/70 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Menu Item Card ───────────────────────────────────────────────────────────
function MenuItemCard({ item, onClick }) {
  return (
    <button
      onClick={() => onClick(item)}
      className="text-left p-3 rounded-xl transition-all hover:scale-[1.02]"
      style={{ background: 'rgba(212,168,67,0.05)', border: '1px solid rgba(212,168,67,0.12)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold leading-tight truncate">{item.name}</p>
          <p className="text-white/40 text-[10px] mt-0.5 leading-tight line-clamp-2">{item.desc}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-amber-400 font-bold text-xs">{item.price}</p>
          <p className="text-amber-600/50 text-[9px]">GNB</p>
        </div>
      </div>
      <div className="mt-1.5">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${item.type === 'Lore' ? 'bg-purple-900/40 text-purple-400' : 'bg-blue-900/40 text-blue-400'}`}>
          {item.type}
        </span>
        {item.special && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-900/40 text-amber-400 ml-1">✨</span>}
      </div>
    </button>
  );
}

// ─── Main Bar Menu Modal ──────────────────────────────────────────────────────
export default function BarMenuModal({ isOpen, onClose, addToast, triggerShake, triggerFreeze }) {
  const [tab, setTab] = useState('drinks');
  const [selectedItem, setSelectedItem] = useState(null);

  if (!isOpen) return null;

  const items = tab === 'drinks' ? DRINKS : FOOD;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <div
          className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl flex flex-col"
          style={{ background: '#100c04', border: '1px solid rgba(212,168,67,0.25)', maxHeight: '85vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(212,168,67,0.15)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-amber-400 font-bold text-lg" style={{ fontFamily: 'Georgia, serif' }}>
                  MacLaren's Full Bar & Grill Menu
                </h2>
                <p className="text-amber-600/50 text-xs mt-0.5">Carl has eyes everywhere. No funny business.</p>
              </div>
              <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl transition-colors">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-3">
              {['drinks', 'food'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
                  style={{
                    background: tab === t ? 'rgba(212,168,67,0.2)' : 'transparent',
                    color: tab === t ? '#d4a843' : 'rgba(212,168,67,0.4)',
                    border: tab === t ? '1px solid rgba(212,168,67,0.35)' : '1px solid transparent',
                  }}
                >
                  {t === 'drinks' ? '🍺 Drinks' : '🍔 Food'}
                </button>
              ))}
            </div>
          </div>

          {/* Items grid */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => (
                <MenuItemCard key={item.id} item={item} onClick={setSelectedItem} />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 flex-shrink-0 text-center" style={{ borderTop: '1px solid rgba(212,168,67,0.1)' }}>
            <p className="text-white/12 text-[9px]" style={{ lineHeight: '1.4' }}>
              Goliath National Bank is a subsidiary of AltruCell Corporation. Member FDIC. Goliath National Bank: We care about... your money.
            </p>
          </div>
        </div>
      </div>

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onPurchaseSuccess={() => {}}
          addToast={addToast}
          triggerShake={triggerShake}
          triggerFreeze={triggerFreeze}
        />
      )}
    </>
  );
}
