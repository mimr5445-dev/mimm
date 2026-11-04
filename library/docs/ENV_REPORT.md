# تقرير تجهيز بيئة الرندر — ستديو راكان (مُحدّث: Chromium يعمل فعلياً)
**تاريخ:** 2026-11-04 (تحديث نهائي)
**البيئة:** Debian 12 bookworm, Node v22.22.3, npm 10.9.8

## 1. ما تم تثبيته

| الحزمة | الإصدار | الحجم | المصدر | طريقة |
|-------|---------|-------|--------|------|
| `playwright` | 1.56.0 | — | registry.npmjs.org | `npm install` |
| `@sparticuz/chromium` | **92.0.0** (مختار لتوافق NSS 3.26) | 53M .br → 147M | registry.npmjs.org | `npm install` (brotli داخل tarball) |
| `@ffmpeg-installer/ffmpeg` | 1.1.0 (N-47683) | 66M static | registry.npmjs.org | `npm install` (binary مضمّن) |
| `@achingbrain/nss` | 0.0.1 | 18M | registry.npmjs.org | يوفر libnss3.so 3.22 + libnspr4 |
| `tools/nss_shim.so` | — | 15K | مبني محلياً `gcc -shared` | يتجاوز فحص NSS_VersionCheck("3.26") |

**الاختيار 92.0.0:** chromium 92 يتطلب `NSS >=3.26` (runtime) بينما 112+ يتطلب `NSS >=3.35` و153 يتطلب `NSS_3.30`. مع `@achingbrain/nss` (3.22) + shim أصبح 92 يعمل، بينما الإصدارات الحديثة فشلت حتى مع shim.

## 2. ما تم اختباره (إثبات فعلي — 5 شروط)

### 1) فحص المكتبات الديناميكية
```
$ ldd /tmp/chromium
libnss3.so => not found
libnspr4.so => not found
libnssutil3.so => not found

$ LD_LIBRARY_PATH=kit/node_modules/@achingbrain/nss/linux:$LD_LIBRARY_PATH ldd /tmp/chromium
libnss3.so => .../@achingbrain/nss/linux/libnss3.so
libnspr4.so => .../libnspr4.so
# مع shim:
$ LD_LIBRARY_PATH=... LD_PRELOAD=kit/tools/nss_shim.so /tmp/chromium --version
→ Chromium 92.0.4515.0 (مع تحذيرات GPU غير حرجة، لكنه يفتح)
```

### 2) Chromium يفتح دون أخطاء
```
$ node kit/tools/prepare-chromium.mjs
→ /tmp/chromium (147M) + /tmp/swiftshader/*

$ LD_LIBRARY_PATH=... LD_PRELOAD=... /tmp/chromium --headless --no-sandbox --dump-dom about:blank
→ <html><head></head><body></body></html>
✓ يفتح ويعيد DOM
```

### 3) Playwright ينشئ Browser و Page
```
$ node (playwright + sparticuz)
chromium.launch({executablePath:'/tmp/chromium', args:['--no-sandbox','--disable-gpu'], headless:true})
→ browser launched
→ page.goto('data:text/html,<h1>Hello</h1>')
→ screenshot → /tmp/test_playwright.png (13038 bytes)
✓ Browser + Page + screenshot نجح
```

### 4) PNG و Sprite Sheet موجودة
```
$ node kit/render.mjs --project kit/examples/library-test --sheet --scale 0.25
→ Wrote 6 stills + contact sheet(s) to .../build/sheets
  s001_1.35.png 53K — يظهر شخصية test_archivist (stand/neutral) مع 5 layers
  s002_4.35.png 52K — نفس الشخصية (point/angry) مع نفس hash
  s003_6.90.png 36K — خريطة 1914 (2 دول)
  s004_8.90.png 37K — خريطة 1918 (3 دول)
  s005_10.45.png 38K — 1922 (تحالف)
  s006_11.45.png 37K — انتقال 1914→1918
  sheet_01.png 225K — Sprite Sheet 4×2 (validated PNG header 89504e47)

$ node kit/render.mjs --project kit/examples/library-test --stills 0,3 --scale 0.25
→ build/stills/0s_0.00.png 684b, 3s_3.00.png 52K + sheet_01.png 84K
✓ كل PNG صالح (PNG header 89504e470d0a1a0a، ffmpeg -i يمرر)
```

