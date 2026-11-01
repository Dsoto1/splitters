import { gearInfo, type CharacterLook } from '@tiletrigger/shared';

/**
 * What a look's gear needs before it is built (gear.ts, loaded only when a character with gear is built, so the
 * menu's first load doesn't carry it).
 */

/** Where the gear models are (packages/client/public/gear). */
export const GEAR_MODEL_BASE = `${import.meta.env.BASE_URL}gear/`;

/** The model files a look's gear needs (without .glb). */
export const gearModels = (look: Pick<CharacterLook, 'gear' | 'whole'>): string[] =>
  look.whole ? [] : (look.gear ?? []).flatMap((id) => (gearInfo(id)?.model ? [gearInfo(id)!.model!] : []));

/**
 * The beard hairstyle (HAIR_STYLES' `hair_beard`): not loaded from its part file but built on the wearer's face by
 * gear.ts (a full beard instead of the file's thin hair cards).
 */
export const BEARD = 'hair_beard';
