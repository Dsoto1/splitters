import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, it } from 'vitest';
import { BUTTON_USE, getProp, initPhysics, loadMap, rulesForMode, type MapDocument, type MapEntity, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { rigidTrace, type RigidTraceTick } from '../src/sim/wheelPhysics.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * The driving-feel diagnosis (owner, 2026-11-16: "we seem to get snagged on invisible elements that cause the buggy to
 * stutter or act like it hit something ... landing jumps dont feel good, they feel.. programmed"). The Troop Buggy is
 * driven by an autopilot round a map's open places (spawns and pickups) for a few minutes; every tick where its speed
 * or its spin changes sharply is put down to what acted on it that tick (wheelPhysics.ts rigidTrace): the hull sweep
 * (and what it met: terrain, a level box, a prop, an environment shape), a hull corner, a rolled-up corner, a bump
 * stop, the 92 % speed keep, a step-up, the air levelling, the tyres sliding, or the springs alone (the ground). And
 * each landing: what decided it. DRIVE_TRACE=<dir> runs it and writes snags-<map>.txt there (docs/DRIVING_PHYSICS_PLAN.md,
 * "Driving physics 3").
 */
const SHARP_SPEED = 1.0; // m/s in one tick (60 m/s²: three times what the engine or brakes do)
const SHARP_SPIN = 1.5; // rad/s in one tick

type Physics = {
  sweepChassis: (...a: unknown[]) => { moved: unknown; normals: unknown[] };
  chassisController: { numComputedCollisions(): number; computedCollision(i: number): { collider?: { handle: number } } | null };
  boxAt(h: number): { kind: string; sourceId: string } | undefined;
  shapeAt(h: number): { sourceId: string } | undefined;
  raycastHit(o: unknown, d: unknown, l: number): { dist: number; handle: number } | null;
};

function drive(file: string, ticks: number, seed: number): string {
  const r = loadMap(readFileSync(fileURLToPath(new URL(`../../../maps/${file}.json`, import.meta.url)), 'utf8'));
  if (!r.ok) throw new Error(file);
  const first = r.map.entities.find((e: MapEntity) => e.kind === 'mount' && (e as { model: string }).model === 'troop_buggy');
  const map: MapDocument = { ...r.map, entities: r.map.entities.filter((e: MapEntity) => e.kind !== 'mount' || e === first) };
  const match = new Match(map, { ...rulesForMode(map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0 }, seed);
  const me = match.addHuman('me')! as Combatant;
  let seq = 0;
  const send = (i: Partial<PlayerInput> = {}) => match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: me.yaw, pitch: 0, buttons: 0, ...i }]);
  for (let k = 0; k < 200; k++) {
    send();
    match.step();
  }
  const mounts = (match as unknown as { mounts: { def: { id: string }; pos: { x: number; y: number; z: number }; yaw: number; speed: number; health: number; alive: boolean }[] }).mounts;
  const m = mounts.find((x) => x.def.id === 'troop_buggy')!;
  me.move = { pos: { x: m.pos.x + 2.4, y: m.pos.y + 0.3, z: m.pos.z }, velY: 0, grounded: true };
  send({ buttons: BUTTON_USE });
  match.step();
  if (!me.mount) throw new Error('not in');
  // What the sweep met each tick (collider handles), and what kind of thing each is.
  const ph = (match as unknown as { physics: Physics }).physics;
  const orig = ph.sweepChassis.bind(ph);
  let met: number[] = [];
  ph.sweepChassis = (...a: unknown[]) => {
    const res = orig(...a);
    met = [];
    const n = ph.chassisController.numComputedCollisions();
    for (let i = 0; i < n; i++) {
      const h = ph.chassisController.computedCollision(i)?.collider?.handle;
      if (h !== undefined) met.push(h);
    }
    return res;
  };
  const what = (h: number): string => {
    const b = ph.boxAt(h);
    if (b) {
      if (b.kind === 'prop') {
        const e = map.entities.find((x) => x.id === b.sourceId) as { model?: string } | undefined;
        const def = e?.model ? getProp(e.model) : undefined;
        const ratio = def?.collision && def.size ? (def.collision[0] * def.collision[2]) / (def.size[0] * def.size[2]) : NaN;
        return `prop ${e?.model ?? b.sourceId} (collision/mesh footprint ${ratio.toFixed(2)})`;
      }
      return `${b.kind} box`;
    }
    const s = ph.shapeAt(h);
    if (s) return `environment ${s.sourceId.replace(/_\d+$/, '')}`;
    return 'terrain';
  };
  // Where to go: the map's open places.
  const places = map.entities.filter((e) => e.kind === 'spawn' || e.kind === 'pickup').map((e) => ({ x: e.position[0], z: e.position[2] }));
  let rng = seed * 9301 + 49297;
  const rand = () => ((rng = (rng * 9301 + 49297) % 233280) / 233280);
  let goal = places[Math.floor(rand() * places.length)]!;
  const trace: (RigidTraceTick & { met: number[]; tick: number; reset: boolean })[] = [];
  let reset = false;
  rigidTrace.sink = (t) => trace.push({ ...t, met, tick: k, reset });
  let k = 0;
  let stall = 0;
  let best = Infinity;
  let dist = 0;
  let last = { ...m.pos };
  for (; k < ticks; k++) {
    reset = false;
    const dx = goal.x - m.pos.x;
    const dz = goal.z - m.pos.z;
    if (Math.hypot(dx, dz) < 8) {
      goal = places[Math.floor(rand() * places.length)]!;
      best = Infinity;
    }
    let d = Math.atan2(dx, dz) - m.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const right = Math.max(-1, Math.min(1, d * 1.5));
    send({ forward: Math.abs(d) > 1.2 ? 0.5 : 1, right, yaw: me.yaw });
    match.step();
    m.health = 450;
    me.health = 100;
    const step = Math.hypot(m.pos.x - last.x, m.pos.z - last.z);
    dist += step;
    last = { ...m.pos };
    const gd = Math.hypot(goal.x - m.pos.x, goal.z - m.pos.z);
    if (gd < best - 3) {
      best = gd;
      stall = 0;
    } else stall++;
    if (stall > 300 || !m.alive || !me.mount) {
      // Wedged or flipped: start again from the next place.
      if (!me.mount) break;
      const p = places[Math.floor(rand() * places.length)]!;
      m.pos = { x: p.x, y: m.pos.y + 3, z: p.z };
      m.yaw = rand() * Math.PI * 2;
      last = { ...m.pos };
      stall = 0;
      best = Infinity;
      goal = places[Math.floor(rand() * places.length)]!;
      reset = true;
    }
  }
  rigidTrace.sink = null;

  // ---- sharp changes, put down to what acted.
  const counts = new Map<string, number>();
  const things = new Map<string, number>();
  const cornerOn = new Map<string, number>();
  const note = (key: string, map_: Map<string, number> = counts) => map_.set(key, (map_.get(key) ?? 0) + 1);
  let sharp = 0;
  let prev: (typeof trace)[number] | null = null;
  const examples: string[] = [];
  for (const t of trace) {
    if (prev && !t.reset && !prev.reset) {
      const outside = Math.hypot(t.vel0.x - prev.vel1.x, t.vel0.y - prev.vel1.y, t.vel0.z - prev.vel1.z);
      if (outside > 0.2) note('speed set from outside the step (Match)');
    }
    prev = t;
    if (t.reset) continue;
    const s0 = Math.hypot(t.vel0.x, t.vel0.z);
    const s1 = Math.hypot(t.vel1.x, t.vel1.z);
    const dv = Math.abs(s1 - s0);
    const dw = Math.hypot(t.spin1.x - t.spin0.x, t.spin1.y - t.spin0.y, t.spin1.z - t.spin0.z);
    if (dv < SHARP_SPEED && dw < SHARP_SPIN) continue;
    sharp++;
    const causes: string[] = [];
    if (t.sweepBlocked > 0.02 || t.sweepImpact > 0.3) {
      const kinds = [...new Set(t.met.map(what))];
      const up = t.sweepNormals.some((n) => n.y > 0.5);
      causes.push(`sweep${up ? ' (ground under the hull)' : ''}`);
      for (const kd of kinds) note(`${kd}${up ? ', from below' : ''}`, things);
    }
    if (t.hardCorners || t.rollCorners) {
      for (const c of t.corners) {
        const h = ph.raycastHit({ x: c.at.x + c.n.x * 0.2, y: c.at.y + c.n.y * 0.2, z: c.at.z + c.n.z * 0.2 }, { x: -c.n.x, y: -c.n.y, z: -c.n.z }, 0.4);
        note(`${c.roll ? 'rolled-up corner' : 'hull corner'} on ${h ? what(h.handle) : '?'}, facing ${c.n.y > 0.5 ? 'up (ground)' : c.n.y < -0.5 ? 'down' : 'sideways (a wall, a rock face)'}`, cornerOn);
      }
    }
    if (t.hardCorners) causes.push('hull corner');
    if (t.rollCorners) causes.push('rolled-up corner');
    if (t.bump) causes.push('bump stop');
    if (t.keep > 0.2) causes.push('speed keep');
    if (t.stepUps) causes.push('step-up');
    if (t.airLevel > 2) causes.push('air levelling');
    if (t.sliding >= 4) causes.push('grip cut');
    const key = causes.length ? causes.join(' + ') : t.contact === 0 ? 'air (gravity, air control)' : 'springs and tyres only (the ground)';
    note(key);
    if (examples.length < 25 && causes.length) examples.push(`tick ${t.tick} at (${t.pos.x.toFixed(1)}, ${t.pos.y.toFixed(1)}, ${t.pos.z.toFixed(1)}): speed ${s0.toFixed(1)} -> ${s1.toFixed(1)}, spin jump ${dw.toFixed(1)}; ${key}; met ${[...new Set(t.met.map(what))].join(', ') || '-'}`);
  }
  // ---- landings (6+ ticks in the air, then down): what decided the first ten ticks after.
  const land = new Map<string, number>();
  let air = 0;
  let landings = 0;
  for (let i = 0; i < trace.length; i++) {
    const t = trace[i]!;
    if (t.contact === 0 && !t.hardCorners && !t.rollCorners) {
      air++;
      continue;
    }
    if (air >= 6) {
      landings++;
      const seen = new Set<string>();
      for (let j = i - 3; j < Math.min(trace.length, i + 10); j++) {
        const u = trace[j];
        if (!u) continue;
        if (j < i && u.airLevel > 2) seen.add('air levelling before touchdown');
        if (j >= i && u.bump) seen.add('bump stop');
        if (j >= i && u.hardCorners) seen.add('hull corner');
        if (j >= i && u.keep > 0.2) seen.add('speed keep');
        if (j >= i && (u.sweepBlocked > 0.02 || u.sweepImpact > 0.3)) seen.add('sweep');
      }
      for (const sname of seen) note(sname, land);
    }
    air = 0;
  }
  const km = dist / 1000;
  const lines = [
    `${map.metadata.name}: ${ticks} ticks (${(ticks / 60).toFixed(0)} s), ${dist.toFixed(0)} m driven; ${sharp} sharp ticks (${(sharp / km).toFixed(0)} a km): speed ${SHARP_SPEED} m/s or spin ${SHARP_SPIN} rad/s in a tick`,
    '',
    'Sharp ticks by what acted:',
    ...[...counts].sort((a, b) => b[1] - a[1]).map(([key, n]) => `  ${String(n).padStart(4)}  ${(n / km).toFixed(0).padStart(4)}/km  ${key}`),
    '',
    'What the hull corners met on those ticks (each corner):',
    ...[...cornerOn].sort((a, b) => b[1] - a[1]).map(([key, n]) => `  ${String(n).padStart(4)}  ${key}`),
    '',
    'What the hull sweep met on those ticks:',
    ...[...things].sort((a, b) => b[1] - a[1]).map(([key, n]) => `  ${String(n).padStart(4)}  ${key}`),
    '',
    `Landings: ${landings}; what acted in them (3 ticks before to 10 after):`,
    ...[...land].sort((a, b) => b[1] - a[1]).map(([key, n]) => `  ${String(n).padStart(4)}  ${key}`),
    '',
    'Examples:',
    ...examples.map((e) => `  ${e}`),
  ];
  return lines.join('\n');
}

describe.runIf(!!process.env.DRIVE_TRACE)('driving snags', () => {
  for (const file of ['canyon', 'test_coverage']) {
    it(file, () => {
      const out = drive(file, Number(process.env.DRIVE_TICKS ?? 10800), 7);
      mkdirSync(process.env.DRIVE_TRACE!, { recursive: true });
      writeFileSync(`${process.env.DRIVE_TRACE}/snags-${file}${process.env.DRIVE_TAG ?? ''}.txt`, out);
    }, 600_000);
  }
});
