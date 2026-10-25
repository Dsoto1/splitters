import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CHARACTER_PARTS, CORE_BOT_PROFILES, CORE_LOOKS, DEFAULT_LOOK, decodeLook, encodeLook, getLook, initPhysics, lookForBot, lookProblems, materialTint, textureFor } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { loadArena } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const lock = JSON.parse(readFileSync(new URL('../../../content/characters.lock.json', import.meta.url), 'utf8')) as {
  files: { role: string; id?: string; body?: string; slot?: string }[];
};
const file = (id: string) => lock.files.find((f) => f.id === id);
/** Whole-body characters made with Meshy (tools/content/prepare-meshy-characters.mjs). */
const meshy = JSON.parse(readFileSync(new URL('../../../content/meshy.lock.json', import.meta.url), 'utf8')) as { files: { role: string; id: string }[] };
const parted = CORE_LOOKS.filter((l) => !l.whole);

describe('character looks', () => {
  it('only uses parts that ship, made for the look’s body, one per slot', () => {
    for (const l of parted) {
      for (const id of [l.head, ...l.parts, ...l.hair]) {
        expect(file(id), `${l.id}: ${id}`).toBeDefined();
        expect(file(id)!.body, `${l.id}: ${id}`).toBe(l.body);
      }
      const slots = l.parts.map((p) => file(p)!.slot);
      expect(new Set(slots).size, l.id).toBe(slots.length);
      for (const c of l.colorways) expect(file(c)?.role, `${l.id}: ${c}`).toBe('texture');
    }
    expect(lock.files.some((f) => f.role === 'rig')).toBe(true);
  });

  it('ships every whole-body character with its first-person arms, and nothing else on it', () => {
    const whole = CORE_LOOKS.filter((l) => l.whole);
    expect(whole.length).toBeGreaterThan(0);
    for (const l of whole) {
      expect(l.parts, l.id).toHaveLength(1);
      expect(meshy.files.find((f) => f.id === l.parts[0])?.role, l.id).toBe('meshy');
      expect(meshy.files.find((f) => f.id === l.whole!.arms)?.role, l.id).toBe('meshy-fparms');
      expect(l.hair, l.id).toEqual([]);
      expect(lookProblems(l), l.id).toEqual([]);
    }
  });

  it('uses every shipped part, hairstyle and colourway in at least one preset', () => {
    const used = new Set(CORE_LOOKS.flatMap((l) => [l.head, ...l.parts, ...l.hair, ...l.colorways]));
    const unused = lock.files.filter((f) => ['head', 'part', 'hair'].includes(f.role) && !used.has(f.id!)).map((f) => f.id);
    expect(unused).toEqual([]);
    // Every alternative colourway (a texture ID with a variant word) is worn by someone.
    const colourways = lock.files.filter((f) => f.role === 'texture' && /^(ranger|peasant|athlete)_(?!m$|f$)/.test(f.id!)).map((f) => f.id);
    expect(colourways.filter((c) => !used.has(c!))).toEqual([]);
  });

  it('resolves every material family to a shipped texture', () => {
    const materials = ['MI_Ranger', 'MI_Peasant', 'MI_Athlete_Male', 'MI_Athlete_Female', 'MI_Regular_Male', 'MI_Superhero_Female', 'MI_Hair_1', 'MI_Hair_2'];
    for (const l of CORE_LOOKS) {
      for (const m of materials) {
        const t = textureFor(m, l)!;
        expect(file(t)?.role, `${l.id} ${m} -> ${t}`).toBe('texture');
      }
    }
    expect(textureFor('MI_Eyes', CORE_LOOKS[0]!)).toBeNull();
    expect(textureFor('MI_Ranger', getLook('core.warden'))).toBe('ranger_moss');
    expect(textureFor('MI_Athlete_Female', getLook('core.striker'))).toBe('athlete_light_f');
    expect(materialTint('MI_Superhero_Male')).toBe('skin');
    expect(materialTint('MI_Hair_2')).toBe('hair');
  });

  it('has unique IDs and falls back to the default for unknown ones', () => {
    expect(new Set(CORE_LOOKS.map((l) => l.id)).size).toBe(CORE_LOOKS.length);
    expect(getLook('nope').id).toBe(DEFAULT_LOOK);
    expect(getLook(undefined).id).toBe(DEFAULT_LOOK);
  });

  it('gives players their chosen look and bots a spread of looks in the roster', () => {
    const match = new Match(loadArena());
    match.addHuman('Ann', 'core.miller');
    match.addHuman('Bo', 'not-a-look');
    for (let i = 0; i < 3; i++) match.addBot(`Bot${i}`, CORE_BOT_PROFILES[0]!);
    const roster = match.roster();
    expect(roster.find((r) => r.name === 'Ann')!.look).toBe('core.miller');
    expect(roster.find((r) => r.name === 'Bo')!.look).toBe(DEFAULT_LOOK);
    const bots = roster.filter((r) => r.bot);
    expect(bots.length).toBeGreaterThan(1);
    expect(new Set(bots.map((b) => b.look)).size).toBeGreaterThan(1);
    expect(lookForBot(0)).not.toBe(lookForBot(1));
  });
});

