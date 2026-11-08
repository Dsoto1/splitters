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
Junction; 180 s each, 33 matches, on the maps before main's prop scale pass. Each part was measured on its own
first: the branch carried switches for them while measuring (with every switch off it replayed main's matches
exactly); they are gone.

| Dev sample | Before | After |
|---|---|---|
| CTF captures (flag takes), 24 matches | 20 (176) | 23 (127) |
| CTF matches with a capture; maps with one | 12; 7 | 11; 6 |
| CTF route choice (each bot past a trip's middle, once a life): team trips with two ways taking 15 % or more; the busiest way's share | 88 %; 59 % | 89 %; 60 % |
| King of the Hill: hill held, contested | 26.3 %, 0.0 % | 48.9 %, 0.6 % |
| Bomb plants a match | 0.5 | 1.5 |
| Hostage rescues | 0 | 1 |
| Elimination round | 120 s | 70 s |
| Team Deathmatch: idle out of a fight; the busiest way's share; time in cover in a fight | 7.1 %; 54 %; 31.9 % | 6.6 %; 43 %; 36.7 % |
| Idle out of a fight, CTF | 4.3 % | 5.7 % |

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
| Groups only on trips of 180 m and more | 20 (9) |
| ...without interceptors (landed) | 23 (11) |

One side with the team brain and the other without, in the same matches (the side alternating by seed): CTF captures
10 against 12 and takes 71 against 78 (groups on every map); King of the Hill hill seconds 238 against 263, and
gathering out of the hill's sight to retake it 37 against 170 (so King of the Hill goes straight for the hill). From
110 m, Diamond Park's attack went in two groups, and its five-minute capture test (seed 1) went without a capture (13
takes); from 180 m it has one again.

**Interceptors are built and off** (`Playbook.interceptors` 0). On the dev sample they made no difference (22 and 22
captures at 110 m), but the five-minute capture tests' matches (botCtf.test.ts: Diamond Park 12 v 12, Sunken Kingdom
16 v 16, on main's maps after the prop scale pass) said otherwise. Three interceptors were the attackers of the side
whose flag was taken: its attack stopped while they waited on the carrier's way, and carriers rarely got home.

| First capture within five minutes, seeds 1-6 | Diamond Park | Sunken Kingdom |
|---|---|---|
| main's bots | 6 of 6 (92-196 s) | 6 of 6 (95-175 s) |
| part 1, three interceptors | 3 of 6 | 5 of 6 |
| one interceptor | 5 of 6 | 6 of 6 (119-281 s) |
| none (landed) | 6 of 6 (80-149 s) | 6 of 6 (76-162 s) |
| none, and defenders free to chase as before | 5 of 6 | - |

**What it didn't do yet:** CTF captures are only a little up (20 → 23), and half the sample's maps went without one
(6 of 12, 5 before). With the defenders holding their flags, a take is a real attack, and the attack against a held
flag (moving up cover to cover, bounds, the playbooks) is part 2's. The busiest way still carries 60 % of a CTF team's
bots past a trip's middle (the aim: under half).

