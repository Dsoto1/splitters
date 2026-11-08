import type { OrderGoal } from '../bots/brain.ts';
import { horizontalDistance, type Vec3 } from '../math.ts';
import { TICK_RATE } from './constants.ts';
import type { GameMode } from './rules.ts';

/**
 * Fireteams (docs/FIRETEAMS_PLAN.md, Part 1): a variant for every team mode where each person leads a fixed squad
 * of bots, and bot-led squads of the same size fill the rest of each team.
 *
 * - **Fixed squads** (`Fireteams.sync`): squads are made from the roster, not from who stands near whom. Every
 *   person leads one squad of `size` (the leader included); no person is ever a member of another person's squad.
 *   Bots fill people's squads first, then bot-led squads of the same size (the last one or two a little smaller).
 *   A person joining mid-match takes over a bot-led squad (its bot leader steps down to a member; nobody respawns);
 *   when a person leaves (or goes away), the squad's best bot leads it. Holes in people's squads are filled from
 *   bot-led squads.
 * - **Orders** (`checkOrder`, `Fireteams.order`): Follow me, Hold here, Go there, Attack that, Defend the objective,
 *   Regroup. Small input messages (`PlayerInput.say`, ORDER_SAY_BASE + kind), checked here and by the match.
 * - **What a member does** (`memberGoal`): its squad's order as an OrderGoal, a heavy weight in its scored choice
 *   (bots/choices.ts): members follow orders and still fight what they see.
 * - **The leader down** (`Fireteams.step`): the squad holds its ground and fights (a place order stays in force);
 *   when the leader is back, it forms up on them.
 *
 * Everything here is deterministic (slot order, no randomness) and cheap: `sync` when the roster changes,
 * `step` a few times a second, `memberGoal` a few comparisons per think.
 *
 * Hooks for Part 2 (formations, bounding, the squad HUD) and Part 3 (squad scores, MVP, the party preset): a squad's
 * `id`, `members` and `order` are what they read; `FireteamOrder.done` is when an order was carried out.
 */

/** Squad sizes the host can pick (the leader included), and the standard. */
export const FIRETEAM_SIZES = [4, 5, 6] as const;
export const DEFAULT_FIRETEAM_SIZE = 5;
export const fireteamSize = (n: unknown): number => (typeof n === 'number' && FIRETEAM_SIZES.includes(Math.round(n) as 4 | 5 | 6) ? Math.round(n) : DEFAULT_FIRETEAM_SIZE);

/** The modes Fireteams is a variant of: every team mode with an objective or kills (MAP 21's assault is Breakthrough). */
export const FIRETEAM_MODES: readonly GameMode[] = ['core.tdm', 'core.ctf', 'core.koth', 'core.bomb', 'core.hostage', 'core.breakthrough'];
export const fireteamMode = (mode: string): boolean => (FIRETEAM_MODES as readonly string[]).includes(mode);

export type OrderKind = 'follow' | 'hold' | 'go' | 'attack' | 'defend' | 'regroup';
/** The order wheel's orders, clockwise from the top. */
export const ORDER_KINDS: readonly OrderKind[] = ['follow', 'hold', 'go', 'attack', 'defend', 'regroup'];
export const ORDER_LABELS: Readonly<Record<OrderKind, string>> = { follow: 'Follow me', hold: 'Hold here', go: 'Go there', attack: 'Attack that', defend: 'Defend the objective', regroup: 'Regroup' };
/** What a bot answers (the callout in the chat feed). */
export const ORDER_ACKS: Readonly<Record<OrderKind, string>> = { follow: 'Right behind you!', hold: 'Holding here!', go: 'Moving there!', attack: 'Engaging!', defend: 'Defending the objective!', regroup: 'Regrouping on you!' };
/** Why an order wasn't taken (shown to the leader). */
export type OrderRefusal = 'notLeader' | 'down' | 'noPoint' | 'noEnemy' | 'noObjective';
export const REFUSAL_TEXT: Readonly<Record<OrderRefusal, string>> = { notLeader: 'Only a squad leader gives orders', down: "You can't give orders while down", noPoint: 'Aim or ping where to go', noEnemy: 'Aim at or ping an enemy to attack', noObjective: 'No objective to defend here' };
export const REFUSALS: readonly OrderRefusal[] = ['notLeader', 'down', 'noPoint', 'noEnemy', 'noObjective'];

