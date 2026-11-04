#!/usr/bin/env python3
"""
library/tools/new_map.py — إنشاء هيكل خريطة جديدة
"""

import argparse, json, os, shutil, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REG = os.path.join(ROOT, "library/registry.json")

def canonical_json(obj):
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True, help="snake_case id")
    ap.add_argument("--name-ar", required=True)
    ap.add_argument("--name-en", required=True)
    ap.add_argument("--year", type=int, default=1900)
    ap.add_argument("--engine", default="procedural", choices=["procedural","layered-svg","hybrid"])
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    dest = os.path.join(ROOT, f"library/maps/{a.id}")
    if os.path.exists(dest) and not a.force:
        print(f"ERROR: {dest} exists — use --force")
        return 1
    os.makedirs(dest, exist_ok=True)

    # copy template files
    for f in ["meta.json", "base.geo.json", "timeline.json"]:
        src = os.path.join(ROOT, f"library/maps/_template/{f}")
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(dest, f))

    # patch meta.json
    meta_path = os.path.join(dest, "meta.json")
    if os.path.exists(meta_path):
        meta = json.load(open(meta_path, encoding='utf-8'))
        meta["id"] = a.id
        meta["name"] = {"ar": a.name_ar, "en": a.name_en}
        json.dump(meta, open(meta_path,'w',encoding='utf-8'), ensure_ascii=False, indent=2)

    # patch base year
    base_path = os.path.join(dest, "base.geo.json")
    if os.path.exists(base_path):
        base = json.load(open(base_path, encoding='utf-8'))
        base["year"] = a.year
        json.dump(base, open(base_path,'w',encoding='utf-8'), ensure_ascii=False, indent=2)

    # update registry
    reg = json.load(open(REG, encoding='utf-8'))
    if not any(m["id"]==a.id for m in reg.get("maps",[])):
        reg["maps"].append({
            "id": a.id,
            "base": f"/library/maps/{a.id}/base.geo.json",
            "timeline": f"/library/maps/{a.id}/timeline.json",
            "meta": f"/library/maps/{a.id}/meta.json",
            "engine": a.engine,
            "tags": ["custom"],
            "version": "1.0.0"
        })
        json.dump(reg, open(REG,'w',encoding='utf-8'), ensure_ascii=False, indent=2)
        print(f"created {dest} + registry entry")
    print(f"Next: edit {dest}/base.geo.json then run validate.py")
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
