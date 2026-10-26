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
  MODE_LABELS,
  isTeamMode,
  LOOK_BIOS,
  MAX_PLAYER_SLOTS,
  MAX_TEAMS,
  TEAM_PRESETS,
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
} from '@tiletrigger/shared';
import { loadMousePrefs, saveMousePrefs } from '../game/input.ts';
import { loadRelay, saveRelay } from '../game/peerLink.ts';
import { installTooltips } from './tooltip.ts';
import { GRAPHICS_QUALITIES, loadGraphicsQuality, saveGraphicsQuality, type GraphicsQuality } from '../game/atmosphere.ts';
import { fetchGames, hubSetting, saveHub } from '../game/hub.ts';
import type { AudioSystem } from '../audio/audio.ts';
import { listCustomLooks } from '../designer/customLooks.ts';
import { drawMapPlan } from './mapPlan.ts';
import type { MenuScene } from './menuScene.ts';
import { weaponIcon } from './weaponIcons.ts';
import { ALLY_MARKER_COLOURS, CROSSHAIR_COLOURS, CROSSHAIR_STYLES, HITMARKER_STYLES, markerSetting, saveMarkers, crosshairSetting, hitmarkerSetting, saveCrosshair, saveHitmarker, type HitmarkerStyle } from '../game/crosshair.ts';
import type { PortraitRenderer } from './portraits.ts';
import { bindFullscreenButton } from '../fullscreen.ts';

/** A built-in map the Arcade offers. */
/** The "Inspired by …" line for a homage map (nothing for our own designs). */
function inspired(key: string): HTMLElement[] {
  const from = mapInspiration(key);
  return from ? [el('em', { class: 'inspired', textContent: `Inspired by ${from}` })] : [];
}

export interface ArcadeMap {
  key: string;
  map: MapDocument;
  blurb: string;
  modes: GameMode[];
  bots: number;
  /** Shown under its own heading after the built-in maps (e.g. "Imported"). */
  group?: string;
}

export interface ArcadeSetup {
  map: string;
  mode: GameMode;
  bots: number;
  skill: 'easy' | 'normal' | 'hard';
  scoreLimit: number;
  minutes: number;
  /** Team modes: players per team (2–8 teams; Capture the Flag uses the first two); bots fill every team. */
  teams?: number[];
  /** Team names and colours by team order (empty entries: the map's). */
  teamNames?: string[];
  teamColors?: string[];
  /** Small and large characters play differently (false: everyone standard). Absent = on. */
  sizes?: boolean;
  /** Quick messages and emotes allowed. Absent = on. */
  emotes?: boolean;
  /** How bots play. Absent = mixed (each character its own way). */
  botStyle?: 'arena' | 'tactical';
  /** Kill-streak rewards and spawning beside teammates. Absent = on. */
  killstreaks?: boolean;
  squadSpawn?: boolean;
  /** Gravity multiple and fall damage over the map's own (absent: the map's); friendly fire (absent: off). */
  gravity?: number;
  fallDamage?: boolean;
  friendlyFire?: 'half' | 'on';
  /** Spears only (absent: normal weapons). */
  spears?: boolean;
  /** Vehicles take half damage, or none (absent: normal). */
  vehicleDamage?: 'tough' | 'off';
}

export interface FrontEndHooks {
  openEditor(): void;
  openDesigner(look: string): void;
  playLocal(map: MapDocument, rules: MatchRules, bots: number, skill: ArcadeSetup['skill']): void;
  playOnline(server: string, name: string): void;
  /** Join a friend's hosted game by its code. */
  joinCode(code: string, name: string): void;
}

type ScreenId = 'home' | 'play' | 'characters' | 'online' | 'options';

