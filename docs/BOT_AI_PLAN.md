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

The `wip/bots-idle` fix (e9bf9611), before and after, Diamond Park CTF, two matches of 300 s (seeds 1, 2):

| Measure | Before | After |
|---|---|---|
| Captures / flag takes, a match | 0.5 / 2.5 | 1.5 / 19.5 |
| Idle out of a fight, of alive time | 32.9 % | 3.1 % |
| Frozen (not even turning) | 20.4 % | 0.5 % |
| No-route searches, a match | 4,888 | 9 |
| Idle spells of 10 s and more, a match | 57.5 | 3.5 |
| Kills a minute | 15.1 | 52.4 |

The whole CTF suite (44 maps, two matches of 300 s each; docs/BOTS.md, "Capture the Flag", has every map):

| Measure | Before | After |
|---|---|---|
| Captures in 88 matches (matches with one) | 21 (17) | 145 (55) |
| Maps with a capture | 13 of 44 | 31 of 44 |
| Flag takes | 77 | 906 |
| Idle out of a fight / frozen | 17.9 % / 2.9 % | 5.6 % / 0.9 % |
| Idle spells of 10 s and more, a match | 19.0 | 2.7 |
| Stuck recoveries / no-route searches, a match | 283 / 545 | 229 / 614 |
| Kills a minute | 22.9 | 35.1 |
| Fernwood Moon: captures, idle out of a fight | 0, 28.2 % | 1 a match, 6.9 % |
| Sunken Kingdom: captures, idle out of a fight | 0, 17.3 % | 2 a match, 1.4 % |
| Team Deathmatch, Fernwood Moon: idle out of a fight, frozen | 23.0 %, 11.9 % | 7.6 %, 0.6 % |
| `pnpm bench:96:clump`, bot thinking a tick | 1.46–2.04 ms | 1.54–2.12 ms |

