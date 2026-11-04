// `pnpm content:rebuild`: rebuilds every generated content file from the sources, in order, so a merge
// (or a new pack) needs no hand-editing of generated files. Deterministic and idempotent: run it twice
// and the second run changes nothing.
//
//   1. locks   tools/content/lockfile.mjs            every content/*.lock.json in the stable format; git
//                                                     conflict markers in one are settled (both sides'
//                                                     entries; the one matching the file on disk wins)
//   2. tables  tools/content/surfaces.mjs            the prop surface pictures and content/surfaces.lock.json
//              tools/content/prepare-props.mjs       props.generated.ts and props.lock.json from
//                                                     content/props/*.json (packs from downloads kept as built)
//              tools/content/character-manifests.mjs characters.generated.ts from content/characters/*.json
//              tools/content/weapons.mjs             weapons.generated.ts, weaponFamilies.generated.ts, codes.lock.json
//              tools/content/vehicles.mjs            mounts.generated.ts from content/vehicles/*.json
//              tools/content/npcs.mjs                npcRoles.generated.ts and codes.lock.json (npcRoles) from content/npcs.json
//              tools/content/hitboxes.mjs            hitboxes.generated.ts: hit shapes measured from the character and creature models
//              tools/content/pickups.mjs             pickups.generated.ts from content/pickups.json
//              tools/content/materials.mjs           materials.generated.ts from content/materials.json
//              tools/content/surface-types.mjs       surfaceTypes.generated.ts from content/surface-types.json and the props' `surface`
//              tools/content/tiles.mjs               kitTiles.generated.ts and edgeStyles.generated.ts from content/tiles/
//              tools/content/environment.mjs         the environment species (public/env/), environment.lock.json and both environment.generated.ts
//   3. atlas   tools/content/build-palette-atlas.mjs --offline: the palette atlases from the pictures
//                                                     already made (any old atlas, either side of a conflict)
//      only when a piece has no picture yet (new or changed model):
//      build   pnpm build
//      preview vite preview on a free port (not 4173, 4391 or 4567), stopped by its PID afterwards
//      atlas   build-palette-atlas.mjs <url>          renders the missing pictures
//   4. content:build                                  content/provenance.json
//   5. content:check                                  everything checked
//
//   pnpm content:rebuild [--all]     --all re-renders every palette picture (builds and serves the client)
//
// After a merge: resolve the source files git couldn't merge (content/props/<pack>.json, maps, code),
// then run this; generated files with conflict markers (the locks, provenance, *.generated.ts, the
// palette index) are rewritten, not merged. Then `git add` what it wrote.

import { execFileSync, spawn } from 'node:child_process';
import { get } from 'node:http';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const all = process.argv.includes('--all');
/** Generated files: a merge conflict in one is settled by rebuilding it. */
const GENERATED = /^(content\/[a-z-]+\.lock\.json|content\/provenance\.json|packages\/shared\/src\/content\/[A-Za-z]+\.generated\.ts|packages\/client\/public\/thumbs\/palette\.json)$/;
/** Ports other tools and sessions use. */
const AVOID = new Set([4173, 4391, 4567]);

const step = (name) => console.log(`\n== ${name}`);
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
const node = (script, ...args) => run(process.execPath, [join(ROOT, script), ...args]);

// Unmerged source files must be resolved by hand first: rebuilding can't know which side is right.
const unmerged = (() => {
  try {
    return [...new Set(execFileSync('git', ['diff', '--name-only', '--diff-filter=U'], { cwd: ROOT }).toString().split('\n').filter(Boolean))];
  } catch {
    return [];
  }
})();
const byHand = unmerged.filter((f) => !GENERATED.test(f));
if (byHand.length) {
  console.error(`Resolve these merge conflicts first (they are sources, not generated):\n  ${byHand.join('\n  ')}`);
  process.exit(1);
}

step('locks');
node('tools/content/lockfile.mjs');

step('tables: props, characters, weapons, vehicles, NPC roles, pickups, materials, tiles and hit shapes');
node('tools/content/surfaces.mjs');
node('tools/content/prepare-props.mjs');
node('tools/content/character-manifests.mjs');
node('tools/content/weapons.mjs');
node('tools/content/vehicles.mjs');
node('tools/content/npcs.mjs');
node('tools/content/pickups.mjs');
node('tools/content/materials.mjs');
node('tools/content/surface-types.mjs');
node('tools/content/tiles.mjs');
node('tools/content/environment.mjs');
// Hit shapes measured from the character models (after the looks: it reads them).
node('tools/content/hitboxes.mjs');

step('palette atlas');
let pending = all;
if (!all) {
  try {
    node('tools/content/build-palette-atlas.mjs', '--offline');
  } catch (e) {
    if (e.status !== 3) throw e;
    pending = true;
  }
}
if (pending) {
  step('build (pictures to render)');
  run('pnpm', ['build']);
  const port = await freePort(4799);
  step(`preview on port ${port}`);
  const preview = spawn('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'inherit', detached: true });
  const stop = () => {
    // The preview's own process group (pnpm and vite under it), by its PID.
    try {
      process.kill(-preview.pid, 'SIGTERM');
    } catch {}
  };
  process.on('exit', stop);
  try {
    await waitFor(`http://localhost:${port}/`);
    step('atlas: rendering');
    node('tools/content/build-palette-atlas.mjs', `http://localhost:${port}`, ...(all ? ['--all'] : []));
  } finally {
    stop();
  }
}

step('content:build');
node('tools/content/build.mjs');
step('content:check');
node('tools/content/build.mjs', '--check');

const changed = execFileSync('git', ['status', '--porcelain', '--', 'content', 'packages/shared/src/content', 'packages/client/public/thumbs', 'packages/client/public/props'], { cwd: ROOT }).toString().trim();
console.log(changed ? `\ncontent rebuilt; changed:\n${changed}` : '\ncontent rebuilt; nothing changed');

/** The first free port from `from` up, skipping the ones others use. */
async function freePort(from) {
  for (let port = from; port < from + 100; port++) {
    if (AVOID.has(port)) continue;
    const ok = await new Promise((done) => {
      const srv = createServer().once('error', () => done(false)).once('listening', () => srv.close(() => done(true)));
      srv.listen(port, '127.0.0.1');
    });
    if (ok) return port;
  }
  throw new Error(`no free port from ${from}`);
}

/** Wait until the preview answers (two minutes at most). */
async function waitFor(url) {
  for (let i = 0; i < 240; i++) {
    // node:http, not fetch: a proxy set in the environment must not see localhost.
    const ok = await new Promise((done) => get(url, (res) => (res.resume(), done(res.statusCode === 200))).once('error', () => done(false)));
    if (ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not answer`);
}
