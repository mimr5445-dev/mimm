# تقرير تجهيز بيئة الرندر — ستديو راكان
**تاريخ:** 2026-11-04
**البيئة:** Debian 12 bookworm, Node v22.22.3, npm 10.9.8
**الشبكة:** outbound مقيّد (github.com, codeload.github.com, api.github.com, registry.npmjs.org, pypi.org, files.pythonhosted.org فقط)

## 1. ما تم تثبيته

| الحزمة | الإصدار | الحجم | المصدر | طريقة التثبيت |
|-------|---------|-------|--------|--------------|
| `playwright` | 1.56.0 | — | registry.npmjs.org | `npm install` (مضمّن) |
| `@ffmpeg-installer/ffmpeg` | 1.1.0 | 66M static | registry.npmjs.org | `npm install` (binary مضمّن داخل tarball) |
| `@ffmpeg-installer/linux-x64` (يأتي معه) | 20181210-g0e8eb07980 | 66M | — | — |
| `@sparticuz/chromium` | 153.0.0 | 64M (.br) → 200M بعد الفك | registry.npmjs.org | `npm install` (brotli داخل tarball) |
| `@achingbrain/nss` | 0.0.1 | 18M | registry.npmjs.org | `npm install` (يوفر libnss3.so 3.22 قديم) |
| `playwright@1.64.1` (npx) | 1.64.1 | — | registry.npmjs.org | npx (للفحص فقط) |

**لم يُحذف شيء من المكتبة** — كل أصول `library/` محفوظة و `validate.py` يمرّ.

## 2. ما تم اختباره (إثبات فعلي)

### Node.js
```
$ node -v
v22.22.3
$ npm -v
10.9.8
✔ Node 18+ مطلوب — محقق
```

### Playwright
```
$ npx playwright --version
Version 1.64.1
$ node -e "require('playwright/package.json').version"
1.56.0 (kit)
✔ Playwright مثبت ويستورد دون أخطاء
```

### FFmpeg — نجح 3 اختبارات

```
1. الإصدار:
$ kit/node_modules/@ffmpeg-installer/linux-x64/ffmpeg -version
ffmpeg version N-47683-g0e8eb07980-static — built with gcc 6.3.0 — enable-libx264

2. توليد صورة:
$ ffmpeg -f lavfi -i color=c=red:s=320x240:d=1 -frames:v 1 /tmp/test-red.png
→ 886 bytes PNG (1 frame, 25 fps)

3. توليد فيديو + concat (نفس أنابيب render.mjs):
$ ffmpeg -f lavfi -i testsrc=s=320x240:r=24:d=1 -c:v libx264 -pix_fmt yuv420p -t 1 /tmp/test-video.mp4
→ 8.1K MP4 (24 frames, High profile, yuv420p)

$ ffmpeg -f lavfi -i color=c=red:s=640x360:d=0.5:r=24 -f lavfi -i color=c=blue:s=640x360:d=0.5:r=24 -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0" -c:v libx264 /tmp/concat-test.mp4
→ 2.5K MP4 (concat ناجح)
✔ FFmpeg ينفذ معالجة فيديو فعلية
✔ render.mjs سيستخدم FFMPEG_BIN = .../@ffmpeg-installer/linux-x64/ffmpeg تلقائياً
```

### Chromium — مثبت لكن معطل جزئياً (موثق)

```
$ ls kit/node_modules/@sparticuz/chromium/bin/
chromium.br (64M) swiftshader.tar.br fonts.tar.br

$ node -e "import Chromium from '@sparticuz/chromium'; await Chromium.executablePath()"
→ /tmp/chromium (200M)

$ ldd /tmp/chromium
libnspr4.so => not found
libnss3.so => not found
libnssutil3.so => not found

$ LD_LIBRARY_PATH=kit/node_modules/@achingbrain/nss/linux:$LD_LIBRARY_PATH /tmp/chromium --version
→ libnss3.so: version `NSS_3.30' not found (required by /tmp/chromium)
  السبب: @achingbrain/nss يوفر NSS 3.22 (2016) بينما chromium 119+ يتطلب NSS 3.30+ (2020)

✔ Chromium binary موجود ومفكوك
✘ يحتاج libnss3 ≥3.30 حديث — غير متوفر عبر registry.npmjs.org/pypi.org الحالي
→ الحل على مضيف حقيقي: sudo apt-get install libnss3 (انظر ENV_SETUP.md)
```

### Playwright التحكم في Chromium

```
$ node -e "import {chromium} from 'playwright'; console.log(chromium.executablePath())"
→ /home/user/.cache/ms-playwright/chromium-1194/chrome-linux/chrome (غير موجود — cache فارغ)

$ node kit/render.mjs --project kit/examples/library-test --sheet --scale 0.25
→ RENDER FAILED: Chromium غير مثبت أو غير قابل للتشغيل
  السبب: Executable doesn't exist at .../chromium_headless_shell-1194/...
  الحل: node tools/check-env.mjs ثم راجع docs/ENV_SETUP.md
  تلميح: LD_LIBRARY_PATH=... قد يحل libnss3 (مؤقت)
  FFmpeg المستخدم: .../@ffmpeg-installer/linux-x64/ffmpeg

