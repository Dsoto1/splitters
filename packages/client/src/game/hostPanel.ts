import { DEFAULT_TEAMS, botSetLabel, HOST_BOT_SKILLS, HOST_BOT_STYLES, MODE_LABELS, ROTATION_MAX, TICK_RATE, isTeamMode, teamsLabel, type HostCommand, type HostRulesPatch, type HostState, type RotationEntry, type RotationPreset, type RotationState } from '@tiletrigger/shared';
import { choice, el, settingRow, stepper, teamEditor } from '../frontend/setupControls.ts';
import { botManager } from '../frontend/botManager.ts';
import { BOT_SET_PRESETS } from '../playlists.ts';

/** Team sizes a host can jump to in one click (every team the same size). */
const TEAM_PRESETS = [1, 2, 4, 5, 8, 12, 16, 24, 48];
const SKILL_LABELS: Record<HostState['skill'], string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const STYLE_LABELS: Record<HostState['style'], string> = { mixed: 'Mixed', arena: 'Arena', tactical: 'Tactical' };
const FF_LABELS = { off: 'Off', half: 'Half', on: 'Full' } as const;

export interface HostPanelHooks {
  /** Run a host command (bots, rules, restart, end; a map change goes through `changeMap`). */
  command(cmd: Exclude<HostCommand, { c: 'map' }>): void;
  /** Open the map picker; absent: this match can't change map (MapMaker TEST). */
  changeMap?: () => void;
  /** Log in as the dedicated server's admin; absent: not on a dedicated server. */
  login?: (token: string) => void;
  /**
   * The map rotation: add a map (the map picker), and the built-in presets. Absent: no rotation here
   * (MapMaker TEST, a playlist, or a server too old to have one). Changes go through `command`.
   */
  rotation?: { add(): void; presets: readonly RotationPreset[] };
}

interface Draft {
  fill: number;
  sizes: number[];
  skill: HostState['skill'];
  style: HostState['style'];
  /** Restart-only rules as they'll be after the restart. */
  rules: Required<HostRulesPatch> | null;
}

/** The restart-only rules after any change waiting for the restart. */
const nextRules = (s: HostState): Required<HostRulesPatch> | null => (s.rules ? { ...s.rules, ...(s.pending ?? {}) } : null);

/**
 * The pause menu's Match section for whoever runs the match (the offline
 * player, the Host game host, a dedicated server's admin), built from the
 * same controls as Play → match setup: players or each team's size, bot
 * skill and style (live: Apply rebalances now), rules that wait for the
 * restart (marked so), Change map, Restart match, End match. On a dedicated
 * server, everyone else sees only a "Server admin" login.
 */
export class HostPanel {
  readonly root = el('details', { id: 'host-controls', class: 'host-controls' });
  private state: HostState | null = null;
  /** Settings being edited, applied together. */
  private draft: Draft | null = null;
  private readonly status = el('p', { class: 'hint hc-status', id: 'hc-status' });
  /** People in the match besides you (kick and ban). */
  private people: { slot: number; name: string }[] = [];
  private peopleKey = '';
  /** The rotation this browser keeps (offline, Host game); a server's comes in its HostState. */
  private ownRotation: RotationState | null = null;

  constructor(
    private readonly hooks: HostPanelHooks,
    /** Who the player is to the match, for the heading. */
    private readonly title: 'Host' | 'Admin',
  ) {
    this.render();
  }

  /** The match's settings now (null: you don't run it). */
  setState(state: HostState | null): void {
    this.state = state;
    this.draft = state ? { fill: state.fill, sizes: this.sizesOf(state), skill: state.skill, style: state.style, rules: nextRules(state) } : null;
    this.render();
  }

  /** The roster's people (not bots), you left out: whoever runs the match can kick or ban them. */
  setPeople(people: { slot: number; name: string }[]): void {
    const key = people.map((p) => `${p.slot}:${p.name}`).join('|');
    if (key === this.peopleKey) return;
    this.peopleKey = key;
    this.people = people;
    if (this.state) this.render();
  }

  /** The rotation kept by this browser (null: the host's state carries it, or there is none). */
  setRotation(rotation: RotationState | null): void {
    this.ownRotation = rotation;
    if (this.state) this.render();
  }

  get controlling(): boolean {
    return !!this.state;
  }

  setStatus(text: string, error = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('error', error);
  }

