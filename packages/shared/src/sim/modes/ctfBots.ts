import { horizontalDistance, type Vec3 } from '../../math.ts';
import { FLAG_CARRIED, FLAG_DROPPED } from '../../protocol.ts';
import type { Combatant } from '../match.ts';
import type { FlagRt } from './ctf.ts';
import type { BotGoal } from './types.ts';

/**
 * Capture the Flag goal selection for Player Bots. Kept on its own so bot
 * tactics can be reworked without touching the mode's rules.
 *
 * Each team's bots take standing roles by their order in the team (attack,
 * defend, attack, escort, ...), and the situation overrides them:
 * - the carrier runs the enemy flag home (and waits there if its own flag is away);
 * - a dropped flag of ours: defenders, escorts and anyone close go and touch it;
 * - our flag carried off: defenders, escorts and anyone close chase the carrier;
 * - a teammate has the enemy flag: escorts and attackers stay with them;
 * - otherwise attackers go for the enemy flag, defenders hold near our base.
 * Fighting still comes first: the brain only follows the goal while roaming.
 */
export type CtfRole = 'attack' | 'defend' | 'escort';
const ROLES: readonly CtfRole[] = ['attack', 'defend', 'attack', 'escort'];
/** Bots this close to a flag in trouble drop their role to deal with it. */
const RESPOND_RANGE = 22;

export function ctfRole(c: Combatant, everyone: readonly Combatant[]): CtfRole {
  const team = everyone.filter((o) => o.faction === c.faction && o.kind !== 'npc').sort((a, b) => a.slot - b.slot);
  return ROLES[Math.max(0, team.indexOf(c)) % ROLES.length]!;
}

/** Carriers run for home and only fight what is right on top of them. */
export const CARRIER_AWARENESS = 4;

/** A bot that just took the flag forgets the fight it was in (and its path) and heads for home. */
export function ctfBotTookFlag(c: Combatant): void {
  c.bot?.onSpawn(c.yaw);
}

export function ctfBotAwareness(c: Combatant, flags: readonly FlagRt[]): number {
  return flags.some((f) => f.carrier === c.slot) ? CARRIER_AWARENESS : Infinity;
}

export function ctfBotGoal(c: Combatant, everyone: readonly Combatant[], flags: readonly FlagRt[]): BotGoal | null {
  const own = flags.find((f) => f.team === c.faction);
  const enemy = flags.find((f) => f.team !== c.faction);
  if (!own || !enemy) return null;
  const role = ctfRole(c, everyone);
  const near = (p: Vec3) => horizontalDistance(c.move.pos, p) < RESPOND_RANGE;
  if (enemy.carrier === c.slot) return { pos: own.base, radius: 0.6 };
  if (own.state === FLAG_DROPPED && (role !== 'attack' || near(own.pos))) return { pos: own.pos, radius: 0.5 };
  if (own.state === FLAG_CARRIED && (role !== 'attack' || near(own.pos))) return { pos: own.pos, radius: 1.5 };
  const mateCarrying = enemy.state === FLAG_CARRIED;
  switch (role) {
    case 'defend':
      return { pos: own.base, radius: 6 };
    case 'escort':
    case 'attack':
      return mateCarrying ? { pos: enemy.pos, radius: 4 } : { pos: enemy.pos, radius: 0.5 };
  }
}
