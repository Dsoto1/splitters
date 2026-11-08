import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, DEFAULT_RULES, initPhysics, type GameEvent, type MapDocument, type MapEntity, type MatchRules } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { STREAK_REWARDS } from '../src/sim/items.ts';
import { FORT_COMBAT } from '../src/sim/forts.ts';
import { THROWABLE_DEFS } from '../src/content/weapons.generated.ts';
import { getWeapon, throwableWeaponId } from '../src/sim/weapons.ts';
import { makeMap } from './helpers.ts';

/**
 * Team kills (owner, 2026-11-08: "Teamkills should not count towards a kill streak (should end one) or show anything
 * rewarding. It should actually show in the upper right that it was a TK."). With friendly fire on, every way of
 * downing a teammate is fired for real here (rounds, a rocket's blast, a grenade, a vehicle, a turret, a burn, a
 * barrel set off), by a person and by a bot, in every team mode: the kill event carries `tk` (the feed marks it),
 * and nothing rewards it: no kill or score, the killer's streak ends (no streak reward), no headshot mark, no
 * callout or award credit, no Roulette credit. Enemy kills and self-kills are unchanged.
 */

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** A yard 5 x 3 cells (40 x 24 m), with what a test adds. */
function yard(extra: MapEntity[] = []): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 3; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 });
  const map = makeMap(tiles, [[4, 0, 4]]);
  return { ...map, entities: [...map.entities, ...extra] };
}

interface Internals {
  fireNow(shooter: Combatant, def: ReturnType<typeof getWeapon>, viewTick: number): void;
  enterMount(c: Combatant): boolean;
  launch(c: Combatant, spec: unknown, weapon: string, up: number): void;
  fire(shooter: Combatant, def: ReturnType<typeof getWeapon>, viewTick: number): void;
  mounts: { pos: { x: number; y: number; z: number }; yaw: number; speed: number; seats: (number | null)[]; def: { id: string } }[];
}
const inner = (m: Match) => m as unknown as Internals;

type Shooter = 'human' | 'bot';

/** A 2 v 2 team match with friendly fire on: you (a person or a bot), a teammate, two enemies, all parked. */
function setUp(opts: { mode?: MatchRules['mode']; shooter?: Shooter; ff?: MatchRules['friendlyFire']; extra?: MapEntity[]; rules?: Partial<MatchRules> } = {}) {
  const mode = opts.mode ?? 'core.tdm';
  const rules: MatchRules = { ...DEFAULT_RULES[mode], teamSizes: [2, 2], friendlyFire: opts.ff ?? 'on', scoreLimit: 0, respawnDelayTicks: 100_000, ...opts.rules };
  const match = new Match(yard(opts.extra), rules, 7);
  const me = opts.shooter === 'bot' ? match.addBot('me', { ...CORE_BOT_PROFILES[3]!, tags: [] }, BOT_DIFFICULTIES.normal)! : match.addHuman('me')!;
  const others = [0, 1, 2].map((i) => match.addHuman(`p${i}`)!);
  const mate = others.find((o) => o.faction === me.faction)!;
  const enemy = others.find((o) => o.faction !== me.faction)!;
  const events: GameEvent[] = [];
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) events.push(...match.step());
  };
  step(5);
  // Bots' own brains stay out of it: the test steers them.
  if (me.bot) (me as { bot: unknown }).bot = undefined;
  const ground = me.move.pos.y;
  const park = (c: Combatant, x: number, z: number) => (c.move = { ...c.move, pos: { x, y: ground, z }, velY: 0, grounded: true, vx: 0, vz: 0 });
  for (const c of [me, ...others]) {
    c.armor = 0;
    c.invulnerable = false;
    c.shieldUntil = 0;
  }
  // Everyone away from the action but the target: the enemies far off to the side.
  others.forEach((c, i) => park(c, 34, 4 + i * 4));
  park(me, 10, 4);
  me.yaw = 0;
  me.pitch = 0;
  events.length = 0;
  return { match, me, mate, enemy, others, events, step, park, ground };
}

