// Fails when a built chunk imports from a module worker's entry file (packages/client/dist/assets/simWorker-*.js).
// Safari evaluates such an import as a second copy of the entry, with its own never-started WebAssembly
// (Rapier), so offline matches fail there only. See packages/client/src/game/simWorkerCore.ts.
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../../packages/client/dist/assets/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
const entries = files.filter((f) => /^simWorker-[\w-]+\.js$/.test(f));
if (!entries.length) {
  console.error('check-worker-entry: no simWorker-*.js in packages/client/dist/assets (run pnpm build first)');
  process.exit(1);
}
let bad = 0;
for (const entry of entries) {
  // A static or dynamic import of the entry, from another chunk ("./simWorker-x.js" after from/import).
  const pattern = new RegExp(`(from|import)\\s*\\(?\\s*["']\\./${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`);
  for (const f of files) {
    if (f === entry) continue;
    if (pattern.test(readFileSync(new URL(f, dir), 'utf8'))) {
      console.error(`check-worker-entry: ${f} imports from the worker entry ${entry}`);
      bad++;
    }
  }
}
if (bad) process.exit(1);
console.log(`check-worker-entry: nothing imports from ${entries.join(', ')}`);
