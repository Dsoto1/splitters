import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_USE,
  PhysicsWorld,
  applyCommand,
  buildMapDecor,
  buildMapGeometry,
  closeOpenEndsCommand,
  addPortalsCommand,
  coreCatalog,
  initPhysics,
  layPathsIntoTerrain,
  loadMap,
  mapGroundBores,
  newMapDocument,
  newTerrain,
  openEnds,
  rulesForMode,
  terrainHeightAt,
  trackPointAt,
  validateMap,
  type MapDocument,
  type MapEntity,
  type PlayerInput,
  type Rotation,
  type TilePlacement,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';

/**
 * Tileset 04 step 6 (docs/map-briefs/tunnels/PLAN_2026-11-13.md, "Step 6 as built"): the 7 m bore (profile L) in the
 * road, concrete and brick families, port profiles and the reducer, the wide ramp a vehicle climbs, roads through a
 * tunnel; and the two follow-ups folded in: the mine track following curves, lanterns in the brick and mine chambers.
 */
const WIDE = ['wide_straight', 'wide_curve', 'wide_t', 'wide_cross', 'wide_end', 'wide_portal'];
const ARMS: Record<string, string[]> = { wide_straight: ['N', 'S'], wide_curve: ['S', 'E'], wide_t: ['E', 'W', 'S'], wide_cross: ['N', 'E', 'S', 'W'], wide_end: ['S'], wide_portal: ['N'] };
const FAMILIES = ['road', 'concrete', 'brick'];
const DIRS: Record<string, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };

function mapOf(tiles: (Partial<TilePlacement> & { tile: string; x: number; y: number })[], hill = 8, size = 96): MapDocument {
  const doc = newMapDocument('Wide');
  const t = newTerrain(size, 2);
  t.heights.fill(Math.round(hill * 100));
  return { ...doc, terrain: t, entities: [], classicStructure: { ...doc.classicStructure, tiles: tiles.map((p, i) => ({ id: `tile_${i}`, z: 0, rotation: 0 as Rotation, ...p })) } };
}

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

