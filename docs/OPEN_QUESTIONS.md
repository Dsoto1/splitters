# Open Questions — Spec Reconciliation

The master spec and `CHARACTERS_BOTS.md` were written with different platform assumptions. These should be resolved before Phase 0 code, because several of them change the architecture.

## 1. Platform: PC-first (Godot) vs browser-first

- **Master spec §header, §18:** Godot 4.x, Windows PC primary; Linux/Steam Deck secondary.
- **CHARACTERS_BOTS header, §8, §26, §34:** "browser-first"; LODs, streaming, and acceptance criteria are written for browser clients.

Godot 4 can export to the web, but web exports have real limits: they need cross-origin isolation for threads, run with WebGL 2 / Compatibility renderer constraints, and give no raw UDP. Pick one primary target; the other becomes a stretch target.

## 2. Player count and server model

- **Master spec §12.2, §19:** host-authoritative listen servers; 12–16 combatants baseline.
- **CHARACTERS_BOTS §10, §13, §14:** 32 player slots, dedicated authoritative servers, plus ~64 active NPCs.

This sets the networking budget, the bot tick budget, and hosting costs. A suggested reconciliation: ship listen servers at 16 slots for the vertical slice, and keep gameplay authority isolated so dedicated servers and 32 slots can follow (master spec §12.2 already asks for this).

## 3. "MapMaker" vs "Scenario Maker"

The master spec describes a MapMaker with a Simple/Advanced logic editor (§8.8). CHARACTERS_BOTS refers to a "Scenario Maker" with a WHEN → IF → DO trigger system, NPC squads, bosses, and factions (§16, §24, §25). Decide whether these are the same tool or whether the Scenario Maker is a later layer on top of the MapMaker. Either way, NPCs, factions, and squads are not in the master spec's phases.

## 4. Roster size at vertical slice

- **Master spec §21 Phase 1:** no character count; Phase 2 says 20+; Phase 4 says 30–50.
- **CHARACTERS_BOTS §9, §34:** 12 for the prototype and 24–32 for the vertical slice.

The CHARACTERS_BOTS slice target is far above the master spec's Phase 1 scope, which is 4 weapons and 1 theme. Suggest the master spec's slice uses the 12-character prototype set.

## 5. Theme lists

The environment themes (master spec §8.6, e.g. "Egyptian tomb", "space station") and the character theme families (CHARACTERS_BOTS §6, e.g. "Victorian Macabre", "Retro Space Resort") are separate lists that only partly overlap. Decide whether map themes and character worlds share one taxonomy.

## 6. Bot personality fields

The master spec §7.4 and CHARACTERS_BOTS §29 `BotProfile` list overlapping but different dimensions. Treat CHARACTERS_BOTS §29 as the canonical schema, with difficulty modifiers kept separate (§12).

## 7. Repository document set

Master spec §24 lists 15 sub-docs (`GAME_DESIGN.md`, `MAPMAKER.md`, `MAP_FORMAT.md`, …). Only the master spec and the characters/bots doc exist so far. `CHARACTERS_BOTS.md` covers most of what `BOTS_AI.md` and `CHARACTER_ART.md` would hold.
