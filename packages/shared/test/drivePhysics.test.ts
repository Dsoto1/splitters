import { writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_JUMP, BUTTON_STEER_LOOK, BUTTON_USE, DEFAULT_DEATHMATCH_RULES, MOUNT_DEFS, initPhysics, rigidOf, rigidTrace, tippedOver, uprightness, type MapDocument, type MapEntity, type MatchRules, type PlayerInput, type RigidState } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 };
type MountEntity = Omit<Extract<MapEntity, { kind: 'mount' }>, 'id' | 'kind'>;

/** A long open yard (x -4..124, z -4..36) with the buggy at (8, 16) facing +x, and any blocks. */
function strip(blocks: MapEntity[] = [], at: [number, number, number] = [8, 0, 16], yaw = Math.PI / 2): MapDocument {
  const tiles = [];
  for (let x = 0; x < 16; x++) for (let y = 0; y < 5; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  const m: MountEntity = { position: at, model: 'troop_buggy', yaw, faction: null, respawnSeconds: null };
  return { ...map, entities: [...map.entities, { id: 'mount_0', kind: 'mount' as const, ...m }, ...blocks] };
}
/** A block; `pitch` tips it (a ramp), `roll` leans it. */
export const block = (id: string, x: number, z: number, size: [number, number, number], pitch = 0, y = 0, yaw = Math.PI / 2): MapEntity =>
  ({ id, kind: 'block', position: [x, y, z], yaw, size, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120, ...(pitch ? { pitch } : {}) }) as MapEntity;

interface MountRt {
  pos: { x: number; y: number; z: number };
  yaw: number;
  speed: number;
  slide: number;
  airborne: boolean;
  health: number;
  rigid?: RigidState;
  susp?: { p: number; r: number; wheel: number[]; contact: number };
}
const mountOf = (match: Match) => (match as unknown as { mounts: MountRt[] }).mounts[0]!;

/** A driver in the buggy, with helpers to drive it tick by tick and record a trace. */
export function drive(blocks: MapEntity[] = [], opts: { drive?: 'classic' | 'rigid'; at?: [number, number, number]; yaw?: number } = {}) {
  const match = new Match(strip(blocks, opts.at, opts.yaw), rules, 1, opts.drive ? { drive: opts.drive } : {});
  const c = match.addHuman('driver')! as Combatant;
  match.step();
  const m = mountOf(match);
  c.move = { pos: { x: m.pos.x, y: m.pos.y, z: m.pos.z - 2 }, velY: 0, grounded: true };
  let seq = 0;
  const send = (i: Partial<PlayerInput>) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: c.yaw, pitch: 0, buttons: 0, ...i }]);
  send({ buttons: BUTTON_USE });
  match.step();
  send({});
  match.step();
  expect(c.mount?.index).toBeDefined();
  const trace: string[] = ['t,x,y,z,speed,slide,yaw,pitch,roll,air,contact,sliding,up'];
  let t = 0;
  const run = (n: number, i: Partial<PlayerInput> = {}, each?: () => void) => {
    for (let k = 0; k < n; k++) {
      send(i);
      match.step();
      t++;
      const r = m.rigid;
      trace.push([t, m.pos.x, m.pos.y, m.pos.z, m.speed, m.slide, m.yaw, m.susp?.p ?? 0, m.susp?.r ?? 0, m.airborne ? 1 : 0, r?.contact ?? 0, r?.sliding ?? 0, r ? uprightness(r) : 1].map((v) => +v.toFixed(4)).join(','));
      each?.();
    }
  };
  const save = (name: string) => {
    const dir = process.env.DRIVE_TRACE;
    if (dir) writeFileSync(`${dir}/${name}.csv`, trace.join('\n'));
  };
  return { match, c, m, run, save, send };
}