/** `PlayerInput.say` values for orders: ORDER_SAY_BASE + ORDER_KINDS index (110-115). */
export const ORDER_SAY_BASE = 110;
export const orderSay = (k: OrderKind): number => ORDER_SAY_BASE + ORDER_KINDS.indexOf(k);
export const orderFromSay = (say: number | undefined): OrderKind | null => (say !== undefined && say >= ORDER_SAY_BASE && say < ORDER_SAY_BASE + ORDER_KINDS.length ? ORDER_KINDS[say - ORDER_SAY_BASE]! : null);

/** A ping (or an aimed-at point) this fresh is "there" for Go there and Attack that (s). */
export const PING_FRESH = 10;
/** Attack that ends after this long (s), or when the target is down. */
const ATTACK_SECONDS = 45;
/** Regroup ends when half the squad is within REGROUP_NEAR m of the leader, or after this long (s): then Follow me. */
const REGROUP_SECONDS = 20;
const REGROUP_NEAR = 8;
/** An order is carried out when half the squad's living members are within its radius and this much (m). */
const ARRIVE_SLACK = 2;
/** Orders kept for measuring (the newest). */
const ORDERS_KEPT = 400;

export interface FireteamOrder {
  kind: OrderKind;
  /** Where (Hold here, Go there, Defend the objective), or null (Follow me, Regroup, Attack that). */
  pos: Vec3 | null;
  /** Attack that: the enemy's slot. */
  target: number | null;
  /** When it was given, and when the squad carried it out (null: not yet). */
  tick: number;
  done: number | null;
  /** Given by the match itself (forming up after the leader came back, Follow me after an attack or a regroup). */
  auto?: boolean;
}

export interface Squad {
  id: number;
  team: string;
  /** The leader's slot (a person's, or the best bot's), or null for a moment (no member left alive to lead). */
  leader: number | null;
  /** Every member, the leader included, in the order they joined. */
  members: number[];
  /** A person leads it. */
  human: boolean;
  order: FireteamOrder;
  /** The leader went down at this tick (null: alive): the squad holds where each member stood (`holds`). */
  downAt: number | null;
  holds: Map<number, Vec3>;
}

/** One combatant as the squads see it (Match.squadRoster). */
export interface SquadRosterEntry {
  slot: number;
  team: string | null;
  human: boolean;
  /** How well a bot leads (higher leads first; the director's leadScore). */
  lead: number;
  pos: Vec3;
}

/** Something the match tells the players (the 'squad' event). */
export type SquadNote = { a: 'lead'; squad: Squad; slot: number; human: boolean; from: number | null } | { a: 'order'; squad: Squad; order: FireteamOrder };

/** What `step` needs of the match: a member's state (null: not in play), and an attack target's position (null: down or gone). */
export interface SquadWorld {
  member(slot: number): { alive: boolean; pos: Vec3 } | null;
  target(slot: number): Vec3 | null;
}

/** An order as measured: its kind, when given and when carried out (ticks; null: not carried out). */
export interface OrderRecord {
  squad: number;
  kind: OrderKind;
  tick: number;
  done: number | null;
  auto: boolean;
}

const follow = (tick: number, auto = false): FireteamOrder => ({ kind: 'follow', pos: null, target: null, tick, done: null, ...(auto ? { auto: true } : {}) });

/**
 * Every team's fixed squads. `size` is the squad size, its leader included (4-6). The match calls `sync` after the
 * roster changes and `step` a few times a second; bots read `memberGoal`.
 */
export class Fireteams {
  readonly squads: Squad[] = [];
  private readonly bySlot = new Map<number, Squad>();
  private nextId = 1;
  /** Orders given (and auto ones), the newest ORDERS_KEPT, for measuring (bot-report). */
  readonly orders: OrderRecord[] = [];
  private readonly records = new Map<FireteamOrder, OrderRecord>();

