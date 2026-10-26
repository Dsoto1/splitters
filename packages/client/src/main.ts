import './renamedStorage.ts';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/chakra-petch/700-italic.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import { initPhysics, isGameMode, loadMap, mapCanRun, playableModes, rulesForMap, rulesForMode, type GameMode, type MatchRules } from '@tiletrigger/shared';
import arenaJson from '../../../maps/phase0_arena.json';
import vaultJson from '../../../maps/m3_vault.json';
import outpostJson from '../../../maps/m4_outpost.json';
import sandgateJson from '../../../maps/sandgate.json';
import citadelJson from '../../../maps/citadel.json';
import canyonJson from '../../../maps/canyon.json';
import { AudioSystem } from './audio/audio.ts';
import { createEngine, type RendererKind } from './engine.ts';
import { currentFrameCap, loadRenderScale, renderRatio } from './game/atmosphere.ts';
import { EditorApp, type TestRequest } from './editor/editorApp.ts';
import { LocalTransport } from './game/localTransport.ts';
import { NetTransport } from './game/netTransport.ts';
import { PeerTransport, cleanJoinCode } from './game/peerLink.ts';
import { CharacterDesigner } from './designer/characterDesigner.ts';
import { FrontEnd, type ArcadeMap } from './frontend/frontEnd.ts';
import { MenuScene } from './frontend/menuScene.ts';
import { ModelThumbnails } from './frontend/modelThumbs.ts';
import { setWeaponIconSource } from './frontend/weaponIcons.ts';
import { PortraitRenderer } from './frontend/portraits.ts';
import { GameSession } from './game/session.ts';
import { installFullscreenKeys } from './fullscreen.ts';
import type { Transport } from './game/transport.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
function storage(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

type Mode = 'menu' | 'editor' | 'game' | 'designer';

const OFFLINE_MAPS = { arena: arenaJson, vault: vaultJson, outpost: outpostJson, sandgate: sandgateJson, citadel: citadelJson, canyon: canyonJson } as const;
type OfflineMap = keyof typeof OFFLINE_MAPS;
/** Every map file shipped in maps/ (loaded up front; they are small). */
const EXTRA_MAPS = import.meta.glob<unknown>('../../../maps/*.json', { eager: true, import: 'default' });
/** Maps converted from TimeSplitters MapMaker saves: their own chunk, and their own "Imported" group in the Arcade. */
const importedMaps = (): Promise<Record<string, unknown>> => import('./importedMaps.ts').then((m) => m.IMPORTED_MAPS);

/** Arcade entries for a set of map files, from each map's own metadata, by name. */
function arcadeEntries(files: Record<string, unknown>, group?: string): ArcadeMap[] {
  return Object.entries(files)
    .flatMap(([path, json]): ArcadeMap[] => {
      const key = path.replace(/^.*\/|\.json$/g, '');
      if (key in OFFLINE_MAPS) return [];
      const r = loadMap(json);
      if (!r.ok) return [];
      const blurb = r.map.metadata.description.split(/(?<=\.)\s/)[0] ?? '';
      return [{ key, map: r.map, blurb, modes: playableModes(r.map), bots: Math.max(3, Math.min(11, r.map.metadata.recommendedPlayers.max - 1)), ...(group ? { group } : {}) }];
    })
    .sort((a, b) => a.map.metadata.name.localeCompare(b.map.metadata.name));
}

/** The built-in maps the Arcade offers, with the modes each supports. */
function arcadeMaps(): ArcadeMap[] {
  const entry = (key: OfflineMap, blurb: string, modes: GameMode[], bots: number): ArcadeMap[] => {
    const r = loadMap(OFFLINE_MAPS[key]);
    // Modes the map gains from its objectives (flag bases, hills) join the built-in list.
    return r.ok ? [{ key, map: r.map, blurb, modes: [...modes, ...playableModes(r.map).filter((m) => !modes.includes(m))], bots }] : [];
  };
  return [
    ...entry('canyon', 'Outdoor canyon: two bases, boulder fields, hills and a ridge ledge.', ['core.tdm', 'core.deathmatch'], 9),
    ...entry('citadel', 'Castle keep in an outer bailey: a two-storey atrium, roof terraces, every weapon.', ['core.deathmatch', 'core.tdm'], 9),
    ...entry('sandgate', 'Desert town: long street, mid doors, tunnels.', ['core.tdm', 'core.deathmatch'], 9),
    ...entry('arena', 'Duel arena: a tight graybox loop with an upper floor, for 2–4 players.', ['core.deathmatch', 'core.tdm'], 3),
    ...entry('vault', 'Crack the vault: doors, traps, and loops round the heist route.', ['core.deathmatch'], 5),
    ...entry('outpost', 'Take the outpost from the Syndicate: flank the courtyard, hold the uplink, reach evac.', ['core.coop'], 2),
    // Every other map in maps/ (the homage maps and any added later) joins the list from its own metadata.
    ...arcadeEntries(EXTRA_MAPS),
  ];
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

  init(): Promise<void> {
    this.ready ??= (async () => {
      // Physics is needed by every session for client prediction, online or local.
      const [created] = await Promise.all([createEngine($<HTMLCanvasElement>('view')), initPhysics()]);
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
      const maps = arcadeMaps();
      // Imported maps stay out of the list until the importer rebuilds them properly
      // (docs/ROADMAP_V1.md); they still open directly with ?offline=<name> or ?imported.
      if (params.has('imported')) {
        void importedMaps().then(
          (files) => maps.push(...arcadeEntries(files, 'Imported')),
          (e: unknown) => console.warn('imported maps failed to load', e),
        );
      }
      this.front = new FrontEnd($('menu'), maps, {
        openEditor: () => void this.openEditor(),
        openDesigner: (look) => void this.openDesigner(look),
        playLocal: (map, rules, bots, skill) => this.playLocal(map, rules, bots, skill),
        playOnline: (server, name) => void this.playOnline(server, name),
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
    // Frame cap: skip this display refresh if it comes too soon (ProMotion screens refresh at 120 Hz).
    const cap = currentFrameCap();
    if (cap && now - this.last < 1000 / cap - 1.5) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.mode === 'menu') this.menuScene?.frame(dt);
    else if (this.mode === 'game') this.session?.frame();
    else if (this.mode === 'editor') this.editor?.frame(dt);
    else if (this.mode === 'designer') this.designer?.frame(dt);
  }

  async showMenu(status = ''): Promise<void> {
    await this.init();
    this.mode = 'menu';
    this.editor?.hide();
    this.front!.show(status);
  }

  async openDesigner(look?: string): Promise<void> {
    await this.init();
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
    await this.init();
    this.editor ??= new EditorApp({
      engine: this.engine,
      canvas: this.canvas,
      startTest: (req) => this.startTest(req),
      goHome: () => this.showMenu(),
    });
    $('menu').hidden = true;
    this.mode = 'editor';
    this.editor.show();
    // Automation hook for browser tests.
    (window as unknown as { __editor: EditorApp }).__editor = this.editor;
  }

  private startTest(req: TestRequest): void {
    const t0 = performance.now();
    this.editor!.hide();
    this.startSession(new LocalTransport(req.map, { name: this.front!.name || 'Tester', look: this.front!.look, botFill: req.botFill, difficulty: req.difficulty }), {
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
        if (reason) this.editor!.toast(`Test ended: ${reason}`, true);
      },
    });
  }

  /** Quick start from a URL (?offline=sandgate, &gamemode=core.ctf): the map's own mode (or the one asked for) and a default bot count; `extra` adds rules (Classes). */
  async playOffline(which: string = 'arena', mode: string | null = null, extra: Partial<MatchRules> = {}): Promise<void> {
    await this.init();
    const json = which in OFFLINE_MAPS ? OFFLINE_MAPS[which as OfflineMap] : (EXTRA_MAPS[`../../../maps/${which}.json`] ?? (await importedMaps())[`../../../maps/imported/${which}.json`]);
    if (!json) return void this.showMenu(`No map called ${which}`);
    const arena = loadMap(json);
    if (!arena.ok) return void this.showMenu('Built-in map failed to load');
    // Co-op: two bot teammates; team deathmatch: 5 v 5; deathmatch maps: a lobby of opponents.
    const asked = mode && isGameMode(mode) && mapCanRun(arena.map, mode) ? mode : null;
    // Zombies: you and three bots (the horde is the crowd).
    const botFill = asked === 'core.zombies' ? 4 : (({ outpost: 3, vault: 6, sandgate: 10, arena: 4, citadel: 10, canyon: 10 } as Record<string, number>)[which] ?? Math.max(4, Math.min(12, arena.map.metadata.recommendedPlayers.max)));
    this.playLocal(arena.map, { ...(asked ? rulesForMode(arena.map, asked) : rulesForMap(arena.map)), ...extra }, botFill, 'normal');
  }

  playLocal(map: Parameters<typeof rulesForMap>[0], rules: MatchRules, botFill: number, difficulty: 'easy' | 'normal' | 'hard'): void {
    this.startSession(new LocalTransport(map, { name: this.front!.displayName || 'Player', look: this.front!.look, botFill, difficulty, rules }), {
      exitLabel: 'Leave match',
      exitOnF5: false,
      hostable: true,
      onExit: (reason) => void this.showMenu(reason ?? ''),
    });
  }

  /** Join a friend's hosted game (Host game) by its code. */
  async joinCode(code: string, name: string): Promise<void> {
    await this.init();
    this.front!.setStatus('Connecting…');
    this.startSession(new PeerTransport(cleanJoinCode(code), name, this.front!.look), {
      exitLabel: 'Leave match',
      exitOnF5: false,
      onExit: (reason) => void this.showMenu(reason ? `Disconnected: ${reason}` : ''),
    });
  }

  async playOnline(url: string, name: string): Promise<void> {
    await this.init();
    this.front!.setStatus('Connecting…');
    this.startSession(new NetTransport(url, name, this.front!.look), {
      exitLabel: 'Leave match',
      exitOnF5: false,
      onExit: (reason) => void this.showMenu(reason ? `Disconnected: ${reason}` : ''),
    });
  }

  private startSession(transport: Transport, o: { exitLabel: string; exitOnF5: boolean; hostable?: boolean; onExit: (reason?: string) => void; onReady?: () => void }): void {
    $('menu').hidden = true;
    this.mode = 'game';
    this.session = new GameSession({
      engine: this.engine,
      rendererKind: this.kind,
      canvas: this.canvas,
      transport,
      audio,
      exitLabel: o.exitLabel,
      exitOnF5: o.exitOnF5,
      hostable: !!o.hostable,
      showStats: params.has('stats'),
      onReady: o.onReady,
      portrait: this.portraits?.get(this.front!.look),
      onExit: (reason) => {
        this.session = undefined;
        o.onExit(reason);
      },
    });
  }
}

const app = new App();
if (params.get('mode') === 'assets') {
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
  void app.playOffline(which || 'arena', params.get('gamemode'), classes ? { classes: true, ...(Number(classes) > 1 ? { classLimit: Number(classes) } : {}) } : {});
} else if (params.has('join')) void app.init().then(() => app.joinCode(params.get('join') ?? '', app.front!.displayName || 'Player'));
else if (params.has('autojoin')) void app.init().then(() => app.playOnline(app.front!.server, app.front!.name));
else void app.showMenu();
