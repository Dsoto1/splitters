import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUTTON_FIRE,
  BUTTON_RELOAD,
  BUTTON_ZOOM,
  CORE_WEAPONS,
  MAP_FORMAT_VERSION,
  MAX_ARMOR,
  PLAYER,
  TICK_RATE,
  bulletPhysics,
  createRng,
  falloffAt,
  flightTo,
  gunplayOf,
  initPhysics,
  lookAngles,
  roundsReady,
  weaponCode,
  type MapDocument,
  type PlayerInput,
  type Vec3,
  type WeaponDefinition,
} from '@tiletrigger/shared';
import { Match, initNavigation, type Combatant } from '@tiletrigger/shared/match';

/**
 * Gunplay measurement report (docs/GUNPLAY_AUDIT.md, "Method"): drives the real shared sim (Match: the same code the
 * server, client prediction and bots run) on a flat test deck, one shooter and one standard target, and measures every
 * gun of the arsenal. Nothing is worked out by hand from the weapon JSON: each number is what the sim did.
 *
 * Per weapon:
 * - TTK (first round leaving the barrel to the kill, flight time and reloads included) on a standard player (100
 *   health) unarmoured and with full armour (MAX_ARMOR, which takes its share of each hit), at each distance, body
 *   (the torso's middle) and head (the head sphere's middle), three ways:
 *   - `ideal`: every round where it is aimed (the gunplay cone switched off; a shotgun keeps its pellet pattern), the
 *     player tracking perfectly, countering all recoil and compensating drop: the damage model's TTK;
 *   - `hip` and `ads`: the real spread (standing still, hip or fully aimed), perfect tracking and recoil counter: the
 *     median of `--trials` seeds (a kill missing in more than half of them: none);
 * - shots to kill (the fewest rounds that kill with the trigger let go after them), the damage one round does at each distance, and the ideal body TTK swept 5-150 m;
 * - time to the first shot from idle (weapon up, trigger pressed), draw time (switch to it with the trigger held, until
 *   it fires) and the swap to the Pistol;
 * - reloads: tactical and empty (until full and ready), first round usable on an empty or shell reload, and how long a
 *   reload takes to give way to the trigger (a tactical reload's chambered round) and to a swap to the Pistol;
 * - recoil: the offset one round leaves and the time it takes to settle, and the same after a 10-round spray (no
 *   counter input);
 * - spread: the cone the sim gave the first round standing (hip, ADS), running and the 10th round of a hip spray;
 * - falloff: the sim's damage multiple and drop at each distance.
 *
 * Usage (from the repo root):
 *   pnpm gun-report                                  (every gun; prints the tables)
 *   pnpm gun-report --json=docs/gunplay-audit.json --svg=docs/gunplay-ttk.svg
 *   pnpm gun-report --weapons=core.pistol,core.smg --trials=12
 *   pnpm gun-report --from=docs/gunplay-audit.json --svg=docs/gunplay-ttk.svg   (redraw the chart from a run's JSON)
 * Options: --trials=N (default 6), --distances=10,25,50,100, --seconds=8 (the cap on one kill).
 */

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k!, v ?? 'true'] as const;
  }),
);
const TRIALS = Number(args.get('trials') ?? 6);
const DISTANCES = (args.get('distances') ?? '10,25,50,100').split(',').map(Number);
const SWEEP = [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 75, 100, 125, 150];
const CAP_TICKS = Math.round(Number(args.get('seconds') ?? 8) * TICK_RATE);
const MS = 1000 / TICK_RATE;

/** The guns: everything a player carries and fires (melee, tools, mode-only and mounted weapons left out). */
const ARSENAL: WeaponDefinition[] = Object.values(CORE_WEAPONS).filter((w) => w.category && w.category !== 'melee' && !w.heal && !w.grapple);
const chosen = args.get('weapons')?.split(',');
const WEAPONS = chosen ? ARSENAL.filter((w) => chosen.includes(w.id)) : ARSENAL;
const PISTOL = CORE_WEAPONS['core.pistol']!;

/** A flat 8 m-cell deck from x -16 to 176 m, 40 m wide: the target stands down +x. */
function deck(): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = -2; x < 22; x++) for (let y = -2; y <= 2; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 });
  return {
    format: 'tiletrigger.map',
    formatVersion: MAP_FORMAT_VERSION,
    metadata: { id: 'gun_lab', name: 'Gun lab', author: '', description: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', parentId: null, recommendedPlayers: { min: 1, max: 2 }, supportedModes: ['core.deathmatch'] },
    classicStructure: { cellSize: 8, levelHeight: 4, theme: 'core.prototype', tiles },
    entities: [{ id: 'spawn_0', kind: 'spawn', position: [0, 0, 0], yaw: 0, faction: null }],
    factions: [],
    logic: { variables: [], timers: [], objectives: [], rules: [] },
    terrain: null,
    bounds: null,
    teamSetup: null,
    backdrop: null,
    blood: null,
    physics: null,
    dependencies: [],
  };
}

