import { horizontalDistance, type Vec3 } from '../math.ts';
import { TICK_RATE } from '../sim/constants.ts';
import { placeOn, type Corridor, type Trip } from '../nav/corridors.ts';
import type { OrderGoal } from './brain.ts';
import { hasTag, type BotProfile } from './profile.ts';

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
  /** The mode's playbook (its numbers; DEFAULT_PLAYBOOK's when absent). */
  playbook?: Playbook;
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
  /** Corridors for the groups: at most this many times as long as the shortest, plus 20 m. */
  stretch: number;
  /** Groups only with this many attackers or more... */
  groupsFrom: number;
  /**
   * ...on a trip whose shortest way is this long or more (m), with two ways at most `stretch` times as long (plus 20 m):
   * on a shorter trip each bot takes its own lane (split over the ways on every map, Capture the Flag lost a third of
   * its captures on the dev sample).
   */
  groupsFromLength: number;
  /**
   * When the attackers split over the corridors: always, or only for a group push (`attack.stage`: retaking a hill the
   * enemy holds; going for one nobody holds, everyone goes straight, a detour costs hill time).
   */
  split: 'always' | 'push' | 'never';
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
  /** Every group waiting at its staging spot goes as soon as one does (a push from different ways at once). */
  together: boolean;
  /**
   * Interceptors at most (none by default), and how far (m) ahead of the enemy on its way they cut it off. Three, in
   * Capture the Flag, were the attackers of the side whose flag was taken: its attack stopped while they waited on the
   * carrier's way, and carriers rarely got home (Diamond Park's first capture in 3 of 6 five-minute matches, against 6
   * of 6 without; one interceptor, 5 of 6).
   */
  interceptors: number;
  cutAhead: number;
  /** Prices: × (1 + crowd × each teammate on it + deaths × each death on it in the last minute + seen × each sighting there lately). */
  crowd: number;
  death: number;
  seen: number;
}

export const DEFAULT_PLAYBOOK: Playbook = {
  recon: 2,
  split: 'always',
  reconFrom: 6,
  reconFrom1: 4,
  flank: 0.3,
  stretch: 1.35,
  groupsFrom: 3,
  groupsFromLength: 180,
  stageShare: 0.35,
  stageMin: 28,
  stageMax: 60,
  gathered: 0.6,
  waitAfterFirst: 10,
  pushMost: 45,
  together: true,
  interceptors: 0,
  cutAhead: 30,
  crowd: 0.15,
  death: 0.35,
  seen: 0.2,
};