  /**
   * The map rotation: the maps played in turn after each match, each in its mode. Add (the map picker),
   * remove, move up and down, start from a preset, shuffle, skip to the next now; "Next up" says where the
   * match goes. Every change sends the whole list (the host checks it).
   */
  private rotationSection(s: HostState): HTMLElement[] {
    const hook = this.hooks.rotation;
    const r = this.ownRotation ?? s.rotation ?? null;
    if (!hook || !r) return [];
    const entries: RotationEntry[] = r.entries.map((e) => ({ map: e.map, mode: e.mode }));
    const set = (list: RotationEntry[]) => this.hooks.command({ c: 'rotation', entries: list });
    const next = r.next !== null ? r.entries[r.next] : undefined;
    const head = el('p', { class: 'hc-rot-next', id: 'hc-rot-next', textContent: next ? `Next up: ${next.name} · ${MODE_LABELS[next.mode]}` : 'Empty: the match replays this map. Add maps, or start from a preset.' });
    const list = el('ol', { class: 'hc-rot', id: 'hc-rot-list' });
    r.entries.forEach((e, i) => {
      const button = (id: string, text: string, title: string, disabled: boolean, act: () => void) => {
        const b = el('button', { id: `hc-rot-${id}-${i}`, textContent: text, title, disabled });
        b.addEventListener('click', act);
        return b;
      };
      const swap = (j: number) => {
        const l = [...entries];
        [l[i], l[j]] = [l[j]!, l[i]!];
        set(l);
      };
      const label = el('span', { textContent: `${e.name} ` }, el('small', { textContent: MODE_LABELS[e.mode] }));
      const li = el(
        'li',
        { class: i === r.current ? 'now' : i === r.next ? 'next' : '', title: i === r.current ? 'Playing now' : i === r.next ? 'Next up' : '' },
        label,
        button('up', '↑', 'Move up', i === 0, () => swap(i - 1)),
        button('down', '↓', 'Move down', i === r.entries.length - 1, () => swap(i + 1)),
        button('del', '✕', 'Remove', false, () => set(entries.filter((_, j) => j !== i))),
      );
      list.append(li);
    });
    const add = el('button', { id: 'hc-rot-add', textContent: 'Add map…', title: `Pick a map and mode for the rotation (up to ${ROTATION_MAX})`, disabled: r.entries.length >= ROTATION_MAX });
    add.addEventListener('click', () => hook.add());
    const preset = el('select', { id: 'hc-rot-preset', title: 'Replace the rotation with a built-in one' });
    preset.append(new Option('Start from a preset…', ''));
    for (const p of hook.presets) {
      const o = new Option(`${p.name} (${p.maps.length})`, p.id);
      o.title = p.description;
      preset.append(o);
    }
    preset.addEventListener('change', () => {
      const p = hook.presets.find((x) => x.id === preset.value);
      if (p) this.hooks.command({ c: 'rotation', entries: p.maps.map((m) => ({ map: m.map, mode: m.mode })), shuffle: p.shuffle });
    });
    const shuffle = el('input', { type: 'checkbox', id: 'hc-rot-shuffle', checked: r.shuffle });
    shuffle.addEventListener('change', () => this.hooks.command({ c: 'rotation', shuffle: shuffle.checked }));
    const skip = el('button', { id: 'hc-rot-skip', textContent: 'Skip to next', title: next ? `Go to ${next.name} now` : 'The rotation is empty', disabled: !next });
    skip.addEventListener('click', () => this.hooks.command({ c: 'skip' }));
    const clear = el('button', { id: 'hc-rot-clear', textContent: 'Clear', title: 'Empty the rotation (matches replay their map)', disabled: !r.entries.length });
    clear.addEventListener('click', () => set([]));
    return [
      el('h4', { textContent: 'Rotation' }),
      head,
      ...(r.entries.length ? [list] : []),
      el('div', { class: 'hc-row hc-rot-tools' }, add, preset),
      el('div', { class: 'hc-row hc-rot-tools' }, el('label', { class: 'hc-check' }, shuffle, ' Shuffle'), skip, clear),
    ];
  }

