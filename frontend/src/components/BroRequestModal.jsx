import React from 'react';

export default function BroRequestModal({ request, onAccept, onDecline }) {
  if (!request) return null;
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-80 rounded-2xl p-6 shadow-2xl text-center"
        style={{ background: '#1a0f06', border: '1px solid rgba(212,168,67,0.4)' }}>
        <div className="text-4xl mb-3">🤝</div>
        <h2 className="text-amber-400 font-bold text-lg mb-1" style={{ fontFamily: 'Georgia, serif' }}>
          Bro Request!
        </h2>
        <p className="text-white/70 text-sm mb-6 leading-relaxed">
          <strong className="text-amber-300">{request.sender_name}</strong> wants to swear the thumb-lick oath and become your official Bro. Do you accept?
        </p>
        <div className="flex gap-3">
          <button onClick={onAccept}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ background: '#FFD800', color: '#000' }}>
            👍 Accept Bro
          </button>
          <button onClick={onDecline}
            className="flex-1 py-2.5 bg-white/8 hover:bg-white/12 rounded-xl text-sm text-white/70 transition-colors">
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
