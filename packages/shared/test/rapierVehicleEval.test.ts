import RAPIER from '@dimforge/rapier3d-compat';
import { mkdirSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../src/index.ts';

beforeAll(() => initPhysics());

/**
 * Driving physics 3, the evaluation (docs/DRIVING_PHYSICS_PLAN.md, "Driving physics 3"): the Troop Buggy as a Rapier
 * dynamic rigid body on DynamicRayCastVehicleController, in a small world of its own (ground, a ramp, a rock). What the
 * driver's prediction needs of it: the same inputs give the same states (determinism on one machine), and a replay
 * from a state the host sent (position, rotation, velocities written into the body, then stepped) stays on the host's
 * path, although Rapier's contact caches (warm starting) aren't in that state. DRIVE_TRACE=<dir> writes rapier-eval.txt.
 */
type State = { p: RAPIER.Vector; q: RAPIER.Rotation; v: RAPIER.Vector; w: RAPIER.Vector };

function build() {
  const world = new RAPIER.World({ x: 0, y: -17, z: 0 });
  world.timestep = 1 / 60;
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, -0.5, 0));
  // A 1 m kicker 30 m ahead and a rock (a turned box) to the side of the run-out.
  world.createCollider(RAPIER.ColliderDesc.cuboid(2.5, 0.05, 3).setTranslation(0, 0.45, 30).setRotation({ x: Math.sin(-0.17), y: 0, z: 0, w: Math.cos(-0.17) }));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.8, 0.6, 0.8).setTranslation(1.6, 0.4, 55).setRotation({ x: 0, y: Math.sin(0.4), z: 0, w: Math.cos(0.4) }));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.0, 0).setCanSleep(false));
  // The Troop Buggy's box (1.17 x 0.5 x 2.28 half, the chassis tub only), 900 kg, centre of mass low.
  world.createCollider(RAPIER.ColliderDesc.cuboid(1.0, 0.3, 2.1).setTranslation(0, 0.25, 0).setMass(900).setFriction(0.5), body);
  const car = world.createVehicleController(body);
  for (const [x, z] of [[-1, 1.74], [1, 1.74], [-1, -1.86], [1, -1.86]] as const) {
    car.addWheel({ x, y: 0, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, 0.3, 0.42);
    const i = car.numWheels() - 1;
    car.setWheelSuspensionStiffness(i, 30);
    car.setWheelSuspensionCompression(i, 3.5);
    car.setWheelSuspensionRelaxation(i, 4.5);
    car.setWheelMaxSuspensionTravel(i, 0.25);
    car.setWheelFrictionSlip(i, 1.6);
  }
  return { world, body, car };
}

function control(car: RAPIER.DynamicRayCastVehicleController, k: number): void {
  const steer = k > 420 && k < 470 ? 0.35 : k > 520 ? 0.25 * Math.sin(k / 30) : 0;
  for (let i = 0; i < 4; i++) {
    // Toward 18 m/s (the Troop Buggy's top speed), as our engine model does.
    const v = car.currentVehicleSpeed();
    car.setWheelEngineForce(i, i >= 2 ? 4000 * Math.max(-1, Math.min(1, (18 - v) / 3)) : 0);
    car.setWheelSteering(i, i < 2 ? steer : 0);
  }
}

const read = (b: RAPIER.RigidBody): State => ({ p: { ...b.translation() }, q: { ...b.rotation() }, v: { ...b.linvel() }, w: { ...b.angvel() } });
const write = (b: RAPIER.RigidBody, s: State) => {
  b.setTranslation(s.p, true);
  b.setRotation(s.q, true);
  b.setLinvel(s.v, true);
  b.setAngvel(s.w, true);
};
const dist = (a: RAPIER.Vector, b: RAPIER.Vector) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe.runIf(!!process.env.DRIVE_TRACE)('Rapier vehicle evaluation', () => {
  it('determinism, replay from a sent state, cost', () => {
    const N = 900;
    const run = () => {
      const { world, body, car } = build();
      const out: State[] = [];
      let ms = 0;
      for (let k = 0; k < N; k++) {
        control(car, k);
        const t0 = performance.now();
        car.updateVehicle(world.timestep);
        world.step();
        ms += performance.now() - t0;
        out.push(read(body));
      }
      return { out, ms };
    };
    const a = run();
    const b = run();
    let same = 0;
    for (let k = 0; k < N; k++) if (dist(a.out[k]!.p, b.out[k]!.p) === 0 && a.out[k]!.q.w === b.out[k]!.q.w) same++;
    // Replay as the prediction does: every `every` ticks the state is written into a second world's body (rounded as
    // the wire rounds it), then the next ticks are stepped there; compared with the host's path after `ahead` ticks.
    const lines: string[] = [];
    const host = a.out;
    for (const ahead of [6, 9]) {
      const { world, body, car } = build();
      let worst = 0;
      const errs: number[] = [];
      for (let k = 10; k + ahead < N; k += 5) {
        const s = host[k - 1]!;
        const r = (v: number, m: number) => Math.round(v * m) / m;
        write(body, { p: { x: r(s.p.x, 1e4), y: r(s.p.y, 1e4), z: r(s.p.z, 1e4) }, q: { x: r(s.q.x, 1e6), y: r(s.q.y, 1e6), z: r(s.q.z, 1e6), w: r(s.q.w, 1e6) }, v: { x: r(s.v.x, 1e4), y: r(s.v.y, 1e4), z: r(s.v.z, 1e4) }, w: { x: r(s.w.x, 1e4), y: r(s.w.y, 1e4), z: r(s.w.z, 1e4) } });
        for (let j = 0; j < ahead; j++) {
          control(car, k + j);
          car.updateVehicle(world.timestep);
          world.step();
        }
        const e = dist(read(body).p, host[k + ahead - 1]!.p);
        errs.push(e);
        worst = Math.max(worst, e);
      }
      errs.sort((x, y) => x - y);
      lines.push(`replay ${ahead} ticks from a sent state: p50 ${(errs[Math.floor(errs.length / 2)]! * 100).toFixed(2)} cm, p95 ${(errs[Math.floor(errs.length * 0.95)]! * 100).toFixed(2)} cm, worst ${(worst * 100).toFixed(2)} cm`);
    }
    const end = host[N - 1]!;
    const peak = Math.max(...host.map((s) => s.p.y));
    lines.unshift(
      `two runs, same inputs: ${same} of ${N} ticks identical`,
      `cost: ${((a.ms / N) * 1000).toFixed(0)} µs a tick (vehicle update and a world step, this box)`,
      `drive: ended at (${end.p.x.toFixed(1)}, ${end.p.y.toFixed(2)}, ${end.p.z.toFixed(1)}), top ${Math.max(...host.map((s) => Math.hypot(s.v.x, s.v.z))).toFixed(1)} m/s, highest ${peak.toFixed(2)} m`,
    );
    mkdirSync(process.env.DRIVE_TRACE!, { recursive: true });
    writeFileSync(`${process.env.DRIVE_TRACE}/rapier-eval.txt`, lines.join('\n'));
    expect(same).toBe(N);
  }, 120_000);
});
