import { WEATHER_CHOICES, WEATHER_PRESETS, isWeatherChoice, BOT_CAST_CHOICES, CHARACTER_GROUPS, DEFAULT_TEAMS, MAX_PLAYER_SLOTS, MAX_TEAMS, MAX_TEAM_SIZE, botCastLabel, changeTeamCount, evenTeams, getWeaponSet, isWeaponSetId, peopleAndBots, setTeamSize, weaponSetList, type FitItem, type FitTopic, type GameMode, type MatchLimits, type PlayerCap, type SetupFit, type SizePreset, type TeamChange } from '@tiletrigger/shared';

/**
 * Match setup controls shared by Play → match setup and the host's pause
 * menu (Host tab), so a change mid-match looks and works like one before it:
 * steppers you can type into, choice tabs whose unavailable options are
 * greyed with the reason, setting rows and fields (marked when they wait for
 * a restart), sections that open and close, the size presets, the fit
 * indicator, the Offline / Host online switch and the team editor.
 */

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) e.className = cls;
  Object.assign(e, rest);
  e.append(...children);
  return e;
};

/** A small (i) that explains something when hovered or focused (the front end's tooltip shows data-tip). */
export function infoTip(text: string): HTMLElement {
  const i = el('span', { class: 'info', tabIndex: 0, textContent: 'i' });
  i.dataset.tip = text;
  i.setAttribute('aria-label', text);
  return i;
}

/** Explain a control that can't be used right now (greyed; the reason on hover). */
function why(e: HTMLElement, reason: string | null | undefined): void {
  if (!reason) return;
  e.dataset.tip = reason;
  e.title = reason;
}

/**
 * A button that can't be pressed here, with the reason: greyed and inert, but still focusable and hoverable
 * (a disabled button gets no hover or focus, so its tooltip would never show).
 */
export function inert(b: HTMLElement, reason: string | null | undefined): void {
  if (!reason) return;
  b.classList.add('off');
  b.setAttribute('aria-disabled', 'true');
  why(b, reason);
}

export interface StepperOptions {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** How the value reads (not typeable when set: "10 min", "∞"). */
  fmt?: (v: number) => string;
  /** IDs: `${id}` for the value, `${id}-minus` / `${id}-plus` for the buttons. */
  id?: string;
  /** Why it can't change (greyed with the reason). */
  disabled?: string | null;
  label?: string;
  onChange: (v: number) => void;
}

/** − value +, the value typeable (whole numbers) unless it has its own format. */
export function stepper(o: StepperOptions): HTMLElement {
  const step = o.step ?? 1;
  const clamp = (v: number) => Math.max(o.min, Math.min(o.max, v));
  const minus = el('button', { type: 'button', textContent: '−', disabled: !!o.disabled || o.value <= o.min, ...(o.id ? { id: `${o.id}-minus` } : {}) });
  const plus = el('button', { type: 'button', textContent: '+', disabled: !!o.disabled || o.value >= o.max, ...(o.id ? { id: `${o.id}-plus` } : {}) });
  minus.setAttribute('aria-label', `Less${o.label ? ` ${o.label}` : ''}`);
  plus.setAttribute('aria-label', `More${o.label ? ` ${o.label}` : ''}`);
  minus.addEventListener('click', () => o.onChange(clamp(Math.round((o.value - step) * 100) / 100)));
  plus.addEventListener('click', () => o.onChange(clamp(Math.round((o.value + step) * 100) / 100)));
  let value: HTMLElement;
  if (o.fmt) value = el('b', { textContent: o.fmt(o.value), ...(o.id ? { id: o.id } : {}) });
  else {
    const input = el('input', { type: 'number', min: String(o.min), max: String(o.max), step: String(step), value: String(o.value), disabled: !!o.disabled, ...(o.id ? { id: o.id } : {}) });
    if (o.label) input.setAttribute('aria-label', o.label);
    input.addEventListener('change', () => {
      const v = Number(input.value);
      if (Number.isFinite(v)) o.onChange(clamp(Math.round(v)));
      else input.value = String(o.value);
    });
    value = input;
  }
  const box = el('div', { class: `stepper${o.disabled ? ' off' : ''}` }, minus, value, plus);
  why(box, o.disabled);
  return box;
}

