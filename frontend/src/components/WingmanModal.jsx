import React from 'react';

export default function WingmanModal({ offer, onAccept, onDecline }) {
  if (!offer) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="w-80 rounded-2xl p-6 shadow-2xl text-center"
        style={{ background: '#1a0f06', border: '1px solid rgba(212,168,67,0.35)' }}
      >
        <p className="text-amber-400 font-bold text-lg mb-1" style={{ fontFamily: 'Georgia, serif' }}>
          The Wingman Protocol Initiated!
        </p>
        <p className="text-white/60 text-sm mb-5 leading-relaxed">
          Haaaaave you met <strong className="text-amber-300">{offer.sender_name}</strong>?{' '}
          They want to slide a{' '}
          <strong className="text-amber-300">{offer.item.item_name}</strong>{' '}
          over to your coaster.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onAccept}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ background: '#FFD800', color: '#000' }}
          >
            Accept Round 🍻
          </button>
          <button
            onClick={onDecline}
            className="flex-1 py-2.5 bg-white/8 hover:bg-white/12 rounded-xl text-sm text-white/70 transition-colors"
          >
            Decline Round
          </button>
        </div>
      </div>
    </div>
  );
}
