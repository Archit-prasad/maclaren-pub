import React, { useState, useEffect, useRef } from 'react';

export default function BFHModal({ proposal, onAccept, onDecline, wingmanVouchers = [] }) {
  const [secondsLeft, setSecondsLeft] = useState(30);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!proposal) return;
    setSecondsLeft(30);
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [proposal?.proposal_id]);

  if (!proposal) return null;

  const urgency = secondsLeft <= 10 ? '#ef4444' : '#3b82f6';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-96 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg,#001a4d,#00008b)', border: '2px solid #3b82f6' }}>

        {/* Countdown ring */}
        <div className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full text-xs font-black"
          style={{ border: `3px solid ${urgency}`, color: urgency }}>
          {secondsLeft}
        </div>

        <div className="text-5xl mb-4">🎺</div>
        <h2 className="text-white font-black text-xl mb-2 leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
          THE ULTIMATE ROMANTIC GESTURE!
        </h2>
        <p className="text-blue-200 text-sm mb-6 leading-relaxed">
          <strong className="text-white">{proposal.sender_name}</strong> has stolen the legendary Blue French Horn from the restaurant for you!
          Do you accept this grand, completely over-the-top gesture?
        </p>

        {/* Wingman vouchers */}
        {wingmanVouchers.length > 0 && (
          <div className="mb-4 px-4 py-2 rounded-xl text-xs text-yellow-200" style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.4)' }}>
            {wingmanVouchers.map((name, i) => (
              <p key={i}>✨ {name} vouches for this gesture! He's a good guy, accept it!</p>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onAccept}
            className="flex-1 py-3 rounded-2xl text-sm font-black transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)', color: '#000' }}>
            🎯 Accept the Horn
          </button>
          <button onClick={onDecline}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)' }}>
            💔 Decline
          </button>
        </div>

        {secondsLeft === 0 && (
          <p className="text-red-400 text-xs mt-3">Time expired — the gesture has been cancelled.</p>
        )}
      </div>
    </div>
  );
}
