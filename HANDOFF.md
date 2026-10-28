# Handoff: where Tile Trigger stands (2026-10-28, afternoon)

A briefing for the next Claude session or agent picking up this repo. Read
`CLAUDE.md` first (workflow and rules), then this file. Keep this file current:
update it when you finish a piece of work or the owner changes direction.

## State

- **Live:** https://trigger.toshiroplay.com, version **0.3.0** (`v0.3.0` tag and
  GitHub release exist). `main` is at or past `ace6276`; all of it went green on
  `check/candidate`.
- **Since 0.3.0 (in the CHANGELOG's Unreleased section, not tagged yet):**
  - Safari offline-match fix;
  - MapMaker white-props fix;
  - Host Service, the dedicated-server launcher;
  - on-demand loading: the menu loads 0.74 MB of JS gzip instead of 4.4 MB.

  - Host Service **launcher** (`packages/host/src/launcher.ts`): the service
    serves its own page on 127.0.0.1 and opens it on start: the console in
    the site's look (log, filters, command line with suggestions) and a right
    bar of controls, each running the console command it shows;
  - map select: uniform map cards (picture, name, plan); blurb and modes in
    the setup panel;
  - the imported TimeSplitters maps (`maps/imported/`) and their importer are
    gone (the owner's call: they didn't convert well);
  - online: away players and reconnecting, profiles (username, region),
    region-sorted game browser, the online line in the Tab scoreboard, join
    limits and idle kick on every host (on `main` at `c3d6f27`; the box needs
    `infra/deploy-multiplayer.sh --owner …` rerun for `PROFILES_DIR`);
  - shipped
    character portraits (`tools/content/capture-portraits.mjs`, the
    "Capture portraits" workflow: run it once this is on `main`, then review
    and merge its `check/portraits` branch), the start-up loading screen
    (`src/boot.ts`), MapMaker's level split fixed (floors go by their top, so
    ground floors aren't drawn see-through over terrain), and match setup's
    step-by-step panel with mode tabs, search, sort, list view and favourites
    (`frontEnd.ts` `arcade()` / `fillSetup()`, `modeIcons.ts`; the owner's
    mockup of 2026-10-28).

  A 0.4.0 release is reasonable once the owner has tried the launcher. A minor
  version, because these are features.
- **Nothing is in progress.** Everything above is on `main` (`7657980` and on). Open: nine portraits left to render live (soldier NPCs untinted, cyclops/oculus/imp/Nova framing) until `portraits.ts` handles them; the Host Service launcher now opens as an app window (`src/appWindow.ts`), untested on a real screen.

## In flight (2026-10-28, 16:30 EDT): pick up here

All of this is on the session branch `claude/launcher-ui-map-cards` (pushed) and
on `check/candidate` (CI running). `main` is at `4718207` + the infra fixes; none
of the list below is on `main` yet. When `check/candidate` is green,
fast-forward `main` to it (it contains `main`).

1. **Binbun VFX (CC0 packs the owner downloaded; zips not committed):**
   - muzzle flashes `game/muzzleFlash.ts` (from `public/vfx/muzzle_flash.json` +
     atlas), hit and explosion effects `game/godotVfx.ts` (a small Godot
     particle/shader player for `hit_fx.json`, `explosion_fx.json`);
     converter `tools/content/prepare-vfx.mjs` + `godot.mjs`; provenance in
     `content/vfx*.json`, `assets-src/binbun-*`.
   - Muzzle commit `8ac1d75` went green on `check/vfx`, but a local capture
     (frozen clock, `?offline=arena`) showed **no flash visible in first
     person**: the rig fires (pieces enabled, scale 0.2 at the muzzle) yet
     nothing shows. Suspects: blades lie along the view axis (edge-on from
     behind the gun), the front star is small, alpha math, or the atlas
     sampling. Debug with the check-builds site (release asset of the commit)
     served locally + Playwright (scripts were in the session scratchpad:
     freeze `performance.now` after `view.flashRig.fire`). Don't ship until a
     screenshot shows a flash. Hit/explosion player is untested visually.
2. **Terrain never through floors** (`settle.ts terrainUnderFloors`, applied in
   `loadMap` and every MapMaker edit via `withTerrainUnderFloors`): on
   `check/terrain` (`476bd74`) e2e shard 8 failed once (outpost, canyon, teams,
   hostcontrols, lobby, dedicatedhost); logs aren't downloadable here; re-run it
   to tell flake from real.
3. **MapMaker:** fold-away sidebars (\ / Shift+\), edits rebuild only what
   changed (measured on Sandgate headless: ~170 ms per edit, ~100 ms of it the
   terrain), faster terrain meshes, and **Paths** (`shared/map/paths.ts`,
   `client/pathMeshes.ts`, `editor/pathTool.ts`, `setPaths` command; laid on
   load, `loadMap(..., { forEditing: true })` in MapMaker/publish keeps them
   apart).
4. **MapMaker unification ("yes to all"), done on the session branch (CI next):**
   - Right-click takes back the tool's effect (`secondaryClick`): Paint resets,
     Walls resets, Scatter clears, Road/Paths/Route remove a point, a placing
     tool removes a thing of its own kind; with Select it opens a menu
     (`openContextMenu`, `#ed-ctx`).
   - Erase picks like Select (a whole moving build; Alt one piece).
   - Placement: Ctrl (or Shift) places without snapping for every kind
     (`freePlacing`); dragged things preview where they land (`updateDrag`).
     One spot rule (`placeSpot`: the terrain under the pointer, else the
     level's floor) and one ghost (`setPropGhost`) for props, vehicles, spawns
     and pickups; tiles keep their green ghost. Objects (doors, traps…) still
     show only the hover cell.
   - Rotation: `yawStep(kind, fine)` in shared `operations.ts` (spawn 45/15,
     prop and vehicle 15/5, tiles, zones and liquids 90, rest 90/15) for
     placing, R, Shift+R and the inspector; groups turn about their centre
     (`rotateCommand`).
   - Drag-to-paint for Paint, Walls, Scatter and Erase (`brushAtHover`), one
     undo step per drag (`EditHistory.beginStroke/endStroke`); Shift = the
     opposite, Alt = pick.
   - Keys: \ and Shift+\ fold the sidebars, PgUp/PgDn levels only, [ ] brush
     size only, G Paths, Shift+G race Road, N Scatter.
   - One hint line per tool (click · right-click · R · modifiers).
   - Inspector walls pick glass like the Walls tool (`setEdge`); surfaces share
     the Paint tool's Apply to and take its brush.
   - One home per pane: Nature and Terrain only in Environment; the backdrop in
     Environment → Sky (`#ed-sky`); no `confirm()` for undoable removals.
   - Routes: `editor/routeTool.ts`, "Draw route on the map" in the mover and
     plane inspectors, the same gestures as Paths and the Road.
   - e2e: editorux checks the rotation steps, the menu and strokes. CI failures
     now come back as annotations (`::error title=e2e <flow>::…`), so a failed
     shard can be read through the check-runs API without the log.
5. **Frozen page fixed (85a2737):** the hit/explosion player's `Emitter.spawnAt`
   returned without counting a particle once an emitter was full, so the
   emission loops never ended and busy matches froze (perf stall on Frost
   Basin, hostgame/dedicatedhost connection failures, a scenery click
   timeout). Found by bisecting on `check/perf-a` / `check/perf-b`; those and
   `check/kickprobe` are leftover probe branches (deleting a remote branch is
   refused from here: the owner can delete them). Effects are also capped
   (remote pack flashes within 45 m on at most 8 guns; 10 effects at once).
6. Waiting on the owner: privacy-page contact address; Sandgate's street
   terrain (lumpy dirt/grass in the open streets is authored paint: the owner
   can now draw sand Paths over it); nine portraits still rendered live.

## How work flows (details in CLAUDE.md)

1. Work on the session branch, or in an agent worktree that you merge into it.
2. Run the checks locally: `pnpm typecheck`, `pnpm test:changed`, and after
   `pnpm build`, the e2e flows your change touches
   (`E2E_ONLY=<flows> node e2e/run.mjs`).
3. Push the merge candidate: `git push -f origin HEAD:check/candidate`. CI runs
   what the change needs. You can poll it without auth:
   `curl -s "https://api.github.com/repos/Dsoto1/splitters/actions/workflows/ci.yml/runs?branch=check/candidate&per_page=1"`
4. Only when green, fast-forward: `git push origin <sha>:main`. A main push that
   already passed on a check branch skips the tests. The `release` and
   `host-release` jobs then publish the site build and the Host Service
   downloads to the `main-latest` GitHub release.
5. The owner updates the box with `sudo tiletrigger-update` (Lightsail console →
   Connect). An hourly timer can do it instead
   (`systemctl enable --now tiletrigger-update.timer`).

**Gotchas**

- Some Claude sessions can't reach registry.npmjs.org (DNS fails, the proxy
  refuses it): `pnpm install` fails, so nothing builds or tests locally. Push
  to `check/candidate` and let CI check it.

- The session's git proxy refuses tag pushes and remote branch deletes. The
  owner makes releases in the GitHub UI: tag `vX.Y.Z` on the green main commit,
  notes from CHANGELOG.
- Bump `packages/client/package.json` for a release. The menu shows the version,
  so regenerate the menu screenshot baseline: `pnpm e2e:baselines`, or
  `E2E_UPDATE_BASELINES=1 E2E_ONLY=visual node e2e/run.mjs`, keeping only
  `menu.png`.
- CI artifact downloads (blob storage) are blocked from the sandbox. A failing
  visual check prints a quarter-size PNG to the log (`VISUALPNG <scene>` lines,
  base64) and a 12×6 grid of where pixels differ.
- Run at most 2–3 agents at a time and commit at every milestone. The container
  restarts sometimes and loses anything uncommitted.
- Use `TaskStop` on agents that linger on background jobs.
- Several agents share e2e ports on one machine. Load causes timing failures
  (glass shots, "TEST starts within 3 s"), so rerun a failure alone before
  calling it real.

## Map of the system

| Area | Where | Docs |
|---|---|---|
| Client (Babylon.js + Vite) | `packages/client` | `docs/UI.md`, `docs/LOADING.md` |
| Simulation, maps, protocol | `packages/shared` | `docs/TECH_ARCHITECTURE.md`, `docs/MULTIPLAYER_PROTOCOL.md` |
| Hub (site, broker, game browser, TURN creds, Cognito, tickets) and dedicated server | `packages/server` | `docs/HOSTING.md`, `docs/MULTIPLAYER_SECURITY.md` |
| Host Service (dedicated host over WebRTC, console, control API, downloads) | `packages/host` | `docs/HOSTING.md` → "Dedicated host (Host Service)" |
| AWS (Lightsail box, Route53, SSM, budget) | `infra/` | `docs/HOSTING.md`, `infra/deploy-multiplayer.sh` header |
| CI | `.github/workflows/ci.yml`, `tools/ci/` | `CLAUDE.md` |
| Bots | `packages/shared/src/sim/` (spawns, squads, roles) | `docs/BOTS.md`, `docs/PERF_96.md` |
| Gunplay | | `docs/GUNPLAY_SPEC.md`, `docs/GUNPLAY_DIRECTION.md` |
| Owner's multiplayer direction | | `docs/MULTIPLAYER_DIRECTION.md` (read before networking or hosting work) |

**Infrastructure facts**

- Lightsail 2 GB box `toshiro-trigger-hub`, static IP 18.214.136.159, us-east-1.
  It runs Caddy, the hub and coturn.
- Deploys come from AWS CloudShell: `infra/deploy-multiplayer.sh`.
- The box never builds: it installs CI's signed builds from GitHub Releases.
- The owner's Cognito pool (shared with their Flavius game), login domain
  `login.toshiroplay.com`, Trigger's public SPA app client (PKCE, Google
  sign-in). No IDs in the repo: the deploy looks them up each run; the page
  reads them from the hub's `/auth-config.js`.