/** What each mode's score counts, for a score limit in words. */
const SCORE_UNITS: Partial<Record<GameMode, string>> = {
  'core.tdm': 'points',
  'core.deathmatch': 'kills',
  'core.roulette': 'points',
  'core.ctf': 'captures',
  'core.forts': 'captures',
  'core.koth': 'hill seconds',
  'core.elim': 'rounds',
  'core.bomb': 'rounds',
  'core.hostage': 'rounds',
  'core.breakthrough': 'reinforcements an attacker',
  'core.discs': 'knock-offs',
};

/** A score limit and time in words ("500 points, 20 min"): the parts the mode shows (Fort Wars has no clock). */
export function limitsText(mode: GameMode, l: MatchLimits, shown: { score: boolean; time: boolean } = { score: true, time: true }): string {
  const parts = [shown.score ? `${l.scoreLimit} ${SCORE_UNITS[mode] ?? 'points'}` : '', shown.time ? (l.minutes ? `${l.minutes} min` : 'no time limit') : ''];
  return parts.filter(Boolean).join(', ');
}

/** One option of a choice: its value, label and (when it can't be picked) why not. */
export type ChoiceOption<T extends string> = readonly [value: T, label: string, disabled?: string | null];

/** A row of tabs, one on; greyed options say why they can't be picked. Buttons carry data-value. */
export function choice<T extends string>(options: readonly ChoiceOption<T>[], value: T, onChange: (v: T) => void, id?: string, disabled?: string | null): HTMLElement {
  const box = el(
    'div',
    { class: `tabs${disabled ? ' off' : ''}`, ...(id ? { id } : {}) },
    ...options.map(([v, label, off]) => {
      const b = el('button', { type: 'button', class: `tab${v === value ? ' on' : ''}`, textContent: label, disabled: !!(off || disabled) });
      b.dataset.value = v;
      why(b, off);
      b.addEventListener('click', () => v !== value && onChange(v));
      return b;
    }),
  );
  why(box, disabled);
  return box;
}

/**
 * A switch between two or three ways (Offline | Host online): segments that read as one control, the one on
 * lit. A segment that can't be picked here stays visible, greyed, with the reason on hover and focus.
 */
export function segmented<T extends string>(options: readonly (readonly [value: T, label: string, disabled?: string | null, id?: string, tip?: string])[], value: T, onChange: (v: T) => void, o: { id: string; label: string }): HTMLElement {
  const box = el('div', { class: 'seg-switch', id: o.id, role: 'radiogroup' });
  box.setAttribute('aria-label', o.label);
  for (const [v, label, off, id, tip] of options) {
    const b = el('button', { type: 'button', class: `seg-opt${v === value ? ' on' : ''}`, textContent: label, ...(id ? { id } : {}) });
    b.dataset.value = v;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(v === value));
    if (tip) b.dataset.tip = tip;
    inert(b, off ? `${tip ? `${tip}\n\n` : ''}${off}` : null);
    b.addEventListener('click', () => !off && v !== value && onChange(v));
    box.append(b);
  }
  return box;
}

export interface RowOptions {
  /** Takes effect when the match restarts (mid-match). */
  restart?: boolean;
  /** Changes now, mid-match. */
  live?: boolean;
  /** Set by hand: it no longer follows the suggestion for the match's size (score, time). */
  custom?: boolean;
  /** Can't be used here, and why. */
  disabled?: string | null;
}

/** The small marks after a setting's name: it waits for a restart, or changes the match now. */
function whenTags(o: RowOptions): HTMLElement[] {
  const tags: HTMLElement[] = [];
  if (o.restart) tags.push(el('span', { class: 'when-tag restart', textContent: '⟳ Restart', title: 'Applies when the match restarts (Apply & restart)' }));
  if (o.live) tags.push(el('span', { class: 'when-tag live', textContent: 'Live', title: 'Changes right away, mid-match' }));
  if (o.custom) tags.push(el('span', { class: 'when-tag custom', textContent: 'Custom', title: 'Set by you: it stays when the size changes ("Back to suggested" follows the size again)' }));
  return tags;
}

