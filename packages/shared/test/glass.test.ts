import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  DEFAULT_DEATHMATCH_RULES,
  GLASS,
  MapDocument as MapSchema,
  PLAYER,
  PhysicsWorld,
  ScenarioBodies,
  TICK_RATE,
  buildMapGeometry,
  edgeGlassAt,
  getWeapon,
  glassBlocks,
  glassIssues,
  initPhysics,
  lookAngles,
  rayOBox,
  setEdgeGlassCommand,
  validateMap,
  weaponCode,
  windowPaneIndex,
  windowPanes,
  type GameEvent,
  type GlassKind,
  type MapDocument,
  type MapEntity,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

/** Two rooms side by side (x 0 and 8) with a window between them; glass on the west room's east side. */
function windowed(glass: GlassKind | null, extra: MapEntity[] = []): MapDocument {
  const map = makeMap(
    [
      { id: 'west', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0, edges: { '0,0,0:E': 'window' }, ...(glass ? { glass: { '0,0,0:E': glass } } : {}) },
      { id: 'east', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
    ],
    [
      [-1, 0, 0],
      [7, 0, 0],
    ],
  );
  return { ...map, entities: [...map.entities, ...extra] };
}

class Driver {
  seq = 0;
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
    this.match.queueInputs(c.slot, [{ seq: ++this.seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
  run(n: number, each: () => void = () => {}): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      each();
      out.push(...this.match.step());
    }
    return out;
  }
}

function give(c: Combatant, id: string): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

/** A shooter in the west room and a target in the east room, facing each other through the window. */
function duel(map: MapDocument) {
  const match = new Match(map, rules);
  const d = new Driver(match);
  const a = match.addHuman('a')!;
  const b = match.addHuman('b')!;
  a.move.pos = { x: -1, y: 0, z: 0 };
  b.move.pos = { x: 7, y: 0, z: 0 };
  give(a, 'core.pistol');
  const fire = (ticks = 1) => {
    const look = lookAngles({ x: a.move.pos.x, y: a.move.pos.y + PLAYER.eyeHeight, z: 0 }, { x: b.move.pos.x, y: b.move.pos.y + 1.5, z: 0 });
    // Pull and release the trigger (the pistol is semi-automatic).
    let held = false;
    return d.run(ticks, () => {
      b.move.pos = { x: 7, y: 0, z: 0 };
      held = !held;
      d.input(a, { buttons: held ? BUTTON_FIRE : 0, ...look });
    });
  };
  return { match, d, a, b, fire };
}

describe('glass panes', () => {
  it('puts a pane in a glazed window, and only there', () => {
    expect(windowPanes(windowed(null))).toHaveLength(0);
    const panes = windowPanes(windowed('breakable'));
    expect(panes).toHaveLength(1);
    const p = panes[0]!;
    expect(p.kind).toBe('breakable');
    // The west room's east wall: x 3.5..4, the opening 2.6 m wide from 0.9 m to 2.5 m up.
    expect(p.box.center.x).toBeCloseTo(3.75);
    expect(p.box.center.y).toBeCloseTo(1.7);
    expect(p.box.half.z).toBeCloseTo(1.3);
    expect(p.box.half.x).toBeCloseTo(GLASS.thickness / 2);
    // A twin window has two panes.
    const twin = windowed('reinforced');
    twin.classicStructure.tiles[0]!.edges = { '0,0,0:E': 'windows' };
    expect(windowPanes(twin).map((q) => q.kind)).toEqual(['reinforced', 'reinforced']);
    // Glass on a plain wall does nothing (and validation says so).
    const wall = windowed('breakable');
    wall.classicStructure.tiles[0]!.edges = { '0,0,0:E': 'wall' };
    expect(windowPanes(wall)).toHaveLength(0);
    expect(glassIssues(wall).map((i) => i.code)).toContain('glass.edge');
  });

  it('blocks movement but not sight', () => {
    const map = windowed('breakable');
    const physics = new PhysicsWorld(buildMapGeometry(map));
    const bodies = new ScenarioBodies(physics, map);
    // Standing in the window opening (on the sill) is blocked by the pane, and free once it's gone.
    const sill = { x: 3.75, y: 0.95, z: 0 };
    expect(physics.headroom(sill, 1.4)).toBe(false);
    // Sight and plain world rays go straight through.
    expect(physics.lineOfSight({ x: 0, y: 1.7, z: 0 }, { x: 7, y: 1.7, z: 0 })).toBe(true);
    expect(physics.raycastHit({ x: 0, y: 1.7, z: 0 }, { x: 1, y: 0, z: 0 }, 7)).toBeNull();
    bodies.setSolid(windowPaneIndex(map, 0), false);
    bodies.commit();
    expect(physics.headroom(sill, 1.4)).toBe(true);
    physics.free();
  });

  it('a glass block stops a walking player', () => {
    const map = makeMap([{ id: 'r', tile: 'core.room_large', x: 0, y: 0, z: 0, rotation: 0 }]);
    const block: MapEntity = { id: 'pane', kind: 'block', position: [3, 0, 0], yaw: Math.PI / 2, size: [3, 3, 0.06], material: null, tint: null, behaviour: 'solid', trigger: 'logic', delaySeconds: 0.8, respawnSeconds: null, health: 120, glass: 'breakable' };
    const doc = { ...map, entities: [...map.entities, block] };
    expect(glassBlocks(doc)).toHaveLength(1);
    // Not level geometry: the scenario owns it.
    expect(buildMapGeometry(doc).some((b) => b.sourceId === 'pane')).toBe(false);
    const physics = new PhysicsWorld(buildMapGeometry(doc));
    new ScenarioBodies(physics, doc);
    const body = physics.createPlayerCollider();
    let feet = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 60; i++) feet = physics.moveCharacter(body, feet, { x: 0.1, y: -0.05, z: 0 }).feet;
    expect(feet.x).toBeLessThan(3 - PLAYER.radius + 0.05);
    expect(physics.lineOfSight({ x: 0, y: 1.5, z: 0 }, { x: 6, y: 1.5, z: 0 })).toBe(true);
    physics.free();
  });

  it('lets shots through, shattering the pane into the replicated state', () => {
    const map = windowed('breakable');
    const { match, b, fire } = duel(map);
    const i = windowPaneIndex(map, 0);
    expect(match.scenario.fullState().es?.find(([k]) => k === i)).toEqual([i, 100, 0]);
    const ev = fire(2);
    expect(b.health).toBeLessThan(100);
    expect(ev.some((e) => e.e === 'broken' && e.i === i)).toBe(true);
    expect(match.scenario.fullState().es?.find(([k]) => k === i)).toEqual([i, 0, 0]);
    // A bot paths round the intact pane; once it is broken the window is an opening.
    match.scenario.reset();
    const box = (blockers: { min: { x: number } }[]) => blockers.some((x) => Math.abs(x.min.x - (3.75 - GLASS.thickness / 2)) < 1e-6);
    expect(box(match.scenario.blockers())).toBe(true);
    expect(match.scenario.shootGlass({ x: 0, y: 1.7, z: 0 }, { x: 1, y: 0, z: 0 }, 8, null)).toBe(1);
    expect(box(match.scenario.blockers())).toBe(false);
  });

  it('reinforced glass stops shots and cracks, but never breaks', () => {
    const map = windowed('reinforced');
    const { match, b, fire } = duel(map);
    const i = windowPaneIndex(map, 0);
    fire(120);
    expect(b.health).toBe(100);
    const [, health] = match.scenario.fullState().es!.find(([k]) => k === i)!;
    expect(health).toBeGreaterThan(0);
    expect(health).toBeLessThan(100);
    // Blasts crack it too, and stray rays don't break it.
    expect(match.scenario.shootGlass({ x: 0, y: 1.7, z: 0 }, { x: 1, y: 0, z: 0 }, 8, null)).toBe(0);
  });

  it('comes back after the map\'s glass respawn time', () => {
    const map = windowed('breakable');
    map.glass = { respawnSeconds: 2 };
    const { match, d } = duel(map);
    const i = windowPaneIndex(map, 0);
    match.scenario.shootGlass({ x: 0, y: 1.7, z: 0 }, { x: 1, y: 0, z: 0 }, 8, null);
    const alive = () => match.scenario.fullState().es!.find(([k]) => k === i)![1] > 0;
    expect(alive()).toBe(false);
    d.run(TICK_RATE);
    expect(alive()).toBe(false);
    d.run(TICK_RATE * 1.5);
    expect(alive()).toBe(true);
  });

  it('a ray finds a turned box', () => {
    const box = { center: { x: 5, y: 1, z: 0 }, half: { x: 1, y: 1, z: 0.05 }, yaw: Math.PI / 2 };
    expect(rayOBox({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 10, box)).toBeCloseTo(4.95);
    expect(rayOBox({ x: 0, y: 1, z: 2 }, { x: 1, y: 0, z: 0 }, 10, box)).toBeNull();
    expect(rayOBox({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 4, box)).toBeNull();
  });
});

describe('glass options', () => {
  it('validates in the schema and flags glass that does nothing', () => {
    const map = windowed('breakable');
    expect(MapSchema.safeParse(map).success).toBe(true);
    expect(MapSchema.safeParse({ ...map, glass: { respawnSeconds: 30 } }).success).toBe(true);
    expect(MapSchema.safeParse({ ...map, glass: { respawnSeconds: 0 } }).success).toBe(false);
    const bad = structuredClone(map);
    (bad.classicStructure.tiles[0] as { glass: Record<string, string> }).glass = { '0,0,0:E': 'frosted' };
    expect(MapSchema.safeParse(bad).success).toBe(false);
    expect(validateMap(map).filter((i) => i.code.startsWith('glass'))).toEqual([]);
    const crumbly: MapEntity = { id: 'g', kind: 'block', position: [0, 0, 0], yaw: 0, size: [3, 3, 0.06], material: null, tint: null, behaviour: 'crumble', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120, glass: 'breakable' };
    expect(validateMap({ ...map, entities: [...map.entities, crumbly] }).map((i) => i.code)).toContain('glass.block');
  });

  it('MapMaker puts glass in a window side and takes it out', () => {
    let map = windowed(null);
    const target = { cell: [0, 0, 0] as [number, number, number], side: 'E' as const };
    const cmd = setEdgeGlassCommand(map, target, 'reinforced');
    if ('error' in cmd) throw new Error(cmd.error);
    const apply = (c: typeof cmd) => {
      if (c.kind !== 'updateTiles') throw new Error(c.kind);
      return { ...map, classicStructure: { ...map.classicStructure, tiles: map.classicStructure.tiles.map((t) => c.after.find((a) => a.id === t.id) ?? t) } };
    };
    map = apply(cmd);
    expect(edgeGlassAt(map, target)).toBe('reinforced');
    // The same wall seen from the other room.
    expect(edgeGlassAt(map, { cell: [1, 0, 0], side: 'W' })).toBe('reinforced');
    expect(windowPanes(map)).toHaveLength(1);
    const off = setEdgeGlassCommand(map, target, null);
    if ('error' in off) throw new Error(off.error);
    map = apply(off);
    expect(edgeGlassAt(map, target)).toBeNull();
    expect(map.classicStructure.tiles[0]!.glass).toBeUndefined();
  });
});
