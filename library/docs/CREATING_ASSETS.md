# إنشاء أصول جديدة — قواعد موحدة

## الشخصيات

1. **التسمية:** `id` = snake_case إنجليزي (`test_historian_a`)، لا عربي في `id`.
2. **المحرك:** اختر واحداً من `procedural|layered-svg|hybrid` — لا تخلط.
3. **الهوية:** `identity` + `rig` + `wardrobe.base` هي الهوية. أي تغيير فيها = `identityHash` جديد + `version` +1.
4. **التعبيرات:** لا تضف تعبيراً لا يستطيع `rig2d.js` رسمه (neutral, determined, angry... راجع `EXPR`).
5. **الطبقات:** `wardrobe.base.layers` اختيارية — كل طبقة لها `anchor` من الـ12 نقطة.

## الخرائط

1. **الأساس:** `base.geo.json` يحمل `year` الأساس وكل الدول/المدن في تلك السنة.
2. **التايملاين:** `timeline.json` يحمل `changes` فقط (add/remove/update). لا تكرر كل الدول في كل سنة.
3. **الإحداثيات:** `path: [[x,y],...]` بوحدات منطقية (800×500 افتراضياً). استخدم `bounds` في `meta.json`.
4. **الألوان:** استخدم `library/maps/_shared/style.json` أو `library/characters/_shared/palettes.json`.

## المواقع والعناصر

- كل موقع هو دالة JS واحدة: `export function myPlace(g,t,cam,opts)` في `library/locations/<id>/`.
- كل عنصر هو دالة: `export function myProp(g,x,y,opts)` في `library/props/<id>/`.

## identityHash — كيف يحسب

```bash
python library/tools/identity_hash.py --manifest library/characters/<id>/manifest.json
python library/tools/identity_hash.py --manifest library/characters/<id>/manifest.json --check
```

- هو `SHA256(JSON.stringify({identity, rig, wardrobe.base}))` مرتب المفاتيح، مقتطع 16 حرف.
- **ليس شكلياً:** إذا غيّرت لون الرداء دون تحديث الهاش، `validate.py` سيفشل. هذا يمنع تغير هوية ستالين بالخطأ.

## التسجيل

كل أصل جديد يجب تسجيله في `library/registry.json` (يقوم `new_character.py` بذلك تلقائياً).
