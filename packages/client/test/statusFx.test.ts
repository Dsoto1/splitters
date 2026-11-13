import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FX_CLOAK, FX_PROTECTED, STATUS_BURN, STATUS_CHILL, STATUS_FROZEN, STATUS_POISON, STATUS_SLOW } from '@tiletrigger/shared';
import { STATUS_FX, STATUS_FX_MAX, STATUS_FX_RANGE, StatusFx, plainStatus, statusFxKind, statusFxLevel } from '../src/game/statusFx.ts';
import { lastingFx } from '../src/game/fxMap.ts';
import { portName } from '../src/game/godotVfx.ts';
import type { LastingPlace } from '../src/game/lastingFx.ts';

const shipped = (pack: string): Record<string, { set?: string; nodes: { name: string; type: string; material_override?: { shader?: { shader?: string } } }[] }> => JSON.parse(readFileSync(new URL(`../public/vfx/${pack}.json`, import.meta.url), 'utf8')).effects;

/** A stand-in for LastingFx: records what was asked for; `drawn` says which ids it draws. */
function fakeLasting(drawn: (id: string) => boolean = () => true) {
  const wants: { id: string; key: string; at: { x: number; y: number; z: number }; place: LastingPlace }[] = [];
  return { wants, lasting: { want: (id: string, key: string, at: { x: number; y: number; z: number }, place: LastingPlace = {}) => void wants.push({ id, key, at, place }), drawn } };
}

