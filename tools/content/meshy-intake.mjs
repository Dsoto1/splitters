// Brings new Meshy characters in, in one go:
//
//   MESHY_API_KEY=… pnpm content:meshy <downloads dir>            every manifest not built yet
//   MESHY_API_KEY=… ONLY=<ids> pnpm content:meshy <downloads dir> just those (rebuilds them if built)
//
// 1. fetch-meshy.mjs downloads what isn't in the downloads dir yet (outside the repo);
// 2. prepare-meshy-characters.mjs builds them (ONLY=<them>; everything else is kept as built);
// 3. character-manifests.mjs writes the looks the game reads;
// 4. build.mjs refreshes content/provenance.json.
// Then check them on the grip sheet (tools/content/grip-sheet.mjs) and ship (docs/CHARACTERS.md).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifests } from './character-manifests.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = process.argv[2] && resolve(process.argv[2]);
if (!dir) {
  console.error('usage: MESHY_API_KEY=… [ONLY=<ids>] pnpm content:meshy <downloads dir>');
  process.exit(2);
}
if (!relative(ROOT, dir).startsWith('..')) {
  console.error(`the downloads dir must be outside the repo (raw downloads are never committed): ${dir}`);
  process.exit(2);
}
const lock = JSON.parse(readFileSync(join(ROOT, 'content/meshy.lock.json'), 'utf8'));
const only = process.env.ONLY?.split(',').filter(Boolean);
const ids = only ?? readManifests({ ready: true }).filter((m) => !lock.files.some((f) => f.id === m.id)).map((m) => m.id);
if (!ids.length) {
  console.log('every manifest in content/characters is built (ONLY=<ids> rebuilds some)');
  process.exit(0);
}
console.log(`characters: ${ids.join(', ')}`);
const step = (what, args, env = {}) => {
  console.log(`\n== ${what}`);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) {
    console.error(`${what} failed`);
    process.exit(r.status ?? 1);
  }
};
step('fetch', ['tools/content/fetch-meshy.mjs', dir, ...ids]);
if (!existsSync(dir)) process.exit(1);
step('prepare', ['tools/content/prepare-meshy-characters.mjs', dir], { ONLY: ids.join(',') });
step('looks', ['tools/content/character-manifests.mjs']);
step('provenance', ['tools/content/build.mjs']);
console.log(`\nbuilt ${ids.join(', ')}. Next: pnpm build, serve it, and check the grip sheet:\n  ONLY=${ids.join(',')} node tools/content/grip-sheet.mjs http://localhost:4860 <out dir>`);
