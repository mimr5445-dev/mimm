// scenes/shots/02_map.js — اختبار الخريطة الزمنية
import { E, V, registerShot } from '/engine/core.js';
import { loadMap, getStateForYear, drawMap, interpolateMapState } from '/library/engine/map.js';

let WORLD = null;
await loadMap('test_region_a').then(m => WORLD = m).catch(e => console.log('map load failed', e));

function drawTestMap(g, state, opts) {
  // خلفية
  g.fillStyle = '#0f1122';
  g.fillRect(-E.W, -E.H, E.W*3, E.H*3);
  // عنوان
  g.fillStyle = '#C9A86A';
  g.font = '700 32px Nunito';
  g.textAlign = 'center';
  g.fillText(`${state.year} — ${state.countries.length} دول`, E.W/2, 90);
  // رسم الخريطة في المنتصف
  drawMap(g, state, {x: E.W/2 - 400, y: E.H/2 - 150, w: 800, h: 300, highlight: opts.highlight||[]});
  // تفاصيل
  g.fillStyle = '#fff';
  g.font = '500 14px monospace';
  g.textAlign = 'left';
  state.countries.forEach((c,i) => {
    g.fillStyle = c.color;
    g.fillRect(80, 120 + i*22, 14, 14);
    g.fillStyle = '#fff';
    g.fillText(`${c.id} (${c.name.ar})`, 100, 131 + i*22);
  });
  if (state.arrows && state.arrows.length) {
    g.fillStyle = '#ff4444';
    g.font = '600 13px Nunito';
    g.fillText(`→ ${state.arrows.length} أسهم`, E.W - 200, 120);
  }
  if (state.alliances && state.alliances.length) {
    g.fillStyle = '#9C27B0';
    g.fillText(`◆ ${state.alliances.length} تحالف`, E.W - 200, 140);
  }
}

registerShot('s003', {
  draw(g, t, info) {
    if (!WORLD) { g.fillStyle='#ff6b6b'; g.fillText('loading map', E.W/2, E.H/2); return; }
    const state = getStateForYear(WORLD, 1914);
    drawTestMap(g, state, {});
    g.fillStyle = '#C9A86A';
    g.font = '600 16px Nunito';
    g.textAlign = 'center';
    g.fillText('1914 — الحالة الأصلية (2 دول)', E.W/2, E.H - 40);
  }
});

registerShot('s004', {
  draw(g, t, info) {
    if (!WORLD) return;
    const state = getStateForYear(WORLD, 1918);
    drawTestMap(g, state, {});
    g.fillStyle = '#C9A86A';
    g.font = '600 16px Nunito';
    g.textAlign = 'center';
    g.fillText('1918 — بعد التغيير (3 دول + معركة)', E.W/2, E.H - 40);
  }
});

registerShot('s005', {
  draw(g, t, info) {
    if (!WORLD) return;
    const state = getStateForYear(WORLD, 1922);
    drawTestMap(g, state, {});
    g.fillStyle = '#C9A86A';
    g.font = '600 16px Nunito';
    g.textAlign = 'center';
    g.fillText('1922 — تحالف (+أسهم)', E.W/2, E.H - 40);
  }
});

registerShot('s006', {
  draw(g, t, info) {
    if (!WORLD) return;
    const k = t / info.dur;
    const state = interpolateMapState(WORLD, 1914, 1918, k);
    drawTestMap(g, state, {});
    g.fillStyle = '#ffd86e';
    g.font = '700 18px Nunito';
    g.textAlign = 'center';
    g.fillText(`انتقال 1914→1918 — k=${k.toFixed(2)} added=${state._interp.added.join(',')}`, E.W/2, E.H - 40);
    // progress bar
    g.fillStyle = 'rgba(255,255,255,0.2)';
    g.fillRect(E.W/2 - 200, E.H - 22, 400, 8);
    g.fillStyle = '#C9A86A';
    g.fillRect(E.W/2 - 200, E.H - 22, 400*k, 8);
  }
});
