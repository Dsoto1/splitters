import './renamedStorage.ts';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/chakra-petch/700-italic.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import { VISIBLE_IMPORTED_MAPS, isRetiredMap, isGameMode, loadMap, mapCanRun, playableModes, playlistNext, rulesForMap, rulesForMode, setIdRandom, type CarryOver, type GameMode, type MapDocument, type MatchRules, type Playlist } from '@tiletrigger/shared';
import { AudioSystem } from './audio/audio.ts';
import { createEngine, type RendererKind } from './engine.ts';
import { currentFrameCap, loadRenderScale, renderRatio } from './game/graphicsSettings.ts';
import type { EditorApp, TestRequest } from './editor/editorApp.ts';
import { FramePacer } from './game/framePacer.ts';
import type { CharacterDesigner } from './designer/characterDesigner.ts';
import { FrontEnd, type ArcadeMap } from './frontend/frontEnd.ts';
import { MenuScene } from './frontend/menuScene.ts';
import { ModelThumbnails } from './frontend/modelThumbs.ts';
import { setWeaponIconSource } from './frontend/weaponIcons.ts';
import { PortraitRenderer } from './frontend/portraits.ts';
import type { GameSession, SessionOptions, Travel } from './game/session.ts';
import { listLibrary, openFromLibrary } from './editor/storage.ts';
import { MAP_INDEX, builtInMapJson, isBuiltInMap, loadBuiltInMap, type MapIndexEntry } from './mapIndex.ts';
import { PLAYLISTS, inSuite } from './playlists.ts';
import { installFullscreenKeys } from './fullscreen.ts';
import { CALLBACK_PATH, handleAuthCallback } from './account.ts';
import { loadSignaling, type Transport } from './game/transport.ts';
import { seededRng, testMode } from './testMode.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
// Browser tests' deterministic mode (?test=1): offline only, see testMode.ts.
const TEST = testMode();
if (TEST) {
  // Seeded per page load in this browser profile: the same steps give the same ids in a fresh profile (a test's
  // own context), and a reload doesn't hand out ids already saved in the library before it.
  let loads = 1;
  try {
    loads = Number(localStorage.getItem('tiletrigger.test.loads') ?? 0) + 1;
    localStorage.setItem('tiletrigger.test.loads', String(loads));
  } catch {
    // No storage: nothing saved to collide with either.
  }
  setIdRandom(seededRng(Math.imul(TEST.seed, 1000003) + loads));
}
(window as unknown as { __testMode: typeof TEST }).__testMode = TEST;
function storage(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

type Mode = 'menu' | 'editor' | 'game' | 'designer';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** `p`, or nothing after `ms`: waits that must never hold the app back for long. */
const capped = (p: Promise<unknown>, ms: number): Promise<unknown> => Promise.race([p.catch(() => undefined), wait(ms)]);

/**
 * The UI fonts, fetched alongside the engine so the first menu draws in them
 * rather than in a fallback that then swaps and shifts every line (capped:
 * a slow font never holds the menu back for long).
 */
function loadFonts(): Promise<unknown> {
  const faces = ['italic 700 16px "Chakra Petch"', '700 16px "Chakra Petch"', '600 16px "Chakra Petch"', '500 16px "Chakra Petch"', '400 16px Barlow', '500 16px Barlow', '600 16px Barlow'];
  return capped(Promise.all(faces.map((f) => document.fonts?.load(f))), 1500);
}

/**
 * Hide the 3D view until its scene can draw everything it has (shaders
 * compiled, textures in, the menu's hero standing there), then fade it in:
 * no half-built frames, grey before the sky or pop-in on a first visit. The
 * page behind is the menu's own colour. Callers cap `ready`, so this never adds a wait of its own.
 */
let revealing = 0;
function revealWhenReady(ready: Promise<unknown>): void {
  const token = ++revealing;
  const view = $('view');
  view.classList.add('veiled');
  void ready.catch(() => undefined).then(() => {
    if (token !== revealing) return;
    // One more frame drawn with everything in, then fade.
    requestAnimationFrame(() => requestAnimationFrame(() => token === revealing && view.classList.remove('veiled')));
  });
}

/** The quick-start names (?offline=) of the original maps, and their files in maps/. */
const OFFLINE_MAPS = { arena: 'phase0_arena', vault: 'm3_vault', outpost: 'm4_outpost', sandgate: 'sandgate', citadel: 'citadel', canyon: 'canyon' } as const;
type OfflineMap = keyof typeof OFFLINE_MAPS;
const isOfflineMap = (key: string): key is OfflineMap => Object.hasOwn(OFFLINE_MAPS, key);
/** Maps converted from TimeSplitters MapMaker saves: their own chunks, and their own "Imported" group in the Arcade. */
const importedMaps = (ids?: readonly string[]): Promise<Record<string, unknown>> => import('./importedMaps.ts').then((m) => m.loadImportedMaps(ids));

/** The match code (matchCode.ts: session, transports, physics), loaded once; a failed load is tried again next time. */
type MatchCode = typeof import('./game/matchCode.ts');
let matchCode: Promise<MatchCode> | undefined;
function loadMatchCode(): Promise<MatchCode> {
  matchCode ??= import('./game/matchCode.ts')
    .then(async (m) => {
      // Physics is needed by every session for client prediction, online or local.
      await m.initPhysics();
      return m;
    })
    .catch((e: unknown) => {
      matchCode = undefined;
      throw e;
    });
  return matchCode;
}

/** An Arcade entry whose map is already loaded (imported maps, your MapMaker maps). */
function loadedEntry(key: string, map: MapDocument, rest: Omit<ArcadeMap, 'key' | 'metadata' | 'map' | 'load'>): ArcadeMap {
  return { key, metadata: map.metadata, map, load: () => Promise.resolve(map), ...rest };
}

/** An Arcade entry for a built-in map: the card from the index, the map itself loaded the first time it's needed (and kept). */
function builtInEntry(key: string, e: MapIndexEntry, rest: Omit<ArcadeMap, 'key' | 'metadata' | 'map' | 'load'>): ArcadeMap {
  let loading: Promise<MapDocument> | undefined;
  const entry: ArcadeMap = {
    key,
    metadata: e.metadata,
    load: () =>
      (loading ??= loadBuiltInMap(e.key).then(
        (doc) => {
          if (!doc) throw new Error(`map ${e.key} failed to load`);
          entry.map = doc;
          return doc;
        },
        (err: unknown) => {
          loading = undefined;
          throw err;
        },
      )),
    ...rest,
  };
  return entry;
}

const byName = (a: ArcadeMap, b: ArcadeMap) => a.metadata.name.localeCompare(b.metadata.name);
const blurbOf = (description: string) => description.split(/(?<=\.)\s/)[0] ?? '';
const botsFor = (players: { max: number }) => Math.max(3, Math.min(11, players.max - 1));

/** Arcade entries for a set of map files (imported maps), from each map's own metadata, by name. */
function arcadeEntries(files: Record<string, unknown>, group?: string): ArcadeMap[] {
  return Object.entries(files)
    .flatMap(([path, json]): ArcadeMap[] => {
      const key = path.replace(/^.*\/|\.json$/g, '');
      if (isOfflineMap(key) || isRetiredMap(key)) return [];
      const r = loadMap(json);
      if (!r.ok) return [];
      return [loadedEntry(key, r.map, { blurb: blurbOf(r.map.metadata.description), modes: playableModes(r.map), bots: botsFor(r.map.metadata.recommendedPlayers), ...(group ? { group } : {}) })];
    })
    .sort(byName);
}

/** The built-in maps the Arcade offers, with the modes each supports (from the index: no map file is loaded for this). */
function arcadeMaps(): ArcadeMap[] {
  const indexed = new Map(MAP_INDEX.map((e) => [e.key, e]));
  const entry = (key: OfflineMap, blurb: string, modes: GameMode[], bots: number): ArcadeMap[] => {
    const e = indexed.get(OFFLINE_MAPS[key]);
    // Modes the map gains from its objectives (flag bases, hills) join the built-in list.
    return e ? [builtInEntry(key, e, { blurb, modes: [...modes, ...e.modes.filter((m) => !modes.includes(m))], bots })] : [];
  };
  return [
    ...entry('canyon', 'Outdoor canyon: two bases, boulder fields, hills and a ridge ledge.', ['core.tdm', 'core.deathmatch'], 9),
    ...entry('citadel', 'Castle keep in an outer bailey: a two-storey atrium, roof terraces, every weapon.', ['core.deathmatch', 'core.tdm'], 9),
    ...entry('sandgate', 'Desert town: long street, mid doors, tunnels.', ['core.tdm', 'core.deathmatch'], 9),
    // Every other map in maps/ (the homage maps and any added later) joins the list from its own metadata;
    // arena, vault and outpost are retired (RETIRED_MAPS) and stay reachable only by ?offline= for tests.
    ...MAP_INDEX.filter((e) => !isOfflineMap(e.key) && !isRetiredMap(e.key))
      .map((e) => builtInEntry(e.key, e, { blurb: blurbOf(e.metadata.description), modes: e.modes, bots: botsFor(e.metadata.recommendedPlayers) }))
      .sort(byName),
  ];
}

/** Your MapMaker maps (this browser's library), for an offline host's Change map. */
function ownMaps(): ArcadeMap[] {
  return listLibrary().flatMap((e): ArcadeMap[] => {
    const r = openFromLibrary(e.id);
    return 'map' in r ? [loadedEntry(`own:${e.id}`, r.map, { blurb: 'Your map', modes: playableModes(r.map), bots: 4, group: 'Your' })] : [];
  });
}

/** Run `f` when the page is idle (soon after, at the latest). */
function whenIdle(f: () => void, timeout = 3000): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => f(), { timeout });
  else setTimeout(f, 200);
}

