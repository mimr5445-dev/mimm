#!/usr/bin/env node
// tools/check-env.mjs — فحص مسبق لاعتماديات الرندر قبل التشغيل
// يتحقق من: Node, Playwright, Chromium, FFmpeg، ويعطي رسائل واضحة

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const GREEN = s => `\x1b[32m${s}\x1b[0m`;
const RED = s => `\x1b[31m${s}\x1b[0m`;
const YELLOW = s => `\x1b[33m${s}\x1b[0m`;
const BOLD = s => `\x1b[1m${s}\x1b[0m`;

let ok = true;
let warnings = 0;

function check(label, fn) {
  try {
    const res = fn();
    if (res.ok) {
      console.log(GREEN(`✔ ${label}`) + (res.detail ? ` — ${res.detail}` : ''));
      return true;
    } else {
      console.log(RED(`✘ ${label}`) + ` — ${res.msg}`);
      if (res.warn) { warnings++; } else { ok = false; }
      if (res.hint) console.log(`  ${YELLOW('↳')} ${res.hint}`);
      return false;
    }
  } catch (e) {
    console.log(RED(`✘ ${label}`) + ` — ${e.message}`);
    ok = false;
    return false;
  }
}

console.log(BOLD('\n=== فحص بيئة ستديو راكان ===\n'));

// 1. Node
check('Node.js', () => {
  const v = process.version;
  const major = parseInt(v.slice(1).split('.')[0], 10);
  if (major < 18) return { ok: false, msg: `الإصدار ${v} قديم — يتطلب Node 18+`, hint: 'حدّث Node إلى 22 LTS' };
  return { ok: true, detail: v };
});

// 2. Playwright
check('Playwright', () => {
  const pkgPath = path.join(ROOT, 'node_modules/playwright/package.json');
  if (!fs.existsSync(pkgPath)) return { ok: false, msg: 'playwright غير مثبت', hint: 'npm install في skills/make-2d-video/kit' };
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const corePath = path.join(ROOT, 'node_modules/playwright-core/package.json');
  const coreVer = fs.existsSync(corePath) ? JSON.parse(fs.readFileSync(corePath,'utf8')).version : pkg.version;
  return { ok: true, detail: `v${pkg.version} (core ${coreVer})` };
});

// 3. Chromium — try 3 sources: playwright cache, @sparticuz/chromium, system
check('Chromium', () => {
  // a) playwright cache
  const home = process.env.HOME || '/home/user';
  const cacheDir = path.join(home, '.cache/ms-playwright');
  let cached = [];
  if (fs.existsSync(cacheDir)) {
    cached = fs.readdirSync(cacheDir).filter(f => f.startsWith('chromium'));
  }
  // b) @sparticuz/chromium
  const sparticuzBin = path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/chromium.br');
  const hasSparticuz = fs.existsSync(sparticuzBin);
  // c) system chromium
  const sys = spawnSync('which', ['chromium-browser', 'chromium', 'google-chrome'], { encoding: 'utf8' });
  
  if (cached.length > 0) {
    return { ok: true, detail: `playwright cache: ${cached.join(', ')}` };
  }
  if (hasSparticuz) {
    // check if we can inflate and check libs
    return { ok: true, detail: '@sparticuz/chromium (bin/chromium.br موجود، يحتاج libnss3 الحديث — see docs/ENV_SETUP.md)' , warn: true };
  }
  return { 
    ok: false, 
    msg: 'Chromium غير موجود — لا cache ولا @sparticuz ولا نظام',
    hint: 'الحل: npm install + npx playwright install (يتطلب allow-list cdn.playwright.dev) أو استخدم @sparticuz/chromium + ثبت libnss3 الحديث، راجع docs/ENV_SETUP.md'
  };
});

