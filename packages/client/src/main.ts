import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/chakra-petch/700-italic.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import { initPhysics, loadMap, rulesForMap, type GameMode, type MatchRules } from '@chronosplit/shared';
import arenaJson from '../../../maps/phase0_arena.json';
import vaultJson from '../../../maps/m3_vault.json';
import outpostJson from '../../../maps/m4_outpost.json';
import sandgateJson from '../../../maps/sandgate.json';
import citadelJson from '../../../maps/citadel.json';
import { AudioSystem } from './audio/audio.ts';
import { createEngine, type RendererKind } from './engine.ts';
import { EditorApp, type TestRequest } from './editor/editorApp.ts';
import { LocalTransport } from './game/localTransport.ts';
import { NetTransport } from './game/netTransport.ts';
import { CharacterDesigner } from './designer/characterDesigner.ts';
import { FrontEnd, type ArcadeMap } from './frontend/frontEnd.ts';
import { MenuScene } from './frontend/menuScene.ts';
import { PortraitRenderer } from './frontend/portraits.ts';
import { GameSession } from './game/session.ts';
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

const OFFLINE_MAPS = { arena: arenaJson, vault: vaultJson, outpost: outpostJson, sandgate: sandgateJson, citadel: citadelJson } as const;
type OfflineMap = keyof typeof OFFLINE_MAPS;

/** The built-in maps the Arcade offers, with the modes each supports. */
function arcadeMaps(): ArcadeMap[] {
  const entry = (key: OfflineMap, blurb: string, modes: GameMode[], bots: number): ArcadeMap[] => {
    const r = loadMap(OFFLINE_MAPS[key]);
    return r.ok ? [{ key, map: r.map, blurb, modes, bots }] : [];
  };
  return [
    ...entry('citadel', 'Castle keep: a two-storey atrium, roof terraces, every weapon.', ['core.deathmatch', 'core.tdm'], 7),
    ...entry('sandgate', 'Desert town: long street, mid doors, tunnels.', ['core.tdm', 'core.deathmatch'], 9),
    ...entry('arena', 'Graybox loop around a pillar hall, with an upper floor.', ['core.deathmatch', 'core.tdm'], 5),
    ...entry('vault', 'Doors, traps and a vault to crack.', ['core.deathmatch'], 3),
    ...entry('outpost', 'Take the outpost from the Syndicate with a militia escort.', ['core.coop'], 2),
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
      this.kind = created.kind;
      this.canvas = created.canvas;
      if (created.note) console.info(created.note);
      window.addEventListener('resize', () => this.engine.resize());
      this.menuScene = new MenuScene(this.engine);
      this.portraits = new PortraitRenderer(this.engine);
      this.front = new FrontEnd($('menu'), arcadeMaps(), {
        openEditor: () => void this.openEditor(),
        openDesigner: (look) => void this.openDesigner(look),
        playLocal: (map, rules, bots, skill) => this.playLocal(map, rules, bots, skill),
        playOnline: (server, name) => void this.playOnline(server, name),
      }, this.menuScene, this.portraits, audio, params);
      this.engine.runRenderLoop(() => this.frame());
    })();
    return this.ready;
  }

  private frame(): void {
    const now = performance.now();
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

  /** Quick start from a URL (?offline=sandgate): the map's own mode and a default bot count. */
  async playOffline(which: OfflineMap = 'arena'): Promise<void> {
    await this.init();
    const arena = loadMap(OFFLINE_MAPS[which]);
    if (!arena.ok) return void this.showMenu('Built-in map failed to load');
    // Co-op: two bot teammates; team deathmatch: 5 v 5; deathmatch maps: a lobby of opponents.
    const botFill = { outpost: 3, vault: 4, sandgate: 10, arena: 6, citadel: 8 }[which];
    this.playLocal(arena.map, rulesForMap(arena.map), botFill, 'normal');
  }

  playLocal(map: Parameters<typeof rulesForMap>[0], rules: MatchRules, botFill: number, difficulty: 'easy' | 'normal' | 'hard'): void {
    this.startSession(new LocalTransport(map, { name: this.front!.name || 'Player', look: this.front!.look, botFill, difficulty, rules }), {
      exitLabel: 'Leave match',
      exitOnF5: false,
      onExit: (reason) => void this.showMenu(reason ?? ''),
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

  private startSession(transport: Transport, o: { exitLabel: string; exitOnF5: boolean; onExit: (reason?: string) => void; onReady?: () => void }): void {
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
  void app.playOffline(which && which in OFFLINE_MAPS ? (which as OfflineMap) : 'arena');
} else if (params.has('autojoin')) void app.init().then(() => app.playOnline(app.front!.server, app.front!.name));
else void app.showMenu();
