import { describe, expect, it, vi } from 'vitest';
import { MountState } from '../src/game/mountState.ts';
import type { MapDocument, MountSnapshot } from '@tiletrigger/shared';

const physics = { createBox: () => ({}), setBoxEnabled: () => {}, setBoxPose: () => {}, commit: () => {} } as never;
const map = { entities: [{ id: 'spdr', kind: 'mount', model: 'speeder', position: [0, 0, 0], yaw: 0 }] } as unknown as MapDocument;

describe('vehicle smoothing', () => {
  it('a fast vehicle glides between snapshots instead of surging at each one', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const state = new MountState(map, physics);
    const m = state.mounts.get(0)!;
    // Server: 24 m/s along +z, a snapshot every 2 ticks (30 a second). Client: 60 frames a second.
    const speeds: number[] = [];
    let last = 0;
    for (let frame = 0; frame < 240; frame++) {
      now = (frame * 1000) / 60;
      if (frame % 2 === 0) {
        const tick = frame;
        const snap = [0, 0, 0, (tick / 60) * 24, 0, 0, 0, 300, 1, -1, -1] as unknown as MountSnapshot;
        state.apply([snap], tick);
      }
      state.smooth(1 / 60);
      if (frame > 60) speeds.push((m.shown.pos.z - last) * 60);
      last = m.shown.pos.z;
    }
    const mean = speeds.reduce((a, v) => a + v, 0) / speeds.length;
    const spread = Math.sqrt(speeds.reduce((a, v) => a + (v - mean) ** 2, 0) / speeds.length) / mean;
    expect(mean).toBeGreaterThan(23);
    expect(spread).toBeLessThan(0.05);
    vi.restoreAllMocks();
  });

  it('snapshots that arrive a few ms early or late (a worker, the network) do not make it surge either', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const state = new MountState(map, physics);
    const m = state.mounts.get(0)!;
    // Server: 18 m/s along +z, a snapshot every tick (60 a second), each arriving up to 5 ms off. Client: 144 fps.
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const arrivals = Array.from({ length: 600 }, (_, k) => ({ tick: k + 1, at: ((k + 1) * 1000) / 60 + (rand() - 0.5) * 10 }));
    const speeds: number[] = [];
    let last = 0;
    let next = 0;
    for (let frame = 0; frame < 144 * 9; frame++) {
      now = (frame * 1000) / 144;
      while (next < arrivals.length && arrivals[next]!.at <= now) {
        const { tick } = arrivals[next++]!;
        state.apply([[0, 0, 0, (tick / 60) * 18, 0, 0, 0, 300, 1, -1, -1] as unknown as MountSnapshot], tick);
      }
      state.smooth(1 / 144);
      if (frame > 144 * 3) speeds.push((m.shown.pos.z - last) * 144);
      last = m.shown.pos.z;
    }
    const mean = speeds.reduce((a, v) => a + v, 0) / speeds.length;
    const spread = Math.sqrt(speeds.reduce((a, v) => a + (v - mean) ** 2, 0) / speeds.length) / mean;
    expect(mean).toBeGreaterThan(17.5);
    expect(spread).toBeLessThan(0.03);
    vi.restoreAllMocks();
  });
});