describe('status auras (statusFx.ts)', () => {
  it('maps each status to an aura of the Status FX pack, as effects of the moment, every part of them ported', () => {
    const fx = shipped('status_fx');
    for (const kind of ['burn', 'poison', 'slow', 'chill'] as const) {
      const ref = lastingFx(`status.${kind}`)!;
      expect(ref, kind).toMatchObject({ pack: 'status_fx' });
      // Not decoration and not a fixture: someone near you on fire comes before a pickup's glow or a far portal.
      expect(ref.decor ?? ref.fixture, kind).toBeUndefined();
      const scene = fx[ref.effect]!;
      expect(scene.nodes.some((n) => n.name === 'Aura'), kind).toBe(true);
      for (const n of scene.nodes) if (n.material_override?.shader?.shader) expect(portName(scene.set, n.material_override.shader.shader), `${ref.effect}/${n.name}`).toMatch(/^StatusFX\//);
    }
    expect(lastingFx('status.burn')!.effect).toBe('vfx_status_flame');
    expect(lastingFx('status.poison')!.effect).toBe('vfx_status_poison');
    expect(lastingFx('status.chill')!.effect).toBe('vfx_status_ice');
    // Goo: the pack's bubbles in the goo's own pink (the plain shell's colour).
    expect(lastingFx('status.slow')).toMatchObject({ effect: 'vfx_status_rot', tint: '#ff5ac8' });
  });

  it('picks the strongest status, as the plain shell does, and nothing for bits that are not statuses', () => {
    expect(statusFxKind(STATUS_FROZEN | STATUS_BURN)).toBe('chill');
    expect(statusFxKind(STATUS_BURN | STATUS_POISON | STATUS_SLOW)).toBe('burn');
    expect(statusFxKind(STATUS_POISON | STATUS_SLOW)).toBe('poison');
    expect(statusFxKind(STATUS_SLOW | STATUS_CHILL)).toBe('slow');
    expect(statusFxKind(STATUS_CHILL)).toBe('chill');
    expect(statusFxKind(FX_PROTECTED | FX_CLOAK)).toBeNull();
    expect(statusFxKind(0)).toBeNull();
  });

  it("keeps the plain shell where no aura is drawn, and a frozen one's block of ice either way", () => {
    expect(plainStatus(STATUS_BURN, false)).toBe(STATUS_BURN);
    expect(plainStatus(STATUS_BURN | STATUS_POISON, true)).toBe(0);
    expect(plainStatus(STATUS_FROZEN | STATUS_BURN, true)).toBe(STATUS_FROZEN);
    expect(plainStatus(STATUS_CHILL, true)).toBe(0);
  });

  it('asks for the nearest few within range only, at the middle of the body, sized with it', () => {
    const { wants, lasting } = fakeLasting();
    const fx = new StatusFx(lasting);
    const cam = { x: 0, y: 1.6, z: 0 };
    for (let i = 0; i < 8; i++) fx.ask(i, STATUS_BURN, { x: 0, y: 0, z: 30 - i * 3 }, 1, cam);
    fx.ask(20, STATUS_POISON, { x: 0, y: 0, z: STATUS_FX_RANGE + 5 }, 1, cam);
    fx.ask(21, FX_PROTECTED, { x: 0, y: 0, z: 2 }, 1, cam);
    fx.ask(22, STATUS_SLOW, { x: 0, y: 0, z: 1 }, 1.5, cam);
    fx.flush(1000, false);
    expect(wants.length).toBe(STATUS_FX_MAX);
    expect(wants.map((w) => w.id)).toEqual(['status:22', 'status:7', 'status:6']);
    expect(wants[0]).toMatchObject({ key: 'status.slow', place: { size: 1.5, range: STATUS_FX_RANGE, prefill: true } });
    expect(wants[0]!.at.y).toBeCloseTo(0.95 * 1.5, 5);
    expect(wants[1]!.key).toBe('status.burn');
    // Low graphics has four lasting places: one at least is left for a fire or a gas cloud.
    expect(STATUS_FX_MAX).toBeLessThan(4);
    expect(STATUS_FX_RANGE).toBeLessThanOrEqual(70);
    // Nothing carried over: the next frame asks only for who is asked about then.
    wants.length = 0;
    fx.flush(1016, false);
    expect(wants).toEqual([]);
  });

  it('eases in while drawn, never past its strength; with Reduce flashing on dimmer, slower and slowed', () => {
    let level = 0;
    for (let i = 0; i < 6; i++) level = statusFxLevel(level, true, 1 / 60, false);
    expect(level).toBeGreaterThan(0.2);
    expect(level).toBeLessThan(STATUS_FX.level);
    for (let i = 0; i < 60; i++) level = statusFxLevel(level, true, 1 / 60, false);
    expect(level).toBe(STATUS_FX.level);
    expect(statusFxLevel(level, false, 1 / 60, false)).toBe(0);
    // Calm: a fifth of a second in it is still faint, and it ends under the usual strength.
    let calm = 0;
    for (let i = 0; i < 12; i++) calm = statusFxLevel(calm, true, 1 / 60, true);
    expect(calm).toBeLessThan(0.25);
    for (let i = 0; i < 120; i++) calm = statusFxLevel(calm, true, 1 / 60, true);
    expect(calm).toBe(STATUS_FX.calmLevel);
    expect(STATUS_FX.calmLevel).toBeLessThan(STATUS_FX.level);
    expect(STATUS_FX.calmRise).toBeLessThan(STATUS_FX.rise / 3);
    expect(STATUS_FX.calmSlow).toBeLessThanOrEqual(0.5);

    const { wants, lasting } = fakeLasting();
    const fx = new StatusFx(lasting);
    const cam = { x: 0, y: 0, z: 0 };
    fx.ask(1, STATUS_BURN, { x: 0, y: 0, z: 3 }, 1, cam);
    fx.flush(1000, true);
    fx.ask(1, STATUS_BURN, { x: 0, y: 0, z: 3 }, 1, cam);
    fx.flush(1050, true);
    expect(wants[0]!.place).toMatchObject({ slow: STATUS_FX.calmSlow, level: 0 });
    expect(wants[1]!.place.level).toBeCloseTo(STATUS_FX.calmRise * 0.05, 5);
    wants.length = 0;
    fx.ask(1, STATUS_BURN, { x: 0, y: 0, z: 3 }, 1, cam);
    fx.flush(1100, false);
    expect(wants[0]!.place.slow).toBeUndefined();
  });

  it('shows nothing while its effect has no place', () => {
    const { wants, lasting } = fakeLasting(() => false);
    const fx = new StatusFx(lasting);
    for (let f = 0; f < 5; f++) {
      fx.ask(3, STATUS_POISON, { x: 0, y: 0, z: 3 }, 1, { x: 0, y: 0, z: 0 });
      fx.flush(1000 + f * 16, false);
    }
    expect(wants.every((w) => w.place.level === 0)).toBe(true);
    expect(fx.worn(3)).toBe(false);
  });
});
