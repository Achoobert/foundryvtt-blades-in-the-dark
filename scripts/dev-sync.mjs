import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TARGET = path.join(os.homedir(), 'foundrydata', 'Data', 'systems', 'blades68');

const ENTRIES_TO_SYNC = ['system.json', 'module', 'templates', 'styles', 'lang', 'assets', 'packs', 'rule_books'];

await mkdir(TARGET, { recursive: true });

for (const entry of ENTRIES_TO_SYNC) {
  const source = path.join(ROOT, entry);
  if (!existsSync(source)) continue;
  await cp(source, path.join(TARGET, entry), { recursive: true, force: true });
  console.log(`Synced ${entry} -> ${TARGET}`);
}

console.log(`\nSystem deployed to ${TARGET}`);
console.log('Restart/refresh the foundry_14 container world to pick up changes.');
