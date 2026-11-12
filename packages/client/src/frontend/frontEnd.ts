import { roomLightsOn, saveRoomLights } from '../game/roomLights.ts';
import {
  BREAKTHROUGH_POOL_MAX,
  breakthroughSectors,
  CHARACTER_GROUP_LABELS,
  CHARACTER_PROFILES,
  CORE_LOOKS,
  EXPERIMENTAL_SECTION,
  characterSections,
  characterTier,
  botCastLabel,
  botSetLabel,
  getWeaponSet,
  matchWeaponSet,
  mapWeaponSet,
  setThrowables,
  THROWABLE_DEFS,
  weaponSetList,
  WEATHER_PRESETS,
  isWeatherChoice,
  mapWeather,
  weatherLabel,
  type BotProfile,
  type BotSet,
  NPC_LOOKS,
  PLAYER_NPC_LOOKS,
  NPC_ROLE_SPECS,
  npcLookRole,
  lookGroup,
  validLookId,
  DEFAULT_LOOK,
  DEFAULT_RULES,
  GAME_MODES,
  raceTrack,
  MODE_LABELS,
  isTeamMode,
  LOOK_BIOS,
  TEAM_PRESETS,
  SETUP_PRESETS,
  BIG_MATCH,
  PARTY_PRESETS,
  applyParty,
  capMessage,
  getVariant,
  isCoopMode,
  isTwoTeamMode,
  mapPickTeams,
  matchingPreset,
  modeOptions,
  normalizeSetup,
  partyMapMove,
  partyMode,
  partyOn,
  partyUnavailable,
  peopleAndBots,
  playerCap,
  presetPatch,
  presetPlayers,
  rulesFromSetup,
  setVariant,
  DEFAULT_FIRETEAM_SIZE,
  fireteamMode,
  setupFamily,
  setupFit,
  mapPlayerCaps,
  capsLine,
  setupLimits,
  setupPlayers,
  setupSummary,
  setupTeams,
  setupYourTeam,
  sizePresets,
  variantStates,
  withSetupLimits,
  limitsScale,
  scoreStep,
  SCORE_LIMIT_MAX,
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
  STAT_SPECS,
  classStats,
  lookStats,
  type StatKey,
} from '@tiletrigger/shared';
import { DEFAULT_WHEEL_KEY, RESERVED_KEYS, keyLabel, loadMousePrefs, loadWheelKey, saveMousePrefs, saveWheelKey } from '../game/input.ts';
import { loadRelay, saveRelay } from '../game/relay.ts';
import { loadSteerMode, saveSteerMode, type SteerMode } from '../game/vehicleCamera.ts';
import { currentAccount, signIn, signInAvailable, signOut } from '../account.ts';
import { cachedProfile, checkUsername, loadProfile, myRegion, saveProfile, setRegion } from '../profile.ts';
import { installTooltips } from './tooltip.ts';
import { deviceMaxPlayers, isTouchDevice } from '../touchDevice.ts';
import { FIRST_PERSON_LABELS, FIRST_PERSON_MODES, FRAME_CAPS, GRAPHICS_QUALITIES, RENDER_SCALES, RENDER_SCALE_LABELS, currentFrameCap, loadFirstPersonMode, loadGraphicsQuality, loadRenderScale, saveFirstPersonMode, saveFrameCap, saveGraphicsQuality, saveRenderScale, type FirstPersonMode, type FrameCap, type GraphicsQuality, type RenderScale } from '../game/graphicsSettings.ts';
import { loadPerfOverlay, savePerfOverlay } from '../game/perfPrefs.ts';
import { reduceFlashing, saveReduceFlashing } from '../game/reduceFlashing.ts';
import { hitboxOverlayAllowed, loadHitboxOverlay, saveHitboxOverlay } from '../game/hitboxPrefs.ts';
import { fetchGames, hubSetting, saveHub } from '../game/hub.ts';
import { communityMapRow, communityPanel, reportButton } from './communityUi.ts';
import type { AudioSystem } from '../audio/audio.ts';
import { listCustomLooks } from '../designer/customLooks.ts';
import { mapThumbs, thumbPair, type MapThumbs } from './mapThumbs.ts';
import type { MapMeta } from '../mapIndex.ts';
import { GLYPHS, botCastSelect, choice, field, fitChip, fitList, fold as foldEl, glyph, inert, infoTip, limitsText, numbered, numberedRow, segmented, settingRow, sizeChips, stepper, weatherSelect, teamEditor, weaponSetSelect, type ChoiceOption } from './setupControls.ts';
import { deleteSetup, lastSetup, listSetups, saveSetupAs, setLastSetup } from './savedSetups.ts';
import type { MenuScene } from './menuScene.ts';
import { weaponIcon } from './weaponIcons.ts';
import { autoReloadOn, damageNumbersOn, saveAutoReload, saveDamageNumbers, saveSprayReadout, sprayReadoutOn } from '../game/combatReadouts.ts';
import { ALLY_MARKER_COLOURS, CROSSHAIR_COLOURS, CROSSHAIR_STYLES, HITMARKER_STYLES, markerSetting, saveMarkers, crosshairSetting, hitmarkerSetting, saveCrosshair, saveHitmarker, type HitmarkerStyle } from '../game/crosshair.ts';
import type { PortraitRenderer } from './portraits.ts';
import { SHIPPED_PORTRAITS } from './portraitIndex.ts';
import { bindFullscreenButton, browserTookEscape, fullscreenSupported, isFullscreen, toggleFullscreen } from '../fullscreen.ts';
import { PAD, glyphs, onPadPress } from '../inputMode.ts';
import { BOT_SET_PRESETS, PLAYLISTS } from '../playlists.ts';
import { botManager } from './botManager.ts';
import { joinParty, lastJoin, parseInvite } from '../game/party.ts';
import { MODE_SHORT, modeIcon } from './modeIcons.ts';
import { QUICK_MODES, loadQuickPrefs, pickQuickMap, quickSetup, saveQuickPrefs, type QuickMode } from './quickPlay.ts';
import { setTutorialState, tutorialState } from '../game/tutorial.ts';
import { loadTipState, resetTips, setTipsOn } from '../game/tips.ts';
import { testMode } from '../testMode.ts';

/** The "Inspired by …" line for a homage map (nothing for our own designs). */
function inspired(key: string): HTMLElement[] {
  const from = mapInspiration(key);
  return from ? [el('em', { class: 'inspired', textContent: `Inspired by ${from}` })] : [];
}