/** The sim's private parts the lab drives or watches (the same objects the match runs on). */
interface MatchInside {
  tick: number;
  rng: () => number;
  bullets: unknown[];
  projectiles: unknown[];
  zones: unknown[];
  fire(shooter: Combatant, def: { id: string }, viewTick: number): void;
  spreadDir(dir: Vec3, spread: number): Vec3;
  spawn(c: Combatant): void;
}

type Aim = 'body' | 'head';
type Way = 'ideal' | 'hip' | 'ads';

/** One shooter, one target, one match per weapon; every trial respawns both. */
class Lab {
  readonly match: Match;
  readonly inside: MatchInside;
  readonly a: Combatant;
  readonly t: Combatant;
  private seq = 0;
  /** Ticks the shooter's rounds left on (one per trigger pull: a shotgun's pellets are one). */
  fired: number[] = [];
  /** The cone the sim gave each of the shooter's rounds (rad). */
  cones: number[] = [];
  /** Off: the gunplay cone is switched off (a multi-pellet weapon keeps its pattern). */
  exact = false;
  def: WeaponDefinition = PISTOL;
  /** Where the target is held (feet). */
  spot: Vec3 = { x: 10, y: 0, z: 0 };

  constructor() {
    this.match = new Match(deck(), { mode: 'core.deathmatch', scoreLimit: 0, timeLimitSeconds: 0, respawnDelayTicks: 1_000_000, startingWeapons: ['core.pistol'], startingGrenades: 0, intermissionTicks: 60, bodySizes: false, characterStats: false, friendlyFire: 'off' }, 1);
    this.inside = this.match as unknown as MatchInside;
    this.a = this.match.addHuman('shooter')!;
    this.t = this.match.addHuman('target')!;
    const fire = this.inside.fire.bind(this.match);
    this.inside.fire = (s, d, v) => {
      if (s === this.a) {
        // A burst's or a pellet weapon's one pull is one round here; the spread hook below sees each pellet.
        if (this.fired[this.fired.length - 1] !== this.inside.tick) this.fired.push(this.inside.tick);
      }
      fire(s, d, v);
    };
    const spreadDir = this.inside.spreadDir.bind(this.match);
    this.inside.spreadDir = (dir, spread) => {
      this.cones.push(spread);
      return spreadDir(dir, this.exact ? (this.def.pellets > 1 ? this.def.spread : 0) : spread);
    };
  }

  /** Both respawned, the shooter at the origin facing +x with `def` up, the target `dist` m away facing it. */
  reset(def: WeaponDefinition, dist: number, armour: boolean, seed: number, exact: boolean): void {
    for (const c of [this.a, this.t]) {
      this.inside.spawn(c);
      c.shieldUntil = 0;
    }
    this.inside.bullets.length = 0;
    this.inside.projectiles.length = 0;
    this.inside.zones.length = 0;
    this.inside.rng = createRng(seed);
    this.def = def;
    this.exact = exact;
    this.spot = { x: dist, y: 0, z: 0 };
    this.a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
    this.t.move = { pos: { ...this.spot }, velY: 0, grounded: true };
    this.a.yaw = Math.PI / 2;
    this.t.yaw = -Math.PI / 2;
    this.t.armor = armour ? MAX_ARMOR : 0;
    this.give(this.a, def);
    this.give(this.a, PISTOL, false);
    this.fired = [];
    this.cones = [];
    // Let the respawn settle (grounded, no pending fall).
    for (let i = 0; i < 3; i++) this.step({});
    this.fired = [];
    this.cones = [];
  }

