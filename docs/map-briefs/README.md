# Map briefs from the owner

Design briefs and approved overhead reference images for new maps. The images are concept art: they set the
layout, landmarks and mood, not coordinates or scale. Each map is built in MapMaker (CLAUDE.md, "Maps"); its
build notes (manifest, QA report, decisions and deviations) go in `docs/map-briefs/<map id>/` when it is built.

| Brief | Reference | Map | Status |
|---|---|---|---|
| BUILD_01_Sunken_Kingdom.md | sunken_kingdom_reference.jpg | `maps/sunken_kingdom.json` | built on `wip/sunken-kingdom` (2026-10-30), not merged; docs in `sunken_kingdom/`; three questions for the owner (dome, tier height, bot CTF) in its DECISIONS_AND_DEVIATIONS.md |
| BUILD_06_Iron_Maw.md | iron_maw_reference.jpg | `maps/iron_maw.json` | building (2026-10-30); Meshy landmarks (bucket-wheel excavator, haul truck) await the owner's approval |

`AGENT_BUILD_CONTRACT.md` (the owner's, v1.0) applies to every map, with these repo adaptations:
- The map file stays `maps/<id>.json` (the game loads maps from there; CLAUDE.md "Maps"). The contract's
  per-map documents and screenshots go in `docs/map-briefs/<id>/` instead of `maps/<slug>/`.
- `DISCOVERY_REPORT.md` is shared by all maps: `docs/map-briefs/DISCOVERY_REPORT.md`.
- Checks that can't run here (e.g. 96 players on a CPU-rendered container) are recorded as NOT TESTED, never PASS.
