# Verdant Protocol: QA report (2026-11-10)

Numbers in MAP_IMPLEMENTATION_MANIFEST.md, "QA". Screenshots in `screenshots/` (MapMaker's card-shot frame at eye
level, 1.55-1.7 m over the floor, except the cabin, the ward, the gully and the tower lookout at their own heights; the
plan view's Export PNG).

| Check | Result |
|---|---|
| Saved in the real format (MapMaker's Export), loads with no warnings or lost objects | **PASS** (validate-map 0 issues) |
| Validation incl. navigation | **PASS** (`pnpm validate-map maps/verdant_protocol.json`: OK, 0 issues) |
| Landmarks identifiable overhead and at eye level | **PASS** (`plan-export.jpg`; `eye-command`, `eye-greenhouse*`, `eye-crash*`, `eye-watchpost`, `eye-overlook_from_watchpost`, `eye-bunker_yard`, `eye-bunker_ward`) |
| Routes read at eye level | **PASS** (`eye-route_*`: west and south footpaths, perimeter road, knoll ramp, plateau stairs, gully) |
| Underground route has real entrances and exits | **PASS** (both stair huts; navigation both ways in `verdantProtocol.test.ts`) |
| Z-fighting | **PASS** (`zfight.test.ts`, map and props: 0) |
| Spawns not in geometry or hazards; spawn kills | **PASS** (validate-map; spawn deaths TDM 0 %, CTF 2.3 %, bench 2.9 %) |
| Bots reach the goals | **PASS** (bot-report: no route 0 % in TDM, CTF and KotH; 0 nav traps) |
| Bot matches at the target count (32) | **PASS** (TDM, CTF, KotH, 150 s each) |
| Performance | **PASS** server tick (bench, 32 bots: avg 4.8 ms, p95 9.4 ms of 16.7); client frame time NOT TESTED (SwiftShader here) |
| Budgets | **PASS** (entities 2,102 of 4,096; 944 collision boxes; 40 of 80 prop models; 17 lights of 256) |
| Reduce flashing | **PASS** (the bunker's lights are steady; nothing blinks) |
| Manual walk-through on a real GPU | **NOT TESTED** |
