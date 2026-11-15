// The selection Mirror (Shift+M, and M's flip in place) and tiles that are their own mirror image across their
// diagonal (the Arena Corner's storeys, octagon phase 2): an exploded corner, its storey tiles and its lights (and the
// gate's portcullis) selected on their own, mirrors exactly as the set piece does, each tile placed turned; one
// command, one undo step.
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  boxCorners,
  buildMapDecor,
  buildMapGeometry,
  coreCatalog,
  explodeSetPieceCommand,
  flipCommand,
  invertCommand,
  loadMap,
  mirrorCommand,
  selectionMiddle,
  serializeMap,
  tileDiagonalMirror,
  tileMirrorTwin,
  type MapDocument,
  type MirrorPlane,
  type Rotation,
  type Selection,
  type WorldBox,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

const TILES = ['core.arena_corner_ground', 'core.arena_corner_mid', 'core.arena_corner_upper', 'core.arena_corner_attic', 'core.arena_corner_ground_gate', 'core.arena_corner_attic_gate', 'core.arena_corner_tower'];

const played = (doc: MapDocument): MapDocument => {
  const r = loadMap(serializeMap(doc));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
};
const ok = <T>(r: T | { error: string }): T => {
  if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error);
  return r as T;
};
const shape = (b: Pick<WorldBox, 'min' | 'max' | 'yaw' | 'pitch' | 'roll' | 'kind'>) =>
  `${b.kind} ${boxCorners(b)
    .map((p) => p.map((v) => (Math.round(v * 1000) / 1000 + 0).toFixed(3)).join(','))
    .sort()
    .join(' ')}`;
/** Everything the map builds and holds, ids aside: boxes, trim, and its things (lights, the portcullis). */
function built(doc: MapDocument) {
  const m = played(doc);
  const things = m.entities
    .filter((e) => e.kind !== 'spawn')
    .map(({ id: _id, ...e }) => JSON.stringify(e, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 + 0 : v)))
    .sort();
  return { boxes: buildMapGeometry(m).map(shape).sort(), decor: buildMapDecor(m).map(shape).sort(), things };
}

function cornerMap(piece: string, rotation: Rotation): MapDocument {
  const map = makeMap([], [[-150, 0, -150]]);
  return { ...map, classicStructure: { ...map.classicStructure, theme: 'core.imperial' }, setPieces: [{ id: 'corner', piece, x: 1, y: -2, z: 0, rotation, mirror: false }] };
}

describe('the selection Mirror and diagonally symmetric tiles', () => {
  it('each Arena Corner tile is itself turned three quarters in a mirror', () => {
    for (const id of TILES) {
      const def = coreCatalog.get(id)!;
      expect(tileDiagonalMirror(def), id).toBe(true);
      expect(tileMirrorTwin(def), id).toEqual({ k: 3, o: [0, 0] });
    }
  });

  for (const piece of ['setpiece.arena_corner', 'setpiece.arena_corner_gate']) {
    it(`an exploded ${piece} mirrors as the set piece does, in every turn and across either line; one undo step`, () => {
      for (const r of [0, 1, 2, 3] as Rotation[]) {
        const doc = cornerMap(piece, r);
        const ex = ok(explodeSetPieceCommand(doc, 'corner'));
        const exploded = applyCommand(doc, ex.command);
        const pieceSel: Selection = { tiles: [], entities: [], setPieces: ['corner'] };
        const mid = selectionMiddle(doc, pieceSel)!;
        for (const plane of [
          { across: 'eastWest', at: mid },
          { across: 'northSouth', at: mid },
          { across: 'eastWest', at: [-84, 0] },
          { across: 'northSouth', at: [0, -84] },
        ] as MirrorPlane[]) {
          // A copy only where it lands clear of the original.
          for (const copy of plane.at === mid ? [false] : [false, true]) {
            const label = `${piece} turned ${r}, ${plane.across} at ${plane.at}${copy ? ', a copy' : ''}`;
            const a = ok(mirrorCommand(doc, pieceSel, plane, { copy, swapTeams: false }));
            const b = ok(mirrorCommand(exploded, ex.selection, plane, { copy, swapTeams: false }));
            const after = applyCommand(exploded, b.command);
            expect(built(after), label).toEqual(built(applyCommand(doc, a.command)));
            // One undo step puts the exploded corner back as it was.
            expect(applyCommand(after, invertCommand(b.command)), label).toEqual(exploded);
          }
        }
      }
    });
  }

  it("M's flip in place turns an exploded corner over onto its own cells, as the set piece flips", () => {
    const doc = cornerMap('setpiece.arena_corner', 1);
    const ex = ok(explodeSetPieceCommand(doc, 'corner'));
    const exploded = applyCommand(doc, ex.command);
    const a = ok(flipCommand(doc, { tiles: [], entities: [], setPieces: ['corner'] }));
    const b = ok(flipCommand(exploded, ex.selection));
    expect(built(applyCommand(exploded, b.command))).toEqual(built(applyCommand(doc, a.command)));
  });
});
