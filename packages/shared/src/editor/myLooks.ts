/**
 * Looks of your own (docs/MAPMAKER_PAINTING_PLAN.md, Phase 5, "Saved looks"; map format v47): a set piece's look as
 * it shows, saved under a name ("Save as my look…"), kept in your browser library and, once a placement uses it, in
 * the map's `lookDefs`, so the map plays anywhere. A look is roles only (question 7a), so it fits any set piece; paint
 * on single parts stays with its placement. The layers stay as they were: the base theme, then the look, then your
 * paint. A role no layer gives is left out of a saved look, so it keeps following the theme: saving and switching to
 * the look never changes how the piece looks (no silent swaps).
 */
import { MAX_MAP_LOOK_DEFS, SET_PIECE_ROLES, type MapDocument, type SetPieceDefinition, type SetPieceLookDef, type SetPiecePlacement, type SetPieceRoleValues } from '../map/schema.ts';
import { piecesFor, placementPack, withMapLooks, type SetPieceLibrary } from '../map/setPieces.ts';
import type { EditCommand } from './commands.ts';

/** Your own looks' ids start with this (shipped role packs never do). */
export const MY_LOOK_PREFIX = 'my_';
export const isMyLook = (id: string | undefined): boolean => !!id?.startsWith(MY_LOOK_PREFIX);

/** `my_<name>` for a display name, free by `taken` (a name taken gets _2, _3…). */
export function lookIdFor(name: string, taken: (id: string) => boolean): string {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 29) || 'look';
  const id = `${MY_LOOK_PREFIX}${slug}`;
  if (!taken(id)) return id;
  for (let i = 2; ; i++) {
    const next = `${MY_LOOK_PREFIX}${slug.slice(0, 29 - String(i).length - 1)}_${i}`;
    if (!taken(next)) return next;
  }
}

/** A display name tidied: trimmed, single spaces, at most 48 characters (empty: null). */
export function lookName(name: string): string | null {
  const n = name.replace(/\s+/g, ' ').trim().slice(0, 48);
  return n || null;
}

/**
 * What a placement's look is now, as roles: each role's value from your paint across the piece, else its look, else
 * the piece's own. A role none of them gives is left out (it follows the theme), so a placement switched to the saved
 * look shows exactly what it showed.
 */
export function placementLookRoles(doc: MapDocument, p: SetPiecePlacement, def: SetPieceDefinition, library: SetPieceLibrary): SetPieceRoleValues {
  const pack = placementPack(p, doc.classicStructure.theme, withMapLooks(doc, library));
  const out: Record<string, unknown> = {};
  for (const role of SET_PIECE_ROLES) {
    const v = p.overrides?.roles?.[role] ?? pack?.roles[role] ?? def.roles?.[role];
    if (v !== undefined) out[role] = v;
  }
  return out as SetPieceRoleValues;
}

/** How many of the map's placements wear a look. */
export const lookUses = (doc: Pick<MapDocument, 'setPieces'>, id: string): number => (doc.setPieces ?? []).filter((p) => p.pack === id).length;

/**
 * The map's looks after `placements` are what they will be, with `look` put in (replacing a copy of the same id): only
 * the looks some placement names stay (a look travels with a map only so its pieces play anywhere). Null: none.
 */
function lookDefsFor(doc: MapDocument, placements: readonly SetPiecePlacement[], look?: SetPieceLookDef): SetPieceLookDef[] | null {
  const used = new Set(placements.map((p) => p.pack));
  const list = (doc.lookDefs ?? []).filter((l) => l.id !== look?.id);
  if (look) list.push(look);
  const out = list.filter((l) => used.has(l.id));
  return out.length ? out : null;
}