  give(c: Combatant, def: WeaponDefinition, hold = true): void {
    c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: def.alt?.max ?? 0 });
    if (!hold) return;
    c.current = weaponCode(def);
    c.raiseTicks = 0;
    c.fireCooldown = 0;
    c.reload = null;
    c.reloadTicks = 0;
  }

  held(): { mag: number; reserve: number; heat?: number; overheated?: boolean; unchambered?: boolean } {
    return this.a.weapons.get(this.a.current)!;
  }

  /** One tick: the shooter's input, the target standing still facing the shooter, held to its spot. */
  step(i: Partial<PlayerInput>): void {
    const s = ++this.seq;
    this.match.queueInputs(this.a.slot, [{ seq: s, forward: 0, right: 0, yaw: this.a.yaw, pitch: this.a.pitch, buttons: 0, viewTick: this.inside.tick, ...i }]);
    if (this.t.alive) {
      this.t.move = { ...this.t.move, pos: { ...this.spot } };
      this.match.queueInputs(this.t.slot, [{ seq: s, forward: 0, right: 0, yaw: -Math.PI / 2, pitch: 0, buttons: 0 }]);
    }
    this.match.step();
  }

  /** Where to look to put a round on the target's body or head: the shape's middle, plus drop or a lob. */
  aimAt(aim: Aim, def: WeaponDefinition): { yaw: number; pitch: number } {
    const eye = { x: this.a.move.pos.x, y: this.a.move.pos.y + PLAYER.eyeHeight, z: this.a.move.pos.z };
    const to = point(this.t, aim);
    const look = lookAngles(eye, to);
    const dist = Math.hypot(to.x - eye.x, to.z - eye.z);
    const gp = gunplayOf(def);
    if (gp.ballistic) {
      // Hold over for the drop (what a skilled player does): the sim's own flight time and drop to that distance.
      const { drop } = flightTo(gp.ballistic, dist, this.match.rules);
      return { yaw: look.yaw, pitch: look.pitch + Math.atan2(drop, dist) };
    }
    const p = def.projectile;
    if (def.kind === 'projectile' && p && p.gravity > 0) {
      // Lob: the low launch angle that lands on the point (from half a metre out, where projectiles start).
      const v = p.speed;
      const g = p.gravity;
      const x = Math.max(0.1, dist - 0.5);
      const y = to.y - eye.y;
      const disc = v ** 4 - g * (g * x * x + 2 * y * v * v);
      const pitch = disc >= 0 ? Math.atan((v * v - Math.sqrt(disc)) / (g * x)) : Math.PI / 4;
      return { yaw: look.yaw, pitch };
    }
    return look;
  }

  /**
   * Fire at the target until it dies (or the cap): a perfect clicker on semi and burst triggers (released the tick
   * after each round), held on automatics; recoil countered in full every input; sights held for `ads`.
   * Returns ticks from the first round to the kill, the rounds fired and the first hit's damage.
   */
  kill(aim: Aim, way: Way, limit = Infinity): { ticks: number | null; rounds: number } {
    const def = this.def;
    const ads = way === 'ads';
    if (ads) for (let i = 0; i < 60; i++) this.step({ ...this.aimAt(aim, def), buttons: BUTTON_ZOOM });
    const zoom = ads ? BUTTON_ZOOM : 0;
    const clicker = (def.fireMode ?? 'auto') !== 'auto';
    const start = this.inside.tick;
    for (let n = 0; n < CAP_TICKS + 600; n++) {
      if (!this.t.alive) break;
      const justFired = this.fired.length > 0 && this.fired[this.fired.length - 1] === this.inside.tick;
      // After `limit` rounds the trigger stays released (rounds in flight, splash and burns still land).
      const release = (clicker && justFired) || this.fired.length >= limit;
      const g = this.a.gun;
      this.step({ ...this.aimAt(aim, def), buttons: (release ? 0 : BUTTON_FIRE) | zoom, rc: [Math.max(0, g.rp), g.ry] });
      if (this.fired.length && this.inside.tick - this.fired[0]! > CAP_TICKS) break;
      if (!this.fired.length && this.inside.tick - start > CAP_TICKS) break;
    }
    const t0 = this.fired[0];
    return { ticks: !this.t.alive && t0 !== undefined ? this.inside.tick - t0 : null, rounds: this.fired.length };
  }

  /**
   * The damage model's kill (`ideal`: the gunplay cone off): the time from the first round to the kill with the
   * trigger held, and the fewest rounds that kill with the trigger let go after them (rounds still in flight, splash
   * and burns counted). A multi-pellet weapon's
   * pattern is random, so it is the median over `trials` seeds. `one`: what a single round did (unarmoured: health
   * lost, at most the target's 100).
   */
  ideal(def: WeaponDefinition, dist: number, armour: boolean, aim: Aim, trials: number): { ticks: number | null; stk: number | null; one: number | null } {
    const runs: { ticks: number; stk: number }[] = [];
    let one: number | null = null;
    let misses = 0;
    for (let s = 1; s <= trials; s++) {
      // Hold the trigger until it dies: an upper bound (it counts rounds still in flight at the kill)...
      this.reset(def, dist, armour, s * 104729, true);
      const before = this.t.health;
      const hold = this.kill(aim, 'ideal');
      let found = hold.ticks !== null;
      if (found) {
        // ...then fewer rounds, released after them, while that still kills.
        // The kill's time is the held trigger's (a burn or a round in flight finishing it off can't beat it).
        let stk = hold.rounds;
        for (let n = hold.rounds - 1; n >= 1; n--) {
          this.reset(def, dist, armour, s * 104729, true);
          const k = this.kill(aim, 'ideal', n);
          if (k.ticks === null) break;
          // (A burst trigger finishes its burst: the rounds that actually left.)
          stk = k.rounds;
        }
        runs.push({ ticks: hold.ticks!, stk });
      }
      if (s === 1) {
        this.reset(def, dist, armour, s * 104729, true);
        this.kill(aim, 'ideal', 1);
        one = Math.round((before - Math.max(0, this.t.alive ? this.t.health : 0)) * 10) / 10;
      }
      if (!found) misses++;
    }
    if (misses * 2 > trials) return { ticks: null, stk: null, one };
    const pad = Array<number>(misses).fill(Infinity);
    return { ticks: finite(median([...runs.map((r) => r.ticks), ...pad])), stk: finite(median([...runs.map((r) => r.stk), ...pad])), one };
  }
}

