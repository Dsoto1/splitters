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
3. **"Scenario Maker" naming.** `CHARACTERS_BOTS_V2.md` still says "Scenario Maker" throughout (e.g. §1, §4, §16, §23, §24, §34, §37). Master §5 says it is not a separate application. Rename it to MapMaker (ENTITIES / LOGIC workspaces).
4. **v1-only detail.** Accessibility (v1 §17), validation severity classes (v1 §9), weapon data fields (v1 §5.2), map versioning fields (v1 §10.3), and save/profile (v1 §20) have no v2 home yet. They live in `archive/MASTER_SPEC_V1.md` until `WEAPONS_ITEMS.md`, `UI_UX.md`, etc. are written (master §16 "Later" list).

## Phase 0 stack decisions (made)

- **Server runtime:** Node.js 22.
- **Transport:** WebSocket with JSON messages. Revisit binary/delta encoding or WebTransport after staged load tests.
- **Physics/collision:** Rapier (WASM) shared by server and client prediction.
- **Navigation:** Recast/Detour via recast-navigation-js, generated from map geometry.
- **Repo layout:** pnpm monorepo with `shared`, `server`, `client` packages.

See [`PHASE0.md`](PHASE0.md) for results and deferred gaps.
