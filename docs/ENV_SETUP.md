# إعداد بيئة ستديو راكان — دليل التشغيل

## المتطلبات

| المكون | الإصدار المثبت | الحالة | المصدر |
|-------|----------------|--------|--------|
| Node.js | v22.22.3 | ✅ جاهز | Debian bookworm |
| npm | 10.9.8 | ✅ جاهز | - |
| Playwright | 1.56.0 (core 1.56.0) | ✅ جاهز | `registry.npmjs.org` |
| Chromium | @sparticuz/chromium 153.0.0 (200 MB) | ⚠️ مثبت لكن يحتاج `libnss3 ≥3.30` | `registry.npmjs.org` (مضمّن .br، لا يحتاج CDN) |
| FFmpeg | N-47683-g0e8eb07980-static (66 MB) | ✅ جاهز | `registry.npmjs.org` → `@ffmpeg-installer/ffmpeg` (static، لا يحتاج apt) |
| Python | 3.11.2 | ✅ جاهز | - |
| libnss3 | 0.0.1 (قديم، يوفر NSS_3.9 فقط) | ⚠️ قديم — يحتاج تحديث | `registry.npmjs.org` → `@achingbrain/nss` |

---

## لماذا لا يمكن تثبيت Chromium/FFmpeg بالطريقة التقليدية؟

البيئة الحالية (Arena) تسمح بالخروج فقط إلى:
`github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`

- `cdn.playwright.dev` و `playwright.azureedge.net` و `deb.debian.org` و `snapshot.debian.org` **محظورة** → `npx playwright install` يفشل بـ `ECONNRESET` / `SSL_ERROR_SYSCALL`.
- `apt-get update/install` يفشل لنفس السبب → لا يمكن `apt-get install chromium ffmpeg libnss3`.
- لذلك تم اختيار حزم **مضمّنة** في `registry.npmjs.org` لا تحتاج CDN خارجي أثناء التثبيت:

```bash
# FFmpeg static مضمّن داخل tarball npm (لا تحميل خارجي أثناء install)
npm install @ffmpeg-installer/ffmpeg

# Chromium مضغوط brotli داخل tarball npm
npm install @sparticuz/chromium
# يفك إلى /tmp/chromium عند التشغيل عبر Chromium.executablePath()
```

---

## ما تم تثبيته في هذه الجلسة

```bash
cd skills/make-2d-video/kit
npm install                          # playwright 1.56.0 + three + fonts
npm install @ffmpeg-installer/ffmpeg # يوفر ffmpeg static 66M
npm install @sparticuz/chromium      # يوفر chromium.br 64M + swiftshader
npm install @achingbrain/nss         # يوفر libnss3.so قديم (لتجربة LD_LIBRARY_PATH)

# التحقق
node tools/check-env.mjs
# → ✔ Node v22.22.3
# → ✔ Playwright 1.56.0
# → ✔ Chromium @sparticuz (bin/chromium.br موجود)
# → ✔ FFmpeg .../node_modules/@ffmpeg-installer/linux-x64/ffmpeg
```

**الملفات المعدلة (محافظة على التوافق):**
- `render.mjs` — أُضيف `FFMPEG_BIN` (system → @ffmpeg-installer → playwright cache) + رسائل خطأ واضحة + تلميح `LD_LIBRARY_PATH`
- `tools/check-env.mjs` — جديد: فحص مسبق لكل الاعتماديات

**لم يُغيّر:** هوية المحرك، نظام الشخصيات/الخرائط، أصول المكتبة.

---

## اختبار FFmpeg — نجح فعلياً

```bash
# 1. إصدار
skills/make-2d-video/kit/node_modules/@ffmpeg-installer/linux-x64/ffmpeg -version
# → ffmpeg version N-47683-g0e8eb07980-static

# 2. توليد صورة
.../ffmpeg -hide_banner -f lavfi -i color=c=red:s=320x240:d=1 -frames:v 1 /tmp/test-red.png
# → 886 bytes PNG

# 3. توليد فيديو 1 ثانية + concat (نفس خط أنابيب render.mjs)
.../ffmpeg -hide_banner -f lavfi -i testsrc=s=320x240:r=24:d=1 -c:v libx264 -pix_fmt yuv420p -t 1 /tmp/test-video.mp4
# → 8.1K MP4 (24 frames)

.../ffmpeg -y -v error -f lavfi -i color=c=red:s=640x360:d=0.5:r=24 -f lavfi -i color=c=blue:s=640x360:d=0.5:r=24 -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0" -c:v libx264 -pix_fmt yuv420p /tmp/concat-test.mp4
# → 2.5K MP4 (concat ناجح)

# render.mjs يستخدم نفس المسار:
# spawn(FFMPEG_BIN, ['-f','image2pipe','-framerate',...,'-i','-','-c:v','libx264',...])
```

