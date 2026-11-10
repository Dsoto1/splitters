import { createRng, horizontalDistance, type Vec3 } from '../math.ts';
import { TICK_RATE } from '../sim/constants.ts';
import type { Corridor, Trip } from '../nav/corridors.ts';
import type { OrderGoal } from './brain.ts';
import { laneWaypoint } from './explore.ts';
import { hasTag, type BotProfile, type BotStyle } from './profile.ts';
import { RegionMap, type RegionLayout } from './regions.ts';
import { TeamBrain, type PricedTrip, type PushStats, type SideBrief, type TeamJob } from './teamBrain.ts';
import type { VantageBoard } from './vantage.ts';

/**
 * Match-level bot planning (docs/BOTS.md): roles, squads ("clusters") and
 * each side's map knowledge. Everything here runs at low rate (Match: about
 * once a second per side) or when the roster changes; bots read the result
 * from their view's `plan` (the same objects, updated in place).
 */
export type BotRole = 'squad' | 'camper' | 'sniper' | 'lone_wolf';

/** A squad as its members see it (one object per squad, shared by its members). */
export interface ClusterView {
  id: number;
  /** The member leading (its slot), and where it was at the last update. */
  leader: number;
  leaderPos: Vec3;
  /** Where the squad is heading, and the waypoint it goes by (its route). */
  goal: Vec3 | null;
  via: Vec3 | null;
  size: number;
  /** The leader is fighting: members not in a fight of their own close in. */
  leaderBusy: boolean;
  /** Someone has fallen behind: the leader eases off. */
  lagging: boolean;
  /** How far apart members keep (m): grunts close, the rest looser. */
  spacing: number;
  /** Its way to the goal: a corridor of the side's trip to the enemy (route variety), or null (`via`, or straight). */
  route: Corridor | null;
}

/** What a bot reads of the match's planning (the same object every tick, updated in place). */
export interface BotPlan {
  role: BotRole;
  cluster: ClusterView | null;
  /** The bot's side's region knowledge (null without teams' worth of information, e.g. NPCs). */
  regions: RegionMap | null;
  /** Vantage spots for campers and snipers (null when nobody in the match needs them). */
  vantage: VantageBoard | null;
  /** The enemy's side of the map (team modes), for pushing forward; null otherwise. */
  towards: readonly Vec3[] | null;
  /** The team brain's job for it (teamBrain.ts: its group, corridor and staging, or a cut-off point); null: none. */
  job: TeamJob | null;
  /** The side's common trips, each corridor priced (crowd, deaths, sightings): a loose bot takes the cheapest. */
  trips: readonly PricedTrip[];
}

/** One member as the match reports it to the director. */
export interface DirectorMember {
  slot: number;
  pos: Vec3;
  /** Has a target (or just had one). */
  fighting: boolean;
  /** Where the enemy it fights was last seen (for the squad to close in on). */
  enemyAt: Vec3 | null;
  /** May join a squad (alive Player Bot on foot, playing the 'squad' role, under nobody's orders). */
  free: boolean;
  /** Leads the team (rules.leaders): leads its squad too. */
  teamLeader: boolean;
  profile: BotProfile;
  /** The mode's goal for it now (null: none), the corridor it walks, whether a person ordered it, whether it rides or mans something, what it saw lately. */
  goal?: OrderGoal | null;
  corridor?: Corridor | null;
  ordered?: boolean;
  mounted?: boolean;
  seen?: Vec3 | null;
  /** Fireteams (Part 2): a bot-led squad's member takes its leader's job (this slot's), so the squad plays one play. */
  unit?: number;
}

/** Squads only in matches this big (players), and only from this many free bots on a side. */
export const CLUSTER_MIN_PLAYERS = 16;
const CLUSTER_MIN_FREE = 6;
/** A member further than this from its leader leaves the squad (m); a bot joins one whose leader is within JOIN_RADIUS. */
const LEAVE_RADIUS = 60;
const JOIN_RADIUS = 30;
const GATHER_RADIUS = 25;
/** A squad still this much closer (m) to its goal when its time there is up keeps the goal. */
const GOAL_PROGRESS = 15;
/** Roles (other than tag-driven sniping) only for matches with this many Player Bots. */
export const ROLE_MIN_BOTS = 6;

interface Cluster {
  view: ClusterView;
  members: number[];
  goalUntil: number;
  region: number;
  /** The leader's distance from the goal when it was picked (or last given more time). */
  goalDist: number;
}

