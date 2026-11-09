import { horizontalDistance, type Vec3 } from '../../math.ts';
import { FLAG_CARRIED, FLAG_DROPPED, FLAG_HOME } from '../../protocol.ts';
import { ctfDefendersBy, playbookFor } from '../../bots/playbooks.ts';
import { hasTag } from '../../bots/profile.ts';
import { TICK_RATE } from '../constants.ts';
import type { Combatant } from '../match.ts';
import type { FlagRt } from './ctf.ts';
import type { BotGoal } from './types.ts';

/**
 * Capture the Flag goals for Player Bots (docs/BOTS.md, "Capture the Flag").
 * Kept on its own so bot tactics can be reworked without touching the mode's
 * rules.
 *
 * Roles (owner, 2026-11-05: "only like 2–3 bots protect a flag and the rest
 * are just going out there and trying to get the other team's"), per team,
 * among its Player Bots: a few defend (ctfDefenders: 3 on a team of 12 or
 * more, 2 on a smaller one), picked by who suits it (campers and snipers
 * first, then the careful and unaggressive; rushers last), and everyone else
 * attacks. When a teammate has the enemy flag, the attackers nearest the
 * carrier escort it home and the rest come along further back.
 *
 * Whatever the role, the situation comes first:
 * - the carrier runs the enemy flag home (and keeps watch round its base while its own flag is away);
 * - our flag dropped: defenders and anyone close go and touch it (it goes home);
 * - our flag carried off: defenders and anyone close chase the carrier, and once
 *   our own carrier is home waiting on it, every attacker but its escorts too;
 * - enemies at our flag at home: the defenders close in on them.
 *
 * Goals for attackers, carriers, escorts and responders are ones to keep to
 * (`push`, bots/brain.ts OrderGoal): fighting still comes first, but noises and
 * enemies off the way don't draw them off it. Defenders hold their base,
 * keeping watch round the flag toward the enemy's side.
 *
 * The plan (roles, escorts, flags in trouble) is worked out by the mode a few
 * times a second (CtfBotPlan.update), not per bot: a bot's goal is a few
 * comparisons.
 */
export type CtfRole = 'attack' | 'defend' | 'escort';

/** CTF's playbook (bots/playbooks.ts): defenders by team size, escorts, response and threat ranges, and so on. */
const ROLES = playbookFor('core.ctf').ctf!;
const RESPOND_RANGE = ROLES.respond;
const THREAT_RANGE = ROLES.threat;
const ESCORTS = ROLES.escorts;
const DEFEND_RADIUS = ROLES.defendRadius;
/** Carriers run for home and only notice enemies this close (they shoot back at them on the run). */
export const CARRIER_AWARENESS = ROLES.carrierAwareness;
const CARRIER_WAIT = ROLES.carrierWait;

/** How many of a team's Player Bots defend: 3 on a team of 12 or more players, 2 on a smaller one (1 on a team of two or three). */
export function ctfDefenders(teamSize: number): number {
  return ctfDefendersBy(ROLES, teamSize);
}

/**
 * Fireteams: each squad's CTF role, the squads in the order best suited to defend: a squad defends while it fits in the
 * `n` defenders wanted (with those already holding) and another squad is still left to attack.
 */
export function ctfSquadRoles(sizes: readonly number[], n: number): ('defend' | 'attack')[] {
  let held = 0;
  let attackers = sizes.length;
  return sizes.map((size) => {
    const defend = attackers > 1 && held + size <= n;
    if (defend) {
      held += size;
      attackers--;
    }
    return defend ? 'defend' : 'attack';
  });
}

/** How well a bot suits defending: campers and snipers first, then the careful and unaggressive; rushers and roamers last. */
function defendScore(c: Combatant): number {
  const p = c.bot!.profile;
  let s = (100 - p.aggression) * 0.5 + (100 - p.exploration) * 0.3 + p.tacticalAwareness * 0.2;
  if (hasTag(p, 'CAMPER')) s += 100;
  if (hasTag(p, 'SNIPER')) s += 60;
  if (hasTag(p, 'BERSERKER') || hasTag(p, 'RECKLESS') || hasTag(p, 'LONE_WOLF') || hasTag(p, 'EXPLORER')) s -= 100;
  return s;
}

