// Measured hit shapes in the match (lag compensation, zones), character stats and random characters.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BODY_SIZES,
  BUTTON_FIRE,
  BUTTON_CROUCH,
  BUTTON_JUMP,
  BUTTON_SPRINT,
  CORE_LOOKS,
  DEFAULT_DEATHMATCH_RULES,
  PLAYER,
  RANDOM_LOOK_POOL,
  RETIRED_LOOKS,
  STAT_KEYS,
  STAT_SPECS,
  classStats,
  getLook,
  getWeapon,
  headPoint,
  initPhysics,
  lookAngles,
  lookHitbox,
  lookStats,
  matchStats,
  randomLook,
  rayBody,
  lastHit,
  statsProblems,
  weaponCode,
  type GameEvent,
  type MapDocument,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';
// The manifests' checker keeps its own copy of the stat ranges (tools/content/character-manifests.mjs).
import { STAT_RANGES } from '../../../tools/content/character-manifests.mjs';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const eye = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });

function yard(spawns: [number, number, number][] = [[0, 0, 4]]): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, spawns);
}

class Driver {
  seq = 0;
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
    this.match.queueInputs(c.slot, [{ seq: ++this.seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
  run(n: number, each: () => void = () => {}): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      each();
      out.push(...this.match.step());
    }
    return out;
  }
}

function give(c: Combatant, id: string): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

/** Two players in the yard: a at (0, 0, 4), b `at`, facing a. */
function pair(look?: string, at: [number, number, number] = [12, 0, 4], extra: Partial<typeof rules> = {}) {
  const match = new Match(yard([[0, 0, 4], at]), { ...rules, ...extra });
  const d = new Driver(match);
  const a = match.addHuman('a')!;
  const b = match.addHuman('b', look)!;
  a.move = { pos: { x: 0, y: 0, z: 4 }, velY: 0, grounded: true };
  b.move = { pos: { x: at[0], y: at[1], z: at[2] }, velY: 0, grounded: true };
  b.yaw = Math.atan2(a.move.pos.x - b.move.pos.x, a.move.pos.z - b.move.pos.z);
  return { match, d, a, b };
}

/** Where a body's head is drawn (the head sphere's centre) for a combatant now. */
function headOf(c: Combatant) {
  const h = lookHitbox(c.look);
  return headPoint({ feet: c.move.pos, yaw: c.yaw, stance: c.move.stance ?? 0, scale: h.scale * c.size, box: h.box });
}

const landed = (ev: GameEvent[]) => ev.filter((e) => e.e === 'shot' || e.e === 'impact').map((e) => (e.e === 'shot' ? { hit: e.hit[0], z: e.z?.[0] ?? 0 } : { hit: e.hit, z: e.z ?? 0 })).filter((x) => x.hit !== null);

describe('zones in the match come from the shapes', () => {
  for (const look of ['core.sprout', 'core.ranger', 'core.abe', 'core.hyena']) {
    it(`${look} (${getLook(look).size ?? 'standard'}): a round at the drawn head is a head shot, one at the chest a body shot, one at a thigh a leg shot`, () => {
      const zoneAt = (to: (b: Combatant) => { x: number; y: number; z: number }) => {
        const { d, a, b } = pair(look);
        give(a, 'core.revolver');
        const aim = lookAngles(eye(a.move.pos), to(b));
        const ev = d.run(30, () => d.input(a, { ...aim, buttons: BUTTON_FIRE }));
        return landed(ev)[0];
      };
      const box = lookHitbox(look).box.stand;
      const k = matchStats(look, rules).size;
      expect(zoneAt((b) => headOf(b))).toEqual({ hit: 1, z: 1 });
      const t = box.torso!;
      expect(zoneAt((b) => ({ x: b.move.pos.x, y: ((t.a[0] + t.b[0]) / 2) * k, z: b.move.pos.z }))).toEqual({ hit: 1, z: 0 });
      // A thigh (body frame x right; b faces -x, so its right is +z).
      const thigh = box.legs[0]!;
      const mid = [(thigh.a[0] + thigh.b[0]) / 2, (thigh.a[1] + thigh.b[1]) / 2, (thigh.a[2] + thigh.b[2]) / 2];
      expect(zoneAt((b) => ({ x: b.move.pos.x - mid[2] * k, y: mid[1] * k, z: b.move.pos.z + mid[0] * k }))).toEqual({ hit: 1, z: 2 });
    });
  }
});

describe('lag compensation uses the same shapes', () => {
  it('a shot at the head seen a moment ago lands on the rewound head (its stance and facing as they were), not the crouched body now', () => {
    const run = (useViewTick: boolean) => {
      // 4 m: the round arrives within the tick it is fired (later ticks of a flight are rewound less: lead for travel).
      const { match, d, a, b } = pair('core.ranger', [4, 0, 4]);
      give(a, 'core.revolver');
      d.run(5, () => (d.input(a, {}), d.input(b, { yaw: b.yaw })));
      const seen = match.tick;
      const aim = lookAngles(eye(a.move.pos), headOf(b));
      // b crouches and turns side-on.
      d.run(10, () => (d.input(a, { ...aim }), d.input(b, { yaw: 0, buttons: BUTTON_CROUCH })));
      expect(b.move.stance).toBe(1);
      const ev = d.run(1, () => (d.input(a, { ...aim, buttons: BUTTON_FIRE, ...(useViewTick ? { viewTick: seen } : {}) }), d.input(b, { yaw: 0, buttons: BUTTON_CROUCH })));
      return landed([...ev, ...d.run(5, () => (d.input(a, {}), d.input(b, { yaw: 0, buttons: BUTTON_CROUCH })))]);
    };
    expect(run(true)).toEqual([{ hit: 1, z: 1 }]);
    expect(run(false)).toEqual([]);
  });

  it('the rewound body is tested with exactly the shapes a live body is (rayBody on the recorded pose)', () => {
    const { box } = lookHitbox('core.abe');
    const body = { feet: { x: 3, y: 0.5, z: -2 }, yaw: 1.1, stance: 1 as const, scale: 1.18, box };
    const head = headPoint(body);
    const from = { x: head.x + 7, y: head.y + 0.4, z: head.z - 2 };
    const d = { x: head.x - from.x, y: head.y - from.y, z: head.z - from.z };
    const l = Math.hypot(d.x, d.y, d.z);
    const dir = { x: d.x / l, y: d.y / l, z: d.z / l };
    const t1 = rayBody(from, dir, body);
    const z1 = lastHit.zone;
    const t2 = rayBody(from, dir, { ...body, feet: { ...body.feet } });
    expect(t2).toBe(t1);
    expect(lastHit.zone).toBe(z1);
    expect(z1).toBe(1);
  });
});

describe('character stats', () => {
  it('every look without stats plays its size class (and standard with sizes off, and NPC skins)', () => {
    for (const l of CORE_LOOKS) {
      if (l.stats) continue;
      expect(lookStats(l.id), l.id).toEqual(classStats(l.size ?? 'standard'));
      expect(lookStats(l.id, { sizes: false }), l.id).toEqual(classStats('standard'));
    }
    expect(classStats('small')).toEqual({ health: BODY_SIZES.small.health, speed: BODY_SIZES.small.speed, size: BODY_SIZES.small.scale, damage: 1, stamina: 1, jump: 1, melee: 1, armor: 0 });
    expect(lookStats('npc:trooper')).toEqual(classStats('standard'));
  });

  it('a look\'s own stats replace its class values field by field; Character stats off ignores them', () => {
    const l = getLook('core.ranger');
    l.stats = { health: 140, jump: 1.2 };
    try {
      expect(lookStats('core.ranger')).toEqual({ ...classStats('standard'), health: 140, jump: 1.2 });
      expect(matchStats('core.ranger', { characterStats: false })).toEqual(classStats('standard'));
    } finally {
      delete l.stats;
    }
  });

  it('the manifests take the same stats and ranges as the game', () => {
    expect(Object.keys(STAT_RANGES)).toEqual([...STAT_KEYS]);
    for (const s of STAT_SPECS) expect(STAT_RANGES[s.key as keyof typeof STAT_RANGES]).toEqual([s.min, s.max]);
    expect(statsProblems({ health: 120, armor: 0.1 })).toEqual([]);
    expect(statsProblems({ health: 500 })).toHaveLength(1);
    expect(statsProblems({ luck: 1 })).toHaveLength(1);
  });

  it('wired into the sim: health, speed, size, damage, armor, melee, jump and stamina', () => {
    const l = getLook('core.ranger');
    l.stats = { health: 150, speed: 1.1, size: 1.1, damage: 1.2, armor: 0.25, melee: 1.5, jump: 1.2, stamina: 2 };
    try {
      const { match, d, a, b } = pair('core.ranger', [6, 0, 4]);
      // a wears the stats too (its look is the default: core.ranger).
      expect(b.maxHealth).toBe(150);
      expect(b.health).toBe(150);
      expect(b.speedMul).toBe(1.1);
      expect(b.size).toBe(1.1);
      // Damage dealt × 1.2, and b's armor takes a quarter off.
      give(a, 'core.revolver');
      const aim = lookAngles(eye(a.move.pos), { x: b.move.pos.x, y: b.move.pos.y + 1.25 * 1.1, z: b.move.pos.z });
      d.run(30, () => d.input(a, { ...aim, buttons: BUTTON_FIRE }));
      const rev = getWeapon('core.revolver');
      expect(150 - b.health).toBeCloseTo(rev.damage * 1.2 * 0.75, 3);
      void match;
      // Jump (1.2 times the speed: 1.44 times as high) and stamina (lasts twice as long: half the drain), against a
      // look without stats doing the same.
      const moves = (who: ReturnType<typeof pair>) => {
        who.d.run(20, () => who.d.input(who.b, {}));
        const y0 = who.b.move.pos.y;
        let peak = y0;
        who.d.run(1, () => who.d.input(who.b, { buttons: BUTTON_JUMP }));
        who.d.run(80, () => (who.d.input(who.b, {}), (peak = Math.max(peak, who.b.move.pos.y))));
        who.d.run(40, () => who.d.input(who.b, { buttons: BUTTON_SPRINT, forward: 1 }));
        return { jump: peak - y0, drained: 1 - (who.b.move.stamina ?? 1) };
      };
      const own = moves(pair('core.ranger', [6, 0, 8]));
      l.stats = {};
      const plain = moves(pair('core.ranger', [6, 0, 8]));
      expect(own.jump / plain.jump).toBeGreaterThan(1.3);
      expect(own.drained).toBeLessThan(plain.drained * 0.6);
      expect(plain.drained).toBeGreaterThan(0.05);
    } finally {
      delete l.stats;
    }
  });

  it('melee strength scales melee hits, not damage dealt', () => {
    const l = getLook('core.ranger');
    l.stats = { melee: 1.5, damage: 1 };
    try {
      const { d, a, b } = pair('core.ranger', [1.4, 0, 4]);
      give(a, 'core.knife');
      const aim = lookAngles(eye(a.move.pos), { x: b.move.pos.x, y: b.move.pos.y + 1.2, z: b.move.pos.z });
      d.run(25, () => d.input(a, { ...aim, buttons: BUTTON_FIRE }));
      expect(b.maxHealth - b.health).toBeCloseTo(getWeapon('core.knife').damage * 1.5, 3);
    } finally {
      delete l.stats;
    }
  });
});

describe('random characters', () => {
  it('pick only playable roster looks (never retired, NPC-only or NPC skins)', () => {
    const roster = new Set(CORE_LOOKS.map((l) => l.id));
    for (const id of RANDOM_LOOK_POOL) {
      expect(roster.has(id), id).toBe(true);
      expect(id in RETIRED_LOOKS, id).toBe(false);
      expect(id.startsWith('npc:'), id).toBe(false);
    }
    for (let seed = 1; seed < 40; seed++) for (let life = 1; life < 30; life++) expect(roster.has(randomLook(seed, seed % 7, life))).toBe(true);
  });

  it('are deterministic per seed and spread over the roster', () => {
    const run = (seed: number) => Array.from({ length: 40 }, (_, i) => randomLook(seed, i % 8, 1 + Math.floor(i / 8)));
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
    expect(new Set(run(7)).size).toBeGreaterThan(20);
    // Never the same look twice in a row.
    for (let life = 1; life < 50; life++) expect(randomLook(3, 2, life + 1, randomLook(3, 2, life))).not.toBe(randomLook(3, 2, life));
  });

  it('in a match: everyone (people and bots) plays a random look each life, sent in the spawn event; off again, their own', () => {
    const play = (seed: number) => {
      const match = new Match(yard([[0, 0, 4], [10, 0, 4], [20, 0, 4]]), { ...rules, respawnDelayTicks: 1, randomCharacters: true }, seed);
      const d = new Driver(match);
      const a = match.addHuman('a', 'core.sprout')!;
      const seen: string[] = [];
      for (let life = 0; life < 4; life++) {
        const ev = d.run(3, () => d.input(a, {}));
        const sp = ev.find((e) => e.e === 'spawn' && e.s === a.slot);
        if (sp && sp.e === 'spawn' && sp.l) seen.push(sp.l);
        expect(a.alive).toBe(true);
        a.health = 0;
        a.alive = false;
        a.respawnTick = match.tick;
      }
      return { match, d, a, seen };
    };
    const one = play(5);
    expect(one.seen.length).toBeGreaterThanOrEqual(3);
    for (const l of one.seen) expect(RANDOM_LOOK_POOL).toContain(l);
    expect(play(5).seen).toEqual(one.seen);
    // Its size and hit shapes follow the look it plays.
    expect(one.a.size).toBe(matchStats(one.a.look, one.match.rules).size);
    // Off: back to its own look at the next life.
    one.match.setRules({ randomCharacters: false });
    d2: {
      one.d.run(3, () => one.d.input(one.a, {}));
      expect(one.a.look).toBe('core.sprout');
      break d2;
    }
  });
});
