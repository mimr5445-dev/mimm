#!/usr/bin/env python3
"""
library/tools/identity_hash.py — حساب identityHash للأصول (v2)

للشخصية:
  hash = SHA256( canonical({identity, rig, wardrobe.base}) + "|" + layer_hashes )
  حيث layer_hashes = [ "src:hash(content)" لكل طبقة SVG/JSON مرتبة ]
  تغيير أي ملف SVG يغيّر البصمة. تغيير expressions/poses/variants/palette لا يغيّرها.

للخريطة:
  hash = SHA256(canonical(base.geo.json))

الاستخدام:
  python library/tools/identity_hash.py --manifest library/characters/test_historian_a/manifest.json
  python library/tools/identity_hash.py --manifest ... --check
  python library/tools/identity_hash.py --map library/maps/test_region_a/base.geo.json
"""

import argparse, hashlib, json, os, sys

def canonical_json(obj):
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')

def hash_character_manifest(path, check=False):
    data = json.load(open(path, encoding='utf-8'))
    manifest_dir = os.path.dirname(os.path.abspath(path))

    payload = {
        "identity": data.get("identity"),
        "rig": data.get("rig"),
        "wardrobe": {"base": data.get("wardrobe", {}).get("base")},
    }
    base_hash = hashlib.sha256(canonical_json(payload)).hexdigest()

    layers = data.get("wardrobe", {}).get("base", {}).get("layers", [])
    layer_hashes = []
    for lyr in sorted(layers, key=lambda x: x.get("src","")):
        src = lyr.get("src")
        if not src:
            continue
        full = os.path.join(manifest_dir, src)
        if os.path.exists(full):
            with open(full, 'rb') as f:
                content = f.read().replace(b"\r\n", b"\n").strip()
            h = hashlib.sha256(content).hexdigest()[:16]
            layer_hashes.append(f"{src}:{h}")
        else:
            layer_hashes.append(f"{src}:MISSING")

    combined = base_hash + "|" + "|".join(layer_hashes) if layer_hashes else base_hash
    h = hashlib.sha256(combined.encode('utf-8')).hexdigest()[:16]
    print(h)
    if check:
        stored = data.get("identityHash")
        if stored == h:
            print(f"OK: identityHash matches ({h})")
            sys.exit(0)
        else:
            print(f"MISMATCH: stored={stored} computed={h}")
            if layer_hashes:
                print(f"  layers considered: {layer_hashes}")
            sys.exit(1)
    return h

def hash_map_base(path):
    data = json.load(open(path, encoding='utf-8'))
    h = hashlib.sha256(canonical_json(data)).hexdigest()[:16]
    print(h)
    return h

def main():
    ap = argparse.ArgumentParser(description="حساب identityHash للأصول v2")
    ap.add_argument("--manifest", help="مسار manifest.json لشخصية")
    ap.add_argument("--map", help="مسار base.geo.json لخريطة")
    ap.add_argument("--check", action="store_true", help="تحقق أن الحقل الحالي يطابق المحسوب")
    a = ap.parse_args()
    if a.manifest:
        hash_character_manifest(a.manifest, check=a.check)
    elif a.map:
        hash_map_base(a.map)
    else:
        ap.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
