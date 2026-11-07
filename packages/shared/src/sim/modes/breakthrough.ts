import { playbookFor } from '../../bots/playbooks.ts';
import { hasTag } from '../../bots/profile.ts';
import type { SideBrief } from '../../bots/teamBrain.ts';
import type { BreakthroughObjective } from '../../map/schema.ts';
import { behindLine, breakthroughSectors } from '../../map/sectors.ts';
import { terrainHeightAt } from '../../map/terrain.ts';
import { horizontalDistance, type Vec3 } from '../../math.ts';
import {
  BT_IN_ATTACKERS,
  BT_IN_BOTH,
  BT_IN_DEFENDERS,
  BT_IN_NOBODY,
  BT_OBJ_ACTIVE,
  BT_OBJ_DONE,
  BT_OBJ_PLANTED,
  BT_OBJ_SKIPPED,
  BT_OBJ_WAITING,
  BT_ROUND_ATTACKERS,
  BT_ROUND_DEFENDERS,
  BT_ROUND_PLAYING,
  type ModeSnapshot,
} from '../../protocol.ts';
import { TICK_RATE } from '../constants.ts';
import type { Combatant } from '../match.ts';
import { getMountDef } from '../mounts.ts';
import { BUTTON_CROUCH, BUTTON_JUMP, BUTTON_PRONE, BUTTON_SPRINT, type PlayerInput } from '../movement.ts';
import { BREAKTHROUGH_POOL, BREAKTHROUGH_SECTOR_SECONDS } from '../rules.ts';
import type { SpawnSpot } from '../spawns.ts';
import { THROWABLE_DEFS } from '../weapons.ts';
import { teamHome, type BotGoal, type BotTripSpec, type ModeHost, type ModeLogic } from './types.ts';

/**
 * Breakthrough's playbook (bots/playbooks.ts; docs/BOTS.md, "Breakthrough's playbook"): the team brain's numbers for
 * the attackers (spread over the sector's ways on any trip, bounds cover to cover whatever the style), and the
 * defenders' shares (the guns, the trenches, the crest, falling back early) for botGoal.
 */
const PLAYBOOK = playbookFor('core.breakthrough');
const ROLES = PLAYBOOK.breakthrough!;
/**
 * A sector's posts are what stands within this of its objectives on the defenders' side of its line (m): the guns and
 * trenches on a crest over a beach cover the zones at the cliff's foot from the next sector's ground.
 */
const POST_REACH = 60;
/** Crest spots: at least this much higher than the sector's objectives (m), this far apart at least; how many a sector keeps. */
const CREST_RISE = 2.5;
const CREST_APART = 6;
const CREST_SPOTS = 6;
/**
 * The attackers' objective is the least defended of the sector's (the fewest defenders within this of it, m), kept
 * until it is taken or planted, and looked at again this often (s) while no attacker is on it yet: it moves to one
 * with fewer defenders, or, more than FOCUS_NEAR away (m), with at least two fewer (a long walk between two
 * objectives isn't thrown away for one defender).
 */
const FOCUS_GUARD = 15;
const FOCUS_SECONDS = 20;
const FOCUS_NEAR = 60;
/** A defender's duty (the playbook's shares): a gun, the crest, falling back early, a trench or sandbags, the objectives. */
type Duty = 'gun' | 'crest' | 'back' | 'trench' | 'hold';

/** A spawn group's home for its trips: its spot nearest the group's middle (null: an empty group). */
const groupHome = (spots: readonly SpawnSpot[]): Vec3 | null => teamHome(spots.map((s) => ({ pos: s.pos, team: '' })), '');

/** Seconds to plant a charge at a target (attackers) and to defuse one (defenders), holding still within its reach. */
export const BT_PLANT_SECONDS = 3;
export const BT_DEFUSE_SECONDS = 5;
/** A planted charge goes off after this long unless defused. */
export const BT_FUSE_SECONDS = 20;
/** Defenders left behind the line once a sector falls: seconds of warning, then the damage a second it does. */
export const BT_FALLBACK_SECONDS = 10;
export const BT_FALLBACK_DPS = 20;
/** Seconds one attacker alone takes to capture a zone, and a final hold (each zone can say its own). */
export const BT_ZONE_SECONDS = 20;
export const BT_FINAL_SECONDS = 40;
/** Seconds between the two rounds (sides swapped). */
export const BT_BREAK_SECONDS = 8;
/** Defenders respawn this many times slower than the match's respawn delay (attackers take it as it is). */
export const BT_DEFENDER_RESPAWN = 1.5;
/** Most attackers counted for capture speed: one alone at 1×, two at 1.5×, three or more at 2×. */
const ZONE_CROWD = 3;
/** Standing in a zone: within its radius, from a little below its floor to a storey above (as King of the Hill). */
const ZONE_BELOW = 1;
const ZONE_ABOVE = 3.5;
/** A charge's reach in height, and how far a planter or defuser may drift before the action is cancelled. */
const TARGET_HEIGHT = 2;
const STEADY = 0.6;
/** A target's blast as it goes. */
const BLAST = { radius: 9, damage: 260 };
/** Players a spawn point serves before its group gets spots of its own round it (sim/spawns.ts SPAWN_SHARE). */
const GROUP_SHARE = 3;

export type BreakthroughSide = 'attack' | 'defend';

/** One of the map's objectives as it plays. */
export interface BtObjectiveRt {
  /** Its map entity's index. */
  index: number;
  kind: BreakthroughObjective;
  /** Its sector (0-based, in the order they are taken). */
  sector: number;
  label: string;
  pos: Vec3;
  radius: number;
  /** Zones: seconds one attacker alone takes to capture it. */
  seconds: number;
  state: number;
  /** Zones: capture, 0-1. */
  progress: number;
  /** Zones: who stands in it (BT_IN_*). */
  presence: number;
  /** Targets: the tick a planted charge goes off, and who planted it. */
  blowAt: number;
  planter: number | null;
  /** Targets: a plant or defuse under way. */
  action: { slot: number; start: number; from: Vec3 } | null;
}

