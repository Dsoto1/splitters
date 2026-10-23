import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, CORE_LOOKS, DEFAULT_LOOK, getLook, initPhysics, lookForBot, materialTint, textureFor } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { loadArena } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const lock = JSON.parse(readFileSync(new URL('../../../content/characters.lock.json', import.meta.url), 'utf8')) as {
  files: { role: string; id?: string; body?: string; slot?: string }[];
};
const file = (id: string) => lock.files.find((f) => f.id === id);

describe('character looks', () => {
  it('only uses parts that ship, made for the look’s body, one per slot', () => {
    for (const l of CORE_LOOKS) {
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
