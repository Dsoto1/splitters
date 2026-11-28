import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  BUTTON_RELOAD,
  DEFAULT_DEATHMATCH_RULES,
  MapDocument,
  PLAYER,
  STANDARD_COMBAT,
  ammoGiven,
  applyCommand,
  invertCommand,
  cleanCombatRules,
  combatRulesOf,
  combatSummary,
  feedMagazine,
  getWeapon,
  gunplayOf,
  headMultiple,
  initPhysics,
  lookAngles,
  migrateMapDocument,
  BOT_DIFFICULTIES,
  CORE_BOT_PROFILES,
  standardCombat,
  weaponCode,
  type GameEvent,
  type MapDocument as MapDoc,
  type MapEntity,
  type MatchRules,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const eye = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
const chest = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + 1.1, z: p.z });
const head = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight + 0.05, z: p.z });

function deck(extra: MapEntity[] = [], combatRules?: MapDoc['combatRules']): MapDoc {
  const tiles = [];
  for (let x = 0; x < 4; x++) for (let y = -1; y <= 1; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return { ...map, entities: [...map.entities, ...extra], ...(combatRules ? { combatRules } : {}) };
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

function give(c: Combatant, id: string, reserve?: number): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: reserve ?? def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

function setup(o: { rules?: Partial<MatchRules>; map?: MapDoc['combatRules']; extra?: MapEntity[]; weapon?: string; at?: number } = {}) {
  const match = new Match(deck(o.extra, o.map), { ...rules, ...o.rules });
  const d = new Driver(match);
  const a = match.addHuman('a')!;
  const b = match.addHuman('b')!;
  a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
  b.move = { pos: { x: o.at ?? 5, y: 0, z: 0 }, velY: 0, grounded: true };
  give(a, o.weapon ?? 'core.pistol');
  return { match, d, a, b };
}

/** One shot at `aim` (chest or head); the damage it did and the events. */
function shoot(o: Parameters<typeof setup>[0] & { aim?: 'chest' | 'head' } = {}) {
  const s = setup(o);
  const to = (o.aim === 'head' ? head : chest)(s.b.move.pos);
  const ev = s.d.run(1, () => s.d.input(s.a, { ...lookAngles(eye(s.a.move.pos), to), buttons: BUTTON_FIRE }));
  ev.push(...s.d.run(4));
  return { ...s, dmg: PLAYER.maxHealth - s.b.health, ev };
}

describe('combat rules: resolving', () => {
  it('host over map over standard, knob by knob; junk dropped', () => {
    expect(combatRulesOf({})).toEqual(STANDARD_COMBAT);
    expect(standardCombat(combatRulesOf({}, { combatRules: {} }))).toBe(true);
    const p = combatRulesOf({ ammo: 'unlimited' }, { combatRules: { ammo: 'scarce', headshots: 'off', damageScale: 2 } });
    expect(p).toEqual({ ...STANDARD_COMBAT, ammo: 'unlimited', headshots: 'off', damageScale: 2 });
    expect(cleanCombatRules({ headshots: 'huge', damageScale: 3, reloads: 'no', healthScale: 1.5 })).toEqual({ healthScale: 1.5 });
    expect(combatSummary(p)).toEqual(['Headshots off', 'Unlimited ammo', 'Damage 2×']);
  });

  it('head multiples, ammo given and the magazine feed', () => {
    expect(headMultiple(2, 'off')).toBe(1);
    expect(headMultiple(2, 'normal')).toBe(2);
    expect(headMultiple(2, 'high')).toBe(3);
    expect(headMultiple(1, 'high')).toBe(1);
    expect(ammoGiven(30, 'scarce')).toBe(15);
    expect(ammoGiven(1, 'scarce')).toBe(1);
    expect(ammoGiven(30, 'normal')).toBe(30);
    const w = { def: { magazine: 10, reserveMax: 40 }, mag: 3, reserve: 5, unchambered: true as boolean | undefined };
    expect(feedMagazine(w, { ammo: 'normal', reloads: false })).toBe(true);
    expect(w).toMatchObject({ mag: 8, reserve: 0, unchambered: undefined });
    const u = { def: { magazine: 10, reserveMax: 40 }, mag: 0, reserve: 0 };
    feedMagazine(u, { ammo: 'unlimited', reloads: false });
    expect(u).toMatchObject({ mag: 10, reserve: 30 });
    const r = { def: { magazine: 10, reserveMax: 40 }, mag: 0, reserve: 0 };
    feedMagazine(r, { ammo: 'unlimited', reloads: true });
    expect(r).toMatchObject({ mag: 0, reserve: 40 });
  });

  it('the map file carries them (v56), and older maps load unchanged with the standard', () => {
    const m = deck([], { headshots: 'high', reloads: false });
    expect(MapDocument.parse(m).combatRules).toEqual({ headshots: 'high', reloads: false });
    expect(MapDocument.safeParse({ ...m, combatRules: { damageScale: 3 } }).success).toBe(false);
    const old = MapDocument.parse(migrateMapDocument({ ...deck(), formatVersion: 55 }).doc);
    expect(old.combatRules).toBeUndefined();
    expect(combatRulesOf({}, old)).toEqual(STANDARD_COMBAT);
  });
});

describe('combat rules: MapMaker command', () => {
  it('sets, clears and undoes the map file\'s combatRules', () => {
    const m = deck();
    const cmd = { kind: 'setCombatRules' as const, before: null, after: { ammo: 'unlimited' as const } };
    const set = applyCommand(m, cmd);
    expect(set.combatRules).toEqual({ ammo: 'unlimited' });
    expect('combatRules' in applyCommand(set, invertCommand(cmd))).toBe(false);
    expect('combatRules' in applyCommand(set, { kind: 'setCombatRules', before: { ammo: 'unlimited' }, after: {} })).toBe(false);
  });
});

describe('combat rules in play (host-authoritative sim)', () => {
  const pistol = getWeapon('core.pistol');
  const headK = gunplayOf(pistol).head;

  it('standard rules leave damage as it was', () => {
    expect(shoot().dmg).toBeCloseTo(pistol.damage, 5);
    expect(shoot({ aim: 'head' }).dmg).toBeCloseTo(Math.min(PLAYER.maxHealth, pistol.damage * headK), 5);
  });

  it('headshots off count a head as the body; high doubles the bonus; the map default and the host override', () => {
    expect(headK).toBeGreaterThan(1);
    expect(shoot({ aim: 'head', rules: { headshots: 'off' } }).dmg).toBeCloseTo(pistol.damage, 5);
    expect(shoot({ aim: 'head', map: { headshots: 'off' } }).dmg).toBeCloseTo(pistol.damage, 5);
    expect(shoot({ aim: 'head', map: { headshots: 'off' }, rules: { headshots: 'normal' } }).dmg).toBeCloseTo(Math.min(100, pistol.damage * headK), 5);
    expect(shoot({ aim: 'head', rules: { headshots: 'high' } }).dmg).toBeCloseTo(Math.min(100, pistol.damage * (1 + (headK - 1) * 2)), 5);
    // The killfeed's mark: no headshot kill with headshots off.
    const kill = (headshots: 'off' | 'normal') => {
      const s = setup({ rules: { headshots, damageScale: 2 } });
      s.b.health = 1;
      const ev = s.d.run(1, () => s.d.input(s.a, { ...lookAngles(eye(s.a.move.pos), head(s.b.move.pos)), buttons: BUTTON_FIRE }));
      ev.push(...s.d.run(4));
      return ev.find((e) => e.e === 'kill');
    };
    expect(kill('normal')).toMatchObject({ hs: 1 });
    expect(kill('off')).toBeDefined();
    expect((kill('off') as { hs?: number } | undefined)?.hs).toBeUndefined();
  });

  it('damage and health scales', () => {
    expect(shoot({ rules: { damageScale: 0.5 } }).dmg).toBeCloseTo(pistol.damage * 0.5, 5);
    expect(shoot({ map: { damageScale: 2 } }).dmg).toBeCloseTo(pistol.damage * 2, 5);
    expect(shoot({ rules: { healthScale: 2 } }).dmg).toBeCloseTo(pistol.damage / 2, 5);
    expect(shoot({ rules: { healthScale: 2, damageScale: 2 } }).dmg).toBeCloseTo(pistol.damage, 5);
  });

  it('bullets through walls off: a board that a rifle round passes stops it', () => {
    const board: MapEntity = { id: 'wall', kind: 'block', position: [3, 0, 0], size: [0.1, 3, 4], yaw: 0, material: 'core.oak_planks', tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 } as MapEntity;
    expect(shoot({ weapon: 'core.rifle', extra: [board] }).dmg).toBeGreaterThan(0);
    expect(shoot({ weapon: 'core.rifle', extra: [board], rules: { wallPenetration: false } }).dmg).toBe(0);
    expect(shoot({ weapon: 'core.rifle', extra: [board], map: { wallPenetration: false } }).dmg).toBe(0);
  });

  it('reloads off: the magazine feeds from the reserve and nothing reloads; unlimited ammo never runs down', () => {
    const fire = (o: Parameters<typeof setup>[0], ticks: number) => {
      const s = setup({ ...o, weapon: 'core.smg', at: 30 });
      const w = s.a.weapons.get(s.a.current)!;
      w.reserve = 60;
      let reloaded = false;
      s.d.run(ticks, () => {
        s.d.input(s.a, { buttons: BUTTON_FIRE | BUTTON_RELOAD, pitch: 0.5 });
        if (s.a.reloadTicks > 0) reloaded = true;
      });
      return { w, reloaded };
    };
    const smg = getWeapon('core.smg');
    const off = fire({ rules: { reloads: false } }, 30);
    expect(off.reloaded).toBe(false);
    expect(off.w.mag + off.w.reserve).toBeLessThan(smg.magazine + 60);
    expect(off.w.mag).toBe(Math.min(smg.magazine, off.w.mag + off.w.reserve));
    const bottomless = fire({ map: { reloads: false, ammo: 'unlimited' } }, 30);
    expect(bottomless.w.mag).toBe(smg.magazine);
    expect(bottomless.w.reserve).toBe(smg.reserveMax);
    const on = fire({}, 30);
    expect(on.reloaded).toBe(true);
  });

  it('scarce ammo: half the spawn and pickup ammo', () => {
    const spawned = (ammo?: 'scarce') => {
      const match = new Match(deck(), { ...rules, ...(ammo ? { ammo } : {}) });
      const a = match.addHuman('a')!;
      match.step();
      return [...a.weapons.values()].filter((w) => w.def.reserveMax > 0).map((w) => w.reserve);
    };
    const normal = spawned();
    const scarce = spawned('scarce');
    expect(normal.length).toBeGreaterThan(0);
    scarce.forEach((r, i) => expect(r).toBe(Math.max(1, Math.ceil(normal[i]! / 2))));
  });

  it('bots on unlimited ammo with reloads off never reload and never run dry', () => {
    const match = new Match(deck(), { ...rules, ammo: 'unlimited', reloads: false });
    const h = match.addHuman('a')!;
    const bot = match.addBot('bot', CORE_BOT_PROFILES[0]!, BOT_DIFFICULTIES.normal)!;
    expect(h && bot).toBeTruthy();
    let reloads = 0;
    let shots = 0;
    for (let i = 0; i < 900; i++) {
      for (const e of match.step()) if (e.e === 'shot' && e.s === bot.slot) shots++;
      if (bot.reloadTicks > 0) reloads++;
      if (h.alive) h.health = PLAYER.maxHealth;
    }
    expect(shots).toBeGreaterThan(0);
    expect(reloads).toBe(0);
    for (const w of bot.weapons.values()) if (w.def.reserveMax > 0 && w === bot.weapons.get(bot.current)) expect(w.reserve).toBe(w.def.reserveMax);
  });
});