- Secrets live only in SSM (`/toshiro/trigger/turn-secret`,
  `/toshiro/trigger/hub-signing-secret`). Never put them in the repo or the
  bundle.
- Budget `toshiro-trigger-prod-monthly`, alerts at $15/$25. About $13/month.
- The owner chose to keep the TURN relay (2026-10-28). It's capped in
  coturn's config, and credentials go only to live games.

**Pitfalls**

- **Safari and module workers:** no chunk may import from a worker's entry file.
  `simWorker.ts` is a tiny loader for `simWorkerCore.ts`, and
  `tools/ci/check-worker-entry.mjs` enforces it.
- **Babylon side-effect imports:** since MapMaker loads on demand,
  `game/view.ts` imports `@babylonjs/core/Culling/ray` itself. Watch for
  "X needs to be imported before" errors after moving code between chunks.
- **Shared materials:** never `dispose(false, true)` a node built from
  `ModelLibrary`; its materials are shared. Use `disposePropNode`.
- **Bundle budget:** `tools/ci/bundle-budget.mjs` caps the JS loaded before the
  menu at 800 kB gzip.
- **Host Service and node-datachannel quirks:** a channel can arrive already
  open, and "open" can fire twice. Admit a connection once (`admitWhenOpen`).
  A Node offerer has a DTLS race; see `packages/host/test/guest.ts`.

