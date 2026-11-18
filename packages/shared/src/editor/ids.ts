/** New map ids (split from commands.ts, which re-exports them, 2026-11-18: main.ts seeds them in test mode, and reaching commands.ts took the edit commands into the menu's first JS; docs/LOADING.md). */

let idRandom: () => number = Math.random;
/** Where new ids come from (the browser's test mode sets a seeded generator, so the same edits give the same ids). */
export function setIdRandom(rand: () => number): void {
  idRandom = rand;
}

/** Short random stable ID with a readable prefix, e.g. `tile_k3v9x2ma`. */
export function newId(prefix: string, rand: () => number = idRandom): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rand() * 36)];
  return `${prefix}_${s}`;
}
