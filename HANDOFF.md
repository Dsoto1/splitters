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
    gone (the owner's call: they didn't convert well).

  A 0.4.0 release is reasonable once the owner has tried the launcher. A minor
  version, because these are features.
- **Nothing is in progress.** No agents are running and no CI is pending.

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
- Cognito pool `us-east-1_VdMsuDJ59` (shared with the owner's Flavius game),
  domain `login.toshiroplay.com`, Trigger app client `2lrej6nsacfag8a7taeu3u6sc2`
  (public SPA, PKCE, Google sign-in).
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
