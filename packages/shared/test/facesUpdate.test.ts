// updateVisibleFaces (MapMaker's faces kept between edits): after any edit it gives the faces a full pass gives.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMapDecor, buildMapGeometry, loadMap, updateVisibleFaces, visibleFaces, type FaceCache, type RenderFace, type WorldBox } from '../src/index.ts';

const MAPS = new URL('../../../maps/', import.meta.url);
const drawnBoxes = (id: string): WorldBox[] => {
  const loaded = loadMap(readFileSync(new URL(`${id}.json`, MAPS), 'utf8'));
  if (!loaded.ok) throw new Error(`${id} failed to load`);
  return [...buildMapGeometry(loaded.map), ...buildMapDecor(loaded.map)];
};

/** A seeded generator (mulberry32). */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const r = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
/** A face as text, whatever corner it starts at; a list of faces as sorted text. */
const faceText = (f: RenderFace) => {
  const pts = f.corners.map((p) => p.map(r).join(','));
  const flat = f.flat.map((p) => p.map(r).join(','));
  const start = pts.indexOf([...pts].sort()[0]!);
  const turn = <T,>(l: T[]) => [...l.slice(start), ...l.slice(0, start)];
  return `${f.box}|${f.normal.map(r).join(',')}|${turn(pts).join(' ')}|${turn(flat).join(' ')}|${f.flatNormal.map(r).join(',')}`;
};
const text = (faces: readonly RenderFace[]) => faces.map(faceText).sort();

const box = (min: [number, number, number], max: [number, number, number], kind: WorldBox['kind'] = 'wall', extra: Partial<WorldBox> = {}): WorldBox => ({ min, max, kind, sourceId: 't', ...extra });
const moved = (b: WorldBox, d: [number, number, number]): WorldBox => ({ ...b, min: [b.min[0] + d[0], b.min[1] + d[1], b.min[2] + d[2]], max: [b.max[0] + d[0], b.max[1] + d[1], b.max[2] + d[2]] });

describe('updateVisibleFaces', () => {
  it('starts with a full pass, and returns the same cache for the same list', () => {
    const boxes = [box([0, 0, 0], [4, 0.5, 4], 'floor'), box([0, 0.5, 0], [0.3, 3, 4])];
    const c = updateVisibleFaces(null, boxes);
    expect(c.full).toBe(true);
    expect(text(c.faces)).toEqual(text(visibleFaces(boxes)));
    expect(updateVisibleFaces(c, boxes)).toBe(c);
  });

  it('clips only the boxes near a move, and uncovers what the moved box hid', () => {
    const floor = box([0, 0, 0], [40, 0.5, 4], 'floor');
    const walls = Array.from({ length: 40 }, (_, i) => box([i, 0.5, 0], [i + 0.3, 3, 4]));
    const crate = box([0.3, 0.5, 1], [1, 1.5, 2], 'solid');
    const a = [floor, ...walls, crate];
    const before = updateVisibleFaces(null, a);
    const b = [floor, ...walls, moved(crate, [20, 0, 0])];
    const after = updateVisibleFaces(before, b);
    expect(after.full).toBe(false);
    // The crate, the floor under it and the walls it touched or touches: not the other 36.
    expect(after.redone).toBeLessThan(8);
    expect(text(after.faces)).toEqual(text(visibleFaces(b)));
  });

  it('keeps every face when only props, barriers or the order of what draws nothing changed', () => {
    const a = [box([0, 0, 0], [4, 0.5, 4], 'floor'), box([1, 0.5, 1], [2, 1.5, 2], 'prop'), box([0, 0.5, 0], [0.3, 3, 4])];
    const before = updateVisibleFaces(null, a);
    const b = [box([3, 0.5, 3], [3.5, 1, 3.5], 'prop'), a[0]!, a[2]!, box([-1, 0, -1], [0, 9, 5], 'barrier')];
    const after = updateVisibleFaces(before, b);
    expect(after.redone).toBe(0);
    expect(after.changed).toBe(false);
    expect(text(after.faces)).toEqual(text(visibleFaces(b)));
  });

  it('says the faces changed when a box that touched nothing is taken away', () => {
    const a = [box([0, 0, 0], [1, 1, 1]), box([10, 0, 0], [11, 1, 1]), ...Array.from({ length: 12 }, (_, i) => box([30 + i * 3, 0, 0], [31 + i * 3, 1, 1]))];
    const b = a.slice(1);
    const after = updateVisibleFaces(updateVisibleFaces(null, a), b);
    expect(after.full).toBe(false);
    expect(after.changed).toBe(true);
    expect(text(after.faces)).toEqual(text(visibleFaces(b)));
  });

  it('falls back to a full pass when much changed', () => {
    const a = Array.from({ length: 30 }, (_, i) => box([i * 2, 0, 0], [i * 2 + 1, 1, 1]));
    const b = a.map((x, i) => (i % 2 ? moved(x, [0, 0, 5]) : x));
    const after = updateVisibleFaces(updateVisibleFaces(null, a), b);
    expect(after.full).toBe(true);
    expect(text(after.faces)).toEqual(text(visibleFaces(b)));
  });

  // The maps MapMaker was slow on (free blocks by the thousand, many turned), and one built from tiles with trim.
  for (const id of ['st_johns', 'iron_maw', 'test_coverage']) {
    it(`matches a full pass after each of a run of edits on ${id}`, () => {
      let boxes = drawnBoxes(id);
      let cache: FaceCache = updateVisibleFaces(null, boxes);
      const rand = rng(id.length * 7919);
      const pick = () => Math.floor(rand() * boxes.length);
      const step = () => Math.round((rand() * 4 - 2) * 4) / 4;
      for (let n = 0; n < 8; n++) {
        const next = [...boxes];
        const kind = n % 4;
        if (kind === 0 || kind === 1) {
          // A move: by quarter metres (flush with its neighbours again, often), sometimes up or down.
          const i = pick();
          next[i] = moved(next[i]!, [step(), n % 3 ? 0 : step(), step()]);
        } else if (kind === 2) next.splice(pick(), 1);
        else {
          // A copy set down beside its original, later in the list (as a paste is), and a resize.
          const i = pick();
          next.push(moved({ ...next[i]!, sourceId: `copy${n}` }, [0.5, 0, 0.5]));
          const j = pick();
          next[j] = { ...next[j]!, max: [next[j]!.max[0] + 0.5, next[j]!.max[1], next[j]!.max[2]] };
        }
        cache = updateVisibleFaces(cache, next);
        boxes = next;
        expect(cache.full, `edit ${n}`).toBe(false);
        expect(text(cache.faces), `edit ${n}`).toEqual(text(visibleFaces(boxes)));
      }
    }, 120_000);
  }
});
