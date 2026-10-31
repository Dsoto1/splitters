import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GAME_MODES, MODE_LABELS, SERVER_RULES, isGameMode, isTeamMode } from '@tiletrigger/shared';
import { botSetToText, presetBotSet, type BotSetPreset, type RotationPreset } from '@tiletrigger/shared';
import type { CommandSpec } from './commands.ts';

/**
 * The launcher: the Host Service's own page, served on this computer only
 * (control.ts, http://127.0.0.1:7797/), opened in the browser when the service
 * starts. It looks like the site and shows the same console as the window
 * (every log line, every command and its answer) with a command line under
 * it, and a right bar of controls. Each control runs an ordinary console
 * command (it shows which, so the command line is easy to learn); while the
 * server is stopped they edit the settings the next Start uses. The console
 * window keeps working alongside it: both see everything.
 */

/** One console line as the launcher shows it. */
export interface ConsoleLine {
  n: number;
  /** log: a log line (timestamped); cmd: a command someone ran; out: its answer. */
  kind: 'log' | 'cmd' | 'out';
  text: string;
  /** Who ran a command: the console window or the launcher. */
  from?: 'window' | 'launcher';
}

/** The last lines of the console, numbered, for the launcher to fetch what it hasn't seen. */
export class LogBuffer {
  private lines: ConsoleLine[] = [];
  private next = 1;

  constructor(private readonly keep = 1500) {}

  push(kind: ConsoleLine['kind'], text: string, from?: ConsoleLine['from']): void {
    for (const t of text.split('\n')) {
      this.lines.push({ n: this.next++, kind, text: t.slice(0, 2000), ...(from ? { from } : {}) });
    }
    if (this.lines.length > this.keep) this.lines.splice(0, this.lines.length - this.keep);
  }

  /**
   * Lines after `after` (at most `limit`), and the number to ask from next time.
   * `reset`: `after` is past anything this buffer numbered (the service started
   * again), so these are all its lines and the page starts over.
   */
  since(after: number, limit = 500): { lines: ConsoleLine[]; next: number; reset: boolean } {
    const reset = after > this.next - 1;
    const from = reset ? 0 : after;
    const lines = this.lines.filter((l) => l.n > from).slice(0, limit);
    return { lines, next: lines.length ? lines.at(-1)!.n : from, reset };
  }
}

export interface LauncherMap {
  id: string;
  name: string;
  modes: { id: string; label: string; team: boolean }[];
}