  constructor(readonly size: number) {}

  /** The squad `slot` is in, if any. */
  squadOf(slot: number): Squad | undefined {
    return this.bySlot.get(slot);
  }

  /** The squad `slot` leads, if any. */
  ledBy(slot: number): Squad | undefined {
    const s = this.bySlot.get(slot);
    return s && s.leader === slot ? s : undefined;
  }

  /** A team's squads, people's first, then by id. */
  teamSquads(team: string): Squad[] {
    return this.squads.filter((s) => s.team === team).sort((a, b) => Number(b.human) - Number(a.human) || a.id - b.id);
  }

  /**
   * Bring the squads in line with the roster (deterministic: slot order, no randomness). Returns the leadership
   * changes for the players (a person took over a squad, a bot leads a person's squad after they left).
   */
  sync(roster: readonly SquadRosterEntry[], tick: number): SquadNote[] {
    const notes: SquadNote[] = [];
    const by = new Map<number, SquadRosterEntry>();
    for (const r of roster) if (r.team !== null) by.set(r.slot, r);
    // 1. Out: whoever left the match or changed team.
    for (const s of this.squads) {
      s.members = s.members.filter((m) => {
        const r = by.get(m);
        if (r && r.team === s.team) return true;
        this.bySlot.delete(m);
        s.holds.delete(m);
        return false;
      });
      if (s.leader !== null && !s.members.includes(s.leader)) s.leader = null;
    }
    // 2. People: each leads a squad of their own.
    const people = [...by.values()].filter((r) => r.human).sort((a, b) => a.slot - b.slot);
    for (const p of people) {
      const s = this.bySlot.get(p.slot);
      if (s && s.leader === p.slot && s.human) continue;
      if (s && (s.leader === null || s.leader === p.slot || !by.get(s.leader)?.human)) {
        // In a bot-led squad (back from being away, or a bot's body taken over): they lead it now.
        this.lead(s, p.slot, true, tick, notes);
        continue;
      }
      // In another person's squad: out of it, to a squad of their own.
      if (s) this.drop(s, p.slot);
      const take = this.teamSquads(p.team!)
        .filter((q) => !q.human)
        // (The one with a hole first, the fullest of those: the bot that made room for them was likely in it.)
        .sort((a, b) => Number(a.members.length >= this.size) - Number(b.members.length >= this.size) || b.members.length - a.members.length || a.id - b.id)[0];
      if (take) {
        // A bot-led squad: its leader steps down to a member. Nobody respawns.
        take.members.push(p.slot);
        this.bySlot.set(p.slot, take);
        this.lead(take, p.slot, true, tick, notes);
      } else this.create(p.team!, [p.slot], p.slot, true, tick, notes);
    }
    // 3. Bot-led squads that lost their person (left, or away and played by a bot): the best bot leads.
    for (const s of this.squads) {
      const l = s.leader === null ? undefined : by.get(s.leader);
      if (s.human && (!l || !l.human)) {
        s.human = false;
        s.leader = null;
      }
      if (s.leader === null && s.members.length) {
        const next = s.members.map((m) => by.get(m)!).sort((a, b) => Number(b.human) - Number(a.human) || b.lead - a.lead || a.slot - b.slot)[0]!;
        this.lead(s, next.slot, next.human, tick, notes);
      }
    }
    // 4. Bots without a squad: people's squads with room first, then bot-led squads with room, then new squads.
    const loose = [...by.values()].filter((r) => !r.human && !this.bySlot.has(r.slot)).sort((a, b) => a.slot - b.slot);
    const fresh = new Map<string, SquadRosterEntry[]>();
    for (const b of loose) {
      const room = this.teamSquads(b.team!)
        .filter((q) => q.members.length < this.size)
        .sort((a, c) => Number(c.human) - Number(a.human) || a.members.length - c.members.length || a.id - c.id)[0];
      if (room) {
        room.members.push(b.slot);
        this.bySlot.set(b.slot, room);
      } else {
        let list = fresh.get(b.team!);
        if (!list) fresh.set(b.team!, (list = []));
        list.push(b);
      }
    }
    // New bot-led squads, as even as can be (11 bots in squads of 5: 4, 4 and 3, not 5, 5 and 1).
    for (const [team, list] of fresh) {
      const k = Math.ceil(list.length / this.size);
      for (let i = 0; i < k; i++) {
        const group = list.filter((_, j) => j % k === i);
        const leader = group.slice().sort((a, b) => b.lead - a.lead || a.slot - b.slot)[0]!;
        this.create(team, group.map((g) => g.slot), leader.slot, false, tick, notes);
      }
    }
    // 5. People's squads come first: a hole in one is filled from a bot-led squad of the team (its member nearest
    //    the person; the member walks over, nobody respawns). A bot-led squad of one joins another with room.
    for (const s of this.squads) {
      if (!s.human || !s.members.length) continue;
      const leader = by.get(s.leader!)!;
      // Over size (a person took over a full squad while the bot that made room for them was in another): the member
      // furthest from them goes to the team's squad with the most room (a bot-led one first).
      while (s.members.length > this.size) {
        const into = this.squads.filter((q) => q !== s && q.team === s.team && q.members.length < this.size).sort((a, b) => Number(a.human) - Number(b.human) || a.members.length - b.members.length || a.id - b.id)[0];
        if (!into) break;
        const pick = s.members
          .filter((m) => m !== s.leader)
          .map((m) => by.get(m)!)
          .sort((a, b) => horizontalDistance(b.pos, leader.pos) - horizontalDistance(a.pos, leader.pos) || a.slot - b.slot)[0]!;
        this.drop(s, pick.slot);
        into.members.push(pick.slot);
        this.bySlot.set(pick.slot, into);
      }
      while (s.members.length < this.size) {
        const from = this.squads
          .filter((q) => q.team === s.team && !q.human && q.members.length >= 2)
          .sort((a, b) => b.members.length - a.members.length || a.id - b.id)[0];
        if (!from) break;
        const pick = from.members
          .filter((m) => m !== from.leader)
          .map((m) => by.get(m)!)
          .sort((a, b) => horizontalDistance(a.pos, leader.pos) - horizontalDistance(b.pos, leader.pos) || a.slot - b.slot)[0];
        if (!pick) break;
        this.drop(from, pick.slot);
        s.members.push(pick.slot);
        this.bySlot.set(pick.slot, s);
      }
    }
    for (const s of this.squads) {
      if (s.human || s.members.length !== 1) continue;
      const into = this.squads
        .filter((q) => q !== s && q.team === s.team && q.members.length && q.members.length < this.size)
        .sort((a, b) => Number(b.human) - Number(a.human) || a.members.length - b.members.length || a.id - b.id)[0];
      if (!into) continue;
      const slot = s.members[0]!;
      this.drop(s, slot);
      into.members.push(slot);
      this.bySlot.set(slot, into);
    }
    // Empty squads go.
    for (let i = this.squads.length - 1; i >= 0; i--) if (!this.squads[i]!.members.length) this.squads.splice(i, 1);
    return notes;
  }

