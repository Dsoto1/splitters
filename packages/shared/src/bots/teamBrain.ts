import { horizontalDistance, type Vec3 } from '../math.ts';
import { TICK_RATE } from '../sim/constants.ts';
import { placeOn, type Corridor, type Trip } from '../nav/corridors.ts';
import type { OrderGoal } from './brain.ts';
import { hasTag, type BotProfile } from './profile.ts';
import { BOT_TRIALS } from './trials.ts';

/**
 * The team brain (docs/BOTS.md, "Team brain"; BOT_AI_PLAN.md Phase B items 2 and 4): once a second per side, from what
 * the mode says about the side (ModeLogic.botBrief: what its attackers go for, and an enemy to cut off), it
 * - splits the side's attackers into groups: a main push, flankers and a recon pair (PLAYBOOK shares);
 * - gives each group a corridor of the trip there (nav/corridors.ts): the main push the cheapest, the flankers
 *   another, the recon pair the third, where the map has them;
 * - prices each corridor by how many teammates are on it (crowd), where teammates died in the last minute (deaths)
 *   and where the side saw enemies lately (sightings, the recon pair's first of all): a team stops feeding one choke,
 *   and loose bots spread out by themselves;
 * - runs group pushes when the mode asks for them (an objective held by the enemy: a flag at its base, a hill they
 *   hold): members coming up from behind (fresh from their spawn) gather at a staging spot on their group's corridor
 *   and go on together, a wave at a time, once most of those on their way have gathered or a while after the first
 *   got there; members already past the spot (a wave's survivors) never fall back to it;
 * - picks interceptors when the mode names an enemy to cut off (our flag carried home): the bots best placed get to
 *   a point ahead of it on its way, rather than everyone chasing it from behind.
 * Bots read their job (BotPlan.job) and the side's trips with their prices (BotPlan.trips) from objects updated in
 * place. A person's order to a bot wins over all of it (that bot is left out). Deterministic: no randomness here.
 */
export type GroupKind = 'main' | 'flank' | 'recon';

/** What a mode tells the team brain about one side (ModeLogic.botBrief), once a second. */
export interface SideBrief {
  /**
   * Where the side's attackers are going (the enemy's flag, the hill), and whether they gather first and go together
   * (a group push: the objective is the enemy's, held or guarded).
   */
  attack: { pos: Vec3; stage: boolean } | null;
  /** An enemy to cut off on its way somewhere (our flag's carrier, going home): where it is, where it's going, who. */
  intercept: { pos: Vec3; to: Vec3; slot: number } | null;
}

/** The team brain's job for one bot (BotPlan.job), refreshed once a second. */
export interface TeamJob {
  group: GroupKind | 'intercept';
  /** The objective its route and staging are for (the bot's own goal must be there for them to apply). */
  to: Vec3 | null;
  /** Its group's corridor to `to`, or null for its own way. */
  route: Corridor | null;
  /** Gather here (on the corridor) until the group goes. */
  stage: Vec3 | null;
  /** A goal of its own instead of the mode's (an interceptor's cut-off point). */
  goal: OrderGoal | null;
}

/** A side's trip with each corridor's price for the next bot to choose (BotPlan.trips). */
export interface PricedTrip {
  readonly trip: Trip;
  /** Each corridor's length × (1 + crowd, deaths and sightings on it), updated once a second. */
  readonly cost: number[];
  readonly crowd: number[];
  readonly deaths: number[];
  readonly seen: number[];
}

/** One member of the side as the team brain sees it (once a second). */
export interface BrainMember {
  slot: number;
  pos: Vec3;
  profile: BotProfile;
  /** The mode's goal for it now (null: none). */
  goal: OrderGoal | null;
  /** The corridor it walks (BotBrain.corridor), for the crowd price. */
  corridor: Corridor | null;
  /** A person ordered it ("Follow me!", "Hold here!"): left out. */
  ordered: boolean;
  /** In a vehicle or on a gun. */
  mounted: boolean;
  /** Where it last saw an enemy, within the last second or so (null: nobody). */
  seen: Vec3 | null;
}