/** One sector as it plays: its line (where its ground starts, `dir` the way the attackers push), its objectives and its spawn groups. */
export interface BtSectorRt {
  index: number;
  order: number;
  name: string;
  pos: Vec3;
  dir: { x: number; z: number };
  /** Targets to destroy for it to fall (its zones must all be captured too). */
  need: number;
  /** Seconds it puts on the clock. */
  seconds: number;
  objectives: BtObjectiveRt[];
  /** Its spawn groups: the map's spawn points marked for it (as the match's spawn spots, so recent use counts). */
  spawns: Record<BreakthroughSide, SpawnSpot[]>;
  /**
   * Where its defenders post (the playbook's shares): what stands within POST_REACH of its objectives on the defenders'
   * side of its line: guns (turrets), trenches (trench tiles, and a step behind each sandbag wall) and the crest (high
   * ground over its objectives: upper floors, terrain rising CREST_RISE over them), the best first (BreakthroughMode.postsOf
   * keeps those its defenders can walk to, and crest spots that see an objective).
   */
  posts: { guns: Vec3[]; trenches: Vec3[]; crest: Vec3[] };
}

/** Standing in a zone (or close enough to a target to plant or defuse at it). */
export function inObjective(o: Pick<BtObjectiveRt, 'kind' | 'pos' | 'radius'>, p: Vec3): boolean {
  if (horizontalDistance(o.pos, p) > o.radius) return false;
  return o.kind === 'target' ? Math.abs(p.y - o.pos.y) < TARGET_HEIGHT : p.y > o.pos.y - ZONE_BELOW && p.y < o.pos.y + ZONE_ABOVE;
}

/**
 * Breakthrough (core.breakthrough, docs/GAME_MODES.md): asymmetric. The attackers take the map's sectors in order;
 * the defenders hold each line in turn.
 * - **Sectors.** A sector falls when every capture zone in it is captured and enough of its targets are destroyed
 *   (all, or its "N of M"). A zone captures while attackers alone stand in it (faster with more, up to two times),
 *   holds while a defender stands in it (contested) and slips back while only defenders do; once captured it stays
 *   so. A target takes a charge: an attacker within reach presses Use and holds still (bots: stand still), the fuse
 *   burns, a defender within reach defuses it the same way. A final hold is a zone whose capture ends the round.
 * - **When a sector falls** the attackers' spawns move up to the next sector's group and the defenders' fall back to
 *   theirs; defenders left on the attackers' side of the next sector's line have BT_FALLBACK_SECONDS to get over it,
 *   then it hurts (BT_FALLBACK_DPS); the next sector's objectives switch on and its time goes on the clock.
 * - **Reinforcements:** the attackers' pool is `breakthroughPool` (BREAKTHROUGH_POOL) per attacker, topped up by half
 *   as much per attacker for each sector taken; each attacker death costs one, and once it is spent the fallen stay
 *   down. The defenders respawn without limit, BT_DEFENDER_RESPAWN times slower.
 * - **Time:** each sector puts its seconds on the clock (its own, else `breakthroughSectorSeconds`). A charge still
 *   burning when the clock runs out plays on (overtime).
 * - **Winning:** the attackers win the round when the last sector falls; the defenders when the clock runs out, or
 *   the pool is spent and the last attacker is down. With `breakthroughSwap` a second round follows with the sides
 *   swapped; a team's score is the sectors it took, and of two teams that took as many, the one that took its last
 *   with more time left wins.
 */
export class BreakthroughMode implements ModeLogic {
  readonly sectors: BtSectorRt[];
  readonly objectives: BtObjectiveRt[];
  round = 1;
  /** The sector in play (0-based); the sector count once the last has fallen. */
  active = 0;
  /** Reinforcements left. */
  pool = 0;
  /** The tick the clock runs out. */
  clockEnd = 0;
  /** How the round stands (BT_ROUND_*), and when the next one starts (between rounds). */
  outcome = BT_ROUND_PLAYING;
  restartAt: number | null = null;
  /** Each team's attack: sectors taken, and the seconds left on the clock when it took its last. */
  private readonly results = new Map<string, { sectors: number; timeLeft: number }>();
  /** Defenders behind the line: since when (tick). */
  readonly behind = new Map<number, number>();
  /** Spots added round a spawn group too small for its team (per sector and side). */
  private readonly extraSpots = new Map<string, SpawnSpot[]>();
  private warnedQuarter = false;
  /**
   * Bots: each sector's posts its defenders can use (postsOf); this tick's plan (plan): each attacker's place among its
   * side's bots, each defender's duty with its place among those on it (`j`) and among those answering the attack
   * (`a`), and whether the defenders fall back early; the attackers' objective and since when (attackFocus).
   */
  private readonly usable = new Map<number, BtSectorRt['posts']>();
  private readonly placeOf = new Map<number, { k: number; n: number }>();
  private readonly duty = new Map<number, { duty: Duty; j: number; a: number }>();
  private planTick = -1;
  private fallingBack = false;
  private focus: BtObjectiveRt | null = null;
  private focusAt = 0;
  /** Attacking bots spawned as they were added, before they had a brain: armed with smoke at their first input. */
  private readonly unarmed = new Set<number>();

  constructor(private readonly host: ModeHost) {
    const map = host.map;
    const spawnEntities = map.entities.filter((e) => e.kind === 'spawn');
    this.sectors = breakthroughSectors(map).map((s) => ({
      index: s.index,
      order: s.order,
      name: s.name,
      pos: s.pos,
      dir: s.dir,
      need: 0,
      seconds: s.seconds ?? host.rules.breakthroughSectorSeconds ?? BREAKTHROUGH_SECTOR_SECONDS,
      objectives: [],
      spawns: { attack: [], defend: [] },
      posts: { guns: [], trenches: [], crest: [] },
    }));
    const byOrder = new Map<number, BtSectorRt>();
    for (const s of this.sectors) if (!byOrder.has(s.order)) byOrder.set(s.order, s);
    this.objectives = [];
    map.entities.forEach((e, index) => {
      if (e.kind !== 'objective') return;
      const sector = byOrder.get(e.sector);
      if (!sector) return;
      const o: BtObjectiveRt = {
        index,
        kind: e.objective,
        sector: this.sectors.indexOf(sector),
        label: e.label,
        pos: { x: e.position[0], y: e.position[1], z: e.position[2] },
        radius: e.radius,
        seconds: e.seconds ?? (e.objective === 'final' ? BT_FINAL_SECONDS : BT_ZONE_SECONDS),
        state: BT_OBJ_WAITING,
        progress: 0,
        presence: BT_IN_NOBODY,
        blowAt: 0,
        planter: null,
        action: null,
      };
      this.objectives.push(o);
      sector.objectives.push(o);
    });
    const needs = new Map(breakthroughSectors(map).map((s) => [s.index, s.need]));
    for (const s of this.sectors) {
      const targets = s.objectives.filter((o) => o.kind === 'target').length;
      s.need = Math.min(targets, needs.get(s.index) ?? targets);
    }
    spawnEntities.forEach((e, i) => {
      if (e.kind !== 'spawn' || e.sector === undefined || !e.side) return;
      const sector = byOrder.get(e.sector);
      const spot = host.spawnPoints[i];
      if (sector && spot) sector.spawns[e.side].push(spot);
    });
    this.findPosts();
    this.reset();
  }