describe('custom looks', () => {
  it('lists exactly the shipped parts', () => {
    const shipped = lock.files.filter((f) => f.role === 'part').map((f) => f.id).sort();
    expect(CHARACTER_PARTS.map((p) => p.id).sort()).toEqual(shipped);
    for (const p of CHARACTER_PARTS) expect(file(p.id)!.slot === p.slot || (file(p.id)!.slot === 'torso' && p.slot === 'torso')).toBe(true);
  });

  it('accepts every preset and round-trips it through a custom ID', () => {
    // Whole-body characters can't be customised, so they never become custom IDs.
    for (const l of parted) {
      expect(lookProblems(l), l.id).toEqual([]);
      const id = encodeLook(l);
      expect(id.length).toBeLessThanOrEqual(64);
      const back = decodeLook(id)!;
      expect(back, l.id).not.toBeNull();
      expect([...back.parts].sort()).toEqual([...l.parts].sort());
      expect([...back.hair].sort()).toEqual([...l.hair].sort());
      expect(back.colorways).toEqual(l.colorways);
      expect(back.skin).toBe(l.skin);
      expect(back.hairColor).toBe(l.hairColor);
      expect(getLook(id).id).toBe(id);
    }
  });

  it('rejects looks that cannot be worn and falls back to the default', () => {
    const base = getLook('core.ranger');
    expect(lookProblems({ ...base, parts: base.parts.filter((p) => !p.startsWith('ranger_legs')) })).toContain('needs trousers');
    expect(lookProblems({ ...base, parts: [...base.parts, 'athlete_torso_m'] }).length).toBeGreaterThan(0);
    expect(lookProblems({ ...base, parts: ['athlete_torso_m', 'ranger_arms_m', 'ranger_legs_m', 'ranger_feet_m'] })).toContain('a sportswear top already has arms');
    expect(lookProblems({ ...base, hair: ['hair_long'] })).toContain('a hairstyle is for the other body type');
    // Malformed or unwearable IDs fall back to the default look.
    expect(getLook('c1-zzzz').id).toBe(DEFAULT_LOOK);
    const noLegs = encodeLook({ ...base, parts: base.parts.filter((p) => !p.startsWith('ranger_legs')) });
    expect(decodeLook(noLegs)).toBeNull();
    expect(getLook(noLegs).id).toBe(DEFAULT_LOOK);
  });

  it('keeps a valid custom look for a joining player', () => {
    const custom = encodeLook({ body: 'female', parts: ['peasant_torso_f', 'ranger_arms_f', 'athlete_legs_f', 'ranger_feet_f'], hair: ['hair_buns'], colorways: ['peasant_dusk'], skin: '#9a6a4e', hairColor: '#8a3a2a' });
    const match = new Match(loadArena());
    match.addHuman('Kit', custom);
    expect(match.roster()[0]!.look).toBe(custom);
  });
});
