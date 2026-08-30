import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WORLD_ID = 'blades68';
const WORLD_DIR = path.join(os.homedir(), 'foundrydata', 'Data', 'worlds', WORLD_ID);
const WORLD_JSON_PATH = path.join(WORLD_DIR, 'world.json');

await mkdir(path.join(WORLD_DIR, 'data'), { recursive: true });
await mkdir(path.join(WORLD_DIR, 'scenes'), { recursive: true });

if (existsSync(WORLD_JSON_PATH)) {
  console.log(`World already exists at ${WORLD_JSON_PATH}`);
  process.exit(0);
}

const worldJson = {
  title: 'Blades68',
  system: 'blades68',
  id: WORLD_ID,
  coreVersion: '14',
  compatibility: { minimum: '13', verified: '14' },
  systemVersion: '0.1.0',
  description: 'Local dev world for the Blades68 system.',
  flags: {}
};

await writeFile(WORLD_JSON_PATH, JSON.stringify(worldJson, null, 2));
console.log(`Created dev world at ${WORLD_JSON_PATH}`);
console.log(
  `Set FOUNDRY_WORLD=${WORLD_ID} in ~/tools/local_containers/foundry_14 (or launch it from /setup) to play-test.`
);
