import type { MapDocument, MapGroup } from '../map/schema.ts';
import { newId, applyCommand, type EditCommand } from './commands.ts';
import type { Selection } from './operations.ts';

/**
 * MapMaker's groups (map format v31; docs/MAPMAKER_OVERHAUL_PLAN.md, Phase 3 item 3): a few of the map's own tiles,
 * entities and set-piece placements kept together while editing. Clicking any member selects the whole group (as a
 * set piece or a moving build is picked whole; Alt-click picks one member), so moving, turning, mirroring, duplicating
 * and deleting work on it as one through the ordinary selection commands. A thing is in one group at most. Groups
 * belong to one map (set pieces are the kind that travel between maps) and play ignores them.
 */

/** The name MapMaker shows for a group. */
export const groupName = (g: Pick<MapGroup, 'name'>): string => g.name ?? 'Group';

/** Every id the selection names (tiles, entities, set pieces). */
export const selectionIds = (sel: Selection): string[] => [...sel.tiles, ...sel.entities, ...(sel.setPieces ?? [])];

/** The group a thing is in, or null. */
export function groupOf(doc: Pick<MapDocument, 'groups'>, id: string): MapGroup | null {
  for (const g of doc.groups ?? []) if (g.members.includes(id)) return g;
  return null;
}

/** What kind of thing an id is in the document (null: none of the map's own). */
export function memberKind(doc: MapDocument, id: string): 'tile' | 'entity' | 'setPiece' | null {
  if (doc.classicStructure.tiles.some((t) => t.id === id)) return 'tile';
  if (doc.entities.some((e) => e.id === id)) return 'entity';
  if (doc.setPieces?.some((p) => p.id === id)) return 'setPiece';
  return null;
}

/** A selection of these ids, each in its own list (ids the map doesn't have are left out). */
export function selectionOf(doc: MapDocument, ids: Iterable<string>): Selection {
  const want = new Set(ids);
  const tiles = doc.classicStructure.tiles.filter((t) => want.has(t.id)).map((t) => t.id);
  const entities = doc.entities.filter((e) => want.has(e.id)).map((e) => e.id);
  const setPieces = (doc.setPieces ?? []).filter((p) => want.has(p.id)).map((p) => p.id);
  return { tiles, entities, ...(setPieces.length ? { setPieces } : {}) };
}

/** The selection with the whole of every group any of it is in (the selection itself when no group is touched). */
export function withGroups(doc: MapDocument, sel: Selection): Selection {
  if (!doc.groups?.length) return sel;
  const ids = new Set(selectionIds(sel));
  let grew = false;
  for (const g of doc.groups) {
    if (!g.members.some((m) => ids.has(m))) continue;
    for (const m of g.members) if (!ids.has(m)) {
      ids.add(m);
      grew = true;
    }
  }
  if (!grew) return sel;
  // Keep the order things were picked in, the group's other members after.
  const out = selectionOf(doc, ids);
  const order = (list: readonly string[], first: readonly string[]) => [...first.filter((id) => list.includes(id)), ...list.filter((id) => !first.includes(id))];
  const setPieces = order(out.setPieces ?? [], sel.setPieces ?? []);
  return { tiles: order(out.tiles, sel.tiles), entities: order(out.entities, sel.entities), ...(setPieces.length ? { setPieces } : {}) };
}

/** The groups the selection holds whole. */
export function selectedGroups(doc: MapDocument, sel: Selection): MapGroup[] {
  const ids = new Set(selectionIds(sel));
  return (doc.groups ?? []).filter((g) => g.members.every((m) => ids.has(m)));
}

/** The one group the selection is exactly (all of it, nothing else), or null. */
export function selectionGroup(doc: MapDocument, sel: Selection): MapGroup | null {
  const ids = selectionIds(sel);
  const g = ids.length ? groupOf(doc, ids[0]!) : null;
  return g && g.members.length === ids.length && ids.every((id) => g.members.includes(id)) ? g : null;
}

const setGroups = (doc: MapDocument, after: MapGroup[]): EditCommand => ({ kind: 'setGroups', before: doc.groups ?? null, after: after.length ? after : null });

/**
 * Group the selection (Ctrl+G): one new group of everything selected and the whole of any group it touches (those
 * groups make way for it). Needs two things or more.
 */
