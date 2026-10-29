import {
  CHARACTER_PROFILES,
  CORE_LOOKS,
  type BotProfile,
  NPC_LOOKS,
  NPC_ROLE_SPECS,
  npcLookRole,
  validLookId,
  DEFAULT_LOOK,
  DEFAULT_RULES,
  GAME_MODES,
  MODE_LABELS,
  isTeamMode,
  LOOK_BIOS,
  MAX_PLAYER_SLOTS,
  TEAM_PRESETS,
  SETUP_PRESETS,
  BIG_MATCH,
  HUGE_MATCH,
  isCoopMode,
  isTwoTeamMode,
  modeOptions,
  normalizeSetup,
  presetPlayers,
  rulesFromSetup,
  setupNotes,
  setupPlayers,
  setupTeams,
  type MatchSetup,
  type TeamAssign,
  getLook,
  mapTeams,
  teamLayoutLabel,
  getWeapon,
  partInfo,
  type GameMode,
  type LobbyListing,
  type MapDocument,
  type MatchRules,
  mapInspiration,
  REGIONS,
  regionLabel,
  usernameProblem,
  type Region,
} from '@tiletrigger/shared';
import { loadMousePrefs, saveMousePrefs } from '../game/input.ts';
import { loadRelay, saveRelay } from '../game/relay.ts';
import { currentAccount, signIn, signInAvailable, signOut } from '../account.ts';
import { cachedProfile, checkUsername, loadProfile, myRegion, saveProfile, setRegion } from '../profile.ts';
import { installTooltips } from './tooltip.ts';
import { FRAME_CAPS, GRAPHICS_QUALITIES, RENDER_SCALES, RENDER_SCALE_LABELS, currentFrameCap, loadGraphicsQuality, loadRenderScale, saveFrameCap, saveGraphicsQuality, saveRenderScale, type FrameCap, type GraphicsQuality, type RenderScale } from '../game/graphicsSettings.ts';
import { fetchGames, hubSetting, saveHub } from '../game/hub.ts';
import type { AudioSystem } from '../audio/audio.ts';
import { listCustomLooks } from '../designer/customLooks.ts';
import { mapThumbs, thumbPair, type MapThumbs } from './mapThumbs.ts';
import type { MapMeta } from '../mapIndex.ts';
import { choice, fold as foldEl, infoTip, noteList, settingRow, stepper, teamEditor, type ChoiceOption } from './setupControls.ts';
import { deleteSetup, lastSetup, listSetups, saveSetupAs, setLastSetup } from './savedSetups.ts';
import type { MenuScene } from './menuScene.ts';
import { weaponIcon } from './weaponIcons.ts';
import { ALLY_MARKER_COLOURS, CROSSHAIR_COLOURS, CROSSHAIR_STYLES, HITMARKER_STYLES, markerSetting, saveMarkers, crosshairSetting, hitmarkerSetting, saveCrosshair, saveHitmarker, type HitmarkerStyle } from '../game/crosshair.ts';
import type { PortraitRenderer } from './portraits.ts';
import { bindFullscreenButton } from '../fullscreen.ts';
import { PLAYLISTS } from '../playlists.ts';
import { MODE_SHORT, modeIcon } from './modeIcons.ts';

/** The "Inspired by …" line for a homage map (nothing for our own designs). */
function inspired(key: string): HTMLElement[] {
  const from = mapInspiration(key);
  return from ? [el('em', { class: 'inspired', textContent: `Inspired by ${from}` })] : [];
}

/** A built-in map the Arcade offers. */
/** A map card's picture (on top) and plan (beside the name): built-in maps have an automatic picture, your own MapMaker maps don't. */
function cardThumbs(m: ArcadeMap): MapThumbs {
  const t = mapThumbs(m, !m.group);
  t.pic.classList.add('card-pic');
  t.plan.classList.add('card-plan');
  return t;
}

/**
 * A map card: the picture on top, then the name and the top-down plan. Every
 * card is the same size (the name and nothing else), so the grid stays
 * even; the map's blurb, modes and details live in the panel beside the list.
 * `note` is a short tag over the picture ("Playing now").
 */
function mapCard(m: ArcadeMap, on: boolean, note?: string, fav?: { on: boolean; toggle: () => boolean }): { card: HTMLButtonElement; draw: () => void } {
  const pic = cardThumbs(m);
  // One row of short mode tags; more than fit become "+N" (the card never grows).
  const shown = m.modes.slice(0, 3);
  const tags = el('span', { class: 'card-modes' }, ...shown.map((x) => el('i', { textContent: MODE_SHORT[x] })), ...(m.modes.length > shown.length ? [el('i', { class: 'more', textContent: `+${m.modes.length - shown.length}`, title: m.modes.slice(3).map((x) => MODE_LABEL[x]).join(', ') })] : []));
  const card = el('button', { class: `map-card${on ? ' on' : ''}`, title: m.metadata.name }, pic.pic, el('div', { class: 'meta' }, el('span', { class: 'meta-text' }, el('b', { textContent: m.metadata.name }), tags), pic.plan));
  if (note) card.append(el('span', { class: 'card-note', textContent: note }));
  if (fav) {
    // A span, not a button: buttons can't hold buttons.
    const star = el('span', { class: `card-fav${fav.on ? ' on' : ''}`, role: 'button', tabIndex: 0, title: 'Favourite', textContent: fav.on ? '★' : '☆' });
    star.setAttribute('aria-pressed', String(fav.on));
    const flip = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      const now = fav.toggle();
      star.classList.toggle('on', now);
      star.textContent = now ? '★' : '☆';
      star.setAttribute('aria-pressed', String(now));
    };
    star.addEventListener('click', flip);
    star.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && flip(e));
    card.append(star);
  }
  card.dataset.map = m.key;
  return { card, draw: pic.draw };
}

/** Maps the Featured sort puts first and badges (the home screen shows the first). */
const FEATURED_MAPS: readonly string[] = ['sandgate', 'canyon', 'citadel'];

/** How the map list is shown (kept in this browser). */
interface MapBrowsePrefs {
  sort: 'featured' | 'name' | 'size' | 'favs';
  view: 'grid' | 'list';
  favs: string[];
}
const BROWSE_KEY = 'tiletrigger.mapBrowse';
function loadBrowsePrefs(): MapBrowsePrefs {
  const d: MapBrowsePrefs = { sort: 'featured', view: 'grid', favs: [] };
  try {
    const p = JSON.parse(localStorage.getItem(BROWSE_KEY) ?? '{}') as Partial<MapBrowsePrefs>;
    return {
      sort: (['featured', 'name', 'size', 'favs'] as const).find((s) => s === p.sort) ?? d.sort,
      view: p.view === 'list' ? 'list' : 'grid',
      favs: Array.isArray(p.favs) ? p.favs.filter((x): x is string => typeof x === 'string').slice(0, 200) : [],
    };
  } catch {
    return d;
  }
}
function saveBrowsePrefs(p: MapBrowsePrefs): void {
  try {
    localStorage.setItem(BROWSE_KEY, JSON.stringify(p));
  } catch {
    // This page only.
  }
}

/** Match setup's steps, in order: the one open is where you are. */
type SetupStep = 'mode' | 'players' | 'bots' | 'rules' | 'done';
const STEP_ORDER: readonly SetupStep[] = ['mode', 'players', 'bots', 'done'];

/** Draw each card's plan once it scrolls into view in `root` (a long list draws only what is seen). */
function lazyPlans(root: HTMLElement): (card: Element, draw: () => void) => void {
  if (typeof IntersectionObserver === 'undefined') return (_card, draw) => requestAnimationFrame(draw);
  const draws = new Map<Element, () => void>();
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      seen.unobserve(e.target);
      draws.get(e.target)?.();
      draws.delete(e.target);
    }
  }, { root });
  return (card, draw) => {
    draws.set(card, draw);
    seen.observe(card);
  };
}

export interface ArcadeMap {
  key: string;
  /** What its card shows; the same as `map.metadata` once loaded. */
  metadata: MapMeta;
  /** The whole map, once loaded (built-in maps load on demand: mapIndex.ts). */
  map?: MapDocument;
  /** Load the whole map and keep it as `map`. */
  load(): Promise<MapDocument>;
  blurb: string;
  modes: GameMode[];
  bots: number;
  /** Shown under its own heading after the built-in maps (e.g. "Your"). */
  group?: string;
}

/** Play → match setup's settings (saved as `cs.arcade`; older saves load too). */
export type ArcadeSetup = MatchSetup;

export interface FrontEndHooks {
  openEditor(): void;
  openDesigner(look: string): void;
  /** `host`: open a join code for friends as soon as the match starts. */
  playLocal(map: MapDocument, rules: MatchRules, bots: number, skill: ArcadeSetup['skill'], host?: boolean): void;
  playOnline(server: string, name: string): void;
  /** Play a scenario chain (maps/playlists): its maps in order, each once the one before is won. */
  playPlaylist(id: string, botFill: number, skill: ArcadeSetup['skill']): void;
  /** Join a friend's hosted game by its code. */
  joinCode(code: string, name: string): void;
}

type ScreenId = 'home' | 'play' | 'characters' | 'online' | 'options' | 'profile';

const MODE_LABEL = MODE_LABELS;
const BASE_RULES = DEFAULT_RULES;
/** The score limit row per mode: its label and stepper (step, min, max). */
const SCORE_ROW: Partial<Record<GameMode, { label: string; step: number; min: number; max: number }>> = {
  'core.tdm': { label: 'Team score', step: 5, min: 5, max: 200 },
  'core.ctf': { label: 'Captures', step: 1, min: 1, max: 20 },
  'core.forts': { label: 'Captures', step: 1, min: 1, max: 20 },
  'core.koth': { label: 'Hill seconds', step: 10, min: 30, max: 600 },
  'core.elim': { label: 'Rounds to win', step: 1, min: 1, max: 15 },
  'core.bomb': { label: 'Rounds to win', step: 1, min: 1, max: 15 },
  'core.hostage': { label: 'Rounds to win', step: 1, min: 1, max: 15 },
  'core.discs': { label: 'Knock-offs', step: 1, min: 3, max: 50 },
};
/** A short line on each mode, under its name in the mode picker. */
const MODE_LINES: Record<GameMode, string> = {
  'core.deathmatch': 'Everyone for themselves; most kills wins.',
  'core.tdm': 'Teams score a point per kill.',
  'core.ctf': 'Bring the enemy flag home to score.',
  'core.forts': 'Build a fort, then Capture the Flag.',
  'core.koth': 'Hold the moving hill to score.',
  'core.elim': 'Rounds, no respawns: last team standing.',
  'core.bomb': 'Plant the bomb or defuse it; rounds.',
  'core.hostage': 'Rescue the hostages or guard them; rounds.',
  'core.coop': "Your squad against the map's mission.",
  'core.zombies': 'Hold out against endless zombie waves.',
  'core.discs': 'Knock rivals into the void with discs.',
  'core.race': 'Checkpoints and laps, in vehicles.',
};
/** One line on each mode, for its (i). */
const MODE_TIPS: Partial<Record<GameMode, string>> = {
  'core.deathmatch': 'Everyone for themselves. Most kills wins.',
  'core.tdm': 'Teams score a point per kill. First team to the score wins.',
  'core.ctf': "Grab the enemy flag from their base and bring it to yours while your own flag is home.",
  'core.forts': 'Fort Wars: a build phase with a force field between the teams (spend build points on walls, ramps and crates round your flag; LMB place, RMB pick up, R turn), then Capture the Flag over the forts. Explosives smash pieces.',
  'core.koth': 'Stand on the hill to score seconds for your team; the hill moves now and then.',
  'core.elim': 'Rounds with no respawns: wipe out the other teams to win the round.',
  'core.bomb': 'Attackers plant the bomb at site A or B (stand still, E); defenders stop them or defuse it. No respawns in a round.',
  'core.hostage': 'Rescuers lead hostages (E beside one) to the exit zone; guards hold them. No respawns in a round.',
  'core.coop': 'Work through the mission with bot squadmates against the map\'s enemies.',
  'core.zombies': 'Hold out with your bot squad against endless waves of zombies. Each wave is bigger; the fallen come back when it is beaten.',
  'core.discs': 'Ricochet-style: everyone starts with three bouncing discs and picks them up again where they land, like ammo (any disc will do). A hit knocks you about without hurting; knock someone into the void to score. Power discs (fast, triple, splitting, freeze) lie about the arena.',
  'core.race': 'Everyone starts on the grid in a vehicle: drive the checkpoints in order, lap after lap. First over the line wins. Combat races turn the guns and sideline sentries on.',
};

const FAMILY_LABEL = { ranger: 'Ranger', peasant: 'Peasant', athlete: 'Sportswear' } as const;

function storage(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) e.className = cls;
  Object.assign(e, rest);
  e.append(...children);
  return e;
};
const kbd = (key: string, cls = '') => el('kbd', { class: cls, textContent: key });
const hint = (key: Node, label: string) => el('span', {}, key, label);

/**
 * The front end (main menu): Home, Arcade setup, Character select, Online and
 * Options screens over the live 3D menu scene, styled after the UI reference
 * board. Keyboard: arrows move, Enter selects, Esc goes back, Q / E switch tabs.
 */
export class FrontEnd {
  private screen: ScreenId = 'home';
  private navIndex = 0;
  private readonly body = el('div', { class: 'screens' });
  private readonly status = el('p', { id: 'menu-status' });
  private readonly footerHints = el('div', { class: 'hintbar' });
  private setup: ArcadeSetup;
  name: string;
  /** Clan tag shown in front of your name ("[TAG] Name"), up to 5 letters or digits. */
  clan = '';

  /** Signed in with a username (Profile): it is your name, shown as a verified account (no clan tag). */
  verified = false;

