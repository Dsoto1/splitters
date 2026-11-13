import {
  coplanarIssues,
  coplanarSpots,
  initPhysics,
  setPiecePortStates,
  validateMap,
  type CoplanarSpot,
  type MapDocument,
  type ValidationIssue
} from '@tiletrigger/shared';
import type { FromMapTest, ToMapTest } from './mapTestWorkerCore.ts';
import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';

/** Navigation is checked this long after the last edit (ms): not between the clicks of someone placing or deleting in a row. */
const NAV_DELAY_MS = 900;
/** The map's own checks and the overlaps go to their worker this long after the last edit (ms): one check for a run of quick edits. */
const CHECK_DELAY_MS = 120;

/** The map's checks: validation, navigation and the bots' own spots worked out a moment after each edit, coplanar overlaps, and the issues list and status pill (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class MapChecks {
  constructor(readonly app: EditorApp) {}

  navIssues: ValidationIssue[] = [];
  navTimer?: number;
  /** Coplanar overlaps (geometry.coplanar), worked out a moment after each edit, with the map's own checks. */
  zIssues: ValidationIssue[] = [];
  zSpots: CoplanarSpot[] = [];
  overlapsOn = false;
  navToken = 0;

  /** Select and frame the object a validation issue points at (or open the logic item). */
  focusIssue(issue: ValidationIssue): void {
    if (!issue.targetId) return;
    const tile = this.app.doc.classicStructure.tiles.find((t) => t.id === issue.targetId);
    const entity = this.app.doc.entities.find((e) => e.id === issue.targetId);
    // A set piece, or one of its parts (the overlaps check names parts): the placement.
    const piece = this.app.placementOf(this.app.expansion.partOf.get(issue.targetId) ?? issue.targetId);
    const { logic } = this.app.doc;
    if (!tile && !entity && !piece && [...logic.rules, ...logic.objectives, ...logic.variables, ...logic.timers].some((x) => x.id === issue.targetId)) {
      this.app.logic.open(issue.targetId);
      return;
    }
    if (piece) {
      this.app.setLevel(piece.z);
      this.app.setSelection({ tiles: [], entities: [], setPieces: [piece.id] });
    } else if (tile) {
      this.app.setLevel(tile.z);
      this.app.setSelection({ tiles: [tile.id], entities: [] });
    } else if (entity) {
      this.app.setLevel(Math.floor((entity.position[1] + 0.01) / this.app.doc.classicStructure.levelHeight));
      this.app.setSelection({ tiles: [], entities: [entity.id] });
    } else return;
    this.app.setTool({ kind: 'select' });
    this.app.focusSelection();
  }

  // ---------------------------------------------------------------- validation

  /**
   * After every edit. The map's own checks (validateMap) and the overlaps check are worked out a moment later in a
   * worker of their own, and the issues list follows when they come back: on the page they took 0.15 to 0.25 s of
   * every edit on St. John's (2,500 blocks), before the next click was taken. Whoever needs the issues at once
   * (Test, the editor's `issues`) gets them worked out on the spot (`settle`).
   */
  validate(): void {
    this.stale = true;
    this.editedAt = performance.now();
    clearTimeout(this.navTimer);
    clearTimeout(this.checkTimer);
    const token = ++this.navToken;
    this.checkTimer = window.setTimeout(() => this.sendCheck(token), CHECK_DELAY_MS);
  }

  /** The issues list is behind the document (an edit since it was worked out). */
  private stale = false;
  private editedAt = 0;
  private checkTimer?: number;
  private checkWorker: Worker | null = null;
  private checkBusy = false;
  private checkNext = 0;
  private noCheckWorker = false;

  /** The map's own issues, now: worked out on the page if an edit has not been checked yet. */
  settle(): void {
    if (!this.stale) return;
    this.stale = false;
    this.app.issues = [...validateMap(this.app.doc), ...this.portIssues()];
  }

  private sendCheck(token: number): void {
    if (token !== this.navToken) return;
    if (this.noCheckWorker) return this.checkHere(token);
    if (this.checkBusy) {
      this.checkNext = token;
      return;
    }
    let worker = this.checkWorker;
    if (!worker) {
      try {
        worker = this.checkWorker = new Worker(new URL('./mapTestWorker.ts', import.meta.url), { type: 'module', name: 'mapissues' });
      } catch {
        this.noCheckWorker = true;
        return this.checkHere(token);
      }
      worker.onmessage = (e: MessageEvent<FromMapTest>) => {
        const m = e.data;
        if (m.k !== 'check' && m.k !== 'checkFailed' && m.k !== 'failed') return;
        this.checkBusy = false;
        const next = this.checkNext;
        this.checkNext = 0;
        if (m.k === 'check') {
          if (m.token === this.navToken) this.checked(m.token, m.issues, m.spots, m.zIssues);
        } else if (m.k === 'failed' || m.token === this.navToken) return this.checkHere(this.navToken);
        if (next) this.sendCheck(next);
      };
      worker.onerror = () => {
        // The worker itself failed to load: on the page from here on.
        this.checkWorker?.terminate();
        this.checkWorker = null;
        this.checkBusy = false;
        this.checkNext = 0;
        this.noCheckWorker = true;
        this.checkHere(this.navToken);
      };
    }
    this.checkBusy = true;
    const { map: view, partOf } = this.app.expansion;
    // (One message: what the document and its expansion share is copied once.)
    const job: ToMapTest = { k: 'check', doc: this.app.doc, view, partOf, token };
    worker.postMessage(job);
  }

  /** The checks on the page (no worker here): as before the worker. */
  private checkHere(token: number): void {
    if (token !== this.navToken) return;
    const { map: view, partOf } = this.app.expansion;
    let spots: CoplanarSpot[] = [];
    const issues = validateMap(this.app.doc);
    if (!issues.some((i) => i.severity === 'error')) {
      try {
        spots = coplanarSpots(view, undefined, partOf);
      } catch {
        spots = [];
      }
    }
    this.checked(token, issues, spots, coplanarIssues(view, spots));
  }

  /** The checks of the document as it is now came back: the issues list, the overlaps, and navigation next. */
  private checked(token: number, issues: ValidationIssue[], spots: CoplanarSpot[], zIssues: ValidationIssue[]): void {
    this.stale = false;
    this.app.issues = [...issues, ...this.portIssues()];
    if (this.app.issues.some((i) => i.severity === 'error')) {
      this.navIssues = [];
      this.renderIssues();
      return;
    }
    // A set piece's parts against each other are the piece's own business (the author can't move a part).
    this.zSpots = spots;
    this.zIssues = zIssues;
    if (this.overlapsOn) this.app.view.setOverlaps(this.zSpots);
    this.renderIssues();
    // Navigation as played: set pieces expanded into their parts, on the ground as shown (paths laid in, kept under
    // the floors).
    const ground = this.app.view.ground;
    const doc = ground && ground !== this.app.viewDoc.terrain ? { ...this.app.viewDoc, terrain: ground } : this.app.viewDoc;
    // Navigation a moment after the last edit, in the test worker (mapTestWorker.ts): the page keeps drawing and taking
    // edits while the navmesh is built. One check at a time; an edit made meanwhile is checked when it comes back.
    clearTimeout(this.navTimer);
    this.navTimer = window.setTimeout(() => this.checkNavigation(doc, token), Math.max(0, NAV_DELAY_MS - (performance.now() - this.editedAt)));
  }

  /** The navigation worker (kept between checks: its physics and navigation are set up once), and what it is doing. */
  private navWorker: Worker | null = null;
  private navBusy = false;
  private navNext: { doc: MapDocument; token: number } | null = null;

  private checkNavigation(doc: MapDocument, token: number): void {
    if (token !== this.navToken) return;
    if (this.navBusy) {
      this.navNext = { doc, token };
      return;
    }
    let worker = this.navWorker;
    if (!worker) {
      try {
        worker = this.navWorker = new Worker(new URL('./mapTestWorker.ts', import.meta.url), { type: 'module', name: 'mapchecks' });
      } catch {
        // No workers here: on the page, as before.
        void this.checkNavigationHere(doc, token);
        return;
      }
      worker.onmessage = (e: MessageEvent<FromMapTest>) => {
        const m = e.data;
        if (m.k !== 'nav' && m.k !== 'navFailed' && m.k !== 'failed') return;
        this.navBusy = false;
        const latest = m.k !== 'failed' && m.token === this.navToken;
        if (m.k === 'nav' && latest) {
          this.navIssues = m.result.issues;
          // "What bots know" (bot hints): the bots' own spots, worked out on the same navmesh.
          this.app.hints.setComputed(m.result.computed ?? null);
          this.renderIssues();
        } else if (m.k !== 'nav' && (m.k === 'failed' || latest)) {
          this.navIssues = [{ severity: 'warning', code: 'nav.failed', message: `navigation could not be generated: ${m.error}` }];
          this.renderIssues();
        }
        const next = this.navNext;
        this.navNext = null;
        if (next) this.checkNavigation(next.doc, next.token);
      };
      worker.onerror = () => {
        // The worker itself failed to load: on the page from here on.
        this.navWorker?.terminate();
        this.navWorker = null;
        this.navBusy = false;
        this.navNext = null;
        this.noNavWorker = true;
        void this.checkNavigationHere(this.app.viewDoc, this.navToken);
      };
    }
    if (this.noNavWorker) return void this.checkNavigationHere(doc, token);
    this.navBusy = true;
    const job: ToMapTest = { k: 'nav', map: doc, computed: this.app.hints.computedOn, token };
    worker.postMessage(job);
  }

  private noNavWorker = false;

  /** The check on the page (no worker): the navmesh as the match builds it, and the navigation audit. */
  private async checkNavigationHere(doc: MapDocument, token: number): Promise<void> {
    const { initNavigation, validateMapNavigation } = await import('@tiletrigger/shared/match');
    await initNavigation();
    if (token !== this.navToken) return;
    try {
      await initPhysics();
      const nav = validateMapNavigation(doc, false, { computed: this.app.hints.computedOn });
      this.navIssues = nav.issues;
      this.app.hints.setComputed(nav.computed ?? null);
    } catch (e) {
      this.navIssues = [{ severity: 'warning', code: 'nav.failed', message: `navigation could not be generated: ${(e as Error).message}` }];
    }
    this.renderIssues();
  }

  /** A set piece's port with a wall in it (MapMaker's warning; the outline shows it red): one per port. */
  portIssues(): ValidationIssue[] {
    const out: ValidationIssue[] = [];
    for (const p of this.app.doc.setPieces ?? []) {
      const def = this.app.pieceDef(p.piece);
      if (!def) continue;
      for (const s of setPiecePortStates(p, def, this.app.mapBoxes())) {
        if (!s.blockedBy) continue;
        out.push({ severity: 'warning', code: 'setpiece.port', message: `${def.displayName}: ${this.app.pieces.portName(s)} faces a wall (${this.app.pieces.blockerName(s.blockedBy)}): open it, or move the piece`, targetId: p.id });
      }
    }
    return out;
  }

  /** Every issue: the map's own, navigation, overlaps and the test runs'. `settle` false: as last worked out (the list drawn while a check is on its way). */
  allIssues(settle = true): ValidationIssue[] {
    const order = { error: 0, warning: 1, suggestion: 2 } as const;
    if (settle) this.settle();
    return [...this.app.issuesNow, ...this.navIssues, ...this.zIssues, ...this.app.mapTest.issues()].sort((a, b) => order[a.severity] - order[b.severity]);
  }

  renderIssues(): void {
    const issues = this.allIssues(false);
    const list = $('ed-issues');
    list.replaceChildren();
    if (!issues.length) {
      const li = document.createElement('li');
      li.className = 'none';
      li.textContent = 'No problems found. Ready to test.';
      list.append(li);
    }
    for (const issue of issues) {
      const li = document.createElement('li');
      li.className = issue.severity;
      li.textContent = issue.message;
      li.title = issue.code;
      li.addEventListener('click', () => this.focusIssue(issue));
      list.append(li);
    }
    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    const pill = $('ed-status');
    pill.className = `pill ${errors ? 'err' : warnings ? 'warn' : 'ok'}`;
    pill.textContent = errors ? `${errors} error${errors > 1 ? 's' : ''}` : warnings ? `${warnings} warning${warnings > 1 ? 's' : ''}` : '✓ Ready';
  }
}
