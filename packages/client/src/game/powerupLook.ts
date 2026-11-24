import type { PowerupKind } from '@tiletrigger/shared';

/**
 * How each power-up looks (docs/PICKUPS.md, "Power-ups"): its colour (the pickup, the HUD line, the glow on someone
 * who has it), its HUD name and a small icon (an SVG path in a 14 × 14 box; `stroke` drawn as a line, else filled).
 * Kept apart from the pickup models so the HUD doesn't load Babylon for it.
 */
export interface PowerupLook {
  color: string;
  name: string;
  icon: string;
  stroke?: true;
}

export const POWERUP_LOOKS: Readonly<Record<PowerupKind, PowerupLook>> = {
  speed: { color: '#5fe0ff', name: 'SPEED', icon: 'M8 0 2 8h4l-1 6 6-8H7z' },
  damage: { color: '#d77bff', name: 'DOUBLE DAMAGE', icon: 'M2 1h3l2 4 2-4h3L9 7l3 6H9L7 9l-2 4H2l3-6z' },
  overdrive: { color: '#ffc83a', name: 'OVERDRIVE', icon: 'M7 0l1.6 4.4L13 3l-2.4 4L13 11l-4.4-1.4L7 14l-1.6-4.4L1 11l2.4-4L1 3l4.4 1.4z' },
  regen: { color: '#5dff8a', name: 'REGEN', icon: 'M5 1h4v4h4v4H9v4H5V9H1V5h4z' },
  rapid: { color: '#ff9a4a', name: 'RAPID FIRE', icon: 'M1 2l5 5-5 5V9.5L3.5 7 1 4.5zM7 2l5 5-5 5V9.5L9.5 7 7 4.5z' },
  phantom: { color: '#c3c9ff', name: 'PHANTOM', icon: 'M2 13V6a5 5 0 0 1 10 0v7l-1.7-1.3L8.5 13 7 11.6 5.5 13l-1.8-1.3z' },
  moon: { color: '#a9c8ff', name: 'MOON BOOTS', icon: 'M9.5 1A6 6 0 1 0 13 11 5 5 0 0 1 9.5 1z' },
  vampire: { color: '#ff5c7a', name: 'VAMPIRE', icon: 'M7 1S2 7 2 9.5a5 5 0 0 0 10 0C12 7 7 1 7 1z' },
  bottomless: { color: '#4fe6c8', name: 'BOTTOMLESS MAG', icon: 'M3.5 4.5a2.5 2.5 0 1 0 0 5c2 0 5-5 7-5a2.5 2.5 0 1 1 0 5c-2 0-5-5-7-5z', stroke: true },
};

/** The icon as inline SVG in the power-up's colour. */
export function powerupIcon(kind: PowerupKind): string {
  const l = POWERUP_LOOKS[kind];
  const paint = l.stroke ? `fill="none" stroke="${l.color}" stroke-width="1.6"` : `fill="${l.color}"`;
  return `<svg class="pu-icon" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="${l.icon}" ${paint}/></svg>`;
}

/**
 * One HUD line: icon, name, seconds left and a thin bar of the time left (`total`: the pickup's seconds). No
 * blinking as it runs out (Reduce flashing or not): the bar says it.
 */
export function powerupLine(kind: PowerupKind, seconds: number, total: number): string {
  const l = POWERUP_LOOKS[kind];
  const share = Math.max(0, Math.min(1, seconds / Math.max(1, total)));
  return `<span class="pu-line" data-pu="${kind}" style="color:${l.color}">${powerupIcon(kind)}${l.name} ${Math.ceil(seconds)}<i class="pu-bar" style="width:${Math.round(share * 20) * 5}%;background:${l.color}"></i></span>`;
}