  /** The Bots window over the pause menu: Apply sends the whole set (the match swaps bots in one at a time). */
  private openBots(s: HostState): void {
    if (document.getElementById('bot-manager')) return;
    const teams = s.teams ? Array.from({ length: s.teams }, (_, i) => ({ name: s.teamNames?.[i] ?? DEFAULT_TEAMS[i]?.name ?? `Team ${i + 1}`, color: s.teamColors?.[i] ?? DEFAULT_TEAMS[i]?.color ?? '#00d1ff' })) : [];
    const players = s.teams ? this.sizesOf(s).reduce((a, b) => a + b, 0) : s.fill;
    const opener = document.getElementById('hc-bots');
    const win = botManager({
      set: s.botSet ?? null,
      teams,
      presets: BOT_SET_PRESETS,
      applyLabel: 'Apply',
      note: `Applies to this match now: bots swap in one at a time. ${players} players in all, you included.`,
      players: Math.max(0, players - 1),
      onApply: (set) => this.hooks.command({ c: 'bots', botSet: set }),
      onClose: () => (document.getElementById('hc-bots') ?? opener)?.focus(),
    });
    (document.getElementById('pause') ?? document.body).append(win);
  }

  /** Every team's size (an older server only says the largest). */
  private sizesOf(s: HostState): number[] {
    if (!s.teams) return [];
    return s.sizes?.length === s.teams ? [...s.sizes] : Array.from({ length: s.teams }, () => s.teamSize ?? 1);
  }

