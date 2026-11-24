import {
  DEFAULT_GROUND_THEME,
  coreMaterials,
  coreThemes,
  fitBounds,
  groundThemes,
  matchingGroundTheme,
  MODE_LABELS,
  newMapDocument,
  newTerrain,
  setupFamily,
  withMainMode,
  type BoundaryStyle,
  type GameMode,
  type GroundThemeDefinition,
  type MapDocument,
} from '@tiletrigger/shared';
import { onPadPress, PAD } from '../inputMode.ts';
import { themeStylePacks } from './paletteCatalog.ts';

/**
 * New map's setup (owner, 2026-11-24): one short screen, every choice pre-filled, Create straight away for today's
 * blank map, and everything changeable later in Map properties. Besides the size and Ground theme (or a "Start from"
 * layout) it asks the Structure theme, the mode (and the modes also offered), the players (best, up to) and the
 * boundary. Map properties' own lists and logic are used here (the mode lists, the boundary styles, Fit to map), so
 * the two never disagree.
 */

/** A new map starts on open ground this size (m); New offers the others, and the sky (0: no terrain). */
export const STARTER_TERRAIN = 160;

export const NEW_MAP_SIZES: readonly [number, string, string][] = [
  [96, 'Skirmish', '96 m · a few players'],
  [160, 'Medium', '160 m · most modes'],
  [240, 'Large', '240 m · vehicles'],
  [320, 'Huge', '320 m · big battles'],
  [0, 'Sky map', 'No terrain · floating'],
];

/** A Ground theme as a menu shows it: its name and its base ground ("Quarry · Gravel"). */
export const groundThemeLabel = (g: GroundThemeDefinition): string => `${g.displayName} · ${coreMaterials.get(g.base)?.displayName ?? g.base}`;

/** A blank map: the starter room and spawn, on open ground of `size` metres (just under the floors, all the base of `groundTheme`) or none. */
export function starterMap(size: number | null, groundTheme: string = DEFAULT_GROUND_THEME): MapDocument {
  const doc = newMapDocument('Untitled Map');
  return size ? { ...doc, terrain: { ...newTerrain(size, 2, [0, 0], groundTheme), baseY: -0.15 } } : doc;
}

/** The main modes Map properties' Mode offers (its pick, what TEST plays). */
export const MAIN_MODES: readonly (readonly [GameMode, string])[] = [
  ['core.deathmatch', 'Deathmatch'],
  ['core.tdm', 'Team Deathmatch'],
  ['core.ctf', 'Capture the Flag'],
  ['core.koth', 'King of the Hill'],
  ['core.elim', 'Elimination'],
  ['core.breakthrough', 'Breakthrough'],
  ['core.coop', 'Co-op mission'],
  ['core.zombies', 'Zombies'],
  ['core.discs', 'Disc Arena'],
];

/** The modes Map properties' "Also offered" ticks (besides the main one; the rest follow from a map's pieces). */
export const ALSO_MODES: readonly (readonly [GameMode, string])[] = [
  ['core.deathmatch', 'Deathmatch'],
  ['core.tdm', 'Team Deathmatch'],
  ['core.coop', 'Co-op mission'],
];

/** Map properties' boundary styles ('' none: the terrain's edge is the playable boundary). */
export const BOUNDARY_CHOICES: readonly (readonly ['' | BoundaryStyle, string])[] = [
  ['', 'None'],
  ['invisible', 'Invisible walls'],
  ['wall', 'Solid walls'],
  ['fence', 'Tall fence'],
];

/** A boundary's height when it is set (Map properties' too). */
export const BOUNDARY_HEIGHT = 8;
/** Fit to map's margin round what's built (m). */
export const BOUNDARY_MARGIN = 4;

/** What New map asks. */
export interface NewMapSetup {
  /** Open ground this many metres across, or 0 for the sky (no terrain). */
  size: number;
  ground: string;
  theme: string;
  mode: GameMode;
  /** Modes also offered (ALSO_MODES' ids; the main one is left out). */
  also: GameMode[];
  /** Players it plays best with (Map properties' Max players: the recommended most). */
  best: number;
  /** The most it takes in its main mode (Map properties' Players by mode); null: automatic, from its spawns and size. */
  upTo: number | null;
  boundary: '' | BoundaryStyle;
}

