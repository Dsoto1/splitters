import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, DROP_LIE_SECONDS, MAX_DROPS, TICK_RATE, chooseDrop, dropsInPlay, getWeapon, initPhysics, parseClientMessage, weaponCode, type MatchRules } from '../src/index.ts';
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
    // Clients get it in the snapshot.
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

  it('rule off, spears or discs only, Disc Arena and races: nothing drops', () => {
    for (const r of [{ ...rules, dropWeapons: false }, { ...rules, weapons: 'spears' as const }]) {
      const { match, killer, victim } = setup(r);
      arm(victim, 'core.rifle', 30, 30);
      kill(match, victim, killer);
      expect(match.drops).toHaveLength(0);
    }
    expect(dropsInPlay({ ...rules, mode: 'core.discs' })).toBe(false);
    expect(dropsInPlay({ ...rules, mode: 'core.race' })).toBe(false);
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
