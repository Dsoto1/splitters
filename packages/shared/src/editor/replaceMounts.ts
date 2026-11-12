import type { MapDocument, MapEntity, MapPath } from '../map/schema.ts';
import { aliasedMount, aliasedPath } from '../map/mountAliases.ts';
import { liveMount, type MountModel, type RetiredMountModel } from '../sim/mounts.ts';
import type { EditCommand } from './commands.ts';

/**
 * MapMaker's "Replace all" for a retired vehicle (map/mountAliases.ts): every use of `from` on the map becomes `to`
 * (default: the vehicle it already plays as) in one undo step. Placed ones keep their id, position, facing, team,
 * paint and respawn time. With the replacement it plays as, the track's cars and its old race vehicle change too
 * (they name it as well; with another vehicle chosen only the placed ones change: a track has its own list of
 * vehicles). Returns the command and how many of each changed; nothing to do: `placed` and `tracks` both 0.
 */
export function replaceRetiredMountCommand(doc: MapDocument, from: RetiredMountModel, to: MountModel = liveMount(from)): { command: EditCommand; placed: number; tracks: number } {
  const before: MapEntity[] = [];
  const after: MapEntity[] = [];
  for (const e of doc.entities) {
    if (e.kind !== 'mount' || e.model !== from) continue;
    before.push(e);
    after.push({ ...aliasedMount(e), model: to });
  }
  const commands: EditCommand[] = [];
  if (after.length) commands.push({ kind: 'updateEntities', before, after });
  let tracks = 0;
  if (to === liveMount(from) && doc.paths?.length) {
    const paths: MapPath[] = doc.paths.map((p) => {
      if (p.race?.vehicle !== from && p.race?.ambientVehicle !== from) return p;
      tracks++;
      // Only `from`: another retired vehicle the track names keeps its own Replace all.
      const next = aliasedPath(p);
      return { ...p, race: { ...p.race, vehicle: p.race.vehicle === from ? next.race!.vehicle : p.race.vehicle, ambientVehicle: p.race.ambientVehicle === from ? next.race!.ambientVehicle : p.race.ambientVehicle } };
    });
    if (tracks) commands.push({ kind: 'setPaths', before: doc.paths, after: paths });
  }
  return { command: commands.length === 1 ? commands[0]! : { kind: 'batch', commands }, placed: after.length, tracks };
}