  private render(): void {
    const open = this.root.open;
    const s = this.state;
    const d = this.draft;
    this.root.hidden = !s && !this.hooks.login;
    if (!s || !d) {
      // Dedicated server, not (yet) the admin: a token box.
      const token = el('input', { id: 'hc-token', type: 'password', placeholder: 'Admin token', autocomplete: 'off' });
      const login = el('button', { id: 'hc-login', textContent: 'Log in' });
      login.addEventListener('click', () => token.value.trim() && this.hooks.login?.(token.value.trim()));
      this.root.replaceChildren(el('summary', {}, 'Server admin'), el('p', { class: 'hint', textContent: "The server's ADMIN_TOKEN lets you change bots and map, restart and end the match." }), el('div', { class: 'hc-row' }, token, login), this.status);
      this.root.open = open;
      return;
    }
    const redraw = () => this.render();
    const rows: HTMLElement[] = [];
    const now = this.sizesOf(s);
    if (s.teams) {
      const even = el('select', { id: 'hc-preset', title: 'Every team the same size' });
      even.append(new Option('All teams…', ''));
      for (const n of TEAM_PRESETS) if (n * s.teams <= s.max) even.append(new Option(teamsLabel(s.teams, n), String(n)));
      even.addEventListener('change', () => {
        if (even.value) d.sizes = d.sizes.map(() => Number(even.value));
        redraw();
      });
      rows.push(
        settingRow('Quick sizes', 'Set every team to one size; then change any team on its own.', even, { live: true }),
        teamEditor({
          id: 'hc',
          state: { sizes: d.sizes, names: d.sizes.map((_, i) => s.teamNames?.[i] ?? DEFAULT_TEAMS[i]?.name ?? `Team ${i + 1}`), colors: d.sizes.map((_, i) => s.teamColors?.[i] ?? DEFAULT_TEAMS[i]?.color ?? '#00d1ff'), you: null },
          countLocked: 'The number of teams is set when the match starts: change it from Play → Match setup, or Change map.',
          namesLocked: 'Names and colours are set when the match starts (Play → Match setup).',
          maxPlayers: s.max,
          onChange: (next) => {
            d.sizes = next.sizes;
            redraw();
          },
        }),
      );
      rows.push(el('p', { class: 'setup-hint', textContent: 'Team sizes change live: bots join or leave to fit. Drag a bot pip to move it to another team.' }));
    } else {
      const coop = s.mode === 'core.coop' || s.mode === 'core.zombies';
      rows.push(settingRow(coop ? 'Squad' : 'Players', coop ? 'You and your bot squadmates.' : 'Everyone in the match, you included; bots fill the rest.', stepper({ value: d.fill, min: 1, max: s.max, id: 'hc-players', label: coop ? 'squad' : 'players', onChange: (v) => ((d.fill = v), redraw()) }), { live: true }));
    }
    rows.push(settingRow('Bot skill', 'Easy bots aim slowly and miss often; hard ones react fast, use cover and lead their shots.', choice(HOST_BOT_SKILLS.map((v) => [v, SKILL_LABELS[v]] as const), d.skill, (v) => ((d.skill = v), redraw()), 'hc-skill'), { live: true }));
    rows.push(settingRow('Bot style', 'Mixed: every character plays its own way. Arena: always moving (Quake). Tactical: careful, cover, held angles (Counter-Strike).', choice(HOST_BOT_STYLES.map((v) => [v, STYLE_LABELS[v]] as const), d.style, (v) => ((d.style = v), redraw()), 'hc-style'), { live: true }));
    // The host's own bots (names, looks, skills, teams, squads): hosts that know bot sets say so (HostState.botSet).
    if (s.botSet !== undefined) {
      const open = el('button', { id: 'hc-bots', textContent: 'Bots…', title: 'Your own bots: names, looks, skill, style, team and squad (applies live: bots swap in one at a time)' });
      open.addEventListener('click', () => this.openBots(s));
      rows.push(settingRow('Bot set', 'Your own bots by name, look, skill, style, team and squad; random bots fill the rest unless the set says only these.', el('div', { class: 'bot-set-line' }, el('span', { class: 'bot-set-sum', id: 'hc-bots-sum', textContent: botSetLabel(s.botSet) }), open), { live: true }));
    }
    const liveChanged = d.fill !== s.fill || d.sizes.join() !== now.join() || d.skill !== s.skill || d.style !== s.style;

    // Rules that need the match to start over.
    const ruleRows: HTMLElement[] = [];
    const want = nextRules(s);
    const r = d.rules;
    if (r) {
      ruleRows.push(
        settingRow('Score limit', 'Score that wins (0: none).', stepper({ value: r.scoreLimit, min: 0, max: 1000, id: 'hc-score', label: 'score limit', onChange: (v) => ((r.scoreLimit = v), redraw()) }), { restart: true }),
        settingRow('Time limit', 'Minutes until the match ends (∞: none).', stepper({ value: Math.round(r.timeLimitSeconds / 60), min: 0, max: 120, id: 'hc-minutes', fmt: (v) => (v ? `${v} min` : '∞'), onChange: (v) => ((r.timeLimitSeconds = v * 60), redraw()) }), { restart: true }),
        settingRow('Respawn delay', 'Seconds before players are back in.', stepper({ value: Math.round(r.respawnDelayTicks / TICK_RATE), min: 0, max: 30, id: 'hc-respawn', fmt: (v) => `${v} s`, onChange: (v) => ((r.respawnDelayTicks = v * TICK_RATE), redraw()) }), { restart: true }),
        settingRow('Friendly fire', 'Whether shots and blasts hurt teammates.', choice((['off', 'half', 'on'] as const).map((v) => [v, FF_LABELS[v]] as const), r.friendlyFire, (v) => ((r.friendlyFire = v), redraw()), 'hc-ff', isTeamMode(s.mode) || s.mode === 'core.coop' || s.mode === 'core.zombies' ? null : `No teammates in ${MODE_LABELS[s.mode]}.`), { restart: true }),
      );
    }
    const rulesChanged = !!r && !!want && (Object.keys(r) as (keyof HostRulesPatch)[]).some((k) => r[k] !== want[k]);
    // What Apply does to the match, on the button: "Apply: +6 bots".
    const total = (sizes: readonly number[], fill: number) => (s.teams ? sizes.reduce((a, b) => a + b, 0) : fill);
    const delta = total(d.sizes, d.fill) - total(now, s.fill);
    const what = delta > 0 ? `: +${delta} bot${delta === 1 ? '' : 's'}` : delta < 0 ? `: −${-delta} bot${delta === -1 ? '' : 's'}` : '';
    const apply = el('button', { class: 'primary', id: 'hc-apply', textContent: rulesChanged && !liveChanged ? 'Apply on restart' : `Apply${what}`, disabled: !liveChanged && !rulesChanged });
    apply.addEventListener('click', () => {
      if (liveChanged) {
        const cmd: Extract<HostCommand, { c: 'bots' }> = { c: 'bots' };
        if (s.teams) {
          if (d.sizes.join() !== now.join()) {
            // Every team the same size: the plain command older servers know too.
            if (d.sizes.every((n) => n === d.sizes[0])) cmd.teamSize = d.sizes[0]!;
            else cmd.teamSizes = [...d.sizes];
          }
        } else if (d.fill !== s.fill) cmd.fill = d.fill;
        if (d.skill !== s.skill) cmd.skill = d.skill;
        if (d.style !== s.style) cmd.style = d.style;
        this.hooks.command(cmd);
      }
      if (rulesChanged && r && s.rules) {
        const patch: HostRulesPatch = {};
        for (const k of Object.keys(r) as (keyof HostRulesPatch)[]) if (r[k] !== want![k]) (patch as Record<string, unknown>)[k] = r[k];
        this.hooks.command({ c: 'rules', rules: patch });
      }
    });
    const pending = s.pending && Object.keys(s.pending).length ? s.pending : null;
    const waiting = pending
      ? [el('p', { class: 'hc-pending', id: 'hc-pending', textContent: `Waiting for the restart: ${[pending.scoreLimit !== undefined ? `score ${pending.scoreLimit}` : '', pending.timeLimitSeconds !== undefined ? `time ${pending.timeLimitSeconds ? `${Math.round(pending.timeLimitSeconds / 60)} min` : '∞'}` : '', pending.respawnDelayTicks !== undefined ? `respawn ${Math.round(pending.respawnDelayTicks / TICK_RATE)} s` : '', pending.friendlyFire ? `friendly fire ${FF_LABELS[pending.friendlyFire].toLowerCase()}` : ''].filter(Boolean).join(', ')}. Restart match to play with them.` })]
      : [];
    const actions = el('div', { class: 'hc-actions' });
    if (this.hooks.changeMap) {
      const map = el('button', { id: 'hc-map', textContent: 'Change map…' });
      map.addEventListener('click', () => this.hooks.changeMap?.());
      actions.append(map);
    }
    const restart = el('button', { id: 'hc-restart', textContent: 'Restart match', title: pending ? 'Start over with the waiting rule changes' : 'Start the match over on this map' });
    confirmTwice(restart, 'Click again to restart', () => this.hooks.command({ c: 'restart' }));
    const rotation = this.rotationSection(s);
    const end = el('button', { id: 'hc-end', textContent: 'End match', title: 'End the match now and show the scoreboard' });
    confirmTwice(end, 'Click again to end', () => this.hooks.command({ c: 'end' }));
    actions.append(restart, end);
    // People: kick (they may come back) or ban (kept out: their account when signed in, else weakly by browser).
    const people = this.people.length
      ? [
          el('h4', { textContent: 'Players' }),
          ...this.people.map((p) => {
            const kick = el('button', { id: `hc-kick-${p.slot}`, textContent: 'Kick', title: `Remove ${p.name} (they may rejoin)` });
            kick.addEventListener('click', () => this.hooks.command({ c: 'kick', slot: p.slot }));
            const ban = el('button', { id: `hc-ban-${p.slot}`, textContent: 'Ban', title: `Remove ${p.name} and keep them out` });
            ban.addEventListener('click', () => window.confirm(`Ban ${p.name} from this ${this.title === 'Admin' ? 'server' : 'game'}?`) && this.hooks.command({ c: 'ban', slot: p.slot }));
            return el('div', { class: 'hc-row hc-person' }, el('span', { textContent: p.name }), kick, ban);
          }),
        ]
      : [];
    const label = s.teams ? (now.every((n) => n === now[0]) ? teamsLabel(s.teams, now[0]!) : now.join('v')) : `${s.fill} players`;
    const summary = el('summary', {}, `Match (${this.title.toLowerCase()})`, el('small', { textContent: ` ${label} · ${MODE_LABELS[s.mode]} · ${SKILL_LABELS[s.skill]} bots` }));
    this.root.replaceChildren(
      summary,
      el('h4', { textContent: s.teams ? 'Teams & bots' : 'Players & bots' }),
      ...rows,
      ...(ruleRows.length ? [el('h4', { textContent: 'Rules' }), ...ruleRows] : []),
      apply,
      ...waiting,
      actions,
      ...rotation,
      ...people,
      this.status,
    );
    this.root.open = open;
  }
}

/**
 * A button that undoes everyone's match (restart, end) asks for a second click: the first says so on the
 * button for a few seconds, the second does it.
 */
function confirmTwice(button: HTMLButtonElement, ask: string, act: () => void): void {
  const label = button.textContent ?? '';
  let armed: ReturnType<typeof setTimeout> | null = null;
  button.addEventListener('click', () => {
    if (armed) {
      clearTimeout(armed);
      armed = null;
      button.textContent = label;
      button.classList.remove('armed');
      act();
      return;
    }
    button.textContent = ask;
    button.classList.add('armed');
    armed = setTimeout(() => {
      armed = null;
      button.textContent = label;
      button.classList.remove('armed');
    }, 3000);
  });
}