type Rig = ReturnType<typeof setUp>;

/** The kill of `victim` in the events (or undefined). */
const killOf = (r: Rig, victim: Combatant) => r.events.find((e): e is Extract<GameEvent, { e: 'kill' }> => e.e === 'kill' && e.victim === victim.slot);

/** Hold still while time passes (bots and people drift otherwise), until the last of `who` (the target) is down. */
function hold(r: Rig, ticks: number, who: Combatant[] = [r.me, r.mate]): void {
  const target = who[who.length - 1]!;
  for (let i = 0; i < ticks; i++) {
    for (const c of who) c.move = { ...c.move, vx: 0, vz: 0 };
    r.step();
    if (!target.alive) break;
  }
}

/** Ways to down `target` (a teammate or an enemy), each fired for real. */
const SOURCES: Record<string, (r: Rig, target: Combatant) => void> = {
  bullets(r, t) {
    r.park(t, 10, 9);
    t.health = 5;
    inner(r.match).fireNow(r.me, { ...getWeapon('core.rifle'), alt: undefined }, 0);
    hold(r, 20, [r.me, t]);
  },
  'a rocket (its blast)'(r, t) {
    r.park(t, 10, 8);
    t.health = 5;
    r.me.invulnerable = true;
    inner(r.match).fireNow(r.me, { ...getWeapon('core.rockets'), alt: undefined }, 0);
    hold(r, 40, [r.me, t]);
  },
  'a grenade'(r, t) {
    r.me.invulnerable = true;
    r.park(t, 10, 6);
    t.health = 5;
    // A frag thrown as G throws it, at the floor just ahead: it goes off on its fuse beside them.
    r.me.pitch = -1.2;
    inner(r.match).launch(r.me, THROWABLE_DEFS.frag.projectile, throwableWeaponId('frag'), 0.12);
    hold(r, 240, [r.me, t]);
  },
  'a vehicle (run over)'(r, t) {
    const kart = inner(r.match).mounts.find((m) => m.def.id === 'kart')!;
    r.park(r.me, kart.pos.x + 1, kart.pos.z);
    expect(inner(r.match).enterMount(r.me)).toBe(true);
    t.health = 5;
    for (let i = 0; i < 120 && t.alive; i++) {
      r.match.queueInputs(r.me.slot, [{ seq: 2000 + i, forward: 1, right: 0, yaw: kart.yaw, pitch: 0, buttons: 0 }]);
      kart.speed = Math.max(kart.speed, 12);
      // Always just ahead of the bonnet.
      r.park(t, kart.pos.x + Math.sin(kart.yaw) * 1.2, kart.pos.z + Math.cos(kart.yaw) * 1.2);
      r.step();
    }
  },
  'a turret'(r, t) {
    const gun = inner(r.match).mounts.find((m) => m.def.id === 'turret_mg')!;
    r.park(r.me, gun.pos.x, gun.pos.z - 1);
    expect(inner(r.match).enterMount(r.me)).toBe(true);
    t.health = 5;
    for (let i = 0; i < 120 && t.alive; i++) {
      r.park(t, gun.pos.x, gun.pos.z + 6);
      // The seat's gun, fired as its trigger fires it (bots' hands don't read queued inputs).
      r.me.yaw = gun.yaw;
      r.me.pitch = -0.05;
      if (i % 6 === 0) inner(r.match).fire(r.me, { ...getWeapon('core.mount_mg'), alt: undefined }, 0);
      r.step();
    }
  },
  'a burn'(r, t) {
    r.park(t, 10, 6.5);
    t.health = 12;
    inner(r.match).fireNow(r.me, { ...getWeapon('core.flamethrower'), alt: undefined }, 0);
    hold(r, 300, [r.me, t]);
  },
  'a barrel set off'(r, t) {
    // The barrel straight ahead (aimed at its middle); the target beside it, out of the line of fire.
    r.park(t, 11.6, 9.5);
    r.me.pitch = -0.16;
    t.health = 5;
    for (let i = 0; i < 6 && t.alive; i++) {
      r.me.fireCooldown = 0;
      inner(r.match).fireNow(r.me, { ...getWeapon('core.rifle'), alt: undefined }, 0);
      hold(r, 10, [r.me, t]);
    }
    hold(r, 10, [r.me, t]);
  },
};

