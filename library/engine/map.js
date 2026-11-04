// library/engine/map.js — المحمّل الموحد للخرائط مع إعادة بناء زمني
// Unified map loader with year-based reconstruction.
// Supports engines: procedural / layered-svg / hybrid (same three as characters)
//
// Data model: base.geo.json (original state) + timeline.json (diffs per year)
// Reconstruction: start from base, apply all diffs where diff.year <= targetYear
//
// Usage:
//   import { loadMap, getStateForYear, drawMap } from '/library/engine/map.js';
//   const map = await loadMap('test_region_a');
//   const state = getStateForYear(map, 1945); // {countries, cities, arrows, alliances}
//   drawMap(g, state, {x, y, w, h, highlight: ['ussr']});

const ENGINES = ['procedural', 'layered-svg', 'hybrid'];
let _registry = null;
let _cache = new Map();

export async function loadRegistry() {
  if (_registry) return _registry;
  try {
    const res = await fetch('/library/registry.json');
    if (res.ok) { _registry = await res.json(); return _registry; }
  } catch {}
  try {
    const fs = await import('fs');
    const path = await import('path');
    const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
    const txt = fs.readFileSync(path.join(root, 'library/registry.json'), 'utf8');
    _registry = JSON.parse(txt);
    return _registry;
  } catch (e) {
    throw new Error('map.js: cannot load registry.json — ' + e.message);
  }
}

