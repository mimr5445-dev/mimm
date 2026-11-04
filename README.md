# aiTrends 2D Studio

> **حوّل أي تعليق صوتي إلى فيديو كرتوني سينمائي — إطار بإطار، بالكود فقط.**
>
> Turn any voiceover into a fully animated, cinematic stick-figure video — frame by frame, code-rendered.

[![Version](https://img.shields.io/badge/version-0.1.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js)]()
[![Python](https://img.shields.io/badge/python-%3E%3D3.9-3776AB?logo=python)]()

---

## نظرة عامة | Overview

**aiTrends 2D Studio** هو استوديو فيديو برمجي يحول التعليق الصوتي (voiceover) إلى فيديو متحرك بأسلوب **stick-figures سينمائية**:

- شخصيات سوداء بحواف مضيئة (rim light) تتحرك في بيئات 2.5D غامرة
- لقطات وجه عملاقة، تجميد الزمن، أرقام متحركة، مخططات blueprint، ولقطات 3D منخفضة المضلعات
- **كل إطار مرسوم بالكود** (HTML Canvas + Three.js) ويُلتقط عبر Chromium Headless — لا استخدام لنماذج توليد الصور/الفيديو، لذا الثبات مضمون والنصوص حادة

Every frame is drawn by code and captured frame-by-frame in headless Chromium, then encoded with ffmpeg. No image/video generation models — characters stay consistent, text stays crisp.

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

## المدخلات | Inputs

- **Voiceover** بأي صيغة شائعة (MP3, WAV, M4A...)
- **Script** اختياري: مؤقت (SRT/VTT/JSON/TXT) أو نص عادي (يُزامن تلقائياً) أو بدون نص (يُفرّغ تلقائياً بـ Whisper)
- **الأبعاد:** `16:9` أو `9:16` · **الدقة:** `720p` / `1080p` / `1440p` / `2160p (4K)` · تعليقات محروقة اختيارية
- **الصوت:** موسيقى مولدة حسب المزاج، أو ملفك الخاص، أو بدون · مؤثرات: 36 مؤثر مدمج أو ملفاتك

---

## التثبيت | Installation

راجع [`skills/make-2d-video/references/install.md`](skills/make-2d-video/references/install.md) للتفاصيل الكاملة.

```bash
# 1. انسخ الاستوديو إلى مجلد العمل
cp -r skills/make-2d-video/kit aitrends-2d-studio
cd aitrends-2d-studio

# 2. تحقق من البيئة
python tools/doctor.py
python tools/verify_kit.py   # يجب أن يظهر 29/29

# 3. ثبّت الاعتمادات
npm install
npx playwright install chromium
pip install numpy scipy faster-whisper

# 4. اختبار سريع
node render.mjs --project examples/reaction-time --sheet --scale 0.3
```

**المتطلبات:** `ffmpeg` + `Node.js ≥ 18` + `Python ≥ 3.9` — حوالي 1GB مساحة قرص.

---

## الاستخدام السريع | Quick Start

```bash
# إنشاء مشروع جديد
python tools/new_project.py --name my-video --voice input/voiceover.mp3 --aspect 16:9 --resolution 1080p --title "My Video"

# تفريغ النص وتوليد اللقطات الأولية
python tools/transcribe.py --project projects/my-video --lang ar --model small
python tools/beats.py --project projects/my-video

# ثم اتبع المراحل في skills/make-2d-video/SKILL.md
# 1. كتابة story/bible.md و story/shots.json
# 2. اختيار النمط
# 3. بناء المشاهد
# 4. الرندر والدمج
node render.mjs --project projects/my-video --sheet --scale 0.5  # معاينة
node render.mjs --project projects/my-video                     # رندر نهائي
python audio/mix.py --project projects/my-video                  # مزج الصوت → out/<title>.mp4
```

---

## هيكل المستودع | Structure

```
.
├── .claude-plugin/plugin.json      # تعريف الإضافة
├── skills/
│   ├── make-2d-video/              # الأنبوب الكامل + المراجع + الاستوديو
│   │   ├── SKILL.md
│   │   ├── kit/                    # المحرك القابل للتنفيذ
│   │   │   ├── engine/             # core.js, rig2d.js, fx2d.js, ui2d.js, three-kit.js, styles.js
│   │   │   ├── audio/              # dsp.py, sfx.py, music.py, mix.py
│   │   │   ├── tools/              # transcribe.py, beats.py, doctor.py ...
│   │   │   ├── render.mjs          # محرك الرندر (Chromium → ffmpeg)
│   │   │   └── examples/reaction-time/ # مشروع مرجعي (47 ثانية)
│   │   └── references/             # style-bible.md, engine-api.md ...
│   ├── new-video/                  # مهارة الإعداد
│   ├── video-styles/               # مهارة الأنماط
│   ├── render-video/               # مهارة الرندر
│   └── video-sound/                # مهارة الصوت
├── README.md
├── LICENSE
└── .gitignore
```

كل فيديو يعيش في `aitrends-2d-studio/projects/<slug>/` و `story/shots.json` هو مصدر الحقيقة للتوقيت.

---

## أوقات الرندر | Render Times

| الدقة | السرعة (2-core cloud) | ملاحظة |
|------|----------------------|--------|
| 720p | ~2 إطار/ثانية (فيديو 47ث = ~11د) | |
| 1080p | ~2× أبطأ | موصى به |
| 4K | ~8× أبطأ | يُفضل تركه طوال الليل |
| حاسوب مكتبي حديث | 3–5× أسرع | |

---

## المراجع | References

- [`references/style-bible.md`](skills/make-2d-video/references/style-bible.md) — الدستور البصري (الشخصيات، الإضاءة، الكاميرا، المونتاج)
- [`references/engine-api.md`](skills/make-2d-video/references/engine-api.md) — واجهة المحرك
- [`references/story-breakdown.md`](skills/make-2d-video/references/story-breakdown.md) — كتابة القصة
- [`references/sound-design.md`](skills/make-2d-video/references/sound-design.md) — تصميم الصوت
- [`references/render-qc.md`](skills/make-2d-video/references/render-qc.md) — فحص الجودة
- [`references/install.md`](skills/make-2d-video/references/install.md) — التثبيت

---

## الترخيص | License

[MIT](LICENSE) — Copyright (c) 2026 aiTrends

لا حاجة لمفاتيح API أو اشتراكات.
