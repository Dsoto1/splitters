/**
 * What the player used last: keyboard and mouse, or a controller. Menus show
 * the matching glyphs (Esc / Q E / ↵, or B / LB RB / A): the root element
 * carries `data-input="kbm" | "pad"` and style.css hides the other set.
 * A controller press also reaches `onPadPress` listeners (the main menu's
 * navigation); the pause menu reads the pad itself each frame.
 */
import { DirRepeat, scrollStep, stickDir, type Dir } from './frontend/padNav.ts';

export type InputMode = 'kbm' | 'pad';

/** Standard-mapping gamepad buttons. */
export const PAD = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, start: 9, up: 12, down: 13, left: 14, right: 15 } as const;

const DIR_BUTTON: Record<Dir, number> = { up: PAD.up, down: PAD.down, left: PAD.left, right: PAD.right };

let mode: InputMode = 'kbm';
const scrollListeners = new Set<(px: number) => void>();
const held = new DirRepeat();
let lastPoll = 0;
const modeListeners = new Set<(m: InputMode) => void>();
const padListeners = new Set<(button: number) => void>();
let installed = false;
let polling = false;
let prev: boolean[] = [];

export function inputMode(): InputMode {
  return mode;
}

function setMode(m: InputMode): void {
  if (m === mode) return;
  mode = m;
  document.documentElement.dataset.input = m;
  for (const f of modeListeners) f(m);
}

/** Called when the mode changes; returns the unsubscribe. */
export function onInputMode(f: (m: InputMode) => void): () => void {
  modeListeners.add(f);
  return () => modeListeners.delete(f);
}

/**
 * Called each frame the right stick leans past its dead zone, with the pixels to scroll this frame (down positive);
 * returns the unsubscribe.
 */
export function onPadScroll(f: (px: number) => void): () => void {
  scrollListeners.add(f);
  return () => scrollListeners.delete(f);
}

/**
 * Called on each controller button press (edge, standard mapping); returns the unsubscribe. The d-pad and the left
 * stick come as the d-pad's buttons, and repeat while held: once, again after a short delay, then at a steady rate.
 */
export function onPadPress(f: (button: number) => void): () => void {
  padListeners.add(f);
  return () => padListeners.delete(f);
}

function poll(): void {
  const pad = [...(navigator.getGamepads?.() ?? [])].find((g) => g?.connected && g.mapping === 'standard');
  if (!pad) {
    polling = false;
    prev = [];
    lastPoll = 0;
    held.update(null, 0);
    return;
  }
  const down = pad.buttons.map((b) => b.pressed);
  const moved = pad.axes.some((a) => Math.abs(a) > 0.5);
  if (moved || down.some(Boolean)) setMode('pad');
  down.forEach((d, i) => {
    if (d && !prev[i] && !(i >= PAD.up && i <= PAD.right)) for (const f of padListeners) f(i);
  });
  prev = down;
  const now = performance.now();
  const dt = Math.min(0.1, lastPoll ? (now - lastPoll) / 1000 : 0);
  lastPoll = now;
  // The d-pad, else the left stick: one direction, repeating while held.
  const pressed = (b: number) => !!down[b];
  const dir: Dir | null = pressed(PAD.up) ? 'up' : pressed(PAD.down) ? 'down' : pressed(PAD.left) ? 'left' : pressed(PAD.right) ? 'right' : stickDir(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
  const step = held.update(dir, now);
  if (step) for (const f of padListeners) f(DIR_BUTTON[step]);
  // The right stick scrolls.
  const px = scrollStep(pad.axes[3] ?? 0, dt);
  if (px) for (const f of scrollListeners) f(px);
  requestAnimationFrame(poll);
}

function startPolling(): void {
  if (polling) return;
  polling = true;
  requestAnimationFrame(poll);
}

/** Watch the keyboard, mouse and controllers (once, at boot). */
export function installInputMode(): void {
  if (installed) return;
  installed = true;
  document.documentElement.dataset.input = mode;
  const kbm = () => setMode('kbm');
  window.addEventListener('keydown', kbm, { capture: true, passive: true });
  window.addEventListener('mousedown', kbm, { capture: true, passive: true });
  window.addEventListener('wheel', kbm, { capture: true, passive: true });
  window.addEventListener('gamepadconnected', startPolling);
  if ([...(navigator.getGamepads?.() ?? [])].some((g) => g?.connected)) startPolling();
}

/** A key hint's glyphs: the keyboard's, and the controller's (shown by `data-input`). */
export function glyphs(key: string, pad?: string, padClass = ''): HTMLElement[] {
  const k = document.createElement('kbd');
  k.className = pad ? 'g-kbm' : 'g-any';
  k.textContent = key;
  if (!pad) return [k];
  const p = document.createElement('kbd');
  p.className = `g-pad ${padClass}`.trim();
  p.textContent = pad;
  return [k, p];
}