/** The CTF bot plan, refreshed by the mode (CtfMode.step); bots read it in ctfBotGoal. */
export class CtfBotPlan {
  /** Each Player Bot's standing role (attack or defend). */
  readonly roles = new Map<number, CtfRole>();
  /** Bots escorting a teammate who carries the enemy flag (the nearest few attackers). */
  readonly escorts = new Set<number>();
  /** Per team: the nearest enemy within THREAT_RANGE of its flag while the flag is at home. */
  readonly threat = new Map<string, Vec3>();
  private lineup = '';
  private rolesAt = -Infinity;
  /**
   * Fireteams (Part 2, objective first; ModeLogic.botUnits): a bot's bot-led squad, which takes one role for all of it
   * (null: a bot in a person's squad, no role of its own; undefined: no squads).
   */
  unitOf: ((slot: number) => number | null | undefined) | null = null;

  update(tick: number, everyone: readonly Combatant[], flags: readonly FlagRt[]): void {
    // Roles: when the line-up changes, else every few seconds (they only change with it).
    if ((tick % 6) !== 0 && tick - this.rolesAt < TICK_RATE * 5) return;
    const unit = this.unitOf;
    const lineup = everyone.map((c) => `${c.slot}${c.faction ?? ''}${c.kind[0]}${unit ? `:${unit(c.slot) ?? '-'}` : ''}`).join(',');
    if (lineup !== this.lineup || tick - this.rolesAt >= TICK_RATE * 5) {
      this.lineup = lineup;
      this.rolesAt = tick;
      this.roles.clear();
      const teams = new Map<string, Combatant[]>();
      for (const c of everyone) {
        if (!c.faction || c.kind === 'npc') continue;
        let t = teams.get(c.faction);
        if (!t) teams.set(c.faction, (t = []));
        t.push(c);
      }
      for (const members of teams.values()) {
        const bots = members.filter((c) => c.kind === 'bot' && c.bot).sort((a, b) => defendScore(b) - defendScore(a) || a.slot - b.slot);
        // A team of bots alone keeps at least one attacker; with people on it, the bots may all hold the base.
        const keep = members.some((c) => c.kind === 'human') ? 0 : 1;
        const n = Math.max(0, Math.min(ctfDefenders(members.length), bots.length - keep));
        if (unit && bots.some((c) => unit(c.slot) !== undefined)) this.squadRoles(bots, n, unit);
        else bots.forEach((c, i) => this.roles.set(c.slot, i < n ? 'defend' : 'attack'));
      }
    }
    // Escorts and flags in trouble: a few times a second.
    this.escorts.clear();
    this.threat.clear();
    for (const f of flags) {
      if (f.state === FLAG_CARRIED && f.carrier !== null) {
        const carrier = everyone.find((c) => c.slot === f.carrier);
        if (!carrier) continue;
        const mates = everyone.filter((c) => c.alive && c.bot && c.faction === carrier.faction && c !== carrier && this.roles.get(c.slot) !== 'defend');
        mates.sort((a, b) => horizontalDistance(a.move.pos, carrier.move.pos) - horizontalDistance(b.move.pos, carrier.move.pos));
        for (const c of mates.slice(0, ESCORTS)) this.escorts.add(c.slot);
      } else if (f.state === FLAG_HOME) {
        let best = THREAT_RANGE;
        let at: Vec3 | null = null;
        for (const c of everyone) {
          if (!c.alive || !c.faction || c.faction === f.team || c.kind === 'npc') continue;
          const d = horizontalDistance(c.move.pos, f.base);
          if (d < best && Math.abs(c.move.pos.y - f.base.y) < 4) {
            best = d;
            at = c.move.pos;
          }
        }
        if (at) this.threat.set(f.team, { ...at });
      }
    }
  }

