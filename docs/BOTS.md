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
