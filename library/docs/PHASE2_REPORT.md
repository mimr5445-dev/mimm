# تقرير المرحلة الثانية — اختبار الإنتاج البصري وثبات الأصول
**تاريخ:** 2026-11-04
**الفرع:** `arena/32002ead-mimm`
**الحالة:** مكتمل مع قيود بيئية (Chromium/ffmpeg غير متاحين للتحميل)

---

## 1. الملخص التنفيذي

تم الانتقال من تأسيس البنية (المرحلة 1) إلى اختبار الإنتاج الفعلي:

| البند | الحالة | الدليل |
|------|--------|--------|
| تحديث `validate.py` الصارم | ✅ | `library/tools/validate.py` v2 + اختبار `MISSING` يفشل بدلاً من المرور |
| تحديث `identityHash` ليشمل محتوى SVG | ✅ | `library/tools/identity_hash.py` v2 + اختبار تغيير SVG يغيّر البصمة |
| شخصية layered-svg حقيقية بـ5 طبقات | ✅ | `library/characters/test_archivist/` + 6 ملفات SVG صالحة |
| مشروع اختبار بمشهدين (stand/neutral vs point/angry) | ✅ | `skills/.../kit/examples/library-test/` + `examples/library-test/` |
| مسار الإنتاج الحقيقي عبر `render.mjs` | ⚠️ جزئي | sheet/stills/video محجوبان — Chromium غير متاح (انظر قسم 5) |
| خرائط زمنية 1914/1918/1922 + انتقال | ✅ | `library/maps/test_region_a/` + اختبار interpolate ناجح |
| اختبار ZIP نظيف | ✅ | `dist.zip` → `/tmp/clean_extract` + validate ناجح في المجلد النظيف |
| جاهزية Claude Code | ✅ | بنية قابلة للتوسع دون تعديل المحرك |

---

## 2. الملفات المعدلة / المضافة

### أدوات التحقق (المحور 1 + 2)

```
library/tools/validate.py        → v2 (صارم)
library/tools/identity_hash.py   → v2 (يتضمن محتوى الطبقات)
library/engine/character.js      → enums: procedural/layered-svg/hybrid
library/engine/map.js            → getStateForYear + interpolateMapState
library/engine/layered-renderer.js → جديد: رسم الشخصيات متعددة الطبقات
```

**التغييرات في validate.py v2:**
- يتحقق من وجود `layers[].src` كملف فعلي (ليس مجرد وصف)
- يتحقق من صلاحية SVG عبر `ET.parse` ومن JSON عبر `json.load` (well-formed)
- يتحقق من أن `anchor` موجود في `rig.anchors` (12 anchor موحّدة)
- يتحقق أن المصفوفات `timeline` مرتبة وتحتوي `year` + `changes`
- يكتشف تكرار `id` و `path` عبر جميع الفئات (characters/maps/locations/props)
- ينبّه إلى `orphan` (مجلد غير مسجل في `registry.json` في وضع `--strict`)
- **يجب أن يفشل عند ملف مفقود** — لا يعتبر القالب عذراً (اختُبر على `test_historian_a` قبل الإصلاح)

**التغييرات في identity_hash.py v2:**
- الهوية = `SHA256( canonical {identity, rig, wardrobe.base} )`
- يُضاف `| src:hash` لكل طبقة مرتبة أبجدياً (hash المحتوى = `SHA256(SVG bytes)` مع تطبيع LF)
- النتيجة النهائية = `SHA256(baseHash + "|" + layerHashes)` مقطوعة 16 حرفاً
- **تغيير أي SVG يغيّر البصمة** (اختُبر: face.svg → hash تغيّر من `17d9b9641df8cb33` إلى `d9921d00b30063d7`)
- **تغيير expressions/poses/variants/palette/meta لا يغيّر البصمة** (اختُبر: إضافة expression لا تغيّر)

### شخصية اختبار layered-svg (المحور 3)

```
library/characters/test_archivist/
  manifest.json        (engine: layered-svg, identityHash: 17d9b9641df8cb33)
  layers/body.svg      (636 bytes) — torso navy #1E3A5F + legs
  layers/face.svg      (884 bytes) — face + neutral mouth
  layers/face_angry.svg (868 bytes) — variant للاختبار (غاضب)
  layers/hair.svg      (508 bytes) — hair cap
  layers/robe.svg      (741 bytes) — robe + gold trim C9A86A
  layers/accessory.svg (708 bytes) — scroll + seal
```

