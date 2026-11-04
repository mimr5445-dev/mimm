#!/usr/bin/env python3
"""
library/tools/validate.py — التحقق الشامل من مكتبة الأصول (v2 — صارم)

يتحقق من:
- وجود كل ملف مسجل في registry.json
- صحة engine (procedural/layered-svg/hybrid فقط)
- مطابقة identityHash للمحتوى الفعلي (يشمل ملفات SVG المرجعية)
- وجود كل ملف مُشار إليه في manifest (layers.src, etc)
- صحة بنية JSON و SVG (well-formed)
- توافق registry ↔ manifest (engine, id, version)
- عدم تكرار id أو مسارات

الاستخدام:
  python library/tools/validate.py
  python library/tools/validate.py --verbose
  python library/tools/validate.py --fix-hash
  python library/tools/validate.py --strict   # يفحص حتى القوالب (افتراضياً يستثني _template)
"""

import hashlib, json, os, sys, xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REG_PATH = os.path.join(ROOT, "library/registry.json")
ENGINES = {"procedural", "layered-svg", "hybrid"}

def canonical_json(obj):
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')

def file_hash(path):
    """SHA256 مقتطع 16 لحرف لمحتوى ملف"""
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]

def hash_character(data, manifest_dir):
    """
    identityHash الجديد: يشمل
    - identity (الاسم/الدور/العصر/tags/bio)
    - rig (نظام المفاصل كامل)
    - wardrobe.base (الملابس الأساسية)
    - محتوى كل ملف SVG/JSON مرجعي في wardrobe.base.layers[].src
    لا يشمل: expressions, poses, variants, palette, meta (تغييرها لا يغير الهوية)
    """
    # Base payload
    payload = {
        "identity": data.get("identity"),
        "rig": data.get("rig"),
        "wardrobe": {"base": data.get("wardrobe", {}).get("base")},
    }
    base_hash = hashlib.sha256(canonical_json(payload)).hexdigest()

    # Add layer file hashes (sorted by src for determinism)
    layers = data.get("wardrobe", {}).get("base", {}).get("layers", [])
    layer_hashes = []
    for lyr in sorted(layers, key=lambda x: x.get("src","")):
        src = lyr.get("src")
        if not src:
            continue
        full = os.path.join(manifest_dir, src)
        if os.path.exists(full):
            # Hash file content normalized (strip, LF)
            with open(full, 'rb') as f:
                content = f.read().replace(b"\r\n", b"\n").strip()
            h = hashlib.sha256(content).hexdigest()[:16]
            layer_hashes.append(f"{src}:{h}")
        else:
            # Missing file -> include marker so hash differs from present
            layer_hashes.append(f"{src}:MISSING")

    # Combine
    combined = base_hash + "|" + "|".join(layer_hashes) if layer_hashes else base_hash
    return hashlib.sha256(combined.encode('utf-8')).hexdigest()[:16]

def load_registry():
    if not os.path.exists(REG_PATH):
        print(f"MISSING registry.json at {REG_PATH}")
        sys.exit(1)
    return json.load(open(REG_PATH, encoding='utf-8'))

def is_valid_json(path):
    try:
        json.load(open(path, encoding='utf-8'))
        return True, None
    except Exception as e:
        return False, str(e)

def is_valid_svg(path):
    try:
        ET.parse(path)
        return True, None
    except Exception as e:
        return False, str(e)

