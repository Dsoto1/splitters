# Bot AI: logic and navigation plan (owner-approved queue item, 2026-11-06)

The owner reported three bot problems:
- **CTF:** "no bots are actually going for the flag, most just hang out and do little."
- **Diamond Park:** most of the team hung out in the tunnel and dugout area.
- **Fernwood Moon:** "why would some bots not be moving at all?"

The current fix (`wip/bots-idle`, HANDOFF "Queued FIRST: CTF bots don't go for the flag") deals with the worst
symptoms. This plan covers bot logic and navigation as a whole. docs/BOTS.md describes how bots work today, as built.

## The owner's decisions (2026-11-06)
- **Queue:**
  - **Phase A** (navigation audit, never stand still, the scorecard) starts right after `wip/bots-idle` lands,
    alongside set pieces (different code).
  - **Phase B** (scored choices, team brain, mode playbooks) comes next, before MAP 21. The beach assault needs bots
    that attack well.
  - **Phases C and D** follow.
- **CTF roles** (2026-11-05):
  - 2–3 defenders per team: 2 for small teams, 3 for 12+.
  - Everyone else attacks.
  - A carrier gets escorts.
  - Anyone near their own flag when it's in trouble responds.
- **Standing still:** a bot stands still only when it's deliberately holding a spot, and then it looks alive.
- **Performance:** this must not cost the game its frame rate (see "Performance").

## Where it stands (main 5739da41)

### Navigation
- **The navmesh:** built by Recast/Detour from the map's boxes and terrain at load (`nav/index.ts` `NavWorld`).
  - Cells are 0.2 m. The agent is the player's height and step, with the player's radius + 0.2 m.
  - A search can use up to 65,535 nodes.
- **Links** (`sim/movement.ts` `navLinks`):
  - jump pads, ladders, portals and ziplines;
  - lifts, which the brain handles itself (`liftWait`).
  - **No links** for dropping off a ledge higher than a step, jumping a gap or jumping up onto a ledge. A bot on a
    raised slab without stairs has no route off it.
- **The mesh is fixed for the match.**
  - The brain handles doors that a button opens (`pathBlocked`, `planPress`).
  - Other moving things are not in the routes: breakable and crumbling blocks, trapdoors, movers, Forts builds.
- **A failed search** backs the bot off for 0.2 s, doubling up to 4 s (`brain.ts` `followPathNow`). The bot stands
  still meanwhile.
- **`validateNavigation`** gives warnings for:
  - spawns that aren't on the mesh;
  - spawns and objectives that can't be reached from the **first** spawn.

  It doesn't check places bots can get into but not out of.

### Logic
- **Per bot,** a state machine (`bots/brain.ts`, about 2,700 lines): roam, advance, engage, cover, chase,
  investigate, retreat, hold, mount, mounted.
- **Per side, once a second,** the director (`bots/director.ts`) runs squad plans, regions, vantage spots and roles
  (camper, sniper, lone wolf, squad; docs/BOTS.md).
- **Per mode,** goals from `sim/modes/*Bots.ts` arrive as `orderGoal`, and the brain follows them only while
  roaming. Fights, noises, cover, posts and pickups all outrank the objective.

## First measurements
Diamond Park CTF, 24 bots, 180 s, seed 1 (`pnpm bot-report`, `wip/bots-idle` 0943e6bf):

| Measure | Value |
|---|---|
| Flag takes / captures | 0 / 0 |
| Path searches failed | 686 of 2,188 in 60 s (31 %) |
| Idle, of alive time | 29 %: no route 17.8 %, station 4.1 %, cover 3.0 % |
| Doing, of alive time | investigate 22.4 %, cover 20.2 %, going to the goal 9.3 % |
| Stuck recoveries | 88 |
| Longest idle spell | 100 s (five attackers by (15, 0, -16)) |

The current fix's before and after numbers go here when it lands.

## Rules that frame the design
- **One sim.** Bots run in the shared sim (`packages/shared`). It is the same code on the dedicated server and in a
  browser host's match worker.
- **Deterministic by seed.** The bench, the tests and `?test=1` depend on it.
- **The performance rule** (docs/BOTS.md): nothing new runs per bot per tick that isn't a couple of comparisons.
  - Team decisions run once a second per side.
  - Anything heavy runs at match start or is cached per map.
- **Maps are declarative data.** Bot hints placed in MapMaker are map data, with no scripts.
- **Measure first, prove with numbers.** Every phase lands with a before and after scorecard and
  `pnpm bench:96:clump`.

## Phase A: navigation audit, never stand still, the scorecard
Starts right after `wip/bots-idle` lands, alongside set pieces.

1. **The scorecard:** `pnpm bot-report` over every mode and its maps, several seeds.
   - **Per mode:**
     - CTF: takes, captures and returns;
     - King of the Hill: hill time held and contested;
     - Bomb: plants and defuses;
     - Hostage: rescues;
     - Elimination: round time;
     - Forts: pieces built.
   - **In every mode:**
     - idle time by reason;
     - failed searches and stuck recoveries;
     - time spent heading to the goal;
     - coverage, spawn deaths, kills a minute;
     - bot think ms.
   - **Limits** live in a checked-in file, like the perf budgets. A nightly CI job runs it, and so does
     `pnpm bot-report --check` locally. A change that makes bots worse fails.
2. **The navigation audit,** in the headless all-maps test and in validate-map.
   - Build the mesh and its links, find its islands, and work out what's reachable from every polygon, not just the
     first spawn.
   - **Traps:** places a bot can get into (falling, a one-way link) but can't walk out of.
   - **Cut off:** objectives, spawns and pickups that no spawn can reach.
   - **A picture per map** in the CI artifacts, showing traps and the spots where searches failed in the scorecard
     runs.
   - Errors on official maps, warnings for creators in MapMaker.