/** A bot on its way to its staging spot this long (s) without getting there goes on (a spot it can't reach, a fight). */
const STAGE_PATIENCE = 25;
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
  /** The corridor (of the attack trip) each attacker set out on: kept until it dies or stops attacking. */
  private readonly ways = new Map<number, number>();
  /** Since when (tick) each attacker has been on its way to its staging spot without getting there. */
  private readonly staging = new Map<number, number>();
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

  /** The playbook this update plays by (the mode's, from its brief, or the brain's own). */
  private pb: Playbook;
  /** Staging spots worked out per corridor (stagePoint: a few sight lines each, once). */
  private readonly stages = new Map<Corridor, Vec3>();

  /**
   * `sees`: whether one eye point sees another (the match's physics; without it, staging spots are picked by distance
   * alone).
   */
  constructor(
    readonly playbook: Playbook = DEFAULT_PLAYBOOK,
    private readonly sees: ((a: Vec3, b: Vec3) => boolean) | null = null,
  ) {
    this.pb = playbook;
  }

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
    this.pb = brief?.playbook ?? this.playbook;
    const pb = this.pb;
    const jobs = new Map<number, TeamJob | null>();
    for (const m of members) {
      jobs.set(m.slot, null);
      this.lastAlive.set(m.slot, tick);
      if (m.seen) {
        // (The recon pair's reports count twice: what it sees ahead on a side route is what the groups behind it need.)
        for (let k = this.groupOf.get(m.slot) === 'recon' ? 2 : 1; k > 0; k--) this.sightings.push({ pos: { ...m.seen }, tick });
        while (this.sightings.length > MEMORY) this.sightings.shift();
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
      this.ways.clear();
      this.waves.length = 0;
    }
    const attackers = attack ? members.filter((m) => !m.ordered && !m.mounted && m.goal && !m.goal.run && horizontalDistance(m.goal.pos, attack.pos) < SAME_GOAL && Math.abs(m.goal.pos.y - attack.pos.y) < 4) : [];
    if (attack && trip && trip.trip.corridors.length && attackers.length >= pb.groupsFrom && (pb.split === 'always' || (pb.split === 'push' && attack.stage))) this.assign(tick, attackers, attack, trip, jobs);
    else {
      for (const m of attackers) this.groupOf.delete(m.slot);
      for (const g of Object.values(this.groups)) g.members.length = 0;
    }

    // Interceptors: the members best placed to get ahead of the enemy on its way.
    const cut = brief?.intercept ?? null;
    if (cut && pb.interceptors > 0) this.intercept(cut, members, all, jobs);
    return jobs;
  }

  /** The side's trip ending at `to` (within SAME_GOAL), if any. */
  private tripTo(to: Vec3): PricedTrip | null {
    for (const t of this.trips) if (horizontalDistance(t.trip.to, to) < SAME_GOAL && Math.abs(t.trip.to.y - to.y) < 4) return t;
    return null;
  }

  /** Each corridor's price: crowd (members on it), deaths in the last minute and sightings lately near its route. */
  private price(tick: number, members: readonly BrainMember[], trips: readonly Trip[]): void {
    const pb = this.pb;
    // (The match hands over a new list each second: the same trips, unless the navmesh was rebuilt.)
    const known = this.tripsFor;
    if (!known || known.length !== trips.length || trips.some((t, i) => t !== known[i])) {
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
    const pb = this.pb;
    // A short trip, or one without two ways near the shortest: no groups, each bot its own lane (one group on one
    // corridor sent a whole team down one way; flankers on a long way round got there late and alone).
    if (!splits(trip.trip, pb)) {
      for (const m of attackers) this.groupOf.delete(m.slot);
      for (const g of Object.values(this.groups)) {
        g.members.length = 0;
        resetGroup(g);
      }
      return;
    }
    const ways = trip.trip.corridors.length;
    const n = attackers.length;
    const short = Math.min(...trip.trip.corridors.map((c) => c.length));
    const recon = n >= pb.reconFrom ? pb.recon : n >= pb.reconFrom1 ? 1 : 0;
    const flank = Math.round((n - recon) * pb.flank);
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
    // Corridors: by length and what happened on each lately (teammates' deaths, sightings of the enemy), not by who walks
    // them (the groups themselves are that crowd: priced by it, the main push and the flankers swapped ways every
    // second). The main push the cheapest, the flankers the cheapest other, the recon pair what's left (else the
    // flankers'). A group keeps its corridor while it pushes (members waiting or a wave on its way), and otherwise until
    // another is clearly cheaper (by a third).
    const risk = (k: number) => trip.trip.corridors[k]!.length * (1 + trip.deaths[k]! * pb.death + Math.min(trip.seen[k]!, 6) * pb.seen);
    const order = Array.from({ length: ways }, (_, k) => k)
      .filter((k) => trip.trip.corridors[k]!.length <= short * pb.stretch + 20)
      .sort((a, b) => risk(a) - risk(b) || a - b);
    const main = this.groups.main;
    const flk = this.groups.flank;
    const rec = this.groups.recon;
    const keep = (g: Group, taken: readonly number[]) => {
      if (g.corridor < 0 || g.corridor >= ways || taken.includes(g.corridor)) return false;
      if (g.waiting.size > 0 || g.sent.size > 0) return true;
      const best = order.find((k) => !taken.includes(k));
      return best === undefined || risk(g.corridor) <= risk(best) * 1.33;
    };
    if (!keep(main, [])) main.corridor = order[0]!;
    if (!keep(flk, [main.corridor])) flk.corridor = order.find((k) => k !== main.corridor) ?? main.corridor;
    if (!keep(rec, [main.corridor, flk.corridor])) rec.corridor = order.find((k) => k !== main.corridor && k !== flk.corridor) ?? flk.corridor;
    const living = new Map(attackers.map((m) => [m.slot, m]));
    // Each bot keeps the corridor it set out on until it dies or stops attacking (a group's corridor changes only for
    // those joining after: swapping a group's way mid-push turned bots 20 m from the flag back for the other way).
    for (const slot of this.ways.keys()) if (!living.has(slot)) this.ways.delete(slot);
    for (const slot of this.staging.keys()) if (!living.has(slot)) this.staging.delete(slot);
    const to = trip.trip.to;
    // Each group: who is in it alive, where each waits, whether it is ready to go.
    const state: { g: Group; kind: GroupKind; ms: BrainMember[]; ready: boolean }[] = [];
    for (const kind of ['main', 'flank', 'recon'] as const) {
      const g = this.groups[kind];
      // (The dead are out of the wave they went with, and of the waiting: back from their spawn, they gather again.)
      for (const slot of g.sent) if (!living.has(slot)) g.sent.delete(slot);
      for (const slot of g.waiting.keys()) if (!living.has(slot)) g.waiting.delete(slot);
      const ms = g.members.map((slot) => living.get(slot)).filter((m): m is BrainMember => !!m);
      if (g.corridor < 0 || g.corridor >= ways || !ms.length) {
        resetGroup(g);
        continue;
      }
      for (const m of ms) if (!this.ways.has(m.slot)) this.ways.set(m.slot, g.corridor);
      // Waves (an objective to take from the enemy): those coming up from behind gather at their corridor's staging spot
      // and go on together. The recon pair goes ahead on its own; a group of one just goes.
      const stages = attack.stage && kind !== 'recon' && g.members.length >= 2;
      g.stage = stages ? this.stageOn(trip.trip.corridors[g.corridor]!, pb) : null;
      let behind = 0;
      for (const m of ms) {
        const stage = stages ? this.stageOn(trip.trip.corridors[this.ways.get(m.slot)!]!, pb) : null;
        if (!stage || g.sent.has(m.slot)) continue;
        // Nearer the objective than the spot already (a wave's survivors, a bot that took its own way): on, never back.
        if (horizontalDistance(m.pos, to) < horizontalDistance(stage, to) - 5) {
          g.waiting.delete(m.slot);
          continue;
        }
        behind++;
        if (horizontalDistance(m.pos, stage) < 15 && Math.abs(m.pos.y - stage.y) < 4) {
          if (!g.waiting.has(m.slot)) g.waiting.set(m.slot, tick);
        } else g.waiting.delete(m.slot);
      }
      let ready = false;
      if (stages && g.waiting.size) {
        let first = tick;
        for (const at of g.waiting.values()) first = Math.min(first, at);
        ready = (g.waiting.size >= 2 && g.waiting.size >= Math.ceil(behind * pb.gathered)) || tick - first >= TICK_RATE * pb.waitAfterFirst;
      }
      state.push({ g, kind, ms, ready });
    }
    // Go: each group when it is ready; with the playbook's `together`, every group waiting at its spot goes as soon as one
    // is (the main push and the flankers hit at about the same time, from different ways).
    const all = pb.together && state.some((x) => x.ready);
    for (const x of state) {
      const g = x.g;
      if ((x.ready || all) && g.waiting.size) {
        const slots = [...g.waiting.keys()].sort((a, b) => a - b);
        for (const slot of slots) g.sent.add(slot);
        g.waiting.clear();
        const c = trip.trip.corridors[this.ways.get(slots[0]!) ?? g.corridor]!;
        this.waves.push({ at: tick, slots, from: meanLeft(slots.map((slot) => living.get(slot)!), c), corridor: c });
        this.stats.started++;
      }
      for (const m of x.ms) {
        const c = trip.trip.corridors[this.ways.get(m.slot) ?? g.corridor]!;
        const stage = g.stage ? this.stageOn(c, pb) : null;
        let waits = !!stage && !g.sent.has(m.slot) && horizontalDistance(m.pos, to) >= horizontalDistance(stage, to) - 5;
        // On its way to the spot this long without getting there (no way to it, held up): it goes on.
        if (waits && !g.waiting.has(m.slot)) {
          const since = this.staging.get(m.slot) ?? tick;
          this.staging.set(m.slot, since);
          if (tick - since > TICK_RATE * STAGE_PATIENCE) {
            g.sent.add(m.slot);
            waits = false;
          }
        }
        if (!waits || g.waiting.has(m.slot)) this.staging.delete(m.slot);
        jobs.set(m.slot, { group: x.kind, to: { ...to }, route: c, stage: waits ? stage : null, goal: null });
      }
    }
    this.followWaves(tick, attack.pos, living);
  }

  /** A corridor's staging spot (worked out once per corridor: a few sight lines). */
  private stageOn(c: Corridor, pb: Playbook): Vec3 {
    let at = this.stages.get(c);
    if (!at) this.stages.set(c, (at = stagePoint(c, pb, this.sees)));
    return at;
  }

  /**
   * Waves under way, for the scorecard: one that got a member to the objective reached it; one that lost half of those
   * who set out first, or ran past PUSH_MOST, is spent. Metres gained along the route and seconds go to the totals.
   */
  private followWaves(tick: number, to: Vec3, living: ReadonlyMap<number, BrainMember>): void {
    const pb = this.pb;
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
   * Interceptors (a reaction: our flag carried off): up to `interceptors` members the enemy will run into: ahead of it
   * on its way home (nearer where it's going than it is), within reach of its route (the corridor, of the trips to
   * where it's going, that it is nearest), not right on it (those chase it as the mode says), not carrying anything.
   * Each goes to the point of that route nearest it if that is well ahead of the enemy, else `cutAhead` m ahead of the
   * enemy, and waits there for it (a goal to keep to); once the enemy is close, straight at it. Bots behind the enemy
   * don't turn back for it: chasing from behind is the mode's (the defenders and those close by).
   */
  private intercept(cut: { pos: Vec3; to: Vec3; slot: number }, members: readonly BrainMember[], all: readonly Trip[], jobs: Map<number, TeamJob | null>): void {
    const pb = this.pb;
    let route: Corridor | null = null;
    let from = -1;
    let off = 25;
    for (const t of all) {
      if (horizontalDistance(t.to, cut.to) > 12) continue;
      for (const c of t.corridors) {
        const p = placeOn(c, cut.pos);
        if (p.at >= 0 && p.off < off) {
          off = p.off;
          route = c;
          from = p.at;
        }
      }
    }
    if (!route) return;
    const line = route.line;
    const at0 = route.lineAt[from]!;
    let ahead = from;
    while (ahead < line.length - 1 && route.lineAt[ahead]! - at0 < pb.cutAhead) ahead++;
    const left = horizontalDistance(cut.pos, cut.to);
    const picks: { m: BrainMember; pos: Vec3; d: number }[] = [];
    for (const m of members) {
      if (m.ordered || m.mounted || m.goal?.run) continue;
      const near = horizontalDistance(m.pos, cut.pos);
      if (near < 20 || horizontalDistance(m.pos, cut.to) >= left) continue;
      const p = placeOn(route, m.pos);
      if (p.at < 0 || p.off > 40) continue;
      // Its own nearest point of the route if well ahead of the enemy, else the point cutAhead m ahead of it.
      const k = route.lineAt[p.at]! - at0 >= 10 ? p.at : ahead;
      const pos = near < 15 ? cut.pos : line[k]!;
      picks.push({ m, pos, d: horizontalDistance(m.pos, pos) + Math.abs(m.pos.y - pos.y) * 2 });
    }
    picks.sort((a, b) => a.d - b.d || a.m.slot - b.m.slot);
    for (const { m, pos } of picks.slice(0, pb.interceptors)) {
      jobs.set(m.slot, { group: 'intercept', to: null, route: null, stage: null, goal: { pos: { ...pos }, radius: pos === cut.pos ? 1.5 : 3, push: true } });
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

/** Whether the attackers split over a trip's ways: its shortest `groupsFromLength` or more, two ways near the shortest. */
export function splits(trip: Trip, pb: Playbook): boolean {
  const short = Math.min(...trip.corridors.map((c) => c.length));
  return short >= pb.groupsFromLength && trip.corridors.filter((c) => c.length <= short * pb.stretch + 20).length >= 2;
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
function stagePoint(c: Corridor, pb: Playbook, sees: ((a: Vec3, b: Vec3) => boolean) | null): Vec3 {
  const back = Math.min(pb.stageMax, Math.max(pb.stageMin, c.length * pb.stageShare));
  const end = c.lineAt[c.lineAt.length - 1]!;
  let k = c.line.length - 1;
  while (k > 0 && end - c.lineAt[k]! < back) k--;
  if (!sees) return { ...c.line[k]! };
  // Out of sight of the objective if a point of the route within the playbook's band does it (nearest the share back
  // first, never past the route's first half: the gathering is near the fight, not at home).
  const goal = c.line[c.line.length - 1]!;
  const eye = (p: Vec3) => ({ x: p.x, y: p.y + 1.5, z: p.z });
  const from = eye(goal);
  const lo = Math.max(pb.stageMin, 0);
  const hi = Math.min(pb.stageMax, end * 0.5);
  let best = k;
  let bestD = Infinity;
  for (let i = 0; i < c.line.length; i++) {
    const left = end - c.lineAt[i]!;
    if (left < lo || left > hi) continue;
    const d = Math.abs(left - back);
    if (d >= bestD || sees(from, eye(c.line[i]!))) continue;
    best = i;
    bestD = d;
  }
  return { ...c.line[best]! };
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