// One audio system for the whole app. Browsers only start audio after a user
// gesture, so the first click or key press unlocks it.
const audio = new AudioSystem();
audio.setVolume(Number(storage('cs.volume') ?? 0.8));
const volumeInput = $<HTMLInputElement>('volume');
volumeInput.value = String(Math.round(audio.getVolume() * 100));
volumeInput.addEventListener('input', () => {
  audio.setVolume(Number(volumeInput.value) / 100);
  storage('cs.volume', String(audio.getVolume()));
});
for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => audio.unlock(), { capture: true });
installFullscreenKeys();
(window as unknown as { __audio: AudioSystem }).__audio = audio;

/** Top-level shell: one Babylon engine shared by the main menu, MapMaker and game sessions. */
class App {
  private engine!: AbstractEngine;
  private kind!: RendererKind;
  private canvas!: HTMLCanvasElement;
  private mode: Mode = 'menu';
  private editor?: EditorApp;
  private session?: GameSession;
  private designer?: CharacterDesigner;
  private menuScene?: MenuScene;
  private portraits?: PortraitRenderer;
  front?: FrontEnd;
  private ready?: Promise<void>;
  private last = performance.now();
  private readonly pacer = new FramePacer();

  init(): Promise<void> {
    this.ready ??= (async () => {
      const maps = arcadeMaps();
      // The home screen's featured map draws its plan: fetch that one map alongside the engine.
      const featured = maps.find((m) => m.key === 'sandgate') ?? maps[0];
      const [created] = await Promise.all([createEngine($<HTMLCanvasElement>('view')), loadFonts(), featured && capped(featured.load(), 5000)]);
      this.engine = created.engine;
      this.applyRenderScale();
      window.addEventListener('tiletrigger:render-scale', () => this.applyRenderScale());
      this.kind = created.kind;
      this.canvas = created.canvas;
      if (created.note) console.info(created.note);
      window.addEventListener('resize', () => this.engine.resize());
      this.menuScene = new MenuScene(this.engine);
      this.portraits = new PortraitRenderer(this.engine);
      setWeaponIconSource(new ModelThumbnails(this.engine));
      // Imported maps stay out of the list until each one is verified (docs/IMPORTED_MAPS_AUDIT.md):
      // the verified ones join the Arcade, ?imported lists them all, ?offline=<name> opens any one.
      void importedMaps(params.has('imported') ? undefined : VISIBLE_IMPORTED_MAPS).then(
        (files) => maps.push(...arcadeEntries(files, 'Imported')),
        (e: unknown) => console.warn('imported maps failed to load', e),
      );
      this.front = new FrontEnd($('menu'), maps, {
        openEditor: () => void this.openEditor(),
        openDesigner: (look) => void this.openDesigner(look),
        playLocal: (map, rules, bots, skill, host) => this.playLocal(map, rules, bots, skill, undefined, undefined, host),
        playOnline: (server, name) => void this.playOnline(server, name),
        playPlaylist: (id, botFill, skill) => this.playPlaylist(id, botFill, skill),
        joinCode: (code, name) => void this.joinCode(code, name),
      }, this.menuScene, this.portraits, audio, params);
      this.engine.runRenderLoop(() => this.frame());
    })();
    return this.ready;
  }