3. **Never stand still on a failed route.**
   - Walk a partial path (Detour's partial result) toward the goal, then search again.
   - Move a goal that's off the mesh (a flag on a prop, a pickup on a crate) to the nearest reachable point.
   - A bot that's off the mesh (pushed, fallen, spawned badly) walks to the nearest polygon first.
   - If a goal can't be reached at all, pick the next best goal for the bot's role at once, with no back-off spell.
     Remember unreachable goals, per island, for the rest of the match.

**Done when:**
- no official map has a cut-off objective or a trap;
- on the CTF suite, failed searches are under 2 % and no-route idle is under 1 %;
- the scorecard runs nightly.

## Phase B: bot logic (before MAP 21)
1. **Scored choices.**
   - Today the state machine picks by rules. Instead, each think, the bot scores its options:
     - the mode objective for its role;
     - fighting what it sees;
     - cover;
     - a pickup it needs;
     - a noise;
     - the leader's order;
     - its post.
   - The scores weigh role, mode, health, ammo, distance, team state and personality (CHARACTERS_BOTS_V2 §11). A
     margin keeps bots from dithering between options.
   - The states stay as the "how" (moving, fighting, taking cover). The scores pick the "what".
   - So a CTF attacker fights on its way to the flag and turns back to it after the fight, instead of wandering off
     after sounds.
2. **A team brain per mode** (the director).
   - **Roles from the objective:** defenders, attackers, escorts, flankers, interceptors.
   - **Group pushes:** regroup at a staging spot, then go together.
   - **Reactions to events:**
     - flag taken → interceptors;
     - a carrier → escorts;
     - hill lost → retake it.
   - A human leader's orders win.
3. **Playbooks per mode:** CTF, King of the Hill, Bomb, Hostage, Elimination, Forts, co-op and zombies, the vehicle
   modes.
   - Where possible they are data: role shares, staging distances, timings.

**Done when:**
- the scorecard shows regular captures on every CTF map, hills contested and held, bombs planted and defused, and
  hostages rescued;
- the owner playtests it.

## Phase C: navigation depth
1. **Links for every move a player can make,** generated at load from the geometry and checked against the real
   movement code (`sim/movement.ts`): ledge drops (one-way), gap jumps, jumps up onto a ledge within reach, and rope
   lifts. A move players don't have (vaults, mantles) needs the movement first.
2. **Moving obstacles change the routes:** doors, breakable and crumbling blocks, trapdoors, movers, Forts builds.
   - Use a tiled navmesh with obstacles (Detour's tile cache), or route costs.
   - Rebuild a few tiles at a time, within a budget.
3. **Crowds:** bots steer round each other in tunnels, doorways and on stairs, using local avoidance on the existing
   spatial grid. This should cut stuck recoveries.
4. **Smarter routes:**
   - area costs that prefer cover and avoid spots where teammates died recently, updated once a second per side;
   - several route choices for flanks;
   - a cache for common trips (spawn → objective);
   - a per-tick search budget for 48 v 48 and the huge maps.

**Done when:**
- stuck recoveries halve;
- bots use drops, jumps and doors as players do;
- no bot is frozen by a closed door or a broken bridge.

## Phase D: polish and tools
1. **Memory:**
   - last-known enemy spots kept for a while;
   - where shots came from;
   - callouts shared with the team (a teammate's sighting reaches the squad).
2. **Holding looks alive:** scanning, shifting and peeking at a held spot.
3. **Skill tiers that feel human:** reaction time, aim and decision quality by difficulty (easy, normal, hard), not
   only aim error.
4. **Bot debug view in game:** `?botdebug=1`, host or offline only.
   - Each bot's path, state, goal, scores and why it stopped.
   - Failed-search spots on the map.
5. **Bot hints in MapMaker:** chokepoints, sniper and camp spots, staging spots, jump links.
   - They are map data. The computed ones stay the default.

## Performance
**Where bots run.** In the shared sim: on the dedicated server, or in the host's match worker. The page's own thread
spends nothing on them (docs/PERF_96.md). Rendering, not bots, is what limits frame rate today.

**Today's cost**, against a 16.7 ms tick:

| Case | Bot thinking a tick | Whole sim tick |
|---|---|---|
| Diamond Park, 24 bots | 0.7 ms | 1.8 ms |
| 96 bots (PERF_96.md, "Bot behaviour pass") | 1.0–1.8 ms | 2–3 ms median, 6–8 ms p95 (clumped 48 v 48, in its worker) |

**Cost of each part:**
- **None at play time:**
  - the audit and the scorecard run offline and in CI;
  - the debug view is off unless asked for.
- **A saving:** fewer failed searches. A failed search explores everything it can reach before it gives up.
- **Load time only:** links are built at load. They add a little load time and nothing per tick.
- **Small:**
  - scored choices: a few multiplications per option per think, within the existing think budget;
  - team brain: once a second per side;
  - crowd steering: neighbour checks on the existing grid.
- **Real cost:** moving obstacles and route costs. They are budgeted (a few tiles rebuilt at a time, costs updated
  once a second) and measured. A tiled navmesh also takes more memory; measure it on the huge maps.
- **Behaviour changes:**
  - bots that move instead of standing still cost a little more character movement, the biggest sim cost at 96
    players;
  - bots that spread out instead of clumping cost less thinking (it doubles in a clump).

**The guard.** Every phase lands with `pnpm bench:96:clump` before and after, and the perf CI budget. Bot thinking at
96 bots stays within 2.5 ms a tick (today 1.0–1.8 ms).
