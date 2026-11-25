/**
 * Crash and error reports (docs/CRASH_REPORTS.md): what a player's browser sends the hub when the game breaks and the
 * player presses Send, and the hub's check of it. Shared so both sides scrub the same way: the client before it shows
 * the player what will be sent, the hub again before it keeps anything.
 *
 * Kept: the error's message and stack (URLs and file paths cut to the bundle's own file names), the build, the map ID
 * (suite maps only; anything else is "custom"), the mode, the graphics quality, the browser and OS family, the time.
 * Never: names, account IDs, emails, addresses, chat, a map's contents.
 *
 * Imported as `@tiletrigger/shared/crashReport` (not from the shared index: the menu bundle only loads it on a break).
 */

/** The most a report may be, as sent (JSON, UTF-8). */
export const CRASH_REPORT_MAX_BYTES = 8192;
export const CRASH_MESSAGE_MAX = 300;
export const CRASH_STACK_MAX = 4000;

export const CRASH_KINDS = ['error', 'rejection', 'webgl', 'freeze'] as const;
export type CrashKind = (typeof CRASH_KINDS)[number];
export const CRASH_SCREENS = ['menu', 'game', 'editor', 'designer', 'other'] as const;
export type CrashScreen = (typeof CRASH_SCREENS)[number];
const QUALITIES = ['low', 'medium', 'high'] as const;
const BROWSERS = ['Chrome', 'Edge', 'Firefox', 'Safari', 'Opera', 'Samsung', 'other'] as const;
const SYSTEMS = ['Windows', 'macOS', 'Linux', 'ChromeOS', 'Android', 'iOS', 'other'] as const;

export interface CrashReport {
  v: 1;
  kind: CrashKind;
  /** Signature: the same break gives the same one (dedupe on the client, grouping on the hub). */
  sig: string;
  message: string;
  stack: string;
  /** The client's package version and the commit it was built from. */
  version: string;
  sha: string;
  /** A suite map's ID, "custom" for any other map, or null outside a match. */
  map: string | null;
  mode: string | null;
  screen: CrashScreen;
  quality: (typeof QUALITIES)[number] | null;
  /** Family and major version only ("Chrome 131"), and the OS family ("Windows"). */
  browser: string;
  os: (typeof SYSTEMS)[number];
  /** When, to the minute (ISO). */
  at: string;
}

/**
 * Cut what could identify a player or a machine out of an error's text: URLs and file paths down to their file name
 * (with line and column), emails, IP addresses, UUIDs (account IDs), long tokens, and any of `privateWords` (the
 * player's own name).
 */
