/**
 * Dual wielding (docs/GUNPLAY_SPEC.md, "Akimbo / Dual Wield"). Step 1: the weapon data and its resolver (the match
 * rule is in matchSetup.test.ts and serverRules.test.ts). Step 2: play: making a pair, the second trigger, two
 * magazines over one reserve, the trade, the staggered reload, back to one gun, switches, drops and death, the
 * snapshot's fields, and that none of it exists while dual wielding is off (rules.ts AKIMBO_READY).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AKIMBO_BASE,
  AKIMBO_READY,
  BOT_DIFFICULTIES,
  BUTTON_ALT,
  BUTTON_AUTO_RELOAD,
  BUTTON_FIRE,
  BUTTON_RELOAD,
  BUTTON_SPRINT,
  BUTTON_ZOOM,
  CORE_BOT_PROFILES,
  CORE_WEAPONS,
  DEFAULT_DEATHMATCH_RULES,
  FAMILY_DEFAULTS,
  PLAYER,
  PROTOCOL_VERSION,
  SNAPSHOT_BINARY_VERSION,
  SnapshotBinaryDecoder,
  SnapshotBinaryEncoder,
  SnapshotDecoder,
  SnapshotStream,
  akimboCone,
  akimboKick,
  akimboLoader,
  akimboOf,
  akimboRaise,
  akimboReady,
  encodeSnapshots,
  getItem,
  getWeapon,
  gunplayOf,
  initPhysics,
  lookAngles,
  newGunState,
  pairReloadTurn,
  setAkimboReady,
  weaponCode,
  type GameEvent,
  type ItemDefinition,
  type MapDocument,
  type MatchRules,
  type PlayerInput,
  type ServerMessage,
  type Vec3,
  type WeaponDefinition,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { loadArena, makeMap } from './helpers.ts';

const weapon = (id: string): WeaponDefinition => CORE_WEAPONS[id]!;

describe('akimboOf', () => {
  it('exactly four weapons can be paired today', () => {
    expect(Object.values(CORE_WEAPONS).filter((d) => akimboOf(d)).map((d) => d.id).sort()).toEqual(['core.machine_pistol', 'core.pistol', 'core.pulse_pistol', 'core.sawed_off']);
    for (const id of ['revolver', 'hand_cannon', 'smg', 'gilded_pistol', 'flare_gun', 'goo_gun', 'freeze_ray', 'nailgun', 'lmg', 'shotgun', 'auto_shotgun', 'rifle', 'knife']) {
      expect(akimboOf(weapon(`core.${id}`)), id).toBeNull();
    }
  });

  it('resolves the base block, then the family, then the weapon', () => {
    expect(akimboOf(weapon('core.pistol'))).toEqual({ cone: 1.5, pattern: 1, kick: 1.2, reload: 1.35, raise: 1.25, move: 0 });
    expect(akimboOf(weapon('core.machine_pistol'))).toEqual({ cone: 1.6, pattern: 1, kick: 1.25, reload: 1.35, raise: 1.25, move: 0 });
    expect(akimboOf(weapon('core.sawed_off'))).toEqual({ cone: 1, pattern: 1.15, kick: 1.4, reload: 1.5, raise: 1.25, move: 0 });
    // No family of its own: it takes the pistol's trade by name.
    expect(weapon('core.pulse_pistol').family).toBeUndefined();
    expect(akimboOf(weapon('core.pulse_pistol'))).toEqual(akimboOf(weapon('core.pistol')));
    // The SMG family has its trade ready; the full-stock SMG itself isn't eligible.
    expect({ ...AKIMBO_BASE, ...FAMILY_DEFAULTS.smg.akimbo }).toEqual({ cone: 1.7, pattern: 1, kick: 1.3, reload: 1.4, raise: 1.25, move: -0.03 });
    expect(AKIMBO_BASE).toEqual({ cone: 1, pattern: 1, kick: 1, reload: 1, raise: 1.25, move: 0 });
  });

  it('takes a weapon\'s own numbers and `as`, and caches', () => {
    const smg = { ...weapon('core.smg'), akimbo: true as const };
    expect(akimboOf(smg)).toEqual({ cone: 1.7, pattern: 1, kick: 1.3, reload: 1.4, raise: 1.25, move: -0.03 });
    expect(akimboOf(smg)).toBe(akimboOf(smg));
    const own = { ...weapon('core.smg'), akimbo: { as: 'machine_pistol' as const, kick: 2, raise: 1 } };
    expect(akimboOf(own)).toEqual({ cone: 1.6, pattern: 1, kick: 2, reload: 1.35, raise: 1, move: 0 });
    expect(akimboOf(own)).not.toHaveProperty('as');
  });

  it('leaves a weapon\'s gunplay as it was', () => {
    for (const id of ['core.pistol', 'core.machine_pistol', 'core.pulse_pistol', 'core.sawed_off']) {
      const { akimbo: _a, ...plain } = weapon(id);
      expect(gunplayOf(weapon(id)), id).toEqual(gunplayOf(plain));
    }
  });
});

// ---------------------------------------------------------------- step 2: play

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 };
const eye = (p: Vec3) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
const PISTOL = 'core.pistol';
const MP = 'core.machine_pistol';
const SAWED = 'core.sawed_off';
const PULSE = 'core.pulse_pistol';
const code = (id: string) => weaponCode(getWeapon(id));

/** A long deck: 6 cells (48 m) along x, three wide. */
function deck(pickups: { item: string; at: [number, number, number] }[] = []): MapDocument {
  const tiles = [];
  for (let x = -1; x <= 5; x++) for (let y = -1; y <= 1; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return { ...map, entities: [...map.entities, ...pickups.map((p, i) => ({ id: `gun_${i}`, kind: 'pickup' as const, item: p.item, position: p.at, respawnSeconds: null }))] };
}

type Inner = { applyItem(c: Combatant, item: ItemDefinition): boolean; kill(v: Combatant, k: Combatant | null, w: string): void; makePair(c: Combatant, w: Combatant['weapons'] extends Map<number, infer W> ? W : never, mag: number): void };
const inner = (m: Match) => m as unknown as Inner;

/** `c` holds `id` (full, a full reserve unless given), up and ready. */
function give(c: Combatant, id: string, mag?: number, reserve?: number): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: mag ?? def.magazine, reserve: reserve ?? def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

/** One person on the deck with `id` in hand; `pair`: holding a second one too (Match.makePair, what a pickup of it does), its raise over. */
function solo(id: string, o: { pair?: boolean; rules?: MatchRules; map?: MapDocument; akimbo?: boolean } = {}) {
  const match = new Match(o.map ?? deck(), o.rules ?? rules, 3, o.akimbo === undefined ? {} : { akimbo: o.akimbo });
  const a = match.addHuman('A')!;
  a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
  give(a, id);
  if (o.pair !== false) {
    inner(match).makePair(a, a.weapons.get(code(id))!, getWeapon(id).magazine);
    a.fireCooldown2 = 0;
  }
  const w = () => a.weapons.get(code(id))!;
  let seq = 0;
  const look = lookAngles(eye(a.move.pos), { x: 40, y: 1.25, z: 0 });
  /** One input; returns the tick's events. */
  const tick = (i: Partial<PlayerInput> = {}): GameEvent[] => {
    match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, ...look, buttons: 0, ...i }]);
    return match.step();
  };
  const shots = (ev: GameEvent[]) => ev.filter((e): e is Extract<GameEvent, { e: 'shot' }> => e.e === 'shot' && e.s === a.slot);
  const pub = () => match.playerSnapshots().find((p) => p.s === a.slot)!;
  const me = () => match.privateState(a.slot)!;
  return { match, a, w, tick, shots, pub, me };
}

