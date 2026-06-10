import React, { useRef, useState, useEffect, useCallback } from 'react';
import hotspots from '../config/hotspots';
import { useAuth } from '../contexts/AuthContext';

const CHAT_TYPES = new Set([
  'Big Corner Sofa','Standard Sofa','Long Table A','Long Table B',
  'Medium Table','Small Table','Solo Table','Waiting Sofa',
]);

// room occupancy count overlay (populated by parent via roomCounts prop)
export default function PubFloorMap({ onHotspotClick, roomCounts = {}, activeTableId = null, addToast }) {
  const { user } = useAuth();
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const [imgDims, setImgDims] = useState({ width: 0, height: 0 });
  const jukeboxRef = useRef(null);
  const [jukeboxPlaying, setJukeboxPlaying] = useState(false);
  const fadeRef = useRef(null);

  // ── ResizeObserver to track image render dimensions ────────────────────────
  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setImgDims({ width, height });
      }
    });
    if (imgRef.current) obs.observe(imgRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Jukebox audio setup ────────────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio('/assets/jukebox_500miles_8bit.mp3');
    audio.loop = true;
    audio.volume = 0;
    jukeboxRef.current = audio;

    // Web Audio API fallback if file fails to load
    audio.addEventListener('error', () => {
      try {
        const ctx = new AudioContext();
        const notes = [261.63, 293.66, 329.63, 349.23, 392.00]; // C4 pentatonic
        let noteIdx = 0;
        let fallbackInterval = null;
        const playNote = () => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'square';
          osc.frequency.value = notes[noteIdx % notes.length];
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
          noteIdx++;
        };
        jukeboxRef.current = {
          _ctx: ctx,
          _interval: null,
          play() { this._interval = setInterval(playNote, 220); },
          pause() { clearInterval(this._interval); },
          get paused() { return !this._interval; },
          set volume(_) {},
        };
      } catch {}
    });

    return () => { audio.pause(); };
  }, []);

  const toggleJukebox = useCallback(() => {
    const audio = jukeboxRef.current;
    if (!audio) return;
    if (jukeboxPlaying) {
      clearInterval(fadeRef.current);
      let vol = audio.volume;
      fadeRef.current = setInterval(() => {
        vol = Math.max(0, vol - 0.05);
        try { audio.volume = vol; } catch {}
        if (vol <= 0) { clearInterval(fadeRef.current); audio.pause(); }
      }, 25);
    } else {
      audio.volume = 0;
      audio.play().catch(() => {});
      clearInterval(fadeRef.current);
      let vol = 0;
      fadeRef.current = setInterval(() => {
        vol = Math.min(0.4, vol + 0.05);
        try { audio.volume = vol; } catch {}
        if (vol >= 0.4) clearInterval(fadeRef.current);
      }, 25);
    }
    setJukeboxPlaying((p) => !p);
  }, [jukeboxPlaying]);

  const handleHotspotClick = (e, hotspot) => {
    e.stopPropagation();
    if (!user) return;

    if (hotspot.type === 'Jukebox') {
      toggleJukebox();
      addToast?.(jukeboxPlaying ? '🎵 Jukebox off' : '🎵 Jukebox playing — The 500 Miles Remix');
      return;
    }

    if (hotspot.type === 'Bar Counter') {
      addToast?.('🍺 Bar menu coming in Phase 3!');
      return;
    }

    if (hotspot.type === "Men's Washroom") {
      if (user.gender !== 'Male') {
        addToast?.("MacLaren's respects the sacred laws of pub washrooms.", 'warn');
        return;
      }
    }
    if (hotspot.type === "Women's Washroom") {
      if (user.gender !== 'Female') {
        addToast?.("MacLaren's respects the sacred laws of pub washrooms.", 'warn');
        return;
      }
    }

    onHotspotClick?.(hotspot);
  };

  const handleMapClick = () => {
    addToast?.('You are not allowed to enter restricted areas.', 'warn');
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[#0d1208] select-none"
      onClick={handleMapClick}
    >
      <div className="relative inline-block">
        <img
          ref={imgRef}
          src="/assets/image_3c932e.png"
          alt="MacLaren's Pub Floor"
          className="block max-h-[calc(100vh-64px)] w-auto object-contain"
          draggable={false}
        />

        {/* Hotspot overlays — invisible by default, white glow on hover */}
        {imgDims.width > 0 && hotspots.map((hs) => {
          const left   = (hs.x / 100) * imgDims.width;
          const top    = (hs.y / 100) * imgDims.height;
          const width  = (hs.width / 100) * imgDims.width;
          const height = (hs.height / 100) * imgDims.height;
          const count = roomCounts[hs.id] ?? 0;
          const isChat = CHAT_TYPES.has(hs.type);

          return (
            <div
              key={hs.id}
              onClick={(e) => handleHotspotClick(e, hs)}
              style={{
                position: 'absolute',
                left, top, width, height,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
              className="group"
            >
              {/* Hover glow — only visible element on hover */}
              <div
                className="absolute inset-0 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              />

              {/* Occupant count badge (chat rooms only) */}
              {isChat && count > 0 && (
                <div
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold pointer-events-none"
                  style={{ background: 'rgba(255,216,0,0.85)', color: '#000', border: '1px solid rgba(0,0,0,0.4)' }}
                >
                  {count}
                </div>
              )}

              {/* Hover tooltip */}
              <div
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-[10px] font-semibold text-white whitespace-nowrap pointer-events-none z-10"
                style={{ background: 'rgba(0,0,0,0.80)' }}
              >
                {hs.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
