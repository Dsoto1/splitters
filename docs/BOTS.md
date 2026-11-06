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

**Choosing a spawn point** (`pickSpawn`). Every candidate gets a cheap score:

- distance to the nearest living enemy (capped at 100 m; height counts double);
- someone standing on it (within 1.5 m): −60; a few people within 4 m: −6 each;
- used in the last 3 s: up to −20, fading (enough to break ties, not to send
  anyone nearer an enemy);
- team modes on shared spawns: +8 per teammate within 25 m (each side keeps an
  area of its own), as before;
- made-up points (below): a small pull toward the side's own base.

Then the best six are checked for enemies within 50 m with a clear sight
line to the spawn (the three nearest each): −30 for every one that can see
it. At most 18 rays a spawn. A little randomness (0–3) separates near-equal choices. Squad spawn
(beside a teammate out of the fight, 70 % of team spawns) is unchanged.
Spawn protection is unchanged: there is none outside Disc Arena's 2 s guard.

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
waypoints.

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
  a scoped gun with rounds; prone with the scope, holds 25–50 s, and leaves
  its spot within a second or so of a kill (mid-fight too), taking another
  one (never the same) 4–10 s later.
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
| dune_harbor | 0.0 → **0.0** | 0.0 → 1.0 | 23.0 → 7.4 | 458 → 302 | 28.6 → 41.2 |
| dustwater | 0.0 → **3.5** | 0.0 → 14.5 | 11.1 → 3.0 | 127 → 110 | 16.4 → 31.9 |
| eagle_spires | 0.5 → **0.0** | 2.5 → 5.5 | 18.6 → 10.8 | 144 → 172 | 20.8 → 18.9 |
| fernwood_moon | 0.0 → **1.0** | 0.0 → 2.0 | 28.2 → 6.9 | 900 → 352 | 31.4 → 50.7 |
| flatpack_depot | 1.0 → **4.5** | 1.5 → 12.5 | 10.5 → 1.7 | 138 → 173 | 20.5 → 34.7 |
| fogbound | 0.0 → **0.5** | 2.0 → 7.5 | 16.8 → 4.8 | 175 → 217 | 15.7 → 24.2 |
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
| no_mans_field | 0.0 → **1.0** | 0.0 → 3.5 | 10.4 → 7.2 | 230 → 288 | 19.2 → 29.5 |
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
| starhaven | 0.5 → **3.0** | 2.5 → 9.0 | 19.8 → 12.7 | 552 → 546 | 19.2 → 26.5 |
| sunken_kingdom | 0.0 → **2.0** | 0.5 → 15.5 | 17.3 → 1.4 | 190 → 188 | 33.6 → 46.7 |
| sunstone_crag | 0.0 → **0.5** | 0.5 → 5.0 | 24.6 → 6.0 | 356 → 186 | 28.9 → 35.4 |
| twin_spires | 0.0 → **0.0** | 0.0 → 0.0 | 11.9 → 3.8 | 62 → 103 | 23.6 → 33.4 |
| underdrain | 0.0 → **0.0** | 0.0 → 0.0 | 33.0 → 14.4 | 209 → 106 | 11.3 → 21.6 |
| vinefall_sanctum | 1.5 → **2.5** | 6.5 → 12.5 | 9.2 → 6.7 | 186 → 407 | 22.4 → 31.3 |
| whiteout_station | 0.0 → **0.5** | 0.0 → 7.5 | 13.6 → 2.7 | 238 → 387 | 32.3 → 49.4 |

Still without a capture: Capitol Mall (249 m between the flags), Coldwater Gulch, Dune Harbor, Eagle Spires, Fort
Meadow (a midfield brawl), Saltmarsh Harbor, Twin Spires, Cinder Foundry, Iron Tide, Norman Shores, Pantry Raid,
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
  portals, ziplines, lifts, ledge drops). **Falls** are where a body walks off the walkable ground onto lower ground,
  traced against the level (nothing in the way at step, knee and head height, then down; landings in lava or deep
  water left out: a bot there swims or drowns, it doesn't walk). Falls are how bots end up somewhere without a route
  there (knocked, pushed, a missed step); they aren't routes.
- **The main area**: the component of routes (polygons that all route to each other) the most spawn points reach and
  are reached from (both ways: a team's base bots jump-pad up into and can't route down from isn't it).
- **A trap**: a patch bots get into from where they spawn (falling, a one-way link, a jump pad) that doesn't route to
  the main area, and that the bots' own hop off a cut-off patch (`NavWorld.escapes`: a step or hop of up to 1.1 m
  within 8 m) doesn't get out of either. One with a fall out is a ledge with no way down (the drop links below fix
  those); one without is a pit nobody gets out of: the map's to fix.
