# PROJECT CHRONOSPLIT — TECH ARCHITECTURE v1

**Authority:** Supporting spec; `MASTER_SPEC_V2.md` wins on conflict.

## Client
TypeScript browser application. Babylon.js is the current rendering/scene-engine direction; WebGPU preferred where supported with WebGL2 fallback. Keep game simulation interfaces decoupled enough to replace rendering details without rewriting content formats.

Client modules: rendering, input, audio, animation, HUD/menu/editor UI, prediction/interpolation, map preview/test bridge, asset streaming/cache, telemetry/profiling.

## Dedicated authoritative server
Headless runtime owns authoritative gameplay. Do not require Babylon/DOM/WebGPU. Share pure TypeScript/data modules where deterministic/appropriate, but do not force identical client/server runtimes if a server-specific implementation is better.

Server modules: sessions, simulation tick, entities, movement validation, weapons/damage, pickups, factions, objectives, logic VM/interpreter, AI, navigation queries, encounters/reinforcements, replication, persistence hooks, moderation/security hooks.

## Data formats
All user content is versioned and schema-validated. Stable IDs rather than array positions. Maps reference asset IDs and packages/dependencies. Maintain migration functions between format versions.

Core map domains: metadata, classicStructure, advancedStructure, terrain, props, gameplay, entities, factions, objectives, logic, world, dependencies, legacyMetadata.

## Safe creator logic
Logic is declarative data interpreted by the server/runtime. Do not execute arbitrary uploaded JavaScript. Apply operation budgets, reference validation and recursion/loop safeguards.

## Navigation
Generated from structural/terrain geometry where feasible. Support dynamic obstacle/door state and authored hints only when generation cannot infer behavior. Editor debug view must expose failures.

## Networking
Architect 32 player slots. Use snapshots/deltas as selected after prototype measurement, client prediction for local movement, interpolation for remote actors, and interest management based on spatial relevance/room/portal information where useful.

NPC replication may be lower-frequency or simplified at distance. Cosmetic simulation is client-side when authority is unnecessary.

## Performance budgets
Measure CPU simulation, server tick, bandwidth/player, draw calls, triangles, animation cost, AI perception/tactics, active projectiles, dynamic lights, physics bodies and memory. MapMaker surfaces creator-facing budget categories.

## Browser delivery
Use code splitting, compressed assets, progressive downloads, cache/version hashes and lazy character/theme loading. Joining a map should download only required dependencies.

## Security
Treat community map data and client claims as untrusted. Validate schemas, IDs, bounds, actions, rates and authoritative gameplay outcomes. Sanitize user-facing text/content according to platform policy.

## Testing gates
Automated tests for serialization/migrations, logic conditions/actions, weapon/damage rules, faction relationships, objective state, map validation and protocol compatibility. Load harness simulates staged player/NPC counts independent of visual clients where possible.
