import RAPIER from '@dimforge/rapier3d-compat';
import { mkdirSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, it } from 'vitest';
import { MOUNT_DEFS, PhysicsWorld, initPhysics, newRigid, rigidOf, stepRigid, type WorldBox } from '../src/index.ts';

beforeAll(() => initPhysics());

/**
 * Frame strips for the owner (docs/DRIVING_PHYSICS_PLAN.md, "Driving physics 3"): the Troop Buggy flat out over a
 * 1.5 m kicker, then its right wheels into a rock, side on; once as it drives now (sim/wheelPhysics.ts) and once as a
 * Rapier dynamic body on DynamicRayCastVehicleController (the candidate), over the same boxes. DRIVE_TRACE=<dir>
 * writes strip-now.csv and strip-rapier.csv (tick, x, y, z, qx, qy, qz, qw); tools in the scratchpad draw them.
 */
const KICKER = { centre: [0, 0.45, 30], half: [2.5, 0.05, 3], pitch: 0.34 } as const;
const ROCK = { centre: [1.6, 0.4, 55], half: [0.8, 0.6, 0.8], yaw: 0.8 } as const;
const TICKS = 330;

describe.runIf(!!process.env.DRIVE_TRACE)('driving frame strips', () => {
  it('now and the Rapier candidate', () => {
    const box = (c: readonly number[], h: readonly number[], extra: Partial<WorldBox>): WorldBox => ({ min: [c[0]! - h[0]!, c[1]! - h[1]!, c[2]! - h[2]!], max: [c[0]! + h[0]!, c[1]! + h[1]!, c[2]! + h[2]!], kind: 'solid', sourceId: 'x', ...extra });
    const boxes = [box([0, -0.5, 0], [200, 0.5, 200], { kind: 'floor' }), box(KICKER.centre, KICKER.half, { pitch: KICKER.pitch }), box(ROCK.centre, ROCK.half, { yaw: ROCK.yaw })];
    // Now: the rigid step against a PhysicsWorld of those boxes.
    const physics = new PhysicsWorld(boxes);
    const def = MOUNT_DEFS.troop_buggy!;
    const t = rigidOf(def)!;
    const body = physics.createBox({ x: 0, y: def.half[1], z: 0 }, { x: def.half[0], y: def.half[1], z: def.half[2] });
    const probe = physics.createChassisProbe(t.probeR, t.probeHalf);
    physics.commit();
    const world = physics.chassisWorld(probe, body);
    const s = newRigid(t, { x: 0, y: 0, z: 0 }, 0);
    const now: string[] = ['t,x,y,z,qx,qy,qz,qw'];
    for (let k = 0; k < TICKS; k++) {
      stepRigid(s, t, world, { forward: 1, right: 0, brake: false, piloted: true }, 1 / 60);
      const up = { x: 0, y: def.half[1], z: 0 };
      void up;
      physics.setBoxTransform(body, { x: s.pos.x, y: s.pos.y + def.half[1], z: s.pos.z }, s.q);
      physics.commit();
      now.push([k, s.pos.x, s.pos.y, s.pos.z, s.q.x, s.q.y, s.q.z, s.q.w].map((v) => +v.toFixed(4)).join(','));
    }
    // The candidate: a Rapier dynamic body on its raycast vehicle controller, over the same boxes.
    const rw = new RAPIER.World({ x: 0, y: -17, z: 0 });
    rw.timestep = 1 / 60;
    rw.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, -0.5, 0));
    rw.createCollider(RAPIER.ColliderDesc.cuboid(...KICKER.half).setTranslation(...KICKER.centre).setRotation({ x: Math.sin(-KICKER.pitch / 2), y: 0, z: 0, w: Math.cos(KICKER.pitch / 2) }));
    rw.createCollider(RAPIER.ColliderDesc.cuboid(...ROCK.half).setTranslation(...ROCK.centre).setRotation({ x: 0, y: Math.sin(ROCK.yaw / 2), z: 0, w: Math.cos(ROCK.yaw / 2) }));
    // Its origin at the feet, as ours: the chassis box from 0.24 m (ride height) to 1.6 m, centre of mass 0.85 m up.
    const rb = rw.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0, 0).setCanSleep(false));
    rw.createCollider(RAPIER.ColliderDesc.cuboid(def.half[0] * 0.9, 0.5, def.half[2] * 0.95).setTranslation(0, 0.9, 0).setMassProperties(900, { x: 0, y: 0.85, z: 0 }, { x: 900 * 0.5, y: 900 * 0.6, z: 900 * 0.25 }, { x: 0, y: 0, z: 0, w: 1 }).setFriction(0.6), rb);
    const car = rw.createVehicleController(rb);
    for (const [x, z] of t.points) {
      car.addWheel({ x, y: t.hubY + 0.2, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, 0.2, t.radius);
      const i = car.numWheels() - 1;
      car.setWheelSuspensionStiffness(i, 28);
      car.setWheelSuspensionCompression(i, 2.6);
      car.setWheelSuspensionRelaxation(i, 3.4);
      car.setWheelMaxSuspensionTravel(i, 0.25);
      car.setWheelFrictionSlip(i, 1.4);
      car.setWheelMaxSuspensionForce(i, 60000);
    }
    const rap: string[] = ['t,x,y,z,qx,qy,qz,qw'];
    for (let k = 0; k < TICKS; k++) {
      const v = car.currentVehicleSpeed();
      for (let i = 0; i < 4; i++) car.setWheelEngineForce(i, i >= 2 ? 3500 * Math.max(-1, Math.min(1, (18 - v) / 3)) : 0);
      car.updateVehicle(rw.timestep);
      rw.step();
      const p = rb.translation();
      const q = rb.rotation();
      rap.push([k, p.x, p.y, p.z, q.x, q.y, q.z, q.w].map((n) => +n.toFixed(4)).join(','));
    }
    mkdirSync(process.env.DRIVE_TRACE!, { recursive: true });
    writeFileSync(`${process.env.DRIVE_TRACE}/strip-now${process.env.DRIVE_TAG ?? ''}.csv`, now.join('\n'));
    writeFileSync(`${process.env.DRIVE_TRACE}/strip-rapier.csv`, rap.join('\n'));
  }, 120_000);
});