/** Share of the Player Bots that may play each role, by match style (campers stay a small minority: GUNPLAY_DIRECTION, fun over mil-sim). */
const ROLE_SHARE: Record<BotStyle, Record<Exclude<BotRole, 'squad'>, number>> = {
  mixed: { camper: 0.08, sniper: 0.1, lone_wolf: 0.1 },
  arena: { camper: 0.03, sniper: 0.05, lone_wolf: 0.12 },
  tactical: { camper: 0.14, sniper: 0.14, lone_wolf: 0.06 },
};

/**
 * Roles for a match's Player Bots, deterministic by slot and seed: tags first
 * (CAMPER, SNIPER, LONE_WOLF), then the personalities that suit a role best,
 * each role capped at its share of the bots for the style. Everyone else
 * plays 'squad'. Snipers need SNIPER (or a long range preference); berserkers
 * never camp. Matches under ROLE_MIN_BOTS bots have no roles (duels and small
 * games play as before).
 */
export function assignRoles(bots: readonly { slot: number; profile: BotProfile }[], style: BotStyle, seed: number): Map<number, BotRole> {
  const out = new Map<number, BotRole>();
  for (const b of bots) out.set(b.slot, 'squad');
  const n = bots.length;
  const share = ROLE_SHARE[style];
  const hash = (slot: number) => createRng((seed * 31 + slot * 977) >>> 0)() * 0.5;
  const fill = (role: Exclude<BotRole, 'squad'>, suit: (p: BotProfile) => number) => {
    const cap = n < ROLE_MIN_BOTS ? 0 : Math.max(0, Math.floor(n * share[role]));
    const cands = bots
      .filter((b) => out.get(b.slot) === 'squad' && suit(b.profile) > 0)
      .map((b) => ({ b, s: suit(b.profile) + hash(b.slot) }))
      .sort((x, y) => y.s - x.s || x.b.slot - y.b.slot);
    for (const { b } of cands.slice(0, cap)) out.set(b.slot, role);
  };
  fill('sniper', (p) => (hasTag(p, 'BERSERKER') ? 0 : hasTag(p, 'SNIPER') ? 2 + p.rangePreference / 100 : p.rangePreference >= 80 ? p.rangePreference / 100 : 0));
  fill('camper', (p) => (hasTag(p, 'BERSERKER') || hasTag(p, 'RECKLESS') ? 0 : hasTag(p, 'CAMPER') ? 3 : (p.selfPreservation + (100 - p.aggression) + p.tacticalAwareness - p.exploration) / 200 - 0.4));
  fill('lone_wolf', (p) => (hasTag(p, 'LONE_WOLF') ? 3 : hasTag(p, 'EXPLORER') ? 1 + p.exploration / 100 : p.exploration >= 75 && p.teamLoyalty <= 50 ? 0.5 : 0));
  return out;
}

/**
 * Squads, roles and side knowledge for one match. `update` once a second per
 * side (Match.runBots, staggered by side) is all the per-tick cost: squads
 * form from free bots close together (3–6, by the side's size), keep a
 * leader, pick a shared goal (a region the side hasn't seen lately, toward
 * the enemy, not another squad's) and a route (a waypoint off to one side,
 * different per squad), and re-pick when the leader gets there or after a
 * while. Members follow loosely (BotBrain), fight on their own, and regroup.
 */
export class BotDirector {
  private readonly plans = new Map<number, BotPlan>();
  private readonly sides = new Map<string, RegionMap>();
  private readonly clusters = new Map<string, Cluster[]>();
  /** Each side's team brain (teamBrain.ts). */
  private readonly brains = new Map<string, TeamBrain>();
  private readonly rng: () => number;
  private nextId = 1;
  vantage: VantageBoard | null = null;

  constructor(
    seed: number,
    private readonly layout: RegionLayout,
    private readonly places: readonly Vec3[],
    /** Whether one eye point sees another (the match's physics), for the team brains' staging spots. */
    private readonly sees: ((a: Vec3, b: Vec3) => boolean) | null = null,
  ) {
    this.rng = createRng((seed * 2246822519 + 3266489917) >>> 0);
  }

  /** The bot's plan (created on first use; the same object for the whole match). */
  planFor(slot: number): BotPlan {
    let p = this.plans.get(slot);
    if (!p) this.plans.set(slot, (p = { role: 'squad', cluster: null, regions: null, vantage: this.vantage, towards: null, job: null, trips: NO_TRIPS }));
    return p;
  }

  /** A side's team brain (made on first use). */
  brainFor(side: string): TeamBrain {
    let b = this.brains.get(side);
    if (!b) this.brains.set(side, (b = new TeamBrain(undefined, this.sees)));
    return b;
  }

  /** Someone on `side` died here: the team brain prices the corridors near it up for a minute. */
  noteDeath(side: string, pos: Vec3, tick: number): void {
    this.brainFor(side).death(pos, tick);
  }

