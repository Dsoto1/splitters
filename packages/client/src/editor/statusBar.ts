import { entityLevelOf, levelName, type MapDocument, type Selection } from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';
import { memoryLine, memorySample } from '../memoryReadout.ts';

/** MapMaker's memory readout in the status bar (fix 3a): behind a debug flag, `?memory=1` or `localStorage['tiletrigger.memoryReadout'] = '1'`. */
function memoryFlag(): boolean {
  try {
    return new URLSearchParams(location.search).get('memory') === '1' || localStorage.getItem('tiletrigger.memoryReadout') === '1';
  } catch {
    return false;
  }
}

/** How many selected things are on a level other than `level` (tiles and set pieces by their level, things by height). */
export function otherLevelCount(doc: MapDocument, sel: Selection, level: number): number {
  if (!sel.tiles.length && !sel.entities.length && !sel.setPieces?.length) return 0;
  const lh = doc.classicStructure.levelHeight;
  let n = 0;
  if (sel.tiles.length) {
    const ids = new Set(sel.tiles);
    for (const t of doc.classicStructure.tiles) if (ids.has(t.id) && t.z !== level) n++;
  }
  if (sel.entities.length) {
    const ids = new Set(sel.entities);
    for (const e of doc.entities) if (ids.has(e.id) && entityLevelOf(e, lh) !== level) n++;
  }
  if (sel.setPieces?.length) {
    const ids = new Set(sel.setPieces);
    for (const p of doc.setPieces ?? []) if (ids.has(p.id) && p.z !== level) n++;
  }
  return n;
}

/** The status bar's selection words: "3 selected", "3 selected · 2 on other levels", or nothing. */
export function selectionWords(total: number, other: number): string {
  if (!total) return '';
  if (!other) return `${total} selected`;
  const where = total === 1 ? 'on another level' : other === total ? 'all on other levels' : other === 1 ? '1 on another level' : `${other} on other levels`;
  return `${total} selected · ${where}`;
}

/** The status bar's counts, short (the long list is its tooltip). */
export function countWords(doc: MapDocument, boxes: number): { short: string; long: string } {
  const tiles = doc.classicStructure.tiles.length;
  let spawns = 0;
  let pickups = 0;
  let npcs = 0;
  for (const e of doc.entities) {
    if (e.kind === 'spawn') spawns++;
    else if (e.kind === 'pickup') pickups++;
    else if (e.kind === 'encounter') npcs++;
  }
  const scenario = doc.entities.length - spawns - pickups - npcs;
  const rules = doc.logic.rules.length;
  const pieces = doc.setPieces?.length ?? 0;
  const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
  return {
    short: `${plural(tiles, 'tile')}${pieces ? ` · ${plural(pieces, 'set piece')}` : ''} · ${plural(doc.entities.length, 'thing')}`,
    long: `${plural(tiles, 'tile')}${pieces ? ` · ${plural(pieces, 'set piece')}` : ''} · ${plural(spawns, 'spawn')} · ${plural(pickups, 'pickup')} · ${plural(scenario, 'scenario object')} · ${plural(npcs, 'NPC squad')} · ${plural(rules, 'rule')} · ${plural(boxes, 'collision box', 'collision boxes')}`,
  };
}

/**
 * The short status bar along the bottom (MapMaker UI spec Phase 1): the level, what's selected (and how much of it
 * is on other levels: the owner's answer 6), the map's counts in brief, the budget pill, the problems pill (it opens
 * the problems list) and what's under the pointer. The every-key line it had is in the `?` overlay. Drawn on an edit,
 * a selection or a level change, never per frame.
 */
export class StatusBar {
  private countedDoc: MapDocument | null = null;
  private shownSel = '';
  private shownCounts = '';

  private readonly memory = memoryFlag();
  private memoryAt = 0;

  constructor(readonly app: EditorApp) {}

  /** Each frame: with the debug flag on, the memory readout once a second (script memory short, the rest its tooltip). */
  memoryTick(): void {
    if (!this.memory) return;
    const now = performance.now();
    if (now - this.memoryAt < 1000) return;
    this.memoryAt = now;
    let el = document.getElementById('ed-memory');
    if (!el) {
      el = document.createElement('span');
      el.id = 'ed-memory';
      $('ed-status').before(el);
    }
    const s = memorySample();
    el.textContent = s.heapMB !== null ? `${Math.round(s.heapMB)} MB script · ${s.gpuTextures} textures` : `${s.gpuTextures} textures · ${s.meshes} meshes`;
    el.title = memoryLine(s);
  }

  mount(): void {
    $('ed-status').addEventListener('click', () => this.app.dock.showProblems());
  }

  /** The level and the selection (on a selection or level change, and after an edit). */
  update(): void {
    const app = this.app;
    $('ed-level-name-bottom').textContent = `${levelName(app.level)} · ${app.level * app.doc.classicStructure.levelHeight} m`;
    const total = app.selCount();
    const words = selectionWords(total, total ? otherLevelCount(app.doc, app.selection, app.level) : 0);
    if (words !== this.shownSel) {
      this.shownSel = words;
      const el = $('ed-sel');
      el.textContent = words;
      el.hidden = !words;
    }
  }

  /** The counts, once per version of the document (refresh runs this on every edit and level change). */
  updateCounts(): void {
    const doc = this.app.doc;
    if (this.countedDoc === doc) return;
    this.countedDoc = doc;
    const w = countWords(doc, this.app.mapBoxes().length);
    if (w.long === this.shownCounts) return;
    this.shownCounts = w.long;
    const el = $('ed-counts');
    el.textContent = w.short;
    el.title = w.long;
  }
}
