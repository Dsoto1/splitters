import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, CORE_LOOKS, DEFAULT_LOOK, getLook, initPhysics, lookForBot } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { loadArena } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const lock = JSON.parse(readFileSync(new URL('../../../content/characters.lock.json', import.meta.url), 'utf8')) as {
  files: { role: string; id?: string; body?: string }[];
};

describe('character looks', () => {
  it('only uses parts that ship, made for the look’s body', () => {
    const part = (id: string) => lock.files.find((f) => f.id === id);
    for (const l of CORE_LOOKS) {
      for (const id of [l.head, l.outfit, l.hair]) {
        if (!id) continue;
        expect(part(id), `${l.id}: ${id}`).toBeDefined();
        expect(part(id)!.body, `${l.id}: ${id}`).toBe(l.body);
      }
      if (l.colorway) expect(lock.files.some((f) => f.role === 'texture' && f.id === l.colorway)).toBe(true);
    }
    expect(lock.files.some((f) => f.role === 'rig')).toBe(true);
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
