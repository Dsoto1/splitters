import { DEFAULT_TEAMS, MAX_PLAYER_SLOTS, MAX_TEAMS, MAX_TEAM_SIZE, type SetupNote } from '@tiletrigger/shared';

/**
 * Match setup controls shared by Play → match setup and the host's pause
 * menu (Host tab), so a change mid-match looks and works like one before it:
 * steppers you can type into, choice tabs whose unavailable options are
 * greyed with the reason, setting rows (marked when they wait for a restart),
 * folds, setup notes and the team editor.
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

export interface RowOptions {
  /** Takes effect when the match restarts (mid-match). */
  restart?: boolean;
  /** Changes now, mid-match. */
  live?: boolean;
  /** Can't be used here, and why. */
  disabled?: string | null;
}

/** A setting: its name with an (i), a restart / live tag when it applies, then the control. */
export function settingRow(label: string, tip: string | null, control: HTMLElement, o: RowOptions = {}): HTMLElement {
  const tags: HTMLElement[] = [];
  if (o.restart) tags.push(el('span', { class: 'when-tag restart', textContent: 'On restart', title: 'Takes effect when the match restarts' }));
  if (o.live) tags.push(el('span', { class: 'when-tag live', textContent: 'Live', title: 'Changes right away, mid-match' }));
  const row = el('div', { class: `row${o.disabled ? ' off' : ''}` }, el('span', { class: 'row-label' }, label, ...(tip ? [infoTip(tip)] : []), ...tags), control);
  why(row, o.disabled);
  return row;
}

/** A section folded away until opened; `badge`: a short state ("2 changed", "standard"). */
export function fold(o: { id: string; title: string; badge?: string; open: boolean; onToggle: (open: boolean) => void; extra?: HTMLElement[] }, ...children: HTMLElement[]): HTMLDetailsElement {
  const d = el('details', { class: 'setup-more', id: o.id }) as HTMLDetailsElement;
  d.open = o.open;
  d.addEventListener('toggle', () => o.onToggle(d.open));
  d.append(el('summary', {}, el('span', { textContent: o.title }), ...(o.badge ? [el('small', { textContent: o.badge })] : []), ...(o.extra ?? [])), ...children);
  return d;
}

/** Setup warnings and hints, each a line (warnings first). */
export function noteList(notes: readonly SetupNote[], id = 'setup-notes'): HTMLElement {
  const sorted = [...notes].sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));
  return el('ul', { class: 'setup-notes', id }, ...sorted.map((n) => el('li', { class: n.level, textContent: n.text })));
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
  onChange: (next: TeamEditorState) => void;
}

/** Bot pips drawn per team before "+N". */
const PIPS = 10;

/**
 * Teams, freely: how many (2–8), and each one's size, name and colour (from
 * the palette). Drag a bot pip to another team to move a bot there, or drag
 * yourself (or press Join) to play on that team; any total up to `maxPlayers`.
 */
export function teamEditor(o: TeamEditorOptions): HTMLElement {
  const s = o.state;
  const total = s.sizes.reduce((a, b) => a + b, 0);
  const cap = o.maxPlayers ?? MAX_PLAYER_SLOTS;
  const emit = (patch: Partial<TeamEditorState>) => o.onChange({ ...s, sizes: [...s.sizes], names: [...s.names], colors: [...s.colors], ...patch });
  const setSize = (i: number, v: number) => {
    const sizes = [...s.sizes];
    const room = cap - (total - sizes[i]!);
    sizes[i] = Math.max(1, Math.min(v, room, MAX_TEAM_SIZE));
    emit({ sizes });
  };
  const moveBot = (from: number, to: number) => {
    if (from === to) return;
    const sizes = [...s.sizes];
    const floor = Math.max(1, (o.people?.[from] ?? 0) + (s.you === from ? 1 : 0));
    if (sizes[from]! <= floor || sizes[to]! >= MAX_TEAM_SIZE) return;
    sizes[from]!--;
    sizes[to]!++;
    emit({ sizes });
  };
  const count = stepper({
    value: s.sizes.length,
    min: 2,
    max: MAX_TEAMS,
    id: `${o.id}-team-count`,
    label: 'teams',
    disabled: o.countLocked,
    onChange: (n) => {
      const sizes = s.sizes.slice(0, n);
      let left = cap - sizes.reduce((a, b) => a + b, 0);
      while (sizes.length < n) {
        const add = Math.max(1, Math.min(left, s.sizes[s.sizes.length - 1] ?? 2));
        sizes.push(add);
        left -= add;
      }
      emit({ sizes, you: s.you !== null && s.you >= n ? n - 1 : s.you });
    },
  });
  const head = el('div', { class: 'team-head' }, el('span', { class: 'row-label', textContent: 'Teams' }), count, el('span', { class: 'team-total', id: `${o.id}-team-total`, textContent: `${s.sizes.join('v')} · ${total} players` }));
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
    const name = el('input', { class: 'team-name', value: s.names[i] ?? '', maxLength: 24, title: o.namesLocked ?? 'Team name', disabled: !!o.namesLocked, id: `${o.id}-team-name-${i}` });
    name.setAttribute('aria-label', `Team ${i + 1} name`);
    name.addEventListener('change', () => {
      const names = [...s.names];
      names[i] = name.value.trim();
      emit({ names });
    });
    const people = o.people?.[i] ?? 0;
    const min = Math.max(1, people + (s.you === i ? 1 : 0));
    const sizeStep = stepper({ value: size, min, max: Math.min(MAX_TEAM_SIZE, cap - (total - size)), id: `${o.id}-team-size-${i}`, label: `team ${i + 1} size`, onChange: (v) => setSize(i, v) });
    // Roster: you, people, then a pip per bot (drag one to another team).
    const roster = el('div', { class: 'roster' });
    if (s.you === i && o.youLabel) {
      const me = el('span', { class: 'chip you', textContent: o.youLabel, draggable: true, title: 'Drag to another team to play on it' });
      me.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/plain', 'you'));
      roster.append(me);
    }
    if (people) roster.append(el('span', { class: 'chip people', textContent: `${people} ${people === 1 ? 'person' : 'people'}` }));
    const bots = Math.max(0, size - people - (s.you === i ? 1 : 0));
    for (let b = 0; b < Math.min(bots, PIPS); b++) {
      const pip = el('span', { class: 'pip', draggable: true, title: 'A bot: drag it to another team' });
      pip.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/plain', `bot:${i}`));
      roster.append(pip);
    }
    if (bots > PIPS) roster.append(el('span', { class: 'more', textContent: `+${bots - PIPS}` }));
    roster.append(el('span', { class: 'bots-n', textContent: `${bots} bot${bots === 1 ? '' : 's'}` }));
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
    const tail: HTMLElement[] = [];
    if (o.youLabel && s.you !== i) {
      const join = el('button', { type: 'button', class: 'team-join link', textContent: 'Join', title: 'Play on this team' });
      join.dataset.team = String(i);
      join.addEventListener('click', () => emit({ you: i }));
      tail.push(join);
    }
    card.append(el('div', { class: 'team-top' }, swatch, name), el('div', { class: 'team-mid' }, sizeStep, ...tail), roster);
    cards.append(card);
  });
  return el('div', { class: 'team-editor' }, head, cards);
}
