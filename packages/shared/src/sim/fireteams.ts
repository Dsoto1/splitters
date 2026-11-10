import type { OrderGoal } from '../bots/brain.ts';
import { horizontalDistance, type Vec3 } from '../math.ts';
import { TICK_RATE } from './constants.ts';
import type { GameMode } from './rules.ts';
import { SquadScores } from './squadScores.ts';

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

export type OrderKind = 'follow' | 'hold' | 'go' | 'attack' | 'defend' | 'regroup' | 'spacing';
/**
 * The order wheel's orders, clockwise from the top. `spacing` (Part 2) is "Spread out" / "Stay tight": it doesn't
 * replace the squad's order, it sets how far apart the members keep (`Squad.spacing`).
 */
export const ORDER_KINDS: readonly OrderKind[] = ['follow', 'hold', 'go', 'attack', 'defend', 'regroup', 'spacing'];
export const ORDER_LABELS: Readonly<Record<OrderKind, string>> = { follow: 'Follow me', hold: 'Hold here', go: 'Go there', attack: 'Attack that', defend: 'Defend the objective', regroup: 'Regroup', spacing: 'Spread out' };
/** What a bot answers (the callout in the chat feed); `spacing` answers by what it was set to (SPACING_ACKS). */
export const ORDER_ACKS: Readonly<Record<OrderKind, string>> = { follow: 'Right behind you!', hold: 'Holding here!', go: 'Moving there!', attack: 'Engaging!', defend: 'Defending the objective!', regroup: 'Regrouping on you!', spacing: 'Spreading out!' };

/**
 * How far apart a squad's members keep (Part 2): `normal` until the leader says otherwise, then `spread` (Spread out)
 * or `tight` (Stay tight). The wheel's one entry toggles: from normal or tight it spreads them out, from spread it
 * tightens them up.
 */
export type SquadSpacing = 'normal' | 'spread' | 'tight';
export const SQUAD_SPACINGS: readonly SquadSpacing[] = ['normal', 'spread', 'tight'];
/** What the wheel's spacing entry does now (its label), and what it sets. */
export const nextSpacing = (sp: SquadSpacing): SquadSpacing => (sp === 'spread' ? 'tight' : 'spread');
export const spacingLabel = (sp: SquadSpacing): string => (nextSpacing(sp) === 'spread' ? 'Spread out' : 'Stay tight');
export const SPACING_ACKS: Readonly<Record<SquadSpacing, string>> = { normal: 'Spacing as you like!', spread: 'Spreading out!', tight: 'Tightening up!' };
/** The HUD's word for the squad's spacing (none for normal). */
export const SPACING_TEXT: Readonly<Record<SquadSpacing, string>> = { normal: '', spread: 'Spread out', tight: 'Tight' };
/** Why an order wasn't taken (shown to the leader). */
export type OrderRefusal = 'notLeader' | 'down' | 'noPoint' | 'noEnemy' | 'noObjective';
export const REFUSAL_TEXT: Readonly<Record<OrderRefusal, string>> = { notLeader: 'Only a squad leader gives orders', down: "You can't give orders while down", noPoint: 'Aim or ping where to go', noEnemy: 'Aim at or ping an enemy to attack', noObjective: 'No objective to defend here' };
export const REFUSALS: readonly OrderRefusal[] = ['notLeader', 'down', 'noPoint', 'noEnemy', 'noObjective'];