/** A setting: its name with an (i), a restart / live tag when it applies, then the control. */
export function settingRow(label: string, tip: string | null, control: HTMLElement, o: RowOptions = {}): HTMLElement {
  const row = el('div', { class: `row${o.disabled ? ' off' : ''}` }, el('span', { class: 'row-label' }, label, ...(tip ? [infoTip(tip)] : []), ...whenTags(o)), control);
  why(row, o.disabled);
  return row;
}

/** One of the essentials (score, time, the mode's own key setting): its name over its control, a few across. */
export function field(label: string, tip: string | null, control: HTMLElement, o: RowOptions = {}): HTMLElement {
  const box = el('div', { class: `field${o.disabled ? ' off' : ''}` }, el('span', { class: 'field-label' }, label, ...(tip ? [infoTip(tip)] : []), ...whenTags(o)), control);
  why(box, o.disabled);
  return box;
}

/** A section folded away until opened; `badge`: a short state ("2 changed", "standard"). */
export function fold(o: { id: string; title: string; badge?: string; open: boolean; onToggle: (open: boolean) => void; extra?: HTMLElement[] }, ...children: HTMLElement[]): HTMLDetailsElement {
  const d = el('details', { class: 'setup-more', id: o.id }) as HTMLDetailsElement;
  d.open = o.open;
  d.addEventListener('toggle', () => o.onToggle(d.open));
  d.append(el('summary', {}, el('span', { textContent: o.title }), ...(o.badge ? [el('small', { textContent: o.badge })] : []), ...(o.extra ?? [])), ...children);
  return d;
}

/**
 * A section of the setup under the essentials (Players & teams, Bots, Advanced rules): its header (the title,
 * a line saying what it's set to, a caret) opens and closes it. `tag`: a mark after the title (Live).
 */
export function section(o: { id: string; title: string; summary?: (Node | string)[]; open: boolean; onToggle: () => void; tag?: HTMLElement | null; warn?: boolean; opening?: boolean }, ...children: HTMLElement[]): HTMLElement {
  const head = el(
    'button',
    { type: 'button', class: 'sec-head', id: `${o.id}-head` },
    el('h4', { textContent: o.title }),
    ...(o.tag ? [o.tag] : []),
    el('span', { class: `sec-sum${o.warn ? ' warn' : ''}` }, ...(o.summary ?? [])),
    el('span', { class: 'sec-caret', textContent: '▸' }),
  );
  head.setAttribute('aria-expanded', String(o.open));
  head.addEventListener('click', o.onToggle);
  // `opening`: just opened, its settings slide in (a redraw of one already open doesn't flash).
  const sec = el('section', { class: `setup-sec${o.open ? ' open' : ''}${o.open && o.opening ? ' opening' : ''}`, id: o.id }, head);
  if (o.open) sec.append(el('div', { class: 'sec-body', id: `${o.id}-body` }, ...children));
  return sec;
}

/**
 * The size presets worked out for this map, mode and device (Duel, Small, Map's pick, Big battle, Max), the one
 * the setup is on lit; changed from all of them, a Custom chip says so (with what it is: `custom`).
 */
export function sizeChips(presets: readonly SizePreset[], on: SizePreset | null, custom: string, onPick: (p: SizePreset) => void, id: string): HTMLElement {
  const box = el('div', { class: 'size-chips', id, role: 'group' });
  box.setAttribute('aria-label', 'Size presets');
  for (const p of presets) {
    const b = el('button', { type: 'button', class: `size-chip${p === on ? ' on' : ''}` }, el('b', { textContent: p.label }), el('small', { textContent: p.value }));
    b.dataset.preset = p.id;
    b.dataset.tip = p.tip;
    b.setAttribute('aria-pressed', String(p === on));
    b.addEventListener('click', () => onPick(p));
    box.append(b);
  }
  if (!on) {
    const c = el('span', { class: 'size-chip custom on', id: `${id}-custom` }, el('b', { textContent: 'Custom' }), el('small', { textContent: custom }));
    c.dataset.tip = 'Changed from the presets: any of them puts it back.';
    box.append(c);
  }
  return box;
}

