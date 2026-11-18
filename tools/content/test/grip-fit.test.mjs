import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AXES, KEEP_MARGIN, THRESH, choose, fitStep, handError, stripOffsets, targetsOf } from '../grip-fit.mjs';
import { GRIP_FIT_FILE, isPlayable, isQueued, readManifests } from '../character-manifests.mjs';

describe('the grip fit (tools/content/grip-fit.mjs)', () => {
  it('measures a hand against its target by the axes that count', () => {
    // A long gun's support hand slides along the handguard by design: its `ahead` isn't counted.
    expect(handError([0, 0, 0.3], [0, 0, 0], AXES.long.l)).toBe(0);
    expect(handError([0.03, 0.04, 0], [0, 0, 0], AXES.pistol.l)).toBe(5);
    expect(handError(null, [0, 0, 0], AXES.pistol.r)).toBe(99);
  });

  it('steps each point toward its target, damped and within reach', () => {
    const next = fitStep([0, 0, 0], [0.01, 0.05, -0.02], [0.01, 0, 0], AXES.pistol.l);
    expect(next[0]).toBe(0);
    expect(next[1]).toBeCloseTo(-0.04);
    expect(next[2]).toBeCloseTo(0.016);
    // Never further than the limit, however far off.
    expect(fitStep([0, 0, 0], [0, 1, 0], [0, 0, 0], AXES.pistol.l)[1]).toBeGreaterThanOrEqual(-0.09);
    // An axis the hold doesn't fit stays.
    expect(fitStep([0, 0, 0.02], [0, 0, 0.3], [0, 0, 0], AXES.long.l)[2]).toBe(0.02);
  });

  it('keeps hand-set offsets only where they beat the fit, and flags outliers', () => {
    const target = { pistol: { r: [0, 0, 0], l: [0, 0, 0] } };
    const at = (r, l, flags = []) => ({ drawn: { atR: r, atL: l }, flags });
    const good = at([0, 0.005, 0], [0, 0.01, 0]);
    const worse = at([0, 0.03, 0], [0, 0.05, 0]);
    expect(choose({ none: worse, hand: worse, auto: good }, 'pistol', target).pick).toBe('auto');
    expect(choose({ none: worse, hand: good, auto: worse }, 'pistol', target).pick).toBe('hand');
    // Within the margin the fit wins: fewer hand-set numbers to keep.
    const near = at([0, 0.005 + KEEP_MARGIN / 300, 0], [0, 0.01, 0]);
    expect(choose({ none: worse, hand: good, auto: near }, 'pistol', target).pick).toBe('auto');
    // Over the pass mark, or a palm the wrong way: an outlier for hand tuning.
    expect(choose({ none: worse, auto: at([0, (THRESH.r + 1) / 100, 0], [0, 0, 0]) }, 'pistol', target).outlier).toBe(true);
    expect(choose({ none: worse, auto: at([0, 0, 0], [0, 0, 0], ['palm']) }, 'pistol', target).outlier).toBe(true);
    expect(choose({ none: worse, auto: good }, 'pistol', target).outlier).toBe(false);
  });

  it('takes its targets from the approved holds (hand-set where set, else none; flagged ones left out)', () => {
    const r = (atR, flags = []) => ({ holds: { long: { none: { drawn: { atR, atL: [0, 0, 0] }, flags } }, pistol: { none: { drawn: { atR, atL: [0, 0, 0] }, flags } } } });
    const t = targetsOf([r([0, 0.01, 0]), r([0, 0.02, 0]), r([0, 0.03, 0]), r([0, 0.5, 0], ['palm'])]);
    expect(t.long.r).toEqual([0, 0.02, 0]);
  });

  it("strips replaced offsets from a manifest, keeping the rest of its hand formatting", () => {
    const text = '{\n  "id": "x",\n  "fixes": {\n    "hands": { "curl": 1 },\n    "grip": {\n      "gripLong": [-0.03, 0.03, -0.03],\n      "curlR": 0.6\n    }\n  }\n}\n';
    expect(stripOffsets(text, ['gripLong'])).toBe('{\n  "id": "x",\n  "fixes": {\n    "hands": { "curl": 1 },\n    "grip": {\n      "curlR": 0.6\n    }\n  }\n}\n');
    const inline = '{\n  "id": "x",\n  "fixes": {\n    "feet": true,\n    "grip": { "gripLong": [-0.03, 0.03, -0.03] }\n  }\n}\n';
    expect(stripOffsets(inline, ['gripLong'])).toBe('{\n  "id": "x",\n  "fixes": {\n    "feet": true\n  }\n}\n');
  });

  it('has fitted every player character (content/grip-fit.json): offsets or kept hand-set ones, arms colours, an audit', () => {
    const fit = JSON.parse(readFileSync(GRIP_FIT_FILE, 'utf8'));
    const players = readManifests().filter((m) => !isQueued(m) && isPlayable(m) && m.kind !== 'creature');
    const missing = players.filter((m) => !fit.characters[m.id]).map((m) => m.id);
    expect(missing, 'run node tools/content/grip-fit.mjs <preview url> <work dir> with ONLY=<ids> WRITE=1 STRIP=1').toEqual([]);
    for (const m of players) {
      const e = fit.characters[m.id];
      expect(e.arms?.skin ?? m.firstPerson?.skin, m.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(Object.keys(e.audit).sort(), m.id).toEqual(['long', 'pistol']);
      // A kept hand-set offset is still in the manifest; a fitted one is not.
      for (const k of e.keep) expect(m.fixes?.grip?.[k], `${m.id} ${k}`).toBeDefined();
      for (const k of Object.keys(e.grip)) expect(m.fixes?.grip?.[k], `${m.id} ${k}`).toBeUndefined();
    }
    expect(join(GRIP_FIT_FILE)).toMatch(/grip-fit\.json$/);
  });
});