  /**
   * Each sector's posts for its defenders (BtSectorRt.posts): what stands within POST_REACH of its objectives on the
   * defenders' side of its line (its own ground, or a later sector's overlooking it), the best first, the same order
   * every time.
   */
  private findPosts(): void {
    const map = this.host.map;
    const { cellSize, levelHeight } = map.classicStructure;
    const ground = map.terrain;
    for (const s of this.sectors) {
      if (!s.objectives.length) continue;
      const near = (p: Vec3) => s.objectives.reduce((d, o) => Math.min(d, horizontalDistance(o.pos, p)), Infinity);
      const ours = (p: Vec3) => !behindLine(s, p) && near(p) <= POST_REACH;
      const base = s.objectives.reduce((y, o) => Math.min(y, o.pos.y), Infinity);
      const { guns, trenches, crest } = s.posts;
      for (const e of map.entities) {
        if (e.kind !== 'mount' && e.kind !== 'prop') continue;
        const p = { x: e.position[0], y: e.position[1], z: e.position[2] };
        if (!ours(p)) continue;
        if (e.kind === 'mount' && getMountDef(e.model)?.kind === 'turret') guns.push(p);
        // A sandbag wall: a fighting position a step behind it (away from the attack).
        else if (e.kind === 'prop' && /sandbag/.test(e.model)) trenches.push({ x: p.x + s.dir.x * 1.2, y: p.y, z: p.z + s.dir.z * 1.2 });
      }
      // High ground: upper floors and terrain rising over the objectives (a cliff's crest over a beach), scored by how
      // high (up to 15 m) less a tenth of how far from the objectives.
      const high: { p: Vec3; score: number }[] = [];
      const add = (p: Vec3) => high.push({ p, score: Math.min(15, p.y - base) - near(p) * 0.1 });
      for (const t of map.classicStructure.tiles) {
        const p = { x: t.x * cellSize, y: t.z * levelHeight, z: t.y * cellSize };
        if (!ours(p)) continue;
        // (A sunken trench's floor is 1.5 m under its level.)
        if (/trench/.test(t.tile)) trenches.push({ ...p, y: p.y - 1.5 });
        else if (p.y >= base + CREST_RISE) add(p);
      }
      if (ground) {
        const seen = new Set<string>();
        for (const o of s.objectives) {
          for (let dx = -POST_REACH; dx <= POST_REACH; dx += 8) {
            for (let dz = -POST_REACH; dz <= POST_REACH; dz += 8) {
              const x = Math.round((o.pos.x + dx) / 8) * 8;
              const z = Math.round((o.pos.z + dz) / 8) * 8;
              const key = `${x},${z}`;
              if (seen.has(key)) continue;
              seen.add(key);
              const h = terrainHeightAt(ground, x, z);
              if (h !== null && h >= base + CREST_RISE && ours({ x, y: h, z })) add({ x, y: h, z });
            }
          }
        }
      }
      high.sort((a, b) => b.score - a.score || a.p.x - b.p.x || a.p.z - b.p.z || a.p.y - b.p.y);
      for (const h of high) {
        if (crest.length >= CREST_SPOTS * 4) break;
        if (crest.every((q) => horizontalDistance(q, h.p) >= CREST_APART || Math.abs(q.y - h.p.y) > 3)) crest.push(h.p);
      }
      // Guns and trenches by the objective each is nearest, nearest first, taken in turn from each objective's: the first
      // few defenders on them cover every objective.
      const spread = (ps: Vec3[]): Vec3[] => {
        const by = s.objectives.map((o) => ({ o, ps: [] as Vec3[] }));
        for (const p of ps) by.reduce((a, b) => (horizontalDistance(b.o.pos, p) < horizontalDistance(a.o.pos, p) ? b : a)).ps.push(p);
        for (const g of by) g.ps.sort((a, b) => horizontalDistance(a, g.o.pos) - horizontalDistance(b, g.o.pos) || a.x - b.x || a.z - b.z);
        const out: Vec3[] = [];
        for (let i = 0; out.length < ps.length; i++) for (const g of by) if (g.ps[i]) out.push(g.ps[i]!);
        return out;
      };
      s.posts.guns = spread(guns);
      s.posts.trenches = spread(trenches);
    }
  }

  /**
   * A sector's posts its defenders can use, worked out the first time they are asked for: those they can walk to from
   * their spawn group (on the navmesh), and of the crest's, up to CREST_SPOTS that see one of its objectives.
   */
  private postsOf(s: BtSectorRt): BtSectorRt['posts'] {
    let posts = this.usable.get(s.index);
    if (posts) return posts;
    const home = groupHome(s.spawns.defend) ?? s.objectives[0]?.pos ?? null;
    const walk = (p: Vec3) => !!home && this.host.path(home, p) !== null;
    const eye = (p: Vec3) => ({ x: p.x, y: p.y + 1.5, z: p.z });
    const sees = (p: Vec3) => s.objectives.some((o) => this.host.physics.lineOfSight(eye(p), { x: o.pos.x, y: o.pos.y + 1, z: o.pos.z }));
    const crest: Vec3[] = [];
    for (const p of s.posts.crest) if (crest.length < CREST_SPOTS && walk(p) && sees(p)) crest.push(p);
    posts = { guns: s.posts.guns.filter(walk), trenches: s.posts.trenches.filter(walk), crest };
    this.usable.set(s.index, posts);
    return posts;
  }

