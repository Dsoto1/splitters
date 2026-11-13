// Everything MapMaker's test worker runs (mapTestWorker.ts loads it with a dynamic import, for the reason
// game/simWorkerCore.ts gives: Safari gives a chunk imported from a module worker's entry file a second Rapier).
import { coplanarIssues, coplanarSpots, initPhysics, validateMap, type CoplanarSpot, type MapDocument, type ValidationIssue } from '@tiletrigger/shared';
import type { BotTestOptions, BotTestResult, ExposureResult, validateMapNavigation } from '@tiletrigger/shared/match';

/** The navigation check's answer (MapChecks: the issues, and the bots' own spots when asked for). */
export type NavCheck = ReturnType<typeof validateMapNavigation>;

/** The page to the worker: one job a worker (the page starts a new worker for each, and Cancel ends it). */
export type ToMapTest =
  | { k: 'bots'; map: MapDocument; opts: BotTestOptions }
  | { k: 'exposure'; map: MapDocument }
  /** The map's navigation check after an edit (MapChecks.validate): this worker stays, one check after another. */
  | { k: 'nav'; map: MapDocument; computed: boolean; token: number }
  /**
   * The map's own checks and its coplanar overlaps after an edit (MapChecks.validate; a second worker that stays, so
   * they never wait behind a navmesh): `doc` the document, `view` it with its set pieces expanded, `partOf` each
   * part's placement.
   */
  | { k: 'check'; doc: MapDocument; view: MapDocument; partOf: ReadonlyMap<string, string>; token: number };

/** The worker to the page. */
export type FromMapTest =
  | { k: 'ready'; setupMs: number }
  | { k: 'progress'; share: number; seconds: number }
  | { k: 'bots'; result: BotTestResult }
  | { k: 'exposure'; result: ExposureResult }
  | { k: 'nav'; token: number; result: NavCheck }
  /** The jump pads flown, after `nav` (the check is over with this, or with `navFailed`). */
  | { k: 'pads'; token: number; issues: ValidationIssue[] }
  | { k: 'navFailed'; token: number; error: string }
  | { k: 'check'; token: number; issues: ValidationIssue[]; spots: CoplanarSpot[]; zIssues: ValidationIssue[] }
  | { k: 'checkFailed'; token: number; error: string }
  | { k: 'failed'; error: string };

/** How long a slice of the match runs before the page hears how far it got (ms of the worker's time). */
const REPORT_MS = 150;

export async function runMapTest(m: ToMapTest, post: (m: FromMapTest) => void): Promise<void> {
  if (m.k === 'check') {
    // Nothing here needs the match (physics, navigation): the checks MapMaker ran on the page after every edit.
    try {
      const issues = validateMap(m.doc);
      let spots: CoplanarSpot[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        try {
          spots = coplanarSpots(m.view, undefined, m.partOf);
        } catch {
          spots = [];
        }
      }
      post({ k: 'check', token: m.token, issues, spots, zIssues: coplanarIssues(m.view, spots) });
    } catch (e) {
      post({ k: 'checkFailed', token: m.token, error: (e as Error).message });
    }
    return;
  }
  const t0 = performance.now();
  const mod = await import('@tiletrigger/shared/match');
  await Promise.all([initPhysics(), mod.initNavigation()]);
  if (m.k === 'nav') {
    // The navmesh as the match builds it and the navigation audit: seconds on a big map, so here, not on the page
    // (on the page it froze MapMaker after every edit: the owner's recording of 2026-11-12, 12.7 s of 26).
    try {
      post({ k: 'nav', token: m.token, result: mod.validateMapNavigation(m.map, false, { computed: m.computed }) });
    } catch (e) {
      post({ k: 'navFailed', token: m.token, error: (e as Error).message });
      return;
    }
    // Then every jump pad flown by a player's body (shared sim/padFlight.ts: the `pad.flight` warning), in a match
    // of the map: a second answer, so the navigation issues don't wait for it. It ends the check.
    let issues: ValidationIssue[] = [];
    try {
      issues = mod.padFlightIssues(mod.flyPads(m.map));
    } catch {
      // A map no match can be made of: the navigation check has said what it could.
    }
    post({ k: 'pads', token: m.token, issues });
    return;
  }
  if (m.k === 'exposure') {
    post({ k: 'exposure', result: mod.mapExposure(m.map) });
    return;
  }
  const run = new mod.BotTestRun(m.map, m.opts);
  post({ k: 'ready', setupMs: Math.round(performance.now() - t0) });
  try {
    let last = performance.now();
    while (!run.done) {
      // A quarter of a match second at a time.
      run.advance(15);
      const now = performance.now();
      if (now - last >= REPORT_MS || run.done) {
        last = now;
        post({ k: 'progress', share: run.progress, seconds: Math.round(run.progress * m.opts.seconds) });
      }
    }
    post({ k: 'bots', result: run.result() });
  } finally {
    run.destroy();
  }
}
