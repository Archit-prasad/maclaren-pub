import React, { useState, useRef, useCallback, useEffect } from 'react';

const ZONE_TYPES = [
  'Big Corner Sofa', 'Standard Sofa', 'Long Table A', 'Long Table B',
  'Medium Table', 'Small Table', 'Solo Table', 'Waiting Sofa',
  "Men's Washroom", "Women's Washroom", 'Bar Counter', 'Jukebox',
];

const TYPE_COLORS = {
  'Big Corner Sofa':  'rgba(99,102,241,0.45)',
  'Standard Sofa':    'rgba(139,92,246,0.45)',
  'Long Table A':     'rgba(16,185,129,0.45)',
  'Long Table B':     'rgba(5,150,105,0.45)',
  'Medium Table':     'rgba(245,158,11,0.45)',
  'Small Table':      'rgba(251,191,36,0.45)',
  'Solo Table':       'rgba(252,211,77,0.45)',
  'Waiting Sofa':     'rgba(167,139,250,0.45)',
  "Men's Washroom":   'rgba(59,130,246,0.45)',
  "Women's Washroom": 'rgba(236,72,153,0.45)',
  'Bar Counter':      'rgba(239,68,68,0.45)',
  'Jukebox':          'rgba(249,115,22,0.45)',
};

const BORDER_COLORS = {
  'Big Corner Sofa':  '#6366f1', 'Standard Sofa': '#8b5cf6',
  'Long Table A':     '#10b981', 'Long Table B':  '#059669',
  'Medium Table':     '#f59e0b', 'Small Table':   '#fbbf24',
  'Solo Table':       '#fcd34d', 'Waiting Sofa':  '#a78bfa',
  "Men's Washroom":   '#3b82f6', "Women's Washroom": '#ec4899',
  'Bar Counter':      '#ef4444', 'Jukebox':       '#f97316',
};

