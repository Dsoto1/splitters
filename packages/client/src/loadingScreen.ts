/**
 * The match's loading screen (index.html `#loading-screen`, docs/LOADING.md "Starting a match"), staged: from Start
 * match's click the map's card (picture, name, mode) and the progress bar; partway through the match's info (the
 * goal) and the Tab board join it (game/session.ts); then it fades into the countdown. Kept tiny and free of game
 * code: the menu's chunk shows it before the match code has loaded.
 */

const $ = (id: string): HTMLElement | null => document.getElementById(id);

export interface LoadingCard {
  name: string;
  /** The mode's label ("Team Deathmatch"). */
  mode?: string;
  /** The map's picture, when there is one. */
  picture?: string | null;
}

/** Show the loading screen on its own (the rest of the HUD hidden until the match lets us in), with the map's card. */
export function showLoadingScreen(card: LoadingCard | null, progress = 0): void {
  const hud = $('hud');
  const screen = $('loading-screen');
  if (!hud || !screen) return;
  hud.classList.add('only-loading');
  hud.classList.remove('ls-staged');
  screen.classList.remove('ls-out');
  hud.hidden = false;
  screen.hidden = false;
  if (card) setLoadingCard(card);
  setLoadingProgress(progress);
}

/** The card's name, mode and picture (missing fields are kept as they are). */
export function setLoadingCard(card: Partial<LoadingCard> & { goal?: string }): void {
  const screen = $('loading-screen');
  if (!screen) return;
  const set = (sel: string, text: string | undefined) => {
    const el = screen.querySelector<HTMLElement>(sel);
    if (el && text !== undefined) el.textContent = text;
  };
  set('b', card.name);
  set('.ls-mode', card.mode);
  set('.ls-goal', card.goal);
  const img = screen.querySelector<HTMLImageElement>('.ls-pic');
  if (img && card.picture !== undefined) {
    img.hidden = !card.picture;
    if (card.picture) img.src = card.picture;
  }
}

/** The bar: 0..1 (it never goes back). */
export function setLoadingProgress(progress: number): void {
  const bar = $('loading-screen')?.querySelector<HTMLElement>('.bar i');
  if (!bar) return;
  const now = Number.parseFloat(bar.style.width) || 0;
  const want = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  if (want >= now || want === 0) bar.style.width = `${want}%`;
}

/** Start match failed before the match began: take the screen down (the menu comes back). */
export function hideLoadingScreen(): void {
  const hud = $('hud');
  const screen = $('loading-screen');
  if (screen) screen.hidden = true;
  if (hud?.classList.contains('only-loading')) {
    hud.classList.remove('only-loading', 'ls-staged');
    hud.hidden = true;
  }
}