  /** Draw at the chosen render scale (pixels per CSS pixel). */
  applyRenderScale(): void {
    this.engine.setHardwareScalingLevel(1 / renderRatio(loadRenderScale()));
    this.engine.resize();
  }

  private frame(): void {
    const now = performance.now();
    // Frame cap: skip this display refresh if the next frame isn't due yet (ProMotion screens refresh at 120 Hz).
    if (!this.pacer.tick(now, currentFrameCap())) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.mode === 'menu') this.menuScene?.frame(dt);
    else if (this.mode === 'game') this.session?.frame();
    else if (this.mode === 'editor') this.editor?.frame(dt);
    else if (this.mode === 'designer') this.designer?.frame(dt);
  }

  async showMenu(status = ''): Promise<void> {
    // Only the first visit has anything to wait for: coming back, the menu scene is already loaded.
    if (!this.ready) {
      const shown = this.init().then(() => capped(this.menuScene!.ready(), 2500));
      revealWhenReady(shown);
      // Once the menu is up and the page idle, fetch what Play needs (the match code and the map it opens on).
      void shown.then(() => whenIdle(() => this.prefetchPlay(), 2000));
    }
    await this.init();
    this.mode = 'menu';
    this.editor?.hide();
    this.front!.show(status);
  }

  /** Polite prefetch (idle, after the menu is shown): the match code and the map Play opens on, so Start doesn't wait. */
  private prefetchPlay(): void {
    void this.front?.preloadCurrentMap();
    void loadMatchCode().catch(() => undefined);
  }

  /**
   * Run `f` with the match code, loading it first if the prefetch hasn't yet
   * (the menu stays up meanwhile). Only the latest request runs: a second
   * Start while the first is still loading replaces it.
   */
  private matchRequest = 0;
  private async withMatch(f: (m: MatchCode) => void): Promise<void> {
    const token = ++this.matchRequest;
    let m: MatchCode;
    try {
      m = await loadMatchCode();
    } catch (e) {
      console.error('match code failed to load', e);
      this.front?.setStatus('The game failed to load: check your connection and try again.');
      return;
    }
    if (token === this.matchRequest) f(m);
  }

  async openDesigner(look?: string): Promise<void> {
    const [{ CharacterDesigner }] = await Promise.all([import('./designer/characterDesigner.ts'), this.init()]);
    $('menu').hidden = true;
    this.mode = 'designer';
    this.designer = new CharacterDesigner(this.engine, this.canvas, look ?? this.front!.look, (id) => {
      this.designer?.dispose();
      this.designer = undefined;
      if (id) this.front!.useLook(id);
      void this.showMenu();
    }, this.portraits);
  }

  async openEditor(): Promise<void> {
    const [{ EditorApp }] = await Promise.all([import('./editor/editorApp.ts'), this.init()]);
    const first = !this.editor;
    this.editor ??= new EditorApp({
      engine: this.engine,
      canvas: this.canvas,
      startTest: (req) => this.startTest(req),
      goHome: () => this.showMenu(),
    });
    $('menu').hidden = true;
    this.mode = 'editor';
    // Always a blank starter map; the user opens what they want from Open….
    this.editor.startFresh();
    this.editor.show();
    // The first time, its sky, ground and shaders are still on their way: fade the view in when they are.
    if (first) revealWhenReady(capped(this.editor.view.scene.whenReadyAsync(), 2000));
    // TEST starts a match in a worker: have one load the simulation while the map is being made.
    void loadMatchCode().then((m) => m.prewarmSimWorker(), () => undefined);
    // Automation hook for browser tests.
    (window as unknown as { __editor: EditorApp }).__editor = this.editor;
  }

  private startTest(req: TestRequest): void {
    const t0 = performance.now();
    void this.withMatch((m) => this.startTestWith(m, req, t0));
  }

  private startTestWith(m: MatchCode, req: TestRequest, t0: number): void {
    this.editor!.hide();
    this.startSession(m, new m.LocalTransport(req.map, { name: this.front!.name || 'Tester', look: this.front!.look, botFill: req.botFill, difficulty: req.difficulty, ...(TEST ? { test: TEST } : {}) }), {
      exitLabel: 'Back to MapMaker',
      exitOnF5: true,
      onReady: () => {
        const ms = performance.now() - t0;
        (window as unknown as { __testStartMs: number }).__testStartMs = ms;
        console.info(`TEST ready in ${ms.toFixed(0)} ms`);
      },
      onExit: (reason) => {
        this.mode = 'editor';
        this.editor!.show();
        m.prewarmSimWorker();
        if (reason) this.editor!.toast(`Test ended: ${reason}`, true);
      },
    });
  }

  /** Quick start from a URL (?offline=sandgate, &gamemode=core.ctf): the map's own mode (or the one asked for) and a default bot count; `extra` adds rules (Classes). */
  async playOffline(which: string = 'arena', mode: string | null = null, extra: Partial<MatchRules> = {}, bots = 0): Promise<void> {
    // Straight into a match: fetch its code alongside the engine.
    void loadMatchCode().catch(() => undefined);
    await this.init();
    const file = isOfflineMap(which) ? OFFLINE_MAPS[which] : which;
    const json = isBuiltInMap(file) ? await builtInMapJson(file) : (await importedMaps([which]))[`../../../maps/imported/${which}.json`];
    if (!json) return void this.showMenu(`No map called ${which}`);
    const arena = loadMap(json);
    if (!arena.ok) return void this.showMenu('Built-in map failed to load');
    // Co-op: two bot teammates; team deathmatch: 5 v 5; deathmatch maps: a lobby of opponents.
    const asked = mode && isGameMode(mode) && mapCanRun(arena.map, mode) ? mode : null;
    // Zombies: you and three bots (the horde is the crowd).
    const botFill = asked === 'core.zombies' ? 4 : (({ outpost: 3, vault: 6, sandgate: 10, arena: 4, citadel: 10, canyon: 10 } as Record<string, number>)[which] ?? Math.max(4, Math.min(12, arena.map.metadata.recommendedPlayers.max)));
    const rules = { ...(asked ? rulesForMode(arena.map, asked) : rulesForMap(arena.map)), ...extra };
    // &bots=96 (load tests): that many players in all, split evenly over two teams.
    if (bots > 0 && rules.teamSizes?.length === 2) rules.teamSizes = [Math.ceil(bots / 2), Math.floor(bots / 2)];
    this.playLocal(arena.map, rules, bots > 0 ? bots : botFill, 'normal');
  }

  /** The scenario chain being played (Arcade → co-op → Playlist): which playlist, how far in, and its settings. */
  private chain: { playlist: Playlist; index: number; botFill: number; difficulty: 'easy' | 'normal' | 'hard' } | null = null;

  /** `hosting`: Host game carried over a map change (the same join code; friends rejoin it). */
  /** `autoHost`: open a join code for friends as soon as the match starts (Play → Host). */
  playLocal(map: Parameters<typeof rulesForMap>[0], rules: MatchRules, botFill: number, difficulty: 'easy' | 'normal' | 'hard', carry?: CarryOver, hosting?: Travel['hosting'], autoHost = false): void {
    void this.withMatch((m) => this.playLocalWith(m, map, rules, botFill, difficulty, carry, hosting, autoHost));
  }

  private playLocalWith(m: MatchCode, map: Parameters<typeof rulesForMap>[0], rules: MatchRules, botFill: number, difficulty: 'easy' | 'normal' | 'hard', carry: CarryOver | undefined, hosting: Travel['hosting'], autoHost: boolean): void {
    this.startSession(m, new m.LocalTransport(map, { name: this.front!.displayName || 'Player', look: this.front!.look, botFill, difficulty, rules, ...(carry ? { carry } : {}), ...(TEST ? { test: TEST } : {}) }), {
      exitLabel: 'Leave match',
      exitOnF5: false,
      hostable: true,
      chain: !!this.chain,
      hosting,
      autoHost,
      onExit: (reason, travel) => {
        // The host changed map: the same rules, players and bot skill there (Host game friends follow).
        if (reason === 'travel' && travel?.host) return this.playLocal(travel.host.map, travel.host.rules, travel.host.fill, travel.host.skill, undefined, travel.hosting);
        if (reason === 'travel' && travel) return void this.travelLocal(travel, rules, botFill, difficulty);
        travel?.hosting?.peer.close();
        this.chain = null;
        void this.showMenu(reason ?? '');
      },
    });
  }

  /** The host's Change map (pause menu → Match): the Arcade's map cards; offline, your MapMaker maps too. */
  private mapPicker: NonNullable<SessionOptions['mapPicker']> = (o) =>
    this.front!.hostMapPicker({
      ...o,
      isSuite: inSuite,
      own: o.suiteOnly ? [] : ownMaps(),
      // A built-in map loads when its card is picked; usually it's in by the time Change map is pressed.
      onPick: (m, mode) => (m.map ? o.onPick(m.map, mode) : void m.load().then((doc) => o.onPick(doc, mode), (e: unknown) => console.warn('map failed to load', e))),
    });

  /** Start a playlist (maps/playlists): its first map; each win moves on to the next. */
  playPlaylist(id: string, botFill: number, difficulty: 'easy' | 'normal' | 'hard'): void {
    const playlist = PLAYLISTS.find((p) => p.id === id);
    if (!playlist) return void this.showMenu(`No playlist called ${id}`);
    this.chain = { playlist, index: -1, botFill, difficulty };
    void this.travelLocal({}, null, botFill, difficulty);
  }

  /**
   * A local chain moves on: the "Next map" a map named, else the playlist's
   * next. Only maps of our suite load; anything else ends the chain.
   */
  private async travelLocal(travel: Travel, rules: MatchRules | null, botFill: number, difficulty: 'easy' | 'normal' | 'hard'): Promise<void> {
    const chain = this.chain;
    const at = chain ? (chain.index < 0 ? 0 : playlistNext(chain.playlist, chain.index)) : null;
    const id = travel.id ?? (chain && at !== null ? chain.playlist.maps[at]!.map : null);
    if (!id) {
      this.chain = null;
      travel.hosting?.peer.close();
      return void this.showMenu(chain ? `${chain.playlist.name} complete!` : '');
    }
    const json = inSuite(id) ? await builtInMapJson(id).catch(() => undefined) : undefined;
    const loaded = json ? loadMap(json) : null;
    if (!loaded?.ok) {
      this.chain = null;
      travel.hosting?.peer.close();
      return void this.showMenu(`The next map (${id}) isn't one of ours`);
    }
    const entry = chain && at !== null && chain.playlist.maps[at]!.map === id ? chain.playlist.maps[at]! : null;
    if (chain) chain.index = entry ? at! : chain.index;
    const want = entry?.mode ?? (mapCanRun(loaded.map, 'core.coop') ? 'core.coop' : rules?.mode);
    const next = want && mapCanRun(loaded.map, want) ? rulesForMode(loaded.map, want) : rulesForMap(loaded.map);
    const keep = chain?.playlist.carry ?? { score: true, loadout: true };
    const c = travel.carry;
    const carry = c ? { ...(keep.score ? { kills: c.kills, deaths: c.deaths } : {}), ...(keep.loadout ? { weapons: c.weapons } : {}) } : undefined;
    this.playLocal(loaded.map, next, chain?.botFill ?? botFill, chain?.difficulty ?? difficulty, carry, travel.hosting);
  }

  /** Join a friend's hosted game (Host game) by its code. */
  async joinCode(code: string, name: string): Promise<void> {
    void loadMatchCode().catch(() => undefined);
    await this.init();
    this.front!.setStatus('Connecting…');
    const signaling = await loadSignaling();
    void this.withMatch((m) => this.startSession(m, signaling.join(code, name, this.front!.look), {
      exitLabel: 'Leave match',
      exitOnF5: false,
      onExit: (reason, travel) => {
        // The host changed map: rejoin the same code in a moment (their next match lets us in).
        if (reason === 'travel' && travel) return void window.setTimeout(() => void this.joinCode(code, name), 1200);
        void this.showMenu(reason ? `Disconnected: ${reason}` : '');
      },
    }));
  }

  async playOnline(url: string, name: string): Promise<void> {
    void loadMatchCode().catch(() => undefined);
    await this.init();
    this.front!.setStatus('Connecting…');
    void this.withMatch((m) => this.startSession(m, new m.NetTransport(url, name, this.front!.look), {
      exitLabel: 'Leave match',
      exitOnF5: false,
      onExit: (reason, travel) => {
        // The server moved on to the next map of a chain: join it again in a moment.
        if (reason === 'travel' && travel) return void window.setTimeout(() => void this.playOnline(url, name), 1200);
        void this.showMenu(reason ? `Disconnected: ${reason}` : '');
      },
    }));
  }

  private startSession(m: MatchCode, transport: Transport, o: { exitLabel: string; exitOnF5: boolean; hostable?: boolean; chain?: boolean; hosting?: Travel['hosting']; autoHost?: boolean; onExit: (reason?: string, travel?: Travel) => void; onReady?: () => void }): void {
    $('menu').hidden = true;
    this.mode = 'game';
    this.session = new m.GameSession({
      engine: this.engine,
      rendererKind: this.kind,
      canvas: this.canvas,
      transport,
      audio,
      exitLabel: o.exitLabel,
      exitOnF5: o.exitOnF5,
      hostable: !!o.hostable,
      chain: !!o.chain,
      showStats: params.has('stats'),
      onReady: o.onReady,
      portrait: this.portraits?.get(this.front!.look),
      hosting: o.hosting,
      autoHost: !!o.autoHost,
      mapPicker: this.mapPicker,
      onExit: (reason, travel) => {
        this.session = undefined;
        o.onExit(reason, travel);
      },
    });
  }
}

