import { compilePack, extractPack } from '@foundryvtt/foundryvtt-cli';
import { readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_DIR = path.join(ROOT, 'packs-source');
const PACKS_DIR = path.join(ROOT, 'packs');

const mode = process.argv[2];

if (!['pack', 'unpack'].includes(mode)) {
  console.error('Usage: node scripts/build-packs.mjs <pack|unpack>');
  process.exit(1);
}

const packNames = readdirSync(SOURCE_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

for (const name of packNames) {
  const source = path.join(SOURCE_DIR, name);
  const dest = path.join(PACKS_DIR, name);

  if (mode === 'pack') {
    mkdirSync(PACKS_DIR, { recursive: true });
    console.log(`Compiling ${name}...`);
    await compilePack(source, dest, { log: true });
  } else {
    console.log(`Extracting ${name}...`);
    await extractPack(dest, source, { log: true, clean: true });
  }
}

console.log(`Done: ${mode} for [${packNames.join(', ')}]`);