  /**
   * This tick's plan for the bots (worked out once a tick). Each side's Player Bots go by their place in slot order (`k`
   * of `n`: not by slot, which alternates between the teams). The defenders: whether they fall back early (the sector
   * more than half taken, or half of them down), and each one's duty by the playbook's shares of its place (k + 0.5) / n:
   * the first quarter on the sector's guns, then 40 % in its trenches (the first 30 % of the side falling back early to
   * the next line when it's time), 15 % on its crest, the rest on its objectives; a share whose posts the sector lacks
   * holds the objectives. `j` is its place among those on its duty, `a` among those answering the attack (trenches and
   * objectives; -1 for the others).
   */
  private plan(): void {
    if (this.planTick === this.host.tick) return;
    this.planTick = this.host.tick;
    this.placeOf.clear();
    this.duty.clear();
    const all = this.host.combatants();
    const bots = (team: string) => all.filter((x) => x.faction === team && x.kind === 'bot').sort((a, b) => a.slot - b.slot);
    for (const team of [this.attackers, this.defenders]) {
      const side = bots(team);
      side.forEach((x, k) => this.placeOf.set(x.slot, { k, n: side.length }));
    }
    const side = all.filter((x) => x.faction === this.defenders);
    const down = side.filter((x) => !x.alive).length;
    this.fallingBack = side.length > 1 && (down * 2 >= side.length || this.sectorProgress() > ROLES.fallBackAt);
    const sector = this.sector;
    if (!sector) return;
    const posts = this.postsOf(sector);
    const back = !!this.sectors[this.active + 1]?.objectives.length && this.fallingBack;
    const guns = ROLES.guns;
    const trenches = guns + ROLES.trenches;
    const crest = trenches + ROLES.crestSnipers;
    const on: Record<Duty, number> = { gun: 0, crest: 0, back: 0, trench: 0, hold: 0 };
    let answering = 0;
    const defenders = bots(this.defenders);
    const n = defenders.length;
    defenders.forEach((x, k) => {
      const share = (k + 0.5) / n;
      const duty: Duty =
        share < guns && posts.guns.length
          ? 'gun'
          : back && n >= 3 && share >= guns && share < guns + ROLES.fallBack
            ? 'back'
            : share >= trenches && share < crest && posts.crest.length
              ? 'crest'
              : share >= guns && share < trenches && posts.trenches.length
                ? 'trench'
                : 'hold';
      this.duty.set(x.slot, { duty, j: on[duty]++, a: duty === 'trench' || duty === 'hold' ? answering++ : -1 });
    });
  }

  /** How far the attackers have got with the sector in play, 0..1: its zones' capture, or its targets toward the need. */
  private sectorProgress(): number {
    const s = this.sector;
    if (!s) return 0;
    const zones = s.objectives.filter((o) => o.kind !== 'target');
    const zoneShare = zones.length ? zones.reduce((a, o) => a + (o.state === BT_OBJ_DONE ? 1 : o.progress), 0) / zones.length : 0;
    const gone = s.objectives.filter((o) => o.kind === 'target' && o.state === BT_OBJ_DONE).length;
    return Math.max(zoneShare, s.need > 0 ? gone / s.need : 0);
  }

  /** Where the attackers come from in a sector (for its defenders to watch): its attackers' spawn group, else short of its line. */
  private attackFrom(s: BtSectorRt): Vec3 {
    return groupHome(s.spawns.attack) ?? { x: s.pos.x - s.dir.x * 20, y: s.pos.y, z: s.pos.z - s.dir.z * 20 };
  }

  /**
   * The attackers' objective in the sector in play: of those still to take, the least defended (the fewest defenders
   * alive within FOCUS_GUARD of it, then the map's order), kept until it is taken or planted and looked at again every
   * FOCUS_SECONDS while no attacker is on it (it changes only for one with fewer defenders, two fewer beyond FOCUS_NEAR);
   * else a burning charge.
   */
  private attackFocus(): BtObjectiveRt | null {
    const s = this.sector;
    if (!s) return null;
    const live = s.objectives.filter((o) => o.state === BT_OBJ_ACTIVE);
    if (!live.length) return s.objectives.find((o) => o.state === BT_OBJ_PLANTED) ?? null;
    const tick = this.host.tick;
    const f = this.focus && live.includes(this.focus) ? this.focus : null;
    if (f && tick - this.focusAt < FOCUS_SECONDS * TICK_RATE) return f;
    const all = this.host.combatants();
    if (f && all.some((c) => c.alive && c.faction === this.attackers && horizontalDistance(c.move.pos, f.pos) < f.radius + 3)) return f;
    const guards = (o: BtObjectiveRt) => all.filter((c) => c.alive && c.faction === this.defenders && horizontalDistance(c.move.pos, o.pos) < FOCUS_GUARD).length;
    let best = live[0]!;
    let fewest = guards(best);
    for (const o of live) {
      const g = guards(o);
      if (g < fewest) {
        best = o;
        fewest = g;
      }
    }
    if (f && guards(f) - fewest < (horizontalDistance(f.pos, best.pos) > FOCUS_NEAR ? 2 : 1)) best = f;
    this.focus = best;
    this.focusAt = tick;
    return best;
  }

  /** Whether the defenders hold an objective: a zone they alone stand in, or a target with one of them within reach and 6 m. */
  private held(o: BtObjectiveRt): boolean {
    if (o.kind !== 'target') return o.presence === BT_IN_DEFENDERS;
    return this.host.combatants().some((c) => c.alive && c.faction === this.defenders && horizontalDistance(c.move.pos, o.pos) < o.radius + 6);
  }

  private get attackIndex(): number {
    return (this.round - 1) % 2;
  }

  /** The attacking team's ID this round. */
  get attackers(): string {
    return this.host.teams[this.attackIndex]!.id;
  }

  get defenders(): string {
    return this.host.teams[1 - this.attackIndex]!.id;
  }

  /** Rounds in the match: two with the sides swapped, else one. */
  get rounds(): number {
    return this.host.rules.breakthroughSwap ? 2 : 1;
  }

  /** The side a player plays this round (null: not on either team). */
  sideOf(c: Combatant): BreakthroughSide | null {
    return c.faction === this.attackers ? 'attack' : c.faction === this.defenders ? 'defend' : null;
  }

  /** The sector in play (null once the last has fallen). */
  get sector(): BtSectorRt | null {
    return this.sectors[this.active] ?? null;
  }

  private get perAttacker(): number {
    return Math.max(1, Math.round(this.host.rules.breakthroughPool ?? BREAKTHROUGH_POOL));
  }

  /** The attacking team's size: as the rules set it, or as many as are on it. */
  private attackerCount(): number {
    const sized = this.host.rules.teamSizes?.[this.attackIndex] ?? 0;
    return Math.max(1, sized, this.host.combatants().filter((c) => c.faction === this.attackers).length);
  }

  /** Seconds left on the clock. */
  get timeLeft(): number {
    return Math.max(0, Math.ceil((this.clockEnd - this.host.tick) / TICK_RATE));
  }