  /** A side's group pushes so far (measuring: bot-report). */
  pushStats(side: string): PushStats | null {
    return this.brains.get(side)?.stats ?? null;
  }

  setRole(slot: number, role: BotRole): void {
    this.planFor(slot).role = role;
  }

  /** A bot's role, if it has a plan (measuring: bot-report). */
  roleOf(slot: number): BotRole | null {
    return this.plans.get(slot)?.role ?? null;
  }

  /** A side's region knowledge. */
  regionsFor(side: string): RegionMap {
    let r = this.sides.get(side);
    if (!r) this.sides.set(side, (r = new RegionMap(this.layout)));
    return r;
  }

  /** A bot left the match (or was replaced): out of its squad. */
  forget(slot: number): void {
    this.plans.delete(slot);
    for (const list of this.clusters.values()) for (const c of list) c.members = c.members.filter((m) => m !== slot);
  }

  /**
   * One side's update: region knowledge from where everyone on it stands
   * (`everyone`), then squads from its free bots. `alert` tells a squad member
   * where its busy leader's enemy is.
   */
  update(tick: number, side: string, everyone: readonly Vec3[], members: readonly DirectorMember[], towards: readonly Vec3[] | null, squads: boolean, alert: (slot: number, at: Vec3) => void, brief: SideBrief | null = null, trips: readonly Trip[] = [], allTrips: readonly Trip[] = trips, fixed: readonly (readonly number[])[] | null = null): void {
    const regions = this.regionsFor(side);
    regions.update(everyone, tick);
    for (const m of members) if (m.enemyAt) regions.contact(m.enemyAt, tick + TICK_RATE * 20);
    // The team brain: prices, groups and pushes, interceptors (a person's orders win: those bots are left out).
    const brain = this.brainFor(side);
    const jobs = brain.update(
      tick,
      members.map((m) => ({ slot: m.slot, pos: m.pos, profile: m.profile, goal: m.goal ?? null, corridor: m.corridor ?? null, ordered: !!m.ordered, mounted: !!m.mounted, seen: m.seen ?? null })),
      brief,
      trips,
      allTrips,
    );
    for (const m of members) {
      const plan = this.planFor(m.slot);
      plan.regions = regions;
      plan.towards = towards;
      plan.vantage = this.vantage;
      plan.job = (m.unit !== undefined ? jobs.get(m.unit) : undefined) ?? jobs.get(m.slot) ?? null;
      plan.trips = brain.trips;
    }
    let list = this.clusters.get(side);
    if (!list) this.clusters.set(side, (list = []));
    let free = new Map<number, DirectorMember>();
    for (const m of members) if (m.free) free.set(m.slot, m);
    if (!squads || (!fixed && free.size < CLUSTER_MIN_FREE)) {
      for (const m of members) this.planFor(m.slot).cluster = null;
      list.length = 0;
      return;
    }
    if (fixed) {
      // Fireteams: the squads are fixed (sim/fireteams.ts), each bot-led one given as [leader, ...members alive]; the
      // director keeps only their goals and routes (and its alerts), so a bot-led squad plays the same pushes.
      free = new Map(members.map((m) => [m.slot, m]));
      list = this.fixedClusters(list, fixed, free);
    } else list = this.formClusters(list, free);
    this.clusters.set(side, list);
    this.directClusters(tick, list, free, members, regions, towards, brain, alert);
  }

  /** Fireteams' bot-led squads as the director's clusters (the same cluster for the same leader, for its goal). */
  private fixedClusters(list: Cluster[], fixed: readonly (readonly number[])[], pool: ReadonlyMap<number, DirectorMember>): Cluster[] {
    const byLeader = new Map(list.map((c) => [c.view.leader, c]));
    const out: Cluster[] = [];
    for (const g of fixed) {
      const lead = pool.get(g[0]!);
      const ms = g.filter((s) => pool.has(s));
      if (!lead || ms.length < 2) continue;
      const c = byLeader.get(lead.slot) ?? { view: { id: this.nextId++, leader: lead.slot, leaderPos: { ...lead.pos }, goal: null, via: null, size: ms.length, leaderBusy: false, lagging: false, spacing: 3, route: null }, members: [], goalUntil: 0, region: -1, goalDist: Infinity };
      c.members = ms;
      out.push(c);
    }
    return out;
  }

