import { EXPOSED_SHARE, botTestLines, matchClock, HEAT_LAYERS, HEAT_LAYER_LABELS, MODE_LABELS, exposureIssues, isTeamMode, playableModes, type GameMode, type HeatLayer, type MapDocument, type ValidationIssue } from '@tiletrigger/shared';
import type { BotTestResult, ExposureResult } from '@tiletrigger/shared/match';
import { MapTestOverlay, type MapTestOverlayHost } from './mapTestOverlay.ts';
import type { FromMapTest, ToMapTest } from './mapTestWorkerCore.ts';

/**
 * MapMaker's Test panel (overhaul Phase 4, items 1 and 2; the top bar's Bot test): a bot test run on the map being
 * edited (mode, bots, length; progress and Cancel), then its heatmaps (toggled one by one) and a short summary; and
 * the spawn exposure check, each spawn labelled with how much of the map sees it, its longest lines of sight and the
 * map's long sightlines drawn, exposed spawns warned in the validator's list. Both run in a worker of their own
 * (mapTestWorker.ts), so the editor keeps drawing and editing meanwhile; the panel times the editor's frames during a
 * run and says so with the result. The logic is shared editor/mapTest.ts; nothing is stored in the map.
 */
export interface MapTestHost {
  /** The document being edited (its modes; exposure warnings stand while it is this one). */
  doc(): MapDocument;
  /** The document as a match plays it (paths laid in, terrain under floors, set pieces expanded). */
  played(): MapDocument;
  /** Errors in the validator's list now (a test can't run with any). */
  errors(): number;
  /** The exposure warnings changed: the validator's list is drawn again. */
  issuesChanged(): void;
  toast(message: string, error?: boolean): void;
  root: HTMLElement;
  overlay: MapTestOverlayHost;
}

const LENGTHS: [number, string][] = [
  [30, '30 seconds'],
  [60, '1 minute'],
  [120, '2 minutes'],
  [180, '3 minutes'],
  [300, '5 minutes'],
];

export class MapTestPanel {
  readonly overlay: MapTestOverlay;
  readonly el: HTMLElement;
  /** The last bot run's result and the exposure check's, and the document the check was for. */
  result: BotTestResult | null = null;
  exposure: ExposureResult | null = null;
  private exposureFor: MapDocument | null = null;
  private worker: Worker | null = null;
  private exposureWorker: Worker | null = null;
  /** The editor's frames while a run goes: the longest gap between two (ms) and how many. */
  frames = { longest: 0, count: 0 };
  private frameAt = 0;
  private shownLayers = new Set<HeatLayer>(HEAT_LAYERS);
  private linesOn = true;