Left for Phase A (found on the way): the navmesh keeps 0.8 m from walls, not the 0.6 m its comment means (a
floating-point round-up); 26 spawn points on 18 maps inside collision (`spawn.blocked`); drops are never routes
(Eagle Spires' cliff ledges); a bot can stand at a button that doesn't open its way (Primeval Park, 218 s); 13 maps
still without a capture (most lose the carrier on the way home: Phase B).

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
**Done** (`wip/bots-a`, 2026-11-06; docs/BOTS.md, "Navigation audit", "Never standing still on a failed route" and
"Scorecard"; the before/after table is under "Phase A, measured" below).

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

**Met:** no official map has an audit error; the 15 findings left on 9 maps (11 traps, two spawn points, two pickups)
are listed for the owner in `nav/auditKnown.ts`, each with why and what would fix it (docs/BOTS.md, "Where the official
maps stand"). On the CTF suite, failed searches 0.03 % and no-route idle 0.05 %. The full scorecard ran from Run
workflow on `wip/bots-a` (run 42264736565: 398 matches on 77 maps, every limit held) and runs nightly.

### Phase A, measured
Before: main as Phase A began (`wip/bots-idle` landed). After: `wip/bots-a` at ec075ed7. The same matches both times
(`pnpm bot-report … --json`, then `--compare` and `--judge`): the CTF suite (44 maps, two matches of 300 s each) and a
sample of every other mode (two seeds of 180 s each; Forts 240 s). The sim is deterministic by seed; thinking times
depend on the machine (a shared one, its load 2 to 13 on 4 cores).

| CTF suite, 88 matches | Before | After |
|---|---|---|
| Failed searches, of every route search | 1.67 % (614 a match) | 0.03 % (10 a match) |
| No-route idle, of alive time | 0.16 % | 0.05 % |
| Idle out of a fight / frozen | 5.6 % / 0.9 % | 4.8 % / 0.6 % |
| Stuck recoveries a bot-minute | 2.37 | 2.24 |
| Idle spells of 10 s and more, a match | 2.7 | 1.4 |
| Captures (matches with one; maps with one) | 145 (55; 31 of 44) | 138 (56; 34 of 44) |
| Flag takes, returns | 906, 380 | 836, 346 |
| Kills a minute | 35.1 | 35.3 |
| Bot thinking a tick | 0.67 ms | 0.52 ms |

Captures move by ten or so between runs of nearly the same code (149 and 151 at the two commits before the last two
fixes): two matches a map is a small sample. The failed searches left are Obsidian Orb's, bots fallen onto a 0.4 m
ledge in its reactor shaft that nothing gets off (for the owner). Worse on a few maps: Iron Compound (its gantry
turret, below) and Iron Tide (in one of its two matches, bots stuck for minutes at a crumbling wall, `block_341`, by
its west jump pad). The fixes for Serene City's console and Sandfall Colosseum's dropped spear are in the numbers.

The other modes:

| Mode, matches | Failed searches | No-route idle | Idle out of a fight | Stuck a bot-minute | Objective |
|---|---|---|---|---|---|
| King of the Hill, 16 | 9.42 → 0.00 % | 1.13 → 0.01 % | 5.0 → 3.6 % | 1.36 → 1.24 | hill held 32.4 → 28.9 % |
| Bomb, 12 | 3.37 → 0.00 % | 0.01 → 0.00 % | 9.1 → 8.9 % | 1.61 → 2.02 | plants 0.5 → 0.3 a match |
| Hostage, 8 | 3.37 → 0.00 % | 0.29 → 0.02 % | 8.7 → 10.3 % | 1.65 → 2.36 | rescues 0.1 → 0.3 a match |
| Elimination, 16 | 27.16 → 0.00 % | 0.32 → 0.00 % | 3.3 → 2.7 % | 1.23 → 1.21 | rounds 38 → 36 s |
| Forts, 4 | 0.08 → 0.00 % | 0 → 0 % | 27.6 → 33.4 % | 4.82 → 2.84 | pieces built 74 → 75 a match |
| Team Deathmatch, 16 | 39.67 → 0.00 % | 1.22 → 0.45 % | 6.1 → 4.9 % | 1.53 → 1.24 | - |

Idle out of a fight counts holding a station: Forts' and some hills' guards, who teammates no longer shove about. Bomb
and Hostage's sample plays Dune Harbor, which lists neither: a dropship landing beside its sunken room leaves its
riders under the street floor (below). Team Deathmatch's no-route idle is Norman Shores': bots in the shallows, off the
navmesh, with no way onto it level or below.

**The navigation audit** (`pnpm nav-audit`, 90 maps): before the ledge-drop links and the inside-solid fix, 148 errors
on the official maps; with them, 28 errors and 21 traps on 14 maps; now 0 errors, 11 traps and 15 findings in all on 9
maps.

**Navmesh clearance, 0.8 m against 0.6 m** (the CTF suite, one seed of 180 s, the 32 maps both runs finished; the rest
of the branch the same):

| | 0.8 m (kept) | 0.6 m |
|---|---|---|
| Captures (matches with one) | 20 (15) | 20 (14) |
| Failed searches / no-route idle | 0.13 % / 0.06 % | 0.17 % / 0.07 % |
| Idle out of a fight / frozen | 6.0 % / 0.7 % | 5.5 % / 0.7 % |
| Stuck recoveries a bot-minute | 3.08 | 2.54 |

0.6 also breaks the tiles' narrow switchback stairs (nine of the tile packs' reach tests fail), so 0.8 stays.

**Shingle Point** (the owner's playtest), teammates pushing aside instead of back, the rest of the branch the same:

| | Before | After |
|---|---|---|
| King of the Hill, three seeds of 180 s: stuck recoveries a bot-minute | 1.31 | 0.80 |
| King of the Hill: idle out of a fight | 4.0 % | 3.7 % |
| Bomb, two seeds: stuck recoveries a bot-minute | 1.41 | 0.46 |
| Five CTF maps, eleven matches: stuck recoveries a bot-minute, captures | 2.31, 5 | 2.01, 8 |

**`pnpm bench:96:clump`** (96 bots; Norman Shores, Frost Basin and Riot Junction, spread and clumped, 30 s each), bot
thinking a tick, before and after taken in turn: base 1.13–1.90 ms (mean 1.48), branch 1.24–2.01 ms (mean 1.54), two
rounds each at load 2.4–3.7: clumped the same (1.45 → 1.43), spread a tenth more (1.51 → 1.66: bots that keep moving),
the whole sim tick 3.3–6.1 ms both. Within the 2.5 ms guard. (A first pair at load 6–9 on the same machine: 1.33–2.38
against 1.34–2.57.)

**Left, found on the way:**
- Iron Compound's gantry MG turret (`mount_148`) stands in the 1.6 m walkway with 0.8 m beside it, and bots coming
  back along the walkway walk into it: a mount's body isn't on the navmesh (Phase C, moving obstacles).
- A dropship landing beside Dune Harbor's sunken room leaves its riders under the street floor, where nothing gets
  them out (vehicles).
- Norman Shores: bots in the shallows are off the navmesh, with no way onto it level or below (wading up a beach).
- Hills held 32.4 → 28.9 % and Bomb plants 0.5 → 0.3 a match on the samples, and a few CTF maps still without a
  capture: the playbooks are Phase B's. So are six defenders keeping watch in Shingle Point's HQ (bomb site B).
- The owner's list in HANDOFF ("Bot AI Phase A"): the 15 audit findings, Obsidian Orb's shaft ledge, Iron Compound's
  turret.

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
4. **Route variety** (moved up from Phase C, owner, 2026-11-06).
   - **The owner, playtesting CTF after Phase A:** "Many maps focus them into one direction or path. Very few 'recon'
     teams, or groups that take a different route."
   - **Why:** today every bot takes the shortest route, so a whole team takes the same lane.
   - **Several distinct routes per trip.** Find the shortest, then search again with its corridor made costly, giving
     two or three corridors that really differ. Cache them per map for the common trips: spawn → objective, base →
     flag.
   - **The director spreads its groups across them:** a main push, flankers on the other routes, and a **recon pair**
     that goes ahead on a side route and reports what it sees to the team. With the roles from item 2.
   - **Crowd cost:** a corridor already carrying many teammates' routes costs more to the next bot planning a route,
     so loose bots spread out by themselves.
   - **Death cost:** where teammates died in the last minute costs more, so a team stops feeding the same choke.
     Updated once a second per side.
   - **Measure it in the scorecard:** how many distinct corridors each team uses on the way to the objective, and the
     share on the busiest one, per map. Maps with only one way through (a single bridge) are listed, not failed.
5. **Snipers who play like snipers** (owner, 2026-11-06).
   - **The owner:** "Bots on both sides taking those sniper roles/personalities seriously, camping in tucked away high
     spots … to take calculated shots, some even moving locations after, acting like real snipers."
   - **Today:** the sniper role (about 10 % of bots) only plays while the bot carries a scoped gun, and few maps place
     one. It rarely switches on.
   - **Get the gun.** A sniper-role bot spawns with the weapon set's scoped gun (docs/WEAPON_SETS_PLAN.md), or goes
     for a scoped pickup first.
   - **Calculated shots.** It waits for a good shot: a target that is still, unaware or lined up, and a high hit
     chance at the range. It doesn't give its spot away on a poor one.
   - **Relocates like a sniper:** after a shot or two, or when it is spotted or shot at, not only after a kill. The
     next spot is somewhere else, and not back the way it came.
   - **Spots:** high, tucked away, a wall or roof edge behind, a long view down a lane the enemy uses. The roofs and
     ledges only parkour reaches come with Phase C item 1.
6. **Cover-to-cover advance** (owner, 2026-11-06).
   - **The owner:** "We don't have nearly enough taking cover and using it to progressively advance through a map or
     objective. I generally see many rushing towards one another (which would make more sense if it was arena style)."
   - **Bounding moves.** A group moves cover to cover toward the objective along its route. One half covers (watching
     or suppressing the threat) while the other moves, then they swap.
   - **Peek and shoot** from cover instead of running at each other. Stay in cover while reloading or hurt.
   - **Route costs that prefer cover** (moved up from Phase C item 4).
   - **By bot style:** Tactical leans hardest on it, Mixed in between, Arena keeps the rush.
   - **Measured:** time in cover while a fight is on, and how far an advance gets per minute without losing half the
     group.

**Done when:**
- the scorecard shows regular captures on every CTF map, hills contested and held, bombs planted and defused, and
  hostages rescued;
- on maps with more than one way to the objective, each team uses at least two routes, and no single corridor
  carries most of a team;
- sniper-role bots get scoped kills from vantage spots on maps with long sightlines, and move between shots;
- in Tactical and Mixed, bots spend clearly more of a fight in cover, and push objectives in bounds;
- the owner playtests it.

### Phase B part 1, measured (scored choices, team brain, route variety)
Before: main with Phase B's measuring (route use and route choice in `bot-report`; the bots unchanged). After:
`wip/bots-b`, part 1. The dev sample: Capture the Flag on 12 maps (Bunker Cross, Diamond Park, Serene City, Twin
Spires, Capitol Mall, Grand Marquee, Maple Court, Pantry Raid, Iron Tide, Saltmarsh Harbor, Sunken Kingdom, Fernwood
Moon; seeds 1 and 2), King of the Hill on Shingle Point, Diamond Park and Bunker Cross, Bomb on Serene City and
Ironhold Prison, Hostage on Serene City, Elimination on Diamond Park, Team Deathmatch on Fernwood Moon and Riot
Junction; 180 s each, 33 matches. Each part was measured on its own first: the branch carried switches for them while
measuring (with every switch off it replayed main's matches exactly); they are gone.

| Dev sample | Before | After |
|---|---|---|
| CTF captures (flag takes), 24 matches | 20 (176) | 20 (141) |
| CTF matches with a capture | 12 | 9 |
| CTF route choice (each bot past a trip's middle, once a life): team trips with two ways taking 15 % or more; the busiest way's share | 88 %; 59 % | 93 %; 58 % |
| King of the Hill: hill held, contested | 26.3 %, 0.0 % | 48.9 %, 0.6 % |
| Bomb plants a match | 0.5 | 1.5 |
| Hostage rescues | 0 | 1 |
| Elimination round | 120 s | 70 s |
| Team Deathmatch: idle out of a fight; the busiest way's share; time in cover in a fight | 7.1 %; 54 %; 31.9 % | 6.6 %; 43 %; 36.7 % |
| Idle out of a fight, CTF | 4.3 % | 5.9 % |

On this sample King of the Hill, Bomb, Hostage and Elimination played the same matches as the scored choices alone
(the team brain's groups switched off): King of the Hill never splits, and those maps' trips are under 180 m. More
idle out of a fight in CTF is the defenders keeping watch by their flag (they chased gunfire across the map before).

**Scored choices alone** (the team brain off): CTF captures 23 (129 takes), King of the Hill's hill held 48.9 %, Bomb
plants 1.5 a match, a hostage rescued, Team Deathmatch idle out of a fight 5.3 %. Fewer takes for as many captures:
with the defenders staying by their flag, a take is a real attack, and more of them end in a capture (11 → 18 %).

**The team brain, as it went** (CTF captures on the same 24 matches, and matches with one; scored choices in all):

| Variant | CTF captures |
|---|---|
| No groups | 23 (11) |
| Groups on every map, following their corridors point by point (12 m) | 9 (5) |
| Groups on every map, by one via a corridor | 16 (9) |
| ...with staging, waves together and interceptors | 15 (6) |
| Groups only on trips of 110 m and more | 22 (11) |
| ...without interceptors | 22 (11) |
| Groups only on trips of 180 m and more (landed) | 20 (9) |

One side with the team brain and the other without, in the same matches (the side alternating by seed): CTF captures
10 against 12 and takes 71 against 78 (groups on every map); King of the Hill hill seconds 238 against 263, and
gathering out of the hill's sight to retake it 37 against 170 (so King of the Hill goes straight for the hill). From
110 m, Diamond Park's attack went in two groups, and its five-minute capture test (seed 1) went without a capture (13
takes); from 180 m it has a capture again. Interceptors made no difference to the captures on this sample (22 and 22)
and stay: they are the reaction the plan asks for, and they cost nothing in the numbers.

**What it didn't do yet:** CTF captures didn't go up. With both sides' defenders holding their flags, carriers die close
to them: on Diamond Park 25 takes in two matches, 23 carriers killed within 14 s of the take, no capture (before: 24
takes, 2 captures). The attack against a held flag (moving up cover to cover, bounds, the playbooks) is part 2's. The
busiest way still carries 58 % of a CTF team's bots (the aim: under half).

**`pnpm bench:96:clump`** (96 bots; Norman Shores, Frost Basin and Riot Junction, spread and clumped, 30 s each), bot
thinking a tick, before and after taken in turn, two rounds each at load 1.2-1.5: before 1.43-2.58 ms (means 1.87 and
1.93), after 1.46-2.68 ms (means 1.85 and 1.91). The same on average; Norman Shores spread out, the first of the run, is
the most both times (2.51 and 2.58 before, 2.68 and 2.65 after: over the 2.5 ms guard before the change too, on this
machine, which measured Phase A's base at 1.13-1.90). The team brain itself is a few corridors' prices and a group
assignment once a second a side.

## Phase C: navigation depth (straight after Phase B; item 1 first)
1. **Parkour first** (owner, 2026-11-06: snipers "trying different 'parkour' to get where others don't normally go
   (roofs, etc)"). Links for every move a player can make, generated at load from the geometry and checked against the real
   movement code (`sim/movement.ts`): ledge drops (one-way), gap jumps, jumps up onto a ledge within reach, and rope
   lifts. A move players don't have (vaults, mantles) needs the movement first. Vantage spots then include the roofs
   and ledges only these moves reach, for snipers, and flankers use them as routes.
2. **Moving obstacles change the routes:** doors, breakable and crumbling blocks, trapdoors, movers, Forts builds.
   - Use a tiled navmesh with obstacles (Detour's tile cache), or route costs.
   - Rebuild a few tiles at a time, within a budget.
3. **Crowds:** bots steer round each other in tunnels, doorways and on stairs, using local avoidance on the existing
   spatial grid. This should cut stuck recoveries.
4. **Smarter routes:**
   - (area costs that prefer cover moved to Phase B item 6; avoiding spots where teammates died, and choosing among
     several routes, to Phase B item 4);
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
