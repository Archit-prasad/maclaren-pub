import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d1208] text-center px-4">
      <p className="text-red-500 font-black text-5xl md:text-7xl tracking-tight mb-4 leading-tight">
        NOBODY ASKED YOU, PATRICE!
      </p>
      <p className="text-white/40 text-xl mb-2">Error 404: Page Not Found</p>
      <p className="text-white/20 text-sm mb-8 italic">
        — Robin Scherbatsky, probably
      </p>
      <button
        onClick={() => navigate('/')}
        className="px-6 py-3 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
      >
        Back to MacLaren's
      </button>
    </div>
  );
}