describe('rigid driving (sim/wheelPhysics.ts)', () => {
  it('the Troop Buggy has it, on; nothing else does', () => {
    expect(rigidOf(MOUNT_DEFS.troop_buggy)).not.toBeNull();
    expect(MOUNT_DEFS.troop_buggy.vehicle?.rigid?.on).toBe(true);
    for (const def of Object.values(MOUNT_DEFS)) if (def.id !== 'troop_buggy') expect(def.vehicle?.rigid, def.id).toBeUndefined();
  });

  it('sits on its springs, drives off and turns', () => {
    const d = drive();
    d.run(60);
    const rest = { ...d.m.pos };
    expect(Math.abs(rest.y)).toBeLessThan(0.05);
    expect(d.m.rigid!.contact).toBe(4);
    d.run(120, { forward: 1 });
    d.save('flat');
    console.log('flat', d.m.pos, d.m.speed);
    expect(d.m.speed).toBeGreaterThan(14);
    d.run(60, { forward: 1, right: 1 });
    console.log('turn', d.m.yaw, d.m.speed, d.m.slide, d.m.susp?.r);
    d.save('turn');
  });
});

describe('rigid driving: jumps, landings, slopes, flips', () => {
  it('a ramp jump: it flies with its momentum, falls with gravity and lands on its springs', () => {
    // A kicker 1 m high at x 38..45, 7 m long.
    const d = drive([block('ramp', 42, 16, [6, 0.4, 7], 0.3)]);
    d.run(20);
    let air = 0;
    let peak = 0;
    let landed = -1;
    let land = { comp: 0, speed: 0 };
    let landSpeed = 0;
    let vy = 0;
    const dbg: string[] = [];
    for (let k = 0; k < 300; k++) {
      d.run(1, { forward: 1 });
      const r = d.m.rigid!;
      expect(Number.isFinite(r.pos.x + r.pos.y + r.q.w + r.vel.y + r.spin.x)).toBe(true);
      if (d.m.airborne) {
        air++;
        peak = Math.max(peak, d.m.pos.y);
        vy = r.vel.y;
      } else if (air > 10 && landed < 0) {
        landed = k;
        landSpeed = -vy;
      }
      if (process.env.DRIVE_TRACE) dbg.push(`${k} ${r.pos.x.toFixed(2)} ${d.m.airborne} ${r.contact} ${r.comp.map((c) => c.toFixed(3))} y ${r.pos.y.toFixed(3)} vy ${r.vel.y.toFixed(2)}`);
      if (landed >= 0 && k < landed + 45) land = { comp: Math.max(land.comp, ...r.comp), speed: Math.max(land.speed, d.m.speed) };
    }
    d.save('jump');
    if (process.env.DRIVE_TRACE) writeFileSync(`${process.env.DRIVE_TRACE}/jump-wheels.txt`, dbg.join('\n'));
    // Off the lip at speed: a real flight, higher than the lip, coming down at speed.
    expect(air).toBeGreaterThan(20);
    expect(peak).toBeGreaterThan(1.3);
    expect(landSpeed).toBeGreaterThan(4);
    // The landing squashes the springs, keeps going (momentum), and it ends upright on four wheels.
    expect(land.comp).toBeGreaterThan(0.08);
    expect(land.speed).toBeGreaterThan(10);
    expect(uprightness(d.m.rigid!)).toBeGreaterThan(0.95);
    expect(d.m.rigid!.contact).toBe(4);
  });

  it('air control: S in the air lifts the nose, W drops it', () => {
    // From the throttle held over the lip (W): S (-1) lifts the nose, W held stays neutral.
    const fly = (forward: number) => {
      const d = drive([block('ramp', 42, 16, [6, 0.4, 7], 0.3)]);
      d.run(20);
      let pitch = 0;
      for (let k = 0; k < 300 && !(d.m.airborne && d.m.rigid!.air > 2); k++) d.run(1, { forward: 1 });
      d.run(12, { forward }, () => (pitch = d.m.susp!.p));
      expect(d.m.airborne).toBe(true);
      return pitch;
    };
    const flat = fly(1);
    expect(fly(-1)).toBeGreaterThan(flat + 0.1);
    // And W pressed in the air after a coasting take-off noses it down.
    const coast = (forward: number) => {
      const d = drive([block('ramp', 42, 16, [6, 0.4, 7], 0.3)]);
      d.run(20);
      let pitch = 0;
      for (let k = 0; k < 300 && !(d.m.airborne && d.m.rigid!.air > 2); k++) d.run(1, { forward: d.m.pos.x > 41 ? 0 : 1 });
      d.run(6, { forward }, () => (pitch = d.m.susp!.p));
      expect(d.m.airborne).toBe(true);
      return pitch;
    };
    expect(coast(1)).toBeLessThan(coast(0) - 0.03);
  });

  it('a hard landing from high up dents it, as the classic drive did', () => {
    const d = drive([], { at: [20, 9, 16] });
    const before = d.m.health;
    d.run(120);
    expect(d.m.health).toBeLessThan(before);
    expect(uprightness(d.m.rigid!)).toBeGreaterThan(0.95);
  });

  it('climbs a 25 degree slope; on a 50 degree one the grip fails and it slides back down', () => {
    const slope = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      // A long slab tilted up toward +x from x 20 (its low end at the ground).
      const L = 14;
      const d = drive([block('slope', 20 + (L / 2) * Math.cos(a), 16, [6, 0.6, L], a, (L / 2) * Math.sin(a) - 0.3 * Math.cos(a))], { at: [14, 0, 16] });
      d.run(30);
      let top = 0;
      let after = 0;
      d.run(240, { forward: 1 }, () => (top = Math.max(top, d.m.pos.y)));
      d.run(60, { forward: 1 }, () => (after = d.m.pos.y));
      d.save(`slope${deg}`);
      return { top, after, x: d.m.pos.x, up: uprightness(d.m.rigid!), sliding: d.m.rigid!.sliding };
    };
    const easy = slope(25);
    // Up and over the top (14 m at 25 degrees: 5.9 m up).
    expect(easy.top).toBeGreaterThan(5);
    const steep = slope(50);
    // It carries its run-up (about 9 m/s) a way up, short of the top (10.7 m up), then slides back down, throttle held.
    expect(steep.top).toBeLessThan(10.2);
    expect(steep.after).toBeLessThan(steep.top - 0.5);
  });

  it('kerbed on one side at speed it tips; on its side or roof jump rolls it back (owner: "2b"); empty, it rights itself', () => {
    // A kicker under the left wheels only.
    const d = drive([block('kerb', 34, 14.6, [1.6, 0.4, 5], 0.45)]);
    d.run(20);
    let roll = 0;
    d.run(150, { forward: 1 }, () => (roll = Math.max(roll, Math.abs(d.m.susp!.r))));
    d.save('kerb');
    expect(roll).toBeGreaterThan(0.5);
    // Upside down in the air: it lands on its roof and stays there until the driver presses jump.
    const roofAt = (x: number) => {
      const r = d.m.rigid!;
      r.q = { x: 0, y: 0, z: 1, w: 0 };
      r.pos = { x, y: 2.5, z: 16 };
      r.vel = { x: 0, y: 0, z: 0 };
      r.spin = { x: 0, y: 0, z: 0 };
      d.m.pos = r.pos;
      (d.m as unknown as { rigidSeen: { pos: unknown } }).rigidSeen.pos = r.pos;
    };
    roofAt(60);
    let roof = false;
    d.run(240, {}, () => (roof ||= d.m.rigid!.hull && uprightness(d.m.rigid!) < -0.8));
    expect(roof).toBe(true);
    expect(tippedOver(d.m.rigid!)).toBe(true);
    expect(uprightness(d.m.rigid!)).toBeLessThan(-0.8);
    let upright = -1;
    for (let k = 0; k < 240 && upright < 0; k++) {
      d.run(1, { buttons: k < 10 ? BUTTON_JUMP : 0 });
      if (uprightness(d.m.rigid!) > 0.95 && d.m.rigid!.contact === 4) upright = k;
    }
    d.save('roof');
    expect(upright).toBeGreaterThan(0);
    expect(upright).toBeLessThan(150);
    // Empty: back on its wheels by itself within a few seconds.
    roofAt(80);
    d.send({ buttons: BUTTON_USE });
    d.match.step();
    expect(d.c.mount).toBeFalsy();
    let empty = -1;
    for (let k = 0; k < 600 && empty < 0; k++) {
      d.match.step();
      if (k > 60 && uprightness(d.m.rigid!) > 0.95 && d.m.rigid!.contact === 4) empty = k;
    }
    expect(empty).toBeGreaterThan(0);
    expect(empty).toBeLessThan(500);
  });

  it('is deterministic: the same inputs give the same states and snapshots', () => {
    const go = () => {
      const d = drive([block('ramp', 42, 16, [6, 0.4, 7], 0.3), block('kerb', 70, 14.6, [1.6, 0.4, 5], 0.45)]);
      const out: string[] = [];
      for (let k = 0; k < 400; k++) {
        d.run(1, { forward: 1, right: k > 200 ? 0.6 : 0, buttons: k > 300 && k < 330 ? BUTTON_JUMP : 0 });
        out.push(JSON.stringify([d.match.snapshot([]).ms, d.match.privateState(d.c.slot)?.vp]));
      }
      return out;
    };
    expect(go()).toEqual(go());
  });

  it('a speed set from outside (a crash, a test) becomes its speed along its heading', () => {
    const d = drive();
    d.run(30, { forward: 0.1 });
    d.m.speed = 18;
    d.run(1, { forward: 1 });
    expect(d.m.speed).toBeGreaterThan(16);
    expect(d.m.speed).toBeLessThan(20);
    d.m.speed = 0;
    d.run(1);
    expect(Math.abs(d.m.speed)).toBeLessThan(1);
  });

  it('?drive=classic (MatchOptions.drive) keeps the old driving', () => {
    const d = drive([], { drive: 'classic' });
    expect(d.m.rigid).toBeUndefined();
    d.run(60, { forward: 1 });
    expect(d.m.speed).toBeGreaterThan(5);
    expect(d.match.privateState(d.c.slot)?.vp).toBeUndefined();
  });
});