describe('the 7 m bore (profile L)', () => {
  it('every wide shape in every family it comes in: the same shell, ports that say L, and a 7 m x 3.5 m clear box down every arm', () => {
    for (const shape of WIDE) {
      const base = coreCatalog.get(`core.tunnel_road_${shape}`)!;
      expect(base.familyOf, shape).toMatchObject({ base: base.id, family: 'road' });
      expect(coreCatalog.familiesOf(base.id).map((d) => d.familyOf!.family), shape).toEqual(FAMILIES);
      expect(base.ports.every((p) => p.bore === 'L'), shape).toBe(true);
      const hard = (fam: string) => {
        const doc = mapOf([{ tile: base.id, x: 0, y: 0, ...(fam === 'road' ? {} : { family: fam }) }]);
        return buildMapGeometry(doc).filter((b) => b.kind !== 'trim').map(({ surface: _s, ...b }) => b);
      };
      for (const fam of FAMILIES.slice(1)) expect(hard(fam), `${shape} ${fam}`).toEqual(hard('road'));
      const doc = mapOf([{ tile: base.id, x: 0, y: 0 }]);
      const physics = new PhysicsWorld(buildMapGeometry(doc).filter((b) => b.kind !== 'trim' && !b.endCap), null);
      for (const side of ARMS[shape]!) {
        const [dx, dz] = DIRS[side]!;
        for (const off of [-3.3, 0, 3.3]) for (const y of [0.2, 1.7, 3.3]) expect(physics.raycastWorld({ x: -dz * off, y, z: dx * off }, { x: dx, y: 0, z: dz }, 4), `${shape} ${side} ${off} ${y}`).toBeNull();
      }
      physics.free();
    }
    // The mine stays on the 3.6 m passage; the S shapes keep their ports (no bore said: S).
    expect(coreCatalog.get('core.tunnel_mine_wide_straight')).toBeUndefined();
    expect(coreCatalog.get('core.tunnel_concrete_straight')!.ports.every((p) => p.bore === undefined)).toBe(true);
  });

  it('the road family: lines on the asphalt, walkways and a guardrail along the walls, all drawn and out of the way of wheels and players', () => {
    const solids = coreCatalog.get('core.tunnel_road_wide_straight')!.solids ?? [];
    expect(new Set(solids.filter((b) => b.kind !== 'trim').map((b) => b.surface?.material))).toEqual(new Set(['core.pbr_concrete', 'core.pbr_concrete_dark']));
    const lines = solids.filter((b) => b.surface?.material === 'core.paint_matte');
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines.every((b) => b.max[1] <= 0.013)).toBe(true);
    for (const shape of WIDE.filter((s) => s !== 'wide_portal')) {
      const doc = mapOf([{ tile: `core.tunnel_road_${shape}`, x: 0, y: 0 }]);
      const drawn = [...buildMapGeometry(doc), ...buildMapDecor(doc)].filter((b) => b.kind === 'trim' && b.max[1] > 0.02).map((b) => ({ ...b, kind: 'solid' as const }));
      const physics = new PhysicsWorld(drawn, null);
      // A buggy's width (2.4 m) either side of the middle, and a player inside the walkways: nothing drawn in the way.
      for (const side of ARMS[shape]!) {
        const [dx, dz] = DIRS[side]!;
        for (const off of [-2.6, -1.2, 0, 1.2, 2.6]) for (const y of [0.15, 1, 1.9]) expect(physics.raycastWorld({ x: -dz * off, y, z: dx * off }, { x: dx, y: 0, z: dz }, 4), `${shape} ${side} ${off} ${y}`).toBeNull();
      }
      physics.free();
    }
  });

  it('the reducer: L to the south, S to the north, the walls stepping in at the middle; a mismatched joint is a warning until a reducer goes in', () => {
    const red = coreCatalog.get('core.tunnel_road_reducer')!;
    expect(red.ports).toEqual([{ side: 'S', level: 0, bore: 'L' }, { side: 'N', level: 0 }]);
    const physics = new PhysicsWorld(buildMapGeometry(mapOf([{ tile: red.id, x: 0, y: 0 }])).filter((b) => b.kind !== 'trim' && !b.endCap), null);
    // From the wide end, 2.6 m off the line, northward: the step at the middle. Down the middle: through.
    expect(physics.raycastWorld({ x: 2.6, y: 1, z: -3.9 }, { x: 0, y: 0, z: 1 }, 8)).toBeCloseTo(3.9, 1);
    expect(physics.raycastWorld({ x: 0, y: 1, z: -3.9 }, { x: 0, y: 0, z: 1 }, 8)).toBeNull();
    physics.free();
    const mismatch = (m: MapDocument) => validateMap(m).filter((i) => i.code === 'tunnel.profile_mismatch');
    const bad = mapOf([{ tile: 'core.tunnel_road_wide_straight', x: 0, y: 0 }, { tile: 'core.tunnel_concrete_straight', x: 0, y: 1 }]);
    expect(mismatch(bad).map((i) => i.targetId)).toEqual(['tile_1']);
    const good = mapOf([{ tile: 'core.tunnel_road_wide_straight', x: 0, y: 0 }, { tile: 'core.tunnel_road_reducer', x: 0, y: 1 }, { tile: 'core.tunnel_concrete_straight', x: 0, y: 2 }]);
    expect(mismatch(good)).toEqual([]);
    // Turned about: the reducer's wide side north.
    const turned = mapOf([{ tile: 'core.tunnel_concrete_straight', x: 0, y: 0 }, { tile: 'core.tunnel_road_reducer', x: 0, y: 1, rotation: 2 }, { tile: 'core.tunnel_road_wide_straight', x: 0, y: 2 }]);
    expect(mismatch(turned)).toEqual([]);
  });

  it('Add a portal and Close open ends put the shape of each end\'s bore, in the piece\'s family where it comes in it', () => {
    const doc = mapOf([{ tile: 'core.tunnel_road_wide_straight', x: 0, y: 0, family: 'brick' }, { tile: 'core.tunnel_road_reducer', x: 0, y: 1 }]);
    expect(openEnds(doc).map((e) => `${e.tile}:${e.side}:${e.bore}`).sort()).toEqual(['tile_0:S:L', 'tile_1:N:S']);
    const closed = closeOpenEndsCommand(doc);
    if ('error' in closed) throw new Error(closed.error);
    const at = Object.fromEntries(closed.placed.map((p) => [`${p.x},${p.y}`, p]));
    expect(at['0,-1']).toMatchObject({ tile: 'core.tunnel_road_wide_end', family: 'brick', rotation: 2 });
    // The road family has no 3.6 m passage: the reducer's narrow end gets the plain Dead End.
    expect(at['0,2']).toMatchObject({ tile: 'core.tunnel_concrete_end', rotation: 0 });
    expect('family' in at['0,2']!).toBe(false);
    const portals = addPortalsCommand(doc);
    if ('error' in portals) throw new Error(portals.error);
    expect(portals.placed.map((p) => `${p.tile}@${p.x},${p.y}r${p.rotation}:${p.family ?? '-'}`).sort()).toEqual(['core.tunnel_concrete_portal@0,2r2:-', 'core.tunnel_road_wide_portal@0,-1r0:brick']);
    expect(openEnds(applyCommand(doc, closed.command))).toEqual([]);
  });
});

