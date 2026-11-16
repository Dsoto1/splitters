import type { MapDocument } from '../map/schema.ts';
import { withGroups } from './groups.ts';
import { withMoverGroups, type Selection } from './operations.ts';
import { pickableSelection } from './outliner.ts';

/**
 * MapMaker's one selection (MapMaker UI spec Phase 2; docs/MAPMAKER_UI_AUDIT.md §4). The viewport, the outliner, the
 * inspector, the status bar and the plan view all read `EditorApp.selection`; every write goes through
 * `EditorApp.setSelection` (which bumps `selectionRev`, so a view redraws on a change of number rather than comparing
 * ids). These are its rules, kept pure:
 *
 * - `wholeSelection`: what a pick becomes, wherever it came from (a click in the view, the outliner, a problem's
 *   "select", the budget pill): whole groups and whole moving builds, locked things left out. `single` (Alt) keeps just
 *   what was picked.
 * - `pruneSelection`: after an edit, ids the map no longer has are dropped (and nothing else changes); the same object
 *   comes back when nothing went, so nothing redraws.
 * - A level change keeps the selection (the owner's answer 6); the status bar says how many are on other levels.
 */

/** A pick made whole: groups and moving builds (unless `single`), without what `blocked` holds (the outliner's locks). */
export function wholeSelection(doc: MapDocument, sel: Selection, opts: { single?: boolean; blocked?: ReadonlySet<string> } = {}): Selection {
  let out = sel;
  if (!opts.single) {
    // A moving build is picked whole, as a click on any part picks it (Alt: one part); then the groups any of it is in.
    const ents = withMoverGroups(doc, sel.entities);
    if (ents.length !== sel.entities.length) out = { ...sel, entities: ents };
    out = withGroups(doc, out);
    const again = withMoverGroups(doc, out.entities);
    if (again.length !== out.entities.length) out = withGroups(doc, { ...out, entities: again });
  }
  return opts.blocked ? pickableSelection(out, opts.blocked) : out;
}

/** The selection without ids the document no longer has: the same object when every id is still there. */
export function pruneSelection(doc: MapDocument, sel: Selection): Selection {
  const has = (list: readonly string[], ids: ReadonlySet<string>) => list.every((id) => ids.has(id));
  const tiles = new Set(doc.classicStructure.tiles.map((t) => t.id));
  const entities = new Set(doc.entities.map((e) => e.id));
  const pieces = new Set((doc.setPieces ?? []).map((p) => p.id));
  if (has(sel.tiles, tiles) && has(sel.entities, entities) && has(sel.setPieces ?? [], pieces)) return sel;
  const setPieces = (sel.setPieces ?? []).filter((id) => pieces.has(id));
  return { tiles: sel.tiles.filter((id) => tiles.has(id)), entities: sel.entities.filter((id) => entities.has(id)), ...(setPieces.length ? { setPieces } : {}) };
}

/** Two selections of the same ids in the same order. */
export function sameSelection(a: Selection, b: Selection): boolean {
  const eq = (x: readonly string[], y: readonly string[]) => x.length === y.length && x.every((v, i) => v === y[i]);
  return eq(a.tiles, b.tiles) && eq(a.entities, b.entities) && eq(a.setPieces ?? [], b.setPieces ?? []);
}
