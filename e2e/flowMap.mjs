// Which browser flows and unit-test packages a change needs: the one place that maps
// paths to e2e flows (CI's plan job, `pnpm e2e:changed`, `pnpm test:changed`).
// Safe default: a path no rule names, or one in the shared simulation / infrastructure,
// runs everything. Docs alone run nothing. Tested in tools/ci/test/select.test.mjs.
import { readFileSync } from 'node:fs';

/**
 * The browser map tour (every map in a match, then opened in MapMaker) is long: it runs in this many parts ('maps',
 * 'maps2', … 'maps14', about 6 maps and 6 minutes each), and only on full runs (nightly, v* tags, Run workflow:
 * select's `tour`). Check branches and main pushes rely on the headless check of every map (packages/shared/test/
 * allMaps*.test.ts) and the coverage map's flow; a change to a few maps tours just those (E2E_MAPS).
 */
export const MAP_PARTS = 14;
export const MAP_FLOWS = Array.from({ length: MAP_PARTS }, (_, i) => (i ? `maps${i + 1}` : 'maps'));
/** The character checks, in three parts (viewer and palms; drawn hands; grips in a match): ~11 min in one. */
export const CHARACTER_FLOWS = ['characters', 'characters2', 'characters3'];
/** A change to at most this many maps tours just those maps (E2E_MAPS) on a check branch; more run their tour parts. */
export const MAX_NAMED_MAPS = 6;
/** The map with one of everything (maps/test_coverage.json; testOnly: no map list or rotation offers it). */
export const COVERAGE_MAP = 'test_coverage';

/** Every flow in e2e/run.mjs (run.mjs refuses to start if they differ). */
export const FLOWS = [
  'editor', 'editorux', 'offline', 'mobile', 'vault', 'outpost', 'sandgate', 'citadel', 'canyon', 'scenery', 'setpieces', 'physicsfx',
  'teams', 'weaponsets', 'ctf', 'forts', 'breakthrough', 'roulette', 'arsenal', 'vehicles', 'race', 'zombies', 'classes', 'coverage', ...MAP_FLOWS,
  'designer', ...CHARACTER_FLOWS, 'online', 'hostgame', 'hostcontrols', 'lobby', 'handoff', 'dedicatedhost', 'hostpage', 'webgpu', 'visual', 'environment', 'flashing',
];

/** Maps that have a flow of their own, so the tour leaves them out. */
export const COVERED_MAPS = new Set(['phase0_arena', 'm3_vault', 'm4_outpost', 'sandgate', 'citadel', 'canyon', COVERAGE_MAP, 'test_breakthrough']);

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
  void_yard: ['hostcontrols'],
  [COVERAGE_MAP]: ['coverage'],
  test_breakthrough: ['breakthrough'],
  env_showcase: ['environment'],
};

/**
 * Docs and notes: nothing reads them to build or test the game. Also what CI ignores when it asks whether a
 * commit's code equals a commit that already went green (tools/ci/greenTree.mjs). Keep this list strict.
 */
