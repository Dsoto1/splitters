import type { OrderGoal } from '../../bots/brain.ts';
import type { WorldBox } from '../../map/geometry.ts';
import type { Faction, MapDocument } from '../../map/schema.ts';
import type { Vec3 } from '../../math.ts';
import type { GameEvent, ModeSnapshot } from '../../protocol.ts';
import type { Combatant } from '../match.ts';
import type { PlayerInput } from '../movement.ts';
import type { PhysicsWorld } from '../physics.ts';
import type { MatchRules } from '../rules.ts';

/**
 * What an objective mode (Capture the Flag, King of the Hill, Elimination)
 * may see and do in the match. The Match builds one of these and calls the
 * mode at a few hook points, so mode rules live in their own files.
 */
export interface ModeHost {
  readonly tick: number;
  /** The match's teams (team modes always have at least two). */
  readonly teams: readonly Faction[];
  readonly rules: MatchRules;
  readonly map: MapDocument;
  /** Falling below this height kills. */
  readonly killY: number;
  combatants(): Combatant[];
  emit(ev: GameEvent): void;
  /** End the round now (the top team score wins). */
  endRound(): void;
  /** Put a player back at a spawn point, alive and freshly equipped (out of any seat). */
  respawn(c: Combatant): void;
  /** Height of the floor under a point (within a few metres), or null over a drop. */
  groundBelow(p: Vec3): number | null;
  /** Whether a point is in a liquid that kills within a couple of seconds (lava; not acid, which you can wade through). */
  deadly?(p: Vec3): boolean;
  /** A walkable route between two points (navmesh), or null. */
  path(a: Vec3, b: Vec3): Vec3[] | null;
  /** A big explosion (Bomb mode), credited to `by`. */
  explode(at: Vec3, radius: number, damage: number, by: Combatant | null): void;
  /** The match's collision world (Fort Wars adds and removes pieces in it). */
  readonly physics: PhysicsWorld;
  /** The map's spawn points. */
  readonly spawnPoints: readonly { pos: Vec3; yaw: number; team: string | null }[];
  /** Rebuild the bots' navmesh with these extra obstacles (Fort Wars, when the forts are done); false when the map is too big to do it quickly. */
  rebuildNav(extra: readonly WorldBox[]): boolean;
}

/** Where a Player Bot should go when it is not fighting, how close counts as there, and how it goes about it (bots/brain.ts OrderGoal). */
export type BotGoal = OrderGoal;

/**
 * A trip a team's bots make again and again (docs/BOTS.md, "Route variety"): from its base or spawn to an objective.
 * The match finds two or three different corridors for each (nav/corridors.ts) once, at setup, and the team brain
 * spreads its groups over them. `kind`: attackers going for it, defenders going to hold it, or a carrier (a hostage's
 * leader) taking something home.
 */
export interface BotTripSpec {
  team: string;
  from: Vec3;
  to: Vec3;
  kind: 'attack' | 'defend' | 'carry';
}

/** A team's home for its trips: its own spawn point nearest the middle of its spawn points (null: it has none of its own). */
export function teamHome(spawnPoints: readonly { pos: Vec3; team: string | null; generated?: boolean }[], team: string): Vec3 | null {
  const own = spawnPoints.filter((s) => s.team === team && !s.generated);
  if (!own.length) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const s of own) {
    x += s.pos.x;
    y += s.pos.y;
    z += s.pos.z;
  }
  const mid = { x: x / own.length, y: y / own.length, z: z / own.length };
  let best = own[0]!;
  let bestD = Infinity;
  for (const s of own) {
    const d = (s.pos.x - mid.x) ** 2 + (s.pos.z - mid.z) ** 2 + (s.pos.y - mid.y) ** 2 * 4;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return { ...best.pos };
}

/** An objective mode's rules. Every hook is called only while the round is in play. */
export interface ModeLogic {
  /** Once per tick, after movement and combat. */
  step(): void;
  /** A player died (after the match has booked the death and set the respawn time). */
  onKill(victim: Combatant, killer: Combatant | null): void;
  /** A player is leaving the match. */
  onLeave(c: Combatant): void;
  /** A new round starts: back to the opening state. */
  reset(): void;
  /** Score per team ID (these replace kill totals for team scoring). */
  teamScores(): Map<string, number>;
  /** Host handoff: take back the team scores a checkpoint carried (teamScores' numbers). */
  restoreScores?(scores: ReadonlyMap<string, number>): void;
  snapshot(): ModeSnapshot;
  /** May this player not drive or ride vehicles right now (flag carriers)? */
  blocksVehicle(c: Combatant): boolean;
  /** How far (metres) a Player Bot notices enemies; flag carriers only react to close threats and keep running. */
  botAwareness(c: Combatant): number;
  /** Goal for a Player Bot, or null to roam as in Team Deathmatch. */
  botGoal(c: Combatant, hostiles: readonly Combatant[]): BotGoal | null;
  // Optional hooks (Fort Wars).
  /** A player has just spawned (weapons already handed out). */
  onSpawn?(c: Combatant): void;
  /** Should this hit do nothing (Fort Wars: no fighting while the teams build)? */
  blocksDamage?(victim: Combatant, attacker: Combatant | null): boolean;
  /** The mode takes this input's trigger presses for itself (Fort Wars Builder); fire, aim and reload are then dropped. */
  useInput?(c: Combatant, input: PlayerInput): boolean;
  /** A shot or blade hit this world collider: true when it belongs to the mode (Fort Wars pieces). */
  damageBody?(handle: number, amount: number, attacker: Combatant | null): boolean;
  /** An explosion went off (Fort Wars pieces take blast damage). */
  splash?(at: Vec3, radius: number, damage: number, edge: number, attacker: Combatant | null): void;
  /** Adjust a Player Bot's input after it thought (Fort Wars: shoot through enemy walls in the way). */
  botInput?(c: Combatant, input: PlayerInput): void;
  /** The trips the mode's bots make again and again (base to flag, spawn to hill...), for their corridors. */
  botTrips?(): readonly BotTripSpec[];
}
