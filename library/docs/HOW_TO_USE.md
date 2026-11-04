# كيف يستخدم كلود المكتبة — دليل الاستخدام

> هذا الملف هو **المرجع الوحيد** لكلود عند إنتاج فيديو. لا يحتاج لقراءة المشروع كاملاً.

## 1) اكتشاف الأصول

```bash
cat library/registry.json
```

يحتوي على 4 قوائم: `characters`, `maps`, `locations`, `props`. كل عنصر له `id`, `path`, `engine`, `tags`, `version`.

- للبحث بالاسم: `grep -i stalin library/registry.json`
- للبحث بالوسم: ابحث عن `tags` التي تحتوي كلمة مفتاحية

## 2) استدعاء شخصية

```js
// داخل scenes/shots/XX_*.js
import { loadCharacter, getOutfit } from '/library/engine/character.js';
import { drawFigure } from '/engine/rig2d.js';

// في أعلى الملف (خارج draw):
let HISTORIAN; // سيُحمّل مرة واحدة
loadCharacter('test_historian_a').then(m => HISTORIAN = m);

// داخل draw(g, t, info):
registerShot('s001', {
  draw(g, t, info) {
    if (!HISTORIAN) return; // انتظر التحميل
    const outfit = getOutfit(HISTORIAN); // أو getOutfit(HISTORIAN, 'military') لنسخة بديلة
    drawFigure(g, { x: E.W/2, y: E.H*0.75, s: 1.2, outfit, pose: POSES.stand, expr: 'thinking', rim: {color: M.rim, dir:[0,-1]}});
  }
});
```

- `engine` يجب أن يكون واحداً من `procedural|layered-svg|hybrid` — المحمّل يتحقق تلقائياً.
- لا تغيّر `manifest.json` داخل المشروع — استورد فقط.

## 3) اختيار التعبير والوضعية

كل `manifest.json` يحتوي:

```json
"expressions": ["neutral","determined","angry",...],
"poses": ["stand","talk","point",...]
```

- `expr` → قيمة من `expressions` (تُمرر لـ `drawFigure({expr})`)
- `pose` → قيمة من `poses` أو كائن مخصص `{head:[x,y], ...}` (يُمرر لـ `POSES[pose]`)

## 4) استدعاء خريطة

```js
import { loadMap, getStateForYear, drawMap } from '/library/engine/map.js';

let WORLD;
loadMap('test_region_a').then(m => WORLD = m);

registerShot('s010', {
  draw(g, t, info) {
    if (!WORLD) return;
    const state = getStateForYear(WORLD, 1918); // إعادة بناء سنة 1918
    drawMap(g, state, {x: 100, y: 80, w: 900, h: 500, highlight: ['republic_north']});

    // انتقال مرئي بين سنتين:
    // const mid = interpolateMapState(WORLD, 1914, 1918, t/info.dur);
    // drawMap(g, mid, {...});
  }
});
```

- `getStateForYear(map, year)` يطبّق كل `timeline` حتى السنة المطلوبة — البيانات الأصلية لا تُفقد.
- `interpolateMapState(map, 1914, 1918, k)` يعطي حالة وسيطة للتحريك.

## 5) خلفيات ومواقع

```js
import { palace } from '/library/locations/test_palace/palace.js';
palace(g, t, cam, {mood: 'interiorWarm'}); // ترسم الخلفية وتُرجع {GY, M}
```

## 6) إنشاء أصل جديد (إذا لم تجده)

```bash
# شخصية
python library/tools/new_character.py --id my_leader --name-ar "قائد جديد" --name-en "New Leader" --engine layered-svg

# خريطة
python library/tools/new_map.py --id my_region --name-ar "منطقة جديدة" --name-en "New Region" --year 1900
```

ثم عدّل `manifest.json`/`base.geo.json` وشغّل:

```bash
python library/tools/validate.py --fix-hash
python library/tools/validate.py --verbose
```

## 7) قواعد الثبات

- لا تغيّر `id` أبداً.
- عند تغيير `wardrobe.base` أو `rig` → احسب `identityHash` جديداً وارفع `version`.
- لا تحفظ أصولاً في `projects/<slug>/` — فقط في `library/`.

## 8) التحقق قبل التسليم

```bash
python library/tools/validate.py
```

يجب أن يطبع `✓ All N assets validated`.
