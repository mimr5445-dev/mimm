// library/engine/character.js — المحمّل الموحد للشخصيات
// Unified loader for characters — works in browser (fetch) and Node (fs).
// Supports all three engines: procedural / layered-svg / hybrid
//
// Usage (inside any shot file):
//   import { loadCharacter, getOutfit } from '/library/engine/character.js';
//   const char = await loadCharacter('test_historian_a'); // returns manifest
//   drawFigure(g, { x, y, s, outfit: getOutfit(char), pose: POSES.stand, expr: 'neutral', rim });
//
// For Claude: call loadCharacter(id) before drawing, cache result.
//
// Engine names are unified: procedural | layered-svg | hybrid (no other values allowed)

const ENGINES = ['procedural', 'layered-svg', 'hybrid'];

// In-browser: registry is fetched from /library/registry.json
// In-Node: registry is read from filesystem (fallback)

let _registry = null;
let _cache = new Map();

export async function loadRegistry() {
  if (_registry) return _registry;
  try {
    const res = await fetch('/library/registry.json');
    if (res.ok) { _registry = await res.json(); return _registry; }
  } catch {}
  // fallback for file:// or test
  try {
    const fs = await import('fs');
    const path = await import('path');
    const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
    const txt = fs.readFileSync(path.join(root, 'library/registry.json'), 'utf8');
    _registry = JSON.parse(txt);
    return _registry;
  } catch (e) {
    throw new Error('character.js: cannot load registry.json — ' + e.message);
  }
}

export async function loadCharacter(id) {
  if (_cache.has(id)) return _cache.get(id);
  const registry = await loadRegistry();
  const entry = registry.characters?.find(c => c.id === id);
  if (!entry) throw new Error(`character '${id}' not found in registry.json. Available: ${(registry.characters||[]).map(c=>c.id).join(', ')}`);
  if (!ENGINES.includes(entry.engine)) throw new Error(`character '${id}' has invalid engine '${entry.engine}' — must be one of: ${ENGINES.join(', ')}`);

  let manifest;
  // Browser: fetch manifest via HTTP
  try {
    const res = await fetch(entry.path);
    if (res.ok) { manifest = await res.json(); }
  } catch {}
  // Node fallback
  if (!manifest) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
      const txt = fs.readFileSync(path.join(root, entry.path.replace(/^\//,'')), 'utf8');
      manifest = JSON.parse(txt);
    } catch (e) {
      throw new Error(`character.js: failed to load manifest for '${id}' at ${entry.path}: ${e.message}`);
    }
  }

  // Validate engine consistency between registry and manifest
  if (manifest.engine !== entry.engine) {
    throw new Error(`character '${id}' engine mismatch: registry says '${entry.engine}' but manifest says '${manifest.engine}'`);
  }

  _cache.set(id, manifest);
  return manifest;
}

// Convert manifest.wardrobe.base → outfit object understood by rig2d.js drawFigure
// This is the bridge that keeps the existing renderer working without modification.
export function getOutfit(manifest, variant = null) {
  const base = manifest.wardrobe?.base;
  if (!base) throw new Error(`character '${manifest.id}' has no wardrobe.base`);
  const src = variant && manifest.wardrobe.variants?.[variant] ? { ...base, ...manifest.wardrobe.variants[variant] } : base;
  // Map manifest fields → rig2d outfit fields
  return {
    top: src.top || 'suit',
    color: src.color || '#2C3E50',
    color2: src.color2 || null,
    head: src.head || 'none',
    headColor: src.headColor || null,
    face: src.face || 'none',
    legs: src.legs || null,
    gloves: src.gloves || null,
    number: src.number || null,
    kid: src.kid || false,
    // Preserve layers for layered-svg/hybrid renderers
    layers: src.layers || [],
    _engine: manifest.engine,
    _id: manifest.id,
  };
}

// Helper: get palette
export function getPalette(manifest) {
  return manifest.palette || { primary: '#2C3E50', accent: '#BDC3C7', skin: '#0e0b12' };
}

// Helper: list available characters (for Claude to discover)
export async function listCharacters() {
  const reg = await loadRegistry();
  return reg.characters || [];
}

// Clear cache (useful for hot-reload in dev)
export function clearCache() { _cache.clear(); _registry = null; }
