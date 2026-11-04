# مكتبة الأصول — Library

> **المكتبة المركزية للاستوديو** | Central Asset Library
>
> كل أصل هنا **مستقل عن أي فيديو**. أي فيديو في `projects/<slug>/` يستورد منها ولا ينسخها.

هذه المجلد هو المصدر الوحيد للحقيقة للشخصيات والخرائط والمواقع والعناصر. صُمم ليكون قابلاً للتوسع إلى **عشرات الشخصيات ومئات الخرائط والمواقع دون تعديل المحرك**.

## المبادئ

1. **الثبات:** `id` ثابت، `identityHash` يضمن عدم تغير التصميم دون قصد.
2. **الفصل:** `library/` ≠ `projects/` — لا تخلط أصول المكتبة بملفات مشروع واحد.
3. **محركات موحدة:** `procedural` / `layered-svg` / `hybrid` فقط.
4. **تحميل موحد:** كل الأصول تُحمّل عبر `library/engine/*.js` (fetch + fs).
5. **تحقق إجباري:** `tools/validate.py` يجب أن ينجح قبل أي commit.

## الهيكل

```
library/
├── registry.json                 # فهرس كل الأصول (id → path → type → tags)
├── schemas/                      # JSON Schema لكل نوع أصل
├── characters/
│   ├── _shared/rigging.md        # نظام الإحداثيات والمفاصل
│   ├── _shared/palettes.json     # ألوان مشتركة
│   ├── _template/manifest.json   # قالب شخصية
│   └── <id>/manifest.json        # شخصية واحدة = مجلد واحد
├── maps/
│   ├── _shared/style.json        # ألوان وحدود موحدة
│   ├── _template/                # قالب خريطة
│   └── <id>/ {base.geo.json, timeline.json, meta.json}
├── locations/                    # خلفيات قابلة لإعادة الاستخدام (دوال JS)
├── props/                        # عناصر صغيرة (أعلام/تيجان/أسلحة)
├── engine/                       # محركات التحميل والرسم الموحدة
│   ├── character.js              # loadCharacter(id) → outfit/layers + render
│   ├── map.js                    # loadMap(id) + getStateForYear(year)
│   └── validate.js               # منطق التحقق المشترك (JS)
└── docs/                         # أدلة كلود
```

## محركات الرسم (موحدة في كل الملفات)

| المحرك | الاستخدام | متى |
|---|---|---|
| `procedural` | رسم برمجي Canvas (مثل `rig2d.js`) | شخصيات بسيطة، اختبار سريع |
| `layered-svg` | طبقات SVG مركبة على مفاصل | شخصيات تاريخية غنية (الافتراضي للاستوديو) |
| `hybrid` | طبقات + توليد أولي بالذكاء الاصطناعي (ثم تثبيت) | أصول مصممة خارجياً ثم مجمدة |

> لا تستخدم أسماء أخرى. هذه الثلاثة فقط في كل `manifest.json`.

## للمطور (أنت) vs لكلود

- **أنت:** تضيف مجلدات وتحديث `registry.json` وتشغيل `validate.py`.
- **كلود:** يقرأ `registry.json` ثم يستدعي `loadCharacter()` / `loadMap()` داخل `registerShot`.

راجع `docs/HOW_TO_USE.md` للتفاصيل.