  reset(): void {
    this.round = 1;
    this.results.clear();
    this.startRound();
  }

  private startRound(): void {
    this.restartAt = null;
    this.outcome = BT_ROUND_PLAYING;
    this.active = 0;
    this.behind.clear();
    this.warnedQuarter = false;
    this.focus = null;
    for (const o of this.objectives) {
      o.state = o.sector === 0 ? BT_OBJ_ACTIVE : BT_OBJ_WAITING;
      o.progress = 0;
      o.presence = BT_IN_NOBODY;
      o.blowAt = 0;
      o.planter = null;
      o.action = null;
    }
    this.pool = this.perAttacker * this.attackerCount();
    this.clockEnd = this.host.tick + (this.sectors[0]?.seconds ?? BREAKTHROUGH_SECTOR_SECONDS) * TICK_RATE;
    if (!this.results.has(this.attackers)) this.results.set(this.attackers, { sectors: 0, timeLeft: 0 });
  }

  private player(slot: number | null): Combatant | undefined {
    return slot === null ? undefined : this.host.combatants().find((c) => c.slot === slot);
  }

  step(): void {
    const host = this.host;
    if (this.restartAt !== null) {
      if (host.tick >= this.restartAt) this.nextRound();
      return;
    }
    if (this.outcome !== BT_ROUND_PLAYING) return;
    const all = host.combatants();
    if (!all.some((c) => c.faction === this.attackers) || !all.some((c) => c.faction === this.defenders)) {
      // Warm-up until both sides have someone: the clock waits, the pool fills to the team, the fallen come back.
      this.clockEnd++;
      this.pool = Math.max(this.pool, this.perAttacker * this.attackerCount());
      for (const c of all) if (!c.alive && c.respawnTick === Infinity) c.respawnTick = host.tick + host.rules.respawnDelayTicks;
      return;
    }
    const sector = this.sector;
    if (!sector) return;
    for (const o of sector.objectives) {
      if (o.state === BT_OBJ_DONE || o.state === BT_OBJ_SKIPPED) continue;
      if (o.kind === 'target') this.runTarget(o, all);
      else this.runZone(o, all);
      if (this.outcome !== BT_ROUND_PLAYING || this.sector !== sector) return;
    }
    if (this.sectorTaken(sector)) return this.sectorFalls();
    this.fallBack(all);
    // Out of time (a charge still burning plays on), or out of reinforcements with the last attacker down.
    const burning = sector.objectives.some((o) => o.state === BT_OBJ_PLANTED);
    if (host.tick >= this.clockEnd && !burning) return this.endAttack(false);
    if (this.pool <= 0 && !all.some((c) => c.faction === this.attackers && (c.alive || c.respawnTick < Infinity))) this.endAttack(false);
  }

  /** A zone: attackers alone capture it, a defender in it holds it, defenders alone push it back. */
  private runZone(o: BtObjectiveRt, all: Combatant[]): void {
    let att = 0;
    let def = 0;
    const inside: Combatant[] = [];
    for (const c of all) {
      if (!c.alive || !inObjective(o, c.move.pos)) continue;
      if (c.faction === this.attackers) {
        att++;
        inside.push(c);
      } else if (c.faction === this.defenders) def++;
    }
    o.presence = att && def ? BT_IN_BOTH : att ? BT_IN_ATTACKERS : def ? BT_IN_DEFENDERS : BT_IN_NOBODY;
    const step = 1 / (o.seconds * TICK_RATE);
    if (att && !def) o.progress = Math.min(1, o.progress + step * (1 + 0.5 * (Math.min(att, ZONE_CROWD) - 1)));
    else if (def && !att) o.progress = Math.max(0, o.progress - step);
    if (o.progress < 1) return;
    o.state = BT_OBJ_DONE;
    o.presence = BT_IN_NOBODY;
    for (const c of inside) c.objective++;
    this.host.emit({ e: 'bt', a: 'capture', i: o.index, team: this.attackers });
  }

  /** A target: plant (attackers), defuse (defenders), and the charge going off. */
  private runTarget(o: BtObjectiveRt, all: Combatant[]): void {
    const host = this.host;
    const tick = host.tick;
    const planted = o.state === BT_OBJ_PLANTED;
    if (planted && tick >= o.blowAt) {
      o.state = BT_OBJ_DONE;
      o.action = null;
      host.explode({ x: o.pos.x, y: o.pos.y + 0.6, z: o.pos.z }, BLAST.radius, BLAST.damage, this.player(o.planter) ?? null);
      host.emit({ e: 'bt', a: 'destroy', i: o.index, s: o.planter, team: this.attackers, p: [o.pos.x, o.pos.y, o.pos.z] });
      return;
    }
    const side = planted ? this.defenders : this.attackers;
    const a = o.action;
    if (a) {
      const c = this.player(a.slot);
      if (!c?.alive || c.faction !== side || horizontalDistance(c.move.pos, a.from) > STEADY || !inObjective(o, c.move.pos)) {
        o.action = null;
        return;
      }
      if (tick - a.start < (planted ? BT_DEFUSE_SECONDS : BT_PLANT_SECONDS) * TICK_RATE) return;
      o.action = null;
      if (planted) {
        o.state = BT_OBJ_ACTIVE;
        o.planter = null;
        host.emit({ e: 'bt', a: 'defuse', i: o.index, s: c.slot, team: this.attackers });
      } else {
        o.state = BT_OBJ_PLANTED;
        o.planter = c.slot;
        o.blowAt = tick + BT_FUSE_SECONDS * TICK_RATE;
        host.emit({ e: 'bt', a: 'plant', i: o.index, s: c.slot, team: this.attackers });
      }
      return;
    }
    // Use (E) starts it; bots start it just by standing still within reach (they never press keys).
    for (const c of all) {
      if (!c.alive || c.faction !== side || !inObjective(o, c.move.pos)) continue;
      if (c.useTick === tick || (c.kind !== 'human' && (c.move.vx ?? 0) === 0 && (c.move.vz ?? 0) === 0)) {
        o.action = { slot: c.slot, start: tick, from: { ...c.move.pos } };
        return;
      }
    }
  }

  private sectorTaken(s: BtSectorRt): boolean {
    let destroyed = 0;
    for (const o of s.objectives) {
      if (o.kind === 'target') {
        if (o.state === BT_OBJ_DONE) destroyed++;
      } else if (o.state !== BT_OBJ_DONE) return false;
    }
    return destroyed >= s.need && s.objectives.length > 0;
  }

