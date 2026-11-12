import { MEASURED_HITBOXES } from '../content/hitboxes.generated.ts';
import { decodeLook, getLook, NPC_KEPT_LOOKS, RETIRED_LOOKS } from '../content/looks.ts';
import type { NpcRole } from '../map/schema.ts';
import { PLAYER } from './constants.ts';
import { CREATURE_SPECS, isCreature } from './creatures.ts';
import type { LookHitbox } from './hitbox.ts';
import { NPC_ROLE_SPECS, npcLookRole } from './npc.ts';

/**
 * Which hit shapes a body has (sim/hitbox.ts; docs/CHARACTERS.md, "Hitboxes"): a look's measured shapes
 * (tools/content/hitboxes.mjs → content/hitboxes.generated.ts), a creature skin's, an NPC's. A module of its own so
 * the menu's first JS, which reaches sim/hitbox.ts through the weapons, doesn't carry the measured table (about
 * 32 kB gzip): the match code and the hitbox overlay load it (docs/LOADING.md).
 */

/** The standard mannequin's shapes (read when first needed). */
let fallback: LookHitbox | undefined;
const FALLBACK = (): LookHitbox => (fallback ??= MEASURED_HITBOXES['base:male']!);

/** A look's shapes and the scale they're drawn at before the body's size (players, bots and player skins). */
export function lookHitbox(look: string | undefined): { box: LookHitbox; scale: number } {
  const role = npcLookRole(look);
  if (role) {
    // A player in an NPC skin: a creature is fitted to a player's height (fitPlayerSkin), a soldier is the mannequin.
    if (isCreature(role)) {
      const box = MEASURED_HITBOXES[`creature:${role}`] ?? FALLBACK();
      return { box, scale: creatureSkinScale(box) };
    }
    return { box: MEASURED_HITBOXES['base:male'] ?? FALLBACK(), scale: 1 };
  }
  const id = look && NPC_KEPT_LOOKS.has(look) ? look : getLook(look).id;
  const own = MEASURED_HITBOXES[id] ?? (look && !RETIRED_LOOKS[look] ? MEASURED_HITBOXES[look] : undefined);
  if (own) return { box: own, scale: 1 };
  // A design of yours: the mannequin of its body.
  const body = (look && decodeLook(look)?.body) ?? getLook(look).body;
  return { box: MEASURED_HITBOXES[`base:${body}`] ?? FALLBACK(), scale: 1 };
}

/** Widest (m) a player's creature skin is grown to (client creatures.ts SKIN_MAX_WIDE). */
const SKIN_MAX_WIDE = 1.3;
/** A creature skin's scale on a player: its height to a player's, a small wide one grown only so far (fitPlayerSkin). */
export function creatureSkinScale(box: LookHitbox): number {
  const tall = box.rest;
  if (tall < 0.3) return 1;
  let s = PLAYER.height / tall;
  const wide = box.wide ?? 0;
  if (s > 1 && wide * s > SKIN_MAX_WIDE) s = Math.max(1, SKIN_MAX_WIDE / wide);
  return s;
}

/** An NPC's shapes and scale (before its encounter size) as the client draws it (session.ts npcLook). */
export function npcHitbox(role: NpcRole, id: number): { box: LookHitbox; scale: number } {
  const spec = NPC_ROLE_SPECS[role];
  if (role === 'zombie') return { box: MEASURED_HITBOXES['base:zombie'] ?? FALLBACK(), scale: 1 };
  if (isCreature(role) && CREATURE_SPECS[role]) return { box: MEASURED_HITBOXES[`creature:${role}`] ?? FALLBACK(), scale: 1 };
  if (spec.look) return { box: lookHitbox(spec.look).box, scale: spec.scale };
  // Soldiers: about half of each squad on the female mannequin (the client's id % 2).
  return { box: MEASURED_HITBOXES[id % 2 === 1 ? 'base:female' : 'base:male'] ?? FALLBACK(), scale: spec.scale };
}
