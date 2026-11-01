import { writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_JUMP, BUTTON_STEER_LOOK, BUTTON_USE, DEFAULT_DEATHMATCH_RULES, MOUNT_DEFS, initPhysics, newSuspension, stepSuspension, suspensionOf, type MapDocument, type MapEntity, type MatchRules, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 };
type MountEntity = Omit<Extract<MapEntity, { kind: 'mount' }>, 'id' | 'kind'>;

/** A long open yard (x -4..124, z -4..36) with the mount at (8, 16) facing +x, and any blocks. */
function strip(model: string, blocks: MapEntity[] = []): MapDocument {
  const tiles = [];
  for (let x = 0; x < 16; x++) for (let y = 0; y < 5; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  const m: MountEntity = { position: [8, 0, 16], model: model as 'buggy', yaw: Math.PI / 2, faction: null, respawnSeconds: null };
  return { ...map, entities: [...map.entities, { id: 'mount_0', kind: 'mount' as const, ...m }, ...blocks] };
}
const block = (id: string, x: number, z: number, size: [number, number, number], pitch = 0): MapEntity =>
  ({ id, kind: 'block', position: [x, 0, z], yaw: Math.PI / 2, size, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120, ...(pitch ? { pitch } : {}) }) as MapEntity;

interface MountRt {
  pos: { x: number; y: number; z: number };
  yaw: number;
  speed: number;
  slide: number;
  airborne: boolean;
  susp?: { h: number; p: number; r: number; hv: number; pv: number; rv: number; wheel: number[]; contact: number; settled: boolean; steer: number };
}
const mountOf = (match: Match) => (match as unknown as { mounts: MountRt[] }).mounts[0]!;

/** A driver in the mount, with helpers to drive it tick by tick and record the trace. */
function drive(model: string, blocks: MapEntity[] = []) {
  const match = new Match(strip(model, blocks), rules, 1);
  const c = match.addHuman('driver')! as Combatant;
  match.step();
  c.move = { pos: { x: 8, y: 0, z: 14 }, velY: 0, grounded: true };
  let seq = 0;
  const send = (i: Partial<PlayerInput>) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: c.yaw, pitch: 0, buttons: 0, ...i }]);
  send({ buttons: BUTTON_USE });
  match.step();
  send({});
  match.step();
  expect(c.mount?.index).toBeDefined();
  const m = mountOf(match);
  const trace: string[] = ['t,x,y,speed,slide,yaw,air,h,p,r,contact'];
  let t = 0;
  const run = (n: number, i: Partial<PlayerInput> = {}) => {
    for (let k = 0; k < n; k++) {
      send(i);
      match.step();
      t++;
      const s = m.susp;
      trace.push([t, m.pos.x, m.pos.y, m.speed, m.slide, m.yaw, m.airborne ? 1 : 0, s?.h ?? 0, s?.p ?? 0, s?.r ?? 0, s?.contact ?? 0].map((v) => (typeof v === 'number' ? +v.toFixed(4) : v)).join(','));
    }
  };
  const save = (name: string) => {
    const dir = process.env.SUSPENSION_TRACE;
    if (dir) writeFileSync(`${dir}/${name}.csv`, trace.join('\n'));
  };
  return { match, c, m, run, save, send };
}