  /** The sector in play has fallen: spawns move up, the next one's objectives and time come into play (or the attackers have won). */
  private sectorFalls(): void {
    const host = this.host;
    const fallen = this.sector!;
    for (const o of fallen.objectives) {
      if (o.state === BT_OBJ_DONE) continue;
      o.state = BT_OBJ_SKIPPED;
      o.action = null;
      o.planter = null;
    }
    const res = this.results.get(this.attackers)!;
    res.sectors = this.active + 1;
    res.timeLeft = this.timeLeft;
    host.emit({ e: 'bt', a: 'sector', n: this.active, team: this.attackers });
    this.active++;
    this.behind.clear();
    const next = this.sector;
    if (!next) return this.endAttack(true);
    this.pool += Math.ceil(this.perAttacker / 2) * this.attackerCount();
    this.warnedQuarter = false;
    this.clockEnd = Math.max(this.clockEnd, host.tick) + next.seconds * TICK_RATE;
    for (const o of next.objectives) o.state = BT_OBJ_ACTIVE;
  }

  /** Defenders on the attackers' side of the line once a sector has fallen: a warning, then it hurts. */
  private fallBack(all: Combatant[]): void {
    const line = this.active > 0 ? this.sector : null;
    for (const c of all) {
      if (c.faction !== this.defenders || !c.alive || !line || !behindLine(line, c.move.pos)) {
        this.behind.delete(c.slot);
        continue;
      }
      const since = this.behind.get(c.slot);
      if (since === undefined) this.behind.set(c.slot, this.host.tick);
      else if (this.host.tick - since >= BT_FALLBACK_SECONDS * TICK_RATE) this.host.hurt?.(c, BT_FALLBACK_DPS / TICK_RATE, 'core.fallback');
    }
  }

  /** The round is over: the attackers took the last sector (`won`) or the defenders held. */
  private endAttack(won: boolean): void {
    const host = this.host;
    this.outcome = won ? BT_ROUND_ATTACKERS : BT_ROUND_DEFENDERS;
    this.behind.clear();
    for (const o of this.objectives) o.action = null;
    host.emit({ e: 'bt', a: 'round', n: this.round, team: won ? this.attackers : this.defenders });
    if (this.round < this.rounds) {
      this.restartAt = host.tick + BT_BREAK_SECONDS * TICK_RATE;
      return;
    }
    host.endRound(this.winner(won));
  }

  /** Who won the match: one round, its winner; two, more sectors taken, then more time left when the last was taken. */
  private winner(lastWon: boolean): string | null {
    if (this.rounds === 1) return lastWon ? this.attackers : this.defenders;
    const [a, b] = this.host.teams.slice(0, 2).map((t) => this.results.get(t.id) ?? { sectors: 0, timeLeft: 0 });
    if (a!.sectors !== b!.sectors) return a!.sectors > b!.sectors ? this.host.teams[0]!.id : this.host.teams[1]!.id;
    if (a!.sectors > 0 && a!.timeLeft !== b!.timeLeft) return a!.timeLeft > b!.timeLeft ? this.host.teams[0]!.id : this.host.teams[1]!.id;
    return null;
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
    for (const c of this.host.combatants()) this.host.respawn(c);
    this.host.emit({ e: 'bt', a: 'start', n: this.round, team: this.attackers });
  }

  onKill(victim: Combatant): void {
    this.behind.delete(victim.slot);
    const host = this.host;
    if (victim.faction === this.defenders) {
      victim.respawnTick = host.tick + Math.round(host.rules.respawnDelayTicks * BT_DEFENDER_RESPAWN);
      return;
    }
    if (victim.faction !== this.attackers || this.outcome !== BT_ROUND_PLAYING || this.restartAt !== null) return;
    if (this.pool <= 0) {
      victim.respawnTick = Infinity;
      return;
    }
    this.pool--;
    const start = this.perAttacker * this.attackerCount();
    if (this.pool === 0) host.emit({ e: 'bt', a: 'pool', n: 0, team: this.attackers });
    else if (!this.warnedQuarter && this.pool <= Math.floor(start / 4)) {
      this.warnedQuarter = true;
      host.emit({ e: 'bt', a: 'pool', n: this.pool, team: this.attackers });
    }
  }

  onLeave(c: Combatant): void {
    this.behind.delete(c.slot);
    this.unarmed.delete(c.slot);
    for (const o of this.objectives) if (o.action?.slot === c.slot) o.action = null;
  }

  /**
   * The playbook's smoke (BreakthroughRoles.smoke): an attacking bot that moves up cover to cover (every style but
   * Arena's and the berserkers', who rush and never bound) carries smoke grenades instead of its frags, so bounding up
   * the beach the moving half screens the open ground it crosses (BotBrain.considerSmoke; docs/BOTS.md, "Smoke"). The
   * rushers keep their frags.
   */
  onSpawn(c: Combatant): void {
    this.behind.delete(c.slot);
    // (A bot being added spawns before it has a brain, and so a style: it is armed at its first input, botInput.)
    if (c.kind === 'bot' && !c.bot) this.unarmed.add(c.slot);
    else this.armSmoke(c);
  }

  private armSmoke(c: Combatant): void {
    const profile = c.bot?.profile;
    if (!ROLES.smoke || c.kind !== 'bot' || !profile || c.throwable?.kind !== 'frag' || this.sideOf(c) !== 'attack') return;
    if (hasTag(profile, 'ARENA') || hasTag(profile, 'BERSERKER')) return;
    c.throwable = { kind: 'smoke', count: Math.min(THROWABLE_DEFS.smoke.max, c.throwable.count) };
  }

  /** Host handoff: the team scores a checkpoint carried (sectors taken). */
  restoreScores(scores: ReadonlyMap<string, number>): void {
    for (const t of this.host.teams) {
      const n = scores.get(t.id);
      if (n !== undefined) this.results.set(t.id, { sectors: n, timeLeft: this.results.get(t.id)?.timeLeft ?? 0 });
    }
  }

  /** Each team's score: the sectors it took attacking. */
  teamScores(): Map<string, number> {
    return new Map(this.host.teams.map((t) => [t.id, this.results.get(t.id)?.sectors ?? 0]));
  }

