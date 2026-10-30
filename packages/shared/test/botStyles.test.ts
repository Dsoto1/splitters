import { beforeAll, describe, expect, it } from 'vitest';
import { CHARACTER_PROFILES, CORE_BOT_PROFILES, CORE_LOOKS, DEFAULT_COOP_RULES, DEFAULT_DEATHMATCH_RULES, getWeapon, initPhysics, loadMap, profileFor, type MapDocument } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { arenaHop } from '../src/bots/brain.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

describe('character bot profiles and styles', () => {
  it('every standard-size preset character has a profile with real favourite weapons', () => {
    for (const l of CORE_LOOKS) {
      const p = CHARACTER_PROFILES[l.id];
      if (!p) continue;
      for (const w of p.weaponPreferences) expect(() => getWeapon(w), `${l.id} ${w}`).not.toThrow();
    }
    expect(Object.keys(CHARACTER_PROFILES).length).toBeGreaterThanOrEqual(14);
  });

  it("the match style overrides each character's own", () => {
    const own = profileFor('core.pathfinder', CORE_BOT_PROFILES[0]!);
    expect(own.tags).toContain('ARENA');
    const tac = profileFor('core.pathfinder', CORE_BOT_PROFILES[0]!, 'tactical');
    expect(tac.tags).toContain('TACTICAL');
    expect(tac.tags).not.toContain('ARENA');
    expect(profileFor('somebody-custom', CORE_BOT_PROFILES[1]!).id).toBe(CORE_BOT_PROFILES[1]!.id);
  });

  it("bots in a match play their character's profile", () => {
    const map = makeMap([{ id: 'r', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, 0], [2, 0, 2]]);
    const match = new Match(map, { ...DEFAULT_DEATHMATCH_RULES, botStyle: 'arena' });
    const c = match.addBot('b', CORE_BOT_PROFILES[0]!, undefined, true)!;
    const profile = (c.bot as unknown as { profile: { id: string; tags: string[] } }).profile;
    if (CHARACTER_PROFILES[c.look]) expect(profile.id).toBe(c.look);
    expect(profile.tags).toContain('ARENA');
  });
});

describe('arena hopping', () => {
  it('the Arena style hops all the time; an ARENA character on Mixed only in fights, and less often', () => {
    expect(arenaHop(true, false, false, true)).not.toBeNull();
    expect(arenaHop(true, false, true, false)).not.toBeNull();
    expect(arenaHop(true, false, false, false)).toBeNull();
    expect(arenaHop(false, false, true, true)).toBeNull();
    expect(arenaHop(false, true, false, true)).toBeNull();
    const fight = arenaHop(false, true, true, false)!;
    const always = arenaHop(true, true, true, false)!;
    expect(fight[0]).toBeGreaterThan(always[1]);
    expect(profileFor('core.pathfinder', CORE_BOT_PROFILES[0]!).hop).toBeUndefined();
    expect(profileFor('core.pathfinder', CORE_BOT_PROFILES[0]!, 'arena').hop).toBe('always');
  });

  it('in a match: ARENA characters on Mixed hop only in a fight and less than on the Arena style', () => {
    const map = makeMap(
      [0, 1, 2, 3].map((x) => ({ id: `yard_${x}`, tile: 'core.yard', x, y: 0, z: 0, rotation: 0 as const })),
      [[0, 0, 0], [22, 0, 0]],
    );
    const hops = (style: 'mixed' | 'arena') => {
      const match = new Match(map, { ...DEFAULT_DEATHMATCH_RULES, ...(style === 'arena' ? { botStyle: 'arena' as const } : {}) }, 5);
      const bots = [0, 1].map((i) => match.addBot(`b${i}`, CORE_BOT_PROFILES[0]!, undefined, true, { look: 'core.pathfinder' })!);
      for (const c of bots) c.invulnerable = true;
      let fight = 0;
      let calm = 0;
      const was = bots.map(() => true);
      for (let t = 0; t < 60 * 30; t++) {
        match.step();
        bots.forEach((c, i) => {
          if (was[i] && !c.move.grounded && c.move.velY > 5) {
            const inFight = c.bot!.target !== null || t - (c.bot as unknown as { underFireTick: number }).underFireTick < 90;
            if (inFight) fight++;
            else calm++;
          }
          was[i] = c.move.grounded;
        });
      }
      return { fight, calm, all: fight + calm };
    };
    const mixed = hops('mixed');
    const arena = hops('arena');
    expect(arena.all).toBeGreaterThan(10);
    expect(mixed.fight).toBeGreaterThan(0);
    // Out of a fight only the odd jump over something in the way.
    expect(mixed.calm).toBeLessThanOrEqual(2);
    expect(mixed.all * 1.5).toBeLessThan(arena.all);
  });
});

describe('roaming NPCs', () => {
  it('wander away from their spawner with nobody around', () => {
    const map: MapDocument = makeMap(
      [0, 1, 2, 3].map((x) => ({ id: `yard_${x}`, tile: 'core.yard', x, y: 0, z: 0, rotation: 0 as const })),
      [[0, 0, 0]],
    );
    map.entities.push({ id: 'enc_roam', kind: 'encounter', position: [4, 0, 0], yaw: 0, faction: 'syndicate', roster: { trooper: 0, gunner: 0, heavy: 0, imp: 1 }, activeCap: 1, reinforcements: 0, perPlayer: 0, respawnSeconds: 1, radius: 1, order: 'roam', orderTarget: null, startActive: true, difficulty: 'normal' } as MapDocument['entities'][number]);
    const loaded = loadMap(map);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const match = new Match(loaded.map, DEFAULT_COOP_RULES, 3);
    let far = 0;
    for (let t = 0; t < 60 * 20; t++) {
      match.step();
      const n = match.npcSnapshots()[0];
      if (n) far = Math.max(far, Math.hypot(n[1] - 4, n[3]));
    }
    expect(far).toBeGreaterThan(8);
  });
});
