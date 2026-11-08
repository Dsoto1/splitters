import { describe, expect, it, vi } from 'vitest';
import { mountToWorld, type MapDocument, type MountSnapshot } from '@tiletrigger/shared';
import { MountState } from '../src/game/mountState.ts';
import { RIDER_BLEND_SECONDS, RiderPlacement } from '../src/game/riderPlacement.ts';
import { SessionAudio } from '../src/game/sessionAudio.ts';
import type { RemotePose } from '../src/game/interpolation.ts';
import type { AudioSystem } from '../src/audio/audio.ts';

const physics = { createBox: () => ({}), setBoxEnabled: () => {}, setBoxPose: () => {}, commit: () => {} } as never;
const map = { entities: [{ id: 'spdr', kind: 'mount', model: 'speeder', position: [0, 0, 0], yaw: 0 }] } as unknown as MapDocument;
const pose = (slot: number, x: number, y: number, z: number): RemotePose => ({ slot, x, y, z, yaw: 0, pitch: 0, alive: true, grounded: true, weapon: 0, powerups: 0, status: 0 });

/** A speeder doing 24 m/s along +z, snapshots 30 a second, frames 60 a second; slot 5 rides in seat 1 from `from` (frame) to `to`. */
function drive(frames: number, onFrame: (f: { frame: number; state: MountState; now: number; riderZ: number }) => void, from = 0, to = Infinity): void {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const state = new MountState(map, physics);
  for (let frame = 0; frame < frames; frame++) {
    now = (frame * 1000) / 60;
    if (frame % 2 === 0) {
      const z = (frame / 60) * 24;
      const seated = frame >= from && frame < to;
      state.apply([[0, 0, 0, z, 0, 0, 0, 300, 1, -1, seated ? 5 : -1] as unknown as MountSnapshot], frame);
    }
    state.smooth(1 / 60);
    // The rider's own pose as snapshot interpolation draws it: the server's seat point 100 ms ago.
    const riderZ = Math.max(0, ((frame - 6) / 60) * 24);
    onFrame({ frame, state, now, riderZ });
  }
  vi.restoreAllMocks();
}

describe('riders drawn on their seats', () => {
  it('a passenger at speed stays on the seat of the vehicle as drawn, every frame (their own pose trails it by over a metre)', () => {
    const place = new RiderPlacement();
    let worstOwn = 0;
    let worstPlaced = 0;
    drive(240, ({ frame, state, riderZ }) => {
      const m = state.mounts.get(0)!;
      const offset = m.def.seats[1]!.offset;
      const seat = (i: number, o: readonly [number, number, number]) => (i === 0 ? mountToWorld(m.shown.pos, m.shown.yaw, o) : null);
      const own = mountToWorld({ x: 0, y: 0, z: riderZ }, 0, offset);
      const p = pose(5, own.x, own.y, own.z);
      const want = seat(0, offset)!;
      if (frame > 60) worstOwn = Math.max(worstOwn, Math.hypot(p.x - want.x, p.y - want.y, p.z - want.z));
      place.place([p], state.seatedRiders(), seat, 1 / 60);
      if (frame > 30) worstPlaced = Math.max(worstPlaced, Math.hypot(p.x - want.x, p.y - want.y, p.z - want.z));
      if (frame > 30) expect(place.placed.has(5)).toBe(true);
    });
    expect(worstOwn).toBeGreaterThan(1);
    expect(worstPlaced).toBeLessThan(0.01);
  });

  it('getting in and out eases between the rider\'s own pose and the seat', () => {
    const place = new RiderPlacement();
    const seatAt = { x: 0, y: 1, z: 0 };
    const own = { x: 2, y: 0, z: 0 };
    const riders = new Map([[5, { mount: 0, offset: [0, 1, 0] as const }]]);
    const seat = () => seatAt;
    const xs: number[] = [];
    const frames = Math.round(RIDER_BLEND_SECONDS * 60);
    for (let i = 0; i < frames + 5; i++) {
      const p = pose(5, own.x, own.y, own.z);
      place.place([p], riders, seat, 1 / 60);
      xs.push(p.x);
    }
    // In: from beside it onto the seat, never past it, without a jump.
    for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeLessThanOrEqual(xs[i - 1]! + 1e-9);
    expect(xs[0]!).toBeGreaterThan(1.9);
    expect(xs.at(-1)!).toBeCloseTo(0, 6);
    expect(Math.max(...xs.slice(1).map((x, i) => xs[i]! - x))).toBeLessThan(0.3);
    // Out: back to its own pose over the same time, and then left alone.
    const out: number[] = [];
    for (let i = 0; i < frames + 5; i++) {
      const p = pose(5, own.x, own.y, own.z);
      place.place([p], new Map(), seat, 1 / 60);
      out.push(p.x);
    }
    expect(out[0]!).toBeLessThan(0.1);
    expect(out.at(-1)!).toBe(2);
    expect(place.placed.has(5)).toBe(false);
  });

  it('a dead rider, or one whose vehicle is gone, is left where their pose is', () => {
    const place = new RiderPlacement();
    const riders = new Map([[5, { mount: 0, offset: [0, 1, 0] as const }]]);
    const p = { ...pose(5, 2, 0, 0), alive: false };
    place.place([p], riders, () => ({ x: 0, y: 1, z: 0 }), 1);
    expect(p.x).toBe(2);
    const q = pose(5, 2, 0, 0);
    place.place([q], riders, () => null, 1);
    expect(q.x).toBe(2);
  });
});

