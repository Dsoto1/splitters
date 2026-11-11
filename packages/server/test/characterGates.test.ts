import { describe, expect, it } from 'vitest';
import { CORE_LOOKS, characterGateReports, characterTier } from '@tiletrigger/shared';
import { characterFacts } from '../src/tools/characterFacts.ts';

// The characters' quality gates over the real roster, from what the content build recorded (pnpm quality-gates
// prints the same; docs/CHARACTERS.md, "Tier"). A core character must pass every blocking gate.
describe("characters' quality gates, the roster", () => {
  const facts = characterFacts();
  const reports = characterGateReports(facts);

  it('reads real facts (not a roster of skipped gates)', () => {
    expect(reports.length).toBe(CORE_LOOKS.length);
    const whole = CORE_LOOKS.filter((l) => l.whole);
    expect(whole.length).toBeGreaterThan(50);
    for (const l of whole) {
      const f = facts(l);
      expect(f.model?.triangles, l.id).toBeGreaterThan(1000);
      expect(f.targetTriangles, l.id).toBeGreaterThan(1000);
    }
    expect(facts(CORE_LOOKS[0]!).maxTriangles).toBeGreaterThan(0);
    // Whole-body characters get all six gates; a look built from the shared parts the three that apply.
    for (const r of reports) expect(r.gates.length, r.look).toBe(CORE_LOOKS.find((l) => l.id === r.look)!.whole ? 6 : 3);
  });

  it('every core character passes every blocking gate', () => {
    const failing = reports.filter((r) => r.failing.length).map((r) => `${r.look}: ${r.failing.map((g) => `${g.id}: ${g.note}`).join(' | ')}`);
    expect(failing).toEqual([]);
    expect(reports.every((r) => r.tier === characterTier(CORE_LOOKS.find((l) => l.id === r.look)!))).toBe(true);
  });
});
