/** A round that passes close to your head whizzes by (sessionAudio.ts flybyPoint; docs/AUDIO.md). */
import { describe, expect, it } from 'vitest';
import { flybyPoint } from '../src/game/sessionAudio.ts';

const v = (x: number, y: number, z: number) => ({ x, y, z });

describe('flybyPoint', () => {
  it('finds where a near miss passes your head', () => {
    const p = flybyPoint(v(0, 1.6, 0), v(0, 1.6, 40), v(1, 1.6, 20));
    expect(p).not.toBeNull();
    expect(p!.z).toBeCloseTo(20);
  });
  it('is silent for rounds that pass wide, end short of you or pass right by the gun', () => {
    expect(flybyPoint(v(0, 1.6, 0), v(0, 1.6, 40), v(3, 1.6, 20))).toBeNull();
    expect(flybyPoint(v(0, 1.6, 0), v(0, 1.6, 10), v(0.5, 1.6, 20))).toBeNull();
    expect(flybyPoint(v(0, 1.6, 0), v(0, 1.6, 40), v(0.5, 1.6, 2))).toBeNull();
    expect(flybyPoint(v(0, 1.6, 0), v(0, 1.6, 0), v(0, 1.6, 0))).toBeNull();
  });
});
