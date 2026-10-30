import { describe, expect, it } from 'vitest';
import { RAGDOLL_BUDGET, TIER_BODIES, fitBudget, tierFor, type MovingRagdoll } from '../src/game/ragdollBudget.ts';

describe('ragdoll tiers', () => {
  it('a full ragdoll near or in view, a cheap one far in view, laid down out of view', () => {
    expect(tierFor(5, false)).toBe('full');
    expect(tierFor(20, true)).toBe('full');
    expect(tierFor(60, true)).toBe('cheap');
    expect(tierFor(20, false)).toBe('posed');
    expect(TIER_BODIES.full).toBe(10);
    expect(TIER_BODIES.cheap).toBe(3);
    expect(TIER_BODIES.posed).toBe(0);
  });

  it('fits within the budget of awake bodies: the farthest ragdoll drops a tier first', () => {
    const moving: MovingRagdoll[] = [
      { tier: 'full', dist: 8 },
      { tier: 'full', dist: 30 },
      { tier: 'cheap', dist: 50 },
    ];
    // 23 awake; room for a full one under 40.
    expect(fitBudget('full', 5, moving, 40)).toEqual({ tier: 'full', drop: [] });
    // At 30: the cheap one at 50 m freezes (3 bodies); at 28 the full one at 30 m also goes cheap (7).
    const tight = fitBudget('full', 5, moving, 30);
    expect(tight.tier).toBe('full');
    expect(tight.drop).toEqual([2]);
    const tighter = fitBudget('full', 5, moving, 28);
    expect(tighter.drop).toEqual([2, 1]);
    expect(tighter.tier).toBe('full');
  });

  it('lowers the new body itself only when every moving ragdoll is closer', () => {
    const moving: MovingRagdoll[] = [
      { tier: 'full', dist: 3 },
      { tier: 'full', dist: 4 },
    ];
    expect(fitBudget('full', 20, moving, 23)).toEqual({ tier: 'cheap', drop: [] });
    expect(fitBudget('full', 20, moving, 20)).toEqual({ tier: 'posed', drop: [] });
  });

  it('never goes past the budget: twenty deaths at once in a crowd of moving ragdolls', () => {
    const moving: MovingRagdoll[] = [];
    let awake = 0;
    for (let i = 0; i < 60; i++) {
      const dist = 5 + ((i * 7) % 50);
      const fit = fitBudget(tierFor(dist, i % 3 !== 0), dist, moving);
      for (const d of fit.drop) moving[d] = { ...moving[d]!, tier: moving[d]!.tier === 'full' ? 'cheap' : 'posed' };
      if (fit.tier !== 'posed') moving.push({ tier: fit.tier, dist });
      awake = moving.reduce((n, r) => n + TIER_BODIES[r.tier], 0);
      expect(awake).toBeLessThanOrEqual(RAGDOLL_BUDGET.awakeBodies);
    }
    // Near deaths kept their full ragdolls (the far ones made room).
    expect(moving.filter((r) => r.dist <= RAGDOLL_BUDGET.near && r.tier === 'full').length).toBeGreaterThan(0);
  });
});
