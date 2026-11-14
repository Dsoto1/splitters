import { describe, expect, it } from 'vitest';
import {
  CHARACTER_TIERS,
  CHARACTER_TIER_LABELS,
  CLIP_SET_CLIPS,
  CORE_LOOKS,
  DEFAULT_LOOK,
  EXPERIMENTAL_SECTION,
  PICKABLE_LOOKS,
  REPORT_ONLY_CHARACTER_GATES,
  botLookFrom,
  castLooks,
  castLooksFrom,
  characterGateReports,
  characterGates,
  characterSections,
  characterTier,
  getLook,
  lookIn,
  lookForBot,
  pickableLooks,
  type CharacterFacts,
  type CharacterLook,
} from '../src/index.ts';
import { RANDOM_LOOK_POOL, randomLook } from '../src/sim/randomLooks.ts';
// @ts-expect-error: a plain .mjs tool without types
import { CLIP_SET_CLIPS as TOOL_CLIPS, TIERS } from '../../../tools/content/character-manifests.mjs';

// Character tiers (docs/CHARACTERS.md, "Tier"): the same rules as for maps. A synthetic experimental character stands
// in for one (no real manifest carries a tier yet): the roster with it added is what a build with one would give.
const trial: CharacterLook = { id: 'core.trialbot', name: 'Trial Bot', body: 'male', head: '', parts: ['meshy_trialbot'], hair: [], colorways: [], skin: null, hairColor: null, whole: { arms: 'meshy_trialbot_fparms' }, group: 'creatures', nameTheme: 'robot', tier: 'experimental' };
const ROSTER: readonly CharacterLook[] = [trial, ...CORE_LOOKS];
// The roster's own tiers (experimental characters of its own come and go: the ten of 2026-11-11 until 2026-11-12, the twelve
// of 2026-11-13 since then).
const CORE_TIER = CORE_LOOKS.filter((l) => characterTier(l) === 'core');
const EXPERIMENTAL = CORE_LOOKS.filter((l) => characterTier(l) === 'experimental');

describe('character tiers', () => {
  it('absent = core; the manifest checker knows the same tiers', () => {
    expect(TIERS).toEqual(CHARACTER_TIERS);
    expect(Object.keys(CHARACTER_TIER_LABELS)).toEqual([...CHARACTER_TIERS]);
    expect(characterTier({})).toBe('core');
    expect(characterTier(trial)).toBe('experimental');
    // Every look is one tier or the other, and the automatic picks draw from the core ones alone.
    expect(CORE_TIER.length + EXPERIMENTAL.length).toBe(CORE_LOOKS.length);
    expect(CORE_TIER.length).toBeGreaterThan(100);
    expect(PICKABLE_LOOKS).toEqual(CORE_TIER);
    expect(DEFAULT_LOOK).toBe(CORE_TIER[0]!.id);
  });

  it('no automatic pick draws an experimental character', () => {
    const pool = pickableLooks(ROSTER);
    expect(pool).toEqual(CORE_TIER);
    for (const l of EXPERIMENTAL) expect(pool).not.toContain(l);
    // Random bots: across more slots than the roster, with and without a bot-characters setting.
    for (let i = 0; i < ROSTER.length * 2; i++) expect(botLookFrom(ROSTER, i)).not.toBe(trial.id);
    for (let i = 0; i < CORE_LOOKS.length; i++) {
      expect(botLookFrom(ROSTER, i)).toBe(lookForBot(i));
      expect(characterTier(getLook(lookForBot(i)))).toBe('core');
    }
    expect(castLooksFrom(ROSTER, [])).toEqual(pool);
    // Its own group and its own name theme: still not offered (the others of them are).
    for (const cast of [['creatures'], ['robot'], ['creatures', 'robot']]) {
      const looks = castLooksFrom(ROSTER, cast);
      expect(looks.length).toBeGreaterThan(0);
      expect(looks).not.toContain(trial);
      expect(looks).toEqual(castLooks(cast));
    }
    // A setting only the experimental one fits falls back to every core look, not to it.
    expect(castLooksFrom([trial, CORE_LOOKS.find((l) => l.group === 'soldiers')!], ['robot']).map((l) => l.id)).not.toContain(trial.id);
    // Random characters and Roulette (both draw from RANDOM_LOOK_POOL, built the same way).
    const ids = pool.map((l) => l.id);
    for (let life = 1; life < 400; life++) expect(randomLook(7, life % 16, life, undefined, ids)).not.toBe(trial.id);
    expect(RANDOM_LOOK_POOL).toEqual(PICKABLE_LOOKS.map((l) => l.id));
  });

  it('a look resolves by id whatever its tier (a saved choice keeps working)', () => {
    // getLook finds a look by id on the roster (CORE_LOOKS, both tiers), never through the pickable list.
    for (const l of CORE_LOOKS) expect(getLook(l.id)).toBe(l);
    expect(lookIn(ROSTER, trial.id)).toBe(trial);
    for (const l of CORE_LOOKS) expect(lookIn(ROSTER, l.id)).toBe(getLook(l.id));
    // Only the fallback for an unknown id is a pick: a core look, though the experimental one is first on this roster.
    expect(lookIn(ROSTER, 'core.nobody_by_this_name')).toBe(CORE_LOOKS[0]);
    expect(lookIn(ROSTER, undefined)).toBe(CORE_LOOKS[0]);
    expect(characterTier(getLook('core.nobody_by_this_name'))).toBe('core');
  });

  it('Character Select: an Experimental section before Yours, only when someone is in it', () => {
    const entry = (l: CharacterLook) => ({ id: l.id, name: l.name, group: characterTier(l) === 'experimental' ? EXPERIMENTAL_SECTION : l.group! });
    const mine = { id: 'm1', name: 'Mine', group: 'mine' };
    const without = characterSections([...CORE_TIER.map(entry), mine]);
    expect(without.map((s) => s.id)).not.toContain(EXPERIMENTAL_SECTION);
    expect(without.at(-1)!.id).toBe('mine');
    const withOne = characterSections([...ROSTER.map(entry), mine]);
    expect(withOne.map((s) => s.id)).toEqual([...without.map((s) => s.id).slice(0, -1), EXPERIMENTAL_SECTION, 'mine']);
    const exp = withOne.find((s) => s.id === EXPERIMENTAL_SECTION)!;
    expect(exp.label).toBe('Experimental');
    // (A section lists its looks by name.)
    expect(exp.looks.map((l) => l.id).sort()).toEqual([trial.id, ...EXPERIMENTAL.map((l) => l.id)].sort());
    // It left its group's section.
    expect(withOne.find((s) => s.id === 'creatures')!.looks.map((l) => l.id)).not.toContain(trial.id);
    // Yours is there even when empty (it holds "Design new").
    expect(characterSections(CORE_LOOKS.map(entry)).at(-1)).toEqual({ id: 'mine', label: 'Yours', looks: [] });
  });
});

