// The Published maps workflow's download (.github/workflows/published-maps.yml): brings the versions the owner
// published from MapMaker (the hub's /api/v1/maps, packages/server/src/publish.ts) into maps/, except where the
// repository's map is newer than the published copy (shared map/publishedChoice.ts: it changed since the version it
// records, or the copy is an older revision). Those are skipped, with the reason logged, so the nightly sync never
// writes an older published copy over a newer map; a truly newer publish is still written.
//
//   node tools/ci/publishedMaps.mjs [--hub https://trigger.toshiroplay.com] [--maps maps]
//
// Needs the workspace installed (pnpm install): it runs the shared package's own TypeScript (node's type stripping).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ID_RE = /^[a-z0-9_]{2,48}$/;
const shared = () => import('../../packages/shared/src/index.ts');

/**
 * What to do with one published map: `write` the published file over maps/<id>.json, or keep the repository's.
 * `entry`: the hub's list entry ({ id, hash, at, release? }); `repoText`: the repository's file (undefined: none);
 * `publishedText`: the published file.
 */
export async function decide(entry, repoText, publishedText) {
  const { builtInRecord, choosePublished, loadMap, publishedRelease } = await shared();
  if (repoText === undefined) return { write: true, why: 'not in the repository' };
  const repo = loadMap(repoText, undefined, { forEditing: true });
  if (!repo.ok) return { write: true, why: "the repository's file doesn't load" };
  let release = entry.release;
  if (!release) {
    const pub = loadMap(publishedText, undefined, { forEditing: true });
    release = pub.ok ? publishedRelease(pub.map) : undefined;
  }
  const choice = choosePublished(builtInRecord(repo.map), { hash: entry.hash, at: entry.at, ...(release ? { release } : {}) });
  return { write: choice.use === 'published', why: choice.why };
}

/** Download the published maps into `mapsDir`, skipping those the repository has a newer version of. Returns what it did. */
export async function syncPublished({ hub, mapsDir, fetcher = fetch, log = console.log }) {
  const res = await fetcher(`${hub}/api/v1/maps`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`the hub answered ${res.status}`);
  const { maps } = await res.json();
  const done = { written: [], skipped: [] };
  for (const m of maps) {
    if (typeof m?.id !== 'string' || !ID_RE.test(m.id)) continue;
    const r = await fetcher(`${hub}/api/v1/maps/${m.id}?v=${m.at}`, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new Error(`${m.id}: the hub answered ${r.status}`);
    const text = await r.text();
    JSON.parse(text); // it is JSON; the map tests check the rest
    const out = join(mapsDir, `${m.id}.json`);
    const d = await decide(m, existsSync(out) ? readFileSync(out, 'utf8') : undefined, text);
    if (d.write) {
      writeFileSync(out, text);
      done.written.push(m.id);
      log(`${m.id}: ${m.name} (published ${new Date(m.at).toISOString()}): written (${d.why})`);
    } else {
      done.skipped.push(m.id);
      log(`${m.id}: ${m.name} (published ${new Date(m.at).toISOString()}): skipped, the repository's map is kept (${d.why})`);
    }
  }
  return done;
}

const SELF = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  // The shared package is TypeScript: run again with node's type stripping (as tools/content/asset-inventory.mjs does).
  if (!process.execArgv.includes('--experimental-transform-types')) {
    try {
      execFileSync(process.execPath, ['--experimental-transform-types', '--no-warnings', SELF, ...process.argv.slice(2)], { stdio: 'inherit' });
    } catch (e) {
      process.exit(typeof e.status === 'number' ? e.status : 1);
    }
    process.exit(0);
  }
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
  };
  const hub = arg('--hub', process.env.HUB ?? 'https://trigger.toshiroplay.com').replace(/\/+$/, '');
  const mapsDir = resolve(arg('--maps', 'maps'));
  const done = await syncPublished({ hub, mapsDir });
  console.log(`${done.written.length} written, ${done.skipped.length} skipped (the repository's map is newer or the same).`);
}
