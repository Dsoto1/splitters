import { beforeAll, describe, expect, it } from 'vitest';
import {
  ELECTRIC_FENCE,
  PROP_FENCES,
  PROP_FENCE_OFFSET,
  PhysicsWorld,
  getProp,
  borderBoxes,
  borderEdges,
  borderRect,
  borderStyleAt,
  borderStyles,
  boxBounds,
  buildMapGeometry,
  newMapDocument,
  initPhysics,
  loadMap,
  validateMap,
  type BorderStyle,
  type GameEvent,
  type MapDocument,
  type MapEntity,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const EAST = Math.PI / 2;

/** One room in the middle of a 40 × 40 m boundary, with a border round it. */
function bordered(border: BorderStyle, sides?: NonNullable<MapDocument['backdrop']>['borderSides'], entities: MapEntity[] = []): MapDocument {
  const map = makeMap([{ id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-2, 0, 0]]);
  map.bounds = { min: [-20, -20], max: [20, 20], style: 'invisible', height: 8 };
  map.backdrop = { sky: 'clear', scenery: 'hills', ground: 'grass', haze: 0.5, border, ...(sides ? { borderSides: sides } : {}) };
  map.entities.push(...entities);
  return map;
}

class Driver {
  seq = 0;
  readonly events: GameEvent[] = [];
  constructor(
    readonly match: Match,
    readonly me: Combatant,
  ) {}

  run(ticks: number, over: Partial<PlayerInput> = {}): void {
    for (let i = 0; i < ticks; i++) {
      this.match.queueInputs(this.me.slot, [{ seq: ++this.seq, forward: 0, right: 0, yaw: this.me.yaw, pitch: 0, buttons: 0, ...over }]);
      this.events.push(...this.match.step());
    }
  }

  place(x: number, z: number, yaw: number): void {
    this.me.move = { pos: { x, y: 0, z }, velY: 0, grounded: true };
    this.me.yaw = yaw;
  }
}

function start(map: MapDocument): Driver {
  const loaded = loadMap(map);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
  const match = new Match(loaded.map, undefined, 3);
  const d = new Driver(match, match.addHuman('me')!);
  d.run(2);
  return d;
}

describe('border layout', () => {
  it('follows the boundary rectangle, one edge per bordered side, pointing out', () => {
    const edges = borderEdges(bordered('cliffs'));
    expect(edges.map((e) => e.side).sort()).toEqual(['east', 'north', 'south', 'west']);
    for (const e of edges) {
      expect(e.length).toBe(40);
      // Both ends on the rectangle, the normal pointing away from its centre.
      for (const [x, z] of [e.a, e.b]) expect(Math.max(Math.abs(x), Math.abs(z))).toBe(20);
      const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
      expect(mid[0]! * e.out[0] + mid[1]! * e.out[1]).toBe(20);
    }
  });

  it('mixes styles per side, and a side set to none has no border', () => {
    const map = bordered('cliffs', { south: 'water', east: 'fence', west: 'none' });
    expect(borderStyles(map)).toEqual({ north: 'cliffs', east: 'fence', south: 'water', west: 'none' });
    expect(borderEdges(map).map((e) => `${e.side}:${e.style}`).sort()).toEqual(['east:fence', 'north:cliffs', 'south:water']);
    expect(borderStyleAt(map, 0, 40)).toBe('cliffs');
    expect(borderStyleAt(map, 0, -40)).toBe('water');
    expect(borderStyleAt(map, 35, 3)).toBe('fence');
    expect(borderStyleAt(map, 0, 0)).toBe('none');
  });

  it('stands along the terrain edge when the map has no bounds', () => {
    const map = newMapDocument('T');
    map.terrain = { origin: [-30, -10], spacing: 2, cols: 31, rows: 11, baseY: 0, heights: new Array(31 * 11).fill(0), materials: new Array(30 * 10).fill(0), boundary: true, foliage: [] };
    map.backdrop = { sky: 'clear', scenery: 'hills', ground: 'grass', haze: 0.5, border: 'forest' };
    expect(borderRect(map)).toEqual({ min: [-30, -10], max: [30, 10] });
    expect(borderEdges(map)).toHaveLength(4);
    // Without bounds or walled terrain there is nothing to line: a warning.
    map.terrain = { ...map.terrain, boundary: false };
    expect(borderEdges(map)).toHaveLength(0);
    expect(validateMap(map).map((i) => i.code)).toContain('border.noBoundary');
  });

  it('is optional in the format: maps without it load unchanged, maps with it round-trip', () => {
    const map = bordered('skyline', { north: 'forest' });
    const r = loadMap(JSON.parse(JSON.stringify(map)));
    expect(r.ok && r.map.backdrop).toMatchObject({ border: 'skyline', borderSides: { north: 'forest' } });
    expect(r.ok && r.issues.filter((i) => i.code.startsWith('border'))).toEqual([]);
    const plain = loadMap(JSON.parse(JSON.stringify({ ...map, backdrop: { sky: 'clear', scenery: 'hills', ground: 'grass', haze: 0.5 } })));
    expect(plain.ok && borderEdges(plain.map)).toEqual([]);
  });
});

describe('border collision', () => {
  it('lays a solid band all along every bordered side, outside the line', () => {
    for (const style of ['cliffs', 'skyline', 'forest'] as const) {
      const boxes = borderBoxes(bordered(style), 0);
      // Every metre of the perimeter is covered, at least 12 m up.
      for (let u = -20; u <= 20; u += 1) {
        for (const [x, z] of [[u, 21], [u, -21], [21, u], [-21, u]] as const) {
          const hit = boxes.find((b) => x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2]);
          expect(hit, `${style} covers ${x}, ${z}`).toBeDefined();
          expect(hit!.max[1]).toBeGreaterThanOrEqual(12);
          expect(hit!.kind).toBe('barrier');
        }
      }
      // Nothing of it reaches into the play area.
      for (const b of boxes) expect(b.min[0] >= 20 || b.max[0] <= -20 || b.min[2] >= 20 || b.max[2] <= -20).toBe(true);
    }
  });

  it('makes the prop walls and fences as solid as they are tall, from props that exist', () => {
    for (const [style, spec] of Object.entries(PROP_FENCES)) {
      for (const id of [spec.panel, spec.post].filter(Boolean)) expect(getProp(`prop.${id}`), `${style}: ${id}`).toBeDefined();
      const boxes = borderBoxes(bordered(style as BorderStyle), 0);
      // The band covers the line where the fence stands, as high as the fence, and stays out of the play area.
      for (let u = -20; u <= 20; u += 2) {
        const hit = boxes.find((b) => u >= b.min[0] && u <= b.max[0] && 20 + PROP_FENCE_OFFSET >= b.min[2] && 20 + PROP_FENCE_OFFSET <= b.max[2]);
        expect(hit, `${style} covers ${u}`).toBeDefined();
        expect(hit!.max[1]).toBeCloseTo(spec.height, 5);
      }
      for (const b of boxes) expect(b.min[0] >= 20 || b.max[0] <= -20 || b.min[2] >= 20 || b.max[2] <= -20).toBe(true);
    }
  });

  it('is part of the map geometry, so movement, shots and bots all meet it', () => {
    const geo = buildMapGeometry(bordered('cliffs'));
    expect(geo.filter((b) => b.sourceId === '__border').length).toBeGreaterThanOrEqual(16);
    expect(buildMapGeometry(bordered('none')).some((b) => b.sourceId === '__border')).toBe(false);
    // A shot fired out over the boundary's own barrier still meets the cliff.
    const physics = new PhysicsWorld(geo.filter((b) => b.sourceId !== '__bounds'));
    expect(physics.raycastWorld({ x: 10, y: 15, z: 0 }, { x: 1, y: 0, z: 0 }, 30)).toBeCloseTo(10, 0);
  });

  it('keeps a player running at it inside the map', () => {
    const d = start(bordered('cliffs'));
    d.place(15, 0, EAST);
    d.run(150, { forward: 1, yaw: EAST });
    expect(d.me.move.pos.x).toBeLessThan(20);
    expect(d.me.alive).toBe(true);
  });
});