const MODE_LABEL = MODE_LABELS;
const BASE_RULES = DEFAULT_RULES;
/** The score limit row per mode: its label and stepper (step, min, max). */
const SCORE_ROW: Partial<Record<GameMode, { label: string; step: number; min: number; max: number }>> = {
  'core.tdm': { label: 'Team score', step: 5, min: 5, max: 200 },
  'core.ctf': { label: 'Captures', step: 1, min: 1, max: 20 },
  'core.koth': { label: 'Hill seconds', step: 10, min: 30, max: 600 },
  'core.elim': { label: 'Rounds to win', step: 1, min: 1, max: 15 },
  'core.bomb': { label: 'Rounds to win', step: 1, min: 1, max: 15 },
  'core.hostage': { label: 'Rounds to win', step: 1, min: 1, max: 15 },
};
/** One line on each mode, for its (i). */
const MODE_TIPS: Partial<Record<GameMode, string>> = {
  'core.deathmatch': 'Everyone for themselves. Most kills wins.',
  'core.tdm': 'Teams score a point per kill. First team to the score wins.',
  'core.ctf': "Grab the enemy flag from their base and bring it to yours while your own flag is home.",
  'core.koth': 'Stand on the hill to score seconds for your team; the hill moves now and then.',
  'core.elim': 'Rounds with no respawns: wipe out the other teams to win the round.',
  'core.bomb': 'Attackers plant the bomb at site A or B (stand still, E); defenders stop them or defuse it. No respawns in a round.',
  'core.hostage': 'Rescuers lead hostages (E beside one) to the exit zone; guards hold them. No respawns in a round.',
  'core.coop': 'Work through the mission with bot squadmates against the map\'s enemies.',
  'core.zombies': 'Hold out with your bot squad against endless waves of zombies. Each wave is bigger; the fallen come back when it is beaten.',
};