describe("characters' quality gates", () => {
  const good: CharacterFacts = { model: { triangles: 11000, lodTriangles: 3300, hands: true }, arms: { triangles: 1600, hands: true }, maxTriangles: 20000, targetTriangles: 11000, clips: [...CLIP_SET_CLIPS], hitbox: true, portrait: true };
  const failed = (f: CharacterFacts, look: CharacterLook = trial) => characterGates(look, f).filter((g) => !g.ok).map((g) => g.id);

  it('the tools build the same clips the gate asks for', () => {
    expect(TOOL_CLIPS).toEqual([...CLIP_SET_CLIPS]);
  });

  it('a whole-body character passes with everything recorded, and each gap fails its own gate', () => {
    expect(characterGates(trial, good).map((g) => g.id)).toEqual(['triangles', 'lod', 'hands', 'clips', 'hitbox', 'portrait']);
    expect(failed(good)).toEqual([]);
    expect(failed({ ...good, model: { ...good.model!, triangles: 20001 } })).toEqual(['triangles']);
    expect(failed({ ...good, model: { triangles: 11000, hands: true } })).toEqual(['lod']);
    expect(failed({ ...good, model: { ...good.model!, hands: false } })).toEqual(['hands']);
    expect(failed({ ...good, arms: undefined })).toEqual(['hands']);
    expect(failed({ ...good, clips: ['clip_walk', 'clip_run'] })).toEqual(['clips']);
    expect(failed({ ...good, clips: undefined })).toEqual(['clips']);
    expect(failed({ ...good, hitbox: false })).toEqual(['hitbox']);
    expect(failed({ ...good, portrait: false })).toEqual(['portrait']);
    // Nothing built at all: one line saying so, not three.
    expect(failed({ ...good, model: undefined })).toEqual(['triangles']);
    // Universal first-person arms: no file of its own to measure. A rolling body or the rig's own gait: no clip set.
    expect(failed({ ...good, arms: undefined }, { ...trial, whole: { arms: 'ranger_arms_m' } })).toEqual([]);
    expect(failed({ ...good, clips: undefined }, { ...trial, locomotion: 'roll' })).toEqual([]);
    expect(failed({ ...good, clips: undefined }, { ...trial, clips: false })).toEqual([]);
  });

  it('a look built from the shared parts is judged on its clips, hit shape and portrait', () => {
    const preset = CORE_LOOKS.find((l) => !l.whole)!;
    expect(characterGates(preset, { clips: [...CLIP_SET_CLIPS], hitbox: true, portrait: true }).map((g) => g.id)).toEqual(['clips', 'hitbox', 'portrait']);
  });

  it('gates block a core character and only report for an experimental one', () => {
    const core = { ...trial, id: 'core.trialbot2', tier: undefined };
    const reports = characterGateReports(() => ({ ...good, portrait: false }), [trial, core]);
    expect(reports.map((r) => [r.look, r.tier, r.gates.filter((g) => !g.ok).map((g) => g.id), r.failing.map((g) => g.id)])).toEqual([
      ['core.trialbot', 'experimental', ['portrait'], []],
      ['core.trialbot2', 'core', ['portrait'], ['portrait']],
    ]);
    // Every gate blocks today (the whole core roster passes them all: packages/server/test/characterGates.test.ts).
    expect(REPORT_ONLY_CHARACTER_GATES).toEqual({});
    expect(reports[0]!.gates.every((g) => g.blocking)).toBe(true);
  });
});
