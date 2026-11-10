import {
  coplanarIssues,
  coplanarSpots,
  initPhysics,
  setPiecePortStates,
  validateMap,
  type CoplanarSpot,
  type ValidationIssue
} from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';

/** The map's checks: validation, navigation and the bots' own spots worked out a moment after each edit, coplanar overlaps, and the issues list and status pill (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class MapChecks {
  constructor(readonly app: EditorApp) {}

  navIssues: ValidationIssue[] = [];
  navTimer?: number;
  /** Coplanar overlaps (geometry.coplanar), worked out a moment after each edit like navigation. */
  zIssues: ValidationIssue[] = [];
  zSpots: CoplanarSpot[] = [];
  zTimer?: number;
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

  validate(): void {
    this.app.issues = [...validateMap(this.app.doc), ...this.portIssues()];
    this.renderIssues();
    clearTimeout(this.navTimer);
    const token = ++this.navToken;
    // Navigation and overlaps as played: set pieces expanded into their parts, on the ground as shown (paths laid in,
    // kept under the floors).
    const ground = this.app.view.ground;
    const doc = ground && ground !== this.app.viewDoc.terrain ? { ...this.app.viewDoc, terrain: ground } : this.app.viewDoc;
    if (this.app.issues.some((i) => i.severity === 'error')) {
      this.navIssues = [];
      this.renderIssues();
      return;
    }
    this.scheduleOverlaps();
    this.navTimer = window.setTimeout(async () => {
      const { initNavigation, validateMapNavigation } = await import('@tiletrigger/shared/match');
      await initNavigation();
      if (token !== this.navToken) return;
      try {
        await initPhysics();
        // The navmesh as the match builds it, and the navigation audit (traps, spawn points, objectives and pickups
        // cut off): warnings for creators (errors only on the official maps' own checks).
        const nav = validateMapNavigation(doc, false, { computed: this.app.hints.computedOn });
        this.navIssues = nav.issues;
        // "What bots know" (bot hints): the bots' own spots, worked out on the same navmesh.
        this.app.hints.setComputed(nav.computed ?? null);
      } catch (e) {
        this.navIssues = [{ severity: 'warning', code: 'nav.failed', message: `navigation could not be generated: ${(e as Error).message}` }];
      }
      this.renderIssues();
    }, 400);
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

  /** Coplanar overlaps of the map as it is now (its warning and the Overlaps highlight), a moment after the last edit. */
  scheduleOverlaps(): void {
    clearTimeout(this.zTimer);
    const { map: doc, partOf } = this.app.expansion;
    this.zTimer = window.setTimeout(() => {
      if (doc !== this.app.viewDoc) return;
      try {
        // A set piece's parts against each other are the piece's own business (the author can't move a part).
        this.zSpots = coplanarSpots(doc, undefined, partOf);
      } catch {
        this.zSpots = [];
      }
      this.zIssues = coplanarIssues(doc, this.zSpots);
      if (this.overlapsOn) this.app.view.setOverlaps(this.zSpots);
      this.renderIssues();
    }, 450);
  }

  allIssues(): ValidationIssue[] {
    const order = { error: 0, warning: 1, suggestion: 2 } as const;
    return [...this.app.issues, ...this.navIssues, ...this.zIssues, ...this.app.mapTest.issues()].sort((a, b) => order[a.severity] - order[b.severity]);
  }

  renderIssues(): void {
    const issues = this.allIssues();
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
