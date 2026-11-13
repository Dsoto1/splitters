import { describe, expect, it } from 'vitest';
import {
  PARTY_PRESETS,
  SETUP_VARIANTS,
  applyParty,
  capMessage,
  changeTeamBots,
  changeTeamCount,
  evenTeams,
  mapPickTeams,
  matchingPreset,
  normalizeSetup,
  partyOn,
  partyUnavailable,
  playerCap,
  presetPatch,
  rulesFromSetup,
  setTeamSize,
  setVariant,
  setupFit,
  setupPeople,
  setupSummary,
  sizePresets,
  variantOn,
  variantStates,
  type GameMode,
  type MapDocument,
  type MatchSetup,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

/** A map like St. John's: made for 8–32, its own layout 12v12, 41 spawn points (12 a side, 17 shared). */
function stJohns(): MapDocument {
  const at: [number, number, number][] = Array.from({ length: 41 }, (_, i) => [(i % 8) * 6, 0, Math.floor(i / 8) * 6]);
  const map = makeMap([], at);
  return {
    ...map,
    // Its player caps as set in MapMaker (the test map is far smaller than the real one, whose automatic caps these are).
    metadata: { ...map.metadata, recommendedPlayers: { min: 8, max: 32 }, supportedModes: ['core.tdm', 'core.deathmatch', 'core.ctf', 'core.koth', 'core.elim'], playerCaps: { 'core.tdm': { recommended: 24, max: 122 } } },
    teamSetup: { sizes: [12, 12] },
    entities: map.entities.map((e, i) => (e.kind === 'spawn' && i < 24 ? { ...e, faction: i < 12 ? 'embers' : 'tide' } : e)),
  };
}

/** A small map: made for 2–8, 16 spawn points, no layout of its own, no sides. */
function small(): MapDocument {
  const map = makeMap([], Array.from({ length: 16 }, (_, i) => [i * 4, 0, 0] as [number, number, number]));
  return { ...map, metadata: { ...map.metadata, recommendedPlayers: { min: 2, max: 8 }, supportedModes: ['core.tdm', 'core.deathmatch'] } };
}

const setup = (over: Partial<MatchSetup> = {}): MatchSetup => ({ map: 'st_johns', mode: 'core.tdm', bots: 11, skill: 'normal', scoreLimit: 40, minutes: 10, ...over });
const desk = { deviceMax: 48 };
const phone = { deviceMax: 16, device: 'this phone' };

describe('people and bots', () => {
  it('reads as you and bots, never as that many people', () => {
    const map = stJohns();
    expect(setupSummary(setup({ teams: [24, 24] }), map)).toBe('You + 47 bots · 24v24');
    expect(setupSummary(setup({ teams: [24, 24] }), map, 3)).toBe('3 players + 45 bots · 24v24');
    expect(setupSummary(setup(), map)).toBe('You + 23 bots · 12v12');
    expect(setupSummary(setup({ mode: 'core.deathmatch', bots: 7 }), map)).toBe('You + 7 bots');
    expect(setupSummary(setup({ mode: 'core.coop', bots: 1 }), map)).toBe('You + 1 squadmate');
    expect(setupSummary(setup({ mode: 'core.deathmatch', bots: 0 }), map)).toBe('You');
  });

  it('puts you on your team: the first when balanced, the one you picked, none on a random team', () => {
    expect(setupPeople(setup(), 2)).toEqual([1, 0]);
    expect(setupPeople(setup({ assign: 'fixed', playerTeam: 2 }), 3)).toEqual([0, 0, 1]);
    expect(setupPeople(setup({ assign: 'fixed', playerTeam: 7 }), 3)).toEqual([0, 0, 1]);
    expect(setupPeople(setup({ assign: 'random' }), 2)).toEqual([0, 0]);
  });
});

describe('adding bots grows the team', () => {
  const cap = playerCap('core.tdm', stJohns(), 48);
  const o = { people: [1, 0], cap, even: false };

  it('a team of 10 takes an eleventh instead of snapping back; removing one shrinks it', () => {
    expect(changeTeamBots([10, 10], 0, 1, o)).toEqual({ sizes: [11, 10], stopped: null });
    expect(changeTeamBots([10, 10], 1, 5, o)).toEqual({ sizes: [10, 15], stopped: null });
    expect(changeTeamBots([10, 10], 1, -3, o)).toEqual({ sizes: [10, 7], stopped: null });
    expect(setTeamSize([10, 10], 0, 20, o)).toEqual({ sizes: [20, 10], stopped: null });
  });

  it('even teams change together and stay matched', () => {
    const even = { ...o, even: true };
    expect(changeTeamBots([10, 10], 1, 1, even).sizes).toEqual([11, 11]);
    expect(changeTeamBots([4, 4, 4], 0, -1, { ...even, people: [1, 0, 0] }).sizes).toEqual([3, 3, 3]);
    expect(setTeamSize([4, 4], 1, 9, even).sizes).toEqual([9, 9]);
    // Switching it on: every team the size of the largest.
    expect(evenTeams([3, 5, 4], { people: [1, 0, 0], cap })).toEqual({ sizes: [5, 5, 5], stopped: null });
    // A new team comes in at the same size.
    expect(changeTeamCount([6, 6], 3, 'core.tdm', even)).toEqual({ sizes: [6, 6, 6], stopped: null });
  });

  it('stops at a cap and says whose it is', () => {
    const even = { ...o, even: true };
    expect(changeTeamBots([24, 24], 0, 1, even)).toEqual({ sizes: [24, 24], stopped: "24 per team is this computer's limit." });
    expect(changeTeamBots([30, 18], 1, 1, o)).toEqual({ sizes: [30, 18], stopped: "48 players in all is this computer's limit." });
    expect(setTeamSize([20, 20], 0, 40, o)).toEqual({ sizes: [28, 20], stopped: "48 players in all is this computer's limit." });
    const onPhone = { ...even, cap: playerCap('core.tdm', stJohns(), 16), device: 'this phone' };
    expect(changeTeamBots([8, 8], 0, 1, onPhone).stopped).toBe("8 per team is this phone's limit.");
    expect(evenTeams([6, 30], { people: [1, 0], cap })).toEqual({ sizes: [24, 24], stopped: "24 per team is this computer's limit." });
    expect(changeTeamCount([24, 24], 3, 'core.tdm', even)).toEqual({ sizes: [16, 16, 16], stopped: "16 per team is this computer's limit." });
    // A team keeps its people, and at least one player.
    expect(changeTeamBots([1, 4], 0, -1, o)).toEqual({ sizes: [1, 4], stopped: 'Every team needs at least one player.' });
    expect(changeTeamBots([3, 1], 1, -1, o).stopped).toBe('Every team needs at least one player.');
    // Two-team modes stay two.
    expect(changeTeamCount([8, 8], 3, 'core.ctf', o)).toEqual({ sizes: [8, 8], stopped: 'Capture the Flag is always two teams.' });
    // A setup made on a bigger computer never shrinks on a press of +.
    expect(changeTeamBots([24, 24], 0, 1, onPhone).sizes).toEqual([24, 24]);
  });

  it('caps players at what the device runs', () => {
    const map = small();
    expect(playerCap('core.deathmatch', map, 48)).toEqual({ max: 48, by: 'device' });
    expect(capMessage(playerCap('core.deathmatch', map, 16), { device: 'this phone' })).toBe("16 players is this phone's limit.");
  });
});

describe('presets that scale with the map', () => {
  const ids = (ps: { id: string }[]) => ps.map((p) => p.id).join(',');
  const values = (ps: { value: string }[]) => ps.map((p) => p.value).join(' ');

  it("works out Duel, Small, Map's pick, Big battle and Max from the map and the device", () => {
    const map = stJohns();
    const ps = sizePresets('core.tdm', map, desk);
    expect(ids(ps)).toBe('duel,small,pick,big,max');
    expect(values(ps)).toBe('1v1 4v4 12v12 16v16 24v24');
    expect(ps.find((p) => p.id === 'pick')!.label).toBe("Map's pick");
    // On a phone, Max is what it runs; Big battle would be the same, so it goes.
    expect(values(sizePresets('core.tdm', map, phone))).toBe('1v1 4v4 8v8');
    expect(ids(sizePresets('core.tdm', map, phone))).toBe('duel,small,pick');
    // Four teams: the same idea shared four ways (the map's pick stays its own layout).
    expect(values(sizePresets('core.tdm', map, { ...desk, teams: 4 }))).toBe('1v1 2v2v2v2 12v12 8v8v8v8 12v12v12v12');
  });

  it("a map with no layout of its own: its pick is its recommended most, split in two; Big battle half again", () => {
    const map = small();
    expect(mapPickTeams(map, 'core.tdm', 48)).toEqual([4, 4]);
    expect(values(sizePresets('core.tdm', map, desk))).toBe('1v1 2v2 4v4 6v6 24v24');
    expect(values(sizePresets('core.deathmatch', map, desk))).toBe('2 players 4 players 8 players 12 players 48 players');
  });

  it('free-for-all and squads get the same idea in their own form', () => {
    const map = stJohns();
    expect(values(sizePresets('core.deathmatch', map, desk))).toBe('2 players 8 players 12 players 32 players 48 players');
    // The Arcade's own starting count for the map is its pick.
    expect(sizePresets('core.deathmatch', map, { ...desk, pickPlayers: 10 }).find((p) => p.id === 'pick')!.players).toBe(10);
    // A squad stops at the map's own size (its layout, 12v12: 24 in all), not at what the device runs.
    const squad = sizePresets('core.coop', map, desk);
    expect(squad.map((p) => p.label).join()).toBe("Solo,Duo,Map's pick,Max");
    expect(values(squad)).toBe('you alone you + 1 squad of 12 squad of 24');
  });

  it('knows which preset a setup is on, and Custom once it changes', () => {
    const map = stJohns();
    const ps = sizePresets('core.tdm', map, desk);
    expect(matchingPreset(setup(), map, ps)!.id).toBe('pick');
    expect(matchingPreset(setup({ teams: [24, 24] }), map, ps)!.id).toBe('max');
    expect(matchingPreset(setup({ teams: [12, 13] }), map, ps)).toBeNull();
    const ffa = sizePresets('core.deathmatch', map, desk);
    expect(matchingPreset(setup({ mode: 'core.deathmatch', bots: 11 }), map, ffa)!.id).toBe('pick');
    expect(presetPatch(ffa.find((p) => p.id === 'duel')!)).toEqual({ bots: 1 });
    expect(presetPatch(ps.find((p) => p.id === 'max')!)).toEqual({ teams: [24, 24] });
  });
});

describe('the fit indicator', () => {
  it('fits at the map’s pick, crowded at 24v24 (with a button for the map’s pick), a problem far past the map', () => {
    const map = stJohns();
    expect(setupFit(setup(), map, desk)).toMatchObject({ level: 'fits', label: 'Fits' });
    const big = setupFit(setup({ teams: [24, 24] }), map, desk);
    expect(big).toMatchObject({ level: 'crowded', label: 'Crowded' });
    const size = big.items.find((i) => i.topic === 'size')!;
    expect(size).toMatchObject({ level: 'warn', fix: { label: 'Use 12v12', teams: [12, 12] } });
    expect(size.text).toMatch(/The map suggests 12v12/);
    expect(big.items.map((i) => i.topic)).toEqual(['caps', 'size', 'spawns', 'performance']);
    expect(big.items[0]).toMatchObject({ topic: 'caps', level: 'info' });
    // 16v16 fits; the map's own layout is still offered.
    const sixteen = setupFit(setup({ teams: [16, 16] }), map, desk);
    expect(sixteen.level).toBe('fits');
    expect(sixteen.items.find((i) => i.topic === 'size')).toMatchObject({ level: 'info', fix: { label: 'Use 12v12' } });
    const tiny = setupFit(setup({ teams: [24, 24] }), small(), desk);
    expect(tiny).toMatchObject({ level: 'problem', label: 'Problem' });
    // Over the map's most for the mode (its player caps): a problem, with its recommended as the fix.
    expect(tiny.items.find((i) => i.level === 'problem')).toMatchObject({ topic: 'caps', fix: { label: 'Use 8', teams: [4, 4] } });
    expect(tiny.items.find((i) => i.topic === 'size')).toMatchObject({ level: 'warn', fix: { label: 'Use 4v4', teams: [4, 4] } });
  });

  it('a setup asking for more than the device runs plays what fits and says so', () => {
    const onPhone = setupFit(setup({ teams: [24, 24] }), stJohns(), phone);
    expect(onPhone.items[0]).toEqual({ topic: 'device', level: 'info', text: 'This setup asks for 48 players; this phone runs 16, so it plays 8v8.' });
    expect(onPhone.level).toBe('fits');
    expect(setupSummary(setup({ teams: [24, 24] }), stJohns(), 1, 16)).toBe('You + 15 bots · 8v8');
    // With no teams of its own, a phone plays the map's layout made to fit.
    expect(rulesFromSetup(setup({ map: 'capitol' }), { ...stJohns(), teamSetup: { sizes: [16, 16] } }, 16).rules.teamSizes).toEqual([8, 8]);
  });
});

describe('variants', () => {
  const map = stJohns();
  const offered: GameMode[] = ['core.tdm', 'core.deathmatch', 'core.ctf', 'core.koth', 'core.elim'];
  const on = (s: MatchSetup) => variantStates(s, map, offered).filter((v) => v.on).map((v) => v.variant.id);

  it('are data: id, label, tip, the settings they set and the modes they suit', () => {
    for (const v of SETUP_VARIANTS) {
      expect(v.id).toMatch(/^[a-z_]+$/);
      expect(v.label && v.tip).toBeTruthy();
      expect(Object.keys(v.sets).length).toBeGreaterThan(0);
      for (const c of [...(v.conflicts ?? []), ...(v.needs ?? [])]) expect(SETUP_VARIANTS.some((x) => x.id === c)).toBe(true);
    }
    expect(SETUP_VARIANTS.map((v) => v.id)).toEqual(['lunar', 'roulette', 'signature', 'jackpots', 'streakpick', 'rerolls', 'swap', 'variety', 'rlteams', 'classes', 'spears', 'discs', 'fireteams']);
    // Co-op offers Lunar and Roulette bodies; the Roulette mode Lunar and its own (its bodies are its core).
    expect(variantStates(setup({ mode: 'core.coop' }), map, offered).map((v) => v.variant.id)).toEqual(['lunar', 'roulette']);
    expect(variantStates(setup({ mode: 'core.roulette' }), map, offered).map((v) => v.variant.id)).toEqual(['lunar', 'signature', 'jackpots', 'streakpick', 'rerolls', 'swap', 'variety', 'rlteams']);
  });

  it('switch their settings on and off, and show as on however the settings were set', () => {
    const lunar = setVariant(setup(), 'lunar', true);
    expect(lunar).toMatchObject({ gravity: 0.4, fallDamage: false });
    expect(on(lunar)).toEqual(['lunar']);
    expect(setVariant(lunar, 'lunar', false)).toEqual(setup());
    // Set one by one in Advanced rules: still Lunar.
    expect(on(setup({ gravity: 0.4 }))).toEqual(['lunar']);
    expect(on(setup({ gravity: 0.4, fallDamage: true }))).toEqual([]);
    // Roulette bodies: random characters. It is the one switch for them (the Rules tab's own was the same thing twice),
    // so it reads on whenever they are; Character stats is its own rule and is left as the host set it.
    const roulette = setVariant(setup({ stats: false }), 'roulette', true);
    expect(roulette).toEqual(setup({ stats: false, randomChars: true }));
    expect(on(setup({ randomChars: true }))).toEqual(['roulette']);
    expect(on(setup({ randomChars: true, stats: false }))).toEqual(['roulette']);
    expect(setVariant(roulette, 'roulette', false)).toEqual(setup({ stats: false }));
    expect(setVariant(setup({ randomChars: true }), 'roulette', false)).toEqual(setup());
  });

  it('conflicting variants switch each other off; Discs only needs a map with edges', () => {
    const classes = setVariant(setup({ classLimit: 2 }), 'classes', true);
    expect(on(classes)).toEqual(['classes']);
    const spears = setVariant(classes, 'spears', true);
    expect(on(spears)).toEqual(['spears']);
    expect(spears.classes).toBeUndefined();
    expect(spears.classLimit).toBeUndefined();
    expect(on(setVariant(spears, 'discs', true))).toEqual(['discs']);
    expect(rulesFromSetup(spears, map).rules.weapons).toBe('spears');
    expect(variantStates(setup(), map, offered).find((v) => v.variant.id === 'discs')!.disabled).toMatch(/edges/);
    expect(variantStates(setup({ mode: 'core.deathmatch' }), map, [...offered, 'core.discs']).find((v) => v.variant.id === 'discs')!.disabled).toBeNull();
  });

  it('need no new stored field: a saved setup from before reads its variants and plays the same', () => {
    const old = { map: 'st_johns', mode: 'core.tdm', bots: 3, skill: 'hard', scoreLimit: 40, minutes: 10, teams: [24, 24], squadSpawn: false, killstreaks: false, randomChars: true, gravity: 0.4, fallDamage: true, lethality: 'tactical', ballistics: 'advanced', vehicleDamage: 'tough', botStyle: 'tactical' };
    const s = normalizeSetup(old)!;
    expect(s).toMatchObject(old);
    expect(on(s)).toEqual(['roulette']);
    expect(rulesFromSetup(s, map).rules).toMatchObject({ teamSizes: [24, 24], gravity: 0.4, fallDamage: true, randomCharacters: true, lethality: 'tactical' });
    // (normalizeSetup marks whether its score and time follow the size; a variant adds nothing beyond that.)
    expect(Object.keys(setVariant(s, 'lunar', true)).sort()).toEqual([...Object.keys(old), 'scoreAuto', 'timeAuto'].sort());
  });
});

describe('party presets', () => {
  const offered: GameMode[] = ['core.tdm', 'core.deathmatch', 'core.ctf'];
  const lunarRoulette = PARTY_PRESETS.find((p) => p.id === 'lunar_roulette')!;

  it('Lunar Roulette: the Roulette mode with Lunar on (and its extras), its standard features on, the map’s own size', () => {
    const map = stJohns();
    const roulette: GameMode[] = [...offered, 'core.roulette'];
    const s = applyParty(lunarRoulette, setup({ mode: 'core.ctf', scoreLimit: 3, teams: [2, 2], spears: true }), map, roulette, desk)!;
    expect(s).toMatchObject({ mode: 'core.roulette', gravity: 0.4, fallDamage: false });
    expect(s.spears).toBeUndefined();
    expect(s.randomChars).toBeUndefined();
    expect(partyOn(lunarRoulette, s, map, roulette)).toBe(true);
    expect(rulesFromSetup(s, map).rules).toMatchObject({ mode: 'core.roulette', gravity: 0.4, fallDamage: false, lunar: true });
    expect(rulesFromSetup(s, map).rules.rouletteSignature).toBeUndefined();
    // Any other variant on (or a standard one off) and it's no longer the bundle; a different size still is.
    expect(partyOn(lunarRoulette, setVariant(s, 'swap', true), map, roulette)).toBe(false);
    expect(partyOn(lunarRoulette, setVariant(s, 'signature', false), map, roulette)).toBe(false);
    expect(partyOn(lunarRoulette, { ...s, bots: 3 }, map, roulette)).toBe(true);
    // Applied over a setup with a standard feature off: it comes back on.
    expect(applyParty(lunarRoulette, setVariant(setup({ mode: 'core.roulette' }), 'jackpots', false), map, roulette, desk)!.rlJackpots).toBeUndefined();
  });

  it('Lunar Roulette needs a map that plays Roulette; Spear Fight plays Deathmatch where there are no teams', () => {
    const map = small();
    const s = applyParty(lunarRoulette, setup({ map: 'small' }), map, ['core.tdm', 'core.deathmatch', 'core.roulette'], desk)!;
    expect(s).toMatchObject({ mode: 'core.roulette', bots: 7, gravity: 0.4 });
    expect(partyUnavailable(lunarRoulette, map, ['core.coop'])).toBe('This map has no Roulette.');
    expect(applyParty(lunarRoulette, setup(), map, ['core.coop'], desk)).toBeNull();
    const spear = PARTY_PRESETS.find((p) => p.id === 'spear_fight')!;
    expect(variantOn(SETUP_VARIANTS.find((v) => v.id === 'spears')!, applyParty(spear, setup(), stJohns(), offered, desk)!, stJohns())).toBe(true);
    for (const p of PARTY_PRESETS) expect(p.line.length).toBeGreaterThan(10);
  });
});
