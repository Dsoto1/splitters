import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  BUTTON_FIRE,
  BUTTON_ZOOM,
  BUILDER_WEAPON,
  CORE_BOT_PROFILES,
  DEFAULT_FORTS_RULES,
  FORT_BUILD,
  FORT_COMBAT,
  FORT_PIECES,
  FORT_PIECE_KINDS,
  TICK_RATE,
  fortAimPlacement,
  initPhysics,
  loadMap,
  lookAngles,
  mapCanRun,
  playableModes,
  type GameEvent,
  type MapDocument,
  type MatchRules,
} from '../src/index.ts';
import { FortsMode, Match, initNavigation, type Combatant } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

function meadow(): MapDocument {
  const r = loadMap(readFileSync(new URL('../../../maps/fort_meadow.json', import.meta.url), 'utf8'));
  if (!r.ok) throw new Error('fort_meadow does not load');
  return r.map;
}

const RULES: MatchRules = { ...DEFAULT_FORTS_RULES, fortBuildSeconds: 20, fortCombatSeconds: 20, fortCycles: 2, fortBudget: 40 };

const steps = (m: Match, n: number): GameEvent[] => {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...m.step());
  return out;
};
const fortsOf = (m: Match) => m.mode as FortsMode;
/** Stand a player on the ground at (x, z). */
const place = (m: Match, c: Combatant, x: number, z: number) => {
  const hit = m.physics.raycastHit({ x, y: 30, z }, { x: 0, y: -1, z: 0 }, 60)!;
  c.move = { pos: { x, y: 30 - hit.dist, z }, velY: 0, grounded: true };
};
const ground = (m: Match, x: number, z: number) => 30 - m.physics.raycastHit({ x, y: 30, z }, { x: 0, y: -1, z: 0 }, 60)!.dist;
const hurt = (m: Match, v: Combatant, by: Combatant | null, n: number) => (m as unknown as { damage(v: Combatant, n: number, a: Combatant | null, w: string): void }).damage(v, n, by, 'core.pistol');

function humans(rules = RULES) {
  const match = new Match(meadow(), rules);
  const a = match.addHuman('a')!;
  const b = match.addHuman('b')!;
  steps(match, 2);
  const forts = fortsOf(match);
  const ta = forts.teamIndex(a.faction);
  return { match, a, b, forts, ta, tb: 1 - ta };
}

