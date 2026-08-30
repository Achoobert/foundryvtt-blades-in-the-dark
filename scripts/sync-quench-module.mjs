import { cp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = path.join(ROOT, 'tests', 'quench');
const TARGET = path.join(os.homedir(), 'foundrydata', 'Data', 'modules', 'blades68-quench-tests');

// Remove first so batch files deleted from tests/quench don't linger as stale,
// still-deployed leftovers in the world's module folder.
await rm(TARGET, { recursive: true, force: true });
await mkdir(TARGET, { recursive: true });
await cp(SOURCE, TARGET, { recursive: true, force: true });

console.log(`Quench test module deployed to ${TARGET}`);