  /** Your name as other players see it, with the clan tag (guests). */
  get displayName(): string {
    if (this.verified) return this.name;
    return this.clan ? `[${this.clan}] ${this.name}` : this.name;
  }

  /** The footer's account links (redrawn when the profile loads). */
  private footerBox?: HTMLElement;

  /** Your profile arrived (or you have none): your username becomes your name. */
  private applyProfile(username: string | null): void {
    const was = `${this.verified}|${this.name}`;
    this.verified = !!username;
    if (username) this.name = username;
    const box = this.footerLinks();
    this.footerBox?.replaceWith(box);
    this.footerBox = box;
    if (`${this.verified}|${this.name}` !== was && !this.root.hidden && ['home', 'online', 'options', 'profile'].includes(this.screen)) this.go(this.screen);
  }
  server: string;
  look: string;
  private charFilter = 'all';
  private hovered: string | null = null;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

  constructor(
    private readonly root: HTMLElement,
    private readonly maps: readonly ArcadeMap[],
    private readonly hooks: FrontEndHooks,
    private readonly scene: MenuScene,
    private readonly portraits: PortraitRenderer,
    private readonly audio: AudioSystem,
    params: URLSearchParams,
  ) {
    this.name = params.get('name') ?? storage('cs.name') ?? `Player${Math.floor(Math.random() * 900 + 100)}`;
    this.clan = storage('cs.clan') ?? '';
    installTooltips();
    this.server = params.get('server') ?? storage('cs.server') ?? `ws://${location.hostname || 'localhost'}:7777`;
    this.look = validLookId(params.get('look') ?? storage('cs.look') ?? DEFAULT_LOOK);
    // The setup used last (this version's or an older one's), if its map is still here.
    let raw: unknown = null;
    try {
      raw = JSON.parse(storage('cs.arcade') ?? 'null');
    } catch {
      raw = null;
    }
    const savedMap = maps.find((m) => m.key === (raw as { map?: unknown } | null)?.map);
    const saved = savedMap ? normalizeSetup(raw, savedMap.modes) : null;
    const first = maps.find((m) => m.key === 'sandgate') ?? maps[0]!;
    this.setup = saved ?? { map: first.key, mode: first.modes[0]!, bots: first.bots, skill: 'normal', scoreLimit: BASE_RULES[first.modes[0]!].scoreLimit, minutes: 10 };
    root.replaceChildren(
      this.body,
      this.status,
      el(
        'footer',
        { class: 'menu-footer' },
        el('div', { class: 'news' }, el('b', { textContent: 'News' }), 'Welcome to the Tile Trigger playtest. New: Sandgate, Team Deathmatch and the Character Designer.'),
        (this.footerBox = this.footerLinks()),
        this.footerHints,
      ),
    );
    window.addEventListener('keydown', this.keyHandler);
    this.go('home');
    (window as unknown as { __front: FrontEnd }).__front = this;
    void loadProfile().then((p) => this.applyProfile(p?.username ?? null));
    // Render every character's portrait in the background while the menu is up, so Character Select opens ready.
    setTimeout(() => void this.warmPortraits(), 1500);
  }

  /** Every built-in look with a portrait (tools/content/capture-portraits.mjs renders these for the site). */
  portraitLooks(): string[] {
    return [...CORE_LOOKS.map((l) => l.id), ...NPC_LOOKS.map((l) => l.id)];
  }

