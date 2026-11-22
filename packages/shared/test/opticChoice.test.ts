import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_ZOOM, BOT_DIFFICULTIES, DEFAULT_DEATHMATCH_RULES, getWeapon, initPhysics, parseClientMessage, weaponCode, type PlayerInput } from '../src/index.ts';
import { BotFiller, Match, initNavigation, type Combatant } from '../src/match.ts';
import { OPTIC_CHOICES_MAX, chosenOptic, cleanOpticChoices, magnifiedOptic, sameOpticChoices } from '../src/sim/opticChoice.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

function yard() {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [8, 0, 4]]);
}

function give(c: Combatant, id: string): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
}

describe('optic choices (sim/opticChoice.ts; docs/MULTIPLAYER_PROTOCOL.md section 27)', () => {
  it('are made valid: only an optic the gun may carry, never its default, nothing for guns without a choice', () => {
    expect(cleanOpticChoices({ 'core.rifle': 'x2', 'core.smg': 'holo', 'core.pistol': 'reddot' })).toEqual({ 'core.rifle': 'x2', 'core.smg': 'holo', 'core.pistol': 'reddot' });
    // Defaults need no entry; a kind the gun may not carry, an unknown gun or kind, a sniper's scope: dropped.
    expect(cleanOpticChoices({ 'core.rifle': 'irons', 'core.burst_rifle': 'reddot', 'core.nope': 'x2', 'core.smg': 'laser', 'core.sniper': 'reddot', 'core.pistol': 'x2' })).toBeUndefined();
    expect(cleanOpticChoices(null)).toBeUndefined();
    expect(cleanOpticChoices(['core.rifle'])).toBeUndefined();
    expect(cleanOpticChoices({ __proto__: { 'core.rifle': 'x2' } })).toBeUndefined();
    expect(cleanOpticChoices({ constructor: 'x2', toString: 'holo' })).toBeUndefined();
    const many = Object.fromEntries(Array.from({ length: OPTIC_CHOICES_MAX + 10 }, (_, i) => [`core.g${i}`, 'x2']));
    expect(cleanOpticChoices({ ...many, 'core.rifle': 'x2' })).toBeUndefined();
    expect(chosenOptic('core.rifle', { 'core.rifle': 'x2' })).toBe('x2');
    expect(chosenOptic('core.rifle', { 'core.rifle': 'sniper' })).toBe('irons');
    expect(chosenOptic('core.rocket_nope')).toBeNull();
    expect(magnifiedOptic('x2')).toBe(true);
    expect(magnifiedOptic('sniper')).toBe(true);
    expect(magnifiedOptic('reddot')).toBe(false);
    expect(sameOpticChoices(undefined, {})).toBe(true);
    expect(sameOpticChoices({ 'core.rifle': 'x2' }, { 'core.rifle': 'holo' })).toBe(false);
  });

  it('hello carries them and the optics message changes them: shapes only (the match checks the guns)', () => {
    const hello = parseClientMessage(JSON.stringify({ t: 'hello', protocol: 5, name: 'A', op: { 'core.rifle': 'x2' } }));
    expect(hello).toMatchObject({ t: 'hello', op: { 'core.rifle': 'x2' } });
    // An older client sends none; a malformed list is left out of hello (the player joins on the defaults).
    expect(parseClientMessage(JSON.stringify({ t: 'hello', protocol: 5, name: 'A' }))).not.toHaveProperty('op');
    for (const op of [[], 'x2', { 'core.rifle': 3 }, { 'Core Rifle': 'x2' }, { 'core.rifle': 'x2<script>' }, {}]) expect(parseClientMessage(JSON.stringify({ t: 'hello', protocol: 5, name: 'A', op })), JSON.stringify(op)).not.toHaveProperty('op');
    expect(parseClientMessage(JSON.stringify({ t: 'optics', op: { 'core.smg': 'holo' } }))).toEqual({ t: 'optics', op: { 'core.smg': 'holo' } });
    // Every gun back on its default: an empty list.
    expect(parseClientMessage(JSON.stringify({ t: 'optics', op: {} }))).toEqual({ t: 'optics', op: {} });
    expect(parseClientMessage(JSON.stringify({ t: 'optics' }))).toEqual({ t: 'optics', op: {} });
    expect(parseClientMessage(JSON.stringify({ t: 'optics', op: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`core.g${i}`, 'x2'])) }))).toBeNull();
  });

  it('are kept on the player and go to everyone in the roster; a change is reported once; bots have none', () => {
    const match = new Match(yard(), rules, 1);
    const a = match.addHuman('A')!;
    expect(match.setOptics(a.slot, { 'core.rifle': 'x2', 'core.sniper': 'reddot' })).toBe(true);
    expect(a.optics).toEqual({ 'core.rifle': 'x2' });
    expect(match.roster().find((p) => p.slot === a.slot)!.op).toEqual({ 'core.rifle': 'x2' });
    expect(match.setOptics(a.slot, { 'core.rifle': 'x2' }), 'the same again').toBe(false);
    expect(match.setOptics(a.slot, {}), 'back to the defaults').toBe(true);
    expect(a.optics).toBeUndefined();
    expect(match.roster().find((p) => p.slot === a.slot)).not.toHaveProperty('op');
    // A bot (Match setup's bots): never.
    const bots = new BotFiller(match, BOT_DIFFICULTIES.normal, { botSet: null });
    bots.rebalance(2);
    const bot = match.combatants().find((c) => c.kind === 'bot')!;
    expect(match.setOptics(bot.slot, { 'core.rifle': 'x2' })).toBe(false);
    expect(match.roster().find((p) => p.slot === bot.slot)).not.toHaveProperty('op');
    // A spectator keeps theirs for when they play again.
    match.setOptics(a.slot, { 'core.smg': 'holo' });
    expect(match.spectate(a.slot)).toBe(true);
    expect(match.roster().find((p) => p.slot === a.slot)!.op).toEqual({ 'core.smg': 'holo' });
    expect(match.setOptics(a.slot, { 'core.smg': 'reddot' })).toBe(true);
    expect(match.joinFromSpectating(a.slot)!.optics).toEqual({ 'core.smg': 'reddot' });
    match.destroy();
  });

  it('zm: a rifle aimed through the 2x optic its player picked is scoped; through its iron sights it is not', () => {
    const scoped = (op?: Record<string, string>) => {
      const match = new Match(yard(), rules, 3);
      const a = match.addHuman('A')!;
      match.setOptics(a.slot, op);
      give(a, 'core.rifle');
      let seq = 0;
      let zm: 1 | undefined;
      for (let i = 0; i < 40; i++) {
        const input: PlayerInput = { seq: ++seq, forward: 0, right: 0, yaw: a.yaw, pitch: a.pitch, buttons: BUTTON_ZOOM };
        match.queueInputs(a.slot, [input]);
        match.step();
        zm = match.playerSnapshots().find((p) => p.s === a.slot)!.zm;
      }
      match.destroy();
      return zm;
    };
    expect(scoped()).toBeUndefined();
    expect(scoped({ 'core.rifle': 'reddot' })).toBeUndefined();
    expect(scoped({ 'core.rifle': 'x2' })).toBe(1);
  });
});