describe('rigid driving: the controls', () => {
  it('look-to-steer turns it toward where the driver looks', () => {
    const d = drive([], { at: [8, 0, 4] });
    d.run(60, { forward: 0.7 });
    const want = Math.PI / 2 - 0.8;
    d.run(150, { forward: 0.7, yaw: want, buttons: BUTTON_STEER_LOOK });
    d.save('look');
    const off = Math.atan2(Math.sin(want - d.m.yaw), Math.cos(want - d.m.yaw));
    expect(Math.abs(off)).toBeLessThan(0.15);
  });

  it('the handbrake (jump) locks the rear wheels: a slide, and it stops', () => {
    const d = drive();
    d.run(90, { forward: 1 });
    let slide = 0;
    d.run(60, { right: 1, buttons: BUTTON_JUMP }, () => (slide = Math.max(slide, Math.abs(d.m.slide))));
    expect(slide).toBeGreaterThan(1.5);
    d.run(60, { buttons: BUTTON_JUMP });
    expect(Math.abs(d.m.speed)).toBeLessThan(1);
  });
});

describe('rigid driving: momentum up steep slopes', () => {
  /** Up a 50 degree slab from the given entry speed, throttle held: the most it climbs (m up) and its speed at the foot. */
  const climb = (speed: number, deg = 50) => {
    const a = (deg * Math.PI) / 180;
    const L = 16;
    const x0 = 90;
    const d = drive([block('slope', x0 + (L / 2) * Math.cos(a) + 0.3 * Math.sin(a), 16, [6, 0.6, L], a, (L / 2) * Math.sin(a) - 0.3 * Math.cos(a))], { at: [8, 0, 16] });
    d.run(20);
    let top = 0;
    let atFoot = 0;
    for (let k = 0; k < 900; k++) {
      d.run(1, { forward: d.m.pos.x < x0 - 4 ? speed / 18 : 1 });
      if (d.m.pos.x < x0 - 3.5) atFoot = d.m.speed;
      top = Math.max(top, d.m.pos.y);
    }
    d.save(`climb${speed}`);
    return { top, atFoot };
  };

  it('speed carries it further up a slope too steep to drive up', () => {
    const r = [6, 12, 18].map((v) => climb(v));
    if (process.env.DRIVE_TRACE) writeFileSync(`${process.env.DRIVE_TRACE}/climb.txt`, r.map((x, i) => `${[6, 12, 18][i]} m/s (at the foot ${x.atFoot.toFixed(1)}): ${x.top.toFixed(2)} m up`).join('\n'));
    // (The slab's top is 12.3 m up.)
    expect(r[0]!.top).toBeLessThan(8);
    // Clearly further with speed: momentum, not just the tyres. (Driving physics 4: flat out, the nose meets the slab's
    // foot hard, a real contact with the 50° face, and it carries about as far as from 12 m/s; driving physics 3's 92 %
    // speed keep carried it over the top.)
    expect(r[1]!.top).toBeGreaterThan(r[0]!.top + 1);
    expect(r[2]!.top).toBeGreaterThan(r[0]!.top + 3);
  });
});