describe('sounds while seated', () => {
  const recorder = () => {
    const played: { id: string; at?: unknown }[] = [];
    const audio = { play: (id: string, o: { at?: unknown } = {}) => played.push({ id, at: o.at }) } as unknown as AudioSystem;
    return { played, sfx: new SessionAudio(audio, () => 0) };
  };

  it('no footsteps from riders carried along by their vehicle; walkers still step', () => {
    const { played, sfx } = recorder();
    for (let f = 0; f < 120; f++) {
      const z = (f / 60) * 24;
      sfx.remoteSteps([pose(5, 0, 0, z), pose(6, 3, 0, (f / 60) * 5)], new Set([5]));
    }
    const steps = played.filter((p) => p.id === 'footstep');
    expect(steps.length).toBeGreaterThan(0);
    // Every one of them from the walker (x = 3), none from the rider (x = 0).
    expect(steps.every((s) => (s.at as { x: number }).x === 3)).toBe(true);
  });

  it('your own seat moves you without footsteps or a landing', () => {
    const { played, sfx } = recorder();
    const local = { alive: true, state: { pos: { x: 0, y: 0, z: 0 }, velY: -9, grounded: false }, reloadTicks: 0 } as never as Parameters<SessionAudio['localStep']>[0];
    for (let f = 0; f < 120; f++) {
      const before = { ...local.state.pos };
      local.state.pos = { x: 0, y: 0, z: (f / 60) * 24 };
      local.state.grounded = f > 3;
      sfx.localStep(local, before, 1, true);
    }
    expect(played.filter((p) => p.id === 'footstep' || p.id === 'land')).toEqual([]);
    // On foot the same movement steps.
    for (let f = 0; f < 60; f++) {
      const before = { ...local.state.pos };
      local.state.pos = { x: 0, y: 0, z: before.z + 0.1 };
      sfx.localStep(local, before, 1, false);
    }
    expect(played.some((p) => p.id === 'footstep')).toBe(true);
  });

  it('a vehicle with someone aboard runs its engine (yours unpositioned), an empty one is silent', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { played, sfx } = recorder();
    const car = (index: number, seats: number[], x: number) => ({ index, alive: true, seats, vel: { x: 0, y: 0, z: 10 }, shown: { pos: { x, y: 0, z: 0 } }, def: { kind: 'vehicle', vehicle: { maxSpeed: 20 } } });
    for (let f = 0; f < 60; f++) {
      now = (f * 1000) / 60;
      sfx.engines([car(0, [0, -1], 0), car(1, [-1, -1], 5), car(2, [7], 10)], 0, { x: 0, y: 0, z: 0 });
    }
    vi.restoreAllMocks();
    const engines = played.filter((p) => p.id === 'vehicle.engine');
    // A second's worth: about two copies each for yours and the other crewed one, none for the empty one.
    expect(engines.filter((e) => !e.at).length).toBe(2);
    expect(engines.filter((e) => (e.at as { x: number } | undefined)?.x === 10).length).toBe(2);
    expect(engines.filter((e) => (e.at as { x: number } | undefined)?.x === 5).length).toBe(0);
  });
});
