# aiTrends 2D Studio — استوديو كرتوني تاريخي/سياسي

> **حوّل أي تعليق صوتي إلى فيديو كرتوني سينمائي — إطار بإطار، بالكود فقط.**
>
> Turn any voiceover into a fully animated, cinematic cartoon video — frame by frame, code-rendered.

[![Version](https://img.shields.io/badge/version-1.1.0-blue)]()
[![Library](https://img.shields.io/badge/library-v1.0.0-green)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js)]()
[![Python](https://img.shields.io/badge/python-%3E%3D3.9-3776AB?logo=python)]()

---

## نظرة عامة | Overview

**aiTrends 2D Studio** استوديو إنتاج كرتوني متخصص في **المحتوى التاريخي والسياسي** — الدول، الحكام، الحروب، التحالفات، والخرائط المتحركة.

- **محرك رندر:** كل إطار مرسوم بالكود (HTML Canvas + Three.js) ويُلتقط عبر Chromium Headless — لا توليد صور بالذكاء الاصطناعي، لذا الثبات مضمون
- **مكتبة أصول مركزية:** `library/` — شخصيات/خرائط/مواقع/عناصر ثابتة الهوية، قابلة لإعادة الاستخدام بين كل الفيديوهات
- **محركات موحدة:** `procedural` / `layered-svg` / `hybrid` فقط في كل مكان
- **خرائط زمنية:** إعادة بناء أي سنة من `base + timeline` مع انتقال مرئي

Every frame is drawn by code. No image generation — characters stay consistent.

---

## المهارات | Skills

| الأمر | الوظيفة |
|------|---------|
| `Make a 2D video` | تشغيل الأنبوب الكامل (8 مراحل) |
| `/new-video` | الإعداد + التفريغ الزمني (Whisper) + تقسيم اللقطات |
| `/video-styles` | معاينة 5 أنماط بصرية واختيار واحد |
| `/render-video` | بناء المشاهد + فحص الجودة + الرندر النهائي |
| `/video-sound` | موسيقى، مؤثرات، ومزج صوتي |

**الأنماط الخمسة:** `Cinematic Dusk` · `Midnight Blue` · `Golden Hour` · `Neon Noir` · `Soft Storybook`

---

## 📚 المكتبة المركزية | Library

```
library/
├── registry.json                 # فهرس كل الأصول (المصدر الوحيد للحقيقة)
├── schemas/                      # JSON Schema للشخصيات والخرائط
├── characters/
│   ├── _shared/rigging.md        # نظام الإحداثيات (12 نقطة ارتكاز)
│   ├── _template/manifest.json   # قالب شخصية
│   └── <id>/manifest.json        # شخصية واحدة = مجلد واحد
├── maps/
│   ├── _shared/style.json        # ألوان وحدود موحدة
│   └── <id>/{base.geo.json, timeline.json, meta.json}
├── locations/                    # خلفيات (دوال JS قابلة لإعادة الاستخدام)
├── props/                        # عناصر (أعلام/تيجان/أسلحة)
├── engine/                       # محركات التحميل الموحدة
│   ├── character.js              # loadCharacter(id) → outfit
│   ├── map.js                    # loadMap(id) + getStateForYear(year)
│   └── validate.js               # تحقق مشترك
├── docs/                         # أدلة كلود (HOW_TO_USE, CATALOG, ARCHITECTURE)
└── tools/                        # validate.py, new_character.py, identity_hash.py
```

**اكتشاف الأصول:** كلود يقرأ `library/registry.json` ثم يستدعي:

```js
import { loadCharacter, getOutfit } from '/library/engine/character.js';
const char = await loadCharacter('test_historian_a');
drawFigure(g, {x, y, s, outfit: getOutfit(char), pose: POSES.stand, expr: 'thinking'});

import { loadMap, getStateForYear, drawMap } from '/library/engine/map.js';
const map = await loadMap('test_region_a');
drawMap(g, getStateForYear(map, 1918), {x, y, w, h});
```

راجع `library/README.md` و `library/docs/HOW_TO_USE.md`.

---

## المدخلات | Inputs

- **Voiceover** بأي صيغة شائعة (MP3, WAV, M4A...)
- **Script** اختياري: مؤقت (SRT/VTT/JSON/TXT) أو نص عادي أو بدون نص (Whisper)
- **الأبعاد:** `16:9` أو `9:16` · **الدقة:** `720p` / `1080p` / `1440p` / `2160p` · تعليقات محروقة
- **الصوت:** موسيقى مولدة/ملفك/بدون · 36 مؤثر مدمج

---

## التثبيت | Installation

راجع [`skills/make-2d-video/references/install.md`](skills/make-2d-video/references/install.md).

```bash
cp -r skills/make-2d-video/kit aitrends-2d-studio
cd aitrends-2d-studio
python tools/doctor.py
python tools/verify_kit.py   # 29/29
npm install
npx playwright install chromium
pip install numpy scipy faster-whisper

# تحقق من المكتبة
python library/tools/validate.py --verbose  # ✓ All assets validated

# اختبار سريع
node render.mjs --project examples/reaction-time --sheet --scale 0.3
```

**المتطلبات الخارجية (لا تُضمّن في ZIP):** `ffmpeg` + `Node.js ≥18` + `Python ≥3.9` + `Chromium` + `Whisper model (~500MB أول مرة)`

---

## الاستخدام السريع | Quick Start

```bash
python tools/new_project.py --name my-video --voice input/voiceover.mp3 --aspect 16:9 --resolution 1080p --title "My Video"
python tools/transcribe.py --project projects/my-video --lang ar --model small
python tools/beats.py --project projects/my-video
# ثم: bible.md + shots.json + اختيار النمط + بناء المشاهد + رندر
node render.mjs --project projects/my-video --sheet --scale 0.5
node render.mjs --project projects/my-video
python audio/mix.py --project projects/my-video
```

---

## هيكل المستودع | Structure

```
.
├── library/                      # ← الجديد: أصول مركزية
├── skills/
│   ├── make-2d-video/ (kit + references)
│   ├── new-video/ video-styles/ render-video/ video-sound/
├── .claude-plugin/plugin.json
├── README.md  LICENSE  .gitignore
```

---

## المراجع | References

- `library/docs/ARCHITECTURE.md` — تصميم المحركات الموحدة
- `library/docs/HOW_TO_USE.md` — دليل كلود (8 خطوات)
- `library/docs/CATALOG.md` — كتالوج الأصول
- `library/characters/_shared/rigging.md` — نظام الإحداثيات
- `skills/make-2d-video/references/style-bible.md` — الدستور البصري

---

## الترخيص | License

[MIT](LICENSE) — Copyright (c) 2026 aiTrends
