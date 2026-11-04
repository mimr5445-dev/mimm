#!/usr/bin/env python3
"""
library/tools/validate.py — التحقق الشامل من مكتبة الأصول

يتحقق من:
- وجود كل ملف مسجل في registry.json
- صحة engine (procedural/layered-svg/hybrid فقط)
- مطابقة identityHash للمحتوى الفعلي
- صحة JSON Schema الأساسية (حقول مطلوبة)
- عدم تكرار id

الاستخدام:
  python library/tools/validate.py
  python library/tools/validate.py --verbose
  python library/tools/validate.py --fix-hash  # يحدّث identityHash تلقائياً (للاختبار)
"""

import hashlib, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REG_PATH = os.path.join(ROOT, "library/registry.json")
ENGINES = {"procedural", "layered-svg", "hybrid"}

def canonical_json(obj):
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')

def hash_character(data):
    payload = {
        "identity": data.get("identity"),
        "rig": data.get("rig"),
        "wardrobe": {"base": data.get("wardrobe", {}).get("base")},
    }
    return hashlib.sha256(canonical_json(payload)).hexdigest()[:16]

def hash_map(data):
    return hashlib.sha256(canonical_json(data)).hexdigest()[:16]

def load_registry():
    if not os.path.exists(REG_PATH):
        print(f"MISSING registry.json at {REG_PATH}")
        sys.exit(1)
    return json.load(open(REG_PATH, encoding='utf-8'))

def check_character(entry, fix=False, verbose=False):
    errs = []
    cid = entry.get("id")
    path = entry.get("path", "").lstrip("/")
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        return [f"character '{cid}': manifest missing at {path}"]
    data = json.load(open(full, encoding='utf-8'))
    # required fields
    for f in ["id", "version", "engine", "identityHash", "identity", "rig", "wardrobe"]:
        if f not in data:
            errs.append(f"character '{cid}': missing field '{f}'")
    # engine
    if data.get("engine") not in ENGINES:
        errs.append(f"character '{cid}': invalid engine '{data.get('engine')}' — must be {ENGINES}")
    if entry.get("engine") not in ENGINES:
        errs.append(f"character '{cid}': registry engine invalid '{entry.get('engine')}'")
    if data.get("engine") != entry.get("engine"):
        errs.append(f"character '{cid}': engine mismatch registry={entry.get('engine')} manifest={data.get('engine')}")
    # id match
    if data.get("id") != cid:
        errs.append(f"character '{cid}': id mismatch manifest.id={data.get('id')}")
    # anchors (12)
    anchors = data.get("rig", {}).get("anchors", {})
    if len(anchors) < 12:
        errs.append(f"character '{cid}': rig.anchors must have 12 points, has {len(anchors)}")
    # identityHash
    computed = hash_character(data)
    stored = data.get("identityHash")
    if stored != computed:
        if fix:
            data["identityHash"] = computed
            json.dump(data, open(full, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
            print(f"  FIXED character '{cid}' identityHash: {stored} -> {computed}")
        else:
            errs.append(f"character '{cid}': identityHash mismatch stored={stored} computed={computed} (run --fix-hash)")
    if verbose and not errs:
        print(f"  OK character '{cid}' engine={data.get('engine')} hash={stored}")
    return errs

def check_map(entry, fix=False, verbose=False):
    errs = []
    mid = entry.get("id")
    base_path = entry.get("base", "").lstrip("/")
    tl_path = entry.get("timeline", "").lstrip("/")
    full_base = os.path.join(ROOT, base_path)
    if not os.path.exists(full_base):
        return [f"map '{mid}': base missing at {base_path}"]
    base_data = json.load(open(full_base, encoding='utf-8'))
    tl_data = []
    if tl_path and os.path.exists(os.path.join(ROOT, tl_path)):
        tl_data = json.load(open(os.path.join(ROOT, tl_path), encoding='utf-8'))
    # check has countries
    if not base_data.get("countries"):
        errs.append(f"map '{mid}': base.countries empty")
    if entry.get("engine") not in ENGINES:
        errs.append(f"map '{mid}': invalid engine '{entry.get('engine')}'")
    if verbose and not errs:
        print(f"  OK map '{mid}' countries={len(base_data.get('countries',[]))} diffs={len(tl_data)}")
    return errs

def check_location(entry, verbose=False):
    errs = []
    path = entry.get("path", "").lstrip("/")
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        errs.append(f"location '{entry.get('id')}': missing at {path}")
    elif verbose and not errs:
        print(f"  OK location '{entry.get('id')}'")
    return errs

def check_prop(entry, verbose=False):
    errs = []
    path = entry.get("path", "").lstrip("/")
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        errs.append(f"prop '{entry.get('id')}': missing at {path}")
    elif verbose and not errs:
        print(f"  OK prop '{entry.get('id')}'")
    return errs

def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--fix-hash", action="store_true", help="auto-fix identityHash")
    a = ap.parse_args()
    reg = load_registry()
    all_errs = []
    seen_ids = set()

    print(f"\nLibrary validate — registry v{reg.get('version','?')}\n")

    for kind in ["characters", "maps", "locations", "props"]:
        entries = reg.get(kind, [])
        if a.verbose:
            print(f"[{kind}] {len(entries)} entries")
        for e in entries:
            cid = e.get("id")
            if cid in seen_ids:
                all_errs.append(f"duplicate id '{cid}' across categories")
            seen_ids.add(cid)
            if kind == "characters":
                all_errs.extend(check_character(e, fix=a.fix_hash, verbose=a.verbose))
            elif kind == "maps":
                all_errs.extend(check_map(e, fix=a.fix_hash, verbose=a.verbose))
            elif kind == "locations":
                all_errs.extend(check_location(e, verbose=a.verbose))
            elif kind == "props":
                all_errs.extend(check_prop(e, verbose=a.verbose))

    # also verify no orphan folders without registry entry
    chars_dir = os.path.join(ROOT, "library/characters")
    if os.path.exists(chars_dir):
        for name in os.listdir(chars_dir):
            if name.startswith("_") or name.startswith("."): continue
            if name not in seen_ids and os.path.isdir(os.path.join(chars_dir, name)):
                print(f"  WARNING: orphan character folder '{name}' not in registry.json")

    if all_errs:
        print(f"\n{len(all_errs)} error(s):")
        for e in all_errs:
            print(f"  ✗ {e}")
        print()
        sys.exit(1)
    else:
        print(f"\n✓ All {len(seen_ids)} assets validated. Registry OK.\n")
        sys.exit(0)

if __name__ == "__main__":
    main()
