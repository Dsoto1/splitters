import { beforeAll, describe, expect, it } from 'vitest';
import {
  CORE_ITEMS,
  CORE_WEAPONS,
  DEFAULT_DEATHMATCH_RULES,
  WEAPON_CATEGORIES,
  categoryItems,
  getItem,
  getWeapon,
  weaponCode,
  initPhysics,
  itemCategory,
  loadMap,
  parseClientMessage,
  pickupPool,
  rollPickup,
  setCategoryPool,
  setPickupPool,
  weaponSetList,
  serializeMap,
  validateMap,
  type MapDocument,
  type MatchRules,
  type PickupEntity,
  type WeaponCategory,
} from '../src/index.ts';
import { BotFiller, HostControl, Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

/** A room with the given pickups along x (the first, at -1 0 2, on the spawn). */
function room(pickups: Partial<PickupEntity>[]): MapDocument {
  const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-1, 0, 2]]);
  return { ...map, entities: [...map.entities, ...pickups.map((p, i) => ({ id: `pickup_${i}`, kind: 'pickup' as const, position: [i - 1, 0, 2] as [number, number, number], item: 'core.weapon_rifle', respawnSeconds: 1, ...p }))] };
}

const itemOf = (m: Match, id: string) => m.pickups.find((p) => p.id === id)!.item;

describe('weapon categories', () => {
  it('every weapon pickup but tools and mode weapons has a category, and every category has several weapons', () => {
    const tools = new Set(['core.medkit', 'core.medi_beam', 'core.grapple', 'core.arena_disc']);
    for (const item of CORE_ITEMS) {
      if (item.effect.kind !== 'weapon' || tools.has(item.effect.weapon)) continue;
      expect(CORE_WEAPONS[item.effect.weapon]?.category, item.id).toBeDefined();
    }
    // (Melee is the battle axe and the spear: the knife is everyone's from the start.)
    for (const c of WEAPON_CATEGORIES) expect(categoryItems(c).length, c).toBeGreaterThanOrEqual(2);
    // Mounted guns never roll.
    for (const w of Object.values(CORE_WEAPONS)) if (w.slot === 0) expect(w.category, w.id).toBeUndefined();
  });

  it('rolls stay in their category, are deterministic and never repeat the weapon that lay there', () => {
    for (const c of WEAPON_CATEGORIES) {
      const pool = categoryItems(c);
      let last = pool[0]!;
      const seen = new Set<string>();
      for (let n = 0; n < 40; n++) {
        const roll = rollPickup(7, 'pickup_a', n, pool, last);
        expect(itemCategory(roll), `${c} roll ${n}`).toBe(c);
        expect(roll).toBe(rollPickup(7, 'pickup_a', n, pool, last));
        expect(roll).not.toBe(last);
        seen.add(roll.id);
        last = roll;
      }
      // Every weapon of a small category comes up in 40 rolls; big ones show a good spread.
      expect(seen.size, c).toBeGreaterThanOrEqual(Math.min(pool.length, 3));
    }
    // Another seed or pickup rolls differently.
    const pool = categoryItems('special');
    const a = Array.from({ length: 10 }, (_, n) => rollPickup(1, 'x', n, pool).id).join();
    expect(Array.from({ length: 10 }, (_, n) => rollPickup(2, 'x', n, pool).id).join()).not.toBe(a);
    expect(Array.from({ length: 10 }, (_, n) => rollPickup(1, 'y', n, pool).id).join()).not.toBe(a);
  });

  it('a placed pickup rolls from its own category, or from its weapon\'s when mixed up and not kept fixed', () => {
    expect(pickupPool({ item: 'core.weapon_rifle' }, false)).toBeNull();
    expect(pickupPool({ item: 'core.weapon_rifle', random: 'shotgun' }, false)).toBe(categoryItems('shotgun'));
    expect(pickupPool({ item: 'core.weapon_rifle' }, true)).toBe(categoryItems('rifle'));
    expect(pickupPool({ item: 'core.weapon_rifle', keepFixed: true }, true)).toBeNull();
    // Health, ammo and tools never mix.
    expect(pickupPool({ item: 'core.health_small' }, true)).toBeNull();
    expect(pickupPool({ item: 'core.weapon_medkit' }, true)).toBeNull();
  });
});