  /** The time the HUD shows: the sector clock (the break's while sides swap). */
  clock(): number | null {
    if (this.restartAt !== null) return Math.max(0, Math.ceil((this.restartAt - this.host.tick) / TICK_RATE));
    return this.outcome === BT_ROUND_PLAYING ? this.timeLeft : 0;
  }

  snapshot(): ModeSnapshot {
    const host = this.host;
    const tick = host.tick;
    return {
      ts: host.teams.map((t) => this.results.get(t.id)?.sectors ?? 0),
      bt: [
        this.round,
        this.rounds,
        this.attackIndex,
        this.active,
        Math.max(0, this.pool),
        this.outcome === BT_ROUND_PLAYING ? this.timeLeft : 0,
        this.restartAt === null ? 0 : Math.max(0, Math.ceil((this.restartAt - tick) / TICK_RATE)),
        this.outcome,
      ],
      bo: this.objectives.map((o) => {
        const a = o.action;
        const need = (o.state === BT_OBJ_PLANTED ? BT_DEFUSE_SECONDS : BT_PLANT_SECONDS) * TICK_RATE;
        if (o.kind !== 'target') return [o.index, o.state, Math.floor(o.progress * 100), o.presence, -1];
        return [o.index, o.state, a ? Math.min(100, Math.round(((tick - a.start) / need) * 100)) : -1, o.state === BT_OBJ_PLANTED ? Math.max(0, Math.ceil((o.blowAt - tick) / TICK_RATE)) : 0, a?.slot ?? -1];
      }),
      ...(this.behind.size ? { bf: [...this.behind].map(([slot, since]): [number, number] => [slot, Math.max(0, Math.ceil((since + BT_FALLBACK_SECONDS * TICK_RATE - tick) / TICK_RATE))]) } : {}),
    };
  }

  botAwareness(): number {
    return Infinity;
  }

  blocksVehicle(): boolean {
    return false;
  }

  /** Where a side spawns now: its group for the sector in play, else the nearest sector's group for that side (further back for defenders, further forward for attackers first). */
  spawnSpots(c: Combatant): readonly SpawnSpot[] | null {
    const side = this.sideOf(c);
    if (!side || !this.sectors.length) return null;
    const k = Math.min(this.active, this.sectors.length - 1);
    const n = this.sectors.length;
    const order: number[] = [k];
    for (let d = 1; d < n; d++) {
      const fwd = k + d;
      const back = k - d;
      // Defenders fall back to a later sector's group first; attackers keep to an earlier one.
      for (const s of side === 'defend' ? [fwd, back] : [back, fwd]) if (s >= 0 && s < n) order.push(s);
    }
    for (const s of order) {
      const spots = this.groupSpots(s, side);
      if (spots.length) return spots;
    }
    return null;
  }

  /** A spawn group's spots, with spots round its own when it holds too few for its team (each checked for room and ground). */
  private groupSpots(s: number, side: BreakthroughSide): SpawnSpot[] {
    const own = this.sectors[s]!.spawns[side];
    if (!own.length) return own;
    const team = side === 'attack' ? this.attackIndex : 1 - this.attackIndex;
    const players = Math.max(this.host.rules.teamSizes?.[team] ?? 0, this.host.combatants().filter((c) => c.faction === this.host.teams[team]?.id).length);
    if (own.length * GROUP_SHARE >= players) return own;
    const key = `${s}:${side}`;
    let extra = this.extraSpots.get(key);
    if (!extra) {
      extra = [];
      const want = Math.ceil(players / GROUP_SHARE) - own.length;
      const physics = this.host.physics;
      for (const sp of own) {
        for (let k = 0; k < 8 && extra.length < want; k++) {
          const a = sp.yaw + (k * Math.PI) / 4;
          const p = { x: sp.pos.x + Math.sin(a) * 2.5, y: sp.pos.y + 0.6, z: sp.pos.z + Math.cos(a) * 2.5 };
          const ground = this.host.groundBelow(p);
          if (ground === null || Math.abs(ground - sp.pos.y) > 0.7) continue;
          const at = { x: p.x, y: ground, z: p.z };
          if (!physics.headroom({ x: at.x, y: at.y + 0.05, z: at.z }, 1.8)) continue;
          if (!physics.lineOfSight({ x: sp.pos.x, y: sp.pos.y + 1, z: sp.pos.z }, { x: at.x, y: at.y + 1, z: at.z })) continue;
          if (this.host.deadly?.(at)) continue;
          extra.push({ pos: at, yaw: sp.yaw, team: sp.team });
        }
      }
      this.extraSpots.set(key, extra);
    }
    return extra.length ? [...own, ...extra] : own;
  }

  /** Squad spawns: not beside a defender left behind the line. */
  spawnBeside(c: Combatant, mate: Combatant): boolean {
    if (this.sideOf(c) !== 'defend') return true;
    const line = this.active > 0 ? this.sector : null;
    return !line || !behindLine(line, mate.move.pos);
  }

  /** The team brain's brief (bots/teamBrain.ts): the attackers' objective, a group push while the defenders hold it; the playbook. */
  botBrief(team: string): SideBrief | null {
    if (this.outcome !== BT_ROUND_PLAYING || this.restartAt !== null) return null;
    if (team !== this.attackers) return { attack: null, intercept: null, playbook: PLAYBOOK.team };
    const o = this.attackFocus();
    return { attack: o ? { pos: { ...o.pos }, stage: this.held(o) } : null, intercept: null, playbook: PLAYBOOK.team };
  }

  /**
   * The trips the bots make again and again (their corridors are worked out once, at setup): each sector's attackers'
   * spawn group to each of its objectives, and its defenders' group to each (both teams each way when the sides swap).
   */
  botTrips(): readonly BotTripSpec[] {
    const teams = this.host.teams;
    if (teams.length < 2) return [];
    const both = [teams[0]!.id, teams[1]!.id];
    const attack = this.rounds > 1 ? both : [teams[0]!.id];
    const defend = this.rounds > 1 ? both : [teams[1]!.id];
    const out: BotTripSpec[] = [];
    for (const s of this.sectors) {
      // (Its defenders' posts too: their routes are looked up here, at setup, rather than in a tick.)
      this.postsOf(s);
      const from = { attack: groupHome(s.spawns.attack), defend: groupHome(s.spawns.defend) };
      for (const o of s.objectives) {
        if (from.attack) for (const team of attack) out.push({ team, from: from.attack, to: { ...o.pos }, kind: 'attack' });
        if (from.defend) for (const team of defend) out.push({ team, from: from.defend, to: { ...o.pos }, kind: 'defend' });
      }
    }
    return out;
  }