  private create(team: string, members: number[], leader: number, human: boolean, tick: number, notes: SquadNote[]): Squad {
    const s: Squad = { id: this.nextId++, team, leader: null, members: [...members], human, order: follow(tick), downAt: null, holds: new Map() };
    this.squads.push(s);
    for (const m of members) this.bySlot.set(m, s);
    this.lead(s, leader, human, tick, notes);
    return s;
  }

  private drop(s: Squad, slot: number): void {
    s.members = s.members.filter((m) => m !== slot);
    s.holds.delete(slot);
    if (this.bySlot.get(slot) === s) this.bySlot.delete(slot);
    if (s.leader === slot) s.leader = null;
  }

  private lead(s: Squad, slot: number, human: boolean, tick: number, notes: SquadNote[]): void {
    const from = s.leader;
    if (from === slot && s.human === human) return;
    s.leader = slot;
    s.human = human;
    // A new leader starts the squad on Follow me (a bot leader's members follow it; a person's form up on them).
    s.order = follow(tick, true);
    s.downAt = null;
    s.holds.clear();
    notes.push({ a: 'lead', squad: s, slot, human, from });
  }

  /** Give a squad an order (already checked: checkOrder and the match). Returns the order. */
  order(s: Squad, kind: OrderKind, pos: Vec3 | null, target: number | null, tick: number, auto = false): FireteamOrder {
    s.order = { kind, pos: pos ? { ...pos } : null, target, tick, done: null, ...(auto ? { auto: true } : {}) };
    const rec: OrderRecord = { squad: s.id, kind, tick, done: null, auto };
    this.records.set(s.order, rec);
    this.orders.push(rec);
    if (this.orders.length > ORDERS_KEPT) this.orders.splice(0, this.orders.length - ORDERS_KEPT);
    return s.order;
  }

