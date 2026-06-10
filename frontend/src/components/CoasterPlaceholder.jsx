import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function CoasterPlaceholder() {
  const { user } = useAuth();
  return (
    <div className="h-full flex flex-col items-center justify-start pt-6 px-3 gap-4">
      <div className="w-full rounded-2xl p-4 text-center" style={{ background: 'rgba(180,120,40,0.08)', border: '1px solid rgba(180,120,40,0.2)' }}>
        <p className="text-2xl mb-1">🧾</p>
        <p className="text-amber-400 font-semibold text-sm">My Coaster</p>
        <p className="text-amber-600/50 text-xs mt-0.5">{user?.gnb_coin_balance ?? 0} GNB</p>
      </div>
      <div className="w-full rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }}>
        <p className="text-white/20 text-xs">Inventory &amp; drinks unlocked in Phase 3</p>
      </div>
    </div>
  );
}