export const DOC_PATTERNS = [/^docs\//, /^[^/]*\.md$/, /^packages\/[^/]+\/[^/]*\.md$/, /^LICENSE/];

/**
 * Paths whose change gets the bot scorecard's quick check (`pnpm bot-report --check`, CI's bots job; docs/BOTS.md,
 * "Scorecard"): the bots, navigation, the simulation and its modes, and the scorecard itself (its tool, limits and
 * measures). The full scorecard runs nightly.
 */
export const BOT_PATHS = [/^packages\/shared\/src\/(bots|nav|sim)\//, /^packages\/server\/src\/tools\/(bot-report|botMeasures|navPictures)\.ts$/, /^packages\/server\/src\/tools\/bot-limits\.json$/];

/** The maps the quick check plays (bot-limits.json `check`): a change to one of them gets the check too. */
export const BOT_CHECK_MAPS = new Set(JSON.parse(readFileSync(new URL('../packages/server/src/tools/bot-limits.json', import.meta.url), 'utf8')).check.matches.map(([id]) => id));

/** Whether a repo-relative path is docs only (DOC_PATTERNS). */
export const isDocPath = (p) => DOC_PATTERNS.some((re) => re.test(p.replace(/^\.\//, '')));

const FULL = Symbol('full');
const NONE = Symbol('none');
const UNIT_ALL = 'all';

/**
 * Rules, first match wins: [pattern, flows (or FULL / NONE), unit packages ('all' or a list)].
 * Anything no rule matches is FULL.
 */
const RULES = [
  // Docs and notes: nothing to run.
  ...DOC_PATTERNS.map((re) => [re, NONE, []]),
  [/^\.gitignore$|^\.editorconfig$/, NONE, []],
  // The Lightsail box's scripts: no flow or unit test runs them (the check job lints them; infra/test/ by hand).
  [/^(infra|deploy)\//, NONE, []],

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
  // Content manifests (content/*.json, tools/content builds from them; `pnpm content:check`, which the check job
  // always runs, holds them to the built files). What the runtime reads is the build output (public/models,
  // packages/shared/src/content/*.generated.ts: those run everything), so a manifest alone runs the flows that
  // look at that kind of content, and the unit tests that read it. Any other content/ path: everything.
  [/^content\/(characters\/|characters\.lock\.json$)/, [...CHARACTER_FLOWS, 'designer', 'visual'], ['client', 'content', 'shared']],
  [/^content\/(clip-sets\/|clip-sets\.lock\.json$)/, [...CHARACTER_FLOWS, 'visual'], ['client', 'content', 'shared']],
  [/^content\/gear(\.lock)?\.json$/, [...CHARACTER_FLOWS, 'designer', 'visual'], ['shared']],
  // Props: one file per content pack (content/props/<pack>.json); the palette test reads them too.
  [/^content\/(props\/|props(\.lock)?\.json$)/, ['editor', 'scenery', 'setpieces', 'visual'], ['client', 'shared']],
  // Guns: the arsenal, the grips on them (characters), mounted guns (vehicles).
  [/^content\/guns(\.lock)?\.json$/, ['arsenal', ...CHARACTER_FLOWS, 'vehicles'], ['shared']],
  // Effects: the flows that play them, and the flicker check (Reduce flashing: no new effect may flash).
  [/^content\/vfx(\.lock)?\.json$/, ['physicsfx', 'arsenal', 'flashing'], ['client']],
  [/^content\/skies(\.lock)?\.json$/, [...MAP_FLOWS, 'scenery', 'setpieces', 'canyon', 'visual'], ['shared']],
  [/^content\/city(\.lock)?\.json$/, [...MAP_FLOWS, 'vault', 'outpost', 'sandgate', 'citadel', 'canyon', 'scenery', 'setpieces'], ['client', 'shared']],
  [/^content\/sounds\.json$/, ['offline'], ['client']],
  // The procedural environment's species (tools/content/environment.mjs builds them): the lab, WebGPU, the baseline.
  [/^content\/environment(\/|\.json$|\.lock\.json$)/, ['environment', 'webgpu', 'visual'], ['client', 'content', 'shared']],
  [/^(content|assets-src)\//, FULL, UNIT_ALL],
  [/^packages\/client\/(public|index\.html|vite\.config\.ts|package\.json|tsconfig\.json)/, FULL, ['client']],
  [/^packages\/client\/src\/(main|engine|assetUrl|renamedStorage|style)\./, FULL, ['client']],
  [/^packages\/client\/src\/game\/(session|hud|localTransport|matchHost|simWorker|input|prediction|interpolation|snapshotMerge|characterAnimator|atmosphere|framePacer|cameraPose|transport)\.ts$/, FULL, ['client']],
  [/^packages\/client\/src\/(content|materials)\//, FULL, ['client']],

  // The match renderer: every flow that plays a match (all but the MapMaker UI, the host page and the WebGPU
  // menu check, which never load it: main.ts imports the session on demand).
  [/^packages\/client\/src\/game\/view\.ts$/, FLOWS.filter((f) => !['editorux', 'hostpage', 'webgpu'].includes(f)), ['client']],

  // The rest of the client, by area.
  // Phones and tablets (on-screen controls, touch detection) and the weapon wheel.
  [/^packages\/client\/src\/(touchDevice|game\/(touchControls|weaponWheel))\.ts$/, ['mobile', 'offline'], ['client']],
  [/^packages\/client\/src\/editor\//, ['editor', 'editorux', 'scenery', 'canyon', 'race', 'weaponsets', 'visual'], ['client']],
  [/^packages\/client\/src\/designer\//, ['designer', ...CHARACTER_FLOWS], ['client']],
  [/^packages\/client\/src\/tools\/characterViewer/, [...CHARACTER_FLOWS], ['client']],
  // Your own body and arms in first person, and where hands are drawn on guns (the grip checks).
  [/^packages\/client\/src\/game\/(firstPersonBody|firstPersonArms|handProbe)\.ts$/, [...CHARACTER_FLOWS, 'offline', 'arsenal', 'visual'], ['client']],
  // The procedural environment (renderer behind ?env=1, materials, the lab).
  [/^packages\/client\/src\/(environment\/|tools\/envLab\.ts$)/, ['environment', 'webgpu', 'scenery', 'visual'], ['client']],
  [/^packages\/client\/src\/tools\//, NONE, ['client']],
  [/^packages\/client\/src\/frontend\//, ['offline', 'mobile', 'teams', 'weaponsets', 'breakthrough', 'roulette', 'lobby', 'hostgame', 'hostcontrols', 'dedicatedhost', 'designer', ...CHARACTER_FLOWS, 'editor', 'webgpu', 'visual'], ['client']],
  [/^packages\/client\/src\/hostPage\.ts$/, ['hostpage'], ['client']],
  [/^packages\/client\/src\/audio\//, ['offline'], ['client']],
  [/^packages\/client\/src\/game\/(hostPanel|pauseMenu)\.ts$/, ['offline', 'weaponsets', 'hostgame', 'hostcontrols', 'lobby', 'dedicatedhost'], ['client']],
  [/^packages\/client\/src\/game\/(peerLink|relay|hub|lan|netTransport|joinCode)\.ts$/, ['online', 'hostgame', 'hostcontrols', 'lobby', 'handoff', 'dedicatedhost'], ['client']],
  [/^packages\/client\/src\/game\/hostLeft\.ts$/, ['hostgame', 'handoff'], ['client']],
  [/^packages\/client\/src\/game\/spectatorCam\.ts$/, ['offline', 'teams', 'hostgame'], ['client']],
  [/^packages\/client\/src\/game\/(mountVisuals|mountState|vehicleCamera)\.ts$/, ['vehicles', 'race'], ['client']],
  [/^packages\/client\/src\/(game\/raceHud\.ts|roadMeshes\.ts)$/, ['race'], ['client']],
  [/^packages\/client\/src\/game\/fortsClient\.ts$/, ['forts'], ['client']],
  [/^packages\/client\/src\/game\/rouletteHud\.ts$/, ['roulette', 'flashing'], ['client']],
  [/^packages\/client\/src\/game\/(flagVisuals|modeHud)\.ts$/, ['ctf', 'forts', 'breakthrough', 'zombies', 'teams', 'race', 'classes', 'flashing'], ['client']],
  [/^packages\/client\/src\/game\/scoreBoard\.ts$/, ['teams', 'ctf', 'zombies', 'classes', 'hostcontrols'], ['client']],
  [/^packages\/client\/src\/game\/(glassVisuals|waterVisuals|ragdoll|ragdollBudget|ragdollJoints|bloodVisuals|impactVisuals|reflections|skyEffects)\.ts$/, ['physicsfx', 'setpieces', 'flashing'], ['client']],
  [/^packages\/client\/src\/game\/(arsenalVisuals|muzzleVisuals|crosshair|throwArc|coverState)\.ts$/, ['arsenal', 'physicsfx', 'flashing'], ['client']],
  // Reduce flashing (the setting, steady lightning, the hurt vignette): its check, and where else they show.
  [/^packages\/client\/src\/game\/(reduceFlashing|steadyArcs|hurtVignette)\.ts$/, ['offline', 'physicsfx', 'arsenal', 'visual', 'flashing'], ['client']],
  [/^packages\/client\/src\/game\/(scenarioVisuals|scenarioState|pickupVisuals|propVisuals|canopyVisuals|cityVisuals|creatureAnimator|gait|torsoSurface|minimap|perfProbe|sessionAudio)\.ts$/, [...MAP_FLOWS, 'vault', 'outpost', 'sandgate', 'citadel', 'canyon', 'scenery', 'setpieces', 'zombies', ...CHARACTER_FLOWS, 'flashing'], ['client']],
  [/^packages\/client\/src\/(backdrop|borderVisuals|foliage|mapMeshes|playlists)\.ts$/, [...MAP_FLOWS, 'vault', 'outpost', 'sandgate', 'citadel', 'canyon', 'scenery', 'setpieces', 'visual', 'flashing'], ['client']],

  // The server (dedicated server, hub, lobby).
  [/^packages\/server\/src\/tools\//, NONE, ['server']],
  [/^packages\/server\//, ['online', 'hostgame', 'hostcontrols', 'lobby', 'handoff', 'dedicatedhost', 'hostpage'], ['server', 'host']],
  // The Host Service (dedicated host); its packaging tool runs in CI's host-release job.
  [/^packages\/host\/tools\//, NONE, []],
  [/^packages\/host\//, ['dedicatedhost', 'hostpage'], ['host']],
];

/**
 * What a set of changed paths (repo-relative) needs.
 * Returns { full, flows (sorted, every flow when full), bots (the bot scorecard's quick check), maps (E2E_MAPS: the maps the 'maps' flow tours, [] for its
 * whole part), unit ('all' or a sorted list of packages), docsOnly, perf, reasons }.
 * `mapIds`: the map files there are (ids, without .json), to find a changed map's tour part.
 * `tour`: a full run (nightly, v* tags, Run workflow) that takes the browser map tour; otherwise the tour's parts are
 * left out: the flows a rule maps to the tour get the coverage map's flow instead, and a change to a few maps tours
 * just those maps (`maps`, at most MAX_NAMED_MAPS; more run the parts that hold them).
 */
export function selectForPaths(paths, mapIds = [], { tour = false } = {}) {
  const changedMaps = [];
  const flows = new Set();
  const unit = new Set();
  let full = false;
  let unitAll = false;
  let perf = false;
  let bots = false;
  const reasons = [];
  for (const raw of paths) {
    const p = raw.replace(/^\.\//, '');
    if (!p) continue;
    if (BOT_PATHS.some((re) => re.test(p)) || BOT_CHECK_MAPS.has(/^maps\/([^/]+)\.json$/.exec(p)?.[1] ?? '')) bots = true;
    // Render-side changes get the draw-call budget check.
    if (/^packages\/client\/src\/(game\/(view|ragdoll|ragdollBudget|ragdollJoints|characterAnimator|propVisuals|scenarioVisuals|cityVisuals|canopyVisuals)\.ts|mapMeshes\.ts|foliage\.ts|backdrop\.ts|content\/|materials\/)|^packages\/shared\/src\/(content|map)\/|^tools\/perf\/|^content\//.test(p)) perf = true;
    const map = /^maps\/([^/]+)\.json$/.exec(p);
    if (map) {
      const id = map[1];
      if (id === 'phase0_arena') {
        full = true;
        reasons.push(`${p}: the default map of most flows`);
      } else {
        if (!COVERED_MAPS.has(id)) changedMaps.push(id);
        for (const f of MAP_USERS[id] ?? []) flows.add(f);
      }
      unitAll = true;
      continue;
    }
    // Built-in map rotations (data): the host controls that offer them, and the tests that check them.
    if (/^maps\/rotations\/[^/]+\.json$/.test(p)) {
      flows.add('hostcontrols');
      flows.add('dedicatedhost');
      for (const u of ['shared', 'server', 'host']) unit.add(u);
      continue;
    }
    // Built-in bot sets (data): the Bots window (match setup, pause menu), the dedicated host, and their tests.
    if (/^maps\/botsets\/[^/]+\.json$/.test(p)) {
      for (const f of ['offline', 'teams', 'hostcontrols', 'dedicatedhost']) flows.add(f);
      for (const u of ['shared', 'server', 'host']) unit.add(u);
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
  const docsOnly = !full && flows.size === 0 && unit.size === 0 && !unitAll && !perf && !changedMaps.length;
  if (full) for (const f of FLOWS) flows.add(f);
  let maps = [];
  if (!tour) {
    // No browser tour: what asked for it (a rule, or the full suite) gets the coverage map's flow instead.
    if (MAP_FLOWS.filter((f) => flows.delete(f)).length) flows.add('coverage');
    if (changedMaps.length && changedMaps.length <= MAX_NAMED_MAPS) {
      flows.add('maps');
      maps = [...changedMaps].sort();
    } else for (const id of changedMaps) flows.add(MAP_FLOWS[Math.max(0, mapPartOf(id, mapIds.length ? mapIds : changedMaps))]);
  } else if (!full) for (const id of changedMaps) flows.add(MAP_FLOWS[Math.max(0, mapPartOf(id, mapIds.length ? mapIds : changedMaps))]);
  return {
    full,
    flows: FLOWS.filter((f) => flows.has(f)),
    maps,
    unit: unitAll || full ? UNIT_ALL : [...unit].sort(),
    docsOnly,
    perf: perf || full,
    // The bot scorecard's quick check: a change to the bots, navigation, the simulation or its modes (or everything).
    bots: bots || full,
    reasons,
  };
}

/** vitest path filters for a selection's unit packages ('all' → none: every test). */
export function unitTestPaths(unit) {
  if (unit === UNIT_ALL) return [];
  return unit.map((u) => (u === 'tools' ? 'tools/ci/test' : u === 'content' ? 'tools/content/test' : `packages/${u}/test`));
}

/**
 * Unit-test jobs, side by side: the suite (~6 min on one runner) in vitest shards, and the headless check of every map
 * (packages/shared/test/allMaps*.test.ts, ~6 min of CPU) in jobs of its own. [{ name, args }]: vitest's arguments.
 */
export function unitJobs(unit) {
  if (unit !== 'all' && !unit.length) return [];
  const paths = unit === 'all' ? [] : unitTestPaths(unit);
  const maps = unit === 'all' || unit.includes('shared');
  const n = unit === 'all' ? 3 : unit.length > 1 || maps ? 2 : 1;
  const rest = Array.from({ length: n }, (_, i) => ({ name: `${i + 1}/${n}`, args: [...paths, `--shard=${i + 1}/${n}`, ...(maps ? ['--exclude=**/allMaps*.test.ts'] : [])].join(' ') }));
  const mapJobs = maps ? [1, 2].map((i) => ({ name: `maps ${i}/2`, args: `packages/shared/test/allMaps --shard=${i}/2` })) : [];
  return [...rest, ...mapJobs];
}