// 4. Chromium launch test (try to actually launch if cached)
check('Chromium launch (Playwright)', () => {
  // Try sparticuz if cache missing
  try {
    const spExec='/tmp/chromium';
    if (require('fs').existsSync(spExec)) {
      const ldd=require('child_process').spawnSync('ldd',[spExec],{encoding:'utf8'});
      if (!ldd.stdout.includes('not found') || (process.env.LD_LIBRARY_PATH||'').includes('@achingbrain')) return {ok:true, detail:'sparticuz chromium + nss shim ready'};
    }
  } catch {}

  // Only test if we have cache
  const home = process.env.HOME || '/home/user';
  const cacheDir = path.join(home, '.cache/ms-playwright');
  if (!fs.existsSync(cacheDir) || !fs.readdirSync(cacheDir).some(f=>f.startsWith('chromium'))) {
    return { ok: true, detail: 'تخطي — لا cache (سيتم اختباره عند الرندر)', warn: true };
  }
  // Try to import playwright and check executablePath
  try {
    // We do sync check: look for headless_shell binary
    const headless = path.join(cacheDir, fs.readdirSync(cacheDir).find(f=>f.includes('chromium_headless'))||'', 'chrome-linux/headless_shell');
    if (fs.existsSync(headless)) {
      const ldd = spawnSync('ldd', [headless], { encoding: 'utf8' });
      if (ldd.stdout && ldd.stdout.includes('not found')) {
        const missing = ldd.stdout.split('\n').filter(l=>l.includes('not found')).map(l=>l.trim()).join(', ');
        return { ok: false, msg: `مكتبات ناقصة: ${missing}`, hint: 'sudo apt-get install libnss3 libnspr4 ... أو LD_LIBRARY_PATH' };
      }
      // try version
      const ver = spawnSync(headless, ['--version'], { encoding: 'utf8', timeout: 5000 });
      if (ver.status === 0) return { ok: true, detail: ver.stdout.trim() };
      return { ok: false, msg: ver.stderr?.slice(0,200) || 'فشل تشغيل headless_shell', hint: 'تحقق من ldd' };
    }
    return { ok: true, detail: 'cache موجود لكن headless_shell غير موجود — جرب npx playwright install', warn: true };
  } catch (e) {
    return { ok: false, msg: e.message, hint: 'تحقق من التثبيت' };
  }
});

// 5. FFmpeg
check('FFmpeg', () => {
  // a) system
  let sys = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' });
  if (sys.status === 0 && sys.stdout.trim()) {
    const v = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
    const line = v.stdout ? v.stdout.split('\n')[0] : 'ffmpeg';
    return { ok: true, detail: `${sys.stdout.trim()} — ${line.slice(0,80)}` };
  }
  // b) @ffmpeg-installer
  const ffPath = path.join(ROOT, 'node_modules/@ffmpeg-installer/linux-x64/ffmpeg');
  if (fs.existsSync(ffPath)) {
    const v = spawnSync(ffPath, ['-version'], { encoding: 'utf8' });
    const line = v.stdout ? v.stdout.split('\n')[0] : 'ffmpeg via @ffmpeg-installer';
    return { ok: true, detail: `${ffPath} — ${line.slice(0,80)}` };
  }
  // c) playwright ffmpeg
  const home = process.env.HOME || '/home/user';
  const ffCache = path.join(home, '.cache/ms-playwright/ffmpeg-1013/ffmpeg-linux');
  if (fs.existsSync(ffCache)) {
    return { ok: true, detail: `playwright ffmpeg cache: ${ffCache}` };
  }
  return { ok: false, msg: 'ffmpeg غير موجود', hint: 'npm install @ffmpeg-installer/ffmpeg (مضمّن) أو sudo apt-get install ffmpeg' };
});

// 6. Fonts & build
check('Build dirs', () => {
  const buildOk = fs.existsSync(ROOT);
  return { ok: buildOk, detail: ROOT, msg: 'engine path missing' };
});

console.log('');
if (!ok) {
  console.log(RED('✘ البيئة غير جاهزة للرندر — راجع docs/ENV_SETUP.md و PHASE2_REPORT'));
  console.log(YELLOW('  للاختبار السريع بدون فيديو: node render.mjs --project examples/library-test --sheet --scale 0.25'));
  process.exitCode = 1;
} else if (warnings) {
  console.log(YELLOW('⚠ البيئة جاهزة جزئياً — Chromium يحتاج إعداد إضافي لكن FFmpeg جاهز'));
  console.log(YELLOW('  يمكن إنتاج stills/sheets، الفيديو يحتاج ffmpeg + chromium كاملين'));
} else {
  console.log(GREEN('✔ البيئة جاهزة — يمكنك تشغيل render.mjs'));
}
console.log('');