/** New map's choices as it opens: what a blank map was before the setup screen (Create straight away makes that). */
export function newMapDefaults(): NewMapSetup {
  const blank = newMapDocument();
  return {
    size: STARTER_TERRAIN,
    ground: DEFAULT_GROUND_THEME,
    theme: blank.classicStructure.theme,
    mode: (blank.metadata.supportedModes[0] ?? 'core.deathmatch') as GameMode,
    also: [],
    best: blank.metadata.recommendedPlayers.max,
    upTo: null,
    boundary: '',
  };
}

/**
 * The size New map suggests for a player count (the most, else the best): docs/MAP_BUDGETS.md, "Suggested sizes by
 * player count" (arena or skirmish 2-6 players, 40-100 m; standard 4-12, 100-200 m or a 160 m terrain; large 8-24,
 * 200-400 m), with Huge for more than that (New map's "big battles"). Never the sky: that is a kind of map, not a size.
 */
export function suggestedSize(players: number): number {
  const at = players <= 6 ? 96 : players <= 12 ? 160 : players <= 24 ? 240 : 320;
  return NEW_MAP_SIZES.some(([v]) => v === at) ? at : STARTER_TERRAIN;
}

/** The players a size suggestion counts: the most when set, else the best. */
export const setupPlayers = (s: Pick<NewMapSetup, 'best' | 'upTo'>): number => s.upTo ?? s.best;

/** Whether a mode takes a squad (co-op, zombies): one number, the squad, which is both its best and its most. */
export const squadMode = (mode: GameMode): boolean => setupFamily(mode) === 'squad';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

/** The modes a setup offers, main first (Map properties' withMainMode: no removed mode). */
export function setupModes(s: Pick<NewMapSetup, 'mode' | 'also'>): string[] {
  return withMainMode([s.mode, ...s.also.filter((m) => m !== s.mode)], s.mode);
}

/** The boundary a style gives this map: Fit to map's rectangle round what's built, or none. */
export function setupBounds(doc: MapDocument, style: '' | BoundaryStyle): MapDocument['bounds'] {
  if (!style) return null;
  const fit = fitBounds(doc, BOUNDARY_MARGIN);
  return fit ? { min: fit.min, max: fit.max, style, height: BOUNDARY_HEIGHT } : null;
}

/** The players part of a setup on a map: its recommended players, and the main mode's own caps when "up to" is set. */
function withPlayers(doc: MapDocument, s: Pick<NewMapSetup, 'best' | 'upTo' | 'mode'>): MapDocument {
  const best = clamp(s.best, 1, 96);
  const metadata = { ...doc.metadata, recommendedPlayers: { min: Math.min(doc.metadata.recommendedPlayers.min, best), max: best } };
  if (s.upTo !== null && !squadMode(s.mode)) {
    const max = clamp(s.upTo, best, 128);
    metadata.playerCaps = { ...(doc.metadata.playerCaps ?? {}), [s.mode]: { recommended: Math.min(best, max), max } };
  }
  return { ...doc, metadata };
}

/** A new blank map from New map's choices (the defaults give exactly the blank map New made before). */
export function newMapFromSetup(s: NewMapSetup): MapDocument {
  const blank = starterMap(s.size || null, s.ground);
  const themed: MapDocument = coreThemes.get(s.theme) ? { ...blank, classicStructure: { ...blank.classicStructure, theme: s.theme } } : blank;
  const moded: MapDocument = { ...themed, metadata: { ...themed.metadata, supportedModes: setupModes(s) } };
  const doc = withPlayers(moded, s);
  return { ...doc, bounds: setupBounds(doc, s.boundary) };
}

/** The Structure theme a layout is built in to take yours: the plain one a blank map starts in. */
export const PLAIN_THEME = 'core.prototype';

/** What a "Start from" layout sets itself (its own wins there; the setup screen shows its values). */
export interface LayoutOwns {
  /** Its Structure theme (a layout built in the plain theme takes the one picked). */
  theme: boolean;
  /** Its modes and players: always (it is laid out for them). */
  modes: true;
  /** Its boundary (a layout without one takes the one picked, fitted round it). */
  boundary: boolean;
}

