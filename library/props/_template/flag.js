// library/props/_template/flag.js — مثال عنصر علم
export function flag(g, x, y, opts = {}) {
  const w = opts.w || 60, h = opts.h || 40;
  const color = opts.color || '#CC0000';
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
  g.strokeStyle = '#1a1a1a';
  g.lineWidth = 1;
  g.strokeRect(x, y, w, h);
  // pole
  g.fillStyle = '#8B7355';
  g.fillRect(x, y, 3, h+20);
}