describe('rigid driving: stairs and walls', () => {
  /** A flight of `n` steps (`rise` and `run` m, 8 m wide) up toward +x from x 30, a 30 m landing on top. */
  const stairs = (n: number, rise: number, run: number): MapEntity[] => {
    const out: MapEntity[] = [];
    for (let i = 0; i < n; i++) out.push(block(`step${i}`, 30 + i * run + run / 2, 16, [8, (i + 1) * rise, run]));
    out.push(block('landing', 30 + n * run + 15, 16, [8, n * rise, 30]));
    return out;
  };
  const up = (blocks: MapEntity[], forward: number) => {
    const d = drive(blocks);
    d.run(20);
    let top = 0;
    let at = -1;
    // Upright a second after it got to the top (it then drives on off the landing's far end, a 4 m drop).
    let upTop = -1;
    const goal = Math.max(...blocks.map((b) => ((b as { size: [number, number, number] }).size[1]))) - 0.1;
    const tr: string[] = [];
    d.run(1200, { forward }, () => {
      top = Math.max(top, d.m.pos.y);
      if (at < 0 && d.m.pos.y > goal) at = d.match.tick;
      if (at >= 0 && d.match.tick === at + 60) upTop = uprightness(d.m.rigid!);
      const r = d.m.rigid!;
      tr.push(`${d.m.pos.x.toFixed(2)} z ${d.m.pos.z.toFixed(2)} y ${d.m.pos.y.toFixed(2)} sp ${d.m.speed.toFixed(2)} p ${d.m.susp!.p.toFixed(2)} yaw ${d.m.yaw.toFixed(2)} comp ${r.comp.map((c) => c.toFixed(2))} hull ${r.hull} c ${r.contact} sl ${r.sliding}`);
    });
    if (process.env.DRIVE_TRACE) writeFileSync(`${process.env.DRIVE_TRACE}/stairs-${forward}-${blocks.length}.txt`, tr.join('\n'));
    return { top, x: d.m.pos.x, up: at < 0 ? uprightness(d.m.rigid!) : upTop, seconds: at < 0 ? Infinity : at / 60 };
  };

  it("drives up the kit's stairs (0.25 m risers, 0.5 m runs: core.stairs) at a crawl and at speed, and a steeper flight at speed", () => {
    const res: string[] = [];
    for (const [rise, run, forward] of [
      [0.25, 0.5, 0.35],
      [0.25, 0.5, 0.8],
      [0.2, 0.35, 0.8],
    ] as const) {
      const n = Math.round(4 / rise / (rise === 0.25 ? 1 : 2.5));
      const r = up(stairs(n, rise, run), forward);
      res.push(`${n} x ${rise}/${run} at throttle ${forward}: ${r.top.toFixed(2)} m of ${(n * rise).toFixed(2)} in ${r.seconds.toFixed(1)} s, up ${r.up.toFixed(2)}`);
      expect(r.top, `rise ${rise}, run ${run}, throttle ${forward}`).toBeGreaterThan(n * rise - 0.15);
      expect(r.up).toBeGreaterThan(0.8);
    }
    if (process.env.DRIVE_TRACE) writeFileSync(`${process.env.DRIVE_TRACE}/stairs.txt`, res.join('\n'));
  });

  it('a wall is still a wall: 1.2 m high, flat out, it does not climb it', () => {
    const r = up([block('wall', 32, 16, [6, 1.2, 1])], 1);
    expect(r.top).toBeLessThan(1.1);
    expect(r.x).toBeLessThan(32);
  });
});

