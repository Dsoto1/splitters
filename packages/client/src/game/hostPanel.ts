import { HOST_BOT_SKILLS, HOST_BOT_STYLES, MODE_LABELS, teamsLabel, type HostCommand, type HostState } from '@tiletrigger/shared';

/** Team sizes a host can jump to in one click (the Arcade's big layouts). */
const TEAM_PRESETS = [2, 4, 5, 8, 12, 16, 24, 48];
const SKILL_LABELS: Record<HostState['skill'], string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const STYLE_LABELS: Record<HostState['style'], string> = { mixed: 'Mixed', arena: 'Arena', tactical: 'Tactical' };

export interface HostPanelHooks {
  /** Run a host command (bots, restart, end; a map change goes through `changeMap`). */
  command(cmd: Exclude<HostCommand, { c: 'map' }>): void;
  /** Open the map picker; absent: this match can't change map (MapMaker TEST). */
  changeMap?: () => void;
  /** Log in as the dedicated server's admin; absent: not on a dedicated server. */
  login?: (token: string) => void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) e.className = cls;
  Object.assign(e, rest);
  e.append(...children);
  return e;
};

/**
 * The pause menu's Match section for whoever runs the match (the offline
 * player, the Host game host, a dedicated server's admin): players or team
 * size, bot skill and style (Apply rebalances live), Change map, Restart
 * match, End match. On a dedicated server, everyone else sees only a
 * "Server admin" login.
 */
export class HostPanel {
  readonly root = el('details', { id: 'host-controls', class: 'host-controls' });
  private state: HostState | null = null;
  /** Settings being edited, applied together. */
  private draft: { fill: number; teamSize: number | null; skill: HostState['skill']; style: HostState['style'] } | null = null;
  private readonly status = el('p', { class: 'hint hc-status', id: 'hc-status' });

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
    this.draft = state ? { fill: state.fill, teamSize: state.teamSize, skill: state.skill, style: state.style } : null;
    this.render();
  }

  get controlling(): boolean {
    return !!this.state;
  }

  setStatus(text: string, error = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('error', error);
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
    const step = (value: string, minus: () => void, plus: () => void, id: string) => {
      const a = el('button', { textContent: '−', id: `${id}-minus` });
      const b = el('button', { textContent: '+', id: `${id}-plus` });
      a.addEventListener('click', () => (minus(), this.render()));
      b.addEventListener('click', () => (plus(), this.render()));
      return el('div', { class: 'stepper' }, a, el('b', { textContent: value, id }), b);
    };
    const tabs = <T extends string>(values: readonly T[], labels: Record<T, string>, value: T, set: (v: T) => void, id: string) =>
      el(
        'div',
        { class: 'tabs', id },
        ...values.map((v) => {
          const b = el('button', { class: `tab${v === value ? ' on' : ''}`, textContent: labels[v] });
          b.dataset.value = v;
          b.addEventListener('click', () => (set(v), this.render()));
          return b;
        }),
      );
    const rows: HTMLElement[] = [];
    if (s.teams && d.teamSize !== null) {
      const most = Math.floor(s.max / s.teams);
      const preset = el('select', { id: 'hc-preset', title: 'Team size' });
      preset.append(new Option('Presets', ''));
      for (const n of TEAM_PRESETS) if (n <= most) preset.append(new Option(teamsLabel(s.teams, n), String(n)));
      preset.addEventListener('change', () => {
        if (preset.value) d.teamSize = Number(preset.value);
        this.render();
      });
      rows.push(el('div', { class: 'hc-row' }, el('span', { textContent: 'Teams' }), step(teamsLabel(s.teams, d.teamSize), () => (d.teamSize = Math.max(1, d.teamSize! - 1)), () => (d.teamSize = Math.min(most, d.teamSize! + 1)), 'hc-teams'), preset));
    } else {
      const coop = s.mode === 'core.coop' || s.mode === 'core.zombies';
      rows.push(el('div', { class: 'hc-row' }, el('span', { textContent: coop ? 'Squad' : 'Players' }), step(String(d.fill), () => (d.fill = Math.max(1, d.fill - 1)), () => (d.fill = Math.min(s.max, d.fill + 1)), 'hc-players')));
    }
    rows.push(el('div', { class: 'hc-row' }, el('span', { textContent: 'Bot skill' }), tabs(HOST_BOT_SKILLS, SKILL_LABELS, d.skill, (v) => (d.skill = v), 'hc-skill')));
    rows.push(el('div', { class: 'hc-row' }, el('span', { textContent: 'Bot style' }), tabs(HOST_BOT_STYLES, STYLE_LABELS, d.style, (v) => (d.style = v), 'hc-style')));
    const changed = d.fill !== s.fill || d.teamSize !== s.teamSize || d.skill !== s.skill || d.style !== s.style;
    const apply = el('button', { class: 'primary', id: 'hc-apply', textContent: 'Apply', disabled: !changed });
    apply.addEventListener('click', () => {
      const cmd: Extract<HostCommand, { c: 'bots' }> = { c: 'bots' };
      if (s.teams) {
        if (d.teamSize !== s.teamSize && d.teamSize !== null) cmd.teamSize = d.teamSize;
      } else if (d.fill !== s.fill) cmd.fill = d.fill;
      if (d.skill !== s.skill) cmd.skill = d.skill;
      if (d.style !== s.style) cmd.style = d.style;
      this.hooks.command(cmd);
    });
    const actions = el('div', { class: 'hc-actions' });
    if (this.hooks.changeMap) {
      const map = el('button', { id: 'hc-map', textContent: 'Change map…' });
      map.addEventListener('click', () => this.hooks.changeMap?.());
      actions.append(map);
    }
    const restart = el('button', { id: 'hc-restart', textContent: 'Restart match' });
    restart.addEventListener('click', () => this.hooks.command({ c: 'restart' }));
    const end = el('button', { id: 'hc-end', textContent: 'End match', title: 'End the match now and show the scoreboard' });
    end.addEventListener('click', () => this.hooks.command({ c: 'end' }));
    actions.append(restart, end);
    const summary = el('summary', {}, `Match (${this.title.toLowerCase()})`, el('small', { textContent: ` ${s.teams && s.teamSize ? teamsLabel(s.teams, s.teamSize) : `${s.fill} players`} · ${MODE_LABELS[s.mode]} · ${SKILL_LABELS[s.skill]} bots` }));
    this.root.replaceChildren(summary, el('h4', { textContent: 'Bots' }), ...rows, apply, actions, this.status);
    this.root.open = open;
  }
}
