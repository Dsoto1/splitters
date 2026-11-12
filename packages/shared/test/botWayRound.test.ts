import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { initPhysics, loadMap, rulesForMode } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { CORE_BOT_PROFILES } from '../src/bots/profile.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

// Iron Maw's pit slope has a trench behind a ladder's backing plate, off the navmesh: the nearest places on the navmesh
// are straight through the plate. A bot that slid in stood there for the rest of the match (77 s in a bot report); now
// it walks round the plate's end (BotBrain.wayRound).
it('a bot off the navmesh with a wall in the straight way back walks round it', () => {
  const r = loadMap(readFileSync(new URL('../../../maps/iron_maw.json', import.meta.url), 'utf8'));
  if (!r.ok) throw new Error('Iron Maw does not load');
  for (const start of [
    { x: -30, y: -38, z: -87 },
    { x: -28, y: -39.5, z: -85 },
  ]) {
    const match = new Match(r.map, { ...rulesForMode(r.map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0 }, 3);
    const c = match.addBot('b', CORE_BOT_PROFILES[0]!)!;
    for (let i = 0; i < 60; i++) match.step();
    c.move.pos = { ...start };
    c.move.velY = 0;
    const nav = (match as unknown as { nav: { nearestPoly(p: { x: number; y: number; z: number }): unknown } }).nav;
    // The trench is still there (if the map fills it in, this test needs another place).
    expect(nav.nearestPoly(c.move.pos)).toBeNull();
    let out = -1;
    for (let i = 0; i < 60 * 10 && out < 0; i++) {
      match.step();
      if (c.move.grounded && nav.nearestPoly(c.move.pos)) out = i;
    }
    expect(out).toBeGreaterThanOrEqual(0);
  }
}, 120000);