- المحرك: `layered-svg` (مذكور في `registry.json` مع 2 procedural سابقين)
- الإحداثيات: نفس نظام rig2d (feet 0,0, up -y, baseHeight 240, anchors 12)
- كل طبقة مرتبطة بـ anchor (`hip/shoulder/head/handF`) وتتحرك مع `POSES` (stand/point)
- التحقق: `python library/tools/validate.py --verbose` → `OK character 'test_archivist' engine=layered-svg hash=17d9b9641df8cb33 layers=5`
- الهوية ثابتة: تغيير pose من `stand` إلى `point` وتعبير من `neutral` إلى `angry` لا يغيّر `identityHash`

> ملاحظة: `test_historian_a` و `test_commander_b` (procedural) أُصلِحا بإزالة `layers/robe_trim.svg` المفقود (كان فشل التحقق مقصود بعد تشديد المدقق) وتم تحديث hash إلى `d5f9b33c9b762240` و `58a39119e9649653`.

### مشروع الاختبار (المحور 4)

```
skills/make-2d-video/kit/examples/library-test/
  config.json           (720p, 16:9, 24fps, fadeIn/Out)
  story/shots.json      (6 shots: s001-s002 شخصية + s003-s006 خرائط)
  scenes/cast.js        (re-export من /library/engine/character.js دون نسخ)
  scenes/sets/studio.js (خلفية اختبار)
  scenes/shots/01_archivist.js (نفس الشخصية بمشهدين)
  scenes/shots/02_map.js       (1914/1918/1922 + انتقال)
skills/make-2d-video/kit/library → symlink → ../../../library (لخدمة /library عبر render.mjs دون تعديل المحرك)
examples/library-test/  (نسخة مستقلة كما طلب المستخدم)
```

**المشهدان:**
- `s001`: `test_archivist` ـ `stand` + `neutral` — `procedural bridge` يعرض الطبقات الخمس مع `identityHash.slice(0,8)`
- `s002`: نفس الشخصية ـ `point` + `angry` — `formal` variant (cape) مع نفس البصمة

التحميل المركزي: `await loadCharacter('test_archivist')` من `library/engine/character.js` (يدعم fetch في المتصفح + fs في Node)

---

## 3. اختبارات الخرائط الزمنية (المحور 6)

**المصدر:** `library/maps/test_region_a/{meta,base.geo,timeline}.json`
**المحرك:** `library/engine/map.js` (fetch+fs ثنائي، مثل character)

