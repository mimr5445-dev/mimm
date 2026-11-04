# إعداد بيئة ستديو راكان — دليل التشغيل (مُحدّث: Chromium يعمل)

## المتطلبات

| المكون | الإصدار المثبت | الحالة | المصدر |
|-------|----------------|--------|--------|
| Node.js | v22.22.3 | ✅ | Debian bookworm |
| Playwright | 1.56.0 | ✅ | registry.npmjs.org |
| Chromium | @sparticuz/chromium 92.0.0 (147M) | ✅ يعمل مع shim | registry.npmjs.org (brotli داخل tarball) |
| FFmpeg | N-47683-g0e8eb07980-static 66M | ✅ | @ffmpeg-installer/ffmpeg |
| libnss3/libnspr4 | 0.0.1 + shim | ✅ عبر npm | @achingbrain/nss + tools/nss_shim.so |

## لماذا 92.0.0 وليس 153؟

- chromium 153 يتطلب `NSS_3.30` + `NSS >=3.35` → يحتاج libnss3 حديث غير متوفر عبر npm
- chromium 92 يتطلب `NSS >=3.26` فقط → مع `@achingbrain/nss` (3.22) + shim يصبح متوافقاً
- كلاهما من `registry.npmjs.org` (مسموح)، لكن 92 هو الوحيد الذي يعمل مع المكتبات المتاحة في البيئة المقيدة

## التثبيت

```bash
cd skills/make-2d-video/kit
npm install                          # playwright + three + fonts
npm install @sparticuz/chromium@92.0.0 @ffmpeg-installer/ffmpeg @achingbrain/nss
gcc -shared -fPIC -o tools/nss_shim.so tools/nss_shim.c  # 15K shim

node tools/prepare-chromium.mjs       # يفك إلى /tmp/chromium + /tmp/swiftshader
node tools/check-env.mjs              # فحص
```

## اختبار سريع

```bash
LD_LIBRARY_PATH=$PWD/node_modules/@achingbrain/nss/linux:$LD_LIBRARY_PATH \
LD_PRELOAD=$PWD/tools/nss_shim.so /tmp/chromium --headless --no-sandbox --dump-dom about:blank
# → <html>...</html>

node render.mjs --project examples/library-test --sheet --scale 0.25
# → build/sheets/sheet_01.png (225K)

node render.mjs --project examples/library-test --scale 0.25 --workers 2
# → build/video_silent.mp4 (79K, 12s)

# التحقق
node_modules/@ffmpeg-installer/linux-x64/ffmpeg -i build/video_silent.mp4
node_modules/@ffmpeg-installer/linux-x64/ffmpeg -v error -i build/video_silent.mp4 -f null -
```

## على مضيف حقيقي (شبكة مفتوحة)

```bash
sudo apt-get update && sudo apt-get install -y libnss3 libnspr4
npx playwright install --with-deps chromium  # بديل يستخدم cache
# ثم نفس الأوامر أعلاه — ستعمل بدون shim
```

## المخرجات

- `build/sheets/sheet_01.png` — Sprite Sheet
- `build/stills/*.png` — لقطات
- `build/video_silent.mp4` — فيديو 12s 320×180 h264