/**
 * The playbook's numbers (BOT_AI_PLAN.md Phase B item 3; per mode in B2): shares of the attackers, staging, timings.
 */
export interface Playbook {
  /** The recon pair (with this many attackers or more: 2; from `reconFrom1`: 1). */
  recon: number;
  reconFrom: number;
  reconFrom1: number;
  /** Flankers: this share of the attackers left after the recon pair, with two corridors or more. */
  flank: number;
  /** Groups only with this many attackers or more. */
  groupsFrom: number;
  /** Staging: this share of the route back from the objective, at least / at most (m). */
  stageShare: number;
  stageMin: number;
  stageMax: number;
  /** A wave goes when this share of the group's members on their way has gathered (at least two)... */
  gathered: number;
  /** ...or this long (s) after the first of them got there. */
  waitAfterFirst: number;
  /** A wave is over (for the scorecard) after this long (s), once half of it is down, or when it got there. */
  pushMost: number;
  /** Interceptors at most, and how far (m) ahead of the enemy on its way they cut it off. */
  interceptors: number;
  cutAhead: number;
  /** Prices: × (1 + crowd × each teammate on it + deaths × each death on it in the last minute + seen × each sighting there lately). */
  crowd: number;
  death: number;
  seen: number;
}

export const DEFAULT_PLAYBOOK: Playbook = {
  recon: 2,
  reconFrom: 6,
  reconFrom1: 4,
  flank: 0.4,
  groupsFrom: 3,
  stageShare: 0.35,
  stageMin: 28,
  stageMax: 60,
  gathered: 0.6,
  waitAfterFirst: 10,
  pushMost: 45,
  interceptors: 3,
  cutAhead: 30,
  crowd: 0.15,
  death: 0.35,
  seen: 0.2,
};

/** Deaths and sightings count against a corridor this close to its route (m), for this long (s). */
const NEAR_ROUTE = 12;
const DEATH_SECONDS = 60;
const SEEN_SECONDS = 20;
/** At most this many deaths and sightings kept per side. */
const MEMORY = 64;
/** An attacker: its goal within this of the side's attack objective (m). */
const SAME_GOAL = 8;
/** A slot not seen alive this long (s) leaves its group (it left the match, or is long dead). */
const FORGET_SECONDS = 30;

interface Group {
  kind: GroupKind;
  /** The corridor it takes (index into the attack trip's corridors), -1 for none. */
  corridor: number;
  /** Its staging spot (null: none, it goes straight on). */
  stage: Vec3 | null;
  /** Members waiting at the staging spot, and since when (tick). */
  readonly waiting: Map<number, number>;
  /** Members sent on with a wave (until they die). */
  readonly sent: Set<number>;
  /** Members now (slots). */
  members: number[];
}

/** A wave that set out (for the scorecard): when, who, how far they had to go (mean, m along the route). */
interface Wave {
  at: number;
  slots: number[];
  from: number;
  corridor: Corridor;
}

/** Group pushes, for the scorecard (bot-report: "pushes"). */
export interface PushStats {
  started: number;
  /** A member got to the objective. */
  reached: number;
  /** Half of those who set out went down first. */
  lostHalf: number;
  /** Metres gained along the route, and seconds pushing, over all pushes. */
  metres: number;
  seconds: number;
}

export class TeamBrain {
  readonly stats: PushStats = { started: 0, reached: 0, lostHalf: 0, metres: 0, seconds: 0 };
  /** The side's trips with their prices (BotPlan.trips: every member reads the same list). */
  readonly trips: PricedTrip[] = [];
  private readonly groupOf = new Map<number, GroupKind>();
  private readonly lastAlive = new Map<number, number>();
  private readonly groups: Record<GroupKind, Group> = {
    main: newGroup('main'),
    flank: newGroup('flank'),
    recon: newGroup('recon'),
  };
  private readonly deaths: { pos: Vec3; tick: number }[] = [];
  private readonly sightings: { pos: Vec3; tick: number }[] = [];
  private readonly waves: Wave[] = [];
  private attackTo: Vec3 | null = null;
  private tripsFor: readonly Trip[] | null = null;

