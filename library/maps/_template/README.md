# قالب خريطة

انسخ هذا المجلد لإنشاء خريطة جديدة:

```bash
cp -r library/maps/_template library/maps/my_region
```

ثم عدّل:
- `meta.json` — الاسم والمنطقة والإسقاط
- `base.geo.json` — الدول والمدن في سنة الأساس
- `timeline.json` — التغيرات عبر السنوات

احسب `identityHash`:
```bash
python library/tools/identity_hash.py --map library/maps/my_region/base.geo.json
```

حدّث `library/registry.json` وشغّل `python library/tools/validate.py`.
