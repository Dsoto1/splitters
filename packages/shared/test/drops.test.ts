import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, DROP_FALL_TICKS, DROP_LIE_SECONDS, DROP_SETTLE_TICKS, MOUNT_DEFS, loadMap, type MapDocument, type MapEntity, type Vec3, MAX_DROPS, TICK_RATE, chooseDrop, dropsInPlay, getWeapon, initPhysics, parseClientMessage, weaponCode, type MatchRules } from '../src/index.ts';
import { BotFiller, HostControl, Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 };

/** A room, the spawn at -1 0 2 (where the killer stands). */
const room = () => makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-1, 0, 2]]);

/** A killer and a victim standing 3 m apart in the room. */
function setup(r: MatchRules = rules) {
  const match = new Match(room(), r, 3);
  const killer = match.addHuman('killer')!;
  const victim = match.addHuman('victim')!;
  killer.move = { pos: { x: -1, y: 0, z: 2 }, velY: 0, grounded: true };
  victim.move = { pos: { x: 2, y: 0, z: 2 }, velY: 0, grounded: true };
  return { match, killer, victim };
}

/** Put a weapon in someone's hands with this much ammo. */
function arm(c: Combatant, id: string, mag: number, reserve: number, alt = 0, hold = true): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag, reserve, alt });
  if (hold) c.current = weaponCode(def);
}

const kill = (m: Match, victim: Combatant, killer: Combatant | null) => (m as unknown as { kill(v: Combatant, k: Combatant | null, w: string): void }).kill(victim, killer, 'core.rifle');

/** Step the match with an idle input for `who` each tick. */
function run(m: Match, who: Combatant, ticks: number) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    m.queueInputs(who.slot, [{ seq: m.tick + 1, forward: 0, right: 0, yaw: who.yaw, pitch: 0, buttons: 0 }]);
    events.push(...m.step());
  }
  return events;
}