  constructor(readonly playbook: Playbook = DEFAULT_PLAYBOOK) {}

  /** A member of the side died here (the death price of the corridors near it). */
  death(pos: Vec3, tick: number): void {
    this.deaths.push({ pos: { ...pos }, tick });
    if (this.deaths.length > MEMORY) this.deaths.shift();
  }

  /**
   * The side's update, once a second: prices, groups, pushes, interceptors. `trips` are the side's own (the mode's,
   * and spawn to spawn); `all` every side's (an enemy's way home is one of them). Returns each member's job (members
   * without one: null).
   */
  update(tick: number, members: readonly BrainMember[], brief: SideBrief | null, trips: readonly Trip[], all: readonly Trip[]): Map<number, TeamJob | null> {
    const pb = this.playbook;
    const jobs = new Map<number, TeamJob | null>();
    for (const m of members) {
      jobs.set(m.slot, null);
      this.lastAlive.set(m.slot, tick);
      if (m.seen) {
        this.sightings.push({ pos: { ...m.seen }, tick });
        if (this.sightings.length > MEMORY) this.sightings.shift();
      }
    }
    for (const [slot, at] of this.lastAlive) {
      if (tick - at > TICK_RATE * FORGET_SECONDS) {
        this.lastAlive.delete(slot);
        this.groupOf.delete(slot);
      }
    }
    this.price(tick, members, trips);

    // Attackers: going for the side's objective, not under a person's orders, on foot.
    const attack = brief?.attack ?? null;
    const trip = attack ? this.tripTo(attack.pos) : null;
    if (!attack || !this.attackTo || horizontalDistance(this.attackTo, attack.pos) > SAME_GOAL) {
      // A new objective (the hill moved, the flag dropped somewhere): every group starts over.
      this.attackTo = attack ? { ...attack.pos } : null;
      for (const g of Object.values(this.groups)) resetGroup(g);
      this.waves.length = 0;
    }
    const attackers = attack ? members.filter((m) => !m.ordered && !m.mounted && m.goal && !m.goal.run && horizontalDistance(m.goal.pos, attack.pos) < SAME_GOAL && Math.abs(m.goal.pos.y - attack.pos.y) < 4) : [];
    if (attack && trip && trip.trip.corridors.length && attackers.length >= pb.groupsFrom && !BOT_TRIALS.nojobs) this.assign(tick, attackers, attack, trip, jobs);
    else {
      for (const m of attackers) this.groupOf.delete(m.slot);
      for (const g of Object.values(this.groups)) g.members.length = 0;
    }

    // Interceptors: the members best placed to get ahead of the enemy on its way.
    const cut = brief?.intercept ?? null;
    if (cut && !BOT_TRIALS.nointercept) this.intercept(cut, members, all, jobs);
    return jobs;
  }

  /** The side's trip ending at `to` (within SAME_GOAL), if any. */
  private tripTo(to: Vec3): PricedTrip | null {
    for (const t of this.trips) if (horizontalDistance(t.trip.to, to) < SAME_GOAL && Math.abs(t.trip.to.y - to.y) < 4) return t;
    return null;
  }

  /** Each corridor's price: crowd (members on it), deaths in the last minute and sightings lately near its route. */
  private price(tick: number, members: readonly BrainMember[], trips: readonly Trip[]): void {
    const pb = this.playbook;
    if (this.tripsFor !== trips) {
      this.tripsFor = trips;
      this.trips.length = 0;
      for (const t of trips) {
        const n = t.corridors.length;
        this.trips.push({ trip: t, cost: t.corridors.map((c) => c.length), crowd: new Array<number>(n).fill(0), deaths: new Array<number>(n).fill(0), seen: new Array<number>(n).fill(0) });
      }
    }
    while (this.deaths.length && tick - this.deaths[0]!.tick > TICK_RATE * DEATH_SECONDS) this.deaths.shift();
    while (this.sightings.length && tick - this.sightings[0]!.tick > TICK_RATE * SEEN_SECONDS) this.sightings.shift();
    for (const p of this.trips) {
      const cs = p.trip.corridors;
      for (let k = 0; k < cs.length; k++) {
        const c = cs[k]!;
        let crowd = 0;
        for (const m of members) if (m.corridor === c) crowd++;
        let deaths = 0;
        for (const d of this.deaths) if (nearRoute(c, d.pos)) deaths++;
        let seen = 0;
        for (const s of this.sightings) if (nearRoute(c, s.pos)) seen++;
        p.crowd[k] = crowd;
        p.deaths[k] = deaths;
        p.seen[k] = seen;
        p.cost[k] = c.length * (1 + crowd * pb.crowd + deaths * pb.death + Math.min(seen, 6) * pb.seen);
      }
    }
  }

