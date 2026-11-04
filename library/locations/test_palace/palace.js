// library/locations/test_palace/palace.js — خلفية قصر قابلة لإعادة الاستخدام
// Reusable palace interior background. Uses same mood/fx as kit sets.

import { E, V } from '/skills/make-2d-video/kit/engine/core.js';

export function palace(g, t, cam, opts = {}) {
  const moodName = opts.mood || 'interiorWarm';
  // Lazy import to avoid circular deps — caller passes mood() if needed
  // For test, we draw simple gradient + pillars
  const colors = {
    interiorWarm: ['#4a3646', '#5a3a34', '#f9d49c'],
    night: ['#0b1028', '#1d2550', '#3a3570'],
  };
  const sky = colors[moodName] || colors.interiorWarm;
  // backdrop
  g.save();
  const grad = g.createLinearGradient(0, 0, 0, E.H);
  sky.forEach((c,i) => grad.addColorStop(i/(sky.length-1), c));
  g.fillStyle = grad;
  g.fillRect(-E.W, -E.H, E.W*3, E.H*3);
  // pillars
  for (let i=-1; i<=2; i++) {
    const x = E.W/2 + i*400 - (cam?.x||0)*0.5;
    g.fillStyle = '#2a1e2a';
    g.fillRect(x-30, E.H*0.2, 60, E.H*0.6);
    g.fillStyle = '#3a2a37';
    g.fillRect(x-40, E.H*0.18, 80, 20);
  }
  // floor
  g.fillStyle = '#3d2c38';
  g.fillRect(-E.W, E.H*0.75, E.W*3, E.H*0.25);
  g.restore();
  return { GY: E.H*0.75, M: { rim: '#ffc68a' } };
}