def check_character(entry, fix=False, verbose=False):
    errs = []
    cid = entry.get("id")
    if not cid:
        return ["character entry missing 'id'"]
    if cid.startswith("_"):
        return []  # skip template
    path = entry.get("path", "").lstrip("/")
    full = os.path.join(ROOT, path)
    manifest_dir = os.path.dirname(full)

    if not os.path.exists(full):
        return [f"character '{cid}': manifest MISSING at {path}"]

    # JSON well-formed
    ok, err = is_valid_json(full)
    if not ok:
        return [f"character '{cid}': manifest JSON invalid: {err}"]

    data = json.load(open(full, encoding='utf-8'))

    # required fields
    for f in ["id", "version", "engine", "identityHash", "identity", "rig", "wardrobe"]:
        if f not in data:
            errs.append(f"character '{cid}': missing required field '{f}'")

    # engine values
    if data.get("engine") not in ENGINES:
        errs.append(f"character '{cid}': invalid engine '{data.get('engine')}' — must be {ENGINES}")
    if entry.get("engine") not in ENGINES:
        errs.append(f"character '{cid}': registry engine invalid '{entry.get('engine')}'")
    if data.get("engine") != entry.get("engine"):
        errs.append(f"character '{cid}': engine mismatch registry={entry.get('engine')} manifest={data.get('engine')}")

    # id match
    if data.get("id") != cid:
        errs.append(f"character '{cid}': id mismatch manifest.id={data.get('id')}")

    # version semver
    ver = data.get("version","")
    if not isinstance(ver, str) or ver.count(".") != 2:
        errs.append(f"character '{cid}': version must be semver x.y.z, got '{ver}'")

    # anchors 12
    anchors = data.get("rig", {}).get("anchors", {})
    if len(anchors) < 12:
        errs.append(f"character '{cid}': rig.anchors must have 12 points, has {len(anchors)}")
    else:
        for name, pt in anchors.items():
            if not (isinstance(pt, list) and len(pt)==2 and all(isinstance(v,(int,float)) for v in pt)):
                errs.append(f"character '{cid}': anchor '{name}' must be [x,y] numbers, got {pt}")

    # expressions / poses not empty
    if not data.get("expressions"):
        errs.append(f"character '{cid}': expressions empty")
    if not data.get("poses"):
        errs.append(f"character '{cid}': poses empty")

    # Check all referenced files in wardrobe.base.layers
    layers = data.get("wardrobe", {}).get("base", {}).get("layers", [])
    for lyr in layers:
        src = lyr.get("src")
        if not src:
            errs.append(f"character '{cid}': layer '{lyr.get('id','?')}' missing 'src'")
            continue
        # Check path not absolute, not traversing outside
        if src.startswith("/") or ".." in src:
            errs.append(f"character '{cid}': layer '{lyr.get('id')}' src must be relative without '..': {src}")
            continue
        full_layer = os.path.join(manifest_dir, src)
        if not os.path.exists(full_layer):
            errs.append(f"character '{cid}': layer file MISSING: {src} (resolved {os.path.relpath(full_layer, ROOT)})")
        else:
            # Check SVG validity if .svg
            if src.endswith(".svg"):
                ok2, err2 = is_valid_svg(full_layer)
                if not ok2:
                    errs.append(f"character '{cid}': layer SVG invalid {src}: {err2}")
            elif src.endswith(".json"):
                ok2, err2 = is_valid_json(full_layer)
                if not ok2:
                    errs.append(f"character '{cid}': layer JSON invalid {src}: {err2}")
            # Check anchor exists
            if lyr.get("anchor") not in anchors and lyr.get("anchor") not in ["head","neck","shoulder","hip","elbowF","handF","elbowB","handB","kneeF","footF","kneeB","footB","root"]:
                errs.append(f"character '{cid}': layer '{lyr.get('id')}' anchor '{lyr.get('anchor')}' not in rig.anchors")

    # For layered-svg / hybrid, require at least 2 layers with real files
    if data.get("engine") in ("layered-svg","hybrid"):
        real_layers = [l for l in layers if os.path.exists(os.path.join(manifest_dir, l.get("src","")))]
        if len(real_layers) < 2:
            errs.append(f"character '{cid}': engine {data.get('engine')} requires >=2 layer files with real SVGs, found {len(real_layers)}")

    # identityHash (now includes SVG content)
    computed = hash_character(data, manifest_dir)
    stored = data.get("identityHash")
    if stored != computed:
        if fix:
            data["identityHash"] = computed
            json.dump(data, open(full, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
            print(f"  FIXED character '{cid}' identityHash: {stored} -> {computed}")
        else:
            errs.append(f"character '{cid}': identityHash mismatch stored={stored} computed={computed} (run --fix-hash)")

    if verbose and not errs:
        layer_count = len(layers)
        print(f"  OK character '{cid}' engine={data.get('engine')} hash={stored} layers={layer_count}")

    return errs

def check_map(entry, fix=False, verbose=False):
    errs = []
    mid = entry.get("id")
    if not mid or mid.startswith("_"):
        return []
    base_path = entry.get("base", "").lstrip("/")
    tl_path = entry.get("timeline", "").lstrip("/")
    meta_path = entry.get("meta", "").lstrip("/") if entry.get("meta") else None

    full_base = os.path.join(ROOT, base_path)
    if not os.path.exists(full_base):
        return [f"map '{mid}': base MISSING at {base_path}"]
    ok, err = is_valid_json(full_base)
    if not ok:
        errs.append(f"map '{mid}': base JSON invalid: {err}")
    else:
        base_data = json.load(open(full_base, encoding='utf-8'))
        if not base_data.get("countries"):
            errs.append(f"map '{mid}': base.countries empty or missing")
        else:
            # Validate each country has required fields
            for c in base_data["countries"]:
                if not c.get("id") or not c.get("path") or not c.get("color"):
                    errs.append(f"map '{mid}': country missing id/path/color: {c.get('id','?')}")
                if c.get("color") and not c["color"].startswith("#"):
                    errs.append(f"map '{mid}': country {c['id']} color must be #hex")

    # timeline
    if tl_path:
        full_tl = os.path.join(ROOT, tl_path)
        if not os.path.exists(full_tl):
            errs.append(f"map '{mid}': timeline MISSING at {tl_path}")
        else:
            ok, err = is_valid_json(full_tl)
            if not ok:
                errs.append(f"map '{mid}': timeline JSON invalid: {err}")
            else:
                tl_data = json.load(open(full_tl, encoding='utf-8'))
                if not isinstance(tl_data, list):
                    errs.append(f"map '{mid}': timeline must be array")
                else:
                    # Check sorted by year and no duplicate years with same op
                    years = [d.get("year") for d in tl_data if isinstance(d,dict)]
                    if years != sorted(years):
                        errs.append(f"map '{mid}': timeline years not sorted: {years}")
                    for diff in tl_data:
                        if "year" not in diff or "changes" not in diff:
                            errs.append(f"map '{mid}': timeline entry missing year/changes: {diff}")

    # meta optional
    if meta_path:
        full_meta = os.path.join(ROOT, meta_path)
        if not os.path.exists(full_meta):
            errs.append(f"map '{mid}': meta MISSING at {meta_path}")
        else:
            ok, err = is_valid_json(full_meta)
            if not ok:
                errs.append(f"map '{mid}': meta JSON invalid: {err}")

    if entry.get("engine") not in ENGINES:
        errs.append(f"map '{mid}': invalid engine '{entry.get('engine')}' must be {ENGINES}")
    if verbose and not errs:
        base_data = json.load(open(full_base, encoding='utf-8')) if os.path.exists(full_base) else {}
        tl_data = json.load(open(os.path.join(ROOT, tl_path), encoding='utf-8')) if tl_path and os.path.exists(os.path.join(ROOT, tl_path)) else []
        print(f"  OK map '{mid}' engine={entry.get('engine')} countries={len(base_data.get('countries',[]))} diffs={len(tl_data)}")
    return errs

def check_location(entry, verbose=False):
    errs = []
    lid = entry.get("id")
    if not lid or lid.startswith("_"):
        return []
    path = entry.get("path", "").lstrip("/")
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        errs.append(f"location '{lid}': file MISSING at {path}")
    elif not full.endswith(".js"):
        errs.append(f"location '{lid}': path must be .js, got {path}")
    elif verbose and not errs:
        print(f"  OK location '{lid}'")
    return errs

def check_prop(entry, verbose=False):
    errs = []
    pid = entry.get("id")
    if not pid or pid.startswith("_"):
        return []
    path = entry.get("path", "").lstrip("/")
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        errs.append(f"prop '{pid}': file MISSING at {path}")
    elif verbose and not errs:
        print(f"  OK prop '{pid}'")
    return errs

def main():
    import argparse
    ap = argparse.ArgumentParser(description="Library validate v2")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--fix-hash", action="store_true", help="auto-fix identityHash")
    ap.add_argument("--strict", action="store_true", help="also validate _template")
    a = ap.parse_args()
    reg = load_registry()
    all_errs = []
    seen_ids = {}
    seen_paths = {}

    print(f"\nLibrary validate v2 — registry v{reg.get('version','?')} (strict={a.strict})\n")

    for kind in ["characters", "maps", "locations", "props"]:
        entries = reg.get(kind, [])
        if a.verbose:
            print(f"[{kind}] {len(entries)} entries")
        for e in entries:
            cid = e.get("id")
            # skip template unless strict
            if cid and cid.startswith("_") and not a.strict:
                if a.verbose:
                    print(f"  SKIP template '{cid}'")
                continue
            if not cid:
                all_errs.append(f"{kind} entry missing 'id': {e}")
                continue
            # duplicate id across all categories
            if cid in seen_ids:
                all_errs.append(f"duplicate id '{cid}' found in {seen_ids[cid]} and {kind}")
            else:
                seen_ids[cid] = kind
            # duplicate path
            p = e.get("path") or e.get("base")
            if p:
                if p in seen_paths:
                    all_errs.append(f"duplicate path '{p}' for ids '{seen_paths[p]}' and '{cid}'")
                else:
                    seen_paths[p] = cid

            if kind == "characters":
                all_errs.extend(check_character(e, fix=a.fix_hash, verbose=a.verbose))
            elif kind == "maps":
                all_errs.extend(check_map(e, fix=a.fix_hash, verbose=a.verbose))
            elif kind == "locations":
                all_errs.extend(check_location(e, verbose=a.verbose))
            elif kind == "props":
                all_errs.extend(check_prop(e, verbose=a.verbose))

    # orphan check
    chars_dir = os.path.join(ROOT, "library/characters")
    if os.path.exists(chars_dir):
        for name in os.listdir(chars_dir):
            if name.startswith("."): continue
            if name.startswith("_") and not a.strict: continue
            full = os.path.join(chars_dir, name)
            if os.path.isdir(full) and name not in seen_ids:
                print(f"  WARNING: orphan character folder '{name}' not in registry.json")

    maps_dir = os.path.join(ROOT, "library/maps")
    if os.path.exists(maps_dir):
        for name in os.listdir(maps_dir):
            if name.startswith("."): continue
            if name.startswith("_") and not a.strict: continue
            full = os.path.join(maps_dir, name)
            if os.path.isdir(full) and name not in seen_ids:
                print(f"  WARNING: orphan map folder '{name}' not in registry.json")

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