/** A small (i) that explains something when hovered or focused (see the tooltip in FrontEnd). */
function infoTip(text: string): HTMLElement {
  const i = el('span', { class: 'info', tabIndex: 0, textContent: 'i' });
  i.dataset.tip = text;
  i.setAttribute('aria-label', text);
  return i;
}

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

  /** Your name as other players see it, with the clan tag. */
  get displayName(): string {
    return this.clan ? `[${this.clan}] ${this.name}` : this.name;
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
    const saved = JSON.parse(storage('cs.arcade') ?? 'null') as ArcadeSetup | null;
    const first = maps.find((m) => m.key === 'sandgate') ?? maps[0]!;
    this.setup = saved && maps.some((m) => m.key === saved.map) ? saved : { map: first.key, mode: first.modes[0]!, bots: first.bots, skill: 'normal', scoreLimit: BASE_RULES[first.modes[0]!].scoreLimit, minutes: 10 };
    root.replaceChildren(
      this.body,
      this.status,
      el('footer', { class: 'menu-footer' }, el('div', { class: 'news' }, el('b', { textContent: 'News' }), 'Welcome to the Tile Trigger playtest. New: Sandgate, Team Deathmatch and the Character Designer.'), this.footerHints),
    );
    window.addEventListener('keydown', this.keyHandler);
    this.go('home');
    (window as unknown as { __front: FrontEnd }).__front = this;
    // Render every character's portrait in the background while the menu is up, so Character Select opens ready.
    setTimeout(() => void this.warmPortraits(), 1500);
  }

  /** Portraits for all the looks, one at a time, only while the menu is showing (never during a match). */
  private async warmPortraits(): Promise<void> {
    const ids = [...CORE_LOOKS.map((l) => l.id), ...NPC_LOOKS.map((l) => l.id), ...listCustomLooks().map((l) => l.id)];
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
    const featured = this.maps.find((m) => m.key === 'sandgate') ?? this.maps[0]!;
    const plan = el('canvas');
    const card = el(
      'button',
      { class: 'featured panel', title: 'Play this map' },
      plan,
      el('div', { class: 'meta' }, el('div', { class: 'kicker', textContent: 'Featured map' }), el('h3', { textContent: featured.map.metadata.name }), ...inspired(featured.key), el('p', { textContent: `${featured.modes.map((m) => MODE_LABEL[m]).join(' · ')} — ${featured.blurb}` })),
    );
    card.addEventListener('click', () => {
      this.pickMap(featured.key);
      this.go('play');
    });
    requestAnimationFrame(() => drawMapPlan(plan, featured.map));
    return el(
      'div',
      { class: 'screen home' },
      el('h1', { class: 'logo' }, el('span', { class: 'tile', textContent: 'Tile ' }), el('span', { class: 'trigger', textContent: 'Trigger' })),
      el('p', { class: 'logo-sub', textContent: 'Make. Play. Die.' }),
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

  // ---------------------------------------------------------------- arcade

  /** Scroll position of the map list, kept across redraws of the play screen. */
  private mapScroll = 0;
  /** Refreshes the game browser while the Online screen is open. */
  private browserTimer?: number;
  /** The Arcade panel's "More rules" fold is open. */
  private moreRules = false;

  private pickMap(key: string): void {
    const m = this.maps.find((x) => x.key === key);
    if (!m) return;
    const mode = m.modes.includes(this.setup.mode) ? this.setup.mode : m.modes[0]!;
    this.setup = { ...this.setup, map: key, mode, bots: m.bots, scoreLimit: BASE_RULES[mode].scoreLimit };
  }

  private arcade(): HTMLElement {
    const current = this.maps.find((m) => m.key === this.setup.map) ?? this.maps[0]!;
    const cards = el('div', { class: 'map-cards' });
    // Picking a map redraws this screen: keep the list where it was instead of jumping to the top.
    cards.addEventListener('scroll', () => (this.mapScroll = cards.scrollTop), { passive: true });
    requestAnimationFrame(() => (cards.scrollTop = this.mapScroll));
    // Grouped maps (many, e.g. imported ones) draw their plans only once they scroll into view.
    const lazy = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((seen) => {
      for (const e of seen) {
        if (!e.isIntersecting) continue;
        lazy!.unobserve(e.target);
        const m = this.maps.find((x) => x.key === (e.target as HTMLElement).dataset.map);
        const c = e.target.querySelector('canvas');
        if (m && c) drawMapPlan(c, m.map);
      }
    }, { root: cards });
    let group: string | undefined;
    for (const m of this.maps) {
      if (m.group !== group) {
        group = m.group;
        if (group) cards.append(el('h4', { class: 'map-group', textContent: `${group} maps` }));
      }
      const plan = el('canvas');
      const card = el(
        'button',
        { class: `map-card${m.key === current.key ? ' on' : ''}` },
        plan,
        el('div', { class: 'meta' }, el('b', { textContent: m.map.metadata.name }), ...inspired(m.key), el('small', { textContent: m.blurb }), el('div', { class: 'mode-tags' }, ...m.modes.map((x) => el('span', { textContent: MODE_LABEL[x] })))),
      );
      card.dataset.map = m.key;
      card.addEventListener('click', () => {
        this.pickMap(m.key);
        this.go('play');
      });
      cards.append(card);
      if (m.group && lazy) lazy.observe(card);
      else requestAnimationFrame(() => drawMapPlan(plan, m.map));
    }
    const stepper = (value: number, step: number, min: number, max: number, set: (v: number) => void, fmt = (v: number) => String(v)) => {
      const minus = el('button', { textContent: '−' });
      const plus = el('button', { textContent: '+' });
      minus.addEventListener('click', () => (set(Math.max(min, value - step)), this.saveSetup(), this.go('play')));
      plus.addEventListener('click', () => (set(Math.min(max, value + step)), this.saveSetup(), this.go('play')));
      return el('div', { class: 'stepper' }, minus, el('b', { textContent: fmt(value) }), plus);
    };
    const tabs = (options: readonly [string, string][], value: string, set: (v: string) => void) =>
      el(
        'div',
        { class: 'tabs' },
        ...options.map(([v, label]) => {
          const b = el('button', { class: `tab${v === value ? ' on' : ''}`, textContent: label });
          b.addEventListener('click', () => (set(v), this.saveSetup(), this.go('play')));
          return b;
        }),
      );
    const s = this.setup;
    const coop = s.mode === 'core.coop' || s.mode === 'core.zombies';
    const twoTeams = s.mode === 'core.ctf' || s.mode === 'core.bomb' || s.mode === 'core.hostage';
    const start = el('button', { class: 'primary go', id: 'arcade-start' }, el('span', { textContent: 'Start match' }), el('kbd', { class: 'a', textContent: '↵' }));
    start.addEventListener('click', () => this.start());
    // A setting row: its name with an (i) explaining it on hover, then the control.
    const row = (label: string, tip: string | null, control: HTMLElement) => el('div', { class: 'row' }, el('span', { class: 'row-label' }, label, ...(tip ? [infoTip(tip)] : [])), control);
    // Extra rules sit folded away; the fold says how many differ from the defaults.
    const extras: { label: string; tip: string; changed: boolean; value: string; control: HTMLElement }[] = [
      { label: 'Weapons', tip: 'Spears only: everyone holds one throwing spear. One hit kills; go and fetch it back. No other weapons, ammo or grenades.', changed: !!s.spears, value: 'Spears only', control: tabs([['normal', 'Normal'], ['spears', 'Spears only']], s.spears ? 'spears' : 'normal', (v) => (this.setup.spears = v === 'spears' || undefined)) },
      { label: 'Bot style', tip: 'Mixed: every character plays its own way. Arena: strafe-jumping, item timing, always moving (Quake). Tactical: careful, cover, held angles (Counter-Strike).', changed: !!s.botStyle, value: `${s.botStyle === 'arena' ? 'Arena' : 'Tactical'} bots`, control: tabs([['mixed', 'Mixed'], ['arena', 'Arena'], ['tactical', 'Tactical']], s.botStyle ?? 'mixed', (v) => (this.setup.botStyle = v === 'mixed' ? undefined : (v as 'arena' | 'tactical'))) },
      { label: 'Character sizes', tip: 'Matter: small characters are smaller, quicker targets with less health that fit through gaps others must crouch for; large ones are bigger, slower and tougher. All equal: everyone plays at standard size.', changed: s.sizes === false, value: 'Equal sizes', control: tabs([['on', 'Matter'], ['off', 'All equal']], s.sizes === false ? 'off' : 'on', (v) => (this.setup.sizes = v === 'on')) },
      { label: 'Gravity', tip: "Map: whatever the map was built with (normal unless its maker changed it).", changed: s.gravity !== undefined, value: `${s.gravity === 0.4 ? 'Low' : s.gravity === 1.6 ? 'Heavy' : 'Normal'} gravity`, control: tabs([['map', 'Map'], ['0.4', 'Low'], ['1', 'Normal'], ['1.6', 'Heavy']], s.gravity === undefined ? 'map' : String(s.gravity), (v) => (this.setup.gravity = v === 'map' ? undefined : Number(v))) },
      { label: 'Fall damage', tip: "Drops past about 5 m hurt; about 16 m kills. Map: the map's own setting.", changed: s.fallDamage !== undefined, value: `Fall damage ${s.fallDamage ? 'on' : 'off'}`, control: tabs([['map', 'Map'], ['on', 'On'], ['off', 'Off']], s.fallDamage === undefined ? 'map' : s.fallDamage ? 'on' : 'off', (v) => (this.setup.fallDamage = v === 'map' ? undefined : v === 'on')) },
      { label: 'Friendly fire', tip: 'Team modes and co-op: whether your shots and blasts hurt teammates. Team kills cost a point.', changed: !!s.friendlyFire, value: `Friendly fire ${s.friendlyFire === 'half' ? 'half' : 'full'}`, control: tabs([['off', 'Off'], ['half', 'Half'], ['on', 'Full']], s.friendlyFire ?? 'off', (v) => (this.setup.friendlyFire = v === 'off' ? undefined : (v as 'half' | 'on'))) },
      { label: 'Vehicle damage', tip: 'Normal: vehicles smoke, catch fire and blow up. Tough: they take half damage. Off: they can\'t be destroyed (except by falling off the map). Turrets and sentries always take full damage.', changed: !!s.vehicleDamage, value: `${s.vehicleDamage === 'off' ? 'Indestructible' : 'Tough'} vehicles`, control: tabs([['normal', 'Normal'], ['tough', 'Tough'], ['off', 'Off']], s.vehicleDamage ?? 'normal', (v) => (this.setup.vehicleDamage = v === 'normal' ? undefined : (v as 'tough' | 'off'))) },
      { label: 'Kill streaks', tip: 'Rewards for kills without dying: 3 UAV, 5 Supply Pulse (heal + ammo for nearby teammates), 7 Counter-UAV (jams enemy minimaps), 9 Airstrike.', changed: s.killstreaks === false, value: 'No kill streaks', control: tabs([['on', 'On'], ['off', 'Off']], s.killstreaks === false ? 'off' : 'on', (v) => (this.setup.killstreaks = v === 'on')) },
      { label: 'Spawn on teammates', tip: 'Team modes: respawn beside a teammate who is out of the fight, when one is free.', changed: s.squadSpawn === false, value: 'No squad spawns', control: tabs([['on', 'On'], ['off', 'Off']], s.squadSpawn === false ? 'off' : 'on', (v) => (this.setup.squadSpawn = v === 'on')) },
      { label: 'Emotes & messages', tip: 'Quick messages (B, then 1-7; 1 "Follow me!" and 7 "Hold here!" also order your team\'s bots), the dance emote (N). Pings (T) always work.', changed: s.emotes === false, value: 'No emotes', control: tabs([['on', 'On'], ['off', 'Off']], s.emotes === false ? 'off' : 'on', (v) => (this.setup.emotes = v === 'on')) },
    ];
    const changed = extras.filter((x) => x.changed);
    const more = el('details', { class: 'setup-more' }) as HTMLDetailsElement;
    more.open = this.moreRules;
    more.addEventListener('toggle', () => (this.moreRules = more.open));
    const reset = el('button', { class: 'link', textContent: 'Reset', title: 'Back to the standard rules' });
    reset.hidden = !changed.length;
    reset.addEventListener('click', (e) => {
      e.preventDefault();
      for (const k of ['spears', 'botStyle', 'gravity', 'fallDamage', 'friendlyFire', 'killstreaks', 'squadSpawn', 'emotes', 'sizes', 'vehicleDamage'] as const) delete this.setup[k];
      this.saveSetup();
      this.go('play');
    });
    more.append(
      el('summary', {}, el('span', { textContent: 'More rules' }), el('small', { textContent: changed.length ? `${changed.length} changed` : 'standard' }), reset),
      ...extras.map((x) => row(x.label, x.tip, x.control)),
    );
    const players = isTeamMode(s.mode) ? this.teamSizes(current.map, twoTeams).reduce((a, b) => a + b, 0) : s.bots + 1;
    const modeTabs = el(
      'div',
      { class: 'mode-pick' },
      ...current.modes.map((m) => {
        const b = el('button', { class: `mode-chip${m === s.mode ? ' on' : ''}` }, el('b', { textContent: MODE_LABEL[m] }), infoTip(MODE_TIPS[m] ?? MODE_LABEL[m]));
        b.addEventListener('click', () => {
          this.setup.mode = m;
          this.setup.scoreLimit = BASE_RULES[m].scoreLimit;
          this.saveSetup();
          this.go('play');
        });
        return b;
      }),
    );
    const about = [current.map.metadata.description, current.map.metadata.author && !['Tile Trigger', 'ChronoSplit'].includes(current.map.metadata.author) ? `Map by ${current.map.metadata.author}` : ''].filter(Boolean).join('\n\n');
    const plan = el('canvas', { class: 'setup-plan' });
    requestAnimationFrame(() => drawMapPlan(plan, current.map));
    const panel = el(
      'div',
      { class: 'setup panel' },
      el('div', { class: 'setup-head' }, plan, el('div', {}, el('small', { textContent: 'Map' }), el('h3', {}, current.map.metadata.name, ...(about ? [infoTip(about)] : [])), ...inspired(current.key), el('p', { class: 'setup-sub', textContent: `${MODE_LABEL[s.mode]} · ${players} players${coop ? '' : ` · ${s.minutes ? `${s.minutes} min` : 'no time limit'}`}` }))),
      el('div', { class: 'setup-body' },
        el('section', {}, el('h4', { textContent: 'Mode' }), modeTabs),
        el('section', {}, el('h4', { textContent: coop ? 'Squad' : 'Players' }),
          ...(isTeamMode(s.mode) ? this.teamRows(current.map, stepper, twoTeams) : [row(coop ? 'Squadmates' : 'Bots', coop ? 'Bot squadmates fighting alongside you.' : 'Bots to fill the match. You play too.', stepper(s.bots, 1, 0, 15, (v) => (this.setup.bots = v)))]),
          row('Bot skill', 'Easy bots aim slowly and miss often; hard ones react fast, use cover and lead their shots.', tabs([['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], s.skill, (v) => (this.setup.skill = v as ArcadeSetup['skill'])))),
        ...(coop
          ? []
          : [
              el('section', {}, el('h4', { textContent: 'To win' }),
                ((r) => row(r.label, 'The match ends when someone reaches this.', stepper(s.scoreLimit, r.step, r.min, r.max, (v) => (this.setup.scoreLimit = v)))) (SCORE_ROW[s.mode] ?? { label: 'Score limit', step: 5, min: 5, max: 200 }),
                row('Time limit', 'When time runs out the highest score wins. ∞: no limit.', stepper(s.minutes, 1, 0, 30, (v) => (this.setup.minutes = v), (v) => (v ? `${v} min` : '∞')))),
            ]),
        more,
      ),
      el('div', { class: 'setup-foot' }, ...(changed.length ? [el('div', { class: 'rule-chips' }, ...changed.map((x) => el('span', { textContent: x.value })))] : []), start),
    );
    return el('div', { class: 'screen play' }, el('div', { class: 'screen-head' }, el('h2', { innerHTML: 'Arcade <em>Match</em>' })), el('div', { class: 'arcade' }, cards, panel));
  }

  private saveSetup(): void {
    storage('cs.arcade', JSON.stringify(this.setup));
  }

  private start(): void {
    const m = this.maps.find((x) => x.key === this.setup.map) ?? this.maps[0]!;
    const base = BASE_RULES[this.setup.mode];
    const rules: MatchRules = { ...(this.setup.mode === 'core.coop' || this.setup.mode === 'core.zombies' ? base : { ...base, scoreLimit: this.setup.scoreLimit, timeLimitSeconds: this.setup.minutes * 60 }), ...(this.setup.sizes === false ? { bodySizes: false } : {}), ...(this.setup.emotes === false ? { emotes: false } : {}), ...(this.setup.botStyle ? { botStyle: this.setup.botStyle } : {}), ...(this.setup.killstreaks === false ? { killstreaks: false } : {}), ...(this.setup.squadSpawn === false ? { squadSpawn: false } : {}), ...(this.setup.gravity !== undefined ? { gravity: this.setup.gravity } : {}), ...(this.setup.fallDamage !== undefined ? { fallDamage: this.setup.fallDamage } : {}), ...(this.setup.friendlyFire ? { friendlyFire: this.setup.friendlyFire } : {}), ...(this.setup.spears ? { weapons: 'spears' as const } : {}), ...(this.setup.vehicleDamage ? { vehicleDamage: this.setup.vehicleDamage } : {}) };
    this.saveSetup();
    if (isTeamMode(this.setup.mode)) {
      // Bots fill every team to its size; you take a place on one of them.
      const teams = this.teamSizes(m.map, this.setup.mode === 'core.ctf' || this.setup.mode === 'core.bomb' || this.setup.mode === 'core.hostage');
      const names = (this.setup.teamNames ?? []).slice(0, teams.length);
      const colors = (this.setup.teamColors ?? []).slice(0, teams.length);
      this.hooks.playLocal(m.map, { ...rules, teamSizes: teams, ...(names.some(Boolean) ? { teamNames: names } : {}), ...(colors.some(Boolean) ? { teamColors: colors } : {}) }, Math.min(MAX_PLAYER_SLOTS, teams.reduce((a, b) => a + b, 0)), this.setup.skill);
      return;
    }
    // The bot filler counts the player too.
    this.hooks.playLocal(m.map, rules, this.setup.bots + 1, this.setup.skill);
  }

  /** The team layout for team modes: your last choice, else the map's, else two teams of four (`two`: just the first two teams, for CTF). */
  private teamSizes(map: MapDocument, two = false): number[] {
    const sizes = this.setup.teams ?? (map.teamSetup ? [...map.teamSetup.sizes] : [4, 4]);
    return two ? sizes.slice(0, 2) : sizes;
  }

  /** Arcade rows for teams: a layout preset, then a stepper per team in its colour. */
  private teamRows(map: MapDocument, stepper: (value: number, step: number, min: number, max: number, set: (v: number) => void) => HTMLElement, twoTeams = false): HTMLElement[] {
    const sizes = this.teamSizes(map, twoTeams);
    const teams = mapTeams(map, sizes.length);
    const set = (next: number[]) => {
      this.setup.teams = next;
      this.saveSetup();
      this.go('play');
    };
    const preset = el('select', { id: 'arcade-teams' }) as HTMLSelectElement;
    const label = teamLayoutLabel(sizes);
    preset.append(new Option(`${label} (${sizes.reduce((a, b) => a + b, 0)} players)`, ''));
    for (const p of TEAM_PRESETS) if (teamLayoutLabel(p) !== label) preset.append(new Option(`${teamLayoutLabel(p)} (${p.reduce((a, b) => a + b, 0)} players)`, p.join(',')));
    preset.addEventListener('change', () => preset.value && set(preset.value.split(',').map(Number)));
    const plus = el('button', { class: 'tab', textContent: '+ Team' });
    plus.addEventListener('click', () => sizes.length < MAX_TEAMS && set([...sizes, sizes[sizes.length - 1] ?? 2]));
    const minus = el('button', { class: 'tab', textContent: '− Team' });
    minus.addEventListener('click', () => sizes.length > 2 && set(sizes.slice(0, -1)));
    const all = this.teamSizes(map);
    // Each team: its colour (click to change), its name (type to rename) and its size.
    const steppers = teams.map((t, i) => {
      const color = el('input', { type: 'color', value: this.setup.teamColors?.[i] || t.color, title: 'Team colour', class: 'team-color' });
      color.addEventListener('change', () => {
        const list = [...(this.setup.teamColors ?? [])];
        list[i] = color.value;
        this.setup.teamColors = list;
        this.saveSetup();
      });
      const name = el('input', { value: this.setup.teamNames?.[i] || t.name, maxLength: 24, title: 'Team name', class: 'team-name' });
      name.addEventListener('change', () => {
        const list = [...(this.setup.teamNames ?? [])];
        list[i] = name.value.trim();
        this.setup.teamNames = list;
        this.saveSetup();
      });
      return el('div', { class: 'team-size' }, color, name, stepper(sizes[i]!, 1, 1, 16, (v) => (this.setup.teams = all.map((s, j) => (j === i ? v : s)))));
    });
    // Capture the Flag is always two teams: just their sizes.
    if (twoTeams) return [el('div', { class: 'team-grid' }, ...steppers)];
    return [el('div', { class: 'row' }, 'Teams', el('div', { class: 'team-layout' }, preset, plus, minus)), el('div', { class: 'team-grid' }, ...steppers)];
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
    const name = el('input', { id: 'name', value: this.name, maxLength: 24, autocomplete: 'off' });
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
      this.name = name.value.trim() || this.name;
      this.server = server.value.trim();
      storage('cs.name', this.name);
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
      this.name = name.value.trim() || this.name;
      storage('cs.name', this.name);
      this.hooks.joinCode(c, this.displayName);
    });
    return el('div', { class: 'screen online' }, el('div', { class: 'screen-head' }, el('h2', { innerHTML: 'Online <em>Play</em>' })), el('div', { class: 'online-grid' }, this.gameBrowser(), el('div', { class: 'online-side' }, codeForm, form)));
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
      const tags = [el('span', { class: 'gb-tag', textContent: 'Player-hosted' }), ...(g.relay ? [el('span', { class: 'gb-tag relay', textContent: 'Relay' })] : [])];
      tags[0]!.dataset.tip = "Runs in the host's browser: it ends if they leave, and the host's game decides what happens (play with people you trust for anything serious).";
      if (tags[1]) tags[1].dataset.tip = 'The host set up a relay, so players on strict networks can usually still connect.';
      return el(
        'div',
        { class: 'gb-row' },
        el('div', { class: 'gb-name' }, el('b', { textContent: g.name }), el('small', { textContent: `hosted by ${g.host}` }), el('div', { class: 'gb-tags' }, ...tags)),
        el('span', { class: 'gb-map', textContent: g.map }),
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
        const games = await fetchGames();
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

  private options(): HTMLElement {
    const name = el('input', { value: this.name, maxLength: 24 });
    const clan = el('input', { value: this.clan, maxLength: 5, placeholder: 'none' });
    clan.addEventListener('change', () => {
      this.clan = clan.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase();
      clan.value = this.clan;
      storage('cs.clan', this.clan);
    });
    name.addEventListener('change', () => {
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
    const controls = el(
      'div',
      { class: 'controls' },
      ...[
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
        ['Use', 'E'],
        ['Weapons', '1–9 · Wheel · Q'],
        ['Scores', 'Tab'],
        ['Fullscreen', 'F11 · Alt+Enter'],
        ['Controller: move / look', 'Left stick / right stick'],
        ['Controller: fire / aim', 'RT / LT'],
        ['Controller: jump / crouch', 'A / B'],
        ['Controller: reload / next weapon', 'X / Y'],
        ['Controller: use / throw', 'RB / hold LB'],
        ['Controller: sprint / ping', 'L3 / D-pad up'],
      ].map(([a, k]) => el('div', {}, el('span', { textContent: a! }), kbd(k!))),
    );
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
    return el(
      'div',
      { class: 'screen options' },
      el('div', { class: 'screen-head' }, el('h2', { innerHTML: 'Game <em>Options</em>' })),
      el(
        'div',
        { class: 'form panel' },
        el('label', {}, 'Player name', name),
        el('label', {}, 'Clan tag', clan),
        el('label', {}, 'Volume', volume),
        el('label', {}, 'Display', fullscreen),
        el('label', {}, el('span', { class: 'row-label' }, 'Graphics', infoTip('Applies from your next match. Medium suits most computers; drop to Low if the game stutters, try High on a strong graphics card.')), graphics),
        el('label', {}, 'Mouse sensitivity', el('span', { class: 'row' }, sens, sensVal)),
        el('label', {}, 'Invert look', invert),
        el('label', {}, 'Aim assist', assist),
        el('p', { class: 'hint', textContent: 'Playing on a touchpad? Turn on aim assist, look with the arrow keys, fire with F and aim with X. Controllers work too (click into the game first).' }),
        el('h3', { class: 'panel-title', textContent: 'Crosshair' }),
        crosshairs,
        colours,
        el('label', {}, 'Hit marker', hitStyle),
        el('label', {}, 'Teammate marker', allySel),
        el('label', {}, 'Enemy marker', enemySel),
        el('h3', { class: 'panel-title', textContent: 'Relay (Host game / Join by code)' }),
        el('p', { class: 'hint', textContent: "If a friend finds your game but can't connect, your networks block direct connections. A TURN relay passes the game through a server instead: make a free account (e.g. metered.ca → TURN server), paste its address and login here, and invite your friend again — the invite link carries these settings." }),
        el('label', {}, 'Relay address', relayUrl),
        el('label', {}, 'Username', relayUser),
        el('label', {}, 'Password', relayPass),
        el('h3', { class: 'panel-title', textContent: 'Controls' }),
        controls,
      ),
    );
  }

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
    } else if (this.screen === 'play' && e.key === 'Enter') {
      e.preventDefault();
      this.start();
    } else if (this.screen === 'play' && (e.key === 'q' || e.key === 'e')) {
      const m = this.maps.find((x) => x.key === this.setup.map)!;
      const i = m.modes.indexOf(this.setup.mode);
      const mode = m.modes[(i + (e.key === 'e' ? 1 : m.modes.length - 1)) % m.modes.length]!;
      this.setup = { ...this.setup, mode, scoreLimit: BASE_RULES[mode].scoreLimit };
      this.go('play');
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
