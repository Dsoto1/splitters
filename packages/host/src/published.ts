import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMapId, isRetiredMap, loadMap, serializeMap } from '@tiletrigger/shared';
import type { Fetch } from './advertiser.ts';

/**
 * The Host Service's maps: the ones that came with it, with the versions the
 * owner published on the hub (packages/server/src/publish.ts) laid over them,
 * in one folder the match reads (the state folder's maps/). Brought up to date
 * when the service starts and every few minutes; a publish reaches a running
 * server at its next map change. When the hub can't be reached the folder
 * stays as it was, so a host started offline still has every map.
 *
 * MANIFEST records which files came from the hub (by content hash), so a
 * version taken down on the hub goes back to the one that came with the
 * service, and a published map that was taken down goes away.
 */
const MANIFEST = '.published.json';

interface Entry {
  id: string;
  hash: string;
  at: number;
}

export interface SyncResult {
  /** Maps from the hub in the folder now. */
  published: number;
  /** IDs of published maps that didn't come with the service (official maps added by publishing). */
  added: string[];
  /** Whether the hub answered. */
  online: boolean;
}

const sameFile = (a: string, b: string) => {
  try {
    const sa = statSync(a);
    const sb = statSync(b);
    // Seconds: file systems keep times to different precisions.
    return sa.size === sb.size && Math.floor(sa.mtimeMs / 1000) === Math.floor(sb.mtimeMs / 1000);
  } catch {
    return false;
  }
};

/** Write `text` to `file` in one step (a reader never sees half a map). */
function writeAtomic(file: string, text: string): void {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

export async function syncMaps(bundled: string, dir: string, hub: string, fetcher: Fetch = fetch, log: (l: string) => void = () => undefined): Promise<SyncResult> {
  mkdirSync(dir, { recursive: true });
  let manifest: Record<string, Entry> = {};
  try {
    manifest = JSON.parse(readFileSync(join(dir, MANIFEST), 'utf8')) as Record<string, Entry>;
  } catch {
    // None yet.
  }
  // What the hub publishes now (null: it didn't answer, so leave what we have).
  let listed: Entry[] | null = null;
  try {
    const res = await fetcher(`${hub}/api/v1/maps`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) listed = ((await res.json()) as { maps: Entry[] }).maps.filter((m) => isMapId(m.id) && !isRetiredMap(m.id));
    else if (res.status === 404) listed = [];
  } catch {
    listed = null;
  }
  const shipped = readdirSync(bundled).filter((f) => f.endsWith('.json'));
  if (listed) {
    const now = new Set(listed.map((m) => m.id));
    for (const m of listed) {
      if (manifest[m.id]?.hash === m.hash && existsSync(join(dir, `${m.id}.json`))) continue;
      try {
        const res = await fetcher(`${hub}/api/v1/maps/${m.id}?v=${m.at}`, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) continue;
        const r = loadMap(await res.text());
        if (!r.ok || r.map.metadata.id !== m.id) continue;
        writeAtomic(join(dir, `${m.id}.json`), serializeMap(r.map));
        manifest[m.id] = m;
        log(`map ${m.id}: the published version`);
      } catch {
        // Next time.
      }
    }
    // Taken down on the hub: back to the map that came with the service, or gone.
    for (const id of Object.keys(manifest)) {
      if (now.has(id)) continue;
      delete manifest[id];
      if (existsSync(join(bundled, `${id}.json`))) copyFileSync(join(bundled, `${id}.json`), join(dir, `${id}.json`));
      else rmSync(join(dir, `${id}.json`), { force: true });
      log(`map ${id}: no longer published`);
    }
    writeAtomic(join(dir, MANIFEST), JSON.stringify(manifest));
  }
  // The maps that came with the service, where nothing published replaces them (copied once, then when they change).
  for (const f of shipped) {
    const id = f.slice(0, -5);
    if (manifest[id]) continue;
    const from = join(bundled, f);
    const to = join(dir, f);
    if (sameFile(from, to)) continue;
    copyFileSync(from, to);
    const t = statSync(from);
    try {
      // Same times as the original, so the next start sees it unchanged.
      utimesSync(to, t.atime, t.mtime);
    } catch {
      // Copied again next time.
    }
  }
  // The built-in map rotations (maps/rotations/) and bot sets (maps/botsets/) come along: the match reads them from this folder too.
  for (const sub of ['rotations', 'botsets']) {
    const presets = join(bundled, sub);
    if (!existsSync(presets)) continue;
    mkdirSync(join(dir, sub), { recursive: true });
    for (const f of readdirSync(presets).filter((x) => x.endsWith('.json'))) if (!sameFile(join(presets, f), join(dir, sub, f))) copyFileSync(join(presets, f), join(dir, sub, f));
  }
  const shippedIds = new Set(shipped.map((f) => f.slice(0, -5)));
  return { published: Object.keys(manifest).length, added: Object.keys(manifest).filter((id) => !shippedIds.has(id)), online: !!listed };
}
