// library/engine/validate.js — منطق التحقق المشترك (JS side)
// Shared validation logic for JS tools/tests.
// Mirrors Python validate.py but runs in browser/Node for live checks.

export function isValidEngine(v) {
  return ['procedural','layered-svg','hybrid'].includes(v);
}

export function isHexColor(s) {
  return typeof s === 'string' && /^#[a-fA-F0-9]{6}$/.test(s);
}

export function isSnakeId(s) {
  return typeof s === 'string' && /^[a-z0-9_]+$/.test(s);
}

export function isSemVer(s) {
  return typeof s === 'string' && /^\d+\.\d+\.\d+$/.test(s);
}

export function isIdentityHash(s) {
  return typeof s === 'string' && /^[a-f0-9]{16}$/.test(s);
}

// Compute canonical identity payload for hashing (must match Python identity_hash.py)
// Fields: identity + rig + wardrobe.base (sorted keys)
export function canonicalIdentityPayload(manifest) {
  const payload = {
    identity: manifest.identity,
    rig: manifest.rig,
    wardrobe: { base: manifest.wardrobe?.base },
  };
  return JSON.stringify(payload, Object.keys(payload).sort());
}

// Validate character manifest shape (lightweight, full validation via JSON Schema in Python)
export function validateCharacterShape(m) {
  const errs = [];
  if (!isSnakeId(m.id)) errs.push(`id must be snake_case: ${m.id}`);
  if (!isSemVer(m.version)) errs.push(`version must be semver: ${m.version}`);
  if (!isValidEngine(m.engine)) errs.push(`engine must be one of procedural/layered-svg/hybrid: ${m.engine}`);
  if (!isIdentityHash(m.identityHash)) errs.push(`identityHash must be 16 hex: ${m.identityHash}`);
  if (!m.identity?.name?.ar || !m.identity?.name?.en) errs.push('identity.name.ar/en required');
  if (!m.rig?.anchors || Object.keys(m.rig.anchors).length < 12) errs.push('rig.anchors must have 12 points');
  if (!m.wardrobe?.base) errs.push('wardrobe.base required');
  return errs;
}

export function validateMapShape(m) {
  const errs = [];
  if (!isSnakeId(m.id)) errs.push(`id invalid: ${m.id}`);
  if (!isSemVer(m.version)) errs.push(`version invalid: ${m.version}`);
  if (!isIdentityHash(m.identityHash)) errs.push(`identityHash invalid`);
  if (!m.base?.countries) errs.push('base.countries required');
  return errs;
}