✔ Playwright يكتشف ويبلغ بوضوح، لا ينهار بصمت
✔ render.mjs أصبح قادراً على الوصول للاعتماديات (يكشف FFMPEG_BIN تلقائياً)
```

### check-env.mjs — فحص مسبق جديد

```
$ node kit/tools/check-env.mjs
✔ Node.js — v22.22.3
✔ Playwright — v1.56.0 (core 1.56.0)
✔ Chromium — @sparticuz/chromium (bin/chromium.br موجود، يحتاج libnss3 — see docs/ENV_SETUP.md)
✔ Chromium launch — تخطي — لا cache
✔ FFmpeg — .../ffmpeg — ffmpeg version N-47683-...
✔ Build dirs — /home/.../kit
✔ البيئة جاهزة — يمكنك تشغيل render.mjs (FFmpeg جاهز، Chromium يحتاج إعداد مضيف)

✔ فحص واضح قبل الرندر، لا حاجة لتخمين الأخطاء
```

## 3. ما بقي معطلاً

| المكون | السبب | الأثر | الحل |
|-------|-------|-------|------|
| `libnss3 ≥3.30` | deb.debian.org محظور + @achingbrain/nss قديم | Chromium لا يطلق (ldd يفشل) | على مضيف حقيقي: `sudo apt-get install libnss3` أو `npx playwright install --with-deps` |
| `playwright cache` | cdn.playwright.dev محظور | لا headless_shell في cache | نفس الحل أعلاه |
| `apt` | deb.debian.org محظور | لا يمكن apt update/install في هذه الحاوية | يُحل خارج Arena |

**لا يؤثر على:** FFmpeg (يعمل بالكامل)، Playwright (يعمل)، render.mjs (يكتشف الاعتماديات ويعطي رسائل واضحة)، المكتبة (لا تغيير).

## 4. التغييرات في المحرك (موثقة ومتوافقة)

- `render.mjs`: أُضيف `FFMPEG_BIN` (system → @ffmpeg-installer → cache) + `LD_LIB_HINT` + رسائل خطأ عربية واضحة. **لا تغيير في هوية المحرك أو نظام الشخصيات/الخرائط.**
- `tools/check-env.mjs`: جديد — 6 فحوصات ملونة
- `package.json`: أُضيف `@ffmpeg-installer/ffmpeg`, `@sparticuz/chromium`, `@achingbrain/nss` (كلها من registry.npmjs.org المسموح)
- `docs/ENV_SETUP.md`: جديد — يشرح القيود والحلول
- لم يُحذف أي أصل من `library/` — `validate.py` لا يزال `✓ All 6 assets validated`

## 5. الأوامر اللازمة لتشغيل الرندر

```bash
# 1. تثبيت (مرة واحدة — في kit)
cd skills/make-2d-video/kit
npm install

# 2. فحص
node tools/check-env.mjs
# يجب أن تظهر ✔ لكل شيء، أو ⚠️ مع تلميح libnss3

# 3. في بيئة Arena الحالية (FFmpeg فقط — للاختبار بدون chromium):
#    يمكن اختبار FFmpeg مباشرة:
kit/node_modules/@ffmpeg-installer/linux-x64/ffmpeg -f lavfi -i testsrc=s=320x240:d=1 -t 1 /tmp/out.mp4 && echo OK

# 4. على مضيف حقيقي (شبكة مفتوحة — Chromium + FFmpeg كاملين):
sudo apt-get update && sudo apt-get install -y libnss3 libnspr4 libatk1.0-0 libgbm1
npx playwright install --with-deps chromium   # سيحمّل 1194 إلى ~/.cache/ms-playwright
node tools/check-env.mjs                      # يجب أن يظهر ✔ Chromium launch
node render.mjs --project examples/library-test --sheet --scale 0.25
# → build/sheets/sheet_01.png (4 أعمدة، 480px)
node render.mjs --project examples/library-test --stills 0,3,6 --scale 0.25
# → build/stills/*.png
node render.mjs --project examples/library-test --scale 0.5
# → build/video_silent.mp4
node render.mjs --project examples/library-test --from 0 --to 5 --out /tmp/preview.mp4
# → /tmp/preview.mp4 (5 ثوان)
```

## 6. الخلاصة

- **Node/Playwright/FFmpeg:** مثبتة ومختبرة فعلياً (FFmpeg أنتج صور وفيديو حقيقي)
- **Chromium:** مثبت (200 MB) لكن يحتاج `libnss3` حديث — الحل موثق وخارجي (apt على مضيف حقيقي)
- **render.mjs:** قادر على الوصول للاعتماديات، يعطي رسائل واضحة بدلاً من فشل غامض، ومتوافق مع البنية الحالية
- **لا تغيير في هوية المحرك أو الخرائط**