/** The fit check's topics, as its details name them. */
export const FIT_TOPICS: Record<FitTopic, string> = { caps: 'Players', device: 'This device', size: 'Map size', spawns: 'Spawns', teams: 'Teams', performance: 'Performance' };

/** The fit indicator: one chip, green Fits, amber Crowded or red Problem; it shows or hides the details. */
export function fitChip(fit: SetupFit, open: boolean, onToggle: () => void, id: string): HTMLButtonElement {
  const b = el('button', { type: 'button', class: `fit-chip ${fit.level}${open ? ' open' : ''}`, id }, el('i', { class: 'fit-dot' }), el('span', { textContent: fit.label }), el('span', { class: 'fit-caret', textContent: '▾' }));
  b.dataset.level = fit.level;
  b.setAttribute('aria-expanded', String(open));
  b.title = open ? 'Hide the details' : 'How this setup fits the map and this device: spawn points, the map\'s recommended size, performance';
  b.addEventListener('click', onToggle);
  return b;
}

/**
 * The fit check's details, a line per topic: what it found, marked by how much it matters (a red problem, an
 * amber warning, a hint, a tick), and a suggestion's button that acts ("Use 12v12"). `extra`: a control to
 * show with a topic's line (Graphics with performance).
 */
export function fitList(items: readonly FitItem[], onFix: (fix: NonNullable<FitItem['fix']>) => void, id: string, extra: Partial<Record<FitTopic, HTMLElement>> = {}): HTMLElement {
  const list = el('ul', { class: 'fit-list', id });
  for (const it of items) {
    const li = el('li', { class: `fit-item ${it.level}` }, el('b', { class: 'fit-topic', textContent: FIT_TOPICS[it.topic] }), el('span', { class: 'fit-text', textContent: it.text }));
    li.dataset.topic = it.topic;
    if (it.fix) {
      const fix = it.fix;
      const b = el('button', { type: 'button', class: 'fit-fix', id: `${id}-fix-${it.topic}`, textContent: fix.label });
      b.addEventListener('click', () => onFix(fix));
      li.append(b);
    }
    const x = extra[it.topic];
    if (x) li.append(x);
    list.append(li);
  }
  return list;
}

/** The team palette: every default team colour (the map's own sides add theirs). */
export const TEAM_PALETTE: readonly string[] = DEFAULT_TEAMS.map((t) => t.color);

export interface TeamEditorState {
  sizes: number[];
  /** Names and colours as shown (the map's where the player set none). */
  names: string[];
  colors: string[];
  /** The team you're on (fixed assignment), else null: balanced or random. */
  you: number | null;
}

export interface TeamEditorOptions {
  state: TeamEditorState;
  /** Prefix for element IDs (`arcade`, `hc`). */
  id: string;
  /** Why the number of teams can't change (two-team modes; mid-match). */
  countLocked?: string | null;
  /** Why names and colours can't change (mid-match). */
  namesLocked?: string | null;
  /** People already on each team (mid-match: they can't be moved out, so a team can't shrink below them). */
  people?: readonly number[];
  /** Your chip: "You" offline, absent mid-match on a server. */
  youLabel?: string;
  /** Most players in all (a browser's match: BROWSER_MAX_PLAYERS; a dedicated host's: MAX_PLAYER_SLOTS). */
  maxPlayers?: number;
  /** The cap and whose it is (overrides maxPlayers): the device's. */
  cap?: PlayerCap;
  /** Whose limit the cap is, in its message: "this computer", "this phone". */
  device?: string;
  /** The mode: two-team modes keep two teams. */
  mode?: GameMode;
  /** Even teams: its switch, and while it's on every team changes alike. */
  even?: { on: boolean; onToggle: (on: boolean) => void };
  /** Why the last change stopped short (a limit), shown under the teams. */
  stopped?: string | null;
  /** The new teams, and why the change stopped short of what was asked (null: it didn't). */
  onChange: (next: TeamEditorState, stopped: string | null) => void;
}

