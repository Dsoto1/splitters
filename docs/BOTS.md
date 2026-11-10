# Player Bots in big matches: spawning, routes, squads and roles

How Player Bots spawn, spread over the map, move in squads and play their
roles, as built (October 2026). The design intent is CHARACTERS_BOTS_V2.md
(§11 personality, §13 update budget, §15 squads); the frame budget is
PERF_96.md and MAP_BUDGETS.md ("Clumped 48 v 48"). Everything here is in
`packages/shared`: `sim/spawns.ts`, `bots/director.ts`, `bots/regions.ts`,
`bots/vantage.ts`, and the hooks in `sim/match.ts` and `bots/brain.ts`.

The rule for all of it: **nothing new runs per bot per tick that isn't a
couple of comparisons**. Squad and side decisions run once a second per side,
vantage spots and made-up spawn points are worked out once at match start,
and bots read the results from objects the match updates in place.

## Spawning

**Choosing a spawn point** (`pickSpawn`, the same rule for people and bots; weights are data in
`content/match-play.json` `spawnChoice`, docs/GAME_MODES.md "Spawns, protection and awards"). Every candidate gets
a cheap score:

- distance to the nearest living enemy, up to 30 m (height counts double); past 50 m a little less again (0.3 a
  metre, at most −15: a spawn should be safe, not out of the game);
- someone standing on it (within 1.5 m): −60; a few people within 4 m: −6 each;
- used in the last 3 s: up to −20, fading (enough to break ties, not to send anyone nearer an enemy);
- fresh deaths: each player an enemy downed within 12 m in the last 10 s costs up to 18 (less with distance and
  age; at most twice that however many fell there): whoever killed them may still be watching;
- team modes on shared spawns: +6 for each living teammate out of a fight (not hurt for 4 s) within 25 m, up to
  three; and each side keeps its end of the map (`SpawnSides`: a running average of where each
  side spawned): up to ±8 for being nearer your own side's end than an enemy side's, so the sides don't swap ends
  (no spawn flips) while safety still decides;
- made-up points: a small pull toward the side's own base.

