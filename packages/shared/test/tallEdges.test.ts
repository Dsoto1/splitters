import { describe, expect, it } from 'vitest';
import { buildOccupancy, edgeStoreys, setEdgeCommand, tallEdgeIssues, tallEdgeRefusal, type MapDocument, type TilePlacement } from '../src/index.ts';
import { makeMap } from './helpers.ts';

/**
 * Tall wall styles (owner, 2026-11-16: a Grand arch on an inside edge on Level 2 rose through Level 3's floor and the
 * roof): MapMaker refuses one where the storey above has pieces on both sides of the wall, or a roof spans both
 * sides; validation warns on existing ones; an outside wall may still rise past the storey above or a roof.
 */
const TALL = ['arch_grand', 'gate_arch', 'high', 'tower'] as const;

/** Two rooms side by side on Level 1 (x 0 and 1); `above`: rooms over them on these levels; `extra` placements. */
function hall(above: { west?: number[]; east?: number[] } = {}, extra: Partial<TilePlacement> = {}): MapDocument {
  const room = (id: string, x: number, z: number): TilePlacement => ({ id, tile: 'core.room', x, y: 0, z, rotation: 0, ...(id === 'west' ? extra : {}) }) as TilePlacement;
  return makeMap(
    [room('west', 0, 1), room('east', 1, 1), ...(above.west ?? []).map((z) => room(`west${z}`, 0, z)), ...(above.east ?? []).map((z) => room(`east${z}`, 1, z))],
    [[0, 4, 0]],
  );
}
const target = { cell: [0, 0, 1] as [number, number, number], side: 'E' as const };

describe('tall wall styles under a floor or a roof', () => {
  it('the tall styles reach 2 to 4 storeys; the rest one', () => {
    expect(TALL.map((s) => edgeStoreys(s, 4, 4))).toEqual([2, 3, 2, 4]); // the Gate arch's battlements stand over its second storey
    expect(['wall', 'arch_round', 'arch_segmental', 'arch', 'door', 'window'].map((s) => edgeStoreys(s as never, 4, 4))).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('refuses each tall style on an inside wall with rooms over both sides, naming the floor it would cut', () => {
    const doc = hall({ west: [2], east: [2] });
    for (const style of TALL) {
      const cmd = setEdgeCommand(doc, target, style);
      expect('error' in cmd && cmd.error).toMatch(/rise through Level 2's floor/);
      expect(tallEdgeRefusal(doc, target, style)).toMatch(/one-storey style/);
    }
    // One-storey styles go in as ever.
    for (const style of ['arch_round', 'arch_segmental', 'wall'] as const) expect('error' in setEdgeCommand(doc, target, style)).toBe(false);
  });

  it('the Towering wall (4 storeys) is refused when a room is over both sides three levels up', () => {
    const doc = hall({ west: [4], east: [4] });
    expect(tallEdgeRefusal(doc, target, 'tower')).toMatch(/Level 4's floor/);
    expect(tallEdgeRefusal(doc, target, 'arch_grand')).toBeNull();
  });

  it('allows them with the storey above open, or over one side only (an outside wall of the storey above)', () => {
    for (const doc of [hall(), hall({ west: [2] }), hall({ east: [2] })]) for (const style of TALL) expect('error' in setEdgeCommand(doc, target, style)).toBe(false);
  });

  it('a roof over both sides refuses it (its top would stick out of the roof); over one side it is a parapet', () => {
    const roofed = (doc: MapDocument) => ({ ...doc, classicStructure: { ...doc.classicStructure, tiles: doc.classicStructure.tiles.map((t) => ({ ...t, options: { ...(t.options ?? {}), ceiling: 'roof' as const } })) } });
    expect(tallEdgeRefusal(roofed(hall()), target, 'arch_grand')).toMatch(/the roof over Level 1/);
    const oneRoof = hall({}, { options: { ceiling: 'roof' } } as Partial<TilePlacement>);
    expect(tallEdgeRefusal(oneRoof, target, 'arch_grand')).toBeNull();
  });

  it('validation warns on an existing one (edge.tall), once per wall, and not when it stands clear', () => {
    const stored = (doc: MapDocument): MapDocument => ({ ...doc, classicStructure: { ...doc.classicStructure, tiles: doc.classicStructure.tiles.map((t) => (t.id === 'west' ? { ...t, edges: { '0,0,0:E': 'arch_grand' } } : t)) } });
    const bad = tallEdgeIssues(stored(hall({ west: [2], east: [2] })));
    expect(bad.map((i) => [i.code, i.severity, i.targetId])).toEqual([['edge.tall', 'warning', 'west']]);
    expect(bad[0]!.message).toMatch(/Grand arch .* rises through Level 2's floor/);
    expect(tallEdgeIssues(stored(hall()))).toEqual([]);
    expect(buildOccupancy(stored(hall())).cells.size).toBeGreaterThan(0);
  });
});
