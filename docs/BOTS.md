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

## Measuring

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