A little randomness (0-3) separates near-equal points (a round's first spawns spread over all of them). Then the
best eight are checked for enemies within 50 m with a clear sight line to the spawn (the four nearest
each): −35 for every one that can see it (at most 32 rays a spawn). One is then picked **at random among the best
three within 8 of the best**, so nobody can learn where the next spawn will be and a few points share the load.
**Squad spawn** (team modes, 70 % of spawns, beside a teammate out of the fight with no enemy within 20 m): of up to
four such teammates at random, the one nearest the fight that no enemy can see (the three nearest within 50 m
checked), else the spawn point.

**Spawn protection** (`Match.shielded`; seconds by mode in `content/match-play.json` `spawnProtection`: Deathmatch
and Team Deathmatch 3 s, Roulette 2 s, other modes none; a match's `spawnProtection` rule overrides it): every
respawn, and a first life that begins mid-round, is shielded: nobody else's damage gets through, and firing,
throwing or striking drops it at once. The lives a round opens with have none (everyone is spread over the spawns;
a start gate holds them in the countdown). Players see a faint shimmer (a steady blue glow with Reduce flashing on)
and a line under the crosshair. Bots treat a shielded enemy as 6 times further off (a target only when nobody else
is), and a shielded bot holds its fire until a second before its shield runs out (unless an unshielded enemy is
within 2 m), so it gets its bearings rather than throwing the shield away on its first sight of someone.

**Spawn waves.** Matches of 12 players or more spawn bots a few a tick
(`spawnsPerTick`: an eighth of the players, 12 a tick at 96), longest-waiting
first, so a whole roster is in within 8 ticks (0.13 s). That is quicker than
any bot reacts (220 ms at Hard): slower waves (a third of a second and more)
let the first ones shoot the last ones as they appeared, measurably more
deaths in the first seconds of a free-for-all. A bot joining a big
match, or starting a round in one, waits for its wave with its loadout
already on (`Match.queueSpawn`). People always spawn at once. Waves also run
during the start gate's wait and countdown. Smaller matches spawn everyone at
once, as before.

**Made-up spawn points** (`generateSpawns`, `Match.ensureSpawnCapacity`). A
match of 12+ players on a map whose spawns are too few or too bunched for it
(a spawn point per 3 players a side, counting the pool the side actually
spawns from: its own points, or the shared ones in free-for-all; points
within 5 m of each other count as one) gets extra points for that match
only; the map file is never touched.
From the navmesh's sample places (`NavWorld.places()`), a point must:

- have standing room (`headroom`) and solid floor under it, be above the kill
  height, out of water, and not within 4.5 m of a trap, zone, pad or portal;
- have walkable ground 2.5 m out on three sides of four (not at a drop);
- be on the side's own part of the map in team modes (the own 40 % of the line
  between the two bases, 50 % if that's short of places);
- be reachable on foot from the nearest spawn point already accepted (so all
  connect to the side's own);
- be at least 6 m from every other spawn point of the side.

Points are picked by farthest-point sampling (spread enough past 24 m; past
that, nearer the side's base and level with it wins, which keeps them off
roofs and cliffs), with a seeded jitter: the same map and seed give the same
points. Worked out at the first spawn of the match, again only if the match
grows past the players they were made for (in steps of 8), while the match
is being set up (a bot that will wait for its wave triggers it as it joins),
not in a tick. Measured: Frost Basin 48 v 48 gets 10 a side, Canyon 11,
Norman Shores 3–4; Riot Junction (16 a side) none. To see it for a map:
`pnpm --filter @tiletrigger/server spawn-points 96 core.tdm maps/<map>.json`.

MapMaker's validator says so too: `spawn.few` now also fires per team (a team
with fewer spawn points than a third of its half of the recommended players),
and both messages say that big matches add spawn points of their own. The
Arcade setup note says the same.

## Route variety and map coverage

**Region knowledge** (`RegionMap`, one per side). The navmesh's places are
grouped into 24 m regions (per floor). Once a second the side records where
its members stand: when someone on the side was last in each region, and how
many are in it now. Bots pick where to go next from it (`pick`, 24 random
regions sampled, bounded):

- regions nobody on the side has seen for a while score higher, and so do
  regions the bot itself hasn't been to this life (its `MapMemory`): interest
  decays when visited and comes back over 90 s;
- about the distance the bot likes (25–75 m by its exploration, lone wolves
  further);
- toward the enemy's side in team modes (so fights still happen);
- where the side has met the enemy in the last 20 s (from its fighting
  members, once a second), unless four or more of the side are already there;
- fewer teammates already there (lone wolves care a lot, grunts hardly);
- not a region another squad of the side is heading for.

In team modes a bot on its own still often goes straight for the enemy's
side as before (a random enemy spawn point: 30 % of picks, plus up to 40 %
more by aggression; never lone wolves), by its own route: fights keep
happening and the rest of the picks spread the side over the map.

**Routes.** Each bot then takes its own way there: a waypoint off to the left
or right of the straight line (35 % each, 30 % straight), from a seeded
stream of its own (`routeRng`), so the bots of one side spread over the
map's corridors instead of filing down one. Lone wolves flank wide (1.6× the
offset). Path cost noise isn't possible without area costs on the navmesh
(every polygon costs the same), so variety comes from the goals and
waypoints. Since Phase B a bot heading straight for the enemy's side takes the
cheapest corridor of its side's trip there instead, and objectives' attackers
go by their group's (see "Team brain and route variety").

**Not everyone at one fight.** In big matches a bot doesn't go after gunfire
four or more of its side are already within 12 m of, unless it's within
18 m (`perceive`, one grid query).

**Stuck loops.** Three stuck recoveries within 10 s in the same 4 m: the bot
gives up the goal (avoided for 20 s, the squad's too), the noise or chase it
was after, or the vantage spot (avoided for 2 minutes) (`checkStuck`,
`stuckLoops`). A bot only being nudged aside by a teammate (no move of its
own) doesn't count as stuck.

**Shortcut links.** Besides walkable ground the navmesh has one-way links
(`navLinks`): jump pad flights, ladders up and down, portal pairs, lifts and
ziplines. A zipline is a link from the ground where its cable is grabbed to
where it drops riders (and back on a two-way line); Recast costs a link by its
length, so a bot rides when that's the shorter way. Coming to that leg it walks
to the grab spot and presses E once (`zipGrab`); riding, it doesn't plan or
steer (the line carries it), and the match drops any E or jump from a riding
bot, so a stray press can't let go. A team line is shut to other teams' bots
(`pathBlocked`, as a switched-off portal).

## Squads (clusters)

In team matches of 16+ players (Team Deathmatch and other modes without an
objective of their own; objective modes send bots to the objective), the
director groups each side's free bots into squads once a second
(`BotDirector.update`):

- free: alive Player Bot on foot playing the squad role, under nobody's
  orders (a player's "Follow me!"/"Hold here!" wins);
- a bot joins a squad with room whose leader is within 30 m, or gathers the
  free bots within 25 m into a new one; 4–6 a squad by the side's size; a
  squad of one breaks up;
- the leader is the member with the most team loyalty and tactical sense
  (TACTICAL +20; a COWARD leads only a squad of cowards); the team's leader (rules.leaders) always leads
  its squad; a member more than 60 m from its leader leaves;
- the squad picks a goal, half the time an enemy spawn point no other squad
  of the side is heading for, otherwise a region the side hasn't seen lately
  (toward the enemy, where the side met the enemy, not another squad's;
  claimed for its duration), and a route (left, straight or right, different
  between squads); it picks again when the leader is within 12 m of it or
  after 20–35 s.

Members take the squad's goal and route as their own (`BotBrain`, advance).
A member more than 28 m from its leader goes to the leader first (regroups,
until back within 15 m); one that has got ahead of the leader eases off; the
leader slows when someone lags. Squads go single file: a member with a
teammate within 2.6 m ahead of it waits a moment (doorways and bridges
jammed otherwise), and members within 8 m of the squad's goal wait there
for the next one instead of crowding onto the spot. Fights break the squad up naturally (engaging, cover, chase
are per bot); when the leader is fighting, members within 45 m who aren't
are told where its enemy is (`alert`) and close in. Squads keep 3.5 m apart
(grunts 2 m).

## Riding, and pushing with a leader (November 2026)

Two owner reports from 2 Nov, both fixed at the cause (`bots/brain.ts`,
`bots/director.ts`):

**Riders got out as soon as the driver set off.** A teammate bot riding in
someone's vehicle (passenger or gunner seat) gets out when the vehicle is
"parked": stood still 8 s (`RIDE_PARKED_SECONDS`) with nothing to shoot. The
idle clock is `-Infinity` while the vehicle moves, and the check only looked
at the gap from it, so every moving vehicle read as parked for good: riders
pressed E about a second after the driver pulled away (and hopped back in
when it stopped). Now only a vehicle that has really stood still counts.
Riders stay while a teammate drives; they get out when it burns or is about
to blow, when it has been parked 8 s, or when a bot at the wheel has got it
stuck. A bot driver that is getting nowhere while moving (circling a spot it
can't drive out of, a boat at a shore it can't climb) gives up too: the
route left must shrink by 10 m every 12 s (`DRIVE_MIN_PROGRESS`,
`DRIVE_PROGRESS_SECONDS`), or it gets out and leaves that vehicle alone a
while, as when stuck. `test/botRiders.test.ts`: a player drives two bots
over Iron Maw for 60 s (stops included): they stay; on fire, or wrecked to a
quarter, both are out within 1.5 s; parked, they leave after 8 s.

**A wedged Dropship drew bots back again and again** (owner, Shingle Point, 2026-11-07: "a bot seemed to try and get
in, would turn around and seem to leave but turn back around"). A bot had flown it into a landing craft wreck's hull
and left it there turned across it; its nose and tail (4.8 m from its centre) poked out past its enter radius (4.5 m)
and its sides were inside the hull, so nobody could get in, and bots kept planning it, walking up, giving up when the
plan ran out (30 s away) and coming back. Now (`bots/vehicles.ts`, `sim/mounts.ts enterReach`, `sim/match.ts`):
bots walk to a spot just off the hull on their side (`boardingSpot`, not its centre) and press E when the match's own
rule says they can get in (`inBoardingReach`: within the enter radius of the centre or 1.6 m of the hull); use pressed
and still not in 0.25 s later is a failed boarding, and two at one mount (`MAX_BOARD_FAILS`) give up on it; no route
to the spot gives up at once; each give-up on the same mount leaves it alone twice as long (`avoidSeconds`: 30, 60,
120, 240 s); and a vehicle the match sees driven and going nowhere for 3 s is `wedged` for every bot (`vehicleFor`,
`rideFor` skip it) until it has moved 3 m. Flyers driven into something they can't pass climb over it on their own
(`climbAssist`) and settle back to their height after, so a bot pilot no longer wedges one. `bot-report` prints
"boarding: tries, failed, given up on, back to one given up on" per match; `test/vehicleWedge.test.ts`.

**Tactical squads with a leader stood about or went back and forth.** Found
by measuring (both teams: first contact, progress from the side's base to
the enemy's, share of time standing still out of a fight, share of time
walking in circles: over 30 m walked in 20 s, under 8 m from the start; kills
and deaths a minute):

- *Unreachable pickups.* The pickup check every 2 s sent a bot straight back
  to an item it had just given up on (stuck three times by it), and nothing
  remembered it across a respawn. On Shingle Point the assault side's
  squads stood at their spawn walking into the wall of the sunken bunker
  round the rocket launcher (43 stuck recoveries for one bot in 60 s; the
  squad waited on its leader). A pickup a bot gets stuck going for, or has
  no route to, is now left alone for 90 s (`PICKUP_GIVE_UP_SECONDS`, up to
  8 remembered, kept across respawns).
- *The squad's goal after a detour.* A member or the leader that went for a
  pickup (or reached or lost its goal) then picked a goal of its own until
  the squad picked its next one: the leader one way, the members another,
  regrouping back and forth. It now goes back to the squad's goal; a squad
  goal it has no route to is left for 20 s (its own goals meanwhile).
- *Goals swapped on the timer.* A squad re-picked its goal every 20–35 s
  even while closing on it; on a big map half its goals are an enemy spawn
  hundreds of metres off, so squads zig-zagged between far goals. A squad
  still 15 m (`GOAL_PROGRESS`) nearer its goal when the time is up keeps it
  for another 15–25 s; a squad also counts as there when half its members
  are within 12 m (they no longer wait out the timer for a leader held up in
  a fight).

Measured, 24 tactical bots with team leaders, 120 s, before (main 8bc4001)
→ after, per side (first / second team):

| Map, seeds | first contact s | idle out of a fight % | looping % | progress (0 own base, 1 enemy's) | kills/min | deaths/min |
|---|---|---|---|---|---|---|
| Shingle Point TDM, 1–3 | 15.5 / 15.2 → 15.5 / 15.2 | 28.3 / 8.8 → 11.6 / 10.5 | 2.9 / 4.7 → 4.0 / 3.5 | 0.18 / 0.32 → 0.23 / 0.30 | 2.8 / 4.5 → 2.7 / 4.2 | 5.3 / 3.0 → 5.7 / 3.0 |
| Iron Maw TDM, 1–3 | 28.3 / 28.0 → 28.9 / 29.8 | 4.4 / 5.0 → 6.8 / 7.0 | 2.6 / 5.4 → 2.9 / 2.7 | 0.33 / 0.23 → 0.36 / 0.28 | 5.5 / 6.7 → 6.3 / 5.3 | 6.7 / 5.7 → 5.5 / 6.5 |
| Iron Maw TDM, 4–6 | 26.4 / 25.7 → 26.6 / 25.9 | 5.6 / 4.5 → 4.3 / 7.9 | 3.9 / 2.3 → 2.9 / 4.5 | 0.28 / 0.21 → 0.37 / 0.24 | 5.0 / 5.3 → 3.7 / 4.2 | 5.7 / 5.0 → 4.5 / 3.7 |
| Iron Maw CTF, 1–3 | 16.6 / 16.5 → 16.6 / 16.5 | 22.1 / 27.6 → 19.6 / 27.9 | 3.8 / 2.2 → 3.9 / 2.9 | 0.18 / 0.27 → 0.19 / 0.28 | 6.7 / 7.7 → 6.7 / 7.7 | 7.7 / 6.7 → 8.0 / 6.7 |

Kills a minute are few events (±20 % between runs of the same code); CTF has
no squads (objective modes send bots to the objective) and barely moves.
Not suicidal: the assault side's extra deaths on Shingle Point are the
garrison's sentries on the bluff it now reaches (7 in three matches, 3
before). Stuck recoveries on Shingle Point 266 → 121–166 a match. A player
leading ("Follow me!" / "Hold here!") was checked too: bots hold or follow as
ordered, no circling round the leader. `test/botPush.test.ts` (Shingle Point,
10 v 10, 60 s, seed 1, both sides: contact within 30 s, idle under 20 %,
looping under 10 %, worst bot under 16 stuck recoveries, progress, kills; it
fails on main: idle 31 %, 26 stuck recoveries); `botRoles.test.ts` "squad
goals". Cost: a few comparisons per think; 96 bots on Frost Basin, CPU a tick
9.75 / 9.16 ms after vs 9.28 / 9.28 before (two runs each, alternating, load
13–15 on 4 cores: noise).

## Hopping

ARENA bots hop to be harder to hit (`arenaHop`, `bots/brain.ts`):

- **Arena style** (match setup or a bot set entry): constant bunny-hopping
  while they strafe or run, every 0.5–1.1 s.
- **Mixed style**: ARENA characters (Pathfinder and others) hop only in a
  fight (a target, or shot at in the last 1.5 s), only while strafing, and
  less often (every 1.3–2.4 s).

## Roles

Roles are handed out per match (`assignRoles`), deterministic by slot and
seed, as a capped share of the Player Bots for the match's bot style, tags
first, then the personalities that suit the role:

| Role | Mixed | Arena | Tactical | Who |
|---|---|---|---|---|
| Camper | 8 % | 3 % | 14 % | CAMPER, then careful, unaggressive, unadventurous bots (never BERSERKER or RECKLESS) |
| Sniper | 10 % | 5 % | 14 % | SNIPER, then range preference 80+ (never BERSERKER) |
| Lone wolf | 10 % | 12 % | 6 % | LONE_WOLF, then EXPLORER, then exploration 75+ with low team loyalty |
| Squad | the rest | | | |

Matches with fewer than 6 Player Bots have no roles (duels play as before).
New tags on the roster: the Wealthy Otter is a CAMPER, the
Drifter and the Tracker LONE_WOLFs.

**Vantage spots** (`vantage.ts`) are worked out once per map (cached by the
navmesh's fingerprint, so the next match on the map reuses them): 640 of the
navmesh's places, 8 sight lines each (about 5,000 rays). Sniper spots see 40
m+ down their best sector (higher ground and a wall behind score more);
camp spots have walls close on 2–5 sides and a 10–55 m view. The best 36 of
each, 14 m apart. A bot claims a spot while it uses it.

- **Camper**: out of a fight, with nowhere it was sent, takes the best free
  camp spot within 75 m (team modes: between the bases, never by the enemy's
  spawn), holds it crouched, sweeping its sightline, for 18–35 s (tactical
  25–45, arena 10–18), fights from it, doesn't chase anyone who slips away
  unless they're within 10 m, and leaves when the time is up or when
  flushed (hurt there, or shot at by someone it can't see). On the way there
  it doesn't chase noises or enemies that slipped away (beyond 10 m). Then
  it roams
  for 45–75 s (tactical 35–65, arena 60–90) before camping again: campers
  are a minority and never camp all match.
- **Sniper**: the same with sniper spots (within 110 m), only while carrying
  a scoped gun with rounds (it goes for one first: "Snipers" below); prone
  with the scope, holds 25–50 s, takes calculated shots and moves on after
  two or three (another spot 1–3 s later), and leaves its spot within a
  second or so of a kill (mid-fight too), taking another one (never the
  same) 4–10 s later.
- **Lone wolf**: never in a squad; picks far, uncrowded regions, flanks wide.
- **Squad**: the rest; in squads in big team matches.

Existing tags now each play differently: BERSERKER rushes and never takes
cover (as before); COWARD gives up a fight at 80 % of its self-preservation
threshold (others 60 %), once hurt backs off shooting when it sees three or
more enemies, and is never a squad leader; SUPPRESSOR keeps firing where an enemy
went into cover (as before); GRUNT keeps tight squad spacing and doesn't mind
crowded regions; EXPLORER weighs unseen regions double; SNIPER and CAMPER
above.

## Shooting along a clear line

Every shot starts at the shooter's eye (`Match.fireNow`: hitscan, bullets and
projectiles alike), so a bot asks of that line, not just of its aim, before a
round goes (`BotBrain.clearShot`, asked by `AimModel.trigger` only when the
trigger discipline would fire):

- one ray from the eye along the bot's aim to 1.5 m short of the aim point
  (3 m for suppression; 0.7 of the splash radius for rockets). Clear: fire.
  A clear verdict is kept 3 ticks while the aim moves < 0.02 rad and the bot
  < 0.25 m, so sustained fire costs a ray every few ticks;
- blocked: hold fire 3 ticks (no rays meanwhile) and find out why, one or two
  more rays: the chest in the open → the wandering aim was on the rock, it
  halves its aim error (a person sees their crosshair on the rock); only the
  upper body clear → it aims at head and shoulders for 1.5 s; nothing of them
  clear → for about a second it stands up (from a crouch or prone), or,
  already standing, steps aside (and gives up a cover spot it can't shoot
  from);
- not checked: lobbed projectiles (they arc), melee, and targets in vehicles,
  on guns or that are gun emplacements (their bodies are what it shoots).

Eyes, sight lines, cover search and the aim point scale with body size (small
0.78, large 1.18; `CombatantView.size`), the same as the sim's. SUPPRESSOR
bots fire at the spot an enemy went out of sight for 1.5 s, only while the
rounds would reach it.

Found from the owner's Shingle Point screenshot (a gully boulder covered in
bullet holes): bots' aim error at range (normal: 0.05–0.15 rad at 40–55 m)
put a quarter of their trigger pulls into the world short of the target, and
a target behind waist-high cover drew fire at its hidden chest. Measured with
24 bots, eight seeds × 120 s of Team Deathmatch: pulls aimed into the world
short of the target 28.4 % → 8.2 %, rounds hitting a player 8.8 % → 10.5 %,
kills 206 → 201 (rounds fired 11,786 → 8,582); pulls aimed into the gully
boulders (`prop_490`–`prop_493`) 190 → 7. `test/botClearShot.test.ts`: a player behind a 1.3 m wall
(head and shoulders show) drew 93 rounds, 92 into the wall, before; now most
rounds hit.

## Capture the Flag (November 2026)

Owner's reports: "CTF: no bots are actually going for the flag, most just hang out and do little. We should only
have like 2–3 bots protect a flag and the rest are just going out there and trying to get the other team's";
Diamond Park, "most of the team hung out in the tunnel/dugout area". Measured with `pnpm bot-report` (below) over
every map that offers CTF, two seeds of five minutes each (numbers at the end of this section).

**What was wrong:**
- *Roles.* Every fourth bot of a team defended and every fourth escorted; teams of 12 and 16 had 3 and 4 defenders
  standing at their flag, spinning slowly in place ("station": 5–24 % of all bot time on the big maps).
- *The goal didn't stay in charge.* An attacker heading for the flag dropped it for any noise within 45 m (60 m for
  explosions) for up to 10 s, chased enemies that slipped out of sight for up to 8 s, took cover from anyone at 11 m
  and more, and stopped to trade shots at range. On Diamond Park attackers spent 22 % of their time going after
  noises and 9 % going to the flag. They never sprinted to it.
- *No captures once there.* A carrier ignored everything beyond 4 m and ran the shortest way home at 85 % speed,
  never sprinting; fresh respawns at the enemy's base, most of them within 15 m of its flag on the smaller maps,
  killed it within seconds.
- *Stuck where the navmesh is cut off* (see "Standing still").
- *Waiting carriers, lost flags, the plane.* A carrier home with its own flag away (no capture until it's back)
  stood on its base like a statue (Serene City: 143 s). A flag dropped into lava stayed there: nobody can touch it and
  live, so on Cinder Foundry one carrier after another took it and died in the pit (28 takes and drops in a match, no
  capture). Out of the transport plane the whole planeload, defenders too, jumped over the enemy flag and waited for
  the automatic opener (28 m over whatever is below): on Eagle Spires that left the attackers below the enemy mesa's
  top, on its cliffs, sliding down them for half a minute.
- Measured before: 17 of 88 matches had a capture (21 captures); Diamond Park 0.5 captures and 2.5 flag takes a
  match.

**Now** (`sim/modes/ctfBots.ts`, `CtfBotPlan`, worked out by the mode a few times a second, not per bot):
- **Roles** (owner): a team's Player Bots defend 3 strong on a team of 12 or more, 2 on a smaller one (1 on a team
  of two or three; a team of bots alone keeps an attacker), picked by who suits it (campers and snipers first, then
  the careful and unaggressive; rushers and roamers last). Everyone else attacks.
- **Situations first:** the carrier runs home; our flag dropped: the defenders and anyone within 22 m go and touch
  it; our flag carried off: the defenders and anyone within 22 m chase the carrier, and once our own carrier is home
  waiting on it, every attacker but its escorts too; enemies within 16 m of our flag at home: the defenders close
  in. A teammate carrying the enemy flag: the three attackers nearest it escort it (within 4 m), the rest come along
  further back (10 m).
- **Goals kept to** (`OrderGoal.push`, bots/brain.ts): an attacker, escort or responder turns aside only for a noise
  or an enemy that slipped away within 12 m (`PUSH_NOTICE`), takes cover only when hurt, low on ammo or reloading
  (not just for being shot at), leaves cover a second after losing sight of its enemy (2.5–5.5 s otherwise), and
  fights on the move: an enemy further than 9 m is shot at on the way, not stopped for. A far flag (50 m and more)
  is gone to by a lane of the bot's own (left, right or straight, once per goal and life, on the goal's own part of
  the navmesh), so a team's attackers don't all meet the enemy's head-on in one corridor. It sprints when the goal
  is more than 15 m off. A bot with only a sidearm (CTF starts with knife and pistol) grabs a gun within its detour
  (8–20 m by its objective priority) on the way.
- **Carriers run** (`OrderGoal.run`): they sprint home, never take cover or retreat, notice enemies within 15 m
  (`CARRIER_AWARENESS`, was 4) and shoot those within 12 m on the move. Home with their own flag away, they keep watch
  round the base (within 6 m, facing where their flag is) until it's back, then step onto the base and capture.
- **A flag dropped into lava goes home at once**, as one lost over the void does (`CtfMode.drop`; acid, which you can
  wade through, doesn't count). This is a rule change for players too.
- **Out of the plane** (`Match.planeBot`): a bot comes down where the mode sends it (a defender by its own flag), once
  play has begun and roles are handed out; it opens its canopy straight away when well above where it is going, and
  steers for it under the canopy (`BotBrain`, `CombatantView.chute`).
- **Defenders keep watch** round their flag (radius 9 m) toward the enemy's side (see "Standing still").

**Measured** (`pnpm bot-report --suite=ctf --seeds=1,2 --seconds=300`: every map that offers CTF, 44 maps, two
five-minute matches each, the map's own team sizes, all bots; before: main 39056920 with the measuring only; after:
`wip/bots-idle` e9bf9611, with main 5b167034's prop openings merged in):

| Suite, 88 matches | Before | After |
|---|---|---|
| Captures | 21 (0.24 a match) | 145 (1.65 a match) |
| Matches with a capture | 17 | 55 |
| Maps with a capture | 13 of 44 | 31 of 44 |
| Flag takes | 77 | 906 |
| Idle out of a fight (of alive time) | 17.9 % | 5.6 % |
| Frozen (out of a fight, not even turning) | 2.9 % | 0.9 % |
| Going to the goal (of goal time) | 15.9 % | 27.8 % |
| Idle spells of 10 s and more, a match | 19.0 | 2.7 |
| Longest idle spell | 300 s | 218 s (Primeval Park, a bot at a button) |
| Stuck recoveries, a match | 283 | 229 |
| No-route searches, a match | 545 | 614 |
| Kills a minute | 22.9 | 35.1 |

Per map (two matches each; seed noise is large at two matches):

| Map | captures a match | flag takes a match | idle out of a fight % | stuck recoveries a match | kills a minute |
|---|---|---|---|---|---|
| apex_ring | 1.5 → **4.0** | 2.0 → 9.0 | 10.0 → 2.9 | 146 → 124 | 17.2 → 25.0 |
| bunker_cross | 0.5 → **5.0** | 0.5 → 9.5 | 9.4 → 3.8 | 100 → 329 | 16.1 → 23.4 |
| capitol_mall | 0.0 → **0.0** | 0.0 → 0.0 | 27.4 → 9.0 | 469 → 367 | 33.7 → 46.8 |
| cinder_foundry | 0.0 → **0.0** | 0.0 → 7.0 | 15.9 → 4.7 | 84 → 108 | 21.7 → 26.5 |
| coldwater_gulch | 0.0 → **0.0** | 0.0 → 1.0 | 31.2 → 8.7 | 242 → 154 | 13.1 → 22.0 |
| diamond_park | 0.5 → **1.5** | 2.5 → 19.5 | 32.9 → 3.1 | 219 → 278 | 15.1 → 52.4 |
| dustwater | 0.0 → **3.5** | 0.0 → 14.5 | 11.1 → 3.0 | 127 → 110 | 16.4 → 31.9 |
| eagle_spires | 0.5 → **0.0** | 2.5 → 5.5 | 18.6 → 10.8 | 144 → 172 | 20.8 → 18.9 |
| fernwood_moon | 0.0 → **1.0** | 0.0 → 2.0 | 28.2 → 6.9 | 900 → 352 | 31.4 → 50.7 |
| flatpack_depot | 1.0 → **4.5** | 1.5 → 12.5 | 10.5 → 1.7 | 138 → 173 | 20.5 → 34.7 |
| fort_meadow | 0.0 → **0.0** | 0.0 → 0.5 | 3.9 → 0.8 | 6 → 10 | 35.2 → 38.1 |
| glacier_line | 0.5 → **1.5** | 1.5 → 11.5 | 11.3 → 1.4 | 129 → 181 | 29.9 → 46.6 |
| grand_marquee | 0.0 → **4.5** | 2.0 → 25.5 | 3.1 → 2.7 | 100 → 254 | 20.7 → 28.1 |
| iron_compound | 0.0 → **1.0** | 0.0 → 11.0 | 86.5 → 5.6 | 2068 → 297 | 0.0 → 30.1 |
| iron_maw | 0.0 → **0.5** | 0.0 → 1.0 | 24.2 → 5.8 | 308 → 131 | 28.3 → 43.2 |
| iron_tide | 0.0 → **0.0** | 2.5 → 20.5 | 15.2 → 4.7 | 802 → 386 | 20.4 → 30.9 |
| ironhold_prison | 0.0 → **2.0** | 0.5 → 12.5 | 9.0 → 9.6 | 148 → 148 | 22.7 → 32.5 |
| maple_court | 0.0 → **2.0** | 0.0 → 14.0 | 13.9 → 3.6 | 118 → 182 | 18.5 → 27.0 |
| market_town | 0.0 → **2.5** | 0.0 → 14.5 | 8.6 → 2.7 | 99 → 168 | 38.2 → 52.8 |
| neon_galleria | 0.0 → **1.5** | 0.0 → 12.5 | 11.3 → 1.8 | 103 → 144 | 16.2 → 30.3 |
| norman_shores | 0.0 → **0.0** | 0.0 → 3.0 | 24.2 → 10.3 | 96 → 114 | 16.2 → 19.3 |
| obsidian_orb | 1.0 → **5.0** | 3.5 → 10.5 | 17.1 → 12.2 | 524 → 238 | 32.6 → 59.2 |
| pantry_raid | 0.0 → **0.0** | 0.0 → 0.0 | 5.8 → 2.2 | 52 → 71 | 22.8 → 32.6 |
| pharaohs_reach | 0.0 → **2.5** | 0.0 → 12.0 | 10.1 → 3.3 | 54 → 188 | 18.6 → 25.0 |
| primeval_park | 0.0 → **0.0** | 0.0 → 0.0 | 30.2 → 12.9 | 172 → 94 | 17.4 → 27.9 |
| qasr_medina | 0.0 → **3.0** | 0.0 → 23.0 | 8.5 → 3.3 | 161 → 186 | 28.1 → 47.6 |
| rail_stockyard | 0.5 → **3.0** | 0.5 → 13.5 | 8.1 → 2.9 | 73 → 196 | 14.6 → 23.1 |
| riot_junction | 0.0 → **1.0** | 0.0 → 23.5 | 20.2 → 2.3 | 588 → 354 | 30.3 → 47.9 |
| runway_nine | 1.5 → **1.5** | 3.0 → 23.5 | 2.1 → 2.4 | 164 → 254 | 32.3 → 39.6 |
| saltmarsh_harbor | 0.0 → **0.0** | 0.0 → 2.0 | 22.0 → 4.6 | 657 → 614 | 22.7 → 39.0 |
| sandfall_colosseum | 0.5 → **4.5** | 1.5 → 21.0 | 9.3 → 9.0 | 246 → 266 | 21.8 → 28.4 |
| serene_city | 0.5 → **4.0** | 1.5 → 43.0 | 7.2 → 4.7 | 260 → 236 | 36.3 → 59.0 |
| serpent_gorge | 0.0 → **2.5** | 1.0 → 10.0 | 6.5 → 4.3 | 258 → 396 | 20.8 → 33.2 |
| st_johns | 0.0 → **0.5** | 0.0 → 2.5 | 23.9 → 7.6 | 52 → 77 | 22.2 → 31.0 |
| sunken_kingdom | 0.0 → **2.0** | 0.5 → 15.5 | 17.3 → 1.4 | 190 → 188 | 33.6 → 46.7 |
| sunstone_crag | 0.0 → **0.5** | 0.5 → 5.0 | 24.6 → 6.0 | 356 → 186 | 28.9 → 35.4 |
| twin_spires | 0.0 → **0.0** | 0.0 → 0.0 | 11.9 → 3.8 | 62 → 103 | 23.6 → 33.4 |
| underdrain | 0.0 → **0.0** | 0.0 → 0.0 | 33.0 → 14.4 | 209 → 106 | 11.3 → 21.6 |
| vinefall_sanctum | 1.5 → **2.5** | 6.5 → 12.5 | 9.2 → 6.7 | 186 → 407 | 22.4 → 31.3 |
| whiteout_station | 0.0 → **0.5** | 0.0 → 7.5 | 13.6 → 2.7 | 238 → 387 | 32.3 → 49.4 |

Still without a capture: Capitol Mall (249 m between the flags), Coldwater Gulch, Eagle Spires, Fort
Meadow (a midfield brawl), Saltmarsh Harbor, Twin Spires, Cinder Foundry, Midnight Keel, Norman Shores, Pantry Raid,
Primeval Park, Underdrain. Most have flag takes now and lose the carrier on the way home; Capitol Mall, Twin Spires,
Pantry Raid, Primeval Park and Underdrain have none: the attackers die on the way (group pushes are
BOT_AI_PLAN.md Phase B). Eagle Spires still strands bots on ledges of its mesas' cliffs and scaffolds (no route
down: a drop is never a route), Primeval Park has bots standing at a button that doesn't open their way (up to
218 s).

Other modes, same code (two matches of four minutes each unless one is shown): Team Deathmatch on Fernwood Moon
idle out of a fight 23.0 → 7.6 %, frozen 11.9 → 0.6 %, kills 29.5 → 33.1 a minute; Riot Junction 9.4 → 4.5 %,
stuck recoveries 471 → 185, kills 28.8 → 27.4; Frost Basin 12.6 → 4.4 %, frozen 9.3 → 1.3 %, kills 10.5 → 13.3.
King of the Hill (one match): Diamond Park 3.9 → 2.1 %, kills 26.8 → 31.3; Iron Maw 10.4 → 6.0 %, stuck
recoveries 309 → 63. Bomb on Diamond Park: 25.9 → 10.2 %, frozen 10.7 → 0.1 %, kills 7.9 → 10.4.

Cost (`pnpm bench:96:clump`, 96 bots, Team Deathmatch, before and after run side by side on a loaded 4-core box,
load 9.5): bot thinking 1.46–2.04 ms a tick before, 1.54–2.12 after (Norman Shores spread 1.96 → 2.12, clumped
2.04 → 2.07; Frost Basin 1.89 → 2.11 and 1.83 → 1.72; Riot Junction 1.48 → 1.54 and 1.46 → 1.63), within the
2.5 ms budget. (An earlier pair at load 15 read 1.46–2.14 and 1.67–2.54.)

## Standing still (November 2026)

Owner's report (Fernwood Moon, free camera): "why would some bots not be moving at all?" A bot now stands still
only when it holds a spot on purpose, and then it looks alive. Measured over the CTF suite and Team Deathmatch;
the causes, each fixed where it starts:

- **Cut-off patches of navmesh.** The navmesh keeps 0.8 m from walls and steps 0.3 m. (0.8, not the 0.6 its
  comment means, body radius 0.4 + 0.2: (0.4 + 0.2) / 0.2 is 3.0000000000000004 in floating point and rounds up to
  four 0.2 m cells. Left as it is: every map's navmesh and the bots' corner clearance depend on it; BOT_AI_PLAN.md
  Phase A.) A low roof over a step, a narrow strip or a pool's rim leave patches players walk off that have no route
  out: Diamond Park's two dugouts (three of each team's spawn points in each: bots spawning there stood until killed,
  and teammates spawned beside them), Capitol Mall's reflecting pool. The dugouts were the map's: their roofs ran
  1.6 m over the side walls' tops at the dugout ends, so a standing player (1.8 m) couldn't walk under them there,
  and the only standing way out, the 1.2 m strip in front of the roof, is narrower than the navmesh needs (1.6 m).
  The roofs are 0.4 m higher now (MapMaker; validate-map's 113 warnings on the map are gone). `NavWorld` now labels
  the navmesh's connected parts once (about 15 ms on a big map; a search across parts answers at once instead of
  exploring everything reachable), and `escapes()` finds, for a point on a smaller part than its goal's, up to three
  places within 14 m on the goal's part that a straight step or hop of up to 8 m reaches (nothing in the way at
  knee or head height, rising at most 1.1 m). The bot walks to its patch's edge and crosses, hopping when held up
  (`planEscape`); a crossing not made in 8 s is left alone for 30 s.
