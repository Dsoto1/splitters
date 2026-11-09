// Weapon sets (docs/WEAPON_SETS_PLAN.md; sim/weaponSets.ts, content/weapon-sets.json): the data, the spawn loadouts,
// the random spawn guns, pickups rolling within a set by category, drops, the sniper gun, the map's default and the
// host's choice, and old maps and saved setups playing Standard.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CLASS_DEFS,
  PARTY_PRESETS,
  applyParty,
  presetPatch,
  CORE_BOT_PROFILES,
  CORE_ITEMS,
  DEFAULT_COOP_RULES,
  DEFAULT_DEATHMATCH_RULES,
  DEFAULT_TDM_RULES,
  DEFAULT_ZOMBIES_RULES,
  WEAPON_CATEGORIES,
  WEAPON_SET_DEFS,
  WEAPON_SET_IDS,
  applyServerRules,
  categoryItems,
  chooseDrop,
  getItem,
  getWeapon,
  getWeaponSet,
  inSetOr,
  initPhysics,
  itemCategory,
  loadMap,
  mapWeaponSet,
  matchWeaponSet,
  migrateMapDocument,
  nearCategories,
  normalizeSetup,
  parseClientMessage,
  pickupPool,
  pickupWeapons,
  randomGunFor,
  rulesForMode,
  rulesForTravel,
  rulesFromSetup,
  setAllowsDrop,
  setCategoryPool,
  setHas,
  setLoadout,
  setMainGun,
  setMainGuns,
  setPickupPool,
  setServerRule,
  setThrowablePool,
  setWeaponIds,
  serializeMap,
  weaponCode,
  weaponSetInPlay,
  type MapDocument,
  type MatchRules,
  type MatchSetup,
  type PickupEntity,
  type WeaponCategory,
} from '../src/index.ts';
import { BotFiller, HostControl, Match, initNavigation, type Combatant } from '../src/match.ts';
import { loadArena, makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const set = (id: (typeof WEAPON_SET_IDS)[number]) => WEAPON_SET_DEFS[id];
const ids = (items: readonly { id: string }[] | null) => (items ?? []).map((i) => i.id);
const weaponsOf = (items: readonly { effect: { kind: string; weapon?: string } }[] | null) => (items ?? []).map((i) => i.effect.weapon);
const TOOLS = ['core.medkit', 'core.medi_beam', 'core.grapple', 'core.builder', 'core.arena_disc'];

describe('the sets (content/weapon-sets.json)', () => {
  it('six sets in menu order; Standard plays as before', () => {
    expect([...WEAPON_SET_IDS]).toEqual(['standard', 'military', 'scifi', 'medieval', 'chaos', 'mixed']);
    expect(WEAPON_SET_IDS.map((id) => WEAPON_SET_DEFS[id].name)).toEqual(['Standard', 'Military', 'Sci-fi', 'Medieval', 'Chaos', 'Mixed bag']);
    const std = set('standard');
    expect([std.spawn, std.weapons, std.throwables, std.randomGun, std.sniper]).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(setWeaponIds(std)).toBeNull();
    for (const id of WEAPON_SET_IDS) expect(WEAPON_SET_DEFS[id].blurb.length, id).toBeGreaterThan(20);
  });

  it("every set weapon exists and is one a pickup can hold (a pickup, or the set's spawn), never a tool, mode-only weapon or mounted gun", () => {
    for (const id of WEAPON_SET_IDS) {
      const s = set(id);
      for (const w of setWeaponIds(s) ?? []) {
        const def = getWeapon(w);
        expect(def.category, `${id} ${w}`).toBeDefined();
        expect(def.slot, `${id} ${w}`).toBeGreaterThanOrEqual(1);
        expect(TOOLS, `${id} ${w}`).not.toContain(w);
        const pickup = getItem(`core.weapon_${w.replace(/^core\./, '')}`);
        expect(!!pickup || (s.spawn ?? []).includes(w), `${id} ${w}: a pickup, or spawned with`).toBe(true);
      }
    }
    // Mixed bag: every weapon a pickup can hold, and nothing else.
    const all = pickupWeapons().map((w) => w.id);
    for (const w of ['core.railgun', 'core.singularity', 'core.spear', 'core.battle_axe', 'core.swarm', 'core.revolver']) expect(all).toContain(w);
    for (const w of TOOLS) expect(all).not.toContain(w);
    expect([...setWeaponIds(set('mixed'))!].sort()).toEqual([...new Set([...all, 'core.knife', 'core.pistol'])].sort());
  });

  it("the plan's table (owner, 2026-11-06), the knife in every set (owner, 2026-11-07), the grenades as approved", () => {
    expect(set('military').spawn).toEqual(['core.knife', 'core.pistol', 'core.rifle']);
    expect(set('military').sniper).toBe('core.marksman');
    expect([...setWeaponIds(set('military'))!].sort()).toEqual(['core.auto_shotgun', 'core.battle_rifle', 'core.burst_rifle', 'core.hand_cannon', 'core.knife', 'core.launcher', 'core.lmg', 'core.machine_pistol', 'core.marksman', 'core.pistol', 'core.revolver', 'core.rifle', 'core.rockets', 'core.sawed_off', 'core.shotgun', 'core.smg', 'core.sniper']);
    expect(set('scifi').spawn).toEqual(['core.knife', 'core.pulse_pistol', 'core.plasma']);
    expect(set('scifi').sniper).toBe('core.railgun');
    expect([...setWeaponIds(set('scifi'))!].sort()).toEqual(['core.arc_caster', 'core.disc_launcher', 'core.guided', 'core.knife', 'core.laser_rifle', 'core.plasma', 'core.pulse_pistol', 'core.railgun', 'core.swarm']);
    expect(set('medieval').spawn).toEqual(['core.knife', 'core.spear']);
    expect([...setWeaponIds(set('medieval'))!].sort()).toEqual(['core.battle_axe', 'core.knife', 'core.spear']);
    expect(set('chaos').spawn).toEqual(['core.knife', 'core.pistol']);
    expect(set('mixed').spawn).toEqual(['core.knife', 'core.pistol']);
    expect([set('chaos').randomGun, set('mixed').randomGun]).toEqual([true, true]);
    for (const id of WEAPON_SET_IDS) if (id !== 'standard') expect(set(id).spawn?.[0], id).toBe('core.knife');
    // (The Smoke Grenade, the weapons intake of 2026-11-06, in Military and Sci-fi.)
    expect(set('military').throwables).toEqual(['frag', 'mine', 'smoke']);
    expect(set('scifi').throwables).toEqual(['sticky', 'vortex', 'smoke']);
    expect(set('medieval').throwables).toEqual(['incendiary', 'holy']);
    expect(set('chaos').throwables).toEqual(['sheep', 'holy', 'cluster']);
    expect(set('mixed').throwables).toBe('all');
    // The sniper guns are scoped (what the bots' sniper role looks for: a zoom, no second trigger).
    for (const g of ['core.marksman', 'core.railgun']) expect(!!getWeapon(g).view.zoomFov && !getWeapon(g).alt, g).toBe(true);
  });
});

describe('spawn loadouts', () => {
  const kit = (id: (typeof WEAPON_SET_IDS)[number], rules: MatchRules = DEFAULT_TDM_RULES, o: { life?: number; sniper?: boolean; slot?: number } = {}) => setLoadout(set(id), rules, { seed: 5, slot: o.slot ?? 2, life: o.life ?? 1, sniper: o.sniper });

  it("each set's spawn weapons, the last one held, and its first grenade", () => {
    expect(kit('standard')).toEqual({ weapons: ['core.knife', 'core.pistol'], throwable: { kind: 'frag', count: 1 } });
    // Standard keeps the mode's own: co-op adds a rifle, Zombies two grenades.
    expect(kit('standard', DEFAULT_COOP_RULES).weapons).toEqual(['core.knife', 'core.pistol', 'core.rifle']);
    expect(kit('standard', DEFAULT_ZOMBIES_RULES).throwable).toEqual({ kind: 'frag', count: 2 });
    expect(kit('military')).toEqual({ weapons: ['core.knife', 'core.pistol', 'core.rifle'], throwable: { kind: 'frag', count: 1 } });
    expect(kit('scifi')).toEqual({ weapons: ['core.knife', 'core.pulse_pistol', 'core.plasma'], throwable: { kind: 'sticky', count: 1 } });
    expect(kit('medieval')).toEqual({ weapons: ['core.knife', 'core.spear'], throwable: { kind: 'incendiary', count: 1 } });
    // The sets' own spawn replaces the mode's (co-op in Military is still knife, pistol and rifle).
    expect(kit('military', DEFAULT_COOP_RULES).weapons).toEqual(['core.knife', 'core.pistol', 'core.rifle']);
    // At most what a player carries: one holy bomb, one sheep.
    expect(kit('chaos', DEFAULT_ZOMBIES_RULES).throwable).toEqual({ kind: 'sheep', count: 1 });
    const chaos = kit('chaos');
    expect(chaos.weapons.slice(0, 2)).toEqual(['core.knife', 'core.pistol']);
    expect(chaos.weapons).toHaveLength(3);
    expect(setMainGuns(set('chaos')).map((w) => w.id)).toContain(chaos.weapons[2]);
    expect(chaos.throwable).toEqual({ kind: 'sheep', count: 1 });
    const mixed = kit('mixed');
    expect(mixed.weapons).toHaveLength(3);
    expect(getWeapon(mixed.weapons[2]!).slot).toBeGreaterThanOrEqual(3);
    expect(mixed.throwable).toEqual({ kind: 'frag', count: 1 });
  });

  it("a sniper-role bot carries the set's scoped gun in place of the main gun", () => {
    expect(kit('military', DEFAULT_TDM_RULES, { sniper: true }).weapons).toEqual(['core.knife', 'core.pistol', 'core.marksman']);
    expect(kit('scifi', DEFAULT_TDM_RULES, { sniper: true }).weapons).toEqual(['core.knife', 'core.pulse_pistol', 'core.railgun']);
    // Sets without a scoped gun of their own: as anyone (the sniper goes for a scoped pickup).
    expect(kit('standard', DEFAULT_TDM_RULES, { sniper: true }).weapons).toEqual(['core.knife', 'core.pistol']);
    expect(kit('medieval', DEFAULT_TDM_RULES, { sniper: true }).weapons).toEqual(['core.knife', 'core.spear']);
  });

  it('random spawn guns: from the seed, the slot and the life; the same every time, a new one most lives, every main gun in turn', () => {
    const chaos = set('chaos');
    const mains = setMainGuns(chaos).map((w) => w.id);
    // Chaos's main guns: its slot 3-9 oddballs (the flare gun and gilded pistol are pickups, slot 2).
    expect([...mains].sort()).toEqual(['core.blast_rockets', 'core.bubble_blaster', 'core.flak', 'core.freeze_ray', 'core.goo_gun', 'core.nailgun', 'core.oil_slicker', 'core.singularity', 'core.swarm']);
    const lives = Array.from({ length: 60 }, (_, i) => randomGunFor(chaos, 7, 3, i + 1)!);
    expect(Array.from({ length: 60 }, (_, i) => randomGunFor(chaos, 7, 3, i + 1))).toEqual(lives);
    for (const g of lives) expect(mains).toContain(g);
    // A shuffled deck: every oddball once in each round of nine lives, and never the same one twice running.
    for (let round = 0; round + mains.length <= lives.length; round += mains.length) expect(new Set(lives.slice(round, round + mains.length)).size).toBe(mains.length);
    expect(lives.filter((g, i) => i > 0 && g === lives[i - 1])).toEqual([]);
    expect(lives.slice(0, 9).join()).not.toBe(lives.slice(9, 18).join());
    // Another seed, or another player, rolls another sequence.
    expect(Array.from({ length: 10 }, (_, i) => randomGunFor(chaos, 8, 3, i + 1)).join()).not.toBe(lives.slice(0, 10).join());
    expect(Array.from({ length: 10 }, (_, i) => randomGunFor(chaos, 7, 4, i + 1)).join()).not.toBe(lives.slice(0, 10).join());
    // Mixed bag: any main gun a pickup can hold.
    const mixed = new Set(Array.from({ length: 200 }, (_, i) => randomGunFor(set('mixed'), 1, 0, i + 1)!));
    expect(mixed.size).toBeGreaterThan(15);
    for (const g of mixed) expect(getWeapon(g).slot).toBeGreaterThanOrEqual(3);
    // No random gun in the other sets.
    expect(randomGunFor(set('military'), 7, 3, 1)).toBeNull();
    expect(randomGunFor(set('standard'), 7, 3, 1)).toBeNull();
  });
});

describe('pickups roll within the set', () => {
  const pool = (id: (typeof WEAPON_SET_IDS)[number], e: Partial<PickupEntity> & { item: string }) => setPickupPool(set(id), e, false);

  it('by category, else the nearest categories the set has (a sniper pickup in Sci-fi is the railgun)', () => {
    expect(weaponsOf(pool('scifi', { item: 'core.weapon_sniper' }))).toEqual(['core.railgun']);
    expect(weaponsOf(pool('military', { item: 'core.weapon_rifle' }))).toEqual(['core.rifle', 'core.burst_rifle', 'core.battle_rifle']);
    expect(weaponsOf(pool('military', { item: 'core.weapon_plasma' }))).toEqual(['core.rifle', 'core.burst_rifle', 'core.battle_rifle']);
    // Military has no melee or specials: a battle axe is a shotgun; a special an explosive, a sidearm or a rifle.
    expect(weaponsOf(pool('military', { item: 'core.weapon_battle_axe' })).sort()).toEqual(['core.auto_shotgun', 'core.sawed_off', 'core.shotgun']);
    expect(weaponsOf(pool('military', { item: 'core.weapon_singularity' })).sort()).toEqual(['core.battle_rifle', 'core.burst_rifle', 'core.hand_cannon', 'core.launcher', 'core.revolver', 'core.rifle', 'core.rockets']);
    // Sci-fi has no SMGs or shotguns.
    expect(weaponsOf(pool('scifi', { item: 'core.weapon_smg' })).sort()).toEqual(['core.laser_rifle', 'core.plasma', 'core.pulse_pistol']);
    expect(weaponsOf(pool('scifi', { item: 'core.weapon_shotgun' })).sort()).toEqual(['core.arc_caster', 'core.laser_rifle', 'core.plasma', 'core.pulse_pistol']);
    // Medieval: every weapon pickup a spear or a battle axe.
    for (const c of WEAPON_CATEGORIES) expect(weaponsOf(setCategoryPool(set('medieval'), c)).sort(), c).toEqual(['core.battle_axe', 'core.spear']);
    // Chaos: a rifle or a pistol pickup is the nailgun or one of the specials.
    expect(weaponsOf(pool('chaos', { item: 'core.weapon_rifle' })).sort()).toEqual(['core.bubble_blaster', 'core.flare_gun', 'core.freeze_ray', 'core.gilded_pistol', 'core.goo_gun', 'core.nailgun', 'core.oil_slicker', 'core.singularity']);
    // Mixed bag: its own category, every weapon of it.
    for (const c of WEAPON_CATEGORIES) expect(setCategoryPool(set('mixed'), c), c).toEqual(categoryItems(c));
    // Every pool holds only the set's weapons, never empty.
    for (const id of WEAPON_SET_IDS) {
      if (id === 'standard') continue;
      for (const c of WEAPON_CATEGORIES) {
        const p = setCategoryPool(set(id), c);
        expect(p.length, `${id} ${c}`).toBeGreaterThan(0);
        for (const w of weaponsOf(p)) expect(setHas(set(id), w!), `${id} ${c} ${w}`).toBe(true);
        // The same array each time (the match compares pools to see a change).
        expect(setCategoryPool(set(id), c)).toBe(p);
      }
    }
  });

  it('nearest categories: ties together, the own category first', () => {
    const has = (...cs: WeaponCategory[]) => (c: WeaponCategory) => cs.includes(c);
    expect(nearCategories('rifle', has('rifle', 'smg'))).toEqual(['rifle']);
    expect(nearCategories('sniper', has('rifle', 'smg'))).toEqual(['rifle']);
    expect(nearCategories('pistol', has('smg', 'special', 'melee'))).toEqual(['smg', 'special']);
    expect(nearCategories('melee', has('shotgun', 'sniper'))).toEqual(['shotgun']);
  });

  it('kept fixed: stays when its weapon is of the set; a random pickup rolls within the set; tools, health and ammo stay', () => {
    expect(pool('military', { item: 'core.weapon_rifle', keepFixed: true })).toBeNull();
    expect(weaponsOf(pool('military', { item: 'core.weapon_railgun', keepFixed: true })).sort()).toEqual(['core.marksman', 'core.sniper']);
    expect(weaponsOf(pool('military', { item: 'core.weapon_rifle', random: 'explosive' })).sort()).toEqual(['core.launcher', 'core.rockets']);
    for (const item of ['core.health_small', 'core.ammo', 'core.ammo_rifle', 'core.weapon_medkit', 'core.weapon_grapple', 'core.jetpack', 'core.powerup_damage']) expect(pool('chaos', { item }), item).toBeNull();
    // Standard: as before (the host's mix-up, a pickup's own category).
    expect(setPickupPool(set('standard'), { item: 'core.weapon_rifle' }, false)).toBeNull();
    expect(setPickupPool(set('standard'), { item: 'core.weapon_rifle' }, true)).toBe(pickupPool({ item: 'core.weapon_rifle' }, true));
    expect(setPickupPool(set('standard'), { item: 'core.weapon_rifle', random: 'shotgun' }, false)).toBe(categoryItems('shotgun'));
    // No set (spears or discs only): as before.
    expect(setPickupPool(null, { item: 'core.weapon_rifle' }, true)).toBe(categoryItems('rifle'));
  });

  it("grenade pickups hold the set's grenades; Standard's stay as placed", () => {
    expect(ids(pool('military', { item: 'core.vortex_grenades' }))).toEqual(['core.grenades', 'core.mines', 'core.smoke_grenades']);
    expect(ids(pool('chaos', { item: 'core.grenades' }))).toEqual(['core.sheep', 'core.holy_bomb', 'core.cluster_bombs']);
    expect(ids(pool('scifi', { item: 'core.grenades' }))).toEqual(['core.sticky_grenades', 'core.vortex_grenades', 'core.smoke_grenades']);
    expect(pool('military', { item: 'core.grenades', keepFixed: true })).toBeNull();
    expect(pool('standard', { item: 'core.grenades' })).toBeNull();
    const every = setThrowablePool(set('mixed'))!;
    expect(every.length).toBe(CORE_ITEMS.filter((i) => i.effect.kind === 'throwable').length);
    expect(setThrowablePool(set('military'))).toBe(setThrowablePool(set('military')));
  });
});

/** A room with pickups along x (the first, at -1 0 2, on the spawn). */
function room(pickups: (Partial<PickupEntity> & { item: string })[], weaponSet?: string): MapDocument {
  const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-1, 0, 2]]);
  return { ...map, ...(weaponSet ? { weaponSet } : {}), entities: [...map.entities, ...pickups.map((p, i) => ({ id: `pickup_${i}`, kind: 'pickup' as const, position: [i - 1, 0, 2] as [number, number, number], respawnSeconds: 1, ...p }))] };
}
const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 };
const held = (c: Combatant) => [...c.weapons.values()].find((w) => weaponCode(w.def) === c.current)?.def.id;
const carried = (c: Combatant) => [...c.weapons.values()].map((w) => w.def.id);

