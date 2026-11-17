import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_JUMP, BUTTON_USE, DEFAULT_DEATHMATCH_RULES, PhysicsWorld, SNAPSHOT_INTERVAL_TICKS, buildMapGeometry, environmentShapes, initPhysics, loadMap, mapTerrainMesh, rigidOf, yawPitchRoll, type MapDocument, type MapEntity, type PlayerInput } from '@tiletrigger/shared';
import { Match, initNavigation, type Combatant } from '@tiletrigger/shared/match';
import { MountState } from '../src/game/mountState.ts';
import { VehiclePrediction } from '../src/game/vehiclePrediction.ts';
import { makeMap } from '../../shared/test/helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * The driver's prediction of a rigid vehicle over a simulated link (docs/DRIVING_PHYSICS_PLAN.md, "Netcode", and
 * "Judged"): a host Match and a client's prediction physics, MountState and VehiclePrediction, with each input
 * reaching the host and each snapshot reaching the client after a one-way delay plus jitter (seeded). Measured: how
 * far the predicted vehicle is from where the host has it after the same input, the corrections, and how far the
 * vehicle would be drawn behind without prediction (the snapshots' pose, a round trip late).
 */

const block = (id: string, x: number, z: number, size: [number, number, number], pitch = 0): MapEntity =>
  ({ id, kind: 'block', position: [x, 0, z], yaw: Math.PI / 2, size, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120, ...(pitch ? { pitch } : {}) }) as MapEntity;

/** A long yard with a kicker, a kerb under the left wheels and room to turn. */
function course(): MapDocument {
  const tiles = [];
  for (let x = 0; x < 16; x++) for (let y = 0; y < 5; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return {
    ...map,
    entities: [
      ...map.entities,
      { id: 'mount_0', kind: 'mount' as const, position: [8, 0, 16], model: 'troop_buggy', yaw: Math.PI / 2, faction: null, respawnSeconds: null } as MapEntity,
      block('ramp', 42, 16, [6, 0.4, 7], 0.3),
      block('kerb', 80, 14.6, [1.6, 0.4, 5], 0.45),
    ],
  };
}

function canyon(): MapDocument {
  const r = loadMap(readFileSync(fileURLToPath(new URL('../../../maps/canyon.json', import.meta.url)), 'utf8'));
  if (!r.ok) throw new Error('canyon failed to load');
  return r.map;
}

/** A seeded stand-in for Math.random. */
const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

interface LagResult {
  rttMs: number;
  ticks: number;
  /** Predicted against the host after the same input (m): median, 95th percentile, worst. */
  err: { p50: number; p95: number; max: number };
  corrections: number;
  worstCorrection: number;
  /** Most the drawn vehicle moved in a frame beyond its own motion (a visible jump, m). */
  drawnJump: number;
  /** Without prediction: how far behind the host the snapshot pose is when it arrives (m): median and worst. */
  behind: { p50: number; max: number };
  airTicks: number;
  maxRoll: number;
}

const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0;

/** Drive the course for `ticks` with `script` over a link of `rttMs` (each way half, plus 0..jitterMs). */
function lagRun(map: MapDocument, rttMs: number, jitterMs: number, loss: number, ticks: number, script: (t: number) => Partial<PlayerInput>, pick?: (m: { def: { id: string }; pos: { x: number; z: number } }[]) => number): LagResult {
  const match = new Match(map, { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, timeLimitSeconds: 0, respawnDelayTicks: 100_000 }, 1);
  const c = match.addHuman('driver')! as Combatant;
  match.step();
  const mounts = (match as unknown as { mounts: { index: number; def: { id: string }; pos: { x: number; y: number; z: number }; yaw: number; rigid?: { pos: { x: number; y: number; z: number }; q: { x: number; y: number; z: number; w: number } } }[] }).mounts;
  const buggies = mounts.filter((m) => m.def.id === 'troop_buggy');
  const host = buggies[pick ? pick(buggies) : 0]!;
  c.move = { pos: { x: host.pos.x + Math.cos(host.yaw) * 2.4, y: host.pos.y + 0.3, z: host.pos.z - Math.sin(host.yaw) * 2.4 }, velY: 0, grounded: true };
  let seq = 0;
  const now = (i: Partial<PlayerInput>): PlayerInput => ({ seq: ++seq, forward: 0, right: 0, yaw: c.yaw, pitch: 0, buttons: 0, ...i });
  match.queueInputs(c.slot, [now({ buttons: BUTTON_USE })]);
  match.step();
  for (let i = 0; i < 30; i++) {
    match.queueInputs(c.slot, [now({})]);
    match.step();
  }
  expect(c.mount?.index).toBe(mounts.indexOf(host));
  // The client: its own prediction physics and copy of the mounts, as the session builds them.
  const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map), environmentShapes(map));
  const ms = new MountState(map, physics);
  ms.apply(match.mountSnapshots(), match.tick);
  const vp0 = match.privateState(c.slot)!.vp!;
  const cm = ms.mounts.get(host.index)!;
  const pred = new VehiclePrediction(host.index, cm.def, rigidOf(cm.def)!, physics, cm.body, vp0);
  const rand = seeded(7);
  // A lost packet comes a round trip and three packet gaps later, holding everything behind it (netLab.ts LossyLink).
  const oneWay = () => rttMs / 2 + rand() * jitterMs + (rand() < loss ? rttMs + 48 : 0);
  // In flight: inputs to the host, snapshots to the client, each with its arrival time (ms).
  const toHost: { at: number; input: PlayerInput }[] = [];
  const toClient: { at: number; ack: number; vp: number[]; mt: ReturnType<Match['mountSnapshots']>; tick: number; truth: { x: number; y: number; z: number } }[] = [];
  let lastIn = 0;
  let lastOut = 0;
  const pending: PlayerInput[] = [];
  const predicted = new Map<number, { x: number; y: number; z: number }>();
  const truth = new Map<number, { x: number; y: number; z: number }>();
  const errs: number[] = [];
  const behind: number[] = [];
  let drawnJump = 0;
  let lastDrawn: { x: number; y: number; z: number } | null = null;
  let lastState = { ...pred.state.pos };
  let airTicks = 0;
  let maxRoll = 0;
  const tickMs = 1000 / 60;
  for (let t = 0; t < ticks; t++) {
    const clock = t * tickMs;
    // Client: snapshots that have arrived, then this tick's input, predicted at once and sent.
    while (toClient.length && toClient[0]!.at <= clock) {
      const s = toClient.shift()!;
      ms.apply(s.mt, s.tick);
      while (pending.length && pending[0]!.seq <= s.ack) pending.shift();
      pred.reconcile(s.vp, pending);
      // Without prediction this is what you'd see now: the host's pose when it sent this, against where it is now.
      behind.push(Math.hypot(s.truth.x - host.pos.x, s.truth.z - host.pos.z));
    }
    const input = now({ yaw: c.yaw, ...script(t) });
    pred.step(input);
    pending.push(input);
    predicted.set(input.seq, { ...pred.state.pos });
    // Ordered delivery (reliable channel): never before the one sent earlier.
    lastIn = Math.max(lastIn, clock + oneWay());
    toHost.push({ at: lastIn, input });
    // Drawn this frame (one frame a tick): the correction fades; a jump is movement beyond the state's own.
    pred.fade(tickMs / 1000);
    const drawn = pred.pose(1).pos;
    if (lastDrawn) {
      const own = Math.hypot(pred.state.pos.x - lastState.x, pred.state.pos.y - lastState.y, pred.state.pos.z - lastState.z);
      drawnJump = Math.max(drawnJump, Math.hypot(drawn.x - lastDrawn.x, drawn.y - lastDrawn.y, drawn.z - lastDrawn.z) - own);
    }
    lastDrawn = drawn;
    lastState = { ...pred.state.pos };
    // Host: the inputs that have arrived, one tick.
    const arrived: PlayerInput[] = [];
    while (toHost.length && toHost[0]!.at <= clock) arrived.push(toHost.shift()!.input);
    if (arrived.length) match.queueInputs(c.slot, arrived);
    match.step();
    truth.set(c.lastSeq, { ...host.pos });
    if (host.rigid) {
      const ypr = yawPitchRoll(host.rigid.q);
      maxRoll = Math.max(maxRoll, Math.abs(ypr.roll));
    }
    if ((host as unknown as { airborne: boolean }).airborne) airTicks++;
    if (match.tick % SNAPSHOT_INTERVAL_TICKS === 0) {
      lastOut = Math.max(lastOut, clock + oneWay());
      toClient.push({ at: lastOut, ack: c.lastSeq, vp: match.privateState(c.slot)!.vp!, mt: match.mountSnapshots(), tick: match.tick, truth: { ...host.pos } });
    }
  }
  for (const [s, p] of predicted) {
    const h = truth.get(s);
    if (h) errs.push(Math.hypot(p.x - h.x, p.y - h.y, p.z - h.z));
  }
  return {
    rttMs,
    ticks,
    err: { p50: pct(errs, 0.5), p95: pct(errs, 0.95), max: Math.max(...errs) },
    corrections: pred.corrections,
    worstCorrection: pred.worstCorrection,
    drawnJump,
    behind: { p50: pct(behind, 0.5), max: Math.max(...behind) },
    airTicks,
    maxRoll,
  };
}

