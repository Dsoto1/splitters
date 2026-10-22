# splitters — Project ChronoSplit (working title)

An original browser-first arcade FPS and community creation platform with a built-in MapMaker (grid construction through scripted co-op scenarios), full Player Bots, scenario NPCs, and a deliberately chaotic cross-era character roster. Inspired by the design lessons of classic console arena shooters; uses no proprietary assets, names, or content.

**Status:** pre-production (spec pack v2). No code yet.
**Stack direction:** TypeScript + Babylon.js client (WebGPU, WebGL2 fallback); headless dedicated authoritative server.

## Documents

`MASTER_SPEC_V2.md` is authoritative; supporting docs lose on conflict. Recommended reading order:

1. [`docs/MASTER_SPEC_V2.md`](docs/MASTER_SPEC_V2.md) — product definition, platform, combatant model, vertical-slice scope, phases, engineering rules
2. [`docs/TECH_ARCHITECTURE.md`](docs/TECH_ARCHITECTURE.md) — client/server split, data formats, safe logic, networking, security, testing gates
3. [`docs/MAPMAKER_SCENARIO.md`](docs/MAPMAKER_SCENARIO.md) — workspaces, construction layers, logic, factions/encounters/squads, validation
4. [`docs/MULTIPLAYER_AI_SCALE.md`](docs/MULTIPLAYER_AI_SCALE.md) — 32-slot architecture, NPC scaling, interest management, load-test ladder
5. [`docs/CHARACTERS_BOTS_V2.md`](docs/CHARACTERS_BOTS_V2.md) — roster, originality guardrails, bot personalities, NPC reuse

Also:

- [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md) — remaining inconsistencies in the v2 pack
- [`docs/archive/MASTER_SPEC_V1.md`](docs/archive/MASTER_SPEC_V1.md) — superseded v1 master spec, kept for detail v2 doesn't yet cover

## First loop to prove

> Open browser → build room → place gun/enemy/door → attach trigger/objective → Test → fight → return to editor → change → Test again.
