import React from 'react';

const STYLES = {
  info:    'bg-gray-800 border-gray-600',
  success: 'bg-green-900/90 border-green-600',
  error:   'bg-red-900/90 border-red-600',
  warn:    'bg-amber-900/90 border-amber-500',
};

export default function Toast({ toasts, removeToast }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(({ id, message, type }) => (
        <div
          key={id}
          onClick={() => removeToast(id)}
          className={`pointer-events-auto max-w-sm px-5 py-3 rounded-xl border text-white text-sm shadow-xl backdrop-blur cursor-pointer transition-all ${STYLES[type] ?? STYLES.info}`}
        >
          {message}
        </div>
      ))}
    </div>
  );
}
