# Loading: what a first visit downloads

Until 0.3.0 the client was one 22 MB script (4.4 MB gzipped) that a first
visit had to download, parse and run before the main menu could draw. Now the
menu loads only what it draws, and the rest comes on demand or while the menu
sits idle.

## What was in the one script

Measured with a module-size dump of the 0.3.0 build (sizes before minifying):

| | |
|---|---|
| every map in `maps/` (eager `import.meta.glob` in main.ts) | 15.0 MB |
| Rapier (`@dimforge/rapier3d-compat`: its WebAssembly inlined as base64) | 4.3 MB |
| Babylon (engine, materials, meshes, post-processes, glTF with every extension, flow graph, audio…) | ~7 MB |
| the match, MapMaker, Character Designer, shared sim and content tables | ~2.5 MB |

## How it's split now

- **The menu** (`index-*.js`, plus `babylon-*.js` and `vendor-*.js`, which
  index.html modulepreloads): main.ts, the front end, the menu scene, the
  engine, the shared tables the menu reads, and the part of Babylon those run.
- **Maps**: one chunk per file in `maps/`, loaded when a map is played, opened
  in MapMaker or its plan is drawn. The menu draws its cards from
  `virtual:map-index` (`packages/client/mapIndexPlugin.ts`), worked out at
  build time with the same `loadMap` / `playableModes` the menu used to run on
  every map at startup (`src/mapIndex.ts`). A card's plan draws once its map is
  in; the setup panel shows "Loading …" for the moment a map takes. The home
  screen's featured map loads alongside the engine.
- **The match** (`game/matchCode.ts`: session, transports, physics init): a
  dynamic import at main.ts's mode switch. Physics (Rapier) initialises with it
  instead of before the menu. The match worker (`simWorker`) shares the page's
  Rapier file (`rapier-*.js`: same bytes, same hashed name, one download).
- **MapMaker** and the **Character Designer**: dynamic imports when opened.
  MapMaker's Open list comes from the map index; a template loads when its row
  is seen or opened.
- **WebGPU's engine** loads only with `?renderer=webgpu`.
- **glTF**: Babylon's on-demand extension registration
  (`src/content/gltf.ts`); the extensions our models use are registered
  eagerly, the rest (interactivity and its flow graph, audio emitters, splats…)
  load only if a model ever needs one.
- **Graphics settings** (`game/graphicsSettings.ts`) moved out of
  `atmosphere.ts` (which re-exports them), so the menu's Options don't pull in
  shadows and post-processes.
- **Vendor chunks** (`vite.config.ts`): `babylon` (what the first load runs),
  `rapier`, `peerjs`, `vendor` keep their hashed names across releases while
  our code changes (the hub serves `/assets/` immutable for a year). The rest of
  Babylon (shaders, game-only parts) keeps Rollup's own chunks: a manual chunk
  would also take in the shaders the menu fetches on demand.

Hooks for browser tests are unchanged: `window.__front` once the menu is up,
`__editor` when MapMaker opens, `__designer` when the designer does, `__cs`
when a match is ready.

## Prefetch

Once the menu has faded in and the page is idle (`requestIdleCallback`, at
most 2 s later), main.ts fetches the match code (with Rapier) and the map Play
opens on, so Start doesn't wait for them. Pressing Start before that just waits
for the same downloads with the menu still up (a second press replaces the
first). `?offline=`, `?join=` and `?autojoin` start the match code loading at once.

## Numbers

0.3.0 against this change, both built the same way, served like the hub
(gzip), headless Chromium with SwiftShader, CDP throttling 10 Mbit/s and
40 ms per request, a fresh profile each run (`tools/perf/first-load.mjs`,
runs alternating, medians; the machine was shared, so Play times are noisy):

| | 0.3.0 | now |
|---|---|---|
| main chunk (raw / gzip) | 22.3 MB / 4.43 MB | 0.95 MB / 0.30 MB (`index`), + `babylon` 1.62 / 0.42, `vendor` 0.10 / 0.03 |
| the menu's first JS (`bundle-budget.mjs`, gzip 6) | 22.3 MB / 4.43 MB, 1 file | 2.68 MB / 0.74 MB, 3 files |
| JS transferred before the menu is up (incl. the featured map, shaders) | 4.50 MB | 0.86 MB |
| time to the menu (5 runs) | 8.7 s | 3.7 s |
| Play → in match, after 40 s on the menu (prefetch done; 5 runs) | 10.5 s | 10.3 s |
| Play → in match, pressed the moment the menu shows (3 runs) | 27.6 s | 20.4 s |

Play → in match is dominated by SwiftShader building the match (shaders,
meshes); on a real GPU both are far shorter. What matters is that it doesn't
get longer: by the time a player presses Start, the prefetch has normally
brought the match code and the map in. All of `dist` gzipped went from 7.6 MB
to 6.1 MB (the match worker no longer carries its own copy of Rapier).

## The budget (CI)

`tools/ci/bundle-budget.mjs` (CI's build and site jobs) adds up the JS a first
visit loads before the menu (index.html's entry and everything it imports
statically, i.e. its modulepreloads), gzipped as the hub serves it, and fails
over **800 kB gzip / 2.9 MB raw**. Over budget usually means a static import
pulled something the menu doesn't draw back into the first load: make it a
dynamic `import()` at the mode switch that needs it. Raise the budget only on
purpose, in the commit that needs it (`BUDGET_GZIP_KB`, `BUDGET_RAW_KB`).

Measure a change: `pnpm build && node tools/ci/bundle-budget.mjs`, and
`node tools/perf/first-load.mjs [dist …]` for times (it serves each build the
way the hub does and alternates runs between them).
