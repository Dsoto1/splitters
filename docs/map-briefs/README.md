# Map briefs from the owner

Design briefs and approved overhead reference images for new maps. The images are concept art: they set the
layout, landmarks and mood, not coordinates or scale. Each map is built in MapMaker (CLAUDE.md, "Maps"); its
build notes (manifest, QA report, decisions and deviations) go in `docs/map-briefs/<map id>/` when it is built.

| Brief | Reference | Map | Status |
|---|---|---|---|
| BUILD_01_Sunken_Kingdom.md | sunken_kingdom_reference.jpg | `maps/sunken_kingdom.json` | built and merged (2026-10-30); docs in `sunken_kingdom/`; three questions for the owner (dome, tier height, bot CTF) in its DECISIONS_AND_DEVIATIONS.md |
| BUILD_06_Iron_Maw.md | iron_maw_reference.jpg | `maps/iron_maw.json` | built and merged (2026-10-30); notes in `iron_maw/`; uses the owner's Meshy excavator, haul truck and cargo props; questions: player-count cap (schema 16–32), an orange rock material |
| (Style Pack 09 Desert City demo; owner's Desert City tileset sheet) | n/a | `maps/qasr_medina.json` | built on `wip/desert-city-pack` (2026-10-31); notes in `qasr_medina/`; the minaret is a landmark (not climbed) |
| (Style Pack 10 demo; owner's Medieval Village tileset sheet) | n/a | `maps/market_town.json` | built on `wip/medieval-pack` (2026-10-31); notes in `market_town/`; bots don't reach the belfry or the NW watchtower lookout |

`AGENT_BUILD_CONTRACT.md` (the owner's, v1.0) applies to every map, with these repo adaptations:
- The map file stays `maps/<id>.json` (the game loads maps from there; CLAUDE.md "Maps"). The contract's
  per-map documents and screenshots go in `docs/map-briefs/<id>/` instead of `maps/<slug>/`.
- `DISCOVERY_REPORT.md` is shared by all maps: `docs/map-briefs/DISCOVERY_REPORT.md`.
- Checks that can't run here (e.g. 96 players on a CPU-rendered container) are recorded as NOT TESTED, never PASS.