/** A built-in map the Arcade offers. */
/** A map card's picture (on top) and plan (beside the name): built-in maps have an automatic picture, your own MapMaker maps don't. */
function cardThumbs(m: ArcadeMap): MapThumbs {
  const t = mapThumbs(m, isBuiltInEntry(m));
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
  /** The Filter maps window's ticks: only maps that play one of these modes are listed (none ticked: every map). */
  modes: GameMode[];
  /** The maps played last, newest first (the Recent tab). */
  recent: string[];
}
/** The map list's tabs (Match Setup redesign, part 1; the owner's mock-up of 2026-11-11). */
type MapTab = 'all' | 'mine' | 'featured' | 'recent' | 'favs' | 'picks';
const MAP_TABS: readonly (readonly [MapTab, string])[] = [['all', 'All maps'], ['mine', 'My maps'], ['featured', 'Featured'], ['recent', 'Recent'], ['favs', 'Favorites'], ['picks', 'Community Picks']];
/** The group main.ts gives the player's own maps. */
const OWN_GROUP = 'Your';
const RECENT_MAPS = 12;
const BROWSE_KEY = 'tiletrigger.mapBrowse';
function loadBrowsePrefs(): MapBrowsePrefs {
  const d: MapBrowsePrefs = { sort: 'featured', view: 'grid', favs: [], modes: [], recent: [] };
  try {
    const p = JSON.parse(localStorage.getItem(BROWSE_KEY) ?? '{}') as Partial<MapBrowsePrefs>;
    return {
      sort: (['featured', 'name', 'size', 'favs'] as const).find((s) => s === p.sort) ?? d.sort,
      view: p.view === 'list' ? 'list' : 'grid',
      favs: Array.isArray(p.favs) ? p.favs.filter((x): x is string => typeof x === 'string').slice(0, 200) : [],
      modes: Array.isArray(p.modes) ? GAME_MODES.filter((g) => (p.modes as unknown[]).includes(g)) : [],
      recent: Array.isArray(p.recent) ? p.recent.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAPS) : [],
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

/**
 * Match setup's tabs (the owner's mock-up of 2026-11-11): the numbered essentials, then what used to be the
 * sections under them (Bots, Advanced rules) and the saved setups with the party presets.
 */
type SetupTab = 'match' | 'bots' | 'rules' | 'presets';
const SETUP_TABS: readonly (readonly [SetupTab, string, string])[] = [['match', 'Match setup', GLYPHS.gamepad], ['bots', 'Bots & AI', GLYPHS.bot], ['rules', 'Rules', GLYPHS.rules], ['presets', 'Presets', GLYPHS.layers]];

/** The Match Setup tab's rows that stay one line until opened (one open at a time on small screens). */
const SETUP_ROWS = ['setup-variants-row'] as const;

/**
 * Small screens and phones open one of the setup's rows at a time (the stylesheet's narrow and short layouts start
 * at the same sizes); a desktop opens as many as you like.
 */
const compactSetup = (): boolean => isTouchDevice() || (typeof matchMedia === 'function' && matchMedia('(max-width: 900px), (max-height: 600px)').matches);

/** Advanced rules' summary names the changes that matter most first ("9 changed · Low gravity · Tactical bots +7"). */
const RULE_RANK: Record<string, number> = { weapons: 0, set: 0, gravity: 1, style: 2, lethality: 3, ballistics: 4, randomchars: 5, classes: 6, ff: 7, fall: 8, stats: 9, sizes: 10 };

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

/** The map list's group for Community Picks (main.ts): shown in their own tab, not under All maps. */
export const PICK_GROUP = 'Community Pick';
/**
 * Our own maps on the experimental tier (the map's `metadata.tier`, set in MapMaker; owner, 2026-11-11): listed under
 * this heading after the core maps, and never Quick Play's, a playlist's, a rotation's or the featured map (those
 * take maps with no group).
 */
export const EXPERIMENTAL_GROUP = 'Experimental';
/** One of our own maps (it has a built-in card picture), core or experimental. */
const isBuiltInEntry = (m: ArcadeMap): boolean => !m.group || m.group === EXPERIMENTAL_GROUP;

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
  /** A Community Pick's content hash (its Report button). */
  contentHash?: string;
}

/** Play → match setup's settings (saved as `cs.arcade`; older saves load too). */
export type ArcadeSetup = MatchSetup;

export interface FrontEndHooks {
  openEditor(): void;
  openDesigner(look: string): void;
  /** `host`: online from the start (Match setup's Host online, the Host tab's Host online without its restart): listed in the game browser when there's a hub, and a join code. */
  /** `botSet`: the host's own bots (Bots → Edit bots…). `spectate`: join it watching (Match setup → Spectate). */
  playLocal(map: MapDocument, rules: MatchRules, bots: number, skill: ArcadeSetup['skill'], host?: boolean, botSet?: BotSet | null, spectate?: boolean): void;
  playOnline(server: string, name: string): void;
  /** Play a scenario chain (maps/playlists): its maps in order, each once the one before is won. */
  playPlaylist(id: string, botFill: number, skill: ArcadeSetup['skill'], botSet?: BotSet | null): void;
  /** Join a friend's hosted game by its code. */
  joinCode(code: string, name: string): void;
  /** The tutorial on the Training Range (game/tutorial.ts). */
  playTutorial(): void;
}

type ScreenId = 'home' | 'play' | 'characters' | 'online' | 'options' | 'profile';

const MODE_LABEL = MODE_LABELS;
const BASE_RULES = DEFAULT_RULES;
/** The score limit row per mode: its label and stepper (step, min, max). */
const SCORE_ROW: Partial<Record<GameMode, { label: string; step: number; min: number; max: number }>> = {
  'core.tdm': { label: 'Team score', step: 5, min: 5, max: SCORE_LIMIT_MAX },
  'core.roulette': { label: 'Points', step: 5, min: 5, max: SCORE_LIMIT_MAX },
  'core.ctf': { label: 'Captures', step: 1, min: 1, max: 20 },
  'core.forts': { label: 'Captures', step: 1, min: 1, max: 20 },
  'core.koth': { label: 'Hill seconds', step: 10, min: 30, max: 600 },
  'core.elim': { label: 'Rounds to win', step: 1, min: 1, max: 15 },
  'core.bomb': { label: 'Rounds to win', step: 1, min: 1, max: 15 },
  'core.hostage': { label: 'Rounds to win', step: 1, min: 1, max: 15 },
  'core.breakthrough': { label: 'Reinforcements', step: 1, min: 1, max: 40 },
  'core.discs': { label: 'Knock-offs', step: 1, min: 3, max: 50 },
};
/** A short line on each mode, under its name in the mode picker. */
const MODE_LINES: Record<GameMode, string> = {
  'core.deathmatch': 'Everyone for themselves; most kills wins.',
  'core.roulette': 'A new character every life; jackpots and picks.',
  'core.tdm': 'Teams score a point per kill.',
  'core.ctf': 'Bring the enemy flag home to score.',
  'core.forts': 'Build a fort, then Capture the Flag.',
  'core.koth': 'Hold the moving hill to score.',
  'core.elim': 'Rounds, no respawns: last team standing.',
  'core.bomb': 'Plant the bomb or defuse it; rounds.',
  'core.hostage': 'Rescue the hostages or guard them; rounds.',
  'core.breakthrough': 'Attack through the sectors, or hold each line.',
  'core.coop': "Your squad against the map's mission.",
  'core.zombies': 'Hold out against endless zombie waves.',
  'core.discs': 'Knock rivals into the void with discs.',
};
/** One line on each mode, for its (i). */
const MODE_TIPS: Partial<Record<GameMode, string>> = {
  'core.deathmatch': 'Everyone for themselves. Most kills wins.',
  'core.roulette': "Free-for-all where everyone plays a new character every life, dealt from their own shuffled deck, with that character's stats and signature weapon. Jackpot rolls, a Giant Slayer bonus for a small character downing a large one, and a pick of three after 3 kills in one life. Its chips add rerolls, swap on kill, a variety bonus, Lunar or teams.",
  'core.tdm': 'Teams score a point per kill. First team to the score wins.',
  'core.ctf': "Grab the enemy flag from their base and bring it to yours while your own flag is home.",
  'core.forts': 'Fort Wars: a build phase with a force field between the teams (spend build points on walls, ramps and crates round your flag; LMB place, RMB pick up, R turn), then Capture the Flag over the forts. Explosives smash pieces.',
  'core.koth': 'Stand on the hill to score seconds for your team; the hill moves now and then.',
  'core.elim': 'Rounds with no respawns: wipe out the other teams to win the round.',
  'core.bomb': 'Attackers plant the bomb at site A or B (stand still, E); defenders stop them or defuse it. No respawns in a round.',
  'core.hostage': 'Rescuers lead hostages (E beside one) to the exit zone; guards hold them. No respawns in a round.',
  'core.breakthrough': "Asymmetric: the attackers push through the map's sectors in order (capture its zones, plant charges on its targets), with a limited pool of reinforcements and a clock that grows with every sector taken; the defenders respawn without end and hold each line in turn, falling back as it breaks.",
  'core.coop': 'Work through the mission with bot squadmates against the map\'s enemies.',
  'core.zombies': 'Hold out with your bot squad against endless waves of zombies. Each wave is bigger; the fallen come back when it is beaten.',
  'core.discs': 'Ricochet-style: everyone starts with three bouncing discs and picks them up again where they land, like ammo (any disc will do). A hit knocks you about without hurting; knock someone into the void to score. Power discs (fast, triple, splitting, freeze) lie about the arena.',
};

const FAMILY_LABEL = { ranger: 'Ranger', peasant: 'Peasant', athlete: 'Sportswear' } as const;

/**
 * A look's character stats as bars (Character Select, while the setup plays with Character stats): each stat across
 * its whole range (STAT_SPECS), the standard body's mark on it, above standard green and below amber.
 */
function statBars(look: string, sizes: boolean): HTMLElement {
  const st = lookStats(look, { sizes, stats: true });
  const std = classStats('standard');
  const fmt = (k: StatKey, v: number) => (k === 'health' ? String(Math.round(v)) : k === 'armor' ? `${Math.round(v * 100)}%` : `×${v.toFixed(2)}`);
  return el(
    'div',
    { class: 'char-stats', id: 'char-stats' },
    el('h4', { textContent: 'Stats' }),
    ...STAT_SPECS.map((sp) => {
      const v = st[sp.key];
      const at = (x: number) => `${Math.round(Math.max(0, Math.min(1, (x - sp.min) / (sp.max - sp.min))) * 100)}%`;
      const diff = v > std[sp.key] + 1e-9 ? 'up' : v < std[sp.key] - 1e-9 ? 'down' : 'same';
      const bar = el('span', { class: 'stat-bar' }, el('i', { class: `stat-fill ${diff}` }), el('b', { class: 'stat-mark' }));
      (bar.firstChild as HTMLElement).style.width = at(v);
      (bar.lastChild as HTMLElement).style.left = at(std[sp.key]);
      const row = el('div', { class: 'stat-row', title: sp.help }, el('span', { class: 'stat-label', textContent: sp.label }), bar, el('span', { class: 'stat-val', textContent: fmt(sp.key, v) }));
      row.dataset.stat = sp.key;
      return row;
    }),
  );
}

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
/** A key hint that only says what a key does (no click: turning, arrows). */
const hint = (keys: HTMLElement[], label: string) => el('span', {}, ...keys, label);
/** A key hint you can click: it does what the key does. */
const hintButton = (id: string, keys: HTMLElement[], label: string, title: string, act: () => void) => {
  const b = el('button', { type: 'button', class: 'hint-btn', id, title }, ...keys, el('span', { textContent: label }));
  b.addEventListener('click', act);
  return b;
};

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
  private readonly footer = el('footer', { class: 'menu-footer' });
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

  /** Your profile arrived (or you have none): your username becomes your name. */
  private applyProfile(username: string | null): void {
    const was = `${this.verified}|${this.name}`;
    this.verified = !!username;
    if (username) this.name = username;
    // The Profile entry (top right of the main menu) shows the account's state.
    this.body.querySelector('.profile-entry')?.replaceWith(this.profileEntry());
    if (`${this.verified}|${this.name}` !== was && !this.root.hidden && ['home', 'online', 'options', 'profile'].includes(this.screen)) this.go(this.screen);
  }
  server: string;
  look: string;
  /** Character Select's section in view (its jump strip lights it; Q / E step on from it). */
  private charSection: string | null = null;
  /** While a jump scrolls the grid, the strip keeps the section asked for (not each one passed on the way). */
  private charJumping = false;
  private charGlide = 0;
  /** Where Character Select was opened from: Back and Choose return there. */
  private charFrom: ScreenId = 'home';
  /** The character shown on Character Select (clicked, not yet chosen): `look` changes only when it's confirmed. */
  private previewed: string | null = null;
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
    // Score and time follow the match's size until the player sets them (scoreAuto, timeAuto).
    this.setup = saved ?? { map: first.key, mode: first.modes[0]!, bots: first.bots, skill: 'normal', scoreLimit: BASE_RULES[first.modes[0]!].scoreLimit, minutes: 10, scoreAuto: true, timeAuto: true };
    // The bottom bar: the news and the privacy page (main menu only; Profile links it too), then the
    // screen's key hints in groups (hints()). Sign-in and your profile are the Profile entry, top right.
    this.footer.append(
      el('div', { class: 'news' }, el('b', { textContent: 'News' }), 'Welcome to the Tile Trigger playtest. New: Sandgate, Team Deathmatch and the Character Designer.'),
      el('a', { class: 'footer-privacy', href: '/privacy/', target: '_blank', rel: 'noopener', textContent: 'Privacy' }),
      this.footerHints,
    );
    root.replaceChildren(this.body, this.status, this.footer);
    window.addEventListener('keydown', this.keyHandler);
    onPadPress((b) => this.onPad(b));
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
    this.previewed = null;
    this.scene.setLook(this.look);
    this.go(this.screen === 'characters' ? 'characters' : 'home');
  }

  /** After the designer saves a look, select it and return to character select. */
  useLook(look: string): void {
    this.look = validLookId(look);
    storage('cs.look', this.look);
    this.scene.setLook(this.look);
    // A new design gets its picture now (kept in this browser), so the grid shows it rather than drawing it there.
    void this.portraits.get(this.look).catch(() => undefined);
  }

  private go(screen: ScreenId): void {
    clearInterval(this.browserTimer);
    if (this.screen === 'characters' && screen !== 'characters') this.scene.resetSpin();
    // The character shown stays while you switch Character Select's tabs; leaving (or coming back) shows your own.
    if (this.screen !== 'characters' || screen !== 'characters') this.previewed = null;
    // Back (and Choose) on Character Select return to the screen that opened it.
    if (screen === 'characters' && this.screen !== 'characters') this.charFrom = this.screen;
    this.screen = screen;
    this.footer.dataset.screen = screen;
    this.scene.setLook(this.previewed ?? this.look);
    this.scene.setShot(screen === 'home' ? 'home' : 'side');
    this.body.replaceChildren(this.build(screen));
    this.footerHints.replaceChildren(...this.hints(screen));
    if (screen === 'home' && this.quickOpen) this.body.querySelector<HTMLButtonElement>(`#quick-play [data-mode="${loadQuickPrefs().mode ?? 'core.tdm'}"]`)?.focus({ preventScroll: true });
    else if (screen === 'home') (this.body.querySelector('.nav button.on') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  /**
   * The bottom bar's key hints, in three groups: getting about (Back, Q / E), the screen's actions (its
   * main one last, in cyan), then Fullscreen. Keyboard glyphs, or the controller's once one is used
   * (inputMode.ts); each hint that stands for an action is a button doing it.
   */
  private hints(screen: ScreenId): HTMLElement[] {
    const back = () => hintButton('hint-back', glyphs('Esc', 'B', 'b'), 'Back', `Back to ${this.backTarget()} (Esc, controller B)`, () => this.back());
    const cycle = (label: string) => hintButton('hint-cycle', [...glyphs('Q', 'LB'), ...glyphs('E', 'RB')], label, `Previous / next ${label.toLowerCase()} (Q / E, controller LB / RB)`, () => this.cycle(1));
    const main = (label: string, title: string, act: () => void) => {
      const b = hintButton('hint-ok', glyphs('↵', 'A', 'a'), label, title, act);
      b.classList.add('main');
      return b;
    };
    let moves: HTMLElement[] = [back()];
    let acts: HTMLElement[] = [];
    switch (screen) {
      case 'home':
        moves = [hint(glyphs('↑↓', '✛'), 'Navigate')];
        acts = [
          hintButton('hint-profile', glyphs('P', 'Y', 'y'), 'Profile', 'Your profile: character, name and sign-in (P, controller Y)', () => this.go('profile')),
          main('Select', 'Open the highlighted item (Enter, controller A)', () => this.navItems[this.navIndex]!.act()),
        ];
        break;
      case 'play':
        moves.push(cycle('Mode'), hintButton('hint-filter', glyphs('F'), 'Filters', 'Filter maps: choose which game modes to list maps for (F)', () => this.openMapFilter()));
        acts = [main('Start', 'Start the match (Enter, controller A)', () => this.start())];
        break;
      case 'characters':
        moves.push(cycle('Section'));
        acts = [
          hintButton('hint-design', glyphs('D', 'X', 'x'), 'Design new', 'Design a new character (D, controller X)', () => this.hooks.openDesigner(this.look)),
          hintButton('hint-customise', glyphs('C', 'Y', 'y'), 'Customise', 'Customise this character (C, controller Y)', () => this.hooks.openDesigner(this.previewed ?? this.look)),
          main('Choose', 'Choose the character shown (Enter, controller A)', () => this.select(this.previewed ?? this.look)),
        ];
        break;
      case 'profile':
        acts = [hintButton('hint-change', glyphs('C', 'Y', 'y'), 'Change character', 'Open Character Select (C, controller Y)', () => this.go('characters'))];
        break;
      case 'options':
        moves.push(cycle('Section'));
        break;
    }
    const group = (cls: string, items: HTMLElement[]) => el('div', { class: `hint-group ${cls}` }, ...items);
    const groups = [group('moves', moves), ...(acts.length ? [group('acts', acts)] : [])];
    if (fullscreenSupported()) {
      const fs = hintButton('hint-fullscreen', glyphs('F11'), isFullscreen() ? 'Exit fullscreen' : 'Fullscreen', 'Fullscreen on or off (F11)', () => void toggleFullscreen());
      const label = fs.lastElementChild as HTMLElement;
      const update = () => (fs.isConnected ? (label.textContent = isFullscreen() ? 'Exit fullscreen' : 'Fullscreen') : document.removeEventListener('fullscreenchange', update));
      document.addEventListener('fullscreenchange', update);
      groups.push(group('util', [fs]));
    }
    return groups;
  }

  /** Where Back goes from this screen (for its tooltip): the main menu, or the screen that opened Character Select. */
  private backTarget(): string {
    const to = this.screen === 'characters' ? this.charFrom : 'home';
    const names: Record<ScreenId, string> = { home: 'the main menu', profile: 'your profile', online: 'Online', options: 'Options', play: 'match setup', characters: 'the main menu' };
    return names[to];
  }

  /** The screen's title with Back before it (top left: back where you came from, as Esc does). */
  private head(title: string, ...extra: HTMLElement[]): HTMLElement {
    const back = el('button', { type: 'button', class: 'back-btn', id: 'screen-back', title: `Back to ${this.backTarget()} (Esc)` }, el('span', { textContent: '◀' }), 'Back');
    back.firstElementChild!.setAttribute('aria-hidden', 'true');
    back.addEventListener('click', () => this.back());
    return el('div', { class: 'screen-head' }, back, el('h2', { innerHTML: title }), ...extra);
  }

  /** Back one level: every screen is one step from the main menu, and Character Select from where it was opened. */
  private back(): void {
    if (this.screen === 'characters') this.go(this.charFrom === 'characters' ? 'home' : this.charFrom);
    else if (this.screen !== 'home') this.go('home');
  }

  /** Q / E (LB / RB): the next or previous mode, Character Select section or Options section. */
  private cycle(dir: 1 | -1): void {
    if (this.screen === 'play') {
      const m = this.currentMap();
      const i = m.modes.indexOf(this.setup.mode);
      this.setMode(m.modes[(i + (dir > 0 ? 1 : m.modes.length - 1)) % m.modes.length]!);
    } else if (this.screen === 'options') {
      const tabs = FrontEnd.OPTION_TABS;
      this.optionsTab = tabs[(tabs.indexOf(this.optionsTab) + (dir > 0 ? 1 : tabs.length - 1)) % tabs.length]!;
      this.go('options');
    } else if (this.screen === 'characters') {
      this.stepSection(dir);
    }
  }

  /** A controller in the menus: the d-pad moves, A presses, B goes back, LB / RB switch, X / Y design. */
  private onPad(button: number): void {
    if (this.root.hidden) return;
    // A window over the menu (the Bots window): B closes what's on top, A presses, the d-pad moves inside it.
    const top = document.getElementById('bm-pick-wrap') ?? document.getElementById('bot-manager') ?? document.getElementById('quick-play');
    const scope: HTMLElement = top ?? this.root;
    const move = (dir: 1 | -1) => {
      const items = [...scope.querySelectorAll<HTMLElement>('button, input, select, summary, [tabindex="0"]')].filter((e) => !(e as HTMLButtonElement).disabled && e.offsetParent !== null);
      if (!items.length) return;
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next = items[at < 0 ? (dir > 0 ? 0 : items.length - 1) : (at + dir + items.length) % items.length]!;
      next.focus();
      next.scrollIntoView({ block: 'nearest' });
    };
    if (button === PAD.b) {
      if (top) return top.querySelector<HTMLButtonElement>('[data-cancel]')?.click();
      return this.back();
    }
    if (button === PAD.a) {
      const f = document.activeElement as HTMLElement | null;
      if (f && f !== document.body && scope.contains(f)) return f.click();
      if (!top && this.screen === 'home') return this.navItems[this.navIndex]!.act();
      return;
    }
    if (button === PAD.up || button === PAD.down) {
      const dir = button === PAD.down ? 1 : -1;
      if (!top && this.screen === 'home') return this.setNav(this.navIndex + dir);
      if (!top && this.gridMove(0, dir)) return;
      return move(dir);
    }
    if (button === PAD.left || button === PAD.right) {
      const dir = button === PAD.right ? 1 : -1;
      if (!top && this.gridMove(dir, 0)) return;
      return move(dir);
    }
    if (top) return;
    if (button === PAD.lb || button === PAD.rb) return this.cycle(button === PAD.rb ? 1 : -1);
    if (this.screen === 'home' && button === PAD.y) return this.go('profile');
    if (this.screen === 'profile' && button === PAD.y) return this.go('characters');
    if (this.screen === 'characters' && button === PAD.x) return this.hooks.openDesigner(this.look);
    if (this.screen === 'characters' && button === PAD.y) return this.hooks.openDesigner(this.previewed ?? this.look);
    if (this.screen === 'play' && button === PAD.start) return this.start();
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
    { id: 'nav-quick', label: 'Quick Play', act: () => this.openQuickPlay() },
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
    const featuredPic = mapThumbs(featured, isBuiltInEntry(featured));
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
    const offer = this.firstRun();
    return el(
      'div',
      { class: `screen home${offer.length ? ' first-visit' : ''}` },
      el('h1', { class: 'logo' }, el('span', { class: 'tile', textContent: 'Tile ' }), el('span', { class: 'trigger', textContent: 'Trigger' })),
      el('p', { class: 'logo-sub', textContent: 'Make. Play. Die. Repeat.' }),
      el('p', { class: 'logo-version', textContent: `v${__APP_VERSION__}` }),
      nav,
      this.profileEntry(),
      card,
      ...offer,
      ...(this.quickOpen ? [this.quickPanel()] : []),
    );
  }

  // ---------------------------------------------------------------- new players: Quick Play, the tutorial's offer

  /** Quick Play's choice is open over the main menu. */
  private quickOpen = false;
  /** The first visit's tutorial offer shows on the main menu (until answered or the page is left). */
  private firstRunOn: boolean | null = null;
  /** Browser tests (?test=1, or any automated browser) see neither the first-visit offer nor tips, unless they ask (&newplayer=1). */
  private readonly newPlayerAsked = new URLSearchParams(location.search).get('newplayer') === '1';
  private automated(): boolean {
    return !this.newPlayerAsked && (!!testMode() || !!navigator.webdriver);
  }

  /** The first visit: a small card offering the tutorial (never forced; Not now, or anything else, and it's gone). */
  private firstRun(): HTMLElement[] {
    if (this.firstRunOn === null) {
      this.firstRunOn = tutorialState() === 'new' && !this.automated();
      // Offered once: it doesn't come back on the next visit, answered or not.
      if (this.firstRunOn) setTutorialState('offered');
    }
    if (!this.firstRunOn || this.quickOpen) return [];
    const start = el('button', { type: 'button', class: 'primary', id: 'first-run-start', textContent: 'Start tutorial' });
    const later = el('button', { type: 'button', id: 'first-run-dismiss', textContent: 'Not now' });
    start.addEventListener('click', () => {
      this.firstRunOn = false;
      this.hooks.playTutorial();
    });
    later.addEventListener('click', () => {
      this.firstRunOn = false;
      document.getElementById('first-run')?.remove();
      document.querySelector('.screen.home')?.classList.remove('first-visit');
    });
    return [
      el(
        'div',
        { class: 'first-run panel', id: 'first-run', role: 'region', ariaLabel: 'New here?' },
        el('div', { class: 'kicker', textContent: 'New here?' }),
        el('p', { textContent: 'A two-minute tutorial on the Training Range: moving, shooting, grenades and a buggy. Skip it any time.' }),
        el('div', { class: 'first-run-acts' }, start, later),
      ),
    ];
  }

  private openQuickPlay(): void {
    this.quickOpen = true;
    this.firstRunOn = false;
    this.go('home');
  }

  private closeQuickPlay(): void {
    this.quickOpen = false;
    this.go('home');
  }

  /** Quick Play's choice: Team Deathmatch or Deathmatch (the last one picked marked and focused), the tutorial, or Match setup. */
  private quickPanel(): HTMLElement {
    const prefs = loadQuickPrefs();
    const lines: Record<QuickMode, string> = { 'core.tdm': 'Two teams, a point a kill', 'core.deathmatch': 'Everyone for themselves' };
    const modes = el('div', { class: 'qp-modes' });
    for (const mode of QUICK_MODES) {
      const b = el('button', { type: 'button', class: 'qp-mode', id: mode === 'core.tdm' ? 'qp-tdm' : 'qp-dm' }, modeIcon(mode), el('b', { textContent: MODE_LABEL[mode] }), el('small', { textContent: lines[mode] }));
      b.dataset.mode = mode;
      if (mode === prefs.mode) b.append(el('i', { class: 'qp-last', textContent: 'Last played' }));
      b.addEventListener('click', () => void this.quickPlay(mode));
      modes.append(b);
    }
    const close = el('button', { type: 'button', class: 'qp-close', title: 'Close (Esc)', textContent: '✕' });
    close.dataset.cancel = '';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => this.closeQuickPlay());
    const tutorial = el('button', { type: 'button', class: 'qp-link', id: 'qp-tutorial', textContent: 'New here? Tutorial · 2 min' });
    tutorial.addEventListener('click', () => this.hooks.playTutorial());
    const custom = el('button', { type: 'button', class: 'qp-link', id: 'qp-setup', textContent: 'Choose map and rules…' });
    custom.addEventListener('click', () => {
      this.quickOpen = false;
      this.go('play');
    });
    const panel = el(
      'div',
      { class: 'quick-play panel', id: 'quick-play', role: 'dialog', ariaLabel: 'Quick Play' },
      el('div', { class: 'qp-head' }, el('h3', { textContent: 'Quick Play' }), close),
      el('p', { class: 'qp-sub', textContent: 'Straight into a match against bots, on a map picked for you.' }),
      modes,
      el('div', { class: 'qp-foot' }, tutorial, custom),
    );
    // Arrows move between the choices.
    panel.addEventListener('keydown', (e) => {
      if (!e.key.startsWith('Arrow')) return;
      const items = [...panel.querySelectorAll<HTMLButtonElement>('.qp-mode, .qp-link')];
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
      e.preventDefault();
      e.stopPropagation();
    });
    return panel;
  }

  /**
   * Quick Play: a map from the mode's list (quickPlay.ts: official, fits this device, not last time's), loaded; the
   * map's recommended player count for the mode, normal bots; started like Match setup's Start (offline).
   */
  private async quickPlay(mode: QuickMode): Promise<void> {
    const prefs = loadQuickPrefs();
    const candidates = this.maps.map((m) => ({ key: m.key, modes: m.modes, recommendedMax: m.metadata.recommendedPlayers.max, official: !m.group }));
    const key = pickQuickMap(mode, candidates, deviceMaxPlayers(), prefs.last, testMode() ? 0 : Math.random());
    const entry = key ? this.maps.find((m) => m.key === key) : undefined;
    if (!entry) return this.setStatus('Quick Play has no map for that mode here.');
    saveQuickPrefs({ mode, last: entry.key });
    this.setStatus(`Quick Play: ${MODE_LABEL[mode]} on ${entry.metadata.name}…`);
    let map: MapDocument;
    try {
      map = await entry.load();
    } catch {
      return this.setStatus(`${entry.metadata.name} failed to load`);
    }
    if (this.root.hidden) return;
    this.quickOpen = false;
    const setup = quickSetup(mode, map, entry.key, deviceMaxPlayers());
    const { rules, fill } = rulesFromSetup(setup, map, playerCap(mode, map, deviceMaxPlayers()).max);
    (window as unknown as { __quickPlay: unknown }).__quickPlay = { map: entry.key, mode, fill, setup };
    this.hooks.playLocal(map, rules, fill, 'normal', false, null, false);
  }

  private setNav(i: number): void {
    this.navIndex = (i + this.navItems.length) % this.navItems.length;
    this.body.querySelectorAll('.nav button').forEach((b, j) => b.classList.toggle('on', j === this.navIndex));
    // (Quick Play's choice open over the menu keeps the keyboard.)
    if (!this.quickOpen) (this.body.querySelectorAll('.nav button')[this.navIndex] as HTMLButtonElement | undefined)?.focus({ preventScroll: true });
  }

  /** Your account's state in a word or two, for the Profile entry: Guest, ✓ Signed in, or Pick a username. */
  private accountState(): { text: string; cls: 'guest' | 'in' | 'pick' } {
    if (!currentAccount()) return { text: 'Guest', cls: 'guest' };
    return cachedProfile()?.username ? { text: '✓ Signed in', cls: 'in' } : { text: 'Pick a username', cls: 'pick' };
  }

  /**
   * The main menu's Profile entry (top right): your character's portrait and name, your player name and
   * whether you're signed in. It opens Profile; signed out (where sign-in is offered), Sign in sits under it.
   */
  private profileEntry(): HTMLElement {
    const img = el('img', { alt: '' });
    void this.portraits.get(this.look).then((src) => (img.src = src), () => undefined);
    const state = this.accountState();
    const badge = el(
      'button',
      { type: 'button', class: 'player-badge panel', id: 'profile-badge', title: 'Your profile: character, name and sign-in (P, controller Y)' },
      img,
      el('div', { class: 'badge-text' }, el('small', { class: 'badge-kicker' }, 'Profile', el('i', { class: `acct ${state.cls}`, textContent: state.text })), el('b', { textContent: this.displayName }), el('small', { class: 'badge-look', textContent: this.lookName(this.look) })),
      el('span', { class: 'badge-go', textContent: '›' }),
    );
    badge.lastElementChild!.setAttribute('aria-hidden', 'true');
    badge.addEventListener('click', () => this.go('profile'));
    const box = el('div', { class: 'profile-entry' }, badge);
    if (!currentAccount() && signInAvailable()) {
      const signin = el('button', { type: 'button', class: 'cta', id: 'sign-in', textContent: 'Sign in' });
      signin.dataset.tip = 'Optional: a ToshiroPlay account (Google) gets you a username. Playing never needs one.';
      signin.addEventListener('click', () => void signIn());
      box.append(signin);
    }
    return box;
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
  /** The game browser's map filter (kept for this page). */
  private gbMaps: 'all' | 'ours' | 'community' = 'all';
  /**
   * The match setup's rows and folds that are open (by id). Variants and Party presets start as one row each;
   * the Rules tab's folds start open on a desktop (small screens and phones: Rules only).
   */
  private readonly folds = new Set<string>(compactSetup() ? ['setup-rules'] : ['setup-mode', 'setup-rules', 'setup-arsenal']);
  /** The setup's tab that is open (kept while the page is: a match and back leaves it where it was). */
  private setupTab: SetupTab = 'match';
  /** The setup panel, redrawn on every change (the map list stays). */
  private setupPanel: HTMLElement | null = null;
  /** The saved setup loaded last (its name), to show whether the setup still matches it. */
  private setupName: string | null = lastSetup();
  /** The map list's mode tab and search (this visit) and its sort, view and favourites (kept). */
  /** The map list's tab: all maps, your own, the featured, the ones played last, your favourites, or the Community Picks (docs/COMMUNITY_MAPS.md). */
  private mapTab: MapTab = 'all';
  private mapQuery = '';
  private readonly browse = loadBrowsePrefs();
  /** Even teams: a bot added or taken away changes every team alike (shown on while the teams are the same size). */
  private evenTeams = true;
  /** Start match plays offline, or hosts the match online: listed in the game browser (with a hub) and a join code; friends who join take bots' places. */
  private hostOnline = false;
  /** Why the last change to the players stopped short (a limit), shown until the next change. */
  private stopped: string | null = null;
  /** The fit check's details are showing. */
  private fitOpen = false;

  private currentMap(): ArcadeMap {
    return this.maps.find((m) => m.key === this.setup.map) ?? this.maps[0]!;
  }

  /** Load the map Play opens on (main.ts asks while the menu is idle), so the setup panel and Start don't wait for it. */
  preloadCurrentMap(): Promise<unknown> {
    return this.currentMap().load().catch(() => undefined);
  }

  /** The most players this device runs, and how its limit is named ("24 per team is this computer's limit"). */
  private device(): { max: number; name: string } {
    return { max: deviceMaxPlayers(), name: isTouchDevice() ? 'this device' : 'this computer' };
  }

  private pickMap(key: string): void {
    const m = this.maps.find((x) => x.key === key);
    if (!m) return;
    const old = this.currentMap().map;
    const mode = m.modes.includes(this.setup.mode) ? this.setup.mode : m.modes[0]!;
    // Teams on the old map's own layout (Map's pick) take the new map's own; a layout of your own stays.
    const theirs = !!old && !!this.setup.teams && this.setup.teams.join() === mapPickTeams(old, this.setup.mode, this.device().max).join();
    // Another mode: a score set for the old one means nothing there, so it follows the suggestion again.
    this.setup = { ...this.setup, map: key, mode, bots: m.bots, ...(mode === this.setup.mode ? {} : { scoreLimit: BASE_RULES[mode].scoreLimit, scoreAuto: true }) };
    if (theirs) delete this.setup.teams;
    this.stopped = null;
  }

  /** Change the setup, remember it and redraw the panel. `stopped`: why the change stopped short of what was asked (a limit). */
  private change(f: (s: ArcadeSetup) => void, stopped: string | null = null): void {
    f(this.setup);
    // Score and time that follow the size: stored as what they'll play (the setup saves as it reads).
    const map = this.currentMap().map;
    if (map) this.setup = withSetupLimits(this.setup, map, playerCap(this.setup.mode, map, this.device().max).max);
    this.stopped = stopped;
    this.saveSetup();
    this.refreshSetup();
  }

  /** A party preset on another map (Fireteams on a map with room for squads): the map loaded, picked, then the preset. */
  private async partyOnMap(p: (typeof PARTY_PRESETS)[number], entry: ArcadeMap): Promise<void> {
    let map: MapDocument;
    try {
      map = await entry.load();
    } catch {
      return this.setStatus(`${entry.metadata.name} failed to load`);
    }
    if (this.screen !== 'play') return;
    this.pickMap(entry.key);
    const next = applyParty(p, this.setup, map, entry.modes, { deviceMax: this.device().max, pickPlayers: entry.bots + 1 });
    if (!next) return;
    if (next.teams) this.evenTeams = next.teams.every((n) => n === next.teams![0]);
    this.setup = next;
    this.saveSetup();
    this.setupScroll = 0;
    this.go('play');
  }

  /** A new setup in place of the old one (a variant, a party preset), remembered and drawn. */
  private replaceSetup(next: ArcadeSetup): void {
    this.setup = next;
    this.change(() => undefined);
  }

  /** A team layout or player count from a preset or a suggestion: Even teams follows whether its teams are matched. */
  private applyLayout(patch: Partial<ArcadeSetup>): void {
    if (patch.teams) this.evenTeams = patch.teams.every((n) => n === patch.teams![0]);
    this.change((x) => {
      Object.assign(x, patch);
      if (patch.teams && x.playerTeam !== undefined && x.playerTeam >= patch.teams.length) x.playerTeam = patch.teams.length - 1;
    });
  }

  /** F in Match Setup: the Filter maps window (when the map list is showing and no window is open already). */
  private openMapFilter(): void {
    const b = document.getElementById('map-filter');
    if (b && b.offsetParent !== null && !document.querySelector('dialog[open]')) b.click();
  }

  /** Another of the setup's tabs, from its top. */
  private showSetupTab(tab: SetupTab): void {
    if (tab === this.setupTab) return;
    this.setupTab = tab;
    this.refreshSetup();
    const body = this.setupPanel?.querySelector<HTMLElement>('.setup-body');
    if (body) body.scrollTop = this.setupScroll = 0;
  }

  /** Open or close one of the setup's rows (Variants, Party presets): small screens keep one open at a time, a desktop both if you like. */
  private toggleRow(id: (typeof SETUP_ROWS)[number]): void {
    const opening = !this.folds.has(id);
    if (opening && compactSetup()) for (const s of SETUP_ROWS) this.folds.delete(s);
    if (opening) this.folds.add(id);
    else this.folds.delete(id);
    this.refreshSetup();
    // Opened: scroll down so its settings show, as far as they fit, never past its head.
    const body = this.setupPanel?.querySelector<HTMLElement>('.setup-body');
    const sec = document.getElementById(id);
    if (!opening || !body || !sec) return;
    const b = body.getBoundingClientRect();
    const r = sec.getBoundingClientRect();
    if (r.bottom > b.bottom) body.scrollTop += Math.max(0, Math.min(r.bottom - b.bottom, r.top - b.top));
    this.setupScroll = body.scrollTop;
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
      // Breakthrough's time is each sector's, not the match's: going to or from it, the time follows the suggestion too.
      if (m === 'core.breakthrough' || s.mode === 'core.breakthrough') s.timeAuto = true;
      s.mode = m;
      // A score set for another mode means nothing in this one: it follows the suggestion again (a time set by hand stays).
      s.scoreLimit = BASE_RULES[m].scoreLimit;
      s.scoreAuto = true;
    });
  }

  private arcade(): HTMLElement {
    const cards = el('div', { class: `map-cards${this.browse.view === 'list' ? ' list' : ''}`, id: 'map-cards' });
    // Picking a map redraws the setup only: the list stays where it was.
    cards.addEventListener('scroll', () => (this.mapScroll = cards.scrollTop), { passive: true });
    requestAnimationFrame(() => (cards.scrollTop = this.mapScroll));

    // ---- the list's controls: tabs for which maps, the Filter maps window (which modes), search, sort, grid or list
    const used = GAME_MODES.filter((g) => this.maps.some((m) => m.group !== PICK_GROUP && m.modes.includes(g)));
    // The Community Picks tab: when the hub has any (players' maps that earned it by being played).
    const picks = this.maps.some((m) => m.group === PICK_GROUP);
    const mine = this.maps.some((m) => m.group === OWN_GROUP);
    if ((this.mapTab === 'picks' && !picks) || (this.mapTab === 'mine' && !mine)) this.mapTab = 'all';
    // (A mode no map here plays any more can't stay ticked.)
    this.browse.modes = this.browse.modes.filter((g) => used.includes(g));
    const tabs = el('div', { class: 'map-tabs', id: 'map-tabs', role: 'tablist' });
    const drawTabs = () =>
      tabs.replaceChildren(
        ...MAP_TABS.filter(([t]) => (t !== 'picks' || picks) && (t !== 'mine' || mine)).map(([t, label]) => {
          const b = el('button', { type: 'button', class: `map-tab${t === this.mapTab ? ' on' : ''}${t === 'picks' ? ' picks' : ''}`, textContent: label, role: 'tab' });
          b.setAttribute('aria-selected', String(t === this.mapTab));
          b.dataset.tab = t;
          b.addEventListener('click', () => {
            this.mapTab = t;
            this.mapScroll = 0;
            drawTabs();
            drawCards();
          });
          return b;
        }),
      );
    // Filter maps: one button, a window of its own with a tick per game mode (the owner, 2026-11-11: "something I could
    // open in a larger window to check off only the game modes of maps I'm interested in seeing").
    const filterCount = el('b', { class: 'map-filter-n' });
    const filterBtn = el('button', { type: 'button', class: 'map-filter', id: 'map-filter', title: 'Choose which game modes to list maps for (F)' }, el('span', { textContent: 'Filter maps' }), filterCount);
    const drawFilter = () => {
      const n = this.browse.modes.length;
      filterBtn.classList.toggle('on', n > 0);
      filterCount.textContent = n ? String(n) : '';
      filterCount.hidden = !n;
      filterBtn.setAttribute('aria-label', n ? `Filter maps: ${n} game mode${n === 1 ? '' : 's'} ticked` : 'Filter maps');
    };
    const playsTicked = (m: { modes: readonly GameMode[] }) => !this.browse.modes.length || this.browse.modes.some((g) => m.modes.includes(g));
    filterBtn.addEventListener('click', () => {
      const count = (g: GameMode) => this.maps.filter((m) => m.group !== PICK_GROUP && m.modes.includes(g)).length;
      const boxes = used.map((g) => {
        const box = el('input', { type: 'checkbox', checked: this.browse.modes.includes(g) });
        box.dataset.mode = g;
        box.addEventListener('change', () => {
          this.browse.modes = used.filter((x) => (x === g ? box.checked : this.browse.modes.includes(x)));
          saveBrowsePrefs(this.browse);
          this.mapScroll = 0;
          drawFilter();
          drawCards();
          drawFoot();
        });
        return el('label', { class: 'mf-mode' }, box, modeIcon(g), el('b', { textContent: MODE_LABEL[g] }), el('i', { textContent: `${count(g)} map${count(g) === 1 ? '' : 's'}` }));
      });
      const done = el('button', { type: 'button', class: 'primary', id: 'mf-done' });
      const clear = el('button', { type: 'button', id: 'mf-clear', textContent: 'Clear all' });
      const drawFoot = () => {
        const n = this.maps.filter((m) => m.group !== PICK_GROUP && playsTicked(m)).length;
        done.textContent = this.browse.modes.length ? `Show ${n} map${n === 1 ? '' : 's'}` : 'Show every map';
        clear.disabled = !this.browse.modes.length;
      };
      const dlg = el(
        'dialog',
        { class: 'map-filter-dialog panel', id: 'map-filter-dialog' },
        el('h3', { textContent: 'Filter maps' }),
        el('p', { class: 'setup-hint', textContent: 'Tick the game modes you want to play: the list shows the maps that play any of them. With none ticked, every map is listed.' }),
        el('div', { class: 'mf-modes' }, ...boxes),
        el('div', { class: 'mf-foot' }, clear, done),
      );
      clear.addEventListener('click', () => {
        this.browse.modes = [];
        saveBrowsePrefs(this.browse);
        for (const l of boxes) (l.querySelector('input') as HTMLInputElement).checked = false;
        drawFilter();
        drawCards();
        drawFoot();
      });
      done.addEventListener('click', () => dlg.close());
      // A click on the backdrop closes it, like Escape.
      dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());
      dlg.addEventListener('close', () => dlg.remove());
      drawFoot();
      document.body.append(dlg);
      dlg.showModal();
    });
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
    const tools = el('div', { class: 'map-tools' }, filterBtn, search, sort, el('div', { class: 'view-pick' }, viewBtn('grid', '▦', 'Grid'), viewBtn('list', '☰', 'List')));

    const drawCards = () => {
      const current = this.currentMap();
      const lazy = lazyPlans(cards);
      const q = this.mapQuery.trim().toLowerCase();
      const favs = new Set(this.browse.favs);
      const built = this.maps.map((m, i) => ({ m, i }));
      const tab = this.mapTab;
      const recent = this.browse.recent;
      const inTab = (m: (typeof this.maps)[number]) =>
        tab === 'picks' ? m.group === PICK_GROUP : m.group !== PICK_GROUP && (tab === 'all' || (tab === 'mine' ? m.group === OWN_GROUP : tab === 'featured' ? !m.group && FEATURED_MAPS.includes(m.key) : tab === 'recent' ? recent.includes(m.key) : favs.has(m.key)));
      const shown = built.filter(({ m }) => inTab(m) && playsTicked(m) && (!q || m.metadata.name.toLowerCase().includes(q) || m.blurb.toLowerCase().includes(q) || m.modes.some((x) => MODE_LABEL[x].toLowerCase().includes(q))));
      const rank = (key: string) => {
        const f = FEATURED_MAPS.indexOf(key);
        return f < 0 ? FEATURED_MAPS.length : f;
      };
      const by = this.browse.sort;
      // Your own maps stay under their heading after the built-in ones, whatever the sort.
      shown.sort((a, b) =>
        // Recent: newest first, whatever the sort.
        (tab === 'recent' ? recent.indexOf(a.m.key) - recent.indexOf(b.m.key) : 0) ||
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
          if (group) cards.append(el('h4', { class: 'map-group', textContent: group === PICK_GROUP ? 'Community Picks' : `${group} maps` }));
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
          // A list filtered to one mode already picked it: that one, when the map plays it.
          const only = this.browse.modes.length === 1 ? this.browse.modes[0]! : null;
          if (only && m.modes.includes(only) && this.setup.mode !== only) this.setMode(only);
          this.refreshSetup();
        });
        cards.append(card);
        lazy(card, draw);
      }
      const none = q
        ? `No maps match "${this.mapQuery.trim()}".`
        : tab === 'picks'
          ? 'No Community Picks yet.'
          : tab === 'recent' && !recent.length
            ? 'No maps played yet: the ones you play show here, newest first.'
            : tab === 'favs' && !favs.size
              ? 'No favourites yet: the star on a map card keeps it here.'
              : this.browse.modes.length
                ? 'No maps here play the game modes ticked in Filter maps.'
                : 'No maps here.';
      if (!shown.length) cards.append(el('p', { class: 'map-empty', textContent: none }));
    };
    drawTabs();
    drawFilter();
    drawCards();
    const panel = el('div', { class: 'setup panel', id: 'match-setup' });
    this.setupPanel = panel;
    this.fillSetup(panel);
    // (The stylesheet lays these out as the mock-up does: the title over the map list, the setup panel the screen's whole height beside them.)
    return el(
      'div',
      { class: 'screen play' },
      this.head('Match <em>Setup</em>'),
      el('div', { class: 'arcade' }, el('div', { class: 'map-browse' }, el('div', { class: 'map-bar' }, tabs, tools), cards), panel),
    );
  }

  /**
   * The setup panel (the owner's mock-up of 2026-11-11). On top, "Match configuration": the map's picture as a
   * banner behind its name, what it is, the setup in a line (people apart from bots, how long, the caps) and the
   * fit indicator. Under it four tabs. Match setup: numbered sections, 1 the game mode (a tile per mode the map
   * plays), 2 what wins (score, time, the mode's own key setting), 3 the teams or the player count with the size
   * presets, then Variants and Party presets as one row each until opened. Bots & AI, Rules and Presets hold the
   * rest. The foot never scrolls away: Save preset, Offline / Host online, Spectate and Start match.
   */
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
    const family = setupFamily(s.mode);
    const team = family === 'teams';
    const coop = family === 'squad';
    const forts = s.mode === 'core.forts';
    const breakthrough = s.mode === 'core.breakthrough';
    const dev = this.device();
    // What this setup plays here: at most what this device runs.
    const cap = playerCap(s.mode, map, dev.max);
    const players = setupPlayers(s, map, cap.max);
    const sizes = team ? setupTeams(s, map, cap.max) : [];
    const pickPlayers = current.bots + 1;
    const fit = setupFit(s, map, { deviceMax: dev.max, device: dev.name, pickPlayers });
    // Score and time: the suggestion for this size, or the player's own.
    const lim = setupLimits(s, map, cap.max);
    const fold = (id: string, title: string, badge: string | undefined, ...children: HTMLElement[]) =>
      foldEl({ id, title, badge, open: this.folds.has(id), onToggle: (open) => (open ? this.folds.add(id) : this.folds.delete(id)) }, ...children);

    // ---- header: the map's picture with its top-down plan, name, what it is, who plays and how long, the fit
    const thumbs = mapThumbs(map, isBuiltInEntry(current));
    requestAnimationFrame(thumbs.draw);
    // The list is hidden on small screens: there, this picks the map.
    const mapSelect = el('select', { id: 'arcade-map', title: 'Map' }, ...this.maps.map((m) => el('option', { value: m.key, textContent: `${m.metadata.name}${m.group ? ` (${m.group})` : ''}`, selected: m.key === current.key })));
    mapSelect.addEventListener('change', () => {
      this.pickMap(mapSelect.value);
      this.saveSetup();
      this.setupScroll = 0;
      this.go('play');
    });
    const rec = map.metadata.recommendedPlayers;
    const spawnCount = map.entities.filter((e) => e.kind === 'spawn').length;
    const about = [map.metadata.description, map.metadata.author && !['Tile Trigger', 'ChronoSplit'].includes(map.metadata.author) ? `Map by ${map.metadata.author}` : '', `Made for ${rec.min}–${rec.max} players; ${spawnCount} spawn points.`].filter(Boolean).join('\n\n');
    // Breakthrough: up to each sector's time, for each round.
    const btLength = breakthrough ? Math.max(1, breakthroughSectors(map).length) * lim.minutes * (s.btSwap ? 2 : 1) : 0;
    const length = coop ? (s.mode === 'core.zombies' ? 'Until the last wave' : 'Mission') : forts ? `~${Math.round((s.fortCycles ?? 1) * ((s.fortBuild ?? 2.5) + (s.fortCombat ?? 5)))} min` : breakthrough ? `up to ${btLength} min` : lim.minutes ? `~${lim.minutes} min` : 'No time limit';
    const toggleFit = () => {
      this.fitOpen = !this.fitOpen;
      this.refreshSetup();
      // The details open at the top of the setup: bring them into view.
      if (this.fitOpen) {
        const b = this.setupPanel?.querySelector<HTMLElement>('.setup-body');
        if (b) b.scrollTop = this.setupScroll = 0;
      }
    };
    // The weapon set in play, when it isn't Standard (the map's default or the setup's own; none with fixed weapons).
    const factSet = s.spears || s.discs || s.mode === 'core.discs' ? null : getWeaponSet(matchWeaponSet({ weaponSet: s.weaponSet }, map));
    const facts = el(
      'div',
      { class: 'setup-facts', id: 'setup-summary' },
      el('span', { class: 'fact-players', title: `Made for ${rec.min}–${rec.max} players. Bots fill every place you don't.` }, setupSummary(s, map, 1, cap.max)),
      el('span', { class: 'fact-time', title: coop ? 'Ends through the mission' : 'How long it runs' }, length),
      // The mode's player caps on this map (MapMaker's, else from its size and spawn points).
      ...(coop ? [] : [((c) => el('span', { class: 'fact-caps', id: 'setup-caps', title: `${MODE_LABELS[s.mode]} on this map: ${c.recommended} players recommended, ${c.max} at most${c.auto ? ' (worked out from its size and spawn points)' : " (set in the map's properties)"}.` }, capsLine(c)))(mapPlayerCaps(map, s.mode))]),
      ...(factSet && factSet.id !== 'standard' ? [el('span', { class: 'fact-weapons', id: 'setup-weapons-fact', title: `${factSet.blurb} (${s.weaponSet === undefined ? "the map's default" : 'your choice'}; Advanced rules → Weapons)` }, `${factSet.name} weapons`)] : []),
    );
    // The picture is the header's banner, behind the name; the plan a small tile at its end.
    const head = el(
      'div',
      { class: 'setup-head' },
      thumbPair(thumbs, 'setup-preview'),
      el(
        'div',
        { class: 'setup-title' },
        el('small', { textContent: 'Match configuration' }),
        el('h3', {}, map.metadata.name, infoTip(about)),
        ...inspired(current.key),
        el('p', { class: 'setup-blurb', textContent: current.blurb }),
        ...(current.contentHash ? [el('p', { class: 'setup-community hint' }, `A player's map${current.metadata.author ? ` by ${current.metadata.author}` : ''}. `, reportButton(current.contentHash, map.metadata.name))] : []),
        facts,
        mapSelect,
      ),
      fitChip(fit, this.fitOpen, toggleFit, 'setup-fit'),
    );

    // ---- the fit check's details: everything when opened; a real problem shows in red either way
    const fixLayout = (fix: { teams?: number[]; players?: number }) => this.applyLayout(fix.teams ? { teams: [...fix.teams] } : { bots: Math.max(0, (fix.players ?? 1) - 1) });
    const fitShown = this.fitOpen ? fit.items : fit.items.filter((i) => i.level === 'problem');
    const graphics = players > BIG_MATCH
      ? settingRow('Graphics', 'Low: no shadows or post effects, the fastest. Saved for every match (Options has the rest: render scale, frame cap).', choice(GRAPHICS_QUALITIES.map((q): ChoiceOption<GraphicsQuality> => [q, q[0]!.toUpperCase() + q.slice(1)]), loadGraphicsQuality(), (v) => {
          saveGraphicsQuality(v);
          this.refreshSetup();
        }, 'arcade-graphics'))
      : null;
    const fitBlock = fitShown.length
      ? [el('div', { class: `fit-details ${fit.level}`, id: 'setup-fit-details' }, fitList(fitShown, fixLayout, 'setup-fit-list', graphics && this.fitOpen ? { performance: graphics } : {}))]
      : [];

    // ---- essentials: the mode (a tile per mode the map has; the rest named, greyed, with why), its variants, what wins
    const options = modeOptions(map, current.modes);
    const modeChips = el(
      'div',
      { class: 'mode-pick', id: 'arcade-modes' },
      ...current.modes.map((m) => {
        // A large tile: the icon, the mode's short tag (TDM, DM, CTF, King) and, where it says more, its full name under it.
        const code = MODE_SHORT[m];
        const full = code.toLowerCase() !== MODE_LABEL[m].toLowerCase();
        const b = el('button', { type: 'button', class: `mode-chip${m === s.mode ? ' on' : ''}`, id: `arcade-mode-${m.replace('core.', '')}` }, modeIcon(m), el('b', { textContent: code }), ...(full ? [el('small', { textContent: MODE_LABEL[m] })] : []));
        b.setAttribute('aria-label', MODE_LABEL[m]);
        b.dataset.mode = m;
        b.dataset.tip = MODE_TIPS[m] ?? MODE_LINES[m];
        b.setAttribute('aria-pressed', String(m === s.mode));
        b.addEventListener('click', () => m !== this.setup.mode && this.setMode(m));
        return b;
      }),
    );
    const modeLine = el('p', { class: 'setup-hint mode-line', textContent: MODE_LINES[s.mode] });
    // Only the modes this map plays are shown (owner, 2026-11-11: "don't show the map modes a map can't play": a map
    // not built for a mode needs no line saying so).
    // Variants: on/off chips drawn from SETUP_VARIANTS (a new variant is data there, not UI here).
    const states = variantStates(s, map, current.modes);
    const variants = states.length
      ? [el('div', { class: 'variant-row', id: 'setup-variants', role: 'group' }, ...states.map((v) => {
          const b = el('button', { type: 'button', class: `variant-chip${v.on ? ' on' : ''}`, id: `setup-variant-${v.variant.id}`, textContent: v.variant.label });
          b.dataset.variant = v.variant.id;
          b.dataset.tip = v.variant.tip;
          b.setAttribute('aria-pressed', String(v.on));
          inert(b, v.disabled ? `${v.variant.tip}\n\n${v.disabled}` : null);
          b.addEventListener('click', () => !v.disabled && this.replaceSetup(setVariant(this.setup, v.variant.id, !v.on)));
          return b;
        }))]
      : [];
    variants[0]?.setAttribute('aria-label', 'Variants');
    const scoreRow = SCORE_ROW[s.mode] ?? { label: 'Score limit', step: 5, min: 5, max: 500 };
    // Kills and points step by more as they grow (5, 10, 50, 100): a big match's 500 is a few presses away.
    const scoreBy = scoreRow.step === 5 ? scoreStep(lim.scoreLimit) : scoreRow.step;
    const win: HTMLElement[] = [];
    if (coop) win.push(el('p', { class: 'setup-hint win-note', textContent: `${MODE_LABEL[s.mode]} ends through the mission, not a score or a clock.` }));
    else if (breakthrough) {
      // Breakthrough wins by sectors: the attackers' reinforcements, each sector's time, and a second round with the sides swapped.
      win.push(
        field('Reinforcements', "Respawns per attacker: the attackers' pool is this times their team, topped up by half as much for each sector taken; once it's spent, the fallen stay down. Defenders respawn without end. It follows the match's size until you change it.", stepper({ value: lim.scoreLimit, min: 1, max: BREAKTHROUGH_POOL_MAX, id: 'arcade-score', label: 'reinforcements per attacker', onChange: (v) => this.change((x) => ((x.scoreLimit = v), (x.scoreAuto = false))) }), { custom: !lim.auto.score }),
        field('Sector time', "Minutes each sector puts on the clock (taking one adds the next one's). The defenders win when it runs out. It follows the match's size until you change it.", stepper({ value: lim.minutes, min: 1, max: 15, id: 'arcade-minutes', fmt: (v) => `${v} min`, onChange: (v) => this.change((x) => ((x.minutes = v), (x.timeAuto = false))) }), { custom: !lim.auto.time }),
        field('Second round', 'A second round with the sides swapped: the team that took more sectors wins, then the one that took its last with more time left.', choice([['off', 'One round'], ['on', 'Swap sides']], s.btSwap ? 'on' : 'off', (v) => this.change((x) => (x.btSwap = v === 'on' || undefined)), 'arcade-bt-swap')),
      );
    } else {
      win.push(field(scoreRow.label, "The match ends when someone reaches this. It follows the match's size (players and bots) until you change it.", stepper({ value: lim.scoreLimit, min: scoreRow.min, max: scoreRow.max, step: scoreBy, id: 'arcade-score', label: scoreRow.label.toLowerCase(), onChange: (v) => this.change((x) => ((x.scoreLimit = v), (x.scoreAuto = false))) }), { custom: !lim.auto.score }));
      if (!forts) win.push(field('Time limit', "When time runs out the highest score wins. ∞: no limit. It follows the match's size until you change it.", stepper({ value: lim.minutes, min: 0, max: 60, id: 'arcade-minutes', fmt: (v) => (v ? `${v} min` : '∞'), onChange: (v) => this.change((x) => ((x.minutes = v), (x.timeAuto = false))) }), { custom: !lim.auto.time }));
    }
    // The mode's own key setting(s), with what wins; the rest of its settings are in Advanced rules.
    const flagReturn = () => stepper({ value: s.flagReturn ?? 30, min: 5, max: 120, step: 5, id: 'arcade-flag-return', fmt: (v) => `${v} s`, onChange: (v) => this.change((x) => (x.flagReturn = v === 30 ? undefined : v)) });
    const FLAG_TIP = 'Seconds a dropped flag lies before it goes home on its own.';
    if (s.mode === 'core.ctf') win.push(field('Flag return', FLAG_TIP, flagReturn()));
    if (s.mode === 'core.koth') win.push(field('Hill moves', 'Seconds before the hill moves to the next spot.', stepper({ value: s.hill ?? 60, min: 15, max: 300, step: 15, id: 'arcade-hill', fmt: (v) => `${v} s`, onChange: (v) => this.change((x) => (x.hill = v === 60 ? undefined : v)) })));
    // Fireteams (the variant): its squad size, the leader included.
    if (s.fireteams && fireteamMode(s.mode)) {
      win.push(
        field('Squad size', 'Players in each fireteam, its leader included: you and your bots, and every bot-led squad filling the teams.', choice([['4', '4'], ['5', '5'], ['6', '6']], String(s.squadSize ?? DEFAULT_FIRETEAM_SIZE), (v) => this.change((x) => (x.squadSize = Number(v) === DEFAULT_FIRETEAM_SIZE ? undefined : Number(v))), 'arcade-squad-size')),
      );
    }
    if (forts) {
      win.push(
        field('Build phase', 'Minutes to build before the barrier drops.', stepper({ value: s.fortBuild ?? 2.5, min: 1, max: 6, step: 0.5, id: 'arcade-fort-build', fmt: (v) => `${v} min`, onChange: (v) => this.change((x) => (x.fortBuild = v)) })),
        field('Combat phase', 'Minutes of Capture the Flag after each build phase.', stepper({ value: s.fortCombat ?? 5, min: 2, max: 20, id: 'arcade-fort-combat', fmt: (v) => `${v} min`, onChange: (v) => this.change((x) => (x.fortCombat = v)) })),
      );
    }
    const limitsLine = coop ? [] : this.limitsLine(s.mode, lim, { score: true, time: !forts }, team && sizes.length <= 4 ? sizes.join('v') : `${players} players`);
    // ---- the Match Setup tab's numbered sections: 1 the mode, 2 what wins, 3 who plays, then Variants and Party presets a row each
    // Up to six tiles in a row (five as the mock-up draws them); more go in two even rows, a little shorter.
    const tiles = current.modes.length;
    modeChips.style.setProperty('--cols', String(tiles <= 6 ? Math.max(5, tiles) : Math.ceil(tiles / 2)));
    if (tiles > 6) modeChips.classList.add('rows2');
    // The mode in a line, on the title's line; what the score and time follow, beside them where there's room.
    const essentials = numbered({ n: 1, id: 'setup-essentials', title: 'Game mode', icon: GLYPHS.gamepad, extra: [modeLine] }, modeChips);
    const settings = numbered({ n: 2, id: 'setup-settings', title: 'Match settings', icon: GLYPHS.gear }, el('div', { class: 'win-row' }, el('div', { class: 'field-grid', id: 'setup-win' }, ...win), ...limitsLine));
    const variantsOn = states.filter((v) => v.on && !v.disabled).map((v) => v.variant.label);
    const variantRow = numberedRow(
      { n: 4, id: 'setup-variants-row', title: 'Variants', icon: GLYPHS.sliders, note: '(Optional)', summary: variantsOn.length ? `${variantsOn.join(' · ')} (${variantsOn.length})` : 'None', lit: variantsOn.length > 0, open: this.folds.has('setup-variants-row'), onToggle: () => this.toggleRow('setup-variants-row') },
      ...(variants.length ? variants : [el('p', { class: 'setup-hint', textContent: `No variants for ${MODE_LABEL[s.mode]}.` })]),
    );

    // ---- presets: sizes worked out for this map and device (any change makes it Custom), then the party bundles
    const presets = sizePresets(s.mode, map, { teams: team ? sizes.length : undefined, deviceMax: dev.max, device: dev.name, pickPlayers });
    const onPreset = matchingPreset(s, map, presets, cap.max);
    const unit = coop ? 'in the squad' : 'players';
    const sizeRow = sizeChips(presets, onPreset, team ? sizes.join('v') : `${players} ${unit}`, (p) => this.applyLayout(presetPatch(p)), 'setup-sizes');
    // The party cards are drawn twice: in the Match Setup tab's row (with their ids) and in the Presets tab.
    const partyOnNow: { name: string | null } = { name: null };
    const partyCards = () => el('div', { class: 'party-chips', id: 'setup-party', role: 'group' }, ...PARTY_PRESETS.map((p) => {
      // A preset with maps of its own (Fireteams) moves to one when this map can't play it or doesn't suit it.
      const move = partyMapMove(p, map, current.modes, dev.max, this.maps.map((m) => ({ key: m.key, modes: m.modes, recommendedMax: m.metadata.recommendedPlayers.max, official: !m.group })));
      const moveTo = move ? this.maps.find((m) => m.key === move) : undefined;
      const offWhy = moveTo ? null : partyUnavailable(p, map, current.modes);
      const on = !offWhy && !moveTo && partyOn(p, s, map, current.modes);
      const mode = moveTo ? (p.mode.teams ?? p.mode.ffa ?? null) : partyMode(p, map, current.modes);
      if (on) partyOnNow.name = p.label;
      const b = el('button', { type: 'button', class: `party-chip${on ? ' on' : ''}`, id: `setup-party-${p.id}` }, el('b', { textContent: p.label }), el('small', { textContent: p.line }));
      b.dataset.party = p.id;
      const squads = p.squadSize ? ' · squads to fit the teams' : '';
      b.dataset.tip = `${mode ? MODE_LABEL[mode] : ''}${p.variants.map((id) => ` · ${getVariant(id)?.label ?? id}`).join('')} · ${moveTo ? `on ${moveTo.metadata.name}` : "the map's own team layout"}${squads}${p.squadSize ? '. Invite links bring friends onto your side, each leading a squad.' : ''}`;
      if (moveTo) b.dataset.map = moveTo.key;
      b.setAttribute('aria-pressed', String(on));
      inert(b, offWhy);
      b.addEventListener('click', () => {
        if (offWhy) return;
        if (moveTo) return void this.partyOnMap(p, moveTo);
        const next = applyParty(p, this.setup, map, current.modes, { deviceMax: dev.max, pickPlayers });
        if (!next) return;
        if (next.teams) this.evenTeams = next.teams.every((n) => n === next.teams![0]);
        this.replaceSetup(next);
      });
      return b;
    }));
    // Party presets (one-click bundles of a mode and variants) are in the Presets tab only (owner, 2026-11-12: beside
    // Variants they read as the same thing twice).
    const party = partyCards();
    party.setAttribute('aria-label', 'Party presets');

    // ---- Players & teams: who plays (people apart from bots), the teams or the count
    const assign = s.assign ?? 'balanced';
    const playerRows: HTMLElement[] = [];
    // How many teams: on the section's title line (the team editor puts its stepper here).
    const teamCountSlot = el('span', { class: 'team-count-slot' });
    if (team) {
      const sides = mapTeams(map, sizes.length);
      const you = setupYourTeam(s, sizes.length);
      const even = this.evenTeams && sizes.every((n) => n === sizes[0]);
      // Your team: a short list on the total's line (it was a row of three tabs in the old Players & teams section).
      const assignPick = el('select', { id: 'arcade-assign' }, ...([['balanced', 'Balanced'], ['random', 'Random'], ['fixed', 'Fixed']] as const).map(([v, t]) => el('option', { value: v, textContent: t, selected: v === assign })));
      assignPick.setAttribute('aria-label', 'Your team');
      assignPick.addEventListener('change', () => this.change((x) => {
        const v = assignPick.value as TeamAssign;
        x.assign = v === 'balanced' ? undefined : v;
        if (v === 'fixed') x.playerTeam = x.playerTeam ?? 0;
      }));
      const yourTeam = el(
        'span',
        { class: 'team-assign' },
        el('span', { class: 'row-label' }, 'Your team', infoTip('Balanced: people spread evenly over the teams (they usually outplay bots), bots fill the rest; offline you start on the first team. Random: a random team with room. Fixed: the team you pick (the switch-sides button between two teams, or Join on a team).')),
        assignPick,
      );
      playerRows.push(
        teamEditor({
          id: 'arcade',
          compact: { extra: [yourTeam], countTo: teamCountSlot },
          state: { sizes, names: sizes.map((_, i) => s.teamNames?.[i] || sides[i]!.name), colors: sizes.map((_, i) => s.teamColors?.[i] || sides[i]!.color), you },
          countLocked: isTwoTeamMode(s.mode) ? `${MODE_LABEL[s.mode]} is always two teams.` : null,
          youLabel: 'You',
          cap,
          device: dev.name,
          mode: s.mode,
          even: { on: even, onToggle: (on) => (this.evenTeams = on) },
          stopped: this.stopped,
          onChange: (next, stopped) => this.change((x) => {
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
          }, stopped),
        }),
      );
    } else {
      const word = coop ? 'squadmate' : 'bot';
      const bots = players - 1;
      // + goes one past the limit, to say whose limit it is rather than greying out silently.
      const botStep = stepper({
        value: bots,
        min: 0,
        max: cap.max,
        id: 'arcade-bots',
        label: `${word}s`,
        onChange: (v) => (v > cap.max - 1 ? this.change((x) => (x.bots = cap.max - 1), capMessage(cap, { device: dev.name })) : this.change((x) => (x.bots = v))),
      });
      playerRows.push(
        el(
          'div',
          { class: 'solo-players' },
          el('span', { class: 'row-label' }, coop ? 'Squadmates' : 'Bots', infoTip(coop ? 'Bot squadmates fighting alongside you.' : 'Bots to fill the match. You play too.')),
          botStep,
          el('b', { class: 'team-sum', id: 'arcade-players-sum', textContent: coop ? `Squad of ${players}` : `Total: ${players} combatants` }),
        ),
        el('p', { class: 'setup-hint', id: 'arcade-bots-line', textContent: `${peopleAndBots(1, bots, word)}${coop ? ' on your side' : ''}. Hosting online, friends who join take bots' places.` }),
        ...(this.stopped ? [el('p', { class: 'cap-note', id: 'arcade-bots-stopped', role: 'status', textContent: this.stopped })] : []),
      );
    }
    if (s.mode === 'core.coop' && PLAYLISTS.length) {
      playerRows.push(settingRow('Playlist', `Play a chain of co-op maps: win one and you go on to the next${PLAYLISTS.map((p) => `\n\n${p.name} (${p.maps.length} maps): ${p.description}`).join('')}`, choice([['', 'Just this map'], ...PLAYLISTS.map((p): ChoiceOption<string> => [p.id, `${p.name} (${p.maps.length})`])], s.playlist ?? '', (v) => this.change((x) => (x.playlist = v || undefined)))));
    }
    // Section 3: the size presets in a compact row (More layouts… on the title's line), then the teams or the count.
    const teamsSec = numbered(
      { n: 3, id: 'setup-teams', title: team ? 'Teams & players' : coop ? 'Squad' : 'Players', icon: GLYPHS.people, extra: [...(team ? [infoTip("Bots fill every place. Hosting online, friends who join take bots' places."), teamCountSlot] : []), this.moreLayouts(current)] },
      sizeRow,
      ...playerRows,
    );

    // ---- rules: what each changes, for Advanced rules (its summary line, its chips) and Reset
    const timeRowOff = forts ? 'Fort Wars ends after its last combat phase.' : coop ? 'Co-op and Zombies end through the mission.' : null;
    const noTeams = team ? null : `No teams in ${MODE_LABEL[s.mode]}.`;
    const respawnDefault = Math.round(BASE_RULES[s.mode].respawnDelayTicks / 60);
    const extras: { id: string; label: string; tip: string; changed: boolean; value: string; control: HTMLElement; disabled?: string | null }[] = [
      { id: 'ff', label: 'Friendly fire', tip: 'Team modes and co-op: whether your shots and blasts hurt teammates. A team kill earns nothing.', changed: !!s.friendlyFire, value: `Friendly fire ${s.friendlyFire === 'half' ? 'half' : 'full'}`, control: choice([['off', 'Off'], ['half', 'Half'], ['on', 'Full']], s.friendlyFire ?? 'off', (v) => this.change((x) => (x.friendlyFire = v === 'off' ? undefined : (v as 'half' | 'on')))), disabled: team || coop ? null : `No teammates in ${MODE_LABEL[s.mode]}.` },
      { id: 'respawn', label: 'Respawn delay', tip: `Seconds before you are back in. Rounds modes (Elimination, Bomb, Hostage) and Zombies wait for the next round or wave instead. Default here: ${respawnDefault} s.`, changed: s.respawn !== undefined, value: `Respawn ${s.respawn} s`, control: stepper({ value: s.respawn ?? respawnDefault, min: 0, max: 30, id: 'arcade-respawn', fmt: (v) => `${v} s`, onChange: (v) => this.change((x) => (x.respawn = v === respawnDefault ? undefined : v)) }) },
      { id: 'leaders', label: 'Team leaders', tip: 'Team modes: each team has a leader (you lead yours; bots lead the others), marked with a gold star. The leader\'s "Follow me!" and "Hold here!" (B, then 1 or 7) order every bot on the team, wherever they are. Leader hunt: in Team Deathmatch, downing the enemy leader scores 3 extra.', changed: !!s.leaders && team, value: s.leaders === 'vip' ? 'Leader hunt' : 'Team leaders', control: choice([['off', 'Off'], ['on', 'On'], ['vip', 'Leader hunt', s.mode === 'core.tdm' ? null : 'Leader hunt is a Team Deathmatch variant.']], s.leaders ?? 'off', (v) => this.change((x) => (x.leaders = v === 'off' ? undefined : (v as 'on' | 'vip')))), disabled: noTeams },
      { id: 'squad', label: 'Spawn on teammates', tip: 'Team modes: respawn beside a teammate who is out of the fight, when one is free.', changed: s.squadSpawn === false && team, value: 'No squad spawns', control: choice([['on', 'On'], ['off', 'Off']], s.squadSpawn === false ? 'off' : 'on', (v) => this.change((x) => (x.squadSpawn = v === 'on'))), disabled: noTeams },
      { id: 'streaks', label: 'Kill streaks', tip: 'Rewards for kills without dying: 3 UAV, 5 Supply Pulse (heal + ammo for nearby teammates), 7 Counter-UAV (jams enemy minimaps), 9 Airstrike.', changed: s.killstreaks === false, value: 'No kill streaks', control: choice([['on', 'On'], ['off', 'Off']], s.killstreaks === false ? 'off' : 'on', (v) => this.change((x) => (x.killstreaks = v === 'on'))) },
      { id: 'sizes', label: 'Character sizes', tip: 'Matter: small characters are smaller, quicker targets with less health that fit through gaps others must crouch for; large ones are bigger, slower and tougher. All equal: everyone plays at standard size.', changed: s.sizes === false, value: 'Equal sizes', control: choice([['on', 'Matter'], ['off', 'All equal']], s.sizes === false ? 'off' : 'on', (v) => this.change((x) => (x.sizes = v === 'on'))) },
      { id: 'stats', label: 'Character stats', tip: "On: each character plays with its own health, speed, size, damage, stamina, jump, melee and armor (Character Select shows them); one without its own plays its size. Off: nobody's own stats count.", changed: s.stats === false, value: 'No character stats', control: choice([['on', 'On'], ['off', 'Off']], s.stats === false ? 'off' : 'on', (v) => this.change((x) => (x.stats = v === 'on' ? undefined : false))) },
      // (Random characters is the Roulette bodies variant, in the Match Setup tab: the owner, 2026-11-12, found the
      // same switch here and there. Character stats, above, says whether those characters play their own stats.)
      // Weather (map/weather.ts; MapMaker overhaul Phase 5): the map's own, or the host's pick.
      { id: 'weather', label: 'Weather', tip: `Rain, snow, wind and fog, for everyone (fog: everyone sees less far). Map: what the map's maker chose (this map: ${weatherLabel(mapWeather(map))}).`, changed: s.weather !== undefined, value: isWeatherChoice(s.weather) ? WEATHER_PRESETS[s.weather].label : 'Map weather', control: weatherSelect(s.weather, weatherLabel(mapWeather(map)), (v) => this.change((x) => (x.weather = v)), 'arcade-weather') },
      { id: 'gravity', label: 'Gravity', tip: 'Map: whatever the map was built with (normal unless its maker changed it).', changed: s.gravity !== undefined, value: `${s.gravity === 0.4 ? 'Low' : s.gravity === 1.6 ? 'Heavy' : 'Normal'} gravity`, control: choice([['map', 'Map'], ['0.4', 'Low'], ['1', 'Normal'], ['1.6', 'Heavy']], s.gravity === undefined ? 'map' : String(s.gravity), (v) => this.change((x) => (x.gravity = v === 'map' ? undefined : Number(v)))) },
      { id: 'fall', label: 'Fall damage', tip: "Drops past about 5 m hurt; about 16 m kills. Map: the map's own setting.", changed: s.fallDamage !== undefined, value: `Fall damage ${s.fallDamage ? 'on' : 'off'}`, control: choice([['map', 'Map'], ['on', 'On'], ['off', 'Off']], s.fallDamage === undefined ? 'map' : s.fallDamage ? 'on' : 'off', (v) => this.change((x) => (x.fallDamage = v === 'map' ? undefined : v === 'on'))) },
      { id: 'lethality', label: 'Lethality', tip: 'How quickly fights end, for every weapon alike. Arcade: everyone soaks about 40% more (longer fights, tracking matters). Standard: the official balance. Tactical: everyone soaks about 30% less (very lethal).', changed: !!s.lethality, value: `${s.lethality === 'arcade' ? 'Arcade' : 'Tactical'} lethality`, control: choice([['arcade', 'Arcade'], ['standard', 'Standard'], ['tactical', 'Tactical']], s.lethality ?? 'standard', (v) => this.change((x) => (x.lethality = v === 'standard' ? undefined : (v as 'arcade' | 'tactical')))) },
      { id: 'ballistics', label: 'Ballistics', tip: "How much bullets behave like projectiles. Arcade: faster bullets that barely drop and don't pass through cover. Standard: the official default (lead and drop matter at long range). Advanced: slower bullets that drop more: lead and hold over further.", changed: !!s.ballistics, value: `${s.ballistics === 'arcade' ? 'Arcade' : 'Advanced'} ballistics`, control: choice([['arcade', 'Arcade'], ['standard', 'Standard'], ['advanced', 'Advanced']], s.ballistics ?? 'standard', (v) => this.change((x) => (x.ballistics = v === 'standard' ? undefined : (v as 'arcade' | 'advanced')))) },
      { id: 'emotes', label: 'Emotes & messages', tip: 'Quick messages (B, then 1-7; 1 "Follow me!" and 7 "Hold here!" also order your team\'s bots), the dance emote (N). Pings (T) always work.', changed: s.emotes === false, value: 'No emotes', control: choice([['on', 'On'], ['off', 'Off']], s.emotes === false ? 'off' : 'on', (v) => this.change((x) => (x.emotes = v === 'on'))) },
    ];
    const restricted = s.spears ? 'Spears only' : s.discs ? 'Discs only' : null;
    // The weapon set: the setup's, else the map's default (Disc Arena and spears or discs only play none).
    const fixedWeapons = restricted ? `${restricted}: everyone holds the same weapon, whatever the set.` : s.mode === 'core.discs' ? 'Disc Arena: everyone throws arena discs, whatever the set.' : null;
    const mapSet = mapWeaponSet(map);
    const playSet = getWeaponSet(matchWeaponSet({ weaponSet: s.weaponSet }, map));
    const setTip = `What everyone spawns with, what the weapon and grenade pickups hold (rolled within the set, a pickup of a kind it lacks holding the nearest kind it has) and what drops.\n\n${weaponSetList().map((w) => `${w.name}: ${w.blurb}`).join('\n\n')}\n\nMap default: what the map's maker chose (this map: ${getWeaponSet(mapSet).name}).`;
    const arsenal: typeof extras = [
      { id: 'set', label: 'Weapon set', tip: setTip, changed: s.weaponSet !== undefined && !fixedWeapons, value: `${playSet.name} weapons`, control: weaponSetSelect(s.weaponSet, mapSet, (v) => this.change((x) => (x.weaponSet = v)), 'arcade-weapons', !!fixedWeapons), disabled: fixedWeapons },
      { id: 'weapons', label: 'Weapons & pickups', tip: 'Normal: the map\'s weapons, ammo and grenades lie about. Spears only: everyone holds one throwing spear (one hit kills; go and fetch it back). Discs only: everyone throws bouncing arena discs that knock players about without hurting (Disc Arena rules). No weapon, ammo or grenade pickups either way.', changed: !!s.spears || !!s.discs, value: s.discs ? 'Discs only' : 'Spears only', control: choice([['normal', 'Normal'], ['spears', 'Spears only'], ['discs', 'Discs only']], s.spears ? 'spears' : s.discs ? 'discs' : 'normal', (v) => this.change((x) => ((x.spears = v === 'spears' || undefined), (x.discs = v === 'discs' || undefined)))) },
      { id: 'mix', label: 'Mix up weapon pickups', tip: "Every weapon pickup the map's maker didn't mark \"keep fixed\" holds a random weapon of the same kind as the one placed there (a pistol stays a pistol, a rifle a rifle), and a new one each time it comes back.", changed: !!s.mixPickups && !restricted && !playSet.weapons, value: 'Mixed-up pickups', control: choice([['off', 'Off'], ['on', 'On']], s.mixPickups ? 'on' : 'off', (v) => this.change((x) => (x.mixPickups = v === 'on' || undefined)), 'arcade-mix'), disabled: restricted ? `${restricted}: no weapon pickups.` : playSet.weapons ? `${playSet.name} weapons: every weapon pickup already holds one of the set's, a new one each time it comes back.` : null },
      { id: 'drops', label: 'Drop weapon on death', tip: "A fallen player's or bot's primary (the gun in hand, else their best one; never the starting pistol or knife) lies at the body for 30 s with the ammo it had left. Walk over it to take it, or its ammo if you have one. The rest of what they carried is recycled.", changed: s.dropWeapons === false && !restricted && s.mode !== 'core.discs', value: 'No weapon drops', control: choice([['on', 'On'], ['off', 'Off']], s.dropWeapons === false ? 'off' : 'on', (v) => this.change((x) => (x.dropWeapons = v === 'off' ? false : undefined)), 'arcade-drops'), disabled: restricted ? `${restricted}: no weapon drops.` : s.mode === 'core.discs' ? `Nothing drops in ${MODE_LABEL[s.mode]}.` : null },
      { id: 'classes', label: 'Classes', tip: 'Everyone picks one of nine classes (L or , in play; it opens when you join and when you are down): Runner, Rocketeer, Torch, Breacher, Bulwark, Mechanic (G: sentry that heals and restocks), Medic (medi-beam, G: overcharge), Marksman and Shade (G: cloak, backstabs). Limits cap how many on a team play the same class.', changed: !!s.classes && !restricted, value: `Classes${s.classLimit ? ` (max ${s.classLimit})` : ''}`, control: choice([['off', 'Off'], ['on', 'On'], ['1', 'Max 1'], ['2', 'Max 2']], !s.classes ? 'off' : s.classLimit ? String(s.classLimit) : 'on', (v) => this.change((x) => ((x.classes = v !== 'off' || undefined), (x.classLimit = v === '1' || v === '2' ? Number(v) : undefined)))), disabled: restricted ? `Classes don't mix with ${restricted.toLowerCase()}.` : null },
      { id: 'vehicles', label: 'Vehicle damage', tip: "Normal: vehicles smoke, catch fire and blow up. Tough: they take half damage. Off: they can't be destroyed (except by falling off the map). Turrets and sentries always take full damage.", changed: !!s.vehicleDamage, value: `${s.vehicleDamage === 'off' ? 'Indestructible' : 'Tough'} vehicles`, control: choice([['normal', 'Normal'], ['tough', 'Tough'], ['off', 'Off']], s.vehicleDamage ?? 'normal', (v) => this.change((x) => (x.vehicleDamage = v === 'normal' ? undefined : (v as 'tough' | 'off')))), disabled: map.entities.some((e) => e.kind === 'mount') || (raceTrack(map)?.ambient ?? 0) > 0 ? null : 'This map has no vehicles.' },
    ];
    const botRules: typeof extras = [
      { id: 'cast', label: 'Bot characters', tip: "Which characters random bots play, and so their names: a soldier is \"Sgt. Dunmore\", a monkey \"Coco Bean\" (the first bot in a character is named after it: Scamp). Map default: what the map's maker chose (most maps: all). Your own bots (Edit bots…) keep their names and looks.", changed: s.botCast !== undefined, value: `${botCastLabel(s.botCast)} bots`, control: botCastSelect(s.botCast, map.botCast, (v) => this.change((x) => (x.botCast = v)), 'arcade-cast') },
      { id: 'style', label: 'Bot style', tip: 'Mixed: every character plays its own way. Arena: strafe-jumping, item timing, always moving (Quake). Tactical: careful, cover, held angles (Counter-Strike).', changed: !!s.botStyle, value: `${s.botStyle === 'arena' ? 'Arena' : 'Tactical'} bots`, control: choice([['mixed', 'Mixed'], ['arena', 'Arena'], ['tactical', 'Tactical']], s.botStyle ?? 'mixed', (v) => this.change((x) => (x.botStyle = v === 'mixed' ? undefined : (v as 'arena' | 'tactical'))), 'arcade-style') },
    ];
    const rowOf = (x: (typeof extras)[number]) => settingRow(x.label, x.tip, x.control, { disabled: x.disabled });
    const live = (xs: typeof extras) => xs.filter((x) => x.changed && !x.disabled);
    // What matters most first: "9 changed · Low gravity · Tactical bots +7".
    const changed = [...live(extras), ...live(arsenal), ...live(botRules)].sort((a, b) => (RULE_RANK[a.id] ?? 50) - (RULE_RANK[b.id] ?? 50));
    const reset = el('button', { type: 'button', class: 'link rule-reset', id: 'setup-reset', textContent: 'Reset', title: 'Back to the standard rules (every variant off)' });
    reset.addEventListener('click', () => this.change((x) => {
      for (const k of ['spears', 'discs', 'mixPickups', 'dropWeapons', 'weaponSet', 'weather', 'classes', 'classLimit', 'botStyle', 'botCast', 'gravity', 'fallDamage', 'friendlyFire', 'killstreaks', 'squadSpawn', 'emotes', 'sizes', 'stats', 'randomChars', 'vehicleDamage', 'leaders', 'lethality', 'ballistics', 'respawn'] as const) delete x[k];
    }));
    const count = (xs: typeof extras) => {
      const n = live(xs).length;
      return n ? `${n} changed` : 'standard';
    };
    const modeRows: HTMLElement[] = [];
    if (forts) {
      modeRows.push(
        settingRow('Cycles', 'Build-then-fight rounds before the match ends. Pieces stand until they are broken; each build phase you can rebuild with the points they cost.', stepper({ value: s.fortCycles ?? 1, min: 1, max: 5, id: 'arcade-fort-cycles', onChange: (v) => this.change((x) => (x.fortCycles = v)) })),
        settingRow('Build points', "Each team's budget: a block costs 2, a wall 4, a metal wall 8.", stepper({ value: s.fortBudget ?? 420, min: 100, max: 800, step: 20, id: 'arcade-fort-budget', onChange: (v) => this.change((x) => (x.fortBudget = v)) })),
        settingRow('Flag return', FLAG_TIP, flagReturn()),
      );
    }
    // Time limit can't apply here (Fort Wars, co-op): said where it would be.
    const rulesRows = [...(timeRowOff ? [settingRow('Time limit', null, el('span', { class: 'setup-hint', textContent: timeRowOff }), { disabled: timeRowOff })] : []), ...extras.map(rowOf)];
    const advSummary = changed.length ? `${changed.length} changed · ${changed.slice(0, 2).map((x) => x.value).join(' · ')}${changed.length > 2 ? ` +${changed.length - 2}` : ''}` : 'Standard';
    const advanced = [
      ...(changed.length ? [el('div', { class: 'rule-chips', id: 'setup-rule-chips' }, ...changed.map((x) => el('span', { textContent: x.value })), reset)] : []),
      ...(modeRows.length ? [fold('setup-mode', `${MODE_LABEL[s.mode]} settings`, 'mode settings', ...modeRows)] : []),
      fold('setup-rules', 'Rules', count(extras), ...rulesRows),
      fold('setup-arsenal', 'Weapons, pickups & vehicles', count(arsenal), ...arsenal.map(rowOf)),
    ];

    // ---- Bots: skill, style, characters, your own bots
    const skillLabel = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[s.skill] ?? s.skill;
    const botsSummary = `${skillLabel} bots${s.botStyle ? ` · ${s.botStyle === 'arena' ? 'Arena' : 'Tactical'}` : ''}${s.botCast !== undefined ? ` · ${botCastLabel(s.botCast)}` : map.botCast?.length ? ` · ${botCastLabel(map.botCast)}` : ''}${s.botSet ? ` · ${s.botSet.name} (${s.botSet.entries.length})` : ''}`;
    const perTeam = team
      ? [el('p', { class: 'setup-hint', textContent: `Bots per team: ${mapTeams(map, sizes.length).map((t, i) => `${s.teamNames?.[i] || t.name} ${sizes[i]! - ((s.assign === 'fixed' ? Math.min(sizes.length - 1, s.playerTeam ?? 0) : 0) === i && s.assign !== 'random' ? 1 : 0)}`).join(' · ')}${s.assign === 'random' ? ' (one less wherever you land)' : ''}. Each team's size is in Match setup, Teams & players.` })]
      : [];

    // ---- the four tabs: every pane is in the page, the open one showing (ids stay findable; a redraw keeps the keyboard's place)
    const panes: Record<SetupTab, HTMLElement[]> = {
      match: [essentials, settings, teamsSec, variantRow],
      bots: [
        el('p', { class: 'pane-sum', id: 'setup-bots-sum', textContent: botsSummary }),
        settingRow('Bot skill', 'Easy bots aim slowly and miss often; hard ones react fast, use cover and lead their shots.', choice([['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], s.skill, (v) => this.change((x) => (x.skill = v as ArcadeSetup['skill'])), 'arcade-skill')),
        ...botRules.map(rowOf),
        this.botSetRow(map, sizes, players),
        ...perTeam,
      ],
      rules: [el('p', { class: 'pane-sum', id: 'setup-advanced-sum', textContent: advSummary }), ...advanced],
      presets: [...this.savedList(), el('h4', { class: 'pane-title', textContent: 'Party presets' }), party],
    };
    const paneIds: Record<SetupTab, string> = { match: 'setup-match', bots: 'setup-bots', rules: 'setup-advanced', presets: 'setup-presets' };
    const tabBar = el('div', { class: 'setup-tabs', id: 'setup-tabs', role: 'tablist' }, ...SETUP_TABS.map(([t, label, icon]) => {
      // Rules: how many are changed from the standard ones, on its tab.
      const n = t === 'rules' ? changed.length : 0;
      const b = el('button', { type: 'button', class: `setup-tab${t === this.setupTab ? ' on' : ''}`, id: `setup-tab-${t}`, role: 'tab' }, glyph(icon), el('span', { textContent: label }), ...(n ? [el('i', { class: 'tab-n', textContent: String(n), title: `${n} changed from the standard rules` })] : []));
      b.dataset.tab = t;
      b.setAttribute('aria-selected', String(t === this.setupTab));
      b.setAttribute('aria-controls', paneIds[t]);
      b.addEventListener('click', () => this.showSetupTab(t));
      return b;
    }));
    tabBar.setAttribute('aria-label', 'Match setup');
    const body = el(
      'div',
      { class: 'setup-body' },
      ...fitBlock,
      ...SETUP_TABS.map(([t]) => {
        const pane = el('div', { class: `setup-pane pane-${t}`, id: paneIds[t], role: 'tabpanel', hidden: t !== this.setupTab }, ...panes[t]);
        pane.setAttribute('aria-labelledby', `setup-tab-${t}`);
        return pane;
      }),
    );
    body.addEventListener('scroll', () => (this.setupScroll = body.scrollTop), { passive: true });

    panel.replaceChildren(head, tabBar, body, this.setupFoot(map, players));
    // Back where it was (a redraw), once the panel is on the page (the first draw is before the screen is).
    if (panel.isConnected) body.scrollTop = this.setupScroll;
    else requestAnimationFrame(() => (body.scrollTop = this.setupScroll));
  }

  /**
   * Under what wins: the score and time suggested for the match's size (`size`: "24v24", "12 players"), which they
   * follow until the player changes them; changed (Custom), a button puts them back on the suggestion. Nothing for
   * a mode that keeps its own (rounds, laps) while it does.
   */
  private limitsLine(mode: GameMode, lim: ReturnType<typeof setupLimits>, shown: { score: boolean; time: boolean }, size: string): HTMLElement[] {
    const custom = (shown.score && !lim.auto.score) || (shown.time && !lim.auto.time);
    if (!custom && !limitsScale(mode)) return [];
    const what = limitsText(mode, lim.suggested, shown);
    const line = el('p', { class: 'setup-hint limits-line', id: 'setup-limits' });
    if (!custom) line.textContent = `Suggested for ${size}: ${what}. They follow the size until you change them.`;
    else {
      const back = el('button', { type: 'button', class: 'link', id: 'setup-limits-reset', textContent: 'Back to suggested', title: "Score and time follow the match's size again" });
      back.addEventListener('click', () => this.change((x) => ((x.scoreAuto = true), (x.timeAuto = true))));
      line.append(el('span', { textContent: `Custom. Suggested for ${size}: ${what}.` }), back);
    }
    return [line];
  }

  /**
   * The setup's foot, always in view: where the match runs (Offline, or Host online, as the pause menu's Host tab
   * means it: listed publicly in the game browser when there's a community hub, and a join code for friends, who
   * take bots' places), saved setups in a small menu, then Spectate and Start match. Enter does what the switch
   * says; Spectate follows it too (offline, bots only; online, you watch while friends play).
   */
  private setupFoot(map: MapDocument, players: number): HTMLElement {
    const s = this.setup;
    const playlist = s.mode === 'core.coop' && !!s.playlist;
    const hostWhy = playlist ? 'Playlists are played offline: pick "Just this map" to host.' : null;
    const online = this.hostOnline && !hostWhy;
    // With a community hub the match is listed publicly (the game browser); without one, friends join by code only.
    const listed = !!hubSetting();
    const where = segmented(
      [
        ['offline', 'Offline', null, 'arcade-offline', 'Just you and the bots, on this computer.'],
        ['online', 'Host online', hostWhy, 'arcade-host', listed ? "Host the match from this browser, listed publicly in the game browser: anyone can join, and friends also join with the code or invite link (Esc → Host tab shows them). People who join take bots' places." : "Host the match from this browser: a join code and an invite link for friends (Esc → Host tab shows them), who take bots' places. (No community hub is set, so it isn't listed in the game browser.)"],
      ],
      online ? 'online' : 'offline',
      (v) => {
        this.hostOnline = v === 'online';
        this.refreshSetup();
        // (The redraw shuts its menu: the keyboard stays on what it now says.)
        document.getElementById('arcade-where-now')?.focus({ preventScroll: true });
      },
      { id: 'arcade-where', label: 'Where the match runs' },
    );

    // Saved setups: a small menu (load one, delete it, or save this one by name).
    const saved = listSetups();
    const pick = el('select', { id: 'setup-saved-list', title: 'Saved setups' }, el('option', { value: '', textContent: saved.length ? 'Load a saved setup…' : 'No saved setups yet' }), ...saved.map((x) => el('option', { value: x.name, textContent: x.name, selected: x.name === this.setupName })));
    pick.addEventListener('change', () => pick.value && this.loadSaved(pick.value));
    const nameIn = el('input', { id: 'setup-save-name', placeholder: 'Name this setup', maxLength: 40, value: this.setupName ?? '' });
    nameIn.setAttribute('aria-label', 'Name this setup');
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
    const menu = el('details', { class: 'saved-menu', id: 'setup-saved' }) as HTMLDetailsElement;
    menu.open = this.folds.has('setup-saved');
    menu.addEventListener('toggle', () => (menu.open ? this.folds.add('setup-saved') : this.folds.delete('setup-saved')));
    const badge = this.setupName ? `${this.setupName}${same ? '' : ' (changed)'}` : saved.length ? `${saved.length} saved` : '';
    menu.setAttribute('aria-label', 'Save preset: saved setups');
    menu.append(
      el('summary', { title: `Saved setups: save this one by name, or load one${badge ? ` (${badge})` : ''}` }, glyph(GLYPHS.save), el('span', { textContent: 'Save preset' })),
      el('div', { class: 'saved-pop', role: 'dialog' }, el('h4', {}, 'Saved setups', ...(badge ? [el('small', { textContent: badge })] : [])), el('div', { class: 'saved-row' }, nameIn, save), el('div', { class: 'saved-row' }, pick, del)),
    );

    // Spectate: the same match with you watching (a bot plays your place); J joins the game.
    const nobody = players <= 1 ? 'Add bots first: there would be nobody to watch.' : playlist ? 'Playlists are played, not watched: pick "Just this map" to spectate.' : null;
    const spectate = el('button', { type: 'button', class: 'go spectate', id: 'arcade-spectate' }, el('span', { textContent: 'Spectate' }));
    spectate.dataset.tip = `Start the match watching it: you follow players or fly a free camera while ${online ? 'friends and bots play' : 'the bots go at it'} (a bot takes your place). Press J to join the game.`;
    inert(spectate, nobody);
    spectate.addEventListener('click', () => !nobody && this.start({ spectate: true }));
    const start = el('button', { type: 'button', class: 'primary go', id: 'arcade-start', title: online ? `Start the match and host it online: ${listed ? 'listed in the game browser, and ' : ''}friends join with a code, taking bots' places (Enter)` : 'Start the match offline: you and the bots (Enter)' }, glyph(GLYPHS.play, 'glyph solid'), el('span', { textContent: 'Start match' }));
    start.addEventListener('click', () => this.start());
    const note = online ? [el('p', { class: 'foot-note', id: 'arcade-online-note', textContent: listed ? "Online: listed in the game browser; friends also join with the code (Esc → Host tab, in the match), taking bots' places." : "Online: friends join with a code (Esc → Host tab, in the match) and take bots' places." })] : [];
    // Where it runs: a small menu saying which (the mock-up's dropdown), its two ways inside (the same switch as before).
    const whereMenu = el('details', { class: 'where-menu', id: 'arcade-where-menu' }) as HTMLDetailsElement;
    const whereNow = el('summary', { id: 'arcade-where-now', title: online ? 'Start match hosts it online: friends join, taking bots\' places. Click to change.' : 'Start match plays offline: you and the bots. Click to change.' }, el('i', { class: `where-dot${online ? ' online' : ''}` }), el('span', { textContent: online ? 'Host online' : 'Offline' }));
    whereNow.setAttribute('aria-label', `Where the match runs: ${online ? 'Host online' : 'Offline'}`);
    whereMenu.append(whereNow, el('div', { class: 'where-pop' }, el('h4', { textContent: 'Where the match runs' }), where));
    // One bar that never scrolls away: Save preset, where it runs, Spectate, and Start match the largest.
    return el('div', { class: 'setup-foot' }, ...note, el('div', { class: 'foot-bar' }, menu, whereMenu, spectate, start));
  }

  /**
   * The Presets tab's saved setups: a row each (its map and mode; Load, Delete). Saving is the foot's Save preset,
   * in view from every tab.
   */
  private savedList(): HTMLElement[] {
    const saved = listSetups();
    const rows = saved.map((x) => {
      const m = this.maps.find((k) => k.key === (x.setup as { map?: unknown }).map);
      const mode = (x.setup as { mode?: GameMode }).mode;
      const load = el('button', { type: 'button', class: 'saved-load', textContent: 'Load', title: `Load "${x.name}"` });
      load.addEventListener('click', () => this.loadSaved(x.name));
      const del = el('button', { type: 'button', class: 'link saved-del', textContent: 'Delete', title: `Delete "${x.name}"` });
      del.setAttribute('aria-label', `Delete the saved setup ${x.name}`);
      del.addEventListener('click', () => {
        deleteSetup(x.name);
        if (this.setupName === x.name) this.setupName = null;
        this.refreshSetup();
      });
      const row = el('div', { class: `saved-item${x.name === this.setupName ? ' on' : ''}` }, el('span', { class: 'saved-what' }, el('b', { textContent: x.name }), el('small', { textContent: `${m ? m.metadata.name : 'A map that is not here any more'}${mode && MODE_LABEL[mode] ? ` · ${MODE_LABEL[mode]}` : ''}` })), load, del);
      row.dataset.name = x.name;
      return row;
    });
    return [
      el('h4', { class: 'pane-title', textContent: 'Saved setups' }),
      el('div', { class: 'saved-items', id: 'setup-saved-items' }, ...(rows.length ? rows : [el('p', { class: 'setup-hint', textContent: 'None yet. Save preset (below) keeps this setup by name: its map, mode, teams and rules.' })])),
    ];
  }

  /** The Bots section's line about your own bots (a bot set), and Edit bots… (the Bots window). */
  private botSetRow(map: MapDocument, sizes: readonly number[], players: number): HTMLElement {
    const s = this.setup;
    const edit = el('button', { type: 'button', id: 'arcade-botset', textContent: s.botSet ? 'Edit bots…' : 'Name your bots…', title: 'Your own bots: names, looks, skill, style, team and squad' });
    edit.addEventListener('click', () => {
      if (document.getElementById('bot-manager')) return;
      const sides = sizes.length ? mapTeams(map, sizes.length) : [];
      const win = botManager({
        set: s.botSet ?? null,
        teams: sides.map((t, i) => ({ name: s.teamNames?.[i] || t.name, color: s.teamColors?.[i] || t.color })),
        presets: BOT_SET_PRESETS,
        applyLabel: 'Use these bots',
        note: `Bots join in this order${sizes.length ? ', each on its team (Auto: wherever needed)' : ''}. ${players} players in all, you included.`,
        players: Math.max(0, players - 1),
        onApply: (set) => this.change((x) => (set ? (x.botSet = set) : delete x.botSet)),
        onClose: () => (document.getElementById('arcade-botset') as HTMLElement | null)?.focus(),
      });
      this.root.append(win);
    });
    const clear = el('button', { type: 'button', class: 'link', id: 'arcade-botset-clear', textContent: 'Random', title: 'Back to random bots', hidden: !s.botSet });
    clear.addEventListener('click', () => this.change((x) => delete x.botSet));
    return settingRow('Your bots', 'Name your bots and pick their looks, skill, style, team and squad (bots in a squad stick together). Built-in sets too: Knights vs Space Crew, Zombie horde, Classic mix.', el('div', { class: 'bot-set-line' }, el('span', { class: 'bot-set-sum', id: 'arcade-botset-sum', textContent: botSetLabel(s.botSet), title: botSetLabel(s.botSet) }), clear, edit));
  }

  /**
   * More layouts…: every fixed shape (1v1 … 48v48, 2v2v2v2, 4×4, FFA 8/16) and MapMaker's other layouts, beside
   * the presets worked out for the map. Each starts an editable setup; a team layout moves a free-for-all to
   * Team Deathmatch (and an FFA one back) when the map has it. Options that can't work here say why.
   */
  private moreLayouts(current: ArcadeMap): HTMLElement {
    const s = this.setup;
    const max = deviceMaxPlayers();
    const teamModes = current.modes.filter((m) => isTeamMode(m));
    const anyTeams = teamModes.filter((m) => !isTwoTeamMode(m));
    const ffaModes = current.modes.filter((m) => !isTeamMode(m) && !isCoopMode(m));
    const select = el('select', { id: 'arcade-teams', class: 'more-layouts', title: 'More layouts: a starting point you can then change' }) as HTMLSelectElement;
    select.setAttribute('aria-label', 'More layouts');
    select.append(new Option('More layouts…', ''));
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
    // Past this device's cap (32 v 32 in a browser, 8 v 8 on a phone): a dedicated host's sizes.
    for (const p of SETUP_PRESETS) {
      if (presetPlayers(p) > max) continue;
      if (p.sizes) {
        shown.add(p.sizes.join(','));
        add(teams, p.sizes.join(','), p.label, presetPlayers(p), teamWhy(p.sizes));
      } else add(ffa, `ffa:${p.ffa}`, p.label, presetPlayers(p), isTeamMode(s.mode) || isCoopMode(s.mode) ? (ffaModes.length ? null : 'no free-for-all on this map') : null);
    }
    const more = el('optgroup', { label: 'More layouts' });
    for (const p of TEAM_PRESETS) if (!shown.has(p.join(',')) && p.reduce((a, b) => a + b, 0) <= max) add(more, p.join(','), teamLayoutLabel(p), p.reduce((a, b) => a + b, 0), teamWhy(p));
    select.append(teams, ffa, more);
    select.addEventListener('change', () => {
      const v = select.value;
      if (!v) return;
      if (!v.startsWith('ffa:')) {
        const sizes = v.split(',').map(Number);
        this.evenTeams = sizes.every((n) => n === sizes[0]);
      }
      this.change((x) => {
        if (v.startsWith('ffa:')) {
          if (isTeamMode(x.mode) || isCoopMode(x.mode)) {
            x.mode = ffaModes.includes('core.deathmatch') ? 'core.deathmatch' : ffaModes[0]!;
            x.scoreLimit = BASE_RULES[x.mode].scoreLimit;
            x.scoreAuto = true;
          }
          x.bots = Number(v.slice(4)) - 1;
          return;
        }
        const sizes = v.split(',').map(Number);
        if (!isTeamMode(x.mode)) {
          const pool = sizes.length > 2 ? anyTeams : teamModes;
          x.mode = pool.includes('core.tdm') ? 'core.tdm' : pool[0]!;
          x.scoreLimit = BASE_RULES[x.mode].scoreLimit;
          x.scoreAuto = true;
        }
        x.teams = sizes;
        if (x.playerTeam !== undefined && x.playerTeam >= sizes.length) x.playerTeam = sizes.length - 1;
      });
    });
    return select;
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
    this.stopped = null;
    // Even teams shows on again for a saved layout whose teams are matched.
    this.evenTeams = true;
    setLastSetup(name);
    this.saveSetup();
    this.setStatus('');
    this.setupScroll = 0;
    this.folds.delete('setup-saved');
    this.go('play');
  }

  private saveSetup(): void {
    storage('cs.arcade', JSON.stringify(this.setup));
  }

  /**
   * Start the match as the switch says (Offline, or Host online: listed in the game browser when there's a community
   * hub, and a join code for friends: the Host tab's Host online). `spectate`: you join it watching (a bot plays your
   * place; J joins the game).
   */
  private start(o: { spectate?: boolean } = {}): void {
    const m = this.currentMap();
    if (!m.map) return void m.load().then(() => this.currentMap() === m && this.start(o), () => this.setStatus(`${m.metadata.name} failed to load`));
    this.saveSetup();
    // The Recent tab: this map first.
    this.browse.recent = [m.key, ...this.browse.recent.filter((k) => k !== m.key)].slice(0, RECENT_MAPS);
    saveBrowsePrefs(this.browse);
    // What fits here: this device's limit (a setup saved on a bigger computer plays smaller on a phone).
    const { rules, fill } = rulesFromSetup(this.setup, m.map, playerCap(this.setup.mode, m.map, deviceMaxPlayers()).max);
    const playlist = this.setup.mode === 'core.coop' && !!this.setup.playlist && PLAYLISTS.some((p) => p.id === this.setup.playlist);
    // A co-op playlist starts on its own first map; the chain carries on from there (played, offline).
    if (playlist) return o.spectate ? undefined : this.hooks.playPlaylist(this.setup.playlist!, fill, this.setup.skill, this.setup.botSet ?? null);
    // Team modes: bots fill every team to its size and you take a place on one; otherwise the bot filler counts you too.
    this.hooks.playLocal(m.map, rules, fill, this.setup.skill, this.hostOnline, this.setup.botSet ?? null, !!o.spectate);
  }

  // ---------------------------------------------------------------- host: change map mid-match

  /**
   * The map picker for a host changing map mid-match (pause menu → Match →
   * Change map): the Arcade's map cards with their screenshots, for one mode
   * at a time (tabs: every mode the maps offer). `suiteOnly`: only maps of our
   * suite (servers and Host game); otherwise `own` maps join too (offline:
   * your MapMaker maps).
   */
  hostMapPicker(o: { mode: GameMode; current: string; suiteOnly: boolean; isSuite: (id: string) => boolean; own?: readonly ArcadeMap[]; title?: string; onPick: (m: ArcadeMap, mode: GameMode) => void; onClose: () => void }): HTMLElement {
    const maps = [...this.maps.filter((m) => !o.suiteOnly || (!m.group && o.isSuite(m.metadata.id))), ...(o.suiteOnly ? [] : (o.own ?? []))];
    const modes = GAME_MODES.filter((mode) => maps.some((m) => m.modes.includes(mode)));
    let mode: GameMode = modes.includes(o.mode) ? o.mode : (modes[0] ?? 'core.deathmatch');
    let picked: ArcadeMap | null = null;
    const cards = el('div', { class: 'map-cards' });
    const tabs = el('div', { class: 'tabs hm-modes' });
    const chosen = el('span', { class: 'hm-chosen' });
    const go = el('button', { class: 'primary', id: 'hm-go', textContent: o.title ?? 'Change map', disabled: true });
    const close = el('button', { class: 'hm-close', id: 'hm-close', textContent: 'Cancel' });
    close.addEventListener('click', () => o.onClose());
    // Back, top left (as on every screen and window): the same as Cancel.
    const back = el('button', { type: 'button', class: 'back-btn', id: 'hm-back', title: 'Back without changing the map (Esc)' }, el('span', { textContent: '◀' }), 'Back');
    back.firstElementChild!.setAttribute('aria-hidden', 'true');
    back.addEventListener('click', () => o.onClose());
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
    return el('div', { class: 'host-maps', id: 'host-maps' }, el('div', { class: 'hm-head' }, back, el('h3', { textContent: o.title ?? 'Change map' }), tabs), cards, el('div', { class: 'hm-foot' }, chosen, close, go));
  }

  // ---------------------------------------------------------------- character select

  /** Everyone on Character Select: the built-in looks (roster order), the NPC skins offered to players, then your designs. */
  private roster(): { id: string; name: string; group: string }[] {
    return [
      // An experimental character sits under Experimental, not with its group (the same rule as an experimental map).
      ...CORE_LOOKS.map((l) => ({ id: l.id, name: l.name, group: characterTier(l) === 'experimental' ? EXPERIMENTAL_SECTION : (lookGroup(l.id) ?? 'mine') })),
      ...PLAYER_NPC_LOOKS.map((l) => ({ id: l.id, name: l.name, group: lookGroup(l.id) ?? 'mine' })),
      ...listCustomLooks().map((s) => ({ id: s.id, name: s.name, group: 'mine' })),
    ];
  }

  /** Character Select's sections, in CHARACTER_GROUPS order: each group anyone is in (listed by name), Experimental when anyone is, then Yours (your designs). */
  private charSections(roster = this.roster()): { id: string; label: string; looks: { id: string; name: string }[] }[] {
    return characterSections(roster);
  }

  /**
   * Character Select: one grid that scrolls through every section (a compact header each: name and count),
   * with a jump strip above it that lights the section in view; a chip, or Q / E (LB / RB), scrolls to one.
   */
  private characters(): HTMLElement {
    const sections = this.charSections();
    const selected = this.previewed ?? this.look;

    // Q / E (LB / RB) at the ends of the strip: buttons too.
    const bumper = (dir: 1 | -1) => {
      const b = el('button', { type: 'button', class: 'bumper-btn', title: `${dir > 0 ? 'Next' : 'Previous'} section (${dir > 0 ? 'E' : 'Q'})` }, ...glyphs(dir > 0 ? 'E' : 'Q', dir > 0 ? 'RB' : 'LB'));
      b.addEventListener('click', () => this.cycle(dir));
      return b;
    };
    const chips = el('div', { class: 'char-jump-chips' });
    for (const s of sections) {
      const n = s.looks.length;
      // The count is in the section's header (and the chip's tooltip), so the strip fits on one line.
      const chip = el('button', { type: 'button', class: 'char-chip', title: `${s.label}: ${n} character${n === 1 ? '' : 's'}`, textContent: s.label });
      chip.dataset.section = s.id;
      chip.addEventListener('click', () => this.jumpToSection(s.id));
      chips.append(chip);
    }
    const jump = el('nav', { class: 'char-jump' }, bumper(-1), chips, bumper(1));
    jump.setAttribute('aria-label', 'Character sections');

    const grid = el('div', { class: 'char-grid loading' });
    // The shipped pictures appear together once they're all decoded (not face by face); a portrait drawn live
    // here (a design of yours, a look new since the last capture) shimmers in its own tile until it's ready,
    // instead of holding back the whole grid.
    // Live ones start once the shipped ones are up: drawing one blocks the page (it reads the picture back from the
    // GPU), which held the whole grid back for seconds.
    const pending: Promise<void>[] = [];
    const live: (() => void)[] = [];
    const makeTile = (c: { id: string; name: string }): HTMLElement => {
      const img = el('img', { alt: c.name });
      const tile = el('button', { class: `char-tile${c.id === this.look ? ' on' : ''}${c.id === selected ? ' previewing' : ''}`, title: c.name }, img, el('span', { textContent: c.name }));
      // Your current character wears a badge; the one shown (previewed) is outlined.
      if (c.id === this.look) tile.append(el('em', { class: 'chosen-badge', textContent: 'Chosen' }));
      const load = () =>
        this.portraits.get(c.id).then(
          async (src) => {
            img.src = src;
            await img.decode().catch(() => undefined);
          },
          () => undefined,
        );
      if (SHIPPED_PORTRAITS[c.id]) pending.push(load());
      else {
        tile.classList.add('loading');
        live.push(() => void load().then(() => tile.classList.remove('loading')));
      }
      tile.dataset.look = c.id;
      // A click (tap, Enter, controller A) shows them; nothing happens on hover, so the mouse is free to turn
      // them round. Enter / A again on the one shown, a double-click or the Choose button picks them.
      tile.addEventListener('click', (e) => (e.detail === 0 && this.previewed === c.id ? this.select(c.id) : this.preview(c.id)));
      tile.addEventListener('dblclick', () => this.select(c.id));
      return tile;
    };
    for (const s of sections) {
      const tiles = el('div', { class: 'char-sec-tiles' }, ...s.looks.map(makeTile));
      if (s.id === 'mine') {
        const design = el('button', { class: 'char-tile new', title: 'Design a new character' }, el('b', { textContent: '+' }), el('span', { textContent: 'Design new' }));
        design.addEventListener('click', () => this.hooks.openDesigner(this.look));
        tiles.append(design);
      }
      const sec = el('section', { class: 'char-sec' }, el('h4', { class: 'char-sec-head' }, el('span', { textContent: s.label }), el('b', { textContent: String(s.looks.length) })), tiles);
      sec.dataset.section = s.id;
      sec.setAttribute('aria-label', s.label);
      grid.append(sec);
    }
    void Promise.all(pending).then(() => {
      grid.classList.remove('loading');
      for (const start of live) start();
    });
    // Fade the bottom edge while there's more below; light the section in view.
    const onScroll = () => {
      grid.classList.toggle('more', grid.scrollTop + grid.clientHeight < grid.scrollHeight - 4);
      if (!this.charJumping) this.markSection(this.sectionInView(grid));
    };
    grid.addEventListener('scroll', onScroll, { passive: true });
    // Your own scrolling (wheel, trackpad, touch, the scroll bar) takes over from a jump under way.
    const takeOver = () => {
      cancelAnimationFrame(this.charGlide);
      this.charJumping = false;
    };
    for (const ev of ['wheel', 'touchstart', 'pointerdown'] as const) grid.addEventListener(ev, takeOver, { passive: true });
    new ResizeObserver(onScroll).observe(grid);
    // Open on your character (or the one shown): their section scrolled to, unless they're in the first view.
    this.charSection = null;
    requestAnimationFrame(() => {
      const t = grid.querySelector<HTMLElement>(`.char-tile[data-look="${CSS.escape(selected)}"]`);
      if (t && t.offsetTop + t.offsetHeight > grid.clientHeight) grid.scrollTop = (t.closest<HTMLElement>('.char-sec')?.offsetTop ?? 0);
      this.markSection(this.sectionInView(grid));
    });

    const info = el('div', { class: 'char-info panel' });
    this.fillInfo(info, selected);
    return el('div', { class: 'screen characters' }, this.head('Character <em>Select</em>'), jump, grid, info, this.spinZone());
  }

  /** The section at the top of the grid's view (the last one once the grid is scrolled to its end). */
  private sectionInView(grid: HTMLElement): string | null {
    const secs = [...grid.querySelectorAll<HTMLElement>('.char-sec')];
    if (!secs.length) return null;
    if (grid.scrollTop > 0 && grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 2) return secs[secs.length - 1]!.dataset.section!;
    let at = secs[0]!;
    for (const s of secs) if (s.offsetTop <= grid.scrollTop + 24) at = s;
    return at.dataset.section!;
  }

  /** Light a section's chip in the jump strip (and keep the chip in view on a narrow strip). */
  private markSection(id: string | null): void {
    if (!id || id === this.charSection) return;
    this.charSection = id;
    const strip = this.body.querySelector<HTMLElement>('.char-jump-chips');
    for (const c of strip?.querySelectorAll<HTMLElement>('.char-chip') ?? []) {
      const on = c.dataset.section === id;
      c.classList.toggle('on', on);
      c.setAttribute('aria-current', on ? 'true' : 'false');
      if (on && strip && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = c.offsetLeft - (strip.clientWidth - c.offsetWidth) / 2;
    }
  }

  /** Scroll Character Select's grid to a section; `focus` (Q / E, LB / RB) also moves the focus to its first portrait. */
  private jumpToSection(id: string, focus = false): void {
    const grid = this.body.querySelector<HTMLElement>('.char-grid');
    const sec = grid?.querySelector<HTMLElement>(`.char-sec[data-section="${CSS.escape(id)}"]`);
    if (!grid || !sec) return;
    this.markSection(id);
    this.glideGrid(grid, Math.min(sec.offsetTop, grid.scrollHeight - grid.clientHeight));
    if (focus) sec.querySelector<HTMLElement>('.char-tile')?.focus({ preventScroll: true });
  }

  /**
   * Scroll the grid to `top` over a quarter of a second (at once with reduced motion). Our own easing,
   * not scrollTo's smooth: a second smooth scrollTo while one is starting (Q, Q) left the grid where it was.
   */
  private glideGrid(grid: HTMLElement, top: number): void {
    cancelAnimationFrame(this.charGlide);
    const from = grid.scrollTop;
    const d = top - from;
    if (Math.abs(d) < 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      grid.scrollTop = top;
      this.charJumping = false;
      return;
    }
    this.charJumping = true;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 260);
      grid.scrollTop = from + d * (1 - (1 - k) ** 3);
      if (k < 1) this.charGlide = requestAnimationFrame(step);
      else this.charJumping = false;
    };
    this.charGlide = requestAnimationFrame(step);
  }

  /** Q / E (LB / RB) on Character Select: the previous or next section (round from the last to the first). */
  private stepSection(dir: 1 | -1): void {
    const ids = [...this.body.querySelectorAll<HTMLElement>('.char-sec')].map((s) => s.dataset.section!);
    if (!ids.length) return;
    const i = Math.max(0, ids.indexOf(this.charSection ?? ids[0]!));
    this.jumpToSection(ids[(i + dir + ids.length) % ids.length]!, true);
  }

  /**
   * Arrow keys / d-pad over Character Select's portraits: left and right go to the previous or next one
   * (on across the end of a row or section), up and down to the nearest one in the row above or below,
   * in this section or the next. False when the focus isn't on the grid (the caller moves it as usual).
   */
  private gridMove(dx: number, dy: number): boolean {
    if (this.screen !== 'characters') return false;
    const grid = this.body.querySelector<HTMLElement>('.char-grid');
    const f = document.activeElement as HTMLElement | null;
    if (!grid || (f && f !== document.body && !grid.contains(f))) return false;
    const tiles = [...grid.querySelectorAll<HTMLElement>('.char-tile')];
    const from = f && grid.contains(f) ? f : (grid.querySelector<HTMLElement>('.char-tile.previewing') ?? tiles[0]);
    if (!from) return false;
    let to: HTMLElement | undefined;
    if (!f || !grid.contains(f)) to = from;
    else if (dx) to = tiles[tiles.indexOf(from) + dx];
    else {
      const r = from.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const rows = tiles.map((t) => ({ t, r: t.getBoundingClientRect() })).filter(({ r: o }) => (dy > 0 ? o.top >= r.bottom - 2 : o.bottom <= r.top + 2));
      if (rows.length) {
        const rowTop = dy > 0 ? Math.min(...rows.map((o) => o.r.top)) : Math.max(...rows.map((o) => o.r.top));
        to = rows.filter((o) => Math.abs(o.r.top - rowTop) < 2).sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - cx) - Math.abs(b.r.left + b.r.width / 2 - cx))[0]?.t;
      }
    }
    if (!to) return true;
    to.focus({ preventScroll: true });
    // Into view below the section's sticky header.
    const g = grid.getBoundingClientRect();
    const t = to.getBoundingClientRect();
    const head = (to.closest('.char-sec')?.querySelector<HTMLElement>('.char-sec-head')?.offsetHeight ?? 0) + 6;
    if (t.top < g.top + head) grid.scrollTop -= g.top + head - t.top;
    else if (t.bottom > g.bottom - 6) grid.scrollTop += t.bottom - g.bottom + 6;
    return true;
  }

  /** Over the hero, beside the grid: drag (mouse or touch) to turn them round and see the whole look; or the turn buttons. */
  private spinZone(): HTMLElement {
    const zone = el('div', { class: 'char-spin', title: 'Drag to turn' });
    let last: { x: number; t: number } | null = null;
    let speed = 0;
    zone.addEventListener('pointerdown', (e) => {
      zone.setPointerCapture(e.pointerId);
      last = { x: e.clientX, t: e.timeStamp };
      speed = 0;
      this.scene.spin(0);
    });
    zone.addEventListener('pointermove', (e) => {
      if (!last) return;
      // A drag across a quarter of the window is about half a turn.
      const turn = ((e.clientX - last.x) / Math.max(320, window.innerWidth)) * Math.PI * 2 * 1.2;
      const dt = Math.max(1, e.timeStamp - last.t) / 1000;
      speed = speed * 0.5 + (turn / dt) * 0.5;
      this.scene.spin(turn);
      last = { x: e.clientX, t: e.timeStamp };
    });
    const end = (e: PointerEvent) => {
      if (!last) return;
      // A flick keeps turning; a drag that stopped before letting go doesn't.
      this.scene.spin(0, e.timeStamp - last.t < 80 ? Math.max(-12, Math.min(12, speed)) : 0);
      last = null;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    const turn = (dir: number, label: string, text: string) => {
      const b = el('button', { class: 'spin-btn', title: label, textContent: text });
      b.setAttribute('aria-label', label);
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', () => this.scene.spin(0, dir * 5.2));
      return b;
    };
    // The turn keys (, and .) are shown here, by the buttons that do the same, rather than in the bottom bar.
    zone.append(el('div', { class: 'spin-bar' }, turn(-1, 'Turn left (,)', '⟲'), el('span', { class: 'spin-label' }, 'Drag to turn', el('kbd', { class: 'g-kbm', textContent: ', .' })), turn(1, 'Turn right (.)', '⟳')));
    return zone;
  }

  private fillInfo(info: HTMLElement, id: string): void {
    const l = getLook(id);
    const name = this.lookName(id);
    const img = el('img', { alt: '' });
    void this.portraits.get(id).then((src) => (img.src = src), () => undefined);
    const outfits = [...new Set(l.parts.map((p) => partInfo(p)?.outfit).filter((x): x is 'ranger' | 'peasant' | 'athlete' => !!x))].map((o) => FAMILY_LABEL[o]).join(' / ');
    // What you spawn with in the match setup's weapon set (the setup's own, else its map's default; Standard: the mode's).
    const kitSet = getWeaponSet(matchWeaponSet({ weaponSet: this.setup.weaponSet }, this.currentMap().map ?? null));
    const grenade = setThrowables(kitSet)?.[0] ?? 'frag';
    const loadout = el(
      'div',
      { class: 'loadout' },
      el('h4', { textContent: kitSet.id === 'standard' ? 'Loadout' : `Loadout · ${kitSet.name}` }),
      ...(kitSet.spawn ?? DEFAULT_RULES[this.setup.mode]?.startingWeapons ?? DEFAULT_RULES['core.deathmatch'].startingWeapons).map((w) => {
        const icon = weaponIcon(w, 'wicon large');
        return el('span', { title: getWeapon(w).displayName }, ...(icon ? [icon] : []), getWeapon(w).displayName);
      }),
      ...(kitSet.randomGun ? [el('span', { title: `A random main gun of the ${kitSet.name} set, a new one each life` }, '＋ A random gun each life')] : []),
      el('span', { title: `${THROWABLE_DEFS[grenade].displayName} (G)` }, `● ${THROWABLE_DEFS[grenade].displayName}`),
    );
    // Character stats (shown while the match setup plays with them): each against everyone's range.
    const stats = this.setup.stats === false ? null : statBars(id, this.setup.sizes !== false);
    const chosen = id === this.look;
    const choose = el('button', { id: 'char-choose', class: 'primary', disabled: chosen, textContent: chosen ? 'Chosen' : `Choose ${name}`, title: chosen ? 'Your character now' : `Play as ${name} (Enter, controller A)` });
    choose.addEventListener('click', () => this.select(id));
    const customise = el('button', { textContent: 'Customise' });
    customise.addEventListener('click', () => this.hooks.openDesigner(id));
    // Whole-body originals are one model: nothing to swap, so no Customise.
    if (l.whole) customise.hidden = true;
    const role = npcLookRole(id);
    if (role) {
      // An NPC skin: their look only; you keep a player's body, health and loadout.
      const group = lookGroup(id);
      const kind = group ? CHARACTER_GROUP_LABELS[group] : NPC_ROLE_SPECS[role].creature ? 'Creature' : 'Soldier';
      info.replaceChildren(img, el('div', { class: 'who' }, el('h3', { textContent: name }), el('p', { textContent: `Play as the ${name}. Looks only: same hitbox, health and loadout as everyone else.` }), el('div', { class: 'tags' }, el('span', { textContent: 'NPC' }), el('span', { textContent: kind }))), loadout, el('div', { class: 'char-actions' }, choose));
      return;
    }
    const bot = CHARACTER_PROFILES[id];
    const style = bot ? botStyleLine(bot) : '';
    info.replaceChildren(
      img,
      el('div', { class: 'who' }, el('h3', { textContent: name }), el('p', { textContent: LOOK_BIOS[id] ?? 'Your own design.' }), ...(style ? [el('p', { class: 'bot-style', textContent: style })] : []), el('div', { class: 'tags' }, ...(lookGroup(id) ? [el('span', { textContent: CHARACTER_GROUP_LABELS[lookGroup(id)!] })] : []), ...(l.whole ? [el('span', { textContent: 'Original' })] : [el('span', { textContent: l.body === 'male' ? 'Male' : 'Female' }), el('span', { textContent: outfits })]))),
      ...(stats ? [stats] : []),
      loadout,
      el('div', { class: 'char-actions' }, choose, customise),
    );
  }

  private preview(id: string): void {
    this.previewed = id;
    this.scene.setLook(id);
    for (const t of this.body.querySelectorAll<HTMLElement>('.char-tile[data-look]')) t.classList.toggle('previewing', t.dataset.look === id);
    const info = this.body.querySelector('.char-info');
    if (info) this.fillInfo(info as HTMLElement, id);
  }

  /** Choose: they're yours, and you're back where Character Select was opened from (Profile shows them). */
  private select(id: string): void {
    this.useLook(id);
    this.go(this.charFrom === 'characters' ? 'home' : this.charFrom);
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
    // A code or a whole invite link (pasted): the link's party puts you on your friend's side.
    const code = el('input', { id: 'join-code', placeholder: 'ABC123 or invite link', maxLength: 600, autocomplete: 'off', title: 'The six-letter code, or the invite link your friend sent' });
    const joinCode = el('button', { class: 'primary', id: 'join-by-code', type: 'submit', textContent: 'Join' });
    const go = (c: string) => {
      if (!this.verified) {
        this.name = name.value.trim() || this.name;
        storage('cs.name', this.name);
      }
      this.hooks.joinCode(c, this.displayName);
    };
    // The friend's game you were last in (a few hours): back in with one press.
    const last = lastJoin();
    const again = last ? el('button', { type: 'button', class: 'link', id: 'join-again', textContent: `Rejoin your last friend's game (${last.code})` }) : null;
    again?.addEventListener('click', () => go(last!.code));
    const codeForm = el('form', { class: 'form panel' }, el('h4', { textContent: "Join a friend's game" }), el('label', {}, 'Code or invite link', code), joinCode, ...(again ? [again] : []), el('p', { class: 'hint', textContent: "Your friend hosts from their match (Esc → Host tab) or a dedicated server, then sends you the code or invite link. Joining with the link puts you on their side (their party); everyone stays together into the next map." }));
    codeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const invite = parseInvite(code.value);
      if (!invite) return void (code.style.outline = '2px solid #e74c3c');
      joinParty(invite.party);
      go(invite.code);
    });
    // Hosting: from a match (nothing to install), or a dedicated server (the optional Host Service, explained on /host).
    const hosting = el('div', { class: 'form panel host-options' }, el('h4', { textContent: 'Host a game' }), el('p', { class: 'hint', textContent: 'From any match: Esc → Host game. Nothing to install.' }), el('a', { href: '/host', id: 'host-dedicated', class: 'link', textContent: 'Host a dedicated server…' }));
    return el('div', { class: 'screen online' }, this.head('Online <em>Play</em>'), el('div', { class: 'online-grid' }, this.gameBrowser(), el('div', { class: 'online-side' }, codeForm, hosting, this.lanPanel(), form)));
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
    // Which maps: all, the game's own, or community maps (made in MapMaker and hosted by players).
    const filter = el('select', { id: 'gb-filter', title: 'Which maps' }, ...([['all', 'All maps'], ['ours', 'Our maps'], ['community', 'Community maps']] as const).map(([v, t]) => el('option', { value: v, textContent: t, selected: v === this.gbMaps })));
    filter.addEventListener('change', () => {
      this.gbMaps = filter.value as typeof this.gbMaps;
      void load();
    });
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
        if (g.pick) {
          const pick = el('span', { class: 'gb-tag pick', textContent: 'Community Pick' });
          pick.dataset.tip = 'Players made this a Community Pick by playing it (docs: Community maps).';
          tags.push(pick);
        }
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
        g.community ? communityMapRow(g, this.listingMap(g)) : this.listingMap(g),
        el('span', { class: 'gb-mode', textContent: MODE_LABEL[g.mode] ?? g.mode }),
        el('span', { class: 'gb-players', textContent: `${g.players}/${g.max}` }),
        g.community && g.contentHash ? el('span', { class: 'gb-join' }, join, reportButton(g.contentHash, g.map)) : join,
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
        const games = (await fetchGames()).filter((g) => this.gbMaps === 'all' || (this.gbMaps === 'community') === !!g.community).map((g, i) => ({ g, i })).sort((a, b) => Number(b.g.region === mine) - Number(a.g.region === mine) || a.i - b.i).map((x) => x.g);
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
      el('div', { class: 'gb-top' }, el('h3', { class: 'panel-title', textContent: 'Game browser' }), status, filter, refresh),
      list,
      el('div', { class: 'gb-hub' }, el('span', { textContent: 'Community hub' }), hub, saveHubBtn),
    );
  }

  // ---------------------------------------------------------------- profile

  /**
   * Your profile, one panel: your character (Change character opens Character Select and comes back
   * here), you as a player (signed in: your username, your name in every match as a verified account,
   * kept on the game server, and Sign out; signed out: your guest name and Sign in), your region and
   * the privacy page. Your Google name and email are never shown.
   */
  private profile(): HTMLElement {
    const who = currentAccount();
    const p = cachedProfile();
    const kicker = (text: string) => el('h4', { class: 'prof-kicker', textContent: text });

    // Your character.
    const img = el('img', { alt: '' });
    void this.portraits.get(this.look).then((src) => (img.src = src), () => undefined);
    const change = el('button', { type: 'button', class: 'primary', id: 'profile-change-character', title: 'Open Character Select (C, controller Y)', textContent: 'Change character' });
    change.addEventListener('click', () => this.go('characters'));
    const group = lookGroup(this.look);
    const kind = group ? CHARACTER_GROUP_LABELS[group] : listCustomLooks().some((l) => l.id === this.look) ? 'Your design' : '';
    const character = el('section', { class: 'prof-sec prof-char' }, img, el('div', { class: 'prof-char-text' }, kicker('Character'), el('h3', { textContent: this.lookName(this.look) }), ...(kind ? [el('span', { class: 'prof-tag', textContent: kind })] : []), change));

    // Region (the game browser lists games near you first).
    const regions = el('select', { id: 'profile-region' }, ...REGIONS.map((r) => el('option', { value: r.id, textContent: r.label, selected: r.id === myRegion() })));
    const regionNote = el('small', { class: 'hint', textContent: 'The game browser shows games in your region first.' });
    regions.addEventListener('change', () => {
      setRegion(regions.value as Region).then(
        () => (regionNote.textContent = 'Saved.'),
        (e: Error) => (regionNote.textContent = `Not saved: ${e.message}`),
      );
    });
    const region = el('section', { class: 'prof-sec' }, el('label', {}, 'Region', regions), regionNote);
    const privacyLink = el('a', { href: '/privacy/', target: '_blank', rel: 'noopener', id: 'privacy-link', textContent: 'Privacy' });
    const foot = el('div', { class: 'prof-foot hint' }, el('span', { textContent: 'Your Google name and email are never shown to anyone: players see your username.' }), privacyLink);
    const head = this.head('Your <em>Profile</em>');
    const panel = (...secs: HTMLElement[]) => el('div', { class: 'screen profile' }, head, el('div', { class: 'profile-panel panel', id: 'profile-panel' }, character, ...secs, region, foot));

    if (!who) {
      // A guest: the name you play under (set in Options), and Sign in where it's offered.
      const editName = el('button', { type: 'button', class: 'link', id: 'profile-edit-name', textContent: 'Change it in Options' });
      editName.addEventListener('click', () => ((this.optionsTab = 'general'), this.go('options')));
      const player = el('section', { class: 'prof-sec prof-player', id: 'profile-form' }, kicker('Player'), el('div', { class: 'prof-name' }, el('b', { textContent: this.displayName }), el('span', { class: 'acct guest', textContent: 'Guest' })), el('p', { class: 'hint' }, 'Your name in matches, marked GUEST online. ', editName));
      if (signInAvailable()) {
        const signin = el('button', { type: 'button', class: 'cta', id: 'profile-sign-in', textContent: 'Sign in' });
        signin.addEventListener('click', () => void signIn());
        player.append(el('div', { class: 'prof-signin' }, el('p', { textContent: 'Sign in (a ToshiroPlay account, with Google) to pick a username: your name in every match, shown with a ✓ so nobody can pass for you. Playing never needs an account.' }), signin));
      }
      return panel(player);
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
    // Signed in: who you are (your username, never your Google name) with Sign out, then the username form.
    const out = el('button', { type: 'button', id: 'sign-out', textContent: 'Sign out' });
    out.addEventListener('click', () => signOut());
    const state = this.accountState();
    const account = el('div', { class: 'prof-name' }, el('b', { textContent: p?.username ?? 'Signed in' }), el('span', { class: `acct ${state.cls}`, textContent: state.text }), out);
    const form = el('form', { class: 'prof-sec prof-player', id: 'profile-form' }, kicker('Player'), account, el('label', {}, 'Username', name), status, save);
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
    foot.append(id);
    // Your community maps on the hub (and the owner's summary): communityUi.ts.
    return hubSetting() ? panel(form, communityPanel(kicker)) : panel(form);
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
    const firstPerson = el('select', {}, ...FIRST_PERSON_MODES.map((m) => el('option', { value: m, textContent: FIRST_PERSON_LABELS[m], selected: m === loadFirstPersonMode() })));
    firstPerson.addEventListener('change', () => saveFirstPersonMode(firstPerson.value as FirstPersonMode));
    const perfOverlay = el('input', { type: 'checkbox', checked: loadPerfOverlay() });
    perfOverlay.addEventListener('change', () => savePerfOverlay(perfOverlay.checked));
    const hitboxes = el('input', { type: 'checkbox', checked: loadHitboxOverlay() });
    hitboxes.addEventListener('change', () => saveHitboxOverlay(hitboxes.checked));
    // Reduce flashing (game/reduceFlashing.ts): on by default; the pause menu has it too.
    const calmFlashes = el('input', { type: 'checkbox', checked: reduceFlashing() });
    calmFlashes.id = 'opt-reduce-flashing';
    calmFlashes.addEventListener('change', () => saveReduceFlashing(calmFlashes.checked));
    // Room lights (game/roomLights.ts): on by default; the pause menu has it too.
    const roomLights = el('input', { type: 'checkbox', checked: roomLightsOn() });
    roomLights.id = 'opt-room-lights';
    roomLights.addEventListener('change', () => saveRoomLights(roomLights.checked));
    const fullscreen = el('button', { type: 'button' });
    bindFullscreenButton(fullscreen);
    const tutorialBtn = el('button', { type: 'button', id: 'opt-tutorial', textContent: 'Start tutorial' });
    tutorialBtn.addEventListener('click', () => this.hooks.playTutorial());
    // First-time tips (game/tips.ts): on unless switched off; Show tips again forgets the ones seen.
    const autoReload = el('input', { type: 'checkbox', checked: autoReloadOn() });
    autoReload.id = 'opt-auto-reload';
    autoReload.addEventListener('change', () => saveAutoReload(autoReload.checked));
    const dmgNumbers = el('input', { type: 'checkbox', checked: damageNumbersOn() });
    dmgNumbers.id = 'opt-damage-numbers';
    dmgNumbers.addEventListener('change', () => saveDamageNumbers(dmgNumbers.checked));
    const sprayOn = el('input', { type: 'checkbox', checked: sprayReadoutOn() });
    sprayOn.id = 'opt-spray-readout';
    sprayOn.addEventListener('change', () => saveSprayReadout(sprayOn.checked));
    const tipsOn = el('input', { type: 'checkbox', checked: !loadTipState().off });
    tipsOn.id = 'opt-tips';
    tipsOn.addEventListener('change', () => setTipsOn(tipsOn.checked));
    const tipsReset = el('button', { type: 'button', id: 'opt-tips-reset', textContent: 'Reset tips' });
    tipsReset.addEventListener('click', () => {
      resetTips();
      tipsOn.checked = true;
      tipsReset.textContent = 'Done: tips show again';
    });
    const mouse = loadMousePrefs();
    const sens = el('input', { type: 'range', min: '0.2', max: '4', step: '0.1', value: String(mouse.sensitivity) });
    const sensVal = el('output', { textContent: `${mouse.sensitivity.toFixed(1)}×` });
    const zoomSens = el('input', { type: 'range', min: '0.2', max: '3', step: '0.05', value: String(mouse.zoomSensitivity) });
    const zoomSensVal = el('output', { textContent: `${mouse.zoomSensitivity.toFixed(2)}×` });
    const invert = el('input', { type: 'checkbox', checked: mouse.invertY });
    const assist = el('input', { type: 'checkbox', checked: mouse.aimAssist });
    const mouseChanged = () => {
      saveMousePrefs({ sensitivity: Number(sens.value) || 1, zoomSensitivity: Number(zoomSens.value) || 1, invertY: invert.checked, aimAssist: assist.checked });
      sensVal.textContent = `${(Number(sens.value) || 1).toFixed(1)}×`;
      zoomSensVal.textContent = `${(Number(zoomSens.value) || 1).toFixed(2)}×`;
    };
    const steer = el('select', {}, el('option', { value: 'classic', textContent: 'Classic: A / D steer', selected: loadSteerMode() === 'classic' }), el('option', { value: 'look', textContent: 'Look to steer (Warthog style)', selected: loadSteerMode() === 'look' }));
    steer.addEventListener('change', () => saveSteerMode(steer.value as SteerMode));
    sens.addEventListener('input', mouseChanged);
    zoomSens.addEventListener('input', mouseChanged);
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
      ['Quick melee (punch; kick on the move or after a punch)', 'Side mouse button · Y'],
      ['Hold breath (scoped)', 'Shift'],
      ['Reload', 'R'],
      ['Use · get in or out of a vehicle', 'E'],
      ['Third person · in a vehicle: cockpit or chase camera', 'H'],
      ['Weapons (Q tap: your last weapon)', '1–9 · Wheel · Q'],
      ['Scores', 'Tab'],
      ['Fullscreen', 'F11 · Alt+Enter'],
      ['Controller: move / look', 'Left stick / right stick'],
      ['Controller: fire / aim', 'RT / LT'],
      ['Controller: jump / crouch', 'A / B'],
      ['Controller: reload / next weapon', 'X / Y'],
      ['Controller: weapon wheel (right stick points, let go to switch)', 'Hold Y'],
      ['Controller: use / throw', 'RB / hold LB'],
      ['Controller: sprint / ping', 'L3 / D-pad up'],
      ['Controller: third person / vehicle camera', 'R3'],
    ];
    const bindingList = (rows: [string, string][]) => el('div', { class: 'controls' }, ...rows.map(([a, k]) => el('div', {}, el('span', { textContent: a }), kbd(k))));
    const pad = 'Controller: ';
    // Phones and tablets (game/touchControls.ts).
    const touchList = bindingList([
      ['Move (push past the rim to sprint)', 'Left pad'],
      ['Jump · crouch', "Tap · hold the pad's middle"],
      ['Look', 'Drag on the right half'],
      ['Fire (drag it to aim while firing)', 'Fire'],
      ['Aim down sights (toggle)', 'Aim'],
      ['Quick melee · reload · use · throw', 'Melee · Reload · Use · Throw'],
      ['Weapon wheel', 'Weapons'],
      ['Pause', 'II (top left)'],
    ]);
    const keyboard = bindingList(bindings.filter(([a]) => !a.startsWith(pad)));
    const controller = bindingList(bindings.filter(([a]) => a.startsWith(pad)).map(([a, k]) => [a.slice(pad.length).replace(/^./, (c) => c.toUpperCase()), k]));
    // Crosshair styles and colours (reference board: crosshair styles).
    // The weapon wheel's key: press the button, then the key (Esc keeps the old one).
    const wheelKey = el('button', { type: 'button', class: 'key-bind', textContent: keyLabel(loadWheelKey()) });
    const wheelNote = el('small', { class: 'key-bind-note' });
    wheelKey.addEventListener('click', () => {
      wheelKey.textContent = 'Press a key…';
      wheelNote.textContent = '';
      const take = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.removeEventListener('keydown', take, true);
        if (e.code !== 'Escape') {
          if (RESERVED_KEYS.has(e.code)) wheelNote.textContent = `${keyLabel(e.code)} already does something else in play.`;
          else saveWheelKey(e.code);
        }
        wheelKey.textContent = keyLabel(loadWheelKey());
      };
      window.addEventListener('keydown', take, true);
    });
    const wheelReset = el('button', { type: 'button', class: 'link', textContent: 'Default (Q)' });
    wheelReset.addEventListener('click', () => {
      saveWheelKey(DEFAULT_WHEEL_KEY);
      wheelKey.textContent = keyLabel(DEFAULT_WHEEL_KEY);
      wheelNote.textContent = '';
    });
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
        row('Tutorial', tutorialBtn, 'Two minutes on the Training Range: moving, shooting, grenades and a buggy. Skip it any time.'),
        row('Player name', name, this.verified ? 'Your username: change it in Profile.' : 'What other players see.'),
        row('Clan tag', clan, 'Up to five letters, shown before your name.'),
        row('Volume', el('span', { class: 'opt-range' }, volume, volumeVal)),
      ]],
      ['display', 'Display', [
        row('Fullscreen', fullscreen, 'F11 or Alt+Enter also switch it.'),
        row('Graphics', graphics, 'Applies from your next match. Medium suits most computers; drop to Low if the game stutters, try High on a strong graphics card.'),
        row('Room lights', toggle(roomLights), 'On by default: lamps light the rooms around them. Off, they still glow but the sun and sky light everything: try it if dark squares show on lit walls (and tell us). On a phone at Low graphics lamps only glow, and rooms are lit a little brighter instead. Also in the pause menu (Settings).'),
        row('Render scale', renderScale, 'Pixels drawn per screen point. Native on a Retina screen is four times the work; Auto is barely softer and much cooler and quieter on laptops.'),
        row('Frame cap', frameCap, 'Most frames drawn a second. 60 is smooth and keeps laptops cool.'),
        row('First person', firstPerson, 'Full body: look down and see your character, legs and feet. Arms only: just your arms on the gun. The gun handles the same either way.'),
        row('Performance overlay', toggle(perfOverlay), 'Frame time and what each frame costs, top left in a match (F3). If the game runs slowly, Pause → Settings → Copy performance report gives a report to send.'),
        // A dev and test setting: only on a dev server, a test build or a page served from this machine.
        ...(hitboxOverlayAllowed() ? [row('Show hitboxes', toggle(hitboxes), 'Developer: draws every body\'s hit shapes (head red, torso yellow, arms green, legs blue) in your next match. Also ?hitboxes=1.')] : []),
      ]],
      ['controls', 'Controls', [
        row('Mouse sensitivity', el('span', { class: 'opt-range' }, sens, sensVal)),
        row('Zoom sensitivity', el('span', { class: 'opt-range' }, zoomSens, zoomSensVal), 'Look speed when aiming down the sights or through a scope. At 1.00× the view moves on screen just as it does in hip fire; lower is steadier, higher is quicker.'),
        row('Invert look', toggle(invert), 'Mouse up looks down.'),
        row('Vehicle steering', steer, 'Look to steer: cars, buggies and hovercraft turn toward where you look (A / D still steer too), and the view stays where you point it. Classic: A and D steer and the view turns with the vehicle. Applies from your next match.'),
        row('Auto-reload', toggle(autoReload), 'On by default: an empty magazine reloads by itself once the gun is ready, without a trigger pull. Sprinting or a quick melee still break a reload.'),
        row('Aim assist', toggle(assist), isTouchDevice() ? 'Gently pulls your sights onto enemies near the crosshair: a help with touch controls.' : 'Helps on a touchpad: look with the arrow keys, fire with F and aim with X. Controllers work too (click into the game first).'),
        row('Weapon wheel', el('span', { class: 'opt-stack' }, el('span', { class: 'key-bind-row' }, wheelKey, wheelReset), wheelNote), 'Hold it to open a wheel of the weapons you carry, point with the mouse and let go to switch (a click picks too). A quick tap of Q still goes back to your last weapon. On a controller hold Y; on a phone tap Weapons.'),
        ...(isTouchDevice() ? [el('h3', { class: 'opt-sub', textContent: 'Touch' }), touchList] : []),
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
        row('Damage numbers', toggle(dmgNumbers), 'What each of your hits did, floating up from the target for a moment: gold for a head hit, cyan where armour took part, bolder for the kill. On the Training Range\'s boards it shows what that round would do to a body there.'),
        row('Spray pattern', toggle(sprayOn), 'A small panel plots where your last burst went, round by round, against a ring the width of a body at 25 m, and how long your aim took to settle. Handy on the Training Range\'s recoil wall.'),
        row('First-time tips', toggle(tipsOn), 'A short hint the first time something happens in a match: low ammo, a vehicle in reach, a pickup, armour, spawn protection, your first death. Each shows once.'),
        row('Show tips again', tipsReset, 'Every tip shows once more.'),
      ]],
      ['accessibility', 'Accessibility', [
        row('Reduce flashing', toggle(calmFlashes), 'On by default. Lightning glows steadily instead of crackling, blasts and muzzle flashes near you are dimmer and fade in, blinking lights pulse gently at most once a second, and taking damage tints the screen edge a dull red that eases in. For players sensitive to flashing light (photosensitive epilepsy). Also in the pause menu (Settings).'),
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
      this.head('Game <em>Options</em>'),
      el('div', { class: 'opt-layout panel' }, nav, body),
    );
  }

  /** The section of Options last open (Q / E step through them). */
  private optionsTab = 'general';
  private static readonly OPTION_TABS = ['general', 'display', 'controls', 'hud', 'accessibility', 'online'];

  // ---------------------------------------------------------------- keyboard

  private onKey(e: KeyboardEvent): void {
    if (this.root.hidden || (e.target instanceof HTMLInputElement && e.key !== 'Escape')) return;
    // A window open over the menu (Filter maps) takes the keys: Escape closes it, not the screen under it.
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape') {
      // One level per press, and never a press the browser used (leaving fullscreen, a held Esc repeating).
      if (browserTookEscape(e)) return;
      e.preventDefault();
      // Typing in a box (search, name): the first Esc only leaves the box.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || (t instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'button'].includes(t.type)))) return t.blur();
      // Match setup's saved setups menu, open: Esc closes it (one level per press).
      if (this.screen === 'home' && this.quickOpen) return this.closeQuickPlay();
      const menu = this.screen === 'play' ? this.root.querySelector<HTMLDetailsElement>('#setup-saved[open], #arcade-where-menu[open]') : null;
      if (menu) {
        menu.open = false;
        return menu.querySelector('summary')?.focus();
      }
      this.back();
    } else if (this.screen === 'home' && this.quickOpen) {
      // Quick Play's choice is open: its own buttons take the keys.
    } else if (this.screen === 'home' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      this.setNav(this.navIndex + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (this.screen === 'home' && e.key === 'Enter' && !(e.target instanceof HTMLButtonElement && !e.target.closest('.nav'))) {
      // (Enter on another button, the Profile entry or the featured map, presses that one.)
      e.preventDefault();
      this.navItems[this.navIndex]!.act();
    } else if (this.screen === 'home' && e.key === 'p') {
      this.go('profile');
    } else if (this.screen === 'profile' && e.key === 'c' && !(e.target instanceof HTMLSelectElement)) {
      this.go('characters');
    } else if (this.screen === 'characters' && e.key.startsWith('Arrow') && this.gridMove(e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0, e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0)) {
      e.preventDefault();
    } else if (this.screen === 'play' && e.key === 'Enter' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement || (e.target as HTMLElement | null)?.tagName === 'SUMMARY')) {
      e.preventDefault();
      this.start();
    } else if (this.screen === 'play' && (e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement)) {
      // F: the Filter maps window (never while typing: a text box's keys returned above; nor with a window open).
      e.preventDefault();
      this.openMapFilter();
    } else if ((this.screen === 'play' || this.screen === 'options') && (e.key === 'q' || e.key === 'e') && !(e.target instanceof HTMLSelectElement)) {
      this.cycle(e.key === 'e' ? 1 : -1);
    } else if (this.screen === 'characters' && (e.key === 'q' || e.key === 'e')) {
      this.cycle(e.key === 'e' ? 1 : -1);
    } else if (this.screen === 'characters' && e.key === 'd') {
      this.hooks.openDesigner(this.look);
    } else if (this.screen === 'characters' && e.key === 'c') {
      this.hooks.openDesigner(this.previewed ?? this.look);
    } else if (this.screen === 'characters' && (e.key === ',' || e.key === '.')) {
      this.scene.spin(0, e.key === '.' ? 5.2 : -5.2);
    } else if (this.screen === 'characters' && e.key === 'Enter' && this.previewed && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      this.select(this.previewed);
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