/** `PlayerInput.say` values for orders: ORDER_SAY_BASE + ORDER_KINDS index (110-116). */
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
  /**
   * Where members follow the leader to: the leader's position, moved on only when they have gone ANCHOR_MOVE m from it
   * (a goal that moves every tick has every member planning a fresh route every think).
   */
  anchor: Vec3 | null;
  /** How far apart the members keep (Spread out / Stay tight; Part 2). */
  spacing: SquadSpacing;
  /**
   * The formation (Part 2, `layFormation`): its shape where the leader is (single file in a corridor or a doorway, a
   * wedge, an open wedge on open ground), the way the squad faces (yaw, the leader's way), the leader's last anchors
   * (newest first: single file walks them), and each member's spot (round the leader on Follow me; round the place on
   * Hold here, Go there and Defend the objective). Empty spots: none worked out (members go to the leader or the place).
   */
  shape: FormationShape;
  heading: number;
  trail: Vec3[];
  spots: Map<number, Vec3>;
  /** What the spots were laid for (anchor, order, members, spacing), so they're laid again only when it changes. */
  laid: string;
  /** The squad is on the move (its anchor moved lately) until this tick: members bound cover to cover in a fight on the way. */
  movingUntil: number;
  /**
   * Follow-ups: its person has given it an order since leading it (the wheel or the B menu; not the match's own). Until
   * then a mode's squad role (CTF: defend or attack, ModeLogic.squadRole) is its default.
   */
  ordered: boolean;
}

/** The follow point moves on once the leader is this far from it (m, or 2 m up or down). */
const ANCHOR_MOVE = 3;

/**
 * Formations (Part 2): the shape a squad takes round its leader, by the free width across the leader's way (two sight
 * lines at chest height, left and right, `SquadWorld.clear`): under FILE_WIDTH m, single file (a corridor, a doorway, a
 * bridge); over OPEN_WIDTH m, an open wedge (open ground); a wedge between. Stay tight closes an open wedge to a wedge;
 * Spread out opens a wedge (single file stays single file: the walls decide).
 */
export type FormationShape = 'file' | 'wedge' | 'open';
export const FORMATION_SHAPES: readonly FormationShape[] = ['file', 'wedge', 'open'];
export const FILE_WIDTH = 7;
export const OPEN_WIDTH = 18;
/** How far (m) the width is looked for to each side. */
const WIDTH_LOOK = 12;
/** Spacing's scale on every offset. */
const SPACING_SCALE: Readonly<Record<SquadSpacing, number>> = { normal: 1, spread: 1.6, tight: 0.6 };
/** A wedge's rank: this far to the side and back (m, × spacing); an open wedge's. */
const WEDGE_SIDE = 3;
const WEDGE_BACK = 2.5;
const OPEN_SIDE = 5.5;
const OPEN_BACK = 1.5;
/** Single file: this far apart (m) along the leader's way, when its trail is too short. */
const FILE_GAP = 3;
/** Round a place (Hold here, Go there, Defend the objective): the ring's radius (m, × spacing). */
const RING: Readonly<Partial<Record<OrderKind, number>>> = { hold: 2.5, go: 3, defend: 5 };
/** A spot is kept this far (m) short of a wall in its way. */
const WALL_CLEAR = 0.8;
/** The squad counts as on the move this long (s) after its anchor last moved. */
const MOVING_SECONDS = 3;
/**
 * A bot-led squad's member further than this (m) from its leader catches up first (at a run), then plays the squad's
 * play again (Part 2, objective first).
 */
export const CATCH_UP = 25;

/** Pick the formation's shape from the free width across the leader's way (m) and the squad's spacing. */
export function formationShape(width: number, spacing: SquadSpacing): FormationShape {
  if (width < FILE_WIDTH) return 'file';
  if (spacing === 'tight') return 'wedge';
  return width > OPEN_WIDTH || spacing === 'spread' ? 'open' : 'wedge';
}

/**
 * The `i`-th member's offset (0: the first after the leader) in a formation, in the squad's frame: `side` m to the
 * right, `ahead` m ahead (negative: behind). Single file is laid along the leader's trail instead (layFormation).
 */
