import { BOT_LOOKS, BOT_NAME_MAX, BOT_SET_MAX, BOT_SET_NAME_MAX, BOT_SQUAD_MAX, botLookName, botSetInUse, botSetLabel, emptyBotSet, presetBotSet, validateBotSet, type BotEntry, type BotSet, type BotSetPreset } from '@tiletrigger/shared';
import { SHIPPED_PORTRAITS } from './portraitIndex.ts';
import { el } from './setupControls.ts';

/**
 * The Bots window: the host's own bots (shared sim/botSet.ts) as a small
 * table: each bot's look (a portrait picker), name, skill, style, team and
 * squad; add, duplicate, remove and reorder; fill the rest randomly or only
 * these bots; start from a built-in set (maps/botsets/) or one saved in this
 * browser. Opened from Play → Match setup → Bots and from the pause menu's
 * Match section (Bots…), where Apply changes the match live.
 *
 * Keyboard: Tab and the arrows move through it (↑ ↓ keep the column), Esc
 * closes the look picker, then the window; Ctrl+Enter applies. A controller
 * drives it through the pause menu (it is that menu's dialog: d-pad, A, B).
 */

const SAVED_KEY = 'cs.botsets';
/** Most sets kept in this browser (the oldest go first). */
const MAX_SAVED = 30;

export interface SavedBotSet {
  name: string;
  set: BotSet;
}

/** The bot sets saved in this browser, each made valid. */
export function listBotSets(): SavedBotSet[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((x) => {
      const v = typeof x === 'object' && x !== null ? validateBotSet((x as { set?: unknown }).set) : null;
      return v && typeof (x as { name?: unknown }).name === 'string' ? [{ name: (x as { name: string }).name.slice(0, BOT_SET_NAME_MAX), set: v.set }] : [];
    });
  } catch {
    return [];
  }
}

function writeBotSets(list: SavedBotSet[]): boolean {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(-MAX_SAVED)));
    return true;
  } catch {
    return false;
  }
}

/** Save (or overwrite) a set by its name; false when storage is unavailable or full. */
export function saveBotSet(set: BotSet): boolean {
  const list = listBotSets().filter((s) => s.name !== set.name);
  list.push({ name: set.name, set: JSON.parse(JSON.stringify(set)) as BotSet });
  return writeBotSets(list);
}

export function deleteBotSet(name: string): void {
  writeBotSets(listBotSets().filter((s) => s.name !== name));
}

export interface BotManagerOptions {
  /** The set now (null: random bots). */
  set: BotSet | null;
  /** The match's teams (name, colour) in order; empty outside team modes (no Team column). */
  teams: readonly { name: string; color: string }[];
  presets: readonly BotSetPreset[];
  /** The Apply button's words ("Apply" mid-match; "Use these bots" in match setup). */
  applyLabel: string;
  /** A line under the title (what Apply does). */
  note?: string;
  /** How many players the match keeps (bots beyond it don't play), for the summary. */
  players?: number;
  onApply(set: BotSet | null): void;
  onClose(): void;
}

const SKILLS: readonly [string, string][] = [['', 'Match'], ['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']];
const STYLES: readonly [string, string][] = [['', 'Match'], ['mixed', 'Own'], ['arena', 'Arena'], ['tactical', 'Tactical']];
const initials = (name: string) => name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();

/** A look's picture: its shipped portrait, else its initials on a tile. */
function lookFace(look: string | undefined, cls: string): HTMLElement {
  const file = look ? SHIPPED_PORTRAITS[look] : undefined;
  if (file) return el('img', { class: cls, src: `${import.meta.env.BASE_URL}portraits/${file}`, alt: '', loading: 'lazy', draggable: false });
  return el('span', { class: `${cls} bm-face-none`, textContent: look ? initials(botLookName(look)) : '?' });
}