/** The middle of the target's torso or head shape, in the world. */
function point(c: Combatant, aim: Aim): Vec3 {
  const box = c.hitbox.stand;
  const k = c.hitScale * c.size;
  let lx = 0;
  let ly = 1.1;
  let lz = 0;
  if (aim === 'head' && box.head) [lx, ly, lz] = [box.head.x, box.head.y, box.head.z];
  else if (box.torso) [lx, ly, lz] = [box.torso.x, (box.torso.a[0] + box.torso.b[0]) / 2, (box.torso.a[1] + box.torso.b[1]) / 2];
  const sin = Math.sin(c.yaw);
  const cos = Math.cos(c.yaw);
  return { x: c.move.pos.x + (lx * cos + lz * sin) * k, y: c.move.pos.y + ly * k, z: c.move.pos.z + (-lx * sin + lz * cos) * k };
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const ms = (ticks: number | null): number | null => (ticks === null ? null : Math.round(ticks * MS));
const mrad = (rad: number | undefined): number | null => (rad === undefined ? null : Math.round(rad * 10000) / 10);

interface Cell {
  /** ms, first round to kill; null: no kill within the cap. */
  ideal: number | null;
  stk: number | null;
  hip: number | null;
  ads: number | null;
}

interface WeaponReport {
  id: string;
  name: string;
  category: string;
  family: string | null;
  slot: number;
  trigger: string;
  rpm: number;
  magazine: number;
  damage: number;
  pellets: number;
  model: 'bullet' | 'hitscan' | 'beam' | 'projectile';
  velocity: number | null;
  ttk: Record<string, Record<string, Cell>>;
  /** Ideal body TTK (ms) unarmoured, by distance (SWEEP). */
  sweep: Record<string, number | null>;
  sweepStk: Record<string, number | null>;
  /** First hit's damage (unarmoured), body and head, by distance. */
  firstHit: Record<string, { body: number | null; head: number | null }>;
  falloff: Record<string, number>;
  drop: Record<string, { flightMs: number; dropCm: number } | null>;
  firstShotMs: number | null;
  drawMs: number | null;
  toPistolMs: number | null;
  reload: { tacticalMs: number | null; emptyMs: number | null; firstRoundMs: number | null; cancelByFireMs: number | null; cancelBySwapMs: number | null; kind: string; overheatCoolMs?: number | null };
  recoil: { oneMrad: number | null; oneSettleMs: number | null; sprayRounds: number; sprayMrad: number | null; spraySettleMs: number | null; sprayForgetMs: number | null };
  spread: { hip: number | null; ads: number | null; run: number | null; spray10: number | null };
}

function measure(lab: Lab, def: WeaponDefinition): WeaponReport {
  const gp = gunplayOf(def);
  const out: WeaponReport = {
    id: def.id,
    name: def.displayName,
    category: def.category ?? '',
    family: gp.family,
    slot: def.slot,
    trigger: def.fireMode ?? 'auto',
    rpm: Math.round((TICK_RATE * 60) / def.fireIntervalTicks),
    magazine: def.magazine,
    damage: def.damage,
    pellets: def.pellets,
    model: def.view.beam ? 'beam' : gp.ballistic ? 'bullet' : def.kind === 'projectile' ? 'projectile' : 'hitscan',
    velocity: gp.ballistic ? bulletPhysics(gp.ballistic, lab.match.rules).speed : def.projectile ? def.projectile.speed : null,
    ttk: {},
    sweep: {},
    sweepStk: {},
    firstHit: {},
    falloff: {},
    drop: {},
    firstShotMs: null,
    drawMs: null,
    toPistolMs: null,
    reload: { tacticalMs: null, emptyMs: null, firstRoundMs: null, cancelByFireMs: null, cancelBySwapMs: null, kind: def.heat ? 'heat' : def.magazine === 0 ? 'none' : gp.reload.type },
    recoil: { oneMrad: null, oneSettleMs: null, sprayRounds: 0, sprayMrad: null, spraySettleMs: null, sprayForgetMs: null },
    spread: { hip: null, ads: null, run: null, spray10: null },
  };

  // TTK grid. A pellet pattern is random: its ideal kill is a median over the trials too.
  const idealTrials = def.pellets > 1 ? TRIALS : 1;
  for (const dist of DISTANCES) {
    const row: Record<string, Cell> = {};
    for (const armour of [false, true]) {
      for (const aim of ['body', 'head'] as const) {
        const ideal = lab.ideal(def, dist, armour, aim, idealTrials);
        if (!armour) out.firstHit[dist] = { ...(out.firstHit[dist] ?? { body: null, head: null }), [aim]: ideal.one };
        const real: Record<'hip' | 'ads', { t: number[]; misses: number }> = { hip: { t: [], misses: 0 }, ads: { t: [], misses: 0 } };
        for (const way of ['hip', 'ads'] as const) {
          for (let s = 1; s <= TRIALS; s++) {
            lab.reset(def, dist, armour, s * 7919, false);
            const k = lab.kill(aim, way);
            if (k.ticks === null) real[way].misses++;
            else real[way].t.push(k.ticks);
          }
        }
        // A median over the trials, a failed kill counting as the slowest.
        const med = (w: 'hip' | 'ads') => (real[w].misses * 2 > TRIALS ? null : median([...real[w].t, ...Array<number>(real[w].misses).fill(Infinity)]));
        const cell: Cell = { ideal: ms(ideal.ticks), stk: ideal.stk, hip: ms(finite(med('hip'))), ads: ms(finite(med('ads'))) };
        row[`${armour ? 'armoured' : 'unarmoured'}.${aim}`] = cell;
      }
    }
    out.ttk[dist] = row;
  }
  for (const dist of SWEEP) {
    const k = lab.ideal(def, dist, false, 'body', idealTrials);
    out.sweep[dist] = ms(k.ticks);
    out.sweepStk[dist] = k.stk;
    out.falloff[dist] = Math.round(falloffAt(gp.falloff, dist) * 100) / 100;
    out.drop[dist] = gp.ballistic ? (({ time, drop }) => ({ flightMs: Math.round(time * 1000), dropCm: Math.round(drop * 100) }))(flightTo(gp.ballistic, dist, lab.match.rules)) : null;
  }

  // Time to the first shot from idle: the weapon up, the trigger pressed.
  lab.reset(def, 25, false, 1, true);
  for (let i = 0; i < 30; i++) lab.step(lab.aimAt('body', def));
  const pressed = lab.inside.tick + 1;
  for (let i = 0; i < 240 && !lab.fired.length; i++) lab.step({ ...lab.aimAt('body', def), buttons: BUTTON_FIRE });
  out.firstShotMs = lab.fired.length ? ms(lab.fired[0]! - pressed) : null;

  // Draw: from the Pistol, switch to it with the trigger held, until it fires; and from it back to the Pistol.
  const draw = (from: WeaponDefinition, to: WeaponDefinition): number | null => {
    lab.reset(def, 25, false, 1, true);
    lab.give(lab.a, from);
    for (let i = 0; i < 30; i++) lab.step(lab.aimAt('body', def));
    lab.fired = [];
    const at = lab.inside.tick + 1;
    for (let i = 0; i < 240 && !lab.fired.length; i++) lab.step({ ...lab.aimAt('body', def), weapon: weaponCode(to), buttons: BUTTON_FIRE });
    return lab.fired.length ? ms(lab.fired[0]! - at) : null;
  };
  if (def.id !== PISTOL.id) {
    out.drawMs = draw(PISTOL, def);
    out.toPistolMs = draw(def, PISTOL);
  } else {
    out.drawMs = draw(CORE_WEAPONS['core.rifle']!, def);
    out.toPistolMs = out.drawMs;
  }

  // Reloads.
  if (def.magazine > 0 && !def.heat) {
    const reloadFrom = (mag: number): { full: number | null; firstRound: number | null } => {
      lab.reset(def, 25, false, 1, true);
      const w = lab.held();
      w.reserve += w.mag - mag;
      w.mag = mag;
      lab.step({ buttons: BUTTON_RELOAD });
      const at = lab.inside.tick;
      let firstRound: number | null = roundsReady(w) > 0 && lab.a.reload ? 0 : null;
      for (let i = 0; i < 600; i++) {
        if (!lab.a.reload) return { full: ms(lab.inside.tick - at + 1), firstRound };
        // The reload's own stages: the first tick a round could be fired (by interrupting it).
        if (firstRound === null && roundsReady(w) > mag) firstRound = ms(lab.inside.tick - at + 1);
        lab.step({});
      }
      return { full: null, firstRound };
    };
    if (def.magazine > 1) out.reload.tacticalMs = reloadFrom(Math.ceil(def.magazine / 2)).full;
    const empty = reloadFrom(0);
    out.reload.emptyMs = empty.full;
    out.reload.firstRoundMs = empty.firstRound;
    // Reload cancel by the trigger: a tactical (or shell) reload under way, fire pressed, until the round leaves.
    const cancel = (by: 'fire' | 'swap'): number | null => {
      lab.reset(def, 25, false, 1, true);
      const w = lab.held();
      const mag = by === 'fire' ? Math.max(1, Math.ceil(def.magazine / 2)) : 0;
      w.reserve += w.mag - mag;
      w.mag = mag;
      if (by === 'fire' && def.magazine === 1) return null;
      lab.step({ buttons: BUTTON_RELOAD });
      for (let i = 0; i < 10; i++) lab.step({});
      if (!lab.a.reload) return null;
      lab.fired = [];
      const at = lab.inside.tick + 1;
      for (let i = 0; i < 240 && !lab.fired.length; i++) lab.step({ ...lab.aimAt('body', def), buttons: BUTTON_FIRE, ...(by === 'swap' ? { weapon: weaponCode(PISTOL) } : {}) });
      return lab.fired.length ? ms(lab.fired[0]! - at) : null;
    };
    out.reload.cancelByFireMs = cancel('fire');
    out.reload.cancelBySwapMs = def.id === PISTOL.id ? null : cancel('swap');
  } else if (def.heat) {
    // Heat: fire until it overheats, then how long until it can fire again.
    lab.reset(def, 25, false, 1, true);
    const w = lab.held();
    for (let i = 0; i < 1200 && !w.overheated; i++) lab.step({ ...lab.aimAt('body', def), buttons: BUTTON_FIRE });
    const at = lab.inside.tick;
    let cool: number | null = null;
    // (Never overheated in 20 s of fire: no cooling to measure.)
    for (let i = 0; i < 1200 && w.overheated; i++) {
      lab.step({});
      if (!w.overheated) {
        cool = ms(lab.inside.tick - at);
        break;
      }
    }
    out.reload.overheatCoolMs = cool;
  }

  // Recoil: one round, then a 10-round spray (or the magazine), no counter; the offset left and how long it takes
  // to settle back, and how long the spray's spread takes to be forgotten.
  const settle = (rounds: number): { mrad: number | null; ms: number | null; forget: number | null; n: number } => {
    lab.reset(def, 100, false, 1, true);
    lab.t.move.pos.z = 30;
    lab.spot = { x: 100, y: 0, z: 30 };
    const clicker = (def.fireMode ?? 'auto') !== 'auto';
    for (let i = 0; i < 600 && lab.fired.length < rounds; i++) {
      const justFired = lab.fired.length > 0 && lab.fired[lab.fired.length - 1] === lab.inside.tick;
      lab.step({ yaw: Math.PI / 2, pitch: 0, buttons: clicker && justFired ? 0 : BUTTON_FIRE });
      if (def.magazine > 0 && lab.held().mag === 0 && !lab.a.reload) break;
    }
    const n = lab.fired.length;
    const g = lab.a.gun;
    const off = Math.hypot(g.rp, g.ry);
    const at = lab.inside.tick;
    let back: number | null = null;
    let forget: number | null = null;
    for (let i = 0; i < 1200 && (back === null || forget === null); i++) {
      if (back === null && g.rp === 0 && g.ry === 0) back = lab.inside.tick - at;
      if (forget === null && g.spray === 0) forget = lab.inside.tick - at;
      lab.step({ yaw: Math.PI / 2, pitch: 0 });
    }
    return { mrad: mrad(off), ms: ms(back), forget: ms(forget), n };
  };
  if (gp.kick || gp.accuracy) {
    const one = settle(1);
    out.recoil.oneMrad = one.mrad;
    out.recoil.oneSettleMs = one.ms;
    const spray = settle(Math.min(10, def.magazine || 10));
    out.recoil.sprayRounds = spray.n;
    out.recoil.sprayMrad = spray.mrad;
    out.recoil.spraySettleMs = spray.ms;
    out.recoil.sprayForgetMs = spray.forget;
  }

  // Spread the sim gave the first round: standing hip, standing fully aimed, running (strafing at full speed), and the
  // 10th round of a hip spray.
  const coneOf = (opts: { ads?: boolean; run?: boolean; nth?: number }): number | undefined => {
    lab.reset(def, 25, false, 1, false);
    const zoom = opts.ads ? BUTTON_ZOOM : 0;
    for (let i = 0; i < 60; i++) lab.step({ ...lab.aimAt('body', def), buttons: zoom, ...(opts.run ? { right: 1 } : {}) });
    lab.cones = [];
    const clicker = (def.fireMode ?? 'auto') !== 'auto';
    const nth = opts.nth ?? 1;
    for (let i = 0; i < 600 && lab.fired.length < nth; i++) {
      const justFired = lab.fired.length > 0 && lab.fired[lab.fired.length - 1] === lab.inside.tick;
      lab.step({ ...lab.aimAt('body', def), buttons: (clicker && justFired ? 0 : BUTTON_FIRE) | zoom, ...(opts.run ? { right: 1 } : {}) });
    }
    if (lab.fired.length < nth) return undefined;
    // Pellets: the first of each round's cones (they share one).
    const perRound = lab.cones.length / lab.fired.length;
    const c = lab.cones[Math.round((nth - 1) * perRound)];
    // A multi-pellet weapon's own pattern is part of its cone: report it apart (the pattern is fixed).
    return c;
  };
  out.spread.hip = mrad(coneOf({}));
  out.spread.ads = mrad(coneOf({ ads: true }));
  out.spread.run = mrad(coneOf({ run: true }));
  if ((def.fireMode ?? 'auto') === 'auto' && def.magazine >= 10) out.spread.spray10 = mrad(coneOf({ nth: 10 }));
  return out;
}

const finite = (x: number | null): number | null => (x === null || !Number.isFinite(x) ? null : x);

// ---------------------------------------------------------------- the chart

/** Benchmark seven (docs/GUNPLAY_DIRECTION.md) and the classes they stand for. */
const BENCHMARKS: readonly [string, string][] = [
  ['core.pistol', 'Service Pistol'],
  ['core.revolver', 'Heavy Revolver'],
  ['core.smg', 'SMG'],
  ['core.rifle', 'Assault Rifle'],
  ['core.shotgun', 'Shotgun'],
  ['core.sniper', 'Precision Rifle'],
  ['core.rockets', 'Rocket Launcher'],
];

/**
 * TTK against distance, one line per benchmark weapon (the ideal body TTK on an unarmoured standard player, from the
 * sweep): an SVG that reads in light and dark (its own surface and ink, the dark steps under prefers-color-scheme), a
 * legend row and direct labels at the line ends (ink text beside a swatch of the line's colour). Colours: the
 * dataviz skill's validated categorical order, light and dark steps.
 */
function chart(reports: WeaponReport[]): string {
  const W = 800;
  const H = 500;
  const L = 64;
  const R = 170;
  const T = 104;
  const B = 56;
  const maxD = 150;
  const maxT = 2500;
  const x = (d: number) => L + (d / maxD) * (W - L - R);
  const y = (t: number) => T + (1 - Math.min(t, maxT) / maxT) * (H - T - B);
  const light = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];
  const dark = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'];
  const lines: string[] = [];
  const labels: { y: number; text: string; i: number }[] = [];
  const shown = BENCHMARKS.map(([id, name], i) => ({ r: reports.find((w) => w.id === id), name, i })).filter((s) => s.r);
  for (const { r, name, i } of shown) {
    const pts = SWEEP.filter((d) => d <= maxD).map((d) => [d, r!.sweep[d] ?? null] as const);
    let path = '';
    let pen = false;
    let last: readonly [number, number] | null = null;
    for (const [d, t] of pts) {
      if (t === null || t > maxT) {
        pen = false;
        continue;
      }
      path += `${pen ? 'L' : 'M'}${x(d).toFixed(1)},${y(t).toFixed(1)} `;
      pen = true;
      last = [d, t];
    }
    if (path) lines.push(`<path class="s${i}" d="${path.trim()}" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    for (const [d, t] of pts) if (t !== null && t <= maxT) lines.push(`<circle class="d${i} ring" cx="${x(d).toFixed(1)}" cy="${y(t).toFixed(1)}" r="4" stroke-width="2"><title>${name}, ${d} m: ${t} ms, ${r!.sweepStk[d]} rounds</title></circle>`);
    if (last) labels.push({ y: y(last[1]), text: `${name}${last[0] < maxD ? ` (to ${last[0]} m)` : ''}`, i });
  }
  // Direct labels, pushed apart so they never overlap (and kept inside the plot's height).
  labels.sort((p, q) => p.y - q.y);
  for (let k = 1; k < labels.length; k++) if (labels[k]!.y - labels[k - 1]!.y < 16) labels[k]!.y = labels[k - 1]!.y + 16;
  const over = labels.length ? labels[labels.length - 1]!.y - (H - B) : 0;
  if (over > 0) for (const l of labels) l.y -= over;
  const grid: string[] = [];
  for (let t = 0; t <= maxT; t += 500) grid.push(`<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`);
  for (const d of [0, 25, 50, 75, 100, 125, 150]) grid.push(`<text class="tick" x="${x(d)}" y="${H - B + 18}" text-anchor="middle">${d}</text>`);
  // Legend row (identity never by colour alone: the direct labels name each line too).
  const legend: string[] = [];
  let lx = L;
  for (const { name, i } of shown) {
    legend.push(`<line class="s${i}" x1="${lx}" x2="${lx + 16}" y1="80" y2="80" stroke-width="2"/><circle class="d${i} ring" cx="${lx + 8}" cy="80" r="4" stroke-width="2"/><text class="ink2" x="${lx + 22}" y="84" font-size="11.5">${name}</text>`);
    lx += 26 + name.length * 6.6;
  }
  const vars = (c: string[]) => c.map((v, i) => `.s${i}{stroke:${v}}.d${i}{fill:${v}}.k${i}{fill:${v}}`).join('');
  const style = [
    '.bg{fill:#fcfcfb}.ink{fill:#0b0b0b}.ink2{fill:#52514e}.tick{fill:#898781;font-size:11px;font-variant-numeric:tabular-nums}.grid{stroke:#e1e0d9;stroke-width:1}.axis{stroke:#c3c2b7;stroke-width:1}.ring{stroke:#fcfcfb}',
    vars(light),
    '@media (prefers-color-scheme: dark){.bg{fill:#1a1a19}.ink{fill:#f0efec}.ink2{fill:#c3c2b7}.grid{stroke:#2c2c2a}.axis{stroke:#383835}.ring{stroke:#1a1a19}',
    vars(dark),
    '}',
    'text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
  ].join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Time to kill against distance for the seven benchmark weapons">`,
    `<style>${style}</style>`,
    `<rect class="bg" x="0" y="0" width="${W}" height="${H}" rx="8"/>`,
    `<text class="ink" x="${L}" y="26" font-size="15" font-weight="600">Time to kill by distance: the benchmark seven</text>`,
    `<text class="ink2" x="${L}" y="45" font-size="11.5">Every round on the body of an unarmoured standard player (100 health), flight time included; a line stops</text>`,
    `<text class="ink2" x="${L}" y="60" font-size="11.5">where no kill comes within 8 s (or past 2.5 s). Measured in the shared sim: pnpm gun-report.</text>`,
    ...legend,
    ...grid,
    `<line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>`,
    ...lines,
    ...labels.map((l) => `<rect class="k${l.i}" x="${W - R + 8}" y="${(l.y - 1).toFixed(1)}" width="10" height="3" rx="1.5"/><text class="ink2" x="${W - R + 22}" y="${(l.y + 4).toFixed(1)}" font-size="11.5">${l.text}</text>`),
    `<text class="ink2" x="${(L + W - R) / 2}" y="${H - 14}" font-size="12" text-anchor="middle">Distance (m)</text>`,
    `<text class="ink2" transform="translate(18 ${(T + H - B) / 2}) rotate(-90)" font-size="12" text-anchor="middle">Time to kill (ms, first round to the kill)</text>`,
    '</svg>',
  ].join('\n');
}

// ---------------------------------------------------------------- run

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const reports: WeaponReport[] = [];
const from = args.get('from');
if (from) {
  // Redraw from an earlier run's JSON (no measuring).
  reports.push(...(JSON.parse(readFileSync(resolve(root, from), 'utf8')) as { weapons: WeaponReport[] }).weapons);
} else {
  await Promise.all([initPhysics(), initNavigation()]);
  const lab = new Lab();
  const began = performance.now();
  for (const def of WEAPONS) {
    const t0 = performance.now();
    reports.push(measure(lab, def));
    process.stderr.write(`${def.id} ${((performance.now() - t0) / 1000).toFixed(1)} s\n`);
  }
  process.stderr.write(`${WEAPONS.length} weapons in ${((performance.now() - began) / 1000).toFixed(0)} s\n`);
}

const f = (v: number | null | undefined, unit = ''): string => (v === null || v === undefined ? '-' : `${v}${unit}`);
const pad = (s: string, n: number) => s.padEnd(n);
console.log(`TTK, ms (first round to kill; ideal / hip median / ADS median of ${TRIALS}), shots to kill (ideal); standard player 100 hp, armour ${MAX_ARMOR}`);
for (const r of reports) {
  console.log(`\n${r.name} (${r.id}, ${r.category}, ${r.family ?? 'no family'}, ${r.trigger} ${r.rpm} rpm, mag ${r.magazine}, ${r.model}${r.velocity ? ` ${r.velocity} m/s` : ''})`);
  for (const d of DISTANCES) {
    const row = r.ttk[d]!;
    const cell = (k: string) => {
      const c = row[k]!;
      return `${f(c.ideal)}/${f(c.hip)}/${f(c.ads)} (${f(c.stk)})`;
    };
    console.log(`  ${pad(`${d} m`, 6)} body ${pad(cell('unarmoured.body'), 26)} head ${pad(cell('unarmoured.head'), 26)} armoured body ${pad(cell('armoured.body'), 26)} head ${cell('armoured.head')}`);
  }
  console.log(`  first shot ${f(r.firstShotMs, ' ms')}, draw ${f(r.drawMs, ' ms')}, to pistol ${f(r.toPistolMs, ' ms')}; reload ${r.reload.kind} tactical ${f(r.reload.tacticalMs, ' ms')} empty ${f(r.reload.emptyMs, ' ms')} first round ${f(r.reload.firstRoundMs, ' ms')} cancel by fire ${f(r.reload.cancelByFireMs, ' ms')} by swap ${f(r.reload.cancelBySwapMs, ' ms')}${r.reload.overheatCoolMs !== undefined ? ` overheat cool ${f(r.reload.overheatCoolMs, ' ms')}` : ''}`);
  console.log(`  recoil one ${f(r.recoil.oneMrad, ' mrad')} settles ${f(r.recoil.oneSettleMs, ' ms')}; ${r.recoil.sprayRounds}-round spray ${f(r.recoil.sprayMrad, ' mrad')} settles ${f(r.recoil.spraySettleMs, ' ms')} spread forgotten ${f(r.recoil.sprayForgetMs, ' ms')}; cone hip ${f(r.spread.hip)} ADS ${f(r.spread.ads)} run ${f(r.spread.run)} spray10 ${f(r.spread.spray10)} mrad`);
}

const out = {
  generated: 'pnpm gun-report (packages/server/src/tools/gun-report.ts): measured in the shared sim',
  target: { health: PLAYER.maxHealth, armour: MAX_ARMOR },
  trials: TRIALS,
  distances: DISTANCES,
  sweep: SWEEP,
  capSeconds: CAP_TICKS / TICK_RATE,
  weapons: reports,
};
const json = args.get('json');
if (json && !from) {
  const p = resolve(root, json);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`\nwrote ${p}`);
}
const svg = args.get('svg');
if (svg) {
  const p = resolve(root, svg);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${chart(reports)}\n`);
  console.log(`wrote ${p}`);
}
