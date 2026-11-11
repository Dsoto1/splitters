import { CREATURE_ROLES } from '../map/mapKeys.ts';
import type { PlayerInput } from './movement.ts';
import { BUTTON_FIRE } from './movement.ts';
import type { Vec3 } from '../math.ts';
import type { GripTune } from '../content/looks.ts';
import { hypot } from '../math.ts';

/**
 * Creature NPCs (CREATURE_ROLES): monsters and aliens with their own bodies
 * and skeletons instead of the soldier rig. Gameplay is the same as for any
 * NPC (the player-sized capsule, the role's weapon and health in
 * NPC_ROLE_SPECS); this is how they look and how the melee ones close in.
 */
export type CreatureKind = (typeof CREATURE_ROLES)[number];
export { CREATURE_ROLES };
/**
 * Every creature model: the creature roles, and the zombie's body (Quaternius'
 * Zombie, with its own rig and clips). The zombie role itself stays a plain
 * NPC (soldier stats, no creature flag); most zombies are drawn with this
 * body, the rest as shambling soldiers.
 */
export type CreatureModel = CreatureKind | 'zombie';

export interface CreatureSpec {
  /** Built model, relative to the client's public folder (tools/content/prepare-creatures.mjs). */
  model: string;
  /** Model units to metres. */
  scale: number;
  /** Floating creatures hang this far above the ground (metres, lowest point of the model). */
  hover: number;
  /**
   * `humanoid`: our rig's clips retargeted onto it (idle, walk, run, attack,
   * hit, death). `alien`: only an idle clip; walking, attacks, hits and death
   * are animated procedurally by the client.
   */
  body: 'humanoid' | 'alien';
  /**
   * Its own clips' natural ground speeds (m/s, at this scale) and the speed it
   * breaks into its run (humanoids with clips of their own; the retargeted
   * rig clips go by the rig's speeds and the hip height).
   */
  gait?: { walk: number; run: number; runFrom: number };
  /**
   * Its own hands and arms on a gun when it carries one (a player or bot in its skin; humanoids only), as a look's
   * `whole.grip` (GripTune): the shared creature hold (characterAnimator holdWith) is left as it is for the rest.
   */
  grip?: GripTune;
}

export const CREATURE_SPECS: Record<CreatureModel, CreatureSpec> = {
  // Its left claw stood above a long gun's handguard, claws up: down under it, turned and closed round it.
  imp: { model: 'creatures/imp.glb', scale: 1, hover: 0, body: 'humanoid', grip: { supportLong: [0, -0.05, 0], rollL: -0.8, curlL: 1.3 } },
  puglin: { model: 'creatures/puglin.glb', scale: 1.2, hover: 0, body: 'humanoid' },
  cyclops: { model: 'creatures/cyclops.glb', scale: 1, hover: 0.25, body: 'alien' },
  oculus: { model: 'creatures/oculus.glb', scale: 1, hover: 0.5, body: 'alien' },
  scolitex: { model: 'creatures/scolitex.glb', scale: 0.75, hover: 0, body: 'alien' },
  // A slow shamble that breaks into a lurching run; no death clip (it drops like the aliens).
  zombie: { model: 'creatures/zombie.glb', scale: 1, hover: 0, body: 'humanoid', gait: { walk: 0.3, run: 3, runFrom: 1.4 } },
};

/** Which zombies get the Quaternius body: two in three; the rest shamble on the soldiers' rig. */
export const zombieHasCreatureBody = (id: number): boolean => id % 3 !== 0;
/**
 * The looks the other zombies wear (owner, 2026-11-11: zombie skins only, no mannequins; they were the soldiers'
 * plain rig tinted green): the roster's own zombie characters, by NPC id.
 */
export const ZOMBIE_LOOKS = ['core.groaner', 'core.lurcher', 'core.rotter', 'core.shambler', 'core.zombiesoldier1', 'core.zombiesoldier2'] as const;
export const zombieLook = (id: number): string => ZOMBIE_LOOKS[Math.floor(id / 3) % ZOMBIE_LOOKS.length]!;

export const isCreature = (role: string): role is CreatureKind => (CREATURE_ROLES as readonly string[]).includes(role);

/** Within this distance (metres) a melee creature that sees its target stops pathing and runs straight at it. */
export const CHARGE_DISTANCE = 10;

/**
 * Melee creatures rush in: once the brain has a target in sight and close,
 * steer straight at it (no strafing, no keeping range) and strike whenever
 * it is within reach. Changes the brain's input in place; does nothing when
 * there is no target, it is far away or on another level.
 */
export function chargeIntoMelee(input: PlayerInput, self: Vec3, target: Vec3 | null, reach: number): void {
  if (!target) return;
  const dx = target.x - self.x;
  const dz = target.z - self.z;
  const dy = target.y - self.y;
  const dist = hypot(dx, dz);
  if (dist > CHARGE_DISTANCE || Math.abs(dy) > 2.5) return;
  input.yaw = Math.atan2(dx, dz);
  input.pitch = Math.atan2(dy, Math.max(0.5, dist));
  input.forward = dist > reach * 0.5 ? 1 : 0;
  input.right = 0;
  input.buttons = dist <= reach ? input.buttons | BUTTON_FIRE : input.buttons & ~BUTTON_FIRE;
}