## Owner preferences and rules

- Plain explanations; ask before big direction changes. The owner tests on the
  live site from a Mac (Safari and Chrome) and a desktop.
- Content rules in CLAUDE.md:
  - no in-game AI generation or uploads;
  - Meshy models made on the owner's subscription are OK and recorded in
    provenance;
  - otherwise CC0 / credit-only / approved Quaternius only;
  - never commit raw pack files.
- Official servers run suite maps only. Community servers may run community
  maps, labelled "Community map".
- Hosting is opt-in. Players never need the Host Service, and no install prompt
  appears anywhere except `/host`.
- The owner said "forget the SUV".

## Waiting for the owner's go (docs/STAGED_IDEAS.md)

1. **Dustwater expansion:** bigger town, mines, two trains running tunnel to
   tunnel in opposite directions. It has four open questions:
   - train type;
   - whether players can ride the trains;
   - size (about 2×, for 48v48?);
   - name: keep Dustwater or make a new map.
2. **Map rework batches and set pieces:**
   - layouts, spawns, glass and water passes;
   - Runway Nine airplane;
   - Blackout enemies;
   - Mercy Ward rooftop zombies.

## Online: away players, reconnecting, profiles, regions (2026-10-28)

- `BotFiller` (shared `sim/match.ts`, `AWAY`): idle → warning → bot plays the
  place ("Name (away)") until real input; dropped → place held 60 s by
  `sub:`/`pk:` key and reclaimed on reconnect; servers close links silent
  20 s. Wired in `server.ts` (dedicated, Host Service) and `matchHost.ts`
  (browser host, friends only). Client reconnect loop in `main.ts`.