export function layoutOwns(layout: MapDocument): LayoutOwns {
  return { theme: layout.classicStructure.theme !== PLAIN_THEME, modes: true, boundary: !!layout.bounds };
}

/** A layout as the new map, with the choices it doesn't set itself (the theme, the boundary) taken from the screen. */
export function layoutWithSetup(layout: MapDocument, s: Pick<NewMapSetup, 'theme' | 'boundary'>): MapDocument {
  const owns = layoutOwns(layout);
  const themed = !owns.theme && coreThemes.get(s.theme) ? { ...layout, classicStructure: { ...layout.classicStructure, theme: s.theme } } : layout;
  return owns.boundary ? themed : { ...themed, bounds: setupBounds(themed, s.boundary) };
}

/** The Style Packs a theme's palette puts first ("Military Compound"), for the theme's note. */
export function themePackNames(theme: string): string[] {
  return themeStylePacks(theme).map((p) => p.displayName);
}

// ---------------------------------------------------------------- the screen

/** A select's options. */
function fill(sel: HTMLSelectElement, options: readonly (readonly [string, string])[], value: string): void {
  sel.replaceChildren(...options.map(([v, label]) => new Option(label, v, v === value, v === value)));
}

/** The arrow keys move a radio group's pick (its buttons) like a native radio group's; Home and End go to its ends. */
export function radioArrows(group: HTMLElement): void {
  group.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step && e.key !== 'Home' && e.key !== 'End') return;
    const items = [...group.querySelectorAll<HTMLButtonElement>('button')].filter((b) => !b.disabled);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? items[0] : e.key === 'End' ? items[items.length - 1] : items[(at + step + items.length) % items.length];
    next?.focus();
    next?.click();
  });
}

/**
 * A controller in a MapMaker dialog while it is open: the d-pad or left stick move through its controls (left and right
 * step a list's choice or a number), A presses, B cancels. Returns the unsubscribe (on close).
 */