describe('a pickup random pickups never roll (`rolls: false`: the Pistol)', () => {
  it('the Pistol has a pickup, after every earlier one (so no earlier roll moved), its weapon\'s name and category', () => {
    const pistol = getItem('core.weapon_pistol')!;
    expect(pistol.effect).toEqual({ kind: 'weapon', weapon: 'core.pistol' });
    expect(pistol.displayName).toBe('Pistol');
    expect(pistol.rolls).toBe(false);
    // Last when it came (2026-11-20); only the weapons intake of 2026-11-18's pickups have come after it, at the end.
    const after = CORE_ITEMS.slice(CORE_ITEMS.indexOf(pistol) + 1).map((i) => i.id);
    expect(after).toEqual(['core.weapon_desert_carbine', 'core.weapon_twin_rifle', 'core.weapon_compact_carbine', 'core.weapon_woodland_smg', 'core.weapon_amarillo', 'core.weapon_nova6', 'core.weapon_lever_action', 'core.weapon_runebreaker', 'core.weapon_flintlock_pistol', 'core.weapon_crossbow', 'core.weapon_blaster_x42', 'core.weapon_laser_blaster', 'core.weapon_hornet', 'core.weapon_katana', 'core.weapon_scimitar', 'core.weapon_baseball_bat', 'core.weapon_space_shield', 'core.weapon_heart_taser']);
    expect(itemCategory(pistol)).toBe('pistol');
    // Only the Pistol is marked: every other weapon pickup rolls as before.
    expect(CORE_ITEMS.filter((i) => i.rolls === false).map((i) => i.id)).toEqual(['core.weapon_pistol']);
  });

  it('is in no random pool, no mix-up pool and no weapon set\'s pool', () => {
    for (const c of WEAPON_CATEGORIES) expect(categoryItems(c).some((i) => i.rolls === false), c).toBe(false);
    for (const set of weaponSetList()) {
      for (const c of WEAPON_CATEGORIES) expect(setCategoryPool(set, c).some((i) => i.rolls === false), `${set.id} ${c}`).toBe(false);
    }
  });

  it('placed, it lies as placed; mixed up (not kept fixed) or random, it rolls another sidearm, like any placed weapon', () => {
    expect(pickupPool({ item: 'core.weapon_pistol' }, false)).toBeNull();
    expect(pickupPool({ item: 'core.weapon_pistol', keepFixed: true }, true)).toBeNull();
    expect(pickupPool({ item: 'core.weapon_pistol' }, true)).toBe(categoryItems('pistol'));
    expect(pickupPool({ item: 'core.weapon_pistol', random: 'pistol' }, false)).toBe(categoryItems('pistol'));
    // A set that leaves weapons as placed (Standard) keeps it; Military (its weapons include the Pistol) keeps it when kept fixed.
    const standard = weaponSetList().find((s) => s.weapons === undefined)!;
    expect(setPickupPool(standard, { item: 'core.weapon_pistol' }, false)).toBeNull();
    const military = weaponSetList().find((s) => Array.isArray(s.weapons) && s.weapons.includes('core.pistol'))!;
    expect(setPickupPool(military, { item: 'core.weapon_pistol', keepFixed: true }, false)).toBeNull();
  });

  it('a placed Pistol pickup in a match lies there and gives the Pistol to someone without one', () => {
    const match = new Match(room([{ item: 'core.weapon_pistol' }]), { ...rules, startingWeapons: ['core.knife'] }, 7);
    const a = match.addHuman('A')!;
    expect(a.weapons.has(weaponCode(getWeapon('core.pistol')))).toBe(false);
    let got = false;
    for (let i = 0; i < 10 && !got; i++) {
      match.queueInputs(a.slot, [{ seq: i + 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
      got = match.step().some((e) => e.e === 'pickup' && e.item === 'core.weapon_pistol');
    }
    expect(match.pickups[0]!.item.id).toBe('core.weapon_pistol');
    expect(got).toBe(true);
    expect(a.weapons.has(weaponCode(getWeapon('core.pistol')))).toBe(true);
    match.destroy();
  });
});

describe('random weapon pickups in a match', () => {
  it('a random pickup holds a weapon of its category, the same in every match with that seed', () => {
    const map = room([{ random: 'sniper' }, { random: 'explosive', item: 'core.weapon_rockets' }, {}]);
    const a = new Match(map, rules, 11);
    const b = new Match(map, rules, 11);
    for (const [id, c] of [['pickup_0', 'sniper'], ['pickup_1', 'explosive']] as [string, WeaponCategory][]) {
      expect(itemCategory(itemOf(a, id))).toBe(c);
      expect(itemOf(a, id)).toBe(itemOf(b, id));
    }
    // A plain pickup stays as placed.
    expect(itemOf(a, 'pickup_2').id).toBe('core.weapon_rifle');
    // The snapshot says what the random ones hold (where it isn't what was placed).
    const pw = new Map(a.snapshot([]).pw ?? []);
    expect(pw.get('pickup_0')).toBe(itemOf(a, 'pickup_0').id);
    expect(pw.has('pickup_2')).toBe(false);
  });

  it('a taken random pickup comes back as another weapon of its category, and the taker got the one that lay there', () => {
    const match = new Match(room([{ random: 'shotgun' }]), rules, 3);
    const p = match.pickups[0]!;
    const before = p.item;
    const c = match.addHuman('a')!;
    const events = [];
    for (let i = 0; i < 10; i++) {
      match.queueInputs(c.slot, [{ seq: i + 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
      events.push(...match.step());
    }
    const pickup = events.find((e) => e.e === 'pickup');
    expect(pickup && pickup.e === 'pickup' && pickup.item).toBe(before.id);
    expect(before.effect.kind === 'weapon' && [...c.weapons.values()].some((w) => w.def.id === (before.effect as { weapon: string }).weapon)).toBe(true);
    expect(p.item).not.toBe(before);
    expect(itemCategory(p.item)).toBe('shotgun');
    // Hidden while it waits, then back as the new roll.
    expect(match.snapshot([]).pk).toContain(p.id);
  });

  it('the host mix-up rolls fixed weapon pickups within their category, leaves kept ones, and turns off again', () => {
    const map = room([{ item: 'core.weapon_shotgun' }, { item: 'core.weapon_sniper', keepFixed: true }, { item: 'core.health_small' }]);
    const off = new Match(map, rules, 5);
    expect(off.pickups.map((p) => p.item.id)).toEqual(['core.weapon_shotgun', 'core.weapon_sniper', 'core.health_small']);
    const on = new Match(map, { ...rules, mixPickups: true }, 5);
    expect(itemCategory(itemOf(on, 'pickup_0'))).toBe('shotgun');
    expect(itemOf(on, 'pickup_0').id).not.toBe('core.weapon_shotgun');
    expect(itemOf(on, 'pickup_1').id).toBe('core.weapon_sniper');
    expect(itemOf(on, 'pickup_2').id).toBe('core.health_small');
    // Mid-match, through the host's controls: at once, no restart.
    const host = new HostControl(off, new BotFiller(off), 1);
    const r = host.apply({ c: 'rules', rules: { mixPickups: true } });
    expect(r.notice).toMatch(/mixed up the weapon pickups/);
    expect(host.state().rules?.mixPickups).toBe(true);
    expect(itemOf(off, 'pickup_0').id).not.toBe('core.weapon_shotgun');
    expect(itemCategory(itemOf(off, 'pickup_0'))).toBe('shotgun');
    expect(itemOf(off, 'pickup_1').id).toBe('core.weapon_sniper');
    host.apply({ c: 'rules', rules: { mixPickups: false } });
    expect(itemOf(off, 'pickup_0').id).toBe('core.weapon_shotgun');
    expect(off.snapshot([]).pw).toBeUndefined();
  });

  it('the rules command carries the mix-up; a bad value is refused', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { mixPickups: true } } }))).toEqual({ t: 'host', cmd: { c: 'rules', rules: { mixPickups: true } } });
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { mixPickups: 'yes' } } }))).toBeNull();
  });
});

describe('random pickups in maps', () => {
  it('load, save and validate: random and keepFixed round-trip, a mismatched shown item is flagged', () => {
    const map = room([{ random: 'pistol', item: 'core.weapon_revolver' }, { keepFixed: true }, { random: 'melee', item: 'core.weapon_rifle' }]);
    const back = loadMap(serializeMap(map));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const pickups = back.map.entities.filter((e): e is PickupEntity => e.kind === 'pickup');
    expect(pickups.map((p) => [p.random, p.keepFixed])).toEqual([['pistol', undefined], [undefined, true], ['melee', undefined]]);
    const issues = validateMap(back.map);
    expect(issues.filter((i) => i.targetId === 'pickup_2').map((i) => i.code)).toContain('pickup.random_item');
    expect(issues.some((i) => i.targetId === 'pickup_0' && i.code.startsWith('pickup.'))).toBe(false);
    // A category that isn't one is refused.
    expect(loadMap(serializeMap({ ...map, entities: map.entities.map((e) => (e.kind === 'pickup' ? { ...e, random: 'lasers' as WeaponCategory } : e)) })).ok).toBe(false);
    expect(getItem('core.weapon_battle_axe')).toBeDefined();
  });
});