  constructor(private readonly host: MapTestHost) {
    this.overlay = new MapTestOverlay(host.overlay);
    const el = document.createElement('div');
    el.id = 'ed-maptest-panel';
    el.className = 'ed-maptest';
    el.hidden = true;
    el.innerHTML = `
      <div class="ed-mt-head"><h2>Test the map</h2><button id="ed-mt-close" type="button" title="Close (what's drawn stays until Clear)" aria-label="Close">×</button></div>
      <section>
        <h3>Bot test run</h3>
        <p class="ed-note">A bot match on this map in the background, then heatmaps of where bots went, got stuck, died and where their routes failed. You can keep building meanwhile.</p>
        <label class="ed-dialog-field"><span>Mode</span><select id="ed-mt-mode"></select></label>
        <label class="ed-dialog-field" id="ed-mt-team-row"><span>Bots a team</span><input id="ed-mt-team" type="number" min="1" max="16" step="1" value="4" /></label>
        <label class="ed-dialog-field" id="ed-mt-bots-row"><span>Bots</span><input id="ed-mt-bots" type="number" min="2" max="32" step="1" value="8" /></label>
        <label class="ed-dialog-field"><span>Length</span><select id="ed-mt-length"></select></label>
        <div class="ed-dialog-actions"><button id="ed-mt-run" type="button" class="primary">Run bots</button></div>
        <div id="ed-mt-progress" class="ed-mt-progress" hidden><progress id="ed-mt-bar" max="1" value="0"></progress><button id="ed-mt-cancel" type="button">Cancel</button><span id="ed-mt-status"></span></div>
        <div id="ed-mt-results" hidden>
          <ul id="ed-mt-summary" class="ed-mt-summary"></ul>
          <div id="ed-mt-layers" class="ed-mt-layers"></div>
          <p id="ed-mt-cost" class="ed-note"></p>
        </div>
      </section>
      <section>
        <h3>Spawn exposure</h3>
        <p class="ed-note">How much of the map can see each spawn, and from how far, with the long sightlines. Spawns seen from ${Math.round(EXPOSED_SHARE * 100)}% of the map or more are warned about.</p>
        <div class="ed-dialog-actions"><label class="ed-mt-check"><input id="ed-mt-lines" type="checkbox" checked /> Sightlines</label><button id="ed-mt-exposure" type="button">Check spawns</button></div>
        <div id="ed-mt-exp" class="ed-mt-exp"></div>
      </section>
      <div class="ed-dialog-actions"><button id="ed-mt-clear" type="button">Clear</button></div>`;
    host.root.append(el);
    this.el = el;
    const length = this.$<HTMLSelectElement>('ed-mt-length');
    for (const [s, label] of LENGTHS) length.append(new Option(label, String(s), s === 120, s === 120));
    for (let i = 0; i < HEAT_LAYERS.length; i++) {
      const layer = HEAT_LAYERS[i]!;
      const l = document.createElement('label');
      l.className = `ed-mt-check ed-mt-layer-${layer}`;
      l.innerHTML = `<input type="checkbox" data-layer="${layer}" checked /> <i></i><span></span>`;
      l.querySelector('span')!.textContent = HEAT_LAYER_LABELS[layer];
      l.querySelector('input')!.addEventListener('change', (e) => {
        if ((e.target as HTMLInputElement).checked) this.shownLayers.add(layer);
        else this.shownLayers.delete(layer);
        this.drawLayers();
      });
      this.$('ed-mt-layers').append(l);
    }
    this.$('ed-mt-mode').addEventListener('change', () => this.modeChanged());
    this.$('ed-mt-run').addEventListener('click', () => this.runBots());
    this.$('ed-mt-cancel').addEventListener('click', () => this.cancel());
    this.$('ed-mt-exposure').addEventListener('click', () => this.checkExposure());
    this.$('ed-mt-close').addEventListener('click', () => this.show(false));
    this.$('ed-mt-clear').addEventListener('click', () => this.clear());
    this.$<HTMLInputElement>('ed-mt-lines').addEventListener('change', (e) => {
      this.linesOn = (e.target as HTMLInputElement).checked;
      this.drawExposure();
    });
    document.getElementById('ed-maptest')?.addEventListener('click', () => this.show(this.el.hidden));
  }