/** Flat out over the kicker, then a slalom, the kerb and a handbrake turn. */
const courseScript = (t: number): Partial<PlayerInput> => ({
  forward: t < 330 ? 1 : 0.8,
  right: t > 260 && t < 330 ? Math.sin(t / 12) * 0.6 : t > 420 && t < 470 ? 1 : 0,
  buttons: t > 430 && t < 450 ? BUTTON_JUMP : 0,
});

/** Canyon: out of the base and across the floor, weaving. */
const canyonScript = (t: number): Partial<PlayerInput> => ({ forward: 1, right: Math.sin(t / 50) * 0.8 });

describe('rigid vehicle prediction over a lagged link', () => {
  const results: LagResult[] = [];
  for (const [rtt, jitter, loss] of [
    [0, 0, 0],
    [100, 10, 0],
    [150, 20, 0],
    [150, 20, 0.02],
  ] as const) {
    it(`course at ${rtt} ms round trip (${jitter} ms jitter, ${loss * 100} % loss): the prediction stays with the host`, () => {
      const r = lagRun(course(), rtt, jitter, loss, 600, courseScript);
      results.push({ ...r, loss } as LagResult);
      expect(r.airTicks).toBeGreaterThan(15);
      // Predicted where the host ends up after the same input, within a few centimetres most of the time.
      expect(r.err.p50).toBeLessThan(0.05);
      expect(r.err.p95).toBeLessThan(0.5);
      // Nothing visible jumps: corrections fade in.
      expect(r.drawnJump).toBeLessThan(0.15);
      // Driving physics 4 (the hull a Rapier body; owner's answer 4a: up to about 10 cm, faded): its contacts replay
      // a little differently on the client (the solver's order over the world's colliders), never by much; a lost
      // packet's stall is the old story (the host went on without the input).
      if (!loss) expect(r.err.max).toBeLessThan(0.15);
      if (rtt >= 100) expect(r.behind.p50).toBeGreaterThan(r.err.p50 * 4);
    });
  }

  it.each([[150, 20]])('canyon at %i ms (%i ms jitter): terrain', (rtt, jitter) => {
    const map = canyon();
    const r = lagRun(map, rtt, jitter, 0, 900, canyonScript, (bs) => bs.reduce((best, m, i) => (Math.abs(m.pos.z) > Math.abs(bs[best]!.pos.z) ? i : best), 0));
    results.push({ ...r, rttMs: -rtt });
    expect(r.err.p50).toBeLessThan(0.1);
    expect(r.drawnJump).toBeLessThan(0.25);
    const out = process.env.DRIVE_TRACE;
    if (out) writeFileSync(`${out}/lag.json`, JSON.stringify(results, null, 1));
  }, 120_000);
});
