import { describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, getWeapon } from '../src/index.ts';
import { bestLoadedDesirability, grenadeWorthIt, pickupNeed, weaponScore, type CombatantView, type InventoryView, type MountView, type WeaponChoiceContext } from '../src/bots/brain.ts';
import { vehicleFor } from '../src/bots/vehicles.ts';

const profile = CORE_BOT_PROFILES.find((p) => p.id === 'core.normal') ?? CORE_BOT_PROFILES[0]!;
const gun = (id: string, mag?: number, reserve?: number): InventoryView => {
  const def = getWeapon(id);
  return { def, mag: mag ?? def.magazine, reserve: reserve ?? def.reserveMax };
};
const enemy = (health: number, x = 0): CombatantView => ({ slot: 1, pos: { x, y: 0, z: 0 }, yaw: 0, pitch: 0, health, armor: 0, alive: true });
const me = enemy(100);
/** The weapon a bot with `guns` (holding the first) picks against `target` at `dist`. */
function pick(guns: InventoryView[], dist: number, target: CombatantView | undefined): string {
  const loaded = (w: InventoryView) => w.def.magazine === 0 || w.mag > 0;
  let best = guns[0]!;
  let bestScore = -Infinity;
  for (const w of guns) {
    const c: WeaponChoiceContext = { dist, target, held: w === guns[0], loadedElsewhere: guns.some((o) => o !== w && loaded(o)), profile };
    const s = weaponScore(w, c);
    if (s > bestScore) [best, bestScore] = [w, s];
  }
  return best.def.id;
}

describe('bot weapon choice', () => {
  it('fires rockets when it has plenty, but keeps its last one from a target that is nearly dead', () => {
    // Holding the launcher both times.
    expect(pick([gun('core.rockets'), gun('core.rifle')], 20, enemy(100))).toBe('core.rockets');
    expect(pick([gun('core.rockets', 1, 0), gun('core.rifle')], 20, enemy(20))).toBe('core.rifle');
  });

  it('draws another gun before the magazine clicks dry in a close fight', () => {
    expect(pick([gun('core.smg', 2, 100), gun('core.shotgun')], 6, enemy(100))).toBe('core.shotgun');
    expect(pick([gun('core.smg', 20, 100), gun('core.shotgun')], 6, enemy(100))).toBe('core.smg');
    // Nothing else loaded: keep shooting what it has.
    expect(pick([gun('core.smg', 2, 100), gun('core.shotgun', 0, 10)], 6, enemy(100))).toBe('core.smg');
  });

  it('never picks a gun with no ammo at all', () => {
    expect(weaponScore(gun('core.rockets', 0, 0), { dist: 20, target: enemy(100), held: true, loadedElsewhere: true, profile })).toBe(-Infinity);
  });
});

describe('bot pickups', () => {
  const owned = (guns: InventoryView[]) => new Map(guns.map((w) => [w.def.id, w]));
  it('only wants ammo that fits a weapon running low', () => {
    const guns = [gun('core.smg', 40, 10), gun('core.shotgun')];
    expect(pickupNeed({ kind: 'ammo', ammo: 'shells' }, me, guns, owned(guns), 2, 'frag')).toBe(0);
    expect(pickupNeed({ kind: 'ammo', ammo: 'light' }, me, guns, owned(guns), 2, 'frag')).toBeGreaterThan(0);
    expect(pickupNeed({ kind: 'ammo' }, me, guns, owned(guns), 2, 'frag')).toBeGreaterThan(0);
  });

  it('wants grenades when it has few', () => {
    const guns = [gun('core.smg')];
    expect(pickupNeed({ kind: 'throwable', throwable: 'frag', count: 2 }, me, guns, owned(guns), 0, null)).toBeGreaterThan(0);
    expect(pickupNeed({ kind: 'throwable', throwable: 'frag', count: 2 }, me, guns, owned(guns), 3, 'frag')).toBe(0);
  });
});

describe('bot grenades', () => {
  it('keeps the last grenade for when it is pinned, unless it plays recklessly', () => {
    expect(grenadeWorthIt(1, false, 0.8)).toBe(false);
    expect(grenadeWorthIt(1, true, 0.8)).toBe(true);
    expect(grenadeWorthIt(2, false, 0.8)).toBe(true);
    expect(grenadeWorthIt(1, false, 0.1)).toBe(true);
    expect(grenadeWorthIt(0, true, 0.1)).toBe(false);
  });
});

describe('bot loadout and vehicles', () => {
  it('rates a loadout by its best gun that still has rounds', () => {
    expect(bestLoadedDesirability([gun('core.knife'), gun('core.pistol')])).toBeCloseTo(getWeapon('core.pistol').botDesirability);
    expect(bestLoadedDesirability([gun('core.pistol'), gun('core.rifle', 0, 0)])).toBeCloseTo(getWeapon('core.pistol').botDesirability);
    expect(bestLoadedDesirability([gun('core.pistol'), gun('core.rifle')])).toBeCloseTo(getWeapon('core.rifle').botDesirability);
  });

  it('takes a vehicle parked beside it for a long trip, not one off the way', () => {
    const car = (index: number, x: number, z: number): MountView => ({ index, kind: 'vehicle', pos: { x, y: 0, z }, yaw: 0, health: 1, alive: true, enterRadius: 2, seats: [{ role: 'driver', free: true }] });
    const from = { x: 0, y: 0, z: 0 };
    const goal = { x: 0, y: 0, z: 150 };
    // Right beside the bot (a little behind it), as at a spawn.
    expect(vehicleFor([car(0, 4, -3)], from, goal, 22)?.index).toBe(0);
    // Close, but the wrong way.
    expect(vehicleFor([car(1, 0, -20)], from, goal, 22)).toBeNull();
    // Short trips are walked.
    expect(vehicleFor([car(2, 4, -3)], from, { x: 0, y: 0, z: 40 }, 22)).toBeNull();
  });
});
