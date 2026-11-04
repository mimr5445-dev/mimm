# تصميم استوديو mimm — Architecture v2 (بعد التصحيحات)

## 1) المحركات الموحدة

في **كل الملفات** (`manifest.json`, `registry.json`, `*.js`, `schemas`) نستخدم نفس الثلاثة:

- `procedural` — رسم Canvas مباشر (rig2d الحالي)
- `layered-svg` — طبقات SVG على مفاصل
- `hybrid` — طبقات + تأسيس AI مجمد

لا يُسمح بأي اسم آخر. `validate.py` يفشل فوراً عند مخالفة.

## 2) التحميل الموحد (تصحيح استيراد manifest)

**المشكلة السابقة:** `import stalin from './stalin/profile.json' assert` لا يعمل في كل البيئات ويفترض مساراً ثابتاً.

**الحل الجديد:** طبقة تحميل واحدة `library/engine/character.js`:

```js
// يعمل في المتصفح (fetch) وفي Node (fs)
const char = await loadCharacter('test_historian_a'); // يقرأ registry.json → manifest
const outfit = getOutfit(char); // يحول wardrobe.base → rig2d outfit
```

- لا استيراد مباشر لـ JSON.
- يتحقق من تطابق `engine` بين `registry.json` و `manifest.json`.
- Cache داخلي لتجنب تحميل متكرر.

نفس النمط للخرائط: `loadMap(id)` → `getStateForYear(map, year)`.

## 3) identityHash كنظام إصدارات

- **الحساب:** `SHA256(canonical({identity, rig, wardrobe.base}))` — مرتب، بدون مسافات، 16 حرف hex.
- **الاستخدام:** 
  - عند تغيير أي حقل في الهوية → الهاش يتغير → يجب رفع `version` (مثلاً `1.0.0` → `1.1.0`).
  - `validate.py --check` يرفض أي `manifest` هاشه لا يطابق محتواه.
  - `registry.json` يحفظ `version` أيضاً — يمكن لكلود مقارنة إصدار المشروع مع المكتبة.

مثال سجل تغيير:
```
v1.0.0 hash=c354... (إنشاء)
v1.1.0 hash=9a11... (تغيير لون الرداء)
```

## 4) نظام الإحداثيات والمفاصل

موثق في `library/characters/_shared/rigging.md`:

- الأصل `(0,0)` عند القدمين، `up = -y`، `baseHeight=240`.
- 12 نقطة ارتكاز ثابتة: `head, neck, shoulder, hip, elbowF/handF, elbowB/handB, kneeF/footF, kneeB/footB`.
- كل طبقة (`layers: [{id, anchor, src, z}]`) ترتبط بنقطة واحدة.
- الوضعيات `poses` تحدد إحداثيات النقاط الـ12 فقط — الطبقات تتبعها تلقائياً مع `ease.inOut`.
- هذا يضمن: تغيير وضعية لا يغير شكل الوجه/الملابس.

## 5) نظام الخرائط الزمني

- **البيانات الأصلية محفوظة:** `base.geo.json` (سنة الأساس) لا تُعدّل أبداً.
- **التغييرات كـ diffs:** `timeline.json = [{year, changes:[{op, id, data}]}]`
  - `op`: `add_country`, `remove_country`, `update_country`, `add_city`, `move_city`, `add_arrow`, `add_alliance`...
- **إعادة البناء:** `getStateForYear(map, 1945)` يبدأ من `base` ويطبق كل diff حتى السنة المطلوبة (مرتب زمنياً).
- **الانتقال المرئي:** `interpolateMapState(map, 1914, 1918, k)` يعطي حالة وسيطة للتحريك (fade + تحديد added/removed).

## قابلية التوسع

- إضافة شخصية جديدة = مجلد جديد + سطر في `registry.json` — لا تعديل للمحرك.
- إضافة خريطة جديدة = `base.geo.json + timeline.json + meta.json` + سطر.
- المحرك لا يعرف عدد الأصول مسبقاً — يقرأ `registry.json` ديناميكياً.