describe('weapon drops', () => {
  it('a fallen player drops the gun in hand with exactly its ammo, on the ground at the body', () => {
    const { match, killer, victim } = setup();
    arm(victim, 'core.rifle', 17, 43, 1);
    // Shot in mid-air: it falls to the floor.
    victim.move.pos.y = 1.5;
    kill(match, victim, killer);
    expect(match.drops).toHaveLength(1);
    const d = match.drops[0]!;
    expect(d.def.id).toBe('core.rifle');
    expect(d.item.id).toBe('core.weapon_rifle');
    expect([d.mag, d.reserve, d.alt]).toEqual([17, 43, 1]);
    expect(d.pos.x).toBeCloseTo(2);
    expect(d.pos.z).toBeCloseTo(2);
    expect(Math.abs(d.pos.y)).toBeLessThan(0.1);
    // Clients get it in the snapshot, for a moment with the height it fell from (they show the fall)...
    expect(match.snapshot([]).dw).toEqual([[d.id, 'core.weapon_rifle', 2, d.pos.y, 2, victim.yaw, 1.5]]);
    // ...then lying.
    run(match, killer, DROP_FALL_TICKS + 1);
    expect(match.snapshot([]).dw).toEqual([[d.id, 'core.weapon_rifle', 2, d.pos.y, 2, victim.yaw]]);
  });

  it('nothing drops without ammo, nor the starting weapons; a starting gun in hand drops the best other gun with ammo', () => {
    let { match, killer, victim } = setup();
    arm(victim, 'core.rifle', 0, 0);
    kill(match, victim, killer);
    expect(match.drops).toHaveLength(0);

    ({ match, killer, victim } = setup());
    // Only the knife and the starting pistol (full of ammo).
    victim.current = weaponCode(getWeapon('core.pistol'));
    kill(match, victim, killer);
    expect(match.drops).toHaveLength(0);
    expect(match.snapshot([]).dw).toBeUndefined();

    ({ match, killer, victim } = setup());
    arm(victim, 'core.smg', 10, 0, 0, false);
    arm(victim, 'core.rockets', 1, 2, 0, false);
    arm(victim, 'core.shotgun', 0, 0, 0, false);
    victim.current = weaponCode(getWeapon('core.pistol'));
    kill(match, victim, killer);
    expect(match.drops.map((d) => d.def.id)).toEqual(['core.rockets']);
  });

  it('chooses as designed: tools, spears and plain melee never drop; heat weapons do', () => {
    const w = (id: string, mag = 5, reserve = 5) => ({ def: getWeapon(id), mag, reserve, alt: 0 });
    const none = new Set<string>();
    expect(chooseDrop([w('core.medkit')], w('core.medkit'), none)).toBeNull();
    expect(chooseDrop([w('core.spear', 1, 0)], w('core.spear', 1, 0), none)).toBeNull();
    expect(chooseDrop([w('core.knife', 0, 0)], w('core.knife', 0, 0), none)).toBeNull();
    expect(chooseDrop([w('core.laser_rifle', 0, 0)], w('core.laser_rifle', 0, 0), none)?.def.id).toBe('core.laser_rifle');
    expect(chooseDrop([w('core.battle_axe', 0, 3)], undefined, none)?.def.id).toBe('core.battle_axe');
    expect(chooseDrop([w('core.battle_axe', 0, 0)], undefined, none)).toBeNull();
  });

  it('someone without the weapon takes it whole, with its ammo, and it comes up', () => {
    const { match, killer, victim } = setup();
    arm(victim, 'core.rifle', 12, 34, 1);
    kill(match, victim, killer);
    const d = match.drops[0]!;
    killer.move = { pos: { ...d.pos }, velY: 0, grounded: true };
    const events = run(match, killer, 3);
    const w = killer.weapons.get(weaponCode(getWeapon('core.rifle')));
    expect(w && [w.mag, w.reserve, w.alt]).toEqual([12, 34, 1]);
    expect(match.drops).toHaveLength(0);
    expect(events.some((e) => e.e === 'pickup' && e.s === killer.slot && e.id === `drop_${d.id}` && e.item === 'core.weapon_rifle')).toBe(true);
    // A rifle is a better slot than the pistol: it comes up like a map pickup's.
    expect(killer.current).toBe(weaponCode(getWeapon('core.rifle')));
  });

  it('someone with the weapon takes its ammo up to their reserve cap; the rest stays on the ground', () => {
    const { match, killer, victim } = setup();
    const max = getWeapon('core.rifle').reserveMax;
    arm(victim, 'core.rifle', 30, 50);
    kill(match, victim, killer);
    arm(killer, 'core.rifle', 30, max - 10);
    const d = match.drops[0]!;
    killer.move = { pos: { ...d.pos }, velY: 0, grounded: true };
    run(match, killer, 3);
    expect(killer.weapons.get(weaponCode(getWeapon('core.rifle')))!.reserve).toBe(max);
    expect(match.drops).toHaveLength(1);
    expect(d.reserve + d.mag).toBe(70);
    // Full now: nothing more taken, no pickup.
    const again = run(match, killer, 3);
    expect(again.some((e) => e.e === 'pickup')).toBe(false);
    expect(d.reserve + d.mag).toBe(70);
    // Room for all of it: consumed.
    killer.weapons.get(weaponCode(getWeapon('core.rifle')))!.reserve = 0;
    run(match, killer, 2);
    expect(match.drops).toHaveLength(0);
    expect(killer.weapons.get(weaponCode(getWeapon('core.rifle')))!.reserve).toBe(70);
  });

  it('a drop lies DROP_LIE_SECONDS, then goes', () => {
    const { match, killer, victim } = setup();
    arm(victim, 'core.shotgun', 2, 8);
    kill(match, victim, killer);
    run(match, killer, Math.round(DROP_LIE_SECONDS * TICK_RATE) - 2);
    expect(match.drops).toHaveLength(1);
    run(match, killer, 4);
    expect(match.drops).toHaveLength(0);
  });

  it(`at most ${MAX_DROPS} lie at once: the oldest goes first`, () => {
    const { match, killer, victim } = setup();
    for (let i = 0; i < MAX_DROPS + 5; i++) {
      arm(victim, 'core.smg', 10 + i, 0);
      kill(match, victim, killer);
    }
    expect(match.drops).toHaveLength(MAX_DROPS);
    expect(match.drops[0]!.mag).toBe(15);
    expect(match.drops.at(-1)!.mag).toBe(10 + MAX_DROPS + 4);
  });

  it('rule off, spears or discs only, Disc Arena: nothing drops', () => {
    for (const r of [{ ...rules, dropWeapons: false }, { ...rules, weapons: 'spears' as const }]) {
      const { match, killer, victim } = setup(r);
      arm(victim, 'core.rifle', 30, 30);
      kill(match, victim, killer);
      expect(match.drops).toHaveLength(0);
    }
    expect(dropsInPlay({ ...rules, mode: 'core.discs' })).toBe(false);
    expect(dropsInPlay({ ...rules, mode: 'core.tdm' })).toBe(true);
    expect(dropsInPlay(rules)).toBe(true);
  });

  it('the host turns drops off and on at once (off clears the ones lying); the command is checked', () => {
    const { match, killer, victim } = setup();
    const host = new HostControl(match, new BotFiller(match), 2);
    expect(host.state().rules?.dropWeapons).toBe(true);
    arm(victim, 'core.rifle', 30, 30);
    kill(match, victim, killer);
    expect(match.drops).toHaveLength(1);
    expect(host.apply({ c: 'rules', rules: { dropWeapons: false } }).notice).toMatch(/turned weapon drops off/);
    expect(match.drops).toHaveLength(0);
    expect(host.state().rules?.dropWeapons).toBe(false);
    kill(match, victim, killer);
    expect(match.drops).toHaveLength(0);
    host.apply({ c: 'rules', rules: { dropWeapons: true } });
    kill(match, victim, killer);
    expect(match.drops).toHaveLength(1);
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { dropWeapons: false } } }))).toEqual({ t: 'host', cmd: { c: 'rules', rules: { dropWeapons: false } } });
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { dropWeapons: 1 } } }))).toBeNull();
  });

  it('bots see drops as weapon pickups', () => {
    const { match, killer, victim } = setup();
    const bot = match.addBot('bot', CORE_BOT_PROFILES[0]!)!;
    const seen: string[][] = [];
    const think = bot.bot!.think.bind(bot.bot!);
    bot.bot!.think = (view) => {
      seen.push(view.pickups.map((p) => `${p.id}:${p.item.id}`));
      return think(view);
    };
    arm(victim, 'core.rifle', 30, 30);
    kill(match, victim, killer);
    const id = match.drops[0]!.id;
    run(match, killer, 30);
    expect(seen.some((list) => list.includes(`drop_${id}:core.weapon_rifle`))).toBe(true);
  });
});