**The nightly scorecard** (Run workflow: every scorecard mode on the maps that list it, two seeds of 180 s, 398 matches
on 77 maps; before: run 42312799177 on main with Phase B's measuring; after: run 42330601755 on part 1, which also has
main's prop scale pass and ground fix):

| Nightly | Before | After |
|---|---|---|
| CTF captures, flag takes, returns a match | 0.9, 5.6, 2.1 | 1.0, 4.5, 1.9 |
| CTF team trips on two routes or more (time); the busiest route | 87 %; 56 % | 87 %; 57 % |
| CTF route choice: two ways or more; the busiest way | - | 85 %; 61 % |
| King of the Hill: hill held, contested | 26.3 %, 0.3 % | 40.8 %, 0.4 % |
| Bomb plants, defuses a match | 0.5, 0.0 | 0.8, 0.0 |
| Hostage rescues a match | 0.1 | 1.5 |
| Elimination rounds a match, each | 3.7, 35 s | 3.6, 37 s |
| Team Deathmatch kills a minute | 21.6 | 21.6 |
| Idle out of a fight: all; CTF; Hostage | 6.1 %; 5.5 %; 9.6 % | 6.7 %; 6.7 %; 14.0 % |
| Stuck recoveries a bot-minute, all | 1.80 | 1.73 |
| Failed searches; no-route idle | 0.00 %; 0.09 % | 0.00 %; 0.08 % |
| Bot thinking a tick (GitHub's machines, not the same ones) | 0.31 ms | 0.37 ms |

25 of the 44 CTF maps had a capture in their two matches; of the 19 without, 11 are maps of 180 m or more between the
flags (three minutes is short for a run there). Hostage's idle out of a fight is its guards keeping watch at their
station (they chased gunfire away from the hostages before): on Iron Tide, station-keeping went from 14 and 8 % of
the bots' time in its two matches to 21 and 17 %. Its limit (bot-limits.json) went from 12 to 16 % for it; the
rescues came with it.

**`pnpm bench:96:clump`** (96 bots; Norman Shores, Frost Basin and Riot Junction, spread and clumped, 30 s each), bot
thinking a tick, before and after taken in turn, two rounds each at load 1.2-1.5: before 1.43-2.58 ms (means 1.87 and
1.93), after 1.46-2.68 ms (means 1.85 and 1.91). The same on average; Norman Shores spread out, the first of the run, is
the most both times (2.51 and 2.58 before, 2.68 and 2.65 after: over the 2.5 ms guard before the change too, on this
machine, which measured Phase A's base at 1.13-1.90). The team brain itself is a few corridors' prices and a group
assignment once a second a side.

### Phase B part 2, measured (snipers, cover-to-cover advance, playbooks)
Before: part 1 as landed (main 7c40d0b9). After: `wip/bots-b`, part 2. The same maps both times (main's, with the prop
scale pass and the ground fix). Samples: part 1's dev sample (33 matches); snipers (Team Deathmatch on Eagle Spires,
Twin Spires, Sunstone Crag, Diamond Park, St John's and Capitol Mall, maps with scoped pickups and long sightlines;
seeds 1 and 2: 12 matches); every bot Tactical (`--style=tactical`: CTF on Bunker Cross, Serene City, Grand Marquee
and Sunken Kingdom, Team Deathmatch on Fernwood Moon and Riot Junction, King of the Hill on Shingle Point: 7) and every
bot Arena (CTF on Bunker Cross and Serene City, Team Deathmatch on Riot Junction: 3); the long CTF maps (Fernwood Moon,
Sunken Kingdom, Iron Tide, Capitol Mall, Glacier Line, Riot Junction, Primeval Park, Eagle Spires; seed 1: 8);
Elimination on Diamond Park, St John's, Capitol Mall and Glasswork Office (seeds 1 and 2: 8). 180 s each.

| Dev sample, 33 matches | Before | After |
|---|---|---|
| Time in cover in a fight, by style: Tactical; Mixed (neither tag); Arena | 24.3 %; 18.2 %; 19.1 % | 40.0 %; 27.7 %; 19.6 % |
| Time in cover in a fight: all; CTF | 19.2 %; 14.0 % | 27.3 %; 23.6 % |
| CTF captures (flag takes); matches with one; maps with one | 26 (155); 12; 6 | 25 (137); 12; 7 |
| King of the Hill: hill held | 46.1 % | 43.9 % |
| Bomb plants, defuses a match | 1.5, 0.0 | 2.0, 0.5 |
| Hostage rescues | 2 | 2 |
| Team Deathmatch kills a minute | 28.7 | 33.2 |
| Scoped kills a match; sniper spots taken a match | 1.5; 0.1 | 2.6; 0.6 |
| Stuck recoveries a bot-minute; idle out of a fight | 2.07; 5.5 % | 1.88; 5.8 % |

| Other samples | Before | After |
|---|---|---|
| Snipers (12): the sniper-role bots' spots taken, rounds from them, kills from them | 15, 2, 1 | 33, 17, 3 |
| Snipers: their scoped kills; spots left after their shots | 4; 0 | 27; 10 |
| Snipers: every bot's scoped kills a match; Team Deathmatch's busiest way | 6.3; 60 % | 6.5; 49 % |
| Tactical (7): time in cover in a fight; CTF captures a match | 22.6 %; 2.0 | 36.5 %; 2.5 |
| Tactical: scoped kills a match (from spots) | 1.1 (0.0) | 3.7 (0.4) |
| Arena (3): time in cover in a fight; CTF captures a match | 25.4 %; 3.5 | 27.5 %; 3.0 |
| Long CTF maps (8): time in cover in a fight; captures | 9.6 %; 3 | 18.1 %; 3 |
| Long CTF maps: group pushes' ground gained (metres a minute of pushing) | 222 | 192 |
| Long CTF maps: route choice, two ways or more; the busiest way | 93 %; 59 % | 92 %; 60 % |
| Elimination (8): rounds a match, each | 1.8, 73 s | 1.6, 80 s |

Six more King of the Hill matches (seeds 2 and 3 on the same maps) on an earlier part 2 build held the hill 41.4 and
41.5 % of the time. Bounds slow a push (ground gained a minute down by an eighth on the long maps) for the cover it
gains.

**Snipers, as they went** (the sniper sample): spots scored for height, a wall behind, being tucked away and the lanes
they cover, and a scoped gun first, took the spots taken from 15 to 31 in the 12 matches, but snipers on them fired 7
rounds: they saw 60 m like everyone (the gun reaches 120). Seeing through the scope out to the gun's reach, they held
their shots instead (61 s held): at 80 m a body is 5 mrad wide, narrower than a bot's aim ever settles to, so the
calculated shot waited for nothing. Lined up a second counts as settled now. One shot a spot, the first hit seldom
killed and the sniper left before the second; two a spot (three for the bold): 14 rounds from spots and 4 kills from
them, against 10 and 1. Kills from spots stay rare (0.3 a match): what's still missing is the scoped gun at spawn
(the weapon sets' `Match.sniperGun`: until then a sniper finds one on the map first, if there is one) and spots that
see where the enemy actually goes in a Team Deathmatch's free-for-all middle.

**The capture tests' matches** (botCtf.test.ts's setup, first capture within five minutes, seeds 1-6):

| | Diamond Park | Sunken Kingdom |
|---|---|---|
| Part 1 | 6 of 6 (80-149 s) | 6 of 6 (76-162 s) |
| Part 2 (landed) | 4 of 6 (90-238 s) | 6 of 6 (95-216 s) |
| ...with each corridor's via in its second half | - | 4 of 6 |
| ...bounding lighter (not within 20 m of the objective, covering 40 % of the turn) | 6 of 6 | 3 of 6 |

A CTF attack is slower in bounds; both tests' own seeds capture (Diamond Park seed 1 at 99 s, Sunken Kingdom seed 3
at 130 s).

**The busiest way** (the coordinator's ask: under half on the long maps). Not there: 59-60 % on the long CTF maps.
Tried: flankers 45 % of the attackers after the recon pair (were 30 %): two ways or more 87 to 100 % of the team trips
there, the busiest way 59 to 58 % (kept); each corridor's via in its second half: 60 to 56 %, but Sunken Kingdom's
captures fell (not kept). Why: a bot takes a corridor by its via and then goes the shortest way to the flag, back on
the main way by the trip's middle (of the bots passing the middle there, about 15 % were still following a corridor).
What it would take: route searches that stay on a group's corridor all the way, a per-group cost on the navmesh's
polygons off it (as the corridors themselves were found), not more vias (several vias a corridor kept groups on their
way but slowed them: fewer takes). That is Phase C's route cost work (item 4) more than Phase B's.

**The nightly scorecard** (Run workflow, 398 matches on 77 maps: run 42339417626 against part 1's 42330601755, the
same maps):

| Nightly | Part 1 | Part 2 |
|---|---|---|
| Time in cover in a fight: all; CTF; King of the Hill; Team Deathmatch | 33.8 %; 13.7 %; 36.9 %; 43.5 % | 36.5 %; 23.6 %; 37.8 %; 43.7 % |
| Scoped kills a match (from vantage spots) | 1.8 (0.0) | 2.6 (0.1) |
| CTF captures, flag takes, returns a match | 1.0, 4.5, 1.9 | 0.9, 4.5, 1.7 |
| CTF route choice: two ways or more; the busiest way | 85 %; 61 % | 88 %; 59 % |
| King of the Hill: hill held | 40.8 % | 40.1 % |
| Bomb plants a match; rounds a match, each | 0.8; 1.6, 86 s | 0.9; 1.3, 97 s |
| Hostage rescues a match | 1.5 | 2.0 |
| Elimination rounds a match, each | 3.6, 37 s | 3.4, 38 s |
| Team Deathmatch kills a minute | 21.6 | 21.1 |
| Idle out of a fight: all; CTF; Bomb; Hostage | 6.7 %; 6.7 %; 10.0 %; 14.0 % | 7.1 %; 6.7 %; 12.3 %; 9.8 % |
| Stuck recoveries a bot-minute | 1.73 | 1.71 |
| Bot thinking a tick (GitHub's machines, not the same ones) | 0.37 ms | 0.32 ms |

Two limits broke, and went up for it (bot-limits.json): CTF's idle spells of 10 s and more, 2.06 a match against 2.0
(now 2.5): snipers hold their spots now, 25-50 s each, deliberately still; Bomb's idle out of a fight, 12.3 % against
12 % (now 14 %): its attackers move up in bounds, so the defenders keep watch at their sites longer (Shingle Point,
seed 1: station-keeping 7.2 → 15.5 % of the bots' time, sniper spots 2.0 %), and its rounds run longer (86 → 97 s)
for as many plants.

**`pnpm bench:96:clump`** (96 bots; Norman Shores, Frost Basin and Riot Junction, spread and clumped, 30 s each), bot
thinking a tick, part 1 and part 2 taken in turn, three rounds each, at load 10-14 on 4 cores (other agents' tests
running): means 1.96, 2.01 and 2.00 ms against 1.93, 2.15 and 1.92. The worst case, Norman Shores spread out: part 1
2.82, 2.89 and 2.82 ms, part 2 2.63, 2.73 and 2.65, lower every round but still over the 2.5 ms guard on this machine
under this load (part 1's own run at load 1.2-1.5 had it at 2.51-2.68). Everything else 1.59-2.15 ms (one 2.91, Frost
Basin spread out in part 2's second round). Part 2 asks for fewer routes (13,320 searches a dev-sample match against
17,572: bots that bound or keep their cover re-plan less). The setup outside the bots' own thinking (their views, the
pickups, goals) is 0.65-0.70 ms of Norman Shores' 2.5-2.9 (a CPU profile: `runBots`' own work a ninth of the bots'
time): the place to look for the headroom the 64-player browser round needs.

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

### Phase C item 0, measured: the hurt-bot retreat (kept as it is)
**The report** (HANDOFF's pitfalls, from the Breakthrough work): a bot under its self-preservation share of its health
retreats from every enemy it sees for the rest of its life when no health pickup is in reach (nothing regenerates), so
on the Breakthrough Range a hurt attacker rarely pushes again. **The ask:** the retreat gives up after a while, or the
bot fights from cover at low health and keeps its objective.

**Measured, it is the other way round:** on main (`wip/bots-c` from 61652cb9, `pnpm bot-report test_breakthrough
--mode=core.breakthrough`), the retreat is what keeps the attack alive. Every variant tried took the attackers' pool
down faster (kills a minute 33 → 47-52 at 8 v 8: hurt bots that stay and fight die, and each death is a reinforcement
spent; the lines held at 150-250 s with none left) and broke through less:

| Variant (8 v 8 on the Range, smoke on, pool 6 an attacker) | Seeds | Broke through | Sectors | Retreating, of alive time |
|---|---|---|---|---|
| main (a hurt bot retreats from every enemy it sees while hurt) | 1-12 | 11 | 35 of 36 | 11.5 % |
| The retreat gives up after 4 s a life (2 s with an objective) | 1-6 | 1 | 10 of 18 | 4.7 % |
| ...and hurt with the retreat given up: cover against what it sees, never on into it | 1-6 | 2 | 12 of 18 | 4.4 % |
| ...only bots pushing an objective give up (defenders retreat as before) | 1-12 | 7 | 27 of 36 | 5.2 % |
| A 4 s retreat each fight (the clock starts again 8 s out of one) | 1-6 | 3 | 13 of 18 | 4.6 % |
| Objective pushers: a retreat each fight, none once in cover | 1-12 | 6 | 24 of 36 | 5.1 % |
| No retreat while standing in its objective (a zone, a charge) | 1-12 | 5 | 23 of 36 | 6.0 % |
| ...and an 8 s retreat each fight | 1-12 | 9 | 30 of 36 | 8.3 % |
| A 12 s retreat each fight | 1-12 | 8 | 32 of 36 | 9.0 % |

At 4 v 4 (seeds 1-8, pool 6) main broke through in 5 (sectors 19 of 24, retreating 9.6 %); the first two variants
in 5 (21 of 24, 3.3 %) and 3 (17 of 24, 3.8 %); the 12 s retreat each fight played main's matches exactly. CTF (Diamond
Park, Sunken Kingdom, Bunker Cross, Serene City; seeds 1 and 2, 180 s) and Team Deathmatch (Fernwood Moon, Riot
Junction) were within their noise for the first and the last variant (CTF captures 20 → 14 and 17 in 8 matches, stuck
recoveries 1.74 → 1.69 a bot-minute); their maps have health, so their bots retreat to it as before.

Why: a hurt bot doesn't retreat for the rest of its life, only while it sees an enemy (and 3 s on); with nobody in sight
its scored choice is its objective again (and a hurt bot lets noises and chases go). So it does push again, between
sightings, and lives. The numbers the brief set to beat (4 v 4: 2 of 8; 8 v 8: the beach 6 of 6, the fort 2 of 6) came
from the Breakthrough agent's scratch harness on an earlier main; today's main beats them by `bot-report` already.
**Kept as it is.** What landed for item 0: a crash fix found on the way (a Breakthrough defender with the fall-back duty
on the last sector read the sector after it: `BreakthroughMode.botGoal` threw mid-match, seed 2 at 8 v 8), `bot-report`'s
Breakthrough fields (the Iron Coast build's commit, taken unchanged) and the retreating share in `--compare`.

### Phase C items 1-4, measured
What's in it: docs/BOTS.md, "Parkour", "Ground that goes", "Crowds" and "Routes along a group's corridor, and the search
budget". Before: main 0d03c3bd (item 0 and the small fixes of 11-07). After: `wip/bots-c` (items 1-4), main merged in.
The same matches (`pnpm bot-report`): CTF on Diamond Park, Sunken Kingdom, Bunker Cross, Serene City, Capitol Mall,
Fernwood Moon, Qasr Medina and Twin Spires (seeds 1 and 2, 180 s: 16 matches), Team Deathmatch on Eagle Spires, Twin
Spires and Riot Junction (6), the Breakthrough Range at 8 v 8 (seeds 1-24, 900 s).

| Sample | Before | After |
|---|---|---|
| CTF: stuck recoveries a bot-minute | 1.40 | 1.34 |
| CTF: captures (flag takes); matches with one | 22 (85); 9 | 18 (112); 9 |
| CTF: idle out of a fight; frozen | 5.4 %; 0.6 % | 5.1 %; 0.8 % |
| CTF: failed searches; no-route idle | 0.00 %; 0.00 % | 0.00 %; 0.00 % |
| CTF: parkour moves a match (drops / gap jumps / jumps up); missed, given up | - | 10.2 / 1.9 / 25.9; 0.6, 1.8 |
| CTF: route choice, busiest way; busiest route (time) | 57 %; 53 % | 61 %; 55 % |
| Team Deathmatch: stuck recoveries a bot-minute | 0.92 | 0.68 |
| Team Deathmatch: parkour moves a match | - | 2.8 / 0.0 / 19.7 |
| Team Deathmatch: sniper spots a match, kills from them | 3.2, 0.2 | 3.3, 0.5 |
| Bot thinking a tick (CTF; load 10-14 on 4 cores) | 1.18 ms | 1.25 ms |
| Breakthrough Range 8 v 8: broke through (seeds 1-24); sectors | 21; 68 of 72 | 16; 62 of 72 (the final build, seeds 1-12: 9 of 12, 31 of 36; main 11, 35) |

**Done when, as it stands:**
- *Stuck recoveries halve:* not met. Down a quarter in Team Deathmatch, 4 % in CTF. The biggest single source on the
  sample is a map spot (Capitol Mall's upstairs office by (140, 4, 8): 150-300 a match, with or without parkour), and
  the rest is spread thin. What did cut them: strafing in a fight no longer judged stuck; a parkour link a bot can't
  make given up on and switched off (Qasr Medina seed 2: 201 → 123).
- *Bots use drops, jumps and doors as players do:* met. 38 parkour moves a CTF match, 22 a Team Deathmatch match,
  under 2 % missed; doors were already routed (openings), and now so is ground that goes.
- *No bot is frozen by a closed door or a broken bridge:* met for bridges, trapdoors and floors that crumble, break or
  hide, and drawbridges (`parkour.test.ts`: routes go round a crumbled bridge by the walkway). Breakable crates or walls
  that open a way when broken don't open a route (the navmesh has no ground under them: a tiled navmesh's work).
- *Think time inside the guard:* met. `pnpm bench 64 30` (Norman Shores, Frost Basin, Riot Junction; TDM, 10 s
  warm-up, spread and clumped; load 6, main and the branch in turn): bot thinking a tick 1.23-1.69 ms on main (mean
  1.45), 1.34-1.87 on the branch (mean 1.54), inside the 2.5 ms guard; movement a little more (bots that move, and move
  in full on a link).
- *CTF's busiest route down from 59 %:* not met on this sample (57 → 61 %). Groups (main push, flankers, recon) only
  form on trips of 180 m and more; of the sample's maps that is Capitol Mall, Fernwood Moon and Sunken Kingdom, where
  routes along a corridor (`pathAlong`) were about 150 a match. Their bots keep their lane all the way now, but most of a
  team isn't in a group, and loose bots take the shortest way.

**The Breakthrough Range** went down: in 16 of 24 seeds against main's 21 (sectors 62 of 72 against 68), and the
final build, seeds 1-12, in 9 of 12 against 11 (sectors 31 of 36 against 35). The matches are chaotic (one changed
decision reshuffles everything after it), so it was taken apart, 12 seeds each (main: 11 of 12): parkour, ground that goes and
the parts of items 3 and 4 one at a time and together: without parkour 8, without keeping right 7, without corridor
routes 5, without all three 6, without the strafing rule as well 8. With every change switched off the build replays
main's matches exactly, seed for seed. No one part accounts for it; each reshuffles the matches and the attack comes out
a little worse. One cause was found and fixed: ground that goes had every bot plan its route again whenever any
breakable prop broke, even one with no ground on the navmesh (the Range's sandbags). For the owner to judge in a
playtest (`check/bots-c` CI and the 4 v 4 numbers in HANDOFF).

**Load time** (the navmesh build with and without parkour, ten big maps, load 11 on 4 cores, noisy): +13 % in all;
Qasr Medina's the most (a second or so: its flat roofs' 280 drop candidates). Links are cached per navmesh, so the next
match on a map pays nothing.

### Phase C follow-up (part 1 landed 2026-11-07: off a sill, corridor followers counted; the duck held back; part 2, large bots round low roofs, landed in 0.9.0, at the moderate price since 2026-11-08)
The coordinator's list after items 1-4 landed: route spread, CTF captures, the Range's 8 v 8, stuck recoveries,
Capitol Mall's office. Baselines: main 0531b29c (Phase C items 1-4 and the day's fixes), and 0d03c3bd (before items
1-4). The CTF sample: the eight maps of "Phase C items 1-4, measured", **seeds 1-6** (48 matches, 180 s; seeds 1-3
alone were too few to tell captures apart).

**Part 1, landed (measured against main 0531b29c):**
- **Off a sill outside a wall** (`NavWorld.wayOnto` with a walk-clear check): a bot on ground the navmesh doesn't
  cover took the nearest polygon within 2 m as its start even when it was behind a wall, and its route went through
  the wall. Capitol Mall's office trap at (140, 4, 8) was this (150-300 stuck recoveries a match before main's small
  fixes). General code, no map change. `parkour.test.ts`: a bot put on that sill gets off.
- **Corridor followers count on their corridor** (`BotBrain.byCorridor`): bots routing along a group's corridor by
  `pathAlong` weren't counted by `BotBrain.corridor`, so neither the team brain's crowd price nor bot-report's "how the
  bots went" saw them.

| Sample | main | Part 1 | With the duck (held back) |
|---|---|---|---|
| CTF, 48 matches: captures (flag takes); matches with one | 48 (265); 30 | 50 (264); 30 | 40 (268); 24 |
| CTF: captures per take | 0.18 | 0.19 | 0.15 |
| CTF: stuck recoveries a bot-minute | 1.32 | 1.31 | 1.18 |
| CTF: busiest way; idle out of a fight; frozen | 59 %; 5.3 %; 0.8 % | 59 %; 5.3 %; 0.8 % | 61 %; 5.4 %; 0.7 % |
| Team Deathmatch (Eagle Spires, Twin Spires, Riot Junction; seeds 1-4): stuck a bot-minute; kills a minute | - | - | 0.90 → 0.90; 23.3 → 24.9 |
| Breakthrough Range 8 v 8, seeds 1-24: broke through; sectors | 19; 65 of 72 | - | 18; 61 of 72 |

Part 1 plays main's matches in 41 of the 48 CTF matches exactly (the sill and the counting rarely come up on this
sample). The Team Deathmatch and Range columns are the branch with the duck; both within their noise (the Range: 40
against 38 over 48 seeds before). CI: `check/bots-c2`.

