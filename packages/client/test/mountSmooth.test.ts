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
});