/** Bot pips drawn per team before "+N". */
const PIPS = 10;

/**
 * Teams, freely: how many (2–8), and each one's people, bots and size, name and colour (from the palette).
 * Each team reads as who's on it ("You + 23 bots"); its − and + take a bot off or add one, and the team
 * shrinks or grows with it (a typed size sets the team). Even teams keep every team matched. A change
 * that hits a limit (the device) says so under the teams. Drag a bot pip to another team to
 * move a bot there, or drag yourself (or press Join) to play on that team.
 */
export function teamEditor(o: TeamEditorOptions): HTMLElement {
  const s = o.state;
  const n = s.sizes.length;
  const total = s.sizes.reduce((a, b) => a + b, 0);
  const cap: PlayerCap = o.cap ?? { max: o.maxPlayers ?? MAX_PLAYER_SLOTS, by: 'device' };
  const even = !!o.even?.on;
  // People on each team: those already in (mid-match), and you.
  const people = s.sizes.map((_, i) => (o.people?.[i] ?? 0) + (s.you === i ? 1 : 0));
  const humans = people.reduce((a, b) => a + b, 0);
  const opts = { people, cap, even, device: o.device };
  const emit = (patch: Partial<TeamEditorState>, stopped: string | null = null) => o.onChange({ ...s, sizes: [...s.sizes], names: [...s.names], colors: [...s.colors], ...patch }, stopped);
  const resize = (r: TeamChange) => emit({ sizes: r.sizes, you: s.you !== null && s.you >= r.sizes.length ? r.sizes.length - 1 : s.you }, r.stopped);
  const moveBot = (from: number, to: number) => {
    if (from === to) return;
    const sizes = [...s.sizes];
    if (sizes[from]! <= Math.max(1, people[from]!) || sizes[to]! >= MAX_TEAM_SIZE) return;
    sizes[from]!--;
    sizes[to]!++;
    emit({ sizes });
  };
  const count = stepper({
    value: n,
    min: 2,
    max: MAX_TEAMS,
    id: `${o.id}-team-count`,
    label: 'teams',
    disabled: o.countLocked,
    onChange: (k) => resize(changeTeamCount(s.sizes, k, o.mode ?? 'core.tdm', opts)),
  });
  const head = el(
    'div',
    { class: 'team-head' },
    el('span', { class: 'row-label', textContent: 'Teams' }),
    count,
    ...(o.even
      ? [
          evenSwitch(`${o.id}-even`, even, (on) => {
            o.even!.onToggle(on);
            if (on) resize(evenTeams(s.sizes, opts));
            else emit({});
          }),
        ]
      : []),
    el('span', { class: 'team-total', id: `${o.id}-team-total`, textContent: `${s.sizes.join('v')} · ${s.you !== null || !humans ? peopleAndBots(humans, total - humans) : `${humans} ${humans === 1 ? 'player' : 'players'} + ${total - humans} bots`}` }),
  );
  const cards = el('div', { class: 'team-cards', id: `${o.id}-team-cards` });
  s.sizes.forEach((size, i) => {
    const color = s.colors[i] ?? TEAM_PALETTE[i % TEAM_PALETTE.length]!;
    const card = el('div', { class: `team-card${s.you === i ? ' mine' : ''}` });
    card.dataset.team = String(i);
    card.style.setProperty('--team', color);
    // Colour: a swatch that opens the palette.
    const swatch = el('details', { class: 'swatches' }) as HTMLDetailsElement;
    const sum = el('summary', { title: 'Team colour', className: 'swatch-now' });
    sum.style.background = color;
    sum.setAttribute('aria-label', `Team ${i + 1} colour`);
    const pal = el('div', { class: 'swatch-grid' }, ...TEAM_PALETTE.map((c) => {
      const b = el('button', { type: 'button', class: `swatch${c === color ? ' on' : ''}`, title: c });
      b.style.background = c;
      b.dataset.color = c;
      b.addEventListener('click', () => {
        const colors = [...s.colors];
        colors[i] = c;
        emit({ colors });
      });
      return b;
    }));
    swatch.append(sum, pal);
    if (o.namesLocked) {
      sum.style.pointerEvents = 'none';
      why(swatch, o.namesLocked);
    }
    const teamName = s.names[i] || `team ${i + 1}`;
    const name = el('input', { class: 'team-name', value: s.names[i] ?? '', maxLength: 24, title: o.namesLocked ?? 'Team name', disabled: !!o.namesLocked, id: `${o.id}-team-name-${i}` });
    name.setAttribute('aria-label', `Team ${i + 1} name`);
    name.addEventListener('change', () => {
      const names = [...s.names];
      names[i] = name.value.trim();
      emit({ names });
    });
    const mine = people[i]!;
    const bots = Math.max(0, size - mine);
    // − and + are a bot less or more (the team shrinks or grows with it); the number is the team's size, and typeable.
    // + goes up to the largest team: past the cap, setTeamSize stops and says whose limit it is.
    const floor = even ? Math.max(...people.map((p) => Math.max(1, p))) : Math.max(1, mine);
    const sizeStep = stepper({ value: size, min: floor, max: MAX_TEAM_SIZE, id: `${o.id}-team-size-${i}`, label: `players on ${teamName}`, onChange: (v) => resize(setTeamSize(s.sizes, i, v, opts)) });
    const [minus, plus] = [sizeStep.firstElementChild as HTMLElement, sizeStep.lastElementChild as HTMLElement];
    minus.setAttribute('aria-label', `One bot fewer on ${teamName}`);
    plus.setAttribute('aria-label', `One more bot on ${teamName}`);
    minus.dataset.tip = even ? 'One bot fewer on every team' : 'One bot fewer: the team shrinks';
    plus.dataset.tip = even ? 'One more bot on every team' : 'One more bot: the team grows';
    // Who's on it: "You + 23 bots", "2 players + 22 bots", "24 bots" (people mid-match, you among them or not).
    const who = el('span', { class: 'team-who', id: `${o.id}-team-who-${i}`, textContent: s.you === i || !mine ? peopleAndBots(mine, bots) : `${mine} ${mine === 1 ? 'player' : 'players'}${bots ? ` + ${bots} bot${bots === 1 ? '' : 's'}` : ''}` });
    // Roster: you, people, then a pip per bot (drag one to another team).
    const roster = el('div', { class: 'roster' });
    if (s.you === i && o.youLabel) {
      const me = el('span', { class: 'chip you', textContent: o.youLabel, draggable: true, title: 'Drag to another team to play on it' });
      me.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/plain', 'you'));
      roster.append(me);
    }
    const others = o.people?.[i] ?? 0;
    if (others) roster.append(el('span', { class: 'chip people', textContent: `${others} ${others === 1 ? 'person' : 'people'}` }));
    for (let b = 0; b < Math.min(bots, PIPS); b++) {
      const pip = el('span', { class: 'pip', draggable: true, title: 'A bot: drag it to another team' });
      pip.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/plain', `bot:${i}`));
      roster.append(pip);
    }
    if (bots > PIPS) roster.append(el('span', { class: 'more', textContent: `+${bots - PIPS}` }));
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('drop');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drop'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drop');
      const what = e.dataTransfer?.getData('text/plain') ?? '';
      if (what === 'you') emit({ you: i });
      else if (what.startsWith('bot:')) moveBot(Number(what.slice(4)), i);
    });
    if (o.youLabel && s.you !== i) {
      const join = el('button', { type: 'button', class: 'team-join link', textContent: 'Join', title: 'Play on this team' });
      join.dataset.team = String(i);
      join.addEventListener('click', () => emit({ you: i }));
      roster.append(join);
    }
    card.append(el('div', { class: 'team-top' }, swatch, name), el('div', { class: 'team-mid' }, who, sizeStep), roster);
    cards.append(card);
  });
  const note = o.stopped ? [el('p', { class: 'cap-note', id: `${o.id}-team-stopped`, role: 'status', textContent: o.stopped })] : [];
  return el('div', { class: 'team-editor' }, head, cards, ...note);
}