  /** Portraits for all the looks, one at a time, only while the menu is showing (never during a match). */
  private async warmPortraits(): Promise<void> {
    const ids = [...this.portraitLooks(), ...listCustomLooks().map((l) => l.id)];
    for (const id of ids) {
      while (this.root.hidden) await new Promise((r) => setTimeout(r, 2000));
      await this.portraits.get(id).catch(() => undefined);
    }
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  show(status = ''): void {
    this.root.hidden = false;
    this.setStatus(status);
    this.scene.setLook(this.look);
    this.go(this.screen === 'characters' ? 'characters' : 'home');
  }

  /** After the designer saves a look, select it and return to character select. */
  useLook(look: string): void {
    this.look = validLookId(look);
    storage('cs.look', this.look);
    this.scene.setLook(this.look);
  }

  private go(screen: ScreenId): void {
    clearInterval(this.browserTimer);
    this.screen = screen;
    this.hovered = null;
    this.scene.setLook(this.look);
    this.scene.setShot(screen === 'home' ? 'home' : 'side');
    this.body.replaceChildren(this.build(screen));
    this.footerHints.replaceChildren(...this.hints(screen));
    if (screen === 'home') (this.body.querySelector('.nav button.on') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  private hints(screen: ScreenId): HTMLElement[] {
    switch (screen) {
      case 'home':
        return [hint(kbd('↑↓'), 'Navigate'), hint(kbd('↵', 'a'), 'Select')];
      case 'play':
        return [hint(kbd('Esc', 'b'), 'Back'), hint(kbd('Q E'), 'Mode'), hint(kbd('↵', 'a'), 'Start')];
      case 'characters':
        return [hint(kbd('Esc', 'b'), 'Back'), hint(kbd('Q E'), 'Filter'), hint(kbd('D', 'x'), 'Design new'), hint(kbd('C', 'y'), 'Customise'), hint(kbd('↵', 'a'), 'Select')];
      case 'options':
        return [hint(kbd('Esc', 'b'), 'Back'), hint(kbd('Q E'), 'Section')];
      default:
        return [hint(kbd('Esc', 'b'), 'Back'), hint(kbd('↵', 'a'), 'Confirm')];
    }
  }

  private build(screen: ScreenId): HTMLElement {
    switch (screen) {
      case 'home':
        return this.home();
      case 'play':
        return this.arcade();
      case 'characters':
        return this.characters();
      case 'online':
        return this.online();
      case 'options':
        return this.options();
      case 'profile':
        return this.profile();
    }
  }

  // ---------------------------------------------------------------- home

  private readonly navItems: { id: string; label: string; act: () => void }[] = [
    { id: 'nav-play', label: 'Play', act: () => this.go('play') },
    { id: 'nav-mapmaker', label: 'MapMaker', act: () => this.hooks.openEditor() },
    { id: 'nav-characters', label: 'Characters', act: () => this.go('characters') },
    { id: 'nav-online', label: 'Online', act: () => this.go('online') },
    { id: 'nav-options', label: 'Options', act: () => this.go('options') },
  ];

  private home(): HTMLElement {
    const nav = el('nav', { class: 'nav' });
    this.navItems.forEach((item, i) => {
      const b = el('button', { id: item.id, textContent: item.label });
      b.classList.toggle('on', i === this.navIndex);
      b.addEventListener('mouseenter', () => this.setNav(i));
      b.addEventListener('click', item.act);
      nav.append(b);
    });
    const featured = this.maps.find((m) => m.key === FEATURED_MAPS[0]) ?? this.maps[0]!;
    const featuredPic = mapThumbs(featured, !featured.group);
    featuredPic.pic.classList.add('featured-pic');
    featuredPic.plan.classList.add('card-plan');
    const card = el(
      'button',
      { class: 'featured panel', title: 'Play this map' },
      featuredPic.pic,
      el('div', { class: 'meta' }, el('div', { class: 'meta-text' }, el('div', { class: 'kicker', textContent: 'Featured map' }), el('h3', { textContent: featured.metadata.name }), ...inspired(featured.key), el('p', { textContent: `${featured.modes.map((m) => MODE_LABEL[m]).join(' · ')} — ${featured.blurb}` })), featuredPic.plan),
    );
    card.addEventListener('click', () => {
      this.pickMap(featured.key);
      this.go('play');
    });
    requestAnimationFrame(featuredPic.draw);
    return el(
      'div',
      { class: 'screen home' },
      el('h1', { class: 'logo' }, el('span', { class: 'tile', textContent: 'Tile ' }), el('span', { class: 'trigger', textContent: 'Trigger' })),
      el('p', { class: 'logo-sub', textContent: 'Make. Play. Die. Repeat.' }),
      el('p', { class: 'logo-version', textContent: `v${__APP_VERSION__}` }),
      nav,
      this.badge(),
      card,
    );
  }

  private setNav(i: number): void {
    this.navIndex = (i + this.navItems.length) % this.navItems.length;
    this.body.querySelectorAll('.nav button').forEach((b, j) => b.classList.toggle('on', j === this.navIndex));
    (this.body.querySelectorAll('.nav button')[this.navIndex] as HTMLButtonElement | undefined)?.focus({ preventScroll: true });
  }

  private badge(): HTMLElement {
    const img = el('img', { alt: '' });
    void this.portraits.get(this.look).then((src) => (img.src = src), () => undefined);
    const b = el('button', { class: 'player-badge panel', title: 'Change character' }, img, el('div', {}, el('b', { textContent: this.name }), el('small', { textContent: this.lookName(this.look) })));
    b.addEventListener('click', () => this.go('characters'));
    return b;
  }

  private lookName(id: string): string {
    const npc = NPC_LOOKS.find((l) => l.id === id);
    if (npc) return npc.name;
    return listCustomLooks().find((s) => s.id === id)?.name ?? getLook(id).name;
  }

  // ---------------------------------------------------------------- match setup (Play)

  /** Scroll positions of the map list and the setup panel, kept across redraws. */
  private mapScroll = 0;
  private setupScroll = 0;
  /** Refreshes the game browser while the Online screen is open. */
  private browserTimer?: number;
  /** The match setup's folds that are open (by id). */
  private readonly folds = new Set<string>(['setup-mode']);
  /** The setup panel, redrawn on every change (the map list stays). */
  private setupPanel: HTMLElement | null = null;
  /** The saved setup loaded last (its name), to show whether the setup still matches it. */
  private setupName: string | null = lastSetup();
  /** The map list's mode tab and search (this visit) and its sort, view and favourites (kept). */
  private mapFilter: GameMode | 'all' = 'all';
  private mapQuery = '';
  private readonly browse = loadBrowsePrefs();
  /** The setup step that's open; the rest show a line each. */
  private step: SetupStep = 'mode';

  private currentMap(): ArcadeMap {
    return this.maps.find((m) => m.key === this.setup.map) ?? this.maps[0]!;
  }

  /** Load the map Play opens on (main.ts asks while the menu is idle), so the setup panel and Start don't wait for it. */
  preloadCurrentMap(): Promise<unknown> {
    return this.currentMap().load().catch(() => undefined);
  }

  private pickMap(key: string): void {
    const m = this.maps.find((x) => x.key === key);
    if (!m) return;
    const mode = m.modes.includes(this.setup.mode) ? this.setup.mode : m.modes[0]!;
    this.setup = { ...this.setup, map: key, mode, bots: m.bots, scoreLimit: mode === this.setup.mode ? this.setup.scoreLimit : BASE_RULES[mode].scoreLimit };
  }

  /** Change the setup, remember it and redraw the panel. */
  private change(f: (s: ArcadeSetup) => void): void {
    f(this.setup);
    this.saveSetup();
    this.refreshSetup();
  }

  private refreshSetup(): void {
    if (!this.setupPanel?.isConnected) return void this.go('play');
    this.setupScroll = this.setupPanel.querySelector('.setup-body')?.scrollTop ?? this.setupScroll;
    // Keep the keyboard where it was (a stepper's +, a tab) across the redraw.
    const focus = document.activeElement?.id;
    this.fillSetup(this.setupPanel);
    if (focus) (document.getElementById(focus) as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private setMode(m: GameMode): void {
    this.change((s) => {
      s.mode = m;
      s.scoreLimit = BASE_RULES[m].scoreLimit;
    });
  }

  private arcade(): HTMLElement {
    const cards = el('div', { class: `map-cards${this.browse.view === 'list' ? ' list' : ''}`, id: 'map-cards' });
    // Picking a map redraws the setup only: the list stays where it was.
    cards.addEventListener('scroll', () => (this.mapScroll = cards.scrollTop), { passive: true });
    requestAnimationFrame(() => (cards.scrollTop = this.mapScroll));

    // ---- the list's controls: a tab per mode, search, sort, grid or list
    const used = GAME_MODES.filter((g) => this.maps.some((m) => m.modes.includes(g)));
    if (this.mapFilter !== 'all' && !used.includes(this.mapFilter)) this.mapFilter = 'all';
    const tabs = el('div', { class: 'map-tabs', id: 'map-tabs', role: 'tablist' });
    const drawTabs = () =>
      tabs.replaceChildren(
        ...(['all', ...used] as const).map((f) => {
          const b = el('button', { type: 'button', class: `map-tab${f === this.mapFilter ? ' on' : ''}`, textContent: f === 'all' ? 'All maps' : MODE_LABEL[f], role: 'tab' });
          b.setAttribute('aria-selected', String(f === this.mapFilter));
          b.dataset.mode = f;
          b.addEventListener('click', () => {
            this.mapFilter = f;
            this.mapScroll = 0;
            drawTabs();
            drawCards();
          });
          return b;
        }),
      );
    const search = el('input', { type: 'search', id: 'map-search', placeholder: 'Search maps…', value: this.mapQuery, maxLength: 40, autocomplete: 'off' });
    search.setAttribute('aria-label', 'Search maps');
    search.addEventListener('input', () => {
      this.mapQuery = search.value;
      drawCards();
    });
    const sort = el('select', { id: 'map-sort', title: 'Sort maps' }, ...([['featured', 'Featured'], ['name', 'A–Z'], ['size', 'Size'], ['favs', 'Favourites']] as const).map(([v, t]) => el('option', { value: v, textContent: t, selected: v === this.browse.sort })));
    sort.addEventListener('change', () => {
      this.browse.sort = sort.value as MapBrowsePrefs['sort'];
      saveBrowsePrefs(this.browse);
      drawCards();
    });
    const viewBtn = (v: MapBrowsePrefs['view'], glyph: string, label: string) => {
      const b = el('button', { type: 'button', class: `view-btn${this.browse.view === v ? ' on' : ''}`, textContent: glyph, title: label });
      b.setAttribute('aria-label', label);
      b.dataset.view = v;
      b.addEventListener('click', () => {
        this.browse.view = v;
        saveBrowsePrefs(this.browse);
        cards.classList.toggle('list', v === 'list');
        tools.querySelectorAll('.view-btn').forEach((x) => x.classList.toggle('on', (x as HTMLElement).dataset.view === v));
      });
      return b;
    };
    const tools = el('div', { class: 'map-tools' }, search, sort, el('div', { class: 'view-pick' }, viewBtn('grid', '▦', 'Grid'), viewBtn('list', '☰', 'List')));

    const drawCards = () => {
      const current = this.currentMap();
      const lazy = lazyPlans(cards);
      const q = this.mapQuery.trim().toLowerCase();
      const favs = new Set(this.browse.favs);
      const built = this.maps.map((m, i) => ({ m, i }));
      const shown = built.filter(({ m }) => (this.mapFilter === 'all' || m.modes.includes(this.mapFilter)) && (!q || m.metadata.name.toLowerCase().includes(q) || m.blurb.toLowerCase().includes(q) || m.modes.some((x) => MODE_LABEL[x].toLowerCase().includes(q))));
      const rank = (key: string) => {
        const f = FEATURED_MAPS.indexOf(key);
        return f < 0 ? FEATURED_MAPS.length : f;
      };
      const by = this.browse.sort;
      // Your own maps stay under their heading after the built-in ones, whatever the sort.
      shown.sort((a, b) =>
        (a.m.group ?? '').localeCompare(b.m.group ?? '') ||
        (by === 'favs' ? Number(favs.has(b.m.key)) - Number(favs.has(a.m.key)) : 0) ||
        (by === 'featured' || by === 'favs' ? rank(a.m.key) - rank(b.m.key) : 0) ||
        (by === 'size' ? a.m.metadata.recommendedPlayers.max - b.m.metadata.recommendedPlayers.max : 0) ||
        (by === 'name' ? a.m.metadata.name.localeCompare(b.m.metadata.name) : a.i - b.i),
      );
      cards.replaceChildren();
      let group: string | undefined;
      for (const { m } of shown) {
        if (m.group !== group) {
          group = m.group;
          if (group) cards.append(el('h4', { class: 'map-group', textContent: `${group} maps` }));
        }
        const featured = !m.group && FEATURED_MAPS.includes(m.key);
        const { card, draw } = mapCard(m, m.key === current.key, featured ? 'Featured' : undefined, {
          on: favs.has(m.key),
          toggle: () => {
            const now = !this.browse.favs.includes(m.key);
            this.browse.favs = now ? [...this.browse.favs, m.key] : this.browse.favs.filter((k) => k !== m.key);
            saveBrowsePrefs(this.browse);
            return now;
          },
        });
        card.addEventListener('click', () => {
          this.pickMap(m.key);
          this.saveSetup();
          cards.querySelectorAll('.map-card.on').forEach((c) => c.classList.remove('on'));
          card.classList.add('on');
          this.setupScroll = 0;
          // A new map starts the steps again at its mode (a filtered list already picked one it has).
          if (this.mapFilter !== 'all' && m.modes.includes(this.mapFilter) && this.setup.mode !== this.mapFilter) this.setMode(this.mapFilter);
          this.step = this.mapFilter !== 'all' ? 'players' : 'mode';
          this.refreshSetup();
        });
        cards.append(card);
        lazy(card, draw);
      }
      if (!shown.length) cards.append(el('p', { class: 'map-empty', textContent: q ? `No maps match "${this.mapQuery.trim()}".` : 'No maps for this mode.' }));
    };
    drawTabs();
    drawCards();
    const panel = el('div', { class: 'setup panel', id: 'match-setup' });
    this.setupPanel = panel;
    this.fillSetup(panel);
    return el(
      'div',
      { class: 'screen play' },
      el('div', { class: 'screen-head' }, el('h2', { innerHTML: 'Match <em>Setup</em>' })),
      el('div', { class: 'arcade' }, el('div', { class: 'map-browse' }, el('div', { class: 'map-bar' }, tabs, tools), cards), panel),
    );
  }

  /** Move the setup on from `from` to the next step (skipping ones already behind you). */
  private nextStep(from: SetupStep): void {
    const i = STEP_ORDER.indexOf(from);
    this.step = i < 0 ? 'done' : STEP_ORDER[i + 1] ?? 'done';
    this.setupScroll = 0;
    this.refreshSetup();
  }

  /** The setup panel: map preview, the core settings (mode, players, bots), folded extras, saved setups, Start and Host. */
  private fillSetup(panel: HTMLElement): void {
    const current = this.currentMap();
    const map = current.map;
    if (!map) {
      // A built-in map still loading (usually already in: the menu fetches the current one while idle).
      panel.replaceChildren(el('p', { class: 'setup-sub', textContent: `Loading ${current.metadata.name}…` }));
      void current.load().then(
        () => panel.isConnected && this.currentMap() === current && this.refreshSetup(),
        () => this.setStatus(`${current.metadata.name} failed to load`),
      );
      return;
    }
    const s = this.setup;
    const team = isTeamMode(s.mode);
    const coop = isCoopMode(s.mode);
    const two = isTwoTeamMode(s.mode);
    const forts = s.mode === 'core.forts';
    const race = s.mode === 'core.race';
    const players = setupPlayers(s, map);
    const fold = (id: string, title: string, badge: string | undefined, ...children: HTMLElement[]) =>
      foldEl({ id, title, badge, open: this.folds.has(id), onToggle: (open) => (open ? this.folds.add(id) : this.folds.delete(id)) }, ...children);

    // ---- header: the map's picture with its top-down plan, name, what it is, how many and how long
    const thumbs = mapThumbs(map, !current.group);
    requestAnimationFrame(thumbs.draw);
    // The list is hidden on small screens: there, this picks the map.
    const mapSelect = el('select', { id: 'arcade-map', title: 'Map' }, ...this.maps.map((m) => el('option', { value: m.key, textContent: `${m.metadata.name}${m.group ? ` (${m.group})` : ''}`, selected: m.key === current.key })));
    mapSelect.addEventListener('change', () => {
      this.pickMap(mapSelect.value);
      this.saveSetup();
      this.setupScroll = 0;
      this.step = 'mode';
      this.go('play');
    });
    const about = [map.metadata.description, map.metadata.author && !['Tile Trigger', 'ChronoSplit'].includes(map.metadata.author) ? `Map by ${map.metadata.author}` : '', `Made for ${map.metadata.recommendedPlayers.min}–${map.metadata.recommendedPlayers.max} players; ${map.entities.filter((e) => e.kind === 'spawn').length} spawn points.`].filter(Boolean).join('\n\n');
    const sizes = team ? setupTeams(s, map) : [];
    const rec = map.metadata.recommendedPlayers;
    const length = coop ? (s.mode === 'core.zombies' ? 'Until the last wave' : 'Mission') : forts ? `~${Math.round((s.fortCycles ?? 1) * ((s.fortBuild ?? 2.5) + (s.fortCombat ?? 5)))} min` : race ? `${s.raceLaps ?? map.track?.laps ?? 3} laps` : s.minutes ? `~${s.minutes} min` : 'No time limit';
    const facts = el(
      'p',
      { class: 'setup-facts', id: 'setup-summary' },
      el('span', { class: 'fact-players', title: `Made for ${rec.min}–${rec.max} players` }, team ? `${sizes.join('v')} · ${players} players` : `${players} player${players === 1 ? '' : 's'}`),
      el('span', { class: 'fact-time', title: coop ? 'Ends through the mission' : 'Time limit' }, length),
    );
    const featured = !current.group && FEATURED_MAPS.includes(current.key);
    const head = el(
      'div',
      { class: 'setup-head' },
      thumbPair(thumbs, 'setup-preview'),
      el(
        'div',
        { class: 'setup-title' },
        el('small', { textContent: featured ? 'Featured map' : current.group ? `${current.group} map` : 'Map' }),
        el('h3', {}, map.metadata.name, infoTip(about)),
        ...inspired(current.key),
        el('p', { class: 'setup-blurb', textContent: current.blurb }),
        facts,
        mapSelect,
      ),
    );

    // ---- mode: a tile per mode the map has (an icon and the name), the selected one's line below, the rest greyed with why
    const options = modeOptions(map, current.modes);
    const modeChips = el(
      'div',
      { class: 'mode-pick', id: 'arcade-modes' },
      ...current.modes.map((m) => {
        const b = el('button', { type: 'button', class: `mode-chip${m === s.mode ? ' on' : ''}` }, modeIcon(m), el('b', { textContent: MODE_LABEL[m] }));
        b.dataset.mode = m;
        b.dataset.tip = MODE_TIPS[m] ?? MODE_LINES[m];
        b.setAttribute('aria-pressed', String(m === s.mode));
        b.addEventListener('click', () => {
          // Picking the mode finishes this step: on to the players.
          this.step = 'players';
          this.setupScroll = 0;
          if (m !== s.mode) this.setMode(m);
          else this.refreshSetup();
        });
        return b;
      }),
    );
    const modeLine = el('p', { class: 'setup-hint mode-line', textContent: MODE_LINES[s.mode] });
    const off = options.filter((o) => !o.ok);
    const unavailable = off.length
      ? [el('div', { class: 'mode-off' }, el('span', { textContent: 'Not on this map:' }), ...off.map((o) => {
          const t = el('span', { class: 'mode-tag-off', tabIndex: 0, textContent: MODE_LABEL[o.mode] });
          t.dataset.tip = o.reason ?? '';
          t.dataset.mode = o.mode;
          t.setAttribute('aria-label', `${MODE_LABEL[o.mode]}: ${o.reason}`);
          return t;
        }))]
      : [];

    // ---- players: a quick preset, then the teams (or the player count)
    const quick = this.quickSetup(current);
    const playerRows: HTMLElement[] = [quick];
    if (team) {
      const sizes = setupTeams(s, map);
      const sides = mapTeams(map, sizes.length);
      const assign = s.assign ?? 'balanced';
      const you = assign === 'fixed' ? Math.min(sizes.length - 1, s.playerTeam ?? 0) : assign === 'balanced' ? 0 : null;
      playerRows.push(
        settingRow(
          'Your team',
          'Balanced: people spread evenly over the teams (they usually outplay bots), bots fill the rest; offline you start on the first team. Random: a random team with room. Fixed: the team you pick (drag "You" or press Join).',
          choice<TeamAssign>([['balanced', 'Balanced'], ['random', 'Random'], ['fixed', 'Fixed']], assign, (v) => this.change((x) => {
            x.assign = v === 'balanced' ? undefined : v;
            if (v === 'fixed') x.playerTeam = x.playerTeam ?? 0;
          }), 'arcade-assign'),
        ),
        teamEditor({
          id: 'arcade',
          state: { sizes, names: sizes.map((_, i) => s.teamNames?.[i] || sides[i]!.name), colors: sizes.map((_, i) => s.teamColors?.[i] || sides[i]!.color), you },
          countLocked: two ? `${MODE_LABEL[s.mode]} is always two teams.` : null,
          youLabel: 'You',
          onChange: (next) => this.change((x) => {
            x.teams = next.sizes;
            // Only names and colours changed from the map's are kept.
            x.teamNames = next.names.map((n, i) => (n && n !== sides[i]?.name ? n : ''));
            x.teamColors = next.colors.map((c, i) => (c && c !== sides[i]?.color ? c : ''));
            if (!x.teamNames.some(Boolean)) delete x.teamNames;
            if (!x.teamColors.some(Boolean)) delete x.teamColors;
            if (next.you !== you && next.you !== null) {
              x.assign = 'fixed';
              x.playerTeam = next.you;
            }
          }),
        }),
      );
    } else {
      playerRows.push(settingRow(coop ? 'Squadmates' : 'Bots', coop ? 'Bot squadmates fighting alongside you.' : 'Bots to fill the match. You play too.', stepper({ value: s.bots, min: 0, max: MAX_PLAYER_SLOTS - 1, id: 'arcade-bots', label: coop ? 'squadmates' : 'bots', onChange: (v) => this.change((x) => (x.bots = v)) })));
      playerRows.push(el('p', { class: 'setup-hint', textContent: `You + ${s.bots} bot${s.bots === 1 ? '' : 's'} = ${players} player${players === 1 ? '' : 's'}${coop ? ' on your side' : ''}` }));
    }
    if (s.mode === 'core.coop' && PLAYLISTS.length) {
      playerRows.push(settingRow('Playlist', `Play a chain of co-op maps: win one and you go on to the next${PLAYLISTS.map((p) => `\n\n${p.name} (${p.maps.length} maps): ${p.description}`).join('')}`, choice([['', 'Just this map'], ...PLAYLISTS.map((p): ChoiceOption<string> => [p.id, `${p.name} (${p.maps.length})`])], s.playlist ?? '', (v) => this.change((x) => (x.playlist = v || undefined)))));
    }
    const notes = setupNotes(s, map);

    // ---- extras, folded: rules, bots, arsenal, the mode's own settings, performance
    const scoreRow = SCORE_ROW[s.mode] ?? { label: 'Score limit', step: 5, min: 5, max: 200 };
    const timeRow = settingRow('Time limit', 'When time runs out the highest score (or the race leader) wins. ∞: no limit.', stepper({ value: s.minutes, min: 0, max: 60, id: 'arcade-minutes', fmt: (v) => (v ? `${v} min` : '∞'), onChange: (v) => this.change((x) => (x.minutes = v)) }), { disabled: forts ? 'Fort Wars ends after its last combat phase.' : coop ? 'Co-op and Zombies end through the mission.' : null });
    const noTeams = team ? null : `No teams in ${MODE_LABEL[s.mode]}.`;
    const respawnDefault = Math.round(BASE_RULES[s.mode].respawnDelayTicks / 60);
    const extras: { id: string; label: string; tip: string; changed: boolean; value: string; control: HTMLElement; disabled?: string | null }[] = [
      { id: 'ff', label: 'Friendly fire', tip: 'Team modes and co-op: whether your shots and blasts hurt teammates. A team kill earns nothing.', changed: !!s.friendlyFire, value: `Friendly fire ${s.friendlyFire === 'half' ? 'half' : 'full'}`, control: choice([['off', 'Off'], ['half', 'Half'], ['on', 'Full']], s.friendlyFire ?? 'off', (v) => this.change((x) => (x.friendlyFire = v === 'off' ? undefined : (v as 'half' | 'on')))), disabled: team || coop ? null : `No teammates in ${MODE_LABEL[s.mode]}.` },
      { id: 'respawn', label: 'Respawn delay', tip: `Seconds before you are back in. Rounds modes (Elimination, Bomb, Hostage) and Zombies wait for the next round or wave instead. Default here: ${respawnDefault} s.`, changed: s.respawn !== undefined, value: `Respawn ${s.respawn} s`, control: stepper({ value: s.respawn ?? respawnDefault, min: 0, max: 30, id: 'arcade-respawn', fmt: (v) => `${v} s`, onChange: (v) => this.change((x) => (x.respawn = v === respawnDefault ? undefined : v)) }) },
      { id: 'leaders', label: 'Team leaders', tip: 'Team modes: each team has a leader (you lead yours; bots lead the others), marked with a gold star. The leader\'s "Follow me!" and "Hold here!" (B, then 1 or 7) order every bot on the team, wherever they are. Leader hunt: in Team Deathmatch, downing the enemy leader scores 3 extra.', changed: !!s.leaders && team, value: s.leaders === 'vip' ? 'Leader hunt' : 'Team leaders', control: choice([['off', 'Off'], ['on', 'On'], ['vip', 'Leader hunt', s.mode === 'core.tdm' ? null : 'Leader hunt is a Team Deathmatch variant.']], s.leaders ?? 'off', (v) => this.change((x) => (x.leaders = v === 'off' ? undefined : (v as 'on' | 'vip')))), disabled: noTeams },
      { id: 'squad', label: 'Spawn on teammates', tip: 'Team modes: respawn beside a teammate who is out of the fight, when one is free.', changed: s.squadSpawn === false && team, value: 'No squad spawns', control: choice([['on', 'On'], ['off', 'Off']], s.squadSpawn === false ? 'off' : 'on', (v) => this.change((x) => (x.squadSpawn = v === 'on'))), disabled: noTeams },
      { id: 'streaks', label: 'Kill streaks', tip: 'Rewards for kills without dying: 3 UAV, 5 Supply Pulse (heal + ammo for nearby teammates), 7 Counter-UAV (jams enemy minimaps), 9 Airstrike.', changed: s.killstreaks === false, value: 'No kill streaks', control: choice([['on', 'On'], ['off', 'Off']], s.killstreaks === false ? 'off' : 'on', (v) => this.change((x) => (x.killstreaks = v === 'on'))) },
      { id: 'sizes', label: 'Character sizes', tip: 'Matter: small characters are smaller, quicker targets with less health that fit through gaps others must crouch for; large ones are bigger, slower and tougher. All equal: everyone plays at standard size.', changed: s.sizes === false, value: 'Equal sizes', control: choice([['on', 'Matter'], ['off', 'All equal']], s.sizes === false ? 'off' : 'on', (v) => this.change((x) => (x.sizes = v === 'on'))) },
      { id: 'gravity', label: 'Gravity', tip: 'Map: whatever the map was built with (normal unless its maker changed it).', changed: s.gravity !== undefined, value: `${s.gravity === 0.4 ? 'Low' : s.gravity === 1.6 ? 'Heavy' : 'Normal'} gravity`, control: choice([['map', 'Map'], ['0.4', 'Low'], ['1', 'Normal'], ['1.6', 'Heavy']], s.gravity === undefined ? 'map' : String(s.gravity), (v) => this.change((x) => (x.gravity = v === 'map' ? undefined : Number(v)))) },
      { id: 'fall', label: 'Fall damage', tip: "Drops past about 5 m hurt; about 16 m kills. Map: the map's own setting.", changed: s.fallDamage !== undefined, value: `Fall damage ${s.fallDamage ? 'on' : 'off'}`, control: choice([['map', 'Map'], ['on', 'On'], ['off', 'Off']], s.fallDamage === undefined ? 'map' : s.fallDamage ? 'on' : 'off', (v) => this.change((x) => (x.fallDamage = v === 'map' ? undefined : v === 'on'))) },
      { id: 'lethality', label: 'Lethality', tip: 'How quickly fights end, for every weapon alike. Arcade: everyone soaks about 40% more (longer fights, tracking matters). Standard: the official balance. Tactical: everyone soaks about 30% less (very lethal).', changed: !!s.lethality, value: `${s.lethality === 'arcade' ? 'Arcade' : 'Tactical'} lethality`, control: choice([['arcade', 'Arcade'], ['standard', 'Standard'], ['tactical', 'Tactical']], s.lethality ?? 'standard', (v) => this.change((x) => (x.lethality = v === 'standard' ? undefined : (v as 'arcade' | 'tactical')))) },
      { id: 'ballistics', label: 'Ballistics', tip: "How much bullets behave like projectiles. Arcade: faster bullets that barely drop and don't pass through cover. Standard: the official default (lead and drop matter at long range). Advanced: slower bullets that drop more: lead and hold over further.", changed: !!s.ballistics, value: `${s.ballistics === 'arcade' ? 'Arcade' : 'Advanced'} ballistics`, control: choice([['arcade', 'Arcade'], ['standard', 'Standard'], ['advanced', 'Advanced']], s.ballistics ?? 'standard', (v) => this.change((x) => (x.ballistics = v === 'standard' ? undefined : (v as 'arcade' | 'advanced')))) },
      { id: 'emotes', label: 'Emotes & messages', tip: 'Quick messages (B, then 1-7; 1 "Follow me!" and 7 "Hold here!" also order your team\'s bots), the dance emote (N). Pings (T) always work.', changed: s.emotes === false, value: 'No emotes', control: choice([['on', 'On'], ['off', 'Off']], s.emotes === false ? 'off' : 'on', (v) => this.change((x) => (x.emotes = v === 'on'))) },
    ];
    const restricted = s.spears ? 'Spears only' : s.discs ? 'Discs only' : null;
    const arsenal: typeof extras = [
      { id: 'weapons', label: 'Weapons & pickups', tip: 'Normal: the map\'s weapons, ammo and grenades lie about. Spears only: everyone holds one throwing spear (one hit kills; go and fetch it back). Discs only: everyone throws bouncing arena discs that knock players about without hurting (Disc Arena rules). No weapon, ammo or grenade pickups either way.', changed: !!s.spears || !!s.discs, value: s.discs ? 'Discs only' : 'Spears only', control: choice([['normal', 'Normal'], ['spears', 'Spears only'], ['discs', 'Discs only']], s.spears ? 'spears' : s.discs ? 'discs' : 'normal', (v) => this.change((x) => ((x.spears = v === 'spears' || undefined), (x.discs = v === 'discs' || undefined)))) },
      { id: 'classes', label: 'Classes', tip: 'Everyone picks one of nine classes (L or , in play; it opens when you join and when you are down): Runner, Rocketeer, Torch, Breacher, Bulwark, Mechanic (G: sentry that heals and restocks), Medic (medi-beam, G: overcharge), Marksman and Shade (G: cloak, backstabs). Limits cap how many on a team play the same class.', changed: !!s.classes && !restricted, value: `Classes${s.classLimit ? ` (max ${s.classLimit})` : ''}`, control: choice([['off', 'Off'], ['on', 'On'], ['1', 'Max 1'], ['2', 'Max 2']], !s.classes ? 'off' : s.classLimit ? String(s.classLimit) : 'on', (v) => this.change((x) => ((x.classes = v !== 'off' || undefined), (x.classLimit = v === '1' || v === '2' ? Number(v) : undefined)))), disabled: restricted ? `Classes don't mix with ${restricted.toLowerCase()}.` : null },
      { id: 'vehicles', label: 'Vehicle damage', tip: "Normal: vehicles smoke, catch fire and blow up. Tough: they take half damage. Off: they can't be destroyed (except by falling off the map). Turrets and sentries always take full damage.", changed: !!s.vehicleDamage, value: `${s.vehicleDamage === 'off' ? 'Indestructible' : 'Tough'} vehicles`, control: choice([['normal', 'Normal'], ['tough', 'Tough'], ['off', 'Off']], s.vehicleDamage ?? 'normal', (v) => this.change((x) => (x.vehicleDamage = v === 'normal' ? undefined : (v as 'tough' | 'off')))), disabled: map.entities.some((e) => e.kind === 'mount') || race ? null : 'This map has no vehicles.' },
    ];
    const bots: typeof extras = [
      { id: 'style', label: 'Bot style', tip: 'Mixed: every character plays its own way. Arena: strafe-jumping, item timing, always moving (Quake). Tactical: careful, cover, held angles (Counter-Strike).', changed: !!s.botStyle, value: `${s.botStyle === 'arena' ? 'Arena' : 'Tactical'} bots`, control: choice([['mixed', 'Mixed'], ['arena', 'Arena'], ['tactical', 'Tactical']], s.botStyle ?? 'mixed', (v) => this.change((x) => (x.botStyle = v === 'mixed' ? undefined : (v as 'arena' | 'tactical'))), 'arcade-style') },
    ];
    const rowOf = (x: (typeof extras)[number]) => settingRow(x.label, x.tip, x.control, { disabled: x.disabled });
    const live = (xs: typeof extras) => xs.filter((x) => x.changed && !x.disabled);
    const changed = [...live(extras), ...live(arsenal), ...live(bots)];
    const reset = el('button', { type: 'button', class: 'link', textContent: 'Reset', title: 'Back to the standard rules' });
    reset.hidden = !changed.length;
    reset.addEventListener('click', (e) => {
      e.preventDefault();
      this.change((x) => {
        for (const k of ['spears', 'discs', 'classes', 'classLimit', 'botStyle', 'gravity', 'fallDamage', 'friendlyFire', 'killstreaks', 'squadSpawn', 'emotes', 'sizes', 'vehicleDamage', 'leaders', 'lethality', 'ballistics', 'respawn'] as const) delete x[k];
      });
    });
    const count = (xs: typeof extras) => {
      const n = live(xs).length;
      return n ? `${n} changed` : 'standard';
    };
    const toWin = race
      ? []
      : [settingRow(scoreRow.label, coop ? 'Co-op and Zombies end through the mission.' : 'The match ends when someone reaches this.', stepper({ value: s.scoreLimit, min: scoreRow.min, max: scoreRow.max, step: scoreRow.step, id: 'arcade-score', onChange: (v) => this.change((x) => (x.scoreLimit = v)) }), { disabled: coop ? `${MODE_LABEL[s.mode]} ends through the mission, not a score.` : null })];
    const rulesFold = fold('setup-rules', 'Rules', count(extras), ...toWin, timeRow, ...extras.map(rowOf));
    rulesFold.querySelector('summary')!.append(reset);
    const perTeam = team
      ? [el('p', { class: 'setup-hint', textContent: `Bots per team: ${mapTeams(map, sizes.length).map((t, i) => `${s.teamNames?.[i] || t.name} ${sizes[i]! - ((s.assign === 'fixed' ? Math.min(sizes.length - 1, s.playerTeam ?? 0) : 0) === i && s.assign !== 'random' ? 1 : 0)}`).join(' · ')}${s.assign === 'random' ? ' (one less wherever you land)' : ''}. Move bots by dragging their pips between teams.` })]
      : [];
    const modeRows: HTMLElement[] = [];
    if (forts) {
      modeRows.push(
        settingRow('Build phase', 'Minutes to build before the barrier drops.', stepper({ value: s.fortBuild ?? 2.5, min: 1, max: 6, step: 0.5, id: 'arcade-fort-build', fmt: (v) => `${v} min`, onChange: (v) => this.change((x) => (x.fortBuild = v)) })),
        settingRow('Combat phase', 'Minutes of Capture the Flag after each build phase.', stepper({ value: s.fortCombat ?? 5, min: 2, max: 20, id: 'arcade-fort-combat', fmt: (v) => `${v} min`, onChange: (v) => this.change((x) => (x.fortCombat = v)) })),
        settingRow('Cycles', 'Build-then-fight rounds before the match ends. Pieces stand until they are broken; each build phase you can rebuild with the points they cost.', stepper({ value: s.fortCycles ?? 1, min: 1, max: 5, id: 'arcade-fort-cycles', onChange: (v) => this.change((x) => (x.fortCycles = v)) })),
        settingRow('Build points', "Each team's budget: a block costs 2, a wall 4, a metal wall 8.", stepper({ value: s.fortBudget ?? 420, min: 100, max: 800, step: 20, id: 'arcade-fort-budget', onChange: (v) => this.change((x) => (x.fortBudget = v)) })),
      );
    }
    if (s.mode === 'core.ctf' || forts) modeRows.push(settingRow('Flag return', 'Seconds a dropped flag lies before it goes home on its own.', stepper({ value: s.flagReturn ?? 30, min: 5, max: 120, step: 5, id: 'arcade-flag-return', fmt: (v) => `${v} s`, onChange: (v) => this.change((x) => (x.flagReturn = v === 30 ? undefined : v)) })));
    if (s.mode === 'core.koth') modeRows.push(settingRow('Hill moves', 'Seconds before the hill moves to the next spot.', stepper({ value: s.hill ?? 60, min: 15, max: 300, step: 15, id: 'arcade-hill', fmt: (v) => `${v} s`, onChange: (v) => this.change((x) => (x.hill = v === 60 ? undefined : v)) })));
    if (race) {
      modeRows.push(
        settingRow('Laps', 'Laps of the circuit (a point-to-point track is always one run).', stepper({ value: s.raceLaps ?? map.track?.laps ?? 3, min: 1, max: 10, id: 'arcade-laps', onChange: (v) => this.change((x) => (x.raceLaps = v)) })),
        settingRow('Vehicle', "What everyone races in. Map: the track's own choice.", choice([['map', 'Map'], ['kart', 'Go-Kart'], ['speeder', 'Speeder'], ['buggy', 'Buggy']], s.raceVehicle ?? 'map', (v) => this.change((x) => (x.raceVehicle = v === 'map' ? undefined : (v as ArcadeSetup['raceVehicle']))))),
        settingRow('Combat', 'Combat race: weapons and vehicle guns are live and the sentries by the track shoot. Clean: nobody can hurt anybody.', choice([['map', 'Map'], ['off', 'Clean'], ['on', 'Combat']], s.raceCombat === undefined ? 'map' : s.raceCombat ? 'on' : 'off', (v) => this.change((x) => (x.raceCombat = v === 'map' ? undefined : v === 'on')))),
      );
    }
    const perf = players > BIG_MATCH
      ? [fold('setup-perf', 'Performance', players > HUGE_MATCH ? 'very big match' : 'big match',
          el('p', { class: 'setup-hint', textContent: `${players} players. Every bot thinks on your computer: past ${BIG_MATCH}, idle bots think every other tick. If it stutters: Low graphics, a lower render scale (Options), fewer bots, or Classes and vehicles off.` }),
          settingRow('Graphics', 'Low: no shadows or post effects, the fastest. Saved for every match (Options has the rest).', choice(GRAPHICS_QUALITIES.map((q): ChoiceOption<GraphicsQuality> => [q, q[0]!.toUpperCase() + q.slice(1)]), loadGraphicsQuality(), (v) => {
            saveGraphicsQuality(v);
            this.refreshSetup();
          }, 'arcade-graphics')))]
      : [];

    // ---- saved setups
    const saved = listSetups();
    const pick = el('select', { id: 'setup-saved-list', title: 'Saved setups' }, el('option', { value: '', textContent: saved.length ? 'Load a saved setup…' : 'No saved setups yet' }), ...saved.map((x) => el('option', { value: x.name, textContent: x.name, selected: x.name === this.setupName })));
    pick.addEventListener('change', () => pick.value && this.loadSaved(pick.value));
    const nameIn = el('input', { id: 'setup-save-name', placeholder: 'Name this setup', maxLength: 40, value: this.setupName ?? '' });
    const save = el('button', { type: 'button', id: 'setup-save', textContent: 'Save' });
    const del = el('button', { type: 'button', id: 'setup-delete', class: 'link', textContent: 'Delete', disabled: !this.setupName || !saved.some((x) => x.name === this.setupName), title: 'Delete the selected saved setup' });
    save.addEventListener('click', () => {
      const name = nameIn.value.trim() || `${map.metadata.name} ${MODE_LABEL[s.mode]}`;
      if (!saveSetupAs(name, this.setup)) return this.setStatus("Couldn't save: this browser isn't keeping data for the game.");
      this.setupName = name;
      this.setStatus('');
      this.refreshSetup();
    });
    nameIn.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), save.click()));
    del.addEventListener('click', () => {
      if (!this.setupName) return;
      deleteSetup(this.setupName);
      this.setupName = null;
      this.refreshSetup();
    });
    const match = saved.find((x) => x.name === this.setupName);
    const same = !!match && JSON.stringify(match.setup) === JSON.stringify(this.setup);
    const savedFold = fold('setup-saved', 'Saved setups', this.setupName ? `${this.setupName}${same ? '' : ' (changed)'}` : `${saved.length} saved`, el('div', { class: 'saved-row' }, pick, del), el('div', { class: 'saved-row' }, nameIn, save));

    // ---- the steps: the open one shows its settings, the others a line each (click one to go back to it)
    const RANK: Record<SetupStep, number> = { mode: 0, players: 1, bots: 2, rules: 3, done: 4 };
    const stepEl = (key: SetupStep, n: number, title: string, summary: (Node | string)[], o: { warn?: boolean; next?: string | null }, ...content: HTMLElement[]) => {
      const open = this.step === key;
      const done = !open && key !== 'rules' && RANK[key] < RANK[this.step];
      const headBtn = el(
        'button',
        { type: 'button', class: 'step-head' },
        el('span', { class: 'step-num', textContent: done ? '✓' : String(n) }),
        el('h4', { textContent: title }),
        el('span', { class: `step-sum${o.warn ? ' warn' : ''}` }, ...summary),
        el('span', { class: 'step-caret', textContent: open ? '▾' : '▸' }),
      );
      headBtn.setAttribute('aria-expanded', String(open));
      headBtn.addEventListener('click', () => {
        if (open) return this.nextStep(key === 'rules' ? 'bots' : key);
        this.step = key;
        this.refreshSetup();
      });
      const sec = el('section', { class: `step${open ? ' open' : ''}${done ? ' done' : ''}`, id: `step-${key}` }, headBtn);
      if (open) {
        const next = el('button', { type: 'button', class: 'step-next', textContent: o.next ?? 'Done' });
        next.addEventListener('click', () => this.nextStep(key === 'rules' ? 'bots' : key));
        sec.append(el('div', { class: 'step-body' }, ...content, el('div', { class: 'step-foot' }, next)));
      }
      return sec;
    };
    const assignLabel = { balanced: 'Balanced', random: 'Random team', fixed: 'Fixed team' }[s.assign ?? 'balanced'];
    const playersSummary = team ? `${sizes.join('v')} · ${assignLabel}` : coop ? `You + ${s.bots} squadmate${s.bots === 1 ? '' : 's'}` : `You + ${s.bots} bot${s.bots === 1 ? '' : 's'}`;
    const skillLabel = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[s.skill] ?? s.skill;
    const botsSummary = `${skillLabel} bots${s.botStyle ? ` · ${s.botStyle === 'arena' ? 'Arena' : 'Tactical'}` : ''}`;
    const modeSet = modeRows.length ? [fold('setup-mode', `${MODE_LABEL[s.mode]} settings`, 'mode settings', ...modeRows)] : [];
    const body = el(
      'div',
      { class: 'setup-body' },
      stepEl('mode', 1, 'Game mode', [modeIcon(s.mode), MODE_LABEL[s.mode]], { next: 'Next: players' }, modeChips, modeLine, ...unavailable),
      stepEl('players', 2, coop ? 'Squad' : 'Players & teams', [playersSummary], { warn: notes.some((x) => x.level === 'warn'), next: 'Next: bots' }, ...playerRows, ...(notes.length ? [noteList(notes)] : [])),
      stepEl(
        'bots',
        3,
        'Bots',
        [botsSummary],
        { next: 'Done' },
        settingRow('Bot skill', 'Easy bots aim slowly and miss often; hard ones react fast, use cover and lead their shots.', choice([['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], s.skill, (v) => this.change((x) => (x.skill = v as ArcadeSetup['skill'])), 'arcade-skill')),
        ...bots.map(rowOf),
        ...perTeam,
      ),
      stepEl('rules', 4, 'Advanced rules', [changed.length ? `${changed.length} changed` : 'Standard'], { next: 'Done' }, ...modeSet, rulesFold, fold('setup-arsenal', 'Weapons, pickups & vehicles', count(arsenal), ...arsenal.map(rowOf)), ...perf),
      savedFold,
    );
    requestAnimationFrame(() => (body.scrollTop = this.setupScroll));
    body.addEventListener('scroll', () => (this.setupScroll = body.scrollTop), { passive: true });
    const start = el('button', { type: 'button', class: `primary go${this.step === 'done' ? ' ready' : ''}`, id: 'arcade-start', title: 'Start the match offline: you and the bots (Enter)' }, el('span', { textContent: 'Start match' }), el('kbd', { class: 'a', textContent: '↵' }));
    start.addEventListener('click', () => this.start());
    const host = el('button', { type: 'button', class: 'go host', id: 'arcade-host', title: 'Start the match and open a join code so friends can play from their browsers (they take bots\' places). Esc → Host tab shows the code and invite link.' }, el('span', { textContent: 'Host' }));
    const playlist = s.mode === 'core.coop' && !!s.playlist;
    host.disabled = playlist;
    if (playlist) host.title = 'Playlists are played offline; pick "Just this map" to host.';
    host.addEventListener('click', () => this.start(true));
    panel.replaceChildren(head, body, el('div', { class: 'setup-foot' }, ...(changed.length ? [el('div', { class: 'rule-chips' }, ...changed.map((x) => el('span', { textContent: x.value })))] : []), el('div', { class: 'go-row' }, host, start)));
  }

  /**
   * The quick presets: the common shapes (1v1 … 48v48, 2v2v2v2, 4×4, FFA 8/16)
   * and MapMaker's other layouts. Each starts an editable setup; a team
   * layout moves a free-for-all to Team Deathmatch (and an FFA preset back)
   * when the map has it. Options that can't work here say why.
   */
  private quickSetup(current: ArcadeMap): HTMLElement {
    const s = this.setup;
    const teamModes = current.modes.filter((m) => isTeamMode(m));
    const anyTeams = teamModes.filter((m) => !isTwoTeamMode(m));
    const ffaModes = current.modes.filter((m) => !isTeamMode(m) && !isCoopMode(m));
    const select = el('select', { id: 'arcade-teams', title: 'Quick setup: a starting point you can then change' }) as HTMLSelectElement;
    select.append(new Option('Quick setup…', ''));
    const teamWhy = (sizes: readonly number[]): string | null => {
      if (isTeamMode(s.mode)) return isTwoTeamMode(s.mode) && sizes.length > 2 ? `${MODE_LABEL[s.mode]} is two teams` : null;
      if (sizes.length > 2 ? !anyTeams.length : !teamModes.length) return 'no team mode on this map';
      return null;
    };
    const add = (group: HTMLOptGroupElement, value: string, label: string, players: number, off: string | null) => {
      const o = new Option(`${label} · ${players} players${off ? ` (${off})` : ''}`, value);
      o.disabled = !!off;
      group.append(o);
    };
    const shown = new Set<string>();
    const teams = el('optgroup', { label: 'Teams' });
    const ffa = el('optgroup', { label: 'Free-for-all' });
    for (const p of SETUP_PRESETS) {
      if (p.sizes) {
        shown.add(p.sizes.join(','));
        add(teams, p.sizes.join(','), p.label, presetPlayers(p), teamWhy(p.sizes));
      } else add(ffa, `ffa:${p.ffa}`, p.label, presetPlayers(p), isTeamMode(s.mode) || isCoopMode(s.mode) ? (ffaModes.length ? null : 'no free-for-all on this map') : null);
    }
    const more = el('optgroup', { label: 'More layouts' });
    for (const p of TEAM_PRESETS) if (!shown.has(p.join(','))) add(more, p.join(','), teamLayoutLabel(p), p.reduce((a, b) => a + b, 0), teamWhy(p));
    select.append(teams, ffa, more);
    select.addEventListener('change', () => {
      const v = select.value;
      if (!v) return;
      this.change((x) => {
        if (v.startsWith('ffa:')) {
          if (isTeamMode(x.mode) || isCoopMode(x.mode)) {
            x.mode = ffaModes.includes('core.deathmatch') ? 'core.deathmatch' : ffaModes[0]!;
            x.scoreLimit = BASE_RULES[x.mode].scoreLimit;
          }
          x.bots = Number(v.slice(4)) - 1;
          return;
        }
        const sizes = v.split(',').map(Number);
        if (!isTeamMode(x.mode)) {
          const pool = sizes.length > 2 ? anyTeams : teamModes;
          x.mode = pool.includes('core.tdm') ? 'core.tdm' : pool[0]!;
          x.scoreLimit = BASE_RULES[x.mode].scoreLimit;
        }
        x.teams = sizes;
        if (x.playerTeam !== undefined && x.playerTeam >= sizes.length) x.playerTeam = sizes.length - 1;
      });
    });
    return settingRow('Quick setup', 'A starting point: pick one, then change any team, size, name or colour. FFA presets set the bots for a free-for-all.', select);
  }

  /** Load a saved setup by name (its map must still exist). */
  private loadSaved(name: string): void {
    const found = listSetups().find((x) => x.name === name);
    const map = found && this.maps.find((m) => m.key === (found.setup as { map?: unknown }).map);
    const setup = found && map ? normalizeSetup(found.setup, map.modes) : null;
    if (!setup) {
      this.setStatus(`"${name}" can't be loaded: its map isn't here any more.`);
      return void this.refreshSetup();
    }
    this.setup = setup;
    this.setupName = name;
    setLastSetup(name);
    this.saveSetup();
    this.setStatus('');
    this.setupScroll = 0;
    this.go('play');
  }

  private saveSetup(): void {
    storage('cs.arcade', JSON.stringify(this.setup));
  }

  /** Start the match (`host`: and open a join code for friends). */
  private start(host = false): void {
    const m = this.currentMap();
    if (!m.map) return void m.load().then(() => this.currentMap() === m && this.start(host), () => this.setStatus(`${m.metadata.name} failed to load`));
    this.saveSetup();
    const { rules, fill } = rulesFromSetup(this.setup, m.map);
    // A co-op playlist starts on its own first map; the chain carries on from there.
    if (this.setup.mode === 'core.coop' && this.setup.playlist && PLAYLISTS.some((p) => p.id === this.setup.playlist)) return this.hooks.playPlaylist(this.setup.playlist, fill, this.setup.skill);
    // Team modes: bots fill every team to its size and you take a place on one; otherwise the bot filler counts you too.
    this.hooks.playLocal(m.map, rules, fill, this.setup.skill, host);
  }
  // ---------------------------------------------------------------- host: change map mid-match

  /**
   * The map picker for a host changing map mid-match (pause menu → Match →
   * Change map): the Arcade's map cards with their screenshots, for one mode
   * at a time (tabs: every mode the maps offer). `suiteOnly`: only maps of our
   * suite (servers and Host game); otherwise `own` maps join too (offline:
   * your MapMaker maps).
   */
  hostMapPicker(o: { mode: GameMode; current: string; suiteOnly: boolean; isSuite: (id: string) => boolean; own?: readonly ArcadeMap[]; onPick: (m: ArcadeMap, mode: GameMode) => void; onClose: () => void }): HTMLElement {
    const maps = [...this.maps.filter((m) => !o.suiteOnly || (!m.group && o.isSuite(m.metadata.id))), ...(o.suiteOnly ? [] : (o.own ?? []))];
    const modes = GAME_MODES.filter((mode) => maps.some((m) => m.modes.includes(mode)));
    let mode: GameMode = modes.includes(o.mode) ? o.mode : (modes[0] ?? 'core.deathmatch');
    let picked: ArcadeMap | null = null;
    const cards = el('div', { class: 'map-cards' });
    const tabs = el('div', { class: 'tabs hm-modes' });
    const chosen = el('span', { class: 'hm-chosen' });
    const go = el('button', { class: 'primary', id: 'hm-go', textContent: 'Change map', disabled: true });
    const close = el('button', { class: 'hm-close', id: 'hm-close', textContent: 'Cancel' });
    close.addEventListener('click', () => o.onClose());
    go.addEventListener('click', () => picked && o.onPick(picked, mode));
    const lazy = lazyPlans(cards);
    const draw = () => {
      tabs.replaceChildren(...modes.map((m) => {
        const b = el('button', { class: `tab${m === mode ? ' on' : ''}`, textContent: MODE_LABEL[m] });
        b.dataset.mode = m;
        b.addEventListener('click', () => {
          mode = m;
          if (picked && !picked.modes.includes(m)) picked = null;
          draw();
        });
        return b;
      }));
      cards.replaceChildren();
      let group: string | undefined;
      for (const m of maps.filter((x) => x.modes.includes(mode))) {
        if (m.group !== group) {
          group = m.group;
          if (group) cards.append(el('h4', { class: 'map-group', textContent: `${group} maps` }));
        }
        const here = m.metadata.id === o.current;
        const { card, draw: drawPlan } = mapCard(m, picked === m, here ? 'Playing now' : undefined);
        card.dataset.id = m.metadata.id;
        card.addEventListener('click', () => {
          picked = m;
          // Fetch it now, so Change map goes ahead the moment it's pressed.
          void m.load().catch(() => undefined);
          draw();
        });
        cards.append(card);
        lazy(card, drawPlan);
      }
      chosen.textContent = picked ? `${picked.metadata.name} · ${MODE_LABEL[mode]}` : 'Pick a map';
      go.disabled = !picked;
    };
    draw();
    return el('div', { class: 'host-maps', id: 'host-maps' }, el('div', { class: 'hm-head' }, el('h3', { textContent: 'Change map' }), tabs), cards, el('div', { class: 'hm-foot' }, chosen, close, go));
  }

  // ---------------------------------------------------------------- character select

  private characters(): HTMLElement {
    const saved = listCustomLooks();
    const family = (id: string) => partInfo(getLook(id).parts.find((p) => partInfo(p)?.slot === 'torso') ?? '')?.outfit ?? 'ranger';
    const all = [
      ...CORE_LOOKS.map((l) => ({ id: l.id, name: l.name, mine: false })),
      ...NPC_LOOKS.map((l) => ({ id: l.id, name: l.name, mine: false })),
      ...saved.map((s) => ({ id: s.id, name: s.name, mine: true })),
    ];
    const filters: [string, string][] = [['all', 'All'], ['originals', 'Originals'], ['ranger', 'Ranger'], ['peasant', 'Peasant'], ['athlete', 'Sportswear'], ['npc', 'NPCs'], ['mine', 'Yours']];
    const groupOf = (id: string) => (npcLookRole(id) ? 'npc' : getLook(id).whole ? 'originals' : family(id));
    const shown = all.filter((c) => this.charFilter === 'all' || (this.charFilter === 'mine' ? c.mine : !c.mine && groupOf(c.id) === this.charFilter));
    const selected = this.hovered ?? this.look;

    const tabs = el('div', { class: 'tabs' }, el('span', { class: 'bumper', textContent: 'Q' }));
    for (const [v, label] of filters) {
      const b = el('button', { class: `tab${v === this.charFilter ? ' on' : ''}`, textContent: label });
      b.addEventListener('click', () => ((this.charFilter = v), this.go('characters')));
      tabs.append(b);
    }
    tabs.append(el('span', { class: 'bumper', textContent: 'E' }));

    const grid = el('div', { class: 'char-grid loading' });
    // Every portrait on the tab appears at once, when the last one is ready (rendered and decoded), not face by face.
    const pending: Promise<void>[] = [];
    for (const c of shown) {
      const img = el('img', { alt: c.name });
      pending.push(
        this.portraits.get(c.id).then(
          async (src) => {
            img.src = src;
            await img.decode().catch(() => undefined);
          },
          () => undefined,
        ),
      );
      const tile = el('button', { class: `char-tile${c.id === this.look ? ' on' : ''}`, title: c.name }, img, el('span', { textContent: c.name }));
      tile.dataset.look = c.id;
      tile.addEventListener('mouseenter', () => this.preview(c.id));
      tile.addEventListener('focus', () => this.preview(c.id));
      tile.addEventListener('click', () => this.select(c.id));
      grid.append(tile);
    }
    void Promise.all(pending).then(() => grid.classList.remove('loading'));
    const design = el('button', { class: 'char-tile new', title: 'Design a new character' }, el('b', { textContent: '+' }), el('span', { textContent: 'Design new' }));
    design.addEventListener('click', () => this.hooks.openDesigner(this.look));
    grid.append(design);

    const info = el('div', { class: 'char-info panel' });
    this.fillInfo(info, selected);
    return el('div', { class: 'screen characters' }, el('div', { class: 'screen-head' }, el('h2', { innerHTML: 'Character <em>Select</em>' }), tabs), grid, info);
  }

  private fillInfo(info: HTMLElement, id: string): void {
    const l = getLook(id);
    const name = this.lookName(id);
    const img = el('img', { alt: '' });
    void this.portraits.get(id).then((src) => (img.src = src), () => undefined);
    const outfits = [...new Set(l.parts.map((p) => partInfo(p)?.outfit).filter((x): x is 'ranger' | 'peasant' | 'athlete' => !!x))].map((o) => FAMILY_LABEL[o]).join(' / ');
    const loadout = el(
      'div',
      { class: 'loadout' },
      el('h4', { textContent: 'Loadout' }),
      ...DEFAULT_RULES['core.deathmatch'].startingWeapons.map((w) => {
        const icon = weaponIcon(w, 'wicon large');
        return el('span', { title: getWeapon(w).displayName }, ...(icon ? [icon] : []), getWeapon(w).displayName);
      }),
      el('span', { title: 'Frag grenade (G)' }, '● Frag grenade'),
    );
    const customise = el('button', { textContent: 'Customise' });
    customise.addEventListener('click', () => this.hooks.openDesigner(id));
    // Whole-body originals are one model: nothing to swap, so no Customise.
    if (l.whole) customise.hidden = true;
    const role = npcLookRole(id);
    if (role) {
      // An NPC skin: their look only; you keep a player's body, health and loadout.
      const kind = NPC_ROLE_SPECS[role].creature ? 'Creature' : 'Soldier';
      info.replaceChildren(img, el('div', { class: 'who' }, el('h3', { textContent: name }), el('p', { textContent: `Play as the ${name}. Looks only: same hitbox, health and loadout as everyone else.` }), el('div', { class: 'tags' }, el('span', { textContent: 'NPC' }), el('span', { textContent: kind }))), loadout);
      return;
    }
    const bot = CHARACTER_PROFILES[id];
    const style = bot ? botStyleLine(bot) : '';
    info.replaceChildren(
      img,
      el('div', { class: 'who' }, el('h3', { textContent: name }), el('p', { textContent: LOOK_BIOS[id] ?? 'Your own design.' }), ...(style ? [el('p', { class: 'bot-style', textContent: style })] : []), el('div', { class: 'tags' }, ...(l.whole ? [el('span', { textContent: 'Original' })] : [el('span', { textContent: l.body === 'male' ? 'Male' : 'Female' }), el('span', { textContent: outfits })]))),
      loadout,
      customise,
    );
  }

  private preview(id: string): void {
    this.hovered = id;
    this.scene.setLook(id);
    const info = this.body.querySelector('.char-info');
    if (info) this.fillInfo(info as HTMLElement, id);
  }

  private select(id: string): void {
    this.useLook(id);
    this.go('home');
  }

  // ---------------------------------------------------------------- online & options

  private online(): HTMLElement {
    const name = el('input', { id: 'name', value: this.name, maxLength: 24, autocomplete: 'off', disabled: this.verified, title: this.verified ? 'Your username: change it in Profile' : '' });
    const server = el('input', { id: 'server', value: this.server, autocomplete: 'off' });
    const img = el('img', { alt: '' });
    void this.portraits.get(this.look).then((src) => (img.src = src), () => undefined);
    const change = el('button', { textContent: 'Change' });
    change.addEventListener('click', () => this.go('characters'));
    const join = el('button', { class: 'primary', id: 'join-online', type: 'submit', textContent: 'Join server' });
    const form = el(
      'form',
      { class: 'form panel' },
      el('label', {}, 'Name', name),
      el('label', {}, 'Server', server),
      el('label', {}, 'Character', el('div', { class: 'current-look' }, img, el('b', { textContent: this.lookName(this.look) }), change)),
      join,
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!this.verified) {
        this.name = name.value.trim() || this.name;
        storage('cs.name', this.name);
      }
      this.server = server.value.trim();
      storage('cs.server', this.server);
      this.hooks.playOnline(this.server, this.displayName);
    });
    // A friend hosting from their own match (pause menu → Host game) gives you a six-letter code.
    const code = el('input', { id: 'join-code', placeholder: 'ABC123', maxLength: 7, autocomplete: 'off' });
    code.style.textTransform = 'uppercase';
    const joinCode = el('button', { class: 'primary', id: 'join-by-code', type: 'submit', textContent: 'Join by code' });
    const codeForm = el('form', { class: 'form panel' }, el('h4', { textContent: "Join a friend's game" }), el('label', {}, 'Code', code), joinCode, el('p', { class: 'hint', textContent: 'Your friend hosts from their match: Esc → Host game, then sends you the code or link.' }));
    codeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const c = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (c.length !== 6) return void (code.style.outline = '2px solid #e74c3c');
      if (!this.verified) {
        this.name = name.value.trim() || this.name;
        storage('cs.name', this.name);
      }
      this.hooks.joinCode(c, this.displayName);
    });
    // Hosting: from a match (nothing to install), or a dedicated server (the optional Host Service, explained on /host).
    const hosting = el('div', { class: 'form panel host-options' }, el('h4', { textContent: 'Host a game' }), el('p', { class: 'hint', textContent: 'From any match: Esc → Host game. Nothing to install.' }), el('a', { href: '/host', id: 'host-dedicated', class: 'link', textContent: 'Host a dedicated server…' }));
    return el('div', { class: 'screen online' }, el('div', { class: 'screen-head' }, el('h2', { innerHTML: 'Online <em>Play</em>' })), el('div', { class: 'online-grid' }, this.gameBrowser(), el('div', { class: 'online-side' }, codeForm, hosting, this.lanPanel(), form)));
  }

  /** Online → LAN: dedicated servers on your network (see game/lan.ts for how, and the limits). */
  private lanPanel(): HTMLElement {
    const list = el('div', { class: 'gb-list lan-list', id: 'lan-list' });
    const status = el('span', { class: 'gb-status' });
    const scan = el('button', { class: 'tab', id: 'lan-scan', textContent: 'Scan' });
    const add = el('input', { id: 'lan-add', placeholder: '192.168.1.20 or host:port', autocomplete: 'off', title: 'Add a computer to look on' });
    const addBtn = el('button', { class: 'tab', textContent: 'Add' });
    const run = async () => {
      status.textContent = 'Looking…';
      const { scanLan } = await import('../game/lan.ts');
      const { games, blocked } = await scanLan();
      status.textContent = `${games.length} found`;
      list.replaceChildren(
        ...(games.length
          ? games.map((g) => {
              const join = el('button', { class: 'primary', textContent: 'Join' });
              join.addEventListener('click', () => this.hooks.playOnline(g.url, this.displayName));
              return el('div', { class: 'gb-row lan-row' }, el('div', { class: 'gb-name' }, el('b', { textContent: g.info.name }), el('small', { textContent: `${g.url.replace(/^ws:\/\//, '')} · ${MODE_LABEL[g.info.mode] ?? g.info.mode}` })), el('span', { class: 'gb-map', textContent: g.info.map }), el('span', { class: 'gb-players', textContent: `${g.info.players} + ${g.info.bots} bots` }), join);
            })
          : [el('p', { class: 'gb-empty', textContent: 'No servers found. Start one with `pnpm dev:server` (it prints its LAN address), add that computer above, or run a community hub on your network (`pnpm dev:hub`) to search the whole network.' })]),
        ...(blocked ? [el('p', { class: 'hint', textContent: 'This page is on https, so it can only reach servers on this computer directly; open the game over http on your network (or run a hub) to see the others.' })] : []),
      );
    };
    addBtn.addEventListener('click', () => {
      const v = add.value.trim();
      if (!v) return;
      void import('../game/lan.ts').then(({ saveLanHosts, savedLanHosts }) => {
        saveLanHosts([...savedLanHosts(), v]);
        add.value = '';
        void run();
      });
    });
    scan.addEventListener('click', () => void run());
    // Looking on this computer (localhost) makes browsers ask "access other apps and services on this
    // device?". Only do that by itself on a page served from this computer or the local network; on
    // the public site it waits for Scan, so the question only comes when you asked for it.
    if (/^(localhost|127\.|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname)) void run();
    else status.textContent = 'Press Scan to look for servers on this computer and your network (your browser asks first).';
    return el('div', { class: 'form panel lan-panel' }, el('div', { class: 'gb-top' }, el('h4', { textContent: 'On your network (LAN)' }), status, scan), list, el('div', { class: 'gb-hub' }, add, addBtn));
  }

  /** Sign in / out (optional: playing never needs an account) and the privacy page. */
  private footerLinks(): HTMLElement {
    const box = el('div', { class: 'menu-links' });
    // Your profile: the username you play under (never your Google name), or a prompt to pick one.
    const username = cachedProfile()?.username;
    const prof = el('button', { class: 'link', id: 'profile-link', textContent: currentAccount() ? (username ? `@${username}` : 'Pick a username') : 'Profile' });
    prof.addEventListener('click', () => this.go('profile'));
    if (signInAvailable()) {
      const who = currentAccount();
      if (who) {
        const out = el('button', { class: 'link', id: 'sign-out', textContent: 'Sign out' });
        out.addEventListener('click', () => signOut());
        box.append(prof, out);
      } else {
        const inBtn = el('button', { class: 'link', id: 'sign-in', textContent: 'Sign in' });
        inBtn.dataset.tip = 'Optional: a ToshiroPlay account (Google). Playing never needs one.';
        inBtn.addEventListener('click', () => void signIn());
        box.append(inBtn, prof);
      }
    } else box.append(prof);
    box.append(el('a', { href: '/privacy/', target: '_blank', rel: 'noopener', id: 'privacy-link', textContent: 'Privacy' }));
    return box;
  }

  /** A listing's map: its picture and plan when it is one of the built-in maps, and its name. */
  private listingMap(g: LobbyListing): HTMLElement {
    const name = el('span', { class: 'gb-map-name', textContent: g.map });
    const known = g.mapId && !g.community ? this.maps.find((m) => !m.group && m.metadata.id === g.mapId) : undefined;
    if (!known) return el('span', { class: 'gb-map' }, name);
    const thumbs = mapThumbs(known, true);
    requestAnimationFrame(thumbs.draw);
    return el('span', { class: 'gb-map' }, thumbPair(thumbs, 'gb-thumbs'), name);
  }

  /** Public games players are hosting from their browsers (Host game → List in the game browser). */
  private gameBrowser(): HTMLElement {
    const list = el('div', { class: 'gb-list' });
    const status = el('span', { class: 'gb-status' });
    const refresh = el('button', { class: 'tab', textContent: 'Refresh' });
    const hub = el('input', { value: hubSetting(), placeholder: 'host:port', autocomplete: 'off', title: 'Community hub address' });
    const saveHubBtn = el('button', { class: 'tab', textContent: 'Use' });
    saveHubBtn.addEventListener('click', () => (saveHub(hub.value), void load()));
    const row = (g: LobbyListing) => {
      const join = el('button', { class: 'primary', textContent: g.players >= g.max ? 'Full' : 'Join' });
      join.disabled = g.players >= g.max;
      join.addEventListener('click', () => this.hooks.joinCode(g.code, this.displayName));
      const dedicated = g.hostType === 'dedicated';
      const hosted = el('span', { class: `gb-tag${dedicated ? ' dedicated' : ''}`, textContent: dedicated ? 'Dedicated host' : 'Player-hosted' });
      hosted.dataset.tip = dedicated
        ? "Runs on a player's always-on computer (Tile Trigger Host Service), not in a browser tab: it keeps going when people come and go. Community-run, not an official server: its owner decides what happens."
        : "Runs in the host's browser: it ends if they leave, and the host's game decides what happens (play with people you trust for anything serious).";
      const tags = [hosted];
      if (g.community) {
        const community = el('span', { class: 'gb-tag community', textContent: 'Community map' });
        community.dataset.tip = "Made by a player in MapMaker, not one of the game's own maps (checked when it loads: it can't run code or bring outside files).";
        tags.push(community);
      }
      if (g.region) {
        const near = g.region === myRegion();
        const where = el('span', { class: `gb-tag region${near ? ' near' : ''}`, textContent: regionLabel(g.region) });
        where.dataset.tip = near ? 'In your region: usually the smoothest games.' : 'Hosted in another region: expect more delay.';
        tags.push(where);
      }
      if (g.relay) {
        const relay = el('span', { class: 'gb-tag relay', textContent: 'Relay' });
        relay.dataset.tip = 'The host set up a relay, so players on strict networks can usually still connect.';
        tags.push(relay);
      }
      return el(
        'div',
        { class: 'gb-row' },
        el('div', { class: 'gb-name' }, el('b', { textContent: g.name }), el('small', { textContent: `hosted by ${g.host}` }), el('div', { class: 'gb-tags' }, ...tags)),
        this.listingMap(g),
        el('span', { class: 'gb-mode', textContent: MODE_LABEL[g.mode] ?? g.mode }),
        el('span', { class: 'gb-players', textContent: `${g.players}/${g.max}` }),
        join,
      );
    };
    const load = async () => {
      if (!hubSetting()) {
        status.textContent = '';
        list.replaceChildren(el('p', { class: 'gb-empty', textContent: 'No community hub set. Enter one below (run `pnpm dev:hub` for a local one), or use a join code from a friend.' }));
        return;
      }
      status.textContent = 'Refreshing…';
      try {
        // Games in your region first (smoother), then the rest, each as the hub lists them.
        const mine = myRegion();
        const games = (await fetchGames()).map((g, i) => ({ g, i })).sort((a, b) => Number(b.g.region === mine) - Number(a.g.region === mine) || a.i - b.i).map((x) => x.g);
        status.textContent = `${games.length} game${games.length === 1 ? '' : 's'} · updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        list.replaceChildren(...(games.length ? [el('div', { class: 'gb-row gb-head' }, el('span', { textContent: 'Game' }), el('span', { textContent: 'Map' }), el('span', { textContent: 'Mode' }), el('span', { textContent: 'Players' }), el('span')), ...games.map(row)] : [el('p', { class: 'gb-empty', textContent: 'No public games right now. Host one: start a match, press Esc, Host game, and tick "List in the game browser".' })]));
      } catch (e) {
        status.textContent = '';
        list.replaceChildren(el('p', { class: 'gb-empty', textContent: `Couldn't reach the game browser (${(e as Error).message}). Check the hub address below.` }));
      }
    };
    refresh.addEventListener('click', () => void load());
    void load();
    this.browserTimer = window.setInterval(() => void load(), 10_000);
    return el(
      'div',
      { class: 'panel game-browser' },
      el('div', { class: 'gb-top' }, el('h3', { class: 'panel-title', textContent: 'Game browser' }), status, refresh),
      list,
      el('div', { class: 'gb-hub' }, el('span', { textContent: 'Community hub' }), hub, saveHubBtn),
    );
  }

  // ---------------------------------------------------------------- profile

  /**
   * Your profile: signed in, your username (your name in every match, a
   * verified account) and region, kept on the game server; signed out, your
   * region, and how signing in gets you a username. Your Google name and
   * email are never shown.
   */
  private profile(): HTMLElement {
    const who = currentAccount();
    const p = cachedProfile();
    const regions = el('select', { id: 'profile-region' }, ...REGIONS.map((r) => el('option', { value: r.id, textContent: r.label, selected: r.id === myRegion() })));
    const regionNote = el('small', { class: 'hint', textContent: 'The game browser shows games in your region first.' });
    regions.addEventListener('change', () => {
      setRegion(regions.value as Region).then(
        () => (regionNote.textContent = 'Saved.'),
        (e: Error) => (regionNote.textContent = `Not saved: ${e.message}`),
      );
    });
    const img = el('img', { alt: '' });
    void this.portraits.get(this.look).then((src) => (img.src = src), () => undefined);
    const change = el('button', { type: 'button', textContent: 'Change' });
    change.addEventListener('click', () => this.go('characters'));
    const look = el('label', {}, 'Character', el('div', { class: 'current-look' }, img, el('b', { textContent: this.lookName(this.look) }), change));
    const privacy = el('p', { class: 'hint', textContent: 'Your Google name and email are never shown to anyone: players see your username.' });
    const head = el('div', { class: 'screen-head' }, el('h2', { innerHTML: 'Your <em>Profile</em>' }));
    if (!who) {
      const signin = el('button', { type: 'button', class: 'primary', id: 'profile-sign-in', textContent: 'Sign in' });
      signin.addEventListener('click', () => void signIn());
      const parts: HTMLElement[] = [
        el('p', { textContent: `You're playing as a guest: "${this.name}", marked GUEST in online matches.` }),
        ...(signInAvailable() ? [el('p', { class: 'hint', textContent: 'Sign in (a ToshiroPlay account, with Google) to pick a username: your name in every match, shown with a ✓ so nobody can pass for you. Playing never needs an account.' }), signin] : []),
      ];
      return el('div', { class: 'screen profile' }, head, el('div', { class: 'form panel', id: 'profile-form' }, ...parts, el('label', {}, 'Region', regions), regionNote, look, privacy));
    }
    const name = el('input', { id: 'profile-username', value: p?.username ?? '', maxLength: 16, placeholder: 'pick a username', autocomplete: 'off', spellcheck: false });
    const status = el('small', { class: 'hint', id: 'profile-name-status', textContent: p?.username ? '' : '3–16 letters, numbers, _ - or . — unique in Tile Trigger' });
    const save = el('button', { type: 'submit', class: 'primary', id: 'profile-save', textContent: p?.username ? 'Change username' : 'Take this username', disabled: true });
    let timer = 0;
    const check = () => {
      const v = name.value.trim();
      window.clearTimeout(timer);
      save.disabled = true;
      if (!v || v === p?.username) return void (status.textContent = '');
      const local = usernameProblem(v);
      if (local) return void (status.textContent = `Can't use that: ${local}`);
      status.textContent = 'Checking…';
      timer = window.setTimeout(() => {
        checkUsername(v).then(
          (r) => {
            if (name.value.trim() !== v) return;
            status.textContent = r.ok ? `${v} is free` : `Can't use that: ${r.problem}`;
            save.disabled = !r.ok;
          },
          (e: Error) => (status.textContent = `Couldn't check: ${e.message}`),
        );
      }, 400);
    };
    name.addEventListener('input', check);
    const form = el('form', { class: 'form panel', id: 'profile-form' }, el('label', {}, 'Username', name), status, save, el('label', {}, 'Region', regions), regionNote, look, privacy);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      save.disabled = true;
      status.textContent = 'Saving…';
      saveProfile({ username: name.value.trim() }).then(
        (saved) => {
          status.textContent = 'Saved: that is your name in every match now.';
          this.applyProfile(saved.username);
        },
        (err: Error) => {
          status.textContent = `Not saved: ${err.message}`;
          save.disabled = false;
        },
      );
    });
    // The account ID (Cognito `sub`) is what names the game's owner on the server (deploy --owner).
    const id = el('button', { type: 'button', class: 'link', id: 'account-id', textContent: 'Copy my account ID' });
    id.addEventListener('click', () => void navigator.clipboard?.writeText(who.sub).then(() => (id.textContent = 'Account ID copied'), () => (id.textContent = who.sub)));
    return el('div', { class: 'screen profile' }, head, form, el('p', { class: 'hint profile-id' }, id));
  }