describe('Fort Wars', () => {
  it('is offered on any map with flag bases for both teams', () => {
    const map = meadow();
    expect(playableModes(map)).toContain('core.forts');
    expect(mapCanRun(map, 'core.forts')).toBe(true);
    const bunker = loadMap(readFileSync(new URL('../../../maps/bunker_cross.json', import.meta.url), 'utf8'));
    if (bunker.ok) expect(playableModes(bunker.map)).toContain('core.forts');
  });

  it('runs build then combat phases, cycles, and ends the match after the last combat', () => {
    const { match, forts, a } = humans();
    expect(forts.phase).toBe(FORT_BUILD);
    expect(match.mode?.snapshot().fo?.slice(0, 4)).toEqual([FORT_BUILD, 20, 1, 2]);
    // Everyone holds the Builder, and only that.
    expect([...a.weapons.values()].map((w) => w.def.id)).toEqual([BUILDER_WEAPON]);
    steps(match, 20 * TICK_RATE);
    expect(forts.phase).toBe(FORT_COMBAT);
    expect([...a.weapons.values()].some((w) => w.def.id === BUILDER_WEAPON)).toBe(false);
    expect(a.weapons.size).toBeGreaterThan(0);
    steps(match, 20 * TICK_RATE);
    expect(forts.phase).toBe(FORT_BUILD);
    expect(forts.cycle).toBe(2);
    steps(match, 20 * TICK_RATE);
    expect(forts.phase).toBe(FORT_COMBAT);
    const ev = steps(match, 20 * TICK_RATE + 2);
    expect(ev.some((e) => e.e === 'round_end')).toBe(true);
    expect(match.phase).toBe('intermission');
  });

  it('walls the teams apart while they build, and nobody can hurt anybody', () => {
    const { match, forts, a, b, ta } = humans();
    const { mid, dir } = forts.midfield;
    // A shot along the line between the bases stops at the barrier.
    const from = { x: mid.x - dir.x * 5, y: mid.y + 1.5, z: mid.z - dir.z * 5 };
    expect(match.physics.raycastWorld(from, dir, 10)).not.toBeNull();
    expect(forts.barrierUp).toBe(true);
    // Somebody on the wrong half is put back on their own.
    const sign = ta === 0 ? 1 : -1;
    place(match, a, mid.x + dir.x * sign * 8 + 6, mid.z + dir.z * sign * 8);
    steps(match, 2);
    expect(forts.midfield.side(a.move.pos) * (ta === 0 ? -1 : 1)).toBeGreaterThan(0);
    const before = b.health;
    hurt(match, b, a, 50);
    expect(b.health).toBe(before);
    steps(match, 20 * TICK_RATE);
    expect(forts.barrierUp).toBe(false);
    expect(match.physics.raycastWorld(from, dir, 10)).toBeNull();
    hurt(match, b, a, 50);
    expect(b.health).toBe(before - 50);
  });

  it('keeps pieces on your own half, clear of flags, spawns, players and each other, within budget', () => {
    const { match, forts, a, ta, tb } = humans();
    const home = forts.bases[ta]!;
    const toward = forts.midfield.dir;
    const s = ta === 0 ? 1 : -1;
    const at = (f: number, r: number) => {
      const x = home.x + toward.x * s * f + toward.z * r;
      const z = home.z + toward.z * s * f - toward.x * r;
      return { x, y: ground(match, x, z), z };
    };
    place(match, a, home.x + 12, home.z);
    expect(forts.problem(ta, 'wall', 0, at(1, 0))).toBe('Too close to a flag or spawn');
    expect(forts.problem(tb, 'wall', 0, at(8, 0))).toBe('Build on your own side');
    const spot = at(8, 0);
    const first = forts.place(ta, 'wall', 0, spot);
    expect(typeof first).not.toBe('string');
    expect(forts.problem(ta, 'block', 0, spot)).toBe('Blocked by another piece');
    expect(forts.problem(ta, 'block', 0, { ...a.move.pos })).toBe('Someone is in the way');
    // 40 points: the wall took 4, then nine more walls fill the budget.
    for (let i = 0; i < 9; i++) expect(typeof forts.place(ta, 'wall', 0, at(10 + 3 * i, 6))).not.toBe('string');
    expect(forts.pointsLeft(ta)).toBe(0);
    expect(forts.problem(ta, 'plank', 0, at(10, -6))).toBe('Not enough build points');
    // Your pieces don't cost the other team anything.
    expect(forts.pointsLeft(tb)).toBe(40);
  });

  it('places with the Builder where you aim (snapped to the grid) and picks your own pieces back up for a refund', () => {
    const { match, forts, a, ta } = humans();
    const home = forts.bases[ta]!;
    const s = ta === 0 ? 1 : -1;
    place(match, a, home.x + 10, home.z + forts.midfield.dir.z * s * 6);
    const target = { x: a.move.pos.x, y: a.move.pos.y, z: a.move.pos.z + forts.midfield.dir.z * s * 4 };
    const eye = { x: a.move.pos.x, y: a.move.pos.y + 1.6, z: a.move.pos.z };
    const look = lookAngles(eye, target);
    const press = (buttons: number, kind: number, rot = 0) => {
      match.queueInputs(a.slot, [{ seq: a.lastSeq + 1, forward: 0, right: 0, yaw: look.yaw, pitch: look.pitch, buttons, build: kind + rot * 16 }]);
      steps(match, 1);
      match.queueInputs(a.slot, [{ seq: a.lastSeq + 1, forward: 0, right: 0, yaw: look.yaw, pitch: look.pitch, buttons: 0, build: kind + rot * 16 }]);
      steps(match, 1);
    };
    const want = fortAimPlacement(match.physics, { x: a.move.pos.x, y: a.move.pos.y + 1.6, z: a.move.pos.z }, look.yaw, look.pitch, 'wall', 1)!;
    expect(want).not.toBeNull();
    // The footprint's edges are on the 0.5 m grid.
    expect(((want.x - 0.25) / 0.5) % 1).toBeCloseTo(0, 6);
    press(BUTTON_FIRE, FORT_PIECE_KINDS.indexOf('wall'), 1);
    expect(forts.pieces).toHaveLength(1);
    expect(forts.pieces[0]!.rot).toBe(1);
    expect(forts.pieces[0]!.base.x).toBeCloseTo(want.x, 6);
    expect(forts.pointsLeft(ta)).toBe(40 - FORT_PIECES.wall.cost);
    // Movement now runs into it: it's in the collision world.
    const p = forts.pieces[0]!;
    expect(match.physics.boxClear({ x: p.base.x, y: p.base.y + 1, z: p.base.z }, { x: 0.1, y: 0.1, z: 0.1 })).toBe(false);
    press(BUTTON_ZOOM, 0);
    expect(forts.pieces).toHaveLength(0);
    expect(forts.pointsLeft(ta)).toBe(40);
    expect(match.physics.boxClear({ x: p.base.x, y: p.base.y + 1, z: p.base.z }, { x: 0.1, y: 0.1, z: 0.1 })).toBe(true);
  });

  it('sends pieces in snapshots when they change, and not every time', () => {
    const { match, forts, ta } = humans();
    const home = forts.bases[ta]!;
    match.mode!.snapshot();
    expect(match.mode!.snapshot().fp).toBeUndefined();
    const x = home.x + 12;
    const z = home.z;
    forts.place(ta, 'block', 0, { x: Math.round(x) + 0.5, y: ground(match, x, z), z: Math.round(z) + 0.5 });
    const md = match.mode!.snapshot();
    expect(md.fp).toHaveLength(1);
    expect(md.fp![0]![1]).toBe(FORT_PIECE_KINDS.indexOf('block'));
    expect(match.mode!.snapshot().fp).toBeUndefined();
  });

  it('pieces are untouchable while building; in combat bullets chip them and explosives smash them', () => {
    const { match, forts, a, b, ta, tb } = humans();
    const enemyHome = forts.bases[tb]!;
    const spot = (dx: number) => {
      const x = enemyHome.x + dx + 0.5;
      const z = enemyHome.z + 0.5;
      return { x, y: ground(match, x, z), z };
    };
    const wall = forts.place(tb, 'wall', 0, spot(10));
    const metal = forts.place(tb, 'metal_wall', 0, spot(-10));
    if (typeof wall === 'string' || typeof metal === 'string') throw new Error(`${wall} ${metal}`);
    expect(forts.damageBody(wall.colliders[0]!.handle, 100, a)).toBe(true);
    expect(wall.health).toBe(wall.max);
    steps(match, 20 * TICK_RATE);
    expect(forts.phase).toBe(FORT_COMBAT);
    // Their own side can't wreck it.
    forts.damageBody(wall.colliders[0]!.handle, 100, b);
    expect(wall.health).toBe(wall.max);
    forts.damageBody(wall.colliders[0]!.handle, 100, a);
    forts.damageBody(metal.colliders[0]!.handle, 100, a);
    expect(wall.max - wall.health).toBeCloseTo(100 * 0.5, 6);
    expect(metal.max - metal.health).toBeCloseTo(100 * 0.15, 6);
    // A rocket-sized blast next to the wood wall breaks it; the metal one far off is untouched.
    const c = { x: wall.base.x, y: wall.base.y + 1, z: wall.base.z - 1 };
    forts.splash(c, 4, 200, 30, a);
    expect(forts.pieces.includes(wall)).toBe(false);
    expect(metal.health).toBe(metal.max - 15);
    expect(match.physics.boxClear({ x: wall.base.x, y: wall.base.y + 1, z: wall.base.z }, { x: 0.1, y: 0.1, z: 0.1 })).toBe(true);
    void ta;
  });

  it('with the default budget bots build a big fort: two towers, an outer wall and metal facing', { timeout: 120_000 }, () => {
    const rules: MatchRules = { ...DEFAULT_FORTS_RULES, fortCombatSeconds: 60, teamSizes: [3, 3] };
    expect(rules.fortBudget).toBe(420);
    const match = new Match(meadow(), rules);
    for (let i = 0; i < 6; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);
    const forts = fortsOf(match);
    steps(match, (rules.fortBuildSeconds ?? 150) * TICK_RATE - 5);
    expect(forts.phase).toBe(FORT_BUILD);
    for (const t of [0, 1]) {
      const mine = forts.pieces.filter((p) => p.team === t);
      const spent = rules.fortBudget! - forts.pointsLeft(t);
      expect(mine.length, `team ${t} built ${mine.length} pieces for ${spent} points`).toBeGreaterThanOrEqual(30);
      expect(spent).toBeGreaterThan(120);
      expect(mine.filter((p) => p.kind === 'stairs').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('bots build a fort round their flag, then play Capture the Flag over it', { timeout: 120_000 }, () => {
    const rules: MatchRules = { ...DEFAULT_FORTS_RULES, fortBuildSeconds: 60, fortCombatSeconds: 180, fortBudget: 120, teamSizes: [3, 3] };
    const match = new Match(meadow(), rules);
    for (let i = 0; i < 6; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);
    const forts = fortsOf(match);
    steps(match, 60 * TICK_RATE - 5);
    expect(forts.phase).toBe(FORT_BUILD);
    for (const t of [0, 1]) {
      const mine = forts.pieces.filter((p) => p.team === t);
      expect(mine.length, `team ${t} built ${mine.length}`).toBeGreaterThanOrEqual(8);
      // Every piece is on its own half.
      for (const p of mine) expect(forts.midfield.side(p.base) * (t === 0 ? -1 : 1)).toBeGreaterThan(0);
      expect(mine.some((p) => p.kind === 'wall') && mine.some((p) => p.kind === 'stairs')).toBe(true);
    }
    // Combat: they go for each other's flags, round (or through) the forts.
    let closest = Infinity;
    let takes = 0;
    let kills = 0;
    for (let t = 0; t < 150 * TICK_RATE; t++) {
      for (const e of match.step()) {
        if (e.e === 'flag' && e.a === 'take') takes++;
        if (e.e === 'kill') kills++;
      }
      for (const c of match.combatants()) {
        const enemy = forts.bases[1 - forts.teamIndex(c.faction)]!;
        if (c.alive) closest = Math.min(closest, Math.hypot(c.move.pos.x - enemy.x, c.move.pos.z - enemy.z));
      }
    }
    expect(forts.phase).toBe(FORT_COMBAT);
    // The meadow is small enough for the navmesh to be rebuilt with the forts in.
    expect(forts.navRebuilt).toBe(true);
    expect(takes > 0 || closest < 6, `flag takes ${takes}, closest ${closest.toFixed(1)} m`).toBe(true);
    expect(kills).toBeGreaterThan(0);
  });
});
