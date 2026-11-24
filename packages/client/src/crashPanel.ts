import { coarseAgent, crashSignature, fitCrashReport, scrubCrashText, type CrashKind, type CrashReport } from '@tiletrigger/shared/crashReport';
import { crashContext } from './crashReport.ts';
import { loadGraphicsQuality } from './game/graphicsSettings.ts';
import { hubApi } from './publishedMaps.ts';

/**
 * The "Something went wrong" panel (docs/CRASH_REPORTS.md), loaded on the first break. Calm by design (Reduce
 * flashing, docs/LOOK.md): a plain dark card in a corner, no red, no flash, no motion. Shows the player exactly what
 * would be sent; sends only on Send. Each break (by signature) is offered once a session, at most 3 in all, one at a
 * time.
 */
const offered = new Set<string>();
let open = false;
const MAX_OFFERS = 3;

/** The report as it would be sent (scrubbed, capped), from a break and the page's context. */
export function buildReport(b: { kind: CrashKind; message: string; stack: string }, now = new Date(), ua = navigator.userAgent): CrashReport {
  const words = crashContext.privateWords();
  const message = scrubCrashText(b.message, words);
  const stack = scrubCrashText(b.stack, words);
  let quality: CrashReport['quality'] = null;
  try {
    quality = loadGraphicsQuality();
  } catch {
    /* no storage */
  }
  return fitCrashReport({
    v: 1,
    kind: b.kind,
    sig: crashSignature(b.kind, message, stack),
    message,
    stack,
    version: __APP_VERSION__,
    sha: /^[\w.-]{0,40}$/.test(__ASSET_VERSION__) ? __ASSET_VERSION__ : '',
    map: crashContext.map,
    mode: crashContext.mode,
    screen: crashContext.screen,
    quality,
    ...coarseAgent(ua),
    at: `${now.toISOString().slice(0, 16)}Z`,
  });
}

/** The panel closed: another break may be offered. */
export function closed(): void {
  open = false;
}

/** Whether to offer this break: none open now, not offered before this session, fewer than MAX_OFFERS so far. */
export function takeOffer(sig: string): boolean {
  if (open || offered.has(sig) || offered.size >= MAX_OFFERS) return false;
  offered.add(sig);
  return (open = true);
}

export function offerReport(b: { kind: CrashKind; message: string; stack: string }): void {
  const url = hubApi('reports');
  if (!url) return;
  const report = buildReport(b);
  if (!takeOffer(report.sig)) return;
  if (!document.getElementById('crash-style')) {
    const style = document.createElement('style');
    style.id = 'crash-style';
    style.textContent = `#crash-panel{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:min(360px,calc(100vw - 32px));box-sizing:border-box;padding:14px 16px;border-radius:10px;background:#1e2838;color:#e6f0ff;border:1px solid rgba(142,162,192,.35);box-shadow:0 6px 24px rgba(0,0,0,.45);font:14px/1.4 Barlow,system-ui,sans-serif}
#crash-panel h4{margin:0 0 4px;font:600 16px/1.3 'Chakra Petch',system-ui,sans-serif}
#crash-panel p{margin:0 0 10px;color:#b8c6dc}
#crash-panel details{margin:0 0 10px;color:#8ea2c0}
#crash-panel pre{max-height:140px;overflow:auto;margin:6px 0 0;padding:6px;background:#121827;border-radius:6px;font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word}
#crash-panel .row{display:flex;gap:8px;justify-content:flex-end}
#crash-panel button{font:600 14px Barlow,system-ui,sans-serif;padding:7px 14px;border-radius:6px;border:1px solid rgba(142,162,192,.35);background:#2a3a55;color:#e6f0ff;cursor:pointer}
#crash-panel button.send{background:#2f4a78;border-color:#4f6bff}
#crash-panel button:disabled{opacity:.6;cursor:default}`;
    document.head.append(style);
  }
  const panel = document.createElement('div');
  panel.id = 'crash-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'crash-title');
  const title = document.createElement('h4');
  title.id = 'crash-title';
  title.textContent = 'Something went wrong';
  const text = document.createElement('p');
  text.textContent = 'The game hit an error. Sending a report helps us fix it: the error, the game version, the map and your browser type. Nothing about you.';
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'What is sent';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(report, null, 1);
  details.append(summary, pre);
  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'send';
  send.textContent = 'Send report';
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = 'Dismiss';
  const row = document.createElement('div');
  row.className = 'row';
  row.append(dismiss, send);
  panel.append(title, text, details, row);
  const close = () => {
    panel.remove();
    closed();
  };
  dismiss.addEventListener('click', close);
  send.addEventListener('click', () => {
    send.disabled = true;
    send.textContent = 'Sending…';
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report), signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? 'Sent. Thank you.' : r.status === 429 || r.status === 503 ? 'The hub is busy: not sent.' : 'The hub refused it: not sent.'))
      .catch(() => 'No answer from the hub: not sent.')
      .then((said) => {
        text.textContent = said;
        details.remove();
        send.remove();
        dismiss.textContent = 'Close';
        window.setTimeout(close, 6000);
      });
  });
  document.body.append(panel);
}
