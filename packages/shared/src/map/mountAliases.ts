/**
 * Retired vehicles in maps (sim/mounts.ts RETIRED_MOUNTS: the Go-Kart and the Ice Cream Truck, owner 2026-11-12;
 * the Buggy's id, owner 2026-11-13).
 * The same idea as retired props (propAliases.ts) and tiles (setPieceAliases.ts):
 *
 * - A map file that names one is still valid as written: the schema accepts the retired ids on a placed `mount` and
 *   as a track's `vehicle` / `ambientVehicle`, so the file's release hash is still the file's and nothing about a
 *   saved, community or published map changes on disk.
 * - As played, loadMap gives each the vehicle that replaced it (`withMountAliases`): a placed one keeps its id,
 *   position, facing, team, paint and respawn time; a track's NPC cars are the replacement.
 * - MapMaker opens the map as made (it draws and describes a retired vehicle as its replacement), says so in the
 *   inspector and in its checks (`mount.retired`), and offers "Replace all", so an exported map names the new
 *   vehicle. The shipped maps were changed that way.
 * Not a format change: no field is added, and a map that names neither is untouched.
 */
import { RETIRED_MOUNT_NAMES, getMountDef, isRetiredMount, liveMount, type RetiredMountModel } from '../sim/mounts.ts';
import type { MapDocument, MapEntity, MapPath } from './schema.ts';

/** The entity with a retired vehicle swapped for its replacement (the entity itself otherwise). */
export function aliasedMount<E extends MapEntity>(e: E): E {
  return e.kind === 'mount' && isRetiredMount(e.model) ? { ...e, model: liveMount(e.model) } : e;
}

/** The path with its track's retired vehicles swapped for their replacements (the path itself otherwise). */
export function aliasedPath<P extends MapPath>(p: P): P {
  const r = p.race;
  if (!r || (!isRetiredMount(r.vehicle) && !isRetiredMount(r.ambientVehicle))) return p;
  return { ...p, race: { ...r, vehicle: liveMount(r.vehicle), ambientVehicle: liveMount(r.ambientVehicle) } };
}

/** Where a map names retired vehicles: the placed ones (entity ids) and the track paths (path ids), by retired id. */
export function retiredMountUses(doc: Pick<MapDocument, 'entities' | 'paths'>): { model: RetiredMountModel; entities: string[]; paths: string[] }[] {
  const by = new Map<RetiredMountModel, { model: RetiredMountModel; entities: string[]; paths: string[] }>();
  const of = (model: RetiredMountModel) => by.get(model) ?? (by.set(model, { model, entities: [], paths: [] }), by.get(model)!);
  for (const e of doc.entities) if (e.kind === 'mount' && isRetiredMount(e.model)) of(e.model).entities.push(e.id);
  for (const p of doc.paths ?? []) for (const v of new Set([p.race?.vehicle, p.race?.ambientVehicle])) if (isRetiredMount(v)) of(v).paths.push(p.id);
  return [...by.values()];
}

/** The map with every retired vehicle it names replaced (the map itself when it names none). */
export function withMountAliases<T extends MapDocument>(doc: T): T {
  if (!retiredMountUses(doc).length) return doc;
  return { ...doc, entities: doc.entities.map(aliasedMount), ...(doc.paths ? { paths: doc.paths.map(aliasedPath) } : {}) };
}

/** MapMaker's checks: a warning for each retired vehicle the map still names (it plays as the replacement). */
export function retiredMountIssues(doc: Pick<MapDocument, 'entities' | 'paths'>): { severity: 'warning'; code: string; message: string; targetId?: string }[] {
  return retiredMountUses(doc).map((u) => {
    const where = [u.entities.length ? `${u.entities.length} placed` : '', u.paths.length ? `the track's cars (${u.paths.join(', ')})` : ''].filter(Boolean).join(' and ');
    const first = u.entities[0];
    return { severity: 'warning' as const, code: 'mount.retired', message: `the ${RETIRED_MOUNT_NAMES[u.model]} is retired (${where}): it plays as the ${getMountDef(u.model)!.displayName}. Replace all (the vehicle's inspector, or the track's pane) to keep that in the map`, ...(first ? { targetId: first } : {}) };
  });
}