export function formationOffset(shape: FormationShape, i: number, spacing: SquadSpacing): { side: number; ahead: number } {
  const k = SPACING_SCALE[spacing];
  const rank = Math.floor(i / 2) + 1;
  const dir = i % 2 === 0 ? -1 : 1;
  if (shape === 'file') return { side: 0, ahead: -FILE_GAP * (i + 1) * k };
  if (shape === 'open') return { side: dir * rank * OPEN_SIDE * k, ahead: -rank * OPEN_BACK * k };
  return { side: dir * rank * WEDGE_SIDE * k, ahead: -rank * WEDGE_BACK * k };
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
  /** `yaw` the way it faces; `carrying` the objective (a flag, the bomb: ModeLogic.blocksVehicle). */
  member(slot: number): { alive: boolean; pos: Vec3; yaw?: number; carrying?: boolean } | null;
  target(slot: number): Vec3 | null;
  /**
   * Formations (absent: none, members go to the leader or the place itself): how far (m) the way from `a` to `b` is
   * clear at chest height (the whole way: their distance), and the walkable ground nearest `p` within a step up or
   * down (null: none, a spot over a drop or inside something).
   */
  clear?(a: Vec3, b: Vec3): number;
  ground?(p: Vec3): Vec3 | null;
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
  /** Each bot's lead ability (the roster's `lead`), for a bot-led squad's next leader when its leader falls. */
  private readonly leadScore = new Map<number, number>();
  /** Part 3: each squad's and player's points (kills, assists, objective plays, hill seconds) and the squad MVP. */
  readonly scores = new SquadScores();

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
    this.leadScore.clear();
    for (const r of roster) if (!r.human) this.leadScore.set(r.slot, r.lead);
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

  /**
   * Host handoff (follow-ups): the squads as the old host had them, made again before the first `sync` (in the old
   * host's order, so ties that go by squad id still go the same way). Members not in the match are dropped by `sync`;
   * a squad led by someone not here now is led by its best member. Returns each new squad (null: none to make).
   */
  adopt(list: readonly { team: string; leader: number | null; members: readonly number[]; human: boolean }[], tick: number): (Squad | null)[] {
    const notes: SquadNote[] = [];
    return list.map((q) => {
      const members = q.members.filter((m) => !this.bySlot.has(m));
      if (!members.length) return null;
      const leader = q.leader !== null && members.includes(q.leader) ? q.leader : members[0]!;
      return this.create(q.team, members, leader, q.human && leader === q.leader, tick, notes);
    });
  }

  private create(team: string, members: number[], leader: number, human: boolean, tick: number, notes: SquadNote[]): Squad {
    const s: Squad = { id: this.nextId++, team, leader: null, members: [...members], human, order: follow(tick), downAt: null, holds: new Map(), anchor: null, spacing: 'normal', shape: 'wedge', heading: 0, trail: [], spots: new Map(), laid: '', movingUntil: -1, ordered: false };
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

  private lead(s: Squad, slot: number, human: boolean, tick: number, notes: SquadNote[], handover = false): void {
    const from = s.leader;
    if (from === slot && s.human === human) return;
    s.leader = slot;
    s.human = human;
    // A new leader starts the squad on Follow me (a bot leader's members follow it; a person's form up on them). A bot
    // taking over from a fallen bot leader keeps the squad's order and spacing (the squad carries on).
    if (!handover) {
      s.order = follow(tick, true);
      s.spacing = 'normal';
      s.ordered = false;
    }
    s.downAt = null;
    s.holds.clear();
    s.trail.length = 0;
    s.spots.clear();
    s.laid = '';
    notes.push({ a: 'lead', squad: s, slot, human, from });
  }

  /**
   * Give a squad an order (already checked: checkOrder and the match). Returns the order. Spread out / Stay tight
   * (`spacing`) sets the squad's spacing and keeps its order (it is recorded, carried out at once).
   */
  order(s: Squad, kind: OrderKind, pos: Vec3 | null, target: number | null, tick: number, auto = false): FireteamOrder {
    if (!auto) s.ordered = true;
    if (kind === 'spacing') {
      s.spacing = nextSpacing(s.spacing);
      s.laid = '';
      this.orders.push({ squad: s.id, kind, tick, done: tick, auto });
      if (this.orders.length > ORDERS_KEPT) this.orders.splice(0, this.orders.length - ORDERS_KEPT);
      return s.order;
    }
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
      let lead = world.member(s.leader);
      // Objective first (Part 2): a bot-led squad whose leader falls is led on by its best member alive (the fallen one
      // catches up as a member, or respawns beside the new leader), so the squad keeps its push rather than holding
      // where it stood or going back to its leader's spawn. A person's squad holds for them (their order stays).
      if (!lead?.alive && !s.human) {
        let next: number | null = null;
        for (const m of s.members) {
          if (m === s.leader || !world.member(m)?.alive) continue;
          if (next === null || (this.leadScore.get(m) ?? 0) > (this.leadScore.get(next) ?? 0)) next = m;
        }
        if (next !== null) {
          this.lead(s, next, false, tick, notes, true);
          lead = world.member(next);
        }
      }
      // Objective first: a bot-led squad's member carrying the objective (a flag, the bomb) leads it home, the squad
      // round it as its escort.
      if (!s.human && lead?.alive && !lead.carrying) {
        const carrier = s.members.find((m) => m !== s.leader && world.member(m)?.carrying && world.member(m)?.alive);
        if (carrier !== undefined) {
          this.lead(s, carrier, false, tick, notes, true);
          lead = world.member(carrier);
        }
      }
      const up = !!lead?.alive;
      if (!up && s.downAt === null) {
        s.downAt = tick;
        for (const m of s.members) {
          const st = m === s.leader ? null : world.member(m);
          if (st?.alive) s.holds.set(m, { ...st.pos });
        }
      } else if (up && s.downAt !== null) {
        s.downAt = null;
        s.anchor = null;
        s.holds.clear();
        // Back: the squad forms up on them (a place order stays: the squad keeps it until told otherwise).
        if (!placeOrder(s.order.kind)) notes.push({ a: 'order', squad: s, order: this.order(s, 'regroup', null, null, tick, true) });
      }
      if (!up) continue;
      const lp = lead!.pos;
      if (!s.anchor || horizontalDistance(s.anchor, lp) > ANCHOR_MOVE || Math.abs(s.anchor.y - lp.y) > 2) {
        const prev = s.anchor;
        s.anchor = { ...lp };
        if (prev) {
          // The squad faces the leader's way; single file walks its trail (newest first).
          s.heading = Math.atan2(lp.x - prev.x, lp.z - prev.z);
          s.trail.unshift(prev);
          if (s.trail.length > TRAIL_KEPT) s.trail.length = TRAIL_KEPT;
          s.movingUntil = tick + MOVING_SECONDS * TICK_RATE;
        } else s.heading = lead!.yaw ?? s.heading;
      }
      if (world.clear && world.ground) layFormation(s, world);
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

/** The leader's last anchors kept (single file walks them: one a member). */
const TRAIL_KEPT = 6;

/**
 * Each member's spot (Part 2): on Follow me (and Regroup), the formation round the leader's anchor: its shape by the
 * free width across the leader's way, single file along the leader's trail, a wedge or an open wedge behind it to each
 * side; on Hold here, Go there and Defend the objective, a ring round the place (the members facing out, not on one
 * spot). Each spot is kept short of a wall between it and the leader (or the place) and put on the walkable ground
 * under it (none: the leader's own spot). Laid again only when the anchor, the order, the members or the spacing
 * change: a few sight lines and ground checks a squad when the leader has gone ANCHOR_MOVE m.
 */
export function layFormation(s: Squad, world: SquadWorld): void {
  const o = s.order;
  const ring = RING[o.kind];
  // (A bot-led squad on Follow me plays its play, each member its own way: no spots round its leader.)
  const centre = ring !== undefined ? o.pos : (o.kind === 'follow' || o.kind === 'regroup') && s.human ? s.anchor : null;
  const others = s.members.filter((m) => m !== s.leader);
  const key = centre ? `${o.kind}|${o.tick}|${centre.x.toFixed(1)},${centre.z.toFixed(1)}|${others.join(',')}|${s.spacing}` : '';
  if (key === s.laid) return;
  s.laid = key;
  s.spots.clear();
  if (!centre) return;
  const eye = (p: Vec3): Vec3 => ({ x: p.x, y: p.y + 1.3, z: p.z });
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  // (Right of the way the squad faces.)
  const rx = fz;
  const rz = -fx;
  const place = (to: Vec3): Vec3 => {
    const d = horizontalDistance(centre, to);
    if (d < 0.1) return { ...centre };
    const free = world.clear!(eye(centre), eye(to));
    const k = free >= d ? 1 : Math.max(0, free - WALL_CLEAR) / d;
    const at = { x: centre.x + (to.x - centre.x) * k, y: centre.y, z: centre.z + (to.z - centre.z) * k };
    const g = world.ground!(at);
    return g && Math.abs(g.y - centre.y) < 2.5 ? g : { ...centre };
  };
  if (ring !== undefined) {
    const r = ring * SPACING_SCALE[s.spacing];
    others.forEach((m, i) => {
      const a = s.heading + (i / Math.max(1, others.length)) * Math.PI * 2;
      s.spots.set(m, place({ x: centre.x + Math.sin(a) * r, y: centre.y, z: centre.z + Math.cos(a) * r }));
    });
    return;
  }
  const c = eye(centre);
  const width = world.clear!(c, { x: c.x - rx * WIDTH_LOOK, y: c.y, z: c.z - rz * WIDTH_LOOK }) + world.clear!(c, { x: c.x + rx * WIDTH_LOOK, y: c.y, z: c.z + rz * WIDTH_LOOK });
  s.shape = formationShape(width, s.spacing);
  others.forEach((m, i) => {
    // Single file: along the leader's own trail (where it walked, so a way there is sure); past it, straight back.
    if (s.shape === 'file' && s.trail[i]) {
      s.spots.set(m, { ...s.trail[i]! });
      return;
    }
    const off = formationOffset(s.shape, i, s.spacing);
    s.spots.set(m, place({ x: centre.x + rx * off.side + fx * off.ahead, y: centre.y, z: centre.z + rz * off.side + fz * off.ahead }));
  });
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
    case 'spacing':
      return 5;
  }
}

/** A person's squad holds where each member stood while they are down (m). */
const HOLD_DOWN_RADIUS = 6;

/** A member's bounding half (Part 2): the leader 0, then its members 1, 0, 1, ... in the order they joined. */
export function squadHalf(s: Squad, slot: number): 0 | 1 {
  if (slot === s.leader) return 0;
  let i = 0;
  for (const m of s.members) {
    if (m === s.leader) continue;
    i++;
    if (m === slot) break;
  }
  return (i % 2) as 0 | 1;
}

/**
 * Where a squad member goes (BotWorldView.orderGoal), or null for its own goals (the leader always; a bot-led squad's
 * member playing the squad's play, below). A person's order is `order` (a heavy weight in the member's scored choice:
 * bots/choices.ts); a bot-led squad's is `squad` (lighter: a member still looks into what happens near it). `leaderPos`
 * is the leader's position (its anchor); `target` the attack target's (null: none); `near.me` the member's own
 * position, `near.tick` now.
 *
 * Part 2:
 * - **Objective first** (a bot-led squad on Follow me, what it does unless a person took it over): null, so the member
 *   plays the squad's play itself: the mode's goal by its squad's role (CTF: ModeLogic.botUnits) and its leader's
 *   team-brain job (group, corridor, staging: Match.directBots), as near its leader as the play keeps it; only one
 *   more than CATCH_UP m from its leader catches up first. Measured against members following their leader (Part 1)
 *   and keeping spots round it: docs/FIRETEAMS_PLAN.md, "Part 2, measured".
 * - **Formations** (a person's squad on Follow me and Regroup): each member's spot round them (`Squad.spots`); on Hold
 *   here, Go there and Defend the objective (any squad) its spot on a ring round the place.
 * - **Bounding**: while the squad is on the move each member has a half (`half`, squadHalf).
 */
export function memberGoal(s: Squad, slot: number, leaderPos: Vec3 | null, target: Vec3 | null, near?: { me?: Vec3 | null; tick?: number }): OrderGoal | null {
  if (s.leader === null || slot === s.leader) return null;
  const o = s.order;
  const told = s.human ? { order: true as const } : { squad: true as const };
  if (s.downAt !== null && !placeOrder(o.kind)) {
    // The leader is down (a person's squad: a bot-led one is led on by a member): hold and fight where it stood.
    const at = s.holds.get(slot) ?? leaderPos;
    return at ? { pos: at, radius: HOLD_DOWN_RADIUS, ...told } : null;
  }
  const spot = s.spots.get(slot);
  const me = near?.me ?? null;
  const tick = near?.tick;
  const half = tick !== undefined && tick < s.movingUntil ? { half: squadHalf(s, slot) } : {};
  switch (o.kind) {
    case 'follow':
    case 'spacing':
      if (!leaderPos) return null;
      if (!s.human) {
        // Objective first: the squad's play, each its own way; fallen far behind, catch up with the leader first.
        return me && horizontalDistance(me, leaderPos) > CATCH_UP ? { pos: leaderPos, radius: orderRadius('follow'), push: true, ...told } : null;
      }
      return spot ? { pos: spot, radius: SPOT_RADIUS, ...half, ...told } : { pos: leaderPos, radius: orderRadius('follow'), ...half, ...told };
    case 'regroup':
      return leaderPos ? { pos: spot ?? leaderPos, radius: spot ? SPOT_RADIUS : orderRadius('regroup'), push: true, ...told } : null;
    case 'attack': {
      const at = target ?? leaderPos;
      return at ? { pos: at, radius: orderRadius('attack'), push: true, ...half, ...told } : null;
    }
    case 'go':
      return { pos: spot ?? o.pos!, radius: spot ? SPOT_RADIUS : orderRadius('go'), push: true, ...half, ...told };
    case 'hold':
    case 'defend':
      return { pos: spot ?? o.pos!, radius: spot ? SPOT_RADIUS : orderRadius(o.kind), ...told };
  }
}

/** How close (m) a member keeps to its own spot in the formation or round a place. */
const SPOT_RADIUS = 1.8;

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
    case 'spacing':
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

/** A squad's role in the mode as the snapshot carries it (follow-ups; CTF): none, attack, defend. */
export type SquadRoleView = 'attack' | 'defend' | null;
const ROLE_CODES: readonly SquadRoleView[] = [null, 'attack', 'defend'];
/** The squad HUD's word for a squad's role. */
export const SQUAD_ROLE_TEXT: Readonly<Record<'attack' | 'defend', string>> = { attack: 'Attack', defend: 'Defend' };

/** One squad as the snapshot carries it (protocol `fs`): see ServerMessage's snapshot. `role`: its mode role (CTF), if any. */
export function squadSnapshot(s: Squad, teamIndex: number, points = 0, role: SquadRoleView = null): number[] {
  const p = s.order.pos;
  return [s.id, teamIndex, s.leader ?? -1, ORDER_KINDS.indexOf(s.order.kind), SQUAD_SPACINGS.indexOf(s.spacing), FORMATION_SHAPES.indexOf(s.shape), s.human ? 1 : 0, p ? Math.round(p.x * 10) : 0, p ? Math.round(p.z * 10) : 0, points, ROLE_CODES.indexOf(role), ...s.members];
}

/** A squad as the client reads it from the snapshot (`fs`). */
export interface SquadView {
  id: number;
  team: number;
  leader: number;
  order: OrderKind;
  spacing: SquadSpacing;
  shape: FormationShape;
  human: boolean;
  /** The order's place (Hold here, Go there, Defend the objective), or null. */
  place: { x: number; z: number } | null;
  members: number[];
  /** The squad's points (Part 3, sim/squadScores.ts). */
  points: number;
  /** Its role in the mode (follow-ups; CTF: defend its flag or attack), or null. */
  role: SquadRoleView;
}

export function readSquad(a: readonly number[]): SquadView {
  const order = ORDER_KINDS[a[3]!] ?? 'follow';
  return {
    id: a[0]!,
    team: a[1]!,
    leader: a[2]!,
    order,
    spacing: SQUAD_SPACINGS[a[4]!] ?? 'normal',
    shape: FORMATION_SHAPES[a[5]!] ?? 'wedge',
    human: a[6] === 1,
    place: placeOrder(order) ? { x: a[7]! / 10, z: a[8]! / 10 } : null,
    points: a[9] ?? 0,
    role: ROLE_CODES[a[10] ?? 0] ?? null,
    members: a.slice(11),
  };
}
