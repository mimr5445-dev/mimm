#!/usr/bin/env python3
"""
library/tools/new_character.py — إنشاء هيكل شخصية جديدة

الاستخدام:
  python library/tools/new_character.py --id my_leader --name-ar "قائد جديد" --name-en "New Leader"

ينشئ:
  library/characters/<id>/manifest.json من القالب
  ويحدّث library/registry.json تلقائياً
"""

import argparse, json, os, shutil, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TPL = os.path.join(ROOT, "library/characters/_template/manifest.json")
REG = os.path.join(ROOT, "library/registry.json")

def canonical_payload(data):
    payload = {
        "identity": data.get("identity"),
        "rig": data.get("rig"),
        "wardrobe": {"base": data.get("wardrobe", {}).get("base")},
    }
    return json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True, help="snake_case id")
    ap.add_argument("--name-ar", required=True)
    ap.add_argument("--name-en", required=True)
    ap.add_argument("--role", default="leader", choices=["leader","general","advisor","soldier","civilian","narrator","other"])
    ap.add_argument("--engine", default="procedural", choices=["procedural","layered-svg","hybrid"])
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    if not a.id.replace("_","").isalnum() or not a.id.islower():
        print(f"ERROR: id must be snake_case a-z0-9_: {a.id}")
        return 1

    dest_dir = os.path.join(ROOT, f"library/characters/{a.id}")
    if os.path.exists(dest_dir) and not a.force:
        print(f"ERROR: {dest_dir} exists — use --force to overwrite")
        return 1
    os.makedirs(dest_dir, exist_ok=True)

    tpl = json.load(open(TPL, encoding='utf-8'))
    tpl["id"] = a.id
    tpl["identity"]["name"]["ar"] = a.name_ar
    tpl["identity"]["name"]["en"] = a.name_en
    tpl["identity"]["role"] = a.role
    tpl["engine"] = a.engine
    # compute hash
    h = hashlib.sha256(canonical_payload(tpl)).hexdigest()[:16]
    tpl["identityHash"] = h

    out = os.path.join(dest_dir, "manifest.json")
    json.dump(tpl, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f"created {out} (engine={a.engine} hash={h})")

    # update registry
    reg = json.load(open(REG, encoding='utf-8'))
    if not any(c["id"]==a.id for c in reg.get("characters",[])):
        reg["characters"].append({
            "id": a.id,
            "path": f"/library/characters/{a.id}/manifest.json",
            "engine": a.engine,
            "tags": [a.role],
            "version": "1.0.0"
        })
        json.dump(reg, open(REG,'w',encoding='utf-8'), ensure_ascii=False, indent=2)
        print(f"updated registry.json (+ {a.id})")
    else:
        print(f"registry already has {a.id} — not duplicated")

    print(f"\nNext: edit {out} then run: python library/tools/validate.py --fix-hash")
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