describe('vehicles and roads through a road tunnel', () => {
  // Under an 8 m hill: a wide portal (south), two wide straights, the wide ramp up a level over two cells, a straight a
  // level up and a wide portal facing north.
  const tunnel = (): MapDocument => {
    const base = mapOf(
      [
        { tile: 'core.tunnel_road_wide_portal', x: 0, y: -3 },
        { tile: 'core.tunnel_road_wide_straight', x: 0, y: -2 },
        { tile: 'core.tunnel_road_wide_straight', x: 0, y: -1 },
        { tile: 'core.tunnel_road_wide_ramp', x: 0, y: 0 },
        { tile: 'core.tunnel_road_wide_straight', x: 0, y: 2, z: 1 },
        { tile: 'core.tunnel_road_wide_portal', x: 0, y: 3, z: 1, rotation: 2 },
      ],
      8,
      160,
    );
    const mount = { id: 'buggy', kind: 'mount', model: 'troop_buggy', position: [0, 1, -31], yaw: 0, faction: null, respawnSeconds: null } as unknown as MapEntity;
    const spawn = { id: 'spawn_a', kind: 'spawn', position: [3, 1, -31], yaw: 0 } as unknown as MapEntity;
    return { ...base, entities: [mount, spawn] };
  };

  it('the map: no profile or buried-mouth warnings; the ground is the hill over the bore and the cuttings at both ends', () => {
    const doc = tunnel();
    const issues = validateMap(doc).filter((i) => i.code.startsWith('tunnel.'));
    expect(issues.map((i) => i.code)).toEqual([]);
    const r = loadMap(doc);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const g = r.map.terrain!;
    expect(terrainHeightAt(g, 0, -8)!).toBeGreaterThan(7);
    expect(terrainHeightAt(g, 0, -30)!).toBeLessThan(0.5);
    expect(terrainHeightAt(g, 0, 30)!).toBeLessThan(4.5);
    expect(mapGroundBores(r.map).cuts.length).toBeGreaterThan(6);
  });

  it('the Troop Buggy drives in at the south portal, through, up the ramp and out of the north portal a level up', { timeout: 60_000 }, () => {
    const r = loadMap(tunnel());
    if (!r.ok) throw new Error(r.issues.map((i) => i.message).join('; '));
    const map = r.map;
    const match = new Match(map, { ...rulesForMode(map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0, botFill: 0 } as never, 1);
    const me = match.addHuman('me')! as Combatant;
    let seq = 0;
    const send = (i: Partial<PlayerInput> = {}) => match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, ...i }]);
    for (let k = 0; k < 120; k++) {
      send();
      match.step();
    }
    const mounts = (match as unknown as { mounts: { def: { id: string }; pos: { x: number; y: number; z: number } }[] }).mounts;
    const m = mounts.find((x) => x.def.id === 'troop_buggy')!;
    me.move = { pos: { x: m.pos.x + 2.4, y: m.pos.y + 0.3, z: m.pos.z }, velY: 0, grounded: true };
    send({ buttons: BUTTON_USE });
    match.step();
    expect(me.mount).toBeTruthy();
    let top = -Infinity;
    let low = Infinity;
    for (let k = 0; k < 60 * 25 && m.pos.z < 40; k++) {
      // (Kept on the line: a touch of steering against any drift.)
      send({ forward: 1, right: Math.max(-1, Math.min(1, -m.pos.x * 0.6)) });
      match.step();
      if (m.pos.z > -20 && m.pos.z < 30) low = Math.min(low, m.pos.y);
      if (m.pos.z < 27) top = Math.max(top, m.pos.y);
    }
    expect(m.pos.z, `reached z ${m.pos.z.toFixed(1)} at x ${m.pos.x.toFixed(1)}, y ${m.pos.y.toFixed(1)}`).toBeGreaterThan(36);
    expect(m.pos.y).toBeGreaterThan(3.5);
    // Never on the hill over it: inside, always on the bore's floor (0 to a level up, 4 m).
    expect(low).toBeGreaterThan(-0.5);
    expect(top).toBeLessThan(5);
  });

  it('a road through the tunnel: a point picked on the bore\'s floor stays there, and a laid road leaves the hill over the bore alone', () => {
    const r = loadMap(tunnel());
    if (!r.ok) throw new Error('map');
    const ground = r.map.terrain!;
    // In the bore, 8 m of hill over the floor: the point stays on the floor. Out in the open it goes on the ground.
    expect(trackPointAt(ground, 1, 0, -10)).toEqual([1, 0, -10]);
    expect(trackPointAt(ground, 30, 0, -10)[1]).toBeCloseTo(terrainHeightAt(ground, 30, -10)!, 1);
    // A hill with a swell along it, so a road laid over it would smooth it.
    const made = { ...tunnel().terrain! };
    made.heights = made.heights.map((h, i) => h + Math.round(150 * Math.sin(Math.floor(i / made.cols) * 0.7)));
    const road = { id: 'road_t', points: [[0, 0, -40], [0, 0, -4]] as [number, number, number][], closed: false, uses: ['road' as const], width: 6, style: 'asphalt' as const, lay: true };
    const cuts = mapGroundBores(tunnel()).cuts;
    const laid = layPathsIntoTerrain(made, [road], cuts);
    const blind = layPathsIntoTerrain(made, [road]);
    // Over the bore the hill is as made; a road that knew nothing of the bore would have smoothed it.
    for (const z of [-15, -11, -7]) expect(terrainHeightAt(laid, 0, z), `z ${z}`).toBeCloseTo(terrainHeightAt(made, 0, z)!, 2);
    expect([-15, -11, -7].some((z) => Math.abs(terrainHeightAt(blind, 0, z)! - terrainHeightAt(made, 0, z)!) > 0.05)).toBe(true);
  });
});