  /** Squads from free bots close together (the usual way): keep, re-lead, break up, join, gather. */
  private formClusters(list: Cluster[], free: ReadonlyMap<number, DirectorMember>): Cluster[] {
    const maxSize = free.size >= 30 ? 6 : free.size >= 16 ? 5 : 4;
    const assigned = new Set<number>();
    // Existing squads: keep members still free and near their leader; a new leader when the old one is gone.
    for (const c of list) {
      let leader = free.get(c.view.leader);
      const kept = c.members.filter((s) => free.has(s));
      if (!leader && kept.length) leader = kept.map((s) => free.get(s)!).sort((a, b) => leadScore(b) - leadScore(a) || a.slot - b.slot)[0];
      c.members = leader ? kept.filter((s) => s === leader!.slot || horizontalDistance(free.get(s)!.pos, leader!.pos) < LEAVE_RADIUS) : [];
      // A team leader (rules.leaders) in the squad leads it.
      const boss = c.members.map((s) => free.get(s)!).find((m) => m.teamLeader);
      if (boss) leader = boss;
      if (leader) c.view.leader = leader.slot;
      for (const s of c.members) assigned.add(s);
    }
    // Squads of one break up (the bot finds another or roams alone).
    for (const c of list) {
      if (c.members.length < 2) {
        for (const s of c.members) assigned.delete(s);
        c.members = [];
      }
    }
    list = list.filter((c) => c.members.length > 0);
    // Free bots join a squad nearby with room, or gather the free bots round them into a new one.
    const loose = [...free.values()].filter((m) => !assigned.has(m.slot)).sort((a, b) => a.slot - b.slot);
    for (const m of loose) {
      if (assigned.has(m.slot)) continue;
      let join: Cluster | null = null;
      let joinD = JOIN_RADIUS;
      for (const c of list) {
        if (c.members.length >= maxSize) continue;
        const l = free.get(c.view.leader);
        const d = l ? horizontalDistance(l.pos, m.pos) : Infinity;
        if (d < joinD) {
          joinD = d;
          join = c;
        }
      }
      if (join) {
        join.members.push(m.slot);
        assigned.add(m.slot);
        continue;
      }
      const near = loose.filter((o) => o !== m && !assigned.has(o.slot) && horizontalDistance(o.pos, m.pos) < GATHER_RADIUS).sort((a, b) => horizontalDistance(a.pos, m.pos) - horizontalDistance(b.pos, m.pos) || a.slot - b.slot);
      if (!near.length) continue;
      const group = [m, ...near.slice(0, maxSize - 1)];
      const leader = group.slice().sort((a, b) => leadScore(b) - leadScore(a) || a.slot - b.slot)[0]!;
      const c: Cluster = {
        view: { id: this.nextId++, leader: leader.slot, leaderPos: { ...leader.pos }, goal: null, via: null, size: group.length, leaderBusy: false, lagging: false, spacing: 3, route: null },
        members: group.map((g) => g.slot),
        goalUntil: 0,
        region: -1,
        goalDist: Infinity,
      };
      for (const g of group) assigned.add(g.slot);
      list.push(c);
    }
    return list;
  }