export default function CoordinateEditor() {
  const [zones, setZones] = useState([]);
  const [drawing, setDrawing] = useState(null);    // {startX,startY,currentX,currentY}
  const [modal, setModal] = useState(null);         // {rect} — pending zone
  const [editId, setEditId] = useState(null);       // zone being edited
  const [modalName, setModalName] = useState('');
  const [modalType, setModalType] = useState(ZONE_TYPES[0]);
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // ── Convert absolute px rect → percentage of image ─────────────────────────
  const toPercent = useCallback((rect) => {
    const img = imgRef.current;
    if (!img) return rect;
    const imgRect = img.getBoundingClientRect();
    return {
      x:      ((rect.x - imgRect.left) / imgRect.width)  * 100,
      y:      ((rect.y - imgRect.top)  / imgRect.height) * 100,
      width:  (rect.width  / imgRect.width)  * 100,
      height: (rect.height / imgRect.height) * 100,
    };
  }, []);

  // ── Mouse helpers (image-relative) ─────────────────────────────────────────
  const imgPos = (e) => {
    const r = imgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    const p = imgPos(e);
    setDrawing({ startX: p.x, startY: p.y, currentX: p.x, currentY: p.y });
    setSelectedId(null);
    e.preventDefault();
  };

  const onMouseMove = useCallback((e) => {
    if (!drawing) return;
    const p = imgPos(e);
    setDrawing((d) => ({ ...d, currentX: p.x, currentY: p.y }));
  }, [drawing]);

  const onMouseUp = useCallback(() => {
    if (!drawing) return;
    const minX = Math.min(drawing.startX, drawing.currentX);
    const minY = Math.min(drawing.startY, drawing.currentY);
    const w = Math.abs(drawing.currentX - drawing.startX);
    const h = Math.abs(drawing.currentY - drawing.startY);
    setDrawing(null);
    if (w < 10 || h < 10) return; // too small, ignore
    const imgRect = imgRef.current?.getBoundingClientRect();
    if (!imgRect) return;
    setModal({ rect: { x: imgRect.left + minX, y: imgRect.top + minY, width: w, height: h } });
    setModalName('');
    setModalType(ZONE_TYPES[0]);
    setEditId(null);
  }, [drawing]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // ── Save zone from modal ────────────────────────────────────────────────────
  const saveZone = () => {
    if (!modalName.trim()) return;
    if (editId) {
      setZones((z) => z.map((zone) =>
        zone.id === editId ? { ...zone, name: modalName, type: modalType } : zone
      ));
      setEditId(null);
    } else {
      const pct = toPercent(modal.rect);
      setZones((z) => [...z, {
        id: Date.now().toString(),
        name: modalName.trim(),
        type: modalType,
        x: Math.max(0, +pct.x.toFixed(2)),
        y: Math.max(0, +pct.y.toFixed(2)),
        width:  +pct.width.toFixed(2),
        height: +pct.height.toFixed(2),
      }]);
    }
    setModal(null);
  };

  // ── Edit existing zone ──────────────────────────────────────────────────────
  const startEdit = (zone) => {
    setEditId(zone.id);
    setModalName(zone.name);
    setModalType(zone.type);
    setModal({ rect: null });
  };

  const deleteZone = (id) => setZones((z) => z.filter((zone) => zone.id !== id));

  // ── Export ──────────────────────────────────────────────────────────────────
  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(zones, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Draw rect for live overlay ──────────────────────────────────────────────
  const drawingRect = drawing ? {
    left:   Math.min(drawing.startX, drawing.currentX),
    top:    Math.min(drawing.startY, drawing.currentY),
    width:  Math.abs(drawing.currentX - drawing.startX),
    height: Math.abs(drawing.currentY - drawing.startY),
  } : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">Floor Map Coordinate Editor</h1>
          <p className="text-white/40 text-xs">Dev-only tool — click and drag to define hotspot zones</p>
        </div>
        <button
          onClick={copyToClipboard}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            copied ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-500'
          }`}
        >
          {copied ? '✓ Copied!' : 'Copy Hotspot Config'}
        </button>
      </div>

      <div className="flex h-[calc(100vh-56px)]">
        {/* ── Image canvas ──────────────────────────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-950 flex items-start justify-center p-4"
        >
          <div className="relative inline-block select-none" onMouseDown={onMouseDown}>
            <img
              ref={imgRef}
              src="/assets/image_3c932e.png"
              alt="Pub floor plan"
              className="block max-w-none"
              style={{ cursor: 'crosshair', userSelect: 'none', maxWidth: '100%' }}
              draggable={false}
            />

            {/* Existing zones */}
            {zones.map((zone) => {
              const img = imgRef.current;
              if (!img) return null;
              const iw = img.getBoundingClientRect().width;
              const ih = img.getBoundingClientRect().height;
              return (
                <div
                  key={zone.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(zone.id); }}
                  style={{
                    position: 'absolute',
                    left:   `${zone.x}%`,
                    top:    `${zone.y}%`,
                    width:  `${zone.width}%`,
                    height: `${zone.height}%`,
                    background: TYPE_COLORS[zone.type] || 'rgba(255,255,255,0.2)',
                    border: `2px solid ${BORDER_COLORS[zone.type] || '#fff'}`,
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                  className={selectedId === zone.id ? 'ring-2 ring-white' : ''}
                >
                  <span
                    className="absolute top-0.5 left-1 text-white text-[10px] font-bold leading-tight pointer-events-none"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
                  >
                    {zone.name}
                  </span>
                </div>
              );
            })}

            {/* Live draw rect */}
            {drawingRect && (
              <div
                style={{
                  position: 'absolute',
                  left:   drawingRect.left,
                  top:    drawingRect.top,
                  width:  drawingRect.width,
                  height: drawingRect.height,
                  background: 'rgba(255,255,255,0.12)',
                  border: '2px dashed #fff',
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div className="w-72 bg-gray-900 border-l border-white/10 overflow-y-auto p-4 flex flex-col gap-3">
          <p className="text-white/50 text-xs uppercase tracking-widest">Zones ({zones.length})</p>
          {zones.length === 0 && (
            <p className="text-white/25 text-sm">Draw a rectangle on the floor plan to add a zone.</p>
          )}
          {zones.map((zone) => (
            <div
              key={zone.id}
              onClick={() => setSelectedId(zone.id)}
              className={`rounded-lg p-3 border cursor-pointer transition-colors ${
                selectedId === zone.id
                  ? 'border-white/40 bg-white/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/8'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ background: BORDER_COLORS[zone.type] || '#fff' }}
                />
                <span className="text-white text-sm font-medium flex-1 truncate">{zone.name}</span>
              </div>
              <p className="text-white/40 text-xs mt-1">{zone.type}</p>
              <p className="text-white/25 text-xs font-mono">
                x:{zone.x} y:{zone.y} w:{zone.width} h:{zone.height}
              </p>
              {selectedId === zone.id && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(zone); }}
                    className="text-xs px-2 py-1 bg-indigo-700/60 hover:bg-indigo-600 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteZone(zone.id); }}
                    className="text-xs px-2 py-1 bg-red-700/60 hover:bg-red-600 rounded"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal: name + type ─────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/15 rounded-2xl p-6 w-80 shadow-2xl">
            <h2 className="font-semibold text-white text-lg mb-4">
              {editId ? 'Edit Zone' : 'Name This Zone'}
            </h2>
            <input
              autoFocus
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveZone()}
              placeholder="Zone name (e.g. Table 4)"
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-indigo-400"
            />
            <select
              value={modalType}
              onChange={(e) => setModalType(e.target.value)}
              className="w-full bg-gray-800 border border-white/15 rounded-lg px-3 py-2 text-white text-sm mb-4 focus:outline-none"
            >
              {ZONE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <div className="flex gap-3">
              <button
                onClick={saveZone}
                disabled={!modalName.trim()}
                className="flex-1 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-semibold disabled:opacity-40"
              >
                Save Zone
              </button>
              <button
                onClick={() => { setModal(null); setEditId(null); }}
                className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
