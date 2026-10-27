// Which browser flows and unit-test packages a change needs: the one place that maps
// paths to e2e flows (CI's plan job, `pnpm e2e:changed`, `pnpm test:changed`).
// Safe default: a path no rule names, or one in the shared simulation / infrastructure,
// runs everything. Docs alone run nothing. Tested in tools/ci/test/select.test.mjs.

/** The map tour is long: CI runs it in this many parts ('maps', 'maps2', … 'maps7'). */
export const MAP_PARTS = 7;
export const MAP_FLOWS = Array.from({ length: MAP_PARTS }, (_, i) => (i ? `maps${i + 1}` : 'maps'));
/** The part that also spot-checks the imported maps (maps/imported/). */
export const IMPORTED_PART = MAP_PARTS - 1;

/** Every flow in e2e/run.mjs (run.mjs refuses to start if they differ). */
export const FLOWS = [
  'editor', 'editorux', 'offline', 'vault', 'outpost', 'sandgate', 'citadel', 'canyon', 'scenery', 'setpieces', 'physicsfx',
  'teams', 'ctf', 'forts', 'arsenal', 'vehicles', 'race', 'zombies', 'classes', ...MAP_FLOWS,
  'designer', 'characters', 'online', 'hostgame', 'hostcontrols', 'lobby', 'webgpu', 'visual',
];

/** Maps that have a flow of their own, so the tour leaves them out. */
export const COVERED_MAPS = new Set(['phase0_arena', 'm3_vault', 'm4_outpost', 'sandgate', 'citadel', 'canyon']);

/** The tour's maps (sorted ids, covered ones left out) split into MAP_PARTS parts: part `i` gets every MAP_PARTS-th. */
export function mapPartOf(id, ids) {
  const tour = [...ids].filter((m) => !COVERED_MAPS.has(m)).sort();
  const i = tour.indexOf(id);
  return i < 0 ? -1 : i % MAP_PARTS;
}

/** Maps a flow opens by name (besides the tour), so a change to one runs those flows. */
const MAP_USERS = {
  m3_vault: ['vault'],
  m4_outpost: ['outpost'],
  sandgate: ['sandgate', 'lobby', 'zombies'],
  citadel: ['citadel'],
  canyon: ['canyon', 'scenery', 'physicsfx', 'arsenal', 'vehicles'],
  skyward: ['scenery'],
  sky_islands: ['setpieces'],
  training_range: ['physicsfx'],
  bunker_cross: ['ctf'],
  fort_meadow: ['forts'],
  twin_spires: ['classes'],
  grid_rings: ['classes'],
  sandsweep: ['race'],
  atomic_court: ['hostcontrols'],
};

const FULL = Symbol('full');
const NONE = Symbol('none');
const UNIT_ALL = 'all';

/**
 * Rules, first match wins: [pattern, flows (or FULL / NONE), unit packages ('all' or a list)].
 * Anything no rule matches is FULL.
 */