describe('driving physics 4: the snags (the hull a Rapier body)', () => {
  /** Along +x at `speed` (held), the sharp ticks (1 m/s or 1.5 rad/s in a tick: driveSnags.test.ts) over x0..x1. */
  const across = (blocks: MapEntity[], speed: number, x0: number, x1: number) => {
    const d = drive(blocks);
    d.run(20);
    let sharp = 0;
    let slowest = Infinity;
    let worstPitch = 0;
    rigidTrace.sink = (t) => {
      if (t.pos.x < x0 || t.pos.x > x1) return;
      const dv = Math.abs(Math.hypot(t.vel1.x, t.vel1.z) - Math.hypot(t.vel0.x, t.vel0.z));
      const dw = Math.hypot(t.spin1.x - t.spin0.x, t.spin1.y - t.spin0.y, t.spin1.z - t.spin0.z);
      if (dv >= 1 || dw >= 1.5) sharp++;
    };
    try {
      for (let k = 0; k < 600 && d.m.pos.x < x1; k++)
        d.run(1, { forward: d.m.speed < speed ? 1 : speed / 18 }, () => {
          if (d.m.pos.x > x0 && d.m.pos.x < x1) {
            slowest = Math.min(slowest, d.m.speed);
            worstPitch = Math.max(worstPitch, Math.abs(d.m.susp!.p));
          }
        });
    } finally {
      rigidTrace.sink = null;
    }
    return { sharp, slowest, worstPitch, x: d.m.pos.x, up: uprightness(d.m.rigid!) };
  };

  it('parked and empty it settles and then stays exactly where it is (it used to creep: a box moving under sight lines)', () => {
    const match = new Match(strip(), rules, 1);
    const m = mountOf(match);
    for (let k = 0; k < 120; k++) match.step();
    const at = { ...m.pos };
    for (let k = 0; k < 1800; k++) match.step();
    expect(m.pos).toEqual(at);
    // A push wakes it.
    (m as unknown as { push: { x: number; z: number } }).push = { x: 3, z: 0 };
    for (let k = 0; k < 30; k++) match.step();
    expect(m.pos.x - at.x).toBeGreaterThan(0.2);
  });

  it('a seam between two floor slabs (1 cm apart in height) at 8 m/s: nothing (it froze there on the coverage map once)', () => {
    const r = across([block('slabA', 40, 16, [8, 0.2, 20], 0, 0), block('slabB', 60, 16, [8, 0.21, 20], 0, 0)], 8, 45, 58);
    expect(r.sharp).toBe(0);
    expect(r.slowest).toBeGreaterThan(7);
    expect(r.x).toBeGreaterThan(58);
  });

  it('kerbs: a 15 cm kerb across the way at 8 and 16 m/s: a bump on the springs, never a stop', () => {
    for (const v of [8, 16]) {
      const r = across([block('kerb', 50, 16, [8, 0.15, 0.6])], v, 46, 56);
      expect(r.slowest, `${v} m/s`).toBeGreaterThan(v * 0.8);
      expect(r.up).toBeGreaterThan(0.95);
      expect(r.sharp, `${v} m/s`).toBeLessThanOrEqual(2);
    }
  });

  it('a rock taller than the tyres reach (a 1.2 m box) at 12 m/s: stopped or thrown by the contact, never climbed (owner 3a)', () => {
    const d = drive([block('rock', 40, 16, [1.6, 1.2, 1.6])]);
    d.run(20);
    let top = 0;
    let slowest = Infinity;
    d.run(240, { forward: d.m.speed < 12 ? 1 : 0.66 }, () => {
      top = Math.max(top, d.m.pos.y);
      if (d.m.pos.x > 36) slowest = Math.min(slowest, Math.abs(d.m.speed));
    });
    expect(top).toBeLessThan(1.1);
    expect(slowest).toBeLessThan(6);
    expect(d.m.pos.x).toBeLessThan(40);
  });

  it('landings are the springs and the hull: no levelling in the air (owner 2a), and the hull lands it when the springs run out', () => {
    // Off the 1 m kicker flat out, hands off in the air: the body flies as it left the lip (no torque but the drag).
    const d = drive([block('ramp', 42, 16, [6, 0.4, 7], 0.3)]);
    d.run(20);
    const spins: number[] = [];
    let landed = false;
    rigidTrace.sink = (t) => {
      if (t.contact === 0 && !t.hullContacts) spins.push(Math.hypot(t.spin1.x, t.spin1.z) - Math.hypot(t.spin0.x, t.spin0.z));
      else if (spins.length > 10) landed = true;
    };
    try {
      for (let k = 0; k < 300 && !landed; k++) d.run(1, { forward: 1 });
    } finally {
      rigidTrace.sink = null;
    }
    expect(spins.length).toBeGreaterThan(20);
    // In the air the pitch and roll spin only dies by the small drag (0.15/s): nothing steers it level. (The first tick
    // still had wheels down in its first substep.)
    for (const ds of spins.slice(1)) expect(Math.abs(ds)).toBeLessThan(0.05);
    // Dropped from 9 m onto flat ground, the springs run out and the hull meets the ground (Rapier), then it sits up.
    const fall = drive([], { at: [20, 9, 16] });
    let hull = false;
    fall.run(120, {}, () => (hull ||= fall.m.rigid!.hull));
    expect(hull).toBe(true);
    expect(uprightness(fall.m.rigid!)).toBeGreaterThan(0.95);
    expect(fall.m.rigid!.contact).toBe(4);
  });
});

