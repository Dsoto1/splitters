import type { NpcRole } from '../map/schema.ts';
import { npcLookRole } from '../sim/npc.ts';
import { WHOLE_BODY_BLOOD } from './characterBlood.generated.ts';
import { RETIRED_LOOKS, type BloodKind } from './looks.ts';

/**
 * What a character bleeds when hit (`blood` in its manifest; owner, 2026-11-17): red for people, green or blue for
 * aliens, black oil with Electric FX sparks for robots and machines, bone dust for skeletons, grey stone dust for statues (bone's dust, greyer; owner, 2026-11-18), a white-grey spectral wisp for
 * ghosts and spirits (no decals for the last two). A look without one (part-built presets, designs, the soldier NPC
 * mannequins) bleeds the map's blood colour. The map's amount and the player's blood switch rule every kind.
 * The same list as BLOOD in tools/content/character-manifests.mjs (a test keeps them equal). IDs never change.
 * Its own module (and its table, characterBlood.generated.ts): only the game reads it, so the menu's first JS doesn't.
 */
export const BLOOD_KINDS = ['red', 'green', 'blue', 'oil', 'bone', 'spirit', 'stone'] as const satisfies readonly BloodKind[];
export const isBloodKind = (x: unknown): x is BloodKind => (BLOOD_KINDS as readonly unknown[]).includes(x);

/**
 * What the creature NPC skins bleed. The soldier mannequins (trooper, gunner, heavy, sniper: the Dummy) have none and
 * bleed the map's blood; the zombie skin is red. Roles drawn as a character look bleed what that look's manifest says.
 */
export const NPC_SKIN_BLOOD: Readonly<Partial<Record<NpcRole, BloodKind>>> = { imp: 'red', puglin: 'red', cyclops: 'blue', oculus: 'green', scolitex: 'green', zombie: 'red' };

/** What a look bleeds (its manifest's `blood`, an NPC skin's above); null: the map's blood (a design of yours, a part-built preset, the mannequins, anything unknown). */
export const lookBlood = (id: string | undefined): BloodKind | null => {
  const role = npcLookRole(id);
  if (role) return NPC_SKIN_BLOOD[role] ?? null;
  const key = (id && RETIRED_LOOKS[id]) || id;
  return (key && WHOLE_BODY_BLOOD[key]) || null;
};