const RULES = [
  // Docs and notes: nothing to run.
  [/^docs\//, NONE, []],
  [/^(?!CLAUDE\.md$)[^/]*\.md$/, NONE, []],
  [/^CLAUDE\.md$/, NONE, []],
  [/^packages\/[^/]+\/[^/]*\.md$/, NONE, []],
  [/^LICENSE|^\.gitignore$|^\.editorconfig$/, NONE, []],

  // Unit tests alone: their package's tests, no browser.
  [/^packages\/client\/test\//, NONE, ['client']],
  [/^packages\/server\/test\//, NONE, ['server']],
  [/^packages\/shared\/test\//, NONE, ['shared']],
  // CI's own tests and the perf tool (the perf job reads PERF changes itself).
  [/^tools\/ci\/test\//, NONE, ['tools']],
  [/^tools\/perf\//, NONE, []],
  // Screenshot baselines.
  [/^e2e\/baselines\//, ['visual'], []],
  [/^e2e\/timings\.json$/, NONE, []],

  // Shared simulation, infrastructure, the runner and CI: everything.
  [/^packages\/shared\//, FULL, UNIT_ALL],
  [/^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig\.base\.json|vitest\.config\.ts)$/, FULL, UNIT_ALL],
  [/^\.github\//, FULL, UNIT_ALL],
  [/^e2e\//, FULL, ['tools']],
  [/^tools\/(ci|content)\//, FULL, UNIT_ALL],
  [/^(content|assets-src)\//, FULL, UNIT_ALL],
  [/^packages\/client\/(public|index\.html|vite\.config\.ts|package\.json|tsconfig\.json)/, FULL, ['client']],
  [/^packages\/client\/src\/(main|engine|assetUrl|renamedStorage|style)\./, FULL, ['client']],
  [/^packages\/client\/src\/game\/(session|view|hud|localTransport|matchHost|simWorker|input|prediction|interpolation|snapshotMerge|characterAnimator|atmosphere|framePacer|cameraPose|transport)\.ts$/, FULL, ['client']],
  [/^packages\/client\/src\/(content|materials)\//, FULL, ['client']],

  // The rest of the client, by area.
  [/^packages\/client\/src\/editor\//, ['editor', 'editorux', 'scenery', 'canyon', 'race', 'visual'], ['client']],
  [/^packages\/client\/src\/designer\//, ['designer', 'characters'], ['client']],
  [/^packages\/client\/src\/tools\/characterViewer/, ['characters'], ['client']],
  [/^packages\/client\/src\/tools\//, NONE, ['client']],
  [/^packages\/client\/src\/frontend\//, ['offline', 'teams', 'lobby', 'hostgame', 'hostcontrols', 'designer', 'characters', 'editor', 'webgpu', 'visual'], ['client']],
  [/^packages\/client\/src\/audio\//, ['offline'], ['client']],
  [/^packages\/client\/src\/game\/(hostPanel|pauseMenu)\.ts$/, ['offline', 'hostgame', 'hostcontrols', 'lobby'], ['client']],
  [/^packages\/client\/src\/game\/(peerLink|peerZip|relay|hub|lan|netTransport|joinCode)\.ts$/, ['online', 'hostgame', 'hostcontrols', 'lobby'], ['client']],
  [/^packages\/client\/src\/game\/(mountVisuals|mountState|vehicleCamera)\.ts$/, ['vehicles', 'race'], ['client']],
  [/^packages\/client\/src\/(game\/raceHud\.ts|roadMeshes\.ts)$/, ['race'], ['client']],
  [/^packages\/client\/src\/game\/fortsClient\.ts$/, ['forts'], ['client']],
  [/^packages\/client\/src\/game\/(flagVisuals|modeHud)\.ts$/, ['ctf', 'forts', 'zombies', 'teams', 'race', 'classes'], ['client']],
  [/^packages\/client\/src\/game\/scoreBoard\.ts$/, ['teams', 'ctf', 'zombies', 'classes', 'hostcontrols'], ['client']],
  [/^packages\/client\/src\/game\/(glassVisuals|waterVisuals|ragdoll|bloodVisuals|impactVisuals|reflections|skyEffects)\.ts$/, ['physicsfx', 'setpieces'], ['client']],
  [/^packages\/client\/src\/game\/(arsenalVisuals|muzzleVisuals|crosshair|throwArc|coverState)\.ts$/, ['arsenal', 'physicsfx'], ['client']],
  [/^packages\/client\/src\/game\/(scenarioVisuals|scenarioState|pickupVisuals|propVisuals|canopyVisuals|cityVisuals|creatureAnimator|gait|torsoSurface|minimap|perfProbe|sessionAudio)\.ts$/, [...MAP_FLOWS, 'vault', 'outpost', 'sandgate', 'citadel', 'canyon', 'scenery', 'setpieces', 'zombies'], ['client']],
  [/^packages\/client\/src\/(backdrop|borderVisuals|foliage|mapMeshes|importedMaps|playlists)\.ts$/, [...MAP_FLOWS, 'vault', 'outpost', 'sandgate', 'citadel', 'canyon', 'scenery', 'setpieces', 'visual'], ['client']],

  // The server (dedicated server, hub, lobby).
  [/^packages\/server\/src\/tools\//, NONE, ['server']],
  [/^packages\/server\//, ['online', 'hostgame', 'hostcontrols', 'lobby'], ['server']],
];

/**
 * What a set of changed paths (repo-relative) needs.
 * Returns { full, flows (sorted, every flow when full), unit ('all' or a sorted list of packages), docsOnly, perf, reasons }.
 * `mapIds`: the map files there are (ids, without .json), to find a changed map's tour part.
 */
export function selectForPaths(paths, mapIds = []) {
  const flows = new Set();
  const unit = new Set();
  let full = false;
  let unitAll = false;
  let perf = false;
  const reasons = [];
  for (const raw of paths) {
    const p = raw.replace(/^\.\//, '');
    if (!p) continue;
    // Render-side changes get the draw-call budget check.
    if (/^packages\/client\/src\/(game\/(view|propVisuals|scenarioVisuals|cityVisuals|canopyVisuals)\.ts|mapMeshes\.ts|foliage\.ts|backdrop\.ts|content\/|materials\/)|^packages\/shared\/src\/(content|map)\/|^tools\/perf\/|^content\//.test(p)) perf = true;
    const map = /^maps\/([^/]+)\.json$/.exec(p);
    if (map) {
      const id = map[1];
      if (id === 'phase0_arena') {
        full = true;
        reasons.push(`${p}: the default map of most flows`);
      } else {
        const part = mapPartOf(id, mapIds.length ? mapIds : [id]);
        if (part >= 0) flows.add(MAP_FLOWS[part]);
        for (const f of MAP_USERS[id] ?? []) flows.add(f);
      }
      unitAll = true;
      continue;
    }
    if (/^maps\/imported\//.test(p)) {
      flows.add(MAP_FLOWS[IMPORTED_PART]);
      unit.add('server');
      continue;
    }
    if (/^maps\//.test(p)) {
      full = true;
      unitAll = true;
      reasons.push(`${p}: not a map file the tour knows`);
      continue;
    }
    const rule = RULES.find(([re]) => re.test(p));
    if (!rule) {
      full = true;
      unitAll = true;
      reasons.push(`${p}: no rule (safe default: everything)`);
      continue;
    }
    const [, what, units] = rule;
    if (what === FULL) {
      full = true;
      reasons.push(`${p}: shared code or infrastructure`);
    } else if (what !== NONE) for (const f of what) flows.add(f);
    if (units === UNIT_ALL) unitAll = true;
    else for (const u of units) unit.add(u);
  }
  const docsOnly = !full && flows.size === 0 && unit.size === 0 && !unitAll && !perf;
  return {
    full,
    flows: full ? [...FLOWS] : FLOWS.filter((f) => flows.has(f)),
    unit: unitAll || full ? UNIT_ALL : [...unit].sort(),
    docsOnly,
    perf: perf || full,
    reasons,
  };
}

/** vitest path filters for a selection's unit packages ('all' → none: every test). */
export function unitTestPaths(unit) {
  if (unit === UNIT_ALL) return [];
  return unit.map((u) => (u === 'tools' ? 'tools/ci/test' : `packages/${u}/test`));
}