describe('the follow-ups folded into step 6', () => {
  it('the mine track follows a curve and turns out of a T\'s branch, inside the cell', () => {
    for (const shape of ['curve', 't']) {
      const solids = coreCatalog.get(`core.tunnel_mine_${shape}`)!.solids ?? [];
      const rails = solids.filter((b) => b.surface?.material === 'core.pbr_steel' && b.max[1] <= 0.07);
      const bent = rails.filter((b) => b.yaw && Math.abs(Math.sin(2 * b.yaw)) > 0.05);
      expect(bent.length, shape).toBeGreaterThanOrEqual(20);
      expect(rails.every((b) => Math.max(Math.abs(b.min[0]), Math.abs(b.max[0]), Math.abs(b.min[2]), Math.abs(b.max[2])) <= 4.1), shape).toBe(true);
    }
    // The T keeps its through line east-west; no stub runs south from the middle.
    const t = coreCatalog.get('core.tunnel_mine_t')!.solids ?? [];
    const straight = t.filter((b) => b.surface?.material === 'core.pbr_steel' && b.max[1] <= 0.07 && !b.yaw);
    expect(straight.some((b) => b.max[0] - b.min[0] > 3)).toBe(true);
    expect(straight.some((b) => b.max[2] - b.min[2] > 3)).toBe(false);
  });

  it('the brick and mine chambers hang lanterns; the concrete chamber keeps its strip lights', () => {
    const glows = (id: string) => (coreCatalog.get(id)!.solids ?? []).filter((b) => b.surface?.material === 'core.lamp_glow');
    for (const f of ['brick', 'mine']) {
      const g = glows(`core.tunnel_${f}_chamber`);
      expect(g.length, f).toBe(5);
      expect(g.every((b) => b.max[0] - b.min[0] < 0.2 && b.max[2] - b.min[2] < 0.2 && b.max[1] - b.min[1] > 0.2), f).toBe(true);
    }
    expect(glows('core.tunnel_concrete_chamber').every((b) => b.max[1] - b.min[1] < 0.1)).toBe(true);
  });
});
