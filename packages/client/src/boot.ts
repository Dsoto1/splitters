/**
 * The start-up loading screen (#boot, in index.html so it shows at once):
 * it stays until the first screen is really ready, so nothing pops in after
 * it goes. Each thing to wait for is a step; the bar fills as they finish and
 * the line under it says what's being loaded. It never waits longer than
 * BOOT_MAX_MS (a slow connection gets the screen anyway, still loading), and
 * goes at once when a match or MapMaker takes over (they have their own).
 */
const BOOT_MAX_MS = 12_000;

let total = 0;
let done = 0;
let finished = false;
const waiting: string[] = [];
const timer = setTimeout(() => finishBoot(), BOOT_MAX_MS);

function el(): HTMLElement | null {
  return document.getElementById('boot');
}

function draw(): void {
  const root = el();
  if (!root) return;
  const bar = root.querySelector<HTMLElement>('.bar i');
  if (bar) bar.style.width = `${Math.max(4, Math.round((done / Math.max(1, total)) * 100))}%`;
  const line = root.querySelector('small');
  if (line) line.textContent = waiting[0] ? `Loading ${waiting[0]}…` : 'Ready';
}

/** Wait for `p` before the first screen shows ("Loading <label>…" meanwhile). Returns `p`. */
export function bootStep<T>(label: string, p: Promise<T>): Promise<T> {
  if (finished) return p;
  total++;
  waiting.push(label);
  draw();
  const end = () => {
    done++;
    waiting.splice(waiting.indexOf(label), 1);
    draw();
  };
  p.then(end, end);
  return p;
}

/** The first screen is ready (or something else took over): fade the loading screen out. */
export function finishBoot(): void {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  const root = el();
  if (!root) return;
  done = total;
  draw();
  root.classList.add('done');
  setTimeout(() => root.remove(), 400);
}

/** A picture fetched and decoded (so it draws at once when shown); never fails. */
export function preloadImage(src: string): Promise<void> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img.decode().catch(() => undefined);
}