/** A labelled on/off switch (a checkbox drawn as a switch), its tooltip saying what it does. */
export function evenSwitch(id: string, on: boolean, onToggle: (on: boolean) => void, label = 'Even teams', tip = 'Keep every team the same size: a bot added or taken away changes every team alike.'): HTMLElement {
  const input = el('input', { type: 'checkbox', id, checked: on });
  input.addEventListener('change', () => onToggle(input.checked));
  const box = el('label', { class: 'even-switch', htmlFor: id }, el('span', { class: 'switch' }, input, el('span', { class: 'switch-track' })), el('span', { textContent: label }));
  box.dataset.tip = tip;
  return box;
}

/**
 * Bot characters (which looks random bots wear, and so their names): the map's own, all, one character group
 * or one name theme. `value`: undefined the map's own, empty all, else the ids (several only when a map set them:
 * shown as they are). `mapCast`: the map's own, for the "Map" option's label.
 */
export function botCastSelect(value: readonly string[] | undefined, mapCast: readonly string[] | undefined, onChange: (v: string[] | undefined) => void, id?: string, disabled?: boolean): HTMLSelectElement {
  const sel = el('select', { ...(id ? { id } : {}), disabled: !!disabled });
  const opt = (v: string, label: string) => {
    const o = el('option', { value: v, textContent: label });
    sel.append(o);
    return o;
  };
  opt('map', `Map default (${botCastLabel(mapCast)})`);
  opt('all', 'All characters');
  const groups = el('optgroup', { label: 'Characters' });
  const themes = el('optgroup', { label: 'Named as' });
  for (const c of BOT_CAST_CHOICES) (CHARACTER_GROUPS.some((g) => g.id === c.id) ? groups : themes).append(el('option', { value: c.id, textContent: c.label }));
  sel.append(groups, themes);
  const key = value === undefined ? 'map' : !value.length ? 'all' : value.length === 1 ? value[0]! : value.join('+');
  if (value && value.length > 1) opt(key, botCastLabel(value));
  sel.value = key;
  sel.addEventListener('change', () => {
    const v = sel.value;
    onChange(v === 'map' ? undefined : v === 'all' ? [] : v.split('+'));
  });
  return sel;
}