describe('in a match', () => {
  it("everyone spawns with the set's loadout; the map's default plays unless the host picks another", () => {
    const map = room([], 'military');
    const m = new Match(map, rules, 3);
    expect(m.weaponSet?.id).toBe('military');
    const a = m.addHuman('a')!;
    expect(carried(a)).toEqual(['core.knife', 'core.pistol', 'core.rifle']);
    expect(held(a)).toBe('core.rifle');
    expect(a.throwable).toEqual({ kind: 'frag', count: 1 });
    // The host's choice wins over the map's.
    const s = new Match(map, { ...rules, weaponSet: 'scifi' }, 3);
    const b = s.addHuman('b')!;
    expect(carried(b)).toEqual(['core.knife', 'core.pulse_pistol', 'core.plasma']);
    expect(b.throwable).toEqual({ kind: 'sticky', count: 1 });
    // A map without a set, and a host choice no build has: Standard, the mode's own loadout.
    const std = new Match(room([]), { ...rules, weaponSet: 'nonsense' }, 3);
    expect(std.weaponSet?.id).toBe('standard');
    expect(carried(std.addHuman('c')!)).toEqual(['core.knife', 'core.pistol']);
  });

  it("Chaos: a random oddball each life, the same in every match with that seed, and the sheep", () => {
    const lifeGuns = (seed: number) => {
      const m = new Match(room([]), { ...rules, weaponSet: 'chaos', respawnDelayTicks: 1 }, seed);
      const c = m.addHuman('a')!;
      const guns: string[] = [];
      for (let life = 0; life < 12; life++) {
        guns.push(held(c)!);
        expect(c.throwable).toEqual({ kind: 'sheep', count: 1 });
        (m as unknown as { kill(v: Combatant, k: Combatant | null, w: string): void }).kill(c, null, 'core.rifle');
        for (let i = 0; i < 5 && !c.alive; i++) {
          m.queueInputs(c.slot, [{ seq: m.tick + 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
          m.step();
        }
      }
      return guns;
    };
    const a = lifeGuns(9);
    expect(lifeGuns(9)).toEqual(a);
    const mains = setMainGuns(set('chaos')).map((w) => w.id);
    for (const g of a) expect(mains).toContain(g);
    expect(new Set(a).size).toBeGreaterThan(4);
    expect(lifeGuns(10)).not.toEqual(a);
  });

  it("pickups hold the set's weapons, the same in every match with that seed; a new set rolls them at once", () => {
    const map = room([{ item: 'core.weapon_sniper' }, { item: 'core.weapon_rifle' }, { item: 'core.weapon_shotgun' }, { item: 'core.health_small' }, { item: 'core.grenades' }], 'scifi');
    const a = new Match(map, rules, 11);
    const b = new Match(map, rules, 11);
    expect(a.pickups.map((p) => p.item.id)).toEqual(b.pickups.map((p) => p.item.id));
    const item = (m: Match, i: number) => m.pickups[i]!.item;
    expect(item(a, 0).id).toBe('core.weapon_railgun');
    expect(['core.weapon_plasma', 'core.weapon_laser_rifle']).toContain(item(a, 1).id);
    expect(setHas(set('scifi'), (item(a, 2).effect as { weapon: string }).weapon)).toBe(true);
    expect(item(a, 3).id).toBe('core.health_small');
    expect(['core.sticky_grenades', 'core.vortex_grenades', 'core.smoke_grenades']).toContain(item(a, 4).id);
    // The snapshot says what they hold (clients draw that).
    expect(new Map(a.snapshot([]).pw ?? []).get('pickup_0')).toBe('core.weapon_railgun');
    // The host switches to Military: they roll within it now.
    const host = new HostControl(a, new BotFiller(a), 1);
    expect(host.state().rules?.weaponSet).toBeNull();
    expect(host.state().mapWeaponSet).toBe('scifi');
    const r = host.apply({ c: 'rules', rules: { weaponSet: 'military' } });
    expect(r.notice).toMatch(/set the weapons to Military/);
    expect(host.state().rules?.weaponSet).toBe('military');
    expect(a.weaponSet?.id).toBe('military');
    expect(['core.weapon_sniper', 'core.weapon_marksman']).toContain(item(a, 0).id);
    expect(['core.weapon_rifle', 'core.weapon_burst_rifle', 'core.weapon_battle_rifle']).toContain(item(a, 1).id);
    expect(['core.grenades', 'core.mines', 'core.smoke_grenades']).toContain(item(a, 4).id);
    // Back to the map's default.
    expect(host.apply({ c: 'rules', rules: { weaponSet: null } }).notice).toMatch(/the map's \(Sci-fi\)/);
    expect(a.rules.weaponSet).toBeUndefined();
    expect(item(a, 0).id).toBe('core.weapon_railgun');
    // The command over the wire: a set's id or null; anything else refused.
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { weaponSet: 'chaos' } } }))).toEqual({ t: 'host', cmd: { c: 'rules', rules: { weaponSet: 'chaos' } } });
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { weaponSet: null } } }))).toEqual({ t: 'host', cmd: { c: 'rules', rules: { weaponSet: null } } });
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { weaponSet: 'lasers' } } }))).toBeNull();
  });

  it('only the set\'s weapons drop, never what everyone spawns with', () => {
    const m = new Match(room([], 'military'), rules, 3);
    const killer = m.addHuman('k')!;
    const victim = m.addHuman('v')!;
    victim.move = { pos: { x: 2, y: 0, z: 2 }, velY: 0, grounded: true };
    const arm = (id: string) => {
      const def = getWeapon(id);
      victim.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.pickupAmmo, alt: 0 });
      victim.current = weaponCode(def);
    };
    const kill = () => (m as unknown as { kill(v: Combatant, k: Combatant | null, w: string): void }).kill(victim, killer, 'core.rifle');
    // The spawn's rifle in hand: nothing (everyone has one).
    kill();
    expect(m.drops).toHaveLength(0);
    // A plasma rifle from before a set change isn't the set's; the SMG is.
    victim.alive = true;
    arm('core.smg');
    arm('core.plasma');
    kill();
    expect(m.drops.map((d) => d.def.id)).toEqual(['core.smg']);
    expect(setAllowsDrop(set('military'), 'core.plasma')).toBe(false);
    expect(setAllowsDrop(null, 'core.plasma')).toBe(true);
    // chooseDrop alone: what the set allows.
    const w = (id: string) => ({ def: getWeapon(id), mag: 5, reserve: 5, alt: 0 });
    expect(chooseDrop([w('core.plasma'), w('core.shotgun')], w('core.plasma'), new Set(), (d) => setAllowsDrop(set('military'), d.id))?.def.id).toBe('core.shotgun');
  });

  it("sniper-role bots spawn with the set's scoped gun: Military's marksman rifle, Sci-fi's railgun; the others as before", () => {
    const sniperProfile = CORE_BOT_PROFILES.find((p) => p.tags.includes('SNIPER'))!;
    const play = (weaponSet?: string) => {
      const m = new Match(loadArena(), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, ...(weaponSet ? { weaponSet } : {}) }, 4);
      for (let i = 0; i < 10; i++) m.addBot(`bot${i}`, sniperProfile);
      const director = (m as unknown as { director: { roleOf(slot: number): string | null } }).director;
      const bots = m.combatants().filter((c) => c.kind === 'bot');
      return { m, snipers: bots.filter((c) => director.roleOf(c.slot) === 'sniper'), others: bots.filter((c) => director.roleOf(c.slot) !== 'sniper') };
    };
    const mil = play('military');
    expect(mil.m.sniperGun).toBe('core.marksman');
    expect(mil.snipers.length).toBeGreaterThan(0);
    for (const c of mil.snipers) expect(carried(c)).toEqual(['core.knife', 'core.pistol', 'core.marksman']);
    for (const c of mil.others) expect(carried(c)).toEqual(['core.knife', 'core.pistol', 'core.rifle']);
    const sci = play('scifi');
    expect(sci.m.sniperGun).toBe('core.railgun');
    for (const c of sci.snipers) expect(held(c)).toBe('core.railgun');
    const std = play();
    expect(std.m.sniperGun).toBeNull();
    for (const c of std.snipers) expect(carried(c)).toEqual(['core.knife', 'core.pistol']);
    // A sniper's next life: the scoped gun again.
    const c = mil.snipers[0]!;
    (mil.m as unknown as { kill(v: Combatant, k: Combatant | null, w: string): void }).kill(c, null, 'core.rifle');
    (mil.m as unknown as { spawn(c: Combatant): void }).spawn(c);
    expect(held(c)).toBe('core.marksman');
    for (const x of [mil.m, sci.m, std.m]) x.destroy();
  });

  it('fixed weapons (spears or discs only, Disc Arena) play no set; classes keep their loadouts, pickups still roll within the set', () => {
    const map = room([{ item: 'core.weapon_rifle' }], 'chaos');
    const spears = new Match(map, { ...rules, weapons: 'spears' }, 3);
    expect(spears.weaponSet).toBeNull();
    expect(spears.sniperGun).toBeNull();
    const s = spears.addHuman('s')!;
    expect(carried(s)).toEqual(['core.spear']);
    expect(s.throwable).toBeNull();
    expect(weaponSetInPlay({ ...DEFAULT_DEATHMATCH_RULES, weapons: 'discs', weaponSet: 'chaos' }, map)).toBeNull();
    const classes = new Match(map, { ...DEFAULT_TDM_RULES, classes: true, scoreLimit: 0 }, 3);
    const c = classes.addHuman('c')!;
    expect(c.cls).toBeDefined();
    expect(carried(c)).toEqual([...CLASS_DEFS[c.cls!.id].weapons]);
    expect(setHas(set('chaos'), (classes.pickups[0]!.item.effect as { weapon: string }).weapon)).toBe(true);
  });
});

