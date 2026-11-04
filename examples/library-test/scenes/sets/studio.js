// scenes/sets/studio.js — خلفية بسيطة للاختبار
import { E } from '/engine/core.js';

export function studio(g, t, cam) {
  const GY = E.H * 0.78;
  // gradient backdrop
  const grad = g.createLinearGradient(0, 0, 0, E.H);
  grad.addColorStop(0, '#3d3360');
  grad.addColorStop(0.5, '#5a3a34');
  grad.addColorStop(1, '#3d2c38');
  g.fillStyle = grad;
  g.fillRect(-E.W, -E.H, E.W*3, E.H*3);
  // floor line
  g.fillStyle = '#3d2c38';
  g.fillRect(-E.W, GY, E.W*3, E.H - GY);
  g.strokeStyle = 'rgba(0,0,0,0.2)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(-E.W, GY); g.lineTo(E.W*2, GY); g.stroke();
  return { GY, M: { rim: '#ffc68a' } };
}