describe('tuning probes (DRIVE_TRACE)', () => {
  it.runIf(!!process.env.DRIVE_TRACE)('turns at 6, 10 and 17 m/s', () => {
    const out: string[] = [];
    for (const v of [6, 10, 17]) {
      const d = drive();
      d.run(30);
      let k = 0;
      while (d.m.speed < v && k++ < 400) d.run(1, { forward: 1 });
      let turned = 0;
      let last = d.m.yaw;
      const spin = () => {
        turned += Math.atan2(Math.sin(d.m.yaw - last), Math.cos(d.m.yaw - last));
        last = d.m.yaw;
      };
      let maxRoll = 0;
      d.run(90, { forward: v / 18, right: 1 }, () => (spin(), (maxRoll = Math.max(maxRoll, Math.abs(d.m.susp!.r)))));
      const y1 = turned;
      d.run(60, { forward: v / 18, right: 1 }, spin);
      out.push(`v ${v}: yaw rate ${(turned - y1).toFixed(2)} rad/s (first 1.5 s ${(y1 / 1.5).toFixed(2)}), speed ${d.m.speed.toFixed(1)}, slide ${d.m.slide.toFixed(2)}, max roll ${maxRoll.toFixed(2)}, up ${uprightness(d.m.rigid!).toFixed(2)}`);
      d.save(`turn${v}`);
    }
    writeFileSync(`${process.env.DRIVE_TRACE}/turns.txt`, out.join('\n'));
  });
  it.runIf(!!process.env.DRIVE_TRACE)('cost: a driven buggy, rigid against classic', () => {
    const time = (mode: 'classic' | 'rigid') => {
      const d = drive([block('ramp', 42, 16, [6, 0.4, 7], 0.3)], { drive: mode });
      d.run(60);
      const t0 = performance.now();
      for (let k = 0; k < 3; k++) {
        d.run(150, { forward: 1, right: k === 1 ? 0.5 : 0 });
        d.run(150, { forward: -1 });
      }
      return (performance.now() - t0) / 900;
    };
    time('rigid');
    const out = [];
    for (let i = 0; i < 3; i++) out.push(`classic ${time('classic').toFixed(3)} ms a tick, rigid ${time('rigid').toFixed(3)} ms a tick (whole match step)`);
    writeFileSync(`${process.env.DRIVE_TRACE}/cost.txt`, out.join('\n'));
  });
});
