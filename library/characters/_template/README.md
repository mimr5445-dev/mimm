# كيف تنشئ شخصية جديدة

1. انسخ هذا المجلد: `cp -r library/characters/_template library/characters/my_new_char`
2. عدّل `manifest.json`:
   - غيّر `id` إلى snake_case إنجليزي (مثال: `my_new_char`)
   - غيّر `identity.name` (عربي + إنجليزي)
   - اختر `engine`: `procedural` أو `layered-svg` أو `hybrid`
   - عدّل `wardrobe.base` (الألوان والملابس — هذا يدخل في identityHash)
   - حدد `expressions` و `poses`
3. احسب `identityHash` عبر:
   ```bash
   python library/tools/identity_hash.py --manifest library/characters/my_new_char/manifest.json
   ```
   انسخ الناتج إلى حقل `identityHash`.
4. حدّث `library/registry.json` وأضف مدخلاً جديداً.
5. شغّل التحقق:
   ```bash
   python library/tools/validate.py
   ```

> **لا تضع صور PNG/JPG كأصل أساسي** — استخدم `engine: layered-svg` مع طبقات SVG أو `procedural`.
