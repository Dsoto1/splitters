# splitters — Project ChronoSplit (working title)

An original browser-first arcade FPS and community creation platform with a built-in MapMaker (grid construction through scripted co-op scenarios), full Player Bots, scenario NPCs, and a deliberately chaotic cross-era character roster. Inspired by the design lessons of classic console arena shooters; uses no proprietary assets, names, or content.

**Status:** Phase 1 (vertical slice), milestone M1 done: in-browser MapMaker with instant TEST. See [`docs/PHASE1.md`](docs/PHASE1.md).
**Stack direction:** TypeScript + Babylon.js client (WebGPU, WebGL2 fallback); headless dedicated authoritative server.

## Quick start

Requires Node 22+ and pnpm 10.

```bash
pnpm install
pnpm dev:server   # dedicated server on ws://localhost:7777 (fills with bots)
pnpm dev:client   # open http://localhost:5173
```

The menu offers **MapMaker**, **Play offline vs bots** (no server needed) and **Play online** (needs `dev:server`).

- **Playing:** WASD move · Space jump · Left mouse fire · Tab scoreboard · F3 performance/bot overlay · Esc twice to leave.
- **MapMaker:** pick a piece and click to place · R rotate · right-click erase · Select tool (V) to click/drag/Shift-select · Del delete · Ctrl+D duplicate · Ctrl+Z / Ctrl+Y undo/redo · PgUp/PgDn change floor · RMB drag look, WASD/QE fly, wheel zoom · F5 or ▶ TEST to play the map instantly with bots.

`pnpm test` · `pnpm typecheck` · `pnpm validate-map maps/phase0_arena.json` · `pnpm bench 32 60` · `pnpm build && pnpm e2e` (browser tests)

## Repository layout

| Path | Contents |
|---|---|
| `packages/shared` | Map format, Classic Grid tiles, physics/movement, weapons, Match simulation, navmesh, Player Bot AI, wire protocol |
| `packages/server` | Dedicated authoritative WebSocket server, instrumentation, `validate-map` and `bench` tools |
| `packages/client` | Babylon.js browser client: MapMaker (`src/editor`), game sessions with prediction/interpolation/HUD (`src/game`), local and network transports |
| `maps/` | Map documents (JSON) |
| `e2e/` | Playwright browser checks (editor loop, online clients) |
| `docs/` | Specs, open questions, Phase 0 report |

## Documents

`MASTER_SPEC_V2.md` is authoritative; supporting docs lose on conflict. Recommended reading order:

1. [`docs/MASTER_SPEC_V2.md`](docs/MASTER_SPEC_V2.md) — product definition, platform, combatant model, vertical-slice scope, phases, engineering rules
2. [`docs/TECH_ARCHITECTURE.md`](docs/TECH_ARCHITECTURE.md) — client/server split, data formats, safe logic, networking, security, testing gates
3. [`docs/MAPMAKER_SCENARIO.md`](docs/MAPMAKER_SCENARIO.md) — workspaces, construction layers, logic, factions/encounters/squads, validation
4. [`docs/MULTIPLAYER_AI_SCALE.md`](docs/MULTIPLAYER_AI_SCALE.md) — 32-slot architecture, NPC scaling, interest management, load-test ladder
5. [`docs/CHARACTERS_BOTS_V2.md`](docs/CHARACTERS_BOTS_V2.md) — roster, originality guardrails, bot personalities, NPC reuse

Also:

- [`docs/PHASE1.md`](docs/PHASE1.md) — vertical-slice milestones, rendering engine decision, M1 status
- [`docs/CONTENT_PIPELINE.md`](docs/CONTENT_PIPELINE.md) — the hand-made toy box players build with, and the pipeline/tools the team uses to make it
- [`docs/PHASE0.md`](docs/PHASE0.md) — what Phase 0 proves, measurements, known gaps
- [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md) — remaining inconsistencies in the v2 pack
- [`docs/archive/MASTER_SPEC_V1.md`](docs/archive/MASTER_SPEC_V1.md) — superseded v1 master spec, kept for detail v2 doesn't yet cover

## First loop to prove

> Open browser → build room → place gun/enemy/door → attach trigger/objective → Test → fight → return to editor → change → Test again.
