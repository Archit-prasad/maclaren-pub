import React from 'react';

export default function BFHBanner({ broadcast, onBystander }) {
  if (!broadcast) return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-[45] flex justify-center pointer-events-none px-4">
      <div
        className="max-w-xl w-full rounded-2xl px-5 py-3 shadow-2xl pointer-events-auto flex flex-col items-center gap-2"
        style={{ background: 'linear-gradient(135deg,#001a4d,#00008b)', border: '2px solid #FFD700' }}
      >
        <p className="text-yellow-300 font-black text-sm tracking-wide text-center">
          🚨 GLOBAL ROMANTIC ALERT: {broadcast.sender_name} is going full Ted Mosby!
        </p>
        <p className="text-blue-200 text-xs text-center">
          They have stolen the Blue French Horn and are offering this grand gesture to{' '}
          <strong className="text-white">{broadcast.recipient_name}</strong> right now! Will they accept?
        </p>
        <div className="flex gap-3 mt-1">
          <button
            onClick={() => onBystander('clap')}
            className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{ background: 'rgba(255,215,0,0.2)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.4)' }}
          >
            👏 Applaud
          </button>
          <button
            onClick={() => onBystander('smurf')}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            🔵 "Honestly, that thing looks like a Smurf penis."
          </button>
        </div>
      </div>
    </div>
  );
}
