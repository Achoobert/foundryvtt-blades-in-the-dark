import { spawn } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEBOUNCE_MS = 250;

const WATCH_PATHS = [
  'styles',
  'module',
  'templates',
  'lang',
  'images',
  'themes',
  'assets',
  'packs-source',
  'yml_source',
  'system.json',
  'template.json',
  'tests/quench',
];

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', script], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited ${code}`));
    });
    child.on('error', reject);
  });
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

let timer;
let pending = { packs: false, yml: false, quench: false, sync: false };
let running = false;

function schedule(filePath) {
  const r = rel(filePath);
  if (r === 'packs-source' || r.startsWith('packs-source/')) pending.packs = true;
  if (r === 'yml_source' || r.startsWith('yml_source/')) pending.yml = true;
  if (r === 'tests/quench' || r.startsWith('tests/quench/')) pending.quench = true;
  else pending.sync = true;

  clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

async function runSafe(script) {
  try {
    await run(script);
  } catch (err) {
    console.error(err.message);
  }
}

async function flush() {
  if (running) {
    timer = setTimeout(flush, DEBOUNCE_MS);
    return;
  }

  const job = { ...pending };
  pending = { packs: false, yml: false, quench: false, sync: false };
  if (!job.packs && !job.yml && !job.quench && !job.sync) return;

  running = true;
  // Each step runs independently: a failure in one (e.g. packs:pack with no
  // packs-source/ yet) must not skip the others, or dev:sync silently stops
  // pushing changes to the Foundry data dir.
  if (job.packs) await runSafe('packs:pack');
  // Must precede dev:sync so freshly compiled packs/ get copied out.
  if (job.yml) await runSafe('packs:yml');
  if (job.sync) await runSafe('dev:sync');
  if (job.quench) await runSafe('test:quench:sync');
  running = false;
}

console.log('Running initial build + sync...');
await run('build:css');
pending = {
  packs: existsSync(path.join(ROOT, 'packs-source')),
  yml: existsSync(path.join(ROOT, 'yml_source')),
  quench: true,
  sync: true,
};
await flush();

const sass = spawn('npm', ['run', 'watch:css'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
});

sass.on('exit', (code) => {
  if (code && code !== 0) process.exit(code);
});

for (const entry of WATCH_PATHS) {
  const target = path.join(ROOT, entry);
  if (!existsSync(target)) continue;
  watch(target, { recursive: true }, (_event, filename) => {
    schedule(filename ? path.join(target, filename) : target);
  });
  console.log(`Watching ${entry}`);
}

function shutdown() {
  sass.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('Watching. CSS + packs + Foundry sync + Quench.');