---

## اختبار Chromium — مثبت لكن يحتاج مكتبة نظام

### ما يعمل

```bash
node --input-type=module -e "import Chromium from '@sparticuz/chromium'; console.log(await Chromium.executablePath())"
# → /tmp/chromium (200 MB، يفك من bin/chromium.br)

ldd /tmp/chromium | grep not\ found
# → libnss3.so => not found, libnspr4.so => not found, libnssutil3.so => not found

LD_LIBRARY_PATH=/.../node_modules/@achingbrain/nss/linux:$LD_LIBRARY_PATH /tmp/chromium --version
# → /tmp/chromium: libnss3.so: version `NSS_3.30' not found (required by /tmp/chromium)
# السبب: @achingbrain/nss يوفر NSS 3.22 (2016) بينما chromium 119+ يتطلب NSS 3.30+ (2020)
```

### الحل على مضيف حقيقي (شبكة مفتوحة)

```bash
# 1. عبر apt (موصى به)
sudo apt-get update
sudo apt-get install -y chromium-browser ffmpeg libnss3 libnspr4 libatk1.0-0 libxcomposite1 libxdamage1 libgbm1 libpango-1.0-0

# 2. أو عبر playwright (إذا كان cdn متاح)
npx playwright install --with-deps chromium
# سيضع Chromium في ~/.cache/ms-playwright/chromium-1194/

# التحقق
node tools/check-env.mjs
# → ✔ Chromium — playwright cache: chromium-1194, chromium_headless_shell-1194
# → ✔ Chromium launch — version 119.0.6045.0

# التشغيل
node render.mjs --project examples/library-test --sheet --scale 0.25
node render.mjs --project examples/library-test --still 1,3
node render.mjs --project examples/library-test --to 5 --scale 0.5  # فيديو 5 ثوان
```

### الحل في بيئة Arena الحالية (بدون apt)

```bash
# استخدم المسارات المضمّنة — render.mjs يكتشفها تلقائياً:
FFMPEG_BIN=skills/make-2d-video/kit/node_modules/@ffmpeg-installer/linux-x64/ffmpeg
# Chromium يحتاج بناء NSS حديث من المصدر (اختياري):
git clone --depth 1 https://github.com/nss-dev/nss /tmp/nss-src
# ثم بناء بـ build.sh (يحتاج gyp/ninja) — غير موصى به في هذه البيئة الضيقة
```

---

## أوامر تشغيل الرندر

```bash
# فحص البيئة أولاً
node skills/make-2d-video/kit/tools/check-env.mjs

# لقطات ثابتة (تحتاج Chromium فقط)
node skills/make-2d-video/kit/render.mjs --project skills/make-2d-video/kit/examples/library-test --sheet --scale 0.25
# → build/sheets/sheet_01.png + stills

node skills/make-2d-video/kit/render.mjs --project skills/make-2d-video/kit/examples/library-test --stills 0,3,6 --scale 0.25

# فيديو (يحتاج Chromium + FFmpeg)
node skills/make-2d-video/kit/render.mjs --project skills/make-2d-video/kit/examples/library-test --scale 0.5
# → build/video_silent.mp4
# مع preview:
node skills/make-2d-video/kit/render.mjs --project skills/make-2d-video/kit/examples/library-test --from 0 --to 5 --scale 0.5 --out /tmp/preview.mp4
```

إذا ظهر `RENDER FAILED: Chromium غير مثبت` → راجع `tools/check-env.mjs` ثم `docs/ENV_SETUP.md`.

---

## ملخص الحالة

- **FFmpeg:** جاهز 100% عبر `@ffmpeg-installer/ffmpeg` (مختبر: توليد PNG + MP4 + concat)
- **Playwright:** جاهز 100% (1.56.0)
- **Chromium:** مثبت لكن **معطل جزئياً** بسبب `libnss3` القديم في هذه الحاوية — الحل يتطلب `apt` على مضيف حقيقي
- **render.mjs:** محدّث ليكتشف FFmpeg تلقائياً ويعطي رسائل واضحة بدلاً من stack trace مبهم
