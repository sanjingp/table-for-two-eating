// Copies three.module.js from node_modules into public/vendor so the client
// never loads anything from a CDN at runtime.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'vendor');
mkdirSync(outDir, { recursive: true });

const files = ['three.module.js', 'three.core.js'];
let copied = 0;
for (const f of files) {
  const src = join(root, 'node_modules', 'three', 'build', f);
  if (existsSync(src)) { copyFileSync(src, join(outDir, f)); copied++; }
}
if (!copied) console.warn('[vendor] three not found in node_modules; skipping');
else console.log(`[vendor] copied ${copied} three.js file(s) to public/vendor`);
