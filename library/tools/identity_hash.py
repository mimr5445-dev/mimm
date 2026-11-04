#!/usr/bin/env python3
"""
library/tools/identity_hash.py — حساب identityHash للأصول

- للشخصية: hash(JSON.stringify({identity, rig, wardrobe.base})) مرتب ومُطبيع
- للخريطة: hash(base.geo.json canonical)

الاستخدام:
  python library/tools/identity_hash.py --manifest library/characters/test_historian_a/manifest.json
  python library/tools/identity_hash.py --map library/maps/test_region_a/base.geo.json
"""

import argparse, hashlib, json, os, sys

def canonical_json(obj):
    # Stable canonical JSON: sort keys, no whitespace, ensure_ascii False
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')

def hash_character_manifest(path):
    data = json.load(open(path, encoding='utf-8'))
    payload = {
        "identity": data.get("identity"),
        "rig": data.get("rig"),
        "wardrobe": {"base": data.get("wardrobe", {}).get("base")},
    }
    h = hashlib.sha256(canonical_json(payload)).hexdigest()[:16]
    print(h)
    return h

def hash_map_base(path):
    data = json.load(open(path, encoding='utf-8'))
    h = hashlib.sha256(canonical_json(data)).hexdigest()[:16]
    print(h)
    return h

def main():
    ap = argparse.ArgumentParser(description="حساب identityHash للأصول")
    ap.add_argument("--manifest", help="مسار manifest.json لشخصية")
    ap.add_argument("--map", help="مسار base.geo.json لخريطة")
    ap.add_argument("--check", action="store_true", help="تحقق أن الحقل الحالي يطابق المحسوب")
    a = ap.parse_args()
    if a.manifest:
        computed = hash_character_manifest(a.manifest)
        if a.check:
            data = json.load(open(a.manifest, encoding='utf-8'))
            stored = data.get("identityHash")
            if stored == computed:
                print(f"OK: identityHash matches ({computed})")
                sys.exit(0)
            else:
                print(f"MISMATCH: stored={stored} computed={computed}")
                sys.exit(1)
    elif a.map:
        computed = hash_map_base(a.map)
        if a.check:
            # For maps, we need to find parent manifest if exists
            # Here we just print computed; caller should compare manually
            pass
    else:
        ap.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