describe('the map default, the host and saved setups', () => {
  it('the map names its default; the host overrides it; an unknown one is Standard', () => {
    expect(mapWeaponSet({ weaponSet: 'military' })).toBe('military');
    expect(mapWeaponSet({})).toBe('standard');
    expect(mapWeaponSet({ weaponSet: 'pirates' })).toBe('standard');
    expect(mapWeaponSet(null)).toBe('standard');
    expect(matchWeaponSet({}, { weaponSet: 'scifi' })).toBe('scifi');
    expect(matchWeaponSet({ weaponSet: 'chaos' }, { weaponSet: 'scifi' })).toBe('chaos');
    expect(matchWeaponSet({ weaponSet: 'pirates' }, { weaponSet: 'scifi' })).toBe('scifi');
    expect(getWeaponSet('pirates').id).toBe('standard');
  });

  it("Match setup's choice reaches the rules; saved setups keep it; one this build lacks is the map's default", () => {
    const map = room([], 'military');
    const base: MatchSetup = { map: 'test_map', mode: 'core.deathmatch', bots: 3, skill: 'normal', scoreLimit: 15, minutes: 10 };
    expect(rulesFromSetup(base, map).rules.weaponSet).toBeUndefined();
    expect(rulesFromSetup({ ...base, weaponSet: 'medieval' }, map).rules.weaponSet).toBe('medieval');
    expect(rulesFromSetup({ ...base, weaponSet: 'pirates' }, map).rules.weaponSet).toBeUndefined();
    expect(normalizeSetup(JSON.parse(JSON.stringify({ ...base, weaponSet: 'chaos' })))?.weaponSet).toBe('chaos');
    expect(normalizeSetup({ ...base, weaponSet: 'pirates' })).not.toHaveProperty('weaponSet');
    // A setup saved before weapon sets: the map's default.
    expect(normalizeSetup(base)).not.toHaveProperty('weaponSet');
  });

  it('size presets and party presets keep the setup\'s set', () => {
    const map = room([], 'military');
    const base: MatchSetup = { map: 'test_map', mode: 'core.deathmatch', bots: 3, skill: 'normal', scoreLimit: 15, minutes: 10, weaponSet: 'chaos' };
    const lunar = PARTY_PRESETS.find((p) => p.id === 'lunar_roulette')!;
    expect(applyParty(lunar, base, map, ['core.deathmatch', 'core.roulette'], { deviceMax: 16 })?.weaponSet).toBe('chaos');
    expect({ ...base, ...presetPatch({ id: 'small', label: 'Small', players: 4, value: '4 players', tip: '' }) }.weaponSet).toBe('chaos');
  });

  it("the host's set stays through a map change; the map's default follows the map", () => {
    const military = room([], 'military');
    const scifi = room([], 'scifi');
    const own = rulesForTravel({ ...rulesForMode(military, 'core.deathmatch'), weaponSet: 'chaos' }, scifi, 8).rules;
    expect(own.weaponSet).toBe('chaos');
    const def = rulesForTravel(rulesForMode(military, 'core.deathmatch'), scifi, 8).rules;
    expect(def.weaponSet).toBeUndefined();
    expect(matchWeaponSet(def, scifi)).toBe('scifi');
  });

  it("a server's `set` rule: a set, or the map's default", () => {
    const map = room([], 'military');
    const r = (v: unknown) => applyServerRules(rulesForMode(map, 'core.tdm'), setServerRule({}, 'set', v, { mode: 'core.tdm' }), map, 8).rules;
    expect(r('chaos').weaponSet).toBe('chaos');
    expect(r('map').weaponSet).toBeUndefined();
    expect(r(undefined).weaponSet).toBeUndefined();
  });

  it('maps: the field saves and loads (format v28); a v27 map and a map without one play Standard; an unknown one is flagged', () => {
    const map = room([], 'medieval');
    const back = loadMap(serializeMap(map));
    expect(back.ok && back.map.weaponSet).toBe('medieval');
    const v27 = { ...room([]), formatVersion: 27 };
    const { doc, fromVersion } = migrateMapDocument(v27);
    expect(fromVersion).toBe(27);
    expect(doc).not.toHaveProperty('weaponSet');
    const loaded = loadMap(v27);
    expect(loaded.ok && mapWeaponSet(loaded.map)).toBe('standard');
    const odd = loadMap(room([], 'pirates'));
    expect(odd.ok).toBe(true);
    expect(odd.issues.map((i) => i.code)).toContain('weapons.set_unknown');
    expect(odd.ok && mapWeaponSet(odd.map)).toBe('standard');
    // Malformed ids are refused by the schema.
    expect(loadMap({ ...room([]), weaponSet: 'Mil Itary!' }).ok).toBe(false);
  });

  it("a mode's own weapon outside the set falls back to the set's main gun (the Roulette mode's signature loadouts)", () => {
    expect(inSetOr(set('military'), 'core.plasma')).toBe('core.rifle');
    expect(inSetOr(set('military'), 'core.shotgun')).toBe('core.shotgun');
    expect(inSetOr(set('scifi'), 'core.rockets')).toBe('core.plasma');
    expect(inSetOr(set('standard'), 'core.rockets')).toBe('core.rockets');
    expect(inSetOr(null, 'core.rockets')).toBe('core.rockets');
    expect(setMainGun(set('chaos'))).toBe(setMainGuns(set('chaos'))[0]!.id);
    expect(setMainGun(set('medieval'))).toBeNull();
    expect(inSetOr(set('medieval'), 'core.rockets')).toBe('core.rockets');
  });

  it('an item category for every set weapon pickup', () => {
    for (const id of WEAPON_SET_IDS) for (const w of setWeaponIds(set(id)) ?? []) {
      const item = getItem(`core.weapon_${w.replace(/^core\./, '')}`);
      if (item) expect(itemCategory(item), `${id} ${w}`).toBe(getWeapon(w).category);
    }
  });
});