/**
 * Where a drop lies (owner, 2026-11-27: riders killed in the Hauler left their guns hanging in the air at their seats):
 * on the ground or floor under where its owner died, never on a vehicle; in water or over nothing, the nearest dry
 * floor, or none.
 */
describe('weapon drops land on the ground', () => {
  /** An open yard 32 × 48 m (floor at 0), with a Hauler parked at 12 0 18, a pool and a crate’s spot. */
  function yard(extra: MapEntity[] = []) {
    const tiles = [];
    for (let x = 0; x < 4; x++) for (let y = 0; y < 6; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
    const map = makeMap(tiles, [[4, 0, 4]]);
    const doc = { ...map, entities: [...map.entities, { id: 'hauler', kind: 'mount', position: [12, 0, 18], model: 'hauler', yaw: Math.PI / 2, faction: null, respawnSeconds: null } as MapEntity, ...extra] } as MapDocument;
    const r = loadMap(doc);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    const match = new Match(r.map, rules, 3);
    const killer = match.addHuman('killer')!;
    const victim = match.addHuman('victim')!;
    killer.move = { pos: { x: 4, y: 0, z: 4 }, velY: 0, grounded: true };
    arm(victim, 'core.rifle', 20, 20);
    return { match, killer, victim };
  }
  /** The level's floor height at x z (map geometry only: what a drop should lie on). */
  const floorY = (m: Match, x: number, z: number) => 0.5 - ((m as unknown as { physics: { raycastWorld(o: Vec3, d: Vec3, n: number): number | null } }).physics.raycastWorld({ x, y: 0.5, z }, { x: 0, y: -1, z: 0 }, 5) ?? NaN);

  it('a rider killed in a vehicle seat: on the ground under the seat, not on the vehicle', () => {
    const { match, killer, victim } = yard();
    victim.move = { pos: { x: 12, y: 0, z: 15 }, velY: 0, grounded: true };
    const boarded = (match as unknown as { enterMount(c: Combatant): boolean }).enterMount(victim);
    expect(boarded).toBe(true);
    expect(victim.mount).toBeDefined();
    const seat = { ...victim.move.pos };
    kill(match, victim, killer);
    expect(match.drops).toHaveLength(1);
    const d = match.drops[0]!;
    // (The yard is flat: its floor as it is in the open.)
    const ground = floorY(match, 4, 4);
    expect(Math.abs(d.pos.y - ground)).toBeLessThan(0.05);
    // Under the seat (the yard’s floor, below the Hauler’s bed), and the fall from it is in the snapshot.
    expect(d.pos.x).toBeCloseTo(seat.x);
    expect(d.pos.z).toBeCloseTo(seat.z);
    expect(d.pos.y).toBeLessThan(MOUNT_DEFS.hauler.half[1]);
    expect(match.snapshot([]).dw![0]![6]).toBeCloseTo(seat.y, 2);
  });

  it('mid-air (blown up, mid-jump): on the ground under the body', () => {
    const { match, killer, victim } = yard();
    victim.move = { pos: { x: 24, y: 7.5, z: 30 }, velY: 6, grounded: false };
    kill(match, victim, killer);
    const d = match.drops[0]!;
    expect([d.pos.x, d.pos.z]).toEqual([24, 30]);
    expect(Math.abs(d.pos.y - floorY(match, 24, 30))).toBeLessThan(0.05);
  });

  it('just off a ledge: on the ground under the spot, not the ledge; under the map, over nothing, no drop', () => {
    let { match, killer, victim } = yard();
    const m = match as unknown as { addBox(kind: string, pos: Vec3, yaw: number, owner: number | null): { body: { translation(): Vec3 } } };
    // A crate's edge (it is under a metre across): killed stepping off it, at the height of its top.
    m.addBox('deployed', { x: 20, y: 0, z: 10 }, 0, null);
    victim.move = { pos: { x: 20.75, y: 0.9, z: 10 }, velY: 0, grounded: false };
    kill(match, victim, killer);
    expect(match.drops).toHaveLength(1);
    expect(Math.abs(match.drops[0]!.pos.y - floorY(match, 4, 4))).toBeLessThan(0.05);

    ({ match, killer, victim } = yard());
    arm(victim, 'core.rifle', 20, 20);
    victim.move = { pos: { x: 10, y: -30, z: 20 }, velY: -20, grounded: false };
    kill(match, victim, killer);
    expect(match.drops).toHaveLength(0);
  });

  it('in water: the nearest dry floor (the pool’s edge), not the bottom of the pool', () => {
    const pool: MapEntity = { id: 'pool', kind: 'water', position: [24, 0, 36], size: [5, 1.5, 5], liquid: 'water' } as MapEntity;
    const { match, killer, victim } = yard([pool]);
    victim.move = { pos: { x: 24, y: 0.2, z: 36 }, velY: 0, grounded: false };
    kill(match, victim, killer);
    expect(match.drops).toHaveLength(1);
    const d = match.drops[0]!;
    // Out of the water (2.5 m from the middle), at most 3-4 m off.
    expect(Math.max(Math.abs(d.pos.x - 24), Math.abs(d.pos.z - 36))).toBeGreaterThan(2.5);
    expect(Math.hypot(d.pos.x - 24, d.pos.z - 36)).toBeLessThanOrEqual(4.01);
  });

  it('what it lay on goes (a crate broken): it falls to the floor under it', () => {
    const { match, killer, victim } = yard();
    const m = match as unknown as { addBox(kind: string, pos: Vec3, yaw: number, owner: number | null): { body: unknown; pos: Vec3 }; damageBox(b: unknown, n: number, by: null): void };
    const box = m.addBox('deployed', { x: 20, y: 0, z: 10 }, 0, null);
    victim.move = { pos: { x: 20, y: 1.2, z: 10 }, velY: 0, grounded: false };
    kill(match, victim, killer);
    const d = match.drops[0]!;
    // On the crate’s top.
    expect(d.pos.y).toBeGreaterThan(0.2);
    m.damageBox(box, 100000, null);
    run(match, killer, DROP_SETTLE_TICKS + 1);
    expect(match.drops).toHaveLength(1);
    expect(Math.abs(d.pos.y - floorY(match, 20, 10))).toBeLessThan(0.05);
    expect(match.snapshot([]).dw![0]!.length).toBe(7);
  });
});
