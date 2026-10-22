# Phase 0 — Technical Proofs

Status of the MASTER_SPEC_V2 §14 Phase 0 list. Measured numbers are from the cloud dev container (Node 22, no GPU), so treat them as a rough baseline, not a target.

| Proof | Where | How it's verified |
|---|---|---|
| Browser FPS movement/rendering | `packages/client` (Babylon.js, WebGPU → WebGL2 fallback) | Headless Chromium smoke run against a live server (WebGL2 path); manual play |
| Authoritative dedicated server | `packages/server` (Node + `ws`, 60 Hz fixed tick) | `packages/server/test/server.test.ts` |
| Two network clients | Same | Two WebSocket clients join, one shoots the other, the kill and score reach both |
| One weapon/damage loop | `shared/src/sim/weapons.ts`, `sim/match.ts` | Hitscan rifle: fire-rate limit, wall occlusion, damage, kill, respawn, score limit, round restart |
| One Player Bot | `shared/src/bots/brain.ts`, `nav/` | Bot finds, chases (including up stairs) and kills an idle human via a navmesh generated from the map; 32-bot soak |
| Minimal map serialisation | `shared/src/map/` | Schema v1, round-trip, migration chain, validation (errors/warnings with target IDs), nav reachability |
| Performance instrumentation | `server/src/stats.ts`, client F3 panel, `pnpm bench` | Server tick/AI ms, snapshot size, bytes/s/client, late ticks; client FPS, ping, mispredictions |

## Architecture decisions made in Phase 0

- **Monorepo** (`pnpm` workspaces): `shared` (pure TS sim + map format + bots), `server`, `client`. `@chronosplit/shared/match` is a separate entry so the browser bundle does not pull in Recast unless it runs a local match.
- **One simulation, three hosts.** `Match` has no Node/DOM/network code. The dedicated server, the tests, the load harness and — in Phase 1 — the in-browser MapMaker TEST mode all call `match.step()`.
- **Physics:** Rapier (`@dimforge/rapier3d-compat`) kinematic character controller against static map boxes. Players never block each other's movement, so client prediction does not depend on remote positions.
- **Deterministic prediction:** the server quantises positions to 1 mm after every step and the client replays unacknowledged inputs from the snapshot state with the same code. `packages/client/test/prediction.test.ts` drives a 15 s scripted run with 100 ms latency each way and asserts **zero** corrections.
- **Navigation:** Recast navmesh generated from the same boxes (`walkableClimb` matches the controller's step height; radius has 0.2 m extra clearance). No authored waypoints.
- **Classic Grid:** tiles are data (cells, ports, solids). Unconnected ports auto-cap into walls; multi-level tiles (stairs) reserve the cells above them.
- **32 slots everywhere:** `MAX_PLAYER_SLOTS = 32` sizes the slot array, protocol and bot fill. Tests fill 32 bots and reject a 33rd.
- **Protocol:** JSON over WebSocket, 30 Hz snapshots; the shared snapshot body is serialised once and only the per-client `ack` is spliced in.

## Measurements (dev container)

| Scenario | Result |
|---|---|
| `pnpm bench 32 60` — 32 Player Bots, 60 s simulated | 0.62 ms avg tick, 2.3 ms p99, 14 ms worst single tick; AI ≈ 23% of tick; ~27× realtime |
| `pnpm bench 8 30` | 0.25 ms avg, 1.0 ms p99 |
| Live server, 2 browsers + 2 bots | ~0.3 ms tick, ~550 B snapshots, ~16 KiB/s per client |
| Client bundle (production build) | ~5.8 MB minified / ~2.0 MB gzip, one chunk |

## Known gaps (deliberately deferred)

- **No lag compensation.** Hits are resolved against current server positions, so shooters must lead by their latency. Needed before online play feels fair.
- **Bundle size.** Rapier's `-compat` build inlines its WASM as base64 and Babylon is not code-split yet. Next steps: switch to the non-compat Rapier build with a separate `.wasm`, split Babylon/physics into lazy chunks.
- **JSON protocol.** Fine at this scale. Revisit (binary/delta) once 16/24/32-slot load tests measure bandwidth.
- **Idle humans don't fall.** The server only simulates a human when an input arrives; a client that stops sending freezes in place. Needs a server-side "no input" step policy.
- **Bot quirks.** In the 32-bot soak, bots trigger ~50 stuck recoveries per minute, mostly from strafing into door frames while fighting. Fine for a proof; tune when doing personalities properly.
- **WebGPU path unverified here.** The container's software WebGPU adapter loses its device on first present, so only the WebGL2 fallback can be exercised. Phase 1 added an automatic fallback for exactly that case; see `PHASE1.md`.
- **No editor yet.** Addressed in Phase 1 M1 (MapMaker + in-browser TEST).

## Running it

```bash
pnpm install
pnpm dev:server        # ws://localhost:7777, fills to 4 players with bots
pnpm dev:client        # http://localhost:5173
```

Server environment variables: `PORT`, `HOST`, `MAP` (path to a map JSON), `BOT_FILL` (total players to fill with bots, max 32), `BOT_DIFFICULTY` (`easy|normal|hard`), `QUIET_STATS=1`.

Client URL parameters: `?server=ws://host:7777&name=You&autojoin&stats&renderer=webgl2`.

Tools: `pnpm test`, `pnpm typecheck`, `pnpm validate-map <map.json>`, `pnpm bench [bots] [seconds] [map.json]`.
