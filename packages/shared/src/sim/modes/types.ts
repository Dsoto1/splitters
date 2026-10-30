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

/** Where a Player Bot should go when it is not fighting, and how close counts as there. */
export interface BotGoal {
  pos: Vec3;
  radius: number;
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
}