  /**
   * A few times a second: the leader going down (the squad holds where each member stands) and coming back (it forms
   * up on them), orders carried out (`done`), and orders that end (an attack's target down, a regroup done: Follow me).
   */
  step(tick: number, world: SquadWorld): SquadNote[] {
    const notes: SquadNote[] = [];
    for (const s of this.squads) {
      if (s.leader === null) continue;
      const lead = world.member(s.leader);
      const up = !!lead?.alive;
      if (!up && s.downAt === null) {
        s.downAt = tick;
        for (const m of s.members) {
          const st = m === s.leader ? null : world.member(m);
          if (st?.alive) s.holds.set(m, { ...st.pos });
        }
      } else if (up && s.downAt !== null) {
        s.downAt = null;
        s.holds.clear();
        // Back: the squad forms up on them (a place order stays: the squad keeps it until told otherwise).
        if (!placeOrder(s.order.kind)) notes.push({ a: 'order', squad: s, order: this.order(s, 'regroup', null, null, tick, true) });
      }
      if (!up) continue;
      const o = s.order;
      const age = (tick - o.tick) / TICK_RATE;
      if (o.kind === 'attack' && (o.target === null || !world.target(o.target) || age > ATTACK_SECONDS)) {
        notes.push({ a: 'order', squad: s, order: this.order(s, 'follow', null, null, tick, true) });
        continue;
      }
      if (o.done === null && this.carriedOut(s, lead!.pos, world)) {
        o.done = tick;
        const rec = this.records.get(o);
        if (rec) rec.done = tick;
      }
      if (o.kind === 'regroup' && (o.done !== null || age > REGROUP_SECONDS)) notes.push({ a: 'order', squad: s, order: this.order(s, 'follow', null, null, tick, true) });
    }
    return notes;
  }

  /** Half the squad's living members (the leader aside) are where the order wants them. */
  private carriedOut(s: Squad, leaderPos: Vec3, world: SquadWorld): boolean {
    let alive = 0;
    let there = 0;
    const o = s.order;
    const at = o.kind === 'attack' ? (o.target === null ? null : world.target(o.target)) : (o.pos ?? leaderPos);
    if (!at) return false;
    const radius = o.kind === 'regroup' ? REGROUP_NEAR : o.kind === 'attack' ? 20 : orderRadius(o.kind);
    for (const m of s.members) {
      if (m === s.leader) continue;
      const st = world.member(m);
      if (!st?.alive) continue;
      alive++;
      if (horizontalDistance(st.pos, at) <= radius + ARRIVE_SLACK) there++;
    }
    return alive > 0 && there * 2 >= alive;
  }
}

/** Orders to a place: they stay in force while the leader is down and after they come back. */
export const placeOrder = (k: OrderKind): boolean => k === 'hold' || k === 'go' || k === 'defend';