  /** Groups for the attackers, their corridors and pushes; each attacker's job. */
  private assign(tick: number, attackers: readonly BrainMember[], attack: { pos: Vec3; stage: boolean }, trip: PricedTrip, jobs: Map<number, TeamJob | null>): void {
    const pb = this.playbook;
    const ways = trip.trip.corridors.length;
    const n = attackers.length;
    const recon = ways >= 2 ? (n >= pb.reconFrom ? pb.recon : n >= pb.reconFrom1 ? 1 : 0) : 0;
    const flank = ways >= 2 ? Math.round((n - recon) * pb.flank) : 0;
    const want: Record<GroupKind, number> = { main: n - recon - flank, flank, recon };
    // Keep each bot in its group while the group isn't over its size; the rest (and newcomers) fill what's short,
    // the recon pair first from the explorers and lone wolves, the flankers from the aggressive.
    const have: Record<GroupKind, BrainMember[]> = { main: [], flank: [], recon: [] };
    const loose: BrainMember[] = [];
    for (const m of [...attackers].sort((a, b) => a.slot - b.slot)) {
      const g = this.groupOf.get(m.slot);
      if (g && have[g].length < want[g]) have[g].push(m);
      else loose.push(m);
    }
    for (const kind of ['recon', 'flank', 'main'] as const) {
      const short = want[kind] - have[kind].length;
      if (short <= 0) continue;
      loose.sort((a, b) => suits(b.profile, kind) - suits(a.profile, kind) || a.slot - b.slot);
      have[kind].push(...loose.splice(0, short));
    }
    have.main.push(...loose);
    for (const kind of ['main', 'flank', 'recon'] as const) {
      const g = this.groups[kind];
      g.members = have[kind].map((m) => m.slot);
      for (const m of have[kind]) this.groupOf.set(m.slot, kind);
    }
    // Corridors: the main push the cheapest now, the flankers the cheapest other, the recon pair what's left (else the
    // flankers'). Picked again only while nobody of the group is waiting or on its way with a wave, so a push keeps
    // its way.
    const order = trip.cost.map((c, k) => [c, k] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, k]) => k);
    const main = this.groups.main;
    const flk = this.groups.flank;
    const rec = this.groups.recon;
    const settled = (g: Group) => g.corridor >= 0 && g.corridor < ways && (g.waiting.size > 0 || g.sent.size > 0);
    if (!settled(main)) main.corridor = order[0]!;
    if (!settled(flk) || flk.corridor === main.corridor) flk.corridor = order.find((k) => k !== main.corridor) ?? main.corridor;
    rec.corridor = order.find((k) => k !== main.corridor && k !== flk.corridor) ?? flk.corridor;
    const living = new Map(attackers.map((m) => [m.slot, m]));
    for (const kind of ['main', 'flank', 'recon'] as const) {
      const g = this.groups[kind];
      const c = trip.trip.corridors[g.corridor] ?? null;
      // (The dead are out of the wave they went with, and of the waiting: back from their spawn, they gather again.)
      for (const slot of g.sent) if (!living.has(slot)) g.sent.delete(slot);
      for (const slot of g.waiting.keys()) if (!living.has(slot)) g.waiting.delete(slot);
      const ms = g.members.map((slot) => living.get(slot)).filter((m): m is BrainMember => !!m);
      if (!c || !ms.length) {
        resetGroup(g);
        continue;
      }
      // Waves (an objective to take from the enemy): those coming up from behind gather at the staging spot and go on
      // together. The recon pair goes ahead on its own; a group of one just goes.
      g.stage = attack.stage && !BOT_TRIALS.nostage && kind !== 'recon' && g.members.length >= 2 ? stagePoint(c, pb) : null;
      const stage = g.stage;
      const stageAt = (stage ? alongOf(c, stage) : null) ?? 0;
      let behind = 0;
      for (const m of ms) {
        if (!stage || g.sent.has(m.slot)) continue;
        const at = alongOf(c, m.pos);
        // Past the spot already (a wave's survivors, a bot that took its own way): on, never back.
        if (at !== null && at > stageAt + 5) {
          g.waiting.delete(m.slot);
          continue;
        }
        behind++;
        if (horizontalDistance(m.pos, stage) < 15 && Math.abs(m.pos.y - stage.y) < 4) {
          if (!g.waiting.has(m.slot)) g.waiting.set(m.slot, tick);
        } else g.waiting.delete(m.slot);
      }
      if (stage && g.waiting.size) {
        let first = tick;
        for (const at of g.waiting.values()) first = Math.min(first, at);
        const enough = g.waiting.size >= 2 && g.waiting.size >= Math.ceil(behind * pb.gathered);
        if (enough || tick - first >= TICK_RATE * pb.waitAfterFirst) {
          const slots = [...g.waiting.keys()].sort((a, b) => a - b);
          for (const slot of slots) g.sent.add(slot);
          g.waiting.clear();
          this.waves.push({ at: tick, slots, from: meanLeft(slots.map((slot) => living.get(slot)!), c), corridor: c });
          this.stats.started++;
        }
      }
      for (const m of ms) {
        const waits = !!stage && !g.sent.has(m.slot) && (alongOf(c, m.pos) ?? 0) <= stageAt + 5;
        jobs.set(m.slot, { group: kind, to: { ...trip.trip.to }, route: c, stage: waits ? stage : null, goal: null });
      }
    }
    this.followWaves(tick, attack.pos, living);
  }

  /**
   * Waves under way, for the scorecard: one that got a member to the objective reached it; one that lost half of those
   * who set out first, or ran past PUSH_MOST, is spent. Metres gained along the route and seconds go to the totals.
   */
  private followWaves(tick: number, to: Vec3, living: ReadonlyMap<number, BrainMember>): void {
    const pb = this.playbook;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]!;
      const alive = w.slots.map((s) => living.get(s)).filter((m): m is BrainMember => !!m);
      const reached = alive.some((m) => horizontalDistance(m.pos, to) < 10 && Math.abs(m.pos.y - to.y) < 4);
      const lost = alive.length * 2 <= w.slots.length;
      if (!reached && !lost && tick - w.at < TICK_RATE * pb.pushMost) continue;
      if (reached) this.stats.reached++;
      else if (lost) this.stats.lostHalf++;
      this.stats.metres += Math.max(0, w.from - (reached || !alive.length ? 0 : meanLeft(alive, w.corridor)));
      this.stats.seconds += (tick - w.at) / TICK_RATE;
      this.waves.splice(i, 1);
    }
  }

  /**
   * Interceptors: up to `interceptors` members not right on the enemy (those chase it as the mode says), the nearest to
   * a point `cutAhead` m ahead of it on its way (the corridor of a trip to where it's going it's nearest), get there
   * instead; past that point (or close to it already), straight at the enemy.
   */
  private intercept(cut: { pos: Vec3; to: Vec3; slot: number }, members: readonly BrainMember[], all: readonly Trip[], jobs: Map<number, TeamJob | null>): void {
    const pb = this.playbook;
    let ahead: Vec3 = { ...cut.to };
    let best = Infinity;
    for (const t of all) {
      if (horizontalDistance(t.to, cut.to) > 12) continue;
      for (const c of t.corridors) {
        const at = placeOn(c, cut.pos);
        if (at.at < 0 || at.off >= best || at.off > 25) continue;
        best = at.off;
        let k = at.at;
        while (k < c.line.length - 1 && c.lineAt[k]! - c.lineAt[at.at]! < pb.cutAhead) k++;
        ahead = { ...c.line[k]! };
      }
    }
    const picks = members
      .filter((m) => !m.ordered && !m.mounted && !m.goal?.run && horizontalDistance(m.pos, cut.pos) > 20)
      .map((m) => ({ m, d: horizontalDistance(m.pos, ahead) + Math.abs(m.pos.y - ahead.y) * 2 }))
      .filter((x) => x.d < horizontalDistance(x.m.pos, cut.pos) + 40)
      .sort((a, b) => a.d - b.d || a.m.slot - b.m.slot)
      .slice(0, pb.interceptors);
    for (const { m, d } of picks) {
      // Close to the cut-off point, or the enemy already nearer its goal than the point is: at the enemy.
      const at = d < 10 || horizontalDistance(cut.pos, cut.to) < horizontalDistance(ahead, cut.to) ? cut.pos : ahead;
      jobs.set(m.slot, { group: 'intercept', to: null, route: null, stage: null, goal: { pos: { ...at }, radius: at === cut.pos ? 1.5 : 3, push: true } });
    }
  }

  /** Groups now (tests and the debug view): each one's corridor, staging spot, members, who waits there and who went on. */
  groupsNow(): { kind: GroupKind; corridor: number; stage: Vec3 | null; members: readonly number[]; waiting: readonly number[]; sent: readonly number[] }[] {
    return Object.values(this.groups).map((g) => ({ kind: g.kind, corridor: g.corridor, stage: g.stage, members: [...g.members], waiting: [...g.waiting.keys()], sent: [...g.sent] }));
  }
}

