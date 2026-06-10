import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ThePlaybook({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Slide-out panel */}
      <div
        className="fixed top-0 right-0 h-full w-80 z-50 flex flex-col shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, #2c1a0e 0%, #1a0f06 40%, #110900 100%)',
          borderLeft: '2px solid rgba(180,140,60,0.35)',
          fontFamily: '"Georgia", "Times New Roman", serif',
        }}
      >
        {/* Gold trim header */}
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(180,140,60,0.4)' }}
        >
          <div>
            <h2 className="text-lg font-bold tracking-wide" style={{ color: '#d4a843' }}>
              The Playbook
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(212,168,67,0.55)' }}>
              Personal Settings
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors"
            style={{ color: 'rgba(212,168,67,0.6)', border: '1px solid rgba(212,168,67,0.2)' }}
          >
            ✕
          </button>
        </div>

        {/* Tab nav */}
        <div className="flex px-4 pt-4 gap-2">
          {['profile', 'account'].map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
              style={{
                background: activeSection === s ? 'rgba(212,168,67,0.2)' : 'transparent',
                color: activeSection === s ? '#d4a843' : 'rgba(212,168,67,0.4)',
                border: activeSection === s ? '1px solid rgba(212,168,67,0.35)' : '1px solid transparent',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {activeSection === 'profile' && (
            <>
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden"
                  style={{ border: '2px solid rgba(212,168,67,0.5)', background: '#2c1a0e' }}
                >
                  {user?.avatar_url
                    ? <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    : <span style={{ color: '#d4a843' }}>{user?.display_name?.[0]?.toUpperCase()}</span>
                  }
                </div>
                <p className="font-bold text-base" style={{ color: '#d4a843' }}>{user?.display_name}</p>
                <span
                  className="px-3 py-0.5 rounded-full text-xs"
                  style={{ background: 'rgba(212,168,67,0.15)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.3)' }}
                >
                  {user?.gender ?? 'Not set'}
                </span>
              </div>

              {/* Stats */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(212,168,67,0.05)', border: '1px solid rgba(212,168,67,0.15)' }}>
                <StatRow label="GNB Coins" value={`${user?.gnb_coin_balance ?? 0} 🪙`} />
                <StatRow label="Bro Registry" value={`${user?.bro_registry?.length ?? 0} / 50`} />
                <StatRow label="Account" value={user?.is_admin ? 'Admin' : 'Member'} />
              </div>
            </>
          )}

          {activeSection === 'account' && (
            <div className="space-y-4">
              <Field label="Email" value={user?.email ?? '—'} />
              <Field label="Display Name" value={user?.display_name ?? '—'} />
              <Field label="Gender" value={user?.gender ?? 'Not set'} />
              <p className="text-xs mt-2" style={{ color: 'rgba(212,168,67,0.35)' }}>
                Profile editing coming in Phase 5.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(180,140,60,0.25)' }}>
          <button
            onClick={logout}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: 'rgba(220,50,50,0.15)', color: 'rgba(255,120,120,0.8)', border: '1px solid rgba(220,50,50,0.25)' }}
          >
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
      <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(212,168,67,0.06)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.12)' }}>
        {value}
      </p>
    </div>
  );
}