/**
 * Weather (map/weather.ts): the map's own or one of the host's choices. `value`: undefined the map's own; `mapLabel`:
 * the map's weather in a few words (shown in the "Map" option).
 */
export function weatherSelect(value: string | undefined, mapLabel: string, onChange: (v: string | undefined) => void, id?: string): HTMLSelectElement {
  const sel = el('select', { ...(id ? { id } : {}) });
  sel.append(el('option', { value: 'map', textContent: `Map (${mapLabel})` }));
  for (const w of WEATHER_CHOICES) sel.append(el('option', { value: w, textContent: WEATHER_PRESETS[w].label }));
  sel.value = isWeatherChoice(value) ? value : 'map';
  sel.addEventListener('change', () => onChange(sel.value === 'map' ? undefined : sel.value));
  return sel;
}

/**
 * Weapon set (sim/weaponSets.ts): the map's default or any set, each option's line on hover. `value`: undefined the
 * map's default; `mapSet`: the map's own (its name in the "Map default" option, so the setup shows what it is).
 */
export function weaponSetSelect(value: string | undefined, mapSet: string, onChange: (v: string | undefined) => void, id?: string, disabled?: boolean): HTMLSelectElement {
  const sel = el('select', { ...(id ? { id } : {}), disabled: !!disabled });
  const own = getWeaponSet(mapSet);
  sel.append(el('option', { value: 'map', textContent: `Map default (${own.name})`, title: own.blurb }));
  for (const s of weaponSetList()) sel.append(el('option', { value: s.id, textContent: s.name, title: s.blurb }));
  sel.value = isWeaponSetId(value) ? value : 'map';
  sel.addEventListener('change', () => onChange(sel.value === 'map' ? undefined : sel.value));
  return sel;
}
