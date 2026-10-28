import { DEFAULT_TEAMS, HOST_BOT_SKILLS, HOST_BOT_STYLES, MODE_LABELS, TICK_RATE, isTeamMode, teamsLabel, type HostCommand, type HostRulesPatch, type HostState } from '@tiletrigger/shared';
import { choice, el, settingRow, stepper, teamEditor } from '../frontend/setupControls.ts';

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

  get controlling(): boolean {
    return !!this.state;
  }

  setStatus(text: string, error = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('error', error);
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
    const apply = el('button', { class: 'primary', id: 'hc-apply', textContent: rulesChanged && !liveChanged ? 'Apply on restart' : 'Apply', disabled: !liveChanged && !rulesChanged });
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
    restart.addEventListener('click', () => this.hooks.command({ c: 'restart' }));
    const end = el('button', { id: 'hc-end', textContent: 'End match', title: 'End the match now and show the scoreboard' });
    end.addEventListener('click', () => this.hooks.command({ c: 'end' }));
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
      ...people,
      this.status,
    );
    this.root.open = open;
  }
}
