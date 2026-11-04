// library/engine/layered-renderer.js — رسم الشخصيات متعددة الطبقات
// Layered SVG character renderer for "layered-svg" and "hybrid" engines.
// Keeps rig2d.js untouched — this is an additive renderer.
//
// Coordinates: same logical space as rig2d (feet 0,0, up -y, baseHeight 240)
// Layers are anchored to rig points and move with pose.

import { E, S } from '/engine/core.js';
import { POSES, breathe } from '/engine/rig2d.js';

// Cache for SVG images (browser Image objects)
const _imgCache = new Map();
const _svgTextCache = new Map();

// Load SVG text (for hash verification or inline draw)
export async function loadSvgText(url) {
  if (_svgTextCache.has(url)) return _svgTextCache.get(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text();
    _svgTextCache.set(url, txt);
    return txt;
  } catch (e) {
    console.warn(`layered-renderer: failed to load ${url}`, e.message);
    return null;
  }
}

// Load SVG as Image (for canvas drawImage)
export async function loadSvgImage(url) {
  if (_imgCache.has(url)) return _imgCache.get(url);
  const img = new Image();
  img.src = url;
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error(`Failed to load ${url}`));
  });
  _imgCache.set(url, img);
  return img;
}

// Get pose anchors (uses rig2d POSES)
function getPoseAnchors(poseName) {
  const base = POSES[poseName] || POSES.stand;
  // Map rig.anchors (head, shoulder, hip, etc) to POSES keys
  // POSES uses: head, sh, hip, eF/hF, eB/hB, kF/fF, kB/fB
  // manifest rig uses: head, neck, shoulder, hip, elbowF/handF, etc
  // For layered renderer, we use POSES as source of truth for movement
  return base;
}

// Draw layered character
// g: canvas context (logical units already transformed)
// manifest: loaded character manifest
// opts: { x, y, s, pose, expr, facing, t, breathe:bool }
export async function drawLayeredCharacter(g, manifest, opts = {}) {
  const { x = E.W/2, y = E.H*0.75, s = 1, pose = 'stand', expr = 'neutral', facing = 1, t = 0 } = opts;
  const baseLayers = manifest.wardrobe?.base?.layers || [];
  if (!baseLayers.length) {
    console.warn(`drawLayeredCharacter: no layers for ${manifest.id}`);
    return;
  }

  // Get current pose points
  let poseData = getPoseAnchors(pose);
  // Apply breathe for idle
  if (opts.breathe !== false) {
    poseData = breathe(poseData, t, 1, 0);
  }

  // Anchor map: rig name -> POSES key
  const anchorMap = {
    head: 'head', neck: 'sh', shoulder: 'sh', hip: 'hip',
    elbowF: 'eF', handF: 'hF', elbowB: 'eB', handB: 'hB',
    kneeF: 'kF', footF: 'fF', kneeB: 'kB', footB: 'fB',
    root: 'hip'
  };

  // For each layer, find its anchor position and draw
  for (const lyr of [...baseLayers].sort((a,b)=>(a.z||0)-(b.z||0))) {
    let src = lyr.src;
    // Expression override: check if face_angry.svg exists for expr
    if (lyr.id === 'face' && expr && expr !== 'neutral') {
      const alt = src.replace('face.svg', `face_${expr}.svg`);
      // We will try to load alt, fallback to original if missing
      // For now, just try alt URL
      // We need manifest dir to resolve correctly — layers are relative to manifest
      // In browser, layers are fetched via /library/characters/<id>/layers/...
      const baseUrl = `/library/characters/${manifest.id}/`;
      const altUrl = baseUrl + alt;
      try {
        // Test if exists via fetch HEAD? For simplicity, try alt first
        const test = await fetch(altUrl, {method:'HEAD'});
        if (test.ok) src = alt;
      } catch {}
    }

    const anchorName = lyr.anchor || 'hip';
    const poseKey = anchorMap[anchorName] || 'hip';
    const pt = poseData[poseKey] || [0,0];

    // World position = character base (x,y) + anchor offset * s * facing
    const wx = x + pt[0] * s * facing;
    const wy = y + pt[1] * s;

    // Load and draw SVG image
    const url = `/library/characters/${manifest.id}/${src}`;
    try {
      const img = await loadSvgImage(url);
      // Draw centered at anchor (SVG viewBox centered)
      // SVG sizes are ~60-90, we scale to fit
      const drawW = (img.width || 80) * s * 0.8;
      const drawH = (img.height || 80) * s * 0.8;
      g.save();
      // Handle facing flip
      if (facing === -1) {
        g.translate(wx, wy);
        g.scale(-1, 1);
        g.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
      } else {
        g.drawImage(img, wx - drawW/2, wy - drawH/2, drawW, drawH);
      }
      g.restore();
    } catch (e) {
      // Fallback: draw placeholder box
      g.save();
      g.fillStyle = lyr.tint || '#888';
      g.fillRect(wx - 20*s, wy - 20*s, 40*s, 40*s);
      g.fillStyle = '#fff';
      g.font = `${12*s}px sans-serif`;
      g.textAlign = 'center';
      g.fillText(lyr.id, wx, wy);
      g.restore();
    }
  }

  // Draw simple shadow
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.beginPath();
  g.ellipse(x, y+2, 34*s, 6*s, 0, 0, Math.PI*2);
  g.fill();
}

// Synchronous fallback for procedural engine bridge
export function getOutfitForRig(manifest) {
  const base = manifest.wardrobe?.base;
  return {
    top: base?.top || 'suit',
    color: base?.color || '#2C3E50',
    head: base?.head || 'none',
    face: base?.face || 'none',
    layers: base?.layers || [],
    _engine: manifest.engine,
    _id: manifest.id,
  };
}