  private options(): HTMLElement {
    const name = el('input', { value: this.name, maxLength: 24, disabled: this.verified, title: this.verified ? 'Your username: change it in Profile' : '' });
    const clan = el('input', { value: this.clan, maxLength: 5, placeholder: 'none' });
    clan.addEventListener('change', () => {
      this.clan = clan.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase();
      clan.value = this.clan;
      storage('cs.clan', this.clan);
    });
    name.addEventListener('change', () => {
      if (this.verified) return;
      this.name = name.value.trim() || this.name;
      storage('cs.name', this.name);
    });
    const volume = el('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(this.audio.getVolume() * 100)) });
    volume.addEventListener('input', () => {
      this.audio.setVolume(Number(volume.value) / 100);
      storage('cs.volume', String(this.audio.getVolume()));
    });
    const graphics = el('select', {}, ...GRAPHICS_QUALITIES.map((q) => el('option', { value: q, textContent: { low: 'Low — fastest', medium: 'Medium — sun shadows', high: 'High — far shadows, ambient occlusion, bloom' }[q], selected: q === loadGraphicsQuality() })));
    graphics.addEventListener('change', () => saveGraphicsQuality(graphics.value as GraphicsQuality));
    const renderScale = el('select', {}, ...RENDER_SCALES.map((r) => el('option', { value: r, textContent: RENDER_SCALE_LABELS[r], selected: r === loadRenderScale() })));
    renderScale.addEventListener('change', () => saveRenderScale(renderScale.value as RenderScale));
    const frameCap = el('select', {}, ...FRAME_CAPS.map((c) => el('option', { value: String(c), textContent: c ? `${c} fps` : 'Unlimited (screen rate)', selected: c === currentFrameCap() })));
    frameCap.addEventListener('change', () => saveFrameCap(Number(frameCap.value) as FrameCap));
    const fullscreen = el('button', { type: 'button' });
    bindFullscreenButton(fullscreen);
    const mouse = loadMousePrefs();
    const sens = el('input', { type: 'range', min: '0.2', max: '4', step: '0.1', value: String(mouse.sensitivity) });
    const sensVal = el('output', { textContent: `${mouse.sensitivity.toFixed(1)}×` });
    const invert = el('input', { type: 'checkbox', checked: mouse.invertY });
    const assist = el('input', { type: 'checkbox', checked: mouse.aimAssist });
    const mouseChanged = () => {
      saveMousePrefs({ sensitivity: Number(sens.value) || 1, invertY: invert.checked, aimAssist: assist.checked });
      sensVal.textContent = `${(Number(sens.value) || 1).toFixed(1)}×`;
    };
    sens.addEventListener('input', mouseChanged);
    invert.addEventListener('change', mouseChanged);
    assist.addEventListener('change', mouseChanged);
    // A TURN relay for Host game / Join by code when networks block direct connections.
    const relay = loadRelay();
    const relayUrl = el('input', { value: relay?.url ?? '', placeholder: 'turn:relay.example.com:3478', autocomplete: 'off' });
    const relayUser = el('input', { value: relay?.user ?? '', placeholder: 'username', autocomplete: 'off' });
    const relayPass = el('input', { type: 'password', value: relay?.pass ?? '', placeholder: 'password', autocomplete: 'off' });
    const relayChanged = () => saveRelay({ url: relayUrl.value, user: relayUser.value.trim(), pass: relayPass.value });
    for (const f of [relayUrl, relayUser, relayPass]) f.addEventListener('change', relayChanged);
    const bindings: [string, string][] = [
      ['Move', 'WASD'],
      ['Jump (stands you up)', 'Space'],
      ['Sprint (uses stamina)', 'Shift'],
      ['Crouch / prone (toggle)', 'C / Z'],
      ['Fire', 'Left mouse · F'],
      ['Aim down sights / scope (wheel: scope zoom)', 'Right mouse · X'],
      ['Look (touchpad / keyboard)', 'Arrow keys'],
      ['Second trigger (alt fire)', 'Middle mouse · V'],
      ['Throw grenade or mine', 'Hold G to aim, let go to throw'],
      ['Hold breath (scoped)', 'Shift'],
      ['Reload', 'R'],
      ['Use · get in or out of a vehicle', 'E'],
      ['Third person · in a vehicle: cockpit or chase camera', 'H'],
      ['Weapons', '1–9 · Wheel · Q'],
      ['Scores', 'Tab'],
      ['Fullscreen', 'F11 · Alt+Enter'],
      ['Controller: move / look', 'Left stick / right stick'],
      ['Controller: fire / aim', 'RT / LT'],
      ['Controller: jump / crouch', 'A / B'],
      ['Controller: reload / next weapon', 'X / Y'],
      ['Controller: use / throw', 'RB / hold LB'],
      ['Controller: sprint / ping', 'L3 / D-pad up'],
      ['Controller: third person / vehicle camera', 'R3'],
    ];
    const bindingList = (rows: [string, string][]) => el('div', { class: 'controls' }, ...rows.map(([a, k]) => el('div', {}, el('span', { textContent: a }), kbd(k))));
    const pad = 'Controller: ';
    const keyboard = bindingList(bindings.filter(([a]) => !a.startsWith(pad)));
    const controller = bindingList(bindings.filter(([a]) => a.startsWith(pad)).map(([a, k]) => [a.slice(pad.length).replace(/^./, (c) => c.toUpperCase()), k]));
    // Crosshair styles and colours (reference board: crosshair styles).
    const crosshairs = el('div', { class: 'crosshair-pick' });
    const colours = el('div', { class: 'crosshair-pick colours' });
    const renderPick = () => {
      const { style, colour } = crosshairSetting();
      crosshairs.replaceChildren(
        ...CROSSHAIR_STYLES.map((s) => {
          const mark = el('i', { class: 'xh' });
          mark.dataset.style = s;
          const b = el('button', { class: `xh-opt${s === style ? ' on' : ''}`, title: s }, mark);
          b.style.setProperty('--xh', colour);
          b.addEventListener('click', () => (saveCrosshair({ style: s, colour }), renderPick()));
          return b;
        }),
      );
      colours.replaceChildren(
        ...CROSSHAIR_COLOURS.map((c) => {
          const b = el('button', { class: `xh-col${c === colour ? ' on' : ''}`, title: c });
          b.style.background = c;
          b.addEventListener('click', () => (saveCrosshair({ style, colour: c }), renderPick()));
          return b;
        }),
      );
    };
    renderPick();
    const hitStyle = el('select', {}, ...HITMARKER_STYLES.map((h) => el('option', { value: h, textContent: { ticks: 'Ticks (Infinite Warfare style)', diamond: 'Diamond', off: 'Off' }[h], selected: h === hitmarkerSetting() })));
    hitStyle.addEventListener('change', () => saveHitmarker(hitStyle.value as HitmarkerStyle));
    const markers = markerSetting();
    const allySel = el('select', {}, ...ALLY_MARKER_COLOURS.map((c) => el('option', { value: c, textContent: { team: 'Team colour', '#3ad1ff': 'Cyan', '#2ecc71': 'Green', '#ffffff': 'White' }[c], selected: c === markers.ally })));
    const enemySel = el('select', {}, el('option', { value: '#ff3b3b', textContent: 'Red', selected: markers.enemy !== null }), el('option', { value: '', textContent: 'Off', selected: markers.enemy === null }));
    const saveMarks = () => saveMarkers({ ally: allySel.value, enemy: enemySel.value || null });
    allySel.addEventListener('change', saveMarks);
    enemySel.addEventListener('change', saveMarks);
    // One section at a time beside a list of sections; every setting a row: what it is (and what it does) on
    // the left, its control on the right.
    const row = (label: string, control: HTMLElement, help?: string) =>
      el('div', { class: 'opt-row' }, el('div', { class: 'opt-label' }, el('span', { textContent: label }), ...(help ? [el('small', { textContent: help })] : [])), el('div', { class: 'opt-control' }, control));
    const toggle = (input: HTMLInputElement) => el('label', { class: 'switch' }, input, el('span', { class: 'switch-track' }));
    const volumeVal = el('output', { textContent: `${volume.value}%` });
    volume.addEventListener('input', () => (volumeVal.textContent = `${volume.value}%`));
    const crosshairPreview = el('div', { class: 'opt-stack' }, crosshairs, colours);
    const sections: [string, string, HTMLElement[]][] = [
      ['general', 'General', [
        row('Player name', name, this.verified ? 'Your username: change it in Profile.' : 'What other players see.'),
        row('Clan tag', clan, 'Up to five letters, shown before your name.'),
        row('Volume', el('span', { class: 'opt-range' }, volume, volumeVal)),
      ]],
      ['display', 'Display', [
        row('Fullscreen', fullscreen, 'F11 or Alt+Enter also switch it.'),
        row('Graphics', graphics, 'Applies from your next match. Medium suits most computers; drop to Low if the game stutters, try High on a strong graphics card.'),
        row('Render scale', renderScale, 'Pixels drawn per screen point. Native on a Retina screen is four times the work; Auto is barely softer and much cooler and quieter on laptops.'),
        row('Frame cap', frameCap, 'Most frames drawn a second. 60 is smooth and keeps laptops cool.'),
      ]],
      ['controls', 'Controls', [
        row('Mouse sensitivity', el('span', { class: 'opt-range' }, sens, sensVal)),
        row('Invert look', toggle(invert), 'Mouse up looks down.'),
        row('Aim assist', toggle(assist), 'Helps on a touchpad: look with the arrow keys, fire with F and aim with X. Controllers work too (click into the game first).'),
        el('h3', { class: 'opt-sub', textContent: 'Keyboard and mouse' }),
        keyboard,
        el('h3', { class: 'opt-sub', textContent: 'Controller' }),
        controller,
      ]],
      ['hud', 'HUD', [
        row('Crosshair', crosshairPreview, 'Its shape, then its colour.'),
        row('Hit marker', hitStyle, 'What flashes on the crosshair when you hit someone.'),
        row('Teammate marker', allySel),
        row('Enemy marker', enemySel, 'Off: only teammates are marked.'),
      ]],
      ['online', 'Online', [
        el('p', { class: 'opt-note', textContent: "If a friend finds your game but can't connect, your networks block direct connections. A TURN relay passes the game through a server instead: make a free account (e.g. metered.ca → TURN server), paste its address and login here, and invite your friend again. The invite link carries these settings." }),
        row('Relay address', relayUrl),
        row('Username', relayUser),
        row('Password', relayPass),
      ]],
    ];
    if (!sections.some(([id]) => id === this.optionsTab)) this.optionsTab = 'general';
    const nav = el('nav', { class: 'opt-nav' });
    const body = el('div', { class: 'opt-body' });
    const show = (id: string) => {
      this.optionsTab = id;
      const [, title, rows] = sections.find(([s]) => s === id)!;
      for (const b of nav.querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === id);
      body.replaceChildren(el('h3', { class: 'opt-title', textContent: title }), ...rows);
      body.scrollTop = 0;
    };
    for (const [id, label] of sections) {
      const b = el('button', { type: 'button', textContent: label });
      b.dataset.tab = id;
      b.addEventListener('click', () => show(id));
      nav.append(b);
    }
    show(this.optionsTab);
    return el(
      'div',
      { class: 'screen options' },
      el('div', { class: 'screen-head' }, el('h2', { innerHTML: 'Game <em>Options</em>' })),
      el('div', { class: 'opt-layout panel' }, nav, body),
    );
  }

  /** The section of Options last open (Q / E step through them). */
  private optionsTab = 'general';
  private static readonly OPTION_TABS = ['general', 'display', 'controls', 'hud', 'online'];

  // ---------------------------------------------------------------- keyboard

  private onKey(e: KeyboardEvent): void {
    if (this.root.hidden || (e.target instanceof HTMLInputElement && e.key !== 'Escape')) return;
    if (e.key === 'Escape' && this.screen !== 'home') {
      e.preventDefault();
      this.go('home');
    } else if (this.screen === 'home' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      this.setNav(this.navIndex + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (this.screen === 'home' && e.key === 'Enter') {
      e.preventDefault();
      this.navItems[this.navIndex]!.act();
    } else if (this.screen === 'play' && e.key === 'Enter' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement || (e.target as HTMLElement | null)?.tagName === 'SUMMARY')) {
      e.preventDefault();
      this.start();
    } else if (this.screen === 'play' && (e.key === 'q' || e.key === 'e') && !(e.target instanceof HTMLSelectElement)) {
      const m = this.currentMap();
      const i = m.modes.indexOf(this.setup.mode);
      this.setMode(m.modes[(i + (e.key === 'e' ? 1 : m.modes.length - 1)) % m.modes.length]!);
    } else if (this.screen === 'options' && (e.key === 'q' || e.key === 'e') && !(e.target instanceof HTMLSelectElement)) {
      const tabs = FrontEnd.OPTION_TABS;
      this.optionsTab = tabs[(tabs.indexOf(this.optionsTab) + (e.key === 'e' ? 1 : tabs.length - 1)) % tabs.length]!;
      this.go('options');
    } else if (this.screen === 'characters' && (e.key === 'q' || e.key === 'e')) {
      const order = ['all', 'originals', 'ranger', 'peasant', 'athlete', 'npc', 'mine'];
      this.charFilter = order[(order.indexOf(this.charFilter) + (e.key === 'e' ? 1 : order.length - 1)) % order.length]!;
      this.go('characters');
    } else if (this.screen === 'characters' && e.key === 'd') {
      this.hooks.openDesigner(this.look);
    } else if (this.screen === 'characters' && e.key === 'c') {
      this.hooks.openDesigner(this.hovered ?? this.look);
    } else if (this.screen === 'characters' && e.key === 'Enter' && this.hovered) {
      this.select(this.hovered);
    }
  }
}

/** A small colour chip. */
function swatch(color: string): HTMLElement {
  const s = document.createElement('span');
  s.className = 'swatch';
  s.style.background = color;
  return s;
}

/** How a character plays as a bot, in a line: its style, two strongest traits and favourite weapon. */
function botStyleLine(p: BotProfile): string {
  const style = p.tags.includes('ARENA') ? 'Arena' : p.tags.includes('TACTICAL') ? 'Tactical' : p.tags.includes('BERSERKER') ? 'Berserker' : p.tags.includes('SNIPER') ? 'Sniper' : 'Balanced';
  const traits: [keyof BotProfile, string][] = [['aggression', 'aggressive'], ['accuracy', 'accurate'], ['selfPreservation', 'cautious'], ['tacticalAwareness', 'tactical'], ['itemGreed', 'item hunter'], ['exploration', 'explorer'], ['pursuitPersistence', 'relentless'], ['teamLoyalty', 'team player'], ['objectivePriority', 'objective-minded'], ['rangePreference', 'long range']];
  const top = traits.map(([k, label]) => [p[k] as number, label] as const).filter(([v]) => v >= 70).sort((a, b) => b[0] - a[0]).slice(0, 2).map(([, l]) => l);
  const fav = p.weaponPreferences[0] ? getWeapon(p.weaponPreferences[0]).displayName : null;
  return `As a bot: ${style}${top.length ? ` · ${top.join(', ')}` : ''}${fav ? ` · favours the ${fav}` : ''}`;
}