export function scrubCrashText(text: string, privateWords: readonly string[] = []): string {
  let s = String(text);
  for (const w of privateWords) if (w && w.trim().length >= 2) s = s.split(w).join('[name]');
  return (
    s
      // Emails first: Firefox writes frames as "fn@https://…", which isn't one.
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
      // Extension and other non-web scripts: not ours, and their IDs are per install.
      .replace(/\b(?:chrome|moz|safari|safari-web)-extension:\/\/[^\s)'"]*/gi, '[extension]')
      // URLs (any scheme with //, and blob:/data:) to their last path part: "https://x.y/assets/main-abc.js?v=1:3:9" → "main-abc.js:3:9".
      .replace(/\b(?:blob:)?[a-z][a-z0-9+.-]*:\/\/[^\s)'"]*/gi, (u) => fileOf(u))
      .replace(/\bdata:[^\s)'"]{0,40}[^\s)'"]*/gi, '[data]')
      // File paths, Unix and Windows, with at least one folder: "/home/me/x/file.ts:3:1" → "file.ts:3:1".
      .replace(/(?<![\w.])(?:[A-Za-z]:\\|\\\\|~?\/)(?:[^\s)'"\\/:]+[\\/])+([^\s)'"\\/:]+(?::\d+){0,2})/g, '$1')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]')
      .replace(/\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/gi, '[ip]')
      // Long runs that look like keys or tokens (JWTs, hashes); short hashes in bundle names stay.
      .replace(/\b[A-Za-z0-9_-]{32,}(?:\.[A-Za-z0-9_-]{8,}){0,2}\b/g, '[token]')
  );
}

/** A URL's file name with its ":line:col" kept. */
function fileOf(url: string): string {
  const m = /^(.*?)((?::\d+){1,2})?$/.exec(url)!;
  const path = m[1]!.replace(/[?#].*$/, '');
  const name = path.replace(/\/+$/, '').split('/').pop() ?? '';
  const host = /^[a-z][a-z0-9+.-]*:\/\/[^/]*$/i.test(path) || !name ? '[site]' : name;
  return host + (m[2] ?? '');
}

/** The browser family and major version, and the OS family, from a user agent; nothing finer. */
export function coarseAgent(ua: string): { browser: string; os: CrashReport['os'] } {
  const os: CrashReport['os'] = /CrOS/.test(ua)
    ? 'ChromeOS'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'other';
  const pick: [RegExp, (typeof BROWSERS)[number]][] = [
    [/Edg(?:e|A|iOS)?\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/SamsungBrowser\/(\d+)/, 'Samsung'],
    [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
    [/(?:Chrome|CriOS|HeadlessChrome)\/(\d+)/, 'Chrome'],
    [/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/, 'Safari'],
  ];
  for (const [re, name] of pick) {
    const m = re.exec(ua);
    if (m) return { browser: `${name} ${m[1]}`, os };
  }
  return { browser: 'other', os };
}

/** FNV-1a, 32 bits, as 8 hex digits. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * The same break gives the same signature: the kind, the message with its numbers taken out, and the first frames'
 * files and functions (not their line numbers, which move with every build).
 */
export function crashSignature(kind: string, message: string, stack: string): string {
  const msg = message.replace(/\d+/g, '#').slice(0, 200);
  const frames = stack
    .split('\n')
    .filter((l) => /:\d+/.test(l))
    .slice(0, 3)
    .map((l) => l.replace(/:\d+(?::\d+)?/g, '').replace(/-[A-Za-z0-9_-]{6,}\.js/g, '.js').trim());
  return hash(`${kind}|${msg}|${frames.join('|')}`);
}

/** UTF-8 length of a string. */
const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Trim a report's stack, then its message, until its JSON fits CRASH_REPORT_MAX_BYTES. */
export function fitCrashReport(r: CrashReport): CrashReport {
  let out = { ...r, message: r.message.slice(0, CRASH_MESSAGE_MAX), stack: r.stack.slice(0, CRASH_STACK_MAX) };
  while (bytes(JSON.stringify(out)) > CRASH_REPORT_MAX_BYTES) {
    if (out.stack.length > 0) out = { ...out, stack: out.stack.slice(0, Math.floor(out.stack.length * 0.75)) };
    else if (out.message.length > 20) out = { ...out, message: out.message.slice(0, Math.floor(out.message.length * 0.75)) };
    else break;
  }
  return out;
}

const str = (v: unknown, max: number, re?: RegExp): string | undefined => (typeof v === 'string' && v.length <= max && (!re || re.test(v)) ? v : undefined);

/**
 * The hub's check: only the known fields, each of the right type and shape, the text scrubbed again. Returns the clean
 * report, or a short reason it was refused.
 */
export function cleanCrashReport(raw: unknown): CrashReport | string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'not a report';
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return 'unknown version';
  const kind = CRASH_KINDS.find((k) => k === o.kind);
  if (!kind) return 'bad kind';
  const message = str(o.message, 2000);
  const stack = str(o.stack ?? '', 16000);
  if (message === undefined || !message.trim() || stack === undefined) return 'bad message or stack';
  const version = str(o.version, 32, /^[\w.+-]+$/);
  const sha = str(o.sha, 40, /^[\w.-]*$/);
  if (version === undefined || sha === undefined) return 'bad build';
  const map = o.map === null ? null : str(o.map, 64, /^[a-z0-9_-]+$/);
  const mode = o.mode === null ? null : str(o.mode, 40, /^[a-z0-9_.-]+$/i);
  if (map === undefined || mode === undefined) return 'bad map or mode';
  const screen = CRASH_SCREENS.find((s) => s === o.screen);
  const quality = o.quality === null ? null : QUALITIES.find((q) => q === o.quality);
  const os = SYSTEMS.find((s) => s === o.os);
  const browser = str(o.browser, 24, /^(?:other|(?:Chrome|Edge|Firefox|Safari|Opera|Samsung) \d{1,4})$/);
  if (!screen || quality === undefined || !os || browser === undefined) return 'bad context';
  const at = str(o.at, 32, /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?Z$/);
  if (at === undefined) return 'bad time';
  const cleanMessage = scrubCrashText(message).slice(0, CRASH_MESSAGE_MAX);
  const cleanStack = scrubCrashText(stack).slice(0, CRASH_STACK_MAX);
  return fitCrashReport({
    v: 1,
    kind,
    sig: crashSignature(kind, cleanMessage, cleanStack),
    message: cleanMessage,
    stack: cleanStack,
    version,
    sha,
    map,
    mode,
    screen,
    quality,
    browser,
    os,
    at: `${at.slice(0, 16)}Z`,
  });
}