/** The commands that make the map's placements `after` (replacing those with the same ids) and its looks fit them. */
function placementsAndLooks(doc: MapDocument, before: SetPiecePlacement[], after: SetPiecePlacement[], look?: SetPieceLookDef): EditCommand | { error: string } {
  const byId = new Map(after.map((p) => [p.id, p]));
  const all = (doc.setPieces ?? []).map((p) => byId.get(p.id) ?? p);
  const looks = lookDefsFor(doc, all, look);
  if ((looks?.length ?? 0) > MAX_MAP_LOOK_DEFS) return { error: `a map holds at most ${MAX_MAP_LOOK_DEFS} looks of its own` };
  const commands: EditCommand[] = [];
  if (JSON.stringify(looks) !== JSON.stringify(doc.lookDefs ?? null)) commands.push({ kind: 'setLookDefs', before: doc.lookDefs ?? null, after: looks });
  if (before.length) commands.push({ kind: 'updateSetPieces', before, after });
  return { kind: 'batch', commands };
}

/**
 * Put placements in a look (`pack`: a shipped role pack, one of your own, or '' for the map theme's). A look of your
 * own goes into the map with them (`look`: its definition; it replaces the map's copy of the same id, so the map's
 * copy matches your library's), and looks nothing wears any more leave the map. Your paint on them stays (it sits
 * above the look). One undo step.
 */
export function applyLookCommand(doc: MapDocument, ids: readonly string[], pack: string, opts: { look?: SetPieceLookDef; library: SetPieceLibrary }): EditCommand | { error: string } {
  const set = new Set(ids);
  const before = (doc.setPieces ?? []).filter((p) => set.has(p.id));
  if (!before.length) return { error: 'select one or more set pieces first' };
  if (isMyLook(pack) && !opts.look && !doc.lookDefs?.some((l) => l.id === pack)) return { error: `the look ${pack} is not in your library or this map` };
  if (pack && !isMyLook(pack) && !opts.library.packs.has(pack)) return { error: `unknown look ${pack}` };
  const after = before.map((p) => {
    const { pack: _old, ...rest } = p;
    void _old;
    return pack ? { ...rest, pack } : rest;
  });
  return placementsAndLooks(doc, before, after, opts.look?.id === pack ? opts.look : undefined);
}

/**
 * Save as my look: placement `id`'s look as it shows (placementLookRoles) under `name`, as look `lookId` (a new one, or
 * one of yours to update: every placement wearing it changes with it). The placement then wears it, its paint across
 * the piece folded into the look (so it shows the same); paint on single parts stays. Returns the look (for your
 * library) and the command (one undo step).
 */
export function saveLookCommand(
  doc: MapDocument,
  id: string,
  name: string,
  lookId: string,
  library: SetPieceLibrary,
): { look: SetPieceLookDef; command: EditCommand } | { error: string } {
  const p = (doc.setPieces ?? []).find((x) => x.id === id);
  if (!p) return { error: `no set piece ${id}` };
  const def = piecesFor(doc, library).get(p.piece);
  if (!def) return { error: `unknown set piece ${p.piece}` };
  const displayName = lookName(name);
  if (!displayName) return { error: 'give the look a name' };
  if (!isMyLook(lookId) || lookId.length > 32 || !/^my_[a-z0-9_]+$/.test(lookId)) return { error: `a look of your own is named my_<name> (not ${lookId})` };
  const look: SetPieceLookDef = { id: lookId, displayName, roles: placementLookRoles(doc, p, def, library) };
  const { roles: _r, ...overrides } = p.overrides ?? {};
  void _r;
  const { overrides: _o, pack: _p, ...rest } = p;
  void _o;
  void _p;
  const after: SetPiecePlacement = { ...rest, pack: lookId, ...(Object.keys(overrides).length ? { overrides } : {}) };
  const command = placementsAndLooks(doc, [p], [after], look);
  return 'error' in command ? command : { look, command };
}

/** Rename a look of your own in this map (its id stays, so placements keep wearing it); null when the map hasn't got it or the name is the same. */
export function renameLookCommand(doc: MapDocument, id: string, name: string): EditCommand | null {
  const displayName = lookName(name);
  const before = doc.lookDefs ?? null;
  if (!displayName || !before?.some((l) => l.id === id && l.displayName !== displayName)) return null;
  return { kind: 'setLookDefs', before, after: before.map((l) => (l.id === id ? { ...l, displayName } : l)) };
}