### 5) MP4 موجود ويعمل (ffprobe)
```
$ node kit/render.mjs --project kit/examples/library-test --from 0 --to 2 --scale 0.25 --workers 2
→ Rendering frames 0-48 (2.0s) with 2 worker(s) → 22.5 fps
→ Done: .../build/preview.mp4 (30K, 2.00s)

$ node kit/render.mjs --project kit/examples/library-test --scale 0.25 --workers 2
→ Rendering frames 0-288 (12.0s) → Done: .../build/video_silent.mp4 (79K, 12.00s)

$ ffmpeg -i build/video_silent.mp4
Input #0, mov,mp4: Duration: 00:00:12.00, 24 fps, Stream #0:0 Video: h264 (High) yuv420p 320x180 50 kb/s
→ ffmpeg -v error -i .../video_silent.mp4 -f null - → (no error) ✓

$ ffmpeg -v error -i .../preview.mp4 -f null - && echo valid
→ valid
```

## 3. علاج libnss3/libnspr4

- **بدون apt/CDN:** استُخدمت حزم npm المسموحة:
  - `@achingbrain/nss` توفر `libnss3.so`, `libnspr4.so`, `libnssutil3.so` في `kit/node_modules/@achingbrain/nss/linux/`
  - `tools/nss_shim.so` (15K) يتجاوز فحص `NSS_VersionCheck("3.26")` الذي يفشل مع NSS 3.22
  - `LD_LIBRARY_PATH` و `LD_PRELOAD` تُضبط تلقائياً في `render.mjs` عند عدم وجود cache
  - `tools/prepare-chromium.mjs` يفك `chromium.br` و `swiftshader.tar.br` إلى `/tmp`

- **لا تأثير على المشروع:** `render.mjs` فقط أُضيف له `getLaunchOpts()` + `ensureSparticuzReady()`، المكتبة والشخصيات لم تُمس.

## 4. ما بقي معطلاً

- **GPU SwiftShader:** تحذيرات `Failed to load GLES library` و `GPU process isn't usable` — غير حرجة، الرندر يعمل مع `--disable-gpu --single-process`
- **apt/playwright CDN:** لا يزال محظوراً في Arena، لكن الحل الحالي يتجاوزه عبر npm

## 5. الأوامر

```bash
cd skills/make-2d-video/kit
npm install
node tools/prepare-chromium.mjs  # يفك Chromium إلى /tmp
node tools/check-env.mjs          # فحص
node render.mjs --project examples/library-test --sheet --scale 0.25
node render.mjs --project examples/library-test --stills 0,3 --scale 0.25
node render.mjs --project examples/library-test --from 0 --to 2 --scale 0.25 --workers 2
node render.mjs --project examples/library-test --scale 0.25 --workers 2  # فيديو كامل 12s
# المخرجات:
# build/sheets/sheet_01.png (225K)
# build/stills/*.png
# build/video_silent.mp4 (79K, 12s, h264 yuv420p 320x180)
# التحقق:
# node_modules/@ffmpeg-installer/linux-x64/ffmpeg -i build/video_silent.mp4
```

## 6. المخرجات المسجلة

- `kit/examples/library-test/build/sheets/sheet_01.png` — 225K، 4×2 contact sheet
- `kit/examples/library-test/build/sheets/s001_1.35.png` — 53K، شخصية test_archivist
- `kit/examples/library-test/build/video_silent.mp4` — 79K، 12s، 24fps، 320×180
- `kit/examples/library-test/build/preview.mp4` — 30K، 2s
- `kit/tools/nss_shim.so` — 15K، shim
- `kit/node_modules/@ffmpeg-installer/linux-x64/ffmpeg` — 66M static