const app = new App();
// Back from the sign-in page (account.ts): finish signing in, then the menu.
if (location.pathname === CALLBACK_PATH) void handleAuthCallback().then((message) => app.showMenu(message ?? ''));
else if (params.get('mode') === 'assets') {
  // Team tool: inspect imported models (orientation, scale, colour, licence).
  void (async () => {
    $('menu').hidden = true;
    const { createEngine } = await import('./engine.ts');
    const { openAssetViewer } = await import('./tools/assetViewer.ts');
    const { engine, canvas } = await createEngine($<HTMLCanvasElement>('view'));
    window.addEventListener('resize', () => engine.resize());
    await openAssetViewer(engine, canvas);
  })();
} else if (params.get('mode') === 'characters') {
  // Team tool: inspect character looks, rig and animations.
  void (async () => {
    $('menu').hidden = true;
    const { createEngine } = await import('./engine.ts');
    const { openCharacterViewer } = await import('./tools/characterViewer.ts');
    const { engine, canvas } = await createEngine($<HTMLCanvasElement>('view'));
    window.addEventListener('resize', () => engine.resize());
    await openCharacterViewer(engine, canvas);
  })();
} else if (params.get('mode') === 'editor') void app.openEditor();
else if (params.get('mode') === 'designer') void app.openDesigner();
else if (params.has('offline')) {
  const which = params.get('offline');
  // &classes=1 (or a number: the per-team class limit) plays with Classes.
  const classes = params.get('classes');
  void app.playOffline(which || 'arena', params.get('gamemode'), classes ? { classes: true, ...(Number(classes) > 1 ? { classLimit: Number(classes) } : {}) } : {}, Math.max(0, Math.min(96, Number(params.get('bots')) || 0)));
} else if (params.has('join')) void app.init().then(() => app.joinCode(params.get('join') ?? '', app.front!.displayName || 'Player'));
else if (params.has('autojoin')) void app.init().then(() => app.playOnline(app.front!.server, app.front!.name));
else void app.showMenu();