  private $<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.el.querySelector<T>(`#${id}`)!;
  }

  get running(): boolean {
    return !!this.worker;
  }

  show(on: boolean): void {
    this.el.hidden = !on;
    const b = document.getElementById('ed-maptest');
    b?.classList.toggle('on', on);
    b?.setAttribute('aria-pressed', String(on));
    if (on) this.fillModes();
  }

  /** The modes this map plays (the main one first). */
  private fillModes(): void {
    const sel = this.$<HTMLSelectElement>('ed-mt-mode');
    const was = sel.value;
    const modes = playableModes(this.host.doc());
    sel.replaceChildren(...modes.map((m) => new Option(MODE_LABELS[m], m)));
    sel.value = modes.includes(was as GameMode) ? was : modes[0]!;
    const team = this.host.doc().teamSetup?.sizes[0];
    if (team && !this.result) this.$<HTMLInputElement>('ed-mt-team').value = String(Math.min(16, team));
    this.modeChanged();
  }

  private modeChanged(): void {
    const team = isTeamMode(this.$<HTMLSelectElement>('ed-mt-mode').value);
    this.$('ed-mt-team-row').hidden = !team;
    this.$('ed-mt-bots-row').hidden = team;
  }

  private newWorker(): Worker {
    return new Worker(new URL('./mapTestWorker.ts', import.meta.url), { type: 'module', name: 'maptest' });
  }

  runBots(): void {
    if (this.worker) return;
    const errors = this.host.errors();
    if (errors) return this.host.toast(`Fix ${errors} error${errors > 1 ? 's' : ''} before a bot test run`, true);
    const mode = this.$<HTMLSelectElement>('ed-mt-mode').value as GameMode;
    const seconds = Number(this.$<HTMLSelectElement>('ed-mt-length').value);
    const num = (id: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(this.$<HTMLInputElement>(id).value) || lo)));
    const opts = { mode, teamSize: num('ed-mt-team', 1, 16), bots: num('ed-mt-bots', 2, 32), seconds, seed: 1 };
    const w = this.newWorker();
    this.worker = w;
    const started = performance.now();
    this.frames = { longest: 0, count: 0 };
    this.frameAt = 0;
    this.setRunning(true, 'Building the navmesh…', 0);
    w.onmessage = (e: MessageEvent<FromMapTest>) => {
      const m = e.data;
      if (m.k === 'progress') this.setRunning(true, `${matchClock(m.seconds)} of ${matchClock(seconds)} played`, m.share);
      else if (m.k === 'ready') this.setRunning(true, `0:00 of ${matchClock(seconds)} played`, 0);
      else if (m.k === 'bots') {
        this.stop();
        this.result = m.result;
        this.showResult(performance.now() - started);
        this.host.toast(`Bot test run done: ${m.result.summary.kills} kills, ${m.result.summary.stuck} stuck recoveries`);
      } else if (m.k === 'failed') {
        this.stop();
        this.host.toast(`The bot test run failed: ${m.error}`, true);
      }
    };
    w.onerror = (e) => {
      this.stop();
      this.host.toast(`The bot test run failed: ${e.message}`, true);
    };
    w.postMessage({ k: 'bots', map: this.host.played(), opts } satisfies ToMapTest);
  }

  /** Cancel: the worker is ended at once (the editor never waited on it). */
  cancel(): void {
    if (!this.worker) return;
    this.stop();
    this.host.toast('Bot test run cancelled');
  }

  private stop(): void {
    this.worker?.terminate();
    this.worker = null;
    this.setRunning(false, '', 0);
  }

  private setRunning(on: boolean, status: string, share: number): void {
    this.$('ed-mt-progress').hidden = !on;
    this.$<HTMLButtonElement>('ed-mt-run').disabled = on;
    this.$('ed-mt-status').textContent = status;
    this.$<HTMLProgressElement>('ed-mt-bar').value = share;
    document.getElementById('ed-maptest')?.classList.toggle('busy', on);
  }

  /** Once a frame (editorApp's render loop): the spawn labels follow the camera; a run's frame times are kept. */
  frame(): void {
    this.overlay.frame();
    if (!this.worker) return;
    const now = performance.now();
    if (this.frameAt) {
      this.frames.longest = Math.max(this.frames.longest, now - this.frameAt);
      this.frames.count++;
    }
    this.frameAt = now;
  }

  private showResult(wallMs: number): void {
    const r = this.result!;
    const s = r.summary;
    this.$('ed-mt-results').hidden = false;
    const ul = this.$('ed-mt-summary');
    ul.replaceChildren();
    const lines = botTestLines(s);
    for (const t of lines) {
      const li = document.createElement('li');
      li.textContent = t;
      ul.append(li);
    }
    this.$('ed-mt-cost').textContent = `In the background: ${(wallMs / 1000).toFixed(1)} s for ${matchClock(s.seconds)} of match (${s.msPerSecond} ms of the worker's time a match second).${this.frames.count > 1 ? ` MapMaker's longest frame meanwhile: ${Math.round(this.frames.longest)} ms over ${this.frames.count} frames.` : ''}`;
    for (const input of this.el.querySelectorAll<HTMLInputElement>('#ed-mt-layers input')) {
      const layer = input.dataset.layer as HeatLayer;
      const n = r.layers[layer].reduce((a, c) => a + c.value, 0);
      input.closest('label')!.querySelector('span')!.textContent = `${HEAT_LAYER_LABELS[layer]}${layer === 'went' ? '' : ` (${n})`}`;
    }
    this.drawLayers();
  }

  private drawLayers(): void {
    const r = this.result;
    for (const layer of HEAT_LAYERS) this.overlay.setLayer(layer, r && this.shownLayers.has(layer) ? r.layers[layer] : null, r?.cell ?? 2);
  }

  checkExposure(): void {
    if (this.exposureWorker) return;
    const errors = this.host.errors();
    if (errors) return this.host.toast(`Fix ${errors} error${errors > 1 ? 's' : ''} before checking spawns`, true);
    const doc = this.host.doc();
    if (!doc.entities.some((e) => e.kind === 'spawn')) return this.host.toast('No spawn points to check', true);
    const w = this.newWorker();
    this.exposureWorker = w;
    const button = this.$<HTMLButtonElement>('ed-mt-exposure');
    button.disabled = true;
    button.textContent = 'Checking…';
    const done = () => {
      w.terminate();
      this.exposureWorker = null;
      button.disabled = false;
      button.textContent = 'Check spawns';
    };
    w.onmessage = (e: MessageEvent<FromMapTest>) => {
      const m = e.data;
      if (m.k === 'exposure') {
        done();
        this.exposure = m.result;
        this.exposureFor = doc;
        this.drawExposure();
        this.host.issuesChanged();
      } else if (m.k === 'failed') {
        done();
        this.host.toast(`The spawn check failed: ${m.error}`, true);
      }
    };
    w.onerror = (e) => {
      done();
      this.host.toast(`The spawn check failed: ${e.message}`, true);
    };
    w.postMessage({ k: 'exposure', map: this.host.played() } satisfies ToMapTest);
  }

  private drawExposure(): void {
    const x = this.exposure;
    this.overlay.setSpawnLabels(x?.spawns ?? null);
    this.overlay.setSightlines(x && this.linesOn ? x.lines : null, x && this.linesOn ? x.spawns : null);
    const box = this.$('ed-mt-exp');
    box.replaceChildren();
    if (!x) return;
    const exposed = x.spawns.filter((s) => s.share >= EXPOSED_SHARE);
    const p = document.createElement('p');
    p.className = 'ed-note';
    p.textContent = `${x.spawns.length} spawn${x.spawns.length === 1 ? '' : 's'} checked from ${x.places} places: ${exposed.length} exposed. ${x.lines.length} long sightline${x.lines.length === 1 ? '' : 's'} (50 m+). ${x.ms} ms in the background.${this.exposureFor !== this.host.doc() ? ' The map has changed since: check again.' : ''}`;
    box.append(p);
    const ol = document.createElement('ol');
    ol.className = 'ed-mt-spawns';
    for (const s of [...x.spawns].sort((a, b) => b.share - a.share).slice(0, 8)) {
      const li = document.createElement('li');
      li.className = s.share >= EXPOSED_SHARE ? 'exposed' : '';
      li.dataset.spawn = s.id;
      li.textContent = `${s.id}${s.team ? ` (${s.team})` : ''}: ${Math.round(s.share * 100)}% of the map, ${s.seenFrom ? `${Math.round(s.nearest)}-${Math.round(s.farthest)} m` : 'unseen'}`;
      ol.append(li);
    }
    box.append(ol);
  }

  /** Exposure warnings for the validator's list, while the map is the one checked. */
  issues(): ValidationIssue[] {
    if (!this.exposure || this.exposureFor !== this.host.doc()) return [];
    return exposureIssues(this.exposure.spawns);
  }

  clear(): void {
    this.result = null;
    this.exposure = null;
    this.exposureFor = null;
    this.overlay.clear();
    this.$('ed-mt-results').hidden = true;
    this.$('ed-mt-exp').replaceChildren();
    this.host.issuesChanged();
  }
}
