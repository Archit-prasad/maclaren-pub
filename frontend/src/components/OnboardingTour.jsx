import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export default function OnboardingTour({ isActive, onComplete, token, coinBalanceRef, floorMapRef, coasterRef }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const steps = [
    {
      num: 1,
      title: 'Welcome to Goliath National Bank',
      text: "You've been credited with 500 GNB Coins. Click your profile once every 24 hours to claim your daily 100 GNB payout. If you're lucky, you might even find a 1939 Penny for a surprise bonus!",
      highlight: coinBalanceRef,
      icon: '🪙',
    },
    {
      num: 2,
      title: 'Securing a Seat',
      text: 'Click on any valid hotspot zone to claim a seat or join a public chat room. If a table is completely packed, you can take a high-stakes gamble on The Naked Man to force a 66% success ghost-seat — but failing kicks you straight out into the cold for 5 minutes!',
      highlight: floorMapRef,
      icon: '🗺',
    },
    {
      num: 3,
      title: 'Your Drink Coaster',
      text: 'This is your Coaster. You can hold up to 6 drinks or food items for yourself. Gulp them down to change your text colors or broadcast status events! You can also slide drinks over to tablemates — and if they\'re your registered Bro, you automatically save 10% on the tab!',
      highlight: coasterRef,
      icon: '🧾',
    },
  ];

  const current = steps[step - 1];

  const handleNext = () => {
    if (step < steps.length) {
      setStep(step + 1);
    } else {
      finishTour();
    }
  };

  const finishTour = async () => {
    setSubmitting(true);
    try {
      await axios.post('/api/auth/complete_onboarding', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onComplete?.();
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      onComplete?.(); // finish anyway
    } finally {
      setSubmitting(false);
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dark overlay except highlight */}
      <div className="absolute inset-0 bg-black/70 pointer-events-auto" onClick={() => handleNext()} />

      {/* Spotlight on highlighted element */}
      {current.highlight?.current && (() => {
        const el = current.highlight.current;
        const rect = el.getBoundingClientRect();
        const padding = 12;
        return (
          <div
            className="absolute"
            style={{
              top: rect.top - padding,
              left: rect.left - padding,
              width: rect.width + padding * 2,
              height: rect.height + padding * 2,
              border: '2px solid #FFD800',
              borderRadius: '12px',
              boxShadow: '0 0 40px #FFD80080, inset 0 0 40px #FFD80030',
              pointerEvents: 'none',
            }}
          />
        );
      })()}

      {/* Tutorial card */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-96 max-w-[calc(100vw-32px)] rounded-2xl shadow-2xl p-6 pointer-events-auto z-[101]"
        style={{ background: 'linear-gradient(135deg,#2c1a0e,#1a0f06)', border: '2px solid #FFD800' }}>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{current.icon}</span>
          <div>
            <p className="text-amber-400 text-xs font-semibold tracking-widest uppercase">Step {step} of 3</p>
            <h3 className="text-white font-bold">{current.title}</h3>
          </div>
        </div>

        <p className="text-white/70 text-sm mb-5 leading-relaxed">{current.text}</p>

        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: '#FFD800', color: '#000' }}>
            {submitting ? 'Finishing...' : step === 3 ? '🎉 Complete Tour' : 'Next →'}
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-4">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i <= step ? '20px' : '8px', background: i <= step ? '#FFD800' : 'rgba(255,255,255,0.1)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
