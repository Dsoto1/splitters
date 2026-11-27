// The limb audit's maths (tools/content/limbs.mjs): a straight standing figure reads zero, and a knee, an ankle, a
// sole and an elbow moved by a known angle read that angle, signed the same way on both sides.
import { describe, expect, it } from 'vitest';
import { bodyFrame, elbowMeasure, elbowWrong, legMeasures, limbMeasures } from '../limbs.mjs';

const rad = (d) => (d * Math.PI) / 180;
/** A figure facing +z, its right side at -x (the game's characters at rotation 0): legs straight, arms down. */
function figure() {
  const j = {};
  for (const [s, x] of [['l', 0.1], ['r', -0.1]]) {
    j[`thigh_${s}`] = [x, 0.9, 0];
    j[`calf_${s}`] = [x, 0.5, 0];
    j[`foot_${s}`] = [x, 0.08, 0];
    j[`ball_${s}`] = [x, 0.02, 0.12];
    j[`upperarm_${s}`] = [x * 2, 1.4, 0];
    j[`lowerarm_${s}`] = [x * 2, 1.12, 0];
    j[`hand_${s}`] = [x * 2, 0.86, 0];
  }
  return j;
}
const out = (s) => (s === 'r' ? -1 : 1);

describe('limb measures', () => {
  it('reads the body frame from the hips and toes', () => {
    const f = bodyFrame(figure());
    expect(f.across[0]).toBeCloseTo(-1);
    expect(f.forward[2]).toBeCloseTo(1);
  });

  it('a straight leg reads zero', () => {
    const m = legMeasures(figure(), 'l');
    expect(m.kneeBow).toBe(0);
    expect(m.shinOut).toBe(0);
    expect(m.footYaw).toBe(0);
    expect(m.kneePoint).toBeNull();
  });

  for (const s of ['l', 'r']) {
    it(`a bowed knee and an ankle out read their angles (${s})`, () => {
      const j = figure();
      // Shin leaning 10° out: the ankle further out than the knee.
      const k = j[`calf_${s}`];
      const l = 0.42;
      j[`foot_${s}`] = [k[0] + out(s) * l * Math.sin(rad(10)), k[1] - l * Math.cos(rad(10)), 0];
      const m = legMeasures(j, s);
      expect(m.shinOut).toBeCloseTo(10, 0);
      expect(m.kneeBow).toBeCloseTo(-10, 0);
      // The knee moved out 6° with the ankle back under the hip: bow legs, + on both sides.
      const j2 = figure();
      const h = j2[`thigh_${s}`];
      j2[`calf_${s}`] = [h[0] + out(s) * 0.4 * Math.sin(rad(6)), h[1] - 0.4 * Math.cos(rad(6)), 0];
      expect(legMeasures(j2, s).kneeBow).toBeGreaterThan(11);
    });

    it(`a knee bent outward and toes out read +, a sole on its outer edge reads + (${s})`, () => {
      const j = figure();
      // The knee forward and out by 30° from straight ahead, bent ~11°.
      const h = j[`thigh_${s}`];
      j[`calf_${s}`] = [h[0] + out(s) * 0.08 * Math.sin(rad(30)), 0.5, 0.08 * Math.cos(rad(30))];
      j[`ball_${s}`] = [j[`foot_${s}`][0] + out(s) * 0.12 * Math.sin(rad(20)), 0.02, 0.12 * Math.cos(rad(20))];
      const x = j[`foot_${s}`][0];
      const outer = [x + out(s) * 0.04, 0.0, 0.05];
      const inner = [x - out(s) * 0.04, 0.08 * Math.tan(rad(15)), 0.05];
      const skin = { [`foot_${s}`]: { soleLeft: outer[0] < inner[0] ? outer : inner, soleRight: outer[0] < inner[0] ? inner : outer } };
      const m = legMeasures(j, s, bodyFrame(j), skin);
      expect(m.kneePoint).toBeCloseTo(30, 0);
      expect(m.footYaw).toBeCloseTo(20, 0);
      expect(m.footRoll).toBeCloseTo(15, 0);
    });

    it(`an elbow down, out, up and in reads 0, 90, 180 and − (${s})`, () => {
      const at = (deg) => {
        const j = figure();
        // Arm forward along +z, the elbow off the line by `deg` round it from straight down toward out.
        j[`upperarm_${s}`] = [out(s) * 0.2, 1.4, 0];
        j[`hand_${s}`] = [out(s) * 0.2, 1.4, 0.5];
        j[`lowerarm_${s}`] = [out(s) * 0.2 + out(s) * 0.1 * Math.sin(rad(deg)), 1.4 - 0.1 * Math.cos(rad(deg)), 0.25];
        return elbowMeasure(j, s).elbow;
      };
      expect(at(0)).toBeCloseTo(0, 0);
      expect(at(45)).toBeCloseTo(45, 0);
      expect(at(90)).toBeCloseTo(90, 0);
      expect(at(170)).toBeCloseTo(170, 0);
      expect(at(-30)).toBeCloseTo(-30, 0);
      expect(elbowWrong(at(45))).toBe(false);
      expect(elbowWrong(at(170))).toBe(true);
      expect(elbowWrong(at(-30))).toBe(true);
    });
  }

  it('scores the worst leg value and the elbow excess', () => {
    const m = limbMeasures({ joints: figure() });
    expect(m.legScore).toBe(0);
    expect(m.elbowScore).toBe(0);
  });
});