/** Our suite's maps with their names and modes (the launcher's map picker), read from the maps folder. */
export function mapCatalog(mapsDir: string, suite: ReadonlySet<string>): LauncherMap[] {
  const out: LauncherMap[] = [];
  let files: string[] = [];
  try {
    files = readdirSync(mapsDir);
  } catch {
    return out;
  }
  for (const f of files) {
    const id = f.replace(/\.json$/, '');
    if (!f.endsWith('.json') || !suite.has(id)) continue;
    try {
      const meta = (JSON.parse(readFileSync(join(mapsDir, f), 'utf8')) as { metadata?: { name?: unknown; supportedModes?: unknown } }).metadata ?? {};
      const modes = (Array.isArray(meta.supportedModes) ? meta.supportedModes : ['core.deathmatch']).filter((m): m is string => typeof m === 'string' && isGameMode(m));
      out.push({ id, name: typeof meta.name === 'string' ? meta.name : id, modes: modes.map((m) => ({ id: m, label: MODE_LABELS[m as keyof typeof MODE_LABELS] ?? m, team: isTeamMode(m) })) });
    } catch {
      // A map that doesn't read isn't offered.
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** JSON inside a <script> element: nothing in it can close the element. */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');

export interface LauncherInfo {
  version: string;
  commands: readonly CommandSpec[];
  maps: readonly LauncherMap[];
  /** The built-in map rotations (maps/rotations/), offered in the Rotation card. */
  presets?: readonly RotationPreset[];
  /** The built-in bot sets (maps/botsets/), offered in the Bots card. */
  botSets?: readonly BotSetPreset[];
  /** Where map pictures come from (the site's automatic shots). */
  site: string;
}

/** Content-Security-Policy for the page: its own script (by nonce), the site's fonts and map pictures, the API on this origin. */
export function launcherCsp(nonce: string, site: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    `img-src ${site} data:`,
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function launcherPage(info: LauncherInfo, nonce: string): string {
  const presets = (info.presets ?? []).map((p) => ({ id: p.id, name: p.name, description: p.description, shuffle: p.shuffle, maps: p.maps }));
  const botSets = (info.botSets ?? []).map((p) => ({ id: p.id, name: p.name, description: p.description, count: p.entries.length, text: botSetToText(presetBotSet(p)) }));
  // The match rules (shared sim/serverRules.ts): what each is, its control, when it applies and the modes it means anything in.
  const rules = SERVER_RULES.map((r) => ({ key: r.key, label: r.label, help: r.help, type: r.type.kind === 'list' ? { kind: 'list', max: r.type.max } : r.type, apply: r.apply, perMode: !!r.perMode, modes: GAME_MODES.filter((m) => !r.modes || r.modes(m)) }));
  const data = scriptJson({ version: info.version, commands: info.commands.map((c) => ({ name: c.name, args: c.args, help: c.help })), maps: info.maps, presets, botSets, site: info.site, rules, modeLabels: MODE_LABELS });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Tile Trigger Host</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Chakra+Petch:ital,wght@0,600;0,700;1,700&display=swap">
<style>${CSS}</style>
</head>
<body>
<header class="top">
  <div class="brand"><span class="tile">Tile</span> <span class="trigger">Trigger</span><small>Host Service <span id="version"></span></small></div>
  <div class="pill" id="pill" data-state="connecting"><i></i><span id="pill-text">Connecting…</span></div>
  <div class="code" id="code-box" hidden><small>Join code</small><b id="code"></b><button type="button" class="ghost" id="copy-code" title="Copy the join code">Copy</button></div>
  <span class="spacer"></span>
  <button type="button" class="ghost side-toggle" id="side-toggle" aria-controls="side" aria-expanded="false">Controls</button>
</header>
<main class="layout">
  <section class="main">
    <div class="tiles" id="tiles">
      <div class="tile-stat"><small>Players</small><b id="t-players">–</b></div>
      <div class="tile-stat"><small>Bots</small><b id="t-bots">–</b></div>
      <div class="tile-stat wide"><small>Map</small><b id="t-map">–</b></div>
      <div class="tile-stat"><small>Tick</small><b id="t-tick">–</b></div>
      <div class="tile-stat"><small>Upload</small><b id="t-up">–</b></div>
      <div class="tile-stat"><small>Uptime</small><b id="t-uptime">–</b></div>
    </div>
    <div class="term panel">
      <div class="term-head">
        <h2>Server <em>console</em></h2>
        <div class="seg" id="filter" role="group" aria-label="Show">
          <button type="button" data-f="all" class="on">All</button><button type="button" data-f="events">Events</button><button type="button" data-f="errors">Problems</button>
        </div>
        <label class="check"><input type="checkbox" id="show-status"> Status lines</label>
        <span class="spacer"></span>
        <button type="button" class="ghost" id="clear">Clear</button>
      </div>
      <div class="term-log" id="log" role="log" aria-live="polite" tabindex="0"></div>
      <button type="button" class="jump" id="jump" hidden>New lines ↓</button>
      <div class="suggest" id="suggest" hidden></div>
      <form class="term-input" id="cmd-form" autocomplete="off">
        <span class="prompt">&gt;</span>
        <input id="cmd" spellcheck="false" aria-label="Command" placeholder="Type a command (help lists them; Tab completes, ↑ ↓ history)">
        <button type="submit" class="primary">Run</button>
      </form>
      <div class="quick" id="quick"></div>
    </div>
  </section>
  <aside class="side" id="side">
    <section class="card">
      <h3>Server</h3>
      <p class="note" id="srv-note"></p>
      <div class="row-btns">
        <button type="button" class="primary" id="b-start">Start</button>
        <button type="button" id="b-stop">Stop</button>
        <button type="button" id="b-restart" title="Restart the match on the same map">Restart match</button>
        <button type="button" id="b-end" title="End the match now, to the scoreboard">End match</button>
      </div>
      <code class="hint" id="h-server">start · stop · restart · end</code>
    </section>
    <section class="card">
      <h3>Map <em>&amp; mode</em></h3>
      <div class="map-pic" id="map-pic"><img id="map-img" alt=""><span id="map-none">No picture</span></div>
      <label class="field"><span>Map</span><select id="f-map"></select></label>
      <div class="chips" id="f-modes" role="group" aria-label="Mode"></div>
      <code class="hint" id="h-map"></code>
    </section>
    <section class="card" id="rotation-card">
      <h3>Map <em>rotation</em> <span class="count" id="rot-count"></span></h3>
      <p class="note" id="rot-next"></p>
      <ol class="rot" id="rot-list"></ol>
      <div class="inline"><select id="rot-map" aria-label="Map to add"></select><select id="rot-mode" aria-label="Mode"></select><button type="button" id="rot-add">Add</button></div>
      <div class="inline"><select id="rot-preset" aria-label="Preset"><option value="">Start from a preset…</option></select><button type="button" id="rot-use">Use</button></div>
      <div class="row-btns"><label class="check"><input type="checkbox" id="rot-shuffle"> Shuffle</label><button type="button" id="rot-skip" title="Go on to the next map now">Skip to next</button><button type="button" id="rot-clear">Clear</button></div>
      <code class="hint" id="h-rot"></code>
    </section>
    <section class="card" id="bots-card">
      <h3>Bot <em>set</em> <span class="count" id="bots-count"></span></h3>
      <p class="note" id="bots-note"></p>
      <div class="inline"><select id="bots-preset" aria-label="Built-in bot set"><option value="">Start from a preset…</option></select><button type="button" id="bots-use">Use</button></div>
      <label class="field"><span title="One bot a line: Name, look, skill, style, team, squad (blank or - for the default; team from 1). A first line only keeps the match to these bots.">Bots</span><textarea id="bots-text" rows="6" spellcheck="false" placeholder="Sir Clank, core.knight, hard, -, 1, Vanguard&#10;Zorp, core.visitor"></textarea></label>
      <div class="row-btns"><button type="button" id="bots-apply">Apply</button><button type="button" id="bots-clear">Random bots</button></div>
      <code class="hint" id="h-bots"></code>
    </section>
    <section class="card">
      <h3>Players <em>&amp; bots</em></h3>
      <div class="field"><span title="Players and bots to keep: bots fill up to this, people take bots' places">Players + bots</span><div class="stepper" data-k="bots" data-min="1" data-max="96"><button type="button" data-d="-1" aria-label="Fewer">−</button><b id="v-bots">–</b><button type="button" data-d="1" aria-label="More">+</button></div></div>
      <div class="field" id="team-field"><span title="Every team to this size (8 = 8 v 8)">Team size</span><div class="stepper" data-k="teams" data-min="1" data-max="48"><button type="button" data-d="-1" aria-label="Smaller">−</button><b id="v-teams">–</b><button type="button" data-d="1" aria-label="Bigger">+</button></div></div>
      <div class="field"><span title="People (not bots) at once: your upload carries each one (about 20 KB/s each at 48 v 48)">People at most</span><div class="stepper" data-k="maxPlayers" data-min="1" data-max="64"><button type="button" data-d="-1" aria-label="Fewer">−</button><b id="v-max">–</b><button type="button" data-d="1" aria-label="More">+</button></div></div>
      <div class="field"><span title="Easy bots aim slowly and miss often; hard ones react fast, use cover and lead their shots">Bot skill</span><div class="seg" id="f-skill" role="group" aria-label="Bot skill"><button type="button" data-v="easy">Easy</button><button type="button" data-v="normal">Normal</button><button type="button" data-v="hard">Hard</button></div></div>
      <div class="field"><span title="Mixed: every character its own way. Arena: always moving. Tactical: cover and held angles">Bot style</span><div class="seg" id="f-style" role="group" aria-label="Bot style"><button type="button" data-v="mixed">Mixed</button><button type="button" data-v="arena">Arena</button><button type="button" data-v="tactical">Tactical</button></div></div>
      <div class="field"><span title="Idle this many seconds and a bot plays for them until they're back (0: never)">Idle → bot</span><span class="inline"><input id="f-afk" type="number" min="0" max="3600" aria-label="Seconds idle before a bot plays"><small class="unit">s</small><button type="button" id="b-afk">Set</button></span></div>
      <div class="field"><span title="Idle this many minutes, still connected, and they are removed (0: never)">Idle → out</span><span class="inline"><input id="f-idle" type="number" min="0" max="1440" aria-label="Minutes idle before removal"><small class="unit">min</small><button type="button" id="b-idle">Set</button></span></div>
      <p class="note">Everything here applies at once<span id="max-note">; while stopped, from the next Start</span>.</p>
      <code class="hint" id="h-players"></code>
    </section>
    <section class="card" id="rules-card">
      <h3>Match <em>rules</em> <span class="count" id="rules-mode"></span></h3>
      <p class="note">The rules of Play → Match setup and the pause menu, kept for every match this server plays. <i class="tag live">live</i> applies now, <i class="tag restart">restart</i> at the restart or the next map, <i class="tag next">next match</i> at the next match.</p>
      <div class="field"><span title="Every map: the rule for every map (score, time and respawn: for this mode). This map only: an override on this map.">Apply to</span><div class="seg" id="rules-scope" role="group" aria-label="Apply to"><button type="button" data-s="all" class="on">Every map</button><button type="button" data-s="map">This map only</button></div></div>
      <div class="rules" id="rules-main"></div>
      <details class="more" id="rules-more-box"><summary>More rules <span id="rules-more-count"></span></summary><div class="rules" id="rules-more"></div></details>
      <div class="wait" id="rules-wait" hidden><p class="note" id="rules-wait-text"></p><button type="button" class="primary" id="rules-restart" title="Restart the match now to play with the waiting rules">Restart now with them</button></div>
      <div class="row-btns"><button type="button" id="rules-reset" title="Every rule back to the mode's own">All rules to default</button></div>
      <code class="hint" id="h-rules">rules · rules &lt;rule&gt; &lt;value&gt; · rules map &lt;rule&gt; &lt;value&gt;</code>
    </section>
    <section class="card">
      <h3>Game <em>browser</em></h3>
      <label class="field"><span>Name</span><span class="inline"><input id="f-name" maxlength="40" spellcheck="false"><button type="button" id="b-name">Set</button></span></label>
      <div class="field"><span>Who can join</span><div class="seg" id="f-vis" role="group" aria-label="Visibility"><button type="button" data-v="listed">Listed</button><button type="button" data-v="code">Join code only</button></div></div>
      <label class="field"><span title="Each player gets this message when they join (at most 200 characters)">Join message</span><span class="inline"><input id="f-motd" maxlength="200" spellcheck="true" placeholder="Welcome! Be nice."><button type="button" id="b-motd">Set</button></span></label>
      <code class="hint" id="h-listing"></code>
    </section>
    <section class="card">
      <h3>People <em>playing</em> <span class="count" id="people-count"></span></h3>
      <div id="people" class="people"><p class="note">Nobody yet: bots only.</p></div>
    </section>
    <section class="card">
      <h3>Message <em>everyone</em></h3>
      <form class="inline" id="say-form"><input id="f-say" maxlength="200" placeholder="Back in 5 minutes: map change next"><button type="submit">Say</button></form>
      <code class="hint">say &lt;text&gt;</code>
    </section>
    <section class="card">
      <h3>Admin <em>&amp; bans</em></h3>
      <p class="note">The admin token lets a player run the match from the pause menu → Server admin.</p>
      <div class="row-btns"><button type="button" id="b-tok-show">Show token</button><button type="button" id="b-tok-new">New token</button><button type="button" id="b-tok-clear">Remove</button></div>
      <code class="hint">admin token [rotate|clear]</code>
      <div id="bans" class="bans"></div>
    </section>
    <section class="card danger-zone">
      <button type="button" class="danger" id="b-quit">Close the Host Service</button>
      <p class="note">Stops the server and closes the window too. <code>quit</code></p>
    </section>
  </aside>
</main>
<div class="overlay" id="overlay" hidden><div class="panel"><h2 id="ov-title"></h2><p id="ov-text"></p></div></div>
<div class="toast" id="toast" hidden></div>
<script type="application/json" id="launcher-data">${data}</script>
<script nonce="${nonce}">${SCRIPT}</script>
</body>
</html>
`;
}

// The site's design (packages/client/src/style.css): deep navy panels, cyan selection, condensed uppercase headings.
const CSS = `
:root {
  --deep-space: #0b0f1a; --slate: #1a2233; --panel: #273449; --text: #e6f0ff; --muted: #8ea2c0;
  --cyan: #00d1ff; --purple: #8765ff; --pink: #ff5ea8; --orange: #ffb347;
  --success: #2ecc71; --warning: #f1c40f; --error: #e74c3c; --info: #3498db;
  --surface-1: #121827; --surface-2: #1e2838; --surface-3: #2a3a55; --line: rgba(142, 162, 192, 0.18);
  --glass: rgba(14, 20, 33, 0.86);
  --font-display: 'Chakra Petch', 'Barlow', system-ui, sans-serif;
  --font-body: 'Barlow', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: ui-monospace, 'Cascadia Mono', 'SF Mono', Menlo, Consolas, monospace;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body { background: radial-gradient(1200px 600px at 20% -10%, rgba(0, 209, 255, 0.08), transparent 60%), var(--deep-space); color: var(--text); font: 500 15px/1.4 var(--font-body); display: flex; flex-direction: column; }
button { font: 600 13px/1.2 var(--font-display); letter-spacing: 0.04em; text-transform: uppercase; padding: 8px 12px; border: 1px solid var(--line); border-radius: 3px; background: var(--surface-2); color: var(--text); cursor: pointer; }
button:hover:not(:disabled) { border-color: rgba(0, 209, 255, 0.55); }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--cyan); outline-offset: 1px; }
button:disabled { opacity: 0.4; cursor: default; }
button.primary { background: var(--cyan); border-color: var(--cyan); color: #04121a; }
button.danger { background: transparent; border-color: rgba(231, 76, 60, 0.6); color: #ff8a7d; width: 100%; }
button.ghost { background: transparent; }
input, select, textarea { font: 500 14px var(--font-body); color: var(--text); background: var(--surface-1); border: 1px solid var(--line); border-radius: 3px; padding: 7px 9px; min-width: 0; }
textarea { width: 100%; resize: vertical; font: 500 13px ui-monospace, Menlo, Consolas, monospace; line-height: 1.4; }
select { width: 100%; }
.panel { background: var(--glass); border: 1px solid var(--line); border-radius: 6px; }
.spacer { flex: 1; }
.top { display: flex; align-items: center; gap: 16px; padding: 12px 20px; border-bottom: 1px solid var(--line); background: rgba(8, 11, 19, 0.92); flex-wrap: wrap; }
.brand { font: italic 700 24px/1 var(--font-display); text-transform: uppercase; letter-spacing: 0.02em; }
.brand .trigger { color: var(--cyan); }
.brand small { margin-left: 10px; font: 600 12px var(--font-display); font-style: normal; letter-spacing: 0.14em; color: var(--muted); }
.pill { display: flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--line); font: 700 12px var(--font-display); letter-spacing: 0.12em; text-transform: uppercase; }
.pill i { width: 9px; height: 9px; border-radius: 50%; background: var(--muted); }
.pill[data-state=running] { border-color: rgba(46, 204, 113, 0.5); color: var(--success); }
.pill[data-state=running] i { background: var(--success); box-shadow: 0 0 10px var(--success); }
.pill[data-state=starting] i, .pill[data-state=restarting] i, .pill[data-state=stopping] i { background: var(--warning); animation: blink 1s infinite; }
.pill[data-state=starting], .pill[data-state=restarting], .pill[data-state=stopping] { color: var(--warning); }
.pill[data-state=crashloop], .pill[data-state=offline] { color: #ff8a7d; border-color: rgba(231, 76, 60, 0.5); }
.pill[data-state=crashloop] i, .pill[data-state=offline] i { background: var(--error); }
@keyframes blink { 50% { opacity: 0.3; } }
.code { display: flex; align-items: center; gap: 8px; }
.code small { color: var(--muted); font: 700 11px var(--font-display); letter-spacing: 0.14em; text-transform: uppercase; }
.code b { font: 700 20px var(--font-display); letter-spacing: 0.18em; color: var(--orange); }
.code button { padding: 4px 8px; font-size: 11px; }
.side-toggle { display: none; }
.layout { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; padding: 16px 20px 18px; }
.main { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.tiles { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; }
.tile-stat { padding: 10px 12px; background: var(--glass); border: 1px solid var(--line); border-radius: 6px; min-width: 0; }
.tile-stat.wide { grid-column: span 2; }
.tile-stat small { display: block; color: var(--muted); font: 700 11px var(--font-display); letter-spacing: 0.14em; text-transform: uppercase; }
.tile-stat b { display: block; margin-top: 2px; font: 700 20px var(--font-display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.term { position: relative; flex: 1; min-height: 320px; display: flex; flex-direction: column; overflow: hidden; }
.term-head { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-bottom: 1px solid var(--line); background: linear-gradient(90deg, rgba(0, 209, 255, 0.10), transparent 70%); flex-wrap: wrap; }
h2, h3 { margin: 0; font-family: var(--font-display); text-transform: uppercase; }
h2 { font: italic 700 20px var(--font-display); letter-spacing: 0.02em; }
h2 em, h3 em { color: var(--cyan); }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 3px; overflow: hidden; }
.seg button { border: 0; border-radius: 0; background: transparent; padding: 6px 10px; font-size: 11px; color: var(--muted); }
.seg button + button { border-left: 1px solid var(--line); }
.seg button.on { background: rgba(0, 209, 255, 0.16); color: var(--cyan); }
.check { display: flex; align-items: center; gap: 6px; color: var(--muted); font: 600 12px var(--font-display); letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }
.term-log { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 14px; font: 13px/1.5 var(--mono); background: #070a12; }
.ln { display: flex; gap: 10px; white-space: pre-wrap; word-break: break-word; }
.ln .tm { flex: none; color: #4f6280; }
.ln .tag { flex: none; min-width: 64px; font: 700 10px/19px var(--font-display); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.ln[data-tag=service] .tag { color: var(--purple); }
.ln[data-tag=host] .tag { color: var(--info); }
.ln[data-tag=web] .tag { color: var(--pink); }
.ln[data-tag=status] { opacity: 0.7; }
.ln[data-tag=event] .tag { color: var(--orange); }
.ln.cmd { color: var(--cyan); margin-top: 6px; }
.ln.cmd .who { color: #4f6280; font-size: 11px; }
.ln.out { color: #cfe0f7; }
.ln.err { color: #ff8a7d; }
.term-log.hide-status .ln[data-tag=status] { display: none; }
.term-log[data-f=events] .ln:not([data-tag=event]):not(.cmd):not(.out) { display: none; }
.term-log[data-f=errors] .ln:not(.err) { display: none; }
.jump { position: absolute; right: 18px; bottom: 102px; z-index: 2; background: var(--cyan); color: #04121a; border-color: var(--cyan); }
.term-input { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-top: 1px solid var(--line); background: var(--surface-1); }
.term-input .prompt { color: var(--cyan); font: 700 18px var(--mono); }
.term-input input { flex: 1; font: 14px var(--mono); background: #070a12; padding: 9px 10px; }
.suggest { position: absolute; left: 12px; right: 12px; bottom: 96px; z-index: 3; max-height: 240px; overflow-y: auto; background: var(--surface-1); border: 1px solid rgba(0, 209, 255, 0.4); border-radius: 4px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); }
.suggest div { display: flex; gap: 12px; padding: 6px 10px; cursor: pointer; font: 13px var(--mono); }
.suggest div.on, .suggest div:hover { background: rgba(0, 209, 255, 0.14); }
.suggest b { color: var(--cyan); font-weight: 600; white-space: nowrap; }
.suggest span { color: var(--muted); font-family: var(--font-body); }
.quick { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 12px 10px; background: var(--surface-1); }
.quick button { padding: 4px 9px; font: 12px var(--mono); text-transform: none; letter-spacing: 0; color: var(--muted); background: transparent; }
.side { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 2px; }
.card { padding: 14px; background: var(--glass); border: 1px solid var(--line); border-radius: 6px; display: flex; flex-direction: column; gap: 10px; }
.card h3 { font: italic 700 16px var(--font-display); letter-spacing: 0.03em; display: flex; align-items: center; gap: 6px; }
.card .count { margin-left: auto; font: 700 12px var(--font-display); color: var(--muted); font-style: normal; }
.note { margin: 0; color: var(--muted); font-size: 13px; }
.note:empty { display: none; }
.hint { align-self: flex-start; font: 11.5px var(--mono); color: #6f86a8; background: rgba(0, 0, 0, 0.25); border: 1px dashed rgba(142, 162, 192, 0.25); border-radius: 3px; padding: 2px 6px; }
.hint::before { content: '> '; color: var(--cyan); }
.hint:empty { display: none; }
.row-btns { display: flex; flex-wrap: wrap; gap: 6px; }
.row-btns button { flex: 1 1 auto; }
.field { display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 10px; }
.field > span:first-child { color: var(--muted); font: 600 12px var(--font-display); letter-spacing: 0.06em; text-transform: uppercase; }
.inline { display: flex; gap: 6px; min-width: 0; }
.inline input { flex: 1; }
.stepper { display: flex; align-items: center; gap: 6px; }
.stepper b { min-width: 40px; text-align: center; font: 700 18px var(--font-display); }
.stepper button { padding: 4px 11px; font-size: 16px; }
.stepper.pending b { color: var(--orange); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chips button { padding: 6px 10px; font-size: 12px; }
.chips button.on { border-color: var(--cyan); background: rgba(0, 209, 255, 0.16); color: var(--cyan); box-shadow: 0 0 0 1px var(--cyan); }
.map-pic { position: relative; aspect-ratio: 16 / 9; border-radius: 4px; overflow: hidden; border: 1px solid var(--line); background: repeating-linear-gradient(135deg, #0d1322 0 10px, #111a2c 10px 20px); display: flex; align-items: center; justify-content: center; }
.map-pic img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.map-pic span { color: var(--muted); font: 700 10px var(--font-display); letter-spacing: 0.14em; text-transform: uppercase; }
.people { display: flex; flex-direction: column; gap: 6px; }
.person { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 8px; align-items: center; padding: 8px; border-radius: 4px; background: var(--surface-1); }
.person b { font: 700 14px var(--font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.person small { grid-column: 1; color: var(--muted); font-size: 12px; }
.person .acts { grid-column: 2; grid-row: 1 / span 2; display: flex; gap: 4px; }
.person .acts button { padding: 4px 8px; font-size: 11px; }
.bans { display: flex; flex-direction: column; gap: 4px; }
.rot { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; counter-reset: rot; }
.rot li { counter-increment: rot; display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 6px; align-items: center; padding: 5px 6px; border-radius: 4px; background: var(--surface-1); font-size: 13px; }
.rot li::before { content: counter(rot); color: var(--muted); font: 700 12px var(--font-display); text-align: right; }
.rot li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rot li small { color: var(--muted); }
.rot li.now { box-shadow: inset 3px 0 0 var(--success); }
.rot li.next { box-shadow: inset 3px 0 0 var(--cyan); }
.rot li .acts { display: flex; gap: 2px; }
.rot li .acts button { padding: 2px 7px; font-size: 11px; }
.card .inline select { flex: 1; min-width: 0; width: auto; }
.ban { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.ban span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
.ban b { color: var(--text); }
.ban button { padding: 3px 8px; font-size: 11px; }
.unit { color: var(--muted); align-self: center; }
.field input[type=number] { width: 80px; flex: 0 0 auto; }
.rules { display: flex; flex-direction: column; gap: 6px; }
.rule { display: grid; grid-template-columns: 124px minmax(0, 1fr); align-items: center; gap: 8px; }
.rule > span { color: var(--muted); font: 600 12px var(--font-display); letter-spacing: 0.04em; text-transform: uppercase; }
.rule .ctl { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
.rule .seg button { padding: 5px 8px; }
.rule .stepper b { min-width: 52px; font-size: 15px; }
.rule .ctl input { flex: 1; min-width: 0; }
.rule.pending > span { color: var(--orange); }
.rule .was { flex-basis: 100%; color: var(--orange); font-size: 12px; }
.rule .dflt { padding: 2px 7px; font-size: 11px; }
.rule.set > span::after { content: ' \u25cf'; color: var(--cyan); }
.tag { font: 700 9px var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; font-style: normal; padding: 1px 4px; border-radius: 2px; border: 1px solid var(--line); margin-left: 4px; }
.tag.live { color: var(--success); }
.tag.restart { color: var(--warning); }
.tag.next { color: var(--info); }
.more summary { cursor: pointer; color: var(--muted); font: 600 12px var(--font-display); letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 0; }
.more[open] summary { margin-bottom: 6px; }
.wait { display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px dashed rgba(255, 179, 71, 0.5); border-radius: 4px; }
.wait .note { color: var(--orange); }
.overlay { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; background: rgba(5, 8, 14, 0.82); backdrop-filter: blur(3px); }
.overlay .panel { max-width: 520px; padding: 24px 26px; display: flex; flex-direction: column; gap: 10px; }
.overlay p { margin: 0; color: var(--muted); }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 11; padding: 10px 16px; border-radius: 4px; background: var(--surface-3); border: 1px solid rgba(0, 209, 255, 0.4); font: 600 14px var(--font-body); }
[hidden] { display: none !important; }
@media (max-width: 1100px) { .tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } .tile-stat.wide { grid-column: span 2; } }
@media (max-width: 900px) {
  .layout { grid-template-columns: minmax(0, 1fr); padding: 12px; }
  .side-toggle { display: inline-block; }
  .side { position: fixed; z-index: 5; top: 0; right: 0; bottom: 0; width: min(380px, 92vw); padding: 14px; background: var(--deep-space); border-left: 1px solid var(--line); transform: translateX(105%); transition: transform 0.2s ease-out; }
  .side.open { transform: none; box-shadow: -20px 0 40px rgba(0, 0, 0, 0.5); }
  .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tile-stat.wide { grid-column: span 3; }
}
`;

// The page's script: plain ES5-style code (no template strings: it lives in one).
const SCRIPT = `
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('launcher-data').textContent);
  var $ = function (id) { return document.getElementById(id); };
  var KEY_STORE = 'tt-host-launcher-key';
  var key = '';
  var m = /[#&]key=([a-f0-9]{48})/.exec(location.hash);
  if (m) {
    key = m[1];
    try { localStorage.setItem(KEY_STORE, key); } catch (e) {}
    history.replaceState(null, '', location.pathname);
  } else {
    try { key = localStorage.getItem(KEY_STORE) || ''; } catch (e) {}
  }
  $('version').textContent = DATA.version;

  function api(path, body) {
    var init = { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + key } };
    if (body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    return fetch(path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || ('error ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function toast(text) {
    var t = $('toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function overlay(title, text) {
    $('overlay').hidden = !title;
    if (title) { $('ov-title').textContent = title; $('ov-text').textContent = text; }
  }

  // ---------------------------------------------------------------- console
  var log = $('log');
  var stick = true;
  var after = 0;
  var MAX_LINES = 2000;
  log.addEventListener('scroll', function () {
    stick = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    if (stick) $('jump').hidden = true;
  });
  $('jump').addEventListener('click', function () { log.scrollTop = log.scrollHeight; });
  var PROBLEM = /error|fail|crash|refused|unreachable|unexpected|denied|can't|cannot|invalid|unknown command|usage:/i;
  function addLine(l) {
    var row = document.createElement('div');
    row.className = 'ln ' + l.kind;
    if (l.kind === 'log') {
      var p = /^(\\d{4}-\\d\\d-\\d\\d )?(\\d\\d:\\d\\d:\\d\\d) (?:\\[(\\w+)\\] ?)?([\\s\\S]*)$/.exec(l.text);
      var tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = p ? p[2] : '';
      var tag = document.createElement('span'); tag.className = 'tag';
      var t = p && p[3] ? p[3] : 'event';
      tag.textContent = t; row.dataset.tag = t;
      var txt = document.createElement('span'); txt.textContent = p ? p[4] : l.text;
      row.append(tm, tag, txt);
      if (PROBLEM.test(l.text) && t !== 'status') row.classList.add('err');
    } else if (l.kind === 'cmd') {
      row.textContent = '> ' + l.text + '  ';
      var who = document.createElement('span'); who.className = 'who';
      who.textContent = l.from === 'launcher' ? '(launcher)' : '(window)';
      row.append(who);
    } else {
      row.textContent = l.text;
      if (PROBLEM.test(l.text)) row.classList.add('err');
    }
    log.append(row);
    while (log.childElementCount > MAX_LINES) log.firstElementChild.remove();
  }
  function local(kind, text) { addLine({ kind: kind, text: text }); scrollDown(); }
  function scrollDown() {
    if (stick) log.scrollTop = log.scrollHeight; else $('jump').hidden = false;
  }
  function pollLog() {
    api('/api/log?after=' + after).then(function (d) {
      if (d.reset) log.replaceChildren();
      d.lines.forEach(addLine);
      after = d.next;
      if (d.lines.length) scrollDown();
      setTimeout(pollLog, d.lines.length >= 500 ? 50 : 700);
    }, function (e) { failed(e); setTimeout(pollLog, 2000); });
  }
  $('filter').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
    log.dataset.f = b.dataset.f;
    log.scrollTop = log.scrollHeight;
  });
  var showStatus = $('show-status');
  try { showStatus.checked = localStorage.getItem('tt-host-status-lines') !== '0'; } catch (e) { showStatus.checked = true; }
  log.classList.toggle('hide-status', !showStatus.checked);
  showStatus.addEventListener('change', function () {
    log.classList.toggle('hide-status', !showStatus.checked);
    try { localStorage.setItem('tt-host-status-lines', showStatus.checked ? '1' : '0'); } catch (e) {}
  });
  $('clear').addEventListener('click', function () { log.replaceChildren(); });

  // Run a console command, exactly as typed in the window (the answer arrives with the log).
  function run(line) {
    return api('/api/console', { line: line }).then(function () { setTimeout(pollStatus, 300); }, function (e) { local('out', 'could not run "' + line + '": ' + e.message); });
  }

  // ---------------------------------------------------------------- command line
  var cmd = $('cmd');
  var hist = [];
  try { hist = JSON.parse(localStorage.getItem('tt-host-history') || '[]').slice(-100); } catch (e) {}
  var hpos = hist.length;
  var suggest = $('suggest');
  var picks = [];
  var pick = -1;
  var MODES = [];
  DATA.maps.forEach(function (mp) { mp.modes.forEach(function (md) { var s = md.id.replace('core.', ''); if (MODES.indexOf(s) < 0) MODES.push(s); }); });
  function pool(word0) {
    if (word0 === 'map') return DATA.maps.map(function (mp) { return { name: mp.id, help: mp.name }; });
    if (word0 === 'mode') return MODES.map(function (s) { return { name: s, help: '' }; });
    if (word0 === 'visibility') return [{ name: 'listed', help: 'game browser and code' }, { name: 'code', help: 'join code only' }];
    if (word0 === 'admin') return [{ name: 'token', help: 'show it' }, { name: 'token rotate', help: 'a new one' }, { name: 'token clear', help: 'remove it' }];
    if (word0 === 'help') return DATA.commands.map(function (c) { return { name: c.name, help: c.help }; });
    return [];
  }
  function matches() {
    var v = cmd.value.replace(/^\\s+/, '');
    var parts = v.split(/\\s+/);
    if (parts.length <= 1) {
      return DATA.commands.filter(function (c) { return c.name.indexOf(parts[0].toLowerCase()) === 0; }).map(function (c) { return { fill: c.name + (c.args ? ' ' : ''), name: c.name + (c.args ? ' ' + c.args : ''), help: c.help }; });
    }
    var last = v.slice(parts[0].length).replace(/^\\s+/, '').toLowerCase();
    return pool(parts[0].toLowerCase()).filter(function (o) { return o.name.indexOf(last) === 0 && o.name !== last; }).slice(0, 40).map(function (o) { return { fill: parts[0] + ' ' + o.name, name: o.name, help: o.help }; });
  }
  function showSuggest() {
    picks = cmd.value.trim() ? matches() : [];
    pick = -1;
    suggest.replaceChildren();
    picks.forEach(function (p, i) {
      var d = document.createElement('div');
      var b = document.createElement('b'); b.textContent = p.name;
      var s = document.createElement('span'); s.textContent = p.help;
      d.append(b, s);
      d.addEventListener('mousedown', function (e) { e.preventDefault(); take(i); });
      suggest.append(d);
    });
    suggest.hidden = !picks.length;
  }
  function mark() { Array.prototype.forEach.call(suggest.children, function (d, i) { d.classList.toggle('on', i === pick); if (i === pick) d.scrollIntoView({ block: 'nearest' }); }); }
  function take(i) {
    cmd.value = picks[i].fill;
    cmd.focus();
    showSuggest();
  }
  cmd.addEventListener('input', showSuggest);
  cmd.addEventListener('blur', function () { setTimeout(function () { suggest.hidden = true; }, 100); });
  cmd.addEventListener('keydown', function (e) {
    var open = !suggest.hidden && picks.length;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!picks.length) showSuggest();
      if (picks.length === 1 || (open && pick >= 0)) take(Math.max(pick, 0));
      else if (picks.length) { pick = (pick + 1) % picks.length; mark(); }
    } else if (e.key === 'ArrowDown' && open) { e.preventDefault(); pick = (pick + 1) % picks.length; mark(); }
    else if (e.key === 'ArrowUp' && open && pick >= 0) { e.preventDefault(); pick = pick - 1; mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hpos > 0) { hpos--; cmd.value = hist[hpos]; } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (hpos < hist.length) { hpos++; cmd.value = hist[hpos] || ''; } }
    else if (e.key === 'Escape') { suggest.hidden = true; }
    else if (e.key === 'Enter' && open && pick >= 0) { e.preventDefault(); take(pick); }
  });
  $('cmd-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var line = cmd.value.trim();
    if (!line) return;
    if (line === 'quit' && !confirm('Close the Host Service? The server stops and everyone playing is disconnected.')) return;
    if (hist[hist.length - 1] !== line) hist.push(line);
    try { localStorage.setItem('tt-host-history', JSON.stringify(hist.slice(-100))); } catch (e2) {}
    hpos = hist.length;
    cmd.value = '';
    suggest.hidden = true;
    stick = true;
    run(line);
  });
  ['status', 'players', 'teams', 'bans', 'help'].forEach(function (c) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = c;
    b.addEventListener('click', function () { run(c); });
    $('quick').append(b);
  });

  // ---------------------------------------------------------------- the right bar
  // Running: every control runs its console command at once. Stopped: they edit what Start starts with.
  var S = null;
  var draft = null;
  var mapById = {};
  DATA.maps.forEach(function (mp) { mapById[mp.id] = mp; });
  var fMap = $('f-map');
  DATA.maps.forEach(function (mp) { var o = document.createElement('option'); o.value = mp.id; o.textContent = mp.name; fMap.append(o); });
  function running() { return S && S.state === 'running' && S.host; }
  function stopped() { return !S || S.state === 'stopped' || S.state === 'crashloop'; }
  function cur() {
    // What the controls show: the live match when it runs, else the draft for the next start.
    if (running()) {
      var h = S.host;
      return { map: h.mapId, mode: h.mode, botFill: h.fill || h.players + h.bots, maxPlayers: h.maxPlayers, name: h.name, visibility: h.visibility, skill: h.skill || 'normal', style: h.style || 'mixed', motd: h.motd || '', afkSeconds: h.afkSeconds, idleKickMinutes: h.idleKickMinutes };
    }
    return draft;
  }
  function modeShort(m) { return (m || '').replace('core.', ''); }

  function renderMap() {
    var c = cur(); if (!c) return;
    if (document.activeElement !== fMap) fMap.value = c.map;
    var mp = mapById[c.map];
    var img = $('map-img');
    var src = DATA.site + '/maps/shots/' + c.map + '.jpg';
    if (img.dataset.src !== src) {
      img.dataset.src = src; img.hidden = false; $('map-none').hidden = true;
      img.onerror = function () { img.hidden = true; $('map-none').hidden = false; };
      img.src = src;
    }
    var modes = $('f-modes');
    modes.replaceChildren();
    var mode = c.mode || (mp && mp.modes[0] ? mp.modes[0].id : '');
    (mp ? mp.modes : []).forEach(function (md) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = md.label;
      b.classList.toggle('on', md.id === mode);
      b.dataset.mode = md.id;
      b.addEventListener('click', function () {
        if (md.id === mode) return;
        if (running()) run('mode ' + modeShort(md.id));
        else { draft.mode = md.id; renderAll(); }
      });
      modes.append(b);
    });
    var team = mp && mp.modes.some(function (md) { return md.id === mode && md.team; });
    $('team-field').hidden = !team;
    $('h-map').textContent = running() ? 'map ' + c.map + ' · mode ' + modeShort(mode) : 'start  (with ' + (mp ? mp.name : c.map) + ', ' + modeShort(mode) + ')';
  }
  fMap.addEventListener('change', function () {
    var id = fMap.value;
    if (running()) run('map ' + id);
    else { draft.map = id; draft.mode = ''; renderAll(); }
  });

  var pending = {};
  var stepTimer = {};
  document.querySelectorAll('.stepper').forEach(function (st) {
    var k = st.dataset.k;
    st.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var now = pending[k] != null ? pending[k] : value(k);
      if (now == null) return;
      var next = Math.max(+st.dataset.min, Math.min(+st.dataset.max, now + (+b.dataset.d) * (e.shiftKey ? 8 : 1)));
      pending[k] = next;
      st.classList.add('pending');
      renderPlayers();
      clearTimeout(stepTimer[k]);
      stepTimer[k] = setTimeout(function () { commit(k); }, 700);
    });
  });
  function value(k) {
    var c = cur(); if (!c) return null;
    if (k === 'bots') return c.botFill;
    if (k === 'maxPlayers') return c.maxPlayers;
    // Two teams' worth of the fill (teams on its own in the console lists them exactly).
    if (k === 'teams') return Math.max(1, Math.round(c.botFill / 2));
    return null;
  }
  function commit(k) {
    var v = pending[k];
    delete pending[k];
    document.querySelector('.stepper[data-k=' + k + ']').classList.remove('pending');
    if (v == null) return;
    if (!running()) {
      if (k === 'teams') { draft.botFill = Math.min(96, v * 2); }
      else if (k === 'bots') draft.botFill = v;
      else draft.maxPlayers = v;
      renderAll();
      return;
    }
    run(k === 'bots' ? 'bots ' + v : k === 'maxPlayers' ? 'maxplayers ' + v : 'teams ' + v);
  }
  function renderPlayers() {
    var c = cur(); if (!c) return;
    var b = pending.bots != null ? pending.bots : c.botFill;
    var t = pending.teams != null ? pending.teams : value('teams');
    var mx = pending.maxPlayers != null ? pending.maxPlayers : c.maxPlayers;
    $('v-bots').textContent = b; $('v-teams').textContent = t; $('v-max').textContent = mx;
    $('max-note').hidden = running();
    $('h-players').textContent = running() ? 'bots ' + b + ($('team-field').hidden ? '' : ' · teams ' + t) + ' · maxplayers ' + mx + ' · skill ' + c.skill + ' · style ' + c.style : 'start  (with these numbers)';
    $('f-skill').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x.dataset.v === (c.skill || 'normal')); });
    var style = running() ? c.style : ((draftRule('style') || {}).v || 'mixed');
    $('f-style').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x.dataset.v === style); });
    if (document.activeElement !== $('f-afk')) $('f-afk').value = c.afkSeconds != null ? c.afkSeconds : 90;
    if (document.activeElement !== $('f-idle')) $('f-idle').value = c.idleKickMinutes != null ? c.idleKickMinutes : 10;
  }
  $('f-skill').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (running()) run('skill ' + b.dataset.v); else { draft.skill = b.dataset.v; renderAll(); }
  });
  $('f-style').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (running()) run('style ' + b.dataset.v);
    else { setDraftRule('style', b.dataset.v === 'mixed' ? undefined : b.dataset.v, false); renderAll(); }
  });
  function setIdle(k, input) {
    var v = Math.round(+$(input).value);
    if (!(v >= 0)) return;
    if (running()) run(k + ' ' + v);
    else { if (k === 'afk') draft.afkSeconds = v; else draft.idleKickMinutes = v; renderAll(); toast('From the next Start'); }
  }
  $('b-afk').addEventListener('click', function () { setIdle('afk', 'f-afk'); });
  $('b-idle').addEventListener('click', function () { setIdle('idlekick', 'f-idle'); });

  var fName = $('f-name');
  function setName() {
    var v = fName.value.trim(); if (!v) return;
    if (running()) run('name "' + v.replace(/"/g, "'") + '"');
    else { draft.name = v; renderAll(); toast('Name set for the next Start'); }
  }
  $('b-name').addEventListener('click', setName);
  fName.addEventListener('keydown', function (e) { if (e.key === 'Enter') setName(); });
  function setMotd() {
    var v = $('f-motd').value.trim();
    if (running()) run(v ? 'motd ' + v : 'motd clear');
    else { draft.motd = v; renderAll(); toast(v ? 'Join message set for the next Start' : 'No join message'); }
  }
  $('b-motd').addEventListener('click', setMotd);
  $('f-motd').addEventListener('keydown', function (e) { if (e.key === 'Enter') setMotd(); });
  $('f-vis').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (running()) run('visibility ' + b.dataset.v);
    else { draft.visibility = b.dataset.v; renderAll(); }
  });
  function renderListing() {
    var c = cur(); if (!c) return;
    if (document.activeElement !== fName) fName.value = c.name || '';
    $('f-vis').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === c.visibility); });
    if (document.activeElement !== $('f-motd')) $('f-motd').value = c.motd || '';
    $('h-listing').textContent = running() ? 'name "' + (c.name || '') + '" · visibility ' + c.visibility + ' · motd <text>' : '';
  }

  function renderPeople() {
    var box = $('people');
    var list = running() ? S.host.people || [] : [];
    $('people-count').textContent = running() ? list.length + ' / ' + S.host.maxPlayers : '';
    box.replaceChildren();
    if (!list.length) {
      var p = document.createElement('p'); p.className = 'note';
      p.textContent = running() ? 'Nobody yet: bots only.' : 'The server isn\\u2019t running.';
      box.append(p); return;
    }
    list.forEach(function (pl) {
      var row = document.createElement('div'); row.className = 'person';
      var n = document.createElement('b'); n.textContent = pl.name; n.title = '#' + pl.slot;
      var s = document.createElement('small');
      s.textContent = '#' + pl.slot + ' · ' + (pl.account ? 'account' : 'guest') + ' · ' + (pl.ping == null ? '–' : pl.ping + ' ms') + (pl.team ? ' · ' + pl.team : '') + ' · ' + pl.kills + '/' + pl.deaths;
      var acts = document.createElement('div'); acts.className = 'acts';
      var k = document.createElement('button'); k.type = 'button'; k.textContent = 'Kick'; k.title = 'kick #' + pl.slot;
      k.addEventListener('click', function () { run('kick #' + pl.slot); });
      var bn = document.createElement('button'); bn.type = 'button'; bn.textContent = 'Ban'; bn.title = 'ban #' + pl.slot + ' 1d';
      bn.addEventListener('click', function () {
        var d = prompt('Ban ' + pl.name + ' for how long? (30m, 12h, 7d, or leave empty for good)', '1d');
        if (d === null) return;
        d = d.trim();
        if (d && !/^\\d{1,6}[mhdw]?$/i.test(d)) { toast('Use 30m, 12h, 7d or 2w'); return; }
        run('ban #' + pl.slot + (d ? ' ' + d : ''));
      });
      acts.append(k, bn);
      row.append(n, acts, s);
      box.append(row);
    });
  }
  function renderBans() {
    var box = $('bans'); box.replaceChildren();
    (S && S.bans || []).forEach(function (b) {
      var row = document.createElement('div'); row.className = 'ban';
      var s = document.createElement('span');
      var n = document.createElement('b'); n.textContent = b.name;
      s.append(n, document.createTextNode(' · ' + (b.account ? 'account' : 'guest') + ' · ' + (b.until ? 'until ' + new Date(b.until).toLocaleString() : 'for good') + (b.reason ? ' · ' + b.reason : '')));
      var u = document.createElement('button'); u.type = 'button'; u.textContent = 'Unban'; u.title = 'unban ' + b.id;
      u.addEventListener('click', function () { run('unban ' + b.id); });
      row.append(s, u); box.append(row);
    });
  }

  function fmtUptime(s) { var h = Math.floor(s / 3600), mi = Math.floor(s / 60) % 60; return h ? h + 'h ' + mi + 'm' : mi + ' min'; }
  function renderTop() {
    var st = S ? S.state : 'offline';
    var pill = $('pill');
    pill.dataset.state = st;
    var label = { running: 'Running', starting: 'Starting…', stopping: 'Stopping…', restarting: 'Restarting…', stopped: 'Stopped', crashloop: 'Stopped after crashes', offline: 'Host Service closed' }[st] || st;
    if (st === 'running' && S.host && !S.host.online) label = 'Running · hub unreachable';
    $('pill-text').textContent = label;
    var h = running() ? S.host : null;
    $('code-box').hidden = !h;
    if (h) $('code').textContent = h.code;
    $('t-players').textContent = h ? h.players + ' / ' + h.maxPlayers : '–';
    $('t-bots').textContent = h ? h.bots : '–';
    $('t-map').textContent = h ? h.map + ' · ' + modeShort(h.mode) : (draft && mapById[draft.map] ? mapById[draft.map].name + ' (next start)' : '–');
    $('t-tick').textContent = h ? h.tickMs.toFixed(1) + ' ms' : '–';
    $('t-up').textContent = h ? h.upKBps + ' KB/s' : '–';
    $('t-uptime').textContent = h ? fmtUptime(h.uptimeS) : '–';
    var busy = st === 'starting' || st === 'stopping' || st === 'restarting';
    $('b-start').disabled = !stopped();
    $('b-stop').disabled = stopped() || busy;
    $('b-restart').disabled = !running();
    $('b-end').disabled = !running();
    var note = '';
    if (st === 'crashloop' || (S && S.lastError && st === 'stopped')) note = S.lastError ? 'Last problem: ' + S.lastError.summary : '';
    else if (h && h.visibility === 'listed') note = h.listed ? 'Listed in the game browser as \\u201c' + h.name + '\\u201d.' : 'Not in the game browser yet' + (h.listingError ? ': ' + h.listingError : '…');
    else if (h) note = 'Join code only: share the code.';
    else if (stopped()) note = 'Stopped. Change anything below, then Start.';
    $('srv-note').textContent = note;
  }
  // ---------------------------------------------------------------- map rotation
  // Running: the match's rotation (each button runs its rotation command). Stopped: the list the next Start plays.
  var presetById = {};
  (DATA.presets || []).forEach(function (p) {
    presetById[p.id] = p;
    var o = document.createElement('option'); o.value = p.id; o.textContent = p.name + ' (' + p.maps.length + ' maps)'; o.title = p.description;
    $('rot-preset').append(o);
  });
  var rotMap = $('rot-map');
  DATA.maps.forEach(function (mp) { var o = document.createElement('option'); o.value = mp.id; o.textContent = mp.name; rotMap.append(o); });
  function fillRotModes() {
    var mp = mapById[rotMap.value]; var sel = $('rot-mode'); var was = sel.value;
    sel.replaceChildren();
    (mp ? mp.modes : []).forEach(function (md) { var o = document.createElement('option'); o.value = md.id; o.textContent = md.label; sel.append(o); });
    if (was && mp && mp.modes.some(function (md) { return md.id === was; })) sel.value = was;
  }
  rotMap.addEventListener('change', fillRotModes);
  fillRotModes();
  function modeLabel(m) { for (var i = 0; i < DATA.maps.length; i++) for (var j = 0; j < DATA.maps[i].modes.length; j++) if (DATA.maps[i].modes[j].id === m) return DATA.maps[i].modes[j].label; return modeShort(m); }
  // Config items ("frost_basin:tdm", "preset:flag_run") as entries, for the list while stopped.
  function draftEntries(items) {
    var out = [];
    (items || []).forEach(function (it) {
      var parts = String(it).split(':');
      if (parts[0] === 'preset') { var p = presetById[parts[1]]; if (p) p.maps.forEach(function (m) { out.push({ map: m.map, mode: m.mode }); }); return; }
      var mp = mapById[parts[0]];
      var mode = parts[1] ? (parts[1].indexOf('core.') === 0 ? parts[1] : 'core.' + parts[1]) : (mp && mp.modes[0] ? mp.modes[0].id : '');
      out.push({ map: parts[0], mode: mode });
    });
    return out;
  }
  function itemOf(e) { return e.map + ':' + modeShort(e.mode); }
  function rotation() {
    if (running()) return S.host.rotation || null;
    if (!draft) return null;
    var list = draftEntries(draft.rotation);
    return { entries: list.map(function (e) { return { map: e.map, mode: e.mode, name: mapById[e.map] ? mapById[e.map].name : e.map }; }), shuffle: !!draft.rotationShuffle, next: list.length ? 0 : null, current: null };
  }
  function setDraftRotation(list) { draft.rotation = list.map(itemOf); renderAll(); }
  function renderRotation() {
    var r = rotation();
    $('rotation-card').hidden = !r && running();
    if (!r) return;
    var box = $('rot-list'); box.replaceChildren();
    r.entries.forEach(function (e, i) {
      var li = document.createElement('li');
      if (i === r.current) li.className = 'now'; else if (i === r.next) li.className = 'next';
      var t = document.createElement('span'); t.textContent = e.name + ' ';
      var md = document.createElement('small'); md.textContent = modeLabel(e.mode); t.append(md);
      var acts = document.createElement('div'); acts.className = 'acts';
      [['\\u2191', 'up', 'Move up'], ['\\u2193', 'down', 'Move down'], ['\\u2715', 'remove', 'Remove']].forEach(function (a) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = a[0]; b.title = a[2] + ' (rotation ' + (a[1] === 'remove' ? 'remove ' + (i + 1) : 'move ' + (i + 1) + ' ' + a[1]) + ')';
        b.disabled = (a[1] === 'up' && i === 0) || (a[1] === 'down' && i === r.entries.length - 1);
        b.addEventListener('click', function () {
          if (running()) return run(a[1] === 'remove' ? 'rotation remove ' + (i + 1) : 'rotation move ' + (i + 1) + ' ' + a[1]);
          var list = draftEntries(draft.rotation);
          if (a[1] === 'remove') list.splice(i, 1);
          else { var j = i + (a[1] === 'up' ? -1 : 1); var x = list[i]; list[i] = list[j]; list[j] = x; }
          setDraftRotation(list);
        });
        acts.append(b);
      });
      li.append(t, acts);
      box.append(li);
    });
    $('rot-count').textContent = r.entries.length ? r.entries.length + ' / 20' : '';
    var nx = r.next != null ? r.entries[r.next] : null;
    $('rot-next').textContent = nx ? 'Next up: ' + nx.name + ' \\u00b7 ' + modeLabel(nx.mode) : 'Empty: each match replays its map. Add maps, or start from a preset.';
    if (document.activeElement !== $('rot-shuffle')) $('rot-shuffle').checked = !!r.shuffle;
    $('rot-skip').disabled = !running() || !r.entries.length;
    $('rot-clear').disabled = !r.entries.length;
    $('rot-add').disabled = r.entries.length >= 20;
    $('h-rot').textContent = running() ? 'rotation add <map> <mode> \\u00b7 rotation preset <name> \\u00b7 skip' : 'start  (with this rotation)';
  }
  $('rot-add').addEventListener('click', function () {
    var id = rotMap.value, mode = $('rot-mode').value;
    if (!id || !mode) return;
    if (running()) return run('rotation add ' + id + ' ' + modeShort(mode));
    var list = draftEntries(draft.rotation); list.push({ map: id, mode: mode }); setDraftRotation(list);
  });
  $('rot-use').addEventListener('click', function () {
    var p = presetById[$('rot-preset').value]; if (!p) return;
    if (running()) { run('rotation preset ' + p.id); return; }
    draft.rotationShuffle = !!p.shuffle;
    setDraftRotation(p.maps.slice());
    toast(p.name + ' for the next Start');
  });
  $('rot-shuffle').addEventListener('change', function () {
    var on = $('rot-shuffle').checked;
    if (running()) return run('rotation shuffle ' + (on ? 'on' : 'off'));
    draft.rotationShuffle = on; renderAll();
  });
  $('rot-skip').addEventListener('click', function () { if (running()) run('skip'); });
  $('rot-clear').addEventListener('click', function () {
    if (!confirm('Empty the rotation? Each match then replays its map.')) return;
    if (running()) return run('rotation clear');
    setDraftRotation([]);
  });

  // ---------------------------------------------------------------- bot set
  // One bot a line ("Name, look, skill, style, team, squad"; a first line "only": just these bots).
  // Running: Apply runs botset list (the match checks it and swaps bots in one at a time). Stopped: the next Start's.
  var botSetById = {};
  (DATA.botSets || []).forEach(function (p) {
    botSetById[p.id] = p;
    var o = document.createElement('option'); o.value = p.id; o.textContent = p.name + ' (' + p.count + ' bots)'; o.title = p.description;
    $('bots-preset').append(o);
  });
  function botText(set) {
    if (!set) return '';
    var lines = set.fill === 'only' ? ['only'] : [];
    (set.entries || []).forEach(function (e) {
      var c = [e.name, e.look || '-', e.skill || '-', e.style || '-', e.team != null ? String(e.team + 1) : '-', e.squad || '-'];
      while (c.length > 1 && c[c.length - 1] === '-') c.pop();
      lines.push(c.join(', '));
    });
    return lines.join('\\n');
  }
  // The config's BOTSET (a preset's id, the text form, or a set) as text.
  function configBotText(v) {
    if (!v) return '';
    if (typeof v === 'object') return botText(v);
    if (botSetById[v]) return botSetById[v].text;
    return String(v).split(';').map(function (l) { return l.trim(); }).filter(Boolean).join('\\n');
  }
  var botsShown = null;
  function renderBots() {
    var text = running() ? botText(S.host.botSet) : configBotText(draft && draft.botSet);
    var box = $('bots-text');
    // Don't overwrite what the owner is typing.
    if (document.activeElement !== box && text !== botsShown) { box.value = text; botsShown = text; }
    var n = text ? text.split('\\n').filter(function (l) { return l && l !== 'only' && l !== 'random'; }).length : 0;
    var only = /^only\\b/.test(text);
    $('bots-count').textContent = n ? n + (only ? ' only' : '') : '';
    $('bots-note').textContent = n ? (only ? 'Only these bots play.' : 'These bots first, then random bots up to the player count.') + (running() ? ' Changes swap bots in one at a time.' : '') : 'Random bots. Pick a preset, or write your own: one bot a line.';
    $('bots-clear').disabled = !n;
    $('h-bots').textContent = running() ? 'botset \\u00b7 botset preset <name> \\u00b7 botset list <bot; bot> \\u00b7 botset clear' : 'start  (with these bots)';
  }
  $('bots-use').addEventListener('click', function () {
    var p = botSetById[$('bots-preset').value]; if (!p) return;
    if (running()) return run('botset preset ' + p.id);
    draft.botSet = p.id; botsShown = null; renderAll();
    toast(p.name + ' for the next Start');
  });
  $('bots-apply').addEventListener('click', function () {
    var lines = $('bots-text').value.split('\\n').map(function (l) { return l.trim(); }).filter(Boolean);
    botsShown = null;
    if (running()) return run(lines.length ? 'botset list ' + lines.join('; ') : 'botset clear');
    draft.botSet = lines.join('; '); renderAll();
    toast('Bots for the next Start');
  });
  $('bots-clear').addEventListener('click', function () {
    botsShown = null;
    if (running()) return run('botset clear');
    draft.botSet = ''; renderAll();
  });

  // ---------------------------------------------------------------- match rules
  // Running: each control runs its rules command (the match applies it live, at the restart or at the next match,
  // as its tag says). Stopped: they edit the rules the next Start plays with.
  var RULES = DATA.rules || [];
  var ruleByKey = {};
  RULES.forEach(function (r) { ruleByKey[r.key] = r; });
  var MAIN_RULES = ['score', 'time', 'respawn', 'ff', 'mix', 'drops', 'teams', 'assign'];
  var scope = 'all';
  $('rules-scope').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    scope = b.dataset.s;
    this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
    rulesShown = ''; renderRules();
  });
  function modeNow() {
    var c = cur(); if (!c) return '';
    if (c.mode) return c.mode;
    var mp = mapById[c.map];
    return mp && mp.modes[0] ? mp.modes[0].id : 'core.deathmatch';
  }
  function draftRules() { if (!draft.rules || typeof draft.rules !== 'object') draft.rules = {}; return draft.rules; }
  // What the draft (next Start) sets for a rule: this map's override, the mode's, everyone's.
  function draftRule(key) {
    var r = draftRules(); var spec = ruleByKey[key]; var mk = modeShort(modeNow());
    if (r.maps && r.maps[draft.map] && r.maps[draft.map][key] != null) return { v: r.maps[draft.map][key], from: 'map' };
    if (spec.perMode) return r.modes && r.modes[mk] && r.modes[mk][key] != null ? { v: r.modes[mk][key], from: 'mode' } : null;
    return r[key] != null ? { v: r[key], from: 'all' } : null;
  }
  function setDraftRule(key, v, onMap) {
    var r = draftRules(); var spec = ruleByKey[key]; var mk = modeShort(modeNow());
    var box;
    if (onMap) { r.maps = r.maps || {}; box = r.maps[draft.map] = r.maps[draft.map] || {}; }
    else if (spec.perMode) { r.modes = r.modes || {}; box = r.modes[mk] = r.modes[mk] || {}; }
    else box = r;
    if (v === undefined) delete box[key]; else box[key] = v;
    if (r.maps && r.maps[draft.map] && !Object.keys(r.maps[draft.map]).length) delete r.maps[draft.map];
    if (r.maps && !Object.keys(r.maps).length) delete r.maps;
    if (r.modes && r.modes[mk] && !Object.keys(r.modes[mk]).length) delete r.modes[mk];
    if (r.modes && !Object.keys(r.modes).length) delete r.modes;
  }
  function ruleText(spec, v) {
    var t = spec.type;
    if (v === '' || v == null) return 'default';
    if (t.kind === 'int') return v === 0 && t.zero ? t.zero : v + (t.unit ? ' ' + t.unit : '');
    if (t.kind === 'bool') return v ? t.on : t.off;
    if (t.kind === 'choice') { for (var i = 0; i < t.values.length; i++) if (t.values[i][0] === v) return t.values[i][1]; return String(v); }
    return Array.isArray(v) ? v.join(', ') || 'default' : String(v);
  }
  // One rule's row: a control showing what it will be (the server's setting, else what plays now).
  function ruleRows() {
    var mode = modeNow();
    if (running()) return (S.host.ruleRows || []).filter(function (x) { return ruleByKey[x.key]; });
    return RULES.filter(function (r) { return r.modes.indexOf(mode) >= 0; }).map(function (r) {
      var d = draftRule(r.key);
      return { key: r.key, now: null, set: d ? d.v : null, from: d ? d.from : null, pending: false };
    });
  }
  function setRule(key, v) {
    var spec = ruleByKey[key];
    if (running()) {
      var val = v === undefined ? 'default' : spec.type.kind === 'bool' ? (v ? 'on' : 'off') : Array.isArray(v) ? v.join(', ') : String(v);
      return run('rules ' + (scope === 'map' ? 'map ' : '') + key + ' ' + val);
    }
    setDraftRule(key, v, scope === 'map');
    rulesShown = ''; renderAll();
  }
  var rulePending = {};
  var ruleTimer = {};
  var rulesShown = '';
  function ruleRow(x) {
    var spec = ruleByKey[x.key]; var t = spec.type;
    var shown = rulePending[x.key] != null ? rulePending[x.key] : x.set != null ? x.set : x.now;
    var row = document.createElement('div');
    row.className = 'rule' + (x.pending ? ' pending' : '') + (x.set != null ? ' set' : '');
    row.dataset.k = x.key;
    var lab = document.createElement('span'); lab.title = spec.help + (spec.perMode ? ' (kept per mode)' : '') + (x.from === 'map' ? ' (set for this map)' : '');
    lab.textContent = spec.label;
    var tag = document.createElement('i'); tag.className = 'tag ' + spec.apply; tag.textContent = spec.apply === 'next' ? 'next match' : spec.apply;
    lab.append(tag);
    var ctl = document.createElement('div'); ctl.className = 'ctl';
    if (t.kind === 'int') {
      var st = document.createElement('div'); st.className = 'stepper' + (rulePending[x.key] != null ? ' pending' : '');
      var minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '\u2212'; minus.setAttribute('aria-label', 'Less');
      var val = document.createElement('b'); val.id = 'r-' + x.key; val.textContent = shown == null ? 'default' : ruleText(spec, shown);
      var plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'More');
      [[minus, -1], [plus, 1]].forEach(function (pair) {
        pair[0].addEventListener('click', function (e) {
          var base = rulePending[x.key] != null ? rulePending[x.key] : shown != null ? +shown : t.min;
          var step = (t.step || 1) * (e.shiftKey ? 5 : 1);
          var nx = Math.max(t.min, Math.min(t.max, base + pair[1] * step));
          rulePending[x.key] = nx;
          val.textContent = ruleText(spec, nx); st.classList.add('pending');
          clearTimeout(ruleTimer[x.key]);
          ruleTimer[x.key] = setTimeout(function () { var v = rulePending[x.key]; delete rulePending[x.key]; rulesShown = ''; setRule(x.key, v); }, 700);
        });
      });
      st.append(minus, val, plus); ctl.append(st);
    } else if (t.kind === 'list') {
      var inp = document.createElement('input'); inp.id = 'r-' + x.key; inp.value = Array.isArray(shown) ? shown.join(', ') : (shown || ''); inp.placeholder = "the map's";
      var set = document.createElement('button'); set.type = 'button'; set.textContent = 'Set';
      set.addEventListener('click', function () { var items = inp.value.split(',').map(function (q) { return q.trim(); }).filter(Boolean); setRule(x.key, items.length ? items : undefined); });
      ctl.append(inp, set);
    } else {
      var seg = document.createElement('div'); seg.className = 'seg'; seg.id = 'r-' + x.key;
      var opts = t.kind === 'bool' ? [[true, t.on], [false, t.off]] : t.values;
      opts.forEach(function (o) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = o[1]; b.dataset.v = String(o[0]);
        b.classList.toggle('on', shown === o[0]);
        b.addEventListener('click', function () { if (shown !== o[0]) setRule(x.key, o[0]); });
        seg.append(b);
      });
      ctl.append(seg);
    }
    if (x.set != null) {
      var d = document.createElement('button'); d.type = 'button'; d.className = 'ghost dflt'; d.textContent = '\u21ba'; d.title = 'Back to the default (rules ' + (scope === 'map' ? 'map ' : '') + x.key + ' default)';
      d.addEventListener('click', function () { setRule(x.key, undefined); });
      ctl.append(d);
    }
    if (x.pending && running()) {
      var w = document.createElement('small'); w.className = 'was';
      w.textContent = 'Playing now: ' + ruleText(spec, x.now) + '; ' + (x.set == null ? 'default' : ruleText(spec, x.set)) + (spec.apply === 'restart' ? ' at the restart' : ' at the next match');
      ctl.append(w);
    }
    row.append(lab, ctl);
    return row;
  }
  function renderRules() {
    var c = cur(); if (!c) return;
    var mode = modeNow();
    var rows = ruleRows();
    var key = JSON.stringify([rows, mode, scope, running(), rulePending]);
    var focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('#rules-card input');
    if (key !== rulesShown && !focused) {
      rulesShown = key;
      var main = $('rules-main'), more = $('rules-more');
      main.replaceChildren(); more.replaceChildren();
      var changed = 0;
      rows.forEach(function (x) {
        var isMain = MAIN_RULES.indexOf(x.key) >= 0;
        (isMain ? main : more).append(ruleRow(x));
        if (!isMain && x.set != null) changed++;
      });
      $('rules-more-count').textContent = '(' + (rows.length - main.childElementCount) + (changed ? ', ' + changed + ' set' : '') + ')';
    }
    $('rules-mode').textContent = (DATA.modeLabels[mode] || modeShort(mode)) + (scope === 'map' && mapById[c.map] ? ' \u00b7 ' + mapById[c.map].name : '');
    var waiting = running() ? rows.filter(function (x) { return x.pending; }) : [];
    $('rules-wait').hidden = !waiting.length;
    $('rules-wait-text').textContent = waiting.length ? 'Waiting for the next match: ' + waiting.map(function (x) { return ruleByKey[x.key].label.toLowerCase() + ' ' + (x.set == null ? 'default' : ruleText(ruleByKey[x.key], x.set)); }).join(', ') + '.' : '';
    $('h-rules').textContent = running() ? 'rules \u00b7 rules <rule> <value> \u00b7 rules map <rule> <value> \u00b7 restart' : 'start  (with these rules)';
  }
  $('rules-restart').addEventListener('click', function () { run('restart'); });
  $('rules-reset').addEventListener('click', function () {
    if (!confirm('Every rule back to the default (the mode\u2019s own) for every match?')) return;
    if (running()) return run('rules reset');
    draft.rules = {}; rulesShown = ''; renderAll();
  });

  function renderAll() { renderTop(); renderMap(); renderPlayers(); renderListing(); renderPeople(); renderBans(); renderRotation(); renderBots(); renderRules(); }

  $('b-start').addEventListener('click', function () {
    var body = { map: draft.map, mode: draft.mode || '', botFill: draft.botFill, maxPlayers: draft.maxPlayers, name: draft.name, visibility: draft.visibility, rotation: draft.rotation || [], rotationShuffle: !!draft.rotationShuffle, botSet: typeof draft.botSet === 'string' ? draft.botSet : '', botDifficulty: draft.skill || 'normal', rules: draftRules(), motd: draft.motd || '', afkSeconds: draft.afkSeconds != null ? draft.afkSeconds : 90, idleKickMinutes: draft.idleKickMinutes != null ? draft.idleKickMinutes : 10 };
    // A set saved from the match (an object) stays as it is: the service keeps it.
    if (draft.botSet && typeof draft.botSet === 'object') delete body.botSet;
    local('cmd', 'start  (' + (mapById[draft.map] ? mapById[draft.map].name : draft.map) + (draft.mode ? ', ' + modeShort(draft.mode) : '') + ', ' + draft.botFill + ' players and bots)');
    api('/api/start', body).then(function () { setTimeout(pollStatus, 300); }, function (e) { local('out', 'could not start: ' + e.message); });
  });
  $('b-stop').addEventListener('click', function () { run('stop'); });
  $('b-restart').addEventListener('click', function () { run('restart'); });
  $('b-end').addEventListener('click', function () { if (confirm('End the match now and show the scoreboard?')) run('end'); });
  $('b-tok-show').addEventListener('click', function () { run('admin token'); });
  $('b-tok-new').addEventListener('click', function () { if (confirm('Make a new admin token? The old one stops working.')) run('admin token rotate'); });
  $('b-tok-clear').addEventListener('click', function () { if (confirm('Remove the admin token? Nobody can log in as admin in-game.')) run('admin token clear'); });
  $('b-quit').addEventListener('click', function () { if (confirm('Close the Host Service? The server stops and everyone playing is disconnected.')) run('quit'); });
  $('say-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('f-say').value.trim(); if (!v) return;
    run('say ' + v); $('f-say').value = '';
  });
  $('copy-code').addEventListener('click', function () {
    var code = $('code').textContent;
    var link = DATA.site + '/?join=' + code;
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { toast('Copied ' + link); }, function () { toast('Join code: ' + code); });
  });
  function drawer(open) {
    $('side').classList.toggle('open', open);
    $('side-toggle').setAttribute('aria-expanded', String(open));
  }
  $('side-toggle').addEventListener('click', function (e) { e.stopPropagation(); drawer(!$('side').classList.contains('open')); });
  // Narrow windows: the controls slide over the console; a click beside them or Escape puts them away.
  document.addEventListener('click', function (e) { if ($('side').classList.contains('open') && !$('side').contains(e.target)) drawer(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') drawer(false); });

  // ---------------------------------------------------------------- status
  var wasOffline = false;
  function failed(e) {
    if (e && e.status === 401) {
      overlay('Open the launcher from the Host Service', 'This page needs this computer\\u2019s pairing key. Type open in the Host Service window, or use the launcher link it shows.');
      return;
    }
    if (e && e.status) return;
    S = null; wasOffline = true;
    renderTop();
    overlay('The Host Service isn\\u2019t running', 'Start it again with Start Tile Trigger Host; this page reconnects by itself.');
  }
  function pollStatus() {
    return api('/api/status').then(function (s) {
      S = s;
      if (wasOffline || !$('overlay').hidden) { overlay(''); wasOffline = false; }
      var c = s.config || {};
      if (!draft || running()) draft = { map: c.map && mapById[c.map] ? c.map : (DATA.maps[0] ? DATA.maps[0].id : 'frost_basin'), mode: c.mode || '', botFill: c.botFill || 24, maxPlayers: c.maxPlayers || 16, name: c.name || 'Dedicated host', visibility: c.visibility || 'listed', rotation: (c.rotation || []).slice(), rotationShuffle: !!c.rotationShuffle, botSet: c.botSet || '', skill: c.botDifficulty || 'normal', rules: JSON.parse(JSON.stringify(c.rules || {})), motd: c.motd || '', afkSeconds: c.afkSeconds, idleKickMinutes: c.idleKickMinutes };
      renderAll();
    }, failed);
  }
  clearInterval(pollStatus.t);
  pollStatus.t = setInterval(pollStatus, 1500);
  if (!key) failed({ status: 401 });
  pollStatus();
  pollLog();
  cmd.focus();
})();
`;
