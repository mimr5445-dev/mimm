import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const binDir = path.join(ROOT, 'node_modules/@sparticuz/chromium/bin');
import pkg from '../node_modules/@sparticuz/chromium/build/lambdafs.js';
const { inflate } = pkg;
const files = ['chromium.br','swiftshader.tar.br','fonts.tar.br'];
for (const f of files) {
  const src = path.join(binDir, f);
  if (!fs.existsSync(src)) { console.log(`missing ${f}`); continue; }
  console.log(`inflating ${f}...`);
  const p = await inflate(src);
  console.log(`→ ${p}`);
}
console.log('done');
console.log('checking /tmp/chromium exists', fs.existsSync('/tmp/chromium'));
console.log('checking /tmp/swiftshader', fs.existsSync('/tmp/swiftshader'));
