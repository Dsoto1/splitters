import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS, type ProjectileVisual } from '@tiletrigger/shared';
import { landStyle } from '../src/game/projectileLand.ts';

// How a projectile with no blast lands (owner, 2026-11-25): every gun's no-splash look has an impact, and the X-42's
// energy splash is calm under Reduce flashing (unlit, dimmer, slower, fewer sparks).
describe('projectile landings', () => {
  it("every gun's projectile with no blast of its own has an impact", () => {
    const looks = new Set<ProjectileVisual>();
    for (const w of Object.values(CORE_WEAPONS))
      for (const p of [w.projectile, w.alt?.projectile])
        if (p && p.splashRadius <= 0 && !p.zone && !p.cover && !p.ammoBox && !p.cluster && !p.airstrike && !p.ignites) looks.add(p.visual);
    expect([...looks].sort()).toEqual(expect.arrayContaining(['arrow', 'blasterBolt', 'disc', 'nail', 'shard', 'stinger']));
    for (const look of looks) expect(landStyle(look, false), look).not.toBeNull();
  });

  it("the Blaster X-42's bolt: a glowing orange splash and a scorch; calm, an unlit dimmer slower puff and fewer sparks", () => {
    const loud = landStyle('blasterBolt', false)!;
    const calm = landStyle('blasterBolt', true)!;
    if ('round' in loud.surface || 'round' in calm.surface) throw new Error('the bolt has its own splash');
    expect(loud.surface.glow?.glow).toBe(true);
    expect(loud.surface.scorch).toBeGreaterThan(1);
    expect(calm.surface.glow?.glow).toBe(false);
    expect(calm.surface.glow!.life).toBeGreaterThan(loud.surface.glow!.life);
    expect(calm.surface.glow!.size).toBeLessThan(loud.surface.glow!.size);
    expect(calm.surface.sparks).toBeLessThan(loud.surface.sparks);
    expect(calm.body.glow?.glow).toBe(false);
  });

  it('a blast draws nothing of its own here', () => {
    expect(landStyle('grenade', false)).toBeNull();
    expect(landStyle('rocket', true)).toBeNull();
  });
});
