import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { initPhysics, loadMap } from '@chronosplit/shared';
import arenaJson from '../../../maps/phase0_arena.json';
import vaultJson from '../../../maps/m3_vault.json';
import { AudioSystem } from './audio/audio.ts';
import { createEngine, type RendererKind } from './engine.ts';
import { EditorApp, type TestRequest } from './editor/editorApp.ts';
import { LocalTransport } from './game/localTransport.ts';
import { NetTransport } from './game/netTransport.ts';
import { GameSession } from './game/session.ts';
import type { Transport } from './game/transport.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const nameInput = $<HTMLInputElement>('name');
const serverInput = $<HTMLInputElement>('server');

nameInput.value = params.get('name') ?? storage('cs.name') ?? `Player${Math.floor(Math.random() * 900 + 100)}`;
serverInput.value = params.get('server') ?? `ws://${location.hostname || 'localhost'}:7777`;

function storage(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

type Mode = 'menu' | 'editor' | 'game';

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
  private ready?: Promise<void>;
  private last = performance.now();

  private init(): Promise<void> {
    this.ready ??= (async () => {
      // Physics is needed by every session for client prediction, online or local.
      const [created] = await Promise.all([createEngine($<HTMLCanvasElement>('view')), initPhysics()]);
      this.engine = created.engine;
      this.kind = created.kind;
      this.canvas = created.canvas;
      if (created.note) console.info(created.note);
      window.addEventListener('resize', () => this.engine.resize());
      this.engine.runRenderLoop(() => this.frame());
    })();
    return this.ready;
  }

  private frame(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.mode === 'game') this.session?.frame();
    else if (this.mode === 'editor') this.editor?.frame(dt);
  }

  private showMenu(status = ''): void {
    this.mode = 'menu';
    this.editor?.hide();
    $('menu').hidden = false;
    $('status').textContent = status;
  }

  async openEditor(): Promise<void> {
    $('status').textContent = 'Loading MapMaker…';
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
    this.startSession(new LocalTransport(req.map, { name: nameInput.value || 'Tester', botFill: req.botFill, difficulty: req.difficulty }), {
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

  async playOffline(which: 'arena' | 'vault' = 'arena'): Promise<void> {
    await this.init();
    const arena = loadMap(which === 'vault' ? vaultJson : arenaJson);
    if (!arena.ok) return this.showMenu('Built-in map failed to load');
    this.startSession(new LocalTransport(arena.map, { name: nameInput.value || 'Player', botFill: which === 'vault' ? 4 : 6, difficulty: 'normal' }), {
      exitLabel: 'Leave match',
      exitOnF5: false,
      onExit: (reason) => this.showMenu(reason ?? ''),
    });
  }

  async playOnline(url: string, name: string): Promise<void> {
    storage('cs.name', name);
    $('status').textContent = 'Connecting…';
    await this.init();
    this.startSession(new NetTransport(url, name), {
      exitLabel: 'Leave match',
      exitOnF5: false,
      onExit: (reason) => this.showMenu(reason ? `Disconnected: ${reason}` : ''),
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
      onExit: (reason) => {
        this.session = undefined;
        o.onExit(reason);
      },
    });
  }
}

const app = new App();
$('open-editor').addEventListener('click', () => void app.openEditor());
$('play-offline').addEventListener('click', () => void app.playOffline());
$('play-vault').addEventListener('click', () => void app.playOffline('vault'));
$('join').addEventListener('submit', (e) => {
  e.preventDefault();
  void app.playOnline(serverInput.value.trim(), nameInput.value.trim());
});
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
} else if (params.get('mode') === 'editor') void app.openEditor();
else if (params.has('offline')) void app.playOffline(params.get('offline') === 'vault' ? 'vault' : 'arena');
else if (params.has('autojoin')) void app.playOnline(serverInput.value, nameInput.value);
