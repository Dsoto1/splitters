import { BREAKTHROUGH_POOL_MAX, DEFAULT_TEAMS, botSetLabel, getWeaponSet, HOST_BOT_SKILLS, HOST_BOT_STYLES, MODE_LABELS, ROTATION_MAX, SCORE_LIMIT_MAX, TICK_RATE, isTeamMode, isTwoTeamMode, limitsScale, mapPickPlayers, matchingPreset, peopleAndBots, scoreStep, setupFit, sizePresets, suggestedLimits, teamsLabel, type HostCommand, type HostRulesPatch, type HostState, type MapDocument, type MatchSetup, type RotationEntry, type RotationPreset, type RotationState } from '@tiletrigger/shared';
import { botCastSelect, choice, el, field, fitChip, fitList, limitsText, segmented, settingRow, sizeChips, stepper, teamEditor, weaponSetSelect } from '../frontend/setupControls.ts';
import { botManager } from '../frontend/botManager.ts';
import { BOT_SET_PRESETS } from '../playlists.ts';

const SKILL_LABELS: Record<HostState['skill'], string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const STYLE_LABELS: Record<HostState['style'], string> = { mixed: 'Mixed', arena: 'Arena', tactical: 'Tactical' };
const FF_LABELS = { off: 'Off', half: 'Half', on: 'Full' } as const;

export interface HostPanelHooks {
  /** Run a host command (bots, rules, restart, end; a map change goes through `changeMap`). */
  command(cmd: Exclude<HostCommand, { c: 'map' }>): void;
  /** Back to the game (the foot's Resume, as Esc). */
  resume?: () => void;
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

/** What the host has changed and not yet applied: the players and bots (live), and the rules. */
interface Draft {
  fill: number;
  sizes: number[];
  skill: HostState['skill'];
  style: HostState['style'];
  /** Bot characters (null: the map's own); undefined where the host doesn't know them. */
  cast: string[] | null | undefined;
  /** Rules as they'll be: the restart-only ones (score, time, respawn, friendly fire) and the three that apply at once. */
  rules: Required<HostRulesPatch> | null;
}

/** The restart-only rules after any change waiting for the restart. */
const nextRules = (s: HostState): Required<HostRulesPatch> | null => (s.rules ? { ...s.rules, ...(s.pending ?? {}) } : null);
/** Rules that apply at once (not at the restart). */
const LIVE_RULES: readonly (keyof HostRulesPatch)[] = ['mixPickups', 'dropWeapons', 'weaponSet'];
const same = (a: readonly unknown[] | null | undefined, b: readonly unknown[] | null | undefined): boolean => (a ?? null) === (b ?? null) || (!!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]));
/** Rules that need a new match, as the foot and the saved line say them: "score 16", "time 15 min", "respawn 3 s", "friendly fire half". */
const rulePhrases = (p: HostRulesPatch): string[] => [
  ...(p.scoreLimit !== undefined ? [`score ${p.scoreLimit}`] : []),
  ...(p.timeLimitSeconds !== undefined ? [`time ${p.timeLimitSeconds ? `${Math.round(p.timeLimitSeconds / 60)} min` : '∞'}`] : []),
  ...(p.respawnDelayTicks !== undefined ? [`respawn ${Math.round(p.respawnDelayTicks / TICK_RATE)} s`] : []),
  ...(p.friendlyFire !== undefined ? [`friendly fire ${FF_LABELS[p.friendlyFire].toLowerCase()}`] : []),
];

/**
 * The pause menu's Host tab for whoever runs the match (the offline player, the Host game host, a dedicated
 * server's admin): the same controls as Play → match setup, live. What wins (score, time), the players and
 * teams (presets worked out for the map, the team editor, the fit indicator), the bots, the rules, then the
 * match (change map, restart, end), the rotation and the people (kick, ban). Settings that need a restart
 * are marked so. Nothing changes until Apply, in the pause menu's foot with Resume: "Apply now" when
 * everything applies live, "Apply & restart" when something needs the match to start over. On a dedicated
 * server everyone else sees only a "Server admin" login (in the Match tab).
 */