export function groupCommand(doc: MapDocument, sel: Selection, name?: string): { command: EditCommand; group: MapGroup } | { error: string } {
  const members = selectionIds(withGroups(doc, sel)).filter((id) => memberKind(doc, id));
  if (members.length < 2) return { error: 'select two things or more to group them' };
  if (selectionGroup(doc, selectionOf(doc, members))) return { error: 'that is a group already' };
  const taken = new Set(members);
  const kept = (doc.groups ?? []).filter((g) => !g.members.some((m) => taken.has(m)));
  const label = name?.trim().slice(0, 40);
  const group: MapGroup = { id: newId('group'), ...(label ? { name: label } : {}), members };
  return { command: setGroups(doc, [...kept, group]), group };
}

/** Ungroup (Ctrl+Shift+G): every group the selection touches goes (its things stay as they are, selected). */
export function ungroupCommand(doc: MapDocument, sel: Selection): { command: EditCommand; count: number } | { error: string } {
  const ids = new Set(selectionIds(sel));
  const gone = (doc.groups ?? []).filter((g) => g.members.some((m) => ids.has(m)));
  if (!gone.length) return { error: 'nothing selected is in a group' };
  return { command: setGroups(doc, (doc.groups ?? []).filter((g) => !gone.includes(g))), count: gone.length };
}

/** Rename a group (blank: back to "Group"). */
export function renameGroupCommand(doc: MapDocument, id: string, name: string): EditCommand | { error: string } {
  const g = doc.groups?.find((x) => x.id === id);
  if (!g) return { error: 'no such group' };
  const label = name.trim().slice(0, 40);
  const { name: _old, ...rest } = g;
  const next: MapGroup = label ? { ...rest, name: label } : rest;
  return setGroups(doc, doc.groups!.map((x) => (x.id === id ? next : x)));
}

/**
 * The groups again for copies (duplicate, paste, a mirrored copy): every group whose members were all copied gets a
 * twin of the copies (a new id), so a duplicated group is a group too. `idMap`: each original's copy.
 */
export function copiedGroups(groups: readonly MapGroup[] | undefined, idMap: ReadonlyMap<string, string>): MapGroup[] {
  return (groups ?? []).filter((g) => g.members.every((m) => idMap.has(m))).map((g) => ({ ...g, id: newId('group'), members: g.members.map((m) => idMap.get(m)!) }));
}

/** The command adding these groups (none: null). */
export function addGroupsCommand(doc: MapDocument, groups: readonly MapGroup[]): EditCommand | null {
  return groups.length ? setGroups(doc, [...(doc.groups ?? []), ...groups]) : null;
}

/**
 * Groups kept tidy: members the map no longer has are dropped (deleted, erased, exploded), and a group left with one
 * thing or none goes. Null when nothing needs it.
 */
export function tidyGroupsCommand(doc: MapDocument): EditCommand | null {
  if (!doc.groups?.length) return null;
  const have = new Set([...doc.classicStructure.tiles.map((t) => t.id), ...doc.entities.map((e) => e.id), ...(doc.setPieces ?? []).map((p) => p.id)]);
  let changed = false;
  const after: MapGroup[] = [];
  for (const g of doc.groups) {
    const members = g.members.filter((m) => have.has(m));
    if (members.length !== g.members.length) changed = true;
    if (members.length >= 2) after.push(members.length === g.members.length ? g : { ...g, members });
  }
  return changed ? setGroups(doc, after) : null;
}

/** A command with the groups tidied after it, in the same undo step (MapMaker runs every edit through this). */
export function withGroupsTidied(doc: MapDocument, cmd: EditCommand): EditCommand {
  if (!doc.groups?.length) return cmd;
  const tidy = tidyGroupsCommand(applyCommand(doc, cmd));
  return tidy ? { kind: 'batch', commands: [cmd, tidy] } : cmd;
}

/** Each original's copy, paired up in order (copies are listed in the originals' document order). */
export function copyPairs(from: Selection, to: Selection): Map<string, string> {
  const idMap = new Map<string, string>();
  const pair = (a: readonly string[], b: readonly string[]) => a.forEach((id, i) => b[i] !== undefined && idMap.set(id, b[i]!));
  pair(from.tiles, to.tiles);
  pair(from.entities, to.entities);
  pair(from.setPieces ?? [], to.setPieces ?? []);
  return idMap;
}

/**
 * A duplicate (duplicateCommand's result) with its groups copied too: the copies of a whole group make a group of
 * their own.
 */
export function withCopiedGroups(doc: MapDocument, sel: Selection, r: { command: EditCommand; selection: Selection }): { command: EditCommand; selection: Selection } {
  if (!doc.groups?.length) return r;
  const idMap = copyPairs(selectionOf(doc, selectionIds(sel)), r.selection);
  const add = addGroupsCommand(applyCommand(doc, r.command), copiedGroups(doc.groups, idMap));
  return add ? { command: { kind: 'batch', commands: [r.command, add] }, selection: r.selection } : r;
}
