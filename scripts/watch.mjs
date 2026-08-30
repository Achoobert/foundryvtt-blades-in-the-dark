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
  'assets',
  'packs-source',
  'system.json',
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
let pending = { packs: false, quench: false, sync: false };
let running = false;

function schedule(filePath) {
  const r = rel(filePath);
  if (r === 'packs-source' || r.startsWith('packs-source/')) pending.packs = true;
  if (r === 'tests/quench' || r.startsWith('tests/quench/')) pending.quench = true;
  else pending.sync = true;

  clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

async function flush() {
  if (running) {
    timer = setTimeout(flush, DEBOUNCE_MS);
    return;
  }

  const job = { ...pending };
  pending = { packs: false, quench: false, sync: false };
  if (!job.packs && !job.quench && !job.sync) return;

  running = true;
  try {
    if (job.packs) await run('packs:pack');
    if (job.sync) await run('dev:sync');
    if (job.quench) await run('test:quench:sync');
  } catch (err) {
    console.error(err.message);
  } finally {
    running = false;
  }
}

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
