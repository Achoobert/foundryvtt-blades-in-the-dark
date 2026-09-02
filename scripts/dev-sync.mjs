import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClassicLevel } from 'classic-level';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TARGET = path.join(os.homedir(), 'foundrydata', 'Data', 'systems', 'blades68');

const ENTRIES_TO_SYNC = [
  'system.json',
  'template.json',
  'module',
  'templates',
  'styles',
  'lang',
  'images',
  'themes',
  'assets',
  'packs',
];

/**
 * Foundry migrates NeDB `foo.db` packs into a LevelDB folder `foo/` and then
 * keeps reading that folder — later `.db` overwrites are ignored. Rebuild the
 * LevelDB companion from the synced `.db` so YAML pack updates actually show up.
 */
async function rebuildPackLevelDbs(packsDir) {
  if (!existsSync(packsDir)) return;
  const entries = await readdir(packsDir);
  for (const name of entries) {
    if (!name.endsWith('.db')) continue;
    const dbPath = path.join(packsDir, name);
    const levelDir = dbPath.replace(/\.db$/i, '');
    try {
      const docs = readFileSync(dbPath, 'utf8')
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
      await rm(levelDir, { recursive: true, force: true });
      const db = new ClassicLevel(levelDir, { keyEncoding: 'utf8', valueEncoding: 'utf8' });
      await db.open();
      const batch = db.batch();
      const prefix = name.includes('macro') ? '!macros!' : '!items!';
      for (const doc of docs) {
        batch.put(`${prefix}${doc._id}`, JSON.stringify(doc));
      }
      await batch.write();
      await db.close();
      console.log(`Rebuilt LevelDB ${path.basename(levelDir)} (${docs.length} docs)`);
    } catch (err) {
      console.warn(`Could not rebuild LevelDB for ${name}: ${err.message}`);
      console.warn('Close Foundry / unlock the pack, then re-run npm run dev:sync.');
    }
  }
}

await mkdir(TARGET, { recursive: true });

for (const entry of ENTRIES_TO_SYNC) {
  const source = path.join(ROOT, entry);
  if (!existsSync(source)) continue;
  await cp(source, path.join(TARGET, entry), { recursive: true, force: true });
  console.log(`Synced ${entry} -> ${TARGET}`);
}

await rebuildPackLevelDbs(path.join(TARGET, 'packs'));

console.log(`\nSystem deployed to ${TARGET}`);
console.log('Restart/refresh the foundry_14 container world to pick up changes.');