  /**
   * Fireteams (objective first): roles by whole squads. A bot-led squad defends only when it fits in the team's
   * defenders (a squad of 3 when 3 are wanted) and another squad still attacks; every other squad attacks, its members
   * with it. Bots in a person's squad attack (they follow the person anyway). So with squads of 4-6 and 2-3 defenders a
   * team has nobody standing at its flag: a flag in trouble is answered by whoever is near and its carrier chased
   * (ctfBotGoal), and the squads go for the enemy's flag. Measured (docs/FIRETEAMS_PLAN.md, Part 2): a squad of 4
   * holding each base (one more than the 3 defenders) left Diamond Park without a capture in 2 matches of 3 minutes;
   * with none, 1-2 a match and kills above the variant off.
   */
  private squadRoles(bots: readonly Combatant[], n: number, unit: (slot: number) => number | null | undefined): void {
    const squads = new Map<number, Combatant[]>();
    for (const c of bots) {
      const u = unit(c.slot);
      if (u === null || u === undefined) {
        this.roles.set(c.slot, 'attack');
        continue;
      }
      let list = squads.get(u);
      if (!list) squads.set(u, (list = []));
      list.push(c);
    }
    // The squads best suited to defend first (their best defender's score: the bots come sorted by it).
    const order = [...squads.values()];
    const roles = ctfSquadRoles(order.map((l) => l.length), n);
    order.forEach((list, i) => {
      for (const c of list) this.roles.set(c.slot, roles[i]!);
    });
  }

  /** A bot's role now (escort while it escorts a carrier). */
  role(c: Combatant): CtfRole {
    return this.escorts.has(c.slot) ? 'escort' : (this.roles.get(c.slot) ?? 'attack');
  }
}

/** A bot that just took the flag forgets the fight it was in (and its path) and heads for home. */
export function ctfBotTookFlag(c: Combatant): void {
  c.bot?.onSpawn(c.yaw);
}

export function ctfBotAwareness(c: Combatant, flags: readonly FlagRt[]): number {
  return flags.some((f) => f.carrier === c.slot) ? CARRIER_AWARENESS : Infinity;
}

export function ctfBotGoal(c: Combatant, flags: readonly FlagRt[], plan: CtfBotPlan): BotGoal | null {
  const own = flags.find((f) => f.team === c.faction);
  const enemy = flags.find((f) => f.team !== c.faction);
  if (!own || !enemy) return null;
  const role = plan.roles.get(c.slot) ?? 'attack';
  const near = (p: Vec3) => horizontalDistance(c.move.pos, p) < RESPOND_RANGE;
  if (enemy.carrier === c.slot) {
    // The carrier home with our own flag away: no capture until it's back, so it keeps watch round the base, toward
    // our flag, meanwhile (before, it stood on the base like a statue, once for 143 s on Serene City).
    if (own.state !== FLAG_HOME && horizontalDistance(c.move.pos, own.base) < CARRIER_WAIT) return { pos: own.base, radius: CARRIER_WAIT - 2, push: true, watch: own.pos };
    // Else home, nothing on the way worth stopping for.
    return { pos: own.base, radius: 0.6, push: true, detour: 0, run: true };
  }
  // Our flag dropped: whoever is close (and the defenders) goes and touches it.
  if (own.state === FLAG_DROPPED && (role === 'defend' || near(own.pos))) return { pos: own.pos, radius: 0.5, push: true };
  if (own.state === FLAG_CARRIED) {
    // Our flag carried off: chase the carrier. Once our own carrier is home waiting on it, the capture waits on
    // getting it back: every attacker but the escorts goes too.
    const waiting = enemy.state === FLAG_CARRIED && horizontalDistance(enemy.pos, own.base) < 12;
    if (role === 'defend' || near(own.pos) || (waiting && !plan.escorts.has(c.slot))) return { pos: own.pos, radius: 1.5, push: true };
  }
  // Enemies at our flag: the defenders close in (everyone else answers only when the flag is taken or dropped).
  const threat = own.state === FLAG_HOME ? plan.threat.get(own.team) : undefined;
  if (threat && role === 'defend') return { pos: threat, radius: 2, push: true };
  if (role === 'defend') return { pos: own.base, radius: DEFEND_RADIUS, watch: enemy.base };
  // A teammate has their flag: escort the carrier home, a few close by and the rest further back, watching behind for chasers.
  if (enemy.state === FLAG_CARRIED) return { pos: enemy.pos, radius: plan.escorts.has(c.slot) ? 4 : 10, push: true, watch: enemy.base };
  return { pos: enemy.pos, radius: 0.5, push: true };
}

/** A bot's CTF role for reports and tests: carrier, escort, defend or attack. */
export function ctfRoleOf(c: Combatant, flags: readonly FlagRt[], plan: CtfBotPlan): CtfRole | 'carrier' {
  return flags.some((f) => f.carrier === c.slot) ? 'carrier' : plan.role(c);
}