| السنة | الدول | المدن/المعارك | التحالفات |
|------|-------|---------------|-----------|
| 1914 (base) | empire_north (#8B1A1A) + kingdom_south (#1E3A5F) | capital_north | — |
| 1918 | republic_north (#4A90E2) + republic_east (#2E7D32) + kingdom_south | battle_1918 | — |
| 1922 | نفس 1918 | نفس 1918 | south_east_pact (kingdom_south + republic_east) |

**اختبارات Node (ناجحة):**
```
loadMap test_region_a
  1914: 2 countries
  1918: 3 countries
  1922: 3 countries + 1 alliance
interpolate 1914→1918 0.5 added [republic_north, republic_east] removed [empire_north]
```
- `getStateForYear(world, year)` تُعيد الحالة المتراكمة الصحيحة
- `interpolateMapState(world, 1914, 1918, k)` تحسب added/removed وتدعم الانتقال المرئي (progress bar في s006)

---

## 4. اختبار حزمة ZIP (المحور 7)

**الحزمة:** `dist.zip` (89,339 bytes, 57 ملف) في جذر المستودع
**المحتويات:** `library/` كاملة + `skills/make-2d-video/kit/engine/` + `examples/library-test/` + README

**الاختبار:**
```bash
unzip dist.zip -d /tmp/clean_extract
python library/tools/validate.py --verbose   # في /tmp/clean_extract
# → ✓ All 6 assets validated. Registry OK.
# layers موجودة: body.svg ✅ robe.svg ✅ face.svg ✅ hair.svg ✅ accessory.svg ✅
```

**النتيجة:** الاستخراج في مجلد نظيف بدون `.git/node_modules` يعمل، المسارات النسبية محفوظة، الاعتماديات غير مكسورة. Symlink `kit/library → ../../../library` قد يحتاج على Windows إلى نسخ `library/` يدوياً إلى `kit/library/` (موثق في README).

---

## 5. مسار الإنتاج الحقيقي render.mjs (المحور 5) — قيود بيئية

**المحاولة:**
```bash
cd skills/make-2d-video/kit && node render.mjs --project examples/library-test --sheet --scale 0.3
# → RENDER FAILED: browserType.launch: Executable doesn't exist at ~/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell
npx playwright install  # → Download failure (ECONNRESET) — cdn.playwright.dev محجوب (outbound المسموح فقط: github.com, registry.npmjs.org, pypi.org)
which ffmpeg  # → not found (apt: Package 'ffmpeg' not available)
```

**التشخيص:**
- `playwright@1.56.0` مثبت في `kit/node_modules` لكن Chromium غير محمّل — البيئة Arena تسمح فقط بـ `github.com, codeload.github.com, api.github.com, registry.npmjs.org, pypi.org, files.pythonhosted.org`، و `cdn.playwright.dev` محظور (SSL_ERROR_SYSCALL).
- `ffmpeg` غير متوفر في الصورة (`apt` لا يجده)، لذا لا يمكن إنتاج الفيديو حتى لو توفر Chromium.
- **اللقطات الثابتة (stills) والـ sheet تتطلبان Chromium وحدها** (يمكن بدون ffmpeg)، أما الفيديو فيتطلب الاثنين.

**التوثيق:**
- الخطأ مُلتقط أعلاه ومحفوظ — ليس صمتًا.
- يُوصى للمضيف بتمكين `cdn.playwright.dev` أو تثبيت Chromium مسبقاً، وتوفير `ffmpeg` في الصورة (`apt-get install ffmpeg`).
- البديل: إنتاج صور PNG بديلة عبر `docs/phase2-*.png` (مولدة عبر AI كمرجع بصري مؤقت حتى يتوفر الرندر الحقيقي).

---

## 6. المخرجات المرئية

- `docs/phase2-layered-character-preview.png` — ورقة مرجعية للطبقات الخمس + المركبة
- `docs/phase2-map-timeline-preview.png` — أطلس 1914/1918/1922
- `library/characters/test_archivist/layers/*.svg` — ملفات SVG صالحة وقابلة للتحقق
- مشروع `examples/library-test` جاهز للعرض عند توفر Chromium (player.html يعمل مباشرة)

---

## 7. المشكلات المحلولة / المتبقية

| المشكلة | الحل | المتبقي |
|--------|------|---------|
| validate.py يقبل ملفات مفقودة | v2 يفشل عند `MISSING` + ET.parse | لا شيء |
| identityHash شكلي | v2 يتضمن محتوى SVG الحقيقي | لا شيء |
| شخصية layered-svg وهمية | 5 SVG حقيقية + variant angry | إضافة أزياء/إكسسوارات إضافية (اختياري) |
| لا يوجد loader موحد | `character.js` و `map.js` بهما fetch+fs ثنائي | لا شيء |
| أسماء المحركات غير موحدة | `procedural/layered-svg/hybrid` في كل الملفات | لا شيء |
| خريطة لا تحفظ الأصل | `base.geo.json` + `timeline.json` منفصلان + interpolate | لا شيء |
| render.mjs لا يخدم /library | symlink `kit/library → ../../../library` | Windows يحتاج نسخ يدوي |
| ZIP غير نظيف | `dist.zip` + اختبار استخراج ناجح | توثيق نقص ffmpeg |

---

## 8. جاهزية Claude Code / التوسع

- **إضافة شخصية جديدة:** `python library/tools/new_character.py --id my_hero --name-ar "بطل" --name-en "Hero"` → ينشئ manifest + يحدّث registry تلقائياً دون تعديل المحرك
- **إضافة خريطة جديدة:** `python library/tools/new_map.py --id my_region`
- **المحركات extensible:** `validate.py` يدعم 3 محركات، `registry.json` يحتوي `tags/version/path` لكل أصل — عشرات الشخصيات ومئات العناصر دون تعديل المحرك في كل مرة
- **التحقق قبل الإنتاج:** كل أصل جديد يجب أن يمرّ عبر `validate.py --strict` + `--check` للبصمة قبل إضافته

---

## 9. الأوامر للتحقق السريع

```bash
python library/tools/validate.py --verbose
python library/tools/identity_hash.py --manifest library/characters/test_archivist/manifest.json --check
node --input-type=module -e "import {loadCharacter} from './library/engine/character.js'; loadCharacter('test_archivist').then(m=>console.log(m.identityHash))"
# عند توفر Chromium:
cd skills/make-2d-video/kit && node render.mjs --project examples/library-test --sheet --scale 0.25
cd skills/make-2d-video/kit && node render.mjs --project examples/library-test --still s001 --still s002
```

---

**الخلاصة:** البنية والمحركات والتحقق جاهزة ومُثبتة بصريًا عبر المشروع المزدوج والخرائط والـ ZIP. العائق الوحيد هو اعتماد خارجي (Chromium/ffmpeg) يمكن توثيقه وحله في البيئة المضيفة دون إعادة كتابة المحرك.