export class HostPanel {
  readonly root = el('details', { id: 'host-controls', class: 'host-controls' });
  /** The Host tab's foot (the pause menu puts it in its own foot): Resume, Apply, what Apply will do, the status. */
  readonly foot = el('div', { class: 'hc-foot', id: 'hc-foot' });
  private state: HostState | null = null;
  /** Settings being edited, applied together. */
  private draft: Draft | null = null;
  private readonly status = el('p', { class: 'hint hc-status', id: 'hc-status' });
  /** People in the match besides you (kick and ban). */
  private people: { slot: number; name: string }[] = [];
  /** Team modes: people on each team besides you, and your team (null: spectating, or not known). */
  private teamPeople: { others: number[]; you: number | null } | null = null;
  private peopleKey = '';
  /** The rotation this browser keeps (offline, Host game); a server's comes in its HostState. */
  private ownRotation: RotationState | null = null;
  /** Shown first while you run the match (the Host tab's Online block); back in its home otherwise. */
  private lead: { node: HTMLElement; home: HTMLElement } | null = null;
  /** The match's map (presets and the fit check are worked out from it), once known. */
  private map: MapDocument | null = null;
  /** Even teams in the team editor (shown on while the teams are matched). */
  private even = true;
  /** Why the last change to the teams stopped short (a limit). */
  private stopped: string | null = null;
  /** The fit check's details are showing. */
  private fitOpen = false;
  /** Apply & restart was pressed once with other people in the match: the next press does it. */
  private armed: ReturnType<typeof setTimeout> | null = null;
  /**
   * When changed rules that need a new match apply: 'now' (Apply & restart: the match starts over with them) or
   * 'next' (Save for next match: they wait for the next match, after this one's scoreboard or Restart match, and
   * this one carries on). The host's choice stays while the panel does.
   */
  private when: 'now' | 'next' = 'now';

  constructor(
    private readonly hooks: HostPanelHooks,
    /** Who the player is to the match, for the heading. */
    private readonly title: 'Host' | 'Admin',
  ) {
    this.render();
  }

  /** The match's settings now (null: you don't run it). A change being edited stays where the match hasn't changed it meanwhile. */
  setState(state: HostState | null): void {
    const prev = this.state;
    const d = this.draft;
    this.state = state;
    if (!state) this.draft = null;
    else {
      const fresh: Draft = { fill: state.fill, sizes: this.sizesOf(state), skill: state.skill, style: state.style, cast: state.cast, rules: nextRules(state) };
      if (d && prev && prev.map === state.map && prev.mode === state.mode) {
        if (prev.fill === state.fill && same(this.sizesOf(prev), fresh.sizes) && d.sizes.length === fresh.sizes.length) {
          fresh.fill = d.fill;
          fresh.sizes = d.sizes;
        }
        if (prev.skill === state.skill) fresh.skill = d.skill;
        if (prev.style === state.style) fresh.style = d.style;
        if (same(prev.cast, state.cast)) fresh.cast = d.cast;
        const was = nextRules(prev);
        if (d.rules && fresh.rules && was) for (const k of Object.keys(fresh.rules) as (keyof HostRulesPatch)[]) if (was[k] === fresh.rules[k]) (fresh.rules as Record<string, unknown>)[k] = d.rules[k];
      }
      this.draft = fresh;
    }
    this.render();
  }

  /** The match's map: the size presets and the fit check are worked out from it. */
  setMap(map: MapDocument | null): void {
    this.map = map;
    if (this.state) this.render();
  }

  /**
   * The roster's people (not bots), you left out: whoever runs the match can kick or ban them. `teams`: how
   * many of them are on each team, and yours (team modes), so each team reads as who's on it.
   */
  setPeople(people: { slot: number; name: string }[], teams: { others: number[]; you: number | null } | null = null): void {
    const key = `${people.map((p) => `${p.slot}:${p.name}`).join('|')}/${teams ? `${teams.others.join()}:${teams.you}` : ''}`;
    if (key === this.peopleKey) return;
    this.peopleKey = key;
    this.people = people;
    this.teamPeople = teams;
    if (this.state) this.render();
  }

  /** The rotation kept by this browser (null: the host's state carries it, or there is none). */
  setRotation(rotation: RotationState | null): void {
    this.ownRotation = rotation;
    if (this.state) this.render();
  }

  /** Put `node` (with its listeners) first while you run the match; otherwise it sits first in `home`. */
  setLead(node: HTMLElement, home: HTMLElement): void {
    this.lead = { node, home };
    if (this.state) this.render();
  }

