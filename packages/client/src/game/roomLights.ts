/**
 * Room lights (Options → Display and the pause menu's Settings): whether a map's lamps light the rooms, on by default.
 * Off, the fixtures still glow but cast no light (the sun and sky light everything). A check for a phone that draws a
 * dark block on lit walls (docs/MOBILE_AUDIT.md, proposal 1): if the block goes with the lamps, the lamps' tile mask is
 * the cause. Also `?roomlights=0` / `?roomlights=1` for this page.
 */

const KEY = 'tiletrigger.roomLights';
/** Fired on window when the setting changes (a running match applies it at once). */
export const ROOM_LIGHTS_EVENT = 'tiletrigger:room-lights';

let current: boolean | null = null;

export function loadRoomLights(): boolean {
  if (typeof window !== 'undefined') {
    const force = new URLSearchParams(window.location?.search ?? '').get('roomlights');
    if (force === '0' || force === '1') return force === '1';
  }
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

/** Whether the map's lamps light the rooms now. */
export function roomLightsOn(): boolean {
  return (current ??= loadRoomLights());
}

export function saveRoomLights(on: boolean): void {
  current = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Lasts for this page.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ROOM_LIGHTS_EVENT));
}