describe('raycast suspension (sim/suspension.ts)', () => {
  it('buggy and gun jeep have it; tank, armored rover, hover and flyers do not', () => {
    expect(suspensionOf(MOUNT_DEFS.buggy)?.points).toHaveLength(4);
    expect(suspensionOf(MOUNT_DEFS.gun_jeep)?.points).toHaveLength(4);
    for (const id of ['tank', 'armored_rover', 'speeder', 'hover_bike', 'skyfighter', 'dropship', 'kart'] as const) expect(suspensionOf(MOUNT_DEFS[id])).toBeNull();
  });

  it('squats under power, dives under the brakes, leans out of a turn', () => {
    const d = drive('buggy');
    d.run(30);
    expect(Math.abs(d.m.susp!.h)).toBeLessThan(0.01);
    d.run(25, { forward: 1 });
    const squat = d.m.susp!.p;
    d.run(90, { forward: 1 });
    const speed = d.m.speed;
    d.run(10, { forward: -1 });
    const dive = d.m.susp!.p;
    d.run(60, { forward: 1 });
    d.run(40, { forward: 1, right: 1 });
    const lean = d.m.susp!.r;
    d.save('buggy_basics');
    expect(speed).toBeGreaterThan(14);
    expect(squat).toBeGreaterThan(0.01);
    expect(dive).toBeLessThan(-0.02);
    // Turning right (yaw growing): it leans out, to the left.
    expect(lean).toBeLessThan(-0.03);
  });

  it('bounces over a bump and settles again', () => {
    const d = drive('buggy', [block('bump', 30, 16, [0.6, 0.12, 6])]);
    let lo = 0;
    let hi = 0;
    for (let k = 0; k < 200; k++) {
      d.run(1, { forward: k < 120 ? 0.7 : 0 });
      lo = Math.min(lo, d.m.susp!.p);
      hi = Math.max(hi, d.m.susp!.p);
    }
    d.run(240);
    d.save('buggy_bump');
    expect(hi - lo).toBeGreaterThan(0.04);
    expect(d.m.susp!.settled).toBe(true);
    expect(Math.abs(d.m.susp!.p)).toBeLessThan(0.01);
  });

  it('a ramp jump: air time, a little tumble, a bouncy landing; never NaN', () => {
    const d = drive('buggy', [block('ramp', 40, 16, [4, 0.3, 6], 0.32)]);
    let air = 0;
    let lowH = 0;
    let takeoff: number | null = null;
    let airPitch = Infinity;
    let landed = -1;
    for (let k = 0; k < 360; k++) {
      d.run(1, { forward: 1 });
      if (d.m.airborne) {
        air++;
        takeoff ??= d.m.susp!.p;
        airPitch = Math.min(airPitch, d.m.susp!.p);
      } else if (air > 5 && landed < 0) landed = k;
      if (landed >= 0) lowH = Math.min(lowH, d.m.susp!.h);
      expect(Number.isFinite(d.m.susp!.h + d.m.susp!.p + d.m.susp!.r)).toBe(true);
    }
    d.save('buggy_jump');
    expect(air).toBeGreaterThan(10);
    // The nose drops in the air (the little tumble).
    expect(airPitch).toBeLessThan(takeoff! - 0.1);
    expect(lowH).toBeLessThan(-0.06);
  });

  it('is deterministic: the same inputs give the same snapshots', () => {
    const go = () => {
      const d = drive('gun_jeep', [block('bump', 30, 16, [0.6, 0.12, 6])]);
      const out: string[] = [];
      for (let k = 0; k < 240; k++) {
        d.run(1, { forward: 1, right: k > 120 ? 0.6 : 0 });
        out.push(JSON.stringify(d.match.snapshot([]).ms));
      }
      return out;
    };
    expect(go()).toEqual(go());
  });

  it('snapshots carry only suspension vehicles, and a parked one stops casting rays once settled', () => {
    const d = drive('buggy');
    const ms = d.match.snapshot([]).ms!;
    expect(ms).toHaveLength(1);
    expect(ms[0]).toHaveLength(5 + 4);
    // Get out: once settled, it stops.
    d.send({ buttons: BUTTON_USE });
    d.match.step();
    d.run(120);
    const physics = (d.match as unknown as { physics: { groundBelow: (...a: unknown[]) => unknown } }).physics;
    let rays = 0;
    const real = physics.groundBelow.bind(physics);
    physics.groundBelow = (...a: unknown[]) => (rays++, real(...(a as [never, never, never])));
    d.run(120);
    expect(rays).toBe(0);
    const tank = drive('tank');
    expect(tank.match.snapshot([]).ms).toBeUndefined();
  });

  it('look-to-steer turns the vehicle toward where the driver looks', () => {
    const d = drive('buggy');
    d.run(60, { forward: 1 });
    const want = Math.PI / 2 + 0.8;
    d.run(150, { forward: 1, yaw: want, buttons: BUTTON_STEER_LOOK });
    const off = Math.atan2(Math.sin(want - d.m.yaw), Math.cos(want - d.m.yaw));
    expect(Math.abs(off)).toBeLessThan(0.12);
    // Without the button the same look does nothing.
    const e = drive('buggy');
    e.run(210, { forward: 1, yaw: want });
    expect(Math.abs(e.m.yaw - Math.PI / 2)).toBeLessThan(0.01);
  });

  it('is loose at speed: a hard turn flat out slides more than the same turn slow', () => {
    const slip = (forward: number) => {
      const d = drive('buggy');
      d.run(150, { forward });
      let most = 0;
      for (let k = 0; k < 40; k++) {
        d.run(1, { forward, right: 1 });
        most = Math.max(most, Math.abs(d.m.slide) / Math.max(1, Math.abs(d.m.speed)));
      }
      return most;
    };
    const fast = slip(1);
    const slow = slip(0.45);
    console.log(`slip fast ${fast.toFixed(3)} slow ${slow.toFixed(3)}`);
    expect(fast).toBeGreaterThan(slow * 1.5);
  });

  it('the springs alone ring down from any start and stay bounded', () => {
    const t = suspensionOf(MOUNT_DEFS.buggy)!;
    const s = newSuspension(t);
    s.h = -0.3;
    s.p = 0.4;
    s.r = -0.4;
    s.hv = -6;
    for (let k = 0; k < 600; k++) stepSuspension(s, t, 1 / 60, { grounded: true, aLong: 0, aLat: 0, landing: 0, steer: 0 });
    expect(Math.abs(s.h) + Math.abs(s.p) + Math.abs(s.r)).toBeLessThan(0.005);
    expect(s.settled).toBe(true);
  });
});

void BUTTON_JUMP;
