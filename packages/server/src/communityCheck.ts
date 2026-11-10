import { Worker } from 'node:worker_threads';
import { initPhysics, isMapId, loadMap, mapIdentity, mapTextProblem, playableModes, validateMap } from '@tiletrigger/shared';
import type { PickCheck } from './community.ts';

/** Largest community map file the hub keeps (MULTIPLAYER_DIRECTION §8: the map budget is 8 MB as played). */
export const MAX_PICK_BYTES = 8 * 1024 * 1024;
/** A check that takes longer than this fails (a map that freezes the checker is no pick). */
export const CHECK_TIMEOUT_MS = 120_000;

/** Navigation findings that fail a pick: a spawn point cut off from the rest, or inside something solid. */
const NAV_FAILS = new Set(['nav.disconnected', 'spawn.blocked']);

let navReady: Promise<unknown> | null = null;

/**
 * The hub's own check of a map file sent for Community Pick (docs/COMMUNITY_MAPS.md, "Promotion thresholds"):
 * - it loads (schema and size limits, MULTIPLAYER_DIRECTION §8), and `validateMap` finds no errors (MapMaker's budgets,
 *   in-house content IDs only: unknown ones fail);
 * - it is the version that earned the pick: its content hash is `hash` (as the host announced it, map/identity.ts);
 * - no WHEN/IF/DO loops (`logic.cycle`);
 * - a mode can run, and every spawn point is reachable (the navigation check, as validate-map runs it);
 * - its player-written text passes the word filter.
 */
export async function checkCommunityMap(text: string, hash: string, blocked: readonly string[] = []): Promise<PickCheck> {
  if (Buffer.byteLength(text) > MAX_PICK_BYTES) return { ok: false, reason: 'the map is too large' };
  const played = loadMap(text);
  if (!played.ok) return { ok: false, reason: `it doesn't load: ${played.issues.find((i) => i.severity === 'error')?.message ?? 'invalid'}` };
  const editing = loadMap(text, undefined, { forEditing: true });
  const hashes = [mapIdentity(played.map).contentHash, ...(editing.ok ? [mapIdentity(editing.map).contentHash] : [])];
  if (!hashes.includes(hash)) return { ok: false, reason: "the file's content hash is not the version that earned the pick" };
  const map = played.map;
  if (!isMapId(map.metadata.id)) return { ok: false, reason: 'its map ID is not allowed' };
  const issues = validateMap(map);
  const error = issues.find((i) => i.severity === 'error');
  if (error) return { ok: false, reason: `validation: ${error.message}` };
  const loop = issues.find((i) => i.code === 'logic.cycle');
  if (loop) return { ok: false, reason: `logic loop: ${loop.message}` };
  const modes = playableModes(map);
  if (!modes.length) return { ok: false, reason: 'no mode can run on it' };
  const word = mapTextProblem(JSON.parse(text), blocked);
  if (word) return { ok: false, reason: `a word in its text isn't allowed ("${word.text.slice(0, 60)}")` };
  const { initNavigation, validateMapNavigation } = await import('@tiletrigger/shared/match');
  navReady ??= Promise.all([initPhysics(), initNavigation()]);
  await navReady;
  const nav = validateMapNavigation(map, false).issues.find((i) => NAV_FAILS.has(i.code));
  if (nav) return { ok: false, reason: `spawns: ${nav.message}` };
  const m = map.metadata;
  return { ok: true, name: m.name, description: m.description, modes, recommendedPlayers: m.recommendedPlayers };
}

/**
 * The check in a worker thread, so building a big map's navigation never holds up the hub (signalling, the game
 * browser); it is stopped after CHECK_TIMEOUT_MS. Where a worker can't start, the check runs here.
 */
export function checkInWorker(text: string, hash: string, blocked: readonly string[] = []): Promise<PickCheck> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./communityCheckWorker.mjs', import.meta.url), { workerData: { text, hash, blocked } });
    } catch {
      return void checkCommunityMap(text, hash, blocked).then(resolve, (e: unknown) => resolve({ ok: false, reason: `the check failed: ${(e as Error).message}` }));
    }
    const timer = setTimeout(() => {
      void worker.terminate();
      resolve({ ok: false, reason: 'the check took too long' });
    }, CHECK_TIMEOUT_MS);
    worker.once('message', (r: PickCheck) => {
      clearTimeout(timer);
      void worker.terminate();
      resolve(r);
    });
    worker.once('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, reason: `the check failed: ${e.message}` });
    });
  });
}