export function padDialog(dialog: HTMLDialogElement, cancel: () => void): () => void {
  const focusables = () => [...dialog.querySelectorAll<HTMLElement>('button, input, select')].filter((e) => !(e as HTMLButtonElement).disabled && e.offsetParent !== null);
  const move = (dir: 1 | -1) => {
    const items = focusables();
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = items[at < 0 ? 0 : (at + dir + items.length) % items.length]!;
    next.focus();
    next.scrollIntoView({ block: 'nearest' });
  };
  const off = onPadPress((b) => {
    if (!dialog.open) return;
    const f = document.activeElement as HTMLElement | null;
    const here = f && dialog.contains(f) ? f : null;
    if (b === PAD.b) return cancel();
    if (b === PAD.a) {
      if (here instanceof HTMLInputElement && here.type === 'checkbox') return here.click();
      return here?.click();
    }
    if (b === PAD.up || b === PAD.down) return move(b === PAD.down ? 1 : -1);
    if (b === PAD.left || b === PAD.right) {
      const dir = b === PAD.right ? 1 : -1;
      if (here instanceof HTMLSelectElement) {
        const i = here.selectedIndex + dir;
        if (i >= 0 && i < here.options.length) {
          here.selectedIndex = i;
          here.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
      if (here instanceof HTMLInputElement && here.type === 'number') {
        if (dir > 0) here.stepUp();
        else here.stepDown();
        here.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      // In a row of choices (sizes, layouts) left and right move along it; elsewhere through the controls.
      if (here?.closest('[role="radiogroup"]')) return here.dispatchEvent(new KeyboardEvent('keydown', { key: dir > 0 ? 'ArrowRight' : 'ArrowLeft', bubbles: true }));
      return move(dir);
    }
  });
  return off;
}

/** What the setup fields hold while a layout is picked: its own values, shown (and locked) where it sets them. */
export interface SetupFields {
  /** The choices as they stand. */
  read(): NewMapSetup;
  /** A layout picked (its map) or none: the rows it sets show its values, locked and marked "Layout's". */
  showLayout(layout: MapDocument | null): void;
  /** A size was picked by hand: players no longer move it. */
  touchSize(): void;
}

/**
 * The setup rows of the New map dialog (index.html #ed-new-setup): fills them with the defaults and keeps them in
 * step (the theme's Ground theme match and Style Packs, the mode's players, the suggested size). `pickSize` picks a
 * size in the dialog's size row; `size` reads it.
 */
export function setupFields(dialog: HTMLElement, o: { size: () => number; pickSize: (v: number) => void; suggest: (v: number) => void }): SetupFields {
  const d = newMapDefaults();
  // Each opening starts afresh: the controls are replaced by bare copies (no listeners from the last time).
  const $ = <T extends HTMLElement>(id: string) => {
    const old = dialog.querySelector<T>(`#${id}`)!;
    if (!(old instanceof HTMLSelectElement || old instanceof HTMLInputElement)) return old;
    const fresh = old.cloneNode(false) as T;
    old.replaceWith(fresh);
    return fresh;
  };
  const theme = $<HTMLSelectElement>('ed-new-theme');
  const ground = $<HTMLSelectElement>('ed-new-ground');
  const mode = $<HTMLSelectElement>('ed-new-mode');
  const also = $<HTMLElement>('ed-new-also');
  const best = $<HTMLInputElement>('ed-new-best');
  const upTo = $<HTMLInputElement>('ed-new-upto');
  const boundary = $<HTMLSelectElement>('ed-new-boundary');
  const themeNote = $<HTMLElement>('ed-new-theme-note');
  const playersNote = $<HTMLElement>('ed-new-players-note');
  const boundaryNote = $<HTMLElement>('ed-new-boundary-note');
  let groundTouched = false;
  let sizeTouched = false;
  let layout: MapDocument | null = null;

  fill(theme, coreThemes.all().map((t) => [t.id, t.displayName] as const), d.theme);
  fill(ground, groundThemes.all().map((g) => [g.id, groundThemeLabel(g)] as const), d.ground);
  fill(mode, MAIN_MODES, d.mode);
  fill(boundary, BOUNDARY_CHOICES.map(([v, label]) => [v, v ? label : 'None (the terrain edge)'] as const), d.boundary);
  best.value = String(d.best);
  upTo.value = '';

  const ticks = () => [...also.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
  const renderAlso = (main: string, on: readonly string[]) => {
    also.replaceChildren(
      ...ALSO_MODES.filter(([id]) => id !== main).map(([id, label]) => {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.dataset.mode = id;
        box.checked = on.includes(id);
        const lab = document.createElement('label');
        lab.append(box, document.createTextNode(label));
        return lab;
      }),
    );
  };
  renderAlso(d.mode, d.also);

  const read = (): NewMapSetup => {
    const m = mode.value as GameMode;
    const b = clamp(Number(best.value) || d.best, 1, 96);
    const u = upTo.value.trim() === '' || squadMode(m) ? null : clamp(Number(upTo.value) || b, b, 128);
    return {
      size: o.size(),
      ground: ground.value,
      theme: theme.value,
      mode: m,
      also: ticks().filter((t) => t.checked).map((t) => t.dataset.mode as GameMode),
      best: b,
      upTo: u,
      boundary: boundary.value as NewMapSetup['boundary'],
    };
  };

  const note = (el: HTMLElement, s: string) => (el.textContent = s);
  const themeLine = () => {
    if (layout && layoutOwns(layout).theme) return note(themeNote, "The layout's own theme.");
    const packs = themePackNames(theme.value);
    const first = packs.length ? ` The palette puts the ${packs.slice(0, 2).join(' and ')} pack${packs.length > 1 ? 's' : ''} first.` : '';
    note(themeNote, `Pick it now: changing the theme later repaints every wall, floor and roof that follows it (Map properties asks first).${first}${layout ? ' The layout is built plain: it takes this theme.' : ''}`);
  };
  const playersLine = () => {
    const s = read();
    upTo.closest('.ed-new-upto')?.toggleAttribute('hidden', squadMode(s.mode));
    const bestLabel = best.previousElementSibling;
    if (bestLabel) bestLabel.textContent = squadMode(s.mode) ? 'Squad of' : 'Best with';
    if (layout) return note(playersNote, `The layout's own: ${layout.metadata.recommendedPlayers.max} players${layout.metadata.supportedModes.length ? `, ${layout.metadata.supportedModes.map((m) => MODE_LABELS[m as GameMode] ?? m).join(', ')}` : ''}.`);
    const size = suggestedSize(setupPlayers(s));
    const label = NEW_MAP_SIZES.find(([v]) => v === size)?.[1] ?? `${size} m`;
    note(playersNote, `${squadMode(s.mode) ? 'The squad that plays it.' : s.upTo === null ? 'Up to: automatic, from its spawn points and size.' : `Up to ${s.upTo} in ${MODE_LABELS[s.mode]}.`} Suggests ${label} (${size} m).`);
    o.suggest(size);
  };
  const boundaryLine = () => {
    if (layout && layoutOwns(layout).boundary) return note(boundaryNote, "The layout's own boundary.");
    note(
      boundaryNote,
      boundary.value
        ? `It starts fitted round ${layout ? 'the layout' : o.size() ? 'the ground' : 'the starting room'}, with the orange outline from the start; Map properties → Boundary moves it or fits it again.`
        : 'No walls: the terrain edge is the playable boundary (the orange outline).',
    );
  };
  // Players move the size until one is picked by hand.
  const suggestSize = () => {
    if (layout || sizeTouched || !o.size()) return;
    o.pickSize(suggestedSize(setupPlayers(read())));
  };

  theme.addEventListener('change', () => {
    if (!groundTouched) ground.value = matchingGroundTheme(theme.value);
    themeLine();
  });
  ground.addEventListener('change', () => (groundTouched = true));
  mode.addEventListener('change', () => {
    renderAlso(mode.value, ticks().filter((t) => t.checked).map((t) => t.dataset.mode!));
    playersLine();
    suggestSize();
  });
  for (const input of [best, upTo]) {
    input.addEventListener('change', () => {
      const s = read();
      best.value = String(s.best);
      upTo.value = s.upTo === null ? '' : String(s.upTo);
      playersLine();
      suggestSize();
    });
  }
  boundary.addEventListener('change', boundaryLine);

  // The choices made before a layout was picked, back when it is unpicked.
  let mine: NewMapSetup | null = null;
  const showLayout = (l: MapDocument | null) => {
    if (l && !layout) mine = read();
    if (!l && layout && mine) {
      theme.value = mine.theme;
      mode.value = mine.mode;
      renderAlso(mine.mode, mine.also);
      best.value = String(mine.best);
      upTo.value = mine.upTo === null ? '' : String(mine.upTo);
      boundary.value = mine.boundary;
      mine = null;
    }
    layout = l;
    const owns = l ? layoutOwns(l) : null;
    const lock = (el: HTMLElement, on: boolean) => {
      el.closest('.ed-dialog-field')?.classList.toggle('layout', on);
      if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) el.disabled = on;
    };
    if (l && owns) {
      if (owns.theme) theme.value = l.classicStructure.theme;
      mode.value = l.metadata.supportedModes[0] ?? d.mode;
      renderAlso(mode.value, l.metadata.supportedModes.slice(1));
      best.value = String(l.metadata.recommendedPlayers.max);
      const own = l.metadata.playerCaps?.[mode.value];
      upTo.value = own ? String(own.max) : '';
      if (owns.boundary) boundary.value = l.bounds?.style ?? '';
    }
    lock(theme, !!owns?.theme);
    lock(mode, !!l);
    for (const t of ticks()) t.disabled = !!l;
    also.closest('.ed-dialog-field')?.classList.toggle('layout', !!l);
    lock(best, !!l);
    lock(upTo, !!l);
    lock(boundary, !!owns?.boundary);
    themeLine();
    playersLine();
    boundaryLine();
  };

  themeLine();
  playersLine();
  boundaryLine();
  return {
    read,
    showLayout,
    touchSize: () => {
      sizeTouched = true;
      boundaryLine();
    },
  };
}
