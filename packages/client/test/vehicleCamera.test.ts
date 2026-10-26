import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOUNT_DEFS, cockpitEye, mountToWorld, type MountDef, type Vec3 } from '@tiletrigger/shared';
import { CHASE_RECENTRE_DELAY, DRIVER_LOOK_LIMIT, VehicleCamera, loadVehicleViews, rayBoxExit, vehicleClass, type RideFrame } from '../src/game/vehicleCamera.ts';

const store = new Map<string, string>();
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});

const FOV = 1.35;
const noWalls = () => null;

function ride(def: MountDef, over: Partial<RideFrame> = {}): RideFrame {
  const pos = over.pos ?? { x: 0, y: 0, z: 0 };
  const yaw = over.yaw ?? 0;
  const seat = over.seat ?? 0;
  const feet = mountToWorld(pos, yaw, def.seats[seat]!.offset);
  return {
    def,
    index: 1,
    seat,
    pos,
    yaw,
    vel: { x: 0, y: 0, z: 0 },
    tilt: { pitch: 0, roll: 0 },
    cockpitEye: mountToWorld(pos, yaw, cockpitEye(def, seat)),
    seatEye: { x: feet.x, y: feet.y + 1.6, z: feet.z },
    ...over,
  };
}

const sub = (a: Vec3, b: Vec3) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

describe('cockpit view', () => {
  it('is the default for ground vehicles and flyers, with the eye at the driver seat', () => {
    const cam = new VehicleCamera();
    const look = { yaw: 2, pitch: 0.3 };
    const r = ride(MOUNT_DEFS.buggy, { yaw: 0.5 });
    const pose = cam.update(1 / 60, r, look, noWalls, FOV);
    expect(pose.mode).toBe('cockpit');
    expect(pose.pos).toEqual(r.cockpitEye);
    // Taking the wheel faces you down the nose.
    expect(look.yaw).toBeCloseTo(0.5);
    expect(pose.roll).toBe(0);
    expect(cam.viewFor(MOUNT_DEFS.skyfighter)).toBe('cockpit');
  });

  it('turns with the vehicle and keeps mouse look within limits', () => {
    const cam = new VehicleCamera();
    const look = { yaw: 0, pitch: 0 };
    cam.update(1 / 60, ride(MOUNT_DEFS.buggy), look, noWalls, FOV);
    look.yaw += 0.4;
    cam.update(1 / 60, ride(MOUNT_DEFS.buggy, { yaw: 0.3 }), look, noWalls, FOV);
    expect(look.yaw).toBeCloseTo(0.7);
    look.yaw += 5;
    look.pitch = 1.4;
    cam.update(1 / 60, ride(MOUNT_DEFS.buggy, { yaw: 0.3 }), look, noWalls, FOV);
    expect(Math.abs(Math.atan2(Math.sin(look.yaw - 0.3), Math.cos(look.yaw - 0.3)))).toBeLessThanOrEqual(DRIVER_LOOK_LIMIT + 1e-9);
    expect(look.pitch).toBeLessThanOrEqual(0.75);
  });

  it('follows the vehicle tilt only gently, more in the air, and levels out again', () => {
    const cam = new VehicleCamera();
    const look = { yaw: 0, pitch: 0 };
    let pose = cam.update(1 / 60, ride(MOUNT_DEFS.buggy), look, noWalls, FOV);
    for (let i = 0; i < 240; i++) pose = cam.update(1 / 60, ride(MOUNT_DEFS.buggy, { tilt: { pitch: 0.5, roll: -0.6 } }), look, noWalls, FOV);
    // Steep ground: the view leans a little (clamped), not with the whole car.
    expect(Math.abs(pose.pitch)).toBeLessThanOrEqual(0.1 + 1e-6);
    expect(Math.abs(pose.roll)).toBeLessThanOrEqual(0.07 + 1e-6);
    expect(Math.abs(pose.roll)).toBeGreaterThan(0.03);
    const air = new VehicleCamera();
    const airLook = { yaw: 0, pitch: 0 };
    let ap = air.update(1 / 60, ride(MOUNT_DEFS.skyfighter), airLook, noWalls, FOV);
    for (let i = 0; i < 240; i++) ap = air.update(1 / 60, ride(MOUNT_DEFS.skyfighter, { tilt: { pitch: -0.2, roll: 0.3 } }), airLook, noWalls, FOV);
    expect(ap.roll).toBeCloseTo(0.18, 2);
    expect(ap.pitch).toBeCloseTo(0.12, 2);
    // Level ground again: back to level.
    for (let i = 0; i < 240; i++) pose = cam.update(1 / 60, ride(MOUNT_DEFS.buggy), look, noWalls, FOV);
    expect(Math.abs(pose.roll)).toBeLessThan(1e-3);
    expect(Math.abs(pose.pitch - look.pitch)).toBeLessThan(1e-3);
  });

  it('lets gunners look freely from the seat, level, within their gun arc', () => {
    const cam = new VehicleCamera();
    const tank = MOUNT_DEFS.tank;
    const look = { yaw: 1.5, pitch: 0 };
    const r = ride(tank, { seat: 1, tilt: { pitch: 0.3, roll: 0.3 } });
    let pose = cam.update(1 / 60, r, look, noWalls, FOV);
    for (let i = 0; i < 60; i++) pose = cam.update(1 / 60, r, look, noWalls, FOV);
    expect(pose.mode).toBe('seat');
    expect(pose.pos).toEqual(r.seatEye);
    expect(pose.roll).toBe(0);
    // The cannon covers 0.6 rad either side of the nose.
    expect(look.yaw).toBeCloseTo(0.6);
    const roof = new VehicleCamera();
    const free = { yaw: 2.5, pitch: 0 };
    roof.update(1 / 60, ride(tank, { seat: 2 }), free, noWalls, FOV);
    expect(free.yaw).toBeCloseTo(2.5);
  });
});