/** How close (m) a member keeps to an order's place (or its leader). */
export function orderRadius(k: OrderKind): number {
  switch (k) {
    case 'follow':
      return 5;
    case 'regroup':
      return 3;
    case 'hold':
      return 4;
    case 'go':
      return 5;
    case 'defend':
      return 8;
    case 'attack':
      return 6;
  }
}

/** A person's squad holds where each member stood while they are down (m). */
const HOLD_DOWN_RADIUS = 6;

/**
 * Where a squad member goes (BotWorldView.orderGoal), or null for the leader (its own goals: the mode's, the team
 * brain's, a squad goal of the director's). A person's order is `order` (a heavy weight in the member's scored
 * choice: bots/choices.ts); following a bot leader is `squad` (lighter: a member still looks into what happens near
 * it). `leaderPos` is the leader's position; `target` the attack target's (null: none).
 */
export function memberGoal(s: Squad, slot: number, leaderPos: Vec3 | null, target: Vec3 | null): OrderGoal | null {
  if (s.leader === null || slot === s.leader) return null;
  const o = s.order;
  const told = s.human ? { order: true as const } : { squad: true as const };
  if (s.downAt !== null && !placeOrder(o.kind)) {
    // The leader is down: hold and fight where it stood (else where the squad was going).
    const at = s.holds.get(slot) ?? leaderPos;
    return at ? { pos: at, radius: HOLD_DOWN_RADIUS, ...told } : null;
  }
  switch (o.kind) {
    case 'follow':
      return leaderPos ? { pos: leaderPos, radius: orderRadius('follow'), ...told } : null;
    case 'regroup':
      return leaderPos ? { pos: leaderPos, radius: orderRadius('regroup'), push: true, ...told } : null;
    case 'attack': {
      const at = target ?? leaderPos;
      return at ? { pos: at, radius: orderRadius('attack'), push: true, ...told } : null;
    }
    case 'go':
      return { pos: o.pos!, radius: orderRadius('go'), push: true, ...told };
    case 'hold':
    case 'defend':
      return { pos: o.pos!, radius: orderRadius(o.kind), ...told };
  }
}

/** What the match knows when a leader gives an order (checkOrder). */
export interface OrderContext {
  /** The one giving it leads a squad, and is alive. */
  leads: boolean;
  alive: boolean;
  /** Where they stand, and what they aim at: the point (the world along their view, within 150 m) and an enemy in their sights. */
  pos: Vec3;
  aim: Vec3 | null;
  aimEnemy: number | null;
  /** Their last ping: where, the enemy it marked, how old (s). */
  ping: { pos: Vec3; target: number | null; age: number } | null;
  /** The mode's objective nearest them for their team (null: none, as in Team Deathmatch). */
  objective: Vec3 | null;
}

/**
 * Check an order (server side: the input only names the kind; where and whom come from the match): Go there takes
 * the leader's fresh ping, else the point they aim at; Attack that the enemy in their sights, else the one their fresh
 * ping marked; Defend the objective the mode's objective nearest them; Hold here where they stand.
 */
export function checkOrder(kind: OrderKind, c: OrderContext): { ok: true; pos: Vec3 | null; target: number | null } | { ok: false; why: OrderRefusal } {
  if (!c.leads) return { ok: false, why: 'notLeader' };
  if (!c.alive) return { ok: false, why: 'down' };
  const fresh = c.ping && c.ping.age <= PING_FRESH ? c.ping : null;
  switch (kind) {
    case 'follow':
    case 'regroup':
      return { ok: true, pos: null, target: null };
    case 'hold':
      return { ok: true, pos: { ...c.pos }, target: null };
    case 'go': {
      const at = fresh && fresh.target === null ? fresh.pos : c.aim;
      return at ? { ok: true, pos: { ...at }, target: null } : { ok: false, why: 'noPoint' };
    }
    case 'attack': {
      const t = c.aimEnemy ?? fresh?.target ?? null;
      return t !== null ? { ok: true, pos: null, target: t } : { ok: false, why: 'noEnemy' };
    }
    case 'defend':
      return c.objective ? { ok: true, pos: { ...c.objective }, target: null } : { ok: false, why: 'noObjective' };
  }
}