  /** Take the panel off the page; the lead goes back home (the next match's panel picks it up). */
  remove(): void {
    if (this.lead && this.lead.node.parentElement !== this.lead.home) this.lead.home.prepend(this.lead.node);
    this.lead = null;
    this.root.remove();
    this.foot.remove();
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
      card(
        'Rotation',
        null,
        head,
        ...(r.entries.length ? [list] : []),
        el('div', { class: 'hc-row hc-rot-tools' }, add, preset),
        el('div', { class: 'hc-row hc-rot-tools' }, el('label', { class: 'hc-check' }, shuffle, ' Shuffle'), skip, clear),
      ),
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

  /** The draft as a match setup, for the presets and the fit check (the map's own rules otherwise). */
  private asSetup(s: HostState, d: Draft): MatchSetup {
    return { map: s.map, mode: s.mode, bots: Math.max(0, d.fill - 1), skill: d.skill, scoreLimit: d.rules?.scoreLimit ?? 0, minutes: Math.round((d.rules?.timeLimitSeconds ?? 0) / 60), ...(s.teams ? { teams: [...d.sizes] } : {}) };
  }

  /**
   * What the draft changes, as short phrases for the foot ("+2 bots", "score 16"): `live`, now; `restart`, the rules
   * that need a new match, against what plays now (Apply & restart plays them, any saved for the next match too);
   * `fresh`, those not saved for the next match yet (Save for next match saves them).
   */
  private changes(s: HostState, d: Draft): { live: string[]; restart: string[]; fresh: string[]; liveRules: HostRulesPatch; restartRules: HostRulesPatch; freshRules: HostRulesPatch } {
    const now = this.sizesOf(s);
    const live: string[] = [];
    const total = (sizes: readonly number[], fill: number) => (s.teams ? sizes.reduce((a, b) => a + b, 0) : fill);
    const delta = total(d.sizes, d.fill) - total(now, s.fill);
    if (delta) live.push(`${delta > 0 ? '+' : '−'}${Math.abs(delta)} bot${Math.abs(delta) === 1 ? '' : 's'}`);
    else if (s.teams && !same(d.sizes, now)) live.push(d.sizes.join('v'));
    if (d.skill !== s.skill) live.push(`${SKILL_LABELS[d.skill].toLowerCase()} bots`);
    if (d.style !== s.style) live.push(`${STYLE_LABELS[d.style].toLowerCase()} style`);
    if (d.cast !== undefined && !same(d.cast, s.cast)) live.push('bot characters');
    const liveRules: HostRulesPatch = {};
    const restartRules: HostRulesPatch = {};
    const freshRules: HostRulesPatch = {};
    const want = nextRules(s);
    const r = d.rules;
    if (r && want && s.rules) {
      for (const k of Object.keys(r) as (keyof HostRulesPatch)[]) {
        if (LIVE_RULES.includes(k)) {
          if (r[k] !== s.rules[k]) (liveRules as Record<string, unknown>)[k] = r[k];
          continue;
        }
        if (r[k] !== s.rules[k] || r[k] !== want[k]) (restartRules as Record<string, unknown>)[k] = r[k];
        if (r[k] !== want[k]) (freshRules as Record<string, unknown>)[k] = r[k];
      }
      if (liveRules.mixPickups !== undefined) live.push(`mixed pickups ${liveRules.mixPickups ? 'on' : 'off'}`);
      if (liveRules.dropWeapons !== undefined) live.push(`weapon drops ${liveRules.dropWeapons ? 'on' : 'off'}`);
      if (liveRules.weaponSet !== undefined) live.push(`${liveRules.weaponSet ? getWeaponSet(liveRules.weaponSet).name : `the map's (${getWeaponSet(s.mapWeaponSet).name})`} weapons`);
    }
    return { live, restart: rulePhrases(restartRules), fresh: rulePhrases(freshRules), liveRules, restartRules, freshRules };
  }

  /**
   * Send what the draft changes: the live part now, then the rules, then (`when` 'now', when any needs it) the
   * restart. 'next': the rules wait for the next match (the match keeps them: HostControl's pending rules).
   */
  private apply(when: 'now' | 'next'): void {
    const s = this.state;
    const d = this.draft;
    if (!s || !d) return;
    const c = this.changes(s, d);
    const now = this.sizesOf(s);
    const cmd: Extract<HostCommand, { c: 'bots' }> = { c: 'bots' };
    if (s.teams) {
      if (!same(d.sizes, now)) {
        // Every team the same size: the plain command older servers know too.
        if (d.sizes.every((n) => n === d.sizes[0])) cmd.teamSize = d.sizes[0]!;
        else cmd.teamSizes = [...d.sizes];
      }
    } else if (d.fill !== s.fill) cmd.fill = d.fill;
    if (d.skill !== s.skill) cmd.skill = d.skill;
    if (d.style !== s.style) cmd.style = d.style;
    if (d.cast !== undefined && !same(d.cast, s.cast)) cmd.cast = d.cast;
    if (Object.keys(cmd).length > 1) this.hooks.command(cmd);
    const rules = { ...c.liveRules, ...(when === 'now' ? c.restartRules : c.freshRules) };
    if (Object.keys(rules).length) this.hooks.command({ c: 'rules', rules });
    if (when === 'now' && c.restart.length) this.hooks.command({ c: 'restart' });
  }

  private render(): void {
    const open = this.root.open;
    const s = this.state;
    const d = this.draft;
    this.root.hidden = !s && !this.hooks.login;
    if (!s || !d) {
      if (this.lead && this.lead.node.parentElement !== this.lead.home) this.lead.home.prepend(this.lead.node);
      // Dedicated server, not (yet) the admin: a token box.
      const token = el('input', { id: 'hc-token', type: 'password', placeholder: 'Admin token', autocomplete: 'off' });
      const login = el('button', { id: 'hc-login', textContent: 'Log in' });
      login.addEventListener('click', () => token.value.trim() && this.hooks.login?.(token.value.trim()));
      this.root.replaceChildren(el('summary', {}, 'Server admin'), el('p', { class: 'hint', textContent: "The server's ADMIN_TOKEN lets you change bots and map, restart and end the match." }), el('div', { class: 'hc-row' }, token, login), this.status);
      this.root.open = open;
      this.foot.replaceChildren();
      return;
    }
    const redraw = () => this.render();
    const now = this.sizesOf(s);
    const map = this.map && this.map.metadata.id === s.map ? this.map : null;
    const coop = s.mode === 'core.coop' || s.mode === 'core.zombies';

    // ---- what wins (restart): score and time, as on Match setup, with what's suggested for the players and bots
    const r = d.rules;
    const players = s.teams ? d.sizes.reduce((a, b) => a + b, 0) : d.fill;
    const sug = r && limitsScale(s.mode) ? suggestedLimits(s.mode, players, s.teams ? d.sizes : undefined) : null;
    const suggestion: HTMLElement[] = [];
    // Breakthrough wins by sectors: its "score" is reinforcements per attacker, its time each sector's.
    const bt = s.mode === 'core.breakthrough';
    const btSecs = r?.breakthroughSectorSeconds ?? 240;
    if (r && sug) {
      const size = s.teams && d.sizes.length <= 4 ? d.sizes.join('v') : `${players} players`;
      const off = bt ? r.breakthroughPool !== sug.scoreLimit || btSecs !== sug.minutes * 60 : r.scoreLimit !== sug.scoreLimit || r.timeLimitSeconds !== sug.minutes * 60;
      const use = el('button', { type: 'button', class: 'link', id: 'hc-use-suggested', textContent: 'Use suggested', title: 'Set the score and time suggested for this many players and bots (they apply with a new match: Apply & restart, or Save for next match)' });
      use.addEventListener('click', () => {
        if (bt) {
          r.breakthroughPool = sug.scoreLimit;
          r.breakthroughSectorSeconds = sug.minutes * 60;
        } else {
          r.scoreLimit = sug.scoreLimit;
          r.timeLimitSeconds = sug.minutes * 60;
        }
        redraw();
      });
      suggestion.push(el('p', { class: 'setup-hint limits-line', id: 'hc-suggest' }, el('span', { textContent: `Suggested for ${size}: ${limitsText(s.mode, sug)}${bt ? ' a sector' : ''}.` }), ...(off ? [use] : [])));
    }
    const fields = !r
      ? []
      : bt
        ? [
            field('Reinforcements', 'Respawns per attacker (the pool is this times the attacking team, topped up by half as much for each sector taken).', stepper({ value: r.breakthroughPool, min: 1, max: BREAKTHROUGH_POOL_MAX, id: 'hc-score', label: 'reinforcements per attacker', onChange: (v) => ((r.breakthroughPool = v), redraw()) }), { restart: true }),
            field('Sector time', "Minutes each sector puts on the clock (taking one adds the next one's).", stepper({ value: Math.round(btSecs / 60), min: 1, max: 15, id: 'hc-minutes', fmt: (v) => `${v} min`, onChange: (v) => ((r.breakthroughSectorSeconds = v * 60), redraw()) }), { restart: true }),
            field('Second round', 'A second round with the sides swapped.', choice([['off', 'One round'], ['on', 'Swap sides']], r.breakthroughSwap ? 'on' : 'off', (v) => ((r.breakthroughSwap = v === 'on'), redraw()), 'hc-bt-swap'), { restart: true }),
          ]
        : [
            // Small scores step by one (a capture, a round); big ones by more (10, 50, 100).
            field('Score limit', 'Score that wins (0: none).', stepper({ value: r.scoreLimit, min: 0, max: SCORE_LIMIT_MAX, step: r.scoreLimit < 50 ? 1 : scoreStep(r.scoreLimit), id: 'hc-score', label: 'score limit', onChange: (v) => ((r.scoreLimit = v), redraw()) }), { restart: true }),
            field('Time limit', 'Minutes until the match ends (∞: none).', stepper({ value: Math.round(r.timeLimitSeconds / 60), min: 0, max: 120, id: 'hc-minutes', fmt: (v) => (v ? `${v} min` : '∞'), onChange: (v) => ((r.timeLimitSeconds = v * 60), redraw()) }), { restart: true }),
          ];
    const win = r ? [card('To win', null, el('div', { class: 'field-grid' }, ...fields), ...suggestion)] : [];

    // ---- players and teams (live): the presets for this map, the team editor or the count, the fit check
    const rows: HTMLElement[] = [];
    const setup = this.asSetup(s, d);
    const deviceMax = s.max;
    if (map) {
      const pickPlayers = mapPickPlayers(map.metadata.recommendedPlayers);
      // Mid-match the number of teams stays: only presets with as many.
      const presets = sizePresets(s.mode, map, { teams: s.teams || undefined, deviceMax, device: 'this match', pickPlayers }).filter((p) => !s.teams || p.teams?.length === s.teams);
      const on = matchingPreset(setup, map, presets, deviceMax);
      rows.push(
        sizeChips(presets, on, s.teams ? d.sizes.join('v') : `${d.fill} players`, (p) => {
          if (p.teams) {
            d.sizes = [...p.teams];
            this.even = p.teams.every((n) => n === p.teams![0]);
          } else d.fill = p.players ?? d.fill;
          this.stopped = null;
          redraw();
        }, 'hc-sizes'),
      );
    }
    if (s.teams) {
      const names = d.sizes.map((_, i) => s.teamNames?.[i] ?? DEFAULT_TEAMS[i]?.name ?? `Team ${i + 1}`);
      rows.push(
        teamEditor({
          id: 'hc',
          state: { sizes: d.sizes, names, colors: d.sizes.map((_, i) => s.teamColors?.[i] ?? DEFAULT_TEAMS[i]?.color ?? '#00d1ff'), you: this.teamPeople?.you ?? null },
          ...(this.teamPeople ? { people: this.teamPeople.others } : {}),
          countLocked: 'The number of teams is set when the match starts: change it from Play → Match setup, or Change map.',
          namesLocked: 'Names and colours are set when the match starts (Play → Match setup).',
          cap: { max: s.max, by: 'device' },
          device: 'this match',
          mode: s.mode,
          even: { on: this.even && d.sizes.every((n) => n === d.sizes[0]), onToggle: (on) => (this.even = on) },
          stopped: this.stopped,
          onChange: (next, stopped) => {
            d.sizes = next.sizes;
            this.stopped = stopped;
            redraw();
          },
        }),
        el('p', { class: 'setup-hint', textContent: "Bots join or leave to fit, at once when you Apply. People who join take bots' places. Drag a bot pip to move it to another team." }),
      );
    } else {
      rows.push(
        settingRow(coop ? 'Squad' : 'Players', coop ? 'You and your bot squadmates.' : 'Everyone in the match, you included; bots fill the rest.', stepper({ value: d.fill, min: 1, max: s.max, id: 'hc-players', label: coop ? 'squad' : 'players', onChange: (v) => ((d.fill = v), redraw()) })),
        el('p', { class: 'setup-hint', id: 'hc-players-line', textContent: `${peopleAndBots(1 + this.people.length, Math.max(0, d.fill - 1 - this.people.length), coop ? 'squadmate' : 'bot')}. People who join take bots' places.` }),
      );
    }
    let fitTag: HTMLElement | null = null;
    if (map) {
      const fit = setupFit(setup, map, { deviceMax, device: 'this match', pickPlayers: mapPickPlayers(map.metadata.recommendedPlayers) });
      fitTag = fitChip(fit, this.fitOpen, () => ((this.fitOpen = !this.fitOpen), redraw()), 'hc-fit');
      const shown = this.fitOpen ? fit.items : fit.items.filter((i) => i.level === 'problem');
      const fix = (f: { teams?: number[]; players?: number }) => {
        if (f.teams && f.teams.length === d.sizes.length) d.sizes = [...f.teams];
        else if (f.players) d.fill = f.players;
        redraw();
      };
      if (shown.length) rows.unshift(fitList(shown, fix, 'hc-fit-list'));
    }
    const live = el('span', { class: 'when-tag live', textContent: 'Live', title: 'Changes the match now (Apply)' });

    // ---- bots (live)
    const botRows: HTMLElement[] = [
      settingRow('Bot skill', 'Easy bots aim slowly and miss often; hard ones react fast, use cover and lead their shots.', choice(HOST_BOT_SKILLS.map((v) => [v, SKILL_LABELS[v]] as const), d.skill, (v) => ((d.skill = v), redraw()), 'hc-skill')),
      settingRow('Bot style', 'Mixed: every character plays its own way. Arena: always moving (Quake). Tactical: careful, cover, held angles (Counter-Strike).', choice(HOST_BOT_STYLES.map((v) => [v, STYLE_LABELS[v]] as const), d.style, (v) => ((d.style = v), redraw()), 'hc-style')),
    ];
    // The host's own bots (names, looks, skills, teams, squads): hosts that know bot sets say so (HostState.botSet).
    if (s.botSet !== undefined) {
      const bots = el('button', { id: 'hc-bots', textContent: 'Bots…', title: 'Your own bots: names, looks, skill, style, team and squad (the window applies them live: bots swap in one at a time)' });
      bots.addEventListener('click', () => this.openBots(s));
      botRows.push(settingRow('Bot set', 'Your own bots by name, look, skill, style, team and squad; random bots fill the rest unless the set says only these.', el('div', { class: 'bot-set-line' }, el('span', { class: 'bot-set-sum', id: 'hc-bots-sum', textContent: `${s.mapBots ? "The map's: " : ''}${botSetLabel(s.botSet)}`, title: `${s.mapBots ? "The map's own bots: " : ''}${botSetLabel(s.botSet)}` }), bots)));
    }
    // Bot characters: random bots out of it change look and name; hosts that know it send HostState.cast.
    if (d.cast !== undefined) {
      botRows.push(settingRow('Bot characters', "Which characters random bots play, and so their names (a soldier is \"Sgt. Dunmore\"; the first bot in a character takes its name). Map default: the map maker's choice. Random bots out of it change when you Apply. Your bot set keeps its own.", botCastSelect(d.cast ?? undefined, s.mapCast, (v) => ((d.cast = v ?? null), redraw()), 'hc-cast')));
    }

    // ---- rules: respawn and friendly fire wait for the restart; mixed pickups and weapon drops apply at once
    const ruleRows: HTMLElement[] = [];
    if (r) {
      ruleRows.push(
        settingRow('Respawn delay', 'Seconds before players are back in.', stepper({ value: Math.round(r.respawnDelayTicks / TICK_RATE), min: 0, max: 30, id: 'hc-respawn', fmt: (v) => `${v} s`, onChange: (v) => ((r.respawnDelayTicks = v * TICK_RATE), redraw()) }), { restart: true }),
        settingRow('Friendly fire', 'Whether shots and blasts hurt teammates.', choice((['off', 'half', 'on'] as const).map((v) => [v, FF_LABELS[v]] as const), r.friendlyFire, (v) => ((r.friendlyFire = v), redraw()), 'hc-ff', isTeamMode(s.mode) || coop ? null : `No teammates in ${MODE_LABELS[s.mode]}.`), { restart: true }),
      );
      // Mix up weapon pickups and drop weapon on death: hosts that know them send them in HostState.rules.
      if (s.rules?.mixPickups !== undefined) ruleRows.push(settingRow('Mix up weapon pickups', 'Every weapon pickup not marked "keep fixed" in MapMaker holds a random weapon of the same kind as the one placed there, and a new one each time it comes back. Applies at once.', choice([['off', 'Off'], ['on', 'On']] as const, r.mixPickups ? 'on' : 'off', (v) => ((r.mixPickups = v === 'on'), redraw()), 'hc-mix'), { live: true }));
      // The weapon set (null: the map's default): hosts that know it send it in HostState.rules.
      if (s.rules?.weaponSet !== undefined && s.mode !== 'core.discs') ruleRows.push(settingRow('Weapon set', "What everyone spawns with and what the weapon and grenade pickups hold (Map default: the map maker's choice). Applies at once: the pickups change now, and everyone's next life spawns with the set.", weaponSetSelect(r.weaponSet ?? undefined, s.mapWeaponSet ?? 'standard', (v) => ((r.weaponSet = v ?? null), redraw()), 'hc-weapons'), { live: true }));
      if (s.rules?.dropWeapons !== undefined && s.mode !== 'core.discs' && s.mode !== 'core.race') ruleRows.push(settingRow('Drop weapon on death', "A fallen player's or bot's primary with ammo left lies at the body for 30 s, with exactly that ammo; the rest of what they carried is recycled. Applies at once (off clears the ones lying about).", choice([['on', 'On'], ['off', 'Off']] as const, r.dropWeapons ? 'on' : 'off', (v) => ((r.dropWeapons = v === 'on'), redraw()), 'hc-drops'), { live: true }));
    }
    const pending = s.pending && Object.keys(s.pending).length ? s.pending : null;
    if (pending) ruleRows.push(el('p', { class: 'hc-pending', id: 'hc-pending', textContent: `Saved for the next match: ${rulePhrases(pending).join(', ')}. They play once this match ends (or on Restart match, or a map change).` }));

    // ---- the match: Change map (routine), then what undoes everyone's match (restart, end), set apart in red
    const routine: HTMLElement[] = [];
    if (this.hooks.changeMap) {
      const mapBtn = el('button', { id: 'hc-map', textContent: 'Change map…', title: 'Pick another map (and mode): the match starts over there with the same players and bots' });
      mapBtn.addEventListener('click', () => this.hooks.changeMap?.());
      routine.push(mapBtn);
    }
    const restart = el('button', { id: 'hc-restart', class: 'danger', textContent: 'Restart match', title: pending ? 'Start over with the rules saved for the next match (asks for a second click)' : 'Start the match over on this map (asks for a second click)' });
    confirmTwice(restart, 'Click again to restart', () => this.hooks.command({ c: 'restart' }));
    const end = el('button', { id: 'hc-end', class: 'danger', textContent: 'End match', title: 'End the match now and show the scoreboard (asks for a second click)' });
    confirmTwice(end, 'Click again to end', () => this.hooks.command({ c: 'end' }));
    const matchCard = card('Match', null, ...(routine.length ? [el('div', { class: 'hc-actions' }, ...routine)] : []), el('div', { class: 'hc-actions hc-danger' }, restart, end));
    // People: kick (they may come back) or ban (kept out: their account when signed in, else weakly by browser).
    const people = this.people.length
      ? [
          card(
            'Players',
            null,
            ...this.people.map((p) => {
              const kick = el('button', { id: `hc-kick-${p.slot}`, textContent: 'Kick', title: `Remove ${p.name} (they may rejoin)` });
              kick.addEventListener('click', () => this.hooks.command({ c: 'kick', slot: p.slot }));
              const ban = el('button', { id: `hc-ban-${p.slot}`, class: 'danger', textContent: 'Ban', title: `Remove ${p.name} and keep them out` });
              ban.addEventListener('click', () => window.confirm(`Ban ${p.name} from this ${this.title === 'Admin' ? 'server' : 'game'}?`) && this.hooks.command({ c: 'ban', slot: p.slot }));
              return el('div', { class: 'hc-row hc-person' }, el('span', { textContent: p.name }), kick, ban);
            }),
          ),
        ]
      : [];
    const label = s.teams ? (now.every((n) => n === now[0]) ? teamsLabel(s.teams, now[0]!) : now.join('v')) : `${s.fill} players`;
    const summary = el('summary', {}, `Match (${this.title.toLowerCase()})`, el('small', { textContent: ` ${label} · ${MODE_LABELS[s.mode]} · ${SKILL_LABELS[s.skill]} bots` }));
    const teamsTitle = s.teams ? (isTwoTeamMode(s.mode) ? 'Teams' : 'Players & teams') : coop ? 'Squad' : 'Players';
    // Cards in balanced columns (style.css: as many as fit, each card whole): Online, what wins, who plays,
    // the bots, the rules, the match buttons, the rotation, the people.
    this.root.replaceChildren(
      summary,
      el(
        'div',
        { class: 'hc-grid' },
        ...(this.lead ? [this.lead.node] : []),
        ...win,
        card(teamsTitle, fitTag ? el('span', { class: 'hc-tags' }, fitTag, live) : live, ...rows),
        card('Bots', live.cloneNode(true) as HTMLElement, ...botRows),
        ...(ruleRows.length ? [card('Rules', null, ...ruleRows)] : []),
        matchCard,
        ...this.rotationSection(s),
        ...people,
      ),
    );
    this.root.open = open;
    this.drawFoot(s, d);
  }

  /**
   * The foot, always in view: Resume, then Apply, named by what it will do: Apply now (everything changes live),
   * Apply & restart (a rule that needs a new match changed: the match starts over with it) or Save for next match
   * (those rules wait for the next match and this one carries on). While such a rule has changed, beside it the
   * choice between the last two (Restart now | Next match); then a line saying what will happen, and the status.
   */
  private drawFoot(s: HostState, d: Draft): void {
    const c = this.changes(s, d);
    const rules = c.restart.length > 0;
    const next = rules && this.when === 'next';
    const restart = rules && !next;
    const any = c.live.length > 0 || (next ? c.fresh.length > 0 : rules);
    const resume = el('button', { type: 'button', class: 'primary', id: 'hc-resume', textContent: 'Resume', title: 'Back to the game (Esc)' });
    resume.addEventListener('click', () => this.hooks.resume?.());
    // (Rules saved already and only players or bots changed since: those apply now.)
    const saving = next && (c.fresh.length > 0 || !c.live.length);
    const apply = el('button', { type: 'button', class: `hc-apply${restart ? ' restart' : saving ? ' next' : ''}`, id: 'hc-apply', textContent: restart ? 'Apply & restart' : saving ? 'Save for next match' : 'Apply now', disabled: !any });
    apply.title = !any
      ? next
        ? 'Saved already: the next match plays with it'
        : 'Change something above first'
      : restart
        ? 'Apply these changes and start the match over (scores reset): some rules only change with a new match'
        : next
          ? `Keep the changed rules for the next match (after this one's scoreboard, or Restart match): this match carries on${c.live.length ? '; players and bots change now' : ''}`
          : 'Apply these changes now (bots join or leave one at a time)';
    const others = this.people.length;
    apply.addEventListener('click', () => {
      if (!any) return;
      // A restart undoes everyone's match: with other people in it, the first press asks.
      if (restart && others && !this.armed) {
        apply.textContent = 'Click again to restart';
        apply.classList.add('armed');
        this.armed = setTimeout(() => {
          this.armed = null;
          if (apply.isConnected) this.drawFoot(s, d);
        }, 3000);
        return;
      }
      if (this.armed) clearTimeout(this.armed);
      this.armed = null;
      this.apply(next ? 'next' : 'now');
    });
    // When the changed rules apply: now (the match restarts) or with the next match.
    const when = rules
      ? [
          segmented(
            [
              ['now', 'Restart now', null, 'hc-when-now', 'Apply restarts the match now with the changed rules (scores reset).'],
              ['next', 'Next match', null, 'hc-when-next', 'Save the changed rules for the next match: this one carries on, and they play after its scoreboard (or when you restart it, or change map). Players and bots still change now.'],
            ],
            this.when,
            (v) => {
              this.when = v;
              this.drawFoot(s, d);
              document.getElementById(`hc-when-${v}`)?.focus();
            },
            { id: 'hc-when', label: 'When the rule changes apply' },
          ),
        ]
      : [];
    // What will happen, in a line.
    const list = (xs: readonly string[]) => xs.join(', ');
    const text = !rules
      ? c.live.length
        ? list(c.live)
        : 'No changes'
      : restart
        ? `${list([...c.live, ...c.restart])}: the match restarts now`
        : [c.live.length ? `${list(c.live)} now` : '', c.fresh.length ? `${list(c.fresh)} from the next match` : `saved for the next match: ${list(c.restart)}`].filter(Boolean).join('; ');
    const what = el('span', { class: 'hc-changes', id: 'hc-changes', textContent: text, title: text });
    this.foot.replaceChildren(resume, apply, ...when, what, this.status);
  }
}

/** A titled card of the Host tab; `tag`: a small badge after the title (Live). */
function card(title: string, tag: HTMLElement | null, ...children: HTMLElement[]): HTMLElement {
  return el('section', { class: 'hc-card' }, el('h4', { class: 'hc-card-title' }, el('span', { textContent: title }), ...(tag ? [tag] : [])), ...children);
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