describe('chase camera', () => {
  function chase(def: MountDef) {
    const cam = new VehicleCamera();
    cam.toggle(def);
    return cam;
  }

  it('sits behind and above the vehicle, outside it', () => {
    const cam = chase(MOUNT_DEFS.buggy);
    const look = { yaw: 0, pitch: 0 };
    const r = ride(MOUNT_DEFS.buggy, { pos: { x: 5, y: 2, z: 5 } });
    const pose = cam.update(1 / 60, r, look, noWalls, FOV);
    expect(pose.mode).toBe('chase');
    const off = sub(pose.pos, r.pos);
    expect(off.z).toBeLessThan(-MOUNT_DEFS.buggy.half[2] - 1);
    expect(off.y).toBeGreaterThan(MOUNT_DEFS.buggy.half[1] * 2);
  });

  it('pulls in when a wall is in the way', () => {
    const cam = chase(MOUNT_DEFS.buggy);
    const look = { yaw: 0, pitch: 0 };
    const r = ride(MOUNT_DEFS.buggy);
    const pivot = { x: 0, y: MOUNT_DEFS.buggy.half[1] * 2 + 0.5, z: 0 };
    const pose = cam.update(1 / 60, r, look, () => 2, FOV);
    const d = Math.hypot(...Object.values(sub(pose.pos, pivot)));
    expect(d).toBeCloseTo(1.6, 5);
  });

  it('pulls back and widens with speed, and stays steady relative to the vehicle at speed', () => {
    const def = MOUNT_DEFS.hover_bike;
    const cam = chase(def);
    const look = { yaw: 0, pitch: 0 };
    const still = cam.update(1 / 60, ride(def), look, noWalls, FOV);
    const stillOff = sub(still.pos, { x: 0, y: 0, z: 0 });
    let pos = { x: 0, y: 0, z: 0 };
    const vel = { x: 0, y: 0, z: def.vehicle!.maxSpeed };
    let last: Vec3 | null = null;
    let wobble = 0;
    let pose = still;
    for (let i = 0; i < 600; i++) {
      pos = { x: 0, y: 0, z: pos.z + vel.z / 60 };
      pose = cam.update(1 / 60, ride(def, { pos, vel }), look, noWalls, FOV);
      const off = sub(pose.pos, pos);
      if (last && i > 400) wobble = Math.max(wobble, Math.hypot(off.x - last.x, off.y - last.y, off.z - last.z));
      last = off;
    }
    expect(Math.hypot(last!.x, last!.z)).toBeGreaterThan(Math.hypot(stillOff.x, stillOff.z) + 1);
    expect(pose.fov).toBeGreaterThan(FOV * 1.1);
    expect(wobble).toBeLessThan(1e-3);
  });

  it('free look swings back behind the vehicle after a moment', () => {
    const cam = chase(MOUNT_DEFS.buggy);
    const look = { yaw: 0, pitch: 0 };
    cam.update(1 / 60, ride(MOUNT_DEFS.buggy), look, noWalls, FOV);
    look.yaw = 1.5;
    cam.update(1 / 60, ride(MOUNT_DEFS.buggy), look, noWalls, FOV);
    for (let i = 0; i < Math.floor(CHASE_RECENTRE_DELAY * 60) - 5; i++) cam.update(1 / 60, ride(MOUNT_DEFS.buggy), look, noWalls, FOV);
    expect(look.yaw).toBeCloseTo(1.5);
    for (let i = 0; i < 240; i++) cam.update(1 / 60, ride(MOUNT_DEFS.buggy), look, noWalls, FOV);
    expect(Math.abs(look.yaw)).toBeLessThan(0.01);
  });
});