- **A goal no route reaches** (a flag on a ledge, something on a roof, a carrier in the air): the bot goes as near
  as a route gets (`NavWorld.reachToward`, Detour's partial route, cached per part and goal) and keeps watch there
  facing it, rather than standing with "no route" until the flag goes home. The route is asked for again as the
  no-route back-off allows (0.2 s doubling to 4 s, from about the same place), and each time the bot also looks for a
  way off a cut-off patch, a button that opens the way and a lead nearer: Obsidian Orb's bots stranded on its
  reactor platform get off it so. (A route to a watch place used to clear the goal's back-off, and the watch was
  dropped every tick: Eagle Spires' attackers stood below the mesas asking 30 000 times a match. A version that
  watched for 4 s between asks took none of Obsidian Orb's flags in two matches, against 5 a match.)
- **Spawned inside something solid.** Sandfall Colosseum's spawn_269 stood inside the stand's steps: a bot spawned
  there stood all match (300 s). Moved in MapMaker; validate-map and MapMaker now warn (`spawn.blocked`: the spawn
  point's middle is inside a collider). 26 spawn points on 18 maps are inside collision by that check, most against
  or in a wall the body is pushed out of (HANDOFF lists them).
- **Doors shut to the bot.** A route through a door no button opens for the bot's team emptied its path: Fernwood
  Moon's Garrison spawns inside its bunker, and the shortest way out is the blast door only the attackers open; its
  own rear door was a few steps away. Doors and path-blocking walls are now navmesh flags (`markOpenings`, the
  polygons under each), and such a route is asked for again keeping out of the shut ones (`findPath(…, shut)`).
  Fernwood's reactor core was moved 0.5 m (MapMaker) so the strip behind it, in front of the rear door, is 1.9 m
  wide, not 1.4: wider than the 1.6 m the navmesh needs.
- **Doors that flap.** Several bots heading for one shut door each set off to press its button, and kept the plan
  after the first opened it: a toggle button shut it again. A press plan is dropped once its door no longer blocks.
  (Iron Compound's gate was also broken for players: its two rules on one press, "open if shut" and "shut if open",
  both ran, since rules run in order. Fixed in MapMaker; validate-map and MapMaker now warn, `logic.undoes`.)
- **Stuck on the same spot** (a dropship parked on the route, the corner of Fernwood's landing pad): after three
  stuck recoveries in 10 s within 4 m, the bot takes a few steps to one side (3–5 m, on a short route) before going
  on (`planSidestep`); before, a bot sent somewhere had nothing to give up and walked into the obstacle for minutes.
  Vehicles: a plan to get in that runs out leaves that vehicle alone for 30 s, and bots press E within the match's
  whole enter radius (a big hull kept them from getting within 80 % of it).
- **Holding a spot looks alive** (`keepWatch`): a bot on station (a defender by its flag, an escort, a bot told to
  hold, a squad member waiting on its squad's next goal, a bot waiting near a goal it can't reach) walks to another
  place round the spot every 2.5–11 s (in sight of its middle, toward where the enemy comes from, on the spot's own
  part of the navmesh), watches that way with a slow sweep and a glance over its shoulder every 7 s, turns to a
  threat it knows of, and crouches and stands again. Campers on a vantage post shift a step to one side and back and
  stand up to look over their cover; snipers lying on their scope only sweep. Bots waiting for or riding a lift look
  about instead of at the shaft.
- **Lanes and places checked.** Lane waypoints and keep-watch places are taken only on the goal's own part of the
  navmesh (a sample on a roof sent bots nowhere), and a failed search backs off only near where it failed (one made
  on a moving lift said nothing about the lift's top).

`BotBrain.doing` says what a bot did on its last think and so why it stood still when it did; `pnpm bot-report`
reads it.

## Navigation audit (November 2026, BOT_AI_PLAN.md Phase A)

What bots can get to and out of, worked out from every polygon of the navmesh, not just from the first spawn point
(`nav/audit.ts` `auditNavigation`; `pnpm nav-audit [maps] [--pictures=dir]`; validate-map, the all-maps test and
MapMaker's validator run it on the navmesh as the match builds it, `sim/mapNav.ts`):

- **Routes** are the navmesh's links between polygons, one way: walking, and the off-mesh links (jump pads, ladders,
  portals, ziplines, lifts, ledge drops). A jump pad's flight comes down on the scenario's solids too (crumbling and
  breakable blocks, breakable props: the navmesh is built with them; Erosion's corner pads land on its crumbling
  decks). **Falls** are where a body walks off the walkable ground onto lower ground, traced against the level:
  nothing in the way at step, knee and head height, and room for a standing body (0.35 m round, from over a step to
  its head) all the way to the edge and just past it (rails, bars and lattices the rays slip between stop it: Bunker
  Cross's galleries have rails 0.1, 1.5 and 2.9 m over the floor, and its outer yard read as a 3,250 m² trap), then
  down. A landing is the navmesh polygon close below where the body comes down, not one beyond a wall from it (Rail
  Stockyard's ramp has slots down its sides whose floor is the underpass on the wall's far side). Landings in lava or
  deep water are left out: a bot there swims or drowns, it doesn't walk. Falls are how bots end up somewhere without
  a route there (knocked, pushed, a missed step); they aren't routes.
- **The main area**: the component of routes (polygons that all route to each other) the most spawn points reach and
  are reached from (both ways: a team's base bots jump-pad up into and can't route down from isn't it).
- **A trap**: a patch bots get into from where they spawn (falling, a one-way link, a jump pad) that doesn't route to
  the main area, and that the bots' own hop off a cut-off patch (`NavWorld.escapes`: a step or hop up to 1.4 m,
  within 8 m, onto ground that routes to the main area; below) doesn't get out of either. One with a fall out is a
  ledge with no way down (the drop links below fix those); one without is a pit nobody gets out of: the map's to
  fix. The hop's ways across are the place samples near the patch (7 m apart), those joined both ways to the goal's
  ground first (not a walkway whose way on is a drop link at its far end), then, when they give none, the goal's own
  ground nearest the patch (a sump or gully a couple of metres from any sample).
- **Cut off**: a spawn point that doesn't route to the main area (`nav.disconnected`), an objective (flag base, hill,
  bomb site, hostage, rescue zone) some team's spawn points don't route to, a pickup no spawn point routes to
  (`nav.<kind>_unreachable`). "Routes to" is as bots get there: to the place, to within a step off the navmesh of
  it (a pickup on a crate, a flag on a prop; below), or by a hop from where routes get onto ground that routes there
  (M4 Outpost's uplink dais, a 0.75 m step 1.5 m from the gate's wall).
- **Severity**: errors on the official maps (maps/: validate-map and the all-maps test fail), warnings for creators
  in MapMaker. Findings left on official maps for the owner are listed with why in `nav/auditKnown.ts` (warnings).
- **Pictures** (`pnpm nav-audit --pictures=dir`; the nightly scorecard's artifact, with where searches failed): the
  navmesh top-down, the main area shaded by height, one-way areas teal, traps red, islands (patches nobody gets to:
  roofs, prop tops) purple, links yellow, drop links orange, spawn points green, objectives yellow, pickups cyan,
  failed searches magenta.

Generation bugs it found, fixed in code:
- **Floors inside solid boxes.** Recast rasterizes surfaces, not volumes: inside a closed box at least a body's height
  tall, the floor reads as open ground. Eagle Spires' two spires (stacked 2 m rock blocks) had a patch inside every
  block, 7,000 m² in all; falls and goals snapped onto them, and the audit saw traps there. A ground polygon with no
  room to stand over its surface at its middle and at most points part way to its corners now gets flags 0 at build
  (`NavWorld.disableInsideSolid`), which every search and nearest-polygon lookup leaves out. The surface is the
  detail mesh's height there (kept within the polygon's corners' heights: a sliver's detail mesh can read metres off),
  not the corners' average: on terrain that is often half a metre or more under a rise, and the first version of the
  check took thousands of square metres of open hillside out of every route (Frost Basin 17,550 m², Sunstone Crag
  23,400, Iron Maw 16,000, Coldwater Gulch 15,300, Sandgate 15,000; with it, the audit's errors on the official maps
  went from 148 to 36).
- **Ledges with no way down** (Eagle Spires' cliff ledges, roofs and scaffolds bots fall or pad onto, Bunker Cross's
  base roofs): one-way **ledge-drop links**, brought forward from Phase C, generated at load (`audit.ts` `trapExits`,
  `NavWorld.build` `drops`): from each patch that doesn't route to the main area, up to three falls onto ground that
  does (lowest first, 4 m apart), then again from patches those now lead out of. A long patch (a walkway along a pool,
  a gallery: its open edges over 48 m round) gets one per 16 m of them, 8 m apart, up to 12 (Capitol Mall's pool rim
  sent its bots 30 m to its one drop at the far end). A fall that lands on ground too steep to stand on (Frost
  Basin's ice ridge, a rock's flank) goes on to the navmesh at the slope's foot it slides to (within 8 m, downhill all
  the way, nothing in the way; the audit's own falls into places stop where they land). Within fall damage: with it
  on, only drops that cost at most about 30 health (8.3 m at normal gravity, `DROP_HURTS_UP_TO`); with it off, any drop
  onto the navmesh. Not into lava or deep water. A map without such patches gets none, and its navmesh is the same as
  before.
- **Falls that weren't** (above): through rails and lattices a body can't pass (Bunker Cross's outer yard), and onto
  a floor beyond a wall (Rail Stockyard's two "pits"). Each check runs only for an edge that does drop, so the audit
  got faster, not slower (the scenario's solid boxes' bounds are worked out once per list: Iron Maw's audit 543 → 264
  ms).

**Where the official maps stand** (`pnpm nav-audit`, 90 maps; the pictures are the nightly's `bots-report` artifact):

| | Errors | Traps | Maps with findings |
|---|---|---|---|
| Start of this round (after the drop links and the inside-solid fix) | 28 | 21 | 14 |
| Now | 0 (15 findings listed, warnings) | 11 | 9 |

Fixed: Bunker Cross's yard and Rail Stockyard's slots (the audit's falls, above); St John's court (a 0.4 m curb at its
ramp's foot), Undergate Transit's four track beds and Sunken Kingdom's sunken patch (1.4 m down: bots hop out, the
legs tucked up) and three of M4 Outpost's five pickups (onto the uplink dais) by the bots' hops (below); Dune Harbor's
(since deleted) aisle between two consoles, whose end was 1.3 m from the ramp (MapMaker: the consoles 1.2 m shorter). Listed for the
owner in `nav/auditKnown.ts`, each with why: Skyward's four pad perches and the two spawn points on its towers and Sky
Islands' sky platform (one-way by design: "ride the pads up... fall off and you are gone"); Grand Marquee's marquee
top (the street pad throws you up, nothing gets you down); Obsidian Orb's reactor shaft (its core's box rose to 3.8 m
under the bridges; since the slack pass the core collides as its shape, so a fall goes past it to the shaft's floor
32 m down, above the kill height, though the map's shaft is "bottomless"); Reactor's yard outside the plant (off a roof
corner, no way back in); Serpent Gorge's gorge floor along the river and slivers by its crypt's walls; Erosion's lower
deck (its corner pads stand on pillars that meet the deck only at a corner); M4 Outpost's last two pickups (the
uplink room's 1.5-2 m gaps round the dais, too narrow for the navmesh). The Skyward, Grand Marquee, Obsidian Orb,
Reactor, Serpent Gorge and Erosion places strand players too; each entry says what would fix it in MapMaker.

**Navmesh clearance: 0.8 m, kept.** The code meant 0.6 m from walls and edges (the body's 0.4 and 0.2, so
corner-cutting bots don't snag door frames) and built 0.8 (`Math.ceil((0.4 + 0.2) / 0.2)` is four cells: in floating
point the quotient is 3.0000000000000004). Every tile's stairs, towers and doorways were built and tested against 0.8,
and 0.6 is worse there: Recast breaks the narrow switchback flights of the Desert, Jungle, Medieval and Snow watch
towers and the Desert outside stair into scraps it drops (nine of the tile packs' reach tests fail; the towers' sniper
perches on Qasr Medina, Market Town, Whiteout Station and Vinefall Sanctum were cut off). 0.6 opens doorways and steps
1.2–1.6 m wide (M4 Outpost's uplink dais), and on the CTF suite (one seed of 180 s, the 32 maps both runs finished)
it gave fewer stuck recoveries (3.08 → 2.54 a bot-minute) and a little less idling, but more failed searches (0.13 →
0.17 %), fewer matches with a capture (15 → 14) and the same captures (table in BOT_AI_PLAN.md, "Phase A, measured"):
not better on the measures that count, and worse for the tiles, so 0.8 stays (`NAV_RADIUS_CELLS`, its comment says
why). Narrow passages are Phase C's; the bots' hops (below) get them over a step or gap the navmesh misses.

## Never standing still on a failed route (Phase A)

A failed search used to back the bot off 0.2 s, doubling to 4 s, standing still meanwhile (`followPathNow`). Now:
- **A goal no route reaches** (exact: `NavWorld.routable` knows each polygon's component of routes and what routes
  from it reach, so there is no search for what can't be reached) is swapped for a **stand-in**, the place nearest it
  a route from the bot does reach (`NavWorld.standIn`; a flag on a ledge: below it; a carrier in the air: under it),
  remembered per component of routes and goal for the match. Within a step off the navmesh of the goal (2.2 m, in
  the clear: a pickup on a crate, a flag on a prop) the bot walks the last bit straight there. At a stand-in a bot
  sent somewhere keeps watch facing the goal, asking again each second (`outOfReach`).
- **A bot off the navmesh** (knocked onto a narrow ledge or a cliff face, spawned badly) walks to the nearest polygon
  first, level or below, up to 60 m down (`NavWorld.wayOnto`).
- **Detour's partial route**: a search that runs out of nodes on a very long way gives back the corridor as far as it
  got; the bot walks it and asks again. With doors shut to it and no button to open them, as near the goal as it gets
  this side of them (it waits there, keeping watch, for the door or a button to be ready).
- **Goals of its own are only picked where a route gets**: roam goals and lane waypoints (`pickAdvanceGoal`,
  `orderTarget`), pickups (one out of reach is dropped for 90 s and the next best taken; one a route reaches but none
  comes back from, on a perch a jump pad throws you onto or in a pit, isn't taken at all: Skyward's and Sky Islands'
  perches), and the director's regions, squad lanes and campers' and snipers' vantage spots, which come from the main
  area's places (`NavWorld.mainPlaces`).
- **A hop off a cut-off patch keeps going** when a fight starts or the goal changes in mid-hop (before, the new
  route's stand-in on the patch pulled the bot back down: Capitol Mall's pool, 14 s instead of 1.4).
- **Hops go by routes, one way** (`NavWorld.escapes`): a bot no route from which reaches its goal hops onto ground that
  does route there (routes as they go: drops, falls and one-way links one way). It used to judge by the navmesh's
  connected parts, which count every link both ways, so a patch a one-way link led into was "joined" to the rest and
  never hopped off (St John's court: a 0.4 m curb at its ramp's foot). A bot on ground that routes to the main area
  hops only onto ground that routes back to it too: over a gap or step the navmesh is too cautious for (M4 Outpost's
  uplink dais, 1.5 m from the gate's wall), never down into a pit after a goal.
- **Up a ledge of up to 1.4 m** (`ESCAPE_RISE`): a jump clears about 1.1 m; a hop up a higher ledge tucks the legs up
  in the air (crouch while airborne, as players do, about 1.5 m; `tuckHop`). Undergate Transit's track beds and Sunken
  Kingdom's sunken patch, 1.4 m down, held bots that fell in.
- **Teammates push aside, not back** (`separate`): going somewhere out of a fight, the push from allies close by only
  steers a bot aside, at most as strongly as its way (0.8), never back; at a ladder's foot and on a ladder, none at
  all, since everyone goes through that one place (bodies don't block each other). In a fight, and round a lift, it
  stays as it was (spread out, bots die less: capping it in fights too cost a tenth of the CTF flag takes). The owner's
  playtest of Shingle Point (bots stuck at the feet of the seawall ladders, at the MG nest by hill 1, in the HQ):
  three or four bots at a ladder pushed each other off it for seconds, and two meeting in the MG nest's narrow way
  pushed each other back and forth. Shingle Point, King of the Hill, three seeds of 180 s: stuck recoveries 1.31 →
  0.80 a bot-minute, idle out of a fight 4.0 → 3.7 %; Bomb, two seeds: 1.41 → 0.46. Five CTF maps, eleven matches:
  2.31 → 2.01, idle spells of 10 s and more 3.5 → 1.0 a match, captures 5 → 8. The HQ is bomb site B: six of the
  defenders guard it (Bomb sends half to each site), and six bots keeping watch in one small room still trip over each
  other now and then; the playbook is Phase B's.
- **No route requests from a ladder** off the navmesh (as none in the air): a bot whose goal changes mid-climb carries
  on along it and asks off it. Fernwood Moon's vine ladder made hundreds of failed searches a match.
- **At a button, it looks at the button and presses** (`pressReach`): in reach, the turn to the button is the tick's
  only turn, from where the bot looked as the tick began, and it doesn't run. The look along its route, or running for
  its goal (an escort, a carrier's team), turned it level again every tick: the turns cancelled, and a bot under a
  console's button never faced it. It stands on the floor in front of the button where its route ends, not at the
  button's own height. Serene City's thaw console held eight bots for minutes once teammates stopped shoving each
  other about it (idle out of a fight 18.7 % of the match; CTF, two matches of 300 s, with both fixes: 3.1 %, no idle
  spell of 10 s; Iron Compound 15.5 → 9.9 %, its frozen time 11.4 → 5.2 %). Aiming at someone, it fights first.
- **A pickup it stands at and doesn't get is given up** (`refused`, 90 s like one it can't reach): within pickup reach
  of an item still lying there, the match offered it and it wasn't taken (a dropped spear the bot already has, its
  ammo full), and the next pickup check sent the bot straight back to it. Sandfall Colosseum, CTF, two matches of 300
  s: five bots round one dropped spear for half a minute; idle out of a fight 13.3 → 5.1 %, frozen 9.2 → 1.7 %, idle
  spells of 10 s and more 15.0 → 0.5 a match. Pharaoh's Reach: 6.3 → 1.3 %, 5.1 → 0.1 %, 5.0 → 0.
- **Spawning beside a teammate only on walkable ground** (`Match.squadSpawnSpot`, the navmesh within a step of both
  the teammate and the spot): a rider a vehicle left under one of Dune Harbor's (since deleted) street floors drew the squadmates
  spawning after it in with it, four a round.

Left for Phase C (found on the way): a mount's body isn't on the navmesh. Iron Compound's gantry MG turret
(`mount_148`) stands in the 1.6 m walkway with 0.8 m beside it, and bots coming back along the walkway walk into it
(most of Iron Compound's stuck recoveries, there before this round too); a bot's sidestep gets it round, but the
mode's goal sends it back along the same line. (A dropship landing beside Dune Harbor's sunken room left its riders
under the street floor; the map was deleted on 2026-11-09.)

## Smoke (November 2026)
The Smoke Grenade (docs/ARSENAL.md) hides whoever is behind a cloud. Bots see it as the match does: their sight lines
(target acquisition, `canSee`) and the match's own (sentries, arc turrets, homing, spawn safety: `Match.sees`) are
blocked by 1.6 m or more of a cloud (`smokeBlocks`, the clouds in `BotWorldView.smoke`); shots still pass through.
- **Using it:** a bot carrying smoke, caught in the open (no cover spot) by an enemy 10-45 m off and hurt (under 70
  health) or shot at, throws it a few metres toward the enemy (`considerSmoke`, then `smokeScreen`), so the cloud
  stands between them while it carries on; Tactical bots do it more often. Bots never throw smoke as a frag.
- **Crossing open ground:** bounding cover to cover ("Cover-to-cover advance", `boundPhase`), a bot of the moving half
  with no cover round it (it left its cover for one further on, or there is none) throws its smoke a few metres toward
  the enemy first, every time it carries some (no dice), and crosses under it. `BotBrain.smokeScreen(view, threat)`
  throws one toward a threat and says whether it could.
- **Who carries it:** a bot that picks up Smoke Grenades (`core.smoke_grenades`, placed on a map; random pickups roll
  only weapons), and in Breakthrough every attacking bot that moves up cover to cover (its playbook's `smoke`: the mode
  swaps its frags for smoke as it spawns; Arena bots and berserkers, who never bound, keep frags); the Military and
  Sci-fi weapon sets will hand it out (docs/WEAPON_SETS_PLAN.md).
- **Tests:** `smoke.test.ts` (a bot fires across an open yard and not through a cloud; a hurt bot in the open throws
  smoke between itself and the enemy; a Tactical bot bounding toward the enemy's flag across open ground sends smoke
  ahead, an Arena bot, which never bounds, doesn't).

## Scored choices (Bot AI Phase B)

With nobody in sight, a bot chooses what to do next by score (`bots/choices.ts`, a pure function the brain feeds about
ten times a second; BOT_AI_PLAN.md Phase B item 1): its goal (or roaming, without one), keeping up hide-and-peek behind
cover, running on from a threat, a pickup, an enemy that slipped out of sight, a noise. The best wins; the one chosen
last counts 0.25 more, so a bot doesn't dither between two. The brain's states stay the "how" (`BotBrain.choose`
applies the choice).

- **The goal**, by what it is: a carrier's run home 6 (above everything), a person's order 2.4, one to keep to (CTF
  attackers, escorts, an interceptor's cut-off point) 1.0, one to hold (a defender's flag) 0.9, any other (a hill,
  co-op's, Bomb's sites) 0.8; up to 0.3 more for bots that care for objectives. Roaming 0.3.
- **The old rules' order is kept** where it was measured and tuned: hide-and-peek in cover 2.9, a real gun when holding
  only a sidearm 2.75, running on from a threat 2.6, an enemy that slipped away 1.6-2.4 (more for persistent bots and
  fresh sightings), a noise 1.5-2.1 (more for aggressive and curious bots and fresh ones).
- **Leaving the goal costs** (`leaveCost`): a carrier never leaves its run; a person's order outweighs everything but
  cover and a gun (bots still fight what they see); on the way to an objective only what happens within 12 m draws a
  bot aside, as before; a bot holding a place looks into what happens within 12 m past its radius, less the further
  off, never a fight 30 m from it (a CTF defender stays by its flag; a bot on the hill stays on it).
- **New weights:** a hurt bot never chases and cares less for noises; one short of ammo less for a chase; one on its
  way to a goal takes the health, armour or ammo it needs within its detour (8-20 m by how much it cares for
  objectives).
- King of the Hill's goal is one to hold (it was pushed, in an earlier try): bots on the hill look into what happens
  near it, not gunfire across the map, and keep taking cover when shot at.

### Hurt bots retreat (measured, Phase C item 0)
A bot under its self-preservation share of its health (`BotBrain.hurt`: selfPreservation × 0.6 of full health, 0.8 for
cowards) retreats while it sees an enemy, to health if any is about, else away from the threat (the farthest spawn
point), and runs on 3 s after losing sight; with nobody in sight its scored choice is its objective again. Nothing
regenerates, so on maps without health a hurt bot does this until it dies. Seven ways of cutting the retreat short
(giving up after a few seconds, a life or a fight; fighting from cover instead; never leaving an objective it stands
in) all made the Breakthrough Range's attack worse, a lot (8 v 8: 5 to 9 breakthroughs in 12 against 11): hurt
attackers that stay die, and their deaths spend the pool. Kept as it is; the numbers are in BOT_AI_PLAN.md, "Phase C
item 0, measured".

## Parkour (Bot AI Phase C item 1)
At load the navmesh build (`NavWorld.build`, `nav/parkour.ts`) adds one-way links for the moves a player makes off the
walkable ground, so routes take them:
- **drop**: walking off a ledge onto ground below, no more than a fall that doesn't hurt (5 m at normal gravity);
- **gap**: a running jump across a gap (a metre or more of it, over ground at least a metre lower) onto ground about as
  high or up to 3 m lower, up to 5.5 m across;
- **up**: a jump up onto a ledge 0.45-1.8 m higher within a body's reach, the legs tucked up in the air (crouch while
  airborne, as players do) for the higher ones.

Candidates come from every open edge of the navmesh (every 1.5 m), and only where the move saves a real walk: the walk
round is 2.5 times the move or more and at least 9 m, or there is none within 60 m. Best savings first, each candidate
is **played through the real movement code** (`stepMovement`) with the inputs a bot gives (`parkourInput`: face the
link's way, run, sprint for a gap, jump at the takeoff, tuck in the air), from takeoffs a little before and past the edge;
the takeoff kept is one that also works 0.15 m early and late, for the standard body from the middle, a small body from
one side and a large one from the other (a drop: the standard body once). One link for a stretch of ledge (4 m apart);
none beside a candidate that failed. A link that would lead from ground that routes back to the main area onto ground that
doesn't (a pillar with no way off) is left out. At most 160 a map (50 drops, 80 of each jump), 240 candidates played; the
links are cached per navmesh, so the next match on the map reuses them. Lifts, rope lifts included, were links already
(`liftLinks`); moves players don't have (vaults, mantles) aren't made.

**Routes:** parkour links are navmesh area `PARKOUR_AREA`, which costs 1.6 times walking a metre, so a bot walks unless
the move saves a real walk; **agile** bots (flankers, the recon pair, snipers, the Arena style: `BotBrain.agile`, the
`findPath` `agile` flag) take them at walking's cost.

**Running one** (`BotBrain.parkourMove`): when its route's next leg is a link (`NavWorld.parkourAt`, the leg's corners
the link's start and end), the bot faces the link's way, runs (sprints for a gap: out of breath, it waits at the start
for its stamina), jumps at the takeoff and tucks in the air, with no shooting, scoping or stance meanwhile; the match
has it think every tick, and move in full detail, until it lands (its jump is timed to the tick). Down by the link's end
counts as made, anywhere else as missed. One it can't make (at it 4 s without going: 8 for a running jump; the clock
goes on across stuck recoveries) is given up and **switched off for everyone** for the match (`NavWorld.linkFailed`: its
navmesh polygon's flags to 0, bots plan again), and so is one missed three times (`bot-report`: links, made, missed, given
up). Links are played through with the scenario's window panes, door panels and breakable walls in the way (they join
the level only after the navmesh: a drop out through a window was made without its pane). A navmesh rebuilt mid-match
(Fort Wars' pieces) has none: playing them through would be a hitch, and over the forts' walls they took attackers off
the way to the flag.

**Snipers' spots others don't go to:** `NavWorld.parkourPlaces()` are the main area's places that walking and the map's
own links don't reach from the spawns, only parkour (a roof a jump gets onto). Vantage spots are looked for on them all,
on top of the spread-out samples, and a sniper spot there is worth 0.45 more (`bots/vantage.ts`; `bot-report`: spots
"only parkour reaches"). Few maps have such places: most roofs have stairs, or are higher than a jump.

**What it costs:** nothing a tick but bots on a link thinking every tick. At load, about 13 % more for the navmesh build
on ten big maps together (measured at load 11 on 4 cores; Qasr Medina, with its 280 drop candidates off flat roofs, the
most: a second or so).

## Bot hints (map data)
Map format v33 (BOT_AI_PLAN.md Phase D item 5; MapMaker overhaul Phase 4 item 3): places the map's maker marks for bots
in MapMaker (the Bot hints tool, Y). They are **map data on top of what bots work out themselves**: the computed spots
(vantage spots, parkour links) stay the default, and a map with no hints plays as before.

**What bots do with them** (Phase D item 5, `bots/hints.ts`; read once per match or per side, nothing per tick; a hint
with a `team` is that side's only, except jump links, which go into the shared navmesh for everyone):
- **sniper, camp**: vantage spots of their own (`hintSpots`, added to the match's `VantageBoard` with the computed
  ones), scored 2.6 (sniper) and 2.2 (camp) against the computed spots' 1-3, so a camper or sniper near one usually
  takes it. A computed spot of the same kind within 8 m of a hint gives way to it. Facing: the hint's, else the most
  open of eight directions. Only campers and snipers use them (the roles: "Roles").
- **staging**: a group of attackers gathers at the staging hint by its corridor (`stageHint`: within 14 m of the
  route and 40 m of the spot the team brain worked out, not nearer the objective than that spot by more than the
  hint's radius) instead of the computed one (teamBrain.ts `stageOn`).
- **choke**: a bot holding a spot near one (35 m, in sight) scans it (see "Holding a spot: the scan" below).
- **jump**: a parkour candidate before any computed one (`dropOptions` → `parkourLinks`), whatever walk it saves,
  played through the movement code like the rest: a hinted jump the movement can't make is left out (its two ends
  are taken on the navmesh within the hint checks' 1.2 m; its kind by the rise: up past a step, a running jump across
  1.5 m or more, else a drop). `parkourStats.hints` counts those given and made. Links are cached per navmesh and
  hints, so MapMaker's "What bots know" shows the hinted links too.

**The format** (`MapDocument.botHints`, `map/schema.ts` `BotHint`; absent: none; at most 256 a map):

| Field | What |
|---|---|
| `id` | a stable id (`hint_…`) |
| `kind` | `choke` (a chokepoint: a doorway, a bridge, a gap between buildings, worth holding or pushing through), `sniper` (a long-sight spot to hold), `camp` (a tucked-in spot to hold), `staging` (where a side gathers before a push), `jump` (a jump a player can make) |
| `position` | `[x, y, z]` world metres, on the ground or a floor (a jump link's start) |
| `to` | a jump link's landing `[x, y, z]`, on the ground; only jump links have it, and they always do |
| `yaw` | radians, as a spawn's (0 north, +z; `viewDirection`): the way through (choke), to watch (sniper, camp), to push (staging); absent: no particular way (jump links never have one: they run from `position` to `to`) |
| `radius` | metres, 0.5-40: how far round the spot counts (new ones: choke 4, sniper and camp 1.5, staging 6, jump 1) |
| `team` | a faction id, as a spawn's (`mapTeams`): only that team's bots use it; absent: every side's |

**Reading them** (read-only, `map/botHints.ts`, exported from the shared index): `mapBotHints(map, kind?, team?)` (a
team gets its own and every side's), `hintAt(h)` and `hintTo(h)` as `Vec3`, `BOT_HINT_SPECS` (labels, default radii,
whether the facing means something), `hintJumpReach(rise, gravity)` and `jumpTrouble(h, physics)` (the movement numbers'
verdict on a jump link). They are in the content hash: changing them changes the map.

**Checks** (warnings only; the hints are advice, bots do without): validateMap (`botHintIssues`): a spot or end outside
the map's boundary (`bothint.outside`), a jump link a player couldn't make by the movement numbers (`bothint.jump`: a
running jump at the map's gravity, the legs tucked for a ledge over the jump's own height, as parkour's jumps up; a metre's
slack for the two points; a drop that hurts with fall damage on), two of a kind and team within a metre (both ends, for
jump links: `bothint.duplicate`). The navigation validator (`validateMapNavigation`, MapMaker's and validate-map's):
a spot or end off the navmesh (`bothint.offNav`, more than 1.2 m across or 1.6 m up or down from it). Not "out of
reach": a jump link's landing is often ground only that jump gets to.

**What bots already know** (MapMaker's "What bots know", read-only): `validateMapNavigation(map, official, { computed:
true })` also returns `computed` (`ComputedBotSpots`): the vantage spots (`vantageFor` on the main area's places and the
parkour places, as the match works them out before the trips' lanes reweigh them) and the parkour links. Bots work out
no chokepoints or staging spots of their own today.

## Memory and callouts (Bot AI Phase D item 1)
Each bot keeps a small memory of its enemies (`bots/memory.ts` `EnemyMemory`, 8 entries, `BotBrain.enemies`): where
each was last seen, where shots at it came from, what it heard, and teammates' callouts, each for its skill tier's
`memorySeconds` (easy 8, normal 15, hard 25), across its lives. The dead are forgotten (checked once a second).
- **Callouts:** a bot that has someone in its sights says where (`CalloutBoard`, one per side in the director, a ring
  of 64; once every 2 s per caller and enemy at most). Teammates within their tier's `calloutRange` of the spot (easy
  25 m, normal 45, hard 60) take it into their memory at their next look about. Squad alerts (a leader's enemy, an
  order) still send squad members to look, as before.
- **What memory does:** it sends nobody anywhere (chasing and noises stay the scored choices', so objectives play as
  before). A bot holding a spot watches the freshest threat it remembers (a shot most: once its tier has turned to it,
  `shotTurnMs`); one on its way checks (pre-aims) a remembered spot within 30 m while it is within 75 degrees of the
  way it goes (not a flag carrier); a camper or sniper on its spot watches one within its view; and someone showing
  where it expected them is reacted to faster (see "Skill tiers").

## Holding a spot: the scan (Bot AI Phase D item 2)
On top of "Standing still"'s keeping watch (shifting between places round the spot, crouching, the glance over the
shoulder), a bot holding a spot with nothing to look at scans: the way it watches, then chokepoint hints near it, then
the two most open of eight ways (rays at eye height, once per place it stands; each angle at least 50 degrees from the
others), one at a time, dwelling on each for its tier's `scanDwell` (easy 3.2 s, normal 2.4, hard 1.6; ±25 %) with a
small sway. Where the way it watches is blocked within 2.5 m (a wall's corner beside it), it **peeks**: a step of
1.2 m to the side from which it is open, for one dwell in three, then back.

## Skill tiers (Bot AI Phase D item 3)
Easy, normal and hard differ in more than aim error (`BotDifficulty`, profile.ts; normal plays much as before):

| | easy | normal | hard |
|---|---|---|---|
| reaction (as before) | 650 ms | 380 ms | 220 ms |
| reaction varies by (each sighting) | ±40 % | ±25 % | ±15 % |
| someone showing outside its view | +60 % | +25 % | +10 % |
| someone showing where it expected them | - | -25 % | -45 % |
| memory | 8 s | 15 s | 25 s |
| callouts reach it from | 25 m | 45 m | 60 m |
| turns to an unseen shooter's rounds after | 700 ms | 350 ms | 150 ms |
| noise on its scored choices | ±0.35 | ±0.08 | none |
| dwells on each angle when holding | 3.2 s | 2.4 s | 1.6 s |

The noise on scored choices (choices.ts; MARGIN is 0.25) has an easy bot now and then do the second-best thing (chase
a noise instead of its goal, keep to cover a moment longer); a carrier's run home is never noisy. These draw from a
random stream of their own (`skillRng`), so the bot's other choices stay as they were by seed.

## Bot debug view (Bot AI Phase D item 4)
`?botdebug=1` on the page's address, in a match that runs in this browser (offline, MapMaker TEST, Host game: the
LocalTransport; not a guest's or a dedicated server's, and not while a friend plays in the hosted match: it shows
every bot through walls). Four times a second the match sends a frame (`Match.botDebugFrame`, `bots/debugView.ts`;
nothing runs while it is off), and the page (`game/botDebugView.ts`) draws:
- each bot's route in its team's colour, a thin line on to its goal, its remembered enemy spots (orange posts) and
  its scan's angles (cyan);
- every failed route search of the match (the latest 200): a red cross where it was going, a dark red line from where
  it asked;
- over each bot, its name, state and what it did on its last think (`BotBrain.doing`), the distance to its goal, and
  "stopped:" and why when it meant to stand or couldn't move;
- a panel: every bot's team, role, skill, state, what it did, its scored choice and top three scores, why it stopped,
  its failed searches and stuck count.

## Ground that goes (Bot AI Phase C item 2)
The navmesh is fixed for the match and has breakable props and free blocks that crumble, break, hide or show, and
movers' blocks, as they start (a mover's at its first point). Doors and walls that block paths were openings already
(flag bits routes keep out of when shut). Now the ground bots stand on that can go is too: the tops of breakable props,
of free blocks and of movers' blocks that aren't lifts (`Scenario.surfaces`: bridges, trapdoors, crumbling floors,
drawbridges) get flag bits after the openings' (14 in all, shared), and a few times a second the match tells the navmesh
which are gone now (`Scenario.surfacesGone`: broken, crumbled, hidden, a mover away from its first point;
`NavWorld.setGone`). Every route search keeps off gone ground (except the polygon it starts or ends on: a bot riding a
button-called lift), and a bot whose route was planned before plans again. When the ground comes back, so do the routes.
A breakable crate or wall that opens a way when it breaks doesn't open a route (the navmesh has no ground under it):
that needs the navmesh rebuilt there (a tiled navmesh: not done).

## Crowds (Bot AI Phase C item 3)
Bodies don't block each other in this game (the movement code ignores other players), so crowds never jam: bots pass
through each other. They did so head-on in doorways, tunnels and on stairs. Now a travelling bot with a teammate within
4 m ahead coming the other way (facing it) steers to its right, as both do (`BotBrain.separate`, on the allies' grid in
big matches), so they pass side by side. And a bot strafing in a fight is no longer judged stuck when its runs reverse in
the same second (they reverse by themselves when something stops them: the stuck recovery only threw away its cover and
route).

## Low roofs and large bodies (Bot AI Phase C follow-up, part 2)
The navmesh is built for the standard 1.8 m body. Ground with less headroom than a large body (2.12 m) stands in, and
a large body's radius round it, is marked `LOW_AREA` (`nav/solo.ts`). A large body's route search (`NavWorld.findPath`
`tall`) prices it at `LOW_ROOF_COST` = 4 a metre (`nav/index.ts`; the owner's moderate price, 2026-11-08; it was
1,000, any way round, in 0.9.0). So a large bot goes round a low stretch when the way round costs less than four times
its length, and crouches through it otherwise; a route that goes under (or starts or ends there) turns on its duck
(`BotBrain.lowRoute`, `mustDuck`). Small and standard bodies route as before. `bot-report` prints stuck recoveries by
body size, ducking, and tall routes under a low roof. Measured: BOT_AI_PLAN.md, "Part 2" and "The moderate price".

## Routes along a group's corridor, and the search budget (Bot AI Phase C item 4)
The team brain's groups take different corridors to the objective (Phase B). A bot took its corridor by its via and
then the shortest way on, and was back on the main way by the trip's middle (60 % of a team on the busiest way on the
long CTF maps). Now a route for a group's job is planned along the corridor's own polygons all the way to the objective
(`NavWorld.pathAlong`: one short search onto the corridor polygon nearest the bot, then the corridor's polygons, the
straight path through them), when the corridor ends at the goal; when it can't (shut by a door, ground gone, off its
end), by its via as before, for 10 s (`bot-report`: routes along a group's corridor). The common trips' corridors are
cached per navmesh already (`findCorridors`).

**The per-tick search budget:** at most 24 route searches start in a tick (`NavWorld.beginTick`, `takeSearch`); a bot
over it keeps the route it has and plans next tick (one with no route left, or with ground gone under its route, always
searches). A 96-bot match averages about ten a tick; the budget only flattens spikes (a respawn wave, a flag taken)
(`bot-report`: searches put off a tick).

## Team brain and route variety (Bot AI Phase B)

**Corridors** (`nav/corridors.ts`; BOT_AI_PLAN.md Phase B item 4): for the trips a mode's bots make again and again
(`ModeLogic.botTrips`: CTF, a team's flag to the enemy's; King of the Hill, each team's spawn to the hill; Bomb, each
spawn to each site; Hostage, the rescuers' spawn to each hostage and on to a rescue zone; Elimination and modes without
one, spawn to spawn), two or three ways that really differ: the shortest over the navmesh's polygons, then again with
the ground within 10 m of the ones found made costly, keeping a way only when under 40 % of it runs within 7 m of the
others and it is at most 1.6 times as long plus 30 m. Worked out at match setup (a few ms each) and kept per navmesh.
Each corridor has a **via**: its point (between a fifth and four fifths of the way) furthest from the trip's other
corridors. A bot takes a corridor by going to its via, then on to the goal, its own routes doing the rest. (A via in
the corridor's second half kept more bots on their way past the trip's middle, the busiest way on the long CTF maps 60
→ 56 %, but Sunken Kingdom's first capture in five minutes came in 4 of 6 matches against 6 of 6: kept as it was.) (Following a
corridor's points every 12 m went wrong on maps with floors: a bot on a deck over a corridor counted as on it and headed
for points on the ground ahead, and captures halved on the dev sample.)

**The team brain** (`bots/teamBrain.ts`), once a second per side, from what the mode says about the side
(`ModeLogic.botBrief`: what its attackers go for and whether as a group push, an enemy to cut off, the mode's playbook):
- **Prices** each corridor of the side's trips: its length × (1 + 0.15 per teammate on it + 0.35 per teammate who died
  near it in the last minute + 0.2 per enemy seen near it in the last 20 s, six at most). The recon pair's sightings
  count twice. A bot heading for the enemy's side on its own takes the cheapest (with a little taste of its own: up to
  ×1.3), so loose bots spread out by themselves and a team stops feeding one choke; a squad (big Team Deathmatch
  matches) the cheapest no other squad is on.
- **Groups**: the side's attackers (bots whose goal is the attack objective, not under a person's orders, on foot) split
  into a main push (the cheapest corridor by length, deaths and sightings: not by who walks it, or the groups swapped
  ways every second), flankers (45 % of the rest, the next corridor) and a recon pair (two from six attackers, one from
  four; explorers and lone wolves first; the third corridor, or the flankers'). Only on a long trip
  (`Playbook.groupsFromLength`, `splits`): its shortest way 180 m or more, with two corridors at most 1.35 times as long
  plus 20 m. In Capture the Flag that is Fernwood Moon (186 m between the flags) and the 12 longer maps (14 then) with a second way
  near the shortest (Riot Junction, Sunken Kingdom, Primeval Park, Midnight Keel, Coldwater Gulch, Sunstone
  Crag, Capitol Mall, Glacier Line, Eagle Spires, St John's, Iron Maw, Norman Shores). On a shorter trip, or
  with only far longer ways round, each bot takes its own lane as before, the loose bots' prices spreading them: split
  over the ways on every map, Capture the Flag lost a third of its captures on the dev sample (BOT_AI_PLAN.md, "Phase B
  part 1, measured"); from 110 m, Diamond Park's attack went in two groups and its five-minute capture test went
  without a capture; flankers on a long way round got there late and alone. A group moves to another corridor only
  when that one is a third cheaper, and only for bots joining it after: a bot keeps the corridor it set out on until it
  dies (a group changing ways mid-push turned bots 20 m from the flag back).
- **Group pushes**: with the objective the enemy's (a flag at its base), bots coming up from their spawn gather at their
  corridor's staging spot (28-60 m back from the objective, out of its sight where the corridor allows) and go together
  once most of those on their way have gathered or 10 s after the first got there; when one group goes, every group
  waiting at its spot goes too, so the main push and the flankers arrive about the same time from different ways. A bot
  already nearer the objective than its spot never falls back to it, one that hasn't got to it in 25 s goes on, and the
  recon pair goes ahead on its own.
- **Interceptors** (a reaction: our flag carried off; built, but none by default, `Playbook.interceptors`): that many
  bots the carrier will run into (ahead of it on its way home and within 40 m of its route) wait for it on its route, a
  goal to keep to, and go straight at it once it's close; bots behind it leave it to the mode's chasers (the defenders
  and those within 22 m). Three, in Capture the Flag, were the attackers of the side whose flag was taken: its attack
  stopped while they waited, and carriers rarely got home (Diamond Park's first capture in 3 of 6 five-minute matches,
  against 6 of 6 without; one interceptor, 5 of 6). The reactions in play are the mode's: a carrier gets escorts,
  defenders close in on an enemy at their flag.
- **A person's orders win**: a bot under orders gets no job, and its order outweighs everything in its choices.
- **Playbooks** (`bots/playbooks.ts`, `PLAYBOOKS`: per mode, as data): the team brain's numbers (`Playbook`: group
  shares, when to split, staging distances, timings, bounds, prices, interceptors), which the mode hands over in its
  brief, and the mode's own roles (Capture the Flag's defenders by team size, escorts, response and threat ranges, the
  defenders' watch radius, the carrier's; Breakthrough's below). King of the Hill, Bomb, Hostage, Elimination, Team
  Deathmatch, co-op and zombies never split; Capture the Flag and Forts split on long trips; a mode without one (no attack
brief) plays by the default. King of the Hill
  straight: split over the ways, the hill was held 33 % of the time on the dev sample against 49 % going straight;
  gathering out of the hill's sight to retake it together, the side doing it held the hill 37 s to the other side's
  170 in the same matches.
- **Breakthrough's playbook** (the owner's brief for Iron Coast; the mode is `core.breakthrough`, its bot logic in
  `sim/modes/breakthrough.ts`): the attackers spread over the sector's ways on any length of trip (a main push,
  flankers and a recon pair), every style but Arena's bounds cover to cover up the beach from 12 m (`bound: 'all'`),
  a tunnel is pushed as a group (staging at its mouth), and smoke goes before open ground once the weapons have smoke;
  the defenders' shares: a quarter on the guns, 40 % in the trenches, 15 % sniping from the crest, the rest on the
  objective, and 30 % of them falling back early to the next line once the sector's capture passes half or half of
  them are down (`BreakthroughRoles`). **As wired:** the mode's brief names the attackers' objective (the least
  defended still to take in the sector in play, kept until taken or planted; `stage` while the defenders hold it) with
  this playbook's `team`, and its trips are each sector's spawn groups to each of its objectives (both teams' when the
  sides swap). The defenders' duties go by each bot's place among its side's bots (by slot order: the teams alternate
  slots, so `slot % 2` picked no defender at all) over the sector's posts: turrets, trench tiles and sandbag walls, and
  high ground that sees an objective, within 60 m of its objectives on the defenders' side of its line, so the
  crest's guns and trenches cover a beach's zones. Gunners and crest snipers stay on their posts; the trenches and
  objectives answer the attack (defusing, crowding a zone being taken); the early fall-back comes from the trenches'
  share. A bot within reach of a target to plant or a charge to defuse holds still, crouched, until it's done (the
  mode's `botInput`). Smoke: every attacking bot that bounds (all but Arena bots and berserkers) spawns carrying smoke
  grenades instead of its frags (the mode's `onSpawn`), so going up the beach the moving half screens the open ground
  it crosses ("Smoke" above): in a 150 s 8 v 8 match on the Range, 49 screens sent ahead in bounds and 28 thrown by
  hurt bots in the open. (Every other attacker by place first gave it, there, only to bots that never bound.) Tunnel
  groups wait for a map with tunnels (the team brain's staging pushes any held objective as a group). **Measured** on the Breakthrough Range (headless matches, bots only, the first
  round, Match Setup's suggested reinforcements and sector time, with smoke): 4 v 4 (6 an attacker, 3 min), eight
  seeds, the beach fell in 4 (106 s on average), the guns in 2, the fort in 2; 8 v 8 (6, 4 min), six seeds, the beach
  in 6 (61 s), the guns in 4, the fort in 2. Before smoke (frags for everyone) and at the old small-team suggestion of
  8: 4 v 4 the beach, the guns and the fort in 7 of 8 (with smoke at 8: 6, 5 and 4), 8 v 8 6, 4 and 3 of 6. Before
  the hold-still fix no attacker planted in 8 v 8 (the guns fell in none of six).

Bots read their job (`BotPlan.job`: group, corridor and staging spot, or an interceptor's cut-off point) and the side's
priced trips (`BotPlan.trips`) from objects the director updates in place. `bot-report` prints, per match, each team's
use of each corridor of its trips (`routes:`, bot-seconds by the nearest corridor) and the group pushes (`pushes`:
waves set out, got there, lost half first); its rows also keep the route choice (`routes[].cross`: each bot's corridor
once it is past a trip's middle, counted once a life, the way it really took rather than where it stood or fought).
The scorecard has "two routes" and "busiest route" (time) and "two ways" and "busiest way" (choice) per mode, and the
judge's line for each map its busiest route and way.

## Fireteams (docs/FIRETEAMS_PLAN.md, Part 1)

A variant of every team mode (`rules.fireteams`, the squad size 4-6; `sim/fireteams.ts`). It replaces the director's
squads by proximity with **fixed squads** made from the roster.

- **Squads** (`Fireteams.sync`, when the roster changes and every 2 s; slot order, no randomness): every person leads a
  squad of the size, their bots filling it; bot-led squads of the same size fill the rest of the team, as even as can
  be (11 bots in squads of 5: 4, 4, 3). No person is ever a member of another person's squad. A person joining
  mid-match (the match removes a bot for them, as before) takes over a bot-led squad, the one with a hole first: its
  bot leader steps down to a member, nobody respawns. A person's squad comes first: a hole in it is filled from a
  bot-led squad (the member nearest them walks over), and one over size gives its furthest member back. A person
  leaving (or away) hands their squad to its best bot leader (`leadAbility`: loyalty, tactical sense, cowards last).
  Player caps don't change: squads only group the players there are (more people than squads of the size: every
  person still leads one, the bots spread among them).
- **What members do** (Part 1; Part 2 changed bot-led squads, below) (`memberGoal`, through `Match.botGoal` ahead of every other goal but a carrier's): follow the
  leader (the squad's `anchor`, the leader's position moved on every 3 m, so routes aren't asked afresh every think),
  or the squad's order. A person's order is `OrderGoal.order` (ORDER_WEIGHT 2.4 in the scored choice: above noises and
  chases, below cover and a gun; bots fight what they see); keeping with a bot leader is `OrderGoal.squad`
  (SQUAD_WEIGHT 1.3: above the mode's goals, and a member turns to a noise or a chase within SQUAD_NOTICE, 15 m).
  A member carrying the objective (a flag, the bomb: `ModeLogic.blocksVehicle`) takes it where the mode says.
- **Bot-led squads use the team brain** (`directBots`): the leader is a normal bot (the mode's goal, the team brain's
  jobs, pushes and routes); its members follow it and are left out of the team brain's groups (`ordered`). In Team
  Deathmatch the director keeps its squad goals and routes for them (`BotDirector.update`'s `fixed`: the bot-led
  squads as its clusters, leader first), so a bot-led fireteam plays the same pushes a proximity squad did. Every bot
  plays the `squad` role (no lone campers or snipers wandering off).
- **Orders** (the order wheel: hold B, hold a controller's d-pad up, the Orders button on a phone; `PlayerInput.say`
  110-115, ORDER_SAY_BASE + kind): Follow me, Hold here (where the leader stands), Go there (their ping in the last
  10 s, else the point they aim at), Attack that (the enemy in their sights, else their fresh ping's; members are told
  where it is), Defend the objective (`ModeLogic.defendSpot`: the hill in play, the sector's objective nearest; else the
  nearest end of the side's trips to hold: its flag, a site, the hostages), Regroup. `checkOrder` checks them on the
  server: only a person leading a squad, alive, at most one every 0.3 s; a refusal tells them why (the 'squad' event,
  `deny`). The first member alive answers with a callout ("Holding here!": the 'squad' event, `ack`, in the chat
  feed). The B menu's Follow me! and Hold here! order the leader's own squad. Pings and the other quick messages work
  as before.
- **Ending orders** (`Fireteams.step`, 10 times a second): Attack that ends when the target is down (or after 45 s),
  Regroup when half the squad is within 8 m (or after 20 s): both turn back into Follow me. An order is **carried out**
  (`FireteamOrder.done`, measured) when half the squad's living members are within its radius (+2 m).
- **The leader down** (a person's squad; a bot-led one is led on by a member since Part 2): the squad holds and fights where each member stood (a Hold here, Go there or Defend the
  objective stays in force). Back, they form up on them (Regroup), a place order staying.
- **Respawn on the leader** (`Match.fireteamSpawn`): a squadmate respawns beside its leader when it's safe there
  (`spawns.ts leaderSpotSafe`: no enemy within 20 m, no fresh deaths, out of sight of the nearest enemies, by the spawn
  choice's own weights; the leader on foot on the ground, not hurt in 4 s, where the mode allows a squad spawn), else
  at its team's spawn (never beside another teammate).
- **Measured** (`bot-report --fireteams=N --orders`, squadMeasures.ts): cohesion (each member's distance to its leader,
  once a second), the share of members alive, and orders carried out and in how long (`--orders`: every squad's leader
  gets an order every 30 s in turn). With the variant off, the same squads are worked out alongside and measured, for
  comparison. Numbers: docs/FIRETEAMS_PLAN.md, "Part 1".
- **Hooks for Part 3**: a squad's `id`, `members`, `order` and `anchor` (scores and MVP read them); the 'squad' events
  carry the squad id.

### Fireteams Part 2: objective first, formations, bounding, the squad HUD (docs/FIRETEAMS_PLAN.md, "Part 2")
- **Objective first (bot-led squads).** A bot-led squad on Follow me plays one play: its members play the mode's
  objective themselves (`memberGoal` returns null for them), each with its **leader's team-brain job** (the same group,
  corridor and staging spot: `DirectorMember.unit`, `BotDirector.update`), and the mode's **role for the whole squad**
  (`ModeLogic.botUnits`; CTF `CtfBotPlan.squadRoles` / `ctfSquadRoles`: a squad defends only when it fits in the
  defenders wanted, so with squads of 4-6 every squad attacks and a flag in trouble is answered by whoever is near). A
  member more than `CATCH_UP` (25 m) from its leader catches up first (at a run). In Team Deathmatch the director's
  fixed clusters keep giving them the squad's goal, route and regroups as before.
  - **The leader falls:** a bot-led squad is led on by its best member alive (`Fireteams.step`, a handover that keeps
    the squad's order); the fallen one comes back as a member (beside the new leader when that's safe). A person's
    squad still holds for them (Part 1; a place order stays, Follow me / Attack that regroup on their return).
  - **A carrier leads:** a bot-led squad's member carrying the objective (a flag, the bomb: `blocksVehicle`) takes the
    lead, so the squad's catch-up and respawns go to it.
  - Tried and measured worse (FIRETEAMS_PLAN.md, Part 2): members keeping formation spots round a bot leader (at its
    pace, or round where its route goes next), the leader easing off for laggers, members playing the leader's own
    goal only near it, a whole squad of 4 holding a CTF base, CTF defenders picked singly out of squads.
- **Formations (a person's squad).** On Follow me and Regroup each member has a spot round its leader (`layFormation`,
  `Squad.spots`), laid again each time the leader has moved `ANCHOR_MOVE` (3 m): the shape by the free width across
  the leader's way (two sight lines at chest height, 12 m each side): under `FILE_WIDTH` (7 m) single file along the
  leader's own trail (its last anchors), over `OPEN_WIDTH` (18 m) an open wedge, a wedge between. Each spot is kept 0.8 m
  short of a wall between it and the leader and put on the walkable ground under it (`nav.closestPoint`, a step up or
  down; none: the leader's spot). On Hold here, Go there and Defend the objective (any squad) the members stand on a
  ring round the place (2.5, 3 and 5 m), not on one spot.
- **Spread out / Stay tight** (`spacing`, the wheel's seventh entry, `PlayerInput.say` 116): one entry that toggles
  the squad's spacing (`normal` → `spread` → `tight` → `spread`; its label says what it will do). Spread scales every
  offset and ring 1.6 and opens a wedge; tight 0.6 and closes an open wedge; single file stays single file. It keeps
  the squad's order. A bot answers "Spreading out!" / "Tightening up!".
- **Bounding.** While a squad is on the move (its anchor moved in the last 3 s) every member has a half
  (`squadHalf`: the leader 0, its members 1, 0, 1, ...; `OrderGoal.half`): in a fight at range on the way, the halves
  take turns (4 s each) covering and moving cover to cover (`BotBrain.boundPhase`, Phase B's advance), by style as
  before (Tactical from 12 m, Mixed from 18, Arena never). A person's squad on Follow me bounds too. **Covering fire:**
  a member of the covering half whose enemy ducks out of sight keeps firing at where it went (`suppress`, only while
  the rounds reach it, so from a peek) for 2.5 s (`coverShots`: bot ticks spent so, measured).
- **Alerts:** a bot leader in a fight tells its members within 45 m not in one where its enemy is (once a second).
- **The squad HUD** (`client/game/squadHud.ts`; the snapshot's `fs`, `squadSnapshot`): your squadmates' cards
  (portrait, name, health; greyed "Down"), the order line ("Squad · Hold here · Spread out"), your squadmates as ringed
  dots in the squad's orange on the minimap and the order's place (H, G, D), and the orange marker over their heads.
- **Measured** (`squadMeasures.ts`): besides Part 1's, squad-seconds in each shape, the members' distance to their
  spots, covering-fire rounds.

## Snipers (Bot AI Phase B)

The sniper role plays like a sniper (`bots/sniper.ts`; BOT_AI_PLAN.md Phase B item 5; the owner: "camping in tucked
away high spots … to take calculated shots, some even moving locations after, acting like real snipers"):
- **The gun first**: a sniper-role bot without a scoped gun goes for a scoped pickup within 70 m before anything but
  cover (`SCOPE_WEIGHT` 2.8). In the Military and Sci-fi weapon sets it spawns with one in place of the set's main
  gun (`Match.sniperGun`: Military's marksman rifle, Sci-fi's railgun; docs/WEAPON_SETS_PLAN.md); a bot whose role is
  shared out after it spawned is re-armed at once (`Match.rearmForRole`).
- **Spots** (`vantage.ts`): a sniper spot scores its view, its height (up to 0.8), a wall behind (0.5) and walls close
  at its sides (tucked away: 0.12 each, four at most), and, once a match, how well it looks down the ways the enemy
  comes: the share of the trips' corridor points in its view and reach that it can see, × 0.8 (`VantageBoard.lanes`,
  24 sight lines a spot at most). A sniper with a goal to hold (a CTF defender's flag, a hill) takes a spot within 75
  m in sight of it (`OPT_POST`, 1.35: over the goal to hold); one with a goal to get to goes with its team.
- **Calculated shots** (`goodShot`): on its spot with the scope up it fires only once its aim has settled on the
  target (its wander within about the target's width), the target in the gun's reach, and still (under 1.2 m/s across
  its view) or not looking its way, or lined up 3.5 s at one walking across; otherwise it keeps tracking with the scope
  up and holds the shot (`held` in bot-report).
- **Moving after a shot or two**: two shots from a spot, three for the bold (aggression 60+), or a kill, then it
  leaves within a second and takes another spot 1-3 s later, at least 18 m away and not back toward the one before (`relocatePrefer`);
  also when the target it watches has looked straight at it for 1.5 s (spotted), and, as before, when hurt there or
  shot at by someone it can't see (`moves` in bot-report).

## Cover-to-cover advance (Bot AI Phase B)

BOT_AI_PLAN.md Phase B item 6 (the owner: "We don't have nearly enough taking cover and using it to progressively
advance through a map or objective"):
- **Bounds** (`BotBrain.boundPhase`): a bot on its way to an objective (a goal to keep to, not a carrier's run) in a
  fight at range moves cover to cover by its style: Tactical from 12 m, Mixed from 18 m, Arena never (nor berserkers).
  Half cover while half move, on a shared clock by slot (3.5 s turns for Tactical, 4.5 s for Mixed), so teammates near
  each other take turns without anyone arranging it: the covering half holds cover facing the threat, peeking and
  shooting rather than running at it; the moving half leaves its cover for one further on (`findCover`'s advance), or
  advances in the open shooting where there's none.
- **In cover while reloading or hurt**: hide-and-peek keeps on while it reloads or is hurt, not only while shot at.
- **Routes that prefer cover** (`NavWorld.markExposure`): when the navmesh is built, each ground polygon with nothing
  within 3 m of its middle at chest height in any of four directions is open ground (navmesh area `OPEN_AREA`); a
  route across it costs 1.2 times as much for Mixed bots and 1.45 for Tactical ones, Arena bots as before
  (`findPath`'s `open`).

`bot-report` keeps each bot's style (`style`: Arena, Tactical, or neither) and `--compare` prints time in cover in a
fight by style.

## Measuring

`pnpm bot-report` (`packages/server/src/tools/bot-report.ts`) plays headless matches of Player Bots (added as the
server adds them: as their characters, normal skill) and reports per map and per bot: time by what each bot was
doing, moving or standing (`BotBrain.doing`); idle time (moved under 0.5 m in a second, alive, on foot) by reason,
with "stuck(...)" when it meant to move and didn't; idle spells of 3 s and more, with where they happened; "frozen"
time (out of a fight, not even turning); time going to the mode's goal and at it; for CTF each bot's role, flag
takes, captures, returns and drops, and every flag run (when, how long, how it ended); no-route searches, stuck
recoveries, kills and tick cost. `--suite=ctf` plays every map that offers CTF, `--shard=k/n` splits a suite over
processes, `--json=file` keeps the rows and `--compare=before.json,after.json` (several files joined with `+`)
prints the two side by side, per map. `--spells` lists the longest idle spells, `--bots` every bot.
**Breakthrough** (`--mode=core.breakthrough`, or `--suite=breakthrough`: the maps that list it): each match records
the sectors the attackers took of the map's, the second each fell, how the round ended (broke through, the line held,
or still playing when `--seconds` ran out) and when, and the attackers' reinforcements at the start and left
(`breakthrough` in the JSON rows); the match stops once its last round is over. Several seeds print a line per map and
size: sectors taken on average, matches broken through, and each sector's share of matches taken with its average
fall time. It is not in the nightly scorecard's suites.

### Scorecard (Phase A)

`pnpm bot-report` is also the bots' scorecard. Per match it records, besides the above: route searches and the share
that found no way (bot route requests, `BotBrain.pathSearches` / `pathFailures`, and every navmesh path query from
any caller), with where they failed (from and toward: the nav pictures draw them); no-route idle; stand-ins; map
coverage a minute and spread; spawn deaths (within 3 s of spawning); kills a minute; bot thinking a tick (the
match's bot pipeline, wall clock); and per mode: CTF takes, captures and returns; King of the Hill time held (one
team alone on the hill) and contested; Bomb plants and defuses; Hostage rescues; Elimination (and Bomb and Hostage)
round times; Fort Wars pieces built.

Stuck recoveries and failed searches are read through `bots/botTrace.ts` (`BotTrace.look`, the counts since the last
look), which MapMaker's bot test run (`editor/mapTest.ts`, overhaul Phase 4) shares: its heatmaps of where bots got
stuck and where routes failed count exactly what the scorecard counts.

- `--suite=<mode>` plays the maps that list the mode (ctf, koth, bomb, hostage, elim, forts, tdm); `--suite=all`
  every scorecard mode on its maps.
- **Limits** live in `packages/server/src/tools/bot-limits.json`, like the perf budgets: per mode (`core.ctf`), for
  all modes (`all`) and per map where it matters (`core.ctf/eagle_spires`). Each measure is a most (failed searches,
  idle, frozen, stuck recoveries a bot-minute, spawn deaths, think ms) or a least (captures, takes, hill time,
  coverage, going to the goal); `METRICS` in bot-report.ts says which. A worse number fails. The idle-spell
  measures (10 s+ spells a match, the longest) leave out posts held (a camper's or sniper's vantage spot, still on
  purpose for 18-50 s: `ON_PURPOSE` in bot-report.ts; 2026-11-09, when the check's spells were all posts); `--spells`
  still lists them.
- `pnpm bot-report --check` plays the file's `check` list (Diamond Park and Eagle Spires CTF, Shingle Point King of
  the Hill, Fernwood Moon TDM; one seed, 90 s each: about a minute and a half on a CI runner) and holds it to
  `checkLimits`. CI runs it (the `bots` job, under `stop-on-failure.sh` like the other gating jobs) when a change
  touches the bots, navigation, the sim or its modes, the scorecard itself or one of the maps the check plays
  (`e2e/flowMap.mjs` `BOT_PATHS`, `BOT_CHECK_MAPS`; the plan's `bots` output, so `green_base` and the docs-only skip
  apply to it as to the rest), and the release waits on it.
- **Nightly** (and from Run workflow) CI plays the full suite (`--suite=all`: 199 map and mode pairs, two seeds of
  three minutes, 14 shards of about 28 matches) and the `bots-scorecard` job holds it to `limits`
  (`--judge=a.json+b.json…`), with the report (every match's rows, the scorecard, `pnpm nav-audit`'s output for every
  map) and every map's nav picture (the maps the suite played drawn again with their failed searches) as the
  `bots-report` artifact. The nightly shards don't stop when another job fails (a flaky browser flow doesn't cost the
  night's scorecard; the run reads failure all the same). First run from Run workflow on `wip/bots-a` (run
  42264736565): 398 matches on 77 maps, the shards 3 to 9 minutes each and the judge with every map's picture 2,
  every limit held.
- The sim is deterministic by seed, so a run's numbers are the same every time on the same code; only bot thinking
  and tick times vary with the machine.

`pnpm bench` prints, per map, a behaviour line next to the CPU ones:

- **first 15 s**: kills in the match's first 15 s (warm-up included), and how
  many of the victims had spawned less than 3 s before;
- **spawn deaths**: share of all deaths within 3 s of spawning;
- **coverage**: share of the map's 21 m regions some bot stood in, per minute
  (for a 30 s run: in the 30 s);
- **spread**: how evenly bots used the map (entropy of bot-seconds per
  region, 0..1, 1 = evenly everywhere);
- **crowd**: the most bots in one region, averaged over one-second samples;
- kills per minute and stuck recoveries.

Clumped runs put everyone back in the clump when they respawn, so their spawn
deaths and coverage say nothing about spawning or routes.

**Cost.** All of the above in a 96-bot match is a director update once a
second per side (a few hundred distance checks), a few comparisons per bot
think, one extra grid query for big-match hearing and one for single file,
and region picks (24–40 samples) only when a bot needs a new goal. Vantage
spots and made-up spawn points are worked out at setup. The same pass made
the per-tick bot pipeline cheaper to pay for it: every bot view of an actor
has one object shape and is refilled each tick instead of made anew, the
movement environment is one reused object, and the near-miss check every
shot runs against every bot does scalar maths.

Numbers: PERF_96.md, "Bot behaviour pass".

## Score and time (November 2026)

Match setup suggests a score limit and a time for the match's size (players and bots together) and keeps them in
step with the size until the host sets them by hand (`suggestedLimits` in `packages/shared/src/sim/matchSetup.ts`,
tests in `packages/shared/test/matchLimits.test.ts`; HOSTING.md, "Save for next match" and Match setup). They are
fitted to how fast bots score, so a match is usually won near its time limit, not in two minutes, and they meet the
owner's anchors (2026-11-06): Team Deathmatch 4v4 about 40 points in 10 minutes, 24v24 about 500 in 15–20.

**The curve:**
- **Team Deathmatch:** a point for each player on a team per minute of the time limit, rounded to a step (5 under
  50, 10 under 300, 50 under 1,000, then 100). The time is 10 minutes up to 6 a side, 15 up to 16, 20 above: 1v1 10
  points, 4v4 40, 6v6 60 (10 minutes); 8v8 120, 12v12 180, 16v16 240 (15); 24v24 500, 32v32 650, 48v48 950 (20).
  With more than two teams the largest one counts.
- **Deathmatch:** the leader's kills, 12 × √players, in 10 minutes: 15 for 2 players, 25 for 4, 35 for 8, 40 for 12,
  50 for 16, 70 for 32, 80 for 48. The leader's kill rate grows about as √players.
- **Capture the Flag:** 3 captures as before (the leading team takes 0.1–0.5 a minute), the time by team size as in
  Team Deathmatch.
- **King of the Hill:** 12 hill seconds a minute of the time: 120 in 10 minutes as before, 180 in 15, 240 in 20 (the
  leading team holds the hill 5–21 s a minute on the shipped maps: Diamond Park 5–8, St. John's 9–21).
- Rounds modes (Elimination, Bomb, Hostage Rescue), co-op, Zombies, Fort Wars and Disc Arena keep their own.

**Measuring.** `pnpm bot-report` prints each match's team scores and its top bot's kills (the `scores:` line, with
the leading team's points a minute; `teams` and `top` in `--json` rows). It plays with no score limit or time, so a
rate is what bots score in an open match. The runs: 10 minutes (CTF 15), `--players=N`, seeds 1 and 2 at small sizes
and one seed at big ones; a map's rate is the mean of its seeds and a size's the middle (median) of its maps. Seeds of
one map differ a lot (Diamond Park 24v24 after Phase A: 22.7 and 34.9 points a minute). The scripts and every match's
rows are in the session scratchpad's `measure/` (before Phase A) and `measure-a/` (after: `run.sh`, `run2.sh`,
`compare.mjs`, `tables.mjs`).

**Team Deathmatch before Bot AI Phase A** (main a07cb65b, 2026-11-06): the leading team's points a minute, the middle
of the maps, the same per player on a team, and each map (* retired since).

| Size | Points a minute | A player | Maps |
|---|---|---|---|
| 1v1 | 1.4 | 1.40 | Bunker Cross 0.9, Sandgate 0.9, Iron Compound* 1.4, Atomic Court 1.8, Void Yard 2.5 |
| 2v2 | 3.0 | 1.50 | Bunker Cross 1.8, Iron Compound* 2.9, Sandgate 3.0, Atomic Court 3.8, Void Yard 6.3 |
| 4v4 | 5.4 | 1.35 | St. John's 1.1, Diamond Park 3.3, Bunker Cross 4.0, Iron Compound* 5.4, Sandgate 6.8, Atomic Court 7.6, Void Yard 15.2 |
| 6v6 | 11.4 | 1.91 | Bunker Cross 7.0, Iron Compound* 10.4, Sandgate 11.4, Atomic Court 12.0, Void Yard 24.2 |
| 8v8 | 7.9 | 0.99 | St. John's 3.7, Bunker Cross 5.5, Capitol Mall 6.4, Fernwood Moon 7.9, Diamond Park 8.4, Iron Compound* 11.7, Sandgate 12.8 |
| 16v16 | 13.9 | 0.87 | Iron Maw 5.7, St. John's 12.3, Diamond Park 13.1, Sunken Kingdom 13.9, Capitol Mall 15.0, Fernwood Moon 17.4, Iron Compound* 22.7 |
| 24v24 | 30.6 | 1.28 | Iron Maw 13.1, St. John's 22.0, Capitol Mall 29.8, Sunken Kingdom 30.6, Diamond Park 33.6, Fernwood Moon 33.8, Iron Compound* 38.1 |
| 48v48 | 56.5 | 1.18 | Iron Maw 33.0, Capitol Mall 80.0 |

About 1.3 points per player a minute in the middle, so a point per player a minute falls due at 70–115 % of the time
limit on the middle map: 4v4 at 7.4 minutes of 10, 8v8 15.2 of 15, 16v16 17.3 of 15 (the time runs out first), 24v24
16.3 of 20, 48v48 16.8 of 20. A small map at the size it's made for gets there sooner (6v6 on the arenas above: 5.3
minutes of 10), and a big map with few players runs out of time first (St. John's at 4v4).

**Team Deathmatch after Phase A** (main adad4de7 merged into `wip/match-setup-2`): the same maps, seeds and lengths,
the retired map left out, plus Diamond Park's second seed at 24v24. No clear change, so the curve stays: at these
rates the suggestion falls due at 9.4 minutes of 10 (4v4, 40 points), 16.4 of 15 (8v8: the time runs out first, at
about 110 of 120) and 17.1 of 20 (24v24, 500).

| Size | Points a minute, before → after | A player | Maps |
|---|---|---|---|
| 4v4 | 4.0 → 4.3 | 1.01 → 1.06 | Diamond Park 3.3 → 3.2, Bunker Cross 4.0 → 4.3, Sandgate 6.8 → 6.1 |
| 8v8 | 8.1 → 7.3 | 1.02 → 0.92 | Capitol Mall 6.4 → 4.5, Fernwood Moon 7.9 → 6.5, Diamond Park 8.4 → 8.2, Sandgate 12.8 → 13.5 |
| 24v24 | 32.1 → 29.3 | 1.34 → 1.22 | Sunken Kingdom 30.6 → 28.6, Diamond Park 33.6 → 28.8 (seeds 22.7, 34.9), Capitol Mall 29.8 → 29.8, Fernwood Moon 33.8 → 31.7 |

**The other modes** (the middle of the maps; after Phase A on the same maps):
- **Deathmatch**, the top bot's kills a minute. Before: 2 players 1.8, 4 2.6, 8 3.8, 12 4.6, 16 7.0, 32 5.0 (St.
  John's and Diamond Park: big maps). After, on Sandgate and Citadel: 8 players 4.7 → 4.8, 16 players 7.9 → 8.4.
- **King of the Hill**, the leading team's hill seconds a minute. Before: 4v4 9.4, 8v8 18.1, 16v16 10.4, 24v24 14.1.
  After, 8v8: Diamond Park 7.9 → 5.8, St. John's 18.1 → 18.0.
- **Capture the Flag**, the leading team's captures a minute (15-minute runs). Before: 0.0–0.3 at 4v4 to 16v16 on
  Diamond Park, St. John's and Iron Compound. After, 8v8: Diamond Park 0.2 → 0.5 (7 captures to 3), St. John's 0.0 →
  0.1.

## Weapon sets' oddballs (docs/WEAPON_SETS_PLAN.md)

Bots weigh every weapon of a set as any other (`weaponScore`: range band, splash, flight, heat). Three things were
added so the sets' oddballs get used:
- **The sheep** (`BotBrain.considerWalker`): its throw (9 m/s) lands only 5-6 m out and it walks the rest (3.2 m/s,
  7 s fuse), so bots never threw it (they lob grenades 7-24 m and refuse a landing inside the grenade's own blast).
  Now, with an enemy in sight (or seen a moment ago) 6-20 m off on about the same level, a bot throws it short along
  the line to them where a knee-high line from its landing to them is clear, and it waddles in.
- **A big blast with a long fuse** (the holy bomb: a 9 m blast from a throw that carries 9 m): thrown so it lands at
  least half its blast away; the thrower then runs straight away from it until it has gone off (`ThrowPlan.clear`).
- **The oil slicker**: puddles round the target, then its igniter (the second trigger) about every three seconds of
  the fight; its bot value went from 0.3 to 0.45 now that it kills (Chaos on Atomic Court, a probe with everyone
  carrying it: 29 slicks laid, 22 lit, 8 kills in 120 s).

## Weapon choice from the measurements (gunplay G4, November 2026)

Which gun a bot holds (`weaponScore`) no longer comes from the hand-set `botRange`. It comes from each gun's time to
kill as bots fire it, measured in the shared sim by `pnpm gun-report` (`shared/src/bots/weaponBands.ts`, data in
`weaponBands.generated.ts`).
- **Band** (`botBand`): where the gun kills within 1.6 times its quickest kill (or 0.5 s more, at most 2.5 s).
- **Edge at the distance** (`ttkEdge`): the gun's TTK there against the benchmark guns' median. Under 15 m, a gun
  not in hand pays its measured draw first. So a shotgun beats a Precision Rifle at arm's length, though both are in
  band, and a bot keeps a loaded SMG at 6 m rather than draw a shotgun.

**Not measured yet: how far a bot stands.** `preferredRange` keeps `botRange`. The measured version (`botEdge`) kept
CTF attackers standing off: Diamond Park captured in 2 of seeds 1-6 against 6 (docs/GUNPLAY_AUDIT.md, "G4").

Guns without a measurement keep `botRange`. After a weapon change, run
`pnpm gun-report --json=docs/gunplay-audit.json --bands`, then `pnpm bot-report --check`. bot-report prints each
gun's rounds, hit rate and hit distance (`weapon use`), and `--compare` shows the spread of weapon use.