function newGroup(kind: GroupKind): Group {
  return { kind, corridor: -1, stage: null, waiting: new Map(), sent: new Set(), members: [] };
}

function resetGroup(g: Group): void {
  g.stage = null;
  g.waiting.clear();
  g.sent.clear();
}

/** How far along a corridor's route a point is (m), when it is within 30 m of it; null otherwise. */
function alongOf(c: Corridor, p: Vec3): number | null {
  const at = placeOn(c, p);
  return at.at < 0 || at.off > 30 ? null : c.lineAt[at.at]!;
}

/** Within NEAR_ROUTE of a corridor's route (a few dozen checks). */
function nearRoute(c: Corridor, p: Vec3): boolean {
  return placeOn(c, p).off < NEAR_ROUTE;
}

/** The staging spot on a corridor: back from the objective by a share of the route (within the playbook's bounds). */
function stagePoint(c: Corridor, pb: Playbook): Vec3 {
  const back = Math.min(pb.stageMax, Math.max(pb.stageMin, c.length * pb.stageShare));
  const end = c.lineAt[c.lineAt.length - 1]!;
  let k = c.line.length - 1;
  while (k > 0 && end - c.lineAt[k]! < back) k--;
  return { ...c.line[k]! };
}

/** The members' mean distance still to go along a corridor (m), of those on it (within 30 m of its route). */
function meanLeft(ms: readonly BrainMember[], c: Corridor): number {
  const end = c.lineAt[c.lineAt.length - 1]!;
  let sum = 0;
  let n = 0;
  for (const m of ms) {
    const at = alongOf(c, m.pos);
    if (at === null) continue;
    sum += end - at;
    n++;
  }
  return n ? sum / n : c.length;
}

/** How well a bot suits a group: recon explorers and lone wolves, flankers the aggressive and the quick. */
function suits(p: BotProfile, kind: GroupKind): number {
  if (kind === 'recon') return p.exploration + (hasTag(p, 'EXPLORER') ? 60 : 0) + (hasTag(p, 'LONE_WOLF') ? 50 : 0) + (hasTag(p, 'ARENA') ? 15 : 0) - (hasTag(p, 'BERSERKER') ? 40 : 0);
  if (kind === 'flank') return p.aggression * 0.6 + p.exploration * 0.4 + (hasTag(p, 'LONE_WOLF') ? 30 : 0);
  return 0;
}
