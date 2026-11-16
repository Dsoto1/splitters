import { fireModeCount, firingOf } from '../sim/fireModes.ts';
import type { WeaponDefinition } from '../sim/weapons.ts';

/**
 * Bots and switchable fire modes (spec §36, §40): a burst or automatic mode inside BOT_BURST_INSIDE metres, where all
 * of a burst lands; a single shot beyond it, where a burst's climb carries its later rounds over the target. A band of
 * BOT_MODE_BAND metres either side keeps the mode as it is, so a target moving about the line doesn't flick it (the
 * switch is free, but each one is a click the bot's opponents hear). No target: the mode stays.
 */
export const BOT_BURST_INSIDE = 22;
export const BOT_MODE_BAND = 3;

/** The mode a bot wants for `def` with a target `dist` metres away (null: none), from mode `current`. */
export function botFireMode(def: WeaponDefinition, dist: number | null, current: number): number {
  const n = fireModeCount(def);
  if (n < 2 || dist === null) return current;
  const find = (rapid: boolean) => {
    for (let i = 0; i < n; i++) if ((firingOf(def, i).mode !== 'semi') === rapid) return i;
    return current;
  };
  if (dist < BOT_BURST_INSIDE - BOT_MODE_BAND) return find(true);
  if (dist > BOT_BURST_INSIDE + BOT_MODE_BAND) return find(false);
  return current;
}