const PROPS: Record<string, MapEntity[]> = {
  'a vehicle (run over)': [{ id: 'mount_kart', kind: 'mount', model: 'kart', position: [20, 0, 12], yaw: 0, faction: null, respawnSeconds: null } as MapEntity],
  'a turret': [{ id: 'mount_mg', kind: 'mount', model: 'turret_mg', position: [20, 0, 8], yaw: 0, faction: null, respawnSeconds: null } as MapEntity],
  'a barrel set off': [{ id: 'barrel', kind: 'destructible', model: 'barrel', position: [10, 0, 10], yaw: 0, health: null, explosiveOnly: false } as MapEntity],
};

/** Everything a team kill must not give, checked against what the killer had: a streak one kill short of a reward. */
function primeStreak(r: Rig): void {
  r.me.streak = STREAK_REWARDS[0]!.kills - 1;
}

function expectNothingRewarding(r: Rig, kills0: number, score0: number | undefined): void {
  const kill = killOf(r, r.mate)!;
  expect(kill, 'the teammate died').toBeDefined();
  expect(kill.killer).toBe(r.me.slot);
  expect(kill.tk).toBe(1);
  expect(kill.hs).toBeUndefined();
  expect(r.me.kills).toBe(kills0);
  // The streak ends (and no reward at the count it would have reached).
  expect(r.me.streak ?? 0).toBe(0);
  expect(r.events.some((e) => e.e === 'streak' && e.s === r.me.slot)).toBe(false);
  // No revenge or nemesis callout for it; nothing toward the awards.
  expect(r.events.some((e) => e.e === 'callout' && e.s === r.me.slot)).toBe(false);
  expect(r.match.awards.stats(r.me.slot)?.best ?? 0).toBe(0);
  if (score0 !== undefined) expect(r.match.teamScores().get(r.me.faction!)).toBe(score0);
  // Still a death for them.
  expect(r.mate.deaths).toBe(1);
}

