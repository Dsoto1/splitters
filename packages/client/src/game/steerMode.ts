/**
 * How a driver steers a ground vehicle: `classic` (A/D, the view turns with the vehicle) or `look` (the Warthog way:
 * the vehicle steers toward where you look, and the view stays where you point it). Kept in the browser.
 */
export type SteerMode = 'classic' | 'look';
const STEER_KEY = 'tiletrigger.vehicleSteer';
export const DEFAULT_STEER: SteerMode = 'classic';

export function loadSteerMode(): SteerMode {
  try {
    const v = localStorage.getItem(STEER_KEY);
    return v === 'look' || v === 'classic' ? v : DEFAULT_STEER;
  } catch {
    return DEFAULT_STEER;
  }
}

export function saveSteerMode(mode: SteerMode): void {
  try {
    localStorage.setItem(STEER_KEY, mode);
  } catch {
    // Private windows and blocked storage: the choice lasts for this session.
  }
}
