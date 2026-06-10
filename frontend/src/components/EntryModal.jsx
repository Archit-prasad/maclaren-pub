import React from 'react';

export default function EntryModal({ hotspot, onConfirm, onCancel }) {
  if (!hotspot) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1208] border border-amber-900/40 rounded-2xl p-6 w-80 shadow-2xl text-center">
        <h2 className="text-white font-semibold text-lg mb-1">{hotspot.name}</h2>
        <p className="text-white/40 text-xs mb-5">{hotspot.type}</p>
        <p className="text-white/80 text-sm mb-6">Do you want to enter the chat?</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-[#FFD800] hover:bg-yellow-300 text-black font-bold rounded-xl text-sm transition-colors"
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
