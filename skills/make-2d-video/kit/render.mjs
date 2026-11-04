// render.mjs — deterministic frame renderer (headless Chromium -> ffmpeg), parallel workers.
//   node render.mjs --project projects/my-video                      full video  -> build/video_silent.mp4
//   node render.mjs --project P --from 30 --to 45 --scale 0.5         preview a range
//   node render.mjs --project P --sheet                               one still per shot -> build/sheets/*.png
//   node render.mjs --project P --stills 3.5,12,40                    stills at times -> build/stills
//   node render.mjs --project P --styles dusk,midnight,golden,neon --at 3.5,12,40   style comparison grid
// Options: --workers N  --scale K  --style ID  --debug  --format png|jpeg  --crf 18  --gl auto|gpu|swiftshader  --out FILE
// --- pre-check: dependency guard (لا يغيّر هوية المحرك، فقط يتحقق قبل التشغيل) ---
import { spawnSync as _checkSpawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
// resolve ffmpeg: system > @ffmpeg-installer > playwright cache
let FFMPEG_BIN = 'ffmpeg';
try {
  const sys = _checkSpawnSync('which', ['ffmpeg'], { encoding: 'utf8' });
  if (!sys.stdout || !sys.stdout.trim()) {
    const ffLocal = path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/@ffmpeg-installer/linux-x64/ffmpeg');
    if (fs.existsSync(ffLocal)) FFMPEG_BIN = ffLocal;
  }
} catch {}
// sparticuz chromium helper: if playwright cache missing, try @sparticuz
let CHROMIUM_EXTRA_ARGS = [];
let LD_LIB_HINT = '';
let SPARTICUZ_EXEC = null;
let SPARTICUZ_ARGS = [];
try {
  const home = process.env.HOME || '/home/user';
  const hasCache = fs.existsSync(path.join(home, '.cache/ms-playwright')) && fs.readdirSync(path.join(home, '.cache/ms-playwright')).some(f=>f.startsWith('chromium'));
  if (!hasCache) {
    const spBr = path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/@sparticuz/chromium/bin/chromium.br');
    const nssSo = path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/@achingbrain/nss/linux/libnss3.so');
    const shimSo = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tools/nss_shim.so');
    if (fs.existsSync(spBr) && fs.existsSync(nssSo)) {
      LD_LIB_HINT = path.dirname(nssSo);
      // prepare env for sparticuz chromium
      process.env.LD_LIBRARY_PATH = LD_LIB_HINT + ':' + (process.env.LD_LIBRARY_PATH||'');
      if (fs.existsSync(shimSo)) process.env.LD_PRELOAD = shimSo + (process.env.LD_PRELOAD ? ':'+process.env.LD_PRELOAD : '');
      // prepare chromium binary synchronously if needed (inflate is async, but we can check /tmp/chromium)
      if (!fs.existsSync('/tmp/chromium')) {
        // will be prepared on first launch via async helper
        SPARTICUZ_EXEC = '/tmp/chromium'; // expected path
      } else {
        SPARTICUZ_EXEC = '/tmp/chromium';
      }
      // get sparticuz args (sync read via require)
      try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const Chromium = require(path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/@sparticuz/chromium/build/index.js'));
        SPARTICUZ_ARGS = Chromium.args || [];
        // ensure swiftshader dir exists for 92 (needs /tmp/swiftshader)
        if (!fs.existsSync('/tmp/swiftshader') && fs.existsSync('/tmp/libGLESv2.so')) {
          fs.mkdirSync('/tmp/swiftshader', {recursive:true});
          for (const f of ['libGLESv2.so','libvk_swiftshader.so','vk_swiftshader_icd.json']) {
            if (fs.existsSync(path.join('/tmp', f))) fs.copyFileSync(path.join('/tmp', f), path.join('/tmp/swiftshader', f));
          }
        }
      } catch {}
    }
  }
} catch {}
async function ensureSparticuzReady() {
  if (SPARTICUZ_EXEC && !fs.existsSync(SPARTICUZ_EXEC)) {
    try {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const Chromium = require(path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/@sparticuz/chromium/build/index.js'));
      const p = await Chromium.executablePath;
      SPARTICUZ_EXEC = p;
    } catch {}
  }
  // ensure swiftshader
  if (!fs.existsSync('/tmp/swiftshader') && fs.existsSync('/tmp/libGLESv2.so')) {
    fs.mkdirSync('/tmp/swiftshader', {recursive:true});
    for (const f of ['libGLESv2.so','libvk_swiftshader.so','vk_swiftshader_icd.json']) {
      if (fs.existsSync(path.join('/tmp', f)) && !fs.existsSync(path.join('/tmp/swiftshader', f))) fs.copyFileSync(path.join('/tmp', f), path.join('/tmp/swiftshader', f));
    }
  }
}
function getLaunchOpts() {
  if (SPARTICUZ_EXEC && fs.existsSync(SPARTICUZ_EXEC)) {
    return { executablePath: SPARTICUZ_EXEC, args: [...LAUNCH.args, ...SPARTICUZ_ARGS.filter(a=>!LAUNCH.args.includes(a))] };
  }
  return LAUNCH;
}

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = {}; { const a = process.argv.slice(2); for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; args[k] = v; } } }
if (!args.project) { console.error('usage: node render.mjs --project projects/<name> [options]'); process.exit(1); }
const PROJECT = path.resolve(args.project);
const BUILD = path.join(PROJECT, 'build'); fs.mkdirSync(BUILD, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

function listScenes(dir, base) { let out = []; if (!fs.existsSync(dir)) return out; for (const f of fs.readdirSync(dir).sort()) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) out = out.concat(listScenes(p, `${base}/${f}`)); else if (f.endsWith('.js') && !f.startsWith('_')) out.push(`${base}/${f}`); } return out; }
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/__manifest') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(listScenes(path.join(PROJECT, 'scenes'), '/project/scenes'))); }
  const p = url.startsWith('/project/') ? path.join(PROJECT, url.slice(9)) : path.join(ROOT, url);
  if (!(p.startsWith(ROOT) || p.startsWith(PROJECT)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const PORT = server.address().port;
const gl = args.gl || (process.platform === 'linux' ? 'swiftshader' : 'auto');
const LAUNCH = { args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', ...(gl === 'swiftshader' ? ['--use-angle=swiftshader'] : []), ...(gl === 'gpu' ? ['--enable-gpu', '--use-angle=default'] : [])] };
const FORMAT = args.format === 'jpeg' ? 'jpeg' : 'png';
const CFG = JSON.parse(fs.readFileSync(path.join(PROJECT, 'config.json'), 'utf8'));
const FPS = CFG.fps || 24;

async function openPlayer(browser, style) {
  const qs = new URLSearchParams(); if (args.scale) qs.set('scale', args.scale); if (style || args.style) qs.set('style', style || args.style); if (args.debug) qs.set('debug', '1');
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { const t = m.text(); if (/ERROR|missing/i.test(t)) console.log('[page]', t); });
  await page.goto(`http://localhost:${PORT}/player.html?${qs}`);
  await page.waitForFunction('window.READY === true || !!window.BOOT_ERROR', null, { timeout: 120000 });
  const boot = await page.evaluate('window.BOOT_ERROR'); if (boot) throw new Error('Player failed to boot: ' + boot);
  const [w, h] = await page.evaluate('window.OUT'); await page.setViewportSize({ width: w, height: h });
  return page;
}
const shot = (page, f) => page.evaluate(i => window.renderFrame(i), f).then(() => page.screenshot({ type: FORMAT, ...(FORMAT === 'jpeg' ? { quality: 94 } : {}) }));
const fmtT = s => `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`;

async function renderVideo() {
  await ensureSparticuzReady();
  const b0 = await chromium.launch(getLaunchOpts()); const p0 = await openPlayer(b0);
  const total = await p0.evaluate('window.TOTAL_FRAMES'), fps = FPS;
  const missing = (await p0.evaluate('window.SHOT_LIST')).filter(s => !s.ok); if (missing.length) console.log(`WARNING: ${missing.length} shots have no scene file yet: ${missing.slice(0, 12).map(s => s.id).join(', ')}${missing.length > 12 ? ' …' : ''}`);
  await b0.close();
  const f0 = Math.max(0, Math.round((+args.from || 0) * fps)), f1 = Math.min(total, args.to ? Math.round(+args.to * fps) : total);
  const W = Math.max(1, Math.min(+(args.workers || Math.max(1, Math.min(8, Math.floor(os.cpus().length / 2)))), Math.ceil((f1 - f0) / 24)));
  const partsDir = path.join(BUILD, 'parts'); fs.rmSync(partsDir, { recursive: true, force: true }); fs.mkdirSync(partsDir, { recursive: true });
  const chunk = Math.ceil((f1 - f0) / W); let done = 0; const t0 = Date.now(); const errs = new Set();
  console.log(`Rendering frames ${f0}-${f1} (${((f1 - f0) / fps).toFixed(1)} s) with ${W} worker(s)…`);
  const work = async (k) => {
    const a = f0 + k * chunk, b = Math.min(f1, a + chunk); if (a >= b) return null;
    const browser = await chromium.launch(getLaunchOpts()); const page = await openPlayer(browser);
    const out = path.join(partsDir, `part_${String(k).padStart(3, '0')}.mp4`);
    const ff = spawn(FFMPEG_BIN, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', args.preset || 'medium', '-crf', String(args.crf || 18), '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      const img = await shot(page, f); if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r)); done++;
      if (done % 48 === 0) { const el = (Date.now() - t0) / 1000, eta = (el / done) * (f1 - f0 - done); process.stdout.write(`  ${done}/${f1 - f0} frames  ${(done / el).toFixed(2)} fps  elapsed ${fmtT(el)}  eta ${fmtT(eta)}\n`); }
    }
    (await page.evaluate('window.ERRORS')).forEach(e => errs.add(e));
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close(); return out;
  };
  const parts = (await Promise.all([...Array(W)].map((_, k) => work(k)))).filter(Boolean);
  const list = path.join(partsDir, 'list.txt'); fs.writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const out = path.resolve(args.out || path.join(BUILD, args.from || args.to ? 'preview.mp4' : 'video_silent.mp4'));
  await new Promise((res, rej) => spawn(FFMPEG_BIN, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', c => (c ? rej(new Error('concat failed')) : res())));
  if (errs.size) { console.log(`\n${errs.size} shot error(s):`); [...errs].slice(0, 40).forEach(e => console.log('  ' + e)); }
  console.log(`\nDone: ${out}  (${fmtT((Date.now() - t0) / 1000)})`);
}
// grid of labelled images, laid out by the browser (works on every OS)
async function contactSheet(browser, items, outFile, cols = 4, cellW = 480) {
  const page = await browser.newPage({ viewport: { width: cols * (cellW + 12) + 12, height: 400 } });
  const html = `<html><body style="margin:0;background:#111;font:600 15px sans-serif;color:#eee"><div style="display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:12px;padding:12px">${items.map(it => `<div><img src="data:image/${FORMAT};base64,${it.img.toString('base64')}" style="width:${cellW}px;display:block;border-radius:4px"><div style="padding:5px 2px">${it.label.replace(/</g, '&lt;')}</div></div>`).join('')}</div></body></html>`;
  await page.setContent(html); await page.screenshot({ path: outFile, fullPage: true }); await page.close();
}
async function renderStills() {
  await ensureSparticuzReady();
  const browser = await chromium.launch(getLaunchOpts()); const styles = args.styles ? String(args.styles).split(',') : [args.style || null];
  const dir = path.join(BUILD, args.styles ? 'styles' : args.sheet ? 'sheets' : 'stills'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const all = [];
  for (const st of styles) {
    const page = await openPlayer(browser, st); const fps = FPS;
    let targets;
    if (args.sheet) targets = (await page.evaluate('window.SHOT_LIST')).map(s => ({ t: s.start + (s.end - s.start) * 0.45, label: `${s.id}  ${s.start.toFixed(1)}s${s.ok ? '' : '  (MISSING)'}` }));
    else targets = String(args.stills || args.at || '1').split(',').map(Number).map(t => ({ t, label: `${t}s` }));
    for (const tg of targets) { const img = await shot(page, Math.round(tg.t * fps)); const name = `${st ? st + '_' : ''}${tg.label.split(' ')[0].replace(/[^\w.]/g, '')}_${tg.t.toFixed(2)}.${FORMAT}`; fs.writeFileSync(path.join(dir, name), img); all.push({ img, label: `${st ? `[${st}] ` : ''}${tg.label}`, st }); }
    (await page.evaluate('window.ERRORS')).forEach(e => console.log('  shot error:', e)); await page.close();
  }
  if (args.styles) { const n = all.length / styles.length; await contactSheet(browser, all, path.join(dir, 'style_grid.png'), n, 420); }
  else { const per = 24; for (let i = 0; i < all.length; i += per) await contactSheet(browser, all.slice(i, i + per), path.join(dir, `sheet_${String(i / per + 1).padStart(2, '0')}.png`), 4, 440); }
  await browser.close(); console.log(`Wrote ${all.length} stills + contact sheet(s) to ${dir}`);
}
try { if (args.sheet || args.stills || args.styles) await renderStills(); else await renderVideo(); }
catch (e) {
  const msg = e.message || String(e);
  if (msg.includes('Executable doesn') || msg.includes('browserType.launch')) {
    console.error('RENDER FAILED: Chromium غير مثبت أو غير قابل للتشغيل');
    console.error('  السبب:', msg.slice(0,300));
    console.error('  الحل: node tools/check-env.mjs ثم راجع docs/ENV_SETUP.md');
    if (LD_LIB_HINT) console.error(`  تلميح: LD_LIBRARY_PATH=${LD_LIB_HINT}:$LD_LIBRARY_PATH قد يحل مشكلة libnss3 (مؤقت)`);
    console.error(`  FFmpeg المستخدم: ${FFMPEG_BIN}`);
  } else if (msg.includes('ffmpeg') || msg.includes('ENOENT') && msg.includes('ffmpeg')) {
    console.error('RENDER FAILED: FFmpeg مفقود');
    console.error(`  حاول: npm install @ffmpeg-installer/ffmpeg (مضمّن، لا يحتاج apt) — الحالي: ${FFMPEG_BIN}`);
  } else {
    console.error('RENDER FAILED:', msg);
  }
  process.exitCode = 1;
}
finally { server.close(); }