  /** Each squad: where its leader is, whether it fights, whether someone lags; a new goal when due. */
  private directClusters(tick: number, list: readonly Cluster[], free: ReadonlyMap<number, DirectorMember>, members: readonly DirectorMember[], regions: RegionMap, towards: readonly Vec3[] | null, brain: TeamBrain, alert: (slot: number, at: Vec3) => void): void {
    for (const m of members) this.planFor(m.slot).cluster = null;
    let lane = 0;
    for (const c of list) {
      const leader = free.get(c.view.leader)!;
      const v = c.view;
      v.leaderPos.x = leader.pos.x;
      v.leaderPos.y = leader.pos.y;
      v.leaderPos.z = leader.pos.z;
      v.size = c.members.length;
      v.leaderBusy = leader.fighting;
      v.lagging = c.members.some((s) => horizontalDistance(free.get(s)!.pos, leader.pos) > 22);
      v.spacing = c.members.every((s) => hasTag(free.get(s)!.profile, 'GRUNT')) ? 2 : 3.5;
      // Time up on a goal the squad is still closing on (a far enemy spawn on a big map): more time, not a new goal.
      // Re-picking on the timer alone swung squads from one far goal to another every 20-35 s (zig-zags, no push).
      if (v.goal && tick >= c.goalUntil) {
        const d = horizontalDistance(leader.pos, v.goal);
        if (d < c.goalDist - GOAL_PROGRESS) {
          c.goalDist = d;
          c.goalUntil = tick + Math.round(TICK_RATE * (15 + this.rng() * 10));
          regions.claim(c.region, c.goalUntil);
        }
      }
      // There: the leader, or half the squad (members waiting at the goal for a leader held up by a fight or a pickup
      // shouldn't wait out the timer; the next goal keeps the push going).
      const arrived = !!v.goal && (horizontalDistance(leader.pos, v.goal) < 12 || c.members.filter((m) => horizontalDistance(free.get(m)!.pos, v.goal!) < 12).length * 2 >= c.members.length);
      if (!v.goal || arrived || tick >= c.goalUntil) {
        // Half the time straight for the enemy's side (a spawn point of theirs: fights keep happening), else a
        // region the side hasn't seen lately; either way by a route of the squad's own.
        const toEnemy = !!towards?.length && this.rng() < 0.5;
        const pick = toEnemy ? this.enemySide(towards!, list, c) : regions.pick({ from: leader.pos, tick, rng: this.rng, ideal: 70, novelty: 1, crowd: 0.6, towards, push: 1.8, avoidClaimed: true, contact: 1.2, samples: 32 });
        if (pick) {
          v.goal = pick.pos;
          c.region = pick.region;
          c.goalUntil = tick + Math.round(TICK_RATE * (20 + this.rng() * 15));
          c.goalDist = horizontalDistance(leader.pos, pick.pos);
          regions.claim(pick.region, c.goalUntil);
          // Squads spread over the routes: toward the enemy's side, the cheapest corridor of the side's trip there that
          // no other squad is on (route variety: crowd, deaths, sightings); elsewhere each takes a different side of
          // the straight line (and some the middle).
          v.route = toEnemy ? squadRoute(brain.trips, pick.pos, list, c) : null;
          const l = ((c.view.id + lane++) % 3) - 1;
          v.via = v.route || l === 0 ? null : laneWaypoint(this.places, leader.pos, pick.pos, l);
        }
      }
      for (const s of c.members) {
        this.planFor(s).cluster = v;
        // The leader is in a fight: the others not in one go and help.
        const mm = free.get(s)!;
        if (v.leaderBusy && s !== leader.slot && !mm.fighting && leader.enemyAt && horizontalDistance(mm.pos, leader.pos) < 45) alert(s, leader.enemyAt);
      }
    }
  }

  /** One of the enemy's spawn points no other squad of the side is heading for (if there is one), as a goal. */
  private enemySide(towards: readonly Vec3[], squads: readonly Cluster[], self: Cluster): { pos: Vec3; region: number } {
    const start = Math.floor(this.rng() * towards.length);
    let p = towards[start]!;
    for (let k = 0; k < towards.length; k++) {
      const q = towards[(start + k) % towards.length]!;
      if (!squads.some((o) => o !== self && o.view.goal && horizontalDistance(o.view.goal, q) < 3)) {
        p = q;
        break;
      }
    }
    return { pos: { ...p }, region: -1 };
  }

  /** Squads on a side (tests and the debug overlay). */
  squads(side: string): { leader: number; members: readonly number[]; goal: Vec3 | null }[] {
    return (this.clusters.get(side) ?? []).map((c) => ({ leader: c.view.leader, members: c.members, goal: c.view.goal }));
  }
}

const NO_TRIPS: readonly PricedTrip[] = [];

/**
 * A squad's corridor toward a goal on the enemy's side: of the side's trip ending nearest it (within 40 m), the
 * cheapest corridor (crowd, deaths and sightings priced in), one another squad is on counting double.
 */
function squadRoute(trips: readonly PricedTrip[], goal: Vec3, squads: readonly Cluster[], self: Cluster): Corridor | null {
  let best: PricedTrip | null = null;
  let bestD = 40;
  for (const t of trips) {
    const d = horizontalDistance(t.trip.to, goal);
    if (d < bestD && t.trip.corridors.length) {
      bestD = d;
      best = t;
    }
  }
  if (!best) return null;
  let pick = -1;
  let low = Infinity;
  best.trip.corridors.forEach((c, k) => {
    const taken = squads.some((o) => o !== self && o.view.route === c);
    const cost = best!.cost[k]! * (taken ? 2 : 1);
    if (cost < low) {
      low = cost;
      pick = k;
    }
  });
  return pick >= 0 ? best.trip.corridors[pick]! : null;
}

/** How well a bot leads by its personality (loyalty, tactical sense; a coward last): squads here and Fireteams' bot leaders. */
export const leadAbility = (p: BotProfile): number => p.teamLoyalty + p.tacticalAwareness + (hasTag(p, 'TACTICAL') ? 20 : 0) - (hasTag(p, 'COWARD') ? 500 : 0);

/** Who leads a squad: the team's leader always; a coward only when nobody else is in it. */
const leadScore = (m: DirectorMember): number => (m.teamLeader ? 1000 : 0) + leadAbility(m.profile);