describe('team kills', () => {
  for (const [what, source] of Object.entries(SOURCES)) {
    for (const shooter of ['human', 'bot'] as const) {
      it(`${what}, by a ${shooter === 'human' ? 'person' : 'bot'}: marked TK, nothing rewarding, the streak ends`, () => {
        const r = setUp({ shooter, extra: PROPS[what] });
        primeStreak(r);
        const score0 = r.match.teamScores().get(r.me.faction!);
        source(r, r.mate);
        expect(r.mate.alive, `${what} downed the teammate`).toBe(false);
        expectNothingRewarding(r, 0, score0);
      });
    }
  }

  it('the same sources on an enemy still score, and carry no TK mark', () => {
    for (const what of ['bullets', 'a grenade', 'a vehicle (run over)', 'a barrel set off']) {
      const r = setUp({ extra: PROPS[what] });
      r.me.streak = STREAK_REWARDS[0]!.kills - 1;
      SOURCES[what]!(r, r.enemy);
      const kill = killOf(r, r.enemy)!;
      expect(kill, what).toBeDefined();
      expect(kill.tk, what).toBeUndefined();
      expect(r.me.kills, what).toBe(1);
      expect(r.me.streak, what).toBe(STREAK_REWARDS[0]!.kills);
      expect(r.events.some((e) => e.e === 'streak' && e.s === r.me.slot), what).toBe(true);
    }
  });

  it('with friendly fire off a teammate is neither hurt nor run over (nothing to mark)', () => {
    for (const what of ['bullets', 'a vehicle (run over)']) {
      const r = setUp({ ff: 'off', extra: PROPS[what] });
      SOURCES[what]!(r, r.mate);
      expect(r.mate.alive, what).toBe(true);
    }
  });

  it('half friendly fire: a team kill is a team kill', () => {
    const r = setUp({ ff: 'half' });
    primeStreak(r);
    SOURCES.bullets!(r, r.mate);
    expect(r.mate.alive).toBe(false);
    expectNothingRewarding(r, 0, r.match.teamScores().get(r.me.faction!));
  });

  for (const mode of ['core.tdm', 'core.ctf', 'core.koth', 'core.elim', 'core.bomb', 'core.hostage', 'core.breakthrough', 'core.forts'] as const) {
    it(`${mode}: a team kill scores nothing for the side and ends the streak`, () => {
      const r = setUp({ mode });
      // Fort Wars opens with its build phase (no damage between players): into the fight.
      if (mode === 'core.forts') (r.match.mode as unknown as { phase: number }).phase = FORT_COMBAT;
      primeStreak(r);
      const score0 = r.match.teamScores().get(r.me.faction!);
      SOURCES.bullets!(r, r.mate);
      expect(r.mate.alive).toBe(false);
      expectNothingRewarding(r, 0, score0);
    });
  }

  it('a team kill ends a streak earned before it: the next enemy kill starts again at one', () => {
    const r = setUp();
    r.me.streak = 2;
    SOURCES.bullets!(r, r.mate);
    expect(r.me.streak ?? 0).toBe(0);
    r.events.length = 0;
    SOURCES.bullets!(r, r.enemy);
    expect(r.me.streak).toBe(1);
    expect(r.me.kills).toBe(1);
  });

  it('Longest Streak, Nemesis and Most Revenge get nothing from team kills', () => {
    const r = setUp();
    // Enemy kills build a streak of 2 in the award tally; a team kill ends it there.
    r.match.awards.kill(r.me.slot, r.enemy.slot);
    r.match.awards.kill(r.me.slot, r.enemy.slot);
    SOURCES.bullets!(r, r.mate);
    expect(r.match.awards.stats(r.me.slot)!.best).toBe(2);
    r.match.awards.kill(r.me.slot, r.enemy.slot);
    // After the team kill the run starts again: 1, not 3.
    expect(r.match.awards.stats(r.me.slot)!.best).toBe(2);
    // The teammate downed by you is not a revenge target for you, nor you for them.
    const awards = r.match.awards.awards([r.me.slot, r.mate.slot, r.enemy.slot]);
    expect(awards.some((a) => a[0] === 'nemesis' && a[3] === r.mate.slot)).toBe(false);
    expect(r.match.awards.stats(r.mate.slot)?.revenge ?? 0).toBe(0);
  });

  it('Roulette with teams: no kill credit, no bonus, the life\'s kills toward a streak pick end', () => {
    const r = setUp({ rules: { roulette: true } });
    expect(r.match.roulette).not.toBeNull();
    const seat = (r.match.roulette as unknown as { seat(c: Combatant): { lifeKills: number; giantKills: number; airKills: number } }).seat.bind(r.match.roulette);
    seat(r.me).lifeKills = 2;
    SOURCES.bullets!(r, r.mate);
    expect(r.mate.alive).toBe(false);
    expect(killOf(r, r.mate)!.tk).toBe(1);
    expect(r.me.kills).toBe(0);
    expect(seat(r.me).lifeKills).toBe(0);
    expect(r.events.some((e) => e.e === 'rl' && e.s === r.me.slot)).toBe(false);
  });

  it('self-kills are unchanged: your own rocket is a death, no TK mark', () => {
    const r = setUp();
    r.me.health = 5;
    r.park(r.me, 10, 4);
    r.me.pitch = -1.4;
    inner(r.match).fireNow(r.me, { ...getWeapon('core.rockets'), alt: undefined }, 0);
    hold(r, 40, [r.me]);
    const kill = killOf(r, r.me)!;
    expect(kill).toBeDefined();
    expect(kill.killer).toBeNull();
    expect(kill.tk).toBeUndefined();
    expect(r.me.selfKills).toBe(1);
  });
});