// Load full map: meta + base + timeline
export async function loadMap(id) {
  if (_cache.has(id)) return _cache.get(id);
  const registry = await loadRegistry();
  const entry = registry.maps?.find(m => m.id === id);
  if (!entry) throw new Error(`map '${id}' not found. Available: ${(registry.maps||[]).map(m=>m.id).join(', ')}`);

  const basePath = entry.base; // e.g. /library/maps/test_region_a/base.geo.json
  const timelinePath = entry.timeline;

  let base, timeline, meta;
  // Browser fetch
  try {
    const [r1, r2, r3] = await Promise.all([
      fetch(basePath).then(r=>r.ok?r.json():null),
      fetch(timelinePath).then(r=>r.ok?r.json():null),
      entry.meta ? fetch(entry.meta).then(r=>r.ok?r.json():null) : Promise.resolve(null),
    ]);
    if (r1) { base = r1; timeline = r2 || []; meta = r3; }
  } catch {}
  // Node fallback
  if (!base) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
      base = JSON.parse(fs.readFileSync(path.join(root, basePath.replace(/^\//,'')), 'utf8'));
      timeline = timelinePath ? JSON.parse(fs.readFileSync(path.join(root, timelinePath.replace(/^\//,'')), 'utf8')) : [];
      meta = entry.meta ? JSON.parse(fs.readFileSync(path.join(root, entry.meta.replace(/^\//,'')), 'utf8')) : null;
    } catch (e) {
      throw new Error(`map.js: failed to load map '${id}': ${e.message}`);
    }
  }

  const map = { id, engine: entry.engine || 'procedural', base, timeline: timeline || [], meta, entry };
  if (!ENGINES.includes(map.engine)) throw new Error(`map '${id}' invalid engine '${map.engine}'`);
  _cache.set(id, map);
  return map;
}

// Rebuild geographic state for any year.
// Applies diffs in chronological order. Original base is never mutated.
export function getStateForYear(map, targetYear) {
  // Deep clone base
  const state = JSON.parse(JSON.stringify(map.base));
  state.year = targetYear;

  // Ensure timeline sorted
  const diffs = [...(map.timeline || [])].sort((a,b) => a.year - b.year);

  for (const diff of diffs) {
    if (diff.year > targetYear) break;
    for (const ch of (diff.changes || [])) {
      applyChange(state, ch);
    }
  }
  return state;
}

// Apply single change to state
function applyChange(state, ch) {
  const op = ch.op;
  if (op === 'add_country') {
    if (!state.countries.find(c=>c.id===ch.id)) state.countries.push(ch.data);
  } else if (op === 'remove_country') {
    state.countries = state.countries.filter(c=>c.id!==ch.id);
  } else if (op === 'update_country') {
    const c = state.countries.find(c=>c.id===ch.id);
    if (c) Object.assign(c, ch.data);
  } else if (op === 'add_city') {
    if (!state.cities.find(c=>c.id===ch.id)) state.cities.push(ch.data);
  } else if (op === 'remove_city') {
    state.cities = state.cities.filter(c=>c.id!==ch.id);
  } else if (op === 'move_city') {
    const c = state.cities.find(c=>c.id===ch.id);
    if (c) c.at = ch.data.at;
  } else if (op === 'add_arrow') {
    state.arrows = state.arrows || [];
    if (!state.arrows.find(a=>a.id===ch.id)) state.arrows.push(ch.data);
  } else if (op === 'remove_arrow') {
    if (state.arrows) state.arrows = state.arrows.filter(a=>a.id!==ch.id);
  } else if (op === 'add_alliance') {
    state.alliances = state.alliances || [];
    if (!state.alliances.find(a=>a.id===ch.id)) state.alliances.push(ch.data);
  } else if (op === 'remove_alliance') {
    if (state.alliances) state.alliances = state.alliances.filter(a=>a.id!==ch.id);
  }
}

// Visual transition between two years (for animation)
// Returns interpolated state at progress k (0..1) between fromYear and toYear
export function interpolateMapState(map, fromYear, toYear, k) {
  const s0 = getStateForYear(map, fromYear);
  const s1 = getStateForYear(map, toYear);
  // Simple: cross-fade colors, lerp arrow progress
  // For true morphing, countries added/removed fade in/out
  const state = JSON.parse(JSON.stringify(s1));
  state._interp = { fromYear, toYear, k, added: [], removed: [] };

  const ids0 = new Set(s0.countries.map(c=>c.id));
  const ids1 = new Set(s1.countries.map(c=>c.id));
  for (const c of s1.countries) if (!ids0.has(c.id)) state._interp.added.push(c.id);
  for (const c of s0.countries) if (!ids1.has(c.id)) state._interp.removed.push(c.id);

  return state;
}

// Simple Canvas draw for procedural engine (placeholder — real drawing uses map style)
export function drawMap(g, state, opts = {}) {
  const { x=0, y=0, w=800, h=500, highlight=[] } = opts;
  g.save();
  // Draw each country as polygon
  for (const c of (state.countries||[])) {
    const isHi = highlight.includes(c.id);
    g.fillStyle = isHi ? shade(c.color, 0.2) : c.color;
    g.strokeStyle = c.border || '#1a1a1a';
    g.lineWidth = isHi ? 3 : 1.2;
    g.beginPath();
    const pts = c.path;
    if (pts && pts.length) {
      g.moveTo(x + pts[0][0], y + pts[0][1]);
      for (let i=1;i<pts.length;i++) g.lineTo(x + pts[i][0], y + pts[i][1]);
      g.closePath();
      g.fill(); g.stroke();
    }
    // Label
    if (c.labelAt) {
      g.fillStyle = '#fff';
      g.font = '700 13px Nunito';
      g.textAlign = 'center';
      g.fillText(c.name?.ar || c.id, x + c.labelAt[0], y + c.labelAt[1]);
    }
  }
  // Draw cities
  for (const city of (state.cities||[])) {
    g.fillStyle = city.kind==='capital' ? '#FFD700' : '#fff';
    g.beginPath(); g.arc(x + city.at[0], y + city.at[1], city.kind==='capital'?5:3, 0, Math.PI*2); g.fill();
    g.strokeStyle = '#000'; g.lineWidth=1; g.stroke();
  }
  // Draw arrows
  for (const ar of (state.arrows||[])) {
    g.strokeStyle = ar.color || '#ff4444';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x + ar.from[0], y + ar.from[1]);
    g.lineTo(x + ar.to[0], y + ar.to[1]);
    g.stroke();
    // arrowhead
    const ang = Math.atan2(ar.to[1]-ar.from[1], ar.to[0]-ar.from[0]);
    g.fillStyle = ar.color || '#ff4444';
    g.beginPath();
    g.moveTo(x + ar.to[0], y + ar.to[1]);
    g.lineTo(x + ar.to[0] - Math.cos(ang-0.5)*10, y + ar.to[1] - Math.sin(ang-0.5)*10);
    g.lineTo(x + ar.to[0] - Math.cos(ang+0.5)*10, y + ar.to[1] - Math.sin(ang+0.5)*10);
    g.closePath(); g.fill();
  }
  g.restore();
}

function shade(hex, k) {
  // simple shade helper (inline to avoid import cycle)
  const n = parseInt(hex.slice(1),16);
  let r=(n>>16)&255, g2=(n>>8)&255, b=n&255;
  if (k<0) { r*=1+k; g2*=1+k; b*=1+k; } else { r+=(255-r)*k; g2+=(255-g2)*k; b+=(255-b)*k; }
  return `rgb(${r|0},${g2|0},${b|0})`;
}

export async function listMaps() {
  const reg = await loadRegistry();
  return reg.maps || [];
}

export function clearCache() { _cache.clear(); _registry=null; }