/** Build the window (the caller puts it on the page and removes it on close). */
export function botManager(o: BotManagerOptions): HTMLElement {
  let draft: BotSet = JSON.parse(JSON.stringify(o.set ?? emptyBotSet())) as BotSet;
  const start = JSON.stringify(validateBotSet(draft)!.set);
  let picker: HTMLElement | null = null;
  const root = el('div', { class: 'bot-manager', id: 'bot-manager', role: 'dialog' });
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Bots');
  const panel = el('div', { class: 'bm-panel panel' });
  root.append(panel);
  const status = el('p', { class: 'bm-status', id: 'bm-status' });

  const close = () => {
    root.remove();
    o.onClose();
  };
  const apply = () => {
    const v = validateBotSet(draft)!;
    o.onApply(botSetInUse(v.set) ? v.set : null);
    close();
  };

  /** Redraw, keeping the focus on the same control (by id). */
  const redraw = () => {
    const focus = (document.activeElement as HTMLElement | null)?.id;
    render();
    if (focus) (document.getElementById(focus) as HTMLElement | null)?.focus({ preventScroll: true });
  };
  const edit = (i: number, patch: Partial<BotEntry>, again = false) => {
    const e = { ...draft.entries[i]!, ...patch };
    for (const k of Object.keys(patch) as (keyof BotEntry)[]) if (patch[k] === undefined) delete e[k];
    draft.entries[i] = e;
    if (again) redraw();
    else updateFoot();
  };
  const move = (i: number, j: number) => {
    if (j < 0 || j >= draft.entries.length) return;
    const l = draft.entries;
    [l[i], l[j]] = [l[j]!, l[i]!];
    redraw();
  };
  const freeName = (base: string) => {
    const used = new Set(draft.entries.map((e) => e.name.toLowerCase()));
    if (!used.has(base.toLowerCase())) return base;
    for (let n = 2; ; n++) {
      const name = `${base.slice(0, BOT_NAME_MAX - 3)} ${n}`;
      if (!used.has(name.toLowerCase())) return name;
    }
  };

  /** The look picker: Random and every built-in look, as portraits. */
  const openPicker = (i: number, anchor: HTMLElement) => {
    picker?.remove();
    const current = draft.entries[i]?.look;
    const grid = el('div', { class: 'bm-picker', id: 'bm-picker', role: 'listbox' });
    grid.setAttribute('aria-label', 'Look');
    const tiles: HTMLButtonElement[] = [];
    for (const l of [{ id: '', name: 'Random' }, ...BOT_LOOKS]) {
      const b = el('button', { type: 'button', class: `bm-tile${(l.id || undefined) === current ? ' on' : ''}`, title: l.name, id: `bm-pick-${l.id.replace(/[^a-z0-9]/gi, '_') || 'random'}` }, l.id ? lookFace(l.id, 'bm-face') : el('span', { class: 'bm-face bm-face-none', textContent: '?' }), el('span', { class: 'bm-tile-name', textContent: l.name }));
      b.dataset.look = l.id;
      b.addEventListener('click', () => {
        closePicker();
        edit(i, { look: l.id || undefined }, true);
        document.getElementById(`bm-look-${i}`)?.focus();
      });
      tiles.push(b);
      grid.append(b);
    }
    grid.addEventListener('keydown', (e) => {
      const at = tiles.indexOf(document.activeElement as HTMLButtonElement);
      if (at < 0) return;
      const cols = Math.max(1, Math.round(grid.clientWidth / Math.max(1, tiles[0]!.offsetWidth + 6)));
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : 0;
      if (!step) return;
      e.preventDefault();
      e.stopPropagation();
      tiles[Math.max(0, Math.min(tiles.length - 1, at + step))]!.focus();
    });
    const back = el('button', { type: 'button', class: 'link', id: 'bm-pick-close', textContent: 'Close' });
    back.dataset.cancel = '';
    back.addEventListener('click', () => {
      closePicker();
      anchor.focus();
    });
    picker = el('div', { class: 'bm-pick-wrap', id: 'bm-pick-wrap' }, el('div', { class: 'bm-pick-head' }, el('b', { textContent: `Look for ${draft.entries[i]?.name ?? 'bot'}` }), el('small', { textContent: 'Arrows move · Enter picks · Esc closes' }), el('span', { class: 'bm-gap' }), back), grid);
    picker.dataset.for = anchor.id;
    panel.append(picker);
    const r = anchor.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    picker.style.top = `${Math.max(8, Math.min(r.bottom - pr.top + 4, pr.height - 330))}px`;
    (tiles.find((t) => (t.dataset.look || undefined) === current) ?? tiles[0]!).focus();
  };
  const closePicker = () => {
    picker?.remove();
    picker = null;
  };

  const foot = el('div', { class: 'bm-sum', id: 'bm-sum' });
  const applyBtn = el('button', { type: 'button', class: 'primary', id: 'bm-apply', textContent: o.applyLabel, title: 'Ctrl+Enter' });
  const updateFoot = () => {
    const v = validateBotSet(draft)!.set;
    const n = v.entries.length;
    const more = o.players !== undefined && n > o.players ? ` · only ${o.players} play (the player count)` : '';
    foot.textContent = n ? `${botSetLabel(v)}${more}` : v.fill === 'only' ? 'No bots: only people play' : 'Random bots, as before';
    applyBtn.disabled = JSON.stringify(v) === start;
  };

  const render = () => {
    closePicker();
    const teams = o.teams;
    // ---- head: the set's name, where it starts from, saved sets
    const name = el('input', { id: 'bm-setname', value: draft.name, maxLength: BOT_SET_NAME_MAX, spellcheck: false, title: 'The set\'s name (saved sets go by it)' });
    name.addEventListener('input', () => ((draft.name = name.value), updateFoot()));
    const from = el('select', { id: 'bm-from', title: 'Replace the list with a built-in set or one you saved' });
    from.append(new Option('Start from…', ''));
    const built = el('optgroup', { label: 'Built-in' });
    for (const p of o.presets) built.append(Object.assign(new Option(`${p.name} (${p.entries.length})`, `p:${p.id}`), { title: p.description }));
    const saved = listBotSets();
    const mine = el('optgroup', { label: 'Saved here' });
    for (const s of saved) mine.append(new Option(`${s.name} (${s.set.entries.length})`, `s:${s.name}`));
    from.append(built, ...(saved.length ? [mine] : []));
    from.addEventListener('change', () => {
      const v = from.value;
      const p = v.startsWith('p:') ? o.presets.find((x) => x.id === v.slice(2)) : undefined;
      const s = v.startsWith('s:') ? saved.find((x) => x.name === v.slice(2)) : undefined;
      if (p) draft = presetBotSet(p);
      else if (s) draft = JSON.parse(JSON.stringify(s.set)) as BotSet;
      else return;
      status.textContent = `Started from ${p?.name ?? s?.name}.`;
      render();
      from.focus();
    });
    const save = el('button', { type: 'button', id: 'bm-save', textContent: 'Save', title: 'Keep this set in this browser under its name' });
    save.addEventListener('click', () => {
      const v = validateBotSet(draft)!.set;
      status.textContent = saveBotSet(v) ? `Saved "${v.name}" in this browser.` : 'Not saved: this browser keeps no data here.';
      redraw();
    });
    const del = el('button', { type: 'button', id: 'bm-delete', class: 'link', textContent: 'Delete saved', disabled: !saved.some((s) => s.name === draft.name), title: 'Forget the saved set of this name' });
    del.addEventListener('click', () => {
      deleteBotSet(draft.name);
      status.textContent = `Deleted the saved "${draft.name}".`;
      redraw();
    });

    // ---- the table
    const head = el('div', { class: `bm-row bm-th${teams.length ? ' teams' : ''}` }, el('span', { textContent: '#' }), el('span', { textContent: 'Look' }), el('span', { textContent: 'Name' }), el('span', { textContent: 'Skill' }), el('span', { textContent: 'Style' }), ...(teams.length ? [el('span', { textContent: 'Team' })] : []), el('span', { textContent: 'Squad' }), el('span', {}));
    const squads = [...new Set(draft.entries.map((e) => e.squad).filter((x): x is string => !!x))];
    const squadList = el('datalist', { id: 'bm-squads' }, ...squads.map((q) => new Option(q)));
    const rows = draft.entries.map((e, i) => {
      const look = el('button', { type: 'button', class: 'bm-look', id: `bm-look-${i}`, title: `Look: ${botLookName(e.look)} (Enter to change)` }, lookFace(e.look, 'bm-face'), el('span', { class: 'bm-look-name', textContent: botLookName(e.look) }));
      look.addEventListener('click', () => openPicker(i, look));
      const nameIn = el('input', { id: `bm-name-${i}`, class: 'bm-name', value: e.name, maxLength: BOT_NAME_MAX, spellcheck: false, placeholder: `Bot ${i + 1}` });
      nameIn.dataset.col = 'name';
      nameIn.addEventListener('input', () => edit(i, { name: nameIn.value }));
      const pick = (id: string, list: readonly [string, string][], value: string | undefined, set: (v: string) => void, col: string, title: string) => {
        const s = el('select', { id, title });
        for (const [v, label] of list) s.append(new Option(label, v, false, v === (value ?? '')));
        s.dataset.col = col;
        s.addEventListener('change', () => set(s.value));
        return s;
      };
      const skill = pick(`bm-skill-${i}`, SKILLS, e.skill, (v) => edit(i, { skill: (v || undefined) as BotEntry['skill'] }), 'skill', 'Skill (Match: the match\'s bot skill)');
      const style = pick(`bm-style-${i}`, STYLES, e.style, (v) => edit(i, { style: (v || undefined) as BotEntry['style'] }), 'style', 'Style (Match: the match\'s; Own: the character\'s own way)');
      const team = teams.length
        ? [pick(`bm-team-${i}`, [['', 'Auto'], ...teams.map((t, j) => [String(j), t.name] as [string, string])], e.team !== undefined && e.team < teams.length ? String(e.team) : '', (v) => edit(i, { team: v === '' ? undefined : Number(v) }, true), 'team', 'Team (Auto: wherever the match needs a player)')]
        : [];
      if (teams.length && e.team !== undefined && teams[e.team]) team[0]!.style.borderLeft = `3px solid ${teams[e.team]!.color}`;
      const squad = el('input', { id: `bm-squad-${i}`, class: 'bm-squad', value: e.squad ?? '', maxLength: BOT_SQUAD_MAX, spellcheck: false, placeholder: '—', title: 'Squad: bots with the same squad on one side stick together and follow the first of them' });
      squad.setAttribute('list', 'bm-squads');
      squad.dataset.col = 'squad';
      squad.addEventListener('input', () => edit(i, { squad: squad.value.trim() || undefined }));
      squad.addEventListener('change', () => redraw());
      const act = (id: string, text: string, title: string, disabled: boolean, fn: () => void) => {
        const b = el('button', { type: 'button', id: `bm-${id}-${i}`, class: 'bm-act', textContent: text, title, disabled });
        b.addEventListener('click', fn);
        return b;
      };
      return el(
        'div',
        { class: `bm-row${teams.length ? ' teams' : ''}`, id: `bm-row-${i}` },
        el('span', { class: 'bm-num', textContent: String(i + 1) }),
        look,
        nameIn,
        skill,
        style,
        ...team,
        squad,
        el(
          'span',
          { class: 'bm-acts' },
          act('up', '↑', 'Move up (earlier bots join first)', i === 0, () => move(i, i - 1)),
          act('down', '↓', 'Move down', i === draft.entries.length - 1, () => move(i, i + 1)),
          act('dup', '⧉', 'Duplicate', draft.entries.length >= BOT_SET_MAX, () => {
            draft.entries.splice(i + 1, 0, { ...e, name: freeName(e.name) });
            redraw();
            document.getElementById(`bm-name-${i + 1}`)?.focus();
          }),
          act('del', '✕', 'Remove', false, () => {
            draft.entries.splice(i, 1);
            redraw();
            (document.getElementById(`bm-del-${Math.min(i, draft.entries.length - 1)}`) ?? document.getElementById('bm-add'))?.focus();
          }),
        ),
      );
    });
    const table = el('div', { class: 'bm-table', id: 'bm-table' }, head, ...rows, squadList);
    if (!rows.length) table.append(el('p', { class: 'bm-empty', textContent: 'No bots of your own yet: Add bot, or start from a built-in set. Without any, the match fills with random bots.' }));
    const add = el('button', { type: 'button', id: 'bm-add', textContent: '+ Add bot', disabled: draft.entries.length >= BOT_SET_MAX, title: `Up to ${BOT_SET_MAX}` });
    add.addEventListener('click', () => {
      draft.entries.push({ name: freeName(`Bot ${draft.entries.length + 1}`) });
      redraw();
      document.getElementById(`bm-name-${draft.entries.length - 1}`)?.focus();
    });
    const clear = el('button', { type: 'button', id: 'bm-clear', class: 'link', textContent: 'Clear list', disabled: !draft.entries.length });
    clear.addEventListener('click', () => {
      draft.entries = [];
      redraw();
      add.focus();
    });
    const fill = (value: BotSet['fill'], text: string, tip: string) => {
      const b = el('button', { type: 'button', id: `bm-fill-${value}`, class: `tab${draft.fill === value ? ' on' : ''}`, textContent: text, title: tip });
      b.setAttribute('aria-pressed', String(draft.fill === value));
      b.addEventListener('click', () => ((draft.fill = value), redraw()));
      return b;
    };
    // Back, top left (as on every screen and window): the same as Cancel.
    const back = el('button', { type: 'button', class: 'back-btn', id: 'bm-back', title: 'Back without applying (Esc)' }, el('span', { textContent: '◀' }), 'Back');
    back.firstElementChild!.setAttribute('aria-hidden', 'true');
    back.addEventListener('click', close);
    const cancel = el('button', { type: 'button', id: 'bm-cancel', textContent: 'Cancel' });
    cancel.dataset.cancel = '';
    cancel.addEventListener('click', close);
    applyBtn.onclick = apply;
    panel.replaceChildren(
      el('div', { class: 'bm-head' }, back, el('h3', { textContent: 'Bots' }), name, from, save, del),
      ...(o.note ? [el('p', { class: 'bm-note', textContent: o.note })] : []),
      table,
      el('div', { class: 'bm-tools' }, add, clear, el('span', { class: 'bm-gap' }), el('div', { class: 'tabs bm-fill' }, fill('random', 'Fill the rest randomly', 'These bots first, then random bots up to the player count'), fill('only', 'Only these bots', 'Just these bots (people still join)'))),
      status,
      el('div', { class: 'bm-foot' }, foot, cancel, applyBtn),
    );
    updateFoot();
  };

  root.addEventListener('keydown', (e) => {
    // The menus behind (the front end, the pause menu) don't see keys meant for this window.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (picker) {
        const look = picker.dataset.for;
        closePicker();
        if (look) document.getElementById(look)?.focus();
        return;
      }
      return close();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!applyBtn.disabled) apply();
      return;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !picker) {
      const t = e.target as HTMLElement;
      if (t.tagName === 'SELECT') return;
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      // In the table: the same column in the next row.
      const row = t.closest('.bm-row');
      const col = t.dataset.col ?? (t.classList.contains('bm-look') ? 'look' : t.classList.contains('bm-act') ? t.id.replace(/-\d+$/, '') : null);
      if (row && col && row.id) {
        const i = Number(row.id.replace('bm-row-', '')) + dir;
        const id = col === 'look' ? `bm-look-${i}` : col.startsWith('bm-') ? `${col}-${i}` : `bm-${col}-${i}`;
        const next = document.getElementById(id);
        if (next) {
          e.preventDefault();
          next.focus();
          return;
        }
      }
      if (t.tagName === 'INPUT' && !row) return;
      const items = [...panel.querySelectorAll<HTMLElement>('button, input, select')].filter((x) => !(x as HTMLButtonElement).disabled && x.offsetParent !== null);
      const at = items.indexOf(t);
      const next = items[at < 0 ? 0 : (at + dir + items.length) % items.length];
      if (next) {
        e.preventDefault();
        next.focus();
        next.scrollIntoView({ block: 'nearest' });
      }
    }
  });
  render();
  requestAnimationFrame(() => (document.getElementById('bm-add') as HTMLElement | null)?.focus());
  return root;
}
