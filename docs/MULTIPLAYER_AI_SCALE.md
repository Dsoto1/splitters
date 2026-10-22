# PROJECT CHRONOSPLIT — MULTIPLAYER & AI SCALE v1

**Authority:** Supporting spec; `MASTER_SPEC_V2.md` wins on conflict.

## Population model
- Maximum architecture: 32 player slots (human or full Player Bot).
- NPC Combatants are separate.
- Long-term validated target: approximately 64 active NPCs on suitable hardware, with larger dormant/reinforcement pools.

## Validation ladder
Player load: 2 -> 8 vertical slice -> 16 -> 24 -> 32.  
NPC load: 8 -> 16 -> 32 -> 64 target.  
Mixed tests matter more than isolated maxima: e.g. 32 player slots + 32 NPCs, then higher NPC counts.

A failed upper test reduces exposed limits or triggers optimization; it does not invalidate the architecture.

## Player Bots
Occupy player slots and follow player rules. Personality is separate from skill. Core decisions: objective, target/threat, weapon/pickup need, route, combat behavior. Bots should play community maps without manually authored waypoint networks for ordinary geometry.

## NPC Combatants
Cheaper scenario AI. Use roles/orders, local perception, squad goals, staggered think rates, relevance-based updates and dormant states. They need not evaluate every pickup/objective in the entire map like a Player Bot.

## Squads
Squad brain chooses high-level target/order; members solve local movement, cover/spacing/combat. This is both a design feature and a scaling strategy.

## Interest management
Prioritize entities by spatial/portal relevance, visibility/proximity, combat interaction, objective importance and audio/event relevance. Distant entities receive reduced state; clients do not need full-rate transforms for every actor.

## Reinforcement pools
A scenario can define 100+ tickets per faction while limiting active NPCs. Safe spawn selection considers enemy proximity, objective/frontline state, blocked spawn points and creator restrictions.

## 16v16 + armies example
16 Red player slots + 16 Blue player slots are the competitive population. Each faction may additionally field NPC squads. NPC scoring/objective participation is configurable. This supports a conventional 16v16 TDM or a larger battlefield using the same faction primitives.

## Co-op example
1–32 player slots share a scenario against encounters whose active count/composition can scale by player count/difficulty. Do not merely multiply health; scale composition, reinforcement timing and simultaneous threats where appropriate.

## Server AI cadence
Movement/simulation may update at simulation rate while expensive perception/tactical decisions are staggered/lower frequency. Exact Hz values must come from profiling rather than this design document.

## Test telemetry
Capture server frame/tick time, AI time by subsystem, bandwidth/client, snapshot sizes, correction rates, active actors/projectiles, path query time, navigation failures, client FPS/GPU/CPU, animation cost and memory.
