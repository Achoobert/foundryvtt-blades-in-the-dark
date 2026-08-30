import { cp, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = path.join(ROOT, 'tests', 'quench');
const TARGET = path.join(os.homedir(), 'foundrydata', 'Data', 'modules', 'blades68-quench-tests');

await mkdir(TARGET, { recursive: true });
await cp(SOURCE, TARGET, { recursive: true, force: true });

console.log(`Quench test module deployed to ${TARGET}`);