**Held back: large bots duck** (`BotBrain.mustDuck`, commit 2c586e5a, reverted in c69cd330): a body taller than the
navmesh's 1.8 m (large looks, 2.12 m) crouches where there's no room to stand a step ahead (or a step up) but room to
crouch. It does what it was for: Diamond Park's stuck recoveries 159 → 79 a match (the dugout steps at (8, 0, -8) and
(24, 0, -8)), all CTF 1.32 → 1.18 a bot-minute. But captures fell 48 → 40, Diamond Park 13 → 9 over seeds 1-12 (flag
takes the same, 80 and 79: large bots now get down the dugout steps instead of giving up there, and carriers that
crouch don't sprint), and botCtf.test's two capture-within-five-minutes matches (Diamond Park seed 1, Sunken Kingdom
seed 3) went without one; without the duck both pass. It's a gameplay call (bots that duck as a player does, against
a few captures); the owner's. To try next with it: large bots route round low roofs (a cost on polygons under low
headroom) rather than crouching through.

**Part 2, landed: large bots route round low roofs** (owner's option a, 2026-11-07; `wip/bots-lowroof`, fc4d701; green on
`check/bots-lowroof`, run 42428308885 (characters3's scope check failed once, as on `check/tanks`; passed on the re-run)).
It reached main and 0.9.0 at the full price (1,000 a metre) while these notes still called it held back; the owner chose
the moderate price on 2026-11-08 (`LOW_ROOF_COST` = 4, below, "The moderate price"). As first measured:
- **The navmesh marks low headroom** (`nav/solo.ts`): generateSoloNavMesh's own steps, with one added after the erosion:
  walkable cells with less room over them than a large body stands in (1.18 × 1.8 m and 5 cm) and the cells within a
  large body's radius (0.4 m) of them get area `LOW_AREA`, so Recast splits polygons there. Read straight off the WASM
  heap: 20-80 ms a map at load. 37 of the 92 maps have some (Diamond Park 7 m², the dugouts' stair tops; Capitol Mall
  561 m²; Eagle Spires' 6,165 m² are inside its rock, left out already). Ground under a low roof isn't open ground
  (`markExposure` skips it).
- **Per size class, one navmesh:** a tall body's search (`NavWorld.findPath` `tall`: size over 1.02) prices `LOW_AREA` at
  `LOW_ROOF_COST` a metre (first 1,000, so any way round was taken; 4 since 2026-11-08); small and standard bodies'
  searches don't change (the area costs them 1).
  A corridor route under a low roof is refused for a tall body (`pathAlong` `tall`).
- **The last resort, and how it's decided:** the route goes under a low roof only when the costly search finds no
  other (or it starts or ends there: getting out from under one, a goal under one). Then `lastLow` is set, the bot's
  `lowRoute` is on, and only then does it duck where it can't stand (`BotBrain.mustDuck`, the held-back duck's probe).
  Start and end polygons that had to go under are remembered (no second costly search). Measured: ducking **0.0 s a
  match** over the 48 CTF matches and the TDM sample; 129 of 225,592 tall searches went under a low roof (each a start
  or end under one, with room to stand where the bot was).
- `botLowRoof.test.ts`: a large bot routes round a low doorway when an open one exists, standing; crouches through it
  when there's no other way; small and standard bots go under it as before. bot-report prints stuck recoveries by body
  size, ducking, and tall routes under a low roof.

| Sample (main = b8854c6) | main | Part 2 |
|---|---|---|
| CTF, 48 matches: captures (flag takes); matches with one | 50 (264); 30 | 43 (255); 26 |
| CTF: captures per take | 0.19 | 0.17 |
| CTF: stuck recoveries a bot-minute (large bodies) | 1.31 (1.54) | 1.12 (1.01) |
| CTF: busiest way; idle out of a fight; frozen | 59 %; 5.3 %; 0.8 % | 58 %; 5.4 %; 0.7 % |
| Diamond Park, seeds 1-12: stuck a bot-minute (large bodies); captures (takes, returns) | 2.17 (4.1); 13 (79, 36) | 1.04 (0.9); 5 (92, 51) |
| Qasr Medina, seeds 1-12: captures (takes) | 14 (84) | 10 (73) |
| Team Deathmatch (Eagle Spires, Twin Spires, Riot Junction; seeds 1-4): stuck a bot-minute; kills a minute | 1.04; 23.7 | 0.76; 23.9 |
| Breakthrough Range 8 v 8, seeds 1-24: broke through; sectors | 19; 65 of 72 | 19; 65 of 72 |

The stuck recoveries fall further than with the duck (1.18), Diamond Park's to half, Riot Junction's 144 → 86 a match,
with no ducking at all. Bunker Cross, Serene City, Sunken Kingdom, Capitol Mall and Twin Spires play main's matches
exactly; the Range has no low roof. **The captures still fall, on Diamond Park:** 13 → 5 over seeds 1-12, with flag takes
up (79 → 92) and returns up (36 → 51; large bodies' returns 6 → 17). It isn't carriers crouching (nobody ducks); the
large bodies that used to stand stuck at the dugouts' side stairs now leave by the back stairs, towards their own flag,
and defend. Two checks: the marking alone (large bodies routing as before, seeds 1-6) Diamond Park 8 → 6 captures, stuck
2.38 → 1.59; a moderate price instead (4 a metre: crouch through a short low strip when the way round is long, seeds
1-12) Diamond Park 9 captures, returns 49, stuck 1.16, ducking 6 s a match. The Qasr Medina drop (13 m² of low ground)
is within the ±10 that one changed decision makes. So un-sticking large bots costs Diamond Park captures whichever way
it's done: the stuck bots were defenders out of play. The owner's call was between landing it, landing it with the
moderate price, or neither; it landed at the full price, and then:

**The moderate price** (owner, 2026-11-08: `LOW_ROOF_COST` = 4 in `nav/index.ts`; `wip/debris-lowroof`). A large bot
goes round a low stretch when the way round costs less than four times its length (bots' cover routes price open ground
up to 1.45 a metre, so the way round counts a little dearer), and crouches through otherwise: a lintel's metre is crouched
through rather than a 15 m detour; an 11 m low tunnel is gone round (`botLowRoof.test.ts`). Measured against main
4d8f205 (the full price), `pnpm bot-report`, 180 s matches:

| Sample | 1,000 a metre (main) | 4 a metre |
|---|---|---|
| CTF, the eight maps, seeds 1-6 (48 matches): captures (matches with one) | 62 (30) | 61 (31) |
| CTF: stuck recoveries a bot-minute (large bodies); ducking a match | 1.27 (1.17); 0.0 s | 1.27 (1.18); 1.3 s |
| CTF: tall routes under a low roof | 101 of 252,473 | 1,507 of 249,582 |
| Diamond Park, seeds 1-12: captures, takes, returns | 10, 69, 33 | 7, 85, 38 |
| Diamond Park: stuck a bot-minute (large bodies); ducking a match | 1.14 (1.14); 0.2 s | 1.13 (1.17); 9.7 s |
| Qasr Medina, seeds 1-12: captures, takes; stuck a bot-minute | 11, 68; 1.20 | 11, 68; 1.20 |
| Team Deathmatch (Eagle Spires, Twin Spires, Riot Junction; seeds 1-4): stuck a bot-minute; kills a minute | 0.88; 28.0 | 0.88; 28.0 |

Only Diamond Park plays differently (its dugouts' stair tops are the only low ground most routes meet): the other
seven CTF maps, Qasr Medina's extra seeds and the Team Deathmatch sample play the same matches exactly. On Diamond Park
large bots now crouch through the stair tops (about 10 s a match) rather than walk round, with more flag takes (69 →
85) but not more captures (10 → 7, within the ±3 that twelve matches move by). Stuck recoveries stay at the full
price's level. Main had moved since the first measurement (b8854c6): at the full price Diamond Park now makes 10
captures over seeds 1-12, not 5, so the gap the moderate price was to close isn't there on today's main.

**CTF captures per take, the ablations** (main 0531b29c with each part of items 1-4 switched off in a scratch build;
48 matches each):

| Build | Captures (takes) | Captures per take | Matches with one | Stuck a bot-minute |
|---|---|---|---|---|
| Before items 1-4 (0d03c3bd) | 61 (255) | 0.24 (seeds 1-3: 0.26, as measured before) | 26 | 1.34 |
| main (items 1-4) | 48 (265) | 0.18 | 30 | 1.32 |
| main without parkour links | 39 (269) | 0.15 | 24 | 1.31 |
| main without keeping right and the strafing rule | 55 (256) | 0.21 | 30 | 1.43 |
| main without either | 44 (258) | 0.17 | 23 | 1.38 |

Neither explains it. Parkour off is no better (worse, if anything); keeping right off gets about half the gap back, but
with both off it's back at main's figure, so that half is noise: at 48 matches captures move by about ±10 between
builds that differ in one rule (one changed decision reshuffles a match). The drop itself, 0.24 → 0.18, is under two
standard errors. The strafing rule does what it was for (stuck 1.43 → 1.32 with it). Not looked at: ground that goes
(item 2) and the corridor routes and search budget (item 4); a cleaner measure than captures (a carrier's run home:
distance made before it drops, by map) would need fewer matches. **No change made.**

**What didn't (earlier on the branch):** **bots in no group taking a corridor of their own** (the cheapest by the crowd
price, claimed at once so a respawn wave spreads, only corridors within 1.3 times the shortest, followed all the way by
`pathAlong`): CTF captures 26 → 13, flag takes 155 → 94, and the busiest way 60 → 72 % (the length cap left Qasr Medina
one corridor; the old left/right lanes spread loose bots better). Reverted (`5275543d`).

**Route spread, still open:** the busiest way is about 60 % on main. Only groups (trips of 180 m and more) follow
corridors; loose bots take left/right lanes, which re-join the main way by the trip's middle. On a two-way trip the
busiest way can only drop under half with an even split. Next to try: loose side-lane bots routed by a corridor's
via (the point furthest from the other corridors) instead of `laneWaypoint`, measured on the 48 matches for captures.

**Next step:** route spread (part 2 is settled: the moderate price, above).

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