describe('dual wielding in play', () => {
  beforeAll(async () => {
    await Promise.all([initPhysics(), initNavigation()]);
    setAkimboReady(true);
  });
  afterAll(() => setAkimboReady());

  describe('making a pair', () => {
    it('the constant is on since step 4 (pairs in normal matches), and tests can turn play off through the one function', () => {
      expect(AKIMBO_READY).toBe(true);
      expect(akimboReady()).toBe(true);
      setAkimboReady(false);
      expect(akimboReady()).toBe(false);
      setAkimboReady();
      expect(akimboReady()).toBe(true);
    });

    it('walking over a second of a gun you hold makes a pair: its own full magazine, and the pickup\'s ammo as before', () => {
      const { match, a, w, tick, pub, me } = solo(MP, { pair: false, map: deck([{ item: 'core.weapon_machine_pistol', at: [0, 0, 0] }]) });
      w().reserve = 30;
      w().mag = 7;
      expect(w().off).toBeUndefined();
      const ev = tick();
      expect(ev.some((e) => e.e === 'pickup' && e.s === a.slot && e.item === 'core.weapon_machine_pistol')).toBe(true);
      expect(w().off).toEqual({ mag: 24 });
      expect([w().mag, w().reserve]).toEqual([7, 78]);
      // The second gun comes up beside the first, which is never held up: its raise before its first round.
      expect(a.fireCooldown2).toBe(akimboRaise(getWeapon(MP), akimboOf(getWeapon(MP))!));
      expect(a.fireCooldown2).toBe(15);
      expect(a.raiseTicks).toBe(0);
      expect(pub().dw).toBe(1);
      expect(me().ow).toEqual([[code(MP), 24]]);
      match.destroy();
    });

    it('a pair is made even with a full reserve (the pickup is the gun), and a third gun is ammunition again', () => {
      const { match, a, w } = solo(MP, { pair: false });
      const item = getItem('core.weapon_machine_pistol')!;
      expect(w().reserve).toBe(getWeapon(MP).reserveMax);
      expect(inner(match).applyItem(a, item)).toBe(true);
      expect(w().off).toEqual({ mag: 24 });
      // A third: nothing to take with a full reserve; ammunition otherwise, and the second gun is untouched.
      expect(inner(match).applyItem(a, item)).toBe(false);
      w().reserve = 10;
      w().off!.mag = 3;
      expect(inner(match).applyItem(a, item)).toBe(true);
      expect(w().reserve).toBe(58);
      expect(w().off).toEqual({ mag: 3 });
      match.destroy();
    });

    it('every eligible gun pairs by its pickup, the Pistol too (its pickup lies only where a map maker placed one)', () => {
      for (const id of [PISTOL, MP, SAWED, PULSE]) {
        const { match, a, w } = solo(id, { pair: false });
        expect(inner(match).applyItem(a, getItem(`core.weapon_${id.replace('core.', '')}`)!), id).toBe(true);
        expect(w().off, id).toEqual({ mag: getWeapon(id).magazine });
        match.destroy();
      }
    });

    it('the Pistol pickup: walking over it with the Pistol everyone starts with makes the pair; with dual wielding off it is ammunition, as any same-gun pickup', () => {
      const item = 'core.weapon_pistol';
      const map = () => deck([{ item, at: [0, 0, 0] }]);
      // On: the pair, a full second magazine, and the pickup's ammo.
      let s = solo(PISTOL, { pair: false, map: map() });
      s.w().reserve = 0;
      let ev = s.tick();
      expect(ev.some((e) => e.e === 'pickup' && e.s === s.a.slot && e.item === item)).toBe(true);
      expect(s.w().off).toEqual({ mag: getWeapon(PISTOL).magazine });
      expect(s.w().reserve).toBe(Math.min(getWeapon(PISTOL).reserveMax, getWeapon(PISTOL).pickupAmmo));
      expect(s.pub().dw).toBe(1);
      s.match.destroy();
      // Off (AKIMBO_READY false, as players had it until step 4): ammunition only, no second gun, nothing new sent.
      setAkimboReady(false);
      s = solo(PISTOL, { pair: false, map: map() });
      s.w().reserve = 0;
      ev = s.tick();
      expect(ev.some((e) => e.e === 'pickup' && e.s === s.a.slot && e.item === item)).toBe(true);
      expect(s.w().off).toBeUndefined();
      expect(s.w().reserve).toBe(Math.min(getWeapon(PISTOL).reserveMax, getWeapon(PISTOL).pickupAmmo));
      expect(s.pub().dw).toBeUndefined();
      expect(s.me().ow).toBeUndefined();
      s.match.destroy();
      // Off, with a full reserve: nothing to take, so it stays for someone else.
      s = solo(PISTOL, { pair: false, map: map() });
      ev = s.tick();
      expect(ev.some((e) => e.e === 'pickup' && e.item === item)).toBe(false);
      expect(s.w().off).toBeUndefined();
      s.match.destroy();
      setAkimboReady(true);
    });

    it('not with the rule off, not while dual wielding is off, not for a bot, not with a gun that can\'t be paired', () => {
      const item = getItem('core.weapon_machine_pistol')!;
      // The rule (MatchRules.akimbo: false): a second gun is ammunition, as today.
      let s = solo(MP, { pair: false, rules: { ...rules, akimbo: false } });
      s.w().reserve = 0;
      expect(inner(s.match).applyItem(s.a, item)).toBe(true);
      expect(s.w().off).toBeUndefined();
      expect(s.w().reserve).toBe(48);
      expect(s.me().ow).toBeUndefined();
      s.match.destroy();
      // Dual wielding off (the default): the same, whatever the rule says; and with a full reserve nothing is taken.
      setAkimboReady(false);
      s = solo(MP, { pair: false });
      expect(inner(s.match).applyItem(s.a, item)).toBe(false);
      expect(s.w().off).toBeUndefined();
      s.match.destroy();
      setAkimboReady(true);
      // A match can be told either way whatever the process says (the client's ?akimbo=1).
      s = solo(MP, { pair: false, akimbo: false });
      expect(inner(s.match).applyItem(s.a, item)).toBe(false);
      s.match.destroy();
      setAkimboReady(false);
      s = solo(MP, { pair: false, akimbo: true });
      expect(inner(s.match).applyItem(s.a, item)).toBe(true);
      expect(s.w().off).toEqual({ mag: 24 });
      s.match.destroy();
      setAkimboReady(true);
      // A bot never pairs.
      s = solo(MP, { pair: false });
      const bot = s.match.addBot('B', CORE_BOT_PROFILES[0]!, BOT_DIFFICULTIES.normal)!;
      give(bot, MP, 24, 0);
      expect(inner(s.match).applyItem(bot, item)).toBe(true);
      expect(bot.weapons.get(code(MP))!.off).toBeUndefined();
      // A gun that isn't eligible: ammunition.
      give(s.a, 'core.revolver', 6, 0);
      expect(inner(s.match).applyItem(s.a, getItem('core.weapon_revolver')!)).toBe(true);
      expect(s.a.weapons.get(code('core.revolver'))!.off).toBeUndefined();
      s.match.destroy();
    });

    it('a loadout never grants a pair: a life starts with one of each gun', () => {
      const fresh = new Match(deck(), rules, 3);
      const b = fresh.addHuman('B')!;
      for (let i = 0; i < 5; i++) fresh.step();
      expect(b.weapons.size).toBeGreaterThan(0);
      expect([...b.weapons.values()].some((x) => x.off)).toBe(false);
      expect(fresh.playerSnapshots()[0]!.dw).toBeUndefined();
      fresh.destroy();
    });
  });

  describe('two triggers', () => {
    it('the first trigger fires the gun you held, the second trigger the second gun: own magazines, own cooldowns, the same tick', () => {
      const { match, a, w, tick, shots } = solo(PISTOL);
      const both = shots(tick({ buttons: BUTTON_FIRE | BUTTON_ALT }));
      expect(both).toHaveLength(2);
      expect(both.map((e) => e.off)).toEqual([undefined, 1]);
      expect(both.every((e) => e.w === PISTOL && !e.alt)).toBe(true);
      expect([w().mag, w().off!.mag]).toEqual([11, 11]);
      const interval = getWeapon(PISTOL).fireIntervalTicks;
      expect([a.fireCooldown, a.fireCooldown2]).toEqual([interval, interval]);
      match.destroy();
    });

    it('each gun keeps its own rhythm: the second alone, then the first alone, never quicker than the gun\'s interval', () => {
      const { match, w, tick, shots } = solo(PISTOL);
      const interval = getWeapon(PISTOL).fireIntervalTicks;
      const fired: [number, boolean][] = [];
      for (let t = 0; t < 40; t++) {
        // The second trigger clicked every other tick throughout; the first from tick 5.
        const b = (t % 2 === 0 ? BUTTON_ALT : 0) | (t >= 5 && t % 2 === 1 ? BUTTON_FIRE : 0);
        for (const e of shots(tick({ buttons: b }))) fired.push([t, !!e.off]);
      }
      const second = fired.filter((f) => f[1]).map((f) => f[0]);
      const first = fired.filter((f) => !f[1]).map((f) => f[0]);
      expect(second[0]).toBe(0);
      expect(first[0]).toBe(5);
      for (const list of [first, second]) for (let i = 1; i < list.length; i++) expect(list[i]! - list[i - 1]!).toBeGreaterThanOrEqual(interval);
      expect(w().mag).toBe(12 - first.length);
      expect(w().off!.mag).toBe(12 - second.length);
      expect(first.length).toBeGreaterThan(2);
      expect(second.length).toBeGreaterThan(2);
      match.destroy();
    });

    it('a semi-automatic\'s latch is per gun: holding both fires one round each; letting one go and pulling it again fires that gun only', () => {
      const { match, w, tick, shots } = solo(PISTOL);
      let n = 0;
      for (let t = 0; t < 30; t++) n += shots(tick({ buttons: BUTTON_FIRE | BUTTON_ALT })).length;
      expect(n).toBe(2);
      // The second trigger let go for a tick (the first still held), then pulled again.
      expect(shots(tick({ buttons: BUTTON_FIRE }))).toHaveLength(0);
      const again = shots(tick({ buttons: BUTTON_FIRE | BUTTON_ALT }));
      expect(again.map((e) => e.off)).toEqual([1]);
      expect([w().mag, w().off!.mag]).toEqual([11, 10]);
      match.destroy();
    });

    it('an automatic pair fires both guns for as long as both triggers are held', () => {
      const { match, w, tick, shots } = solo(MP);
      let first = 0;
      let second = 0;
      for (let t = 0; t < 30; t++) for (const e of shots(tick({ buttons: BUTTON_FIRE | BUTTON_ALT }))) e.off ? second++ : first++;
      expect([first, second]).toEqual([10, 10]);
      expect([w().mag, w().off!.mag]).toEqual([14, 14]);
      match.destroy();
    });

    it('with one gun in hand the second trigger does nothing, as before', () => {
      const { match, w, tick, shots } = solo(PISTOL, { pair: false });
      expect(shots(tick({ buttons: BUTTON_ALT }))).toHaveLength(0);
      expect(w().mag).toBe(12);
      match.destroy();
    });
  });

  describe('the trade', () => {
    it('kick: every round of a pair kicks the one aim by the gun\'s kick x the pair\'s, and both guns feed one spray', () => {
      for (const id of [PISTOL, MP, SAWED, PULSE]) {
        const def = getWeapon(id);
        const k = gunplayOf(def).kick!;
        const one = solo(id, { pair: false });
        one.tick({ buttons: BUTTON_FIRE });
        const pair = solo(id);
        pair.tick({ buttons: BUTTON_FIRE });
        expect(one.a.gun.rp, id).toBeCloseTo(k.pitch[0]!, 12);
        expect(pair.a.gun.rp, id).toBeCloseTo(k.pitch[0]! * akimboOf(def)!.kick, 12);
        expect(pair.a.gun.rp).toBeGreaterThan(one.a.gun.rp);
        // Both at once: two rounds into the one pattern.
        const both = solo(id);
        both.tick({ buttons: BUTTON_FIRE | BUTTON_ALT });
        expect([both.a.gun.shots, both.a.gun.spray]).toEqual([2, 2]);
        for (const s of [one, pair, both]) s.match.destroy();
      }
      // The scaled kick keeps the gun's own settling.
      const k = gunplayOf(getWeapon(PISTOL)).kick!;
      const scaled = akimboKick(k, 1.2)!;
      expect([scaled.delay, scaled.settle, scaled.rate]).toEqual([k.delay, k.settle, k.rate]);
      expect(scaled.pitch).toEqual(k.pitch.map((v) => v * 1.2));
      expect(akimboKick(k, 1.2)).toBe(scaled);
      expect(akimboKick(k, 1)).toBe(k);
    });

    /** The widest angle (rad) between the aim and where `n` first rounds (or pellets) went. */
    function widest(id: string, pair: boolean, n: number): number {
      const s = solo(id, { pair });
      const aim = lookAngles(eye(s.a.move.pos), { x: 40, y: 1.25, z: 0 });
      const dir = { x: Math.cos(aim.pitch) * Math.sin(aim.yaw), y: Math.sin(aim.pitch), z: Math.cos(aim.pitch) * Math.cos(aim.yaw) };
      let max = 0;
      for (let i = 0; i < n; i++) {
        s.w().mag = getWeapon(id).magazine;
        s.a.fireCooldown = 0;
        s.a.semiLatch = false;
        s.a.bloom = 0;
        s.a.gun = newGunState();
        for (const e of s.shots(s.tick({ buttons: BUTTON_FIRE }))) {
          for (const to of e.to) {
            const d = { x: to[0] - e.from[0], y: to[1] - e.from[1], z: to[2] - e.from[2] };
            const len = Math.hypot(d.x, d.y, d.z);
            const cos = (d.x * dir.x + d.y * dir.y + d.z * dir.z) / len;
            max = Math.max(max, Math.acos(Math.min(1, cos)));
          }
        }
        s.tick();
      }
      s.match.destroy();
      return max;
    }

    it('cone and pattern: a pair\'s rounds spread wider by the pair\'s numbers (measured from the rounds themselves)', () => {
      // The Sawed-Off: its pellet pattern x 1.15 (its aim cone x 1). 14 pellets a blast.
      const sawed = getWeapon(SAWED);
      const one = widest(SAWED, false, 60);
      const two = widest(SAWED, true, 60);
      expect(two).toBeGreaterThan(one * 1.05);
      expect(two / one).toBeLessThan(1.3);
      expect(sawed.pellets).toBeGreaterThan(1);
      // The Pulse Pistol (no family: the legacy cone): x 1.5.
      const p1 = widest(PULSE, false, 150);
      const p2 = widest(PULSE, true, 150);
      expect(p2 / p1).toBeGreaterThan(1.25);
      expect(p2 / p1).toBeLessThan(1.75);
      // The numbers themselves: the aim cone x cone, the pattern x pattern.
      expect(akimboCone(akimboOf(getWeapon(PISTOL))!, 0.002, 0)).toBeCloseTo(0.003, 12);
      expect(akimboCone(akimboOf(getWeapon(MP))!, 0.01, 0)).toBeCloseTo(0.016, 12);
      expect(akimboCone(akimboOf(sawed)!, 0.01, sawed.spread)).toBeCloseTo(0.01 + sawed.spread * 1.15, 12);
    });

    it('reload: a pair\'s reloads take the pair\'s `reload` times as long, the stages at the same shares', () => {
      const def = getWeapon(PISTOL);
      const r = gunplayOf(def).reload;
      const l = gunplayOf(akimboLoader(def)).reload;
      expect(r).toMatchObject({ type: 'magazine', tactical: 50, empty: 66 });
      expect(l).toMatchObject({ type: 'magazine', tactical: 68, empty: 89, out: (r as { out: number }).out, in: (r as { in: number }).in });
      expect(akimboLoader(def)).toBe(akimboLoader(def));
      expect(akimboLoader(getWeapon('core.revolver'))).toBe(getWeapon('core.revolver'));
      // In a match: the same tactical reload, one gun and a pair.
      const one = solo(PISTOL, { pair: false });
      one.w().mag = 5;
      one.tick({ buttons: BUTTON_RELOAD });
      expect(one.a.reload!.total).toBe(50);
      const pair = solo(PISTOL);
      pair.w().mag = 5;
      pair.tick({ buttons: BUTTON_RELOAD });
      expect(pair.a.reload!.total).toBe(68);
      one.match.destroy();
      pair.match.destroy();
      // The Sawed-Off, shell by shell: every step x 1.5.
      const s = gunplayOf(getWeapon(SAWED)).reload;
      const sl = gunplayOf(akimboLoader(getWeapon(SAWED))).reload;
      if (s.type === 'shell' && sl.type === 'shell') expect([sl.start, sl.each, sl.end]).toEqual([s.start, s.each, s.end].map((t) => Math.round(t * 1.5)));
      else expect(sl).toMatchObject({ tactical: Math.round((s as { tactical: number }).tactical * 1.5) });
    });

    it('raise: switching to a pair takes the pair\'s `raise` times as long; to one gun, as before', () => {
      const def = getWeapon(PISTOL);
      const { match, a, tick } = solo(PISTOL);
      const knife = [...a.weapons.keys()].find((c) => c !== code(PISTOL))!;
      tick({ weapon: knife });
      tick({ weapon: code(PISTOL) });
      // (The tick that switched also counted one down.)
      expect(a.raiseTicks).toBe(Math.round(def.raiseTicks * 1.25) - 1);
      expect(Math.round(def.raiseTicks * 1.25)).toBe(11);
      // Put away (the fire-mode key): one gun's raise.
      tick({ weapon: knife });
      tick({ weapon: code(PISTOL), fireMode: 1 });
      tick({ weapon: knife, fireMode: 1 });
      tick({ weapon: code(PISTOL), fireMode: 1 });
      expect(a.raiseTicks).toBe(def.raiseTicks - 1);
      match.destroy();
    });

    it('move: a pair\'s `move` is added to the gun\'s running speed (none of today\'s four has one; shown with a family that does)', () => {
      const def = getWeapon(MP);
      const spec = akimboOf(def)!;
      const walk = (pair: boolean) => {
        const s = solo(MP, { pair });
        for (let t = 0; t < 90; t++) s.tick({ forward: 1 });
        const x = Math.hypot(s.a.move.pos.x, s.a.move.pos.z);
        s.match.destroy();
        return x;
      };
      expect(spec.move).toBe(0);
      const same = walk(true);
      expect(same).toBeCloseTo(walk(false), 9);
      // As the SMG family's trade would have it.
      spec.move = -0.03;
      try {
        const slower = walk(true);
        // (3 % off the running speed; the start of the walk is the same.)
        expect(slower / same).toBeGreaterThan(0.96);
        expect(slower / same).toBeLessThan(0.995);
        expect(walk(false)).toBeCloseTo(same, 9);
      } finally {
        spec.move = 0;
      }
    });
  });

  describe('no aiming while paired', () => {
    it('the aim button brings no sights up, slows nobody, and sets no scoped bit; with one gun it does all of that again', () => {
      for (const id of [PISTOL, MP, SAWED, PULSE]) {
        const pair = solo(id);
        for (let t = 0; t < 30; t++) {
          pair.tick({ buttons: BUTTON_ZOOM, forward: 1 });
          expect(pair.a.gun.ads, id).toBe(0);
          expect(pair.pub().zm).toBeUndefined();
        }
        const free = solo(id);
        for (let t = 0; t < 30; t++) free.tick({ forward: 1 });
        // As fast as without the button (aiming walks at 75 %).
        expect(pair.a.move.pos.x).toBeCloseTo(free.a.move.pos.x, 9);
        const one = solo(id, { pair: false });
        for (let t = 0; t < 30; t++) one.tick({ buttons: BUTTON_ZOOM, forward: 1 });
        expect(one.a.gun.ads).toBe(1);
        expect(Math.hypot(one.a.move.pos.x, one.a.move.pos.z)).toBeLessThan(Math.hypot(free.a.move.pos.x, free.a.move.pos.z) * 0.9);
        // None of the eligible guns is magnified: no scoped bit either way.
        expect(one.pub().zm).toBeUndefined();
        for (const s of [pair, free, one]) s.match.destroy();
      }
    });

    it('the second trigger ends a sprint as the first does', () => {
      const { match, a, tick, shots } = solo(PISTOL);
      for (let t = 0; t < 40; t++) tick({ forward: 1, buttons: BUTTON_SPRINT });
      expect(a.move.sprint).toBe(true);
      const ev = tick({ forward: 1, buttons: BUTTON_SPRINT | BUTTON_ALT });
      expect(a.move.sprint).toBeFalsy();
      // Out of the sprint the pair comes up first (the sprint-exit time), then the held pull fires.
      expect(shots(ev)).toHaveLength(0);
      let fired = 0;
      for (let t = 0; t < 10; t++) fired += shots(tick({ forward: 1, buttons: BUTTON_SPRINT | BUTTON_ALT })).filter((e) => e.off).length;
      expect(fired).toBe(1);
      match.destroy();
    });
  });

  describe('one gun again', () => {
    it('the fire-mode key (the input\'s fire mode 1) puts the second gun away: sights again, its magazine kept; and brings it back', () => {
      const { match, a, w, tick, shots, pub, me } = solo(PISTOL);
      w().off!.mag = 4;
      expect(pub().dw).toBe(1);
      tick({ fireMode: 1 });
      expect(w().off).toEqual({ mag: 4, away: true });
      expect(pub().dw).toBeUndefined();
      expect(me().ow).toEqual([[code(PISTOL), 4, 2]]);
      // The second trigger is no trigger now, the aim button aims, and the first gun is today's pistol.
      expect(shots(tick({ buttons: BUTTON_ALT, fireMode: 1 }))).toHaveLength(0);
      for (let t = 0; t < 14; t++) tick({ buttons: BUTTON_ZOOM, fireMode: 1 });
      expect(a.gun.ads).toBe(1);
      tick({ fireMode: 1 });
      const before = a.gun.rp;
      expect(shots(tick({ buttons: BUTTON_FIRE, fireMode: 1 })).map((e) => e.off)).toEqual([undefined]);
      expect(a.gun.rp - before).toBeCloseTo(gunplayOf(getWeapon(PISTOL)).kick!.pitch[0]!, 9);
      // An input without a fire mode (a bot's, an older client's) changes nothing.
      tick();
      expect(w().off!.away).toBe(true);
      // Back out: the second gun takes its raise, the sights are down at once.
      for (let t = 0; t < 14; t++) tick({ buttons: BUTTON_ZOOM, fireMode: 1 });
      tick({ buttons: BUTTON_ZOOM, fireMode: 0 });
      expect(w().off).toEqual({ mag: 4 });
      expect(a.gun.ads).toBe(0);
      expect(pub().dw).toBe(1);
      // (11 ticks, the pistol's raise x 1.25; the tick that brought it out counted the first.)
      expect(a.fireCooldown2).toBe(10);
      let at = -1;
      for (let t = 0; t < 14 && at < 0; t++) if (shots(tick({ buttons: BUTTON_ALT, fireMode: 0 })).length) at = t;
      expect(at).toBe(9);
      expect(w().off!.mag).toBe(3);
      match.destroy();
    });

    it('putting it away or bringing it out beats a reload, like a swap', () => {
      const { match, a, w, tick } = solo(PISTOL);
      w().mag = 3;
      w().off!.mag = 2;
      tick({ buttons: BUTTON_RELOAD, fireMode: 0 });
      expect(a.reload && a.reload2).toBeTruthy();
      tick({ fireMode: 1 });
      expect([a.reload, a.reload2, a.reloadTicks, a.reloadTicks2]).toEqual([null, null, 0, 0]);
      match.destroy();
    });
  });

  describe('reloads', () => {
    it('R reloads the emptier gun first, then the other; each a full reload at the pair\'s pace, from the one reserve', () => {
      const { match, a, w, tick, me } = solo(PISTOL);
      w().mag = 5;
      w().off!.mag = 2;
      w().reserve = 40;
      tick({ buttons: BUTTON_RELOAD });
      // Both are asked for; the second gun (emptier) goes first, the first waits at its start.
      expect(a.reload2!.t).toBe(0);
      tick();
      expect([a.reload!.t, a.reload2!.t]).toEqual([0, 1]);
      expect(me().rd2).toEqual([0, 1, 68, 0]);
      expect(me().rd).toEqual([0, 0, 68, 0]);
      expect(me().rl2).toBe(67);
      let ticks = 1;
      while (a.reload2 && ticks < 200) tick(), ticks++;
      expect(ticks).toBe(68);
      expect(w().off!.mag).toBe(12);
      // A tactical reload keeps one in the chamber: 2 back, 11 + 1... the magazine's rounds went back to the reserve.
      expect(w().reserve).toBe(40 - 10);
      expect(a.reload!.t).toBe(0);
      // Then the first gun's, from its start.
      let more = 0;
      while (a.reload && more < 200) tick(), more++;
      expect(more).toBe(68);
      expect([w().mag, w().off!.mag, w().reserve]).toEqual([12, 12, 40 - 10 - 7]);
      expect(me().rd2).toBeUndefined();
      expect(me().rl2).toBeUndefined();
      match.destroy();
    });

    it('with equal magazines the gun you held goes first; the turn is one rule (pairReloadTurn)', () => {
      const { match, a, w, tick } = solo(PISTOL);
      w().mag = 4;
      w().off!.mag = 4;
      tick({ buttons: BUTTON_RELOAD });
      tick();
      tick();
      expect([a.reload!.t, a.reload2!.t]).toEqual([2, 0]);
      match.destroy();
      const run = (t: number) => ({ kind: 'tactical' as const, t, total: 68, stage: 0 });
      expect(pairReloadTurn(null, run(0), 5, 5)).toBe(2);
      expect(pairReloadTurn(run(0), run(0), 5, 5)).toBe(1);
      expect(pairReloadTurn(run(0), run(0), 5, 4)).toBe(2);
      expect(pairReloadTurn(run(3), run(0), 5, 0)).toBe(1);
      expect(pairReloadTurn(run(0), run(3), 0, 5)).toBe(2);
    });

    it('the gun that is not being reloaded still fires (and gives up its turn); the one reloading goes on', () => {
      const { match, a, w, tick, shots } = solo(PISTOL);
      w().mag = 5;
      w().off!.mag = 0;
      tick({ buttons: BUTTON_RELOAD });
      for (let t = 0; t < 5; t++) tick();
      expect(a.reload2!.t).toBeGreaterThan(0);
      expect(a.reload!.t).toBe(0);
      // The first gun fires through the second's reload.
      const ev = shots(tick({ buttons: BUTTON_FIRE }));
      expect(ev.map((e) => e.off)).toEqual([undefined]);
      expect(w().mag).toBe(4);
      expect(a.reload).toBeNull();
      expect(a.reload2).not.toBeNull();
      // The second trigger can't: its gun is empty and in the middle of its reload.
      expect(shots(tick({ buttons: BUTTON_ALT }))).toHaveLength(0);
      let n = 0;
      while (a.reload2 && n < 200) tick(), n++;
      expect(w().off!.mag).toBe(12);
      // Nothing left waiting: the first gun gave up its turn by firing.
      expect(a.reload).toBeNull();
      expect(w().mag).toBe(4);
      match.destroy();
    });

    it('firing the gun that is reloading interrupts it when it has a round ready, as with one gun; the other\'s wait then starts', () => {
      const { match, a, w, tick, shots } = solo(PISTOL);
      w().mag = 9;
      w().off!.mag = 6;
      tick({ buttons: BUTTON_RELOAD });
      tick();
      expect(a.reload2!.t).toBe(1);
      // Its magazine is still in: a round is ready.
      expect(shots(tick({ buttons: BUTTON_ALT })).map((e) => e.off)).toEqual([1]);
      expect(a.reload2).toBeNull();
      expect(w().off!.mag).toBe(5);
      tick();
      expect(a.reload!.t).toBeGreaterThan(0);
      match.destroy();
    });

    it('auto-reload is per gun: the second gun run dry reloads by itself while the first goes on firing', () => {
      const { match, a, w, tick, shots } = solo(MP);
      w().off!.mag = 2;
      let first = 0;
      let started = -1;
      for (let t = 0; t < 40; t++) {
        first += shots(tick({ buttons: BUTTON_FIRE | BUTTON_ALT | BUTTON_AUTO_RELOAD })).filter((e) => !e.off).length;
        if (started < 0 && a.reload2) started = t;
      }
      expect(started).toBeGreaterThan(0);
      expect(started).toBeLessThan(12);
      expect(a.reload).toBeNull();
      expect(first).toBeGreaterThanOrEqual(13);
      match.destroy();
    });

    it('an empty trigger pull starts that gun\'s reload only; an empty reload chambers before it can fire', () => {
      const { match, a, w, tick, shots, me } = solo(PISTOL);
      w().off!.mag = 0;
      expect(shots(tick({ buttons: BUTTON_ALT }))).toHaveLength(0);
      expect(a.reload2!.kind).toBe('empty');
      expect(a.reload2!.total).toBe(89);
      expect(a.reload).toBeNull();
      let unchambered = 0;
      for (let t = 0; t < 120 && a.reload2; t++) {
        // (The trigger pulled every other tick throughout.)
        const was = !!w().off!.unchambered;
        const ev = shots(tick({ buttons: t % 2 ? BUTTON_ALT : 0 }));
        if (was && w().off!.unchambered) {
          unchambered++;
          expect(me().ow).toEqual([[code(PISTOL), 12, 1]]);
          // Not while it still has to chamber.
          expect(ev).toHaveLength(0);
        }
      }
      expect(unchambered).toBeGreaterThan(3);
      expect(w().off).toEqual({ mag: 12 });
      match.destroy();
    });

    it('the Sawed-Off\'s shells go in gun by gun in the same order, each usable as it goes in', () => {
      const { match, a, w, tick } = solo(SAWED);
      w().mag = 1;
      w().off!.mag = 0;
      w().reserve = 10;
      tick({ buttons: BUTTON_RELOAD });
      let n = 0;
      while ((a.reload || a.reload2) && n < 400) {
        tick();
        n++;
        // The first gun's does not start before the second's is done.
        if (a.reload2) expect(a.reload?.t ?? 0).toBe(0);
      }
      expect([w().mag, w().off!.mag, w().reserve]).toEqual([2, 2, 7]);
      match.destroy();
    });

    it('a reserve that only fills one: the emptier gun gets it, and the other\'s reload does not start', () => {
      const { match, a, w, tick } = solo(PISTOL);
      w().mag = 0;
      w().off!.mag = 0;
      w().reserve = 5;
      tick({ buttons: BUTTON_RELOAD });
      let n = 0;
      while ((a.reload || a.reload2) && n < 400) tick(), n++;
      expect([w().mag, w().off!.mag, w().reserve]).toEqual([5, 0, 0]);
      expect(n).toBeLessThan(100);
      match.destroy();
    });
  });

  describe('switching, drops and death', () => {
    it('switching away cancels both reloads and keeps the pair for when you switch back', () => {
      const { match, a, w, tick, pub, me } = solo(PISTOL);
      w().mag = 3;
      w().off!.mag = 2;
      tick({ buttons: BUTTON_RELOAD });
      tick();
      const knife = [...a.weapons.keys()].find((c) => c !== code(PISTOL))!;
      tick({ weapon: knife });
      expect([a.reload, a.reload2, a.reloadTicks, a.reloadTicks2]).toEqual([null, null, 0, 0]);
      // Not drawn while the knife is out; still yours.
      expect(pub().dw).toBeUndefined();
      expect(me().ow).toEqual([[code(PISTOL), 2]]);
      tick({ weapon: code(PISTOL) });
      expect(pub().dw).toBe(1);
      expect(w().off).toEqual({ mag: 2 });
      match.destroy();
    });

    it('taking a drop of a gun you hold makes a pair: its magazine is the second gun\'s, its reserve tops yours up, and it is gone', () => {
      const { match, a, w, tick } = solo(MP, { pair: false });
      w().reserve = 100;
      const victim = match.addHuman('V')!;
      victim.move = { pos: { x: 12, y: 0, z: 0 }, velY: 0, grounded: true };
      give(victim, MP, 17, 60);
      inner(match).kill(victim, null, 'core.rifle');
      expect(match.drops).toHaveLength(1);
      a.move = { pos: { ...match.drops[0]!.pos }, velY: 0, grounded: true };
      const ev = tick();
      expect(ev.some((e) => e.e === 'pickup' && e.s === a.slot && e.item === 'core.weapon_machine_pistol')).toBe(true);
      expect(w().off).toEqual({ mag: 17 });
      expect(w().reserve).toBe(144);
      expect(match.drops).toHaveLength(0);
      match.destroy();
    });

    it('a death drop is one gun with the first gun\'s magazine; a new life has no pair', () => {
      const { match, a, w } = solo(MP);
      w().mag = 9;
      w().off!.mag = 21;
      w().reserve = 50;
      inner(match).kill(a, null, 'core.rifle');
      expect(match.drops).toHaveLength(1);
      const d = match.drops[0]!;
      expect([d.def.id, d.mag, d.reserve]).toEqual([MP, 9, 50]);
      expect(match.playerSnapshots().find((p) => p.s === a.slot)!.dw).toBeUndefined();
      match.destroy();
      // A respawn deals the loadout afresh.
      const m2 = new Match(deck(), { ...rules, respawnDelayTicks: 5 }, 3);
      const b = m2.addHuman('B')!;
      for (let i = 0; i < 3; i++) m2.step();
      inner(m2).makePair(b, b.weapons.get(code(PISTOL))!, 12);
      expect(b.weapons.get(code(PISTOL))!.off).toBeDefined();
      b.reload2 = { kind: 'tactical', t: 3, total: 68, stage: 0 };
      b.reloadTicks2 = 65;
      b.fireCooldown2 = 4;
      b.semiLatch2 = true;
      inner(m2).kill(b, null, 'core.rifle');
      for (let i = 0; i < 30 && !b.alive; i++) m2.step();
      expect(b.alive).toBe(true);
      expect([...b.weapons.values()].some((x) => x.off)).toBe(false);
      expect([b.reload2, b.reloadTicks2, b.fireCooldown2, b.semiLatch2]).toEqual([null, 0, 0, false]);
      expect(m2.privateState(b.slot)!.ow).toBeUndefined();
      m2.destroy();
    });
  });

  describe('the snapshot', () => {
    it('public dw while the pair is drawn; private ow, rl2, rd2; a shot from the second gun says off: only optional fields', () => {
      const { match, a, w, tick, shots, pub, me } = solo(PISTOL, { pair: false });
      expect(pub().dw).toBeUndefined();
      expect(Object.keys(me()).filter((k) => ['ow', 'rl2', 'rd2'].includes(k))).toEqual([]);
      inner(match).makePair(a, w(), 12);
      a.fireCooldown2 = 0;
      expect(pub().dw).toBe(1);
      expect(me().ow).toEqual([[code(PISTOL), 12]]);
      const ev = shots(tick({ buttons: BUTTON_ALT }));
      expect(ev).toHaveLength(1);
      expect(ev[0]!.off).toBe(1);
      expect(ev[0]!.alt).toBeUndefined();
      expect(shots(tick({ buttons: BUTTON_FIRE }))[0]!.off).toBeUndefined();
      expect(me().ow).toEqual([[code(PISTOL), 11]]);
      // Dead: not drawn.
      w().off!.mag = 3;
      a.alive = false;
      expect(pub().dw).toBeUndefined();
      a.alive = true;
      expect(PROTOCOL_VERSION).toBe(5);
      // (Version 3 since slide and peek added a slide bit and a lean byte, 4 since the dodge's two bytes; dual wielding itself changed no layout.)
      expect(SNAPSHOT_BINARY_VERSION).toBe(4);
      match.destroy();
    });

    it('dw goes through the delta snapshots and back out (set, kept, cleared), and through the binary snapshot as bit 64', () => {
      const { match, a, tick } = solo(PISTOL);
      const other = match.addHuman('B')!;
      other.move = { pos: { x: 6, y: 0, z: 3 }, velY: 0, grounded: true };
      const stream = new SnapshotStream();
      const decoder = new SnapshotDecoder();
      const enc = new SnapshotBinaryEncoder();
      const dec = new SnapshotBinaryDecoder();
      let k = 0;
      const send = (i: Partial<PlayerInput> = {}) => {
        match.queueInputs(other.slot, [{ seq: k + 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
        const ev = tick(i);
        const body = match.snapshot(ev);
        const [text] = encodeSnapshots(body, [{ slot: other.slot, ack: k++, stream }]);
        const wire = (JSON.parse(text!) as { players: Record<string, unknown>[] }).players.find((p) => p.s === a.slot)!;
        const got = decoder.snapshot(JSON.parse(text!) as Extract<ServerMessage, { t: 'snapshot' }>).players.find((p) => p.s === a.slot)!;
        // The local match's binary message carries the same entry.
        const msg = { t: 'snapshot' as const, ack: k, ...body };
        const buf = enc.encode(msg);
        expect(buf).not.toBeNull();
        const back = dec.decode(buf!);
        expect(back?.players.find((p) => p.s === a.slot)!.dw).toBe(body.players.find((p) => p.s === a.slot)!.dw);
        return { wire, got };
      };
      let r = send();
      expect(r.got.dw).toBe(1);
      r = send();
      expect('dw' in r.wire).toBe(false);
      expect(r.got.dw).toBe(1);
      r = send({ fireMode: 1 });
      expect(r.wire.dw).toBeNull();
      expect('dw' in r.got).toBe(false);
      r = send({ fireMode: 1 });
      expect('dw' in r.wire).toBe(false);
      expect('dw' in r.got).toBe(false);
      r = send({ fireMode: 0 });
      expect(r.wire.dw).toBe(1);
      expect(r.got.dw).toBe(1);
      match.destroy();
    });
  });

  describe('determinism, and nothing while it is off', () => {
    /** Where two runs first differ (a line of each), or null when they are the same: a failure names the tick, not megabytes. */
    const firstDiff = (x: string, y: string): string | null => {
      if (x === y) return null;
      const a = x.split('\n');
      const b = y.split('\n');
      const i = a.findIndex((l, k) => l !== b[k]);
      return `line ${i}: ${(a[i] ?? '').slice(0, 300)} | ${(b[i] ?? '').slice(0, 300)}`;
    };
    const script = (t: number): Partial<PlayerInput> => ({
      forward: t % 90 < 60 ? 1 : 0,
      right: t % 50 < 10 ? 1 : 0,
      yaw: Math.PI / 2 + Math.sin(t / 40) * 0.6,
      pitch: Math.sin(t / 23) * 0.1,
      buttons: (t % 7 < 3 ? BUTTON_FIRE : 0) | (t % 5 < 2 ? BUTTON_ALT : 0) | (t % 130 === 100 ? BUTTON_RELOAD : 0) | (t % 61 > 50 ? BUTTON_ZOOM : 0) | BUTTON_AUTO_RELOAD | (t % 200 > 170 ? BUTTON_SPRINT : 0),
      fireMode: t % 300 > 250 ? 1 : 0,
    });
    /** A match of one person (a Machine Pistol in hand, a second one at their feet) and three bots on a deck, played by the script: everything it says, tick by tick. */
    function play(akimbo: boolean | undefined, ticks: number): string {
      const match = new Match(deck([{ item: 'core.weapon_machine_pistol', at: [0, 0, 0] }]), { ...rules, respawnDelayTicks: 120 }, 11, akimbo === undefined ? {} : { akimbo });
      const a = match.addHuman('A')!;
      give(a, MP);
      for (let i = 0; i < 3; i++) match.addBot(`B${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);
      const out: string[] = [];
      for (let t = 0; t < ticks; t++) {
        match.queueInputs(a.slot, [{ seq: t + 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, ...script(t) }]);
        const ev = match.step();
        out.push(JSON.stringify([match.snapshot(ev), match.privateState(a.slot)]));
      }
      match.destroy();
      return out.join('\n');
    }

    it('the same inputs give the same match, pairs and all', { timeout: 120_000 }, () => {
      const one = play(true, 900);
      expect(firstDiff(one, play(true, 900))).toBeNull();
      // (And the script did make and use a pair.)
      for (const key of ['"ow":[[', '"off":1', '"dw":1', '"rd2":[']) expect(one.includes(key), key).toBe(true);
    });

    it('with dual wielding off (the default) the same script leaves no trace of it: no pair, no field, the second trigger and fire mode do nothing', { timeout: 120_000 }, () => {
      setAkimboReady(false);
      try {
        const off = play(undefined, 900);
        for (const key of ['"ow"', '"rl2"', '"rd2"', '"off":1', '"dw":1']) expect(off.includes(key), key).toBe(false);
        // A match told to have it off reads the same, bit for bit.
        expect(firstDiff(play(false, 900), off)).toBeNull();
      } finally {
        setAkimboReady(true);
      }
    });

    it('a match in which nobody makes a pair is bit-identical with dual wielding on or off (bots never pair)', { timeout: 180_000 }, () => {
      const run = (akimbo: boolean) => {
        const match = new Match(loadArena(), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0 }, 5, { akimbo });
        for (let i = 0; i < 6; i++) match.addBot(`B${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);
        const out: string[] = [];
        for (let t = 0; t < 1500; t++) {
          const ev = match.step();
          if (t % 5 === 0) out.push(JSON.stringify(match.snapshot(ev)));
        }
        const end = JSON.stringify(match.slots.filter((c) => c).map((c) => [c!.move.pos, c!.health, c!.kills, c!.deaths, [...c!.weapons.entries()].map(([k, w]) => [k, w.mag, w.reserve, w.off])]));
        match.destroy();
        return out.join('\n') + end;
      };
      const off = run(false);
      expect(firstDiff(run(true), off)).toBeNull();
      expect(off.includes('"dw":1')).toBe(false);
    });
  });

  describe('time to kill, one gun and a pair', () => {
    /**
     * Seconds from the first round to the kill of a standing target `dist` m off (aimed at the chest, both triggers
     * pulled whenever their gun is ready; `control`: the share of the recoil pulled back each input, 1 an ideal
     * hand, 0 none), averaged over `runs` seeds; and the share of runs that killed inside 6 s.
     */
    function ttk(id: string, pair: boolean, dist: number, control: number, runs = 12): { s: number | null; kills: number } {
      let sum = 0;
      let kills = 0;
      for (let seed = 1; seed <= runs; seed++) {
        const match = new Match(deck(), rules, seed);
        const a = match.addHuman('A')!;
        const b = match.addHuman('B')!;
        a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
        b.move = { pos: { x: dist, y: 0, z: 0 }, velY: 0, grounded: true };
        give(a, id);
        if (pair) {
          inner(match).makePair(a, a.weapons.get(code(id))!, getWeapon(id).magazine);
          a.fireCooldown2 = 0;
        }
        const look = lookAngles(eye(a.move.pos), { x: dist, y: 1.25, z: 0 });
        const semi = getWeapon(id).fireMode === 'semi';
        let first: number | null = null;
        let kill: number | null = null;
        for (let t = 0; t < 360 && kill === null; t++) {
          // A perfect clicker: a semi-automatic's trigger is let go the tick before its gun is ready and down when it is.
          const b1 = !semi || a.fireCooldown === 0 ? BUTTON_FIRE : 0;
          const b2 = pair && (!semi || a.fireCooldown2 === 0) ? BUTTON_ALT : 0;
          const rc: [number, number] | undefined = control ? [a.gun.rp * control, a.gun.ry * control] : undefined;
          match.queueInputs(a.slot, [{ seq: t + 1, forward: 0, right: 0, buttons: b1 | b2 | BUTTON_AUTO_RELOAD, ...look, ...(rc ? { rc } : {}) }]);
          match.queueInputs(b.slot, [{ seq: t + 1, forward: 0, right: 0, buttons: 0, yaw: 0, pitch: 0 }]);
          const ev = match.step();
          if (first === null && ev.some((e) => e.e === 'shot' && e.s === a.slot)) first = t;
          if (!b.alive) kill = t;
        }
        if (kill !== null && first !== null) {
          sum += (kill - first) / 60;
          kills++;
        }
        match.destroy();
      }
      return { s: kills ? sum / kills : null, kills: kills / runs };
    }

    it('prints the tables (5, 15 and 30 m): a pair is quicker up close in a steady hand, never twice the gun, and no better without recoil control', { timeout: 300_000 }, () => {
      const cell = (r: { s: number | null; kills: number }) => (r.s === null ? '-' : `${r.s.toFixed(2)}${r.kills < 1 ? ` (${Math.round(r.kills * 100)}%)` : ''}`);
      const tables: Record<number, Record<string, { one: (number | null)[]; pair: (number | null)[] }>> = {};
      const lines: string[] = [];
      for (const control of [1, 0]) {
        lines.push('', `TTK, s (body, standing target, Standard, 12 runs; in brackets the share that killed inside 6 s) - ${control ? 'recoil fully controlled' : 'no recoil control'}`, '| Gun | 5 m one | 5 m pair | 15 m one | 15 m pair | 30 m one | 30 m pair |', '|---|---|---|---|---|---|---|');
        tables[control] = {};
        for (const id of [PISTOL, PULSE, MP, SAWED]) {
          const row = { one: [] as (number | null)[], pair: [] as (number | null)[] };
          const cells: string[] = [];
          for (const dist of [5, 15, 30]) {
            const one = ttk(id, false, dist, control);
            const two = ttk(id, true, dist, control);
            row.one.push(one.s);
            row.pair.push(two.s);
            cells.push(cell(one), cell(two));
          }
          tables[control]![id] = row;
          lines.push(`| ${getWeapon(id).displayName} | ${cells.join(' | ')} |`);
        }
      }
      console.log(`${lines.join('\n')}\n`);
      const steady = tables[1]!;
      // Up close, in a steady hand, a pair is volume: quicker than one gun (the Sawed-Off's one blast already kills).
      for (const id of [PISTOL, PULSE, MP]) expect(steady[id]!.pair[0]!, id).toBeLessThan(steady[id]!.one[0]!);
      expect(steady[SAWED]!.pair[0]!).toBeLessThanOrEqual(steady[SAWED]!.one[0]!);
      // Never better than two guns' worth (half the time, less a tick's rounding).
      for (const id of [PISTOL, PULSE, MP]) expect(steady[id]!.pair[0]!, id).toBeGreaterThan(steady[id]!.one[0]! * 0.45);
    });
  });
});
