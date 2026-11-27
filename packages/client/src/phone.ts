/**
 * Phones and tablets (docs/MOBILE_AUDIT.md, round 3): loaded on a touch device just after the menu's first JS
 * (main.ts), so none of it weighs on a desktop's first load.
 * - **No page zoom.** Safari ignores `user-scalable=no` for a pinch, and zooms on a double tap wherever the page's
 *   `touch-action` doesn't reach: its gesture events and two-finger moves are stopped, and in play (the touch
 *   controls up) a second tap in quick succession too. Text boxes keep theirs (selecting words); lists still scroll.
 * - **Add to Home Screen** on an iPhone in Safari: a calm line once, on the menu, until it's dismissed. Opened from
 *   the Home Screen the game runs full screen (the manifest, index.html), the only full screen an iPhone gives.
 */
const TIP_KEY = 'tiletrigger.homeScreenTip';
/** Two taps this close (ms) are a double tap to the browser. */
const DOUBLE_TAP_MS = 350;

/** An iPhone (or iPod) in its browser, not opened from the Home Screen. iPads have real fullscreen (session.ts). */
export function iPhoneInBrowser(ua: string, standalone: boolean): boolean {
  return /iPhone|iPod/.test(ua) && !standalone;
}

function standalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || (typeof matchMedia === 'function' && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches));
}

/** Stop the browser's own zoom (pinch and double tap). */
export function blockPageZoom(doc: Document = document): void {
  const stop = (e: Event) => {
    if (e.cancelable) e.preventDefault();
  };
  const active = { passive: false } as const;
  // Safari's pinch.
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) doc.addEventListener(t, stop, active);
  doc.addEventListener('dblclick', stop, active);
  // Two fingers moving over the page (the touch controls hold their own fingers: touch-action none there).
  doc.addEventListener('touchmove', (e) => (e.touches.length > 1 ? stop(e) : undefined), active);
  let last = -1e9;
  doc.addEventListener(
    'touchend',
    (e) => {
      const quick = e.timeStamp - last < DOUBLE_TAP_MS;
      last = e.timeStamp;
      if (!quick || e.touches.length) return;
      const t = e.target as Element | null;
      if (t?.closest?.('input, textarea, select, [contenteditable]')) return;
      // In play: the controls act on pointer events, so cancelling the browser's double tap costs them nothing.
      const play = doc.getElementById('touch-ui');
      if (play && !play.hidden) stop(e);
    },
    active,
  );
}

/** The Add to Home Screen line (once, until dismissed), on an iPhone in Safari. */
export function homeScreenTip(): HTMLElement | null {
  try {
    if (localStorage.getItem(TIP_KEY)) return null;
  } catch {
    return null;
  }
  if (!iPhoneInBrowser(navigator.userAgent, standalone())) return null;
  const el = document.createElement('div');
  el.id = 'home-tip';
  el.setAttribute('role', 'note');
  const text = document.createElement('span');
  text.innerHTML = 'For full screen: <b>Share</b> → <b>Add to Home Screen</b>';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Dismiss');
  close.addEventListener('click', () => {
    try {
      localStorage.setItem(TIP_KEY, '1');
    } catch {
      // Shown again next visit.
    }
    el.classList.add('gone');
    window.setTimeout(() => el.remove(), 300);
  });
  el.append(text, close);
  document.body.append(el);
  return el;
}

export function installPhone(): void {
  blockPageZoom();
  homeScreenTip();
}
