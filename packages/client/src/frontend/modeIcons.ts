import type { GameMode } from '@tiletrigger/shared';

/**
 * A small line icon for each game mode (24 × 24, drawn in the text colour),
 * for the mode tiles in match setup. Our own drawings.
 */
const PATHS: Record<GameMode, string> = {
  // Skull.
  'core.deathmatch': 'M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4 2.5 5v3h9v-3c1.3-1 2.5-2.6 2.5-5a7 7 0 0 0-7-7Z M9 10.5h.01 M15 10.5h.01 M10 18v3 M14 18v3 M11.2 14l.8-1.2.8 1.2',
  // Crossed swords.
  'core.tdm': 'M4 4l10 10 M4 4h3l9 9 M20 4L10 14 M20 4h-3l-9 9 M13 17l4-4 M11 17l-4-4 M16.5 15.5l3 3 M7.5 15.5l-3 3',
  // Flag.
  'core.ctf': 'M5 21V4 M5 4h11l-2.5 4L16 12H5',
  // Tower with battlements.
  'core.forts': 'M5 21V5h2.5v2.5h3V5h3v2.5h3V5H19v16Z M10 21v-4a2 2 0 0 1 4 0v4 M9 11h.01 M15 11h.01',
  // Crown.
  'core.koth': 'M4 17l-1-10 5 4 4-6 4 6 5-4-1 10Z M4 20h16',
  // Crosshair.
  'core.elim': 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z M12 2v5 M12 17v5 M2 12h5 M17 12h5 M12 11.5v1',
  // Bomb with a fuse.
  'core.bomb': 'M10.5 8a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z M14.5 9.5l2-2 M16 6c1-2 3-2 4-1 M8 13a3 3 0 0 1 2.5-2',
  // A person inside a guarded ring.
  'core.hostage': 'M12 7a2.5 2.5 0 1 0 0 .01 M8 18c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5 M12 2.5l7.5 3V11c0 5-3.3 8.5-7.5 10.5C7.8 19.5 4.5 16 4.5 11V5.5Z',
  // Two people.
  'core.coop': 'M9 7a3 3 0 1 0 0 .01 M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6 M16 5.5a2.5 2.5 0 1 1 0 5 M17 13c2.5.5 4 2.7 4 6',
  // Three linked rings (a hazard sign).
  'core.zombies': 'M12 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z M7.5 12.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z M16.5 12.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z M12 14.2a.8.8 0 1 0 0 .01',
  // A disc in flight.
  'core.discs': 'M12 6c-5 0-9 2.7-9 6s4 6 9 6 9-2.7 9-6-4-6-9-6Z M12 9.5c-2.2 0-4 1.1-4 2.5s1.8 2.5 4 2.5 4-1.1 4-2.5-1.8-2.5-4-2.5Z',
  // Chequered flag.
  'core.race': 'M5 21V4 M5 4h14v9H5 M5 8.5h14 M9.7 4v9 M14.3 4v9 M5 4h4.7v4.5H5Z M14.3 4H19v4.5h-4.7Z M9.7 8.5h4.6V13H9.7Z',
};

/** The mode's icon as an inline SVG element. */
export function modeIcon(mode: GameMode): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'mode-icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', PATHS[mode] ?? PATHS['core.deathmatch']);
  svg.append(path);
  return svg;
}

/** Short tags for map cards (a row of these must fit a card). */
export const MODE_SHORT: Record<GameMode, string> = {
  'core.deathmatch': 'DM',
  'core.tdm': 'TDM',
  'core.ctf': 'CTF',
  'core.forts': 'Forts',
  'core.koth': 'King',
  'core.elim': 'Elim',
  'core.bomb': 'Bomb',
  'core.hostage': 'Hostage',
  'core.coop': 'Co-op',
  'core.zombies': 'Zombies',
  'core.discs': 'Discs',
  'core.race': 'Race',
};
