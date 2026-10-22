# Open Questions

## Resolved by pack v2

The v1 conflicts are settled by `MASTER_SPEC_V2.md`:

| v1 conflict | v2 decision |
|---|---|
| Godot / PC vs browser | Browser-first; TypeScript + Babylon.js; WebGPU with WebGL2 fallback (§3, TECH_ARCHITECTURE) |
| Listen servers, 12–16 players vs dedicated, 32 slots | Dedicated authoritative servers; 32-slot architecture; vertical slice proves 8 slots, then staged 16/24/32 load tests (§3.4, §11) |
| MapMaker vs Scenario Maker | One MapMaker with BUILD / GAMEPLAY / ENTITIES / LOGIC / WORLD / TEST workspaces (§5) |
| Vertical-slice roster size | 12 characters (§10, §11) |
| NPCs / squads / factions missing from phases | Factions, encounters, squads, and WHEN→IF→DO logic are core; slice includes 1 enemy faction + 1 NPC squad archetype (§7, §8, §11) |

## Still inconsistent in v2

These are small and `MASTER_SPEC_V2.md` already wins on each, but the supporting docs should be corrected so implementers don't trip on them.

1. **`CHARACTERS_BOTS_V2.md` §9 vertical-slice breakdown.** The headline now says 12 characters, but the "At least" list underneath (8 grounded, 8 heightened, 6 weird, 2–6 extreme) still adds up to 24–28. Suggested 12-character split, keeping the §5 ratios: 4 grounded, 4 heightened, 3 weird, 1 extreme.
2. **`CHARACTERS_BOTS_V2.md` §34 acceptance criteria.** Still says "At least 24 distinct characters exist." This should be 12.
3. **"Scenario Maker" naming.** `CHARACTERS_BOTS_V2.md` §1, §18, §23 and §24 still say "Scenario Maker". Master §5 says it is not a separate application. Rename it to MapMaker (ENTITIES / LOGIC workspaces).
4. **v1-only detail.** Accessibility (v1 §17), validation severity classes (v1 §9), weapon data fields (v1 §5.2), map versioning fields (v1 §10.3), and save/profile (v1 §20) have no v2 home yet. They live in `archive/MASTER_SPEC_V1.md` until `WEAPONS_ITEMS.md`, `UI_UX.md`, etc. are written (master §16 "Later" list).

## Decisions needed before Phase 0 code

These are not specified anywhere yet and affect the initial scaffold:

- **Server runtime.** Node.js, Bun, or Deno for the headless server. All three can share TypeScript modules with the client.
- **Transport.** WebSocket only at first, or WebTransport/WebRTC data channels for unreliable delivery. TECH_ARCHITECTURE leaves snapshot/delta strategy to prototype measurement.
- **Physics/collision.** Babylon's Havok plugin on the client is not available headless as-is. The server needs its own collision (e.g. Rapier via WASM, or custom capsule-vs-grid) shared by both sides for prediction.
- **Navigation.** Recast/Detour (e.g. recast-navigation-js) generated from tile geometry is the obvious candidate for "no manual waypoints".
- **Repo layout.** A monorepo (e.g. pnpm workspaces) with `client`, `server`, and shared `shared/map-format`, `shared/sim`, `shared/protocol` packages fits the "share pure TS modules" rule.