- **Cut off**: a spawn point that doesn't route to the main area (`nav.disconnected`), an objective (flag base, hill,
  bomb site, hostage, rescue zone) some team's spawn points don't route to, a pickup no spawn point routes to
  (`nav.<kind>_unreachable`). "Routes to" is as bots get there: to the place, or to within a step off the navmesh of
  it (a pickup on a crate, a flag on a prop; below).
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
  room to stand at its middle now gets flags 0 at build (`NavWorld.disableInsideSolid`), which every search and
  nearest-polygon lookup leaves out.
- **Ledges with no way down** (Eagle Spires' cliff ledges, roofs and scaffolds bots fall or pad onto, Bunker Cross's
  base roofs): one-way **ledge-drop links**, brought forward from Phase C, generated at load (`audit.ts` `trapExits`,
  `NavWorld.build` `drops`): from each patch that doesn't route to the main area, up to three falls onto ground that
  does (lowest first, 4 m apart), then again from patches those now lead out of. Within fall damage: with it on, only
  drops that cost at most about 30 health (8.3 m at normal gravity, `DROP_HURTS_UP_TO`); with it off, any drop onto the
  navmesh. Not into lava or deep water. A map without such patches gets none, and its navmesh is the same as before.

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
  `orderTarget`), pickups (one out of reach is dropped for 90 s and the next best taken), and the director's regions,
  squad lanes and campers' and snipers' vantage spots, which come from the main area's places
  (`NavWorld.mainPlaces`).
- **No route requests in the air** (out of the plane, under a canopy, a jump pad's flight): none can start there.
  Eagle Spires' plane drop made 860 of its 1,507 failed searches in a minute.
- **Buttons** (Primeval Park, a bot stood 218 s at the fence power): a button on cooldown isn't offered (pressed, it
  does nothing; the fence power has 45 s between presses), a bot presses from anywhere within reach (2.2 m eye to
  face, as players do; three bots at one button kept each other off the one spot in front of it), and a door still
  shut 3 s after its button was pressed is left alone 30 s.

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

### Scorecard (Phase A)

`pnpm bot-report` is also the bots' scorecard. Per match it records, besides the above: route searches and the share
that found no way (bot route requests, `BotBrain.pathSearches` / `pathFailures`, and every navmesh path query from
any caller), with where they failed (from and toward: the nav pictures draw them); no-route idle; stand-ins; map
coverage a minute and spread; spawn deaths (within 3 s of spawning); kills a minute; bot thinking a tick (the
match's bot pipeline, wall clock); and per mode: CTF takes, captures and returns; King of the Hill time held (one
team alone on the hill) and contested; Bomb plants and defuses; Hostage rescues; Elimination (and Bomb and Hostage)
round times; Fort Wars pieces built.

- `--suite=<mode>` plays the maps that list the mode (ctf, koth, bomb, hostage, elim, forts, tdm); `--suite=all`
  every scorecard mode on its maps.
- **Limits** live in `packages/server/src/tools/bot-limits.json`, like the perf budgets: per mode (`core.ctf`), for
  all modes (`all`) and per map where it matters (`core.ctf/eagle_spires`). Each measure is a most (failed searches,
  idle, frozen, stuck recoveries a bot-minute, spawn deaths, think ms) or a least (captures, takes, hill time,
  coverage, going to the goal); `METRICS` in bot-report.ts says which. A worse number fails.
- `pnpm bot-report --check` plays the file's `check` list (a few maps, one seed, short matches: about a minute and
  a half on a CI runner) and holds it to `checkLimits`. CI runs it (the `bots` job) when a change touches the bots,
  navigation, the sim or its modes, or the scorecard itself (`e2e/flowMap.mjs` `BOT_PATHS`; the plan's `bots`
  output), and the release waits on it.
- **Nightly** (and from Run workflow) CI plays the full suite (`--suite=all`, two seeds of three minutes, 14 shards)
  and the `bots-scorecard` job holds it to `limits` (`--judge=a.json+b.json…`), with the report (every match's rows,
  the scorecard) and every map's nav picture with its failed searches as the `bots-report` artifact.
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