describe('preferences', () => {
  it('remember cockpit or chase per vehicle class', () => {
    expect(loadVehicleViews()).toEqual({ ground: 'cockpit', air: 'cockpit' });
    new VehicleCamera().toggle(MOUNT_DEFS.dropship);
    expect(loadVehicleViews()).toEqual({ ground: 'cockpit', air: 'chase' });
    expect(new VehicleCamera().viewFor(MOUNT_DEFS.gunship)).toBe('chase');
    expect(new VehicleCamera().viewFor(MOUNT_DEFS.tank)).toBe('cockpit');
    expect(vehicleClass(MOUNT_DEFS.skyfighter)).toBe('air');
    expect(vehicleClass(MOUNT_DEFS.kart)).toBe('ground');
  });

  it('fall back to the defaults when storage is blocked', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    expect(loadVehicleViews()).toEqual({ ground: 'cockpit', air: 'cockpit' });
    const cam = new VehicleCamera();
    expect(() => cam.toggle(MOUNT_DEFS.buggy)).not.toThrow();
    expect(cam.viewFor(MOUNT_DEFS.buggy)).toBe('chase');
  });
});

describe('geometry', () => {
  it('finds where a ray leaves a turned box', () => {
    expect(rayBoxExit({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }, [1, 1, 2], 0)).toBeCloseTo(2);
    expect(rayBoxExit({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }, [1, 1, 2], Math.PI / 2)).toBeCloseTo(1);
    expect(rayBoxExit({ x: 0, y: 5, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }, [1, 1, 2], 0)).toBeNull();
  });

  it('puts every driver eye within the vehicle, at about a seated height', () => {
    for (const def of Object.values(MOUNT_DEFS)) {
      const seat = def.seats.findIndex((s) => s.role === 'driver');
      if (def.kind !== 'vehicle' || seat < 0) continue;
      const [x, y, z] = cockpitEye(def, seat);
      expect(Math.abs(x), def.id).toBeLessThan(def.half[0]);
      expect(Math.abs(z), def.id).toBeLessThan(def.half[2]);
      expect(y, def.id).toBeGreaterThan(0.8);
      expect(y, def.id).toBeLessThan(def.seats[seat]!.offset[1] + 1.5);
    }
  });
});
