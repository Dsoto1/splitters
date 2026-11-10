// MapMaker overhaul Phase 2 item 3 (docs/MAPMAKER_OVERHAUL_PLAN.md): the outliner's list, its search and groups, the
// virtualised window, and hide and lock (editor-only flags, never in the map file).
import { describe, expect, it } from 'vitest';
import {
  entityLabel,
  newMapDocument,
  outlineEntries,
  outlineRows,
  outlineWindow,
  parseOutlinerFlags,
  pickableSelection,
  toggleOutlinerFlag,
  withoutHidden,
  type MapDocument,
  type MapEntity,
} from '../src/index.ts';

const prop = (id: string, model: string, y = 0): MapEntity => ({ id, kind: 'prop', position: [0, y, 0], model, yaw: 0, scale: 1, solid: true, tint: null });

function scene(): MapDocument {
  const doc = newMapDocument('Outline');
  return {
    ...doc,
    classicStructure: { ...doc.classicStructure, tiles: [{ id: 't0', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }, { id: 't1', tile: 'core.corridor', x: 1, y: 0, z: 1, rotation: 0 }] },
    entities: [{ id: 's0', kind: 'spawn', position: [0, 0, 0], yaw: 0, faction: null }, prop('p0', 'prop.barrel'), prop('p1', 'prop.barrel', 4), prop('p2', 'prop.metal_crate')],
    setPieces: [{ id: 'sp0', piece: 'core.sp.gatehouse', x: 4, y: 4, z: 0, rotation: 0, mirror: false }],
  };
}

describe('outliner entries', () => {
  it('lists every tile, set piece and entity once, named as the inspector names them, on its level', () => {
    const doc = scene();
    const entries = outlineEntries(doc, (p) => `Piece ${p}`);
    expect(entries.map((e) => e.id).sort()).toEqual(['p0', 'p1', 'p2', 's0', 'sp0', 't0', 't1']);
    for (const e of doc.entities) expect(entries.find((x) => x.id === e.id)!.name).toBe(entityLabel(doc, e));
    expect(entries.find((e) => e.id === 't1')).toMatchObject({ kind: 'tile', group: 'Tiles', level: 1 });
    expect(entries.find((e) => e.id === 'sp0')).toMatchObject({ kind: 'setpiece', group: 'Set pieces', name: 'Piece core.sp.gatehouse' });
    expect(entries.find((e) => e.id === 'p1')).toMatchObject({ group: 'Props', level: 1 });
  });

  it('groups by kind, then by level where a kind spans more than one; folds and searches', () => {
    const entries = outlineEntries(scene());
    const rows = outlineRows(entries);
    const heads = rows.filter((r) => r.type === 'group').map((r) => (r.type === 'group' ? `${r.label} ${r.count}` : ''));
    expect(heads).toEqual(['Tiles 2', 'Set pieces 1', 'Spawns 1', 'Props 3']);
    // Props are on two levels: a level heading each.
    expect(rows.filter((r) => r.type === 'level' && r.key.startsWith('g:Props')).length).toBe(2);
    // Folded shut: the heading stays, its rows go.
    const folded = outlineRows(entries, { closed: new Set(['g:Props']) });
    expect(folded.some((r) => r.type === 'item' && r.entry.group === 'Props')).toBe(false);
    expect(folded.find((r) => r.type === 'group' && r.label === 'Props')).toMatchObject({ open: false, count: 3 });
    // Search: every word must match; it opens folded groups.
    const found = outlineRows(entries, { query: 'barrel 2', closed: new Set(['g:Props']) }).filter((r) => r.type === 'item');
    expect(found.map((r) => (r.type === 'item' ? r.entry.id : ''))).toEqual(['p1']);
  });

  it('stays quick with 4,096 entities, and the window draws only the rows in view', () => {
    const doc = scene();
    const many: MapDocument = { ...doc, entities: Array.from({ length: 4096 }, (_, i) => prop(`p${i}`, i % 2 ? 'prop.barrel' : 'prop.metal_crate', (i % 4) * 4)) };
    const t0 = performance.now();
    const rows = outlineRows(outlineEntries(many), { query: '' });
    const searched = outlineRows(outlineEntries(many), { query: 'metal crate' });
    const ms = performance.now() - t0;
    expect(rows.length).toBeGreaterThan(4096);
    expect(searched.filter((r) => r.type === 'item').length).toBe(2048);
    expect(ms).toBeLessThan(500);
    const w = outlineWindow(2200, 400, 22, rows.length);
    expect(w.end - w.start).toBeLessThanOrEqual(Math.ceil(400 / 22) + 16);
    expect(w.start).toBe(100 - 8);
    expect(outlineWindow(-50, 400, 22, 5)).toEqual({ start: 0, end: 5 });
  });
});

describe('hide and lock', () => {
  it('are read back safely and toggled per id, dropping ids no longer in the map', () => {
    expect(parseOutlinerFlags(null)).toEqual({ hidden: [], locked: [] });
    expect(parseOutlinerFlags('{bad')).toEqual({ hidden: [], locked: [] });
    expect(parseOutlinerFlags(JSON.stringify({ hidden: ['a', 'a', 3], locked: 'x' }))).toEqual({ hidden: ['a'], locked: [] });
    let f = toggleOutlinerFlag({ hidden: [], locked: ['gone'] }, 'hidden', ['p0', 'p1'], true, new Set(['p0', 'p1']));
    expect(f).toEqual({ hidden: ['p0', 'p1'], locked: [] });
    f = toggleOutlinerFlag(f, 'hidden', ['p0'], false);
    expect(f.hidden).toEqual(['p1']);
  });

  it('hidden things are left out of what MapMaker draws, a set piece with its parts; the document is untouched', () => {
    const doc = scene();
    expect(withoutHidden(doc, new Set())).toBe(doc);
    const parts = new Map([['part_tile', 'sp0']]);
    const view: MapDocument = { ...doc, classicStructure: { ...doc.classicStructure, tiles: [...doc.classicStructure.tiles, { id: 'part_tile', tile: 'core.room', x: 4, y: 4, z: 0, rotation: 0 }] } };
    const shown = withoutHidden(view, new Set(['t0', 'p2', 'sp0']), parts);
    expect(shown.classicStructure.tiles.map((t) => t.id)).toEqual(['t1']);
    expect(shown.entities.map((e) => e.id)).toEqual(['s0', 'p0', 'p1']);
    expect(shown.setPieces).toEqual([]);
    expect(view.classicStructure.tiles.length).toBe(3);
  });

  it('locked and hidden things drop out of a selection', () => {
    expect(pickableSelection({ tiles: ['t0', 't1'], entities: ['p0'], setPieces: ['sp0'] }, new Set(['t0', 'sp0']))).toEqual({ tiles: ['t1'], entities: ['p0'] });
  });
});