- Profiles: hub `profiles.ts` (`PROFILES_DIR`), usernames in account tickets,
  page-side Ed25519 ticket checks for browser hosts (`game/ticketCheck.ts`),
  scoreboard ✓ / GUEST, Profile screen, `client/src/profile.ts`. Needs the
  box set up again once (`deploy-multiplayer.sh`, also for `--owner`).
- Region: `shared/net/profile.ts` REGIONS; adverts carry `region`; game
  browser sorts nearby first; Host Service `REGION`.

## Maps are made in MapMaker; the owner publishes (2026-10-28)

- Every map is its file in `maps/`, made and edited with MapMaker; the 86
  build scripts were retired (CLAUDE.md, "Maps": no scripts, no one-off code
  for one map). The map tour also opens every map in MapMaker (e2e).
- MapMaker treats a mover and what it carries as one **moving build**
  (select, move, rotate, duplicate, delete; Alt-click for one part).
- **Publishing** (docs/HOSTING.md, "Publishing maps"): hub `publish.ts`
  (`/api/v1/maps`, owner-only writes, every version kept), site
  `publishedMaps.ts`, MapMaker `editor/ownerPublish.ts`, Host Service
  `published.ts`, daily `published-maps.yml` workflow to
  `check/published-maps`. **Needs the owner once:** copy the account ID
  (main menu → click "Signed in as …") and run
  `infra/deploy-multiplayer.sh --owner <id>` in CloudShell (that also gives
  the hub `/var/lib/tiletrigger/maps`).
- **Still open:** FBX characters with auto-rigging, owner-only (proposed: a
  Character Lab that guesses the joints, previews animations and the gun grip,
  rigs in the browser and publishes the finished model the same way; the rig
  pipeline exists in `tools/content/prepare-meshy-characters.mjs`).

## Backlog ideas (not started, not yet asked for)

**Host Service next steps** (`docs/HOSTING.md`):
- account pairing through the hub;
- signed self-updates;
- an installer with start-on-boot;
- a tray icon;
- code-signing the downloads;
- per-player join tickets everywhere.

**Other:**
- Babylon's remaining big chunks; a true `.wasm` physics package (Rapier
  non-compat) to drop the base64 inlining.
- Far-player prediction replay skip, and a binary encoding of player entries for
  hosted 48v48 (see `docs/PERF_96.md` → "Hosted 48 v 48").
- A UI parity pass against the reference; a mist depth pass; a per-look outfit
  atlas.
- The FlaviusRule session (`dsoto1/arena`) owns moving the Flavius client to
  `login.toshiroplay.com` (error ref E-XD70 until then). It's not this repo's
  job.