  /**
   * A bot within reach of a target to plant (an attacker, at one still standing in the sector in play) or to defuse (a
   * defender, at a burning charge) holds still, crouched, still shooting, until it is done, as a player would: bots
   * plant and defuse by holding still within reach, and kept to their way (OrderGoal.push) they fight on the move, so
   * one shot at on the target never planted (none in 8 v 8 matches on the Breakthrough Range).
   */
  botInput(c: Combatant, input: PlayerInput): void {
    if (this.unarmed.size && this.unarmed.delete(c.slot)) this.armSmoke(c);
    const sector = this.sector;
    if (!sector || !c.alive || c.mount || this.outcome !== BT_ROUND_PLAYING || this.restartAt !== null) return;
    const side = this.sideOf(c);
    if (!side) return;
    for (const o of sector.objectives) {
      if (o.kind !== 'target' || o.state !== (side === 'attack' ? BT_OBJ_ACTIVE : BT_OBJ_PLANTED)) continue;
      if ((o.action && o.action.slot !== c.slot) || !inObjective(o, c.move.pos)) continue;
      input.forward = 0;
      input.right = 0;
      input.buttons = (input.buttons & ~(BUTTON_JUMP | BUTTON_SPRINT | BUTTON_PRONE)) | BUTTON_CROUCH;
      return;
    }
  }

  /**
   * Breakthrough's bots, by its playbook (docs/BOTS.md, "Breakthrough's playbook"), each by its place and duty in this
   * tick's plan (`plan`). Attackers: one in three guards a burning charge, the rest go for the side's objective (the
   * brief's: the least defended still to take), which the team brain spreads over the sector's ways in groups that
   * bound cover to cover and gather for a push on a held objective; they stand in a zone to capture it, or still at a
   * target to plant. Defenders: one caught behind the line as it fell runs for it; the guns' and the crest's hold their
   * posts (manning the sector's guns, sniping from high ground that sees its objectives); those falling back early go
   * to the next line's trenches, else its objectives; the rest answer the attack (all but one in three rush a burning
   * charge to defuse it, two in three crowd a zone being taken), else hold their trench or sandbags, or the objectives,
   * spread over them. All watch the way the attackers come. Between rounds: roam.
   */
  botGoal(c: Combatant): BotGoal | null {
    const sector = this.sector;
    if (!sector || this.outcome !== BT_ROUND_PLAYING || this.restartAt !== null) return null;
    const side = this.sideOf(c);
    const open = sector.objectives.filter((o) => o.state === BT_OBJ_ACTIVE || o.state === BT_OBJ_PLANTED);
    if (!side || !open.length) return null;
    this.plan();
    const planted = open.filter((o) => o.state === BT_OBJ_PLANTED);
    const guard = (o: BtObjectiveRt): BotGoal => ({ pos: o.pos, radius: Math.max(3, o.radius + 3) });
    const reach = (o: BtObjectiveRt): BotGoal => ({ pos: o.pos, radius: Math.max(0.6, Math.min(1.2, o.radius * 0.4)), push: true });
    if (side === 'attack') {
      const { k } = this.placeOf.get(c.slot) ?? { k: 0 };
      // Enough charges burning to take the sector: everyone guards them; otherwise one in three does.
      const destroyed = sector.objectives.filter((o) => o.kind === 'target' && o.state === BT_OBJ_DONE).length;
      const enough = sector.need > 0 && destroyed + planted.length >= sector.need && sector.objectives.every((o) => o.kind === 'target' || o.state === BT_OBJ_DONE);
      if (planted.length && (enough || k % 3 === 0)) return guard(planted[(enough ? k : Math.floor(k / 3)) % planted.length]!);
      const o = this.attackFocus() ?? open[k % open.length]!;
      if (o.state === BT_OBJ_PLANTED) return guard(o);
      if (o.kind === 'target') return reach(o);
      // A zone: kept to all the way in (held once close, as a King of the Hill hill is, the beach fell in 5 of 8 matches
      // on the Breakthrough Range against 7 of 8).
      return { pos: o.pos, radius: Math.max(1, o.radius * 0.6 - (k % 3) * 0.5), push: true };
    }
    // Left behind the line as it fell (the fall-back warning): run for it, to the nearest of the sector's objectives
    // and the defenders' spawn group, not stopping to fight.
    if (this.behind.has(c.slot)) {
      const home = groupHome(sector.spawns.defend);
      let to: Vec3 | null = null;
      for (const p of [...open.map((o) => o.pos), ...(home ? [home] : [])]) if (!to || horizontalDistance(p, c.move.pos) < horizontalDistance(to, c.move.pos)) to = p;
      if (to) return { pos: to, radius: 3, run: true };
    }
    const { duty, j, a } = this.duty.get(c.slot) ?? { duty: 'hold' as Duty, j: 0, a: 0 };
    const watch = this.attackFrom(sector);
    const posts = this.postsOf(sector);
    const post = (at: readonly Vec3[], radius: number): BotGoal => ({ pos: at[j % at.length]!, radius, watch });
    // (Falling back to the next sector: none after the last, where it holds like the rest; reading past the end threw.)
    const next = duty === 'back' ? this.sectors[this.active + 1] : undefined;
    if (next) {
      const there = this.postsOf(next).trenches;
      if (there.length) return post(there, 1.5);
      const o = next.objectives[j % next.objectives.length]!;
      return { pos: o.pos, radius: Math.max(2, o.radius * 0.8), watch };
    }
    if (duty === 'gun') return post(posts.guns, 2.5);
    if (duty === 'crest') return post(posts.crest, 1.5);
    if (planted.length && a % 3 !== 2) return reach(planted.reduce((x, y) => (horizontalDistance(x.pos, c.move.pos) <= horizontalDistance(y.pos, c.move.pos) ? x : y)));
    const taking = open.filter((o) => o.kind !== 'target' && (o.presence === BT_IN_ATTACKERS || o.presence === BT_IN_BOTH));
    if (taking.length && a % 3 !== 2) {
      const o = taking[a % taking.length]!;
      return { pos: o.pos, radius: Math.max(1, o.radius * 0.5), push: true };
    }
    if (duty === 'trench') return post(posts.trenches, 1.5);
    const o = open[j % open.length]!;
    return { pos: o.pos, radius: o.kind === 'target' ? Math.max(3, o.radius + 3) : Math.max(1.5, o.radius * 0.8), watch };
  }
}