describe('electric fence', () => {
  it('the border fence zaps whoever touches it and throws them back into the map', () => {
    const d = start(bordered('fence'));
    d.place(17, 0, EAST);
    let closest = 0;
    for (let i = 0; i < 40; i++) {
      d.run(1, { forward: 1, yaw: EAST });
      closest = Math.max(closest, d.me.move.pos.x);
    }
    expect(d.me.health).toBeLessThan(100);
    expect(closest).toBeLessThan(20 - ELECTRIC_FENCE.inset);
    const zap = d.events.find((e) => e.e === 'arc' && e.s === -1);
    expect(zap).toBeDefined();
    // Thrown back: a moment later they stand clear of the wires.
    d.run(20);
    expect(d.me.move.pos.x).toBeLessThan(20 - ELECTRIC_FENCE.inset - ELECTRIC_FENCE.reach);
  });

  it('only the fenced sides shock', () => {
    const d = start(bordered('cliffs', { east: 'fence' }));
    d.place(0, 17, 0);
    d.run(60, { forward: 1, yaw: 0 });
    expect(d.me.health).toBe(100);
  });

  it('a placed electric fence is solid, hurts and pushes back, and is harmless when off', () => {
    const fence = (startEnabled: boolean): MapEntity => ({ id: 'fence_1', kind: 'trap', trap: 'shock', position: [12, 0, 0], yaw: Math.PI / 2, activation: 'always', onSeconds: 2, offSeconds: 2, offsetSeconds: 0, startEnabled, damage: null, length: 16 });
    const d = start(bordered('none', undefined, [fence(true)]));
    // Its run lies along Z (yaw a quarter turn), through x = 12.
    d.place(9, 2, EAST);
    d.run(60, { forward: 1, yaw: EAST });
    expect(d.me.move.pos.x).toBeLessThan(12);
    expect(d.me.health).toBeLessThan(100);
    expect(d.events.some((e) => e.e === 'kill' || (e.e === 'arc' && e.s === -1))).toBe(true);
    const off = start(bordered('none', undefined, [fence(false)]));
    off.place(9, 2, EAST);
    off.run(60, { forward: 1, yaw: EAST });
    expect(off.me.move.pos.x).toBeLessThan(12);
    expect(off.me.health).toBe(100);
  });

  it('a placed fence collides along its whole length, not just at its middle', () => {
    const geo = buildMapGeometry(bordered('none', undefined, [{ id: 'f', kind: 'trap', trap: 'shock', position: [0, 0, 10], yaw: 0, activation: 'always', onSeconds: 2, offSeconds: 2, offsetSeconds: 0, startEnabled: true, damage: null, length: 20 }]));
    const b = geo.find((x) => x.sourceId === 'f')!;
    const { min, max } = boxBounds(b);
    expect(max[0] - min[0]).toBeGreaterThanOrEqual(20);
    expect(max[1]).toBeCloseTo(ELECTRIC_FENCE.height, 5);
  });
});
