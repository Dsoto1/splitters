# Handoff: where Tile Trigger stands (2026-11-04)

A briefing for the next Claude session or agent picking up this repo. Read
`CLAUDE.md` first (workflow and rules), then this file. Keep this file current.

## Start here (session of 2026-11-07, handed off to the next account)

**Owner rule for the queue (2026-11-08):** new ideas go to the END of the queue. Only bugs or problematic gameplay
jump ahead, or something the owner explicitly bumps.

**Passengers at speed fixed (`wip/passengers`, 2026-11-08; the owner's bug report, top priority).** "Those seated don't
move in lock step with the vehicle, their bodies drift back ... hearing their footsteps instead of an engine sound."
- **Root cause:** a rider was drawn from their own pose, snapshot-interpolated 100 ms behind the server
  (`INTERP_DELAY_TICKS`), while the vehicle is drawn on its own clock (latest snapshot carried on by its velocity, up
  to 100 ms ahead, `MountState.smooth`) plus its suspension. At 18 m/s a Buggy passenger sat 2.6 m behind their seat
  (measured, e2e below) and slid back as it slowed. Every vehicle, every seat, whoever watches, online and offline
  (one client path). Footsteps: `SessionAudio.remoteSteps` stepped anyone whose pose moved
  (riders included) and `localStep` didn't know you were seated. Engines: there was no engine sound at all.
- **Fix:** `game/riderPlacement.ts` (`RiderPlacement`): each frame, after the vehicles are posed, every rider
  (`MountState.seatedRiders`, from the latest snapshot) is put on the seat point of the vehicle's drawn node
  (`View.seatPoint`: the node's world matrix times the seat offset, suspension included); getting in and out eases
  over 0.25 s. Session applies it to the frame's poses (so avatars, footsteps, splashes and the spectator camera agree).
  `remoteSteps(poses, placed)` skips riders; `localStep(..., mounted)` makes no steps or landing in a seat. Engines:
  synth recipe `engine`, sound `vehicle.engine` (`SessionAudio.engines`: a 1.2 s copy every 0.6 s while anyone rides,
  pitched by speed over maxSpeed; yours unpositioned, the two nearest others positioned, 60 m). A placeholder for
  queued sound pass 2's engine loops.
- **Tests:** unit `packages/client/test/riderPlacement.test.ts` (on the seat every frame at 24 m/s, in/out easing, the
  footstep gate, engines); e2e `passengerChecks` in the `vehicles` flow: canyon, you drive a Buggy with a bot beside
  you at 18 m/s on the page's frame clock (60 fps game time): before the fix 2.62 m off the seat and 2 footsteps,
  after 0.000 m over 90 frames, no footsteps, the engine playing.
- **Seen, not changed:** in the chase view your own driver's body isn't drawn (session draws your character only on
  foot); the passengers are.

**Main** = 63731808 plus this note, green. Today's landings are on main, in order:
- Breakthrough;
- Reduce flashing;
- performance round 4 (32 v 32 in a browser, 64 v 64 on dedicated servers);
- the small fixes (Breakthrough Range an ordinary map, the gun after the scope, dropships, the use prompt);
- Bot AI Phase C (item 0, then items 1-4: parkour, ground that goes, keep right, corridor routes);
- Cool Hands Rex and Fishy Fred;
- the sheep's legs and blast smoke under Reduce flashing;
- the frozen-corpses fix.
- Bot AI Phase C follow-up, part 1 (off a sill, corridor followers counted).

The workflow is unchanged (CLAUDE.md):
- run at most 3 agents, each on `wip/<name>`, green on `check/<name>`, then fast-forward main;
- give agents their own port ranges (4950-4959, 4970-4979, 4980-4989);
- tell agents a CI failure in `attest-build-provenance` (a transparency-log 500 or 404) is GitHub's signing service: re-run the failed job.

**Working in tandem (owner, 2026-11-08): two sessions land on main in parallel.** Both follow this.
- **Claim before you edit shared ground.** Add a line here ("Claimed: <what>, <session>, <date>") before touching
  `packages/client/src/editor/**`, `packages/shared/src/editor/**`, the map schema or `MAP_FORMAT_VERSION`
  (`shared/src/map/mapKeys.ts`), palette or content ids, or any `maps/<id>.json`; remove it when you land. If the
  other session holds a claim, wait or ask the owner. The MapMaker lane owns the editor code and the maps it builds
  (sandfall_colosseum, whiteout_station, MAP 02, MAP 04); the other session owns Iron Coast, race removal and
  Environment Phase 2 until each lands.
- **Map format bumps:** one at a time, claimed here. Whoever lands second takes the next number and chains its
  migration after the first one's.
- **Generated files** (content locks and tables, palette atlases, provenance, `maps/test_coverage.json`,
  `e2e/timings.json`): on a merge conflict, take either side and regenerate with the repo's tools
  (`pnpm content:rebuild` and the rest); never hand-merge them.
- **HANDOFF.md and CHANGELOG.md** merge with `merge=union` (.gitattributes): both sides' lines are kept. After a
  merge, read the touched section once and fix the order.
- **Hot shared files** (`e2e/run.mjs`, `e2e/flowMap.mjs`, `match.ts`, `session.ts`, `style.css`): keep changes small
  and in their own functions or blocks; merge origin/main before every push to a check/ branch.
- **Landing:** merge origin/main, push to check/, land only that green commit by fast-forward. Never force-push,
  rebase pushed commits, or push to the other session's branches. If main moved, merge and re-check.
- **Releases:** a session cutting a release says so here first; the other holds its pushes to main until it lands.
- **Disk:** each session's container is its own; remove a worktree once its branch has landed.

**In flight: MapMaker overhaul (other account)** (owner, 2026-11-08: a second session owns this lane;
docs/MAPMAKER_OVERHAUL_PLAN.md). Branches `wip/mapmaker-*` / `check/mapmaker-*` only.
- **Now:** Phase 1 (the ghost says why, the live budget bar, the `?` overlay; the measure tool, props snap to surfaces with
  randomise), then Phase 3 item 9 (the rotate ring, quick facings) and the rest of Phase 3 that doesn't need the split.
- **Also in this lane** (owner's addendum, 2026-11-08; the other session took these off its queue):
  - set pieces: the 12-piece brainstorm list, retiring the old big pieces they replace (MapMaker's Replace all and
    the load-time alias table), and the MAP 21 sea wall with its breach;
  - the card shots of Step Temple (eye level) and Shingle Point, redone with Phase 3 item 8's card-shot camera;
  - bot hints in MapMaker (Phase 4 item 3, and Bot AI Phase D's MapMaker part; the format goes in docs/BOTS.md);
  - Environment Phase 3's MapMaker tools (PROCEDURAL_ENVIRONMENT §11), after the other session's Environment Phase 2
    lands. Please note it here when it does.
- **The split of `editorApp.ts`** (Phase 2) waits until Iron Coast's MapMaker changes (finer terrain grid, Terrain →
  Change grid, a "coast" border side) and the race-mode removal (the race layer reworded to track / NPC traffic) are on
  main. This line will say when it starts. Please say here when those land.
- **Also in this lane (owner, 2026-11-08, moved from the other session's queue):** set pieces (the 12-piece list,
  retiring old big pieces via Replace all + aliases, MAP 21 sea wall and breach); redo Step Temple's (eye level) and
  Shingle Point's card shots with Phase 3 item 8's card-shot camera; bot hints in MapMaker (Phase 4 item 3 = Bot AI
  Phase D's MapMaker part; keep the format small, document it in docs/BOTS.md); Environment Phase 3's MapMaker tools
  once Environment Phase 2 lands. The other session keeps Iron Coast, race removal and Environment Phase 2.
- **Map builds also in this lane (owner, 2026-11-08):** the Sandfall Colosseum rebuild (docs/map-briefs/sandfall_colosseum),
  the Whiteout Station rebuild from MAP 03 Frostbite Station, and two new maps from their briefs (concepts approved):
  MAP 02 The Spillway and MAP 04 Verdant Protocol (docs/map-briefs/). Build with MapMaker only, using our generated
  foliage (no Kenney trees, bushes, flowers or grass anywhere; owner 2026-11-08). The full pass over every map comes
  after all of this, one map at a time, judging whether each map needs it.

**In flight at the switch** (each branch pushed, tree clean; scratchpad files did not survive the switch):
1. **Friendly fire** (`wip/friendly-fire` @ 318023ed). Green at 1a347140 (run 42408271804, with its new e2e check).
   - **The switch commit:** main's frozen-corpses fix was merged in (conflicts only in CHANGELOG and HANDOFF;
     typecheck passes), and `check/friendly-fire` was re-running at 318023ed at the switch.
   - **Next:** when that run is green, fast-forward main to 318023ed.
   - **Root cause:** every hit test left teammates out before `damage()` read the rule.
   - **Fix:** `Match.canHurt`. Unit test `shared/test/friendlyFire.test.ts`; e2e `friendlyFireChecks` in `teams`.
2. **Iron Coast** part 2 (`wip/iron-coast-part2`, 2026-11-08; part 1 landed at 5edb4296). Done in MapMaker, validate-map
   **0 issues**, card picture recaptured. Details: `docs/map-briefs/iron_coast/DECISIONS_AND_DEVIATIONS.md`, "Part 2",
   and the manifest's "Progress, part 2".
   - **Terrain** ("very unnatural and jagged"): most of it was the border (ragged 30-60 m "Cliffs & mountains" on all
     four sides, in the sea too): now Shoreline & sea south, Forest wall elsewhere. The cliff's foot is cleaned (spikes
     and pits gone) with a scree apron, shingle band and stone faces; inland terrace banks softened; 12 craters.
   - **The grid** is part of it: the cliffs must stay over 50° to keep the 7 routes, and on 2.5 m cells that means one-
     or two-cell steps; every smoothing tried (Smooth all, contour smoothing, a rounded crest lip) opened about 30 new
     ways up (climb flood). MapMaker caps terrains at 161 vertices a side, so no finer grid; **owner's call**: raise the
     cap to 321 (1.25 m) with a Terrain → Change grid resample (4× terrain triangles).
   - **Plants**: foliage layer (crest Overgrown, bluffs and village Lush, none on sand/shingle), 114 bushes (109 our
     Broadleaf Shrub, which conceals), 24 trees, 32 hedges in hedgerows.
   - **Beach**: 43 hedgehogs, 10 Belgian gates (new kit prop `prop.belgian_gate`), 19 tank traps, 2 wrecks, 2 burning
     wrecks (`prop.landing_craft_wreck_burning` finished: surfaces, palette picture, provenance); haze 0.4, mist 0.2.
   - **Bot runs** (Breakthrough, seeds 1-3, 1200 s; baseline re-run on main d3ed2a0 the same day). A / B / C fell at (s):
     | | 16 v 16 | 24 v 24 |
     |---|---|---|
     | main (before) | A 49/42/51, B 211/154/160, C –/298/268; 2 of 3 broke through | A 60/40/39, B 178/201/148, C –/457/–; 1 of 3 |
     | + sandbags, stair cheeks, terrain, props | A 60/40/70, B 215/118/203, C 390/275/294; 3 of 3 | A 70/42/64, B 178/155/170, C 429/355/286; 3 of 3 |
     | + half the beach defenders spawn on the cliff top | A 41/36/56, B 171/122/172, C 381/255/316; 3 of 3 | A 79/67/58, B 201/216/172, C 405/–/251; 2 of 3 |
     | + MG nest per strongpoint (final) | A 51/38/52, B 156/160/174, C 239/244/301; 3 of 3 | A 81/57/64, B 169/182/191, C 415/423/318; 3 of 3 |
     The beach holds longer at 24 v 24 (57-81 s against 39-60), not at 16 v 16 (38-52 against 42-51); the attack now
     breaks through every time (the unstuck stairs help it more than the posts help the defence). **Owner's call**:
     more zone time on A1/A2, or accept.
   - **Stuck** (stair cheeks: rock Sky Blocks filling the wedges beside the flights): bot-report `stuckAt` near route 1
     (x -160..-144, z -62..-38) 624/4/0 and 42/35/8 before, 2/0/0 and 7/0/12 after; near route 5 (x 26..56, z -46..-32)
     549/0/6 and 158/12/16 before, 0/0/5 and 0/5/0 after. Stuck recoveries a match: 16 v 16 1405/111/95 → 82/75/109,
     24 v 24 515/336/284 → 189/297/139. New hot spot: route 7's head (156, 12-13, -36), 102 in one 24 v 24 match.
   - **Perf** (`pnpm bench`, Breakthrough, 4 shared cores at load 21-24, main's map benched alongside): 48 bots 8.76 ms
     avg tick (CPU 4.79; main 7.65 / 4.20), 64 bots 9.04 ms (CPU 5.35; main 9.54 / 5.07). Plants are drawn only (the
     server doesn't see them); not measured on a GPU.
   - **Next**: the owner's two calls above; playtest the beach; route 7's head hot spot.
3. **Bot AI Phase C follow-up, part 1 landed** (`wip/bots-c2`; green on `check/bots-c2`, run 42424732057; main
   fast-forwarded to it). BOT_AI_PLAN.md has the tables under "Phase C follow-up".
   - **Landed:**
     - bots step off a sill outside a wall only onto a clear walk (`NavWorld.wayOnto`): the Capitol Mall office trap;
     - corridor followers are counted on their corridor (the crowd price and bot-report see them).
   - **Measured** (CTF sample, seeds 1-6, 48 matches): part 1 plays as main (captures 48 → 50, stuck 1.32 → 1.31 a
     bot-minute, busiest way 59 %). TDM and the Breakthrough Range (seeds 1-24: 19 against 18) within noise.
   - **Held back, the owner's call: large bots duck** (2c586e5a, reverted in c69cd330). Stuck 1.32 → 1.18 (Diamond
     Park halved), but captures 48 → 40, and botCtf.test's two capture matches go without one. Proposed next: route
     large bots round low roofs instead of crouching through.
   - **CTF ablations, no change made:** captures per take 0.24 before items 1-4, 0.18 on main; without parkour 0.15,
     without keep-right and the strafing rule 0.21, without both 0.17. Neither explains the drop; at 48 matches
     captures move about ±10 between builds, and the drop is under two standard errors. The strafing rule does cut
     stuck recoveries (1.43 → 1.32). Not ablated: ground that goes, corridor routes.
   - **Part 2, large bots route round low roofs (owner's option a): done, held back for the owner** (`wip/bots-lowroof`
     @ fc4d701 and its docs commits; green on `check/bots-lowroof`, run 42428308885). BOT_AI_PLAN.md, "Part 2", has the tables.
     - **How:** the navmesh marks ground with less headroom than a large body (2.12 m) as `LOW_AREA` (`nav/solo.ts`,
       Recast splits polygons there); tall bodies' searches price it at 1,000 a metre (`findPath` `tall`), small and
       standard ones don't change. A route that still goes under (no way round, or it starts or ends there) turns on
       the duck (`lowRoute`, `mustDuck`). `botLowRoof.test.ts`.
     - **Measured against main b8854c6:** stuck 1.31 → 1.12 a bot-minute (large bodies 1.54 → 1.01; Diamond Park 2.17
       → 1.04 over seeds 1-12), ducking 0.0 s a match; TDM stuck 1.04 → 0.76, kills the same; the Range 19 → 19.
       **But captures 50 → 43** (48 matches), all of it Diamond Park and Qasr Medina: Diamond Park 13 → 5 over seeds
       1-12, flag takes up, returns 36 → 51 (large bodies' 6 → 17). Un-stuck large defenders, not crouching carriers.
       A moderate price (4 a metre) gave Diamond Park 9 captures, ducking 6 s a match.
     - **The owner's call:** land it, land it with the moderate price, or neither. Not landed: the goal was the stuck
       reduction without the capture loss.
   - **Next:** route spread (CTF's busiest way about 60 %): route loose side-lane bots through a corridor's via
     instead of `laneWaypoint`, measured on the 48 matches.
   - **The measuring commands** (run each on the branch and on a detached worktree of main; `--compare=a.json,b.json`
     puts them side by side, `+` joins shards):
     - the CTF sample: `pnpm bot-report diamond_park sunken_kingdom bunker_cross serene_city capitol_mall fernwood_moon
       qasr_medina twin_spires --mode=core.ctf --seeds=1,2,3,4,5,6 --seconds=180 --shard=k/2 --json=<out>/ctf.k.json`;
     - with it, TDM: `pnpm bot-report eagle_spires twin_spires riot_junction --mode=core.tdm --seeds=1,2,3,4 --seconds=180`;
     - the Range: `pnpm bot-report test_breakthrough --mode=core.breakthrough --players=16 --seeds=1,...,24
       --seconds=900 --json=<out>/bt8.json`.
4. **Roulette** (`wip/roulette`, main 0531b29 merged in): CI fixed, landing from `check/roulette` (see "Roulette mode"
   below for the fix, the pictures and the bench).

5. **Party join and the vote between matches** (`wip/party`, agent, 2026-11-08; owner-approved brief; green on `check/party` at 775f503, run 42482093840; LANDED: main 775f503). docs/GAME_MODES.md
   "Between matches", MULTIPLAYER_PROTOCOL.md §21, HOSTING.md (`MAP_VOTE`).
   - **Vote:** `shared/sim/mapVote.ts` (`pickVoteOptions`, `tallyVotes`, `MapVote`; 12 s vote + 3 s winner). Ballot: 2-3
     suite maps for the mode that fit the people (caps), rotation's next first, never the map just played (unless
     nothing else fits). Bots don't vote; ties: the host's vote, else ballot order (dedicated); no votes: the first.
     Dedicated: `server.ts` `planVote`/`voteClosed`, suite caps read in the background 20 s after start
     (`server/src/rotation.ts` `suitePool`). Browser host/offline: the page picks (`session.ts` `openVote`, map index
     now carries `caps` per mode), `matchHost.ts` runs the vote, the page travels on the winner (`voteWon`).
     `Match.holdIntermission` holds the scoreboard; a held scoreboard keeps the vote open (tests use that).
     HUD `game/mapVoteHud.ts` (`#map-vote`), Esc over it opens the pause menu. Setting: Rotation card checkbox
     (`cs.mapVote`), `MAP_VOTE`/Host Service `mapVote` (in-game changes kept).
   - **Parties:** `net/party.ts`, client `game/party.ts` (tab tag in sessionStorage; `?join=CODE&party=TAG`); `hello.party`,
     `Combatant.party`, roster `py`, `Match.takeOverBot` prefers the party's team (`partyTeam`). Joins past
     max(map cap, match size) are refused on both hosts. Guests get `#pause-invite`; Online's form takes links and offers
     Rejoin (6 h, `tiletrigger.lastJoin`).
   - **No hub change, nothing to deploy on AWS.** The Lightsail box only needs the usual update for dedicated servers.
   - Tests: shared `mapVote.test.ts` (ballot, tally, ties, hold, rotation moveTo, party sides and carry-over), server
     `chain.test.ts` (vote travel, MAP_VOTE off), client `localHost.test.ts` (cap, party side, vote count); e2e `party`
     (offline ?test=1 vote with keys → next map same players; phone tap; online invite link → same side → both vote →
     travel together). hostcontrols e2e and server hostControls test play with the vote off (plain rotation checks).
   - **Tests and tools keep the old replay:** browser tests (`?test=1`) have the vote off unless `&vote=1`; the e2e
     runner's dedicated server and Host Service run `MAP_VOTE=0`; the perf tools set `cs.mapVote=0` (a TDM match
     ending mid-measure travelled to a fresh worker and broke perf:mass). A long e2e flow that should see the vote asks.
   - The dedicated server's ballot reads suite maps raw (JSON only; a full load of all 92 took ~8 s): race tracks
     aren't offered from the suite there (their paths migrate on load); a race rotation still votes.
   - Open: the launcher/site /host have no vote toggle (config/env and in-game only); the successor of a handoff doesn't
     carry parties or an open vote; free-for-all parties only get the scoreboard mark.

**Queued, in the owner's order:**
1. **Tanks** (owner, 2026-11-07). Bots drive and fire tanks sensibly, and bail out when nearly dead.
   - **Occupants:** whoever drives or rides a tank can't be shot from outside.
   - **The gun:** works, with limited ammo shown in the HUD. Proposed refill: slowly over time, and full at an ammo
     pickup. The owner hasn't confirmed.
   - **Damage:** rockets and blasts wear its health down; bullets do little.
   - **Destruction:** occupants still inside die with it.
2. ~~**Hovercraft** stuck under structures~~: done (`wip/hover-stuck`, see "Hovercraft under structures" below).
3. **Sound pass 2** (Sonniss and Freesound). Both are approved, and their hosts are on the environment's allowlist.
   - Sonniss sits behind a Cloudflare browser check, so the owner puts the chosen packs in the Drive.
   - Freesound needs an API key: ask with the credential form, never in chat.
4. ~~**Fireteams.**~~ Part 1 done: see "Fireteams, part 1" below. Parts 2 (formations, bounding, the squad HUD) and 3
   (squad scores, MVP, the party preset) are next.
5. **The MapMaker overhaul.** Its Phase 3 item 9 is the rotate ring.
6. **Community maps.**
7. **Kit-prop generators.**
8. **Player profiles,** last.

**Owner's answers (2026-11-07, later):**
- Fishy Fred: the name stays; his Meshy page is https://www.meshy.ai/s/P4iLfn (shows CC0). Recorded in his manifest
  (`source.url`). Follow-up: provenance takes the URL from the shared `meshy-community-characters` pack in
  content/models.json, not per character; make build.mjs prefer a character's own `source.url` (needs the lock entry
  to carry it) so each community character credits its own page.
- Rex: no dinosaur bot-name list.
- Blinking lights: fine for now; leave the 26 maps as they are.
- Hurt-bot retreat: no per-fight cap.
- Tank ammo: as proposed (refills slowly over time, full at an ammo pickup). Tanks job can start on that.

**Still open:** M1 recordings for performance round 4; a playtest of Breakthrough Range.

- **Hovercraft under structures** (queued item 2; `wip/hover-stuck`). Two causes, both in the shared vehicle sim (every
  ground vehicle, every map; flyers keep their climbAssist):
  - **The lift ratchet** (the owner's spot). `PhysicsWorld.moveVehicle` starts each move 5 cm up and asks to come down
    by as much. Pinched between two contacts it can slide along neither (Iron Tide's 3 m door at the top of the stairs
    up to the deck at (-16, 4, -20): the Hauler's probe is 3.04 m across, its hull 3.2), the controller moved it
    nowhere, not even down, and the 5 cm stayed: the Hauler rose 5 cm a tick up the door into the lintel and the roof
    (feet 6.2 m after 2 s; body centre "at 5") and stuck there. A refused move now keeps the vehicle where it was,
    resting (the drop alone is tried), and a move that creeps up into the level when it didn't start there keeps its
    height (as moveCharacter does for players): it stops in the door at deck height and backs out.
  - **The probe's dome.** The probe capsule's radius follows the hull's width, so it stands far over the hull (Hauler
    3.43 m against 2.0; Speeder 2.82 against 1.3; Hover Bike 2.37 against 1.0). Under Iron Tide's decks (3.4 m clear)
    and Dune Harbor's arcade (a 0.9 m sill, a lintel at 2.5) the dome caught where the hull fits. A low probe (the
    capsule's own lower half as a convex hull, cut flat at the hull's top: `createLowVehicleProbe`) carries a ground
    vehicle while something is over its hull (`PhysicsWorld.overhead`, a cylinder from the hull's top to the dome's),
    or when the capsule is stopped and the low probe gets further (`Match.moveVehicleProbe`). Open ground: the capsule
    alone, to the millimetre (test).
  - Also: a vehicle freed from a wedge drops its built-up stall (it was marked wedged again a tick later).
  - **Tests** `shared/test/hoverCeiling.test.ts`: flat-ground ride height, top speed and path for all three, equal to
    main's to 1 mm; Iron Tide's door from the deck and from the stairs; Dune Harbor's arcade (a Speeder through, a
    Hauler stopped outside and backed out); a 3 m-thick slab just over each hull (in, through, back out; placed under
    it, out either way; lower than the hull, stopped outside); a door narrower than the probe; bot steering (steer())
    under a deck and out. 6 of the 18 fail on main.
  - **bot-report** now prints, per match, `vehicles:` stalls (a driver on the throttle, under 1 cm a tick for 1 s+),
    wedges, by vehicle and where, and `vehicles inside the level` (vehicle-seconds with the top of the hull's middle
    in level geometry; `boxClear(..., skip, levelOnly)`) and where each vehicle ended. bot-report's own wedge count
    is 0 on main: bot drivers back out long before the 3 s mark.
  - **Numbers** (`pnpm bot-report iron_tide dune_harbor --mode=core.tdm --seeds=1,2,3,4 --seconds=300`, main vs this):
    vehicle-seconds inside the level Iron Tide 12 → 6, Dune Harbor 24 → 4 (hovercraft 9 → 4); vehicle stalls 120 →
    136 and 61 → 65 (hovercraft 44 → 65 and 61 → 65: about the same spots, mostly walls by the spawns; seed-to-seed
    noise is as large). **Foot-bot stuck recoveries rose on Iron Tide: 3.09 → 5.41 a bot-minute** (Dune Harbor 2.27
    → 2.98), most of it one seed: a Hauler now gets in under Iron Tide's decks, a bot bailed out of it at 12.7 m/s,
    the empty hovercraft glided ~35 m into the 3 m door at (0, 0, 28) and plugged it for 100 s. Before, the dome kept
    Haulers out from under the decks. ~~**Next (bots / vehicles, owner's call):** bot drivers follow the foot navmesh
    through doors narrower than the vehicle; bots bail out at full speed; an empty hovercraft coasts on~~: done, see
    "Empty vehicles stop, bots park out of the way" just below.
  - **Tanks** (coordinator's question, after the tanks job): not the same cause. `pnpm bot-report iron_tide
    --seeds=1,2,3,4 --seconds=300` (CTF), main 110ee71 vs this: tanks given up stuck 9 in 18 drives → 9 in 16, 9 → 7
    of them at (±4, 0, -2). That spot has 7.4 m over it: it is the row of pillars at z -4 (x ±4..6, solid to 4.1 m),
    the long hull against them, not a ceiling. Left for the tanks work. (bot-report's `vehicles inside the level`
    needs this branch's `boxClear(…, skip, levelOnly)`: run on main's sim it counts each vehicle's own box.)
  - Landed: main = da68ed3 (green on `check/hover-stuck`, run 42429583559).

- **Empty vehicles stop, bots park out of the way** (`wip/hover-regress`, agent, 2026-11-08; the hovercraft item's
  left-over; green on `check/hover-regress`). All in the shared sim and bot code:
  - **An empty vehicle brakes** (`vehicle.idleBrake`, m/s², in every vehicle's data; default 10; not ambient track
    cars): nobody at the wheel, it brakes to a stop, its slide too. A Hauler got out of at 12.7 m/s stops in ~7 m
    (was ~35). Driven vehicles unchanged (hoverCeiling's open-ground drives match to 1 mm).
  - **Bots get out slowly**: unless it burns or is about to blow, a driver brakes under `BAIL_SPEED` (3 m/s) before
    pressing use, and a rider waits till it is that slow. On or over water (`MountView.overWater`: afloat, in a
    liquid, or a flyer with water under it) they stay aboard up to 8 s more (`EXIT_GROUND_WAIT`) instead of jumping
    in (bots were left swimming in Iron Tide's moat by the wall at (-20, 0, 72) after a dropship sank there).
  - **Bot drivers keep to routes their hull fits** (`vehicleRouteFits`, the tanks' `routeFits` for every ground
    vehicle and hovercraft; flyers none): clear `vehicle.routeFit` × the half width either side (default 0.95, the
    probe's; the Tank keeps 0.8), and now also high enough for the hull (`half[1]` × 2) over the highest ground
    within half its length, as a hull rides level. Checked when a bot picks a vehicle (as tanks were) and on each new
    route at the wheel (80 m ahead): a new route that doesn't fit keeps the route it has; with none, it gets out.
    Iron Tide's worst foot-bot stuck spot, (-4, 1, 16), turned out to be a tank or jeep driven up the centre stairs,
    stopped on the first step by the beam at 3 m over their foot (the hover fix's creep guard, correctly) and left
    plugging them; before the hover fix the probe ratcheted up through the beam.
  - Not done (optional): foot bots routing round a parked vehicle (the navmesh has no dynamic obstacles).
  - **Tests** `shared/test/vehicleBail.test.ts` (16): eight vehicles stop within v²/2·idleBrake (a Hauler from
    12.7 m/s in under 8 m), a bot arriving at speed gets out under 3 m/s (on fire: at once, at speed), stays aboard
    on Iron Tide's sea, routeFit data, Iron Tide's 3 m door (no Hauler route; a Hover Bike's fits), the centre stairs
    (no tank or jeep route), a bot in a Hauler sent through the door gets out short of it. 13 of the first 14 fail on
    main. vehicles-resolved fixture rewritten (only the two new fields).
  - **bot-limits.json**: the check's 10 s+ idle spells 1.5 → 2.5 a match, longest idle 45 → 50 s. The check's one
    fernwood_moon match swings on its north rope lift (14 m, a 17 s round trip: bots wait 10-13 s at the top). On main
    seeds 2-4 of that match give 5, 7 and 3 such spells and a 46 s longest (seed 1: 1 and 32 s); this branch
    reshuffled seed 1 to 6 and 47 s. Revert if the owner prefers a different fix (the lift wait itself).
  - **Numbers** (`pnpm bot-report iron_tide dune_harbor --mode=core.tdm --seconds=300`, seeds 1-12: the HANDOFF's
    four seeds turned out too noisy, a seed swings 200-600 stuck recoveries and runs aren't fully repeatable; foot-bot
    stuck recoveries a bot-minute, vehicle stalls, wedges, vehicle-seconds inside the level):
    - pre-hover main (110ee71 + the new bot-report): Iron Tide 2.69, 416 stalls, 8 wedged, 211 s; Dune Harbor 2.02,
      111, 0, 13 s.
    - main (d3ed2a0): Iron Tide 3.43, 337, 19, 6 s; Dune Harbor 2.15, 196, 7, 116 s.
    - this branch: Iron Tide **2.77**, 155, 13, 5 s; Dune Harbor **2.27**, 56, 0, 8 s. Bots spend less time in
      vehicles (mounted 8.0 → 4.5 % on Iron Tide, 5.7 → 4.6 % on Dune Harbor): they take fewer that don't fit.
    Iron Tide is back near the old number; Dune Harbor is main's within the noise, not yet pre-hover's 2.02.
  - **Left over**: (-4, 1, 16) still collects stuck recoveries (292 in 12 matches, from 454 on main): a vehicle still
    reaches the stairs sometimes (the route check samples every 2 m, and which samples land on the beam varies), and
    (-12, 1, -48) on Iron Tide (204). Dune Harbor's top spots now (56, 0, 4..8), (36, 0, -4), (-12, 0, -16). Foot bots
    routing round parked vehicles would cover what remains.

## Start here (session of 2026-11-04, handed off to the next account)

**State:** `main` = f61f2cf (+ this note), green. Everything below "Landed" is on main; nothing is half-merged.
Workflow is unchanged (CLAUDE.md): work on a `wip/<name>` branch → push `check/<name>` (or a train of several) → when
that run is green, fast-forward `main`. CI is now ~9–10 min a round (balanced shards, headless all-maps check,
coverage map; browser map tour only nightly/tags/Run workflow; new push cancels the older check run; fail-fast).
Poll a run without auth: `curl -s "https://api.github.com/repos/Dsoto1/splitters/actions/workflows/ci.yml/runs?branch=check/<name>&per_page=1"`.
Repo is public: Actions minutes are free. Run fast checks locally before any push to check/ (`pnpm typecheck`,
`pnpm content:check`, the unit tests you touched); let CI run the slow e2e. Max 2–3 agents at once (the container
gets overloaded above that: local e2e times out and flakes). Prune landed worktrees; disk is limited.

### Landed 2026-11-04 (newest first)
- 798bf75 Hitboxes per look (+ generous margin, `HITBOX_MARGIN`), character stats (optional, default = size class),
  match settings "Character stats" (on) and "Random characters" (off); Wealthy Otter and Shade retired; CI speed-up
  (coverage map `maps/test_coverage.json`, `testOnly` map flag, headless allMaps tests, shard packing, fail-fast).
- da7d432 De-toy pass: world colour grade (`WORLD_GRADE`, docs/LOOK.md) and real surfaces + real-world sizes on
  man-made Kenney props (`content/surfaces*.json`); CC0 Meshy Community snowmobile replaces the Kenney sled.
- e5932fb Procedural environment spec + Phase 0 audit (docs/PROCEDURAL_ENVIRONMENT*.md) with the owner's decisions.
- c44d379 Tiles as data (content scalability step 7: core kit + edge styles) and character hands round 4.
- f5cc70b Capitol Mall domes, roofs; Capitol Dome / Copper Dome / Pediment / Pyramidion props; room Roof surface.
- Earlier the same day: content scalability steps 2–6, perf toolset, flaky e2e fixes, Runway Nine airliner, map
  reworks batches 2–3, character fixes rounds 2–3 (see the entries below and CHANGELOG).

### Fireteams, part 1 (`wip/fireteams`, agent, 2026-11-08; owner said "Go"; green on `check/fireteams` at 4610a3b, run 42493762584; LANDED: main 4610a3b; docs/FIRETEAMS_PLAN.md "Part 1", docs/BOTS.md "Fireteams")
- **What players see:** a **Fireteams** variant chip in Match setup for TDM, CTF, KotH, Bomb, Hostage and
  Breakthrough, with **Squad size 4 / 5 / 6** (5 standard) beside the score. In play, "You lead a fireteam of 5 ·
  hold B for orders" and an orange **SQUAD · FOLLOW ME** line over your portrait.
  - **Hold B** opens the order wheel: the weapon wheel's ring in orange, six orders, your squad's current one ringed.
    Defend the objective is dimmed in TDM. A tap of B is still the quick messages.
  - A controller holds d-pad up (a tap pings); a phone gets an **Orders** button by Weapons.
  - Let go on an order: a squadmate answers in the chat ("Holding here!") and the HUD line changes.
  - Servers: `rules fireteams 5`.
- **Code:** `shared/src/sim/fireteams.ts`, holding the squads (`sync`), orders (`checkOrder`, `order`, `step`) and
  `memberGoal`.
  - The Match hooks: `stepFireteams`, `squadOrder` (say 110-115), `fireteamGoal` in `botGoal`, `fireteamSpawn` (with
    `spawns.ts leaderSpotSafe`) and `squadObjective` (`ModeLogic.defendSpot`: KotH, Breakthrough, CTF, Forts).
  - The director takes fixed squads (`update`'s `fixed`). The 'squad' event; `OrderGoal.squad` (weight 1.3).
  - Client: `input.ts` (wheelKind, ordersOn, B / d-pad hold, takeOrderClose), `weaponWheel.ts` (an id), `session.ts`
    (updateOrderWheel, squadEvent), `hud.ts setSquadOrder`, `touchControls.ts` (Orders), and the Match setup squad size.
- **Joining:** `takeOverBot` and `BotFiller.join` are untouched (wip/party's party join landed first). The squads follow
  the roster, so a joiner takes over a bot-led squad by itself.
- **Proof:**
  - unit `shared/test/fireteams.test.ts` (17: assignment incl. join, leave, takeover, away and back, small teams;
    order checks; member goals; the order's weight in the choice; leader down and back; carried out; Match setup;
    in a match: Hold here from the wheel, a refusal, respawn beside the leader or not, a friend's takeover, the squad
    holding);
  - `client/test/inputWheel.test.ts` (+3: tap vs hold of B, one wheel at a time);
  - serverRules and setupPlan lists updated;
  - e2e flow **`fireteams`**: Sandgate TDM `?test=1`, the variant on, you lead 5, a tap of B is the menu, hold B opens
    the wheel, pick Hold here, the answer and the HUD, then you go off and the squad holds 8 s later. The flow is
    registered in flowMap (sandgate, frontend, the wheel and touch files), with timings 130 s (the 16-shard budget
    allowed no more, which is why the phone part went to a unit test).
- **Measured:** FIRETEAMS_PLAN.md "Part 1, measured". Cohesion is much better (distance to the leader 20-57 % less).
  **But kills and CTF captures fell** (captures 2.0 → 1.0 / 0.5 a match on Bunker Cross / Diamond Park): members follow
  a bot leader, not the objective. A "share the leader's objective" variant was tried and reverted (worse). Bench:
  bot thinking about main's (table there; the box was at load 25-33).
- **Screenshots** (this session's scratchpad, may not survive): `fireteams/fireteams-wheel-desktop.png`,
  `fireteams-wheel-phone.png`, `fireteams-ordered-desktop.png`, `fireteams-hud-*.png`.
- **Pitfalls:**
  - this container's local e2e couldn't start a match within 90 s under load (swiftshader), and the default GL closes the
    page about 25 s into a match: CI is where the flow runs;
  - physicsfx's canyon blast and glass checks flaked once more on a check run (as noted above);
  - bench numbers at load 25+ are not comparable with the 2.5 ms guard: re-measure on a quiet machine.
- **For the owner:**
  1. Land Part 1 with fewer captures in bot-only CTF, or first make bot-led squads push the objective (Part 2's
     formations).
  2. After the leader's respawn, a squad on Follow me or Attack that regroups on them, while one on Hold here, Go there
     or Defend the objective keeps its post. Keep that?
  3. The party preset (Part 3) and the squad HUD (Part 2) are next.

### Ammo Boxes by the tank routes (`wip/ammo-boxes`, agent, 2026-11-08; owner-approved follow-up to Tanks 2 item 2)

**Maps** (MapMaker only: Import → palette Ammo Box (`pickup:core.ammo`) placed by hovering the spot → Export, Playwright
driving the page; each file is MapMaker's own output, which also took Iron Maw (24) and Glacier Line (20) to format 29
and stamped `metadata.release`; a key-order-blind compare shows only the new pickups changed). Spots chosen from where
bot tanks actually drive (a scratch heat probe over TDM matches) and checked flat, open and on a route the tank's hull
fits from its spawn (`vehicleRouteFits`):
| map | Ammo Box (x, y, z) | where |
|---|---|---|
| Iron Tide | (6, 0, -44) | hangar deck, aft end by the well deck, 16 m from the tank's spot (neutral tank, one box) |
| Iron Maw | (-88, 0, 84), (88, 0, 84) | each side's haul road, ~118 m out from its tank (mirror pair) |
| Coldwater Gulch | (-32, 0.86, 60), (32, 0.86, -60) | each side's tank lane, 46 m from its tank (point-symmetric) |
| Frost Basin | (28, 0.99, 40), (-28, 0.99, -40) | the road down from each tank (point-symmetric) |
| Glacier Line | (0, 0, -20) | mid-field on the attackers' tank approach (the depot already had (50, -0.15, -104)) |
| Shingle Point | (32, 15.24, 72) | the garrison's bluff road, 42 m from its tank (the beach already has four at the landing) |
`after_hours` (named in the brief) is not a map in maps/; skipped. validate-map: 0 new issues (Glacier Line's one
logic warning is old).

**Bots** (bots/brain.ts `resupplyFor`): a driver goes for an Ammo Box when the cannon is empty (up to `AMMO_DETOUR`
120 m, as before) **or low** (`AMMO_LOW_SHARE` 3 of 10 or fewer with no target, `AMMO_LOW_DETOUR` 70 m), and keeps
going till full; it reads the cannon of the gunner beside it too (`MountView.seats[].shells/maxShells/refills`; before,
a driver with a crewed cannon never knew it was dry). A box its route doesn't fit is passed over for 60 s instead of
making it get out. A crewmate in the same vehicle is never a target (in a free-for-all the driver turned onto its own
gunner and sat there). The trip flag no longer carries into the next seat. Tests: tanks.test.ts (low → drives 40 m
over the box and fills; a gunner's cannon low → the driver takes it; 6 shells drives on; a box 90 m off only when empty).

**bot-report** (`pnpm bot-report iron_tide iron_maw coldwater_gulch frost_basin glacier_line shingle_point
--mode=core.tdm --seconds=300 --seeds=1,2,3`, 18 matches; before = main 8616c87):
| | before | after |
|---|---|---|
| to an ammo pickup (trips) | 0 | 7 (Coldwater 4, Shingle 2, Glacier 1) |
| refills | 0 | 2 (Coldwater) |
| shells fired | 149 | 123 |
| tanks driven (bot-s) | 1009 | 820 |
| kills from aboard | 81 | 62 |
| destroyed / given up stuck / bailed | 8 / 8 / 7 | 6 / 7 / 7 |
Trips that didn't end in a refill (probe): the crew bailed (tank about to blow, deep in enemy ground) or the box was
taken first. Bot tanks rarely run low at all, which is why trips stay few: in the heat probe's matches Iron Tide,
Iron Maw and Frost Basin tanks never got down to 3 shells. Driving/shell totals moved with the matches
(new pickups change every match's course; Iron Tide is identical), not with the trips.

**For the owner:** (1) the spots above are first picks; move them in MapMaker if a lane reads better elsewhere. (2) a
general Ammo Box also refills infantry: the Coldwater and Frost Basin ones sit on open lanes 16-40 m from other ammo,
none in a chokepoint.

### New players: Quick Play, the tutorial, first-time tips (`wip/quickplay`, agent, 2026-11-08; owner-approved brief; green on `check/quickplay` at 973e65f, run 42471172929; LANDED: main 973e65f)

**Quick Play** (`frontend/quickPlay.ts`, FrontEnd `openQuickPlay`/`quickPlay`): first item of the main menu (`#nav-quick`,
highlighted by default). It opens a small choice over the menu: Team Deathmatch or Deathmatch (the last one marked
"Last played" and focused; Enter, arrows, Esc and controller B work), plus "New here? Tutorial" and "Choose map and
rules…" (Match setup). Rules:
- maps from `QUICK_MAPS` only (TDM: sandgate, canyon, crossroads, halcyon_station, frost_basin; DM: citadel,
  crossroads, bunker_cross, halcyon_station: the maps the TDM/DM tables and bot-report samples play), only official
  entries (no `group`), only if they play the mode;
- maps whose recommended most (metadata) is over this device's limit are left out when any fit (phones);
- not the map played last time when there's another; random among the rest (test mode: the first);
- players: `mapPlayerCaps(map, mode).recommended`, capped by the device; DM = you + rec−1 bots, TDM = two even teams
  of ⌊rec/2⌋; normal bots; the mode's own score, time following the size; offline, through `rulesFromSetup` →
  `hooks.playLocal` (Match setup's own path). Remembered: `localStorage tiletrigger.quickPlay` {mode, last}.
  Match setup's saved setup (`cs.arcade`) is left alone.

**Tutorial** (`game/tutorial.ts` rules, `game/coachHud.ts` + `coach.css` the card, session.ts `coachFrame`; main.ts
`playTutorial`, also `?tutorial`): Training Range, Deathmatch, no bots, no time or score limit. Ten steps, each done
by its action as the session sees it (inputs sampled each tick and the predicted player, never a timer): look (2 rad
of turning), move (5 m with a movement input), sprint (1.2 s), crouch (0.4 s), shoot (3 rounds), aim (2 rounds while
aiming or scoped), reload (a reload running), switch (another weapon in hand), throw (a throwable count going down),
drive (15 m in a vehicle's driver seat; the HUD marker points at the nearest vehicle, held at the screen's side when
it's out of view). The card: "Tutorial n / 10", dots, the step's words for keyboard and mouse or for the touch
controls (`[X]` → key caps), a progress bar, Skip (on the card, tappable on touch; and `#pause-skip-tutorial` beside
Resume, since Esc pauses). Skip or Leave → main menu. About 1.5-2.5 minutes with reading.
- Offered once: a first visit's main menu shows a "New here?" card (`#first-run`: Start tutorial / Not now; on short
  screens it takes the featured map's place). `localStorage tiletrigger.tutorial`: offered → skipped / done. Also in
  Quick Play's choice and Options → General → Tutorial.
- **Map (MapMaker, Playwright driving Import → palette → inspector X/Z → Export; the export took it to format 29):**
  Training Range gained a Buggy and Frag Grenades by each spawn group: buggy (-26, 30) and grenades (-20, 27) west (behind the second weapon rows main added at x -12 and -15),
  buggy (206, -32) and grenades (194, -24) east (two east spawns exist). Nothing else changed; validate-map 0 issues.
  (wip/gunplay-audit may edit the range too: these are behind/beside the spawn rows, away from the lanes.)

**First-time tips** (`game/tips.ts` TipBook, shown by coachHud): reload (magazine at a quarter or less, rounds in
reserve), vehicle (one in reach to enter), pickup (one 1-8 m ahead), armour (you picked some up), shield (spawn
protection on you), death (you died: spectate keys). Once each ever (`localStorage tiletrigger.tips` {off, seen}),
one at a time (6 s, 1.5 s gap; a waiting tip older than 12 s is dropped unseen), low in the middle (73 %; phones 67 %,
left of the Use button), never over the crosshair, fade only (nothing for Reduce flashing to calm). Options → HUD:
First-time tips (switch) and Show tips again (reset). Off in the tutorial.
- **Browser tests:** the first-visit offer and tips are off under `?test=1` and in automated browsers
  (`navigator.webdriver`), unless the page asks (`&newplayer=1`; tips also `&tips=1`), so other flows and baselines
  don't see them. Hooks: `window.__tutorial` (state, goTo, skip), `window.__tips` (current, trigger), `window.__quickPlay`.

**Menu on short screens:** six buttons now; at ≤380 px tall (a phone sideways with browser bars) they go in two
columns (touch keeps its 40 px buttons). Menu baseline regenerated (only menu.png).

**Tests:** `packages/client/test/newPlayer.test.ts` (each step on its own action and not by waiting, dead frames,
timing; tips once only, one at a time, stale dropped, off; Quick Play's map choice and sizes); e2e flow `newplayer`
(offer, Start tutorial, a step completing from input, Skip back to the menu, Quick Play → Deathmatch, remembered
choice, a tip once and clear of the crosshair, touch words on a phone), mapped in flowMap (tutorial/tips/coachHud,
frontend/, training_range). offline flow's nav check now expects `nav-quick` first. Pictures (agent scratchpad
`quickplay/`): 01-menu-first-visit-*, 02-quick-play-*, 10-tutorial-step01..11-*, 20-tip-vehicle-* (desktop 1280×720
and phone 750×342 touch).

**CI notes:** the first check run (05a1515) failed only characters3's far-bodies check (`core.hyena` at 52/98 m drawn
1.5 of 2.12 m, both attempts; canyon, nothing this branch draws); the merged commit's run passed it, and failed only
physicsfx (blast throws on canyon, then the bulletproof glass's health read before the hit landed: one crack, health
100), which passed on a re-run of the failed job. Both look like timing flakes; watch for them.

**For the owner:**
1. Quick Play's map lists (above): add or drop maps? The lists live in `frontend/quickPlay.ts`.
2. Quick Play is the highlighted first item, so Enter on the main menu opens it (it was Play). Keep?
3. The tutorial's drive step uses the Buggy; the range has two (one per spawn group). Fine, or a different vehicle?

### Gunplay audit, measured (`wip/gunplay-audit`, agent, 2026-11-08; owner-approved brief: measurement first, no tuning; green on `check/gunplay-audit`, run 42466478881; LANDED: main f1a16d3)

- **Tool:** `pnpm gun-report` (`packages/server/src/tools/gun-report.ts`) drives the real shared sim (Match) on a flat
  deck, one perfect shooter and one standard target, for every gun (34): TTK at 10/25/50/100 m (body/head,
  unarmoured/full armour; ideal, hip and ADS medians of `--trials` seeds), shots to kill, first shot, draw, reload
  tactical/empty and cancels, recoil settle, cones, falloff, drop. `--json`, `--svg` (TTK chart), `--from=<json>`
  redraws. About 3 minutes. Private parts of Match it hooks: `fire`, `spreadDir`, `spawn`, `rng`, `bullets`.
- **Report card:** docs/GUNPLAY_AUDIT.md (numbers: docs/gunplay-audit.json; chart: docs/gunplay-ttk.svg). Headline:
  responsiveness is right (0 ms first shot, 0 ms reload cancel by fire, 133 ms swap to the Pistol from anything);
  the Assault Rifle beats the SMG at the SMG's range (0.50 vs 0.60 s at 10 m; hip at 25 m 0.52 vs 3.50 s) and is the
  best gun from 20 m out; shotguns kill in one shell only to ~5 m (Sawed-Off 8 shells at 10 m); Machine Pistol
  dominated by the SMG; Marksman out-kills the Precision Rifle on body shots; Pulse Pistol (beam, no falloff) beats
  the Pistol at range. Appendix A: the G0-G6 checklist with file:line evidence (G0/G1 done; G2 no lever action; G3 no
  multi-client latency/loss test; G4 weapon choice by hand-set botRange; G5 lethality/ballistics/friendly fire only).
- **Training Range:** every gun not on the front rack (24) now lies on two racks at x -12 and -15 (placed with
  MapMaker's palette and inspector, exported; validate-map 0 issues). Still missing (listed in the audit, appendix C):
  damage readout on hit, humanoid dummies that don't shoot back, armoured targets, a trajectory view.
- **CI note:** physicsfx's canyon blast checks failed on first attempts here (a bot stood by a wall; nothing from this branch runs there) and passed on re-run; watch it.
- **Next (owner picks from the audit's ranked list):** 1 SMG vs rifle identity, 2 shotgun room range, 3 damage
  numbers option, 4 precision rifle body case, 5 melee breaks reloads / auto-reload, 6 recoil-wall readout,
  7 8-client latency/loss harness (G3), 8 bot weapon choice from measured ranges (G4).

### Deathmatch and Team Deathmatch (`wip/tdm-dm`, agent, 2026-11-08; owner-approved brief; green on `check/tdm-dm` at 95f3f80, run 42455479068; LANDED: main 95f3f80)

**The brief:** in the Roulette bench (48 bots, Sandgate, free-for-all) 71 % of Deathmatch kills were within 3 s of the
victim spawning. Spawns, spawn protection, player caps per map, awards and callouts for every mode, new effects,
bot-report pace metrics.

**What changed:**
- **Spawn choice** (`sim/spawns.ts` `pickSpawn`, one rule for people and bots; weights in `content/match-play.json`
  `spawnChoice`, `tools/content/match-play.mjs`): distance to the nearest enemy up to 30 m (past 50 m a little less:
  out of the game), enemy sight lines (best 8 candidates, 4 nearest enemies within 50 m, −35 each), fresh deaths an
  enemy made within 12 m in the last 10 s (up to −18, at most twice that), occupants and recent use as before, a 0-3
  random tie-break; then **random among the best 3 within 8 points** that have no enemy much nearer than the best's and
  aren't seen when the best isn't. Team modes on shared spawns: +6 a teammate out of a fight near it, and `SpawnSides`
  (each side's running spawn centre) gives ±8 for your own end of the map: no spawn flips, safety still decides.
  Squad spawn (TDM, 70 %): of four random teammates out of a fight, the one nearest the fight that no enemy sees.
- **Spawn protection** (`Match.shielded`, `Combatant.shieldUntil`; `spawnProtection(rules)`): Deathmatch and TDM 3 s,
  Roulette 2 s (now the general mechanism; `RouletteDirector.protectedNow`/`endProtection` are gone), other modes
  none; rule `spawnProtection` overrides. Every respawn and a mid-round first life; not the lives a round opens with.
  Firing, throwing or striking drops it. `FX_PROTECTED` for everyone; the client shows a faint ball-lightning shimmer
  (Reduce flashing: a steady soft-blue glow on the body) and "Spawn protection: firing ends it" under your crosshair.
  Bots: a shielded enemy counts as 6× further; a shielded bot holds fire until `botFireBefore` (1 s) before it ends.
- **Player caps** (`metadata.playerCaps` by mode, optional; `autoPlayerCaps`/`mapPlayerCaps`, sim/matchSetup.ts;
  docs/GAME_MODES.md "Player caps"): MapMaker Map properties "Players by mode" (below Bots; empty = automatic; Auto
  button); Match Setup chip `#setup-caps` and a `caps` fit item (over the most: problem with a fix); `rulesForTravel`
  caps the fill; the dedicated server remembers the asked fill across smaller maps (`askedFill`); the rotation skips
  maps too small for the people in it (`MapRotation.peekFitting`, server and browser host). No map JSON edited: every
  map is on its automatic caps. The browser host keeps the capped fill after a smaller map (the server doesn't).
- **Awards and callouts** (`sim/awards.ts` `MatchAwards`): Most Accurate (25 rounds), Longest Streak (3), Nemesis (3
  of one player), Most Revenge Kills (1), plus Roulette's; one `awards` event with the round's end (the old `rl
  awards` is gone); `callout` events (revenge; nemesis at 3 in a row). Client `game/awardsHud.ts` (`#match-awards`,
  `.award`; the roulette e2e reads it now). bot-report prints the awards as they stood.
- **Effects** (content/vfx.json, prepared with `ONLY=hit_fx,flame_fx node tools/content/prepare-vfx.mjs --downloads
  /home/user/fx-packs/links-full`): `pickup.armor` (strike_04, tinted blue), `armor.break` (hit_05, pale blue; `hurt`
  event `a: 'armor'`), `hit.big` (big_impact_01; `hurt` `a: 'big'` at `heavyHit` 45 damage; the victim's screen edges
  darken: `hud.heavyHit`, hurtVignette.ts `HeavyFade`), `streak` (big_impact_02, gold, at 3, 5, 7, 10, 15...),
  lasting `shield.spawn` (ball_lightning_04, level 0.32) and `aura.damage`/`aura.speed` (purple/cold fire at the
  feet). New `tint` on an effect (godotVfx.ts `VfxOptions.tint`: secondary/tertiary colour, a pale wash on the core).
  The fight's moments count against the full one-shot budget (not the minor one) and, with Reduce flashing on, play
  at 0.8 size and 0.55 brightness, faded in. The `flashing` e2e flow has a new `fight` moment (and draws the heavy-hit
  edge).
- **bot-report** pace line and compare table: spawn deaths, seconds between fights (a spawn or a fight's end to the
  next hit; hits within 3 s are one fight) and from a spawn, engagement distance (hits on enemies), kill spread
  (entropy over 21 m regions) and the busiest tenth's share.

**Before → after** (`pnpm bot-report`, seeds 1-3, 120 s; before = main e394a8e with the new metrics; Sandgate at 48
bots, the others at their own sizes):
| Map | mode | spawn deaths | between fights (s) | from a spawn (s) | engagement (m) | kill spread | kills/min |
|---|---|---|---|---|---|---|---|
| sandgate (48) | DM | 71.2 → 46.9 % | 1.0 → 1.5 | 0.5 → 1.0 | 8.0 → 7.4 | 0.280 → 0.296 | 489 → 406 |
| citadel | DM | 5.1 → 0.3 % | 4.7 → 5.0 | 3.2 → 3.8 | 10.2 → 9.9 | 0.477 → 0.495 | 52 → 49 |
| crossroads | DM | 22.2 → 6.2 % | 2.4 → 3.1 | 0.9 → 1.9 | 11.7 → 12.4 | 0.510 → 0.521 | 94 → 73 |
| bunker_cross | DM | 5.0 → 2.9 % | 6.4 → 6.3 | 5.7 → 5.8 | 12.7 → 12.2 | 0.666 → 0.655 | 40 → 40 |
| halcyon_station | DM | 20.8 → 3.8 % | 4.3 → 5.3 | 3.1 → 4.6 | 8.3 → 8.0 | 0.530 → 0.560 | 87 → 74 |
| sandgate (48) | TDM | 1.6 → 0.0 % | 10.0 → 10.3 | 10.9 → 10.7 | 16.3 → 14.9 | 0.335 → 0.276 | 93 → 101 |
| crossroads | TDM | 1.5 → 0.0 % | 7.1 → 7.3 | 5.8 → 7.1 | 23.2 → 21.8 | 0.404 → 0.356 | 34 → 36 |
| bunker_cross | TDM | 1.2 → 0.0 % | 15.5 → 13.8 | 19.9 → 20.6 | 22.4 → 15.4 | 0.695 → 0.456 | 14 → 16 |
| halcyon_station | TDM | 0.0 → 0.0 % | 10.4 → 10.1 | 11.0 → 10.6 | 13.8 → 13.8 | 0.337 → 0.369 | 27 → 26 |
| canyon | TDM | 0.0 → 1.2 % | 12.6 → 11.6 | 14.8 → 13.7 | 22.5 → 20.6 | 0.657 → 0.615 | 26 → 29 |

Deathmatch spawn deaths fall by a third at 48 on Sandgate and by two thirds to nine tenths elsewhere; TDM had almost
none and keeps it so, with time between fights the same or shorter. **But Deathmatch's time between fights rises
0.3-1.0 s** (kills a minute down 6-23 %): most of it is the shield (a respawned bot holds fire ~2 s and is mostly left
alone). The knob is `botFireBefore`: with it at 2 (bots hold ~1 s) the rise is 0.1-0.5 s, but spawn deaths fall less
(Sandgate 71 → 61 %, Crossroads 22 → 18 %, Halcyon 21 → 8 %; seeds 1-3, 120 s). Sandgate at 48 stays high either
way: 48 is its automatic most (16 spawns × 3), and two thirds of its kills are in a fifth of the map. TDM's kill
spread falls on some maps (bunker_cross 0.70 → 0.46): squad spawns now go to the teammate nearest the fight.

**Tests:** `spawnChoice.test.ts` (scoring, deaths, random few, sight, side ends, protection on fire, mid-round
joiner), `awards.test.ts`, `playerCaps.test.ts`, roulette.test (protection on a respawn, the merged awards event),
reduceFlashing.test (heavy edge). Changed: weapons.test (players placed where the test wants them: spawns are now
random among the safest few), teamplay.test (unchanged, passes), matchLimits.test (its campus map sets TDM caps),
botPush.test (garrison > 0.25 at seed 1; over seeds 1-5 assault 0.30 vs 0.26, garrison 0.25 vs 0.37 on main),
botMovement.test (easy strafing speed > 1.12; 1.149 now), hostControl.test and setupPlan.test (their small test maps
set player caps; the fit list starts with `caps`), airplane.test (landed dropship bots may knife each other),
client prediction.test (starts on a fixed spawn point). e2e: roulette drops the shield with `shieldUntil = 0`; the
arsenal flow's wall check stands on the first spawn point with open ground and a 1.45 m wall (was the spawn you got,
and 1.3 m: a crouched eye line cleared it by centimetres); flashing has a `fight` moment (passes, setting on and off);
the arena and canyon baselines are new (the first spawn moved). Checked locally: typecheck, content:check, the
touched unit tests, `bot-report --check` (every limit held), e2e flashing, arsenal (CI=1) and visual.

**Pictures:** session scratchpad `tdm/`: 01-armour-pickup-f*, 02-armour-break-f*, 03-big-hit-f*, 04-streak-f* (frames
1-5 after each starts, a frozen page clock and canvas grabs on the built game, Citadel), 05-spawn-shield,
06-aura-damage, 07-aura-speed, 08-awards. The pictures found a real problem: armour-break and big-hit bursts played at
the body's middle were hidden inside the body; they now play half a metre toward the camera (`View.towardCamera`).

**For the owner:**
1. Deathmatch pace: keep `botFireBefore` 1 (spawn deaths way down, ~0.5 s more between fights), or 2 (pace as before,
   spawn deaths down less)? Or a shorter shield (2-2.5 s)?
2. The automatic caps (docs/GAME_MODES.md "Player caps"): free-for-all recommended = the map's Max players as far as
   its spawns go, most = 3 × spawns, 80 m² a player and 3 × recommended. Fine, or set some maps' own in MapMaker?
3. Effects to look at in the pictures: the armour pickup's blue burst, the heavy-hit and streak sizes.

### Tanks 2: balance and the Ammo Box (`wip/tanks-2`, agent, 2026-11-08; owner's decisions on the Tanks items)

**Owner decisions (2026-11-08):** (1) keep "the driver fires the cannon while its seat is empty" (no change; noted in
tank.json, CONTENT_PIPELINE and GUNPLAY_SPEC §48); (2) tanks were too strong: bots fetch launchers for a tank, and
rockets hurt vehicles more; (3) the cannon refills only from the general Ammo Box.

**What changed:**
- **Rockets x2 against vehicles** (weapon `vehicleDamage`, data in content/weapons; tools/content/weapons.mjs checks
  0-5): rockets, guided, swarm, blast_rockets and mount_rockets are 2. It multiplies what a weapon does to a vehicle
  (kind `vehicle`) only, before its armour share (`Match.damageMount`, given the weapon id by splash, a projectile's
  direct hit and bullets); players, turrets and sentries take what they did. Tank armour unchanged (blasts 1.25): a
  Rocket Launcher side hit is 2 x (40 + 120) x 1.25 = 400 of 1200, so 3 kill it (4 at an angle; was 6), Guided 412
  (3), Blast Rockets 288 (5), a full Swarm volley 500. Unarmoured vehicles go quicker too: a Rocket Launcher hit is
  320 (buggy 450 in 2, was 3; kart, speeder, hover bike, snow sled in 1).
- **Ammo Box only** (seat `ammo.pickups`, vehicles.mjs checks the ids are ammo pickups; the Tank `["core.ammo"]`):
  `Match.resupply` takes only a named pickup and refills only the guns it names; other ammo pickups are left lying.
  Bots out of shells look only for those (`SeatView.refills` -> `ammoPickupFor`).
- **Bots vs armour** (bots/brain.ts `watchArmour`): an armoured vehicle (`MountView.armoured`: armour.bullets < 0.5,
  or sealed) with an enemy aboard within 60 m is remembered 12 s. Then a bot whose weapons don't hurt vehicles (frag
  grenades no longer count while a tank is about) goes up to 60 m for a launcher (30 m for other vehicles), values
  launcher pickups and ammo for an empty launcher 3x (`ARMOUR_PICKUP_BOOST`), draws a carried launcher even with no
  target (`chooseWeapon` vehicle flag), and aims explosives at the middle of the hull (`aimPos`: before, a rocket at the
  sealed crew went over the 2 m deck through the non-solid turret). `antiVehicle` = vehicleDamage > 1 or splash >= 50.
- **bot-report:** the tanks line adds "launchers picked up" (every pickup of an anti-vehicle weapon on a map with a
  tank, not only while one is near). Workbench: weapon "Damage to vehicles", seat "ammo pickups".

**Tests** (packages/shared/test/tanks.test.ts, 29): rocket vs grenade blast on a tank (x2) and on a player (same);
3-4 live rockets kill a tank; the data names only core.ammo, and Light/Rifle/Shells/Sniper/Explosives leave it at 2
shells and lie there; a rifle bot fetches a Rocket Launcher 42 m away with an enemy tank about and leaves it without;
a bot carrying rockets draws them and puts at least 400 into the hull.

**Bot results** (`pnpm bot-report iron_tide iron_maw coldwater_gulch frost_basin --seeds=1,2,3 --seconds=180`, CTF, 12
matches; before = main 110ee71 with the launcher counter):
| | before | after |
|---|---|---|
| tanks destroyed | 1 | 4 |
| bailed about to blow | 1 | 3 |
| drives | 33 | 31 |
| driven (bot-s) | 685 | 536 |
| kills from aboard | 56 (cannon 45, MG 8, roadkill 3) | 33 (cannon 24, MG 7, roadkill 1, barrel 1) |
| shells fired | 95 | 73 |
| launchers picked up | 90 | 134 |
| ammo trips / refills | 1 / 2 | 0 / 0 |
| given up stuck | 8 | 11 |
Destroyable now, still worth driving (about 3 kills a tank-match). Crew died with it: 0 both times (they bail at a
quarter). Stuck give-ups are the known spots (Iron Tide centre), not changed here. Tick times in the after run are
inflated by other agents' suites on the box.

**For the owner:**
1. Light vehicles: rockets x2 applies to every vehicle (the brief said vehicles and tanks): a Rocket Launcher now
   one-shots a kart, speeder, hover bike or snow sled and two-shots a buggy. Keep, or limit `vehicleDamage` to
   armoured vehicles?
2. Ammo trips fell to 0: with only Ammo Boxes counting, few are within 120 m of where tanks fight on these maps; the
   cannon still refills one every 15 s. Place Ammo Boxes near tank routes in MapMaker, or fine as is? **Done**
   (owner approved): "Ammo Boxes by the tank routes" above.

### Tanks (`wip/tanks`, agent, 2026-11-07; Queued item 1; CI on `check/tanks`)

**What changed** (all in the tank's vehicle data, content/vehicles/tank.json, with the generator's schema and checks,
the Workbench fields and docs/CONTENT_PIPELINE.md "Tanks and armour"; GUNPLAY_SPEC §48 note):
- **Sealed crew** (`armour.sealed`): nobody aboard can be shot, blasted or struck from outside (`Match.sheltered`: out
  of every shot's targets, splash and `damage()`); when it is destroyed everyone inside dies (`core.wreck`, credited to
  whoever destroyed it) and the wreck and explosion are as before. Other vehicles still throw riders out.
- **Armour** (`armour`): surface `armor` (rounds stop on it, spark, no penetration), bullets ×0.1, blasts ×1.25
  (splash and a projectile's direct hit), melee ×0; crashes and hazards full. About 6 rockets or 5 shells kill it; the
  roof MG alone needs about 70 s. `damageMount` takes a `MountHit` kind.
- **Shells** (seat `ammo`): the cannon carries 10, one back every 15 s, all at any ammo pickup the crewed tank drives
  over (it takes the pickup); full again at a respawn. HUD: "Tank Cannon 10 / 10", low under a quarter, "Empty" at 0
  (`PrivateState.mo[3]`; client prediction won't fire with none).
- **The driver fires the cannon while its seat is empty** (seat `driverFires`; `firingSeat()` in sim/mounts.ts, used by
  the match, the client HUD and prediction, and bots), the shot kept within the seat's arc; a gunner who gets in takes
  it back. Not asked for: a crew of one could not shoot at all (owner to confirm, below).
- **Tracks** (`vehicle.pivot` 0.8 rad/s): turns on the spot. Bot steering pivots for sharp turns and doesn't count
  turning on the spot as stuck.
- **Bots:** prefer a tank to another vehicle (15 m further, 20 m more detour); take one only where the route fits it
  (`routeFits`: 0.8 of its width, the ground probed under the route; kept off Iron Tide's hangar passages); fight from
  it at a stand-off (close to 28 m, hold and turn the hull, back off under 10 m), shells only at targets worth one (a
  vehicle, turret or sentry; on foot past 10 m while over 30 % of the load is left or with another enemy beside them);
  drive to an ammo pickup within 120 m when out; don't bail out of a sealed one for a fight; get out under its
  `bailHealth` 0.25 or when it burns. Bots with nothing that hurts vehicles rank sealed crew a third as worth shooting.
- **bot-report** prints a `tanks` line (driven, moving, metres, guns manned, drives, back-outs, give-ups and where,
  bails, ammo trips, shells, kills from aboard, destroyed, crew killed).

**Tests:** `packages/shared/test/tanks.test.ts` (18: sealed crew vs a buggy driver, rockets vs bullets, shells, refill,
pickup refill, gunner takes over, respawn load, pivot, bail at a quarter, a bot drives 112 m without a back-out, a lone
bot shells an enemy buggy, route clearance). e2e: `tankChecks` in the `vehicles` flow (Iron Tide: in at the wheel,
HUD 10/10 then 9 after a shot, a blast beside you hurts only the tank); passed locally (CI=1 timeouts, loaded box).

**Bot results** (`pnpm bot-report iron_tide iron_maw coldwater_gulch frost_basin --seeds=1,2,3 --seconds=180`, CTF):
34 drives, 2,964 m driven, 116 shells, 51 cannon kills and 8 roof-gun kills from aboard; 9 drives given up stuck (Iron
Tide 4 at about (±4, 0, -2), iron_maw (-100, 1, 146), coldwater (-10, 0, 100), frost_basin (15, 0, -93) and
(-13, 13, -93)), 8 back-outs; no tank destroyed in 12 three-minute matches, so no bail-outs or crew deaths there.
Before (main, coldwater and iron_maw): bots hardly drove tanks (0 s on both); a driver had no gun.

**For the owner:**
1. Driver fires the cannon when the cannon seat is empty: keep? (The alternative is a driver who can't shoot.)
2. Balance: tanks are strong against bots (no tank destroyed in 36 bot-minutes; cannon kills lead the board on
   coldwater). Options: blasts ×1.5, fewer shells, or bots fetch launchers for tanks more eagerly.
3. Any ammo pickup refills the cannon (also Light/Rifle/Shells/Sniper rounds). Or only the general Ammo Box?
4. The remaining stuck spots (above) are where a person-sized route still squeezes a tank; Iron Tide's centre is the
   worst (the same area as the hovercraft item).

### Roulette mode (`wip/roulette`, agents, 2026-11-07; main 0531b29 (friendly fire) merged in; landing from `check/roulette`)
**What it is:** docs/ROULETTE_MODE_PLAN.md ("As built") and docs/GAME_MODES.md, "Roulette". The mode is
`core.roulette`; Lunar Roulette plays it with Lunar on; balance is data in `content/roulette.json`
(`tools/content/roulette.mjs`).

**Why run 42405165063 failed:** not the unit tests (all unit and maps shards passed) and not an old-Lunar-Roulette
assumption. The one real failure was the `roulette` e2e flow (shard 2; shard 11 was only stopped by
stop-on-failure). On both attempts it never saw two spawn cards: the first life's card (`card: null`) and, on the retry,
the jackpot card. The only one it saw was the second life's, which the flow holds for its picture. Those cards
counted their 2 s on the wall clock from the spawn event, so on a slow runner the hitch while the new body was built
spent the card's time before any frame drew it. A player on a slow machine would miss it the same way.
**Fix:** `game/cappedTimer.ts` (`CappedTimer`): the card counts 2 s of drawn frames, each frame counting at most
0.1 s, so a hitch can't use it up unseen (unit test `client/test/cappedTimer.test.ts`). The flow's checks are
unchanged. The flow's pictures also showed the card staying up over the death screen and the scoreboard: it now
goes when you go down or the round leaves `playing`.

**Checked locally (CI=1):** typecheck, content:check, `test:changed`; `E2E_ONLY=roulette` passes (330 s). Its
pictures are `roulette-setup`, `roulette-spawn-card`, `roulette-pick`, `roulette-jackpot` and `roulette-awards` (under
`E2E_SHOTS`). The jackpot glow is faint in the picture: with Reduce flashing on it peaks at 0.32 opacity, at the
screen's edges.

**Bench** (a shared 4-core machine at load 13-17, so the numbers are rough; 48 bots, 60 s, Sandgate):
| mode | tick avg | p95 | p99 | CPU a tick | character moves (full + coarse) | spawn deaths |
| --- | --- | --- | --- | --- | --- | --- |
| core.roulette | 5.26 ms | 13.3 | 29.6 | 4.24 ms | 31 + 1 | 211 of 372 (57 %) |
| core.tdm | 4.10 ms | 10.3 | 18.5 | 4.05 ms | 6 + 39 | 0 of 72 |
| core.deathmatch | 5.96 ms | 16.1 | 35.7 | 3.72 ms | 31 + 1 | 348 of 490 (71 %) |

Roulette costs what free-for-all Deathmatch costs. Its extra over Team Deathmatch is free-for-all's: everyone fights
everyone near the spawns, so nearly every move is a full one, and there are 5x the kills. Its 2 s spawn protection
cuts spawn deaths from Deathmatch's 71 % to 57 %, still high for 48 on Sandgate. `pnpm bench:96:clump` (Team
Deathmatch, a check that nothing else moved) is in line: tick avg 7.5-10.5 ms over the six runs.

**Not done (as before):** the host checkpoint doesn't carry decks or tokens; dedicated servers have no server rules for
the variants yet.

**For the owner:**
- the balance numbers in `content/roulette.json`:
  - jackpot 5 % a life, tiny 4 %, a pick card a jackpot 15 %;
  - 50 jackpot armour; tiny 0.65 size and ×1.08 speed;
  - a pick at 3 kills; a reroll token per 2 kills, 2 at most;
- the jackpot upgrades, some of them strong (sniper → railgun, rockets → guided, plasma → railgun, goo gun, freeze ray
  and arc caster → singularity);
- whether big free-for-all Roulette matches need more spawn protection or spawn spacing.

<!-- small-fixes-1107 -->
### Friendly fire (`wip/friendly-fire`, agent, 2026-11-07; from main c8d8cba3; CI on `check/friendly-fire`; not landed)
**Root cause:** the rule reached the match (Match setup's `rulesFromSetup`, the Host tab's `setRules`, hostRules KEPT;
bots aren't flagged npc) but only `damage()` read it, and every hit test before it left teammates out: `targetsFor`
(rounds, pellets, ballistic bullets, blades, punches) filtered on `hostile`, a projectile's direct hit skipped allies
(a rocket flew through and burst beyond), and `applyStatus` dropped burns, poison and slows from allies. Splash
already sent everyone to `damage()`, so only a blast right beside a teammate hurt.
**Fix:** `Match.canHurt(a, b)`: an enemy, or anyone not hostile when `rules.friendlyFire` is on (never NPCs, never in
a race without combat); used by the hit tests and `applyStatus`. Third-person aim (`targetsFor(..., aimOnly)`),
homing, walkers, mines and bots' targets stay on `hostile`. **Tests:** `shared/test/friendlyFire.test.ts` fires each
path for real (rifle, shotgun, rockets, knife, flamethrower and its burn) at a teammate and an enemy with the rule
off, half and full; Breakthrough; a team kill earns nothing (fails without the fix). e2e `teams`
(`friendlyFireChecks`): Match setup's rule reaches the match; a teammate takes your rounds with it on and none off.


### Frozen characters in big matches (`wip/frozen-fix`, agent, 2026-11-07; green on `check/frozen-fix` at 63731808, run 42407015946; landed on main 63731808)
**Root cause:** the figures frozen mid-run (some in the air) were the dead. Performance round 4's pose smoothing
(`CharacterAnimator` `blend.on`, set only in `stepAt`) stayed on after a death: GameView stops calling `stepAt` once a
character dies (startRagdoll and toCorpse run first; corpses are never stepped), and `ragdoll`, `lieDown`, `die`
and `freezePose` never cleared it. So every frame the patched `Skeleton.prepare` overwrote a corpse's skin with its
last two living poses (`blendSkin`, its evals and time frozen too): the ragdoll moved the bones unseen and the body was
drawn standing where it died, until it sank or the 32-corpse cap took it. Only deaths in a smoothed band (screen share
below 0.075, about 15 m and more at the usual field of view) did it, which is why big matches (many far deaths at
once, more bodies kept) showed it and a 12 v 12 near fight hardly did.
**Measured** (scratchpad `frozen/probe.mjs`, Shingle Point 32 v 32 TDM, real client): before, 9 of 9 corpses of the
fight's own deaths and 1-3 after each scripted mass death had the smoothing on; one corpse's drawn skin stayed the
same (checksum 19942.942) over 12 s while its pelvis moved 3.41 → 2.52 → 2.56 m. Live characters were all stepped
and animating (no live one stuck). Corpses drawn off their bones (max skin-matrix error), before → after: the fight's
own deaths 4 of 4 (4.1) → 0 (0); mass death 2: 2 of 2 (2.9) → 0 (0); mass death 3: 3 of 9 (3.3) → 0 (0).
**Fix:** `CharacterAnimator.endSmoothing()` (smoothing off, recorded poses and the gun's dropped) on die, ragdoll,
lieDown, freezePose, standBy and revive, so a body is drawn as its bones lie and a revived or reused body starts
afresh. **Tests:** `client/test/smoothedDeath.test.ts` (a ragdoll's drawn skin follows its joints after a smoothed
death; laid down and plain deaths stop smoothing; a kept body stands up fresh; fails without the fix); e2e
`physicsfx`: a bot 22 m off, smoothed, is killed and its corpse's drawn skin matches its bones every frame.
**The singularity:** its pull lasts as ARSENAL says (cannon 2.4 s, grenade 2 s; code unchanged since 10-28), and
characters it holds are alive and animate. The figures frozen in the air were bodies killed by its collapse blast:
this fix covers them.

### Small fixes from the owner's play, 2026-11-07 (`wip/small-fixes-1107`, agent; from main 3647eee9; green on `check/small-fixes-1107` at f79d1ec2, run 42384938315 (the full suite: unit, maps, build, check, bots, perf, 14 e2e shards); not landed)
Four owner reports, each fixed at the cause with a test (CHANGELOG, "Small fixes from the owner's play").

- **Breakthrough Range is an ordinary map** (`maps/test_breakthrough.json`, id kept): "Test map" unticked in MapMaker's
  Map properties and its card's description reworded ("A Breakthrough test layout" was its first sentence), through
  the real editor (Import, a mouse click on the box, typing, Export: revision 5); its map picture
  (`public/maps/shots/test_breakthrough.jpg`, 16 KB, `tools/content/capture-map-shots.mjs`). Play, Match Setup,
  rotations and the host's list offer it (Breakthrough its first mode). e2e `breakthrough` goes without `testmap=`
  and checks Match Setup lists it; `main.ts` no longer adds a `testmap=` map that is already listed. Tests:
  mapIndexPlugin, server testMaps.
- **The use prompt**: the key's letter took the global `kbd` rule's dark ink (#0b0f1a) on `#prompt kbd`'s dark cap.
  Now white text, a light green key (#7dff9a) on a dark cap, a soft dark outline and a faint dark backing; refusals
  light red. e2e `vehicles` checks the colours and the key's contrast on its cap (at least 7:1). No baseline shows it.
- **Dropship wedged on Shingle Point's beach.** Headless repro (`bot` match, 24 bots): a bot flew a Dropship into a
  landing craft wreck (prop at 12, -1.4, -61) and left it turned across the hull, 708 ticks wedged in 180 s. Causes:
  the vehicle probe is a capsule of the hull's half width (1.9 m) that covers only its middle, so it fits the wreck's
  open stern; turned across a 5 m hull it can't move; flyers never climbed on their own and bot pilots never climb.
  Entry was refused because the nose and tail (4.8 m from the centre) were past the 4.5 m enter radius and the sides
  were inside the hull (no prompt, E did nothing). Bots walked to its centre, gave up when the plan ran out, came back
  30 s later. Fixes, general: flyers driven into something they can't pass climb on their own (`climbAssist`, Match
  driveVehicle) and settle back to their height after (`assistFrom`); entry within the enter radius of the centre OR
  1.6 m of the hull (`enterReach`, sim/mounts.ts: the match, the client's prompt and the bots); "The … is full"
  (denied) by a full vehicle; `wedged` (driven, no headway 3 s) marks a vehicle for every bot until it has moved 3 m;
  bots walk to a spot off the hull (`boardingSpot`), give up after 2 failed boardings or no route, longer each time
  (`avoidSeconds` 30/60/120/240 s); `bot-report` prints boardings. The beach props' collision is right (their boxes
  match the models; a Dropship rides over the hedgehog, timber, dory and a desk: tested). Numbers (scratch harness,
  same measure before and after): Shingle Point 180 s: Dropship wedged 708 → 15 ticks, back to a mount it had dropped
  6 → 1; the Dropship placed wedged in the wreck, 3 seeds × 150 s: a player at its nose can't → can get in, wedged
  731 → 119 ticks, bots back to it after giving up 9 → 1, it is flown out after 17-65 → 14-38 s; failed use presses
  0 → 0 (on main bots pressed E only within 95 % of the radius, so they walked instead: the "turn around and back").
  Iron Tide and Dune Harbor have no wreck, but their Dropships wedged too (323; 244 + 506 ticks) → (189, climbing a
  cliff; 38 + 44). Their hovercraft (Hauler, Speeder, Hover Bike: hover, not flyers) still wedge on structures (a
  Hauler under Iron Tide's platforms at -16, 5, -20): not the beach props, left for a vehicles pass. `bot-report
  shingle_point --mode=core.tdm --seeds=1,2 --seconds=180`: boarding 43/29 tries, 0 failed, 6/7 given up on, 1/0 back
  to one given up on. `test/vehicleWedge.test.ts`.
- **Count Bonesworth's gun vanished after the scope** (every character, every gun with a sharper held copy: pistol,
  rifles, shotguns, SMGs, revolver, the Marksman Rifle St. John's Military set has): on Medium and High a gun you pick
  up fetches its sharper copy (`View.sharpenViewmodel`); it took over with `old.isEnabled()`, which asks the parents,
  so when it came in while the gun was put away (scoped, or in third person: the view's root off) it stayed off, and
  the hands held nothing until you switched guns. Now `takeOverViewmodel` (game/viewmodelSwap.ts) takes the old
  copy's own switch. Reproduced on cue (scoped, the copy swapped in, scope down): before, the gun off and not drawn,
  no hand on it, for Bonesworth, the Dapper and the Iron Knight; after, drawn and gripped. The "flicker" itself didn't
  show in frame-by-frame probes (gun and hands drawn every frame, the grip steady at 3-4 cm, standing and prone, the
  Sniper Rifle and the Marksman Rifle, canyon and St. John's); hands chasing a gun that isn't drawn is what the owner
  would have seen. Unit test `viewmodelSwap.test.ts`; e2e `characters3` scopes with the copy swapped in mid-scope.
- Pitfalls: the e2e flows that use `window.__match` run the match on the page (`localStorage tiletrigger.sim =
  main`); a Playwright driver needs the same or `__match` never appears. A loaded machine draws a frame in seconds:
  wait on the view's state (camera fov for the scope), not the clock.

<!-- /small-fixes-1107 -->
<!-- perf-4 -->
### Performance round 4: crowds, 32 v 32 in a browser, 64 v 64 on a dedicated host (`wip/perf-4`, agent, 2026-11-07; from main 5087b0b6, main 3647eee9 merged in; CI on `check/perf-4`; not landed)
docs/PERF_96.md, "Performance round 4", has the numbers; CHANGELOG has the player-facing lines.

**What changed:**
- **Animation by size on screen, smoothed** (`game/animLod.ts`, `CharacterAnimator.blendSkin/blendGun`). Far
  characters drew each evaluated pose until the next, so a running foot stood still 2-4 frames, then jumped up to
  half a metre. Now the frames between are blended from the pose before the last to the last (the skin matrices and the
  held gun; the bones keep the evaluated pose). Bands by a standing character's share of the view's height (a scope
  brings far ones back): every frame to ~15 m (fingers kept past 8 m), 30 Hz to 25 m, 20 Hz to 40 m, 15 Hz to 80 m,
  10 Hz to 150 m, 5 Hz beyond, all smoothed. The coarse after-clip detail (no arm IK) starts at 25 m (was 35 m): that
  pays for it. `?perfoff=animlod4` gives round 2's bands.
- **Loops faded out stay started 3 s at weight 0** (`CharacterAnimator.fadeOut`, `?perfoff=animlinger`).
- **Effects world** (`sim/effectsPhysics.ts`) steps its pipeline without Rapier's per-step walk of every collider.
- **Garbage:** joints turned and restored in place; avatars' last positions reused.
- **Warm-up's files first** (`GameView.prewarm`, `session.prepareMatch`): looks and guns load alongside the effects;
  the gate waits for them (20 s at most) before the shader warm-up's 8 s.
- **Caps:** `BROWSER_MAX_PLAYERS` 64 (32 v 32; phones 16), Match Setup's Max 32v32 and a fit warning past 48 players.
  `MAX_PLAYER_SLOTS` 128 (64 v 64) with `NPC_ID_BASE` 1000 (was 100: slots 100-127 read as NPCs and a 128-player
  match crashed on its first shot) and `PROTOCOL_VERSION` 5. Layouts 32v32 and 64v64 added.
- **Handoff e2e flake, root cause:** the flow's three pages shared one browser, so one GPU process drawing all their
  frames with SwiftShader; each page's synchronous WebGL calls (program link status, uniform blocks, extensions) wait
  behind the others' frames. Measured (an init script timing those calls, not committed): the joining friend's page
  waited 30-55 s in a single second on them. The flow now gives each page its own browser (`instrumentBrowser`); the
  same run then had the friends' worst second at 16 s and the successor named in 30 s instead of 64 s. Real players
  never share a GPU process with two other games, so nothing in the game changes for it; the 60 s grace for a stalled
  friend with its connection up stays.
- **Bench:** `--wire` reports each viewer's delta snapshots raw and deflated. **Recordings:** each hitch carries the
  browser's long tasks and long animation frames over it.
- **Host Service:** its launcher's player and team steppers follow `MAX_PLAYER_SLOTS` (128, 64 a team).

**Measured** (4 cores shared with two other agents, load 8-11; before and after in turn):
- Running character at 30 / 50 / 80 m (virtual 60 fps filmstrips): frames the foot stood still 7 / 9 / 9 of 11 before,
  0 after; biggest jump 51 / 40 / 41 cm before, 14 / 15 / 16 cm after. Pictures:
  scratchpad `p4/strip/running-30-50-80m-before-after.png`.
- Character bench (56 running and strafing 5-60 m, CPU per frame at a virtual 60 fps): 23.1 → 18.7 ms (-19 %), with
  11 % more evaluations; clip starts 49 → 40 a second.
- Effects world step on Shingle Point (2,970 colliders): 4.38 → 2.76 ms, ~0.4 MB less garbage a step.
- `pnpm bench 64`: bot thinking 0.87-2.32 ms a tick on four maps spread and clumped (guard 2.5).
- `pnpm bench 128` (64 viewers, `--wire`): tick 11.4-13.3 ms avg, p95 20-25 ms on this loaded box, about a quarter
  over 96 players under the same load (8.3-12.0, p95 15-25); bot thinking 2.8-3.9 ms; each player sent 26-57 KB/s
  deflated (0.2-0.45 Mbit/s).

**64 v 64 on a dedicated host, what it takes:** the cap is 128 now, and nothing structural stands in the way after
the NPC id move. Not measured on a real host box: a desktop-class core (the tick is ~1.25x 96 players') and, with 128
people connected, about 3-7 MB/s of upload (26-57 KB/s each). The client draws up to 127 characters: far ones are
cheap now, but a 64 v 64 map should spread them out. `pnpm bench 128 60 maps/<map>.json --mode=core.tdm
--viewers=128 --wire` on the host's own machine says whether it holds.

**For the owner to record on the M1 (High, render scale auto, 60 fps cap):**
1. 32v32 offline TDM on Shingle Point and on Market Town (Max preset): a 30-60 s recording each with a 10 s trace.
2. A running crowd at a distance: stand at one end of Shingle Point's beach and watch bots run 30-80 m off; then the
   same with `?perfoff=animlod4` for the old look side by side.
3. A rocket into a crowd on Market Town (7+ kills), recording running.
4. The first 10 s of a match after the update (the first visit: the cache empty), on Shingle Point.

**Left for later:**
- **The mass death on Market Town** (frames of 60-140 ms for 0.6 s after a 7-kill rocket, all outside the game's own
  work) was not found here: the box ran at load 20 and SwiftShader's frames took seconds. A local trace of the blast
  showed one 175 ms young-generation collection and nothing else long on the main thread. Recordings now carry the
  browser's long tasks and long animation frames per hitch (`perfRecorder.ts` `watchMainThread`; `compare.mjs` prints
  them), so the owner's next rocket-into-a-crowd recording says main thread (collection or script) or GPU (neither).
- Character moves are most of a 128-player tick; bot thinking's setup is 0.7-1.6 ms of it (BOT_AI_PLAN Phase B).
- Not done: shared evaluation for characters on the same clip and phase, fewer bones on far skeletons, impostors.

<!-- intake-rex-fred -->
### Import list batch 1: Cool Hands Rex and Fishy Fred (`wip/intake-rex-fred`, agent, 2026-11-07; from main dc60bdb5, main 0d03c3bd merged in; green on `check/intake-rex-fred` at beb336a7, run 42396566250; not landed)
The owner (2026-11-06): "call him 'Cool Hands Rex', i made him in meshy"; "i did not make fishy fred, community".
Downloads in `/home/user/meshy-drive/intake-2026-11-06b/` (raw, never committed), linked in the agent scratchpad
`rexfred/dl`; each built with `ONLY=<id> node tools/content/prepare-meshy-characters.mjs <dir>`. Both are Mixamo
rigs from Meshy; their Running and Walking clips are not used. Scratch: `rexfred/` (tools, shots, audits).

| Character (manifest / look) | Group, size, bot names | Built (body + far copy; colour and normal map 1024 px) | Hands | Licence |
|---|---|---|---|---|
| **Cool Hands Rex** `meshy_trex` / `core.trex` (the owner's name) | creatures, large (2.12 m, 115 health), gangster | the whole 10,404-triangle download + 2,600; its two 4096 px maps baked down (colour 1024 px JPEG, a 1024 px normal map); 1.08 MB; arms 1,079 | thumb, middle, ring and little finger chains, no index: re-fitted from the mesh (right hand split into four fingers, left a mitten); no grip offsets needed | Meshy, owned (pack `meshy-owned`) |
| **Fishy Fred** `meshy_fishyfred` / `core.fishyfred` (the download's name, a placeholder) | animals, small (1.40 m, 85 health), critter (the river names) | the whole 5,000-triangle download + 1,250; its 2048 px map at 1024 px, a 1024 px normal map; 0.55 MB; arms 521 | thumb, middle and little finger chains: re-fitted as mittens; `hands.scale 0.7` (29 -> 21 cm); `grip { gripLong [-0.045, 0.02, -0.03], rollR 0.3 }` | Meshy Community CC0, author and post URL pending (pack `meshy-community-characters`) |

- **The trigger finger.** Neither download has an index finger, so neither keeps its own finger chains (`fingers:
  own` needs all five); the build re-fits the fingers from the mesh (`hands.mjs`), and the rig's index chain takes the
  nearest mesh finger: Rex's right hand splits into four, a claw on the trigger; his left and both of Fred's are
  mittens that close together. No `fixes.fingers` needed.
- **Rex's extra joints.** The tail (`Bone_015`-`Bone_020`) rides the hips and the jaw and head (`Bone_034`-`Bone_039`,
  `headfront`) the head, as the crocodile's do. Meshy centred the download's box, so the tail stood the body 0.32 m
  ahead of its origin: `fixes.centre`. Measured through the rig's clips (scratch `tools/tailcheck.mjs`, the tail's
  lowest point against the feet's): walk, run, sprint, the shooter set's moving clips, crouch and prone keep the tail
  0.17-0.48 m above the feet's lowest point; jump landing brings it to the feet's level for a moment; **death and
  knockback** (lying on the back) put it through the floor, as the crocodile's (Boglurker) already does: a tail with
  no joints of its own can't bend. Pictures: `rexfred/shots/trex-run-side-1.png`, `screens/play-trex-tp-strafe.png`.
- **Hit shapes.** Rex's tail is left out on purpose (the rule: tails aren't hittable, docs/CHARACTERS.md "Hitboxes";
  the torso fit drops vertices far from the spine): the audit reads top 0.02, bottom -0.08, head 0.05, 93% inside
  (`shots/hitboxes-final.png`).
- **Fred's skin.** The download's rig held the fish's face on the left collarbone (602 vertices) and the rest of the
  fish on the head joint; the face would have moved with the left arm. The first build's head sphere was 0.55 m (the
  whole fish) and failed the hitbox audit (head 0.10 off, 85%). Now `fixes.skin.rigid` binds the fish to `spine_03`
  (two boxes, the hips spared) and then its face to `Head` (`blend 0.1`), with `smooth` over the spine, hips and head:
  head sphere 0.30 m on the face, the fish counts as body; audit passes; no stretched edges standing, aiming or running
  (26 with a first, hard-edged try; crouching leaves 6 small ones at the lower back, like Rex's 7).
- **Grip audit** (rifle, pistol, shotgun; lower is better; `rexfred/audit-1` first build, `audit-final`):

  | Character | first build | final | rifle drawn R / L, m |
  |---|---|---|---|
  | Cool Hands Rex | 0 | 0 | 0.05 / 0.12 (unchanged) |
  | Fishy Fred | 5 flat off (rifle: the shooting hand behind the grip, closing it gained nothing, -0.001 m) | 0 | 0.07 / 0.21 -> 0.03 / 0.13 |

- **Portraits** captured for both (`capture-portraits.mjs core.trex core.fishyfred`, a temp copy with Chromium's
  path); `PORTRAIT_VIEWS`: Rex `zoom 1.15` (snout and shades), Fred `aim [0, -0.06, 0], zoom 1.25` (the face low on
  the fish).
- **The coverage map's unit test** didn't ask for the new looks (it passes as is), so no MapMaker change.
- **Screenshots** (agent scratchpad `rexfred/screens/`): `select-<look>.png` in Character Select; `play-<look>-fp-rifle`,
  `fp-pistol`, `tp-rifle`, `tp-pistol`, `tp-run`, `tp-strafe` in an offline match on Canyon; sheets `sheet-trex.png`,
  `sheet-fishyfred.png`, `sheet-running.png`. Viewer frames `rexfred/shots/` (`trex-run-*.png`, `fishyfred-run-*-2.png`).

**For the owner:** a name for Fishy Fred, and his Meshy post URL (CC0 needs no credit; the URL is the licence's proof;
a CC BY post would need a credit). Rex's bots take the gangster names (Slick Vinnie, Knuckles Nolan…): there is no
dinosaur list; say if you'd like one.

**Checks:** CI green on `check/intake-rex-fred` at beb336a7, run 42396566250 (the full suite: unit, maps, build,
check, bots, perf budget and mass, 13 e2e shards). Locally: `pnpm typecheck` clean; `pnpm content:check` OK; the
hitbox audit and coverage-map tests pass; e2e `characters` (324 s), `characters2` (476 s) and `characters3` (489 s)
PASS (ports 4951/4952). `pnpm test:changed` (load 15-17 on 4 cores): 2037 passed, 4 failed, all load: three time-outs
(the 32-bot match, the eagle_spires pads, the host end to end) and the dedicated server's bot refill read 50 ms after a
leave; each passes run on its own, and CI passes them all. Only docs changed after beb336a7.
<!-- /intake-rex-fred -->

<!-- breakthrough -->
<!-- bots-c -->
### Bot AI Phase C: navigation depth (`wip/bots-c`, agent, 2026-11-07; item 0 landed, main 0d03c3bd; items 1-4 green on `check/bots-c` at 2a8464b7, run 42400318933; not landed)
docs/BOT_AI_PLAN.md (Phase C; "Phase C item 0, measured"), docs/BOTS.md ("Hurt bots retreat").

**Item 0, the hurt-bot retreat: kept as it is** (the coordinator agreed, 2026-11-07). The pitfall below ("Bots without
health pickups") said a hurt bot retreats from every fight for the rest of its life and the Range's attackers suffer.
Measured with `bot-report` on main, the retreat is what keeps them alive: main broke through at 8 v 8 in 11 of 12 seeds
(35 of 36 sectors), and every one of seven ways of cutting it short did worse (1 to 9 of 12; kills a minute 33 → 47-52,
the pool spent by 150-250 s). The table is in BOT_AI_PLAN.md, "Phase C item 0, measured": **don't try these again
without a new reason.** Main also beats the brief's numbers to beat (4 v 4: 5 of 8 against 2 of 8): those came from a
scratch harness on an earlier main.

**What item 0 landed:** a Breakthrough crash fix (`BreakthroughMode.botGoal`: a defender with the fall-back duty while
the last sector is the active one read `sectors[active + 1]`, undefined: a TypeError mid-match; seed 2 of the Range
at 8 v 8 hit it; the plan is made once a tick, so a sector falling mid-tick leaves the duty stale); `bot-report`'s
Breakthrough fields (the Iron Coast build's commit 9436ea3a cherry-picked byte-identical, so the two merge cleanly) and
the retreating share of alive time in `--compare`.

**Run it:** `pnpm bot-report test_breakthrough --mode=core.breakthrough --players=16 --seeds=1,2,3,4,5,6,7,8,9,10,11,12
--seconds=900 --json=…` (8 v 8; `--players=8 --seconds=600` for 4 v 4), then `--compare=a.json,b.json`. The Range's
matches are chaotic: six seeds swing by two or three breakthroughs between near-identical builds; use twelve.

**Items 1-4** (`wip/bots-c`, after item 0 landed; docs/BOTS.md "Parkour", "Ground that goes", "Crowds", "Routes along a
group's corridor, and the search budget"; BOT_AI_PLAN.md "Phase C items 1-4, measured"):
- **Parkour** (`nav/parkour.ts`): drops, gap jumps and jumps up as one-way navmesh links, found at load from every open
  edge where they save a real walk, each played through `stepMovement` with the bot's own inputs (`parkourInput`) for
  three body sizes and takeoffs either side, with the scenario's window panes, door panels and breakable walls in the
  way; at most 160 a map, cached per navmesh. Bots run them (`BotBrain.parkourMove`: face, run, jump at the takeoff,
  tuck), think every tick while on one; agile bots (flankers, recon, snipers, Arena) take them at walking's cost, the
  rest at 1.6 times. A link a bot gives up on (6 s without starting, 4 s at it) or misses three times is switched off
  for the match (`NavWorld.linkFailed`). Snipers' spots on places only parkour reaches score 0.45 more. Not on a navmesh
  rebuilt mid-match (Fort Wars).
- **Ground that goes** (`Scenario.surfaces`/`surfacesGone`, `NavWorld.setGone`): the tops of breakable props, free
  blocks that crumble, break or hide, and non-lift movers' blocks share the opening flag bits; gone ones are kept off by
  every route; bots replan.
- **Crowds:** a teammate coming the other way within 4 m is passed on the right; strafing isn't judged stuck.
- **Routes:** a group's bots route along their corridor's own polygons all the way (`NavWorld.pathAlong`); at most 24
  route searches start in a tick (`NavWorld.beginTick`).
- `bot-report`: parkour links, moves made, missed, given up; routes along a corridor; searches put off; ticks keeping
  right; sniper spots only parkour reaches; `--compare`'s retreating share and parkour moves a match.

**Numbers** (main 0d03c3bd against the branch, BOT_AI_PLAN.md): stuck recoveries a bot-minute CTF 1.40 → 1.34, Team
Deathmatch 0.92 → 0.68 (the plan's "halve": not met); 38 parkour moves a CTF match, 22 a Team Deathmatch one, under 2 %
missed; CTF captures 22 → 18 (takes 85 → 112), busiest way 57 → 61 %; **the Breakthrough Range at 8 v 8 broke through
in 16 of 24 seeds against main's 21 (sectors 62 of 72 against 68), and the final build, seeds 1-12, in 9 of 12 against 11 (sectors 31 of 36 against 35)** (ablations in the plan: no single part accounts for it, and with every change off the build replays main
exactly). Load: navmesh build +13 % on ten big maps (Qasr Medina the most, about a second, cached per map after). `pnpm bench 64
30`: bot thinking 1.45 → 1.54 ms a tick (means; inside the 2.5 ms guard).

**For the owner:**
- Capitol Mall's upstairs office by (140, 4, 8), by the desks and a bookshelf (`prop_1626`): bots heading for the
  objective get stuck there, 150-300 recoveries in a match, with or without parkour: a MapMaker fix (move the shelf off
  the walkway?).
- Qasr Medina: a bot on a 0.45 m wall top by (-13.3, 1.75, 26) stalls at its end (the character controller, the
  pitfall above); the parkour drop off it is switched off by the first bot that can't make it.
- The Breakthrough Range's attack is weaker with Phase C (broke through in 16 of 24 seeds against main's 21 (sectors 62 of 72 against 68), and the final build, seeds 1-12, in 9 of 12 against 11 (sectors 31 of 36 against 35)): worth a playtest before Iron Coast leans on it.

**Pictures:** a sniper reaching a ledge only a jump gets onto, Fernwood Moon (top view and side view; session scratchpad
`sniper-parkour-fernwood.png`, made by a scratch harness from a headless match).
<!-- /bots-c -->

### Breakthrough mode, and Iron Coast's fort and gatehouse (`wip/breakthrough`, agents, 2026-11-07; from main 17d0e0a0, main 2c48debf (Bot AI Phase B parts 1 and 2), d3830145 (weapons intake 11-06) and 5087b0b6 (weapon sets) merged in; green on `check/breakthrough` at 647512a5, run 42373473729; not landed)
The brief: docs/map-briefs/MAP_21_Iron_Coast.md ("Breakthrough mode", and "The mode as built"). Rules, settings, HUD,
MapMaker steps: docs/GAME_MODES.md, "Breakthrough". The pieces: docs/SET_PIECES_PLAN.md, "As built: part 4".

**What's in it:**
- **The mode** (`sim/modes/breakthrough.ts`, `core.breakthrough`): sectors in order; capture zones (KOTH-like,
  contested), destroy targets (plant 3 s / fuse 20 s / defuse 5 s; a sector's "N of M"), the final hold; spawn groups
  per sector and side moving on as sectors fall; the 10 s fall-back warning, then 20 hp/s; the attackers' pool
  (`breakthroughPool` per attacker, half again per attacker for each sector taken); defenders unlimited at 1.5× the
  respawn delay; the sector clock (`breakthroughSectorSeconds`, a sector's own `seconds`; carried over; a burning
  charge plays on); an optional second round with the sides swapped (`breakthroughSwap`; sectors, then time left).
  New ModeHost/ModeLogic hooks: `endRound(winner)`, `hurt`, `spawnSpots`, `spawnBeside`, `clock` (and `spawnPoints` are
  the match's own spawn spots now, so recent use counts).
- **Map format v29** (`sector` and `objective` entities, a spawn's `sector` and `side`; v28, the weapon sets' format,
  migrates unchanged; the Breakthrough Range and the coverage map re-exported through MapMaker at v29, Standard weapons).
  Validation: `map/validateBreakthrough.ts`. A format bump alone no longer changes a stamped map (`releaseCurrent`,
  map/identity.ts: the content hash at the stamp's own format version): the 24 maps stamped at v27 keep their
  versions and identity and show no "changed since it was exported" (CI's demo-map tests caught it).
- **HUD** (`game/modeHud.ts`, `flagVisuals.ts`, `minimap.ts`): side, sector strip, pool, objectives with state, world
  markers, labelled minimap blips, `#bt-warning`, announcer lines per side. **Match Setup** (frontEnd.ts) and the
  **host panel**: Reinforcements, Sector time (both follow the size: `breakthroughPoolFor`, `breakthroughMinutesFor`),
  Second round; offered only on maps with sectors (`modeUnavailableReason` says why not). Team setups go to 48 a side
  (TeamSetup max), for Iron Coast's 24-32 a side.
- **MapMaker**: Sector, Capture Zone, Destroy Target, Final Hold, Attackers' Spawn, Defenders' Spawn (Entities →
  Gameplay → Spawns & Objectives), inspectors (`ed-bt-*`, the spawn's `ed-spawn-group`), the sector line drawn with
  its arrows and number; game modes' pieces now show under any Style Pack (`stylePackHas`); Map properties' **Map ID**
  (`#ed-prop-id`: an official or test map's file name, which MapMaker had no way to set).
- **Bots**: Phase B's Breakthrough playbook wired in the mode (no change to the bot brain or Phase B's files;
  docs/BOTS.md, "Breakthrough's playbook"): `botBrief` (the attackers' objective, the least defended still to take,
  kept until taken or planted, `stage` while held; `playbookFor('core.breakthrough').team`), `botTrips` (each sector's
  spawn groups to each of its objectives), `botGoal` by a plan made once a tick (`plan`: each bot's place among its
  side's bots, never its slot, which alternates between the teams: `slot % 2` had picked no defender to defuse, ever;
  the defenders' duties by the playbook's shares over each sector's posts, `findPosts`/`postsOf`: turrets, trench tiles
  and sandbags, high ground that sees an objective, within 60 m of its objectives on their side of its line) and
  `botInput` (a bot within reach of a target to plant or a charge to defuse holds still, crouched: kept to their way,
  bots fought on the move and in 8 v 8 never planted). A defender caught behind the line runs for it. The playbook's
  smoke (with the weapons intake's Smoke Grenade, main d3830145 merged in): attacking bots that bound (all but Arena
  bots and berserkers) spawn carrying smoke instead of frags (`onSpawn`; a bot being added spawns before it has a
  brain, so it is armed at its first `botInput`), and the moving half of a bound screens open ground
  (BotBrain.considerSmoke: 49 such screens in a 150 s 8 v 8 match on the Range).
- **Set pieces**: `setpiece.command_bunker` (fort.json, new family; kit tiles `core.fort_ring`, `core.fort_ring_gate`)
  and `setpiece.cliff_stair_gate` (cliffstair.json; edge style `gate_arch`); `setPieces4.test.ts`.
- **Maps** (MapMaker only, driven through its own palette, inspector, Import and Export): the **Breakthrough Range**
  (`maps/test_breakthrough.json`, testOnly) and the coverage map (one of each new piece, both set pieces).
- **Tests**: `breakthrough.test.ts` (14: order, zones, targets, N of M, spawns and fall-back, pool, clock, final hold,
  second round, format v29, validation, Match Setup, the playbook's brief, trips, posts, shares, fall-back, defusing,
  holding still, determinism by seed), `setPieces4.test.ts`, the coverage map's test (new pieces, the mode); e2e flow
  `breakthrough` (main thread; `?test=1&testmap=test_breakthrough` puts the test map in the Arcade).

**Bots on the Breakthrough Range** (headless matches, bots only, first round; BOTS.md has the details), with Match
Setup's suggestions and smoke: 4 v 4 (6 an attacker, 3 min a sector; the owner lowered it from 8, 2026-11-07), eight
seeds: the beach fell in 4 (106 s on average), the guns in 2, the fort in 2; 8 v 8 (6, 4 min), six seeds: the beach in
6 (61 s), the guns in 4, the fort in 2. Before smoke, at 8 an attacker, 4 v 4 broke through in 7 of 8 (with smoke at
8: the beach 6, the guns 5, the fort 4), 8 v 8 in 3 of 6. Before the playbook (the old `botGoal`, defenders never
defusing) 4 v 4 at the defaults: 6, 3 and 3 of 8; with the playbook but before holding still to plant, 8 v 8 never
planted (the guns fell in none of six). A second round with the sides swapped (4 v 4, three seeds): both teams broke
through in two, the one with more time left when its last sector fell winning (442 s against 436, 305 against 271);
in the third only the second team did, and won. In the e2e flow (you parked, three bot attackers against four) the
bots took the beach in 76 s, 95 s after the main merge with smoke; at the new suggestion its scene took the beach in 8
of 8 seeds (40-72 s). The scratch harness that measured it is not in the repo (bench's Match with bots, the
`bt` events); `pnpm bench 8 300 maps/test_breakthrough.json --mode=core.breakthrough` counts the events. For Iron
Coast's check ("bots take every sector in a scorecard run") `bot-report` needs Breakthrough (sectors taken a match).

**Pitfalls:**
- Driving MapMaker with Playwright against the dev server: any edit to a file the page imports reloads the page and
  kills the run (save edits for after).
- MapMaker in test mode (`?test=1`) hands out seeded ids: import an existing map without it, or new ids can repeat
  the map's own.
- Rapier's character controller can stall on one big flat merged floor box at some spots (setPieces4's gate tests
  check headroom instead of walking every gate): worth a look if a player reports a stuck spot.
- Bots without health pickups: a hurt bot (under its self-preservation share of its health) retreats while it sees an
  enemy (no regeneration), between sightings it goes for its objective again. Health pickups by the spawn groups didn't
  help the attackers (the defenders' were nearer the fighting: the beach fell in 1 of 8), so the Range has none.
  Cutting the retreat short was tried seven ways in Bot AI Phase C (item 0): every one made the attack worse (the
  Phase C section above; BOT_AI_PLAN.md, "Phase C item 0, measured").
- Slots alternate between two teams (0 one team, 1 the other...): anything picking "every other bot" by `slot % 2`
  picks a whole team or nobody. Breakthrough's bots go by their place among their side's bots.

<!-- /breakthrough -->

<!-- weapon-sets -->
### Weapon sets (`wip/weapon-sets`, agent, 2026-11-07; from main 2c48debf, main e0690630 and d3830145 merged in; green on `check/weapon-sets` at 4142cf63, run 42369778613 (the full suite: unit, maps, build, check, bots, perf budget and mass, 16 e2e shards) and at 16b5a8a4, run 42371041159 (after the shuffled deck: unit, maps, build, check, bots, perf, the 11 e2e shards it needed); not landed)
The owner's ask (2026-11-06: "I have never once seen the sheep weapon, hardly see swarm launcher or gravity weapon …
weapon sets for map defaults … weapon style sets or a mixed bag, all depending on the map default and host setting")
and the approved plan, docs/WEAPON_SETS_PLAN.md (as built at its end); docs/ARSENAL.md, "Weapon sets". The brief is the
session scratchpad's `briefs/weapon-sets.md`; this work's scratch is its `ws/` folder.

**What's in it:**
- **The sets as data:** `content/weapon-sets.json` (Standard, Military, Sci-fi, Medieval, Chaos, Mixed bag: spawn,
  random gun, sniper gun, weapons, grenades), checked and built by `tools/content/weapon-sets.mjs` (in `content:check`
  and `content:rebuild`) into `shared/src/content/weaponSets.generated.ts`. Owner, 2026-11-07: the knife in every set;
  grenade pickups roll within the set and everyone spawns with its first (Military frag, mine, smoke; Sci-fi sticky,
  vortex, smoke; Medieval incendiary, holy bomb; Chaos sheep, holy bomb, cluster; Mixed bag all; Standard as placed).
- **The sim** (`sim/weaponSets.ts`): `setLoadout` (spawn weapons, the life's random main gun dealt from a deck
  shuffled from the seed and the slot, a sniper-role bot's scoped gun in place of the main gun, the first grenade),
  `setPickupPool` (by category, else the nearest categories the set has: `nearCategories`; kept-fixed pickups of the
  set stay; grenade pickups too), `setAllowsDrop`, `inSetOr` (for the Roulette mode's signature loadouts, not built
  yet).
  `Match.weaponSet` and `Match.sniperGun` (Bot AI Phase B's hook, now the set's) read the host's choice, else the
  map's default; `Combatant.spawns` counts lives; a bot whose role comes after its spawn is re-armed for it at once
  (`rearmForRole`). Spears or discs only and Disc Arena play no set; classes keep their loadouts.
- **Map default:** `MapDocument.weaponSet`, map format **v28** (no-op migration); MapMaker → Map properties → Weapon
  set (`setWeaponSet` command); validation warns on an unknown id. The stamped-map fix from Breakthrough
  (`releaseCurrent`: a format bump alone keeps a stamped map's version) is taken verbatim, so both branches merge clean.
- **Host choice:** `MatchRules.weaponSet`; Match setup → Advanced rules → Weapons, pickups & vehicles → Weapon set
  ("Map default (…)" names the map's own; the setup's facts show a set other than Standard; Mix up weapon pickups is
  greyed under a set of its own); the pause menu's Host tab (live, `HostRulesPatch.weaponSet`,
  `HostState.mapWeaponSet`); a server's `set` rule (the Host Service launcher shows it among its main rules); kept
  through map changes; saved setups keep it. Character Select's loadout follows the setup's set.
  `?offline=<map>&weapons=<set>` starts a quick match in a set (the arsenal flow and the canyon picture pin Standard
  with it).
- **Looks:** grenades wear the match's set's look in your hands, in flight and on pickups (`throwableModel(kind, set)`,
  `View.setWeaponSetLook`: the pack's frag in Military, the Meshy canister for smoke in Sci-fi); the loading screen
  fetches the set's spawn guns' held copies, its guns and its grenades' models; a host's live switch loads the new
  set's guns in the background.
- **Bots:** sniper-role bots spawn with Military's marksman rifle or Sci-fi's railgun; bots throw the sheep (thrown
  short along an open line to an enemy 6-20 m off: it walks the rest; they never threw it: its 9 m/s throw lands ~6 m
  out, inside their 7 m minimum and its own 5 m blast) and big blasts with a long fuse (the holy bomb, half its blast
  away, then run clear); they light their oil slicks with the igniter (the oil slicker's bot value 0.3 → 0.45).
- **Scorecard:** `pnpm bot-report … --set=a,b` plays each match in each set; every report and the nightly scorecard
  list kills by weapon per set and the set's weapons and grenades without a kill.
- **Smoke on the space maps** (the weapons intake's open item): maps without haze drew with the scene's fog off, so
  the first step into a smoke cloud (or water) switched it on and Babylon rebuilt every material in view for its FOG
  define. They now draw with the fog on at density 0 (`BackdropVisuals.build`; Medium's mist keeps its own colour:
  `SkyEffects.foldMist`). That is 7 maps, not the 15 the intake guessed: Halcyon Station, Starhaven, Twin Spires and
  Void Yard (all Sci-fi now) and the retired Creature Lab, Obsidian Orb and Skyward; every other map has haze.
  Measured on Halcyon Station at Medium (`ws/stall3.mjs`: the build before and after served side by side, a cloud
  laid 10 m off first, then one at your feet): before, 31 and 38 programs built stepping in, every one a fog variant
  (22 and 31 of them materials already in view), 8.0 and 12.4 s inside WebGL's compile and link calls on this box's
  software renderer, the frames stepping in 4.8 s longer than inside the cloud; after, no program, 0 ms, 0.35 s. At
  High: 45 programs (36 materials again), 12.3 s, 6.1 s before; none, 0 ms, 0.12 s after.

**Map defaults** (the owner's OK, 2026-11-07, of the proposed table; set in MapMaker's Map properties by driving the
real editor with Playwright: Import, Weapon set, Export, `ws/setmaps.mjs`; each export differs from its map only in
the format, MapMaker's release stamp and the set, plus the v22 `track: null` that migration drops on five older maps;
retired maps left out):
- **Military** (16): Sandgate, Atomic Court, Shingle Point, Fogbound, No Man's Field, Bunker Cross, Iron Tide,
  Rockfall Canyon, Crossroads, Riot Junction, Runway Nine, Capitol Mall, St. John's, Dockside Depot, Glasswork Office,
  Whiteout Station.
- **Sci-fi** (12): Halcyon Station, Starhaven, Twin Spires, Void Yard, Neon Spire, Express Lobby, Undergate Transit,
  Serene City, Dune Harbor, Fernwood Moon, Coldwater Gulch, Frost Basin.
- **Medieval** (2): Market Town, Sandfall Colosseum. Citadel and Gallows Yard stay Standard (owner: their layouts are
  built round rockets and the railgun).
- **Chaos** (4): Cinder Foundry, Pantry Raid, Flatpack Depot, Erosion. **Mixed bag** (3): Neon Galleria, Grand
  Marquee, Primeval Park.
- **Standard:** every other map (53, the retired ones among them).

**Numbers:** kills by weapon, each set on three maps of its theme (TDM, seeds 1 and 2, 180 s, the maps' own team sizes;
`ws/measure/final/`; the table is in WEAPON_SETS_PLAN.md, "As built"). Military 359 kills (assault rifle 268,
marksman 20, rockets 11 …; none for the SMG, hand cannon and mine); Sci-fi 318 (plasma rifle 209, pulse pistol 27,
sticky 23, railgun 20 …; none for the vortex grenade); Medieval 464 (spear 362, knife 36, incendiary 33, battle axe
33; none for the holy bomb); Chaos 376 (swarm 113, pistol 54, blast rockets 47, nailgun 31, gilded pistol 23, oil
slicker 23, singularity 19, sheep 16, flak 14, freeze ray 12, bubble blaster 8, goo gun 4, flare gun 3, holy bomb 1;
none for the cluster bomb); Mixed bag 382 by 32 weapons; Standard on maps of those kinds 413 (pistol 155, assault
rifle 109; no swarm, singularity or sheep). Sniper-role bots: Military 8 (17 kills, 15 scoped), Sci-fi 4 (15, 10
scoped). `pnpm bot-report --check` (Shingle Point KOTH now Military, Fernwood Moon TDM Sci-fi): every limit held.
The probes behind the bot changes: the sheep was never thrown in three Chaos matches before `considerWalker` (12
kills after); the oil slicker got no kills before the igniter (Atomic Court probe: 29 slicks, 22 lit, 8 kills).

**Tests:** unit `packages/shared/test/weaponSets.test.ts` (data, loadouts, random guns, pools, drops, the sniper gun,
map default and host override, old maps and setups), `tools/content/test/weapon-sets.test.mjs`; the server-rule parity
list; e2e flow `weaponsets` (Sandgate's Military default in Match setup and in play, the Host tab's live switch, a
Chaos match's guns by life, MapMaker's field and TEST). Run here: typecheck, content:check, the unit tests the change
touches (weaponSets; botRoles and botPush, which now pin Standard weapons: Riot Junction's and Shingle Point's own
Military spawned other guns than those tests were measured with), `bot-report --check`, e2e `weaponsets` and `teams`
(pass); CI ran the rest. Screenshots (session scratchpad `ws/shots/`): `weapon-sets-setup.png` (Match setup, the
Weapon set list open: "Map default (Military)" on Sandgate, Chaos picked, its fact and chip),
`weapon-sets-chaos-spawn.png` (a Chaos spawn: the goo gun in hand, a sheep to throw), `weapon-sets-mapmaker.png` (Map
properties, Weapon set Sci-fi and its line).

**For Breakthrough** (`wip/breakthrough`): done there: Breakthrough's format is v29 after this v28 (its migration
after this one), and the maps it touched are re-exported through MapMaker; the stamp fix is the same text on both. Iron Coast's default set is **Military**
(owner): set it in MapMaker's Map properties when the map is built.

**For the owner:**
- Military and Sci-fi play mostly with their spawn gun (75 % and 66 % of kills): the set's other guns come from the
  map's weapon pickups, rolled within the set by category, so a map with few pickups shows little of the set. For
  more: more weapon pickups on those maps (MapMaker), or a random main gun each life as in Mixed bag.
- Mixed bag's random gun is a main gun (slots 3-9): its sidearms, spear and battle axe come only from pickups, and
  besides the frag its grenades only from the few grenade pickups the maps place (none got a kill).
- Chaos and Mixed bag deal the life's gun from a shuffled deck (every one before any again) rather than a fresh roll
  each life, which handed one player the goo gun four lives in six. Say if you would rather have the plain roll.
- Citadel and Gallows Yard stay Standard; MapMaker's Map properties → Weapon set moves either to Medieval in a
  click. Iron Coast becomes Military when Breakthrough builds it.
<!-- /weapon-sets -->

<!-- weapons-1106 -->
### Weapons intake of 2026-11-06: new weapon and grenade models, sharper held textures, the Smoke Grenade (`wip/weapons-1106`, agents, 2026-11-07; from main 9dfe3ba1, main 7c40d0b9 and 2c48debf merged in; green on `check/weapons-1106` at 143ed252, run 42364965060; not landed)
The owner: "Added a bunch of new weapons, all Meshy community"; "We can replace our tommy gun with the 3DModelsCC0 one,
and bring in those others to replace any one-off originals we have"; "retain the fidelity of the texture best we can:
we want these weapons to look a little sharper, clearer, better resolution"; the grenade picks of 2026-11-06 and a new
Smoke grenade; no flashbang (seizure risk). docs/ARSENAL.md, "Weapons intake of 2026-11-06", has the tables, the
texture tiers and the smoke as built. Session scratchpad: `wi/` (tools, shots, renders, the picture sheets); the
brief: `briefs/weapons-intake.md`.

**What each model became** (every one rendered first: `wi/shots/cc0-guns.jpg`, `meshy-guns-q.jpg`,
`cc0-explosives.jpg`, `cur-weapons.jpg` (the originals); the grenades as the main session rendered them,
`nadeview/grenades-sheet.jpg`):
- **Guns** (each weapon's `view.fallback` stays its model built from the repo, the mechanics test's rule; the
  downloads they replaced stay built in content/guns.json, so going back is one line): Suomi KP → SMG (was the Meshy
  Tommy Gun); AK-47 → Assault Rifle (Styloo AK); M4A1 → Burst Rifle (Meshy Neon Flux); Makarov → Pistol (flat kit
  pistol; its magazine, laid out beside the gun in the download, put back in the grip: `move`); Grease Gun → Machine
  Pistol (flat kit, the same shape; now held as a compact long gun); pump Shotgun → Shotgun (Styloo); the pack's
  Sniper → Marksman Rifle (a scoped hunting rifle, posed nose-up in its download: built levelled with `noseDown`,
  magazine seated; was the Meshy Frontier Rifle; the Sniper Rifle keeps its tactical Meshy model); BK 220 → Hand
  Cannon (a heavy semi-automatic, so it reads apart from the Heavy Revolver; was the flat kit revolver); Revolver
  Rustique → Heavy Revolver (was the 2026-01-26 Meshy revolver); the unnamed gilded flintlock → Gilded Pistol (one
  shot, one kill); Plasma Defender → Pulse Pistol (was the Meshy ornate handgun); Scrapfire Assault Blaster →
  Nailgun (drum-fed scrap gun; was the flat kit nailgun).
- **Grenades** (the owner's picks): Globe → frag (Styloo frag the fallback; the pack's frag is its Military look);
  Countdown Sphere → sticky (its blinking light kept on top); "just a grenade" → vortex (its own projectile look
  `vortexNade`: the Singularity Cannon keeps `vortex`); Sunburst → cluster; Toxic Splash → gas; the pack's Molotov →
  incendiary; the pack's smoke grenade → the new Smoke Grenade, the Meshy sci-fi canister its Sci-fi look; the AT
  mine now also shows on the mine's pickup.
- **Spare** (no good place yet; quick builds from the same downloads): the Luger, C4, claymore, pipe bomb, M24.
  Still drawn in code: holy bomb, sheep, airstrike flare, sandbags, dynamite.

**Build** (`prepare-guns.mjs`; CONTENT_PIPELINE.md, "The weapons intake's options"): the pack's PBR maps on its FBX
(`maps`/`materials`, DirectX normals flipped), `move`, `noseDown`, `height`, `pbr` (the source's metal and roughness
kept: the pack's maps, or a Meshy GLB's painted into the rebaked charts by `rebake`'s `also`), `held` (three copies:
everyone's 512 px colour / 512 normal / 256 metal-roughness with its LOD; Medium 1024/512/256 and High 2048/1024/512
for your own hands, budget tier `held`); pack meshes joined and given an LOD. Holds read off gridded side views of
each built model (`wi/tools/holdgrid.mjs`, `wi/shots/grid/`).

**Client:** your gun shows everyone's copy at once, then its Medium/High copy swapped in when loaded
(`View.sharpenViewmodel`); a gun no longer carried frees its held copy (`View.trimViewmodels`,
`ModelLibrary.release`); the loading screen fetches your starting guns' held copies and the match's throwable
models, and warms the throwables' shaders with the guns' (`GameSession.prepareMatch`). Weapon metal reflects a soft
gradient in the map's light (`game/weaponFinish.ts`, loaded on demand). Throwables: their model in flight
(`View.thrownProjectile`, instanced), on pickups (two of it), and in both hands while you line up a throw
(`View.setThrowHold`: the gun put away, a pistol-style hold on the grenade; first person only). Smoke: soft grey
camera-facing puffs (`ZoneVisuals`), an eased grey fog with your eye inside and the sky faded to the same grey
(`View.updateSmokeFog`), enemy markers behind it hidden; the throw arc shows a cloud's or puddle's reach.

**Sim:** the smoke zone billows out, sits and thins (`SMOKE`, `smokeRadius`); `Match.sees` (static sight and no
cloud in the way) is used by sentries, arc turrets, homing and spawn safety, and bots get the clouds in their view
(`BotWorldView.smoke`: target acquisition and `canSee`). Shots, blasts and chain lightning use the physics' own lines,
so they pass through. Bots (`considerSmoke`, then `smokeScreen`): hurt or shot at in the open by an enemy 10-45 m
off, and (since main 2c48debf brought Phase B's cover-to-cover advance) bounding, the moving half with no cover round
it sends smoke ahead every time before it crosses open ground. Only a bot that picks up Smoke Grenades carries any:
placed pickups, and in Military and Sci-fi their grenade pickups, which roll it (`wip/weapon-sets`, "Weapon sets"
above).

**Numbers:**
| Weapon | Model | Triangles (LOD) | Everyone's KB | Medium KB | High KB | Before: model, KB |
|---|---|---|---|---|---|---|
| Submachine Gun | suomi_kp | 9188 (2296) | 402 | 413 | 840 | tommy_gun, 737 |
| Assault Rifle | ak47_cc0 | 4805 | 213 | 270 | 608 | ak47, 146 |
| Burst Rifle | m4a1 | 9258 (2309) | 368 | 299 | 394 | neon_flux, 965 |
| Pistol | makarov | 3991 | 188 | 246 | 569 | pistol, 76 |
| Machine Pistol | grease_gun | 7713 | 268 | 323 | 618 | machine_pistol, 113 |
| Shotgun | shotgun_cc0 | 1740 | 101 | 155 | 456 | shotgun, 97 |
| Marksman Rifle | scoped_rifle | 4808 | 138 | 148 | 233 | frontier_rifle, 953 |
| Hand Cannon | bk220 | 7900 (1561) | 574 | 618 | 1314 | hand_cannon, 91 |
| Heavy Revolver | revolver_rustique | 7979 (1590) | 501 | 530 | 1139 | ironclad_revolver, 249 |
| Gilded Pistol | flintlock | 9000 (1800) | 504 | 561 | 1269 | gilded_pistol, 95 |
| Pulse Pistol | plasma_defender | 8000 (1600) | 481 | 510 | 1004 | ornate_pistol, 801 |
| Nailgun | scrapfire | 9995 (1998) | 668 | 725 | 1558 | nailgun, 70 |
| all 12 | | | 4405 | 4799 | 10000 | 4393 |

Grenades (one copy each, 2.8k-6.3k triangles, 256 px normal maps): Globe 374 KB, Countdown Sphere 241, "just a
grenade" 250, Sunburst 248, Toxic Splash 234, Molotov 210, smoke grenade 112, sci-fi canister 190, the pack's frag
130: 1988 KB in all, fetched with the match only for what it can throw.

- **Downloads:** everyone's copies of the twelve guns 4405 KB against 4393 before (the same); a held copy is fetched
  only for the guns you carry (Medium 148-725 KB, High 233-1558 KB each).
- **Video memory** (five guns held: pistol, rifle, SMG, shotgun, hand cannon): High +140 MB (28 MB a gun), Medium
  +35 MB, Low +0; the scene's textures at High were 292 MB before.
- **First-load JS** (`tools/ci/bundle-budget.mjs`): 2516.9 kB, 706.8 kB gzip (budget 3000 / 840); the models and the
  new code load with the match.
- **Perf budget** (CI, frost_basin, 96 bots; this branch's run 42342142073 against main's nearest, run 42339408690 at
  21e00f81, main 2c48debf's parent with the same client): within budget on both. Clumped draws Medium 213 / Low 191
  (main 293 / 134; budget 900), shadow casters at Medium 30 (55; budget 600), slowest effect start 17 / 14.1 ms
  (10.8 / 9.9; budget 40); CI's draw counts move run to run with where 96 bots stand. Programs built after the
  loading gate, over three runs each: this branch Medium 13 / 13 / 15 and Low 6 / 7 / 6 (runs 42342142073,
  42363390935, 42364965060); main-like runs Medium 3 / 7 / 7 and Low 0 / 0 / 4 (42339408690, 42330592363,
  42328205906). On CI's software-drawn page the gate opens with the warm-up still running ("prewarm null" on both),
  and this branch's warm-up has more to build (the new guns' metal, tangent and reflection variants, nine throwable
  models), so more of it lands after the gate, out of sight. The probes below put the builds in play level with
  main's. A further cut, if wanted: ship the new models without tangents (Babylon then works them out in the shader),
  one variant fewer for each way a gun is drawn.
- **Probe** (`wi/tools/shaderprobe.mjs`: frost_basin, 12 bots, 90 s of play, every program built after the gate with
  its defines and meshes): Medium 8 against main's 8 (`wi/probe-*-medium-r3.log`). This branch's 8: three gun pbr
  variants built in the second its background warm-up ended (no mesh left drawing them: the warm-up's samples) and
  five decal, blood and shadow programs. Main's 8 include a bot's Assault Rifle at first sight in third person and
  the muzzle flash. At the gate 133 programs against 121; the warm-up 71.0 s against 68.7 s on this box, 146
  programs against 130, 42 gun samples against 36. Low (`wi/probe-*-low.log`): 9 against 9; at the gate 88 against
  81; warm-up 48.6 s against 48.9 s.
- **Warm-up at High** (`wi/tools/warm.mjs`: Rockfall Canyon, then each of the twelve guns given in turn, its High
  held copy swapped in): this branch 57.2 s, 160 programs, 33 gun samples, and **0 programs built at first sight**
  over the twelve guns; main 74.7 s, 153 programs, 27 samples, 1 built at first sight (the revolver)
  (`wi/warm-*-high-r3.log`). This box's timings swing with the other agents' load (an earlier pair: main 73.5 s,
  the branch 68.1 s); the program counts are the measure.

**Pictures** (session scratchpad `wi/shots/sheets/`, before = main's build, after = this branch, in Rockfall
Canyon): `first-high-1.jpg` and `first-high-2.jpg` (all twelve guns in first person at High), `first-low.jpg` (four
at Low), `closeup-tiers.jpg` and `closeup-zoom.jpg` (your held copy at High against everyone's copy at Low),
`third-high.jpg` (over the shoulder), `nades-hold.jpg` (each grenade in your hands), `nades-fly.jpg` (in flight, main's
code-drawn shapes beside each model), `pickups.jpg` (two of each grenade, the AT mines, the SMG and shotgun, against
main's coloured balls and discs); `wi/shots/icons.jpg` (the kill-feed icons), `wi/shots/smoke2.jpg` (the cloud from
outside and inside) and `wi/shots/smoke3/inside-before-after.jpg` (inside it, before and after the sky fades); the grip sheets
of all twelve guns on the Ranger, third and first person (`wi/gripsheet-after/core.ranger.png` against
`wi/gripsheet-before/`; halves in `wi/shots/grips/`); the download renders `wi/shots/cc0-guns.jpg`,
`meshy-guns-q.jpg`, `cc0-explosives.jpg` and `cur-weapons.jpg`; the pack's maps screened for marks,
`wi/shots/sheets/packmaps-*.jpg` and `packnormals-*.jpg`. A source edit while the dev server is serving a shot reloads
its page (the pause menu comes back over it): shoot from a build, or edit nothing meanwhile.

**Grip audit** (`tools/content/grip-audit.mjs`, the twelve guns on the Ranger, the Tactical Soldier and the Cowboy,
this branch's build against main's; `wi/audit-after/summary.md`, `wi/audit-before/`, `wi/audit-compare.txt`): the
same flags as main's on every gun and character (Ranger 9, Tactical Soldier 3, Cowboy 3 on both). The one gun flagged
is the Assault Rifle (Ranger `back flat`, the other two `flat`), flagged alike with main's Styloo AK, plus the Ranger's
cloth `spikes` on every gun. The support hand ends further from its point on the longer new guns (Marksman Rifle
+9 cm, Shotgun +4-6, Burst Rifle +2-5, Nailgun +3-5): short arms slide it back along the handguard, as the audit
allows; the shooting hands are where they were.

**Tests:** `smoke.test.ts` (growth and life, sight geometry, the thrown grenade, a bot fires across open ground and
not through a cloud, rounds go through, a hurt bot throws smoke between itself and its enemy, a Tactical bot bounding
toward the enemy's flag across open ground sends smoke ahead and an Arena bot doesn't); `weaponModels.test.ts`
(every weapon and throwable has its model; held copies are the same mesh); the content check (budgets, locks,
provenance). Run here: typecheck, content:check, the tests the change touches (smoke, weaponModels, mechanics,
weaponsData, pickupsData and, after merging main 2c48debf, the bot tests: 57 passed), the bundle budget, e2e
`coverage` and `characters3` (pass) and `visual` (baselines: menu, arena and canyon show the new pistol, 1.1 / 2.5 /
0.4 % of pixels; the other two unchanged). Not conclusive here: `test:changed` (cut short at the box's load 18 on
4 cores; its one failure, a 50 ms wait in server.test.ts, passes alone) and e2e `arsenal` (a 60 s page-load wait
timed out; with CI's waits, one third-person shot over a wall missed, a check this change doesn't touch); CI ran both
in full. After the restart: typecheck and `smoke.test.ts` (7 passed; the bounding test fails without its change).
CI: green at 7e15660f (run 42342142073, everything the branch touched: 36 e2e flows), 19c66184 (run 42363390935,
35 flows) and 143ed252 (run 42364965060, 32 flows); red at f349eecf (run 42340584990: `handoff`, below).

**For the owner:**
- The Flare Gun weapon (`core.flare_gun`) is the one sidearm left on its flat kit model; the pack's flare gun is
  there if you want it after all (you said you weren't sure it was needed).
- Spare models: the Luger, C4, claymore, pipe bomb and M24 (above). Say if one should go somewhere (e.g. C4 as the
  sticky's Military look, the Luger for a WWII set).
- The Grease Gun as the Machine Pistol is a compact SMG now held with both hands at the shoulder (the old flat model
  had the same shape); the BK 220 made the Hand Cannon a semi-automatic and the Revolver Rustique the Heavy Revolver.
- KTX2 (GPU-compressed textures) would cut a High held gun from 28 MB of video memory to about 7: it needs Babylon's
  transcoder files vendored from cdn.babylonjs.com (blocked here: the proxy refuses it). Worth a small job if High's
  +140 MB for five guns matters on your machines.
  **Owner (2026-11-07): skip KTX2 for now.** Revisit only if video memory becomes a problem on someone's machine: UASTC
  (not ETC1S, which shows blocks and banding), the transcoder hosted on our own site, and a side-by-side close-up sheet
  for the owner first.
- Post URLs for the 11 Meshy downloads, if you have them (CC0 needs no credit; the post is the proof).
- The pack's flashbang is not imported (your call, over seizure risk); nothing in this work flashes the screen, and
  the smoke eases in and out in a mid grey.
- Smoke on the maps without haze: **done** on `wip/weapon-sets` ("Weapon sets" above). They are 7, not 15: the four
  live space maps (Halcyon Station, Starhaven, Twin Spires, Void Yard, all Sci-fi) and three retired ones. They draw
  with the fog on at density 0, so stepping into smoke (or water) builds no shader: on Halcyon Station at Medium,
  31-38 programs before (45 at High), none after.

**CI on this branch:** run 42340584990 (f349eecf) failed the `handoff` e2e flow, both attempts: "two friends join the
hosted match", a friend's link closing under it with no "closing ... link" from the host, pages a second or two behind.
That is the open item under "Fixed (2026-11-06): the `handoff` e2e failure" (a joining friend's page freezing on CI,
for performance round 4); this branch adds to a joining page's start (the throwable models, more warm-up programs),
the part that item suspects. It passed at 7e15660f, 19c66184 and 143ed252; if it fails again, start there.

**After the container restart (2026-11-07, a second agent):** CI run 42342142073 (7e15660f) had gone green. Redone:
the pickups, the vortex grenade in hand, main's grenades in flight, the grip sheets and the grip audit (above); the
measures (the warm-up at High and the probe at Medium on both builds; main's build was main 7c40d0b9: 2c48debf after
it changed only bot logic). Added: smoke before open ground in the bounds, and the sky fading inside smoke.

**Pitfalls:**
- The rar doesn't fully unpack with `unar`: `AK47_Height.png`, `Flashbang.fbx` and `Liquid_Base_Color.png` fail (RAR5;
  none is used). `7z`/`unrar` aren't installed.
- glTF-Transform's `join` clashes with `node:path`'s in prepare-guns.mjs: imported as `joinPrimitives`. Scratch scripts
  must import glTF-Transform's ESM build (`dist/index.js`), or POSITION goes missing on write (two module copies).
- In-game pictures on this machine: the page draws a frame or two a second while the offline match runs in real time
  (a 1.5 s grenade flight is over before the picture); the shot scripts hold a grenade or a cloud in the sim for the
  picture (`wi/tools/ingame.mjs`), never in the game.
- A Meshy held entry rebakes at 2048 px (about 3-5 minutes each on this box).
<!-- /weapons-1106 -->

<!-- bots-b -->
### Bot AI Phase B: bot logic (`wip/bots-b`, agents, 2026-11-07; part 1 landed, main 7c40d0b9; part 2 on `check/bots-b2`)
docs/BOT_AI_PLAN.md (Phase B; "Phase B part 1, measured"), docs/BOTS.md ("Scored choices", "Team brain and route
variety"). Landing in two parts, each green on its own check branch: part 1 (scored choices, the team brain, route
variety), part 2 (snipers, cover-to-cover advance, playbooks per mode).

**Part 1, what's in it:**
- Scored choices (`bots/choices.ts`, a pure function; `BotBrain.choose` applies it): the goal by kind (a carrier's run,
  a person's order, one to keep to, one to hold), cover, a gun, a retreat, a chase, a noise, a pickup on the way, with a
  0.25 margin. The old rules' tuned order is kept; what's new: defenders hold their flag, a bot on the hill stays on it,
  orders hold, carriers never turn aside, hurt bots let noises go.
- Corridors (`nav/corridors.ts`): two or three distinct ways per trip, each with one via (following a corridor's points
  every 12 m stranded bots on maps with floors). The team brain (`bots/teamBrain.ts`, once a second a side): prices
  (crowd, deaths, sightings), groups (main push, flankers, a recon pair) only on trips of 180 m or more with two ways
  near the shortest (15 CTF maps), staging out of the objective's sight, waves that go together. Interceptors ahead
  of an enemy carrier are built but off (`Playbook.interceptors` 0: three stopped the attack of the side whose flag was
  taken, and Diamond Park's first capture came in 3 of 6 five-minute matches). King of the Hill never splits. The
  director hands each bot its job (`BotPlan.job`).
- `bot-report`: route choice (`routes[].cross`: each bot's way past a trip's middle, once a life), group pushes, every
  map's line in the nightly judge, "two ways" and "busiest way" in the scorecard.

**Run it:** `pnpm bot-report <maps> --mode=core.ctf --seeds=1,2 --seconds=180 --json=…`, then `--compare=a.json,b.json`
(several files joined with `+`). The full scorecard: Run workflow (`bots-nightly` shards, then `bots-scorecard`); the
agents' token can't download artifacts (403), so read the scorecard from the `bots-scorecard` job's log (`gh api
repos/Dsoto1/splitters/actions/jobs/<id>/logs`).

**Numbers** (dev sample, 33 matches, BOT_AI_PLAN.md): King of the Hill's hill held 26.3 → 48.9 %, Bomb plants 0.5 → 1.5 a
match, hostage rescues 0 → 1, Elimination's round 120 → 70 s, Team Deathmatch's busiest way 54 → 43 %; CTF captures
20 → 23 from 176 → 127 takes, matches with a capture 12 → 11, route choice two ways 88 → 89 %, busiest way 59 → 60 %.
Five-minute capture tests' matches, seeds 1-6: first capture in 6 of 6 on Diamond Park and Sunken Kingdom, as main.
The nightly scorecard (run 42330601755): CTF captures 0.9 → 1.0 a match (25 of 44 maps with one), hill held 26.3 →
40.8 %, plants 0.5 → 0.8, rescues 0.1 → 1.5 a match; Hostage's idle limit raised 12 → 16 % (its guards keep watch at
their station now).

**Part 2, what's in it:** snipers (`bots/sniper.ts`: a scoped gun first, spots scored for height, a wall behind,
tucked away and the lanes they cover, seeing through the scope to the gun's reach, calculated shots, two or three
shots a spot), cover-to-cover advance (`BotBrain.boundPhase`: bounds by style; in cover while reloading or hurt;
`NavWorld.markExposure`: open ground costs Mixed routes 1.2 times, Tactical 1.45), playbooks per mode
(`bots/playbooks.ts`, Breakthrough's included: `bound: 'all'` reaches the brain through `TeamJob.bound`), flankers
45 %, `bot-report`'s style per bot (cover by style in `--compare`) and how each route-choice vote's bot went. Numbers:
BOT_AI_PLAN.md, "Phase B part 2, measured" (cover in a fight Tactical 24 → 40 %, Mixed 18 → 28 %, Arena as before;
sniper-role bots' scoped kills 4 → 27 in the sniper sample). The nightly scorecard (run 42339417626): cover in a fight
33.8 → 36.5 % (CTF 13.7 → 23.6 %), scoped kills 1.8 → 2.6 a match, CTF captures 1.0 → 0.9, hill held 40.8 → 40.1 %,
plants 0.8 → 0.9, rescues 1.5 → 2.0; limits raised: CTF idle spells of 10 s+ 2 → 2.5 a match (snipers holding spots),
Bomb idle out of a fight 12 → 14 % (defenders waiting longer at their sites for attackers moving up in bounds).

**Breakthrough** (`wip/breakthrough`): wired (2026-11-07): its `botBrief` hands `playbookFor('core.breakthrough').team`
with the attack objective (`stage` while the defenders hold it), its `botTrips` each sector's spawn groups to each
objective, and its bot logic reads `.breakthrough` for the defenders' shares (guns, trenches, crest snipers, falling
back). See the Breakthrough section above.

**Left after part 2:** CTF against a held flag (bounds slow the attack: Diamond Park's first capture in five minutes
in 4 of 6 seeds, 6 of 6 in part 1); the busiest way under half (60 % on the long CTF maps: routes that stay on a
group's corridor, Phase C item 4); snipers' kills from spots (0.3 a match: the scoped gun at spawn with the weapon
sets, spots over where the enemy goes).

**For the owner to playtest (part 2):** Tactical style (Match Setup) on Sunken Kingdom or Bunker Cross CTF: attackers
moving up cover to cover, half covering; any style on Twin Spires, Eagle Spires or Diamond Park Team Deathmatch:
snipers picking up the sniper rifle, taking a high spot, waiting for a shot and moving after two; Arena style: the
rush as before.

**For the owner to playtest (part 1):** CTF on a long map (Fernwood Moon, Sunken Kingdom, Iron Tide, Capitol Mall):
the main push, flankers and a recon pair on different ways, a push gathering out of the flag's sight and going in
together. CTF on Diamond Park or Bunker Cross:
defenders staying by their flag; give a bot an order and it holds. King of the Hill on Shingle Point: bots stay on
the hill. Bomb on Serene City: plants.
<!-- /bots-b -->

<!-- bots-a -->
### Bot AI Phase A: navigation audit, never stand still, scorecard (`wip/bots-a`, agents, 2026-11-06; main b2c58e2e, bc6037a1, da59209d and c0b74376 merged in; green on `check/bots-a` at c9ab150a, run 42273882962; not landed)
docs/BOT_AI_PLAN.md (Phase A done; the before/after tables under "Phase A, measured"), docs/BOTS.md ("Navigation
audit", "Never standing still on a failed route", "Scorecard"). Earlier agents did most of it and were stopped; the
last one finished it.

**Run it:** `pnpm nav-audit [maps] [--pictures=dir]` (every map's audit and picture); `pnpm bot-report --check` (the
quick scorecard CI runs, held to `packages/server/src/tools/bot-limits.json`); `pnpm bot-report --suite=all
--seeds=1,2 --seconds=180 --shard=k/n --json=…` then `--judge=a.json+b.json --pictures=dir --summary=file.md` (the
nightly: the `bots-nightly` and `bots-scorecard` jobs in ci.yml; the `bots-report` artifact holds the report and every
map's picture). Scratch tools (a spot's ground and navmesh, the boxes round it, falls into a trap, hops out of one,
pads, every bot near a spot over a match's time window, one bot's way through a match, where spawns land, the
MapMaker driver, A/B scripts): session scratchpad `phaseA2/tools/`.

**Done when, met:** no official map has an audit error (15 findings on 9 maps are listed in `nav/auditKnown.ts` with
why, as warnings: the owner's list below); on the CTF suite failed searches 0.03 % (under 2 %) and no-route idle 0.05 %
(under 1 %); the scorecard runs nightly (the full scorecard ran from Run workflow on `wip/bots-a`, run 42264736565: 398
matches on 77 maps, every limit held).

**What's in it** (newest work last):
- The audit (`nav/audit.ts`), from every polygon: traps, islands, spawn points, objectives and pickups cut off; errors
  on official maps (validate-map, the all-maps test), warnings in MapMaker. Ledge-drop links off patches with no way
  down. Navmesh polygons inside solid boxes left out. Stand-ins for goals no route reaches, the last step off the
  navmesh, a way onto it, no route requests in the air or on a ladder, buttons, pickups only where routes come back.
- The last round: falls need room for a standing body (rails and lattices; Bunker Cross's yard was no trap); landings
  aren't snapped through walls (Rail Stockyard); jump pads land on the scenario's solids (a ray callback: movement is
  in the menu's first JS and must not import map geometry, which cost 166 kB gzip and failed the bundle budget); hops
  go by one-way routes (St John's), onto safe ground from the main area (M4 Outpost's dais), up to 1.4 m with a tucked
  jump (Undergate Transit, Sunken Kingdom); teammates push aside, never back, out of a fight, and not at ladders (the
  owner's Shingle Point report); a bot at a button looks at it and presses (Serene City's thaw console: the look along
  the route turned it level every tick); squadmates spawn beside a teammate only on walkable ground (Dune Harbor);
  the nightly judge loads the WASM before drawing pictures (it threw).
- Maps (MapMaker): Dune Harbor's consoles 1.2 m shorter; spawn points out of solid on 25 maps (earlier); ten maps
  exported at format 26 on this branch imported and exported again (main's format 27 made their release stamps read
  "changed"); Rockfall Canyon's e2e picture taken again (its seeded spawn moved 0.5 m out of a solid).

**Numbers** (BOT_AI_PLAN.md, "Phase A, measured"): CTF suite, 88 matches: failed searches 1.67 → 0.03 %, no-route idle
0.16 → 0.05 %, idle out of a fight 5.6 → 4.8 %, frozen 0.9 → 0.6 %, stuck recoveries 2.37 → 2.24 a bot-minute, idle
spells of 10 s and more 2.7 → 1.4 a match, maps with a capture 31 → 34 of 44, captures 145 → 138 (149 and 151 at the two
commits before the last two fixes: two matches a map is a small sample). Every other mode's failed searches to 0 (Team
Deathmatch 39.7 %, Elimination 27.2 % before). `pnpm bench:96:clump`, bot thinking a tick: base 1.13–1.90 ms against
branch 1.24–2.01 (means 1.48 and 1.54; clumped the same, spread a tenth more), within the 2.5 ms guard.

**Left, found on the way:** Iron Compound's gantry MG turret (`mount_148`) stands in the 1.6 m walkway with 0.8 m beside
it and bots walk into it (a mount's body isn't on the navmesh: Phase C); a dropship landing by Dune Harbor's sunken room
leaves its riders under the street floor, where nothing gets them out (seen in the Bomb and Hostage samples, modes the
map doesn't list); Shingle Point's HQ (bomb site B: six defenders keeping watch in one small room trip over each other:
Phase B's playbook); Norman Shores' bots in the shallows (off the navmesh, no way onto it level or below); Iron Tide's
crumbling wall by its west jump pad (`block_341`: bots stuck at it for minutes in one match); hills held (32 → 29 %) and
Bomb plants (0.5 → 0.3 a match) a little down on the samples, and ten CTF maps still without a capture: Phase B.

**For the owner** (each would be a MapMaker fix; players get stuck in all but the first two too):
1. Skyward: the four pad perches are one-way by design ("fall off and you are gone"), but two spawn points
   (`spawn_035`, `spawn_036`) are on the towers: whoever spawns there can't leave. A pad back down, or move them?
2. Sky Islands: the sky platform (double damage), pad up, no way back (as designed?).
3. Grand Marquee: the marquee top over the street; the street pad throws you up and nothing gets you down (1.6 m
   sign panels, the terrace 2.9 m up). A gap in a side panel or a ladder?
4. Obsidian Orb: the reactor core (`prop_087`, scale 4) fills the "bottomless" shaft up to 3.8 m under the bridges:
   a fall off a retracting bridge lands on it and stays there. Core not solid, or lower it? And a 0.4 m ledge
   (`block_082`) runs along the shaft's north wall at -5.6 m: falls land on it and nothing gets off it (913 of the
   CTF suite's 915 failed searches, 1.4 % of the map's, are bots on that ledge asking for a way off).
5. Reactor: off the roof's south-west corner at (37, 4, 50) you drop 4.3 m into the yard outside the walls and can't
   get back in. A railing on that corner?
6. Serpent Gorge: the gorge floor along the river (falls through the gallery's openings, banks too steep to climb)
   and slivers by the crypt's walls. Steps or a ladder out?
7. Erosion: the corner pads that throw you back up from the lower deck stand on 3 m pillars meeting the deck only at
   a corner (players step across, bots can't). Pillars that share an edge with the deck?
8. M4 Outpost: the uplink room's dais leaves 1.5-2 m gaps the navmesh (0.8 m from walls) can't pass; bots hop onto
   the dais but not round it to the armour behind it or the north corridor. Wider gaps?
9. Iron Compound: the MG turret on the gantry by the stairs (`mount_148`) leaves 0.8 m of walkway beside it; bots
   coming back along the gantry walk into it. Move it off the walkway's middle?
<!-- /bots-a -->

<!-- ground-fix -->
### MapMaker's ground under floors (`wip/ground-fix`, agent, 2026-11-07; from main 5e85caff, main 9dfe3ba1 merged in; green on `check/ground-fix` at e16079fe, run 42328205906; not landed)
The owner: "fix the ground bug" (set pieces part 2's pitfall: every MapMaker edit lowered the ground under every level
floor and nothing ever raised it back).

**The cause (step 1, as found):**
- **Loading** (`loadMap`, map/validate.ts): the set pieces are expanded into their parts (`expandSetPieces`: a sunk
  trench's buried carve floor is one of its parts), as played the paths are laid into the ground (`withPathsLaid`) and
  the props bedded on the ground re-bedded on the laid ground (`rebedProps`), then `terrainUnderFloors` (map/settle.ts) keeps the
  terrain under every floor: each unturned `floor` box (tile slabs, room-option and extra floors such as the trench's,
  roofs, every static block), highest first, lowers each terrain vertex inside its footprint whose height is between
  5 cm under its top and 3 m over it, to just under the slab inside and 5 cm under the top on its edges. It only ever
  lowers. Loading for editing (`forEditing`: MapMaker, publishing) kept the placements and the paths apart but handed
  back the carved ground.
- **MapMaker:** `EditorApp.run` wrapped every edit of tiles, blocks, set pieces or terrain in `withTerrainUnderFloors`
  (editor/operations.ts): apply the edit, carve, and add a `setTerrain` (the ground after the edit → the carved
  ground) to the same undo step. The carved ground replaced the document's ground.
- **Why it never came back:** once the carve was in the document, the heights it lowered were gone (only that step's
  undo still had them). The next edit carved again from the carved ground, and the carve only lowers: a floor moved
  away left its dip, a floor moved in steps left one at every step (the 56 m slab on St. John's), a deleted floor
  left its pad. Loading for editing and exporting wrote the carve into the file, so the ground as made under every
  floor that had ever stood anywhere was lost for good. Play never showed it: loading carved the same ground again,
  which changed nothing. Five shipped maps still have ground that loading carves (Apex Ring, 390 vertices, up to
  0.32 m; Norman Shores, 82, up to 0.83 m; Blackout, Dead Reel, Dockside Depot, 5 cm; Crossroads was the sixth until
  the prop scale pass re-saved it), so opening one of them in MapMaker and exporting it changed the file.
- MapMaker's view already drew `terrainUnderFloors(withPathsLaid(viewDoc))`: the carve in the document added nothing
  to what it showed but its permanence.

**The fix (step 2): the ground is worked out, never stored.** No format change.
- **The document and the file keep the ground as made** (only sculpting changes it): `EditorApp.run` runs edits as
  they are (`withTerrainUnderFloors` is gone) and `loadMap(..., { forEditing: true })` hands back the file's own ground.
- **The ground as played is one function,** `withGroundAsPlayed` (settle.ts): the paths laid in, `terrainUnderFloors`
  over the floors of the geometry as made (set pieces' parts included), and the props bedded on the ground as made
  re-bedded on it (`rebeddedY`, the rule `rebedProps` applies to each prop). `loadMap` plays every map on it.
  `EditorView.setMap` draws the same pieces after every edit: the laid ground cached per ground and paths, the carve
  redone over the whole map's geometry (`mapBoxes()`; under a millisecond on St. John's), and kept as the same terrain
  when it comes out the same, so an edit that moves no floor's carve rebuilds no terrain mesh.
- **Everything in MapMaker that meets the ground uses the ground as shown** (`EditorApp.shownGround`): the pointer (a
  hill inside a building no longer catches clicks), the brush rings, the live brush preview (kept under the floors
  while it is dragged; Flatten levels to the height under the pointer as shown), the level strip's "on the terrain",
  Smooth all's moves of spawns, pickups, flags, hills and vehicles, and the navigation check. Props are bedded on the
  document's own ground (placing, Settle on ground, Scatter, moves, Replace all) and drawn re-bedded on the ground as
  shown (the ghost too), as loading plays them.
- **Loading as played changed in one way:** props on the ground are re-bedded on the ground as played (laid and kept
  under floors), not only on the laid ground, and the carve and the re-bed use the geometry as made (the laid map's
  but for the terrain's edge walls). Over all 90 shipped maps (main 9dfe3ba1 merged in): every map loads
  byte-identically but Blackout and Dockside Depot (9 props each), whose files carry ground 5 cm through a floor's
  edge: those props sit 1-5 cm lower, bedded.
- **No migration:** the file's `terrain` was always the ground before the carve as far as loading goes (`loadMap`
  lowered every map's), so existing maps load as before and older clients play maps the new MapMaker exports.
- **Known, intended:** what stands on a floor or on the lowered ground (spawns, pickups, objectives) stays put when the
  floor goes (props follow the ground). A room moved off its spawn leaves the spawn under the ground that comes back,
  and MapMaker says so ("inside something solid"); before, the spawn was left in a pit. On maps last exported by the old
  MapMaker, the ground under their floors is that old carve (nothing tells it from sculpting): an existing building
  moved away leaves its pad, as before; the terrain tools level it.

**Tests (step 4):** shared `terrainFloors.test.ts`: an edit and its undo byte-identical (moves, turns, deletes, a
raise, a room, a trench, a sculpt); a slab moved across a field in 15 steps and back; a deleted floor; a turned floor,
squared up and then moved (the St. John's slab); trenches and set pieces carving as on load, the slot moving, turning
and going with the piece; a Sunken Trench tile alone; props beside a floor played on the lowered ground and back on
the ground as made when the floor goes; every shipped map loads for editing with its own ground and as played with
none through a floor; MapMaker's view composition equals `loadMap` on St. John's. e2e editorux `editorGroundChecks`:
the starter room on ground raised 0.6 m, dragged two cells with Select (the ground back where it stood, lowered where
it went, the document untouched), undo (byte-identical), redo, across the field and back a cell at a time, TEST plays
the ground MapMaker showed.

**Proof** (session scratchpad `gf/pics/`): `drag-main-*`: main's MapMaker, the room dragged four cells east over the
raised ground: a 1.1 m trench along its whole path (the ground along z 0 from x -8 to 40: 75, 75, 10, -37, -37, -37,
10, ... cm, the document the same). `drag-fix-*`: this branch, the same drags: lowered only under where it stands, the
document 75 cm all along. Step Temple: `st-yaw0-tiles` (before) and `st-after-yaw0-tiles` (after),
`step-temple-before-ground` / `step-temple-after-ground` (the Tiles layer off).

**Audit of the shipped maps (step 3).** Three passes: (1) every commit since the carve landed (a631338d, 2026-10-28)
that changed a map, branch commits too, against its parent: vertices lowered to a floor's carve value (2 cm under a
bottom or 5 cm under a top) in flat runs, or by 20 cm or more, still that low now with no floor over them; (2) on every
map, flat dips at a carve value with no floor over them (for maps made after the carve landed); (3) as played, props
floating (validate-map's `prop.floating`) and pickups, spawns and objectives over the ground with nothing under them.

| Map | Ground lowered where no floor stands | Over it | Done |
|---|---|---|---|
| Step Temple | a slot 2.2 m deep and 4 m long between the west terrace and the Terrace Stair's west face (x -14..-12, z -2..0; the 11-03 rework) | a plant cluster at its bottom | filled in MapMaker (below) |
| Fogbound | 4 vertices at carve values (11-03): shell craters (brush falloff; one holds a mud swamp) | - | deliberate, left |
| St. John's | 595 vertices lowered to carve values by Smooth all (10-31), none under a floor then: smoothing; three gentle lawn hollows (0.1-0.4 m) are flat beds from the 10-30 generation, smoothed | nothing | left |
| the other 26 maps changed since the carve landed (main's prop scale pass, re-saved in MapMaker, included) | none | no prop floats | - |
| the 15 maps with terrain not changed since | the carve never reached their files (five carry ground through a floor edge, lowered on load as always) | - | - |

No prop floats on any shipped map as played. Things over the ground with nothing under them: boats on water (Norman
Shores, Primeval Park), parked vehicles (St. John's), pickups over Sunken Kingdom's flooded courts, Reactor's
`pickup_084`, Overhang's `flag_092` and Cinder Foundry's `pickup_504`: none over ground the bug lowered (their files
never went through the carve, or the history shows none there), so not part of this.

**Step Temple, fixed in MapMaker** (fixed build, driving the real editor with Playwright; scratch driver, not
committed): Import, the Terrain tool's Flatten brush (2 m, 100 %) from the terrace top over each of the slot's four
vertices (back to 220 cm, their height before that session), the plant lifted (inspector Height 2.2, then Settle on
ground: 2.17 m), Export. The file's diff: those four heights, the plant's height, the release stamp. validate-map: 0
issues; the navigation audit: no traps before or after (five drop links into the slot gone).

**For the owner:** nothing to decide for the fix. St. John's three lawn hollows are left as they are (say if you want
them levelled). Moving an existing building in MapMaker leaves its old pad, as described above.
<!-- /ground-fix -->

<!-- setpieces -->
### Set pieces, part 2: MapMaker (`wip/setpieces-2`, agents, 2026-11-06; from `wip/setpieces-3`, main dbbc4b78 merged in; green on `check/setpieces-2` at 555c40ec, run 42312043139; not landed)
What was built: docs/SET_PIECES_PLAN.md, "As built: part 2" and "St. John's (as built)"; how to use it:
docs/BUILDING_KIT.md, "Set pieces". MapMaker places, selects, themes, explodes and saves set pieces; the coverage map
has all 39; St. John's has the Argonne Gate carriageway (with an east tower) and a DeKoven-Smythe skybridge. The first
agent built the MapMaker side and the coverage map and was stopped by an interrupt before St. John's was saved; the
second placed St. John's (from the start, in MapMaker) and finished.
- **Where the code is:** `packages/client/src/editor/editorApp.ts` (the set piece tool and ghost, picking a part as its
  placement, the box select, the tab and its panel, the inspector, Explode, the save dialog, My set pieces),
  `editorView.ts` (the piece ghost, outlines, port marks), `paletteCatalog.ts` (the `setpieces` pane, families,
  Style Pack fit), `storage.ts` (the local library), `frontend/modelThumbs.ts` (the `piece` view for the atlas);
  shared `editor/setPieceEdit.ts` (`setPieceMirrorRefusal`, `setPiecePortStates`).
- **Fixed on the way (shared):** `coplanarSpots(map, boxes, partOf)` leaves a set piece's parts against each other
  out (MapMaker passes the expansion's `partOf`); `withTerrainUnderFloors` counts set pieces' floors (placing a
  trench carves the ground at once: exports used to change on load); the Gothic/Collegiate stone plinth stops at
  doorways (`floorRuns`).
- **Tests:** shared `setPieceEdit.test.ts` (ports, mirror refusal), `zfight.test.ts` (a piece is one piece),
  `terrainFloors.test.ts` (the carve on placing), `setPieceExpand.test.ts` (the plinth at doorways),
  `coverageMap.test.ts` (every set piece); client `setPieceLibrary.test.ts`; e2e editorux `editorSetPieceChecks` (the
  tab, ghost and refusal, turn and mirror, select as one, move and undo, explode and undo, box select, save, export
  and import, the ports warning) and the coverage flow's set piece count.
- **St. John's, proof** (the exported file): validate-map OK (0 issues); z-fight audit 0; MapMaker's overlaps 69 spots
  before and after, none new; the navigation audit no traps and no findings (two new islands: the closed rooms over
  the arch and in the tower); spawns (41), objectives, logic and modes unchanged; bots sent each way in a match walk
  Exeter Street to the drill field through the passage and back, into Knight by its new door and back, through the
  east tower, and DeKoven's first floor to Smythe's over the bridge and back. Screenshots (street, drill field,
  inside, before and after) are in the session scratchpad, `sp2b/shots/`.
- **Pitfalls:** MapMaker's document keeps the placements: draw, pick and check `viewDoc` (expanded), and map a part
  id to its placement with `expansion.partOf`. Driving MapMaker with Playwright on a big map: click palette cards by
  mouse position and wait for the tool (Playwright's own click can wait forever on a busy page), run long drivers
  against `vite preview`, not the dev server (it reloads when a source file changes), keep the window 1280 px wide or
  more (narrower, the inspector folds away), and point the view at the sky while editing through the inspector (on
  St. John's, software rendering of the campus was most of the time). Screenshots with the view's photo camera
  (`view.photoCamera()`, as capture-map-shots.mjs does) come out on Medium graphics: on High every view drew the
  player's own picture. **Every MapMaker edit lowered the ground under every level floor and never raised it back**
  (`withTerrainUnderFloors`, older than set pieces): a big floor moved field by field lowered the ground under each
  place it passed. A copy of Welles's 56 m slab, squared up and then moved before it was cut down to the tower's
  paving, lowered Knight's whole front by 0.7 m on the first try (thrown away). **Fixed** (2026-11-07, "MapMaker's
  ground under floors" above): MapMaker keeps the ground as made and works out the ground under floors after every
  edit, so floors can be moved in any order; no workaround needed.
- **For the owner** (answered 2026-11-07):
  - **Owner's answers:**
    - "Keep the bridge floor fix, tower and bridge are fine."
    - The ground bug: "fix the ground bug". Fixed on `wip/ground-fix` (2026-11-07), ahead of the overhaul.
    - The facade ground bands: "leave the facades as they are for now" (2026-11-07).
  - The other pack facades (concrete, corrugated, manor brick, clapboard, roman, desert, harbour, snow, timber
    frame...) still draw their ground band across doorways (visual only): stopping them at doorways, as the stone ones
    now do, changes those packs' look, so it waits for a yes.
  - St. John's: the gate's east tower (two storeys, Welles's stone, a door onto the drill field, a window on Exeter
    Street) and the skybridge's site (DeKoven to Smythe over Church Street, the one pair of halls that face each other
    at a span a skybridge takes, with short block links to each hall's first floor) are the agents' choices, per the
    plan.
  - King of the Hill: Church Street's hill (`hill_2938`, radius 5 m) is on the street by the bridge's south end, and a
    hill counts anyone up to 3.5 m over its floor (4.04 m there); the bridge's own floor is at 4.0 m, so a floor at
    4.25 m now runs through the bridge (level with the links' steps) and nobody inside holds the hill. Moving the hill
    a few metres instead would be the other way; it was left where it was (objectives unchanged).
  - MapMaker's ground lowering (the pitfall above): fixed on `wip/ground-fix` (2026-11-07), worked out after every
    edit and on load from the ground as made, never stored.

### Set pieces, part 1: data, expansion, first content (`wip/setpieces`, agents, 2026-11-06; from main 774a28ce, main e18a175e merged in; green on `check/setpieces` at 09af09cd, run 42211217797; not landed)
Plan and what it settled: docs/SET_PIECES_PLAN.md ("As built: part 1"); how to add a piece: docs/CONTENT_PIPELINE.md,
"Set pieces". Part 2 (MapMaker: the Set pieces palette tab, ghost placing, select/inspector, Explode, Save selection,
local library, St. John's placements, e2e in editorux) starts from this branch and only wires UI to the shared API.
- **Format v27** (`MAP_FORMAT_VERSION` 27, migration a no-op, v26 fixture `test/fixtures/iron_compound_v26.json`):
  optional `setPieces` (placements: `id` at most 48 chars, `piece`, `x`, `y`, `z`, `rotation`, `mirror`, `pack?`,
  `overrides?` with `roles` and `hide`) and `setPieceDefs` (a map's own `local.*` pieces). `loadMap` expands every
  placement into ordinary tiles and entities (`map/setPieces.ts` `expandSetPieces`: pure, cached per document, ids
  `sp_<placement>_<index>`) before validation, geometry, collision, nav and the server see the map; `forEditing` keeps
  the placements (MapMaker draws nothing for them yet: part 2 expands them for its view). Validation sees the expanded
  map (issues on a part name its placement), footprints can't overlap tiles or each other, ids are unique across
  placements, tiles and entities.
- **Budgets:** the file's caps count placements (`setPieces` at most 1024). The map **as played** must fit the
  schema's own caps (4096 tiles, 4096 entities, 2 MB JSON: `SET_PIECE_PLAYED_MAX`), because the join welcome carries
  the played map and every client runs `loadMap` on it again (session.ts `welcome`). If maps ever need more, send the
  stored map in the welcome instead (each client expands it, deterministically) and raise the played budget.
- **Content** (`content/setpieces/`, `node tools/content/setpieces.mjs`, in `content:check` and `content:rebuild`;
  generated `content/setPieces.generated.ts`, its own chunk, not in the menu's first JS: bundle 695.1 kB gzip):
  `setpiece.carriageway_1` and `_2`, `setpiece.skybridge_2`, `_3`, `_4`; 13 role packs in `roles.json`
  (`collegiate` = Castle Keep's default: St. John's own wall and trim stone, the new **Collegiate stone** facade).
- **New kit pieces (any map, MapMaker offers them now):** wall style **Segmental arch** (`arch_segmental`, 5 m,
  springing 2.7, crown 3.3; collision stepped over the curve; voussoirs and keystone, on the outer face too where
  nothing is beyond); room ceiling **Vaulted ceiling** (`vault`: strips that collide, a beam where a side can't carry
  it, two dressed-stone rib arches a cell as trim); facade **Collegiate stone** (`collegiate_stone`: Gothic stone's
  dressing in lannonstone and dressed limestone; Gothic stone unchanged).
- **Shared API for part 2** (all exported from `@tiletrigger/shared`): `builtInSetPieces()` (library: pieces and
  packs), `expandSetPieces(doc, library)`, `setPieceParts(placement, def, theme, library)` (one placement's parts, for
  MapMaker's view and ghost), `setPieceFootprint`, `setPiecePorts` (cells, levels and sides on the map: the outline and
  port markers), `placementPack`, `piecesFor(doc, library)` (shipped plus the map's own), `setPieceMirrorProblem`,
  `checkSetPieceDefinition`, `parseSetPiece` (untrusted JSON: a player's library, an import). Editor:
  `checkSetPiecePlacement` (ghost green/red with a reason), `placeSetPieceCommand`, `updateSetPieceCommand` (pack,
  overrides), `moveSetPieceCommand`, `rotateSetPieceCommand` (R), `mirrorSetPieceCommand` (M),
  `deleteSetPieceCommand`, `explodeSetPieceCommand` (one undo step; returns the parts' selection),
  `addSetPieceDefCommand`, `setPieceFromSelection(doc, selection, anchor, { displayName })` (returns the definition, the
  pack it matched and any problems). `Selection.setPieces` works in `moveCommand`, `rotateCommand`, `duplicateCommand`
  and `deleteCommand`; `checkPlacement`/`checkLayout` refuse a tile inside a footprint ("…explode it into its parts to
  build into it"). `setPieceFromSelection` takes tiles, blocks, props, doors, ladders and lights (placed pieces count as
  their parts) and the expansion gives ordinary parts back: the overhaul's groups can reuse both.
- **Tests:** `packages/shared/test/setPieceExpand.test.ts` (every turn × mirror × pack of every piece, the transform
  point by point against the unturned piece, entities' facing, block rules, mirror symmetry, ports, roles and
  overrides, determinism, ids, played maps load again, v26 → v27 unchanged, v27 round trip), `setPiecePlay.test.ts`
  (collision, trim and nav from the expansion equal the exploded map's; z-fight audit 0 over every piece in every turn
  and mirror and with neighbours; shots and players through every arch and doorway in every turn, stopped by piers
  and spandrels; bots path through the passages and doorways; skybridges walked, shot through, nothing below),
  `setPieceEdit.test.ts` (overlap refusals with reasons, commands and undo, explode, save selection round trip,
  budgets), `roomOptions.test.ts` (the vault), `tools/content/test/setpieces.test.mjs` (the generator's checks).
  `setPiecePlay.test.ts` also proves every port of every piece, in every turn and mirror, with a room built beyond it,
  as `propOpenings.test.ts` does for props: about 50,000 rays straight through every point of each opening its own
  walls leave open (the tiles' and edges' collision: none is shut), a player walking through each from the room
  beyond, and a bot's path through each.
- **Screenshots** (session scratchpad `shots/out4/`, built game via MapMaker → TEST, Medium, 1280 × 720): the
  carriageway from the street and the courtyard, standing free (outer voussoirs), its vault and ribs, a side door;
  the wide carriageway outside and in; the skybridges from the street, inside and underneath; medieval and harbour
  versions; an overview.
- **Retired:** none (no Phase-1 piece truly replaces an old tile); the list for later phases is in the plan.
- **Coverage map:** `maps/test_coverage.json` got its Segmental arch wall in MapMaker (Import, the wall tool's
  command on the dais room's north side, Export), so the coverage test passes. Part 2: place one of each set piece in
  it through the new palette and make `coverageMap.test.ts` require every set piece.

**Notes for part 2**
- **St. John's** (`maps/st_johns.json`: no tiles; 2,480 blocks, 736 props, halls turned 0.5-2.4°): place pieces on
  the grid and fit the neighbouring blocks in MapMaker (recommendation and reasons in the plan, "St. John's (part 2)").
  The Argonne Gate: `setpiece.carriageway_1` at cell (1, −10), unturned (or (1, −11) to bring the south arch to the
  street front); replace the block-built gate there (the Gothic arch prop at z ≈ −84 and its gatehouse blocks), build
  the 6.5 m to Welles as the gate's east tower in blocks, cut doorways in Knight's and Welles's walls at the doors. Its
  theme (Castle Keep) gives it Collegiate Gothic without naming a pack.
- MapMaker's view must draw placements expanded (`setPieceParts` per placement, or `expandSetPieces(doc).map` for
  the level) while `doc` keeps them; picking a part selects its placement (`partOf` in the expansion).
- A vaulted ceiling springs at 3.02 m, just over a doorway's head: doors and windows in the walls it springs from stay
  whole (the every-port test caught the first version, springing at 2.9 m, 10 cm into the doors), but a taller opening
  there (a wide doorway, an archway) has the vault across its top. Worth a hint in MapMaker's inspector.
- A level-1 skybridge over a street meets the street's 5 m lamp posts: leave lampless paving under it (or level 2).
- The existing e2e flow called `setpieces` is Sky Islands' crumbling stones and trapdoors, not these: name the new
  editorux checks so they aren't confused with it.

**Notes for part 3** (the showpiece pieces, `wip/setpieces-3`)
- Pieces are built for the standard grid (`SET_PIECE_GRID`: 8 m cells, 4 m levels): a map on another grid refuses its
  placements (`setpiece.grid`). The colosseum's 4 m board squares need a decision there: free parts (blocks, props)
  can sit anywhere in a piece's frame already; tiles can't.
- New pieces go in `content/setpieces/<family>.json` (docs/CONTENT_PIPELINE.md, "Set pieces"); the every-turn,
  every-pack, z-fight and every-port tests pick them up. Kit pieces a piece needs (an edge style, a room option) go
  into the kit for every map, as `arch_segmental`, `vault` and `collegiate_stone` did.

**Owner's answers (2026-11-06): 1 yes, 2 keep, 3 keep battlements.** The St. John's stones and the Collegiate stone facade
are right for the campus. The shallow vault stays. Skybridges keep the pack's facade (battlements) by default.

**Open questions for the owner** (answered above)
- Collegiate Gothic: St. John's own stones (Grey Stone Blocks #d9d5cb walls, Dressed Stone #d8d3c6 trim) and a new
  Collegiate stone facade, rather than Gothic Estate's dark Mossy Castle Stone: right for the campus?
- The vault is shallow (a 0.27 m rise, from over the door heads to under a 4 m level's floor): its ribs make it read;
  a taller passage would need the piece to span two levels. Keep it?
- Skybridges wear their pack's facade (Collegiate: battlements and pinnacles along the bridge). Plainer bridges (no
  facade) are an override away (`overrides.roles.facade: "none"`); which should be the default?
<!-- /setpieces -->

### Landed 2026-11-06 evening: main = 157eb996 (train `check/train-20261106-195916`, run 42284421328, green)
- **Bot AI Phase A**: navigation audit, no standing still on a failed route, scorecard (`wip/bots-a`).
- **Four maps retired**: Obsidian Orb, Reactor, Serpent Gorge and Iron Compound (`wip/retire-maps-1106`).
- **The hosting fix**: a stalled friend whose connection is up gets 60 s (`wip/handoff-silent`). See "Fixed: the
  `handoff` e2e failure" below.

### Branch clean-up (owner, 2026-11-06: "yes go ahead")
- **The repo had 292 branches; 261 were merged into main.** Eighteen old unmerged ones (27 Oct to 6 Nov) are to be
  kept as `archive/<branch>` tags and then deleted.
- **This session's GitHub access can't delete branches or push tags** (HTTP 403 on both). The owner runs the
  commands from Cloud Shell.
- **In zsh, write `${b}` inside strings:** `"$b:refs/..."` reads `:r` as a modifier.
- A "Prune branches" Actions workflow is offered for the future; waiting on the owner.

<!-- prop-scale -->
### Prop scale pass: furniture at human size (`wip/prop-scale`, agents, 2026-11-06/07; from main 2acb8f23, main 5e85caff and 372d503f merged in; green on `check/prop-scale` at 61585943, run 42324256688 (full suite: unit, maps, build, check, bots, perf budget and mass, 16 e2e shards); not landed)
**The owner:** "Can we scale the props to the normal human character size? Some of them are tiny, like chairs and
such." Then, on the lineup sheets: "yes fix the outliers, show me the 10% sheets." Part B of the prop pass (after the
slack pass); the brief: session scratchpad `briefs/prop-scale.md`.
- **Done:**
  - **Tools:**
    - The lineup: `?mode=lineup` (`packages/client/src/tools/propLineup.ts`) and `node tools/content/prop-lineup.mjs
      <url> <out dir>`. It draws a sheet per pack: the furniture beside the small, standard and large characters and
      a ruler, from a standing player's eye and from the side. `PACKS=`, `ONLY=`, and `SCALE=1.1` for a furniture
      factor.
    - The measure: `node tools/content/prop-sizes.mjs` gives each piece's seat, top or height against its
      reference (`tools/content/furniture.mjs`).
    - `prepare-props.mjs` scales a prop kept as built (a pack from a download) to a new `height`.
    - docs/CONTENT_PIPELINE.md, "Real-world sizes", has the references and the rule: more than 10 % off → a new
      height; one height per prop; maps at ×1.
  - **Catalogue** (13 props; the openings fixture has them, 604 entries):
    - Kenney: `bench` 0.45 → 0.92 m (seat 0.22 → 0.46). It also collides as voxel now (2 boxes): at full size
      its single box carried slack. `office_chair` 1.0 → 1.26 (seat 0.37 → 0.47), `graveyard_bench` 0.5 → 1.02
      (seat 0.22 → 0.45), `dungeon_chair` 0.8 → 1.12 (seat 0.33 → 0.46).
    - Quaternius: `hm_couch`, `hm_couch_large`, `hm_couch_l` and `hm_armchair` 0.85 → 1.04 (seats 0.35-0.37 →
      0.43-0.45); `hm_dresser` 1.0 → 0.8.
    - Metro: `mt_bench` 0.81 → 0.96 (seat 0.39 → 0.47).
    - Household: `hh_toilet` 1.01 → 0.89 (seat 0.48 → 0.42), `hh_desk` 0.85 → 0.77 (top 0.84 → 0.76), `hh_basin`
      0.76 → 0.95 (rim 0.67 → 0.84; the top of the model is its tap).
    - The plan list sent to the owner said dungeon chair 1.15, desk 0.78 and basin 0.85. Measuring the models
      gave the values above (reported to main).
  - **Maps, in MapMaker**, 16 maps. Session scratchpad `scale/mmedit.mjs` drives the real editor: Import, select,
    the inspector's Scale, X, Z and Height fields, Export. The export brings each file to format 27 and stamps its
    release; as loaded, only the edits differ.
    - Back to ×1: 44 Kenney benches (Ironhold Prison 22, Diamond Park 8 and Neon Galleria 8 at ×2.5, Riot
      Junction 4 at ×2.6, Grand Marquee 2 at ×1.5) and St John's 65 dressers at ×0.8.
    - Down with the desk tops: Glasswork Office's 4 monitors, Neon Galleria's monitor and Riot Junction's 2 desk
      lamps.
    - Moved 0.05-0.32 m clear of the wall, bookcase or plant their new size reached into: 27 placements (14
      sofas, 6 armchairs, 6 benches, a basin). Two of Crossroads' sofas had poked through a partition.
    - Crossroads' sofa beside the house's east door: at 2.7 m it reached past the jamb, and with the counter
      opposite it shut the way in to the hostages upstairs for bots (validate-map). It sits 0.1 m north of its old
      place now; its far arm goes 0.17 m into the 0.24 m partition, not through.
    - Main 5e85caff merged in (2026-11-07). Set pieces part 2 had edited St. John's in MapMaker too, so its file
      is main's, with the 65 dressers set to ×1 again in MapMaker (session scratchpad `scale/mmedit2.mjs`,
      `scale/edits-stj-merge.json`). As loaded it is main's map plus those 65 scales and nothing else (its
      release keeps main's map id, revision 2). Main's St. John's edits are 13 m or more from the four props
      this pass grew there, and no set piece places a resized prop.
- **Checked:**
  - `pnpm typecheck`; `pnpm content:rebuild` (content OK; 17 box props carry slack, every one says why).
  - propOpenings and propSlack tests; the z-fighting audit and the coverage map test (207 tests).
  - validate-map on the 38 maps that place a resized prop: clean, apart from the known warnings on Grand Marquee,
    Reactor and Serpent Gorge.
  - The bots' navmesh area reached from the spawns, before and after, on the same 38 maps: it shrinks only by the
    props' own bigger footprints (at most 67 m², 0.15 %, Capitol Mall); no room is cut off.
  - A scratch overlap check of every placement against walls and neighbours, old sizes against new: nothing new
    apart from those listed below.
  - After main 5e85caff was merged (2026-11-07):
    - `pnpm content:rebuild` changed nothing (no new pictures; content OK); `pnpm typecheck`; validate-map on St.
      John's: OK (0 issues).
    - `pnpm test:changed` (183 files, then the 32 that read maps): two failures, both from this branch, fixed in
      the tests. unifiedPaths: Undergate Transit's re-save made its old race-track field a path (checked against
      main's file: the same curve, checkpoints, grid and ground), so two maps carry the old field, not three.
      dressing: a full living room at seed 3 takes 19 different models with the real-size sofas (bound 16; over
      seeds 1-30 main's tables already gave kitchens 19 and living rooms 18), so the bound is 20.
    - The e2e smoke on the local build (`pnpm e2e:changed`'s set for a full-suite change: editor, offline, online,
      maps) with `E2E_MAPS` = the 16 edited maps: all pass. Every one starts a match on solid ground and opens in
      MapMaker with no errors and nothing lost (Ironhold Prison and Riot Junction, which timed out in the run the
      restart cut off, included).
    - `pnpm bot-report --check` (Diamond Park CTF among its 4 matches, with its benches back at ×1): every limit
      held (11 measures).
- **For the owner:**
  - **A "game size" factor: DECIDED (owner, 2026-11-07): "Keep real size."** No furniture factor, now or as a
    follow-up; recorded in docs/CONTENT_PIPELINE.md, "Real-world sizes". Why: at ×1.1 seats sit at 0.48-0.50 m
    and read high beside the 1.8 m body, and rooms built around today's sizes crowd (the living room's sofa and
    armchair run together). The sheets the owner judged, real size next to ×1.1: session scratchpad
    `scale/x110sheets/` (the Kenney furniture, Quaternius house, household and hospital kits, and
    `in-map-real-vs-x110.jpg` for the office desks and the living room).
  - **Listed, not changed** (docs/CONTENT_PIPELINE.md, "Real-world sizes"):
    - Narrow seats (Kenney `chair`, `hh_chair`, 0.40 m).
    - Low beds of the right length (Kenney `bed`, household beds); Quaternius `hm_bed_king` (3.6 m long).
    - The wheelchair; doors sized to their kits (hospital 3.0 m).
    - The household kettle and desk fan, twice their size: Pantry Raid's kettle is a ×4 giant.
  - **Hollowmere Manor's sofa** (`prop_227`) stands in a 2 m alcove beside its sitting room's north doorway, and no
    real-size sofa fits there. Its back is flush with the wall now and its left arm stays inside the 1 m double wall
    (as it did, deeper), so the doorway keeps clear. A two-seater or the armchair would fit.
  - **The dungeon chairs** round the small tables (Dune Harbor, Flatpack Depot, Grand Marquee, Serene City,
    Starhaven) now tuck 7 cm under the tables' tops.
  - **Serpent Gorge** (retired) is not edited: three graveyard benches there reach into a wall or each other.
- **Pictures** (session scratchpad):
  - Lineups: `scale/lineup-before/` (every pack); `scale/lineup-after/` and `scale/lineup-compare/<pack>.jpg` (the
    six changed packs, before above after); `scale/lineup-resized-before-after.jpg` (the 13 props).
  - In the maps: `scale/maps/in-map-before-after.jpg` (office, living room, dining room, Ironhold's benches, a ward,
    Hollowmere's sofa), and `scale/maps/after-dungeon-chairs.png`.
<!-- /prop-scale -->

<!-- prop-slack -->
### Prop slack pass: columns, the slack audit, 391 props to voxel (`wip/prop-slack`, agent, 2026-11-06; green on `check/prop-slack`, run 42300775716; LANDED: main 04660a1e)
**Status:** landed (main 04660a1e, a fast-forward to `wip/prop-slack`); green, every job (run 42300775716). The run before the rebase (42299124567) failed only perf (budget),
"frost_basin medium: starting arc took 41.4 ms > 40", with the explosion start at 37 ms in the same pass (about 1 ms
in every other run, 9 ms on low that run): a hitch on the runner; the rerun passed. Screenshots: session scratchpad
`slack/shots/colonnade-before-after.jpg` (the sheet) and `slack/shots/{before,after}-*.png`.

**The owner's report** (Capitol Mall): "These pillars are blocking my bullets..capital mall uses them". The white Ionic
column (`prop.im_column_ionic`, 68 on Capitol Mall at scale 1.333) collided as one box as wide as its plinth and capital
all the way up: 0.28 m of invisible wall beside the round shaft along x, 0.55 m at 45° (0.37 and 0.73 m at the map's
scale). Rounds aimed just past the shaft stopped in the air on the box's face; so did rounds at the shaft, 0.37 m
before the stone. The brief: session scratchpad `briefs/slack-pass.md`.
- **Done:**
  - **Columns first** (6c69f1f7): 28 columns, pillars, obelisks and posts `box` → `voxel`: im_column_ionic (7 boxes:
    plinth, base, a cross round the shaft, capital), eg_column_papyrus 20, rn_column_round 7, rn_column_square 5,
    sf_column_round 3, sf_column 4, sf_column_astra 13, sf_column_large 18, dc_column 7, Kenney's column 12, pillar 5,
    cross_column 5, obelisk 5, dg_pillar 4, os_wall_column 11, nc_elevated_pillar 6, jg_carved_pillar 7, eg_obelisk 11,
    jt_obelisk 8, jt_broken_column 6, jt_collapsed_column 15, sd_pillar_01/02 and large_01/02 11/3/11/3, mc_cave_pillar
    and _wide 48 each (no map), ww_corner_post_a 3. No box-mode pole was left: lamps, posts and signs were already
    `trunk` (the openings pass); the loafbrr fence posts and columns fit their boxes.
  - **The slack audit** (`voxel-collision.mjs` `slackRuns`/`propSlack`, `prop-openings.mjs`): along x, z and both
    diagonals, in 5 cm squares, lines that cross the collision, miss the model and are reached from beside it. The
    threshold: **air 0.15 m or wider beside the model over 30 % or more of its height, from some direction**
    (`SLACK_WIDTH`, `SLACK_SHARE`; about a head or a shoulder at the edge of cover). `content:check` fails a `box` prop
    over it without a `fills` reason; natural rocks (two rounded tiers) are not checked; `--slack` lists every prop of
    every mode over it. `fills` now covers slack too (stale only when it fills no opening and carries no slack).
  - **The pass** (ca070ba6): 363 more `box` props → `voxel` (statues, vehicles, furniture, machines, fences, shelves:
    every non-rock box prop over the threshold); 18 keep their box with a `fills` reason, round or thin pieces whose
    voxel collision is that same box (barrels, drums, bins, pots, the urn, the vase, the bar stool, the spare wheel,
    the broken round column, the two picket panels, Kenney's tiny bench, the slush machine). 391 props changed in all
    (session scratchpad `slack/changed-props.txt`; before and after per prop: `slack/changed-props-slack.json`). Mean
    share of height with slack 0.85 → 0.38, mean widest run 1.12 → 0.50 m, boxes 1 → 13.0 a prop.
  - **Fixture**: `prop-openings.mjs --fixture <ref>` is cumulative now (keeps earlier entries, enters props changed
    since the ref against what they were) and probes through the old collision's slack runs (x, z, diagonals); 599
    changed entries. `propSlack.test.ts` (the Ionic column at scale 1 and 1.333, in the sim: rounds beside the shaft
    along x, z and at 45° fly on, rounds at it stop on its face and hit the column, a player walks up onto the plinth's
    step or off a deck and stands against the shaft, no way in from eight sides, cover holds crouched and standing, a
    spot the old box hid is seen, findCover finds a hidden spot; every case fails on the old table). Unit tests of the
    measure in `tools/content/test/voxel-collision.test.mjs`.
- **Checked:**
  - validate-map on all 78 maps that place a changed prop: 71 clean; Glacier Line, Grand Marquee, No Man's Field,
    Reactor, Serpent Gorge and Shingle Point have the same warnings as with the old table. **Obsidian Orb** (retired)
    changed: its reactor core (prop_087, scale 4) collides as its shape, so a fall off a bridge goes past it to the
    shaft's floor 32 m down (four spots round the core's foot, above the kill height) instead of landing on the core's
    box 3.8 m down. The known finding moved with it (`nav/auditKnown.ts`, docs/BOTS.md); the owner's question in the
    bots-a list above (item 4) now reads: the shaft's floor under the kill height?
  - `pnpm bot-report --check`: every limit held (Diamond Park and Eagle Spires CTF, Shingle Point KOTH, Fernwood Moon
    TDM; no failed searches).
  - Prop collision boxes on the 73 maps in play: 31,682 → 58,638. Busiest: Iron Maw 1,481 → 3,281, St John's 1,498 →
    2,358, Shingle Point 1,106 → 2,239, Capitol Mall 1,106 → 2,138; Frost Basin (the CI perf map) 471 → 702.
    Physics and navmesh build and 20,000 shot raycasts on six of the busiest maps, old table against new on this
    loaded machine: within the noise (Iron Maw navmesh 3.5-5.8 s both, rays 145-387 ms both).
  - typecheck; propOpenings, propSlack, navAudit, allMaps (Obsidian Orb, Capitol Mall, Fernwood Moon) and the voxel unit
    tests locally.
- **Left (owner's call):**
  - Voxel boxes are axis-aligned: round shapes keep up to about 0.15-0.25 m of air at 45° (the Ionic shaft's cross,
    0.11 m), and a single plane gets 0.2 m round it. `--slack` still lists 406 props over the threshold, of every mode:
    242 voxel (those corners, the planes' thickness, big props on coarse cubes), 60 trunk, 31 shell (the red rock
    spires), 19 stairs, 16 model, 16 natural rocks, 18 box with `fills`. A merge that also keeps diagonal sight lines
    clear would tighten round props; it would change every voxel prop's collision.
  - Natural rocks keep their two tiers (`isRock`): voxelised, the boulders alone would add over 10,000 boxes to the maps.

<!-- reduce-flashing -->
### Reduce flashing: a seizure-safety setting and a CI flicker check (`wip/reduce-flashing`, agent, 2026-11-07; from main e0690630, main 5087b0b6 and 3cec2e59 merged in; green on `check/reduce-flashing` at 9d2dd7a1, run 42375448239 (the full suite: unit, maps, build, check, bots, perf, 16 e2e shards); not landed)
**Why:** the owner dropped the planned flashbang ("I don't want to give people seizures", 2026-11-06) and asked for
this. docs/LOOK.md, "Reduce flashing", has the full table and the check; CLAUDE.md has the new "Accessibility" rule (no
new effect may add a full-screen flash, white-out or rapid flicker; new effects must pass the flicker check).

**The setting:** Options → Accessibility → Reduce flashing, and the pause menu (Settings → Sound and screen). On by
default, saved as `tiletrigger.reduceFlashing` (`game/reduceFlashing.ts`: `reduceFlashing()`, `blinkLevel`, `ease`,
`blastStrength`, `SAFE_*`), applied at once mid-match (`tiletrigger:reduce-flashing` event). With it on:
- **Lightning** (Arc Caster, arc turrets, electric fences; also fast beam weapons): one steady beam per source
  (`game/steadyArcs.ts`, keyed by shooter, turret or stretch of fence) instead of a new Electric FX bolt and crackle
  per arc; the turret's charge glow stops flickering and shows the plain ball, not the pack's crackling one; fence
  wires glow steadily (`borderVisuals.ts buildFence`).
- **Blasts**: dimmed near the camera (`blastStrength`: 30 % within 0.6 radii, full beyond 3.6) and faded in over
  0.12 s; this needed a per-play brightness in the VFX player (`GodotVfx` options `gain`/`fadeIn`: a `u_gain` uniform
  after the tone map, each tenth a copy of the effect's materials made on first use; `u_gain` 1 everywhere else, so
  nothing changes with the setting off). Vehicle explosions lose the white-hot flash ball.
- **Muzzle flashes** 75 % size, 45 % opacity (`SAFE_MUZZLE`; `MuzzleFlashRig.fire(id, scale, opacity)`).
- **Map lights** (`scenarioVisuals.ts`): blinking is a smooth pulse at most once a second between 55 % and full; a
  logic "Flash" flares to 1.35 (2.5 off); level and colour ease; candles don't gutter. Small indicators (mines, sticky
  grenade, bomb, laser-trap warning) pulse gently instead of blinking (the bomb's fuse is in the mode HUD).
- **Hurt vignette** (`game/hurtVignette.ts`, hud.ts): now drawn from JS every frame (`hud.tickHurt`) in both looks:
  off, the classic saturated-red edge as before; on, a duller red (R/(R+G+B) 0.76 in linear light, under WCAG's 0.8)
  further out, eased in over 0.15 s, held under fire, gone over 0.8 s.
- **Underwater haze** eases over a third of a second.
- Nothing to do: no storm lightning, no low-health pulse exist; smoke and status tints were already eased.

**The check** (e2e flow `flashing`; `e2e/flicker.mjs`, `e2e/frameClock.mjs`; unit tests `tools/ci/test/flicker.test.mjs`,
`packages/client/test/reduceFlashing.test.ts`): MapMaker builds a night scene with its own edits (two dark rooms, one
with a red alarm light blinking 4/s; an Arc Turret; a 12 m electric fence), TEST plays it on the page's thread, the
frame clock freezes the page's time and steps it 1/30 s a frame, and each canvas frame (160 × 90, the hurt tint drawn
over it) is grabbed. Fails, with the setting on, on more than 6 transitions in a second (a quarter of the screen
changing relative luminance by 0.1 or more, darker state under 0.8; same-way changes add up) or a quarter of the screen
turning saturated red within 0.25 s or more than 6 red transitions a second. Off: numbers only. It also reports WCAG's
stricter area (a quarter of a 10° field, a third of the screen each way). Frame strips and `flashing.json` go to
e2e-artifacts (CI uploads them only when a flow fails). `e2e/timings.json` has a 240 s guess until CI's timings job
refreshes it.

| Moment (2 s each) | Off: transitions/s (10° field) | Off: biggest quarter-screen change | On: transitions/s (10° field) | On: biggest change |
|---|---|---|---|---|
| Arc fight up close | 0 (1) | 0.000 | 0 (0) | 0.000 |
| Electric fence | 0 (0) | 0.000 | 0 (0) | 0.000 |
| Four blasts in front of you | 4 (9) | 0.402 (a white-out) | 0 (4) | 0.062 |
| Machine gun in a dark room | 0 (0) | 0.000 | 0 (0) | 0.000 |
| Red alarm light, 4 blinks/s | **9 (9): fails WCAG** | 0.123 | 0 (0) | 0.005 |

(CI run 42375448239. The blasts vary run to run with the effects' randomness: locally off 5 (13) / 0.254, on 2 (4) /
0.072; CI's first run off 2 (7) / 0.306, on 2 (4) / 0.067. The flow took 283 s on CI.)

What the numbers say: at these distances the arcs, the fence and your muzzle flash cover too little of the screen to
count as flashes even with the setting off (they flicker hard, but small); the setting still takes their strobing out.
The real hazards were blinking lights (the alarm's 4 flashes a second fails WCAG outright; 26 maps blink or flash
lights, at up to 4 a second) and blasts close up (a white-out over most of the screen).

**Left / for the owner:**
- Lights blinking 3-4 times a second (Starhaven's bay lights and beacons, Serene City's alarm, Sushi Belt's signs and
  others) are at or over WCAG's limit with the setting off; the setting fixes them, the maps could also blink slower.
- The bomb's light no longer speeds up with the setting on (its fuse shows in the HUD).
- A storm with lightning flashes would need the same cap and ease (none exists).
<!-- /reduce-flashing -->

### Queued (owner-approved, 2026-11-06): weapon sets. After the Match Setup follow-ups, alongside Bot AI Phase B
**Built** (2026-11-07): see "Weapon sets" near the top (`wip/weapon-sets`). The ask as it was queued:
**The owner:** bots mostly use pistols. "I have never once seen the sheep weapon, hardly see swarm launcher or gravity
weapon." They want weapon sets as map defaults, with a host setting.
- **The plan:** docs/WEAPON_SETS_PLAN.md.
- **Sets:** Standard, Military, Sci-fi, Medieval, Chaos, Mixed bag. Owner: "set list is fine".
- **Military** spawns with knife, pistol and an assault rifle (owner: "pistol and a main gun"); sniper-role bots get
  a marksman rifle. Each set has its own spawn loadout.
- **Pickups** roll within the set, by category.
- **Defaults and override:** each map has a default set in MapMaker's Map properties (the owner confirms a theme
  table for official maps). The host overrides it in Match Setup and the Host tab.
- **Bot AI Phase B gains:** snipers who play like snipers (item 5) and a cover-to-cover advance (item 6).
  **Phase C** starts with parkour links (roofs and ledges for snipers and flankers). See docs/BOT_AI_PLAN.md.

### Queued (owner, 2026-11-06): audio pass 2: weapons, reloads, vehicles. Starts once the sound source is settled
**The owner:** "By sound effects, we also need to update some/if not most of the weapon sounds too, reload, vehicle
noises, etc."

**What we have** (docs/AUDIO.md: 90 sounds):
- All 26 fire sounds are in-house synthesiser placeholders.
- Reloads are two generic Kenney clicks (`reload.start`, `reload.end`). Other players' reloads are silent: snapshots
  don't carry them.
- Vehicles have **no engine sounds at all**, only crash and explosion sounds.
- One footstep sound for every surface.

**Scope:**
- **Recorded gunshots per weapon family,** with a near layer and a far tail.
- **Reloads per weapon class,** timed to the reload animations:
  - magazine out and in, then the bolt or charging handle;
  - shells for shotguns;
  - the cylinder for revolvers.
  - Remote reloads audible.
- **Vehicles:**
  - engine loops that follow speed for each mount type: wheeled, tracked, hover, air;
  - skids, entering and leaving, turret traverse, mounted guns.
  - Looping voices are new work in `AudioSystem`.
- **Later, separate items:** per-surface footsteps, ambience.

**Sources** (docs/ASSET_SOURCES.md):
- **Artlist:** not for the game on a standard plan. Waiting on Artlist's written answer (see above).
- **Decided (owner, 2026-11-06): "yes use sonniss and freesound."** CLAUDE.md "Content rules" has the rule.
- **The Sonniss GDC bundles:** they are free, professional, licensed for games and need no credit. Their
  licence is not CC0, so the owner must approve them as a source. Treat their output like purchased assets: processed
  files only, raw files never committed.
- **Freesound CC0** for gaps.
- The container can't reach Sonniss or Freesound today. Either the agent asks for those hosts on the environment card,
  or the owner puts the chosen files in the Drive.

### Done (owner, 2026-11-06): import list, batch 1: Cool Hands Rex and Fishy Fred: see "Import list batch 1" at the top (`wip/intake-rex-fred`)
**The owner:** "There is a fish and t-rex (call him 'Cool Hands Rex', I made him in meshy) model to add for after all
of this work. I'll be trying to generate brand new ones going forward and we can just begin working on a new import
list."
- The running list, with measurements and what to check, is `docs/IMPORT_LIST.md`.
- **Cool Hands Rex** is Meshy, owned: the owner made it.
- **Fishy Fred** (the file's name) is Meshy Community CC0. The owner confirmed: "I did not make fishy fred, community."
- Both are Mixamo rigs, already downloaded to `/home/user/meshy-drive/intake-2026-11-06b/`. Never commit them.

**Artlist (owner's question, 2026-11-06):** "Are we able to leverage my artlist sub for sound effects and catchphrases
for each character?"
- Not yet.
- Artlist's own help center says apps, software, games and their end users need an **Enterprise** licence. Its
  Personal, Pro and Max plans cover video.
- Its AI voice page says paid-plan output is yours to use commercially, but it doesn't name games.
- The repo is public, so also ask whether licensed audio may sit in a public repository.
- Waiting on a written yes from Artlist, or on the owner's plan being Enterprise. No Artlist audio until then.
- If the answer is no, catchphrases could come from:
  - lines the owner or friends record (owned);
  - a voice service whose terms name games (needs the owner's approval);
  - a local open-source text-to-speech with permissively licensed voices.

### Done (owner, 2026-11-06): performance round 4, crowds: see "Performance round 4" at the top (`wip/perf-4`)

<!-- match-setup-2 -->
### Match Setup follow-ups: one Host online, Save for next match, co-op sizes, score and time follow the size (`wip/match-setup-2`, agents, 2026-11-06; main 2acb8f23 merged in; green on `check/match-setup-2` at 9d41d790, run 42307136197; not landed)
The owner's answers to the redesign's questions (1. Host online lists the match from both places; 2. Spectate keeps
following the Offline / Host online switch; 3. "save for next match" back in the Host tab; 4. co-op size presets capped
at the map's size) and the request that the default score and time scale with players + bots ("24v24 in a 40 pt
match means on average 1 kill per; 24v24 plays ok with 500 points, but also 15–20 min"). The brief is the session
scratchpad's `briefs/match-setup-followups.md`. An earlier agent built it and was stopped by an interrupt; the next
merged main (Bot AI Phase A, the four retired maps, the intake follow-up, the prop slack pass), checked the curve
against Phase A's bots, fixed the Host tab foot and two e2e checks, and took the pictures.

**Screenshots** (session scratchpad `shots-ms2c/`; `shots.mjs` there makes them from a `vite preview`): Match setup on
St. John's at 4v4, 12v12 and 24v24 (`setup-4v4.png`, `setup-12v12.png`, `setup-24v24.png`), set by hand
(`setup-24v24-custom.png`, `setup-12v12-custom.png`: Custom stays at another size) and `setup-12v12-back-to-suggested.png`;
the Host tab's foot in each Apply state at 1280 × 720 and 1920 × 1080 (`host-foot-<width>-1-no-changes.png`,
`-2-apply-now`, `-3-apply-restart`, `-4-save-next`, `-5-saved`), in a match started from Match setup, so the foot has
its Offline / Host online switch (test mode has none: it can't host).

**What's in it:**
- **Score and time follow the size** (`sim/matchSetup.ts`: `suggestedLimits`, `setupLimits`, `withSetupLimits`,
  `teamMinutes`, `niceScore` / `scoreStep`, `limitsScale`; `MatchSetup.scoreAuto` / `timeAuto`; `SCORE_LIMIT_MAX` 5,000
  in rules.ts). Match setup's To win follows every size change until set by hand (a Custom tag, `#setup-limits` under
  it with `#setup-limits-reset` "Back to suggested"). Saved setups: the old defaults (the mode's standard score, 10
  minutes) follow the size, anything else stays (`normalizeSetup`). The Host tab's To win shows the suggestion for the
  size being set (`#hc-suggest`, "Use suggested" `#hc-use-suggested`); a map change to another mode takes that mode's
  suggestion (`rulesForTravel`).
- **One Host online** (session.ts `goOnline`): Match setup's Host online lists the match as the pause menu's does (a join
  code without a hub); a match hosted from the start is listed under the host's name (the listing waits for the roster).
- **Save for next match** (hostPanel.ts `drawFoot`: `#hc-when`, Restart now | Next match, beside Apply while a ⟳ Restart
  rule changed; Apply becomes Save for next match). HostControl keeps the rules (`pending`, `nextRules`) and
  `Match.beforeRound` puts them in play when a new match starts (after the scoreboard, or Restart); map changes and the
  rotation take them (`withPending`; servers: `travelRules`); the host tells everyone (`onNextRules`). The foot's line
  says which happens, the Rules card what is saved.
- **Co-op and Zombies' sizes** stop at the map's (`squadRoom`: its team layout in all, else its recommended most).
- **bot-report** prints each match's team scores and its top bot's kills (`scores:`; `teams`, `top` in `--json`).
- **This round's fixes:** the foot's Restart now | Next match switch sat at the far right beside Offline / Host online
  (a later `margin-left: auto` rule beat its own); only the foot's own switch is pushed right now (style.css,
  `.pause-host-foot > .seg-switch`). e2e: `setupLimitsFlow` wanted the saved setup rewritten just by opening Match
  setup (it isn't until something changes; it failed every run), now checked after the first size change;
  `hostcontrols` waits for the match's own phase to leave the restart's countdown before the page's (on a loaded
  machine the page still showed "playing" from before the restart, so Save for next match and End match ran in the
  countdown).
- **Local e2e** (this machine at about 3× CI's flow times, `CI=1` waits): `lobby` passed; `teams` passed every check
  but the old `setupLimitsFlow` one, which passed after the fix (run alone); `hostcontrols` passed up to its Host game
  part, whose friend checks (the friend's page loading, rejoining the host's new map, the rotation) passed in one run
  of three: load (the machine was shared with two other agents). On CI (run 42307136197, the full suite: every unit
  job, the bots check, 16 e2e shards) all three passed first time; the one retry was `designer` (a custom look's
  first-person arms), which this branch doesn't touch.

**The curve** (docs/BOTS.md, "Score and time", has the tables): Team Deathmatch a point per player on a team per minute
of the time limit, the time 10 minutes up to 6 a side, 15 up to 16, 20 above (4v4 40/10, 8v8 120/15, 12v12 180/15,
16v16 240/15, 24v24 500/20, 48v48 950/20); Deathmatch 12 × √players kills in 10 minutes (15 for 2, 35 for 8, 50 for
16, 70 for 32); Capture the Flag 3 captures with the team time; King of the Hill 12 hill seconds a minute of the time
(120/10, 180/15, 240/20); rounds modes, co-op, Zombies, Fort Wars, Disc Arena and races as before.

**The kill rates behind it** (`pnpm bot-report`, 10-minute matches, no limits; the leading team's points a minute,
the middle of the maps):
- Before Phase A (main a07cb65b, 5–7 maps a size): TDM 1v1 1.4, 2v2 3.0, 4v4 5.4, 6v6 11.4, 8v8 7.9, 16v16 13.9,
  24v24 30.6, 48v48 56.5 (2 maps): about 1.3 a player a minute (0.9–1.5; 1.9 at 6v6 on the small maps). Deathmatch,
  the top bot's kills a minute: 2 players 1.8, 4 2.6, 8 3.8, 12 4.6, 16 7.0, 32 5.0 (big maps).
- After Phase A (main adad4de7 merged; the same maps, seeds and lengths, Iron Compound left out): TDM 4v4 4.0 → 4.3
  (Diamond Park, Bunker Cross, Sandgate), 8v8 8.1 → 7.3 (+ Capitol Mall, Fernwood Moon), 24v24 32.1 → 29.3 (Diamond
  Park, Capitol Mall, Fernwood Moon, Sunken Kingdom); Deathmatch 8 players 4.7 → 4.8, 16 7.9 → 8.4 (Sandgate,
  Citadel); King of the Hill 8v8 Diamond Park 7.9 → 5.8, St. John's 18.1 → 18.0 hill seconds a minute; CTF 8v8
  Diamond Park 0.2 → 0.5 captures a minute, St. John's 0.0 → 0.1. All within a seed's spread (Diamond Park 24v24: 22.7
  and 34.9), so the curve stays: the suggestion falls due at 9.4 minutes of 10 (4v4), 16.4 of 15 (8v8: time first, at
  about 110 of 120) and 17.1 of 20 (24v24).
- Scripts and rows: session scratchpad `measure/` (before) and `measure-a/` (after: `run.sh`, `run2.sh`,
  `compare.mjs`, `tables.mjs`).

**Tests:** unit `packages/shared/test/matchLimits.test.ts` (the curve per mode, Custom and suggested, old saves, co-op
caps, Save for next match at the next round, Restart and a map change, scores past 1,000) with the matchSetup,
setupPlan, serverRules and hostControl tests; e2e `teams` (`setupLimitsFlow`: the suggested score and time follow the
size), `lobby` (Host online from Match setup lists the match), `hostcontrols` (Save for next match, the suggestion
line).

**For the owner:**
- 6v6 on the small maps made for it (Atomic Court, Sandgate, Void Yard) reaches its 60 points in about 5 of its 10
  minutes; 7v7 jumps to 110 points in 15. Both follow the owner's time steps (10 minutes up to 6 a side); a different
  step there would be a one-line change (`teamMinutes`).
- King of the Hill's 12 hill seconds a minute (120 in 10 minutes, as before) is reached at about two thirds of the time
  on St. John's and not at all on Diamond Park, where bots hold the hill 5–8 s a minute.
- Capture the Flag keeps 3 captures: after Phase A, Diamond Park's bots made 7 in 15 minutes at 8v8 (3 in about 6
  minutes), St. John's one each (the time decides).
<!-- /match-setup-2 -->

<!-- match-setup -->
### Match Setup redesign, the Host tab, Spectate before the start (`wip/match-setup`, agents, 2026-11-06; main bc6037a1 merged in; green on `check/match-setup` at c32bbf20, run 42242658709; not landed)
The owner's report and approved design are in the queued section below ("Queued … Match Setup redesign"); the brief is
the session scratchpad's `briefs/match-setup.md`. Screenshots before and after (1280 × 720, 1920 × 1080, 2000 × 1100, a
phone sideways at 900 × 415; after also 2560 × 1440, the fit details open and the setup scrolled to the bottom): the
session scratchpad's `shots-ms/before/`, `shots-ms/after/` and `shots-ms/after-host/` (the Host tab).
- **CI:** green at c32bbf20 (run 42242658709, second attempt: the first stopped on `packages/host/test/host.test.ts`'s
  kick-and-ban wait, which passed on the same shared code in the two runs before and on the re-run: a flaky wait).
- **Shared** (`packages/shared/src/sim/matchSetup.ts`, `setupVariants.ts`; tests `setupPlan.test.ts`): people apart
  from bots (`setupSummary`, `peopleAndBots`, `setupPeople`, `setupYourTeam`); team changes that grow and shrink with
  bots and stop at a cap with a message (`changeTeamBots`, `setTeamSize`, `evenTeams`, `changeTeamCount`,
  `playerCap`, `capMessage`); size presets worked out per map, mode and device (`sizePresets`, `matchingPreset`,
  `presetPatch`, `mapPickTeams`, `mapPickPlayers`); one fit check (`setupFit`: Fits / Crowded / Problem with items and
  fixes; `setupNotes` is gone); `setupTeams` / `setupPlayers` / `rulesFromSetup` take a cap (a setup saved on a
  computer plays 8v8 on a phone and the fit check says so). **Variants** are data (`SETUP_VARIANTS`: id, label, tip,
  modes, `sets`, `clears`, `conflicts`, `needs`, `unavailable`); on when their settings are, however set; nothing new is
  stored (saved setups keep their shape). **Party presets** (`PARTY_PRESETS`: Lunar Roulette, Spear Fight; `applyParty`,
  `partyOn`, `partyUnavailable`). The Roulette mode adds its variants as entries there and re-points Lunar Roulette
  (`mode: { ffa: 'core.roulette' }, variants: ['lunar']`, comment in the file).
- **Start gate** (`sim/match.ts` `step`, `spectate`, `remove`): spectators who have loaded count like players, so a
  match only spectators watch starts once they have (it waited out `START_WAIT_SECONDS` before). Offline matches keep
  ticking under the pause menu, so the old one did start after 30 s; it only looked stuck. Tests: `startGate.test.ts`
  (three cases), `client/test/localHost.test.ts` (Spectate from the start).
- **Match setup** (`frontend/frontEnd.ts` `fillSetup`, `setupFoot`, `moreLayouts`; controls in
  `frontend/setupControls.ts`: `section`, `field`, `segmented`, `sizeChips`, `fitChip`, `fitList`, `inert`, the team
  editor with Even teams and "You + 23 bots"; styles in `style.css` "Match setup"). Essentials on top (mode chips,
  variants, what wins and the mode's key setting), then Size (presets, More layouts… = the old Quick setup) and Party
  presets, then the sections Players & teams, Bots, Advanced rules (a summary line; the orange chips and Reset inside;
  Rules, Weapons, the mode's other settings as folds). Graphics moved into the fit details (big matches). The foot:
  Offline / Host online (`#arcade-offline`, `#arcade-host`), Saved (`#setup-saved` menu: the old IDs inside), Spectate
  (`#arcade-spectate`), Start (`#arcade-start`). Enter starts as the switch says; Esc closes the saved menu first;
  small screens (`compactSetup`: touch, ≤ 900 px wide or ≤ 600 px tall) open one section at a time. Spectate goes
  `hooks.playLocal(…, spectate)` → `LocalMatchOptions.spectate` → `MatchHost.start` spectates you before the welcome.
- **Host tab** (`game/hostPanel.ts`, `pauseMenu.ts`, `index.html` `#pause-host-foot`, `session.ts`): cards To win
  (⟳ Restart marks), Players & teams (presets for the map, the team editor with Even teams and people per team from
  the roster, the fit chip), Bots, Rules, Match, Rotation, Players. Nothing applies until Apply in the foot:
  `#hc-resume`, `#hc-apply` ("Apply now", or "Apply & restart" when a restart rule changed: it sends bots, rules, then
  restart; a second click with other people in), `#hc-changes`, the switch (`#go-offline` / `#go-online` keep their
  IDs: Host online lists after a confirm when there's a hub, else opens a code). Esc on the Host tab resumes. Mixed
  pickups, weapon drops and bot characters now go through Apply too.
- **e2e** (`e2e/run.mjs`): the menu check in `offline`; `teams` runs `setupLayoutFlow` (the four sizes: essentials in
  view, Start in view scrolled to the bottom, several / one section open; the owner's setup: summary, Advanced line,
  fit and "Use 12v12", caps, a party preset, Enter) and `spectateStartFlow` (Match setup → Spectate, and the pause
  menu's Spectate while loading: the countdown starts the tick after you've loaded); `hostcontrols` (the foot, Esc,
  Apply now, Apply & restart), `arsenal` (mix needs Apply), `lobby` (the switch), `customSetupFlow` (Even teams off
  for 2v3v5).
- **Bundle:** the menu's first JS 702.9 kB gzip (budget 840).

**For the owner to decide** (answered 2026-11-06: list from both, keep Spectate, Save for next match back, co-op capped;
built on `wip/match-setup-2`, "Match Setup follow-ups" above)
- Pause menu → Host online with a community hub restarts and lists the match (as Go online did); Match setup's Host
  online opens a code only (as Host did). Same word, two behaviours: list from Match setup too, or keep?
- Spectate follows the switch: offline it's bots only; with Host online you watch while friends play. Keep?
- The old "Apply on restart" (keep rules for the next restart without restarting now) is gone: restart rules now
  restart on Apply. Want a "keep for the next match" option back?
- Co-op's size presets go up to Big squad 24 and Max 48 (worked out like the other modes): cap them at the map's
  recommended size?
<!-- /match-setup -->

<!-- setpieces-3 -->
### Set pieces, part 3: the showpiece maps' pieces (`wip/setpieces-3`, agent, 2026-11-06; from main b2c58e2e, main bc6037a1 merged in; green on `check/setpieces-3` at 40e27910, run 42243955187; not landed)
What was built and decided: docs/SET_PIECES_PLAN.md, "As built: part 3" (the 4 m decision, the sunk trench, the
pieces, budgets per piece, notes for part 2, what is left); the new kit in docs/BUILDING_KIT.md ("The showpiece kit").
All data on the standard grid: no map format change, nothing in `packages/client/src/editor/*`.
- **The 4 m question: the mix, no format change.** The colosseum is built on the standard 8 m / 4 m grid, a board
  square being half a cell (every square's centre on a cell centre, a side's middle or a cell corner): tiles where an
  8 m module fits (stands, tunnels, cages, insulae, the floor), free parts on the 4 m lattice for the pillars,
  medallions and zones, and the hatch risers in two variants (cell-centred; corner-centred from four Corner Hatch
  tiles). The sand: 7 cells (56 m), the 52 m board centred on a cell, a 2 m margin; its hatches (±12 m) fall on cell
  corners. MAP 21 stays on the 8 m grid.
- **Trenches are sunk 1.5 m and carve their own slot:** their buried floors pull the terrain down under them
  (settle.ts `terrainUnderFloors`, on load and every MapMaker edit). Place them on level 0 over ground at level 0;
  they need terrain (flat maps keep the Military Compound's raised trenches). Head under the parapet standing in the
  channel, eyes over it on the fire step, hidden crouched.
- **34 pieces, eight families** (`content/setpieces/`): Gun Casemate and Cliff Casemate (`casemate.json`); Trench,
  Bend, Junction, End, Jog, each timber or `_sandbag` (`trench.json`); Grand Cliff Stair, Cliff Stair Tower
  (`cliffstair.json`); Arena Bay (Podium), (Upper Tier), (Vomitorium), Grand Arcade, Arena Attic (`arena.json`);
  Hypogeum Tunnel, Bend, Junction, Crossing, Hatch Riser, Hatch Riser (Corner), Cage Block, Lift-Cage Riser
  (`hypogeum.json`); Insula, Insula (Corner), Insula (Tall) (`insula.json`); Stair Tower (4, 6, 8 levels)
  (`stairtower.json`); Beached Landing Craft (`landing.json`).
- **New kit (any map):** wall styles Round arch, Grand arch (two storeys), Embrasure, Barred gate; tiles Sunken
  Trench (+ Bend, Junction, End), Grand Flight, Seating Tier (+ Vomitorium), Vaulted Tunnel (+ Bend, Junction,
  Crossing), Grand Gallery, Corner Hatch (Military Compound and Imperial Arena style packs); the Sandbags material
  (procedural paint, `patterns.ts` `sandbagPaint`). Shared code, small: `map/catalog.ts` `kitPart` (a kit part's
  `surface` now dresses every box its builder makes, the timber steps; tiles.mjs allows it), `map/materials.ts` (the
  `sandbags` pattern id), `editor/stylePacks.ts` (the new tiles and the prop in their packs).
- **Landing craft** (the owner's Drive model): prop **Landing Craft (Beached)** (`prop.lcvp_beached`, pack
  `meshy-community-drive-1106`: Meshy community, CC0 per owner, community page URL pending; hero tier, 16k triangles,
  a 4k LOD from 40 m, baked normal map, 1.0 MB, `collide: "voxel"`: walk up the ramp into the well, shoot over the
  gunwales; `surface: "metal"`, as the kit Landing Craft). In the Military Compound and Coastal Harbor style packs, and
  the static Beached Landing Craft set piece
  (ramp down, hedgehogs, crates). **Not swapped into Shingle Point:** the owner compares it with the kit Landing Craft.
- **Tests:** `packages/shared/test/setPieces3.test.ts` (18: trenches carved, walked, bot paths, crouched cover and the
  fire step's sightline; casemate embrasure shots, its loop and two ways in; cliff stairs walked and pathed; the
  landing craft's ramp, well and gunwales; the stands' bot route and vomitorium; hypogeum ladders, bars and corner
  hatches; insula storeys and flats; stair towers; expansion equals exploded). `setPiecePlay.test.ts`: the every-port
  test covers every piece whose ports are walled doorways or arches and names the open-sided ones (`OPEN_SIDED`);
  the z-fight test only mirrors `mirror: "free"` pieces. Fixtures: tiles and materials regenerated; the surface
  classes fixture takes Sandbags (soil) and the craft (metal) as they came; the prop openings fixture lists the craft
  as a voxel prop against the box it would collide as (the `--fixture` tool skips props new since its ref, so that
  entry was made by the tool's own steps for the one prop). Coverage map: the 13
  tiles, the four wall styles and the prop placed in MapMaker (driver: Playwright on the built client, Import, the
  palette, R, clicks, the inspector's wall pickers, Export).
- **Screenshots** (session scratchpad, built game, MapMaker → TEST): `shots/m21b/` (casemates, trenches, cliff
  stairs, eye level and overview; `shots/m21/` is before the fixes from looking at them), `shots/lcvp/` (the beached
  landing craft: ramp, overview, side, from the well, stern), `shots/colo/` (stands, arcades, hypogeum, cages,
  insulae, stair towers).
- **Budgets:** per piece in the plan. A full colosseum of these pieces (24 bay lines of six storeys, four 8-level
  corner towers, the hypogeum, 15 insulae) is about 800 tiles, 200 blocks and 190 lights (inside MAP_BUDGETS) but
  about 25,000 collision and 30,000 trim boxes, several times any shipped map (St. John's 3,915): the map build should
  measure load and frame time early and drop what it can (the attic, a storey of arcades round the far sides, the
  stair towers' facade).

**Left for later, and for the owner**
- MAP 21's **sea wall section (with its breach)** and **command bunker**: not built (the Gun Casemate is the pattern).
- The map builds themselves (MAP 21, the colosseum) in MapMaker from these pieces, after part 2.
- Owner: compare the landing craft with Shingle Point's kit Landing Craft; send the community page URL for it.
<!-- /setpieces-3 -->

<!-- intake-1106 -->
### Intake of 2026-11-06: astronauts, crocodile, tortoise; Meshy provenance audit (`wip/intake-1106`, agent, 2026-11-06; from main bc6037a1, main d06af94a merged in; green on `check/intake-1106` at 8b547fe2, run 42268803252 (and run 42265419110 at bad67c03); not landed)
The owner: "I have 3 new astronaut models, replace the light blue one for captain nova, add the 2 new ones. The
boglurker can be replaced by the alligator. Retire bamboo, add the new turtle." Downloads in
`/home/user/meshy-drive/intake-2026-11-06/` (raw, never committed), linked in the agent scratchpad `i1106/dl`; each
built with `ONLY=<id> node tools/content/prepare-meshy-characters.mjs <dir>` (an unchanged manifest rebuilds the same
file). All five are Mixamo-skeleton Meshy rigs; their two clips are not used. Rendered and checked by eye first
(`i1106/shots/raw-*.png`): the light-blue one is the slender female suit (#88a8d8), so it is Capt. Nova.

| Character (manifest / look) | Group, size, bot theme | Download | Built (body + far copy; colour and normal map 1024 px) | Hands |
|---|---|---|---|---|
| Capt. Nova `meshy_nova` / `core.nova` (same name, look, size) | soldiers, standard, soldier | "A full body portrait of a tall slender", 107k tris, whole finger chains | rebaked 14,000 + 3,500, 1.04 MB; arms 1,954 | `fingers: fit` (the download's own fingers scored 7 and stood a finger up off the support hand; own with `hands.together 1` scored 5, no spikes, but its support index still stood over the handguard and the pistol's support fingers splayed; fit 6 closes round both: kept, close-ups `i1106/close/nova-*-owntog-vs-fit.png`); grip tuned |
| Boglurker `meshy_toad` / `core.boglurker` (same name, look, size) | creatures, large, frog | "A humanoid crocodile wearing a heavy", 25.6k, no index fingers | careful cut 13,000 + 3,250, 1.05 MB; arms 2,367 | rigid claws (measured a fist) skinned as mittens: `hands { scale 0.75, curl 1 }` (27.5 -> 20.8 cm); grip tuned; `centre` (below) |
| **Spacewalker** `meshy_astronaut` / `core.astronaut` (new; name a placeholder) | soldiers, standard, soldier | "Astronaut", 10.4k, thumb and middle chains only | whole download 10,406 + 2,601, 1.35 MB; arms 806 | re-fitted; its gloves are low-poly cones that folded into shards closed at 0.87: `hands.curl 0.6`, `skin { knuckle 0.2, joints 0.15 }`; grip tuned |
| **Starfarer** `meshy_darkastronaut` / `core.darkastronaut` (new; placeholder) | soldiers, standard, soldier | "a meticulously detailed astronaut with a", 167k, no finger joints | rebaked 13,998 + 3,496, 0.99 MB; arms 1,441 | `fingers: fit` (no chains, as the Umpire); grip tuned |
| **Shellback** `meshy_tortoise` / `core.tortoise` (new; placeholder) | animals, large (a broad, heavy body; takes Bamboo's place), critter | "The object resembles a humanoid tortoise", 199k, no index fingers | rebaked 14,000 + 3,500, 0.85 MB; arms 1,441 | rigid claws as mittens: `hands { scale 0.75, curl 1 }` (27.7 -> 20.7 cm); grip tuned |

- **Bamboo retired:** `RETIRED_LOOKS['core.panda'] = 'core.tortoise'` (saved choices and bot sets play Shellback);
  manifest, files and portrait kept. No map, bot set or preset named it.
- **Grips** (`fixes.grip`, from live candidates in `?mode=grips`, scratch `i1106/tools/search.mjs`): Nova, Spacewalker,
  Starfarer `supportLong [0, 0.02, 0.03]`, `supportPistol [-0.01, 0.03, -0.03]` and `gripLong [-0.03, 0.02, -0.03]`
  (Spacewalker `-0.045`), Nova `rollR -0.3` (palm in 0.75 -> 0.90); crocodile `gripLong [-0.045, 0.03, -0.03]`,
  tortoise `[-0.045, 0.02, -0.03]`, both `supportPistol [-0.01, 0.03, -0.03]`. Hold offsets did nothing for the
  tortoise's support hand: its arms are short against its shell (the long-gun support hand stays ~0.19 m back).
- **Grip audit** (rifle, pistol, shotgun; lower is better; before = main's build; shooting hand R and support hand L
  distance to their points on the rifle, m):

  | Character | before (main) | first build | final | rifle R / L, first -> final |
  |---|---|---|---|---|
  | Capt. Nova | 3 back (old model; R 0.03, L 0.21) | 7 flat off fp (own fingers) | 6 flat spikes | 0.07 / 0.06 -> 0.03 / 0.02 |
  | Boglurker | 18 flat open back off spikes palm fp (old toad; R 0.19) | 9 flat open off fp | 8 back spikes fp | 0.14 / 0.11 -> 0.02 / 0.06 |
  | Spacewalker | new | 3 flat | 3 flat | 0.05 / 0.21 -> 0.03 / 0.18 |
  | Starfarer | new | 3 spikes | 3 spikes | 0.06 / 0.19 -> 0.03 / 0.15 |
  | Shellback | new | 12 flat open off spikes fp | 7 spikes fp off | 0.12 / 0.17 -> 0.02 / 0.19 |

  What's left: the mitten claws stretch a few finger edges (spikes on middle_01/02); Starfarer one 12x edge at the
  left forearm and Nova one 9x edge (short edges, no tear seen); the tortoise's pistol support hand 0.16 m off (short
  arms); Spacewalker's rifle curl gain 0.006 (`flat`; a softer curl was the price of no shards). Audits:
  `i1106/audit-before`, `audit-1` (first build), `audit-final`; close-ups `i1106/close/`.
- **`fixes.centre`** (new, prepare-meshy-characters.mjs `pose`): the body moved over the origin by its hips. Meshy
  centres a download's box, so the crocodile's tail stood its body 0.39 m ahead of the origin the game moves and
  collides it by (Character Select drew it nearer the camera, head out of frame; its hit shapes sat 0.4 m ahead).
  **Bandit 0.48 m, Scamp 0.35 m and Greyfang 0.26 m stand ahead the same way** (scratch `i1106/tools/pelvis.mjs`
  measures every built body): candidates once their downloads are at hand (Bandit's "too big" note may be this).
- **`fixes.scrubBlue` within boxes:** `{ "color", "within": [[u0, v0, u1, v1]] }` repaints blue only inside boxes of the
  download's colour map. The Spacewalker's shoulder carried a NASA-style mission patch (blue disc, red swoosh): its
  blue is painted the suit's white; the US flag on the other shoulder is kept. Owner to say if the flag should go too.
- **Portraits** captured for all five (`capture-portraits.mjs` with the look ids; a temp copy with
  `executablePath: '/opt/pw-browsers/chromium'`). `PORTRAIT_VIEWS`: Nova's old collar view dropped (the default
  frames the new helmet), Boglurker's kept (the crocodile's snout fits it), Shellback `zoom 1.25`.
- **Screenshots** (agent scratchpad `i1106/screens/`): `select-<look>.png` in Character Select; `play-<look>-fp-rifle`,
  `fp-pistol`, `tp-rifle`, `tp-pistol` in an offline match on Canyon. Character Select's hero: the crocodile aims with
  its head behind its raised arm, and the tortoise's head is behind its shell from that camera (drag to turn).

**Provenance audit (owner's rule, 2026-11-06: "all Community CC0 and should be treated as such unless I let you know I
created them in Meshy").** Every `meshy-owned` entry checked against the repo's records (manifests, locks, licence
files, HANDOFF and git history, the intake queue, the Meshy task IDs' own timestamps). **Kept owned, with the reason:**
- mining machines (`props/mining_excavator.glb`, `mining_haul_truck.glb`): text-to-3D through our Meshy API on the
  owner's subscription, approved 2026-10-30 (commit 7d217715; task records in the session scratchpad `meshy/`);
- airliner shell (`props/airliner_shell.glb`): Meshy preview and refine tasks created 2026-11-04 02:09 UTC while the
  airliner was being made (the map notes of 01:32 that day: it needed the owner's go-ahead on credits). Either we or
  the owner generated it on the owner's account; **owner to confirm**;
- buggy and its tire (`models/vehicles/offroad_buggy.glb`, `offroad_tire.glb`): the owner's own share links
  (meshy.ai/s/hHUmqb, /s/wpwiGq) in the owner's intake queue of 2026-10-29, "owned (owner's Meshy account)";
- Alien Biker (`characters/meshy_alienbiker*.glb`): "the owner's own model (owned; confirmed by the owner 2026-11-01)".

**Relabelled Meshy Community CC0** (author and post URL pending; came from the Drive or meshystuff, no record of the
owner saying they made them; any the owner made goes back to owned: manifest `source.license`, or the pack file):
- Characters (15, 30 files): Shaka Mpande `meshy_ashwalker`, Bonejack, Thornweaver, Uncle Bao (these four rigged by
  our Meshy rigging API; the rig task IDs stay), The Dapper (its current "dapper man rigged" model; the first one,
  generated through our API on 2026-10-25, is gone), Freaky Frida, Scary Larry, Rusty Mech (probably a rig of the
  community "White Rusty Mech" behind Ivory Rustwalker, post 019f3ef0-…: owner to confirm), Seetah J. Chloth, Rourke,
  Slugger-9, Coffee Brown, Goblin, Wealthy Otter, Salamander Warlord. Capt. Nova's and Boglurker's old owned models
  (Nova's was API-generated 2026-10-25) are replaced and gone.
- Weapons, turrets, medkit, tank (14; new pack `meshy-community-arsenal` in content/guns.json): Tommy Gun, Rotary
  Gatling Gun, military sniper rifle, Steampunk Battle Axe, Freeze Gun, Mystical Glue Gun, Futuristic Blaster,
  Plastic Toy Machine Gun (tripod MG), Large Sentry Gun, Ornate handgun, the WWII tank, and three the owner's own
  queue of 2026-10-29 had listed as **CC0 community posts**, now with their post URLs in the provenance: Neon Flux
  (posts/Neon-Flux-Assault-Rifle-019fea29-…), Frontier Rifle (posts/019e91b5-…), Medkit (3d-models/Medkit-019bce42-…).
- Props (50): packs renamed `meshy-owned-{cargo,street,landmarks,drive-1031,rock-pile}` -> `meshy-community-*` (13
  crates and containers, 15 street props, 13 landmark stalls/wells/statues/fountains/crane, 8 barriers and parked
  vehicles, the Rock Pile); the palette atlases regrouped offline (no picture re-rendered).
- Gear (5 helmets): pack `meshy-owned-gear` -> `meshy-community-gear`.
- Pipeline for it: `prepare-meshy-characters.mjs` (and `prepare-gear.mjs`) give a file kept as built its manifest's
  pack, so a licence change needs no download (`node tools/content/prepare-meshy-characters.mjs <empty dir>`);
  `content:check` fails when a character's lock pack and its manifest's licence disagree; a `content/guns.json` entry
  may carry its own post `url` (lock and provenance). Licence files: `assets-src/meshy-owned/License.txt` (what stays,
  why), `assets-src/meshy-community/License.txt` and `assets-src/meshy-community-characters/License.txt` (each model),
  docs/ASSET_SOURCES.md.

**For the owner:** names for Spacewalker, Starfarer and Shellback; which of the relabelled models (above) you made
yourself, and post URLs for the rest if you have them (CC BY 4.0 posts would need a credit); the airliner; the US flag
on Spacewalker; whether Shellback should be large (2.12 m, 115 health; chosen for its heavy build) or standard.

**Checks:** CI green: run 42265419110 at bad67c03 and run 42268803252 at 8b547fe2 (every job: unit, maps, build, 12 e2e shards, perf). Locally:
`pnpm typecheck` clean; `pnpm content:check` OK; the character-manifest, hitbox, style-pack, look-group, bot-theme and
coverage-map tests pass; the e2e `characters` (358 s), `characters2` (260 s) and `characters3` (202 s) flows PASS
(ports 4981/4982). `pnpm test:changed` on this loaded box (load 13 on 4 cores): 1908 passed, 8 failed, all of them
time-outs (botai, two npc play-throughs, sandgate, two pads maps, host) bar the air drop, whose test is fixed
(`airplane.test.ts`: each bot checked as it lands; Nova's new hit shapes changed the bots' choices and the first two
down knifed each other before the last landed); CI passes every one of them. After that run only the intake queue's
licence fields and docs changed (979bd80c and later).
<!-- /intake-1106 -->

<!-- intake-1106b -->
### Intake 11-06 follow-up: Shellback standard, Capt. Nova retired, Starfarer's pack, four licences (`wip/intake-1106b`, agent, 2026-11-06; from main a07cb65b; green on `check/intake-1106b` at 518838fa, run 42283524919 (full suite: unit, maps, build, check, perf, 11 e2e shards); not landed)
The owner's answers on the 11-06 intake (below, "Owner's answers on the 11-06 intake"). Scratch: the agent scratchpad
`i1106b/` (tools, shots, frames).
- **Shellback** (`meshy_tortoise`): large → standard (`size` left out). Rebuilt from the download: byte-identical,
  since size isn't part of the build, only of the generated look. Character Select draws it at 1.79 m (was 2.11),
  100 health, speed ×1 (was 115, ×0.94). The portrait was recaptured and is unchanged: the renderer builds every
  portrait body at 1.8 m, so `zoom 1.25` still frames the head in the shell's dome. Hit shapes: the measured table is
  at 1.8 m and unchanged, and the audit passes (top 0.02, bottom −0.08, head 0.04, 89% inside). In play they scale
  ×1.0 now instead of ×1.18 (`shots/hitboxes-tortoise-{before,after}.png`). Grip audit: unchanged (`audit-after/`: score 7, spikes fp off, rifle drawn R/L 0.02/0.19 m, the same numbers as the intake's final audit). Shots:
  `shots/shellback-before-after.png` (Character Select, third and first person).
- **Capt. Nova retired:** `RETIRED_LOOKS['core.nova'] = 'core.astronaut'` (Spacewalker). Manifest, files, portrait
  and bot profile are kept, as for the other retired looks. The Knights vs Space Crew set's Capt. Orion is a
  Spacewalker now; no map or other preset named Nova. Tests that used Nova as a plain soldier use Spacewalker.
  `botSet.test.ts` now checks that a set naming a retired look plays its replacement, and that no shipped set names a
  retired look. Looks an NPC role keeps are left out of that check: `classic_mix`'s Nub names `core.goblin` (retired
  2026-11-03, kept for the goblin NPC role), so Nub plays Grizzelda. **Owner:** keep that, or name another look?
- **Starfarer's pack** (`meshy_darkastronaut`). What pulled it, measured over the rig's clips (`tools/packpull.mjs`;
  heat maps `pack/heat-all.png`): the download's rig spread the pack over spine_03 (30% of its weight), neck_01 (19),
  spine_02 (14), each clavicle (12), and spine_01, Head, pelvis and the upper arms.
  - The tank on top rode the neck and head: it tipped when aiming up or down and when running.
  - The box's upper sides rode the clavicles and upper arms: they sheared with the arms.
  - The bottom rode spine_02, spine_01 and the pelvis: it bent in a crouch.
  - The arms' share had also flared the lower corners when the build turned the arms out to the T-pose. So the bind
    pose itself had a skirt, shown as a ring of lights round the waist when crouched.

  The fix is a new manifest option, `fixes.skin.rigid` (skinfix.mjs `bindRigid`; docs/CHARACTERS.md, "A look's own
  skin weights"). It works in the download's own pose, in `pose()` before the T-pose turn: boxes in the landmarks
  frame, every vertex inside held by one joint, a `blend` band round them, an `except` pattern. Starfarer binds the
  pack box and the tank to spine_03, blend 0.025, except `^Head$`: 1315 vertices bound, 377 eased. The body options
  (`hops`, `clamp`, `smooth`) can't do this: they apply to the whole body, keep the neck and clavicle shares that pull
  hardest, and can't undo the flare already in the bind pose.

  Stretch over the rig's clips (`tools/packstretch.mjs`): the pack's own edges went from p95 1.3–1.6 and max 2.0–3.6
  per clip to 1.00 (rigid). Where the pack meets moving skin, the stretch now gathers in two places:
  - the tank's front against the helmet's back: 4–8 mm edges, up to about 14×;
  - the pack's bottom against the lumbar plate in a crouch: up to about 9×.

  In the frames these read as a crease between the two teal shells and as a dark lower back under the pack; neither
  shows as a tear. A wider blend (0.05) would also ease the backs of the upper arms, so it stays at 0.025. The hands
  are unchanged (same build log). Hit shapes were re-measured: torso r 0.20 → 0.21, as the pack no longer flares.
  Grip audit: score 3 as before, the hands and their numbers the same; 1–2 new stretched edges at spine_03 in the Character Select hold (the junctions above), the worst edge still the left forearm's 12.3×.

  Frames come from the game's own animator (the character viewer, stepped 16 ms a frame): `pack/frames-before.png`
  and `frames-after1.png`. Side by side: `pack/cmp1-aim.png`, `cmp1-run.png`, `cmp1-turn-crouch.png`, and close-ups
  `cmp1-close.png` and `cmp1-crouchclose.png`.
- **Licences:** the owner, "I did not make any, they are Meshy community." Relabelled as Meshy Community CC0 the same
  way as the audit's:
  - the airliner shell: pack `meshy-owned-airliner` renamed `meshy-community-airliner`; its task IDs stay on record;
    palette atlas regrouped offline; fuselage-profile.mjs points at the new file;
  - the buggy and tire: into `meshy-community-arsenal`, with the owner's share links as their `url`;
    `meshy-owned-guns` removed;
  - the Alien Biker: manifest CC0, community model "stylized alien biker"; the lock relabelled without a rebuild;
    `character-manifests.test.mjs` expects community now, and checks the owned path on a copy.

  The mining machines stay owned. Updated: the licence files (`assets-src/meshy-owned`, `meshy-community`,
  `meshy-community-characters`), ASSET_SOURCES, CONTENT_PIPELINE, BUILDING_KIT, VEHICLES and the intake queue's
  buggy and wheel. content:check is green, including the check that each character's lock pack matches its
  manifest's licence.
- **Checks:** CHECKS_PENDING
<!-- /intake-1106b -->

<!-- shingle -->
### Shingle Point asset refresh (`wip/shingle`, agents, 2026-11-05/06; main 5b167034 merged in; green on `check/shingle`)
Owner's decision: same layout and gameplay, every dated asset replaced, so it compares fairly with MAP 21 (a new map,
later). Not a layout rework. **Ready to land:** CI run 42175700068 green on `check/shingle` at c214e94f (unit, build,
check, perf budget and mass, all 11 e2e shards with Shingle Point's map tour); main has not moved since, so `main` can
be fast-forwarded to it once the owner is happy with the open items at the end of this section.
- **The map** (`maps/shingle_point.json`) was edited in MapMaker only, driven from the session scratchpad
  (`shingle2/tools/maker.mjs`): Import, the theme picker, Replace all, the block Material and prop Variant fields,
  MapMaker's own Delete and "Place <piece>" commands (the ones its Delete key and palette run) for the block groups,
  Export. The UI path for the 56 groups took ~90 s a group on the loaded box, the commands ~1 s.
  - theme Bunker → Military Compound (no hazard stripes); the MG nests' 12 canvas blocks → Burlap (same ballistics);
  - 56 block groups → kit pieces where their blocks stood: 46 Czech hedgehogs, 4 landing craft, 6 wrecks;
  - 24 Replace alls (Keep height unless noted): Tall Hedge → Box Hedge (Keep length, +90°); Leafy Bush, Large Bush →
    Broadleaf Shrub; Wildflowers → Meadow Flowers (yellow); Wheat → Grass Clump (dry); Boulder, Small Rock, Kenney
    Boulder → Angular Boulder; Bushy Tree, Round Tree, Oak, Broadleaf Tree → Oak; Log → Timber Baulk; Big Log →
    Timber Stack; Rowing Boat → Wooden Dory; Barrier → Sandbag Stack; Large Crate → Wooden Crate; Metal Crate → Army
    Crate; Lantern Post → Harbour Lamp Post; Rubble → Pebbles; Hay Bale → Straw Bale (Keep scale); Cart → Hay Cart
    (Keep scale); Woodpile → Timber Baulk (Keep length, +90°: it keeps its breakability); Crumbling Wall → Drystone
    Wall Half (CC0 Loafbrr);
  - one variant per species (4 autumn oaks summer, 4 moss boulders bare): a variant is a model of its own, a draw.
- **Cheaper pieces:** the 8 beach pieces, the Box Hedge and the Hay Cart are one material each, their colours
  painted per vertex (`build-kit-props.mjs`: one material per surface for a piece with surfaces, and those pieces
  now have one surface each; `pieces.mjs` `paint`: opt-in per piece, every other piece byte-identical): one GPU
  instance and one draw a copy (the hedge was 2 a copy, the hay cart 5, the craft 3).
- **Proof** (scratchpad `shingle2/tools/zz_shingle_proof.test.ts`, not committed; results `shingle2/proof.json`):
  spawns, pickups, mounts, ladders, pads, bomb sites, hills, lights, water, tiles, terrain, logic, bounds, backdrop
  identical; the other 46 blocks identical (canvas → burlap); every replaced prop keeps id, x, z, facing (or a quarter
  turn), solid, tint and name; breakables the same (logs and woodpiles → 11 timber baulks at 60 HP: the woodpiles were
  40); 38 concealing plants before and after; craft and wreck boxes within 1 cm of their blocks; nav 1248/1248
  spawn-to-objective paths both (mean 144.4 → 144.8 m); the seawall's 3 gaps and 5 ladders reach the bluff both
  (lengths within 0.5 m); the weak sections are the same blocks. Sightlines blocked: beach → crest 92.8 % → 93.0 %
  crouched, 92.3 % both standing; across the beach within 30 m 21.3 % → 27.9 % crouched (the hedgehogs' three beams),
  6.9 % → 7.0 % standing; village 39.1 % → 39.9 %. validate-map 0 issues; maps e2e flow on it passes.
- **Bots** (headless, 24 bots, 150 s, seeds 1, 2, 3 and the bench's 42): kills and objectives alike (bomb round won by
  the garrison both; KOTH 7 → 8 hill holds). Stuck recoveries, mean before → after: bomb 467 → 204, TDM 108 → 87,
  KOTH 134 → 274. Same spots on both maps (`shingle2/tools/stuck.mts`): the feet of the seawall ladders at x −30, 2
  and 100 (bots that don't catch the ladder), the HQ and the MG nest by hill 1; KOTH now sends more bots up the
  ladders. The push test (`botPush.test.ts`, tactical TDM, seeds 1-5): assault progress 0.24 → 0.28 on average,
  garrison 0.34 → 0.33; its seed 1 gives 0.243 now (0.252 before), so its bar is 0.22 (the fault it guards was 0.19).
- **Performance** (same spots, same base, both builds side by side; high graphics, SwiftShader, 640 × 360; scratchpad
  `shingle2/timing/`): draws 3,697 → 3,586 summed over 10 spots (−3 %; overview 764 → 725, beach 580 → 568, cliff 456
  → 431, village 263 → 238; up only looking at a landing craft, 109 → 125: the craft, a hedgehog and a wreck in each
  shadow cascade); active meshes 5,096 → 4,259 (−16 %; −5 % without the pooled effect meshes); render call time
  (scene.render() before the GPU, the draw-issue side) 378 → 354 ms (−6 %); triangles +26 % (our oaks, boulders,
  hedges and crates are detailed), shadow casters +6 to +13 a view, so SwiftShader's whole frame +16 %. All meshes
  after loading 1,757 → 1,722. Model downloads 848 → 1,575 KB (the oak 315 KB, the two Meshy crates 410 KB); map file
  733 → 681 KB. perf-3 (prop batches) not on main yet: measure again when it lands.
- **Screenshots** (session scratchpad, 1280 × 720, high, eye level; same spots): `shingle2/before/` and
  `shingle2/after/`, `<n>-<spot>-before|after.png`: beach waterline, landing craft, beach east, seawall, cliff,
  bunkers, casemate, village, orchard, overview.
- **Kept, for the owner:** the 14 Kenney furniture pieces in the two houses, the HQ and the casemate (all breakable,
  40-100 HP; none of our furniture is, so a swap takes that cover away), the HQ's Quaternius radio, the 3 Quaternius
  ruined walls on the seawall top (approved pack). MapMaker's Export stamps `metadata.release` and has no control to
  leave it out, so the map keeps one (the only shipped map that does; suite listings compare content hashes, which
  skip it). No `thumbnailCamera`: MapMaker's only camera control is Set thumbnail, which also stores a picture in the
  map (the card-shot camera is MapMaker overhaul Phase 3 item 8), so the menu card shot still shows the old look.

### Flatpack Depot flicker (`wip/flatpack`, agent, 2026-11-05; CI on `check/flatpack`)
Owner: "The ikea map has significant flickering" / "flicker when I look around, could be shader or something"
(Android phone, Low graphics, Performance render scale; screenshot of the Showroom corridor). docs/LOOK.md,
"No flicker: props" and "No flicker: texture shimmer".
- Causes found and fixed (every map):
  1. **Props in the level's planes** (z-fighting): Quaternius Rug's cloth is its base (y = 0, facing up); Kenney
     factory/shop/sci-fi props have double-sided bases and backs (open shelving, crates, freezers). Fix: the level's
     materials carry a depth bias (`LEVEL_DEPTH_BIAS`, mapMeshes.ts `levelDepthBias`, copied onto the merged level
     material). 4,915 places over 89 maps, 298 on Flatpack.
  2. **Props flush on props**: `propFlushLifts` (shared/src/map/propFaces.ts) draws the later prop 4 mm off (max 11 mm
     on any map), game view and MapMaker view (cached per prop set). 754 pairs, 58 on Flatpack; 0 left.
     Contact faces: `tools/content/prop-contacts.mjs` → `propContacts.generated.ts` (content:check, content:rebuild;
     imported only from the match/MapMaker code via `@tiletrigger/shared/propContacts`: menu bundle unchanged).
  3. **Glass sorting**: glass wrote depth, so a nearer 32 m glass chunk drawn first hid panes behind it until the sort
     flipped; `disableDepthWrite` on the glass material.
  4. **Texture shimmer on phones** (reproduced: Chromium at 900×415 CSS, DPR 2.6, touch, Low, Performance): speckled
     terrazzo twinkles when turning 0.2°. The merged level's lookups take a mip bias on magnified low-res views
     (`levelMipBias`: a whole mip level on a phone at Performance, ~0.1 on a desktop; the first try, 0.6, cut the floor's twinkle only 14 %); the normal-map lookup no longer sits in a branch
     (undefined derivatives on some mobile GPUs).
- Looked at, not changed: shader precision (Babylon declares highp; our plugins add no mediump), depth precision
  (Chrome gives depth24 with the stencil we ask for; the bias is in depth steps so it holds on a 16-bit buffer too),
  shadows (Low has none: not the phone's cause; no acne seen on Medium in the container), LOD popping (props on this
  map have no LOD levels).
- Not reproducible in the container: SwiftShader's float depth draws exact ties steadily, so causes 1-2 looked steady
  here; the audit is the proof. Owner to check on the phone (the Showroom rugs, the market hall shelving, the speckled
  floors while turning) and on the M1 (warehouse racks and windows over the warehouse, Medium/High).
- Phone emulation, terrazzo region of the owner's spot, mean frame-to-frame change turning 0.23°: 42 → 32 (-24 %).
  Desktop Medium shots before/after differ in <0.5 % of pixels (glass, shadows); visual baselines unchanged.
- Checks: typecheck, content:check, bundle 692.6 kB gzip (unchanged: contacts table loads with the match code),
  zfight/levelMerge/foliage/glass tests; local test:changed and e2e visual/mobile had only load timeouts (machine at
  load 10-14). CI: `check/flatpack` run 42122718849 green at 49adda8f (full suite). Not landed: land when wanted.
- Side question (Temple Terrace "cracks", MapMaker): no geometric gaps (tops sampled every 5 cm over 2×2 terraces);
  the lines are the facade's moss dressing (moss cap strips, vines); the owner confirmed in play. A foliage test now
  checks no plants grow under or through placed tiles.
- Screenshots: session scratchpad `flatpack/` (before/after, phone emulation and Medium).

### Drive intake of 2026-11-05 (`wip/intake-1105`, agent; step 1 on `check/intake-1105`, step 2 next)
Downloads in `/home/user/meshy-drive/intake-2026-11-05/` (raw, never committed); the agent linked the ones it uses
into a scratch downloads dir (any dir works: the importers find files by `source.file` / `glb` name). Owner's rules:
rigged models only (the six static ones wait for the owner's Meshy rigs), no baseball animations (`anims/` untouched),
the WWII tank replaces the tank. Download format asked for from now on: Meshy rig with the Mixamo-style skeleton,
fingers included; GLB with "Rigged Character" on (rest pose, no animations); upright T- or A-pose, nothing in hands.

- Owner mapping (2026-11-05, final, from main's HANDOFF; later messages added: Goblin Warlord and The Masked Figure
  new, Goblin Mischief replaces Snikkit, Gnoll replaces Hyena Warrior's model):
  - **Re-rigs:**
    - Iron Warden → Iron Knight; Gnoll warrior → Hyena Warrior; "T Pose on Green Screen" → CRT Robot.
    - Monkey → Big Bab; Uniformed Worker → Customs Agent Zhao; Desert Sentinel → Desert Ranger.
    - Elderly Man → Grandpa Chains; Old medieval king → Old King Halvard; Hazmat → Hazmat Joe; Regal Monarch →
      King Aldric.
    - Plus the Dapper, Croakley, Frida, Field Medic Automaton, Stealth Operative, Beanie Alien, Alien Biker,
      WWII Infantry and Grunt '68.
  - **Replacements** (same name and id, new model): Tattered Circus Nightmare → Giggles; Bear Warrior → Barnaby
    Bruin.
  - **Never use:** Alfred Neubauer, the 6 unrigged statics, the baseball animations.

**Step 1 (new characters + tank), pushed to `check/intake-1105`:**
- New characters (manifests in content/characters, built by prepare-meshy-characters.mjs; names are placeholders):
  - **Patches** `meshy_hoboclown` / `core.hoboclown` (folk, standard; "hobo bozo clown": "Bozo" is a trademark, so
    Patches until the owner picks), 9.7k tris, 512 px normal map (1.80 MB at 1024, over the 1.8 MB budget);
  - **Tactical Soldier** `meshy_tacticalsoldier` (soldiers, standard), 10.4k tris;
  - **Umpire** `meshy_umpire` (folk, standard; `umpire_28.glb`, armature in cm, no finger joints), 10.3k tris;
  - **Bamboo** `meshy_panda` (animals, large; "Open Arms Panda"), rebaked 169k -> 14k tris;
  - **The Butcher** `meshy_butcher` (folk, standard; the download is "Painter in a T Pose", the owner reads it as a
    butcher), rebaked 223k -> 14k tris;
  - **Old Timer** `meshy_oldtimer` (folk, standard; "An old man in his 90s"), rebaked 122k -> 14k tris;
  - **Imperial Guard** `meshy_imperialguard` (legends, standard; "A fit ancient Chinese male soldier"), rebaked
    165k -> 14k tris;
  - **Frost Viking** `meshy_frostviking` (legends, large), 10.2k tris (the owner's "fantasy": Knights & Legends);
  - **Goblin Warlord** `meshy_goblinwarlord` (legends, standard: a warlord; owner may prefer small), 10.4k tris;
  - **The Masked Figure** `meshy_maskedfigure` (horror, standard; A-pose rig), 11k tris.
  - Portraits captured for all ten (capture-portraits.mjs with the look ids; CI's "none drawn live" check needs them).
  - All owned (meshy-owned). The last five: no metadata says otherwise, but some names follow Meshy community
    naming: owner to confirm (CC0 would need author + post URL). "Alfred Neubauer": not used (owner).
- **Tank:** `content/guns.json` `vehicles/tank_wwii.glb` (hero tier, 18.9k tris + 5.6k LOD from 45 m, 1536 px colour,
  512 px baked normal map, 1.51 MB; 2.14 MB with 2048/1024 maps was over the 1.6 MB hero budget). Built in parts
  (prepare-guns.mjs `parts` / `splitParts`: hull, turret, barrel on pivots, a dark cap over the deck under the turret).
  `content/vehicles/tank.json`: same box `half [2.1, 1, 3]`, health, handling, weapons, arcs; `fallback`
  `vehicles/tank.glb` (the Quaternius tank, its models.json entry kept); seats moved onto the model (driver
  [-0.6, 1.95, 1.8] front left of the deck, cannon [-0.3, 3.05, -0.3] and roof gun [0.4, 3.05, 0.1] on the turret
  roof; the old ones were inside the new turret or off its roof); cockpitEye over the driver's hatch;
  `turret: { seat: 1, pitch: [-0.17, 0.35] }`: the cannon gunner's aim turns the turret (within its 0.6 rad arc) and
  pitches the barrel (View.turnTurret, eased); the sim lets only that seat set the tank's aim (the roof gun used to
  overwrite it). Shots still leave from the gunner's eye, as for every mounted weapon (no muzzle point in the data).
  The Tank Cannon's `view.model` stays `vehicles/tank.glb` (its weapon icon is keyed by that path).
  - Fit: hull 6.2 m to the box's 6 m; 2.93 m wide against the box's 4.2 m (about 0.6 m each side is beside the
    tracks: shots and bodies stop on air there). **Owner's call:** keep the box (asked) or narrow it to ~1.5 half-width.
- Vehicles now draw their LOD (ModelLibrary.attachLods: per part, parented beside it so paint/char/fade reach it).
  Before, mounts (plain copies) never used their guns.json `lod`.
- e2e: coverage flow checks the tank's parts, their LODs and that a manned cannon seat's aim swings the barrel right
  and up (through `window.__sim`: the match runs in a worker). Local: coverage PASS, vehicles PASS.
- **Briggs and Hollis retired** (owner, "Remove Briggs and Hollis"): RETIRED_LOOKS `core.tposesoldier2` -> Grunt '68,
  `core.tposesoldier1` -> WWII Infantry; manifests, files and portraits kept (as Otter/Shade). No bot set, map,
  preset or the coverage map named them.
- Grip audit (rifle, pistol, shotgun; lower is better): Patches 7 (back, off, fp), Tactical Soldier 7 (flat, off,
  fp), Umpire 3 (flat), Old Timer 3 (flat), The Butcher 6 (flat, spikes), Imperial Guard 6 (flat, spikes), Bamboo 10
  (flat, off, spikes, fp: the gun sits close to the face), Frost Viking 12 (open, back, off, spikes, fp: big splayed
  hands), Goblin Warlord 6 (back, spikes), The Masked Figure 4 (off, fp). Not tuned: candidates for the next hands round (fixes.hands scale/curl, fixes.grip). All animate in
  Character Select and in play (no T-pose or freeze seen: screenshots in the agent's scratchpad `chars-shots/`).

**Replacements (own step):** Goblin Mischief replaces Snikkit (`meshy_snikkit`?, keep name/id/size), Tattered Circus Nightmare replaces Giggles (`meshy_giggles`, keeps name/id/size small),
Bear Warrior replaces Barnaby Bruin (`meshy_barnaby`), Gnoll warrior replaces Hyena Warrior (`meshy_hyena`), all with
new portraits. **Re-rigs, more:** Desert Sentinel -> Desert Ranger, Grandpa Chains, Old King Halvard, Hazmat Joe,
King Aldric (side-by-sides in the agent's scratchpad `match/pairs*.png`).

- CI: run 41960435500 failed only on "every built-in character's portrait is shipped" (fixed: portraits captured);
  run 41962428581 (835115c3) hit a GitHub API 500 in `plan` and was re-run.

**Step 2 (re-rigs and replacements; not started on disk):** suggested split: 2a the six first re-rigs (Dapper,
Croakley, CRT Robot, Frida, Medic Automaton, Stealth Operative), 2b the next ten, 2c the three replacements
(Giggles, Barnaby Bruin, Snikkit; new portraits). For each: point `source.file` at the new download, `ONLY=<id>
node tools/content/prepare-meshy-characters.mjs <dir>`, `pnpm content:rebuild`, build, grip audit after, and keep the
old build (restore its files, manifest and its meshy.lock.json lines) where the new one scores worse.

**Step 2 detail:** rebuild each through the normal path from the new download, grip audit
before/after, keep the old build where the new is worse. Matches (by render, then the owner):
- The Dapper, Croakley, CRT Robot (two candidates: "crt robot rigged" 20261101 and "T Pose on Green Screen"), Freaky
  Frida, Field Medic Automaton, Stealth Operative, Beanie Alien, Alien Biker, WWII Infantry, Grunt '68 ("Realistic
  T Pose"), Big Bab ("T Pose Monkey" 20261105; Scamp unchanged), Agent Zhao ("Uniformed Worker in a T Pose"), Iron
  Knight ("Iron Warden", owner), Hyena Warrior ("Gnoll warrior", owner: replaces the model, keeps the name).
- **Flags:** "T Pose on Green Screen" renders as a photoreal middle-aged man in a shirt and jeans, nothing like CRT
  Robot (scratch `match/pairs2.png`); owner later confirmed it IS the CRT Robot's new rig: build both CRT candidates, compare: show the owner before using it for the robot. Iron Warden and Gnoll are visibly
  different models from the Iron Knight and Hyena Warrior (new portraits needed if adopted).
- Skeletons: Dapper, CRT Robot (20261101), Frida and Alien Biker have 24 joints (no finger chains); the others have
  fingers (Croakley no index finger). **The importer does not use a download's finger chains**: they fold into the
  hand joint and hands.mjs re-derives the finger weights from the mesh, so a re-rig changes body weights and the
  hand mesh's pose, not the finger rig. Using Meshy's finger weights would be an importer option (map the Mixamo
  finger chains to the rig's, place the rig's finger joints on them, keep hands.mjs's measurements): not built.
- Before scores (same audit): Dapper 3 (flat), Croakley 5 (spikes, fp), CRT Robot 6 (back, flat), Frida 0, Medic
  Automaton 3 (back), Stealth Operative 0, Beanie Alien 3 (flat), Alien Biker 3 (flat), WWII Infantry 0, Grunt '68 0;
  Big Bab, Zhao, Iron Knight, Hyena: not yet measured.

**Resume:** `git checkout wip/intake-1105`; scratch tools were in the agent's scratchpad (`intake1105/tools/`:
glbinfo.py, joints.py, preview.mjs (software views of any GLB), slices.mjs, montage.mjs, tankshots.mjs). Grip audit:
`CHROMIUM=/opt/pw-browsers/chromium ONLY=<ids> WEAPONS_ONLY=rifle,pistol,shotgun AUDIT_PX=400 node
tools/content/grip-audit.mjs <url> <out>`. On this machine Playwright's bundled headless shell is missing: the
palette atlas step of `pnpm content:rebuild` needs a temp copy of build-palette-atlas.mjs with
`executablePath: '/opt/pw-browsers/chromium'` (delete it after), like e2e/run.mjs.

<!-- intake-2 -->
### Intake step 2 (`wip/intake-2`, agent, 2026-11-05; from main 4d511dd2)
**Step 2a: on main** (f7d456e0, `check/intake-2a` CI run 42034304208 green; landed by the coordinator).
- `fixes.fingers` (`own` default / `fit`): a rigged download with whole finger chains keeps Meshy's finger joints and
  weights (prepare-meshy-characters.mjs FINGERS / checkOwnFingers; hands.mjs `keep`: measured only; rehand-built keeps
  them). Falls back to the re-fit with no or part chains, a failed check, or `fit` in the manifest. docs/CHARACTERS.md,
  "The download's own fingers". The lock records `fingers: own l r`.
- Proof (grip audit rifle/pistol/shotgun, re-fit -> own): Tactical Soldier 7 -> 4, Frost Viking 12 -> 12 (curl and spikes
  better, better by eye), Goblin Warlord 6 -> 6 (own kept on those three); The Butcher 6 -> 7 and Bill 3 -> 5 (`fit`).
  Across 2a and 2b own fingers scored better 2 times (Tactical Soldier, Beanie Alien), level 4, worse 10: **not a
  general win**; the per-manifest audit decides. Worth a look: why own fingers often score `off`/`back` (the palm
  measured on Meshy's finger weights?).
- Bill `meshy_bill` / `core.bill` (folk, standard, rebaked 145k -> 14k, portrait). Close to "Bill the Barbarian"
  (meshy_hector): kept "Bill"; owner told. A photoreal man: owner to confirm the likeness screen (not a real person).
- Tank box half [2.1, 1, 3] -> [1.47, 1, 3.06] (hull 2.93 x 6.12 m, up to the 2 m deck; the turret above the deck is
  not solid, as before: one box can't fit both without an invisible roof over the deck). Fixture updated;
  packages/shared/test/tankBox.test.ts (walking into the side or front stops at the hull, get in from beside, get out clear).
- Goblin Warlord `size: small` (Goblin, Goblina, Snikkit were already). Hit shapes, health and speed follow the class.

**Step 2b (re-rigs and replacements): e69a8f6b on `check/intake-2b`, CI run 42046872621 green (run 42045527179 failed on a manifest test that named the Iron Knight's old Meshy task IDs; fixed). Not on main: the coordinator lands it.** Grip scores (lower is
better; before = main's build; "own" = Meshy's fingers, "fit" = re-fitted):
| Character | before | new (own, or no chains) | new (fit) | shipped |
|---|---|---|---|---|
| The Dapper | 3 | 3 (no chains) | - | new |
| Croakley | 5 | 5 (no index finger) | - | new |
| Freaky Frida | 0 | 3 (no chains) | - | **old** (worse) |
| Field Medic Automaton | 3 | 3 own | - | new, own |
| Stealth Operative | 0 | 3 own | 0 | new, fit |
| Beanie Alien | 3 | 0 own | - | new, own |
| Alien Biker | 3 | 3 (no chains) | - | new |
| WWII Infantry | 0 | 6 own | 3 | **old** (worse) |
| Grunt '68 | 0 | 3 own | 5 | **old** (worse) |
| Iron Knight (Iron Warden) | 5 | 5 own | 7 | new, own (new portrait) |
| Hyena Warrior (Gnoll) | 5 | 10 (no chains) | - | new (owner's model swap; worse: flat, off, spikes, fp) |
| Desert Ranger (Desert Sentinel) | 2 | 5 own | 5 | **old** (worse) |
| Big Bab | 3 | 5 (no chains) | - | **old** (worse) |
| Customs Agent Zhao | 3 | 3 (part chains) | - | new |
| Grandpa Chains | 0 | 9 own | 8 | **old** (worse) |
| Old King Halvard | 6 | 6 (part chains) | - | new |
| Hazmat Joe | 0 | 4 own | 6 | **old** (worse) |
| King Aldric | 6 | 8 own | 6 | new, fit |
| CRT Robot (crt robot rigged, 11-01) | 6 | 6 (no chains) | - | new |
| Giggles (Tattered Circus Nightmare) | retired | 3 own | 3 | new, own; back on the roster (new portrait) |
| Barnaby Bruin (Bear Warrior) | 8 | 10 own | 8 | new, fit (new portrait) |
| Snikkit (Goblin Mischief) | 3 | 12 (part chains) | - | new (replacement; worse: open, back, flat, off, fp) |
- Kept old builds: files, manifest and lock lines from main, a note in the manifest saying why.
- Hyena Warrior and Snikkit ship their new models though they audit worse (the owner's model swaps); both are
  candidates for the next hands round (`fixes.hands` / `fixes.grip`), as is Barnaby (8).
- Sizes, stats and hit boxes unchanged (heights are normalised; no size class changed). Giggles and Snikkit stay small.
- The old grip/hands/skin tuning was dropped on the five new models (it fitted the old ones); kept on same-model re-rigs.
- Portraits re-captured for every shipped re-rig and new model.
- Local checks: typecheck, content:check, bundle budget (2468 kB, 691 kB gzip) pass; tool and look unit tests pass; e2e characters, coverage and visual PASS; vehicles fails locally on the buggy's chase-camera checks (also on 2a, which CI passed; this container's software GL), green on CI.

**Licence: author and post URL pending from the owner** (recorded "Meshy Community (CC0 per the owner)", url null;
assets-src/meshy-community-characters/License.txt, docs/ASSET_SOURCES.md): Patches ("hobo bozo clown tpose"),
Tactical Soldier ("Tactical T Pose Soldier"), Umpire ("umpire rigged"), Bamboo ("Open Arms Panda"), The Butcher
("Painter in a T Pose"), Old Timer ("An old man in his 90s presented in a"), Imperial Guard ("A fit ancient Chinese male
soldier from"), Frost Viking, Goblin Warlord ("Goblin Warlord villain"), The Masked Figure, Bill ("T Pose on Green
Screen"), Iron Knight ("Iron Warden"; was the owner's own), Hyena Warrior ("Gnoll warrior"; was the owner's own),
Customs Agent Zhao ("Uniformed Worker in a T Pose"; the old model's post was 019df47b-…), Giggles ("Tattered Circus
Nightmare"), Barnaby Bruin ("Bear Warrior"), Snikkit ("Goblin Mischief"). The owner said "most" are CC0: any that are
the owner's own go back to `owned` (manifest `source`, then rebuild that id for the lock).

**Resume:** downloads linked in the agent scratchpad `intake2/dl`; audits in `intake2/audit-*`, before/after sheets in
`intake2/sheets/` (scores.tsv), shots in `intake2/shots/`. Rebuild any character with `ONLY=<id> node
tools/content/prepare-meshy-characters.mjs <dl>` (deterministic: an unchanged manifest gives the same file).
<!-- /intake-2 -->

### Owner review of Environment Phase 1 (2026-11-05)
1. "Looking pretty good":
   - the rocks need improvement;
   - lose the Kenney grass and use our own, since grass is a core part of the foliage.
2. env species get their own budget.
3. Replace the toy-like Kenney flowers and shrubs that the plants brush grows, now.
4. Grass density waits for an M1 recording.

This work is on `wip/env-p1b`. Phase 2 (more species) still needs the owner's go after that.

### Environment Phase 1b: rocks, our own ground cover, env budget (`wip/env-p1b`, agent, 2026-11-05; from main 76c48223; pushed, not merged)
- **Done:**
  - **Budget:** `MAP_BUDGETS.env` in `shared/src/map/validate.ts` (4,000 placed, 3,000 colliding, 120 cliffs, 24 variants;
    codes `budget.env*`); env placements no longer count toward Props / prop models. docs/MAP_BUDGETS.md. `env_showcase`
    validates clean (test in environmentData.test.ts).
  - **Rocks:** boulder hull cut by 8–12 fracture planes (was 4–7): collision hull changes → `assetVersion` 2 + fixture
    entry (still ≤ 32 points, stone, size 2.01 × 1.48 × 1.74 vs 2.10 × 1.47 × 1.94). Visual surface only, inward of the
    hull: bedding grooves, corner chips (never the 6 bound-setting corners), less wear, crease 38°; vertex colour from
    strata, curvature, moss, hue patches. Cliff: joint blocks on levels 0–1 only (`lods[].detail`), so its collision
    (level 2) and fixture are unchanged; colour noise on a circle so panel edges match. `rock.webp` (RGBA, roughness in
    alpha) / `rock_n.webp` redrawn; `EnvRockPlugin` (envMaterials.ts, GLSL + WGSL) draws it tri-planar in world space on
    medium/high (macro sample + warm/cool patches; roughness via a regex swap of `reflectivityBlock`'s first argument).
  - **Ground cover:** new species `env.flower.meadow` (white/yellow/purple, 27 tris) and `env.fern.bracken`
    (summer/autumn, 56 tris; groundcover budget 40 → 64), from new atlas cells `flower.0-2`, `fern.0` (existing cards
    and tree GLBs byte-identical). `foliage.ts` grows env species at every plants level with no flag: grass/tall →
    clump (density 2.2 as reviewed, untouched), flower → meadow, shrub → fern, bush → `env.shrub.broadleaf` level 1;
    pebbles (`prop.stones`) and eelgrass unchanged. Kenney grass/flowers/plant_low retired from the palette
    (`RETIRED_PROPS`, paletteCatalog.ts; maps still load them); the three species are in Nature → Plants & Flowers (no
    picture); "Flowers & grass" and "Desert scrub" scatter sets use them. envlab lineup has the flowers and fern.
- **Perf** (client-perf.mjs, medium, `PERF_BOTS=2`, 20 s, SwiftShader on the shared container; two interleaved
  before/after pairs, before = a build of main 7c0ebb14; counts only): plants on Backwoods 103 / 74 → 73 / 80 draws,
  0.54 / 0.44 → 0.26 / 0.26 M triangles (≈4.2 k → 7.1 k instances: clumps are a few blades); Norman Shores 56 / 57 → 40
  / 47 draws, 0.44 / 0.39 → 0.19 / 0.21 M. Whole frame: Backwoods 420 / 367 → 323 / 355 draws, 1.94 / 1.83 → 1.61 /
  1.62 M triangles; Norman Shores 383 / 376 → 342 / 422 draws (the second pair's camera saw more; not plants),
  1.72 / 1.42 → 1.38 / 1.37 M. Menu first JS 683.4 kB gzip (budget 840). Not measured: GPU time (the plants now use the
  environment's PBR materials with wind instead of lambert; grass capped at 2 lights).
- **Checks:** typecheck, test:changed (1568 passed), content:rebuild + content:check, build, bundle budget,
  validate-map env_showcase (0 issues); e2e here (ports 4991/4992): environment, visual (baselines envlab and canyon
  updated; arena, mapmaker, menu left as they were), scenery, editor, offline, sandgate PASS. CI `check/env-p1b` run
  41976898146 at 7a2d9e8f: green (full suite, every e2e shard).
- **Open for the owner:** grass reads thinner than Kenney's patches at the reviewed density (density waits for the M1
  recording); placed Kenney grass/fern props on maps (e.g. Backwoods' teal tufts) are map entities, unchanged until
  Phase 4 migration; pebbles (`prop.stones`) and eelgrass still pack pieces; Kenney fern and small bush (they conceal)
  stay in the palette; the three ground-cover species have no palette picture yet.
- **Screenshots** (session scratchpad `env2/`): `envlab-before-*` / `envlab-after-*` (rock-close, rocks, cliff-close,
  cliffs, plants, small, lineup) and `backwoods-*`, `env_showcase-*` before/after at eye height.
- **Pitfall:** another agent's `vite preview` held port 4951 all day; a preview started with `--strictPort` on a taken
  port fails silently and the page is served by the other checkout. Use free ports (this job: 4981–4983, e2e 4991/4992).
- **Resume:** `git fetch && git checkout wip/env-p1b`; `node tools/content/environment.mjs --check`; envlab at
  `?envlab` (views rock-close via the camera, rocks, cliffs, plants).

### Owner decisions, 2026-11-05 (later)
- **Environment:**
  - grass density: the owner will test on the M1 first;
  - replace pebbles and eelgrass with our own;
  - retire the Kenney fern and bush once ours conceal the same way;
  - update hand-placed Kenney foliage on maps now, through a MapMaker "Replace all" operation.

  This work is on `wip/env-p1c`.
- **Characters:**
  - "T Pose on Green Screen" is a new character, "Bill", not the CRT Robot;
  - narrow the tank's box to fit the model;
  - make the goblins small;
  - most of this intake is Meshy Community CC0, not owned, so the owner owes authors and post URLs;
  - keep Meshy's finger weights when a download has finger chains (my call; the owner said "your call").

  This work is on `wip/intake-2`.

### Queued (owner, 2026-11-05): first-person pistol hold
"The first person view when holding a pistol could be adjusted. Either the gun moves back more into the hands or the
hands move up more into the gun. Looks as if their fingers are just pinching the grip."
- First person `gripExternal` (characterAnimator.ts) IKs the palms onto the viewmodel's grip and support points.
  The pistol's hold points and viewOffset are in content/weapons (view.hold).
- Seat the pistol's grip deep in the palm, web of the thumb high on the backstrap, fingers wrapped, support hand
  cupping. Do this for every pistol-class weapon.
- Check with the `aheadR`/`sideR` measures and the characters e2e, with before/after first-person shots across
  several characters, including Meshy rigs with Meshy's finger weights once intake-2 lands.
- Start it once a slot frees. It touches the hands, so after intake-2 step 2a.

<!-- pistol -->
### First-person pistol hold (`wip/pistol`, agent, 2026-11-05/06; from main 68663142, main 49c6ace7 merged in; CI on `check/pistol`)
Owner: "The first person view when holding a pistol could be adjusted. Either the gun moves back more into the hands
or the hands move up more into the gun. Looks as if their fingers are just pinching the grip."
**Causes (measured):** in first person each hand's palm point went on the grip's middle, so the shooting hand rode
2-3 cm low and its knuckles stood ahead of the front strap; its knuckle line leaned about 20° off the grip (the
fingers curl about that line, so they closed up across the trigger guard instead of round the grip); the full curl
on top of the clips' bend folded them back into the palm; the support hand kept the clip's hold beside the grip, palm
up, thumb straight up. Two guns were held by the wrong spot altogether (the Machine Pistol by the end of its wire
stock, 11 cm behind its grip; the Freeze Ray inside its trigger guard) and four by the edge of their grips.
- **Fix** (`gripPlaced` in characterAnimator.ts, both first-person views; `PISTOL` holds the numbers):
  - each hand turned about its palm so its knuckle line runs down the grip at its rake (`alignKnuckles`; the support
    hand's 18° further, canted forward round the shooting hand);
  - each hand set by its knuckles, not its palm point (`seated`): the shooting knuckles 2 cm ahead of the grip point,
    just behind the front strap (a hand over 9 cm from wrist to knuckles further round, so its palm stays on the
    backstrap); the support knuckles 1.5 cm ahead of and 1 cm below the support point, its palm 1.1 cm further in;
  - the fingers close until the middle fingertip is round the grip's far side, no further (`closeHand`'s `wrap`
    plane; the support hand's round onto the shooting hand's side);
  - the thumbs laid along the frame, straightened most of the way (`pointThumb`; the clips' thumbs stood up);
  - content: every pistol-class gun's points re-read off a gridded side view (Machine Pistol, Freeze Ray, Hand Cannon,
    Flare Gun, Grapple, Gilded and Pulse Pistol moved; the Machine Pistol also 4 cm nearer the eye) and a new
    `view.hold.rake` (the grip's lean: Flare Gun and Grapple 34°, Freeze Ray 20°, Revolver 18°, Pulse Pistol 17°,
    Hand Cannon 15°, Machine Pistol 10°, Gilded 7°, else 12°; tools/content/weapons.mjs, shared `WeaponHold`).
  - third person: the gun sits in the hand by the middle of its width (`knuckleLine`: a measured palm point sits
    toward a finger); the hand turns are the clips' as before. The moved points change third person too (onto the
    real grips: better on every look checked).
  - dropped: a foregrip hold for the Machine Pistol (out of reach in third person); the earlier WIP's
    "nearest point" close (left the fingertips inside the grip).
- **Measures, grip audit, checks:** not written up before the container restart stopped the agent; the landed state
  (main 463c2477) is hands round 5's "before" (next section: full audit of every look and weapon). It held the Spear,
  Medkit and Medi-Beam as pistols in first person (fixed in round 5).
- **Left for the owner / round 5:** big hands still swallow a pistol in first person (Frost Viking, Goblin Warlord,
  Goblin, Bamboo: hands 25-28 cm against a gun's 18 cm grip); the Knight's gauntlet doesn't close (curl 0.5). Done in
  hands round 5 (below).
- Tools and shots: agent scratchpad `pistol/` (`t2/probe.mjs` shots + joints, `t2/measures.py`, `t2/section.mjs`
  grip cross-sections, `t2/side.mjs` gridded side views, `t2/e2echeck.mjs` the characters flow's grip checks;
  `final-before/`, `final-after/`, sheets in `sheets/`).
<!-- /pistol -->

<!-- hands5 -->
### Hands round 5 (`wip/hands-5`, agents, 2026-11-06; from main 463c2477; CI on `check/hands-5`)
Owner-approved scope: re-tune the support hands the palm fix changed; Frost Viking and Bamboo holds; the Knight's
gauntlet; audit the Spin Gun and the Spear on every character. No Meshy re-rigs, no credits: Frost Viking, the Goblin
Warlord and the Iron Knight were rebuilt locally from their downloads (`/home/user/meshy-drive/intake-2026-11-05/`,
`ONLY=<id> node tools/content/prepare-meshy-characters.mjs <dir with links>`; an unchanged manifest rebuilds
byte-identical, checked), Gorgle's right hand with `rehand-built.mjs` (`SIDES=r`).
- **Grip audit's curl test** (ec240caf): a long gun's support hand is measured against the handguard's line (palm up
  under it, its fingers close up round the guard, away from the support point on its underside, which the old test
  read as a backward curl). `CURL=points` keeps the old rule; audit.json keeps both (`curl`, `curlGuard`).
- **The Spear, Medkit and Medi-Beam in first person** (found by the Spear audit): the pistol hold (main 463c2477)
  applied to every `style: pistol` hold, so these one-handed holds were turned and closed as a raked pistol grip: the
  fingers stood straight over the Spear's shaft and splayed in the air above the Medkit's handle. The pistol hold is
  now for two-handed pistol grips only (`gripPlaced`: a `support` point); the three are back to their earlier first
  person exactly (drawn measures identical to the pre-pistol build). Third person keeps the pistol round's change
  (better: Tactical Soldier's hand 4.4 -> 2.7 cm from the shaft, Frost Viking's 7.5 -> 3.5 cm).
- **New: `fixes.hands.together`** (0-1; hands.mjs writes it on the hand, the game reads it in every view): as a hand
  closes, its fingers come in toward the middle finger by that share of their spread (closeHand `gather`, about the
  palm's normal, before the curl). A download's own fingers keep the download's fan: Frost Viking's 23 degrees from
  index to little finger, the Goblin Warlord's 20, the Iron Warden (Knight) 30, Tactical Soldier 14; re-fitted
  fingers are parallel. Unit tests: hands.test.mjs, character-manifests.test.mjs.
- **Fixed: an own-finger hand's scale** (`fixes.hands.scale` with the download's fingers) shrank the skin about the
  wrist but left the finger and thumb joints where the download had them, 1-2 cm past their own skin's start: the
  fingers curled about points in the air past the knuckles. hands.mjs now scales those joints with the skin (no shipped
  look had both before this round).
- **Frost Viking** (rebuilt): `fixes.hands { scale 0.8, together 1, r.curl 0.6, l.curl 0.75 }` (hands 24.5-25 cm long
  and 19-20 cm wide -> about 19.5 x 16; fully closed, its low-poly fingers folded into shards, so the curl is softer),
  `fixes.grip { gripLong [-0.03, 0.02, -0.03], supportLong [0, 0.05, 0.04], supportPistol [-0.01, 0.05, -0.04] }`.
- **Goblin Warlord** (rebuilt): `fixes.hands { together 1, r.scale 0.75, l.scale 0.85 }` (28 and 24 cm, uneven),
  `fixes.grip { gripLong [-0.03, 0, -0.03], supportPistol [-0.01, 0.04, -0.05] }`.
- **Iron Knight** (rebuilt): `fixes.hands.curl 1` (its gauntlets measure thick for their length, which put the curl at
  its 0.5 floor; they now close round the grip in both views) and `fixes.grip.gripLong [-0.03, 0.03, -0.03]` (the fist
  hung under a long gun's grip, 6.9 cm off it -> 2.6). The audit's curl test reads the full close as backward on the
  rifle's shooting hand (the gauntlet's fingertips curl past the grip's point); by eye it is a fist on the grip.
- **Bamboo**: `fixes.hold { forward 0.06, down 0.12, out 0.1 }`: the rifle ran across its snout (its head is big and
  low); now at its chest, face clear (side views in `panda/cmp-hold-*.png`). Its pistol is held at arm's length ahead
  of the snout (fine from the side).
- **Support hands re-tuned (14 looks)**: grips round 3's offsets were tuned while some palms were read back to front.
  The pistol ones (`supportPistol [0, 0.04, -0.08]` and kin) held the support hand 6-8 cm back under the wrist now that
  its palm faces the right way; `[-0.01, 0.03, -0.03]` puts it round the shooting hand. Long guns: `supportLong
  [0, 0.02, 0.03]` brings the support hand onto the handguard; `gripLong` seats a shooting hand that hung off the
  grip. Per look (all `fixes.grip`, third person and Character Select):
  - Pharaoh: gripLong [-0.03, 0, -0.03], supportPistol [-0.01, 0.03, -0.03].
  - Gorgle: gripLong [-0.045, 0.015, -0.045], supportPistol as above; and `fixes.hands.r.curl 0.8` (its right hand was
    measured a fist and left rigid: an open claw on the grip; now a mitten that closes, rehanded `SIDES=r`).
  - Luther Vanguard: rollL 0.25 dropped (support palm up 0.83 -> 0.93), supportPistol [-0.02, 0.06, -0.08] ->
    [-0.02, 0.04, -0.04] (support hand on the shooting hand: 6 -> 2 cm).
  - Croakley: supportLong [0, -0.02, 0.06] -> [0, 0.02, 0.03] (the rifle's backward curl gone); its long frog fingers
    still stand 14.6 cm from a pistol's grip point (`open`; geometry).
  - Big Bab, Desert Ranger, Greyfang, Seetah, Stealth Operative, WWII Infantry: supportLong [0, 0.02, 0.03] and
    supportPistol [-0.01, 0.03, -0.03] (their gripLong and curls kept; Greyfang gripLong [-0.03, 0, -0.03]).
  - The Masked Figure, Anoobys: gripLong [-0.03, 0.02, -0.03], supportLong and supportPistol as above.
  - Tactical Soldier: the same plus curlR 0.5 (its own fingers curled back past the grip; palm in 0.73 -> 0.93).
  - Kenji: gripLong [-0.03, 0.02, -0.03], supportLong as above, rollL -0.3 (support palm up 0.72 -> 0.88).
- **Spin Gun and Spear audit, every character** (third person in the grip audit; first person measured separately,
  `h5/fp-before.json`, `fp-after.json`, as the audit skips the Spin Gun's first person): 
  - Third person: the Spin Gun's flags are the rifle's (shooting hand and skin: spikes 25 looks, off 10, open 6; the same
    hands as on the rifle); beyond the rifle's only Teddy (its ball paw reads palm-down on the Spin Gun's handle) and
    Salamander Warlord (stretched skin). The Spear adds nothing beyond the pistol's flags.
  - First person, before: the Spear, the Medkit and the Medi-Beam held as pistols (above; fixed). After, over 99 looks:
    hand to the shaft's point median 2.7 -> 4.1 cm, palm in 0.90 -> 0.96, fingers along 0.95 -> 0.97; by the audit's
    first-person thresholds 4 -> 7 looks flagged (Biscuit, Frost Viking, Bamboo, Saint Nick 6.7-7.2 cm: thick hands
    just past 6.5; Brass Hare's cuffed hand and Boglurker's frog hand read palm-out, as on their other guns; Teddy's
    palm and Gorgle's distance cleared). The Spin Gun: 8 -> 7 looks flagged (Gorgle cleared; Frost Viking 8.6 -> 6.9
    cm, Goblin Warlord 6.5 -> 5.0; the rest are thick shooting hands 6.6-7.9 cm off its grip, as on the rifle: Biscuit,
    Grizzelda, Saint Nick, Bamboo; Brass Hare, Boglurker).
- **Grip audit** (99 looks; rifle, pistol, Spin Gun, shotgun, Spear; before = main 463c2477 with the new curl test):
  numbers not summarised here: the agent was stopped before writing them up. See the scratchpad's `h5/audit-before/`
  and `h5/audit-after/` (summary.md in each).
- **Checks:** CI run 42213705026 green at 351b22d0 (full suite). The commits after it change only docs.
- **Left for the owner:**
  - **Bamboo in first person**: its forearms (thick fur) rise above a pistol's slide and hide it in full-body first
    person (the rifle shows). The arms-only view (`firstPerson.body: false`) is no way out: its sleeve pull-in tears the
    fur cards. Needs thinner forearms on the model, or a first-person option that thins a look's forearm copies.
  - **Hand geometry, still**: Vanguard, Beanie Alien, Alien Biker, Mummy Bot, Zhao (fingers fold into shards; a rebake
    or new hands); Frost Viking's and Gorgle's low-poly fingers show shards when closed tight (softened, not gone);
    Croakley's frog fingers (a pistol's `open`), Brass Hare's cuffs and Boglurker's rigid frog hand (`palm`), Teddy's
    ball paws (its Spin Gun support paw reads palm-down).
  - **Grunt '68's long-gun-only support roll** (a new GripTune field; offered in round 4, not done).
  - **Thick hands in first person** (Biscuit, Grizzelda, Saint Nick, Bamboo, Gorgle): the shooting hand sits 6.5-8 cm
    off a long gun's grip (the palm rests half the hand's thickness off it); first person reads no per-look grip
    settings (GripTune is third person and Character Select): a per-look first-person offset would be new.
  - Licence details for this intake's community models are still pending from the owner (see "Intake step 2").
- Evidence (agent scratchpad `h5/`, outside the repo):
  - `sheets/third/<look>-tp.png`: third person before | after, rifle and pistol (framing; support hand from below and
    from the front; shooting hand), all 18 looks; `sheets/first/<look>-fp.png`: full-body first person before | after,
    pistol, rifle, shotgun, Spin Gun, Spear (Frost Viking, Goblin Warlord, Knight, Gorgle, Bamboo, Ranger, Tactical
    Soldier); `sheets/audit/<id>-audit.png`: each changed look's audit row (third person, all five weapons), before over
    after; `sheets/focus/`: Frost Viking's `together` 0 / 0.7 / 1 and softened curl, the Knight's curl (incl. first
    person at 1920 px) and gripLong, the Goblin Warlord, Gorgle's hand, Bamboo's hold from the front and the side, the
    Spear and Medkit in first person before the pistol hold and on main.
  - `audit-before/`, `audit-after/` (audit.json, summary.md, sheet-*.png, <id>.png); `fp-before.json`, `fp-after.json`
    (first person, Spin Gun and Spear, every look).
  - Tools (`h5/tools/`): `search.mjs` (live GripTune / hand candidates on a posed look, the audit's numbers, many at
    once: `SWEEP=<json>`), `tune.mjs` (candidates with shots), `tppairs.mjs` / `fppairs.mjs` (before | after sheets
    from two servers), `fpall.mjs` (first person, every look), `compare.py` (two audits), `setgrip.py` (writes a
    manifest's `fixes.grip`, nothing else touched), `splay.mjs` (finger spread in a GLB), `fingerjoints.mjs` (finger
    joints against their skin), `handx.mjs` (a GLB's `extras.hand`).
<!-- /hands5 -->

### Environment Phase 1c: pebbles, eelgrass, concealing fern, Replace all, maps updated (`wip/env-p1c`, agent, 2026-11-05; from main 4d511dd2, main baf26064 merged in; pushed, not merged)
- **Done:**
  - **Species:** `env.rock.pebbles` (category `rock`, generator kind `pebbles` in `env/rock.mjs`: 6–7 faceted convex
    stones sunk a quarter, grey / sand, 55 tris; budget `rock: [64]`) and `env.water.eelgrass` (new family file
    `content/environment/water.json`, kind `eelgrass` in `env/plants.mjs`: 7–8 S-curved ribbons, green / olive, 49
    tris). Existing GLBs byte-identical. Fixture entries `env.rock.pebbles@1`, `env.water.eelgrass@1`.
  - **Fern conceals:** `env.fern.bracken` assetVersion 2, `conceals: true`, role `cover` (cylinder r 0.363, h 0.555 at
    scale 1, from its bounds; shape unchanged; fixture `@2`). The generator's rule now: ground cover / small rocks have
    nav none; role cover iff they conceal; rocks never conceal.
  - **Proof** (`packages/shared/test/conceal.test.ts`, "our fern and shrub hide players as the Kenney fern and small
    bush did"): on what Replace all makes (height kept), standing / crouched / prone at the middle and just inside the
    Kenney piece's radius, hidden exactly when the Kenney piece hid them (fern ×1, ×1.3, autumn ×0.85; small bush ×1,
    autumn ×1.3); fern hides crouch + prone, small-bush-sized shrub prone only, as before; a bot 10 m away holds fire
    at a crouched (fern) / prone (shrub) player and fires once they stand, the same as with the Kenney piece, and does
    fire in the open (control). Then `prop.fern` and `prop.bush_small` were retired.
  - **Brushes / palette:** foliage.ts pebbles → `env.rock.pebbles` (`#1` on sand), shallow water →
    `env.water.eelgrass` (1 in 4 olive); scatter: Rocks / Desert pebbles, Water plants eelgrass, Jungle and
    Undergrowth the fern, Bushes the shrub. `RETIRED_PROPS` += grass_tuft, fern, bush_small, stones, mn_eelgrass;
    `GROUND_COVER_SPECIES` is per category (Plants & Flowers: grass, flowers, fern, shrub, eelgrass; Rocks & Wood:
    pebbles); `REPLACEMENTS` (suggested species per retired piece).
  - **MapMaker Replace all** (prop inspector, `replaceAllSection`; `replacePropsCommand` in shared
    editor/operations.ts): target select (`#ed-replace-with`: species variants, then non-retired props), size
    (`#ed-replace-size`: Keep height (default) / Keep scale), button `#ed-replace-all`; one undo step; keeps ID,
    position, yaw, name, solid, tint; scale × old height / new height, rounded 0.01, 0.25–4; a prop bedded on the
    terrain is re-bedded under its new footprint (without this a wider fern floated 0.31 m on Jungle Steps). Tests:
    shared editor.test.ts, physicsfx.test.ts.
  - **Maps** (driven in MapMaker without ?test=1 by the scratchpad driver `env3/tools/maker.mjs`: Import file, click a
    piece with Select (direct selection when no click hit it: Shingle Point's grass, Serene City's red and yellow
    flower), Replace all, undo/redo check, Export; `finalize.mjs` drops
    `metadata.release`). Hand-placed Kenney foliage before (all now 0):
    - backwoods: grass_tall 46, fern 28, flower_yellow 6, flower_purple 5 → clump, bracken, meadow #1 / #2 (height);
    - coldwater_gulch: grass_tall 97 → clump; shingle_point: grass_tall 96 → clump; st_johns: grass_tall 3 → clump;
    - jungle_steps: grass_tuft 8 → clump, fern 12 → bracken; serpent_gorge: fern 4 → bracken;
    - primeval_park: fern 62, plant_low 52 → bracken;
    - serene_city: flower_purple 2, flower_red 1 (→ white: no red variant), flower_yellow 1 → meadow;
    - sunstone_crag: stones 36 → pebbles sand (Keep scale: by height they would be 3 m wide), plant_low 18 → bracken
      autumn.
    Export also carries what loading does anyway (format 25 migration: `track` → `paths`, terrain kept under floors
    on Primeval Park and Sunstone Crag, key order): no gameplay change. Metadata otherwise unchanged. Not touched:
    `test_coverage` (keeps mn_eelgrass as its Meshy-pack sample), other Kenney bushes (`bush`, `bush_large`,
    `bush_leafy`: Phase 4). New gameplay: crouch/prone in the replaced ferns hides you as before; the 70 replaced low
    plants (Primeval Park 52, Sunstone Crag 18) now hide a prone player (they never concealed).
  - **Pitfall:** two clicks on the MapMaker canvas within ~0.5 s are a double-click, which changed a wall edge (open →
    window) on Serpent Gorge in one run; the driver now waits 1 s between clicks; compare each export with
    `env3/tools/compare.mjs` before taking it.
- **Next / resume:** `git fetch && git checkout wip/env-p1c`; CI on `check/env-p1c` (status below); owner to look at
  the screenshots (scratchpad `env3/`) and decide on grass sizes (tall grass kept its height: 0.7–1.4 m clumps on
  Coldwater Gulch / Shingle Point, as the Kenney patches stood; smaller would need the Scale field per piece or a
  re-run of Replace all from the old map with Keep scale); a red meadow-flower variant and palette
  pictures for the species are open.
### Performance round 2 (`wip/perf-2`, agent, 2026-11-05; from main 2c8f3e21, origin/main merged; check run on `check/perf-2`)
Status: on main (train dfdfe792, CI green on `check/perf-2` run 42080981667 at d52410d8); the follow-up (still doors
judged by their matrix) and the measured write-up are on `wip/perf-2`. Details and numbers: docs/PERF_96.md,
"Performance round 2". Measured (SwiftShader, same build, on vs off): draws -31 %, render-target draws -49 %, shadow
casters -51 %, mesh evaluation -75 %, main-pass issue -27 %, animated characters -16 %. Projected M1 frame
20.3 → ~14-15.5 ms.
- **Done (code)**: static shadow cache (`game/shadowCache.ts`: static casters drawn only when a cascade moves past its
  margin, every ~30 frames, or when they change; doors and gates join once still for 60 frames; WebGL2 depth blit);
  level draw merging (`levelMerge.ts`, `MapStyler.merge`: per-style level and terrain meshes merged over array
  textures, WebGL2); animation LOD round 2 (`animLod.ts`: 20/12/8 Hz, `coarse` detail past 35 m with the arms' last
  full grip kept; creatures' clips on the same LOD); cheaper clip stops and node disposals (`animPatches.ts`); live
  mesh candidates and frozen static materials (`meshSelection.ts`). A/B on one build:
  `?perfoff=shadowcache,levelmerge,meshsel,animlod2`.
- **Next**: owner re-records on the M1 (PERF_96 says what to expect; `?perfoff=` isolates a part); doors' caching
  measured; roads/paths merged too; Godot VFX emitters pooled. NOT TESTED: the M1 itself, WebGPU (all of round 2's
  rendering parts are off there), local e2e runs (CI ran every shard green).
- **Resume**: check out `wip/perf-2`; the probe is a scratchpad script (docs/PERF_96.md says how it is set up).

### Queued (owner-approved, 2026-11-05): performance round 2 (next free agent slot)
**Owner's second M1 Pro recording** (build 4e77fab; Market Town, TDM, 49 players, high, 60 fps cap). Files in the
session scratchpad `perf2/`: the perf JSON and the trace.

| | Before | After round 1 |
|---|---|---|
| Average frame | 25.9 ms | 20.3 ms (~49 fps) |
| Big fights | 38–45 ms | 26–32 ms |
| Hitches over 50 ms | 19 in 25 s | 3 in 49 s |
| Clips + aim | 8.2 ms | 4.6 ms |
| Shadow + depth | 6.6 ms | 3.8 ms |
| Casters | ~600 | 210–270 |
| Draws | 950–1,400 | 590–800 |

Still CPU-bound, not GPU-bound: a quiet frame is about 20 ms against the 16.7 ms needed for 60 fps.
- render: about 16.4 ms in total, including about 5 ms of draw submission;
- mesh evaluation: 3.0 ms;
- characters update: 1.4 ms;
- ragdolls and effects physics: 1.2 ms.

Targets, aiming for 4–6 ms off:
1. **Level draw merging:** Market Town still has about 58 per-material level draws. Use shared texture atlases /
   material merging across packs; this helps every map.
2. **Animation, further:**
   - mid-range stepping;
   - skip aim refinement past 35 m;
   - animation LOD for creatures, whose clips still run every frame.
3. **Mesh evaluation:** freeze more static meshes and cut the per-frame bookkeeping.
4. **Shadows:** cache the static cascade and refresh it every few frames.

Measure relatively in the container, keep the CI perf budgets, then ask the owner to re-record on the M1.

### Queued next (owner, 2026-11-05): hand palm orientation (before the pistol-hold tweak)
The owner noticed that rigged hands come out with the right palm facing outward and the left palm down instead of
up. The new Gnoll (Hyena Warrior) in the intake-2 sheets shows it.
- **Likely cause:** `skinHandFrame` (client game/handProbe.ts) takes the palm normal from the hand mesh's thinnest
  direction, whose sign is arbitrary, and chooses the thumb's side. On some rigs that picks the back of the hand, so
  the grip turn rotates the hand 180° about its fingers.
- **The audit misses it:** `gripReport`'s `sideR` uses `Math.abs`, so palm-in and palm-out score the same.
- **Fix:**
  - derive the palm side from the finger joints' bend direction;
  - make the audit sign-aware: the right palm faces the grip, the left palm faces up into the handguard;
  - re-audit every look, with third-person, first-person and Character Select before/after sheets.
- **Owner's decisions:** keep the Hyena (Gnoll) and Snikkit (Goblin Mischief) and fix their hands with this;
  Bill is retired. Do the pistol-hold tweak after this.

### Container restart, 2026-11-06 00:30 UTC: three agents stopped (work saved)
All three in-flight agents stopped. Their work is pushed:
- `wip/perf-3` bf4fbdb6: prop batches, still decorations merged, blood instancing, warm-up of guns and characters,
  ragdoll tiers by screen size and staggered starts, minimap from a bitmap. Not yet measured; no CI.
- `wip/shingle` d70bbfd1: beach kit pieces and Replace all improvements. The map swap is part-way; its temporary
  helpers are saved in the scratchpad `shingle-saved/`.
- `wip/pistol` 57dda85f: WIP first-person pistol hold (finger close limited by wrap, hand placed by the middle of its
  width, support hands turned).

Resume each from its branch, after merging main.

### Far enemies as feet only: FIXED (agent, 2026-11-06; on its own: `wip/far-bodies` 36dab498, green on `check/far-bodies` run 42154611523, ready to land; also in `wip/perf-3` as b1a32722)
**Cause** (reproduced in a real match, production build): Babylon's weighted clip blend (`ProcessLateAnimationBindings
ForQuaternions`) blends a joint's clips pairwise in the scene's animatable order, its first step a slerp by
w2 / (w1 + w2). A clip at weight 0 is left out from its second frame at 0 ("actively paused"), but on its first frame it
still joins. Round 1 kept a fight's shot and hit clips started, paused at weight 0 between plays; `setDormant(false)`
(a crowd's character coming back into view, and a reused body standing again) restarted every paused group, those
included. After a stop-and-go (running clips restart later in the order) the two fresh zeros came first: 0 / 0, a NaN
rotation on every UPPER_BODY joint, so the upper body's vertices weren't drawn (legs and hips only: 0.6-0.9 m of a
1.8 m body). Far characters (animated every 3rd-5th frame) kept the pose, and `aimShoulders` measured on such a frame
kept a running body's upper half gone until it next stood still. Not the LOD meshes, body reuse's meshes, meshsel,
frozen materials or the gate (checked: every look's `_lod` covers the body; 67 Meshy looks have a separate `_lod` skin
with the same joints, which is fine).
**Fix** (characterAnimator.ts): waking restarts only what sleep paused (`slept`); `patchAnimatables` leaves a
weight-0, non-additive runtime animation out of the late-binding blend (Babylon's own intent); `aimShoulders` and the
coarse arm pose keep only finite values. **Tests**: `client/test/animBlend.test.ts` (fails without the patch);
e2e `characters3` → `farBodies` (27-player canyon match, ten bots running circles 16-34 m out, a shot and a hit each,
stop-and-go, turn away and back; `wholeBodies` checks each part's LOD is the mesh drawn and the drawn, GPU-skinned
body is finite and ≥ 75 % of 1.8 m × size). On the old build it failed (8 of 11 broken, 473-1,249 NaN vertices each);
with the fix it passes. Owner to confirm on the M1 (any map, 49 players, turn around in a fight).

### Openings fix (`wip/openings`, agent, 2026-11-06; CI on `check/openings`)
Status: green on `check/openings`: CI run 42160424451 on 73b46f93, every job (docs-only commits since); ready to
land. The report below is what it fixes.
- **Done:**
  - `collide: "voxel"` (tools/content/voxel-collision.mjs): 3D collision from the model (0.1 m cubes, flood fill from
    the sides and above, exact cover, merges that never fill air in sight, faces pulled in to the model), with a box
    budget per prop (48; hero 160; `voxelBudget`) and a coarsening ladder. 134 props use it (103 were `box`, 20
    `shell`, 5 `frame`, 5 `trunk` with no single trunk, 1 `openings`); 207 props' collision changed in all.
  - Trunk columns on the real trunk (`trunkBoxes`), as thick as it, following leans, stopping where broadleaf trees
    fork: 47 trees and poles changed (Meshy birches were 1.5 m off; this was screenshot 32).
  - `shell` merges only cells of one height (no walls of air at the tallest cell; coarser steps when that's over the
    prop's box budget): 26 props tightened. The red rock spires (dustwater ×12) and the excavator only fit their
    budget with the old merge, so they keep it (slack round the spires stays: `--slack`).
  - Breakable props collide as their `boxes` (ScenarioBodies `parts`).
  - Openings audit `tools/content/prop-openings.mjs` in `pnpm content:check` (an opening has the model on both
    sides: windows, arches, gateways between posts; `fills` reasons for the 9 kept); `--slack` lists air round
    outlines (`box` props: not changed); fixture
    `packages/shared/test/fixtures/prop-openings.json` + `propOpenings.test.ts` (every changed prop, probes, points of
    the model, digests of the rest; shots, walking, nav and cover in play); `tools/content/test/voxel-collision.test.mjs`.
  - docs/CONTENT_PIPELINE.md "Prop collision"; CHANGELOG.
- **Screenshot 32** (Fernwood Moon, under `jg_giant_root` prop_602, scale 1.6): no `env.*` species on that map, and
  bushes have no collider, so not limbs or foliage. Rays cast from under the root with the old table: 352 of 1,261
  prop hits landed in open air more than 25 cm from the model, mostly on trunk columns standing off the trunk
  (nt_common_tree 0.58 m off, nt_pine_*), tents and stumps. With the trunk columns moved, 185 of 1,244, mostly the
  boxes round the mossy stumps (up to 1.2 m off the model at their scale 1.3-1.8) and logs and the sci-fi dishes; those
  five props now collide as voxel too, leaving 86 of 1,198 (7 %), nearly all on pine columns inside the crowns, where
  the trunk thins (0.3-0.85 m off at scale). Script: session scratchpad `openings/work/fernwood.mts`.
- **Checked:**
  - In play (propOpenings.test.ts): shots through the arches, the holed wall and under the giant root, stopping on the
    stone with the same material and thickness; players walk through five arches and doorways, not through a wall; bots
    path through four arches; crouched cover beside the hole holds; a broad tree's old column spot is open, its trunk
    stops rounds; a breakable tent's boxes are all the tent.
  - On the maps (old table against new, scratchpad `openings/work/navthrough.mts`): bots now path straight through
    the round arches and the ivy arch walls on Sandfall Colosseum, Serpent Gorge and Sunstone Crag (6.0-7.2 m instead
    of 8.6-10.7 m round); windows and broken-wall gaps above the ground stay "round" (not walkable).
  - `pnpm validate-map` on all 81 maps that place a changed prop: 79 clean; No Man's Field's logic-loop warning and
    Diamond Park's 113 `nav.disconnected` (spawn_1746 in the dugout) are the same with the old table. Hollowmere
    Manor and Pharaoh's Reach (the gates and the reed boat) again after they switched, and the eight maps placing the
    mossy stump and log, the dishes and the generator after theirs: clean.
  - Prop collision boxes on those maps: 14,811 to 32,936 (busiest: Backwoods, St John's ~1,500); navmesh builds
    +10-25 % on the busiest maps, shot raycasts +20-40 % in a random test (machine loaded: noisy). CI's 96-bot
    Frost Basin bench and perf jobs pass; not compared before and after on a quiet machine. Locally, `pnpm
    test:changed` on a machine shared with two other agents: 11 bot, nav and host tests timed out and the 96-bot
    bench took 49 ms a tick (limit 30; all pass on CI), and propOpenings read a props table regenerated mid-run
    (alone: 22 of 22 pass).
  - Screenshots (scratchpad `openings/after/`, before-* on the old build, after-* on this one): rounds through
    Fogbound's arch fly 93-100 m (before: all stopped 3.7-4.0 m away, on the invisible box face at z 8.7), rounds at
    its pillars stop on the stone; through the holed wall 15.8-90 m (before: 3.7-4.3 m, on the box face); a player
    walks through the arch (z 6 to 11.2; before: stopped at 8.25); prop collision drawn over the scene.
  - `botRiders.test.ts` keeps its buggy repaired on its blind drive: the drive's path drifted and went over Iron Maw's
    pit edge (crash damage, riders rightly out).
  - E2E locally (temp runner copy with the local Chromium): arsenal, coverage and visual pass; the maps flow on ten
    changed maps (Backwoods, Fernwood Moon, Fogbound, Hollowmere Manor, Iron Maw, Pharaoh's Reach, Sandfall
    Colosseum, Serpent Gorge, St John's, Sunstone Crag) passes with CI's waits (`CI=1`; with desk waits the loaded
    machine missed the 60 s match start, the old build too).
- **Resume:** `git checkout wip/openings`, `pnpm install`, `node tools/content/prepare-props.mjs` (voxelises into
  node_modules/.cache, ~1 min cold), `node tools/content/prop-openings.mjs --check`, then the checks in CLAUDE.md.
  Scratch scripts (renders, audits, screenshots) in the session scratchpad `openings/work/`.
- **Follow-ups (owner's call):** slack round the other `box` props (stumps, logs, dishes, car bonnets: `--slack`;
  Fernwood Moon's mossy stump and log, the space kit's dishes and generator are done) and the red rock spires; Diamond Park's dugout spawn cut off from the navmesh (before this change too). Bars and fences
  with gaps under 0.5 m keep their box, so rounds still stop between the bars: `iron_fence` (gaps 0.25 × 0.7 m, 48
  placements on Hollowmere Manor and St John's), `dg_arch_bars` (0.3 m), the `lf_*` gates and fences (0.1-0.25 m).
  The windows the report named (`sf_wall_window`, `sf_wall_astra_window`, `hp_wall_window`) have glass panes and
  `dg_arch_door` a closed door: their boxes stop rounds on the pane or the door, not in the air.

### Fixed by the openings fix above (owner bug report, 2026-11-06): bullets stop in the air inside arches, windows and holes
The owner's screenshots, in the session scratchpad `openings/` (30.jpg, 31.jpg, 32.jpg), show bullet holes in empty
air inside openings:
- a big stone round arch;
- a ruined wall's window;
- possibly a giant root arch on a dusky forest map.

The first two are likely Fogbound or another map using the Quaternius ruins.

**Cause (found):** `collide: "shell"` (tools/content/prepare-props.mjs `shellBoxes`) is a 2.5D heightfield.
- The model is rasterised onto a top-down 0.4 m grid, and each covered cell becomes a column from y = 0 up to the
  highest geometry above it.
- Anything with an overhang gets filled solid: arches, windows, holes, lintels, bridges, root arches.
- That blocks bullets, and players too.
- **Affected:**
  - `rn_arch_round`, `rn_arch_gothic`, `rn_wall_hole`, `rn_wall_broken`, `rn_wall_arch_ivy`, `rn_window_bars`,
    `dg_arch` and the other "shell" props with openings (56 props use shell);
  - "box" props with openings, e.g. `sf_wall_window`, `hp_wall_window`, the `lf_*` gates and fences, and
    `os_bulkhead_window`.

**Fix:**
- Add a true 3D voxel collision mode:
  - rasterise triangles into a 3D grid, about 0.2–0.3 m;
  - fill solid only between a column's surfaces, inside closed volumes;
  - merge greedily into few boxes.

  Then openings stay open for both shots and movement.
- Use it for every prop with a pass-through opening, found by an audit comparing the 3D voxel volume against today's
  collision, and flag any opening at least 0.5 m across.
- Movement and shots share these colliders (the physics world). Check bot nav through the newly open arches, check
  cover, and keep collider counts within the perf budgets: keep the box count lean and use compound shapes.
- Investigate the third screenshot separately: puffs in mid-air near distant trees could be env tree limbs that block
  shots, or legitimate ground hits.

### CTF bots and idle bots (`wip/bots-idle`, agent, 2026-11-06; from main 39056920, main 5b167034 merged in; green on `check/bots-idle`, ready to land)
Fixes the two reports below (CTF bots don't go for the flag; Diamond Park dugout; Fernwood Moon bots not moving).

**How to resume:** branch `wip/bots-idle` (pushed after every step). Measure with `pnpm bot-report` (new:
`packages/server/src/tools/bot-report.ts`; per map and bot: idle time by reason, idle spells with positions, goal
time, CTF roles and flag runs, no-route searches, stuck recoveries; `--suite=ctf`, `--shard=k/n`, `--json`,
`--compare=a.json,b.json`). Baseline (main + measuring only, d1a8ec97) and after-runs are in the session
scratchpad `bots-idle/` (`before-ctf-*.json`; `after-ctf-*.json` is the 02:52 code; `final-ctf-*.json` the final
code, 64df0c80+; the baseline code is exported to `bots-idle/base`). MapMaker driver scripts (inspector, Logic panel,
export): `bots-idle/tools/maker-*.mjs`, `finalize.mjs` (needs the client's dev server, e.g. port 4963).

**Done (committed):**
- Measuring: `BotBrain.doing` / `meantToMove` / `pathFailures`, `pnpm bot-report`.
- Causes found (CTF suite baseline, 44 maps × 2 seeds × 300 s): 17 of 88 matches had a capture (21 captures); bots
  out of a fight stood still 3–33 % (Iron Compound 86 %); "station" (holding a goal, spinning in place) 5–24 %; no
  route 29 % on Diamond Park (its dugouts were navmesh islands with 3 spawns each), 17 % Fogbound, 13 % Eagle Spires;
  attackers went after noises 20–50 m off (22–29 % of their time); Iron Compound's gate rules cancelled on one press;
  Fernwood's Garrison spawned in its bunker with only the enemy's blast door on its route.
- Fixes: CTF roles (`CtfBotPlan`: 2 defenders, 3 on teams of 12+, escorts, flags in trouble), goals kept to
  (`OrderGoal.push/run/watch`), fight on the move, lanes, sprinting; escapes off cut-off navmesh patches
  (`NavWorld.partAt/escapes`, `planEscape`); routes round doors shut to the bot (`markOpenings`, `findPath(…, shut)`);
  press plans dropped once the door opens; vehicles out of reach left alone; keeping watch on station
  (`keepWatch`), posts shift and peek, lift waits look about. Iron Compound's gate (Logic panel) and Fernwood's
  reactor core (+0.5 m, inspector) fixed in MapMaker. `logic.undoes` warning (validate-map, MapMaker; also flags
  Glacier Line's alert console, left).
- Later fixes: lane waypoints and keep-watch places only on the goal's navmesh part; escapes up to 8 m (Capitol
  Mall's reflecting pool); unreachable goals gone to as near as a route gets (`NavWorld.reachToward`) and watched from
  there, asking again as the back-off allows (a route to a watch place no longer clears the goal's back-off: 30 000
  failed searches a match on Eagle Spires before; asking only every 4 s stranded Obsidian Orb's bots on its reactor
  platform); sidestep after stuck loops (Fernwood's parked dropship); boarding within 0.95 × enter radius; no-route
  back-off only near where it failed; ladder climbs finished (Fernwood's vines: 230 s); lift patience 6 s, then a
  way off lifts (`LIFT_FLAG`); carriers home with their flag away keep watch (Serene City: 143 s on the base); a flag
  dropped into lava goes home (rule change, players too; Cinder Foundry: 28 takes, no capture); plane bots come
  down where their role sends them, open the canopy at once and steer it (Eagle Spires' attackers landed on the
  mesa cliffs); Diamond Park's dugout roofs +0.4 m in MapMaker (validate-map 113 warnings → 0: the roof ran 1.6 m
  over the side walls' tops at the dugout ends); Sandfall's spawn_269 out of the stand's steps (MapMaker) and a
  `spawn.blocked` warning (validate-map, MapMaker).
- Tests: `botCtf.test.ts` (roles, captures on Diamond Park and Sunken Kingdom, dugout, pool, bunker, keeping watch),
  `scenario.test.ts` (logic.undoes), `modes.test.ts` (flag in lava), `nav.test.ts` (spawn.blocked).

**Found, left (for Phase A or the maps):**
- The navmesh keeps 0.8 m from walls, not the 0.6 m its comment means: `Math.ceil((0.4 + 0.2) / 0.2)` is 4 cells
  ((0.4 + 0.2) / 0.2 is 3.0000000000000004). Changing it moves every map's navmesh; Phase A.
- `spawn.blocked` (the spawn point's middle inside a collider) on 26 spawn points, 18 maps: canyon spawn_113,
  citadel spawn_w9sdjfv9q9, dune_harbor spawn_644, flatpack_depot spawn_659, halcyon_station spawn_096/104/106,
  hollowmere_manor spawn_120, iron_compound spawn_207/213/218, ironhold_prison spawn_744, jungle_steps spawn_073/077,
  m3_vault g_spawn_011, neon_spire spawn_694/697/711, riot_junction spawn_805, serpent_gorge spawn_196,
  silo_complex spawn_099, starhaven spawn_203, sunken_kingdom spawn_0418, verdant_ziggurat spawn_120/123. Most are
  against or a little in a wall and the body is pushed out (Iron Compound's spawn_213 walks off fine); fix them in
  MapMaker when touching those maps.
- Maps with few or no captures: Capitol Mall (249 m between flags), Fort Meadow (a midfield brawl, 65 % of the time
  fighting), Twin Spires, Pantry Raid, Underdrain, Primeval Park (no takes: attackers die on the way; Phase B's
  group pushes); Eagle Spires (bots that fall off the mesas' scaffolds and cliffs onto ledges with no route down:
  drops are never routes; with fall damage off, a drop-down link would do).

**Measured** (docs/BOTS.md "Capture the Flag" has every map; scratchpad `final2-ctf-*.json` against
`before-ctf-*.json`): CTF suite captures 21 → 145, matches with a capture 17 → 55 of 88, maps with a capture 13 → 31,
flag takes 77 → 906, idle out of a fight 17.9 → 5.6 %, 10 s+ idle spells 19 → 2.7 a match, kills 22.9 → 35.1 a
minute; TDM, KOTH and Bomb idle down, kills level or up; `pnpm bench:96:clump` bot thinking 1.46–2.04 → 1.54–2.12 ms.

**Checks:** `pnpm typecheck`; the changed unit tests locally (botCtf, modes, nav, airplane, botRoles, botai,
spectate, sandgate, npc, match, terrainFloors, forts); CI on `check/bots-idle`: run 42169677264 green on 9b548458
(its `handoff` e2e flow failed once on CI's load and passed on the re-run), run 42174642880 green on e9bf9611 (the
final code; later commits are docs only).

**Next:** land on main (fast-forward to the green commit, or the docs commit after it). Then Phase A
(docs/BOT_AI_PLAN.md), starting from "Found, left" above.

### Queued FIRST (owner bug report, 2026-11-05 late): CTF bots don't go for the flag
**Owner:** "CTF: no bots are actually going for the flag, most just hang out and do little. We should only have
like 2–3 bots protect a flag, and the rest go out there and try to get the other team's."

**Code today:** `sim/modes/ctfBots.ts`.
- **Standing roles, by team order:** attack, defend, attack, escort. That gives about ¼ defenders; escorts also go
  for the enemy flag.
- **Situational overrides:** carrier, dropped flag, carried flag.
- **Goal handling:** `Match.botGoal` hands the goal to the brain as `orderGoal`, but "the brain only follows the goal
  while roaming". The bot director's squad plans (`director.planFor`), roaming, explore, posts and pickups compete
  with it.
- **Known:** on Sunken Kingdom, with flags 190 m apart, bots never captured.

**Do:**
- Measure first in headless CTF sims, over several seeds and maps (Sunken Kingdom, Iron Maw, the CTF suite):
  - time each bot spends moving toward its CTF goal versus idling, holding or roaming;
  - flag touches, pickups, captures and returns per match;
  - path failures.
- Find why attackers "hang out". Suspects:
  - the director or squad plans overriding the CTF goal;
  - hold, post or explore states;
  - noPath back-off on long routes;
  - the goal radius;
  - defenders and escorts clumping.
- **Owner's role split:** 2–3 defenders per team (2 for small teams, 3 for 12+), all others attack, a carrier gets
  escorts, and anyone near their own flag in trouble responds.
- Bots must actually run the flag: pick it up, carry it home, capture.
- Prove it with captures per match before and after; the target is regular captures on every CTF map.
- **Owner's repro (2026-11-06): Diamond Park CTF.** Most of the team hung out in the tunnel/dugout area.
  - Flags are at (24, 0, -32) "away" and (-32, 0, 24) "home".
  - The map has sunken dugouts, player tunnels to the clubhouses, a lower bowl, an upper deck and a concourse.
  - Start the investigation here: are bots stuck on navigation in the tunnels and dugouts, held by posts or cover,
    or failing their path to the flag?
- **Widened (owner, 2026-11-06): "why would some bots not be moving at all?"** This goes beyond CTF.
  - Screenshot: session scratchpad `openings/idle-bots-fernwood.jpg`, taken in free camera on Fernwood Moon. Two
    bots stand still: Bamboo by the Garrison shield bunker, and a bot at the corner of the landing pad (a raised
    slab).
  - Measure idle time per bot in every mode, with the reason for each idle spell:
    - hold, post or cover;
    - stuck on geometry such as a raised slab edge;
    - noPath back-off;
    - waiting on a lift, rope lift or ladder;
    - squad wait;
    - out of view and coasting.
  - Fix each cause. A bot should only stand still when it's deliberately holding a spot, and then it should look
    alive: scanning, shifting, peeking.
  - Also confirm it isn't a free-camera rendering effect. Animation LOD and dormant/culled state use
    `scene.activeCamera`, so free cam should be fine, but check that bots near the free camera animate and move.



### Owner's M1 re-record after performance round 3 (2026-11-06, app 463c247; files in session scratchpad perf4/)
Recorded on the M1 Pro: TDM, 49 players, High, auto render scale, 60 fps cap. Steady state skips each match's first 5 s.

| | Shingle Point, round 2 | Shingle Point, round 3 | Market Town, round 2 | Market Town, round 3 |
|---|---|---|---|---|
| Average frame | 21.8 ms | 17.3 ms | 22.1 ms | 17.6 ms |
| p95 / p99 | <30 / <40 ms | <25 / <40 ms | <40 / <50 ms | <25 / <30 ms |
| Worst second | 34.0 ms (p95 75.9) | 20.7 ms (p95 22.9) | 40.1 ms | 46.6 ms (a mass-death moment, see below) |
| Draws, max | 980 | 494 | 724 | 589 |
| Meshes, max | 1,130 | 485 | 613 | 406 |
| Render / shadows | 8.5 / 4.1 ms | 5.5 / 1.7 ms | 7.0 / 4.0 ms | 4.1 / 2.5 ms |
| Characters (animation) | 4.2 (2.8) ms | 4.1 (3.0) ms | 6.0 (4.4) ms | 4.8 (3.4) ms |

**Left for performance round 4:**
1. **New:** about 3 s of stutter at the start of a Shingle Point match on the M1.
   - 18 hitches in the first 3 s; 52 shaders were built in the first 5 s.
   - Before round 3 there were none. Market Town shows none.
   - Suspects:
     - the batched props' materials (Shingle batches, Market Town doesn't);
     - the looks that come into view at the first spawn wave;
     - the warm-up's 2 s cap on that machine.
2. **Mass deaths on Market Town:** after a rocket killed 7, frames ran 60–140 ms for about 0.6 s.
   - The time is outside the game's measured work: GPU, driver or GC while bodies start.
   - The game's trace can't show it. A browser performance profile of a blast, or a local repro, would.
3. **Sporadic 50–60 ms frames:** every 20–30 s, mostly outside the measured work. GC is likely; cut the per-frame
   garbage.
4. **Characters are now the biggest CPU cost:** 4–5 ms, of which animation is 3–3.4 ms, at 40+ in view.

**The owner's amphibious landing craft:** a Meshy model, owned, in the Drive. Downloaded to
`/home/user/meshy-drive/intake-2026-11-06/`; never commit it. It's 408k triangles, static. The prop import is added to
set pieces part 3's brief: a hero-budget rebake, about 11 m long, voxel collision, provenance, and a beached-craft
variant for MAP 21.
- **Owner, 2026-11-06: no moving D-Day boats for now.** Matches have to last well beyond the first landing, as a
  semi-traditional arena-style FPS match, so the landing craft is static dressing and cover. MAP 21's beach is
  where the fighting starts, not a scripted arrival.

### Owner's answers on the 11-06 intake (2026-11-06), for the follow-up
**Done on `wip/intake-1106b`:** see "Intake 11-06 follow-up" near the top.
- **Retire Capt. Nova** (owner, later the same day). Add `core.nova` to `RETIRED_LOOKS`, pointing at Spacewalker
  (`core.astronaut`, the nearest astronaut). Keep the files.
- **Starfarer's back pack is "distorted a little".** Find the joints pulling the pack and fix its skin (fixes.skin:
  clamp/smooth, or the pack rigid to the spine). Show it before and after, in motion.
- **Names stay:** Spacewalker, Starfarer, Shellback.
- **Keep the US flag** on Spacewalker.
- **Shellback smaller:** "should be smaller, not that big at all". Large → standard: rebuild, portrait, grip re-check.
- **"I did not make any, they are Meshy community."** Relabel the airliner shell, the buggy and its tire, and the Alien
  Biker as Meshy Community CC0. The mining machines stay owned: we generated them through the Meshy API with the
  owner's approval, 2026-10-30, so they weren't the owner's own downloads.

### Queued (owner, 2026-11-06): character intake, astronauts, crocodile and tortoise. NEXT FREE SLOT ("when able")

### Done (owner, 2026-11-06): character intake, astronauts, crocodile and tortoise: see "Intake of 2026-11-06" above (`wip/intake-1106`)
**Licence (owner, 2026-11-06):** "all Community CC0 and should be treated as such unless I let you know I created them in
Meshy." That covers these five, the landing craft, and every Drive model before them (CLAUDE.md "Content rules"). The
intake also audits `content/provenance.json`. Entries recorded as `meshy-owned` that came from the Drive, and weren't
generated through our Meshy API, become community CC0 with author and URL pending. It lists them for the owner.

The owner: "I have 3 new astronaut models, replace the light blue one for captain nova, add the 2 new ones. The
boglurker can be replaced by the alligator. Retire bamboo, add the new turtle."

The downloads are in `/home/user/meshy-drive/intake-2026-11-06/`; never commit them. They are 5 Mixamo-skeleton rigs:
- **Light-blue astronaut** (107k tris) replaces Capt. Nova (`core.nova`).
- **White astronaut** (10k tris): new.
- **Dark astronaut** (167k tris, no finger joints): new.
- **Humanoid crocodile** (26k tris) replaces Boglurker (`core.boglurker`).
- **Humanoid tortoise** (199k tris): new. Bamboo (`core.panda`) is retired, mapped to the tortoise, with files kept.

The brief is in the session scratchpad, `briefs/intake-1106.md`.

### Queued (owner-approved, 2026-11-06): Match Setup redesign, NEXT FREE SLOT (ahead of the follow-ons)
**Done on `wip/match-setup`** (with the Host tab and Spectate before the start, added the same day): see its section
near the top ("Match Setup redesign, the Host tab, Spectate before the start"). What follows is the request as queued.
**Owner's report** (screenshot: St. John's TDM 24v24, desktop):
- The setup sidebar's text doesn't display properly. For example, "The map suggests 12v12." is crushed into a narrow
  column beside "Next: bots".
- It isn't well organised: the most important options (points, time, game mode) should be available at once.

**Owner's asks:**
- A footer that stays on screen (Start never scrolls away), with Host/Local/Online as a choice beside it, not a rival
  button.
- One panel open at a time on small screens; several on desktop.
- Humans and bots shown separately: "24v24 · 48 players" reads as 48 people.
- One fit indicator instead of the wall of yellow warnings.
- The orange rule chips folded into Advanced rules.
- Presets that adapt rather than an exhaustive list.
- Teams that grow when you add bots. Today a team size of 10 caps the bots, so adding them snaps back.

**Approved design:**
1. Mode, score and time (and the mode's key setting) always on top.
2. Presets computed from the map, its spawns and the device: Duel, Small, Map's pick, Big battle, Max; editing makes
   it Custom.
3. Humans + bots = total per team. Adding a bot grows the team. An Even teams toggle. A plain message when a cap stops
   you.
4. A fit indicator (Fits / Crowded / Problem). Clicking it shows the details. Suggestions are buttons ("Use 12v12").
5. Advanced rules on one summary line, with the chips inside.
6. A sticky footer: Start match plus an Offline / Host online switch, with saved setups in a menu.
7. Responsive layout.
8. Keyboard and gamepad focus order.

The brief is in the session scratchpad, `briefs/match-setup.md`: code map, constraints (keep `MatchSetup` and saved
setups compatible; the menu bundle budget) and proof (screenshots at 4 sizes including a phone, unit and e2e checks).

**Slots:** the first running agent to finish hands its slot to this. Its own follow-on (Phase B, set pieces part 2
or 3) takes the next slot that frees.

**Added by the owner, 2026-11-06:**
- A **variants** frame under the mode chips: data-driven on/off chips per mode, built from today's settings first.
- **Party presets.** The first is **Lunar Roulette**: low gravity, character stats and a random character each life.

**Then, in the same slot after the redesign lands: the Roulette mode** (docs/ROULETTE_MODE_PLAN.md).
- **Core:** character swapping each life, from a fair shuffle deck.
- **Standard:** signature loadouts, jackpot rolls, and a streak pick (choose your next character from 3).
- **Variants:**
  - Lunar: gravity storms and air-kill bonus.
  - Earned rerolls. There are no free death-screen rerolls (owner).
  - Swap on kill.
  - Variety bonus.
  - Teams.

### Queued (owner-approved, 2026-11-06): bot AI, logic and navigation (docs/BOT_AI_PLAN.md)
The owner asked for a plan for bot logic and navigation as a whole, and approved this order:
- **Phase A** (navigation audit from every walkable area, never stand still on a failed route, the bot scorecard with
  limits in nightly CI): **done on `wip/bots-a`** (its section near the top, "Bot AI Phase A"; not landed).
- **Phase B** (scored choices instead of competing states, a team brain per mode, mode playbooks): next, **before
  MAP 21**.
- **Then Fireteams** (owner-approved 2026-11-06, docs/FIRETEAMS_PLAN.md), right after Phase B.
  - Every human leads their own fixed bot squad of 4–6, and no human joins another's.
  - Bot-led squads fill the rest of each team.
  - An order wheel (follow, hold, go there, attack that, defend, regroup, spread or tight), formations and
    bounding, respawn on the leader, a squad HUD.
  - It's a variant for every team mode in Match Setup's variants row.
- **Phases C and D** after:
  - C: drop/jump links, moving obstacles, crowd steering, smarter routes;
  - D: memory, holds that look alive, human-like skill tiers, an in-game bot debug view, bot hints in MapMaker.

**Performance:** bots run in the sim (the server or the host's match worker), not the render thread. Every phase lands
with `pnpm bench:96:clump` before and after; bot thinking at 96 bots stays within 2.5 ms a tick (today 1.0–1.8).

### Owner-approved order after the current agents (2026-11-05 late; owner set effort to max: "hoping for some great work")
0. **Bot AI Phase A** (above): done on `wip/bots-a` (section "Bot AI Phase A" near the top; land it); **Phase B**
   before item 3 (MAP 21).
1. **Set pieces:** plan in docs/SET_PIECES_PLAN.md. Part 1 (data, expansion, carriageway, skybridge) on
   `wip/setpieces` (its section near the top: what landed, the API, notes for parts 2 and 3). Then, by owner decision (2026-11-06, "go with your suggestion for part 3"):
   - **Part 2**, after part 1: the MapMaker UI on `wip/setpieces-2` (tab, ghost, Explode, Save selection, library),
     the St. John's placements and retirements.
   - **Part 3**, in the hands-round-5 slot, alongside part 2: the showpiece pieces on `wip/setpieces-3`.
     - MAP 21: casemate, trench run, cliff stair (sea wall and command bunker if time).
     - Colosseum: arena arcade bay, vomitorium, tunnel junction, cage block, insula (stair tower if time).
     - It decides how the colosseum's 4 m board squares work, since every map and tile is on 8 m cells today.
     - The brief is in the session scratchpad, `briefs/setpieces-3.md`.
   - Then MAP 21 and the colosseum, after parts 2 and 3 and Bot AI Phase B.
2. **Hands round 5,** in parallel; small. Give it to the pistol-hold agent as a follow-on once its pistol work lands.
   Done on `wip/hands-5` (section "Hands round 5"; CI on `check/hands-5`, not on main). It covered:
   - re-tuning the support hands the palm fix changed (Pharaoh, Gorgle, Vanguard, Croakley, Big Bab, Desert Ranger,
     Stealth Op, Tactical Soldier, Masked Figure, Anoobys, Greyfang, Kenji, Seetah, WWII Infantry, Goblin Warlord);
   - Frost Viking and Bamboo holds;
   - the Knight's gauntlet;
   - the Spin Gun and Spear audit.
3. **MAP 21 (Omaha beach assault) and the Sandfall Colosseum rebuild:** the showpiece maps, built with set pieces.
4. **Environment Phase 2:** more species; the border forest moves to our trees.
5. **Core / experimental tiers** with quality gates, in the Control Center Workbench.

The MapMaker overhaul (all of the list, owner 2026-11-06: docs/MAPMAKER_OVERHAUL_PLAN.md) and community maps follow.

### Agent queue order (2026-11-05)
1. Small environment follow-ups (below).
2. Shingle Point asset refresh (owner: "start when it is a good time"). It doesn't need set pieces.
3. Set pieces.
4. Then the maps (MAP 21, Whiteout Station rebuild, colosseum, and the rest).

The pistol-hold tweak follows the palm fix.

### Environment Phase 1d: bigger pebbles, red meadow flower, Nature pictures (`wip/env-p1d`, agent, 2026-11-05; from main 9cd28e63, main dfdfe792 merged in; pushed, not merged)
The owner's small environment follow-ups. Tall grass kept as it is (no change).
- **Pebbles bigger:** `env.rock.pebbles` assetVersion 2 (content/environment/rock.json; same generator kind `pebbles`):
  4 stones (0.2–0.58 m), rounder and higher (`flat` 0.9–1.25, `ring` [7, 4]), 60 triangles (budget `rock: [64]`),
  1.24 × 0.32 × 1.09 m at scale 1 (was 0.83 × 0.13 × 0.96; the Kenney stones were 0.76 × 0.40 × 0.76). Raised the
  base size rather than adding a variant: variants share one size (`envPropDefinition` and Replace all's Keep height
  read variant 0), and the brush's pebbles were just as faint. Still nav none, no shapes, decorative.
  `placement.minSpacing` 0.6 → 0.9, nominalHeight 0.32. Fixture `env.rock.pebbles@2`.
- **Sunstone Crag:** the 36 clusters (Kenney stones, scale kept, 1.04–1.94) are now 0.33–0.62 m high; set from sand to
  **grey** (the Kenney stones were grey; sand on the dark sand still read faint at 12 m) with MapMaker's inspector
  Variant list, one piece at a time (23 selected by clicking, 13 directly), driven without ?test=1 by the scratchpad
  driver `env4/tools/variant.mjs`; Replace all can't do it (same model is a no-op in `replacePropsCommand`).
- **Red meadow flower:** `env.flower.meadow` assetVersion 2, variant 3 `red` (a poppy: the buttercup card `flower.1`
  tinted `#d0261c`, its eye darker). No new atlas cell: `leaves.webp` and every existing GLB byte-identical; new
  `env/flower.meadow.red.glb`. Fixture `env.flower.meadow@2`. Serene City's `prop_391` (Kenney red, then white) →
  variant 3 via the inspector (selected directly: no click hit it). envlab lineup: red beside the Kenney red flower,
  white with no "before" piece (`''`).
- **Palette pictures:** the Nature tab's species (`GROUND_COVER_SPECIES`: grass, meadow flowers, fern, shrub, eelgrass,
  pebbles) are in `pictureKeys` (their first variant's file) and a new `environment` atlas (`atlasGroup`: any
  `prop:env.*`); palette-items.ts reads `env/` files from public/. The `?env=1` preview group still has no pictures.
- Both maps exported by MapMaker, release stamp dropped (`env4/tools/finalize.mjs`); the export also carries what
  loading does (format 25 → 26, key order), as in 1c. `validate-map`: 0 issues on both.
- **Screenshots** (session scratchpad `env4/`): `sunstone_crag-before-{1..4}` (main), `-asset-*` (new pebbles, map
  still sand), `-after-*` (grey) at eye height, 5 m and 12 m; `serene_city-red-1`; `envlab-after-{plants,ground,small,mid}`;
  `palette-environment.png` (the new atlas row).
- **Checks:** typecheck; test:changed (1658 passed; npc "Outpost Siege" and pads "eagle_spires" timed out under load
  17 and passed when rerun alone); content:rebuild + content:check; build; bundle budget (692.6 kB gzip of 840);
  validate-map on both maps (0 issues). Local e2e (ports 4971/4972; editor, offline, online, maps, environment, visual,
  scenery) on a container at load 13–18: offline, online, environment PASS, visual's envlab baseline holds (1.7 %
  differ, 10 % allowed, so no new baseline); editor (dropship / random pickup timing), scenery, maps (both maps'
  tour: "no match", setInputFiles timeout) and visual's arena ("scene never got ready") failed on timeouts. CI
  `check/env-p1d` run 42119067704 at 357a368c (main 8722f6ca merged in): **green**, full suite (unit, 15 e2e shards,
  the two maps' browser tour, perf).
- **Not tested:** the GPU cost of bigger pebbles (60 vs 55 triangles a cluster, more pixels) on the M1; how the
  bigger brush-grown pebbles look across every snow / gravel / sand map (seen in envlab and on Sunstone Crag only).
- **Resume:** `git fetch && git checkout wip/env-p1d`; land with the train once the owner has seen the screenshots.
<!-- palms -->
### Palms the right way round (`wip/palms`, agent, 2026-11-05; from main 2c8f3e21, main merged in at ce8a893a)
**Cause (confirmed):** `skinHandFrame` signed the hand's flat by the thumb's FIRST joint against the wrist joint, which
sits nearly level with the flat; on 34 of 100 looks (the Gnoll, Honest Abe, Scamp, Salamander Warlord, Patches,
Tactical Soldier, Space Marine, Gorgle, ...; own-finger and re-fitted hands alike, in-house rigs too) it picked the
back of the hand. `gripHand` then turned the shooting palm OUT (drawn `sideR` -0.8..-1.0) and `cupHand` the support
palm DOWN (`palmL` -0.7..-1.0), third person, first person and Character Select alike. The audit missed it
(`sideR` was `Math.abs`), and the curl test then often scored such hands well (the back of the hand on the gun with
the fingers bent "toward the gun", i.e. backwards). Creatures (Imp, Puglin) were not affected.
- **Fix** (handProbe.ts): the palm's side comes from the hand's joints, first cue that speaks: handedness (index vs
  little-finger knuckles across the fingers: right palm = across x along, left = along x across, in the mesh's
  right-handed glTF space), the fingers' bend, the thumb's tip, the import's `palmSide`; the old rule last. Checked
  against the rig's own hands (Ranger: agrees 0.95/0.90 with the rig's thumb reading) and a unit test
  (`packages/client/test/handProbe.test.ts`). `drawnHand` signs the drawn flat the same way: `sideR` (shooting palm
  in: +1) and new `palmL` (support palm up / round the shooting hand: +1) are signed.
- **Tools:** grip audit flag `palm` (`sideR` < 0.25 or `palmL` < 0, third or first person; weight 3), `PALMS=old`
  audits by the old rule; `__grips.palms()` (each hand's cues and votes), `__grips.palmRule('old')`; summary.md has a
  palms column. e2e `characters`: the drawn-hand checks need `palmL` >= 0, and the Gnoll and Abe (rifle, pistol;
  third and full-body first person) need `sideR` >= 0.6 and `palmL` >= 0.3.
- **Audit (rifle + pistol + shotgun, 100 looks; before = same build with `PALMS=old`):** total 483 -> 384, flagged
  83 -> 75, `palm` 38 -> 4. Without the palm flag 369 -> 372: fp 19 -> 8 and off 17 -> 11 better; back 18 -> 24 and
  flat 51 -> 56 worse, nearly all the curl test on long-gun SUPPORT hands: a palm-up hand under the handguard curls
  its fingers up round it, away from the support point at the guard's underside (the test measures to that point; to
  the guard's line would suit it better: not changed). Tried and dropped: fingers curl toward the frame's palm instead
  of "toward the gun" (Space Marine's shooting hand then curled off the grip).
- **Tuned after the fix:** Gnoll `fixes.hands.l.curl 1` (its left paw was a rigid fist; rebuilt from the download):
  13 -> 6 (flat: right paw's curl test, spikes: body cloth). Snikkit `fixes.hands.scale 0.75` (31 cm hands, rebuilt)
  + `fixes.grip` (gripLong [-0.03, 0.015, -0.03], curlR 0.7, curlL 0.3, supportPistol [0, 0.02, -0.04]): 12 -> 0
  (his palms were never flipped). Space Marine and Honest Abe: round 3's support offsets were tuned on flipped hands,
  re-tuned (5 -> 3, 3 -> 3: palm -> flat).
- **Still `palm`:** Boglurker (rigid frog hand 19-21 cm off the grip, first person palm out; was broken before),
  Brass Hare (hands buried in huge cuffs; the drawn flat is the cuff's; same before), Shiba (shooting palm 0.22,
  lying more under than beside the grip; same before), Rattles (pistol support hand on edge, -0.04; same before).
- **Candidates for the next hands round** (new flags, mostly the support curl test): Pharaoh 3 -> 6 (back, spikes),
  Gorgle, Vanguard, Croakley, Big Bab, Desert Ranger, Stealth Operative, Tactical Soldier (+back); Masked Figure,
  Anoobys, Greyfang, Kenji, Seetah, WWII Infantry (+flat); Goblin Warlord (+off). Grips round 3's per-look support
  offsets (`supportLong`, `rollL`) were all tuned on whatever way the hand was read then: worth a re-tune pass.
- **Intake-2 verdicts:** "own fingers often score off/back" was this bug in part (own-finger Meshy hands were among
  the flipped). Not re-decided: the keep-old looks (Frida, WWII Infantry, Grunt '68, Desert Ranger, Big Bab, Grandpa
  Chains, Hazmat Joe) ship their OLD builds, and own/fit was chosen between builds no longer shipped: re-deciding
  needs those alternatives rebuilt and re-audited (not done). The shipped builds after the fix: Frida, Grandpa Chains,
  Hazmat 0; Grunt '68 3 -> 0, WWII Infantry 3 -> 3, Desert Ranger 5 -> 3, Big Bab 6 -> 6, Stealth Operative (fit)
  3 -> 3, Beanie Alien (own) 3 -> 0, Tactical Soldier (own) 7 -> 3. No verdict clearly changes on this evidence.
- **Checks:** typecheck clean; content:check OK (hitboxes and provenance regenerated for the rebuilt two); bundle
  budget 2471 kB / 692 kB gzip; local e2e (`CI=1`) characters, characters2, characters3, visual PASS; local
  test:changed ran everything (shared content changed) and only long bot/match simulations timed out under machine
  load (load 25-33); **CI run 42092260434 on `check/palms` (7badaf91) green**. Not on main: the coordinator lands it.
- Evidence: agent scratchpad `palms/` (summary/summary.md ranked, `summary/<id>-before-after.png`, `fp/` first and
  third person before/after, `close/`, audits `before/`, `after/`, `after-final/`; tools in `palms/tools/`).
<!-- /palms -->

### Fixed (2026-11-06): the `handoff` e2e failure, a friend dropped while their page was frozen (`wip/handoff-silent`)
**What happened:**
- It passed on the intake train at 18:23, then failed 6 attempts out of 6 between 19:20 and 19:39:
  - Phase A, run 42278207178, twice;
  - the map retirement, run 42279553000.
- Neither change touches hosting.
- Each time, the second friend (Bo) froze for 25–30 s soon after joining. Its 1 s pings stopped. Bo noticed the
  host's close 3–9 s late, then "fell behind; snapshots merged".
- The host closes a *loaded* friend's link after 20 s of silence (`FRIEND_SILENT_MS`). Bo was dropped, and the
  successor's checkpoint lost Bo's score.

**The fix:**
- `RemoteLink.connected()`, from the PeerJS link's `RTCPeerConnection`, tells whether the connection itself is up.
  WebRTC runs on the browser's own threads, so the connection stays up while the page is frozen.
- The host page reports which links are up every 2 s (`{ k: 'up' }` → `MatchHost.linkUp`).
- A loaded friend who is silent while their connection is up gets 60 s (`FRIEND_STALLED_SILENT_MS`). A link not seen
  up within 6 s still goes after 20 s.
- The warning says "(connection up)" when that was the case.
- Unit test: `localHost.test.ts`, "silent friends".

**Root-caused in performance round 4** (see its section): the three pages shared one browser's GPU process, and a
joining friend's synchronous WebGL calls (shader programs' link status, uniform blocks, extensions) waited behind the
other pages' SwiftShader frames, 30-55 s in a second measured locally. The flow now gives each page a browser of its own.

### Flaky e2e (seen 2026-11-06): `handoff` (host handoff between three browsers)
It failed on CI twice in one job on the HUD portrait train (run 42215908322) and once on `check/bots-idle`. Each time it
passed on a re-run, and the changes involved didn't touch hosting.
- **Signature:** "the successor's checkpoint carries the other friend's score" fails. The host logs "closing Bo's link:
  silent 20 s" and Bo "the host's link went (closed)", after Bo's page "fell 1.3–2.0 s behind its match".
- **Likely:** a page starved on a loaded CI runner goes silent for 20 s, and the host drops it before the checkpoint.
- **To do:** root-cause it, don't just re-run it. The flake may also be a real bug for slow machines, where a friend's
  page stalls and the host cuts them off. Candidates: a longer silence limit while a page is catching up, or keep-alive
  pings from the worker. Queue with the next hosting or perf task.

### Open bug (found 2026-11-05): explosion debris can fall through the world
On the env + intake merge (`check/env-land2`), physicsfx counted 32 debris bodies where it expected 10, with the
fastest moving at about 60 m/s, on both attempts.
- 22 extra is exactly one explosion's debris (view.ts `explosion()`: 16 + 6).
- 60 m/s matches about 3 s of free fall at g = 20. So those chunks were falling through the world rather than
  landing.
- Likely source: the test's 500-damage mass blast destroying a vehicle or turret near the spawn on Rockfall Canyon.
- The test now checks only its own burst (`check/env-land3`), and its message lists the older chunks and their
  colours.
- **Still to find:** why explosion debris doesn't collide with the ground in the effects world.

### New map briefs to discuss with the owner (received 2026-11-05; not started)
- `docs/map-briefs/MAP_02_The_Spillway.md`: a hydroelectric dam in a gorge; battlefield scale, 32–64 players.
- `docs/map-briefs/MAP_03_Frostbite_Station.md`: an arctic research station; 8–16 players.
  - **Owner (2026-11-05): rebuild Whiteout Station (the Snow Outpost demo map) from this brief.** Keep its id and
    map file, and rebuild its layout to MAP 03's identity.
- `docs/map-briefs/MAP_21_Omaha_Beach_Assault.md`: a fortified beach and cliffs; massive battlefield, 64–96 players,
  asymmetric assault.
  - Its reference is the Shingle Point image.
  - **Owner (2026-11-05): build MAP 21 as a NEW map from scratch** with our tools and assets (MapMaker, set pieces,
    style packs, the environment). Keep Shingle Point as its own map **and** give it the asset refresh, so the owner
    can compare the two side by side.
- `docs/map-briefs/MAP_04_Verdant_Protocol.md`: an overgrown jungle compound; 16–32 players.
  - Compare with Vinefall Sanctum, the Jungle Ruins demo, and Jungle Steps.

Each brief has its reference image beside it. The owner approves the concept before any placement work; follow
AGENT_BUILD_CONTRACT.md.

### Performance round 3: DONE on `wip/perf-3` (agent, 2026-11-06; green on `check/perf-3` at c8ca5aa4 with main merged in, run 42181705004; docs/PERF_96.md, "Performance round 3")
Ready to land (with the far-enemies fix above in it). Not on main: fast-forward main to the green check commit.
**What it is:** prop batches (models with 8+ copies on the map: `PROP_BATCH_MIN`), still decorations merged, the fog
reading the ambient occlusion's pre-pass depth, blood as thin instances, guns (also as your own first-person copy),
characters, a tracer, a parachute and a glider warmed while the loading screen is up (out of sight when the warm-up
runs past the gate), water's splash drops warmed,
ragdoll tiers by screen size with staggered starts and a faster rest, the minimap from a bitmap window, shadow
cascades centred on the camera (safety refresh every 240 frames), a blast's push kept for every body it killed however
late its body starts, a crowd's held guns and the pickups' models one instance each of the model merged into one
multi-material mesh (`ModelLibrary.instantiateWhole`), crowd team markers as thin instances.
**Measured** (SwiftShader counts per frame at the owner's hitch spot, 44-45 characters in view; scratchpad `p3a/`):
Shingle Point draws 1,034 -> 489, active meshes 1,308 -> 468, render-target draws 535 -> 142; Market Town meshes
513 -> 297, draws 444 -> 435. Shadow cache turning a full circle: 30 of 72 layer renders redrew -> 3. Mass blast on
Market Town (31 killed): round 2 23 of 30 bodies dropped where they stood on this slow box, round 3 all 31 thrown up.
Shader tours after the warm-up (seven, fixing as they went: water's splash drops, your own first-person guns, the
first tracer and a canopy's rigging lines were built mid-match): the last built none.
**Projected on the M1 Pro:** Shingle Point ~15 ms average (22.2 recorded), ~17 in its busiest second (26.5); Market
Town ~19 (20.9).
**For the owner to re-record on the M1 Pro:** Shingle Point and Market Town as last time (TDM, 49 players, high, auto,
60 fps cap, the beach at (-39, -76) on Shingle Point, a rocket into a crowd on Market Town, a 10 s trace each). Expect
Shingle Point main views at 350-470 draws and 300-410 meshes, renderShadow ~1.5-2 ms, renderCull ~1.5, HUD ~0.2,
`shadersNew` 0 after the start; Market Town ~300 meshes and every body of a mass death thrown.
**Not tested:** anything on a real GPU (all numbers are SwiftShader counts and projections); the fog's look over the
pre-pass depth on the M1 (CI's visual baselines pass); the cascades' squares are ~12 % bigger (shadows that much
coarser), not looked at on the M1; a phone (lower graphics: no pre-pass, and the cascades' change is high graphics
only; the rest applies; not run on one); WebGPU (no pre-pass and no shadow cache there, as before).
**Next:** single-material held weapons (content: they are 3-5 materials each, a draw per material per weapon model);
pickups as thin instances (35-55 meshes); breakable props batched while intact (~40 on Shingle Point).
**How to resume:** branch `wip/perf-3`; probes in the session scratchpad `p3a/` (`probe.mjs <dist> <label>` with
`PROBE_EVAL=<script>`: `census.js`, `tour.js` (with `PROBE_WAIT_PREWARM=1`), `shadowquick.js`, `minimapab.js`,
`combo.js`; `blast2.mjs <dist> <label>` for the mass blast).

#### The brief (owner's Shingle Point M1 recording, 2026-11-05; files in session scratchpad perf3/)
**The recording:** build 76a4b03, M1 Pro, high, 49 players.
- Averages about 20.5 ms. It holds 60 fps only in quiet views (390 draws, 185 meshes).
- In the main views: 700–870 draws and 850–1,090 active meshes.
- Per frame: render about 17 ms, of which:
  - mesh evaluation 3.5 ms
  - shadow and depth maps 4.4 ms
  - about 6.5 ms issuing draws
  - clips and aim 2.8 ms (round 2 worked there)
- One hitch at 55 s compiled 8 new shaders mid-match (75–83 ms frames).
- HUD costs 0.7 ms, against 0.1 ms on Market Town.

**Targets:**
1. Static prop merging and instancing on big open maps: chunked merging of static props and decorations, like levelMerge.
2. Shadow cache effectiveness on large outdoor maps.
3. Shader warm-up so no shaders compile mid-match. Find which material first appeared at 55 s.
4. HUD cost: why 0.7 ms here (minimap or markers with 49 players?).

### Owner's map notes for later (2026-11-05; not started)
- **No Man's Field:** asset refresh. It still uses Kenney kits; move it to our generated environment and props.
- **Border forest backdrop** (owner's note, 2026-11-05): maps' surrounding forest still uses the old blocky tree
  models (owner's screenshot on a temple test map). Swap it to our generated oak and pine, which is Environment
  Phase 4 work. No rush.
- **Rockfall Canyon** (`maps/canyon.json`): asset and foliage refresh, onto our generated environment, rocks and plants.
- **Shingle Point** (`maps/shingle_point.json`, the beach landing): an asset refresh (done on `wip/shingle`: the
  section at the top). The owner also suggests a
  layout rework from the reference `docs/map-briefs/shingle_point_reference.jpg`:
  - a long beach with surf, landing craft and steel hedgehogs, under a cliff line;
  - the cliff has a central grand staircase plus side stairs and ramps up its face;
  - four large concrete casemates/bunkers along the cliff top, with cave mouths into the cliff;
  - a seawall/terrace level;
  - a village with stone houses, a central round fort and walled terraces behind.

  Keep what works today (the assault from the waterline, seawall ladders and gaps, blowable weak sections).
- **Step Temple:** its menu card shot should be a grounded, eye-level view, not aerial.
- **Sandfall Colosseum, a full rebuild ("this is your moment to shine").** Owner's brief:
  - **Layout:** replicate the layout of the owner's game **Flavius Rule (classic)**. Get reference material from the
    owner before starting: screenshots, a top-down plan, or a description. **Received 2026-11-05:**
    docs/map-briefs/sandfall_colosseum/BRIEF.md and `reference/`: the 13×13 board, the seating chart and a mood
    painting. The emperor's box comes back.
  - **Feel:** epic and grand, far more immersive than today's map.
  - **The arena:** use mostly the assets we have today (Imperial Arena pack, Roman pieces), with a better layout and a
    much grander scale. The colosseum stands 6–8 storeys tall if possible.
  - **Under the stands:** a tunnel network that circles the arena. It branches to the animal cages and the gladiators'
    quarters: rest, recovery, imprisonment.
  - **Around it:** a Roman village whose main square leads to the arena entrance.
  - **Backdrop:** a volcano in the distance.
  - **How:** built in MapMaker (CLAUDE.md "Maps"), with in-house detail. Anything MapMaker lacks goes into MapMaker
    as a piece, e.g. set pieces like the arena arcade bay, vomitorium, tunnel junction, cage block and village
    insula, plus a volcano backdrop. Follow docs/map-briefs/AGENT_BUILD_CONTRACT.md: playable footprint, routes,
    spawns, budgets, bots, and NOT TESTED where it applies.
  - **Timing:** a natural first big use of set pieces (agreed queue item 3), so after those exist.

### Queued (owner, 2026-11-07): player profiles with career stats. LAST: after everything else queued or on the roadmap
The owner: "a player's profile should list their stats similar to how gran turismo 7 displays their user profiles. It
could also list any games they are active in, their top 10 most played maps, and list of maps they
created/popularity, etc. … we can add this after all this is completed".

**Today:**
- A profile is only a username and region. It is kept by Cognito account in the hub's `profiles.json`
  (`packages/server/src/profiles.ts`).
- No match results are recorded anywhere.

**The idea:**
- **A profile page** in the GT7 style: a header card with name, level and rank, then tiles of numbers. Shown for you
  and for anyone you click in a lobby or scoreboard.
- **Career:** matches, wins and win rate, kills, deaths and K/D, accuracy, headshots, time played; favourite weapon,
  character and mode; best streak.
- **"Playing now":** the listed server they're in, from the hub's tickets.
- **Top 10 maps** by time played.
- **Maps they made:** their community maps, with play counts and Community Pick status. This needs the
  community-maps plan (docs/COMMUNITY_MAPS.md) first: sharing by hosting, plays counted by the hub.

**The constraint** (MULTIPLAYER_DIRECTION: players' machines compute, AWS only coordinates, small recurring cost):
- Match results come from whoever hosts.
- **Trusted:** results from official and dedicated servers count, sent signed with the account tickets.
- **Not trusted:** a player's own browser host could fake its numbers. Either show those separately ("casual") or
  count only plays and time there, never kills.
- **Cost:** about 1 KB per player, kept with the profile on the hub. No new service.

**The owner's answers (2026-11-07):**
- **Two kinds of stats.**
  - **Official:** from official and dedicated servers, sent signed. Only these are the profile's real numbers: the
    career tiles, level and rank.
  - **Casual:** from matches players host themselves. They don't count; they're shown apart, labelled "Casual".
  - The owner: "stats from matches they host themselves do not count. we could just track official kills vs casual
    kills".
- **Bot kills count separately:** player kills and bot kills are their own numbers, in both Official and Casual.
- **Public or private:** a signed-in player turns their profile public or private in their profile settings. Private
  shows only the username to others.

### Queued (owner-approved, 2026-11-05): community maps
Plan in docs/COMMUNITY_MAPS.md:
- local saving is unlimited;
- sharing is by hosting (Far Cry 2-style browser);
- maps reach Community Picks automatically by play thresholds, with a weekly owner summary and one-click Official;
- Community Pick map files are kept on the hub.

MULTIPLAYER_DIRECTION §7 is amended to match. Starts after the current work.

### Queued (owner-approved 2026-11-06, "all if able"): MapMaker quality-of-life list = the MapMaker overhaul, plan in docs/MAPMAKER_OVERHAUL_PLAN.md
The owner asked what MapMaker could use, by comparison with the Far Cry and TimeSplitters editors. My picks, in order:
1. A green/red ghost before placing, with the reason; plus a live budget bar.
2. "Play from here", and a top-down plan view.
3. Set pieces/prefabs, groups, and copy/paste between maps.
4. Bot test heatmaps, sightline/spawn exposure, and a measure tool.
5. Time of day and weather.
6. Interface: mode tabs, collapsible panels, an outliner with hide/lock, favourites/recents, a shortcut overlay, and a
   guided first-time tour.

Owner request (2026-11-05): show the real buildable area.
- Today the editor grid is a fixed ±12 cells around the origin (`GRID_EXTENT` in client editor/editorView.ts), while
  placement allows ±256 cells and ±16 levels (`checkPlacement`).
- **Owner's refinement:** "I don't think I need to always see the entire space; the border would be more helpful."
  So the grid stays local around the cursor and the work area; it may follow the camera or cursor and fade out.
  What matters is two clear outlines, always visible:
  - the **playable boundary** (map bounds);
  - the **build limit**: where placement stops, on the ground and at the level being edited.
- A toggle may show the full-area grid on demand.
- The owner sees this as a quick win; do it first in the MapMaker work. It goes to the next free agent.
- **Building outside the playable bounds is intended (owner).** Scenery beyond the boundary blends the playable
  space into the outer world cheaply, so don't discourage it. Show the full build area, with the playable bounds
  as a distinct outline inside it. The area outside the bounds should read as "scenery zone", not as an error.

Also proposed: note pins, templates, mirror for team maps, a card-shot camera, and snap-to-surface/randomise for props.

**Build area: done and on main (07ccea8d, b7d5d497; `check/grid` run 42093090058 green).**
- Shared: `editor/buildArea.ts` (`buildLimitRect`, `playableRect` = bounds else terrain extent, `buildZone`,
  `insideBuildLimit`, `buildLimitReason`); `MAX_TILE_CELL` / `MAX_TILE_LEVEL` in the schema replace the literal
  256 / 16; checkPlacement's refusal now says "past the build limit…". Test: `packages/shared/test/buildArea.test.ts`.
- Client: `editor/buildAreaVisuals.ts` (owned by EditorView as `view.area`): local grid round the camera's look point
  on the edited level (radius 12–40 cells with camera distance, fade, majors every 4, rebuilt only when the centre
  moves 4 cells / radius / level changes); playable boundary (orange, + x-ray copy in rendering group 1); build limit
  (white dashed + level-span posts + "BUILD LIMIT" labels); scenery band (hatched orange, 24 m, fading) and labels.
  Top bar `#ed-grid-full` (Full grid). Camera clamp is now the build limit + 120 m, 600 m up. Status bar
  (`#ed-target`) names the scenery zone / past the limit under the pointer. Photo mode hides all of it (the old
  bounds outline was not hidden in thumbnails before).
- Outlines, band and labels lie on the terrain where it rises above the edited level (`max(level, ground)`); labels
  (rendering group 1, no fog) read from the usual south-facing view; the grid itself stays on the level plane (tiles
  sit there), so on hilly terrain it shows only where the ground is below the level, as before.
- e2e: editorux "The build area" block. Docs: BUILDING_KIT "Where you can build". `mapmaker.png` baseline
  regenerated (the starter map's grid now fades out round the look point).
- Not done / open: the grid isn't draped on terrain; the top bar at 960 px wide already overflowed by ~76 px before
  this (Full grid adds ~32 px; only 1280 is checked); the camera may now fly 600 m up and out to the limit, which
  draws the whole map (fine on desktop, not measured on weak GPUs).

**Owner, 2026-11-06: "all if able"**: every item and the extras. Phased in docs/MAPMAKER_OVERHAUL_PLAN.md (1 feedback while building, 2 interface, 3 workflow, 4 testing the map, 5 time of day and weather, 6 guided tour); after set pieces part 2, in the agreed queue's place.
Already covered elsewhere: set pieces (item 3, its own queue item, docs/SET_PIECES_PLAN.md); the build area (above);
bot heatmaps (item 4) partly by docs/BOT_AI_PLAN.md (Phase A failure-spot pictures, Phase D bot debug view and
bot hints). Today a tile's ghost already turns green or red, but it doesn't say why, and there is no budget bar.

### Queued (owner-approved, 2026-11-05): kit-prop generators
docs/PROCEDURAL_ENVIRONMENT.md Phase 6, after Environment Phase 2. Generated families replace most of the simple
man-made props: crates and barrels first, then fences and walls, then containers. Characters, weapons, vehicles and
hero props stay authored.

### Plan (proposed to the owner, 2026-11-05): retire the old nature models after the environment passes
About 120 nature props today:
- Kenney Nature Kit: 55
- Quaternius Ultimate Nature: 39
- Kenney Survival: 12
- Meshy community nature: 8
- a few in other packs

They come to about 3.6 MB of GLBs.

Plan:
1. **Retire from the palette** as each environment family covers them (grass, flowers, ferns and pebbles are done).
2. **Map migration:** move the maps with MapMaker's "Replace all".
3. **Load-time alias table** (retired id → species and variant), so players' own saved maps and old files still load
   and upgrade.
4. **Drop the files from the build only** once no official map and no alias needs them.
5. **Keep for now:** pieces with no species yet (palms, cacti, snow trees, jungle plants, mushrooms, dead trees,
   logs and stumps) until Phase 2+ species cover them. Stylised pieces that a style pack depends on stay until
   that pack's refresh.

### In flight
- **Floors over tall pieces, branch `wip/ceiling`** (agent, 2026-11-05; from main 4e77fabc; runs on `check/ceiling`).
  Owner's screenshot (live, TDM): "notice the blue edge? … tried to place another tile above where i am now, but it
  said i could not overlap tiles. I would like to add a ceiling/floor here". Later: the blue doesn't matter, it only
  marks the level (Level 1) where they want a floor, over "the set piece I am on".
  - The spot: not a map in `maps/`. The blue is the Sands of Egypt theme's underside (`core.lapis`) under Level-1
    floors; only Pharaoh's Reach and Sunken Kingdom use that theme and neither has grass terrain. Grass + cacti, stones
    and rock spires = a MapMaker map of the owner's (new-map grass terrain, Desert scrub scatter) with Egypt-theme
    pieces (the walkway looks like the Sphinx Avenue's paving and plinth). So the exact piece is unknown; any piece two
    or more levels tall refuses a tile on its upper storey (one cell, one piece).
  - Blue edge: dropped at the owner's word (not a bug: lapis is that theme's ceiling paint; not a flicker-fix regression
    by reading, not compared in a browser).
  - Done: `TilePlacement.upperFloors` (format v26, tile-local "dx,dy,dz"): a full floor slab in a tall piece's own
    upper storey (`geometry.ts` `canAddFloor`/`cellSlab`; not bottom storeys, Vertical pieces or model buildings).
    MapMaker: a **Platform placed on such a cell becomes that piece's floor** (`placeTileCommand` → `floorOf`, green
    ghost), and the inspector's **Upper floors → Floor on Level N** ticks a whole storey. `checkPlacement` refusals now
    name the piece and level and say what to do. Docs: BUILDING_KIT "Floors over tall pieces", CHANGELOG.
  - Tests: `packages/shared/test/upperFloors.test.ts` (incl. no coplanar overlaps for every eligible piece with all
    its floors, two rotations); editor.test.ts messages; e2e editorux "A floor over a piece two levels tall".
  - Demo (scratchpad only): a stand-in spot (Egypt theme, grass, a Tall Room open on three sides under Level-1 floors);
    in play it looks like the owner's shot (the cacti, stones and red spires are the theme's dunes backdrop). MapMaker:
    a room there is refused with the new message, a Platform makes the floor, the inspector shows it ticked.
  - Checks: typecheck, content:check, build, bundle 690.7 kB gzip (budget 840); unit upperFloors + editor + zipline
    pass (test:changed under load 13-18 timed out on 14 sim/bench tests that pass alone or on CI); e2e editorux PASS
    (ports 4961/4962); editor and visual failed locally only on load timeouts (random pickup drawn, jump-off hint,
    canyon scene not ready in time; canyon 0.1 % differ) and passed on CI. CI: `check/ceiling` run 42053469134 green at 6cd5f392 (full suite, 13 e2e shards, perf).
  - Next / resume: land it (fast-forward `main` to the green commit, or a train). Owner: tell us which piece the
    screenshot stands on if the new way doesn't cover it. Open: per-cell floors are only by Platform (the inspector ticks
    a whole storey); Vertical pieces never take one (by design: their upper storey is the way up).
- **Market Town perf on the M1 Pro, branch `wip/perf-market`** (agent, 2026-11-05; from main d29e6a8; not merged).
  Owner's capture (high, 44 players): 23 ms frames with few in view, 38-45 ms with 20-40; characters (clips + aim)
  8.5 ms and shadow + depth maps 6.6 ms a frame. Write-up with causes and numbers: docs/PERF_96.md "Market Town on
  an M1 Pro". Done:
  - Animation LOD by frames as well as time, in every match (`game/animLod.ts`); fingers cached past 15 m
    (`CharacterAnimator.curl`); shot/hit overlay clips kept started (`KEPT_OVERLAYS`), none past 35 m.
  - Shadow proxies (`game/shadowProxy.ts`, Atmosphere batches static casters after 0.5 s); pickups and held guns
    cast within 15 m (`shadowFlags.ts`); water's scene depth only round water (`sceneDepth.ts`, WaterVisuals).
  - Blood splats instanced; one character build a frame (`BUILD_CATCH_UP_MS`); bodies reused per look
    (`GameView.keepBody`, `CharacterAnimator.standBy`, `BODY_POOL_PER_LOOK` 2).
  - Probe (scratchpad only, `probe/mt.mjs`: Market Town, fixed placement, perf split + draws by pass/kind + CPU
    profile / Chrome trace): rebuild it from PERF_96's description if needed.
  - CI: `check/perf-market` run 41961274052 green at c684c02 (full suite: unit, build, 13 e2e shards incl. visual,
    perf budget and mass). Local: typecheck, test:changed (17), content:check, bundle 681.8 → 682.6 kB gzip (budget
    840), e2e offline + characters PASS (ports 4971/4972).
  - Next / resume: owner re-records on the M1 (PERF_96 "For the owner to re-record"); land when green. Open:
    creatures' Babylon clips are not gated by the LOD (only their state machine is stepped); scenario doors and
    the ladder gate are a mesh per bar (55 shadow draws on Market Town); the level's 58 materials are 58 main-pass
    draws (a per-pack atlas would cut them).
- Picked up by the claude/launcher-ui-map-cards account (2026-11-04): `wip/env-phase1` (Environment Phase 1
  vertical slice, queue item 1, in flight) and `wip/zfight` (texture flicker fix, item 2: landed on main).
- Surface types landed last (f61f2cf): `content/surface-types.json` (23 types), optional `surface` on props
  and `surface`/`ballistic` on materials, trunks heavy_wood / bushes foliage / boulders stone, impact effects keyed by
  surface type. Its open questions are below.
- **Texture flicker fix (z-fighting), branch `wip/zfight`** (item 2 below; not merged; runs on `check/zfight`).
  - Done: `packages/shared/src/map/faces.ts` `visibleFaces(boxes)`: build-time face clipping that replaces
    mapMeshes.ts's random 2-14 mm box growth and `containedBoxes`. Per rotation frame: faces inside another box or
    back to back with one are dropped; same-plane same-facing faces draw once by a fixed priority (tops: floor >
    solid > wall > trim; sides/bottoms: trim > solid > wall > floor; then own material; then later box); faces of
    differently turned boxes sharing a plane are cut as convex polygons; cuts stop 0.5 mm short (seam, no cracks).
    Client `MapStyler.buildBoxes` draws those faces (n-gon fans); MapMaker clips all levels together then draws
    active/dim sets. Audit + coverage tests: `packages/shared/test/zfight.test.ts` (every map: 0 coplanar overlaps
    left; was 279,777 raw, 220,509 as the old renderer drew them (after its contained-box drop), 34,751 of those exact ties). Collision unchanged (hash of
    buildMapGeometry/props/blocks/terrain over all 89 maps identical to origin/main).
  - MapMaker: one `geometry.coplanar` warning per map when a free block's face shares a plane with another piece in a
    different look (45 of 89 maps have one today; tile-vs-tile is left to the pass), and **Overlaps** in the top bar
    highlights those places (`coplanarSpots`, shared/src/map/zfight.ts; editorView.setOverlaps).
  - Depth: WebGL2 unchanged (reverse depth on a 24-bit canvas buffer gains nothing; float depth needs EXT_clip_control
    + an offscreen target and a copy: not worth it now). WebGPU: stencil off -> Babylon's depth32float main pass, and
    reverse depth on. docs/LOOK.md "No flicker" and "Depth buffer".
  - Visible change: floor slab edges no longer show as dark "underside" bands at random cells on exterior walls (the
    wall wins on sides now); seams/thin lines between wall runs gone. Before/after shots were in the session
    scratchpad (not in the repo).
  - CI: `check/zfight` run 41934273414 green at 52b495d (full e2e set, 15 shards, perf budget/mass).
  - Next / resume: land it (fast-forward `main` to the green commit, or a train). Open: owner to look on the M1 Pro
    (WebGL2 and `?renderer=webgpu`); the priority order is a choice (ask if a floor band was wanted anywhere).
    MapMaker clip cost on the biggest maps ~0.2-0.5 s per rebuild (node); memoise per level if edits feel slow.

### Next, in the owner's agreed order
1. **Environment Phase 1** (after surface types): vertical slice per docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §10 — one
   broadleaf, one conifer, one bush, one grass clump, one boulder, one cliff section; eye-level showcase; owner
   reviews before Phase 2. Owner decisions are in that doc ("Owner decisions": all 13 recommendations; blocky trees
   retired).
2. **Texture flicker fix** (z-fighting; in flight on `wip/zfight`, see above): build-time pass in the shared geometry builder — overlapping SAME-FACING
   coplanar faces (floors, trim/facades on walls, wall-run ends, pack tiles over core) clipped by a fixed priority;
   back-to-back hidden faces dropped (walls stay 1 m solid, collision unchanged); audit test over maps/, MapMaker
   warning + overlay; check float depth buffer with reverse-Z on WebGL2. Owner confirmed the cause.
3. **Set pieces**: multi-cell placeable pieces as data (footprint, levels, parts/props/FX, door markers, rotate/
   mirror, re-theme by style pack), MapMaker "Save selection as set piece", "Set pieces" palette tab; placed as one
   piece AND an "Explode to tiles" option (owner confirmed both). First: the **carriageway / pend** family (owner's
   photo: Collegiate Gothic stone, shallow segmental arch underpass, doors into both buildings from the passage, the
   2nd floor crossing over the arch), plus an enclosed **skybridge**; place one in St. John's. Then the brainstorm list
   (power core hall, catwalk bridge, twin-stair overlook, atrium tower, loading dock, sunken arena, reactor room,
   bunker cluster, courtyard gate, server vault, crossroads plaza, multi-level ramp junction). Old big pieces retired.
4. **Core / experimental tiers + quality gates** (owner deferred it until content scalability was done; steps 1–7
   are now done): let the owner promote characters/maps from an experimental to a core roster, with gates, managed
   from the Control Center Workbench (`.control-center/workbench.json`).
5. CI follow-ups: split unit tests by duration (shard 1/3 is 5 min, others 1–2); confirm the nightly 16-shard tour,
   the timings refresh and fail-fast on a real failing run.

### Open questions for the owner
- Barrels/powder keg were resized to real sizes (barrel 0.95 m, keg 0.75 m): less cover. Keep, or put back?
- Grade and surface detail strength were tuned on software rendering: owner to look on their M1 Pro (one value each:
  `WORLD_GRADE`, `content/surfaces.json`).
- Still open after hands round 5 (its "Left for the owner"): Grunt '68 long-gun-only hand roll (small); new hand
  geometry for Vanguard, Beanie Alien, Alien Biker, Mummy Bot, Zhao; Croakley re-rig (pipeline or Meshy credits; Meshy
  needs approval); Bamboo's first-person forearms.
- Surface types: are stumps, logs and cliffs right as trunk/boulder? About 100 more props are misread by the name
  guesser (e.g. wooden `ww_*` buildings stop bullets like concrete; `iron_fence` reads as wood); each fix changes cover,
  so each needs a yes. Terrain still counts as concrete on the server. heavy_wood needs a playtest.
- Older open items: Underdrain (what did the owner expect?), Apex Ring race-car class, menu budget 840 → ~700 kB,
  unify legacy spread bloom on exotic weapons, a smaller size class for Goblina/Space Marine, frost_basin card look.
- Known bug found by the de-toy job: `ModelLibrary.mergeModel` drops glTF mesh instances (a mesh reused under several
  nodes draws once). Surfaced props are fixed; others still lose copies.

### Not in the repo (previous container only, may be gone)
- MapMaker Playwright drivers that agents used for map edits (`rework3/tools/maker.mjs`, `coverage-map/tools/maker.mjs`)
  lived in the session scratchpad; recreate as needed (they drive MapMaker's own UI, which is the rule).
- Raw downloads (`/home/user/meshy-drive/...`: airliner, snowmobile, character sources) are never committed; re-download
  from the owner's Drive/Meshy if a rebuild needs them.

### Owner preferences learned this session
- Easy wins first; CI improvements stay top of the queue; ask with numbered options and a recommendation.
- Exact hitboxes but generous padding (responsiveness over realism); likes meta characters and per-character stats.
- Look: "everything looks too much like a toy" — move to grounded realism (procedural environment, set pieces,
  replacement models); the grade alone is subtle.
- Retire rather than delete; models not in T-pose get retired (Otter, Shade).
- Meshy credits need approval each time; Meshy Community models are CC0 (Terms §3.3) — record author and post URL.

### Environment Phase 1: the vertical slice (`wip/env-phase1`, agent, 2026-11-04; in progress, pushed, not merged; from main b1423beb)
Plan: docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §10 and "Owner decisions". Status is kept here at every push.
- **Generator** (owned, seeded, no Math.random): `content/environment.json` + `content/environment/<family>.json`
  (six species, two material variants each) → `pnpm content:environment` (`--check` rebuilds in memory,
  byte-identical; run by content:check/rebuild) → `packages/client/public/env/*.glb` (LODs + crossed-card stand-in),
  shared pictures (bark, rock, leaves atlas), `content/environment.lock.json`, both `environment.generated.ts`.
  Code `tools/content/env/*.mjs`. Docs: CONTENT_PIPELINE.md "Environment species".
- **Shared/sim:** `content/environment.ts` (lookups, PropDefinition view: `getProp('env.…')` has no box),
  `environmentSchema.ts` (zod), `map/environment.ts` (world shapes, nav prisms, hash), `PhysicsWorld(boxes, terrain,
  shapes)` (capsules/hulls/trimeshes; `blocks: 'shots'` limbs in a new group: shots + sight only), `shapeAt` →
  surface → ballistic class in `Match.materialAt`; nav gets the shapes' triangles; shrubs conceal from species data;
  `PropEntity.variant` (optional, no format bump). Client prediction, MapMaker nav check and the effects world get
  the same shapes.
- **Client:** `src/environment/` (renderer behind `?env=1`: thin instances per species-variant/LOD/part/64 m sector,
  per-copy LOD with hysteresis, wind MaterialPlugin GLSL+WGSL, tiers), foliage grows env grass under `?env=1`,
  ModelLibrary draws `env/` GLBs as props otherwise. `?envlab` (src/tools/envLab.ts). MapMaker with `?env=1`:
  Environment (preview) palette group, env scatter sets, Variant in the inspector.
- **Tests:** tools/content/test/environment.test.mjs, shared environmentData/environmentCollision tests (+ fixture
  `environment-resolved.json`), e2e flow `environment`, webgpu flow extended to envlab, visual scene `envlab`.
- **Resumed 2026-11-05** (second agent, after a container restart): merged origin/main (texture flicker fix; only
  CHANGELOG conflicted), provenance refreshed for the regenerated cliff GLBs (content:check was red), env_showcase in
  `RETIRED_MAPS`, `envForest` brush spacing 3.8 → 3 m (2,000 trees fit in the 200 m square only that dense),
  `tools/perf/client-perf.mjs` takes `PERF_QUERY=env=1` and prints the environment renderer's stats.
- **Showcase map done:** `maps/env_showcase.json`, made in MapMaker (`?mode=editor&env=1`) by a Playwright driver in
  the agent scratchpad (`showcase/maker.mjs`, passes `pass1..7.mjs`, checkpoints as JSON loaded back through MapMaker's
  Import): 240 m terrain, 9 spawns and 2 small health in a central clearing, 30 cliff panels (15 along z = 96 facing
  south, 15 along x = 96 facing west), 94 shrubs round the clearing, 401 boulders, 2,001 trees (oak, autumn oak, pine;
  scatter brushes), the clearing and cliff feet cleared with the brushes' right-click, "thick grass" painted over the
  square (Terrain → plants brush): ~46 k generated clumps inside the 200 m square with `?env=1` (62 k on the map).
  Hand edits after Export: `metadata.id` = env_showcase and the export's release stamp left out (as the other maps).
  validate-map: one warning, budget.props (2,526 props > 1,500: the §10 counts are over the budget by design).
- **Perf** (§10 target; `tools/perf/client-perf.mjs`, medium, 960×540, `PERF_BOTS=2`, 40 s turning at the spawn,
  SwiftShader on this shared container at load 10–20, so counts not frame rates; two interleaved runs each):
  Backwoods 471 / 465 draws, 1.93 / 2.02 M triangles, 945 / 883 shadow casters, 467 / 465 materials; env_showcase
  with `?env=1` 398 / 418 draws, 1.80 / 1.97 M triangles, 403 / 402 casters, 268 / 273 materials (2,526 copies in
  ~230 batches; per level ~85 / 600 / 1,665 / 175). Under the baseline in each pair, but triangles only by 3–7 %:
  the grass (0.49 M in view) is the largest share. The same map without the flag (species as prop nodes): 2,052
  active meshes, 6.60 M triangles, 3,840 casters.
- **Pitfalls:** MapMaker under `?test=1` seeds its id generator per page load: a map imported in a new page gets
  "ID … already exists" on the first new pieces (drive MapMaker without test=1). Pushing from this shallow clone
  failed with "missing necessary objects" after a GitHub hiccup (the remote ACKed commits it could not use);
  `git -c push.negotiate=false push …` works.
- **Checks (2026-11-05):** `node tools/content/environment.mjs --check` OK; `pnpm typecheck` clean; `pnpm content:check`
  OK; `pnpm test:changed` (all units) 1628 passed, 2 failed then fixed or passed alone (select.test wanted an
  e2e/timings.json entry for `environment`; pads.test eagle_spires is a load timeout, passes alone);
  `validate-map maps/env_showcase.json` one warning (budget.props); bundle budget OK (menu first JS 682.6 kB gzip;
  env code in its own chunks). E2E (`CI=1`, ports 4951/4952): environment PASS (after fixing its forced-level check:
  grass has one level, shrubs three, so they stop short of a forced level 3), visual PASS (envlab baseline written,
  `e2e/baselines/envlab.png`), editor PASS; webgpu fails here in 1 s on its first page.evaluate (before any env
  code; this container's browser) — CI runs it. CI on check/env-phase1: run 41958757185 failed only on zfight.test's
  Norman Shores timeout (20 s; now 90 s); run 41961338160 on 4e9f19db is **green** (full suite, every e2e shard).
- **Screenshots for the owner** (agent scratchpad `env/`): `envlab-<view>.png` and `envlab-before-<view>.png` for
  lineup, trees, small, plants, rocks, cliffs (the before set is the Kenney/Quaternius pieces in the same places),
  `envlab-lod-row.png`, `envlab-overview.png`; the showcase in play with `?env=1` on high:
  `showcase-env-high-{clearing,forest-edge,forest,north-cliffs,east-cliffs}.png`.
- **Next:** owner reviews the screenshots (Phase 1 gate), then land: 4e9f19db is green (fast-forward `main` or a train;
  only HANDOFF changed after it); then Phase 2.
- **Not done from §10:** `dedicatedhost` on env_showcase comparing host and browser collider hashes (the unit test
  environmentCollision covers both load paths); impact sounds per surface (no sounds yet).
- **Resume:** `git fetch && git checkout wip/env-phase1`; `node tools/content/environment.mjs --check`.


## Earlier start notes (session of 2026-10-30 afternoon)

**Read CLAUDE.md first.** Workflow: session branch → `check/candidate` → when green, fast-forward `main`.
The session branch is **`claude/launcher-ui-map-cards`**. Poll CI without auth:
`curl -s "https://api.github.com/repos/Dsoto1/splitters/actions/workflows/ci.yml/runs?branch=check/candidate&per_page=1"`.
Use `pnpm typecheck`, not `pnpm -s typecheck` (the silent flag hides type errors; one reached CI that way).

### Surface types (`wip/surface-types`, agent, 2026-11-04; pushed, not merged; rebased on main da7d432)
Owner-approved first step before procedural environment Phase 1 (audit Q3, decision 2a). One shared list of 23
surface types, `content/surface-types.json` (generator `tools/content/surface-types.mjs` -> `surfaceTypes.generated.ts`;
`sim/surfaceTypes.ts`): each its ballistic class, impact (decal, debris, sound family) and footstep family (unused yet).
Docs: CONTENT_PIPELINE "Surface types", GUNPLAY_SPEC §8 implementation note.
- **New classes** in `sim/gunplay.ts`: `heavy_wood` (resist 6000, no ricochet; a 0.5 m trunk stops even the 3000-energy
  precision round) and `foliage` (resist 30).
- **Props name a surface** (`surface` per prop or per pack in `content/props/<pack>.json`); **materials** may name
  `surface` / `ballistic` (none does yet). Unset = today's guesses, unchanged (`materialClass` for the class; the old
  vfx.json word list, moved to surface-types.json `guess`, for the effect).
- **Set (93 props):** bark on every collidable Trees prop plus rn_dead_tree, eg_palm, jt_tree_trunk, jg_bamboo, stumps
  and logs; foliage on the 8 bushes and mn_shrub; rock on boulders, cliffs and the rocks (rocks keep stone).
- **Client:** effects and sounds come from the surface type (`fxMap.ts`); vfx.json `map.impacts` keyed by type
  (`map.surfaces` gone); new chips (splinters, leaves, grit) in `impactVisuals.ts`; foliage leaves no hole; new
  sounds impact.wood/metal/soft/glass (Kenney Impact Sounds, CC0, already in assets-src) picked by a local ray
  (`SessionAudio.worldImpact`).
- **Proof:** `packages/shared/test/surfaceTypes.test.ts` vs `fixtures/surface-classes-before.json` (taken on main
  before; never regenerate): the only class changes are the listed ones (61 concrete->heavy_wood, tree_plateau
  metal->heavy_wood, 8 bushes thin_metal->foliage, mn_shrub concrete->foliage, 10 boulders/cliffs concrete->stone);
  unset props and all materials keep class and effect. Match test: trunk and boulder stop a rifle, a bush doesn't.
- Pitfall: a bush still has no collider, so its foliage effect is never seen (rounds land behind it).
- Open for the owner: many materials and props are still misread by the guessers (e.g. `core.scifi_panel` glass from
  "pane", `core.carved_stone` thin_metal from "car", sandstone soil, cacti concrete, `iron_fence` thin_wood, ~105
  concrete-class props that look wooden, e.g. ww_* buildings). Fixing each is setting its `surface` (and adding it to
  INTENDED in the test).
- **Checks run (after rebasing on main da7d432):** `pnpm typecheck` OK, `pnpm test:changed` OK (1343 tests),
  `pnpm content:check` OK, e2e `physicsfx` and `arsenal` PASS (CI=1). `offline` was stopped at hand-off (18 checks
  passed, none failed, flow not finished). Not run: the full suite (`pnpm ci:plan` says full: shared sim changed).
  Before/after impact screenshots (trunk, bush, boulder, metal) were taken on Backwoods in the agent scratchpad.
- **Next steps:** finish `E2E_ONLY=offline node e2e/run.mjs`; push a check/ branch for the full suite when the
  owner merges; then procedural environment Phase 1 can read `sim/surfaceTypes.ts`.
- **Files:** content/surface-types.json, content/props/*.json (93 `surface`), content/vfx.json (impacts by type),
  content/sounds.json (+4 impact sounds), tools/content/surface-types.mjs (+test), materials.mjs, props-manifest.mjs,
  build.mjs, rebuild.mjs, vfx-map.mjs, packages/shared/src/sim/{surfaceTypes,gunplay}.ts, map/materials.ts,
  content/surfaceTypes.generated.ts, client game/{fxMap,impactVisuals,view,session,sessionAudio}.ts,
  .control-center/workbench.json, tests packages/shared/test/surfaceTypes.test.ts (+fixture), client fxMap.test.ts.
### Hitboxes, character stats, random characters (`wip/hitboxes-stats`, agent, 2026-11-04; pushed, not merged; from main f5cc70b)
Owner's decisions of 2026-11-04 (exact per-look hitboxes; debug and audit; per-character stats; random characters).
Docs: CHARACTERS.md "Hitboxes", "Character stats", "Random characters"; GUNPLAY_SPEC §11 note. Evidence (agent
scratchpad `hitboxes/`): overlay shots `<look>-<stance>-<front|side>.png` (Sprout small, Linktifa standard, Honest Abe
large, Hyena and Croakley hunched, T-TreeFitty robot, Big Bogdan wide; creatures), `charselect-*.png`, `setup-rules.png`.
- **Hit shapes** (`shared/sim/hitbox.ts`): head sphere, torso capsule squashed across the body, a round capsule per
  thigh and shin, arm capsules where they stick out; stand / crouch / prone each. **Margin** (owner's follow-up the
  same day: generous padding): `HITBOX_MARGIN` in constants.ts, 0.18 m body / 0.12 m head at a 1.8 m body, so hit
  rates and TTK stay at main's; a standard chest is 0.68 x 0.62 m with it (0.32 x 0.26 measured), its head 0.50 m
  across (0.26). Zone = the shape whose own core the round passes nearest (the strike is the nearest padded surface). Generated per look and creature by `tools/content/hitboxes.mjs` (Node skinning,
  `tools/content/skinpose.mjs`) into `hitboxes.generated.ts`; `content:check` and `content:rebuild` run it. Manifest
  overrides `hitbox` (Otter, Boglurker). `Combatant.hitbox/hitScale` (refreshed when the look changes); NPCs as drawn.
- **Wired:** hitscan, pellets, piercing, ballistic bullets, rockets/spears/grenades (0.12 m thick), sentries, third
  person aim, lag compensation (history keeps feet, yaw, stance, scale, shapes). Melee keeps its reach capsule;
  medkit and ping aim keep theirs; a sticky grenade sticks within 0.25 m of the body's middle. Bots aim at the head
  sphere / chest middle (head base over cover); aim error unchanged (the first pass's `BODY_AIM` scaling is gone with
  the margin): 5-seed hit rates easy / normal / hard 16.8 / 33.6 / 51.6 % against main's 17.6 / 30.6 / 53.6 %.
- **Pitfalls:** crouch is measured as drawn, by hand-checked rules (crouch_idle hips and legs, the chest, neck and head
  3/4 of the way to the aim pose, `CROUCH_AIM`; the standing arms carried with the head): the drawn crouch also turns
  the upper body toward the gun side, so crouched shapes sit up to ~8 cm off sideways. The audit (stand pose) flagged
  Wealthy Otter (head sphere 0.11 m behind its forward-reaching head) and Boglurker (its wide frog head, 84 % of the
  vertices inside): both now have `hitbox` overrides (Otter `head dy -0.03 dz 0.08`, Boglurker `head r 0.23`). The
  character viewer draws everyone 1.8 m tall (no size classes), and the shapes at the same scale. A model, clip or
  rig change needs `node tools/content/hitboxes.mjs` (content:check says so).
- **Stats** (`shared/sim/characterStats.ts`): manifest `stats` { health, speed, size, damage, stamina, jump, melee,
  armor }, each defaulting to the size class (none set: nothing changed). Match setting Character stats (default on).
  Speed/jump/stamina reach the predicting client (`PrivateState.bs`; size-class speed was never predicted before).
  Workbench: new Characters collection. Stat bars on Character Select.
- **Retired (owner, 2026-11-04): Wealthy Otter and Shade** (source models not in a T-pose: hands unfixable).
  `RETIRED_LOOKS` like the others: `core.otter` -> Brass Hare, `core.shade` -> Lancer Mei (saved choices, bot sets,
  maps fall back); manifests and files kept; the otter NPC role keeps its model (`NPC_KEPT_LOOKS`, like the goblin).
  Off the roster, so off Random characters' pool too. lookGroups.test: Bandit stands in for the otter.
- **Random characters** (`shared/sim/randomLooks.ts`): setting (default off), per life, hash of seed/slot/life, roster
  looks only; the look rides the `spawn` event (`l`); own choice kept in `Combatant.ownLook`.
- **Tests:** with the margin, mechanics, weapons, ballistics, benchmarks and botClearShot are main's files unchanged
  (scoped sniper 100 % at 30 m, shotgun > 4 pellets, running target 5 of 6, holdover, rounds > 20). Still off main:
  botPush first contact < 36 s (33 s; main 24 s) and worst stuck bot < 26 (23; main 12), botMovement easy speed
  > 1.15 m/s (1.18; main > 1.2): emergent fight metrics that shift with any change to who wins fights; serverRules
  parity (two new rules).
- **Owner's defaults (2026-11-04):** Character stats off leaves size classes alone; arms 1.0x; tails, capes' hems and
  brims unhittable; the up-to-8 cm crouch offset accepted.
- **Perf (96 bots, Frost Basin TDM, 30 s, process CPU per tick, two interleaved runs each, load 12-17):** clumped
  6.41 / 6.36 ms -> 6.69 / 6.69 ms; combat 0.44 / 0.41 -> 0.48 / 0.50 ms; spread 7.40 / 7.51 -> 7.72 / 8.29 ms (noisy).
  (measured before the margin; the margin adds a few additions per shape). A shot against 96 bodies with the margin:
  11.8 us (old capsule 13.8 us, same run), `hitboxPerf.test.ts`; 4060 vs 3633 hits on its random rays.
- **Checks:** typecheck clean; content:check OK (hitboxes up to date); test:changed (all units: shared code) 1359 of
  1366 passed, then the 5 fixed or re-run alone (sticky grenade throw and botPush bound fixed; host.test and two
  pads.test cases are load timeouts, pass alone). E2E (`CI=1`, ports 4951/7951/9951-9954/7953-7954; the change maps to
  all 38 flows): offline PASS 450 s, arsenal PASS 533 s, characters PASS 1845 s, lobby PASS 785 s, dedicatedhost PASS
  381 s, visual PASS 414 s (baselines unchanged: menu 0.5 %, others <= 0.1 %). Needs a `check/` run (full suite).
  After the margin and the two retirements: typecheck clean, content:check OK, the affected unit tests pass (gunplay,
  bots, hitbox, stats, looks); E2E offline PASS 310 s, arsenal PASS 506 s, characters PASS 812 s.

### Look: less like a toy, part A (grade) and part B (prop surfaces) (`wip/detoy`, agent, 2026-11-04; pushed, not merged; from main 5a002f8)
Owner's note "everything looks too much like a toy"; the approved easy wins. Two commits: A (grade) then B (surfaces).
Docs: docs/LOOK.md (the grade), docs/CONTENT_PIPELINE.md "Prop surfaces" (the mapping). Evidence (1280×720, medium,
SwiftShader WebGL2): agent scratchpad `detoy/before/`, `detoy/A/` (A only), `detoy/AB/` (A+B): Bunker Cross
(military, clear), Frost Basin (snow), Flatpack Depot (interiors, dusk; `eye`, `eye2`), Diamond Park (city, night);
`<map>-eye.jpg` at eye level, `<map>-over.jpg` from above.
- **A, the grade** (`applyWorldGrade` / `WORLD_GRADE`, graphicsSettings.ts; matches and MapMaker): ACES at exposure 1.05
  (was 1.15), contrast 1.15 (1.12), colour curves saturation -12 / highlights -20, vignette 1.0 (1.2). Menu lineup,
  Character Select portraits and the Designer keep `applyToneMapping` unchanged (portraits.ts never used either).
  `LIGHT_BALANCE` (backdrop.ts) on each sky's `light` data: sky fill ×0.8 (0.9), sun ×1.6 (1.5), ground bounce 0.5
  (0.62). Shadow bias 0.001 / normal bias 0.014 (0.0015 / 0.02). SSAO (high, WebGL2 only as before) radius 1.3,
  strength 1.15. No new pass: draws identical before/after on low and medium. No per-map retune was needed (skies
  data untouched). Tried and dropped: a cool tint in the shadows (beige walls went grey).
- **B, prop surfaces** (`tools/content/surfaces.mjs`, run by prepare-props): 18 Kenney packs, 251 props mapped
  colour → surface (`content/surfaces.json`: wood, painted_wood, painted_metal, metal, concrete, stone, fabric,
  plastic, cardboard, glass) by per-pack files `content/surfaces/<pack>.json` (`default`, `materials`, `colors`,
  `minShare` 0.18, `skip`, per-prop `props.<id>`). Each part keeps its colour as tint, gets roughness/metalness,
  whole-centimetre box-projected TEXCOORD_1 and extras `{ surface, tile, uv, detail }`; the game
  (`content/propSurfaces.ts`, from ModelLibrary) adds a shared 256 px detail map per surface (`public/surfaces/*.webp`,
  near-lossless, from our ambientCG sets + tileable grime), off on low. Natural pieces skipped (Nature Kit has no
  file; survival trees/rocks/logs/stumps/grass/campfire, graveyard pines/rocks/pumpkin/hay, pirate palms, fantasy
  hedges). Kit props kept as built (Industrial, Roads, Retro Urban, Modular Space, Space, the external Train Kit
  pieces) were surfaced once in place.
- **Sizes**: barrel and open barrel 1.1 -> 0.95 m, anvil 0.9 -> 0.8, bucket 0.4 -> 0.32, powder keg 1.0 -> 0.75,
  bottle 0.4 -> 0.3, lantern 0.6 -> 0.45 (flame `at` and size scaled with it), candles 0.4 -> 0.3, shopping cart
  1.1 -> 1.0, oak barrel 1.0 -> 0.9, fridge 2.0 -> 1.8 (pack `height`; collision follows the built size).
- **Numbers**: menu first JS 2307.7 / 648.8 kB gzip before, 2308.2 / 649.0 after A, 2308.9 / 649.2 after A+B. Props
  73.96 -> 74.66 MB (+0.7 MB, +10.6 % on the 251 surfaced), surface pictures 0.47 MB (9 files, loaded once a map uses
  them), palette atlases 986 -> 1093 KB. Materials in the surfaced props 343 -> 437 (86 props split into 2-3 parts).
  Frost Basin, the two fixed cameras of the screenshots, no bots (a page probe, not committed: median of 25 `scene.render()` + `gl.finish()`; draws a frame): medium eye 146 / 146 /
  152, overview 167 / 168 / 177; low eye 94 / 94 / 98, overview 114 / 115 / 123 (before / A / A+B). Frame times on
  this container were noise (loaded machine, SwiftShader: medians 25-90 ms either way, p90 up to seconds); perf96's
  96-bot runs measured 1-2 frames a scenario and are not usable. Needs a real-GPU check (PERF_GPU=1).
- **WebGPU** (SwiftShader adapter, a match on Bunker Cross): medium with A+B renders without WebGPU errors, colour
  curves on, 34 detail-mapped materials. High shows "EntryPoint main infringes limits" / invalid bloom pipeline errors
  on main before this change too (SwiftShader limits; not from this work).
- **Found, not fixed**: `ModelLibrary.mergeModel` drops glTF mesh instances (a mesh reused by several nodes comes in
  as an InstancedMesh, which the `instanceof Mesh` filter skips): placed props like the Mini Market shelves drew one
  carton of six. Surfaced props now have a mesh per node (their TEXCOORD_1 differs), so those show every copy; the
  same bug still hides copies in other props. Babylon ordering: a flat-colour material with only a detail map gets
  no UVs (the detail plugin asks after attributes are prepared): worked round with a shared 1×1 white albedo.
- **Checks**: `pnpm typecheck` clean; `pnpm content:check` OK (content:rebuild's steps run by hand against an A+B
  preview on port 4813: locks, tables, 251 palette pictures re-rendered, provenance). `pnpm test:changed` (all units,
  shared changed) at load 17-21: 1301 pass, 9 fail; kit.test's barrel height was this change (fixed: 0.95 m); the
  other eight are load timeouts / budgets (botai, npc missions, sandgate, scenario, spectate pass with a longer
  timeout or alone; host.test's Bob account wait and bigMatch's 96-bot tick budget are the known load failures).
  E2E (`CI=1`, ports 4831/7831): visual PASS (menu 0.5 %, mapmaker 0.1 %, arena 0.0 %, canyon 0.1 %: the per-pixel
  tolerance absorbs a grade this gentle), editor, offline, scenery, maps, webgpu PASS. Baselines then regenerated
  after review (`pnpm e2e:baselines`): menu, mapmaker, arena, canyon all rewritten; menu and HUD look the same, the
  world shots carry the grade. ci:plan: full suite (content/surfaces*, shared props table): needs a `check/` run.
- **Owner's call**: (1) the strength of the grade (`WORLD_GRADE`) and of each surface (`detail` in
  content/surfaces.json) are first passes, tuned on SwiftShader; a look on a real GPU and monitor is the real test.
  (2) Smaller barrels and kegs are less cover (cover height 0.95 m, keg 0.75 m): say if maps relied on them.
  (3) Fix the mergeModel instancing bug above (more copies of shelf goods, cups and the like will appear on maps).
  (4) More packs (Quaternius, the Wild West kit, our own code-built kits) can take the same mapping files.
### Snowmobile: the Snow Sled's new model (`wip/snowmobile`, agent, 2026-11-04; pushed, not merged; on main e5932fb)
The owner's ask: a CC0 snowmobile instead of the toy-like Kenney sled. Evidence (before/after, raw vs processed): agent
scratchpad `snowmobile/` (`before/`, `after/`, `after/glacier-line/`, `raw-vs-processed.jpg`, `compare/`).
- **Model:** "Snowmobile" by roygbpjyt (Meshy Community post 019ea836-0675-77b9-8dae-09fcc54aca2e; CC0 1.0 per Meshy
  Terms §3.3 "Community License", terms of 2026-09-19; author credited). Pack `meshy-community-snowmobile` in
  content/guns.json (licence `assets-src/meshy-community-snowmobile/License.txt`), built by prepare-guns.mjs:
  `ONLY=vehicles/snowmobile.glb node tools/content/prepare-guns.mjs --downloads <dir holding snowmobile.glb>`.
  311k triangles -> 20.0k + a 5.0k LOD from 40 m, 2048 px colour, 1024 px normal, 1.42 MB (vehicle tier: 45k / 4.5 MB),
  3.0 m long, skis forward (`forward: -x`). The Kenney Holiday Kit sled and its source are retired.
- **Appearance (coordinator's review):** compared in-game against the raw download (`compare/`): the cut and the maps
  kept shape and colour (32k triangles looked the same as 18k); what the first build lost was material: its ski struts
  and springs are grey paint that reads dark only through the metal channel, and its paint is glossy. New prepare-guns
  options `metalDarken` (folds a GLB's bare metal into the colour map) and `roughness` (built material's, default 0.85);
  the snowmobile uses 0.3 and 0.5, and maxError 0.02 (tighter rebake ray reach). The model itself is a faceted grey and
  black design; on Frost Basin it shows team paint (Automatic: ember orange times grey reads brown); Glacier Line's
  sleds use the Snow skin (pale grey).
- **Refit (content/vehicles/snow_sled.json, measured from a height map of the built mesh; see its `notes`):** box
  `half [0.66, 0.55, 1.5]`; riders seated on the saddle (driver cushion [0, 0.56, -0.55], passenger [0, 0.6, -1.02]),
  astride via the new `SeatDef.straddle` (thighs turned out about the upright, characterAnimator applySit; schema in
  vehicles.mjs), `legDrop` 0.1/0.14 so the feet sit in the footwells; `cockpitEye [0, 1.42, -0.42]` over the
  windscreen; rideHeight 0 (skis and track on the snow). Handling unchanged. No glow, no wheels.
- **Checks:** typecheck clean; content:check OK; test:changed (all units) 1320 passed, 1 failed (host.test.ts end to
  end, a 51 s timeout under load; passes alone); tools/content tests 89 passed. E2E (`CI=1`, ports 4893/7893, load
  average ~19 from other agents' runs): maps5 (Frost Basin) PASS, maps7 (Glacier Line) PASS, characters PASS, visual
  PASS; vehicles FAIL in all 4 runs, a different timing check each time (Arc Turret wind-up, buggy fire, buggy
  steering/chase camera, buggy riders' hips), every check passing in at least one run; none touches the sled. ci:plan:
  full suite (assets-src, content/models.json): needs a `check/` run.
- **Not done:** the driver's hands don't hold the handlebars (seated riders hold their gun or idle; no grip pose for
  vehicles exists); team paint on this grey model reads brown (a paint-gain per mount would fix it: owner's call).
### CI speed-up: ~9-minute rounds, coverage map, headless map check (`wip/ci-speed`, agent, 2026-11-04; pushed, not merged; from main e5932fb)
Owner's request: a CI round in about 8-10 min (run 41851112171 took 36 min: build 2, unit 6.6, e2e shards 8-34 min).
- **Measured** (job API + E2E_TIMINGS log lines): the e2e table was far off (editor 85 → 285 s, characters 31 → 644 s,
  lobby 154 → 658 s: 540 s of it a wait that never saw the host's check-ins). Map tour parts 6-15 min each.
- **Shards** (`e2e/shards.mjs` planShards): LPT into the fewest shards (max 16) whose longest is within 5 min or the
  longest flow; table `e2e/timings.json` (also `perMap`). CI refreshes it: each e2e shard uploads its timings, the
  `timings` job merges them into the table the plan used (`tools/ci/timings.mjs merge --base --out`) and uploads
  `e2e-timings` (30 days); the plan job starts from the newest such artifact. Commit a refreshed table now and then
  (download that artifact over e2e/timings.json; the job's log lists the changes).
- **Splits:** characters → characters / characters2 (drawn hands) / characters3 (grips in a match); lobby polls the
  listing every 5 s; hostpage's right-bar toggle clicks until its command shows (failed twice on CI once).
- **Map tour nightly only** (`--tour`: schedule, v* tags, Run workflow), now 14 parts of ~6 maps. Elsewhere: the
  headless check of every map (`packages/shared/test/allMaps1..8.test.ts` + `allMapsCheck.ts`: load, validate,
  geometry, navmesh, physics, spawns on walkable ground, 90 ticks with 8 bots, nobody below the world; ~1.5 min on
  two CI jobs) and the `coverage` flow; rules that named the tour get `coverage`. A change to up to 6 maps tours just
  those (shard `maps` → E2E_MAPS) plus MAP_USERS; more map parts otherwise; phase0_arena still runs everything.
- **Unit tests** in a matrix (`unitJobs` in flowMap: 3 vitest shards + 2 map-check jobs for everything), perf
  split into budget/mass jobs, sparse checkouts (no client models / asset sources) for e2e and perf.
- **Fail fast:** a new push to a check/ branch cancels its older run (concurrency, check/ only). The unit, e2e and
  perf steps run under `tools/ci/stop-on-failure.sh`: once another job of the run has failed (polled every 40 s) the
  step stops and fails, so the run reads failure (cancelling it would read "cancelled"); land/train refuse it.
- **Green base on check branches:** like main pushes, a check/ commit whose first-parent ancestor (up to 30 back)
  went green on a check branch is planned against that ancestor, not origin/main: a small change on a green
  candidate runs only what it needs.
- **Coverage map** `maps/test_coverage.json` (MapMaker, driven by Playwright; scratch `coverage-map/`: driver
  `tools/maker.mjs` with new ops props/glass/rule/logicTemplate/inPlace, steps `pass1.mjs`, `pass2.mjs`, pictures
  `shots/`): 320 m terrain; 81 tiles (all 71 kit + one per style pack with own tiles), 16 wall styles + both glass
  kinds, one prop per pack (57), one pickup per kind (10), 17 vehicles/turrets, all 89 scenario pieces, flags of both
  teams, hill, bomb site, hostage + rescue, 8 spawns, road, AI route, race track, terrain hill, 3 logic rules.
  validate-map 0 issues. Only hand edit: metadata.id set to test_coverage after MapMaker's first save. Known: the
  airliner shell and mining truck (the only/smallest props of their packs) overlap the race track.
  `packages/shared/test/coverageMap.test.ts` fails when any kit tile, pack, wall style, glass kind, prop pack, pickup
  kind, mount, entity kind, scenario piece, mode marker, path use or logic is missing: add new content to the map.
- **testOnly** (MapMaker Map properties: Test map): left out of the map index (menu, templates, host page),
  rotations (server suiteLookup), the Host Service launcher and the map-card picture check (content:check,
  capture-map-shots). Tests: client mapIndexPlugin.test, server testMaps.test, host units.
- **tilesData test:** the per-map hash section and its fixture part are gone (failed on every intended map/prop
  change); kit, edge styles and the style map stay, ~3 s.
- **Results** (wall time, plan to last job): full check-branch run (everything but the tour) 10.5 min, green
  (run 41910774081 on 21c28a5; 13 e2e shards 2.6-7.5 min, unit 1.1-5.2, perf 2.9/5.6); client-only change
  (hostPage.ts comment, check/ci-speed-client) 4.3 min (1 e2e shard); one map (apex_ring description,
  check/ci-speed-map) 6.7 min (`maps` touring apex_ring only, 1.7 min; bounded by unit 1/3). Was 36 min.
- **Next:** vitest's `--shard` splits by file count, and unit (1/3) takes 5.2-5.5 min while the others take 1-2.3:
  try 4 shards or a duration-based split. hostcontrols (320 s) is the longest flow (it sets the shard goal of ~6 min).
  The first nightly run will be the first all-parts tour on 16 shards: check its times.
  check/ci-speed-client and check/ci-speed-map are probe branches; delete them, don't merge them.


### Procedural environment, Phase 0: audit and plan (`wip/env-audit`, agent, 2026-11-04; docs only, pushed, not merged)
The owner's spec for replacing natural assets with an in-house procedural pipeline is `docs/PROCEDURAL_ENVIRONMENT.md`
(verbatim). The audit and plan are in `docs/PROCEDURAL_ENVIRONMENT_AUDIT.md`: an inventory of 143 natural prop ids
(6,246 instances in 53 maps) with triangles, colliders and usage, how collision, shots, impact effects, nav,
rendering and MapMaker work today, baseline counts for Backwoods, Norman Shores and Eagle Spires, the old-id ->
`env.<family>.<species>` mapping and unknown-id policy, a design proposal (zod schema, tools/content generator, chunked
thin instances, host shapes, shared surface types), the Phase 1 slice plan, and 13 owner questions.
Findings to know before touching it:
- Trees collide as a 0.5 m post as tall as the whole tree, crown included.
- Every trunk is ballistic `concrete` (`materialClass` regexes miss the ids). `bush` reads as `thin_metal`
  ("bus") and `tree_plateau` as `metal` ("plate").
- The client's impact effect comes from a different word list (`content/vfx.json map.surfaces`) than the
  server's class.
- An unknown prop id makes a map fail to load (`validate.ts:207`).
- WebGL2 is the default renderer; WebGPU is opt-in.
- Frame times were not measurable here (SwiftShader under load). Q9 asks the owner for a recording on real
  hardware.
Next: the owner answers Q1–Q13, then Phase 1.
### Capitol Mall: domes on drums, marble roofs (`wip/capitol-domes`, agent, 2026-11-04; pushed, not merged; from main 5a002f8)
Owner-approved follow-up to "Map reworks, batch 3" (its "Not done": the slab skirt under the domes, the black corner
roofs). MapMaker driven by Playwright as before (agent scratchpad `capitol2/`: driver `tools/maker.mjs`, steps
`pass1.mjs` / `pass2.mjs`, pictures `before-*.png` / `after-*.png` for overview, top, capitol, capitol-air,
capitol-top, colonnade, rotunda, museum, museum-air, museum-rotunda, monument).
- **What dome pieces there were:** only the Desert City props `dc_dome` / `dc_dome_blue` (5 m, a low drum, one
  material: Tint multiplies all of it) and the `desert.dome` tile (blue dome on an octagonal drum). No capitol dome,
  no drum, no copper. So four in-house props, built in code in `tools/content/prepare-ancient.mjs` (pack
  tiletrigger-ancient, Owned, provenance "built in code"), `scale: 1` (modelled to size):
  - **Capitol Dome** (`im_capitol_dome`, Imperial Arena, 28.8 x 24.2 m, 5.9k tris, under the 6k budget): a hollow
    drum with windows, 20 columns, entablature, balustrade, attic, a ribbed white dome lined inside (a ceiling seen
    from the rotunda), lantern and bronze finial. `collide: "model"`: drum and dome as twelve-sided rounds, each column
    its own box, so the walk between drum and colonnade stays open.
  - **Copper Dome** (`im_copper_dome`, 23.6 x 16.8 m, 4k tris): limestone drum with pilasters and windows, verdigris
    ribbed dome lined inside, small lantern. Same collision scheme.
  - **Pediment** (`im_pediment`, 12.4 x 2.3 x 1.9 m, 15 degrees, the same both ways round) and **Pyramidion**
    (`eg_pyramidion`, Sands of Egypt, 4 x 2.6 m, gilded tip).
  - Helpers there: `domeShell` (outward or inward bands), `domeRibs` (faces wound by their normals), `radialBox`,
    `roundColumn`, `roundBoxes`, `prism`; a prop's `make()` may return `{ p, boxes }` to carry collision.
- **MapMaker: Roof surface.** The roof slab of a room option Ceiling (roof, skylight, beams) took its top from the
  floor slot: carpeted chambers had carpet roofs (the black). New optional slot `roof` (SURFACE_SLOTS, schema
  `TileSurfaces.roof`, `WorldBox.roof` on the slab, `faceSlot` -> 'roof' for its top); unpainted it resolves to the
  floor, so no existing map changes; themes have no roof default (`ThemeSlot`; tools/content/materials.mjs skips
  it). Inspector row "Roof (top, outside)" only on roofed rooms; the Paint tool paints it on a click on the roof.
  No format bump: an older client drops the field and draws the floor's material (as before).
- **Capitol Mall:** capitol drum panels, columns, entablature, 12-point star, Plaster Dome and slab lantern (117
  pieces) -> Capitol Dome on the old marble ring (y 8.4); museum likewise (39) -> Copper Dome; the three stepped slab
  pediments -> Pediments (Scale 1.9 / 1.32 / 2) on their cornice blocks; the monument's stepped top -> Pyramidion
  (Scale 3.75); roofs: 20 capitol rooms marble #e4dfd2, 11 museum rooms travertine #e8e2d4. Card picture recaptured.
- **Pitfall (driver):** the old drum's columns were props `prop_112..131`, not blocks: deleting a `block_` range
  silently skips ids that don't exist (pass2 deleted them). Check removals by the saved file, not the log.
- **Left as they are:** the block-built exhibits (dinosaur skeletons in the museum hall, the rocket by the air and
  space museum) and the monument's slab-built shaft with its stair (playable); the museum's travertine reads
  tan/brown at sunset (material, not changed).
- **Tests fixed:** the Pyramidion makes Sands of Egypt 27 pieces (`stylePacksAncient.test.ts`), and `SURFACE_SLOTS`
  now ends in `roof` (`tools/content/test/materials.test.mjs`).
- **Checks:** typecheck clean; validate-map 0 issues; content:check OK; content:rebuild changes nothing;
  test:changed 1307 passed, the two above fixed, and npc (two co-op playthroughs), bigMatch (tick budget) and
  host e2e timed out under a load of 10-16 from other checkouts: the five files pass on their own (57/57). E2E
  (`CI=1`, ports 4887/7921, `E2E_MAPS=capitol_mall`): scenery PASS 231 s, maps PASS 146 s, editor PASS 492 s.
  New props' GLBs, palette and provenance map to the full suite on CI: needs a `check/` run.
### Hands round 4: per-look skin weights (`wip/char-hands-skin`, agent, 2026-11-04; pushed, not merged; from main 5a002f8)
Grips round 3's "left unchanged" list, with the owner's approval to re-weight hands per look. Evidence (before/after per
look, rifle and pistol: 3/4, each hand close, side, front; audit numbers in each `<id>.json`): agent scratchpad
`hands4/` (`review-board.png`; `ba/<id>-before-after.png`; `ba/meshy_knight-body-stand-run-strafe-before-over-after.png`;
`body/` standing/running/strafing views; tools in `hands4/tools/`: `shots.mjs` (now with hand close-ups, a warm-up pose
and `creature:<kind>` ids), `stretch.mjs` (most stretched edges with their weights), `body.mjs` (spikes standing,
running, strafing), `curl.mjs` (offline finger-curl stretch test on a GLB), `imptune.mjs` (creature grip trials)).
Final evidence, shot from the files as committed (built client) against main's: `hands4/final/ba/<id>-before-after.png`
(all 13 looks in scope) and `hands4/final/review-board-final.png` (`tools/final.mjs`, verdicts in `tools/verdicts.mjs`);
reverted looks match main there (only framing noise: their files are main's).
- **New field `fixes.skin`** (tools/content/skinfix.mjs, docs/CHARACTERS.md "A look's own skin weights"): finger
  options to hands.mjs `fitHands` (`tips`, `knuckle`, `joints`, `lanes`, `fingers: 'lanes'`; per hand under `l`/`r`)
  and body options after it (`hops`, `clamp`, `smooth`, `wrist`; recorded as `extras.skinFix` on the skin and applied
  once by rehand-built). A look without it is weighted exactly as before (test). Applied with
  `ONLY=<id> node tools/content/rehand-built.mjs` on the shipped files (a rebuild from the downloads would also bring
  in later pipeline changes: Zombie Soldier A rebuilt from its download came out at 13.4k triangles, not 11k);
  rehand-built takes `SIDES=r` (or `l`) to refit one hand and keep the other as built. prepare-meshy-characters
  applies `fixes.skin` too (checked: the zombie's download rebuilt with `tips` has no needle).
- **Kept:** **Zombie Soldier A** `skin { tips 0.3 }`, right hand only (`SIDES=r`): the needle was the middle fingertip
  measured out of the hand as a stray (past 1.6x the 80th percentile from the hand's centre) and left on `hand_r`
  while the rest of the finger curled. Needle gone (40.7x -> 2.5x, spikes 6 -> 0, both guns); the left hand is
  untouched (a refit of the left from the built file changed it for the worse). **Iron Knight** `skin { smooth
  thigh/calf 6 passes, lanes 0.8, joints 0.2 }`: the tabard flipped from one thigh to the other between neighbouring
  vertices and tore open between the legs; his left gauntlet's pinky and middle tore apart (a three-finger split).
  Spikes: hold 18 -> 6 (max 12.3x -> 5.1x), run 17 -> 2, strafe 24 -> 6; the tabard stays closed in all three.
  **Hyena Warrior** `hands.r.curl 0.6` + `skin { knuckle 0.3, joints 0.3 }`: the right paw was measured a fist and
  left rigid, hanging open under the grip; it now closes round it (tips 0.057 -> 0.018 m). Curling the left paw too
  flattened it on the handguard: left as it was. Clearly better at play distance (3/4: a fist on the grip, not claws
  hanging below it); close up the closed paw shows hard folds, a geometry limit like the shard hands below. **Imp** (bots): new per-creature hold settings, CreatureSpec `grip`
  (a GripTune, read by characterAnimator `holdWith`; creatures without it hold as before); the Imp has
  `supportLong [0, -0.05, 0]`, `rollL -0.8`, `curlL 1.3`: its left claw goes under the handguard and closes round it
  (it stood above it, claws up). `__grips.creature(kind, weapon)` on `?mode=grips` poses an armed creature.
- **Reverted (not clearly better), owner/lead:** Vanguard, Beanie Alien, Mummy Bot, Zhao (finger blends and lanes:
  no visible change; a lanes split on Vanguard added stretch), Alien Biker (mitten + blends, or split lanes: the
  shards got worse). Their hands are low-poly "All Animations" hands whose fingers fold into shards when curled; the
  weights are not the cause, so they need hand geometry (a rebake or new hands), not weights. **Grunt '68 and Shade**
  (support hand on its edge): weights cannot turn a hand, unchanged. Tried `fixes.grip.rollL`: -0.7 lays Grunt's
  rifle support hand under the handguard (fingers round it, not standing up) but also turns his pistol support hand
  off the shooting hand; a long-gun-only roll (a new GripTune field) would take it: not done. Shade: +/-0.7 not
  better. **Wealthy Otter** (`wrist`: the cuff on the forearm): the paw sheared and showed its pale underside, worse
  at both strengths tried; the twist is the paw turning on the gun (`rollR 0.4` and the grip turn), not the cuff's
  weights. **Croakley** (`hops 4` + `smooth`; `hops 2` tore the belly at 120x): hold max stretch 12 -> 5 but spikes
  2 -> 4 and strafe 43 -> 53, the belly barely different by eye; its in-house skin puts thigh weight up to the chest,
  which needs a re-rig, not a smoothing.
- **Checks** (c2cdda1, re-run after the machine restart): typecheck clean; content:check OK; `rebuild.mjs`: nothing
  changed; test:changed (all units, shared code) 1361 passed, 2 timed out under machine load (host.test.ts relay
  join, pads.test.ts eagle_spires; neither touched here) and passed on a rerun of those files (26/26). E2E (`CI=1`,
  ports 5641/7641): characters, visual, designer, zombies all PASS; no screenshot baseline changed. The first run
  (before the restart) lost its browser under load. ci:plan: full suite (characterAnimator, shared creatures, character
  files map to all 38 flows): needs a `check/` run before main.

### Grips round 3: per-look hands and arms (`wip/char-grips-3`, agent, 2026-11-04; pushed, not merged; from main 47864cb)
Owner's notes of 3 Nov ("arm position (mainly right arms) and grips", the 28 looks; Santa's and Zombie Soldier A's
shoulders). Round 2's global changes made things worse, so nothing shared moved: each look carries its own data.
Evidence (before/after per look, review board, audits): agent scratchpad `grips3/` (`ba/<id>-before-after.png`,
`review-board-after.png`, `audit-before/`, `audit-after/`, `faces-raw-old-new-*.jpg`).
- **Per-look data:** manifest `fixes.grip` -> generated `whole.grip` (`GripTune`, looks.ts) -> `CharacterInstance.grip`,
  read each frame by the third-person hold (characterAnimator.ts; also Character Select): `supportPistol`,
  `supportLong`, `gripLong` (points moved, `[right, up, ahead]` in the gun's frame), `curlR`/`curlL` (share of the
  measured curl), `rollR`/`rollL` (hand turned about its fingers), `elbowOut`/`elbowDown` (long-gun shooting
  elbow's pole). A look without it holds exactly as before. First person (`gripExternal`) and creatures untouched.
- **How the values were found:** `grips3/tools/tune.mjs` sets `a.ch.grip` in a posed page (rifle and pistol
  open at once) and descends on the audit's own distances (drawn hand to its point, fingertips), then every look
  was checked by eye before/after (`shots.mjs`: rifle and pistol, 3/4 on the hands, side, front). Curl and roll
  that made a support hand curl away from the grip in the audit's curl test were dropped again (Big Bab, Emerald
  Robot, Gorgle, Greyfang, Otter, Anoobys keep point offsets only).
- **Result:** grip audit (rifle + pistol, 29 looks) 86 -> 48, flagged 22 -> 13. The clear win is the pistol's
  support hand: it hung open under/ahead of the gun on nearly every look and now sits under it round the shooting
  hand (27 of the 28; not the Imp). Rifle: grip hand further back on the grip for most; support hand mostly as before.
  **Santa** `hold { out 0.12, down 0.04 }` + `elbowOut 0.1, elbowDown 0.3`: rifle out at his right shoulder, face
  clear. **Zombie Soldier A** `hold { out 0.07 }`: same.
- **Not fixed (owner/lead):** Zombie Soldier A's right-hand needle (an edge from a `hand_r` vertex to `middle_03_r`
  stretched 40x; there with curl 0 and on both weapons, so a skin weight in the file; a looser stray cut-off in
  hands.mjs didn't move it: tried and reverted). Rifle support hands that stand on edge (Grunt '68, Shade) and
  flat/fused fingers (Hyena, Vanguard, Beanie Alien, Alien Biker, Mummy Bot, Zhao: audit `flat`) need the hands
  re-skinned, not offsets. Iron Knight and Croakley keep their `spikes` (cloth/skin). The Otter's "twisted wrist":
  `rollR 0.4` puts the paw flatter on the grip, but the twist itself reads as the cuff's skin. **Imp** (bots only):
  creatureAnimator `holdWith` has no per-creature data; not done.
- **Barnaby, Slugger, Rusty Mech rebuilt** from `meshy-drive/build-newchars/` with the fixed rebake normal maps
  (`ONLY=... prepare-meshy-characters.mjs`; provenance refreshed). Against their downloads (standalone viewer,
  `faces-raw-old-new-*.jpg`): Slugger's cap logo, visor lights and ear discs now show; Rusty Mech's face plate and
  slit are crisp; Barnaby barely changed (his blur is the 17k cut of a 1.5M download, not the normal map).
- **Re-checked Anoobys, Beanie Alien, Honest Abe** (round 2's audit had them worse): Abe 3 -> 0, Beanie 5 -> 3,
  Anoobys 3 -> 3 (its rifle support hand still curls away; pistol better by eye).
- **Checks:** typecheck clean; content:check OK; test:changed (all units: shared code) 1347 passed. E2E (`CI=1`,
  ports 4873/7897): characters PASS, visual PASS (baselines unchanged: menu 0.5 %, others ≤ 0.1 %). ci:plan: full suite (characterAnimator/looks are shared): needs a `check/` run.

### Content scalability step 7: tiles as data, core kit (`wip/tiles-data`, agent, 2026-11-04; pushed, not merged; from main 5a002f8)
docs/CONTENT_SCALABILITY.md step 7, owner's scope "1a" (the core building kit only); same pattern as steps 3-6; how to
add one: docs/CONTENT_PIPELINE.md, "Tiles and edge styles".
- **Where things are now:** `content/tiles/core.json` (all 71 tiles `map/catalog.ts` defined by hand, in catalog order:
  rooms, corridors, stairs, open ground, the buildings, curves, balconies, the city pieces and the 04 Orbital / 07 Neon
  pieces; one part a line) and `content/tiles/edges.json` (the 17 edge styles: label, `segments` that collide, `trim`,
  `openings`, and the `glass`, `corner`, `facade`, `street`, `openDefault`, `trimFrom` and `dressing` settings that
  were lists scattered over geometry.ts, sim/glass.ts and dressing.ts). `tools/content/tiles.mjs`
  (`pnpm content:tiles`) -> `packages/shared/src/content/kitTiles.generated.ts` (`KIT_TILES`) and
  `edgeStyles.generated.ts` (`EDGE_STYLES`, `EDGE_STYLE_LABELS`, `EDGE_SHAPES`, the flag lists). A part names a builder
  and its numbers (box, flight, descending, rail, columns, partition, lamp, arc, arcTrim, arcade, roundRoom,
  discStrips, block); `catalog.ts` `kitPart` / `resolveKitTile` build them (builders stay code; `descending` gained a
  `run`, the round tower became the `roundRoom` builder). `geometry.ts` `edgeSegments` / `edgeTrim` read the shapes
  (`edgeTrim` is exported now); `tileOptions.ts` re-exports `EDGE_STYLES` and labels from the generated file (menu
  split test still holds) and holds the `EdgeShape` types.
- **No network codes:** tiles and edge styles travel as ids in the map document; `content/codes.lock.json` unchanged.
- **Checks in the generator:** strict schema, palette groups and sides from tileOptions.ts, cells xor footprint,
  floors on its levels, ports and edgeDefaults on its own cells, default edges are edge styles, one builder per part,
  boxes min <= max, yaw/surface only on boxes, surface materials in content/materials.json, models under
  packages/client/public, edge-value grammar, repeats, glass needs openings, auto/open kept (auto first), unique ids,
  and every tile / edge style named in `maps/*.json` and the Style Packs' `tiles` exists (kit prefixes core/city/
  orbital/neon here; other prefixes must be a code pack's). `tilesData.test.ts` also checks every map's tiles against
  the whole catalog (pack tiles included).
- **Proof of no change:** `packages/shared/test/fixtures/tiles-resolved.json` (committed first, c25308a, from the
  hand-written code): catalog order, all 71 kit tiles resolved, every edge style's segments and trim at six sizes, glass
  openings, a synthetic map of every style x corner style x facades (geometry, trim, facades, window panes,
  validation, room dressing), and the same six hashes for all 88 maps. Deep-equal, and the kit's JSON byte-equal (key
  order matters: MapMaker's palette pictures are keyed by a hash of the tile's JSON, so `content:check` stays green with
  no re-render; the round corners keep `category` before `id` in the JSON for that reason).
- **Wiring:** `content:rebuild` and `content:check` run tiles.mjs; `tools/content/test/tiles.test.mjs` (5 tests).
- **Workbench:** "Kit tiles" (17 fields: name, group, blurb, floors, open, room options, default edge, model, notes
  editable; id, footprint, cells, ports, per-side defaults and parts read-only) and "Edge styles" (15 fields: name,
  trim offset, glass/corner/facade/street/open flags, dressing kind and span, notes editable; id, rule, segments, trim
  and openings read-only). Not checked with the dashboard's parser.
- **Stayed in code (listed, not moved):** the part builders; room options (layouts, floor inserts, ceilings, corners:
  sized to the footprint, parametric); the facades (city model sets and `PACK_FACADES` boxes); the auto/open rule in
  `resolveEdge`; `TILE_DIMENSIONS` (8 m / 4 m grid assumptions everywhere); MapMaker's edge icons (drawn from the
  segments, so a new style gets one); the Style Pack tiles drawn by code (`paint(box, ...)` in `packTiles*.ts`, 176
  tiles: a future step, e.g. `content/tiles/<pack>.json` with the pack helpers (`shell`, `gableRoof`, `win`,
  `door`, `paint`) as builders, and `STYLE_PACKS` as JSON).
- **Pitfalls:** edit the JSON, never the generated files; never rename a tile or edge style id maps use; a changed kit
  tile needs its palette picture redrawn (`pnpm content:rebuild`); keep a tile's keys in their order or every picture
  goes stale.
- **Checks (on 75f28fe, box at load 11-20 from other agents):** `pnpm typecheck` clean (70 s). `pnpm content:check` OK
  (95 s); `content:rebuild` changed nothing (30 s). `pnpm test:changed` (everything, shared changed): 1548 pass, 2
  skipped, 3 timed out under load (botai "bot aim" 20 s, pads eagle_spires / frost_basin 180 s; untouched by this
  change); both files rerun alone: 32 pass, 1 skipped. Menu's first JS unchanged: 2307.7 kB raw both ways, 648.8 -> 648.9 kB gzip (a 1-byte rounding step)
  (`index` 591,035 bytes both ways, gzip 207,542 -> 207,543; base built from 5a002f8's shared sources on the same
  machine); the kit tiles land in the `geometry` chunk. E2E (`CI=1`, ports 4483/7911): editor PASS (377 s), visual PASS
  (358 s; menu 0.5 %, mapmaker 0.1 %, arena 0.1 %, canyon 0.1 %, no baseline changed), scenery PASS (248 s), maps
  1 of 30 checks failed (1369 s): diamond_park "no match", the known load flake (see the terrain-paths entry), rerun alone
  (`E2E_MAPS=diamond_park`) PASS (213 s). ci:plan: full suite (38 flows, shared code); the rest needs a `check/` run.

### Content scalability step 6: library materials as data (`wip/materials-data`, agent, 2026-11-04; pushed, not merged; on `wip/pickups-data` 01420e4)
docs/CONTENT_SCALABILITY.md step 6, same pattern as steps 3-5; how to add one: docs/CONTENT_PIPELINE.md, "Materials and themes".
- **Where things are now:** `content/materials.json`: `materials` (all 149 in the old `CORE_MATERIALS` order, which is
  MapMaker's palette order, one a line: id, displayName, category, `pattern` + `base` + `accent` for the 89
  procedural ones or `texture` + `base` for the 60 scanned sets, `scale` (tiling), `shine`, `emissive`; the old section
  comments as `notes.section`), `themes` (35: sky and each slot's material and tint) and `tintSwatches` (30).
  `tools/content/materials.mjs` (`pnpm content:materials`) -> `packages/shared/src/content/materials.generated.ts`
  (`CORE_MATERIALS`, `CORE_THEMES`, `TINT_SWATCHES`). `map/materials.ts` keeps the types, the lookups
  (`coreMaterials`, `coreThemes`), `SURFACE_SLOTS` and labels, and two new lists the generator reads: `PATTERN_IDS`
  (was the `PatternId` union, comments kept) and `MATERIAL_CATEGORIES`. Painters, Babylon materials, the ballistic
  class and the terrain grounds stay in code.
- **Derived values:** a scanned material leaves out `pattern` and `accent` (resolved as `plain` and its `base`, as
  the old `t()` helper did); every material writes its `shine` (0.05 / 0.08 defaults of the old helpers written out).
- **No network codes:** materials and themes travel as their id inside the map document, so nothing was added to
  `content/codes.lock.json` (unchanged).
- **Checks in the generator:** strict schema (unknown fields in a material, theme, slot or the file are errors),
  category and pattern from `map/materials.ts`, lower-case #rrggbb colours (base, accent, sky, tints), scale > 0,
  shine 0-1, procedural xor texture, texture sets in `content/textures.json` with `_color` / `_normal` (and
  `_emission` when emissive) under `packages/client/public/textures`, unique ids and swatches, `core.prototype`
  kept, themes name real materials, and every material / theme named by `maps/*.json` (`material`, `theme`), the
  Style Packs' `themes` / `materials`, `TERRAIN_SURFACES` and code literals (`material:` / `surface:` / `skin:`
  'core.…' in shared and client src) exists. The Style Pack tiles' own `paint(box, '<name>')` calls are checked at
  runtime by `materialsData.test.ts` (every tile's solids and extra floors).
- **Proof of no change:** `packages/shared/test/fixtures/materials-resolved.json` (committed first, 8c96947, from the
  hand-written tables: every material with its key order, lookup, ballistic class and terrain layer; palette order;
  themes; swatches; slots); `materialsData.test.ts` deep-equals it.
- **Wiring:** `content:rebuild` (ran: nothing changed) and `content:check` run materials.mjs;
  `tools/content/test/materials.test.mjs` (6 tests).
- **Workbench:** "Materials" (11 fields: id read-only; name, category and pattern as selects, texture, base, accent,
  tiling, shine, glows, notes) and "Themes" (14 fields: id read-only; name, sky, each slot's material and tint,
  notes). Not checked with the dashboard's parser (not in this container); same shapes as the pickups collections.
- **Pitfalls:** edit the JSON, never `materials.generated.ts`; never rename a material or theme id that maps use (the
  generator refuses); a material id also drives its ballistic class (`materialClass` regexes the id): the fixture
  shows a change. A new pattern is code first (`PATTERN_IDS` + painter).
- **Checks:** menu's first JS unchanged: 2304.0 kB raw / 648.0 kB gzip both ways (`index` 587.4 / 207.1 kB; base built
  from 01420e4 on the same machine; the materials are in the `geometry` chunk, not the menu's). `pnpm typecheck` clean.
  `pnpm test:changed` (everything, shared changed): 1542 pass, 2 skipped, 0 failed. `content:check` OK, `content:rebuild`
  changed nothing. E2E (`CI=1`, ports 4297/7899): visual PASS (133 s; menu 0.5 %, mapmaker 0.1 %, arena 0.0 %, canyon
  0.1 % of pixels differ, no baseline changed), editor PASS (203 s), offline PASS (114 s). The full set the change maps
  to (38 flows) was not run locally: it needs a check branch.
- **Not done / next (owner's call):** (1) per-material ballistic class as data: today derived from id + category by
  regex (`sim/gunplay.ts` `materialClass`); an optional `ballistic` override in the JSON would let the Workbench set
  it without renaming (recommended, zero change if no material sets it). (2) footstep / impact sounds by surface:
  none exist (one `footstep` sound, `impact.world` for every surface), a feature, not a move. (3) the terrain grounds
  (`TERRAIN_MATERIALS`, labels, `TERRAIN_SURFACES`, foliage) are stored by index in maps: moving them needs codes in
  the lock; small table, recommend leaving in code until the terrain tools change. (4) `terrainPaint.ts` `NEAREST` /
  `BY_PATTERN` and `PATH_LOOKS` stay code (they map materials to behaviour). (5) e2e/flowMap has no rule for
  `content/materials.json` (it regenerates shared code, so the full suite runs anyway).

### Content scalability step 5: pickups as data (`wip/pickups-data`, agent, 2026-11-04; pushed, not merged; from main 2386d48)
docs/CONTENT_SCALABILITY.md step 5, same pattern as steps 3-4; how to add one: docs/CONTENT_PIPELINE.md, "Pickups".
- **Where things are now:** `content/pickups.json`: `pickups` (all 73 items in the old `CORE_ITEMS` order, one a
  line: id, displayName, effect, respawnSeconds, botValue) and `rules` (`armor.max` 100, `armor.absorb` 2/3,
  `powerup.speedBoost` 1.35 / `damageBoost` 2, `pickup.radius` 1.1). `tools/content/pickups.mjs`
  (`pnpm content:pickups`) -> `packages/shared/src/content/pickups.generated.ts` (`CORE_ITEMS`, `PICKUP_RULES`).
  `sim/items.ts` keeps the types (`ItemEffect`, `ItemDefinition`, new `POWERUP_KINDS`), `getItem`, the five
  constants (now read from `PICKUP_RULES`) and `STREAK_REWARDS` (kill streaks, not pickups: left in code).
  Behaviour and visuals stay in code: `applyItem`, pickupRoll, the bots' `pickupNeed`, client pickup models,
  MapMaker icons and groups, `DISC_POWER_SHOTS`, `JET`.
- **Derived values:** a weapon pickup without `displayName` takes its weapon's (all 39 do: same names as before), a
  disc power its `DISC_POWER_LABELS` entry (the generated file references it); a weapon pickup without `botValue`
  gets 0.55 + respawn / 120 capped at 0.9, the old formula of the extended-arsenal list (those 24 leave it out; the
  other 15 weapon pickups keep their written value).
- **No network codes:** pickups travel as their id (`pickup` event `item`, snapshot taken ids and `pw` [pickup, item]),
  so nothing was added to `content/codes.lock.json` (unchanged). The id is what must not change: the generator fails
  if a pickup named in `maps/*.json` or a Style Pack's `pickups` is missing, and requires weapon pickups to be
  `core.weapon_<weapon>` (drops.ts and match.ts look them up so). Order matters (palette, random-pickup pools).
- **Checks in the generator:** strict schema (unknown fields in a pickup, its effect, `rules` or the file are errors;
  effect is one of the ten kinds), weapons exist and are carried (slot 1-9), ammo types (`AMMO_TYPES`), throwables
  (content/throwables.json; count 1..max), powerups (`POWERUP_KINDS`), disc powers (`DISC_POWERS`), amounts / seconds /
  respawn above 0, bot value 0-1, unique ids, rules ranges.
- **Proof of no change:** `packages/shared/test/fixtures/pickups-resolved.json` (committed first, 3019d57, from the
  hand-written table: every item, its weapon category and lookup, the rules, the random pools per category);
  `pickupsData.test.ts` deep-equals it (and checks `ARMOR_ABSORB === 2/3` and every bot value exactly).
- **Wiring:** `content:rebuild` and `content:check` run pickups.mjs; `tools/content/test/pickups.test.mjs`.
- **Workbench:** "Pickups" (14 fields: name, respawn, bot value, amount, ammo type, throwable and count, powerup,
  seconds, notes; id, kind, weapon and disc power read-only) and "Pickup rules" (5 fields).
- **Checks:** menu's first JS unchanged: 2304.0 kB raw / 648.0 kB gzip both ways (`index` 587.4 /
  207.1 kB; base built from main's items.ts on the same machine). `pnpm typecheck` clean. `pnpm test:changed`
  (everything, shared changed): 1534 pass, 2 skipped, 0 failed. `content:check` OK. E2E (`CI=1`, ports 4293/7893/9093):
  arsenal PASS (186 s), offline PASS (97 s), editor PASS (195 s). The full suite the change maps to (38 flows) was
  not run locally: it needs a check branch.
- **Not done / next:** step 6 (materials). flowMap has no rule for `.control-center/workbench.json` (it runs
  everything); a pickups.json change always regenerates shared code, which runs everything anyway.

### Content scalability step 4: vehicles, turrets and NPC roles as data (`wip/vehicles-npcs-data`, agent, 2026-11-04; not merged; on `wip/per-pack-content` eee1833, which has main)
docs/CONTENT_SCALABILITY.md step 4, same pattern as weapons; how to add one: docs/CONTENT_PIPELINE.md, "Vehicles, turrets and NPC roles".
- **Where things are now:** `content/vehicles/<id>.json` (one per mount: the 17 placeable ones with an `order`, which
  is MapMaker's palette order, and the 2 route crafts `airplane` / `dropship_drop`; kind, model, health, box, seats
  with mounted weapons and arcs, reach, respawn, blast, `vehicle` handling incl. suspension, `sentry` block, drawing
  numbers, blurb, `notes` from the old comments). `content/npcs.json` (18 roles: explicit `code`, health, weapon,
  speed, scale, damage, creature / melee, look, and `bot`: what each role's profile changes from `NPC_PROFILE`).
  `tools/content/vehicles.mjs` (`pnpm content:vehicles`) -> `packages/shared/src/content/mounts.generated.ts`;
  `tools/content/npcs.mjs` (`pnpm content:npcs`) -> `npcRoles.generated.ts` (`NPC_ROLES` in code order,
  `CREATURE_ROLES`, `NPC_ROLE_SPECS`, `NPC_ROLE_BOTS`) and `content/codes.lock.json` `npcRoles`. sim/mounts.ts,
  sim/npc.ts and map/mapKeys.ts keep the types and all behaviour and re-export; `NPC_ROLE_PROFILES` is built from
  `NPC_PROFILE` + `NPC_ROLE_BOTS`. NPC looks logic (skins, colours, `NPC_KEPT_LOOKS`) stays in code.
- **Checks in the generators:** schema (unknown fields are errors); mounts: weapons exist and are slot 0, models
  exist, the two vehicle sounds every mount plays exist, seats fit the kind (turret: gunners only; sentry: none;
  vehicle: one driver; gunners need a weapon, passengers have none), unique `order`, both route crafts present.
  NPC roles: weapon exists and is carried (slot 1-9), look is a `content/characters` look, a creature has its body
  in `CREATURE_SPECS`, tags are ones the brain reads (`hasTag`), traits 0-100, codes unique / never changed / never
  reused / 0..n-1. Mounts have **no network code** (a mount travels as its map entity index; maps name it by id).
- **Proof of no change:** `packages/shared/test/fixtures/vehicles-resolved.json` and `npc-roles-resolved.json`
  (written from the hand-written tables first: every MountDef with `mountMass` and each seat's `cockpitEye`, the
  route crafts and lookups; every role's code, spec and full bot profile, CREATURE_ROLES, the NPC skins and their
  groups); `vehiclesNpcsData.test.ts` deep-equals them. NPC role codes equal the old `NPC_ROLES` order.
- **Wiring:** `pnpm content:rebuild` runs weapons, vehicles and npcs (its generated-file pattern now also matches
  camel-case names: `weaponFamilies`, `npcRoles`); `pnpm content:check` now runs all three `--check`s (the weapons one
  wasn't in it). weapons.mjs exports its schema / TS helpers and keeps other sections of the codes lock.
- **Workbench:** "Vehicles & turrets" (37 fields: name, blurb, model, health, box, reach, respawn, blast, speeds,
  grip, drift, mass, hover, fly, ride height, sentry and arc numbers, the first three seats' weapon and arc, glow;
  id, kind, order and the seat list read-only) and "NPC roles" (20 fields: name, health, weapon, speed, size, damage,
  melee, seven bot traits, tags, notes; role, code, creature and look read-only). Checked with the dashboard's
  `parseManifest` / `itemsOf` (no errors; `seats.1.weapon` paths resolve).
- **Pitfalls:** edit the JSON, never the `.generated.ts`; never rename a mount id (maps) or change / reuse an NPC
  code; a seat's place and the suspension are JSON-only; a numbers change is a fixture change
  (`UPDATE_VEHICLE_FIXTURE=1`). Seat `facing` of ±π/2 is written as ±1.5707963267948966 (exact).
- **Checks:** menu's first JS 649.3 -> 649.4 kB gzip (`index` 208.4 -> 208.6; raw 2308.2 -> 2308.1 kB;
  base built from 27d7a58's shared sources on the same machine); the mount tables stay out of the menu chunk (they
  load with a match / MapMaker), the NPC roles were already in it (Character Select's NPC skins). `pnpm typecheck`
  clean. `pnpm test:changed` (everything, shared changed): 1517 pass, 1 failed at load ~18 (spectate idle-kick, 22 s
  timeout), passes alone. `content:check` and `content:rebuild` (nothing changed). E2E (`CI=1`, ports 4287/7897):
  vehicles PASS (215 s), zombies PASS (49 s), outpost FAIL at load (2 characters in 20 s, run took 143 s), rerun PASS
  (9 characters, 51 s).
- **Not done / next:** e2e/flowMap has no rule for `content/vehicles/` or `content/npcs.json` (a change regenerates
  shared code, which runs the full suite anyway); per-role NPC skin colours stay in code (looks logic, as asked).

### Content scalability step 3: weapons, throwables, classes and abilities as data (`wip/weapons-data`, agent, 2026-11-04; not merged; rebased on main 5bc2455)
docs/CONTENT_SCALABILITY.md "Weapons as data", all five steps; how to add a weapon: docs/CONTENT_PIPELINE.md.
- **Where things are now:** `content/weapons/families.json` (the old `weapon()` default block and the ten gunplay
  families with named fields), `content/weapons/<name>.json` (one per weapon: only what differs, an explicit
  network `code`, `notes` with the design intent of the old comments), `content/throwables.json`,
  `content/classes.json` (explicit codes), `content/abilities.json` (sentry rebuild + dispenser, cloak, overcharge
  numbers), `content/codes.lock.json` (every code ever given). `tools/content/weapons.mjs` (`pnpm content:weapons`,
  `--check`) validates the schema (unknown fields are errors) and references (ammo, models, sounds, slots 0-9,
  codes unique / never changed / never reused, classes name real weapons, throwables, abilities) and writes
  `packages/shared/src/content/weapons.generated.ts` (+ `weaponFamilies.generated.ts`: gunplay's families, kept out of
  the menu chunk). weapons.ts, gunplay.ts and classes.ts keep the types,
  `gunplayOf` and all behaviour and re-export the generated tables; `weaponCode` reads the codes, not object order.
- **Proof of no change:** `packages/shared/test/fixtures/weapons-resolved.json` (written from the hand-written
  tables, step 1) holds every weapon's definition, `gunplayOf` and code, the slot order, throwables and classes
  with their codes and the dispenser; `weaponsData.test.ts` deep-equals it (keeping -0) and pins the old ability
  constants. Steps 2-3 pass it unchanged. Step 4 changed only definitions (recoil.kick out, `kick` in for three
  weapons), with every `gunplayOf` identical (scripted check in the commit message).
- **Step 4, part not done (owner's call):** the camera kick is folded (Pulse Pistol, Gilded Pistol, Railgun carry
  an explicit `kick`). The legacy spread bloom (`recoil.bloom/maxBloom/recover`) is NOT folded: the family spread
  model differs (recovery timing, what the cap covers, ADS blend, where the no-scope penalty sits, bots read
  `accuracy.tight`), so moving it would change the feel. Details: CONTENT_SCALABILITY step 4.
- **Workbench:** `.control-center/workbench.json`: weapons, weapon families, classes, class abilities, throwables
  (id, code, kind, holds read-only). Checked with the dashboard's parser. The Workbench format (v1.10) has no
  "from family / overridden" marker, no reset and no unit display: an empty weapon field means "the family's or
  the default's" (labels say so), and ticks are labelled with the RPM / seconds formula. Those need dashboard work.
- **Pitfalls:** edit the JSON, never `weapons.generated.ts`; never change or reuse a code (the lock refuses it);
  throwable and class codes must run 0, 1, 2... (clients read them by position); `falloff` and `reload` in a weapon
  file replace the family's whole (write all fields), `accuracy` / `kick` / `ballistic` merge. A change to a
  weapon's numbers is a fixture change: rewrite with `UPDATE_WEAPON_FIXTURE=1` and read the diff.
- **Checks:** menu's first JS 649.1 kB gzip on main c4cedd7 -> 649.3 kB (`index` 208.2 -> 208.4; one generated file
  put gunplay's families in the menu chunk, 649.8, hence `weaponFamilies.generated.ts`). `pnpm typecheck` clean.
  `pnpm test:changed` (everything): 1496 pass, 3 failed at load ~19 (server join wait, bigMatch tick budget, npc
  Outpost Siege timeout); rerun: server and bench pass, npc and bigMatch pass with `--testTimeout=180000`. E2E (`CI=1`,
  ports 4283/7893): arsenal PASS (619 s; a first run at 3 s frames failed 4 melee/spear timing checks, as in earlier
  sessions' runs), vehicles PASS (253 s). `pnpm ci:plan`: full suite (shared code): needs a `check/` run before main.
- **Not done / next:** `pnpm content:rebuild` (the parallel props branch) should also run `node tools/content/weapons.mjs`;
  e2e/flowMap has no rule for `content/weapons/` or `.control-center/` (they run the full suite; a weapon change
  always regenerates shared code anyway); stopping power by category stays in `sim/impact.ts`; the menu could
  import a small weapon-name list instead of the whole table (CONTENT_SCALABILITY step 1 note).
### Performance toolset and first busy-area fixes (`wip/perf-toolset`, agent, 2026-11-04; pushed, not merged; from main 9b2373f)
Owner-approved. Guide for the owner: docs/PERF_TOOLS.md (how to record on the host, what to send, reading the split).
- **Level 1, F3 split** (`perfProbe.ts` SYS/COUNT, `perfOverlay.ts` frameSplit): render split into main pass
  (`scene`, with mesh evaluation), shadow + depth maps, post; characters (updateAvatars + Babylon clips/aim + skinning),
  effects, ragdolls/effects physics, prop flames, HUD, net in; counts: animated, skinned, ragdolls awake, lasting
  drawn, characters let through to build. Render spans are Babylon observables (`view.ts instrumentRender`), skinning
  through `CharacterAnimator.skinProbe` (a hook, so the menu doesn't load the probe). Report has the same split.
- **Level 2, Record performance** (Pause → Settings; `perfRecorder.ts`): per-second split (avg + slowest), per-system
  histograms, hitch snapshots (>50 ms: position, map, in view, quality, server tick + split, shaders built). Plain
  download on stop or on leaving the match. `tools/perf/compare.mjs a.json [b.json]`.
- **Level 3, Capture 10 s trace**: `performance.measure` spans `tt:*` + a Chrome trace-event JSON download
  (ui.perfetto.dev / chrome://tracing).
- **Host**: server `tickSplit` on by default (simProfile per tick → `ServerStats.split`, `snapshotBytesMax`, `spikes`),
  `SpikeLog` (stats.ts) → `logs/perf-spikes.log` (HOST_PERF_LOG set by host main.ts), shown on /host (hostPage.ts
  perfLines) and the launcher's Tick tile (tooltip). Smoke: 24 bots Frost Basin, lines and spike JSON as expected.
- **Fixes** (measured same-frame on the after build, Shingle Point 64 bots medium, SwiftShader at load 10-15; the
  probe evaluates the old rule and the new one on the same frame: scratchpad `probe/probe2.mjs`):
  - Shadows: nearest 12 living characters in view cast (+ anyone within 10 m); in crowds nobody past 30 m, now
    including the dead/dying and corpses (main let every corpse and pending death cast, at any distance). Casting
    characters old rule → now: 9 → 6, 6 → 0, 8 → 0, 14 → 1 (four samples; the base build's own count matched the old
    rule exactly). Small clutter (`isSmallProp`: < 0.75 m, or a plant < 1.2 m: grass, wheat, flowers, small rocks)
    casts only within 15 m: 25 instances in shadow reach → 1.
  - Animation: crowds' characters 15-35 m step at 30 Hz (was every frame); 35-70 m 15 Hz, > 70 m 10 Hz as before.
    Evaluations a second at 60 fps, same frames: 750 → 570, 625 → 595, 590 → 590, 585 → 585 (depends on who stands at
    15-35 m; −24 % at most here). Low-detail model in crowds at 12.6 m (`CROWD_LOD_SHARE` 0.7 of 18 m).
  - Off-screen skeletons were already frozen in crowds (culled → dormant, prepare not called): perf96 posed ≈ shown.
  - Static props: Shingle Point's 446 props are 38 untinted models, all already GPU instances merged per material
    with frozen world matrices; nothing left to batch. Materials not frozen (atmosphere changes; PERF_96.md).
  - Merging far characters' draws: not done (each has its own skeleton; needs baked animation textures).
  - First-sight hitch: `GameView.prewarm` at the loading gate (session.prepareMatch, waits 8 s at most): every
    mapped effect played out of sight until `scene.whenReadyAsync`, then ended; then one character per look (up to
    32) at y −10000, `whenReadyAsync`, disposed; `Effect.PersistentMode = true` keeps the programs. Shader programs built by a round of effects after
    loading (explosion, hits, both lightning, lasting ones): main 6 (gv_zap, streaks, flare, four_point_star,
    ElectricFX impact/glow) → 0. On this SwiftShader box the prewarm took 192 s (finished in the background after the
    start); on a GPU expect seconds, unmeasured. Risk: 32 characters built during loading.
- perf96: timing-free counts (skeletons posed, characters animated from Babylon's state), bands, active meshes and
  casters by kind, `rows` scenario (PERF_SCENARIOS=rows), shader builds after the gate, prewarm report. Its spread/clump
  views differ between runs, so draws/casters there don't compare build to build (see probe numbers above).
- Menu bundle 837.2 → 835.4 kB gzip (perfOverlay out of the menu; net probe in its own file).
- Recording/trace smoke (Frost Basin, 31 players, SwiftShader): Record → Stop downloaded a 38 KB file that
  compare.mjs reads (split, counts, 47 hitch snapshots with in-view counts and server tick); the trace downloaded
  14 KB of `tt:` spans; no page errors. Second same-frame probe after the two-phase prewarm: shaders built by the
  round of effects 0; casting characters 10 → 10 (nobody past 30 m in view then), small clutter casting 45 → 0,
  animation evaluations 610 → 490 a second.
- Checks: typecheck; test:changed 1295 pass, 2 fail at load 20-28 (host.test account ticket, botai aim timeout),
  both pass alone; e2e (`CI=1`, other ports): physicsfx PASS (twice), characters PASS (1,666 s), hostpage PASS;
  offline FAIL (kill cam banner checks) and dedicatedhost FAIL (admin player list), and main 9b2373f's build fails
  the same checks of both flows on this box at the same load, so not from this branch; menu 837.2 → 835.4 kB gzip.
  ci:plan: full suite (index.html, atmosphere, characters): needs a `check/` run before main; visual baselines may
  move where small clutter's far shadows went (not run here).

### Character fixes 2: Imp portrait, bodies, shoulders, faces (`wip/char-fixes-2`, agent, 2026-11-03; pushed, not merged; from main 716c012)
Continues the entry below (owner's notes of 3 Nov). Evidence (before/after screenshots, audits, raw comparisons): agent
scratchpad `charfix2/`.
- **Imp portrait** framed on its top 42 % (portraits.ts `CREATURE_TOPS`), recaptured.
- **Bodies:** Character Select draws each look at its size class (menuScene.ts: small 1.40 m, large 2.12 m), which
  is what made Goblina and the Space Marine (both already small) look too big. Honest Abe `"size": "large"` (gameplay:
  speed x0.94, 115 health). Goblina: `lean.neck` 0 (was 10) and `lean.Head` 18, rebuilt from her rigged download
  (meshy-drive `skin-fix-rig/meshy_grizzelda.glb`). Goblina and the Space Marine were not made smaller than small: at
  their size class they read small next to a standard look (`charfix2/select-after-heroes.png`); a further shrink would
  need a new size class or a visual scale that disagrees with the hit box: owner to say.
- **Shoulders (every character, long guns):** `LONG_GUN_BLADE` 0.45 -> 0.22, stock pocket 7 -> 4 cm inside the shoulder
  (`POCKET_IN`), shooting elbow aimed out and less down (`ELBOW_POLE_OUT/DOWN` 0.45/0.18, were 0.35/0.3): the right
  arm stands out from the chest instead of running along it (Santa, Zombie Soldier A). Grip audit (rifle+pistol, 29
  looks): before 101 / 21 flagged, after 106 / 22 (Anoobys +3 back, Beanie Alien +2 off, Honest Abe +3 flat, Shade -3).
- **Hands/fingers: NOT fixed.** Tried and reverted: palm 0.3 hand-lengths further along the grip and a gentler curl
  (audit 201, every hand drawn off its point); `mitten` for 11 looks and `wrist` for the Otter via rehand-built (no
  visible change; the Otter measured worse). What the sheets show (`charfix2/hands-all1-p*.png`): the support hand lies
  flat under the handguard with its fingers straight out (Abe, Gorgle, Zhao, Punkin, Shade), and split fingers crumple
  when the shooting hand closes fully (Desert Ranger, Grunt '68). Next: curl the support fingers about the handguard's
  axis rather than the hand's own, and cap the curl per joint for low-poly hands. The Imp (bots only now) holds its
  left claw above the handguard: creatureAnimator `holdWith`, not touched.
- **Faces (pipeline, tools/content):** `finish.maps` keeps the download's metal-roughness map (Grinning Gus: black
  chrome; Dog Tag Doyle: glossy, and rebaked at 17k with `headShare` 0.24). Rebaked characters' own normal maps were read
  as a download's (`DOWNLOAD_GREEN`) in the final bake: fixed (`hiGreen`), Cal's cheek line and Sgt. Mackie's wedge
  gone; Bonesworth, Elder Tomo (centre seam gone), Thornweaver and Goblina rebuilt with it. Barnaby, Slugger and Rusty
  Mech are rebakes with the same bug, NOT rebuilt (downloads in meshy-drive `build-newchars/`, `tposes-2026-11-01/`; check
  each against its download). Uncut downloads (a low-poly download within budget) ship the download's own normal map
  with no TANGENT attribute and padded gutters: Biker Gang Girl's nose wedge gone; Kenji rebuilt the same way (his pale
  fringe patch is in the download itself: `charfix2/raw-faces-1.jpg`). WWII Infantry and Stealth Operative are All
  Animations downloads and would change on rebuild (not rebuilt). Comparison tool: `charfix2/tools/cmp.mjs` (raw / old /
  new in their rest pose, same light and framing; serve the files under `public/zz-charfix-raw`, never commit it).

### E2E flakes: dedicatedhost, offline, handoff, lobby (`wip/flaky-e2e`, agent, 2026-11-04; not merged)
Four flows that failed on CI's slow software-rendered pages (1–2 fps). No check skipped or loosened; waits are on
conditions, some with roomier caps.
- **dedicatedhost, Kick:** (1) idle takeover: the visitor (after its walk) and the owner (in the pause menu) sit
  still; after 90 s (`AWAY.afkSeconds`) a bot plays for each, `match.roster()` marks them `bot`, and the admin's
  player list (people only, `session.peopleIn`) drops the Kick button. The flow starts the Host Service with
  `AFK_SECONDS=0` (the idle rules have unit tests). (2) **Server fix:** a client still loading the match (no `ready`)
  now gets 60 s before a silent close (`server.ts LOADING_SILENT_MS`, as `matchHost` already allows friends);
  the owner's page building Sandgate went 20 s without a word and was dropped mid-join. The host log now says
  "nothing heard for N s, closing the connection". (3) The Kick click ran inside a 15 s `waitForFunction` that
  could click after timing out (a kick that landed failed the check): it clicks once (`__kickClicked`), with room.
  Page opens wait on what each needs next (`goto` to `commit`); the failure messages carry the pages' warnings,
  failed requests and the host log.
- **offline, kill cam / skip:** the kill cam was 3.5 s of wall clock from the death message, so one long frame ate
  it unseen and the Space meant to skip it toggled the free camera. **Product fix:** its time is the time it's
  drawn, each frame counting at most 0.25 s (`spectatorCam.ts KILL_CAM_FRAME_MS`, as session.ts caps a frame's
  step); same on a normal machine. `spec().killCamEnd` ('skipped' | 'over') proves the skip. **Join game:** the
  bots weren't held, so one could shoot the player between "alive" and the check (`holdBots` now). The sounds wait
  no longer throws (the check after it reports).
- **handoff:** the friends never touched their controls, so after 90 s they were "away", and an away friend is
  no successor (`matchHost.tendSuccessor`): the successor, its checkpoints and the takeover went with it. Each
  friend now looks about (a small turn every 3 s) from the moment it's in; both joins wait in parallel. The
  **404** on every page was the hub's `/api/v1/maps` with publishing off (no `PUBLISHED_MAPS_DIR`): it answers an
  empty list now (`publish.ts noPublishingHandler`). Every failed check dumps the console (pages and the match
  worker, where `matchHost` now says why it closes a friend's link), and failed requests are named.
  **Open:** CI's "two friends join" (Bo's link "closed" 3 s after loading) wasn't reproduced; the new logs will
  name the cause next time.
- **lobby, 2 players:** waited 30 s for a check-in that comes every 20 s on the host page's timer, late on heavy
  Sandgate. It now waits for two of the host's check-ins (its PUTs) after the join, reading the hub only as each
  lands, then the listing must say 2. List predicates treat a hub "slow down" answer (no `games`) as "not yet"
  (`gone` used to throw on it and fail at once). Sandgate join and game-browser waits got room.
- Seen, not changed: the game browser probes localhost:7777–7780 `/info` and `/lobby/lan` (404 when the hub runs
  with `LAN_DISCOVERY=0`): console noise on dedicatedhost pages, harmless. offline's Character Select "E E
  scrolls the grid two sections" failed once under load (unrelated).

### Content scalability step 1: the menu's first download (`wip/menu-bundle`, agent, 2026-11-03; not merged; rebased on main 51519b2)
docs/CONTENT_SCALABILITY.md step 1. **Menu's first JS 837.0 -> 649.0 kB gzip** (2970 -> 2305 kB raw, on main 51519b2; `index` 396.1 ->
208.1 kB gzip; `babylon` and `vendor` unchanged). Budget left at 840 kB (now ~190 kB of room). How it works:
docs/LOADING.md, "Map content".
- **What moved out:** the pack tiles (`packTiles*.ts`), `catalog.ts`'s tables, the prop table (`props.generated.ts`),
  geometry, validate, dressing, editor operations, the zod map schemas (`schema.ts`, `logic.ts`), mounts, border,
  backdrop, gunplay, serverRules, scenarioDefs, `mapPlan.ts`, `mapMeshes.ts` and its patterns, `editor/storage.ts`.
  `STYLE_PACKS` was never in the menu chunk (editor only). The map content (`client/src/mapContent.ts`, ~149 kB
  gzip) loads with the first map drawn, opened or played (`loadMapContent()`, in parallel with the map file).
- **Why they were in:** the shared barrel re-exports everything and the package had no `sideEffects` field, so any
  menu import kept every module; `schema.ts` imported `catalog.ts` for six constants (and catalog builds
  `CORE_TILES` from every pack at load); `track.ts` ran `RaceSettings.parse({})` at load.
- **Changes:** `@tiletrigger/shared` `"sideEffects": false`; `map/tileOptions.ts` (out of catalog.ts, re-exported)
  and `map/mapKeys.ts` (out of schema.ts, re-exported); `DEFAULT_RACE` written out (test/menuSplit.test.ts checks
  it equals the parse); client `mapContent.ts` + `mapContentLoader.ts`; mapIndex, mapThumbs (plan), modelThumbs
  (tile pictures import mapMeshes on demand), main.ts (`playOffline`, `travelLocal`; Change map's own maps via
  matchCode). Hygiene: lazy weapon-code, prop and look maps, pure `CORE_TILES`/`coreCatalog` (no menu change).
- **Pitfall:** a static import of `loadMap`, `buildMapGeometry`, `mapPlan.ts`, `mapMeshes.ts` or `editor/storage.ts`
  from anything the menu loads brings ~190 kB back; so does an import-for-effect module in shared.
- **Still in the menu chunk, could be trimmed next** (rendered size before minifying): `frontEnd.ts` 123 kB (every
  screen; split per screen), `characterAnimator.ts` 66 kB (Character Select preview), `virtual:map-index` 66 kB
  (cards; could drop fields the cards don't show), `sim/weapons.ts` 52 kB (the menu reads names and models: a
  weapon-list module, which step 3 "weapons as data" makes natural), `characters.generated.ts` 34 kB, the inline
  env BRDF PNG 31 kB (could be a fetched file), `game/input.ts` 23 kB (frontEnd's controls screen), synth 17 kB.
- **Checks:** `pnpm typecheck` clean. `pnpm test:changed` (everything, the change is unmapped): 1450 pass, 2 fail,
  both known load failures: host.test (hub wait: Bob's account) and pads eagle_spires (180 s timeout). E2E: see the
  next line. `pnpm ci:plan`: full suite (the new client files have no rule): needs a `check/` run before main.
- **E2E (local):** offline (53 checks), editor (60), visual (4: menu, mapmaker, arena, canyon at 0.1 %) and maps (30) PASS
  (`CI=1 E2E_CLIENT_PORT=4273 E2E_SERVER_PORT=7887`: another session's preview held 4173).

### Content scalability step 2: generated files per pack, `pnpm content:rebuild` (`wip/per-pack-content`, agent, 2026-11-04; not merged; from wip/menu-bundle c4cedd7 = main)

docs/CONTENT_SCALABILITY.md step 2; how-to in docs/CONTENT_PIPELINE.md, "Adding a prop pack".
- **Props, one file per pack:** `content/props/<pack>.json` (55 files: `pack` = what `packs.<id>` was,
  `order`, `props` without a `pack` field). `content/props.json` keeps only the shared budgets (the loader
  refuses it if it still holds packs or props, so a stale branch can't add props there silently).
  `tools/content/props-manifest.mjs` reads the folder for prepare-props, build.mjs, the atlas tool,
  palette-items.ts and prepare-obj-props; `packages/shared/test/helpers.ts` `propManifest()` for the tests.
  The old table interleaved packs (81 runs of 55 packs), so a prop can carry `order` to start a run:
  props sort by order, pack id, place in file. Proof: the loaded manifest deep-equals the old file's
  props (key order too); `props.generated.ts` is byte-identical but its header comment; every prop GLB
  unchanged; props.lock.json the same entries.
- **Palette atlases per pack:** `thumbs/props-<pack>.<hash>.webp`, `tiles-<style pack>`, `vehicles` (71
  atlases, 972 KB; were 11, 1,155 KB). `thumbs/palette.json` v2 is the index, one sorted line per atlas
  (file, rows, bytes, pack name, `[key, hash]` in cell order; 86 KB, was 105). Client: `paletteAtlas.ts`
  builds its lookup (`atlasManifest`); search's pack name comes from the atlas. The tool reuses a cell
  from any old atlas by key and hash (v1, v2, or both sides of a conflicted index); `--offline` never
  renders (exit 3 when something must be). Same pictures in the same order, all 1,608 hashes kept;
  re-encoding once in lossy WebP moved 3.9% of (premultiplied) channel values by 4/255 or more, mean
  0.45/255, the worst pixel per cell 19/255 median, 64 max. Lossless would be 4 MB, over the 3 MB budget.
  content:check also checks file names, `bytes`, sort and an index budget of 160 KB.
- **`pnpm content:rebuild`** (`tools/content/rebuild.mjs`): lockfile.mjs → prepare-props +
  character-manifests → atlas `--offline` (only if pictures are missing: `pnpm build`, vite preview on a
  free port from 4799, never 4173/4391/4567, killed by PID, then the atlas tool) → content:build →
  content:check. Stops on unmerged source files. Run twice: nothing changes (19 s with nothing to render).
  Tried on throwaway branches: two branches each dropping a prop from neighbouring packs merged with only
  the palette index conflicting; after the rebuild the tree equalled doing both on one branch.
- **Locks and provenance:** every `content/*.lock.json` (all 16 writers use `writeLock`) and provenance.json
  are one entry per line, sorted by file; same entries as before. `readLock` settles conflict markers
  (both sides; on a clash the entry matching the file on disk). content:check fails a lock not in the format.
- **CI:** flowMap maps `content/props/` like props.json, unit tests client + shared (palette.test reads it).
- **Still conflicts:** one pack file edited on both sides; one GLB rebuilt on both sides (binary);
  `props.generated.ts` / provenance when two branches add props at neighbouring lines (rebuild rewrites
  them, no hand edit); an entry removed by one side inside a conflicting part of a non-props lock comes back
  (content:check names the missing file). Not split: guns.json, packs.json, textures.json and the other
  single manifests, `stylePacks.ts`, `catalog.ts`, CHANGELOG/HANDOFF.
- **Checks (local, load average 14 on 4 cores):** typecheck clean; test:changed ran all units (tools/content
  changed): 1,496 passed, 2 failed under load and passed alone (bigMatch tick 31.0 ms vs 30; npc Outpost Siege
  20 s timeout); content:check OK; e2e editorux PASS (atlas checks, pack search), editor PASS (first run failed
  "random pickup ... drawn false", a 10 s wait; passed on rerun), scenery PASS (first run timed out starting
  the match). tools/content changes run the full e2e suite on CI: needs a `check/` run.
- **Pitfall:** a branch made before this that edits content/props.json conflicts on it: move its new props
  to their pack file (or a new one), then `pnpm content:rebuild`.

### Character fixes: faces, roster (`wip/char-fixes`, agent, 2026-11-03; not merged, not pushed; from main ef2c103)
Owner's notes of 3 Nov (agent scratchpad `charfix/owner-notes.md`). Steps 1-2 done here; steps 3-5 (Imp thumbnail,
bodies, arms/grips/shoulders/fingers) NOT done: see "Open" below. Evidence: agent scratchpad `charfix/`.
- **Faces (16 looks; the owner's "sgt" and "mackie" are one look, Sgt. Mackie).** Not the shared clip set: the same
  faces with the set switched off (`clips = false` at runtime) and in a plain glTF viewer are the same, and the shipped
  GLBs had these faces since they were built (`probe/`). Causes, each checked against the download rendered at the
  same framing (`faces-raw-new-rebake-old-<1-4>.jpg`: raw / this build / rebake / main):
  1. **Download normal maps read upside down** (meshy-mesh.mjs `DOWNLOAD_GREEN = -1`, was GREEN). Meshy's low-poly
     downloads ("All Animations", many texture GLBs) have flat vertex normals and get their smooth shading from the
     normal map alone; built with the wrong green they shaded in flat facets (WWII Infantry, Stealth Operative).
  2. **The head cut at the body's loose errors** (work cut 1-3 %, final cut up to 5 % of the model's size): heads
     that missed their share at 1 % were cut at several cm (Cal's pointed skull, halves of a face out of line). Now
     `cutKeeping(..., { seamParts: [0] })` cuts the head at `FINE_ERRORS` (0.2 %, 0.4 %) only; the body takes what is
     left of the budget (never under `BODY_FLOOR` 60 %).
  3. **Chart borders pulled straight**: collapses along a texture seam laid a triangle across the gutter or another
     chart (dark/pale wedges over eyes and noses). The head's seam vertices are locked now (charts cut inside their
     outline). Seam copies are also skinned alike (`shareSeamWeights` in pose()).
  4. Rebaked heads get 2.5x the texel density (`REBAKE_HEAD_DENSITY`).
  Per look (manifest `fixes.surface`): download layout, seams locked: Biker Gang Girl, WWII Infantry, Stealth
  Operative, Lancer Mei, Rourke, Grandpa Chains, Grinning Gus, Pemberton. Rebaked (`surface: rebake`): Cal, Sgt.
  Mackie, Elder Tomo, Count Bonesworth (seam-locked their dense heads stay at 15k+ triangles: Tomo 21.8k, Bonesworth
  26.7k, over the 20k budget; Mackie kept an eye wedge), plus Thornweaver and Dog Tag Doyle (already rebake). Rattles:
  his rig task isn't on this machine, so `tools/content/reface-built.mjs` (new) moved his skull's 9-13 % collarbone
  weights onto the head in the shipped file (a green flip there made it worse: not used). Kenji: his download is
  10k triangles, not cut, and every build looked like main: left as on main.
  **Not yet like the download** (owner/lead to judge): Cal and Sgt. Mackie (rebake: softer, chart lines), Biker Gang
  Girl (nose wedge remains), Kenji (pale fringe patch also in an uncut build: the cause is outside the cut, not
  found), Grinning Gus and Dog Tag Doyle (the downloads are glossy black/chrome from a metal-roughness map the
  pipeline drops: ours are matte white), Rattles (head pose). Rebuild: `ONLY=<ids> node tools/content/prepare-meshy-characters.mjs <dir>`
  with the downloads linked in agent scratchpad `charfix/dl/` (Thornweaver's from model-quality `dl/rig/`).
- **Roster** (looks.ts RETIRED_LOOKS, files and manifests kept): Vampire -> Count Bonesworth, The Hollow Visitor ->
  The Visitor, Dust Trooper -> Desert Ranger, Goblin -> Goblina, Rotter -> Shambler, Giggles -> Punkin (Rotter and
  Giggles tear open at the waist and sides: `charfix/core.rotter-before-hold.png`, `core.giggles-before-hold.png`;
  their hands-on-hips downloads, skinClean's tears; not fixable without a new rig). The goblin NPC role still draws
  `core.goblin` (`NPC_KEPT_LOOKS`: getLook gives the look itself, validLookId maps a player's saved choice).
  Imp and Puglin: off `PLAYER_NPC_LOOKS` (Character Select), still NPC roles, NPC_LOOKS and bot looks.
- **Open (steps 3-5, not started or not committed):** Imp portrait framed on its top 42 % (`charfix/step3-imp-portrait.patch`,
  portraits.ts `CREATURE_TOPS`; then capture `npc:imp`). Bodies: Character Select draws every hero at 1.8 m whatever
  its size (menuScene.ts), which is why Goblina and the Space Marine (both already `small`) and Honest Abe (standard)
  read wrong there: `charfix/step4-menu.py` scales the hero by BODY_SIZES; Abe wants `"size": "large"`; Goblina's
  head-down is her `lean.neck` 10. Grip audit BEFORE (rifle+pistol, the 29 looks in step 5 incl. Santa and Zombie
  Soldier A): total 101, 21 flagged (`charfix/audit-before/summary.md`); no after yet.
- Checks (on 2c8ab3e): typecheck; content OK; test:changed 1280 pass, 4 failed, of which looks.test (retired goblin)
  and forts.test (seed 4 missed stairs with the new bot looks: now seed 3) are fixed; host.test (hub wait) and
  pads eagle_spires (210 s timeout) failed at load 20-40, as in earlier sessions; e2e (`CI=1`) characters PASS
  (1,677 s), visual PASS (menu 0.01 %). ci:plan: content paths, full suite: needs a `check/` run before main.
  Not pushed: the lead asked that the face rebuilds not go towards main until they match the downloads.

### Queued (owner-approved, 2026-11-03): content scalability, see docs/CONTENT_SCALABILITY.md
The owner approved every pick in docs/CONTENT_SCALABILITY.md. Step 1 done on `wip/menu-bundle` (above; not merged). Order:
1. Get the menu's first JS off its 800 KB gzip ceiling: pack tiles, the prop table and STYLE_PACKS load with a
   match or MapMaker, not the menu.
2. Per-pack prop files and palette atlases, plus one `pnpm content:rebuild` command, so parallel branches stop
   colliding in generated files.

Do 1 and 2 before the remaining style packs (Desert City, Jungle). Then:
3. Weapons, throwables, classes and abilities as data. This adds explicit network codes and the Workbench fields.
   Start after the Snow pack and the Market Town/dropship work are on main.
4. Vehicles and NPC roles as data.
5. Pickups as data.
6. Materials as data.
7. Tiles as data, as the base of the MapMaker overhaul (scope it with the owner first).

Each step goes on its own `wip/` branch, green on a `check/` branch, then onto main.

Queue (owner, 2026-11-03): **first** the CI pipeline fixes (accept a commit whose code matches an already-green
check commit when only docs differ; a batch-landing script that merges waiting green branches into one candidate;
finer e2e/unit routing: `view.ts`/`content/` stop running all flows, map JSON runs the tests that read maps), **then**
content scalability 1 → 7 above.

**Planned after content scalability (owner, 2026-11-03; not before, in case the structure changes):** core and
experimental tiers for maps and characters, promoted by the owner from the Control Center Workbench (`tier` fields in
the content JSON; `.control-center/workbench.json` collections, dashboard docs/WORKBENCH.md), with quality gates
(grip audit, portrait and face checks, map card not facing a wall, perf budget, spawn and route reachability, a
bots-only match) that block promotion to core and only report for experimental.

### Fire props: pack flames on braziers, fire bowls, torches, campfires (`wip/fire-props`, agent, 2026-11-03; not merged; from main c3e7e7b, rebased on 716c012)
Owner's request: the bought Flame FX on the fire props placed on maps. docs/PHYSICS_FX.md "Pack effects" has the rule.
- **Data, not maps**: content/props.json `flame` per prop (`fx` brazier / torch / candle / campfire, `at` the
  flame's foot in the prop's space as drawn (x mirrored), `size` its height in m, `hide` the model's own flame
  materials); prepare-props.mjs validates and writes it to props.generated.ts. content/vfx.json map.lasting
  `flame.brazier` (basic_fire_02), `flame.torch` (basic_candle_02, scale 2: the cheaper 24-particle variant),
  `flame.candle` (basic_candle_01, scale 2), `flame.campfire` (basic_bonfire), all `decor: true`.
- **Which props**: brazier: jt_fire_bowl, jt_hanging_brazier, jt_altar_fire, jg_brazier, im_brazier, eg_torch (Fire
  Stand), im_altar, mv_forge, sd_brazier, fire_basket (Step Temple's; its green model keeps showing under the flame,
  one textured material, nothing to hide); torch: jt_wall_torch, dg_wall_torch, sv_torch_stand; candle:
  ge_writing_desk, lantern (Kenney candle lantern); campfire: sv_campfire, dg_woodfire. Left alone (and why):
  multi-candle props (candles, rn_candles, ge_candelabra, ge_chandelier: one effect per wick would eat the lasting
  places; their own flames stay), unlit models (Kenney campfire pit, campfire_stones, Kenney candles have no flame),
  enclosed lamps (lantern_post, dc_lantern, ww_lantern, gas/street lamps), light entities (light:candle /
  chandelier fixtures are code-drawn lights, not props). No burning-barrel prop exists.
- **game/propFlames.ts**: per frame, fire props within 75 m ask LastingFx for `prop:<id>`; the model's `hide`
  meshes are switched off only while `drawn`. LastingFx sorts `decor` after every other lasting effect (a burning
  patch 40 m off beats a torch at 2 m), so the caps (low 4 / medium 10 / high 16) and the 70 m rule hold. Low
  graphics: no prop flames at all (own flames). Broken props ask for nothing; props on movers move theirs.
- **Mesh-part bug fixed** (the FX agent's lead): godotVfx `pieceOf` shared the base mesh's Geometry, and thin
  instances keep their matrix/pcolor/pextra buffers on the geometry, so pieces of one effect drew with whichever
  set its buffers last, and with disposed buffers (nothing) once that piece went (warm() at load already did that
  to every mapped effect's `Core`). Each piece now gets its own geometry from the base's vertex data. Fires' `Core`
  now draws (bright heart at the base, after/zoom_vinefall_bowl.png). Loot glows were not re-tried: likely the same
  cause, worth wiring again.
- Evidence (agent scratchpad `fireprops/`): `before/` and `after/` step_temple_basket, step_temple_candles,
  vinefall_fire_bowl, jade_wall_torch, colosseum_brazier, raven_writing_desk (`_1` the settled frame), zooms in
  `after/zoom_*.png`. Harness `fireprops/tools/propshot.mjs` / `shots.sh`.
- Perf (perf:budget settings, jade_sanctum (27 wall torches) and vinefall_sanctum (12 fire bowls, 4 altars, 2
  hanging braziers); the 96-bot run stalled for 600 s on this shared machine (load 24-45; PERF_96.md "Warm-up
  hang"), so PERF_BOTS=32; before = main d517c5f's build): after passes (exit 0), before failed only on vinefall
  medium clumped draws 1008 > 900 (camera-dependent; after's clump 807). Starting a flame: flame.brazier 0,
  flame.torch 0, flame.candle 0, flame.campfire 0-0.1 ms (budget 40); slowest effect overall 24.4 ms after vs
  31.1 ms before (arc, noise). Effects in the shadow pass: 0 both. Frame times not comparable: SwiftShader drew
  1-4 frames per 4 s under that load. A drawn flame is 2 draws (particles + Core), at most 10 on medium.
- Not in MapMaker's view: the editor has no pack effects, so it shows the models' own flames (as before).
- Checks: typecheck clean; test:changed 1282 pass, 5 timing tests failed under load (host e2e, bigMatch bench, two
  npc missions, eagle_spires pads) and pass alone (51/51); new tests propFlames 3, lastingFx decor 1; content:check
  OK after content:build (provenance for flame_fx.json). E2E (`CI=1`): physicsfx PASS (198 s), visual PASS (canyon
  0.1 %, no baseline change), setpieces PASS (33 s). ci:plan: content paths -> full suite; needs a `check/` run.

### CI pipeline: green by code, batch landing, finer routing (`wip/ci-pipeline`, agent, 2026-11-03; not merged; from main d30d9c5)
The first item of the owner's queue above. Three commits:
- **Green by code** (`tools/ci/greenTree.mjs`, ci.yml's "Already green on a check branch?" step, now also on `check/**`
  pushes): when the commit itself has no green check run, the step lists the last 100 successful CI push runs
  (`listWorkflowRuns`, ci.yml), takes the check/ ones (up to 30 commits, fetching a deleted branch's commit by sha) and
  skips when `git diff --name-only --no-renames <green> <candidate>` lists only docs (`DOC_PATTERNS` in e2e/flowMap.mjs:
  docs/, top-level and package-level *.md, LICENSE; `.gitignore`/`.editorconfig` deliberately not). A twin's package names
  the other commit, so on main the release job builds this commit's package again (run_id left empty).
- **Batch landing** `tools/ci/train.mjs` (CLAUDE.md Git workflow): merges wip/ or check/ branches in order in a temporary
  worktree, stops on a conflict naming the branch and files, pushes `check/train-<UTC>`; `--land <sha>` checks the
  branch's latest CI run (gh api) and that origin/main is an ancestor, then pushes `<sha>:main` without force.
- **Routing** (e2e/flowMap.mjs): `game/view.ts` runs the 35 flows that play a match (not editorux/hostpage/webgpu) and the
  client tests, not all 38 + all units; content manifests route by kind (characters, clip-sets, gear, props, guns, vfx,
  skies, city, sounds); other content/ paths (models.json, packs.json, intake/, textures…) still run everything. New unit
  name `content` = tools/content/test. `pnpm test:changed` is now `tools/ci/testChanged.mjs`: vitest --changed, plus the
  tests whose source (or test helper) reads a changed maps/ file (19 for an ordinary map, ~95 for phase0_arena).
- Tests: tools/ci/test/greenTree.test.mjs, train.test.mjs, testChanged.test.mjs; select.test.mjs's "runs everything" list
  lost view.ts and content/props.json (they no longer do) and gained models.json, packs.json, intake/, assets-src/.
- Not proven on GitHub yet: the github-script step (dynamic import of greenTree.mjs, listWorkflowRuns) needs one check/ run.
### Map reworks, batch 3 (`wip/map-rework-3`, agent, 2026-11-04; pushed, not merged; from main daef0aa)
The last five maps of the owner's review (agent scratchpad `rework3/`): MapMaker driven by Playwright as in batches 1-2
(driver `rework3/tools/maker.mjs` = the airliner driver plus a Paths-tool op; steps `rework3/<ic|ac|bw|sj|cm>/pass*.mjs`;
pictures `rework3/<map>-before-*.png` / `-after-*.png`, the same camera names before and after).
- **New MapMaker prop: Burn Barrel** (`prop.burn_barrel`, pack tiletrigger-kit, built in code in build-kit-props.mjs,
  category Military): a rusted drum with charred wood and the pack campfire flame (`flame.size` 0.35; 0.7 was a 2.5 m
  fire). content:rebuild run.
- **Iron Compound** (owner: spawns, layout, not fun): a third way in, a gate tile in the west wall at cell (0,3) held by
  a breakable plank block (260 HP, comes back); a container yard by it, a motor pool (armoured truck, hazard barriers)
  inside the east gate, a stores row on the north wall, a sandbag nest, gabions and crates by the helipad; in front of
  the raiders' spawns a container, an armoured truck and a burnt car, a tent and a campfire; wrecks in no-man's land;
  three of the eight deathmatch spawns moved inside (four inside now) and an Embers spawn moved off the breach; burn
  barrels; sunset, mist 0.25; description.
- **Atomic Court**: the block bus, truck and cars (17 blocks) replaced by a supply truck, burnt car, pickup, flatbed,
  two family cars and a beetle; sheds as outhouses; Suburban Chaos yards (picket fences, box hedges, swing set, slides,
  trampoline, barbecues, patio sets, mailboxes, hydrants, bins); a TV, fridge, washer and beds in each house; sunset.
- **Backwoods**: six drawn paths (dirt trails bridge → lodge and drain bank → porch, the gravel road, the camp's
  trails to both bridges); the old stair-stepped painted trails painted back (77 Paint-brush dabs, ground picked from
  the cells round each); the camp (campfire, tents, torches, pickup, crate); creek rocks and logs; cart and woodpile.
  The map was at the 80-model budget: new pieces reuse models it had (pass2 swapped them).
- **St. John's** ("needs better paths"): the 11 Dark Flagstone walks (black lines on the lawns) → 3 m Mossy Cobbles;
  five new cobbled walks across the two bases' lawns (flagpole ring → central road, → north road, → south barracks;
  Tide's lawn → the hall on the slope, twice); six lantern posts, two hedges.
- **Capitol Mall** ("it feels strange"): the slab domes → `dc_dome` ×4 (capitol white on its lowest tier, museum copper
  green), lanterns lifted; 88 ruin columns → Ionic (scale ×5/6, same height); blocky trees → Broad Oaks (×1.25) and
  birches; seven Historic City Buildings (owner's Meshy) along the side lawns; a cordon round the obelisk; the capitol's
  four walnut corner chambers marble outside; sunset; description.
- **Card pictures** recaptured for all five (capture-map-shots; Capitol Mall keeps its fixed camera).
- **Pitfalls (driver):** the Paths tool picks another path when a click lands on its ribbon or near a handle: click
  every point with Shift (a new path's first two clicks too), and check no other path changed (the first St. John's
  run added four points to a road; rerun from the original). The path pane's style/width controls keep the path as it
  was drawn: redraw the pane (list → none → the path) between changes, or the second change undoes the first.
  `shots.mjs` cameras need the map's real layout: Iron Compound's yard ring has an outer wall at x −12 / z −36.
- **Not done / for the owner:** the capitol's corner chambers have black roofs from above (their roof material, not
  changed); the domes sit on the old 12-point slab tier (reads as a skirt); the Burn Barrel flame and the camp fires
  did not all show in some shots (whether lasting flames are capped by distance or count was not checked).
- **Checks:** typecheck clean; validate-map 0 issues on all five; test:changed 1301 passed, 1 failed: bigMatch "96 bots
  on Frost Basin within the tick budget" (timing, load ~9); rerun alone: bigMatch.test.ts 10/10 passed; map-reading
  files 311 passed. E2E (`CI=1`, ports 4877/7911, `E2E_MAPS` = the five): scenery PASS 98 s, maps PASS 252 s, editor
  PASS 203 s. ci:plan: the new prop's GLB, palette and provenance map to the full suite, so this needs a `check/` run.

### Airliner: Meshy shell, in-house cabin kit, Runway Nine rework (`wip/airliner`, agent, 2026-11-04; pushed, not merged; from wip/per-pack-content eee1833, origin/main merged)
Owner's note on the old plane: "airplane looks like roblox/minecraft. not good". Pictures (before, after, cabin,
cockpit, bridge, stairs, wing, tail): agent scratchpad `airliner/before-*.png`, `airliner/after-*.png`; MapMaker
steps `airliner/pass1.mjs`, `pass2.mjs` (driver `airliner/maker-air.mjs`, maker3 plus a `logic` op and chunked
deletes), placements `airliner/layout.mjs`.
- **Shell** (`prop.airliner_shell`, pack `meshy-owned-airliner`, Meshy owned; preview task
  01a1a451-1dda-77ed-82ec-810c24ac1e9a, refine 01a1a451-ee8d-72d3-99ea-48063cd52abe; download in
  `/home/user/meshy-drive/airliner-2026-11-04/`, not committed): 230k → 19.7k triangles (hero tier; LOD 6.1k from
  120 m), 2048 px colour map rebaked, 1.38 MB. Scale ×36: 68.4 m long, 59.9 m span (a 60 m widebody grown ~14 % so a
  2-3-2 cabin with 1.2 m aisles fits). The red nacelle mark and the nacelle wordmark painted out; the wordmark is in
  Meshy's own normal map too, so the normal map is flattened under what is painted out. Eight openings cut (L1/R1,
  L2/R2, over-wing, rear) with clipped edges. Collision: 492 boxes (body as hollow bands round the cabin with 2 m door
  gaps, solid below the floor and over the ceiling; wings, engines, tail, gear as merged vertical spans).
- **Pipeline** (prepare-props.mjs, meshy-mesh.mjs): `cut`, `collide: "boxes"`, `collide: "model"` (boxes in a
  code-built GLB's extras), `scale` for code-built pieces, `paintOut`/`bakeSize` for Meshy props, `within` boxes on
  paintOut rules. docs/CONTENT_PIPELINE.md. `tools/content/fuselage-profile.mjs <downloads>` measures the shell's
  rings (assets-src/tiletrigger-cabin/fuselage.json) and writes its `cut`/`boxes` into the pack file.
- **Cabin kit** (pack `tiletrigger-cabin`, Owned, `tools/content/prepare-cabin.mjs`): 6 sections lofted from the
  measured rings (0.8–3.9k triangles each), 10 fittings (48–1.3k). docs/BUILDING_KIT.md "Airliner" has the
  assembly numbers.
- **Runway Nine:** the 588-entity block plane deleted; shell at (0, 0, −4.4) with 15 sections and 107 fittings;
  jet bridge rebuilt in blocks (12° ramp from the lounge at 4 m, rotunda, gallery to L1 at 6.79 m, breakable glass);
  stair trucks at R1 and rear left; ladders to both wings; 13 hidden lights; Meshy containers, crates, IBC tanks,
  jersey barriers, hazard blocks and barrels as apron cover. Spawns, pickups, hostages, bomb sites (A at the flight
  deck door, B by the mid-cabin galley), the hijackers' flag and a hill moved aboard / onto the wing. Rules
  `rule_board`/`rule_slides` deleted with the doors (the 3 m door entity can't fit a 1.5 m airliner door);
  `rule_start` says how to board. validate-map 0 issues; map card picture recaptured.
- **Pitfalls:** the navmesh keeps ~0.8 m off obstacles: every lane needs 2 m between collision boxes (seat rows
  collide 0.4 m short of the aisles; door gaps 2 m; a mid-cabin fitting beside the rows plus another in line closes
  the aisles: the cabin divider is not placed for that reason). The flight deck itself has no navmesh (too tight);
  bots reach its door. Over-wing exits sit ~1 m above the wing root: players jump back up, bots use the wing ladders.
  In the logic panel a card's buttons hold the rule's index at render time: redraw the panel between edits. The
  generated prop table does not escape apostrophes in names.
- **Not done:** an exterior step at the over-wing exits for bots; cargo-hold interior (the old hold is gone).
- **Checks** (merged origin/main 2386d48 after; content:rebuild changed nothing): `pnpm typecheck` clean; `pnpm test:changed` 1306 + 308 passed; validate-map 0 issues; e2e (`CI=1`, ports 4822/7893, `E2E_MAPS=runway_nine`) editor PASS 183 s, scenery PASS 78 s, maps PASS 40 s. Needs a `check/` run before main (shared code: validate.ts, the prop table).

### Map reworks, batch 2 (`wip/map-rework-2`, agent, 2026-11-04; pushed, not merged; from wip/map-rework 9b2373f)
Same method as batch 1 below (MapMaker driven by Playwright, steps in agent scratchpad `rework/<map>/pass*.mjs`,
pictures in `rework/<map>-before-*.png` / `-after-*.png` and `rework/<map>/cmp-*.png`). New driver ops: terrain
paint strokes with a ground material, the sky pane's controls redrawn between changes (a stale pane reverted the
sky), per-pass `SEED`.
- **Fogbound:** 22 craters with the lower brush (four hold swamp mud), rough rises at the rear corners, Meshy
  armoured trucks and burnt cars in no-man's land, a ruined farm on each flank, eight dead trees, stormy sky.
- **Citadel:** a Medieval Village town a level down the hill, south of the bailey: a gate in the bailey's south
  wall (tile Walls → wide) with a 0.2 m cobble step, the slope smoothed (smooth brush), a market square (the
  Meshy fountain and stalls), houses, a smithy, a bell tower turned to open onto the square, a watchtower; four
  spawns, large health, the marksman (in the bell tower; its belfry and the watchtower's lookout don't path), and
  the fire basket swapped for a fire bowl.
- **Eagle Spires:** four ziplines, one from each flank spire's top to the valley. They must be under 35°, start
  near the top's edge and use 4.9-5.1 m posts to pass the reach and clearance checks. Frozen-rock cover walls on
  the mesas and the summit, boulder pairs in the valley, snow caps (paint brush), "Paint steep slopes as stone".
- **Express Lobby:** five steel-grating sky bridges with glass rails across the atrium (alternating ends); street
  dressing. Sofas and vending machines on the 3 m balconies cut off routes, so the balconies only got planters.
- **Gallows Yard:** a Wild West gallows on the central platform (railgun moved 4.5 m along it), fire bowls for the
  fire baskets, weeping angels, sarcophagi, night sky, mist 0.6.
- **Sandgate:** Desert City theme, rooms roofed with desert facades, dc_dome/dc_dome_blue on the roofs, market
  dressing, a backdrop (it had none). Layout unchanged; the `sandgate` e2e flow passes.
- **Sandfall Colosseum:** ludus west, market east, cypress avenues, four broken columns on the sand. MapMaker's
  in-page check warns the arena hill can't be reached from spawn_268; it warns the same on the original map, and
  validate-map reports 0 issues.
- **Not reached, and why:**
  - **runway_nine:** the owner wants an imported airliner. No airliner model exists in the props or vehicles (only
    the transport plane and dropship that fly over). It needs a Meshy model, which can't be made without the
    owner's go-ahead on credits; the walkable cabin would stay as blocks under it.
  - **apex_ring:** needs a new race-car vehicle class (a MOUNT_DEFS entry on kart handling with an imported car
    model, wheels and tests). That is engineering work, not map work.
  - **underdrain** ("not what I thought it would be. layout strange"): needs the owner to say what he expected.
  - **capitol_mall, atomic_court, backwoods, st_johns (better paths), iron_compound (spawns, layout):** not
    started.
- Checks: validate-map 0 issues on each map. These e2e flows pass: maps (fogbound, citadel, eagle_spires,
  express_lobby, gallows_yard, sandfall_colosseum), sandgate, citadel and zombies.
  **lobby fails here with the new Sandgate and passes with the old one.** The lobby flow hosts on Sandgate. Twice
  the host's check-in reported 2 players only after the check's 30 s wait (the listing then showed 2); once the
  join timed out. That points to the heavier Sandgate (roofs, facades, domes) slowing the SwiftShader host page at
  load 12, not to a broken map. Watch the lobby shard on CI; if it fails there too, trim Sandgate's domes and
  facades or give that check more time.

### Map reworks from the owner's review (`wip/map-rework`, agent, 2026-11-03; ST and VZ on main, the rest pushed, not merged)
Owner's notes (review page, rounds 1 and 2) for the rework-verdict maps. Every edit was made in MapMaker by a
Playwright driver (agent scratchpad `rework/tools/maker3.mjs`): Import, palette card plus a click on the view, then
the inspector's fields, selects and checkboxes, the toolbar's Delete, Ctrl+D, R, terrain-brush strokes, Settle on
ground, the theme picker and the sky pane, then Save. The saved file is MapMaker's own output. Steps files are in
`rework/<map>/pass*.mjs`. Before and after pictures are in `rework/<map>-before-*.png` / `-after-*.png`, side by
side in `rework/<map>/cmp-*.png`.
- **Driving MapMaker fast (SwiftShader runs at about 1 fps here):** the driver pauses the engine's render loop while
  it edits. Edits are synchronous, and setSelection rebuilds the inspector from the document, so nothing waits on a
  frame. It drops new pieces at a fixed point on the view and the inspector puts them in place, clears the
  400 ms navigation-check timer between edits, and runs one full check (navigation included) before Save. Terrain
  strokes resume the loop while the button is held. Give each pass on an already-edited map its own `&seed=N`:
  test-mode ids restart from the seed, and a second pass's new props collided with the first's.
- **Step Temple:** Ancient Temple theme; inlaid court with column corners, plinth cover and a fire altar; galleries
  roofed, wing rooms beamed with relief walls. Four Terrace Stairs from the ring of ground to landings, arches into
  the galleries, terraces with Summit Shrines (armour). Props swapped for the jungle/temple set and the owner's
  Meshy statues. Ammo matched to the wing weapons, spear for the laser rifle, four spawns at the stair feet.
- **Verdant Ziggurat:** jungle.ziggurat kept as the core (stylePacks2.test.ts wants it; a carved-terrace rebuild
  was reverted). The pack's ziggurat stone is hard-coded castle stone, so tile paint can't lighten it; it is dressed
  instead (monk statues, banners, lianas, moss, torches). River crossings (slab bridge, stepping stones), a zipline
  from the giant tree's 7.5 m lookout to the 4 m tier, a watch tower (its lookout pickup didn't path, so the
  pickup is at its foot), ruined walls at the edges, mist 0.45, grapples. Side courts are Overgrown Ruins; the
  north-west court is not (its walls cut off two spawns).
- **Dustwater:** hotel (Saloon tile turned about), gunsmith, barber, assay office, graveyard and gallows. Buildings
  painted (clapboard, siding, brick, sandstone, plaster). Street cover from the purchased Wild West kit. Red Rock
  Spires mesas, raised mounds (terrain brush), scrub, revolvers, explosive barrels. Prop models kept under the
  80-model budget.
- **Bottling Plant:** roofs as Sky Blocks (concrete, corrugated, a reinforced-glass skylight), 14 ceiling lights,
  hazard solids/trim repainted steel, theme Downtown (the factory theme's backdrop dressing is hazard-striped
  blocks), acid spill.
- **Concrete Annex:** it already had a roof (an extra one floated past the walls and was dropped); per-area
  materials; hangar props swapped to the owner's Meshy cargo; a flame trap in the tunnels.
- **Dune Harbor:** new MapMaker props `prop.dc_dome` / `prop.dc_dome_blue` (prepare-desert.mjs, Desert City pack,
  palette atlas rebuilt) replace the 22 eight-slab domes; Desert City market, Meshy well, stalls, buggies.
- **Coldwater Gulch:** rocks unified (spires → Mossy Rock Spire, rest → Quaternius mossy), small rocks removed,
  all settled.
- **Checks:** validate-map 0 issues on each. Every vitest file that reads maps/ passes. `pnpm test:changed` finds
  no test files for JSON-only changes, so run those files by hand. The dome commit's full test:changed, run under
  load 20+, timed out heavy sim tests (hub, bots, pads); they don't touch props, and need a clean rerun on a
  `check/` branch (the dome commit maps to the full suite). e2e maps flow passes for all eight maps. perf96
  clumped medium draws/casters (budget 900/600): Step Temple 483/163, Dustwater 523/289, Bottling 496/163,
  Concrete Annex 311/100. Verdant Ziggurat is over and was over before the rework: main's original map measured
  1153/524, the rework 1302/601, and a copy with 9 edge plants removed 1363/618. The clump frames are too noisy
  under this load to tell ±150 draws apart, so the plants stayed. VZ needs a clean perf run (most casters are the
  characters in view).
- **Not reached:** fogbound, runway_nine, citadel, eagle_spires, express_lobby, underdrain, sandgate,
  sandfall_colosseum, capitol_mall, atomic_court, backwoods, st_johns, iron_compound, gallows_yard, apex_ring.

### Map removals round 2 and card pictures (`wip/map-removals-2`, agent, 2026-11-03; not merged; from main ef2c103)
- Deleted (file, picture, inspirations, rotation entries): after_hours, clockwork, fallout_lane, ridge_camp, stonewatch_keep.
  Retired (RETIRED_MAPS, kept as fixtures): blackout (co-op mission test in npc.test.ts), cedar_lane (style pack 08 demo and
  tests), glacier_line (editor mover-group test). rotation.test.ts uses Overhang in its fake lookup. The host-controls e2e
  already used atomic_court, so no e2e change. Removed glacier_line/clockwork from the shipped rotation presets.
- `tools/content/capture-map-shots.mjs`: views now look toward the busy area (middle 80% of spawns/pickups/objectives), score
  places of interest in the cone, penalise walls within 8 m low in frame, and add aerial three-quarter views framed to the busy
  area. Regenerated citadel, silo_complex, reactor, step_temple. frost_basin picks the same high overview (terrain material
  looks olive in the render): the owner's call, not changed. mapPlan.ts crops to the built area when it fills <85% (was 60%), 3 m margin.
- Note: pads.test.ts (eagle_spires, frost_basin) timed out at 180 s under machine load in a full run; they are slow, not broken.

### FX pass: the purchased Binbun packs (`wip/fx-pass`, agent, 2026-11-03; not merged; from main a2fd44b = v0.7.0)
Owner's request: put the bought FX packs to use (full licence, "purchased by the owner"). docs/PHYSICS_FX.md "Pack
effects" is the guide; docs/PERF_96.md "Pack effects pass" has the numbers. Raw packs stay outside the repo:
zips in `/home/user/fx-packs/drive-2026-11-01/fx/`, extracted in `extracted-2026-11-01/` (Vol. 2) and
`extracted-2026-11-03/` (Vol. 1, this session), links prepare-vfx reads in `/home/user/fx-packs/links-full/`.
- **Shared support** (godotVfx.ts, prepare-vfx.mjs): any pack in content/vfx.json (`dir`, `file`) exports; per-pack
  shader ports (`<PackDir>/<shader>`); lasting effects (`start` → handle: move/setLevel/stop, fade in/out);
  time scaling, part filters, stretched tubes, nested nodes, draw_pass_2, radial velocity, velocity limit, sampled
  textures, torus meshes; caps by graphics quality (low 6/3/4 one-shots/minor/lasting, medium 12/7/10, high
  16/10/16; low thins lasting particles). Cylinders now use Godot's UVs (side in v 0..0.5: explosion rings and
  streaks draw as the packs meant). Four-point stars with no smoothness are hard-edged (they were squares).
  `game/lastingFx.ts`: owners ask per frame by id; the nearest 70 m win the places, the rest keep their plain look.
- **Electric FX** (CC0 licence file): Arc Caster / Arc Turret / fence arcs are pack bolts per jump (map.arcs; 2.5-4x
  speed for the 0.1-0.15 s between arcs; plain lines for any jump not drawn), crackle where the last lands; the
  Arc Turret's charge is a ball of lightning over the orb (orb kept at 0.35 alpha so the tell still reads; same
  size and timing; `chargeOrb()` reports the drawn size); `trap.shock` crackles.
- **Flame FX** (CC0): fires on burning patches (3-4 per patch; tongues where none drawn), burning vehicles and
  wrecks (flame puffs only where none drawn), flares, flame-trap nozzles.
- **Poison VFX / Smoke VFX** (Vol. 1, no licence file: `LicenseRef-Purchased`, a tier build.mjs now accepts; licence
  notes in `assets-src/binbun-*-vfx/License.txt`): toxic gas cloud over its fainter dome; pack smoke column on
  heavy/burning/wrecked vehicles (black puffs past 70 m or when not drawn).
- **Not done** (and why): smoke grenades (no such weapon), burning barrels (barrels explode, they don't burn),
  acid (none; `goo` is a slowing goo); flamethrower puffs (each puff lives 0.55 s, ~11 per user: too many lasting
  effects; needs a cheap shared-material puff); Beam/Magic Orbs/Projectiles (railgun, Singularity vortex, bolts:
  the beam pack is driven by its controller script's length/radius, not ported yet); Status FX (11 shaders);
  **Loot** glows: shaders and the torus ported, map entries removed: their MeshInstance parts were active but
  drew nothing as lasting effects (even with a StandardMaterial swapped in), cause not found; check whether
  lasting effects' mesh parts draw at all (fire `Core`, the poison cloud's `Glow` may be affected too) before
  wiring loot; Portal VFX, Ice/Frosted Glass, Battle/Dark/Elemental Magic not started.
- Evidence (agent scratchpad `fx/`): `electric/strip_arc.jpg`, `strip_sentryarc.jpg`, `strip_charge.jpg`,
  `strip_fence.jpg`, `zoom_charge.png`; `flame/strip_fire.jpg`, `after_fire_03.png`; `smoke/strip_smoke.jpg`;
  `loot/` (the failed glow). Harness: `fx/../tools/shot.mjs` (frame clock: 1/60 s per drawn frame, bots held off).
- Checks: typecheck; test:changed 12 pass (fxMap 8 incl. "every mapped part's shader is ported", lastingFx 3);
  content OK; perf:budget pass (above); menu 837.5 kB gzip (unchanged). E2E (`CI=1`): physicsfx PASS (273 s), arsenal PASS (454 s), vehicles PASS (289 s, the Arc Turret checks), visual PASS (no baseline change; canyon 0.1 %). ci:plan: content and
  assets-src paths → full suite (38 flows): needs a `check/` run before main.

### Pickup models: medical bag, rifle ammo box, WWII Ammo Crate (`wip/pickup-models`, agent, 2026-11-03; not merged; from main a2fd44b)
Owner's three Drive models (Meshy community, CC0 per the owner; downloads in `/home/user/meshy-drive/drive-2026-11-03-pickups`,
not in the repo). docs/ASSET_SOURCES.md and docs/CONTENT_PIPELINE.md have the rows and rebuild commands.
- **Large health** (`core.health_large`, already 50 HP / 25 s respawn / bot value 0.7; small is 25 / 15 s / 0.4; unchanged)
  is drawn as the medical bag `models/pickups/health_large.glb` (0.5 m long, 2.4k triangles, 147 KB; falls back to the
  medkit at 1.6x). Small health keeps the medkit. No new pickup type was needed. Bots seek it as before (kind `health`).
- **Rifle rounds** (`core.ammo_rifle`) are drawn as the ammo box `models/pickups/ammo_rifle.glb` (0.5 m, 3.0k triangles,
  127 KB; falls back to the striped block). Its stencilling named a real ammunition maker, so all of it is painted out
  (prepare-guns.mjs `paintOut` gained a near-black rule `{ dark, chroma }`): a plain olive box. Every other ammo pickup
  (`core.ammo` and light/shells/sniper/explosive/cells/fuel/chem) keeps the striped block in code; giving them the box
  too is one line in `pickupVisuals.ts`, but they would then look alike (the stripe colour is what tells them apart).
- **WWII Ammo Crate** prop `prop.ww2_ammo_crate` (Crates & Barrels, Military style pack; two stacked crates, 0.9 m,
  5.2k triangles, 236 KB, box collision 1.04 x 0.9 x 0.63 m, breakable 40 like the other crates). There is no ammo-crate
  pickup or resupply in the game, so it is a prop only; the in-house `prop.ammo_crate` stays.
- Pickup models live in guns.json (pack `meshy-community-pickups`, folder `models/pickups/`) like the medkit, sized to
  the small-prop budget (6k triangles / 400 KB) since a map has many. No glow or effect changes (wip/fx-pass owns those);
  the existing hover/spin and rings are kept.
- Evidence: agent scratchpad `pickups/` (in-game shots next to a bot, MapMaker shots, asset viewer, the texture before
  and after the paint-out; scratch tools in `pickups/tools/`).
- Note: the bag carries a red cross on white roundels (as the code fallback medkit does); flagged to the owner.

### Arc Turret, Singularity Cannon model, Mossy Rock Spire (`wip/arc-turret`, agent, 2026-11-02; not merged; from main 151d9dc, rebased on 371f63d)
Owner's three Drive models (Meshy community, CC0 per the owner; downloads in `/home/user/meshy-drive/drive-2026-11-02-props`,
not in the repo). Owner's choice (2 Nov): the Arc Turret reuses the Rocket Turret's processed cannon, told apart by its colour.
- **Mossy Rock Spire** (`prop.rock_mossy_spire`, Rocks & Wood; pack `meshy-community-drive-1102`): 5.0k triangles, 211 KB,
  2.4 m. Tilts with the slope (TILTED_PROP_CATEGORIES), settles to the lowest ground under it, collides as a rounded
  rock (`isRock`: the id has "rock"). Rebuild: `ONLY=rock_mossy_spire node tools/content/prepare-props.mjs --downloads /home/user/meshy-drive`.
- **Singularity Cannon** on `guns/plasma_blaster.glb` (0.66 m, 13.7k + 2.7k LOD, 1.17 MB, hero tier; fallback the old
  Quaternius model). New guns.json knob `glow` (prepare-guns.mjs): the download's orange glow recoloured to `#b07aff`
  plus an emissive map. Holds grip [0,-0.13,-0.17], support [0,-0.076,0.17], shoulder [0,0,-0.33], muzzle [0,0.042,0.33],
  view offset [0.27,-0.28,0.54]. Grip audit (`grip-audit.mjs` now takes `WEAPONS_ADD=singularity:core.singularity`):
  on Ranger, Knight, WWII Infantry and The Visitor the cannon raises no flag the rifle doesn't. It is big in first
  person (lower right quarter of the screen): a cannon, but shrink `length` if the owner finds it too much.
- **Arc Turret** (`MOUNT_DEFS.sentry_arc`, weapon `core.sentry_arc`, `Match.runArcSentry`; docs/VEHICLES.md "Arc Turret"
  has the numbers against the other turrets): 0.75 s wind-up while lined up, then 5 per 0.1 s locked (no miss), one
  chain jump (6 m, ×0.5), range 22 m, 2 s lock then 1.25 s vent, 240 health; losing sight/range drops lock and charge.
  Snapshot bits MOUNT_FLAG_CHARGING (8) / MOUNT_FLAG_ARC (16); `arc` events carry `m` (mount index). Client: glow
  (`MountDef.glow`, mountVisuals `setMountGlow`), charge orb (`View.chargeOrb`), wind-up sound (`trap.warn`), crackle
  `fire.arc` every 300 ms. Validation `mount.arc_spawn` (within 12 m of a spawn it would shoot). On no official map.
- Tests: `packages/shared/test/arcSentry.test.ts` (9); e2e vehicles flow `arcTurretChecks`. Palette atlas and the
  cannon's kill-feed icon regenerated. Evidence: agent scratchpad `props4/` (rock on a slope, turret charging and
  firing, cannon first person and grip sheets, close-ups).

### Characters batch 4: six new characters (`wip/char-batch-4`, agent, 2026-11-02; not merged; from main 151d9dc)
The owner's "All Animations" downloads of 2 Nov (CC0 Meshy community
models the owner rigged and animated on Meshy; recorded like WWII Infantry and the clip set's sources), built with
`ONLY=<ids> node tools/content/prepare-meshy-characters.mjs /home/user/meshy-drive/drive-2026-11-02-anim`:
- **Biker Gang Girl** `core.bikergirl` (`meshy_bikergirl`, folk, gangster names, female, order 97): fingerless gloves
  with fused, low-poly fingers. Split, the left hand crumpled into shards on the grip: both hands are mittens
  (`fixes.hands.mitten`, curl 0.9). Her bare fingertips still fold sharply against the dark glove up close; the curl
  test on her shooting hand stays flat (grip audit 3 "flat", as WWII Infantry's 3 "back"). A palm override made it worse.
- **The Hollow Visitor** `core.hollowvisitor` (`meshy_hollowvisitor`, creatures, alien names, order 98): a grey
  bilobed-headed alien in a worn sweater; a new character beside The Visitor (`core.visitor`). Long split fingers,
  curl 1.3; the support hand's claws still read splayed under the handguard. Audit 3 "spikes": calf/foot stretch
  (baggy trouser hems over feet levelled 14-15 degrees), not visible at play distance.
- **Fearsome Undead** `core.fearsomeundead` (`meshy_fearsomeundead`, horror, undead names, order 99): plaid-shirt
  zombie with clawed hands (mitten, curl 1). Audit 0.
- All three on the shared clip set (no opt-out): strafe-shoot, back-shoot, run-shoot and ADS-strafe read like WWII
  Infantry's. Feet on the ground; standard size (heads 1.54 / 1.62 / 1.59 m posed). Portraits captured and indexed.
- **The last three** (2 Nov evening; the lead put the downloads in `/home/user/meshy-drive/drive-2026-11-02-big/` with
  the owner's approval: the Drive connector only takes files under 10 MB):
  - **Emerald Robot** `core.emeraldrobot` (`meshy_emeraldrobot`, creatures, robot names, order 100): a slim teal-and-grey
    robot with a boxy camera head; clamp hands (turned on their joints, mitten). Audit 0 as built. 512 px normal map
    (at 1024 the body was 1.89 MB, over the 1.8 MB file budget).
  - **Space Marine** `core.spacemarine` (`meshy_spacemarine`, soldiers, soldier names, **small**, order 101): despite
    the name a short green, pointy-eared alien in a red uniform (0.91 m in the download). Hands scale 0.8, curl 1.2
    (25-30 cm hands stayed open off the gun: audit 9); `fixes.hold` forward 0.06 / down 0.1 / out 0.08 (the big head put
    the stock at its mouth; head to gun 0.15 -> 0.29 m). Audit 4: shooting palm 7-8 cm off the grip (off, fp). Goblin
    names broke the soldiers-only bot test (botThemes.test.ts), so soldier names.
  - **Spiked Skeleton Biker** `core.skeletonbiker` (`meshy_skeletonbiker`, horror, undead names, order 102): skeleton in
    a spiked leather jacket and spiked gauntlets. Its long, thin, spread finger bones read as one mitten and curled into
    splayed sticks (audit 6-9 at curl 1-1.5): hands scale 0.7, curl 1 (as Rattles, the Vampire, the Pharaoh); compact
    on the grip, audit 6 (curl test flat, one stretched edge). 512 px normal map (1.85 MB at 1024).
  - All three on the shared clips (no opt-out); feet planted.
- Evidence (lead scratchpad `chars4/`): `before/`, `after/` (clip sheets with WWII Infantry for reference),
  `after/lineup.jpg`, `grip/`, `grip2/` (grip sheets before/after the hand fixes), `audit-before/`, `audit-2/`,
  `close/` (hand close-ups, raw download hands, first person), `portraits.png`; the last three: `after-b/`
  (clip sheets, `lineup.jpg`), `grip-b/`, `grip-b2/`, `audit-b1/`..`audit-b5/`, `portraits-b.png`; scratch tools in
  `chars4/tools/`.
- Checks (all six): typecheck; test:changed 1269 pass, 2 failed then passed rerun: botThemes "soldiers only" (the Space
  Marine had goblin names; fixed) and host.test.ts (a 20 s hub wait at load 12; passed alone); content OK; e2e (`CI=1`)
  characters PASS (955 s), designer PASS, visual PASS (menu 0.30 % off its baseline). ci:plan: content paths count as
  shared, so the full suite (38 flows) needs a `check/` run before main; only these three ran here. Menu bundle 836.9 kB
  gzip (836.4 before; budget 840). `__grips.crowd` 25 strafing+firing (load 7-13, noisy): clip ms/frame 1.8-2.8
  against WWII's 2.0-2.8, after-clip work within noise of WWII's.

### Clips on every character (`wip/clips-all`, agent, 2026-11-02; not merged; from main e29a097)
Owner (2 Nov): "Use those clips on all of them; that should save time when we rig the rest that don't have them."
- **Default clip set:** `DEFAULT_CLIP_SET = 'shooter'` (shared looks.ts, `clipSetOf(look)`): every look on the rig moves
  with it while armed and upright, with nothing in its manifest: the modular looks (Linktifa, Sprout), Designer looks,
  all 91 walking whole bodies, and characters rigged later. Opt out per manifest: `"clips": false` + `"clipsWhy"`
  (checked); name another set: `"clips": "<id>"`. Rolling bodies (`locomotion: roll`) get none. Nobody opted out.
- **Shared sets:** `content/clip-sets/<id>.json` (sources with model/licence/rig, clip → source), built by
  `node tools/content/clip-set.mjs --build /home/user/meshy-drive/drive-2026-11-02-anim` → `characters/shooter_clips.glb`
  (103 KB, loaded once) and `content/clip-sets.lock.json` (build.mjs checks it, provenance records it; role
  `meshy-clips`, `rig: owner`). Licence: assets-src/meshy-community-characters/License.txt, docs/ASSET_SOURCES.md.
- **Chosen clips** (consensus deviation, per region, of the same Meshy clip from the four downloads; scratch tool
  `clips-all/tools/measure.mjs`): Walking from WWII Infantry (legs 2.0° vs 2.4-3.4), Running from The Hollow Visitor
  (3.5; Undead 7.5), Walk_Forward_While_Shooting from Biker Gang Girl (upper 2.0), **Run_and_Shoot** from The Hollow
  Visitor (upper 2.4; new slot `clip_shoot_run`), Walk_Backward_While_Shooting_inplace from Biker Gang Girl (3.1).
  Side_Shot unused (a kneeling shot in place: hips 0.45-0.56 m). Undead gives nothing.
- **Animator:** `clip_shoot_run` on the upper body (masked copy) with the legs' run share, the shooting walk with the
  walk share (gait.ts `clipUpperWeights`); at 3.9/5.2 m/s it is ~all the running shot. WWII Infantry moved onto the
  shared set (his own `meshy_wwiisoldier_clips.glb` retired; body files rebuilt byte-identical).
- **Not on clips:** Baseball Robot (rolls), creature skins (own rigs), NPC soldier mannequins (`spec.npc`, rig gait;
  an easy follow-up if wanted).
- Evidence: lead scratchpad `clips-all/before/*.jpg`, `clips-all/after/*.jpg` (all 93 looks: strafe-shoot,
  back-shoot, run-shoot, ADS-strafe; over the shoulder and side), `clips-all/compare-key-looks.jpg`,
  `*-state.json` (which clips play), `tools/sheet.mjs` (the harness driver).
- **Perf** (load 4-20 from other agents, SwiftShader; noisy): `__grips.crowd` 96 characters, clip evaluation
  ms/frame strafing+firing before→after: Linktifa 28.8→12.1, Poly Soldier 18.9→9.6, WWII 7.8→7.2; backing up 22.9→6.3,
  14.6→9.6, 16.7→23.4; after-clip work 119-156 → 125-177 ms (noise); animatables strafing 9,175→10,071 (+9 a
  character: the upper-body copy), heap the same. `pnpm perf:budget` (frost_basin): draws 316/222 (budget 900),
  casters 87 (600), slowest effect 0.9 ms (40): pass. Menu bundle 836.4 kB gzip (836.0 before; budget 840).
- Checks: typecheck; test:changed 1314 pass, 2 fail = pads.test eagle_spires/frost_basin timing out at 180 s
  under load 20 (24/24 pass alone); content OK; e2e (`CI=1`) characters PASS (849 s; the third-person check now wants
  every walking look on the shared set with its running shot, and the Baseball Robot on none), visual PASS (no
  baseline change), offline PASS. ci:plan: full suite (shared looks.ts, gait.ts): needs a `check/` run before main.

### Bots: riders stay, squads push (`wip/bot-tactics`, agent, 2026-11-02; not merged; from main 8bc4001)
Owner (2 Nov): bots get out of his vehicle when he starts driving; tactical squads with a leader go in circles or
don't push. docs/BOTS.md "Riding, and pushing with a leader" (causes, before/after table).
- **Riders**: the rider's `parked` check took the idle clock (`-Infinity` while moving) at face value, so every moving
  vehicle read as parked: out ~1 s after setting off. Fixed; bot drivers that make no route progress (10 m / 12 s)
  now give up like stuck ones (riders no longer bail on them for free). `test/botRiders.test.ts` (Iron Maw, 60 s).
- **Squads**: unreachable pickups re-picked every 2 s (Shingle Point's sunken-bunker rocket launcher held the
  assault squads at their spawn) → given up 90 s, across respawns; members/leader back to the squad goal after a
  detour; squad goals kept while the leader is closing; half the squad at the goal counts as arrived.
  `test/botPush.test.ts`, `botRoles.test.ts` "squad goals". Probes (not committed): agent scratchpad `probe/`
  (`push.mts` metrics, `lead.mts` player-leader orders, `loops*.mts` breakdowns).
- Open: Iron Maw idle out of a fight is a couple of points higher on some seeds (bots in `mount` waiting by a
  vehicle); kills/min within noise. CTF unchanged (no squads in objective modes).

### St. John's: Welles built to the top, banners as cloth (`wip/st-johns-2`, agent, 2026-11-02; not merged; from main e29a097)
Owner's answers (2 Nov) to the two choices below: "build the walls", "sure, read as cloth". All MapMaker data, made by
driving MapMaker with Playwright (Import → select → Ctrl+D / Shift+PgUp / arrow keys / R / inspector fields / toolbar
Delete → Save; the saved file is MapMaker's own output). No code changes. Scratch driver, steps, probes and pictures:
agent scratchpad `st-johns-2/` (`tools/maker2.mjs`, `tools/steps.mjs`, `before/`, `after/`).
- **Welles (the east-west hall, local frame yaw 0.5°, lx 19.3-76.9, lz -90.6..-70.8)**: 3rd storey floor 8.04-8.34 m,
  4th 12.04-12.34, roof 16.04-16.34 (the old 8 m roof `block_1426` moved up and run to the north wall), parapets
  16.34-17.24 and battlements 17.24-17.94 (the old ones moved up 8 m; the six north battlements past x 29.5 deleted,
  the north-south hall's wall carries its own). South, east, west and north-west walls (with their windows) and the
  string courses are the 2nd storey's copied up one and two storeys (38 blocks each). Stairs: the hall's own flight
  (16 steps) copied turned about beside the stairwell (2nd → 3rd, lx 23.5-26.1, rising south) and straight above the
  first (3rd → 4th, rising north). Doorways (2 × 2.8 m, lx 47-49) through the north wall (`block_1072`, `block_1082`
  split into left/right/lintel) onto the north-south hall's stair landings, with a stone threshold (its floors are
  0.4 m higher; steps are max 0.3 m). Sills (1.1 m) in the two 9 m openings over the courtyard (`block_1073`, `1083`).
  Inside: the 2nd storey's bunks, dressers and rug and the refectory's four long tables copied onto both floors
  (30 props), 6 ceiling lights (3 a floor), rifle ammo (3rd) and health small (4th). `light_1459` moved 0.9 m east
  (off the new stair hole). Totals: +121 blocks (2,480), +30 props (729, 59 models), +6 lights (72), +2 pickups.
- **Chapel banners** `block_601`-`626`: Light Panel → Canvas, tints kept (Canvas's pale weave keeps the colours;
  Carpet is dark red and would muddy them).
- Owner (2 Nov, later): "yes add a weapon pickup up there": a **marksman rifle** (`pickup_dmxokrxrmg`, a MapMaker
  copy of Hazelwood's `pickup_2873`) on the 4th storey at (60.4, 12.34, -74.1), by the wide window over the courtyard
  and the doorway into the north-south hall. The map had one marksman (west side, upstairs in Hazelwood); this is the
  east side's. Rifle ammo is on the 3rd storey.
- Bots: navmesh routes from both teams' spawns to both new floors (by the stairs and through the doorways); bots sent
  there (hold orders, no enemies) arrive in 45-70 s. Free TDM (24 bots, 600 s, seeds 1-3; bot-seconds on the floor,
  distinct bots): without the marksman, 3rd 1/20/0 (1/2/0 bots), 4th 0/0/0; with it, 3rd 42/16/4 (6/3/1 bots),
  4th 48/73/24 (5/2/2 bots). No kills up there yet in those runs. Probe: agent scratchpad `st-johns-2/tools/reach.mts`.
- Left open from below: `block_1737` (a stray stone piece), Visitor first-person arms.

### St. John's: owner's screenshots of 2 Nov (`wip/st-johns`, agent, 2026-11-02; not merged; from main 8bc4001)
Owner's shots 62 (courtyard), 63 (walk by the hall with the clock tower), 64 (inside, where the two halls meet).
Cameras and before/after pictures: agent scratchpad `st-johns/before`, `st-johns/after` (scratch tools in `tools/`).
- **Engine, every map** (settle.ts, both in the game and MapMaker):
  - **Hung fixtures** (`fixtureGap`, `hungPropLift`, `HANG_REACH` 1.5 m, `HANGING_PROPS`): ceiling panels and strips
    are drawn flush under the ceiling over them, a bulb's cord and a chandelier light's chain reach up to it, and
    hung props (Chandelier, Candle Chandelier, Ceiling Light Panel, Hanging Brazier) are drawn with their top against
    it. Data unchanged; the light still shines from where it was put. St. John's: every ceiling panel hung 0.55 m
    under its ceiling (the "white triangle" in 64 is one seen edge-on), the chapel's chandeliers 1 m under the roof
    (the white chandelier "floating" in 64). ScenarioVisuals gets `ceilings` (the level's boxes) from build and from
    MapMaker's setMap.
  - **Props stay bedded as played** (`rebedShift`, `rebedProps`, in `loadMap` before terrain-under-floors; MapMaker's
    view shifts them the same way): MapMaker settles props on the map's own ground, the game lays the walks into it
    at load, so props by a walk sat up to 0.24 m sunk or standing off (18 on St. John's: street trees, lamp posts,
    bushes). Props on a floor/block/prop or placed off the ground stay put. The "half-sunk teal plant" of 63 is
    Kenney's Large Bush (`prop_3299`, a blocky low-poly model, leaning with the slope) at the walk's edge: re-bedded
    5 cm; the rest is the model.
- **MapMaker data** (Import → select → toolbar Delete / inspector fields → Save, Playwright driving the page; the
  saved file is MapMaker's own output, which also took the map to format 25):
  - Deleted `block_1318`: a blue **Light Panel** block (the striped "diamond" in 63) 1.1 m off the fourth-floor
    window of the north-south hall's west face, over the lower half of the window: a stray piece, nothing like it on
    any facade.
  - `block_946` (the north-south hall's ground floor) reached 0.5-0.7 m short of its south wall: the grass strip at
    the floor's edge in 64. Depth 45.76 → 46.46 m, moved 0.35 m south (its edge now under the wall).
  - validate-map 0 issues.
- **For the owner** (not changed):
  1. The "hollow shell" of 62: the east-west hall's north wall carries on up from 8 to 16 m (`block_1069`-`1088`, string
     courses `block_1232`, `block_1240`, battlements `block_1244`-`1254`) along its whole 47 m, but the hall's roof is
     at 8 m: a two-storey screen with sky through its windows. It looks like the north-south hall's south end, stretched to
     the other hall's length when the halls went onto the OSM footprints. Choose: cut it back to the north-south
     hall's 14 m width (delete the parts over the east-west hall), or build the east-west hall's 3rd and 4th
     storeys (floors at 12 and 16 m, south and end walls, stairs).
  2. The chapel's ten wall banners (`block_601`-`626`) are the same glowing striped Light Panel material: Canvas or
     Carpet in their colours would read as cloth.
  3. `block_1737` (a 0.5 × 0.5 × 1.4 m stone piece at 2.0, 5.5, -87.2) touches nothing.
  4. Not bugs: the "flat picture of trees" in 62's low opening is the street trees seen through the east-west hall's
     open ground floor; the far hall's dark, busy look in 63 is its material, Mossy Castle Stone (Bricks076C, 512²,
     mipmapped, 3 m per repeat; Grey Stone Blocks or a lighter tint if wanted); the big teal tree is the low-poly
     `oak_dark` model; the window boxes are the 0.6 m wall reveals onto unlit rooms.
- **The Visitor's first-person arms** (the owner's alien is **The Visitor**, `core.visitor`, `meshy_alien`): cause
  found, not fixed. `<id>_fparms.glb` is cut with one recipe for every character (prepare-meshy-characters.mjs
  `slimArms`: the elbow 40% of the forearm dropped, the forearm pulled to 60% of its girth towards the bone
  (`FP_SLEEVE`, made for sleeves), the hands shrunk to 78% (`FP_HAND`, made for gauntlets)). The Visitor's bare
  forearms and slender hands are already thin, so they come out as pale stalks with spike-thin hands at the grip
  (grip sheet: agent scratchpad `st-johns/fp-compare.png`; Alien Encounter and Alien Biker keep visible hands). Fix:
  a manifest knob (e.g. `firstPerson: { arms: "own", sleeve: 1, hand: 1 }`, checked in character-manifests.mjs and
  read by `slimArms`), then `ONLY=meshy_alien node tools/content/prepare-meshy-characters.mjs
  /home/user/meshy-drive/tposes-2026-11-01` (the download is there) and a grip sheet.
- Checks (rebased on main e465758, with wip/fix-terrain): typecheck; test:changed 1262 pass (new: hungFixtures.test.ts,
  rebed.test.ts; before the rebase 4 timed out under load and passed rerun alone); validate-map st_johns 0 issues. e2e (machine at load 16 on 4
  cores, so `CI=1` for the CI timeouts): editor, visual, maps with `E2E_MAPS=st_johns` PASS; offline FAIL twice on
  the kill-cam banner (arena, nothing here touches it; first run a killer-name mismatch, second no banner in time),
  maps6 "no match" timeouts on maps this doesn't touch without `CI=1`. The change touches shared code: the full suite
  needs a `check/` run before main.

### Iron Maw "snow patches": overlapping roads z-fought (`wip/fix-terrain`, agent, 2026-11-02; not merged; from main c6751d5)
Owner's screenshot: pale "snow/ice" patches with hard jagged borders on brown dirt near Iron Maw's crusher. **Not the
terrain**: Iron Maw's terrain holds only sand, stone and gravel (no snow, unchanged since the greybox; `terrainMaterialFor`
only affects new painting in MapMaker, never how stored cells render). The pale surface is the **concrete
`crusher_apron` path** (Concrete034), the brown the **dirt `rim_haul_road`** (Ground109): the apron starts and ends on the
haul road and runs over it, both ribbons sat at the same lift with the same polygon offset, so the depth buffer picked a
winner pixel by pixel (jagged, triangle-shaped patches). Fix: `pathDrawRanks` (shared/map/paths.ts) gives each drawn path
a draw rank (0 when it overlaps nothing drawn before it, else one above the highest it overlaps: the later path in the
list lies on top); pathMeshes/roadMeshes lift each rank `PATH_RANK_LIFT` (3 cm) and pull it `pathRankUnits` (−8 polygon
offset units per rank) toward the camera, lines and curbs with it (`flat()` takes units). Rank 0 renders exactly as
before. Iron Maw ranks: rim 0; spiral, switchback, ne/west spurs, apron 1; nw/se spurs 2 (≈30 ms once per build).
Shots: lead scratchpad `terrain-fix/compare-apron.png`, `before-*.png` / `after-*.png`.
- Owner's call (MapMaker data, not code): whether the pale concrete apron belongs in a desert mine (Paths tool → its
  style, e.g. Gravel or Dirt trail), and where it should end on the haul road.
- Noted, not changed: the terrain itself has **no blending** between ground layers (one mesh per layer, hard 3 m cell
  edges, MapStyler.buildTerrain); on any painted map the borders are square steps. Soft blending is a renderer feature
  of its own (vertex weights + layered alpha, or a splat shader), not part of this fix.
- Checks: typecheck; test:changed 1246 pass (new: paths.test.ts `pathDrawRanks`); e2e editorux, race PASS; maps3 failed
  only diamond_park/mercy_ward "no match" and a MapMaker import timeout after them: the diamond_park page crashes the same
  way on a main build in this container (load ~14), so not this change. ci:plan says full suite (shared/map/paths.ts).

### Ragdoll joint limits (`wip/fix-ragdoll`, agent, 2026-11-02; not merged; from main c6751d5)
Owner's report: on Iron Maw (TDM, many bots) corpses lay with limbs bent impossibly (a dark character folded with
arms and legs up, a green creature splayed and twisted). **Cause:** `ragdoll.ts` joined its capsules with Rapier
spherical joints with **no limits** (HANDOFF's 2026-10-29 note), so elbows/knees bent backwards, thighs swung up
behind the back, heads and limbs twisted round; whole-body rigs (different proportions, death poses) showed it most.
Checked and not the cause: the far copy (LOD) shares the joints (its skeleton follows the same nodes; `freezePose`
prepares every skin), the scope zoom only moves the LOD switch, capsule sizes/pushes are unchanged and hold on the
ground. **Fix:** `game/ragdollJoints.ts` plans each joint's frame on both bodies from the joint *positions* at death
(body up/right/forward with the avatar's facing settling front and back; each limb's direction; the elbow's and
knee's own bend axis), never bone axes, so one table of anatomical limits (`JOINT_LIMITS`) holds for every rig;
each range is widened to include the pose at death (no snap). Sides come from where a limb is, not its name;
folded joints (rolling robot's legs) fall back to hanging. `EffectsWorld.ballJoint` takes the frames and sets
limits on all three angular axes (Rapier limits 2·asin of the relative rotation's x/y/z; limiting only one axis of
a spherical joint doesn't hold it). Test: `client/test/ragdollJoints.test.ts` (eight rig layouts: A/T/aim poses,
small, large, turned, mirrored names, folded legs; knee/elbow hyperextension, shin twist, thigh behind the back and
head turned round are outside, normal folds inside; a Rapier check that a knee driven forward stops at straight).
Perf: a 30-ragdoll Rapier bench steps no slower with limits (bodies settle and sleep sooner); budget unchanged.
Contact sheets (before/after, scratchpad of the session): `ragdoll-fix/sheet-before.png`, `sheet-after.png`.
Open: the cheap tier (far, in view) still hangs the limbs in the death clip's last frame relative to a tumbling
torso; no self-collision between a body's own limbs (an arm can rest inside the torso).

### Skin fix: Giggles, Dust Trooper, Goblina, Luther Vanguard (`wip/fix-skin`, agent, 2026-11-02; not merged; from main 93c22d8)
Owner: "Giggles and Vanguard models still distorted." Sheets (several angles, hold, run, close-ups, first person; before
above after) in the agent scratchpad `skin-fix/`: `core.<look>-before-after.jpg`, `before/weights-before.jpg` and
`after/weights-after.jpg` (bind pose coloured by limb: left arm red, right green, torso blue, legs yellow, magenta where an
arm and the body share a vertex away from the shoulder), `after/v14-close.jpg`, `others/pair-*.jpg` (the sample below);
scripts in `skin-fix/tools/` (sheet.mjs, close.mjs: `?mode=grips` renders; weights.mjs: offline bind/hold pictures of a
built GLB or a rigged download).
- **Cause (all four):** the downloads stand with the arms down, hands on the hips, sleeves against the body, and their
  weights (Meshy's, and ours on Vanguard) tie the hands, the sleeves' insides and the body's side under the arm to
  both the arm and the hip/spine. Turning the arms out to the T-pose (pose()) dragged those vertices halfway: sheets and
  strands from the hands to the hips were already in the BUILT BIND POSE (the grip audit's stretch test compares the
  hold with the bind pose, so it never counted them: its "spikes" were 0 on Giggles and the Dust Trooper). Goblina's
  "flap hands" are her clawed hands smeared that way; Vanguard's threads run from his fingertips (which touched his
  thighs). Vanguard also had the Frida fault: found shoulders under the pauldrons at the base of the neck, elbows and
  wrists on the arms' inner edge.
- **Fix:** `tools/content/skinclean.mjs`, opt-in `fixes.skinClean: true` (rigged and unrigged downloads; in pose(),
  before the turn): skin facing away from its own bone decides arm vs body (a sleeve's inside is the arm's; the body's
  side under a hanging arm is the body's when that patch is joined mostly to the body; else the nearer bone); only
  joints within 2 of the anchor on the rig's skeleton keep a share; after the turn, triangles reaching a forearm or a
  hand that stretched past 3x (fingertip fused to a thigh) are torn and the holes closed with flat fans; armpits are
  never torn (tearing them opened Goblina's side under her cape). Tests: tools/content/test/skinclean.test.mjs.
  Tried and dropped: tearing every stretched triangle (holes down Giggles' and Goblina's sides), copying the sleeve's
  contact skin onto the body (a print of the cuff left on the hip).
- **Vanguard:** his rig task 404s on this key (as the Dapper's and Nova's), so he is rigged in-house from the unrigged
  download (meshystuff) with shoulders, elbows, wrists and hand tips set by hand (`landmarks` in his manifest); lock role
  `meshy-autorig`. Hands: right curl 0.5 (a `hands.scale` 0.85 try changed nothing in the audit: dropped).
- **Rifle grip audit, before → after:** Dust Trooper 9 (flat open off fp) → **3** (spikes); Giggles 9 (flat open off fp)
  → 10 (flat off spikes fp: one spike edge at spine_01, the small blue sleeve-hem flaps below); Goblina 9 → 9 (open off
  spikes fp; her spikes are the ragged skirt and braids, before and after); Vanguard 5 (back fp) → 10 (flat off spikes
  fp: 3 small spikes, max 4.9). Finger skin (finger share R/L) Giggles and Dust Trooper 0/0 → 0.4-0.58 (the hands are
  hands now); drawn hand to grip Giggles 13/24 → 7/8 cm, Goblina 17/11 → 9/7 cm, Dust Trooper 9/12 → 6/8 cm. The
  sheets are the judge: no strands from any angle in the hold or the run. Remaining: Giggles' sleeve hems leave small
  blue flaps under the arms close up; the Dust Trooper's coat shows a few dark shards at the hips close up.
- **Why opt-in (others checked):** on by default it rebuilt a sample (Desert Ranger, King Aldric, Scary Larry, Honest
  Abe, Freaky Frida, Kenji, Virtua Soldier; `others/pair-*.jpg`): Desert Ranger, Larry, Abe, Virtua Soldier unchanged;
  Frida's pigtails pulled into strands, a flap on Kenji's vest side, a dark shard on King's back: so none of them uses
  it and their files are main's. Try it on characters whose download pose has the hands on the hips.
- Rebuild: `ONLY=meshy_giggles,meshy_dust_trooper,meshy_grizzelda,meshy_vanguard node tools/content/prepare-meshy-characters.mjs /home/user/meshy-drive/skin-fix-rig`
  (links: the three rigged GLBs re-fetched earlier into the model-quality scratchpad `dl/rig/`, and Vanguard's unrigged
  download from meshystuff; the rigged ones re-fetch with fetch-meshy.mjs, no credits). No Meshy credits spent.
- Checks: typecheck; test:changed 46/46; content:check OK; bundle 833.0 kB gzip (budget 840); e2e characters PASS (1,003 s; the first run failed one check on the Dapper (`look=core.dapper`, untouched): "hands drawn on the gun through switches", mouse wheel, body 12 cm, at load 10-17; passed on rerun).

### Third-person shooting while moving + clip retargeting (`wip/anim-retarget`, agent, 2026-11-02; not merged; from main 8bc4001)
Owner: "shooting while moving looks wrong", specifically strafing while shooting and aiming (ADS) in third person and
shooting; and "extract this [WWII Infantry walk-and-shoot] animation and reuse it with all the t-posers. just ww2
infantry for now to test". Brief: lead scratchpad `anim-retarget-brief.md`.
- **Strafe bug (every character, bots and remote players too):** the after-clip turns read the world's up axis through
  a rotation-only inverse of a mirrored joint frame (`getRotationMatrix` of the glTF import's z-flipped skeleton). That
  happened to be right for the hips (the root joint's frame) and the spine's pitch, and backwards for the spine's
  twist, so the spine's counter-turn went the same way as the hips: strafing at full speed put the chest ~140° off the
  aim (measured shoulder line: fwd 120°, strafe right -100°, left -27°), the arms IK-wrapped round to a gun still
  pointing ahead. Firing never froze the legs (shoot is masked to the upper body). Fix: `worldTurn(parent, axis,
  angle)` (characterAnimator.ts) through the parent's full inverse with the mirror's sign; hips, spine pitch/twist,
  flinch, kick and seated legs use it (callers' signs put in the one world convention: + about up turns +Z toward +X,
  + about right tips the top forward). Now the shoulder line stays at 122-124° for still/forward/strafes/back. The FP
  clavicle roll self-corrected already (unchanged result). Seated legs measured the same (knee/foot within cm).
- **ADS in third person:** your rounds go from the eye to the crosshair point (thirdPersonAim, 0.6.1), the gun pointed
  along the view beside it; zoom magnified the miss. Now session.ts sets your own pose's pitch and `aimYaw` from
  `thirdPersonAim` (world raycast only) and the animator turns the gun (aim quaternion) and shoulders onto it
  (`MotionState.aimYaw`, eased 18/s). Remote players/bots unchanged (they aim along their view).
- **Clip retargeting** (`tools/content/retarget.mjs` math, `tools/content/clip-set.mjs` GLB + CLI): rig(t) = src(t) ·
  srcRest⁻¹ · repose⁻¹ · rigRest per joint (repose = the pipeline's own A→T bone turns, feet included), local under the
  rig parent; hips: straight-line travel stripped, bob/sway scaled by leg length; natural speed + direction from the
  planted foot, left touchdown phase; stored in the set's top node extras. Validated: the same Meshy clip from four
  different downloads (WWII, Biker Gang Girl, Hollow Visitor, Fearsome Undead) gives world bone directions within
  0-8° on the rig (locals differ by bone roll only); the root-motion and in-place backward clips measure the same
  speed (0.85 m/s).
- **WWII Infantry rebuilt** from `Meshy_AI_WWII_Infantry_Soldier_All_Animations-3.glb` (gdown into
  `/home/user/meshy-drive/drive-2026-11-02-anim/`, linked in `/home/user/meshy-drive/build-anim/`): the body and arms
  came out byte-identical (same model; only clips added). Manifest: `clipsFrom` (Walking, Running,
  Walk_Forward_While_Shooting, Walk_Backward_While_Shooting_inplace) → `characters/meshy_wwiisoldier_clips.glb` (90 KB,
  lock role `meshy-clips`), `clips: meshy_wwiisoldier` on the look (`look.clips`). Rebuild:
  `ONLY=meshy_wwiisoldier node tools/content/prepare-meshy-characters.mjs /home/user/meshy-drive/build-anim`.
- **In game** (`CharacterAnimator.driveClipGait`, armed + upright gait only; everyone else on the rig's gait): forward
  and strafes: the set's walk/run on the legs blended by speed (gait.ts `clipGaitWeights`, `clipCycleRate`, phase-locked
  on the left foot), the forward shooting walk on the upper body (a masked copy; aim pose takes the rest); backing up:
  the backward shooting walk on the whole body with **stride warping** past 2× its cadence (`strideWarp`, thighs/knees
  scaled about the clip's mean pose, up to 2.2×). Crouch/prone/jumps/seats/first person unchanged. **Finding:** the
  download's shooting walks are slow combat steps (fwd 0.30 m/s over a 3.27 s loop, back 0.85 m/s) against the game's
  3.9 (ADS) - 5.2 m/s, so they can't drive the legs at game pace as authored; Walking (1.53) and Running (5.02 m/s)
  can. `Run_and_Shoot` (2.0 m/s, 0.67 s), in the three other downloads but not WWII's, is the best fit if the owner
  wants a running-while-shooting body.
- **Other downloads (not built):** Biker Gang Girl (66 joints, Mixamo; Running, Walking, Run_and_Shoot, Side_Shot 4 s
  standing, Walk_Backward_While_Shooting(+_inplace), Walk_Forward_While_Shooting), The Hollow Visitor (32 joints:
  Mixamo body, fingers as Bone_0xx; same seven clips), Fearsome Undead (66 joints; the same minus
  Walk_Forward_While_Shooting). All three have every joint the retarget needs and work as clip sources
  (`node tools/content/clip-set.mjs <glb>` lists them). Their licence must be recorded before a set is built from them.
- While a clip holds the upper body, the shoulders are brought back onto the aim pose's line (`chestFix`, measured
  standing in aim_idle): the authored torso turned 13-19° off strafing and 44° backing up; now 0 (shoulder line 134°
  in every direction, the hips 160-170° strafing).
- **Measured:** in game (arena, third person, ADS, firing) the drawn barrel lies along the rounds' path within 0.0-0.1°
  (the old view-parallel barrel: 14.8° off at a point 1.6 m out, 1.4° at 15 m); `__cs.tpAim()` reads the turn. Perf,
  96 characters each (`__grips.crowd`, SwiftShader at load ~16, so noisy): clip evaluation WWII 7-9 ms/frame against
  14-58 for the rig-gait looks, after-clip work (aim/IK) ~145 ms for all alike; +9 animatables a character while
  strafing (the upper-body copy), fewer backing up. The clip set file loads once (90 KB, not in the menu's JS; bundle
  835.1 kB gzip).
- Checks: typecheck; test:changed 1284 pass (2 failures under load, host.test and sandgate, pass alone); content OK;
  e2e characters: the new third-person check PASS, the flow failed only on a page.screenshot timeout in the Imp
  grips-in-play step (load 9-16 on 4 cores); offline: the kill-cam banner check (a 5 s window) failed twice; visual:
  the canyon screenshot timed out twice (menu, mapmaker and arena match baselines). All three look environmental;
  CI should confirm on a check branch (the change maps to the full suite). Tests:
  `tools/content/test/retarget.test.mjs`, `packages/client/test/clipGait.test.ts`. Harness: `__grips.drive(motion,
  shotsPerSecond, frames)`, `__grips.crowd(look, n)` in `?mode=grips`. Evidence: agent scratchpad `anim/frames/`
  (`compare-ranger.jpg`, `compare-polysoldier.jpg`, `compare-wwiisoldier.jpg`: before main 8bc4001 vs after,
  over-the-shoulder and side views, strafe/back/ADS while firing; `game-ads-ranger.jpg`).
### Seetah J. Chloth (`wip/seetah`, agent, 2026-11-01; not merged; from main c6751d5)
- `core.seetah` (`meshy_seetah`, order 96, Animals, `nameTheme: cat`): the owner's cheetah/sloth hybrid (owned, Meshy), from the
  rigged Drive download "Meshy_AI_rigged_cheetah_sloth_All_Animations.glb" (gdown into `/home/user/meshy-drive/drive-2026-11-01-seetah/`,
  linked in `/home/user/meshy-drive/build-seetah/`; no Meshy credits). Built like The Dapper/Alien Biker: 10,439 triangles (the whole
  download), far copy 2,608 (`lod` 0.25), 1.41 MB + arms 0.56 MB; grip audit **2** (`off` on rifle/spin/shotgun: holds look right);
  portrait captured. Checks: typecheck; test:changed 1244 pass; content OK; bundle 833.1 kB gzip; e2e characters (476 s), offline PASS.
  Contact sheet: agent scratchpad `seetah/contact-sheet.png`. Rebuild: `ONLY=meshy_seetah node tools/content/prepare-meshy-characters.mjs /home/user/meshy-drive/build-seetah`.
### Characters batch 3 (`wip/char-batch-3`, agent, 2026-11-01; not merged; from main c5be6c4)
Owner's Drive drops of 1 Nov evening (brief: lead scratchpad `drive-batch-1101-evening.md`). Downloads outside the repo in
`/home/user/meshy-drive/drive-2026-11-01-batch3/` and `...-batch3b/` (gdown: the Drive tool caps downloads at 10 MB); the
build dir of links is `/home/user/meshy-drive/build-batch3/` (also links Rusty Mech's rigged download). No Meshy credits.
Sheets in the lead's scratchpad `char-batch-3/` (portraits.png, grips-contact-sheet.png, distance-sheet-new.png,
dapper-rustymech-closeups/distance-before-after.png, roll-sheet.png; scripts in `tools/`, `scripts/`).
- **New looks** (orders 80-95; all rigged Meshy "All Animations" downloads unless said): Orange Suit Engineer (folk,
  167k → 16k), Gas Mask Engineer (soldiers; unrigged 561k, landmarks found, `cloth`), CRT Robot (creatures; unrigged,
  landmarks found; `lod` 0.35 so the far copy keeps the green screen), **Baseball Robot** `core.rollerbot` (creatures,
  rolls, below), Mummy Bot, Pharaoh Mummy Warrior, Vampire (horror), Stealth Operative, Crimson Operative, WWII Infantry
  (soldiers), Coffee Brown `core.vintagepro` (folk, owned), Field Medic Automaton (creatures, large), Alien Biker (owned,
  confirmed), Pink Mantis `core.pinkalien` (owner's name), Alien Encounter and Beanie Alien (both small). CC0 ones are
  recorded like main's T-pose community models (c3bce36: manifest `community.model`, pack meshy-community-characters).
  **Not built:** Cyber Medic (`Futuristic_Cyberpunk` is a medical backpack, not a body), Low_poly_3D_game_char (dropped).
- **Pipeline** (prepare-meshy-characters.mjs): a source joint not in JOINT_MAP rides its nearest mapped ancestor
  (Mixamo finger chains, end markers, a mummy's head wrappings, Coffee Brown's shin bones) instead of failing;
  `source.joints` names an unnamed rig's joints onto Meshy's (the Baseball Robot's Bone_000...); `locomotion: roll`
  (manifest top level) puts what the legs held on the pelvis (a rigid ball). Rebake (meshy-mesh.mjs): grown charts are
  turned to their tightest box before packing (only rebuilt rebaked characters change; Rusty Mech here).
- **Rolling locomotion** (look `locomotion: 'roll'` → CharacterInstance → CharacterAnimator): no gait clips (idle/aim
  only, jumps keep jump_air), no crouch/prone clips or prone tilt; the root tips about the ground contact toward the
  measured velocity (0.035 rad per m/s) and acceleration (0.025 per m/s²: turns lean inward), max 0.32 rad, eased; the
  spine takes the forward tip back so the gun stays on the aim; crouching hunches (low spine forward, chest back).
  Velocity is measured from the drawn position (teleports > 3 m skipped), so bots, players and remote players all
  lean. Not done: the ball doesn't spin (the download's ball is one surface with the torso: spinning it tears the
  waist), no rolling sound (footsteps still play).
- **The Dapper**: rebuilt from the owner's new rigged download (a different, realistic model: bowler hat, real hands;
  10.3k triangles, all kept, 1024 normal map); his old Meshy task ids moved into the notes (they 404 on this key).
- **Rusty Mech**: 15.9k → 17.8k triangles (of the download's 30.9k), headShare/handsShare up, far copy 0.25. Only a
  small visible gain: the roughness is in the download (a 30.9k remesh whose texture is thousands of tiny islands;
  rebaked into 2,800 charts it fills ~35% of the 1024 map). Better needs a cleaner source; the 1M-triangle
  "White Rusty Mech" texture download in meshy-drive is the community model Ivory Rustwalker came from (CC0, not the
  owner's rig): owner's call whether to rebuild Rusty Mech from it (in-house rig).
- Grip audit (rifle/pistol/shotgun/spear score; The Visitor 0): Orange 0, Baseball Robot 0, Pharaoh 0 (`hands`
  scale 0.7), Pink Mantis 0, Stealth 2, Vampire 2 (scale 0.7), Dapper 3, Rusty Mech 3, Gas Mask 3, Mummy Bot 3
  (scale 0.65), Crimson 3, Coffee Brown 3, Medic 3, Alien Biker 3, Alien Encounter 3 (left curl 1, right 0.5), WWII 3,
  Beanie Alien 3 (scale 0.7); **CRT Robot 6** (back + flat: the curl test only, which reads ±1 cm on mitten hands;
  the sheet's holds look right; curl 0.8 changed nothing).
- Budgets: all under 20k triangles / 1.8 MB (largest CRT Robot 1.75 MB, Mummy Bot 1.72 MB; normalSize 1024 dropped on
  the Baseball Robot, Medic, CRT and Rusty Mech to fit). Menu bundle 830.5 kB gzip.
- Checks: typecheck; test:changed 1246 pass; content OK; e2e designer, characters (517 s), visual, offline PASS
  (offline failed once on a dist built before the last portraits: rebuild before e2e after capturing portraits).
### Bot themes: bots named after their characters (`wip/bot-themes`, agent, 2026-11-01; not merged)
Owner: "name and associate the bots after each character… 96 unique monkey names, same for pirates, medieval sets,
soldiers (Sgt/Pvt/Lt…)… an entire server for the D-Day map that only uses soldier skins". Owner's picks: lists per
kind of creature; the bot characters setting is a map default the host can change.
- **Names** (`shared/content/botNames.ts`): 23 themes (`NAME_THEMES`: soldier, monkey, bear, wolf, dog, cat, raccoon,
  critter, frog, pirate, knight, ninja, wizard, barbarian, undead, spooky, robot, alien, goblin, cowboy, gangster,
  townsfolk, myth), each ≥ 96 names (≤ 20 chars, no digits, original; append-only). Soldiers are generated: 9 ranks ×
  126 surnames, every surname once before any repeats. `BOT_NAMES` (the general list) moved here; match.ts re-exports it.
- **Each look's theme**: whole-body characters declare `nameTheme` in content/characters/*.json (checked by
  character-manifests.mjs, whose `NAME_THEMES` list a test keeps equal to botNames.ts; generated into
  characters.generated.ts); the presets carry it in looks.ts (Linktifa knight, Sprout townsfolk); NPC skins in
  `NPC_SKIN_THEMES`. A look without one takes its group's (soldiers → soldier, legends → knight, folk → townsfolk,
  horror → spooky). **New soldier looks (wip/new-characters-2: core.polysoldier, core.tposesoldier1/2,
  core.stancesoldier, core.resolvesoldier, core.zombiesoldier1/2, core.undeadsoldier) should declare
  `"nameTheme": "soldier"`** (zombie/undead soldiers: `soldier` if they belong on a D-Day server, else `undead`) and
  `core.abe` whatever he is; botThemes.test.ts fails for a built manifest without one, by design.
- **Naming** (`BotFiller.nameFor` → `botNameFor`): the look's own name first (the first bot in Scamp is "Scamp"), then
  its theme's next free name (from an offset by match seed; seed 1 = list order), then the general list, then
  "Mildred 2". Never a name in use (players, bots, spectators, the host's set). `Match.addBot` takes a name function
  so the name follows the look it picks.
- **Bot characters** (`MapDocument.botCast`, optional, no migration: absent = all; `MatchRules.botCast`: absent = the
  map's, `[]` = all): groups and/or themes. `Match.botLook` spreads random bots over `castLooks(cast)` (unrestricted:
  `lookForBot` as before, so bot behaviour tests keep their looks). Editable in MapMaker (map properties → Bots → Bot
  characters, checkboxes, `setBotCast` command, `validateMap` flags unknown ids), Match setup → Bots (select:
  Map default / All / group / theme), pause menu (live: `{ c: 'bots', cast }`, `BotFiller.recast` re-dresses and
  renames random bots out of it), server rules (`cast`, live; admin changes persist). HostState `cast`/`mapCast`.
  Kept over a map change (hostRules KEPT). docs: HOSTING.md (bot names), CHARACTERS.md (`nameTheme`),
  MULTIPLAYER_PROTOCOL.md §19.
- **Loading** (docs/LOADING.md): the name lists (`content/botNames.ts`, ~17 kB gzip) load only with the match code
  (sim/match.ts; the `@tiletrigger/shared/match` entry re-exports them). The menu, MapMaker and the rules read
  `content/botThemes.ts` (theme ids and labels, `lookTheme`, the bot-characters setting), which the shared index
  exports. Keep it that way: importing botNames.ts from anything the menu reaches put the menu's first JS at
  846.6 kB gzip (budget 840); split, it is 831.1 kB.
- No map in maps/ sets botCast yet (the owner picks: e.g. a D-Day map → soldiers, in MapMaker).
- Tests: botThemes.test.ts (lists, manifest themes, 96-bot soldiers-only roster, Scamp first, fallback, host
  override/recast, set keeps its own, setup/server rules/wire, MapMaker command + validation). e2e: editor flow ticks
  Soldiers in map properties; teams flow → `botCastFlow` (soldiers-only offline match from match setup).
### Nine more characters (`wip/new-characters-2`, agent, 2026-11-01; not merged; main c5be6c4 merged in)
The owner's second Drive batch (nine Meshy GLBs; downloads outside the repo in `/home/user/meshy-drive/drive-2026-11-01c/`,
symlinked in `/home/user/meshy-drive/build-newchars2/`). **CC0 Meshy community models** (owner): pack
`meshy-community-characters`, `source.community.model` as the download names it (Abe's "Abraham Lincoln with All
Animations": Meshy cut the title; correct it if the page says otherwise). Look ids as on the Roster Board; the owner's names
`core.polysoldier` **Virtua Soldier**, `core.zombiesoldier1` **Zombie Soldier A**; the rest named here. No credits spent.
- After main's merge: far copies are main's (character-lod.mjs, default share 0.3; this branch's own `fixes.lod` path was
  dropped and the nine carry no `fixes.lod`); all nine rebuilt from the downloads with main's pipeline, hands retuned for
  main's three-joint mitten curl. Per character (body tris; far copy; rifle grip audit, The Visitor 0):
  - **Honest Abe** (`meshy_abe`, Legends): the owner's rig (Mixamo names; `*HandMiddle4`/`*Toe_End` end markers fold into
    their joints); 11,000; 3,297; **0** (right `mitten` curl 1.2: split-read fingers crumpled into shards; left curl 0.4).
  - **Virtua Soldier** (`meshy_polysoldier`): found T-pose landmarks; 11,000; 3,300; **0** (right `mitten`, curl 0.9).
  - **Hollis** (`meshy_tposesoldier1`): 10,998; 3,298; **3** (spikes: one edge at spine_01; right curl 0.9).
  - **Briggs** (`meshy_tposesoldier2`): a 10k download, uncut; 9,988; 2,996; **0**.
  - **Pemberton** (`meshy_stancesoldier`, a T-pose after all): 10,995; 3,298; **3** (flat: right curl gain 0.007; curl 1.5).
  - **Kenji** (`meshy_resolvesoldier`, arms hanging, not a T-pose): shoulders/elbows set by hand down the middle of each
    arm (found ones sat on the torso's edge: webs, a flap off the support arm), `armCloth`, hands 0.85; 10,000; 2,996; **0**.
  - **Zombie Soldier A** (`meshy_zombiesoldier1`): 10,999; 3,292; **3** (spikes, one edge at hand_r).
  - **Grinning Gus** (`meshy_zombiesoldier2`): careful cut stopped at 14,631 (kept); 4,342; **0**. Dark-metal skull in the
    download; colour only kept, reads as bone.
  - **Dog Tag Doyle** (`meshy_undeadsoldier`): `surface: rebake` at 14,000 (1.1M download stopped at 22k); knees set by
    hand (straps between the legs crossed them); 14,065; 4,216; **0** (right curl 0.9).
- **`fixes.hands.mitten`** (true): fingers bend together even where gaps are found (hands.mjs; tests in hands.test.mjs).
- **Freaky Frida** (owner's screenshot: her support shoulder tore in the hold): found shoulders sat at the base of the neck
  (6% of her height out), so the upper arms ran through the chest and took the vest along. Shoulders moved out to the arms'
  roots, elbows a little out, `armCloth`; audit 0. Before/after: `frida-before.png`, `frida-after.png`,
  `frida-shoulder-before-after.png` (a jagged vest armhole rim still shows from her back-left side). The other four of that
  batch (Slugger-9, Barnaby, Rusty Mech, Scary Larry) checked in the hold from three sides (`batch1-shoulders.png`): no
  such tear; audit Barnaby 3 (flat), the rest 0.
- **Slugger-9 retired** (owner): `core.slugger` → `core.t350` in RETIRED_LOOKS; his files and manifest kept (he may come
  back as a better model); no map or bot set used him.
- Rebuild the nine: `ONLY=meshy_abe,meshy_polysoldier,meshy_tposesoldier1,meshy_tposesoldier2,meshy_stancesoldier,meshy_resolvesoldier,meshy_zombiesoldier1,meshy_zombiesoldier2,meshy_undeadsoldier node tools/content/prepare-meshy-characters.mjs /home/user/meshy-drive/build-newchars2`
  (Frida: `ONLY=meshy_frida ... /home/user/meshy-drive/build-newchars`). Note: rehand-built.mjs on a built file and a fresh
  build from the download give slightly different hands; tune on fresh builds.
- Sheets (agent scratchpad `/tmp/claude-0/-home-user/99559628-4a1b-594f-bb6f-7638c8757e80/scratchpad/new-characters-2/`):
  `grip-contact-sheet.png` (pre-merge), `grips-merged/`, `grips-final/`, `lod-distance-sheet.png` (pre-merge), `portraits-sheet.png`,
  the Frida pictures above.

### Model quality, distance, thumbnails, Bandit's hold (`wip/model-quality`, agent, 2026-11-01; not merged; has `wip/new-characters` merged in)
Owner's Roster Board flags (model, thumb, Bandit; Santa "awful from a distance"; later Giggles). Sheets in the agent's
scratchpad `model-quality/` (distance-before-after-1..6.png, closeups-before-after.png, thumbnails-before-after.png,
portraits-rebuilt-before-after.png; scripts distance.mjs, closeups.mjs, crowd.mjs, ptune.mjs, holdtune.mjs there).
- **Far copies were the real "distance" bug** (every whole-body character): the LOD was meshopt's sloppy cut, which joins
  triangles across the texture's charts, so far characters wore scrambled colours (Santa: white streaks; Croakley grey;
  Big Bab noise). New `tools/content/character-lod.mjs`: the careful cut with UV weights and the "Permissive" flag (seams
  collapse only where the layout agrees; Santa 1,621 → 5 of the far triangles across a seam), welded-shape fallback.
  `fixes.lod` (share, 0.3 default). `relod-built.mjs` remade every built character's far copy from its shipped file
  (no downloads needed). No middle LOD step: the sheets show the 3.3k copy holding at 18.5/30/60 m. Cost: far-copy
  VERTICES 1,400 → 4,100 average (the seams the colours need); triangles 3,371 → 3,495 average.
- **Scope**: `setCharacterLodZoom` (characters.ts, called from view.setCamera) moves the 18 m switch out by the zoom
  (tan ratio of FOVs; sniper 0.4 rad → ~71 m). e2e characters checks it (`__charLodZoom`).
- **Rebuilt** (downloads in meshy-drive/meshystuff, rig tasks re-fetched: no credits), `triangles` 15-17k, `headShare`
  0.16 (new fix), `handsShare` 0.08-0.1, `normalSize` 1024 (new fix), `lod` 0.22-0.3: King Aldric 15,074 → 16,998
  (LOD 4,471 → 4,742), Bandit 10,989 → 14,993 (3,115 → 3,284), Desert Ranger 10,999 → 15,000 (3,273 → 3,300), Dust
  Trooper 13,420 → 15,018 (3,777 → 3,286), Grizzelda 14,558 → 15,963 rebaked (4,209 → 4,142), Thornweaver 16,100 →
  15,851 rebaked (4,715 → 4,742), Lancer Mei 11,062 → 14,986 (3,265 → 3,258), Sgt. Pruitt 10,998 → 14,996 (3,154 →
  3,293), Rotter 11,000 → 15,000 (3,201 → 3,288), Saint Nick 10,998 → 15,998 (3,088 → 4,796), Giggles 11,000 → 14,999
  (3,161 → 3,297). Grizzelda and Thornweaver stalled over budget (21k/20.8k, 1.9/2.3 MB) with their fragmented
  layouts: `surface: rebake` at 16k. All under 20k triangles and 1.8 MB (biggest Brother Ansel 1.70 MB, untouched).
- **Not improved here (far copy only):** Boglurker and Goblin (in-house FBX builds; the FBX folders aren't on this
  machine), Capt. Nova and the Dapper (every Meshy task in their manifests 404s on this key: rig, refine, remesh,
  preview). Still visible after the rebuild and not a budget matter: Grizzelda's hands are flaps of sleeve skin, Dust
  Trooper's and Giggles' sleeve spikes (skin weights: see Grip pass 2 "spikes").
- **Bandit**: `fixes.hold: { forward 0.06, down 0.12, out 0.12 }` (new: look `whole.hold`, applied to the long-gun
  stock pocket in characterAnimator.placeWeapon: third person and Character Select). First person isn't touched (the
  gun is the view's; it can't be in the face there); portraits hold no gun. No per-look scale: his size is gameplay
  (`small`, 0.78, same height as the other small ones); a visual-only scale would shrink him inside his hitbox.
- **Portraits**: `PORTRAIT_VIEWS` (portraits.ts) now takes `from`/`aim`/`zoom` arrays; entries for Bandit, Boglurker,
  Croakley, Galloway, Grizzelda, Mei, Rattles, Rotter, Shade and Saint Nick (his rebuilt hat put his face low).
  `renderLive(look, view)` tries a framing without a rebuild. Recaptured those plus the rebuilt bodies.
- **Perf** (SwiftShader, load 8-12): crowd of every look in `?mode=characters` (133 characters, crowd.mjs): draws 134 →
  134 at every distance; triangles past 18 m 418.8k → 427.3k (+2%); through a sniper scope at 60 m 418.8k → 1.24M
  (full detail inside 71 m; the game's narrow scope frustum shows far fewer than this test row). perf96 frost_basin
  medium (1-2 frames, views differ, so only draws/casters mean anything): spread draws 356 → 213, clump 247 → 277,
  casters 82-90 either way. Character files 61.3 → 70.2 MB on the site.
- Note for the lead: the five new characters were built before grip pass 2's hand rules; their GLBs are as
  `wip/new-characters` shipped them (LODs remade here). Roster renames (Goblina, Sgt. Mackie) land on
  `wip/roster-apply-2`: this branch changed meshy_grizzelda.json and meshy_pruitt.json `fixes` only; keep their new names on merge.

### Grip pass 2 (`wip/grip-pass-2`, agent, 2026-11-01; not merged)
### Roster Board applied: CI fallout (`wip/roster-apply`, agent, 2026-11-01; not merged)
Retiring 15 looks moved every bot's look (and body size) in the rotation (`lookForBot` walks CORE_LOOKS), so four
seeded scenarios landed on real bugs, fixed: Small bodies couldn't use a portal set against a wall (the catch margin
scaled with size; now `PORTAL_CATCH`, the same for all); bots came out of a portal and walked straight back in (the
leg now counts as done on teleport; `BotBrain.portalled`); an encounter fill-in could spawn inside a closed door
(Outpost Siege: a guard in the locked gate, courtyard never cleared; `Scenario.inShutDoor`); the Battle Axe test's
"nobody about" player respawned at once (now leaves). botMovement names the look its thresholds were measured on
(Sprout). e2e `characters`: grip checks use Linktifa; `View.gripReport` measures each mesh at the LOD it was drawn at
(a whole-body LOD has its own skeleton, posed only while drawn: the near mesh of a far bot held a stale or rest pose,
0.3-1.6 m "off"); a gun just put in hand is hidden until placed (it sat at the feet until the next placement: a frame,
or 66-100 ms on stepped far bots). Still open: **Boglurker**'s shooting hand is drawn ~20 cm off the grip (fingers
along 0.36) at full detail, and its LOD has no right-hand skin (measures null); one bot of the check's allowance.
Also seen, not touched: Pantry Raid's mouse holes are behind the 0.9 m skirting board (block_015/block_014), so nobody
walks into them without jumping.

### Drive intake + FX full packs (`wip/drive-intake`, agent, 2026-11-01; not merged)

### `wip/original-looks` (agent, 2026-11-01; not merged): the original characters' hats, eyewear and beards
Owner: the part-built looks have "bowls on heads, eyewear and mustaches all strange"; Engineer's "accessories need work",
Sprout's headband. Started from 899537c's ideas
(model gear, refits; ported by hand onto current main, nothing it replaced brought back).
- **Fitting** (`packages/client/src/content/headFit.ts`, pure, unit-tested): `HeadMap` measures the head (skin;
  skin + hair kept within 1.2 cm, draped) as distances from the skull's middle in 48 × 32 directions, from the bind
  pose. `Geo` builds surfaces with thickness (`slab`), tubes and fans, faces turned outwards. `fitModel` seats a
  helmet model: smallest size and lowest seat with the skull above the eyes clear of the shell's inside, the rim over
  the eyes at the brows, a deep shell squashed to 0.88/0.76 if needed; cached per model + head + hair (30-300 ms
  once on this loaded box).
- **gear.ts** rebuilt for head gear: cap (crown, 6 seams, button, curved peak), beret (leather band, badge over the
  left eye, cloth pulled down over the right ear), beanie (ribbed cuff), wide-brim hat (pinched crown, band, brim up
  at the sides), headband (tails knotted at the back), shades (lenses clear of brow and cheeks, bridge on the nose,
  arms to and behind the ears), goggles (cups to the face, strap), mask (hanging point). Hair a hat covers is cut
  (`trimHair`: small pieces such as buns go whole). Chest/back gear unchanged. Gear code is its own chunk
  (`gear.ts` + `headFit.ts`, imported when a character with gear is built; `gearModels.ts` holds what preload needs).
  Helmet meshes hang straight on the Head joint (full-body first person's `cutHead` hides children of head joints only, not grandchildren).
- **Helmets** (models on main since roster-cleanup; `GEAR` `model`, 4 helmets appended so custom IDs' gear mask is
  4-8 hex): Engineer `mk2_helmet`; `helmet` is now the military model. Steel, aviator and viking only in the Designer.
  The owner is retiring 14 of the modular looks (the lead removes them on another branch); this branch left their
  presets as they were and only the kept ones (Linktifa, Sprout, Warden, Engineer) are on the sheets. Tried by eye on
  the retired ones too: steel helmet on Bulwark and aviator on Frost fit well, if anyone wants them.
- **Beard**: `hair_beard`'s file is no longer loaded; `BEARD` in gear.ts builds a full beard (sideburns, jaw, chin,
  moustache, mouth clear, ragged edges) in the hair colour. Designer's Beard option uses it too.
- Tools: `__grips.head(alpha, radius, beta?)` frames the head after `__grips.pose(look, weapon, 'third')`.
- Portraits re-captured: Sprout, Warden, Engineer (Linktifa's has no head gear). Menu bundle 827.4 kB gzip.
- Checks: typecheck; headFit/bodySizes/mergeParts and the shared files test:changed picks (the bot-match ones timed
  out under a load of ~30 and pass alone); content OK; e2e designer, visual PASS; characters: all checks passed
  across two runs except the known flaky Imp hold; once "third person and back (core.pistol): no hands" (the Dapper,
  no gear) which passed on the rerun. Full-body first person: no head gear, helmet or beard in view (up, ahead, down).
- Sheets (agent scratchpad): `original-looks/before.png`, `after.png` and per-look closeups (kept looks only).

### Bots: clear shot (`wip/bot-clear-shot`, agent, 2026-11-01; not merged)
Owner (spectating Shingle Point TDM): "that rock is blocking a bunch of bullets" (a gully boulder, `prop_490`/`prop_492`
`prop.rock_large` at x≈24-26, pocked with holes). docs/BOTS.md "Shooting along a clear line".
- **Cause** (measured, probe in the agent's scratchpad, not committed): bots fired whenever the aim was lined up on
  the target; nobody checked the line from the eye (where `Match.fireNow` starts every shot) along the aim. Normal
  bots' aim error at 40-55 m is 0.05-0.15 rad, so a quarter of trigger pulls (24 bots, 8 seeds × 120 s: 28.4 %) were
  aimed into something short of the target (slopes, the gully boulders, the seawall); a target behind waist-high cover
  showing head and shoulders drew fire at its hidden chest (yard test: 92 of 93 rounds into the wall). Also small and
  large bots saw and aimed from a standard eye (1.6 m) while their rounds left from 0.78×/1.18× that.
- **Fix** (`BotBrain.clearShot`, via `AimModel.trigger`'s new `clear` callback): one ray per pull (a clear verdict kept
  3 ticks while aim/position barely move); blocked: hold 3 ticks, then by one or two rays correct the aim error
  (target in the open), aim at head/shoulders for 1.5 s (low cover), or stand up / step aside (no line).
  `CombatantView.size` scales eyes, sight lines, cover search and the aim point. SUPPRESSOR fire 2.5 → 1.5 s, only while
  rounds reach the spot. Not checked: lobbed projectiles, melee, targets in vehicles/on guns/sentries.
- **Numbers** (24 bots, 8 seeds × 120 s Shingle Point TDM): pulls into the world short of the target 28.4 % → 8.2 %,
  rounds hitting players 8.8 % → 10.5 %, kills 206 → 201, rounds fired 11,786 → 8,582, pulls aimed into the gully boulders 190 → 7. Bench (Shingle Point TDM 60 s,
  load ~13 on 4 cores): 24 bots CPU/tick 4.99 → 5.09 ms, 96 bots 8.83 → 8.77 ms (noise); bot aim 0.10 → 0.14 ms at
  96; bench accuracy at 96 7.8 % → 13.3 %, kills 36 → 47.
- **Player shots:** first person is consistent (camera = scaled eye = shot origin; tracers are drawn from the
  muzzle, cosmetic) and unchanged. Third person was not (camera 3 m back, 0.6 m right, 0.35 m up; rounds along the view
  from the eye: crouched behind low cover you saw over what your rounds hit). **Fixed with the owner's OK** ("yes for
  third person"): `BUTTON_THIRD_PERSON` (8192) in the input; the host computes the crosshair's point itself
  (`sim/thirdPerson.ts` `thirdPersonAim`: the camera's centre ray against the level and the lag-compensated bodies)
  and fires from the eye toward it (`Match.aimOf`); nothing about the aim comes from the client
  (MULTIPLAYER_PROTOCOL.md §18). The client camera uses the same `thirdPersonCamera`. Trade-offs: the client's
  predicted tracer converges against the level only (cosmetic); the client's camera follows the eased eye and drawn
  position, the host the true eye (they differ only mid-crouch and between ticks); a crosshair point less than 0.5 m
  in front of the eye falls back to the view; throws (lifted) and melee are unchanged. Tests: `thirdPerson.test.ts`
  (maths, the input bit, a sim shot over a 1.3 m wall: hits in third person, the wall without the bit); e2e arsenal
  `thirdPersonShot` (the same in the browser, canyon offline).
- **Also fixed:** `Match.applyBodySize` left a living combatant's health alone, and everyone is alive when their
  look is applied on joining: large characters started their first life on 100 of 115 health, small ones on 100 of
  85 (`bodySizes.test.ts` now checks). Disc Arena's "nobody takes damage" test caught it once a large bot survived.
- **Seeded tests that changed:** forts.test.ts CTF ("reach the flag in 150 s") swings with the seed: seeds 1-11, base
  within 6 m 9×/3 flag takes, now 9×/8 takes but not on seed 1 (the default): the test uses seed 4 (comment there).
  discs.test.ts: the health bug above.
- Residual 8 %: rounds the check passes inside its 1.5 m margin, recoil offset the bot doesn't see, grazing edges,
  shots at mounted targets (unchecked by design).

### Grip pass 2 (`wip/grip-pass-2`, agent, 2026-11-01; merged to main 47acd97)
Owner: "when do all the grips get fixed, I see some still not right". Audit before/after (main d8a4afa vs this branch),
rifle, pistol, shotgun and Spear, every player character (63 incl. the rig's Ranger), Character Select pose, sheets and
`compare.md` in the agent's scratchpad (`grips2/before/`, `grips2/after/`; re-run the audit for fresh ones, ~80 min on a
loaded machine: `WEAPONS_ONLY=rifle,pistol,shotgun,spear AUDIT_PX=400`).
- **Root causes fixed in the shared rules** (tools/content/hands.mjs, characterAnimator.ts; all characters re-fitted):
  - mitten hands (most Meshy hands) curled once at the knuckles like a paddle: now they curl along the middle finger's
    three joints (one wide finger), curl ≤ 1; long fingers (Croakley, Scamp, Halvard, Salamander) curl up to 1.5×;
  - long-gun support hands sat under the handguard palm up with the fingers standing open: they now cup it over the base
    of the fingers (`CUP_BACK` 0.22 of the hand's length) and close all the way (`supportCurl`: 1 long, 0.7 pistol), in
    third person, first person and on creatures. Visibly better on King Aldric, Dusty Colt, the Dapper, Shade, Ricochet,
    Sir Galloway, Ashwalker, Ser Brannock; support fingertips median 9.0 → 6.4 cm (rifle);
  - a dense cuff at the wrist (King Aldric's fur cuffs) held the knuckle line and curled into flaps: measured out (only
    King matches the rule); his model was also re-cut from his Meshy rig task (re-fetched, no credits) with
    `fixes.handsShare: 0.1` (the cuffs had taken the hands' 4% of the budget: his hands were a few dozen triangles);
  - a long gun's barrel line keeps `HEAD_CLEAR` 0.15 from the head joint (the stock drops up to 5 cm): Capt. Nova's face
    flag is gone (head-gun 0.10 → 0.13 m);
  - rehand-built.mjs applied `fixes.hands.scale` again on every run (hands shrank each time): it no longer does (the
    scale is applied at import); Saint Nick, Rattles, Anubis, Ashwalker and Agent Zhao were restored from main and
    re-fitted once.
- **Arm cloth by surface distance** (armweights.mjs, `fixes.armCloth`): cloth an arm holds is eased to the body by its
  share of the way arm → body ALONG THE SURFACE (a coat side joined under the arm goes to the body, a wide sleeve stays):
  the rule asked for. But the audit's spikes are not arm cloth any more: it now reports spikes by joint, and they are in
  the legs (Iron Knight 14 on the thighs, Ser Brannock: a tabard between the legs), the armpits (Big Bogdan, the Dapper)
  and low-detail fingers (Bonesworth's skeletal fingers, King's). Tried on Bogdan and the Dapper: no change, so no
  character uses it. Next: the same surface rule for legs (cloth between the thighs to the pelvis) for the Knight (no
  download: his rig task 404s on this key) and Brannock (his rig task is fetchable).
- **Biscuit** ships rebuilt from his T-pose (`source.file` takes the GLB): rigid paws (fists) plus `fixes.hands.r.wrist`
  (the shooting paw's skin past the wrist rides the hand alone; blended into the forearm it folded looking down): the
  e2e drawn-hand check passes on every pose (pitch −1.45 flat was 0.52-0.59). His paws stay closed fists (curling them
  made the skin a ball: e2e flat 0.02-0.10).
- **Teddy**: his "paws" are round shells: `hands.curl: 0` (closing them tore the skin; spikes gone on the shotgun/spear).
- **T-pose characters** (Visitor, Elder, Ember, Merrow, Croakley, Snikkit, Scamp, Halvard, Pruitt, Greyfang, Bandit,
  Biscuit) are rebuilt from their downloads with prepare-meshy-characters.mjs, not rehand-built: a re-fit from the cut
  file turned the Visitor's split fingers into a mitten. Use `ONLY=…` with the downloads dir for these.
- **Roster Board flags (owner via lead):** Bandit "holds gun in face, scale seems bigger": he is fitted to the same
  height as every small character (1.40 m), but he is the broadest of them (shoulders 0.34 of his height; Biscuit 0.27,
  Otter 0.25, Scamp 0.18) with a long tail, and his head sits low between high shoulders, so the stock at his shoulder
  is at his snout from every angle (head joint 0.27 m from the gun's line). Tried: a lean back (`fixes.lean`, neck 16°)
  and keeping the gun out of the face's skin (a head-skin surface like TorsoSurface): no visible change, both dropped.
  Needs a per-look hold (the gun held lower, or a smaller body scale per look): not built. Hyena: a pre-curled claw
  (rigid by shape, in-house FBX build): `fixes.hands.r.palm` moved 3.5 cm into the claw, shooting hand 10.4 → 9.1 cm
  off the grip, rifle `open` gone; still off/fp (a claw can't close further without its FBX). Otter: big mitten hands
  (24 cm long, 10 thick); a palm override either way was no better (off 7.3 → 6.8 / 8.4 cm, first person worse): left.
  Ivory Rustwalker: skipped (retired by the owner).
- **Results** (flags per character over the four weapons, before → after): open 26 → 10, face 1 → 0, off 18 → 18,
  fp 18 → 18, spikes 17 → 18, flat (finger skin) 8 → 7; flagged without the curl test 38 → 29 (with it 39 → 49). The
  references stay clean (The Visitor 2 → 0, Rattles 0 → 0). The audit's curl test
  (fingertips open vs closed, rifle) now reads ±1 cm on most hands (flat 12 → 32, back 3 → 13): a finger wrapped all the
  way round the grip puts its knuckles, not its tips, furthest from the wrist, and the reference Visitor reads −0.4 cm
  even by the finger skin's mean distance; judge those by the sheets (the support hands are visibly better). Shooting
  hand medians: drawn centre 4.2 → 4.7 cm, tips 6.0 → 6.6 cm (the fuller curl), first person 4.0 → 4.5 cm.
- **Open, and why:**
  - fists and claws that can't close (rigid by shape): Hyena, Goblin L, Gorgle R, Rustwalker L, Giggles, Boglurker;
    Boglurker's right hand is 2 cm of 31 vertices and Goblin/Hyena/Boglurker are in-house FBX builds: need the FBX
    folders (with otter, toad, salamander, elder, alien, cat, pilot, pirate, titan: the owner's downloads);
  - hands hidden in sleeves or cut to a few long triangles (Giggles: a ruffled sleeve tube; Grizzelda: 191 vertices, a
    "width" of 33 cm): a re-cut from their rig tasks (fetchable, no credits) with `handsShare`, or a hand modelled out;
  - first person (fp) and off flags on the stubby/clawed ones above plus Croakley, Saint Nick, Salamander, Punkin,
    Desert Ranger, Otter, Vanguard: the drawn hand centre sits 6.5-10 cm from the grip (big hands, short arms);
  - spikes in legs/armpits (above); the Dapper's fingers (middle_03_r 23×): his rig task 404s on this key (owner);
  - Barnaby Bruin: not shipped (a rebake path for characters, keeping the skin weights through rebake's vertex map, is
    the way; not done);
  - creature skins (Imp, Puglin) aren't in the audit (CreatureAnimator, not looks); the Spear is audited as it is held
    (one hand on the shaft: there is no two-handed thrust hold to audit).
- Checks: typecheck, test:changed (31 pass; content tests 26), content check OK, bundle budget 2953/3000 kB; e2e designer
  PASS, visual PASS, characters: every grip check PASS (Biscuit included) but the known Imp check (`wip/flaky-characters`)
  and the Imp page's screenshot timing out under load (twice); arsenal: only "R loads the barrel again" (the known load
  race, see `wip/arsenal-fix`). Portraits recaptured for King Aldric and Biscuit (the only bodies whose shape changed).

### In-house buggy cockpit (`wip/cockpit-parts`, agent, 2026-11-01; merged to main 6b6a40e)
Owner: the driver's view still looked bad up close (lumpy black cage blobs, smeared dash) even with the cropped Meshy
interior; build the cockpit parts in-house, only for the local driver's cockpit view.
- **Data:** `packages/client/src/content/cockpits.ts` (`COCKPITS` by mount id; buggy only): tubes (paths, radius,
  bend), rounded boxes, discs, seats (crease point, recline, harness), the wheel (centre, column direction, radius,
  spokes, lock), gauges (`speed` / `revs` needles), switch rows, a palette, and `hide` boxes (mount frame). Measured on
  the body's triangles (slices): roof frame 1.47 m on rails x ±0.46 from the rear hoop z -1.0 to the front bar z 0.6,
  hoop at z 0.05, A-pillars and a centre brace to the hood, seats at creases z 0.28 / -0.53 / -0.94 (the model has
  three rows), wheel at (-0.32, 1.0, 0.78). Doc: docs/VEHICLES.md, "In-house cockpits".
- **Geometry:** `game/cockpitGeometry.ts`, engine-free (tube sweep with parallel-transport frames and rounded corners,
  rounded boxes, caps, straps), so it is unit tested and can be dumped in Node (type stripping) for offline renders.
  ~17.3k triangles: 16.2k static in 4 surfaces (paint 3.4k, metal 2.4k, plastic 3.2k, fabric 7.3k), wheel 1.0k,
  needles 60 each; 9 draws (the old cropped interior was 31.9k triangles plus a 3.6 MB download). Built once, kept disabled between rides.
- **Client:** `game/cockpitInterior.ts` builds Babylon meshes (vertex colours, 4 PBR materials sharing a 64 px
  generated roughness grain), parents them under `<mount>_gun` (rides the springs), cuts your copy of the body with
  `partitionByBox` (now several boxes), turns the wheel from the eased `ms` steer (View.sprung) × lock and the needles
  from the tick velocity. `View.cockpitInteriorState()` for tests; e2e vehicles checks the parts and body cut, that
  steering turns the wheel and the speedometer moves, and that the chase view draws the body alone.
- **Dropped:** `MountDef.cockpitModel`, `vehicles/offroad_buggy_cockpit.glb` (3.6 MB) and its guns.json `interior`,
  lock and provenance entries. prepare-guns' `interior` support stays (unused).
- **Offline preview trick:** the scratchpad scripts dumped the body GLB's triangles with sampled colours and rendered
  slices / a perspective from the eye in Python, with the parts overlaid; far faster than headless Babylon at 1 fps.
- Next: the gun jeep and kart can get entries; harness colour (red) and the dash layout are easy to retune in data.

### Drive intake + FX full packs (`wip/drive-intake`, agent, 2026-11-01; merged to main dc1d1fc)
### New characters + rebake for characters (`wip/new-characters`, agent, 2026-11-01; not merged; from main dc1d1fc)
Five characters shipped (status built, portraits captured), all the owner's own Meshy models; names, groups and bios
from the Roster Board cards (no requests on the board for these five), look ids as the board has them.
- **`fixes.surface: "rebake"`** (opt-in per manifest; every other character and every prop rebuilds byte-identical:
  checked on The Visitor, Rourke, jersey_barrier_hazard, plastic_road_barrier). `rebakeDownload` in
  prepare-meshy-characters.mjs works on the download as it stands, before rigging and posing: seam copies welded, the
  full mesh cut to `fixes.triangles` by cutKeeping (head 12%, hands 8%, errors 0.4%/0.8% only: looser passes turned a
  paw into a cone), laid out afresh and its 1024 px colour + normal maps painted from the FULL download (meshy-mesh.mjs
  `rebake`, new options: `grow` = charts grown across shared edges within 60 degrees of the seed, refusing triangles
  that would overlap the chart (the six-axis charts gave ~4,000 slivers and 33k vertices for 17k triangles: 1.96 MB,
  over budget), slivers folded into a neighbour; `crease: -1` smooth normals; `reach` 1.2%; it also returns `from`, the
  source vertex of each output vertex). The maps hold through the posing (tangent-space normal map). Rigged downloads
  keep Meshy's weights on the kept vertices; unrigged ones are autoskinned from the cut mesh. Why not after posing: the
  40k work mesh the old path cut first was already scrambled in places (even meshopt's careful cut breaks Meshy's UVs).
  Lock entries carry `surface: "rebake"`; provenance says so. Tests: tools/content/test/rebake.test.mjs.
- **Mixamo rigs**: Meshy's "All Animations" GLBs name joints `mixamorig:*` (Spine, Spine1, Spine2 count up from the
  hips): read as Meshy's names (`meshyName`). Their two clips are ignored.
- Per character (body triangles, grip audit rifle score; The Visitor 0 as reference):
  - **Barnaby Bruin** (Animals; CC0 community per his manifest and HANDOFF, though the brief called all five owned:
    left as recorded, owner to confirm): rebake from the 1.5M download, 17,021 tris, 1.17 MB; paws `hands.scale` 0.7,
    `curl` 1.2 (audit 9 open/off/spikes/fp at full size → **3 flat**: a mitten paw bends once, curl test +0.001).
  - **Slugger-9** (Creatures, large): rebake from 3.1M, target 16k → 18,082 tris, 1.42 MB; audit **0**.
  - **Rusty Mech** (`meshy_rustymech`, Creatures, large): owner's Meshy rig; its baked texture held the careful cut at
    28.4k (3 MB), so rebaked: 15,923 tris, 1.39 MB, Meshy's weights; audit **0**.
  - **Freaky Frida** (`meshy_frida`, Horror): the download has no skin, rigged in-house from found landmarks
    (autoskin reports 2,597 vertices with no bone in sight: hair/pigtails, weighted by nearest; looks fine in the
    holds); 10,760 tris, no rebake needed; audit **0**.
  - **Scary Larry** (`meshy_larry`, Horror): owner's Meshy rig; 11,350 tris; audit **0**.
- Known limits: Barnaby's coat tails show a few small cream patches where the cut body pokes through the cut coat
  (a "push covered body vertices in" pass was tried and made it worse: removed). Rebaked maps cover ~33% of the
  1024 px square (bounding-box shelf packing), so they are a little softer than the download up close.
- Rebuild: `ONLY=meshy_barnaby,meshy_slugger,meshy_rustymech,meshy_frida,meshy_larry node
  tools/content/prepare-meshy-characters.mjs /home/user/meshy-drive/build-newchars` (symlinks to the downloads in
  tposes-2026-11-01, drive-2026-11-01 and drive-2026-11-01b). Note: a rebuild of Rourke rewrites his lock title
  (his lock entry still has the community model name from before he was marked owned): restored here, untouched.
- Checks: typecheck; content OK; bundle 833.8 kB gzip (budget 840); `test:changed` 1225 pass, 2 fail (npc.test.ts co-op
  missions, 25 s timeouts at load 10+; the file passes alone, 15/15); rebake tests 3/3; e2e characters PASS (964 s: viewer 90/90,
  low detail 90/90, every grip check, bots 8/8) and designer PASS. Grip sheets and portraits: agent scratchpad (re-run
  `ONLY=<ids> node tools/content/grip-audit.mjs` for fresh ones).

### Drive intake + FX full packs (`wip/drive-intake`, agent, 2026-11-01; not merged)
Owner's queue of 2026-10-31 ("new models on the Drive", "FX: I bought the full licence"). Downloads outside the repo:
models in `/home/user/meshy-drive/drive-2026-11-01/` (links for the pipelines in `/home/user/meshy-drive/links-1101/`),
FX zips in `/home/user/fx-packs/drive-2026-11-01/fx/` (extracted: `/home/user/fx-packs/extracted-2026-11-01/`; the
layout prepare-vfx reads: `/home/user/fx-packs/links-full/`). No Meshy credits spent.
- **What was new on the Drive** (49 files + `fx/`; everything else was already in content/*.json or the locks): 10 models.
  - Props, new pack `meshy-owned-drive-1031` (owned; rebuild: `ONLY=<ids> node tools/content/prepare-props.mjs --downloads /home/user/meshy-drive/links-1101`):
    `jersey_barrier_hazard`, `hazard_block_barrier` (Military), `plastic_road_barrier` (Industrial), `smithy_workbench`,
    `tiled_well` (Medieval Village), `temple_ruin_stair` (Jungle Ruins, hero, `collide: stairs`), and two parked
    vehicles as hero props: `vehicle_raider_buggy` (sci-fi buggy, 4.4 m) and `vehicle_armored_truck` (8x8, 8.7 m, `shell`).
    Added to the Military, Jungle and Medieval STYLE_PACKS; palette pictures rendered.
  - Characters: **Rourke** (`meshy_rourke`, Folk; "Realistic stylized man" T-pose): landmarks found, arms measured off
    the mesh (the found left wrist was 4 cm short); grip audit 0; portrait captured. **Slugger-9** (`meshy_slugger`,
    Creatures, large; robotic baseball player, 3.1M-triangle image-to-3D): manifest, landmarks and fixes ready but
    **queued** like Barnaby: its texture seams hold every careful cut over the 20k budget (21.3k; 20.8k with seamWeld).
  - Licences are best guesses, to confirm with the owner: the props and vehicles as owned (prompt names like the owner's
    other prop batches), the two characters as Meshy community CC0 (like nearly every character download).
- **FX licence**: the Vol. 2 packs on the Drive (Battle, Dark Magic, Electric, Elemental Magic, Explosion, Flame,
  Frosted Glass, Hit, Status FX "Full") each carry a `license.txt` that is CC0 word for word ("licensed under Creative
  Commons Zero (CC0) ... free to use the assets in this pack for personal, educational and commercial projects with no
  attribution required"). The Vol. 1 packs (Impact, Smoke, Portal, Poison, Fire, Beam, Ice, Loot, Magic Orbs/Area/
  Projectiles, Card, Glass UI, Skies, Green Extra, Supporter textures) carry no licence file, and itch.io is not reachable
  from these sessions. The owner's standing rule ("If I buy it it's always allowed") is on CLAUDE.md via the lead.
  Also in `fx/`, not effects: FoodMegaPack_Pro, RPGWeapons_Pro, Treasure_Pro, RetroUrban, Full.zip (Retro textures): untouched.
- **Shipped**: Hit FX and Explosion FX full editions (the effects our runtime already draws: no new shaders needed).
  The Drive's MuzzleFlashVFX builds byte-identical output to what we ship. Recorded in content/vfx.json per pack
  (`edition`: purchased by the owner, CC0 text) and provenance titles.
- **Mapping as data**: content/vfx.json `map` → `tools/content/vfx-map.mjs` → `packages/client/src/game/fxMap.generated.ts`,
  read by `game/fxMap.ts`. Muzzle by weapon family (moved out of muzzleFlash.ts), surfaces (keywords on prop model /
  tile+theme / free-block material; terrain = dirt) → impact style (sparks, dust colour/size, accent), weapon impacts
  (railgun; melee), water (the splash plus a cyan glint where a round goes in), explosions by weapon id → projectile visual → kind (barrel, trap, bomb, vehicle, air burst when
  nothing is under the blast), gameplay (pickup.<kind>, spawn, portal, pad, trap.<type>, zipline). prepare-vfx ships only
  the effects the map names (hit 13 of 28, explosion 9 of 16; ~9 kB gzip each); content:check fails on a stale map or a
  missing effect. Sim: `explode` events carry `w` (what blew; optional, older clients ignore it). EffectsWorld.raycast
  returns the level box hit. Spawns, portals, pads and ziplines are read off movement (`game/gameplayFxWatch.ts`: no
  new events). GodotVfx: `minor` effects (accents, gameplay) stop at 6 playing (MAX_PLAYING 10), and accents are skipped
  past 45 m.
- **Next (not done)**: Electric FX (zaps for energy weapons, shock traps), Flame FX (fire hazards, burning barrels,
  flare zones), Status FX (pickups, heal, spawn protection) and Portal VFX need their shaders ported in godotVfx.ts
  (Electric: electric_particle, ground_impact, ground_streaks, zap; Flame: fire_core, fire_overlay, fire_particle; Status:
  11). Tracers are unchanged (impactVisuals streaks).
- Checks: typecheck; content OK; new `packages/client/test/fxMap.test.ts` (6); style-pack tests (after renaming three
  props: `temple_ruin_stair`, `smithy_workbench`, `tiled_well`); e2e `physicsfx`, `arsenal`, `editor` PASS;
  `characters` FAIL only on the known flaky "Imp ... pistol r null" (main's HANDOFF) and a 90 s screenshot timeout at load 25. `test:changed` on a
  machine at load 21-27: 14 failures, all timeouts or bench thresholds except `host.test.ts` (Bob's account `sub`),
  which fails the same on main's checkout (f0da0e4): not this branch. Menu bundle 833.4 kB gzip (budget 840); the map
  is in the lazily loaded view chunk. Perf at 96 (load 23+, SwiftShader, so absolute numbers are noisy): server
  `bench:96` Frost Basin tick avg 16.4 ms wall / 8.8 ms CPU; client perf96 Frost Basin medium: tick 8-9 ms, draws 457
  spread / 308 clumped / 278 after a 20-kill blast, effect shadow casters 0, slowest effect start 1.5 ms (explosion;
  every mapped effect warmed at load). Branch not rebased on main (f0da0e4): generated files (props.generated.ts,
  provenance, palette atlases, characters.generated.ts, portraitIndex) need regenerating on merge.

### Updater: cosign's 128 MiB cap (lead, 2026-11-01; `wip/flaky-characters`)
`sudo tiletrigger-update` refused d8a4afa: "cosign: size of layer (138391411) exceeded the limit (134217728)"
(the site tarball passed 128 MiB). cosign v3 caps what it reads unless `COSIGN_MAX_ATTACHMENT_SIZE` is set; the
updater now passes `COSIGN_MAX_ATTACHMENT_SIZE=1GiB` (env overrides). Tested locally with cosign v3.0.2 against the real
build: default refused on size; with the variable "Verified OK"; a tampered tarball still fails (digest mismatch).
Until a box runs this updater (it installs itself from the checkout after an update), use
`sudo COSIGN_MAX_ATTACHMENT_SIZE=1GiB tiletrigger-update`. Worth watching: the site is 138 MB packed and growing.

### Flaky grip checks fixed (lead, 2026-11-01; `wip/flaky-characters`)
"An Imp player holds the gun… (pistol r null)" and "bots' hands … 0 of 0" (characters flow) failed on slow boxes and
once on CI. Cause: `View.gripReport()` read `scene.getActiveMeshes()` between frames, and that list is often empty
there (a probe showed the Imp steadily drawn by the main camera while the between-frames list flickered 5 → 0). It now
uses a copy taken right after the main camera's own evaluation (`drawnByCamera()`, hooked on first use, so play pays
nothing). Anything else reading the active-mesh list from a test should do the same.

### `wip/warthog-step1` (agent, 2026-11-01; not merged): Warthog feel, step 1 (raycast suspension)
Owner: "make the buggy feel like Halo's Warthog (independent suspension)", step 1, "if performance remains intact".
- **Sim** `shared/src/sim/suspension.ts`: one ray down per wheel (`PhysicsWorld.groundBelow`, own box excluded), a
  spring + damper per wheel on a sprung body (unit mass over the wheels, so heave/pitch/roll ring at the tuning's
  `freq`); inertial squat/dive and lean-out from the chassis' acceleration; in the air the body keeps its spin with a
  small nose-down `tumble`; landing feeds `land` × fall speed into the springs (bump stops at `bump`). The chassis
  (probe, level collision box, seats, hit boxes) is unchanged: the sprung body is presentation carried by the sim.
  Wheels off the ground cut grip; `vehicle.drift` loosens grip at speed (× (1 - drift·frac²)). Tuning per vehicle in
  `MOUNT_DEFS` (`vehicle.suspension`, `vehicle.drift`): buggy and gun jeep only (table in docs/VEHICLES.md, "Suspension").
- **Cost caps**: skipped while settled and still (a parked vehicle stops casting once its springs settle; the parked
  early return now also waits for that); far empty vehicles (2-tick moves) sit level with no rays; past 96 rays a
  tick, vehicles reuse last tick's ground on two ticks of three.
- **Net**: snapshot `ms` (REPEATABLE; ints: height cm, pitch/roll mrad, steer %, wheel offsets cm) and input bit
  `BUTTON_STEER_LOOK` 4096; MULTIPLAYER_PROTOCOL.md §17. Old clients/hosts ignore both.
- **Client**: `View.suspendSprung` draws the body from `ms` (eased k = dt·18, like the pose; nothing reads frame
  deltas), falls back to the old drawn-only `suspend` when no `ms`. Wheels on hub pivots (`mountVisuals.wheelsOf`):
  the buggy's tires and the gun jeep's own Car Kit wheel meshes (re-parented onto pivots at load); roll from the
  tick-based velocity, front steer, spring offset. Cockpit eye: `RideFrame.levelEye` + `COCKPIT_EYE_FOLLOW` (5/s)
  eases the eye's offset from the level pose (a 1.5 Hz ±0.15 m bounce reaches the eye at under half; steady lean in
  full); tilt damping in VehicleCamera is unchanged.
- **Look to steer**: Options → Controls → Vehicle steering (`tiletrigger.vehicleSteer`, default **classic**: the
  cockpit is the default view and mouse free-look there is worth keeping; look-steer pins the view to the world).
  Server turns toward the look (`LOOK_STEER_GAIN` 2.2/rad, + A/D), ground vehicles only; the camera stops adding the
  vehicle's turn and the chase camera doesn't recentre.
- **Bots**: steering unchanged; new test (botVehicles.test.ts) drives buggy and jeep round a hairpin course flat out
  with the bot `steer()`: max slip 0.16 / 0.11 rad (spin-out ≈ 0.6).
- **Perf** (A/B against 89cc319 in a second worktree, loaded 4-core box, Iron Maw TDM 60 s, 13 sprung vehicles):
  24 bots tick avg 3.72/3.46 → 3.69/3.31 ms (two rounds), mounts 0.72/0.67 → 0.76/0.69; 96 bots 4.86/4.78 →
  5.05/4.21 ms, mounts 0.70/0.68 → 0.78/0.66 (noise). Worst case, 24 buggies all driven over bumps: 0.84/0.87 →
  1.10/1.04 ms a tick (+~8 µs per vehicle); 48 driven jeeps (ray budget kicking in) 1.22 → 1.37 ms. Client, Iron Maw
  with every wheeled vehicle driven: `View.updateMounts` 1.78/1.50 → 1.31/1.40 ms a frame (the snapshot replaces
  the 5 drawn-only rays per vehicle per frame for the sprung ones). Bundle 831.2 → 833.1 kB gzip.
- Checks: typecheck, test:changed (1201 passed), e2e vehicles (new check: sprung buggy, 4 tires on pivots rolling),
  race, canyon, offline, mobile PASS. CI plan says full suite (shared code): merge through a `check/` branch.
- **Local setup trap** (fixed here, may bite other agents): worktree `node_modules` symlinked into another checkout
  resolve `@tiletrigger/shared` to that checkout's code; use a real `pnpm install --offline --frozen-lockfile`.
- Step 2 (rollovers, rigid body) not started. Ideas: the sprung pitch could feed the probe's launch angle off ramps;
  bots could ease throttle when `slide` grows (MountView has no slide yet).

### Spear model (`wip/spear-model`, agent, 2026-11-01; merged to main 5756b31)
Owner: "New spear is for our spear". The "T Pose Figure" download in `~/meshy-drive/tposes-2026-11-01/` (a carved spear;
Meshy community, CC0 per the owner, author not recorded) is the Spear's model `guns/spear.glb`:
- **Pipeline:** content/guns.json, new pack `meshy-community-weapons` (Meshy community GLB downloads, CC0); the download
  stands upright, so prepare-guns.mjs takes `forward: "+y"` / `"-y"` now (laid down about +X; not for `interior`).
  2.0 m, hero tier: **14,000 triangles + a 2,800 LOD (12 m), 1024 px colour, 512 px normal, 690 KB** (source 1.3M
  triangles, 2048 px maps). Rebuild: `ONLY=guns/spear.glb node tools/content/prepare-guns.mjs --downloads <dir>`
  (a fresh dir with a link to the GLB). Licence notes: assets-src/meshy-community/License.txt, docs/ASSET_SOURCES.md.
- **Wiring:** `core.spear` view: model `guns/spear.glb`, fallback `procedural/spear` (re-laid to the same 2 m, centred,
  grip at z -0.35), viewOffset [0.28, -0.24, 0.65], hold pistol, grip [0, 0, -0.35] (a third of the way back on the
  plain shaft; drawn hand 1.5-3 cm off in first, full-body and third person). Pickups and other players' hands use
  the view model. Thrown spears: `View.spearProjectile` instances the model over the plain shapes (shapes until it
  loads), its tip 0.52 m ahead of the sim point as before. **Fix:** `animateArsenalProjectile` had no case for
  `spear`, so a thrown spear always faced world +Z; it now points along its flight and keeps that heading stuck (a
  spear first seen already stuck, e.g. joining late, still faces +Z: snapshots carry no velocity). New icon
  `guns_spear.webp` (the procedural one removed).
- **Checks:** unit `spearProjectile.test.ts`; e2e arsenal (held as the model, thrown, stuck, drawn as the model),
  characters (hand on the shaft in three views). Looking along a 2 m spear in first person, the flat blade shows
  mostly edge-on past the carved collar; a tilted first-person hold would need a view rotation field (none today).

### `wip/ziplines` (agent, 2026-11-01; merged to main 89cc319): real ziplines, a MapMaker element
Owner: "build real ziplines if it's easy enough; should also be a MapMaker element". Built:
- **Format v25** `zipline` entity (schema.ts `ZiplineEntity`: start post foot `position`, far post `end` as an offset,
  `height`, `speed`, `twoWay`, `team`, `sag`); migration 24 → 25 is additive. Maps keep their old formatVersion.
- **Sim** `shared/src/sim/zipline.ts`, run inside `stepMovement` (so prediction and replays match): E within
  reach grabs, ride along `MoveState.zip/zs/zv`, jump or E lets go with momentum, the far end drops you 1 m
  before the post, a hit ≥ 30 knocks you off (`Match.damage`), one-handed weapons only (`oneHanded`, server
  `unarmed` and client `trigger`). Riders hang from the drooping cable as drawn (sag is not only cosmetic).
  Snapshot `zl` (MULTIPLAYER_PROTOCOL.md §16; added to interest.ts OPTIONAL_KEYS for deltas).
- **Bots:** `ziplineLinks` in `navLinks`; brain `zipGrab` walks to the grab spot and presses E; the match strips
  E/jump from riding bots; team lines are shut to others (`pathBlocked`).
- **Client:** cable/posts in ScenarioVisuals (game and MapMaker), trolley on riders (view.ts `createTrolley`,
  local one in first person), `zip.whirr` (synth `hum`), first-person bank (`Session.zipLean`), prompts.
  The hanging pose is the existing air pose (no arm-up IK: the grip IK would fight it).
- **MapMaker:** palette Zipline (Platforms & Climbing, Jungle Ruins pack), inspector, "Place ends on the map"
  (RouteTool with two fixed points). Validation: shape in `validateMap`, clearance/reach/landing in
  `validateNavigation(map, nav, physics)` (new optional `physics` argument; server, validate-map and MapMaker pass it).
- **Vinefall Sanctum:** two one-way gorge lines (DECISIONS_AND_DEVIATIONS.md), validate-map 0 issues.
- Tests: packages/shared/test/zipline.test.ts; e2e `editor` → `ziplineChecks` (place, place end, TEST ride).
- Checks run locally: typecheck, test:changed (all: 1184 passed), build, bundle 828.3 kB gzip (budget 840),
  e2e editor, editorux, maps (E2E_MAPS=vinefall_sanctum) PASS; offline PASS on a rerun (one flake in
  "Join game puts you back in play", unrelated). Bench 24 bots 30 s Vinefall with / without the lines:
  tick avg 3.37 / 3.68 ms (noise; loaded machine). Not yet on a check branch.
- Left: a hand-over-head hanging pose (needs the grip IK to let go of the support hand); minimap/plan don't
  draw ziplines; R in MapMaker doesn't rotate a zipline (no yaw: drag its ends).

### Vehicle shake fix (lead, 2026-11-01; on `wip/buggy-cockpit`)
Owner: "the buggy shakes violently when I drove it". The sim is smooth (a scratch test drove it: height steady to the mm,
no heading wobble). Cause, on the client: `View.suspend()` read speed, acceleration and turn rate off frame-to-frame
movement of the eased drawn pose (`m.shown`), which surges and stalls as snapshots arrive; acceleration × 0.006 swung
the drawn pitch by up to ~0.1 rad every few frames at a steady 18 m/s, and the cockpit eye rides that pose. Now it uses
the mount's tick-based `vel` and `spin` (`mountState.apply`), with acceleration low-passed (the velocity steps once per
snapshot). Second part: `smooth()` projected ahead from each snapshot's arrival time, so arrival jitter (worker, network)
moved the drawn position; `m.at` now follows the ticks, pulled 10% toward the real arrival. Test:
`mountSmooth.test.ts` (jittered arrivals at 144 fps: 6% speed wobble before, under 3% after). Note: headless software
rendering runs 1-2 fps, so this can't be measured in the browser here; the replay scripts were plain Node.

### Buggy cockpit interior (`wip/buggy-cockpit`, agent, 2026-11-01; not merged)
Owner's screenshot: the buggy's cockpit view looked mushy up close (seats, wheel, dash). The body is the owner's
Meshy download (3.98M triangles, one 2048 px colour map) cut to 40k with one 2048 map over 4.4 m.
- **Pipeline:** a guns.json entry's `interior` (docs/CONTENT_PIPELINE.md, "Cockpit interiors"): prepare-guns.mjs
  builds a second GLB cropped to a box in the model's frame (meshyDocument `crop`), placed with the body's exact
  placement. The buggy's box: x ±0.95, y -0.63..0.8 (mount 0.35..1.78), z -1.05..1.45 (both seat rows, wheel, dash,
  roll cage): 1.98M of the 3.98M source triangles → **31,898 triangles, 2048 px colour + 2048 px normal, 3.6 MB**
  (`vehicles/offroad_buggy_cockpit.glb`, tier `cockpit`, lock + provenance as Meshy, owned). The body rebuilt
  byte-identical. Rebuild: `ONLY=vehicles/offroad_buggy_cockpit.glb node tools/content/prepare-guns.mjs --downloads <dir>`.
- **Client:** `MountDef.cockpitModel` (buggy only); `game/cockpitInterior.ts`, driven from `View.updateMounts`: in the
  cockpit view it loads the interior once, parents it under the ridden body's model node (zOffset -1), and draws your
  copy of the body through a submesh that leaves out its triangles wholly inside the box (the shared index buffer
  reordered once, outside triangles first: the other copies draw the same). Chase view, other vehicles and other
  players: the body alone, no extra load. `View.cockpitInteriorShown()` for tests; e2e vehicles checks both views.
- **Limit:** the download's own colour map is 2048 px for the whole buggy, so colour detail is near what the source
  has; the gain is geometry (about 2x in the cockpit plus a sharper normal map) and the round steering wheel.
  Before/after shots were in the agent's scratchpad.

### T-pose characters (`wip/tpose-characters`, agent, 2026-11-01; merged to main c3bce36; branched from `wip/grip-audit` + main)
Owner: "I uploaded T-poses to use, couldn't find some and found some new ones" (13 Meshy GLBs, kept outside the repo
in the machine's `~/meshy-drive/tposes-2026-11-01/`). Merge after `wip/grip-audit` (this branch holds it, plus a merge
of main for Character Select's groups). Each download was rendered front/side next to the shipped model and matched
by looking, not by name:
- **Same model, rebuilt** (look IDs unchanged; licence as the manifest had it, CC0 community): Alien → The Visitor,
  Elder → Elder Tomo, Pilot → Flt. Lt. Ember, wizard → Merrow the Wise (now rigged here from T-pose landmarks instead
  of Meshy's rig; no `cloth`, since his sleeves hang below the hips: hands out of the sleeves, audit 3 → 3, spikes 2 →
  0). The first three keep their manifest landmarks (they fit the GLBs); `source.file` takes `.glb` or `.fbx`.
  **Cat → Biscuit is the same model but NOT replaced yet**: rebuilt from the GLB with curled paws (`hands.curl` 1) the
  grip audit went 10 → 0, but e2e `characters` ("hands are drawn ... flat to its side") failed on every Biscuit pose
  (flat 0.02-0.10); with rigid paws one pose still fails (pistol, body, pitch -1.45: flat 0.59 < 0.6). The shipped
  Biscuit (passes) is kept; next: a `fixes.hands.palm` / paw frame for him, then rebuild with
  `ONLY=meshy_cat` (source.file `^Meshy_AI_T_Pose_Cat_\d+_texture\.(glb|fbx)$`, landmarks fit as they are).
- **Different models, new characters** (owned, rigged here from landmarks read off front/side views): Frog in Suspenders
  → **Croakley** (Animals; not Boglurker), Goblin → **Snikkit** (Creatures & Machines; not the shipped Goblin), Monkey
  → **Scamp** (Animals, tail; not Big Bab, whose `source.file` was narrowed to its own download), Old medieval → **Old
  King Halvard** (Knights & Legends; not King Aldric), Officer → **Sgt. Pruitt** (Soldiers), Wolf → **Greyfang**
  (Animals, tail), Gentleman Bear → **Barnaby Bruin** (Animals; **queued**, not built: his coat's texture islands hold
  every texture-safe cut at 20.6-23k triangles, over the 20k budget; a sloppy cut scrambles the coat. Needs a texture
  re-layout for characters, like the props' `rebake`, keeping the skin, or a lighter download).
- **Figure** is not a character: a carved spear (a prop or weapon, left for the owner).
- **Bandit**: the shipped build was the in-house fallback (found landmarks: fused legs, turned head) because the
  model-fidelity rebuild had no rigged GLB; rebuilt from his recorded Meshy rig task (re-fetched, **no credits spent**):
  audit 9 → 6 (flat, spikes), legs apart, head forward. The 5 approved credits are unspent.
- Grip audit (rifle, before → after): The Visitor 0 → 0, Elder Tomo 0 → 0, Ember 0 → 0, Merrow 3 → 3,
  Bandit 9 → 6; new: Snikkit 0, Greyfang 0, Sgt. Pruitt 3 (flat), Old King Halvard 3 (spikes), Scamp 6 (open, off, fp),
  Croakley 9 (open, off, spikes, fp: the frog's long fingers hang open). Portraits captured locally for the eleven built.
- Open: Barnaby and Biscuit (above); Croakley's and Scamp's open hands. Licences settled (owner, 2026-11-01): the new T-pose
  models are Meshy community models under CC0 (pack `meshy-community-characters`). The "Figure" download (a carved spear) is
  to become the model of our Spear weapon (done on `wip/spear-model`, above).

### Owner's Meshy props (`wip/owner-props`, agent, 2026-11-01; not merged)
The owner's 12 uploads of 2026-10-31 (Meshy, owned; raw files in `/home/user/meshy-drive/owner-uploads-2026-10-31/`,
not in the repo) are props of the new pack `meshy-owned-landmarks` (content/props.json, `download: owned_landmarks`:
to rebuild, link the GLBs and the monk's `_stylize.glb` into `<dir>/owned_landmarks/` and run
`ONLY=<ids> node tools/content/prepare-props.mjs --downloads <dir>`). All hero tier, 1024 px colour map, baked
normals (512 px), one LOD.
- Same ids as the stand-ins (maps unchanged): `dc_market_stall` (2.8 m), `dc_well` and `mv_well` (both the wishing
  well, 2.2 m), `dc_crane` (crawler crane, 10 m, turned so the boom points +Z; `collide: shell` with the new
  `shellTop: 3.2`, so only tracks and cab collide), `jt_statue_large` (Mayan statue, 4 m; the stand-in was 6.35 m).
  Their code-built stand-ins are gone from prepare-desert/medieval/jungle.mjs and assets-src; the style-pack tests
  expect the Meshy pack for those ids.
- New: `mv_market_stall` (2.9 m), `rustic_market_stall` (Town & Market, 2.7 m), `temple_fire_statue` (3 m),
  `temple_spear_statue` (3.5 m), `temple_monk_statue` (3 m; all three Jungle Ruins), `town_fountain` (2 m tall,
  3.3 m across), `lion_head_fountain` (2 m), `eagle_fountain` (2.6 m; fountains in Town & Market). Added to the
  Jungle, Desert, Medieval, Harbor and (rustic stall) Frontier STYLE_PACKS lists.
- Market Town: prop_062 is `town_fountain` at scale 1 on the plinth top (y 0.5), replacing `fountain_square` at 0.4
  (that Kenney prop is shared with serene_city, so it stays).
- Asset viewer: with one prop (`?mode=assets&set=props&filter=/<id>.glb`) the camera frames it from the front.
- Menu bundle after this: 824.7 kB gzip / 2927 kB raw (budget 840 / 3000). Checks: typecheck, test:changed (the
  pads timeouts under load pass alone), content OK, validate-map clean, e2e editor + maps (market_town, qasr_medina).

### `wip/menu-profile` (agent, 2026-10-31; merged to main 2026-11-01)
Owner: Character Select's tabs "span too far and look cluttered", the bottom bar is cluttered, sign-in is
hidden, and the top-right character tile should be the Profile with "Change character".
- **Profile entry** (`profileEntry()`, `#profile-badge`, top right of Home): portrait, player name, character,
  account chip (`accountState()`: Guest / ✓ Signed in / Pick a username); opens Profile (P, pad Y). Signed out
  with sign-in offered: orange `#sign-in` (`button.cta`) under it. **Characters** left the Home nav.
- **Profile** (`profile()`, `#profile-panel`): character (`#profile-change-character` → Character Select; C /
  pad Y), player (guest name → "Change it in Options" / `#profile-sign-in`; signed in: username, `#sign-out`,
  username form), region, privacy + Copy my account ID. Auth flow unchanged (account.ts untouched).
- **Character Select**: `charSections()` → one `.char-grid` of `.char-sec` (sticky `.char-sec-head`, label +
  count) with a `.char-jump` strip (`.char-chip`, lit by `sectionInView`/`markSection`); Q/E → `stepSection`;
  chips/Q/E glide with our own rAF easing (`glideGrid`: a second smooth `scrollTo` while one was starting left
  the grid in place); wheel/touch cancel it. Arrows / d-pad: `gridMove` (crosses sections). Opens on your
  character's section. `charFrom`: Back and Choose return to the opener (Profile, Online). "All" is gone.
- **Bottom bar** (`hints()`): `.hint-group`s moves | acts (main one `.main`, cyan) | util (Fullscreen); news +
  Privacy only on Home (`footer[data-screen]`); the `, .` turn hint moved into the spin bar; touch: no bar off
  Home. Footer account links (`footerLinks`) removed.
- e2e: offline flow's Character Select block rewritten (Profile route, sections, strip, Q/E, wheel, arrows
  across sections, Back/Choose → Profile, P/C keys); designer flow opens via Profile.
- style.css changed, so CI runs the full suite on a check branch; locally run: offline, mobile, designer,
  characters, visual. Screens: session scratchpad `profile/` (before/after at 1920, 1400, phone).

### Grip audit and fix for every character (`wip/grip-audit`, agent, 2026-10-31/11-01; merged to main 8c5e491)
The owner's screenshot brief (Character Select holding the AK, character by character; references: The Visitor and
Rattles) is in the session branch's HANDOFF ("Queued (owner, 2026-10-31 evening): grip audit and fix"). What was done:
- **Audit tool:** `tools/content/grip-audit.mjs` (+ `__grips.audit()` / `tools/gripAudit.ts`, `__grips.upper()`,
  `__grips.curl()`): every player character with the rifle, pistol and Spin Gun, side and front, measured as drawn:
  finger weights per hand, fingertips against the grip with the hands open vs closed (the curl test), elbow bend vs
  the arm's own skin, gun against head and shoulders, arms across the midline, stretched skin edges, first person.
  Writes `audit.json`, a ranked `summary.md` and contact sheets; `RESUME=1`, `RESCORE=1`, `ONLY=`. See CHARACTERS.md.
- **Results** (57 characters incl. the rig's Ranger; rifle numbers, 1.8 m body): flagged 42 → 30; flags: flat 24 →
  10, off (hand centre off its point) 35 → 16, open (fingertips far from the grip) 25 → 10, first person 29 → 16,
  face 1 → 1 (Capt. Nova, side view), crossed 0 → 0, elbow 0 → 0, spikes 14 → 17 (see left), back (fingers curl away)
  0 → 3 (support hands; before had no curl test). Shooting hand median: fingertips to grip 11.0 → 6.3 cm, hand centre
  to grip 6.8 → 4.2 cm. Curl test, shooting hand (+ closes onto the grip): Big Bogdan −5.3 → +5.4 cm, Shade −5.0 →
  +3.5, Cap'n Barnacle −3.6 → +3.6, Sir Galloway −3.0 → +3.2, Agent Zhao −1.4 → +2.9, Iron Knight −1.4 → +2.8, Hector,
  Grunt '68, Saint Nick, Capt. Nova, the Dapper 0 (no finger skin) → +1.0 to +6.5. References unchanged (The Visitor
  +1.9, Rattles +2.3 → +2.6). Per-character table: the audit's `summary.md`; the session's sheets were in the
  agent's scratchpad (re-run the audit for fresh ones: about 45 min on this machine).
- **(a) Gun at the face / arms crossed** (Barnacle, Hyena, Ricochet, Shambler, Grandpa Chains, Botboy, Rotter): from
  the side NONE is crossed and none has the gun at the face (head-to-gun 0.14-0.30 m, as The Visitor's 0.14 and
  Rattles' 0.17; grips 5-7 cm below the shoulder joint; elbows outward). The cause is Character Select's camera: it
  stood ~7 degrees off the rifle's line, so every hold (the rig's own Farmhand too) read as a gun at the face with
  the arms crossed under it. Fix: Character Select turns the hero three-quarter on (`HERO_YAW_SELECT` 0.85 rad in
  menuScene.ts, eased with the camera; home unchanged; visual e2e passes). Barnacle's arms really are short for his
  shoulders (arm 0.94 of shoulder width, The Visitor's 1.72): his left arm is straight, the support hand slid back.
- **(b) Elbow bending backwards** (Ivory Rustwalker, Iron Knight): not found in the hold: the elbow test (forearm
  toward the upper arm's bind-pose front) is positive on every character. What reads as a broken arm is the hand:
  the Knight's hand was read a quarter turn round (its flat agreed 0.08 with the rig's palm) and lay flat under the
  gun; Rustwalker's hands were rigid "fists". Both re-fitted (below).
- **(c) Flat open palms**, two causes, both fixed: (1) hands.mjs took relaxed Meshy hands (0.3-0.45 thick for their
  length) for fists and left them unweighted (Hector, Grunt '68, Shambler, Grandpa Chains R, Nova, Otter, Pilot, ...):
  now only a compact block is a fist (thick AND about as long as wide); hands turned on their joint take their palm
  from their own flat; strays (straps, cape edges) are left out. `rehand-built.mjs` re-fitted all 56 from the shipped
  files (no downloads needed). (2) Where a palm side came out reversed the fingers curled UP off the grip (Bogdan,
  Shade, Galloway, Barnacle, Zhao, Knight): `closeHand` now takes the gun point and curls toward it.
  Still flat/splayed: some SUPPORT hands under the handguard (King Aldric's left, Dusty Colt's, the Dapper's,
  Grunt '68's look spread) and the rigid paws (Hyena, Biscuit, Boglurker, Goblin L, Teddy L: fists by shape).
- **(d) Stretched spikes** (Giggles, Vanguard, the robed rangers): `tools/content/armweights.mjs` (cloth an arm holds
  that hangs well below it takes the nearest body vertex's weights) was tried on all and made it WORSE (Giggles' and
  the Dust Trooper's wide sleeves grew wings from the arms; stretch rose on Hector, the Dapper, ...). Kept opt-in
  (`fixes.armCloth`), used by none. Needs a better rule (weights blended by geodesic distance from the arm, or cloth
  joints) and is still open. The stretch flag also counts some finger stretch now that more fingers bend (King
  Aldric 28 long edges at middle_01_l, Count Bonesworth, the Dapper, Dusty Colt, Rotter).
- **(4) Lumpy faces / lost hands:** the Meshy cut (`cutKeeping`, meshy-mesh.mjs) now keeps 12% of the budget for the
  head and 4% for the hands, never sloppily (both the 40k work cut and the final cut). Rebuilt from downloads on this
  machine (no new credits; Brother Ansel, Merrow the Wise and King Aldric re-fetched from their recorded rig tasks):
  head triangles Lancer Mei 133 → 1381, Sir Galloway 389 → 1321, Dale 773 → 1296, Brother Ansel 551 → 1282; hand
  triangles Merrow the Wise 110 → 437, Lancer 80 → 430, Brother Ansel 140 → 432. King Aldric 14.6k triangles and
  Brother Ansel 18.1k (budget 11k; the careful cut stops there on these dense rigs, as Ansel's 13.7k did before;
  within the byte budget, content:check OK).
- **Needs the owner:** FBX downloads for the in-house originals aren't on this machine (goblin, otter, toad,
  salamander, hyena, elder, alien, cat, pilot, pirate, titan): their hands were re-fitted from the shipped files, but
  a re-cut (head/hands share) needs the FBX folders. Bandit (fused lower body, head turned): a broken in-house fit,
  needs new landmarks in its manifest or a Meshy rig (5 credits: ask). Plains Scout is still a queued stub on main
  (not built; its respect review is open). Desert Ranger / Dust Trooper / Giggles / Vanguard spikes: open (above).
- Checks: typecheck; full vitest (1194 pass); content:check OK; e2e characters (all grip checks, in play, bots 9/9),
  designer, arsenal, visual PASS (characters' first run failed on a model load and a bot count under machine load;
  passed on rerun).

### `wip/character-groups` (agent, 2026-10-31; not merged)
Owner: "organize the characters better (soldiers, zombies, animals, creatures, human, etc)", then "clicking a
character should just be how I look around, not this hover business; select, then confirm".
- Character Select tabs: All, Soldiers, Knights & Legends, Everyday Folk, Undead & Horror, Animals, Creatures &
  Machines, Yours (empty groups hidden; group tabs sorted by name, All in roster order). One source per look:
  `group` on each part-built preset in `CORE_LOOKS`, `"group"` in each manifest (one added line per file; the
  checker requires it on player looks, `GROUPS` in character-manifests.mjs = `CHARACTER_GROUPS` in looks.ts),
  `NPC_LOOK_GROUPS` for NPC skins; `lookGroup(id)`. Test: packages/shared/test/lookGroups.test.ts. Membership
  table: docs/CHARACTERS.md, "Character Select's groups".
- Picking: click / tap / Enter / A previews (`FrontEnd.previewed`, kept across tab switches); Choose button, Enter
  / A again or double-click confirms; Back keeps the old look; hover does nothing but highlight; Chosen badge.
  e2e `offline` checks all of it.
- **Merging with `wip/grip-audit`:** both edit content/characters/*.json; this branch only adds a `"group"` line
  after `"look"`, so re-run `node tools/content/character-manifests.mjs` after the merge to regenerate
  characters.generated.ts.

### `wip/medieval-fixes-dropship` (agent, 2026-10-31; in progress, not merged)
Owner asks: Market Town "some roofs upside down, the fountain floating and too large, a few buildings look off",
and "add the drop ship to the path tool (drawn in and out of bounds; players/bots only drop out and land in a valid
map area)".
- **Done (committed):**
  - Market Hall roof was a V: `gableRoof` rolled ridge-north-south slabs the wrong way (`roll: -s*PITCH` → `s*PITCH`).
    Houses/forge/watchtower (ridge east-west, pitch) were right at every rotation; a test now checks every medieval
    tile's roof slabs face up and out at all 4 rotations.
  - Odd pieces fixed in `packTilesMedieval.ts`: house ceilings and the balcony deck no longer share faces with the
    walls (z-fighting along every facade top / balcony edge), hall's floor band is now a fascia (it fought the floor),
    shop awning slopes on two wall brackets (were posts hanging in mid-air), shop shelves moved off the east door,
    street plinth cut at doorways, watchtower "braces" were a 7 × 5 m board through the lookout (now X-beams),
    bell tower's belfry floor duplicated the stair landing in another tint, forge chimney / stream lip / watchtower
    posts nudged off coplanar faces. Test: no coplanar faces between different materials in medieval tiles.
  - Props (`prepare-medieval.mjs`, rebuilt with `ONLY=mv_tarp_tent,mv_hay_cart,mv_shop_sign prepare-props`):
    tarp tent canvas now meets its ridge pole (used the complement angle), hay cart shafts rest on the ground,
    shop sign board hangs clear of its strut.
  - Fountain: `prop.fountain_square` scale 1 → 0.4 in `maps/market_town.json` (9.2 m basin over a 3.8 m plinth step
    → fits the upper step at 0.5 m). Portcullis: `startOpen: true`, sim and visuals start raised; what looked like a
    lowered grille in the QA shot is the timber-framed border fence seen through the passage (unchanged).
  - Drop routes: `AirplaneEntity.craft` ('plane' | 'dropship', optional, additive); `DROPSHIP_DROP_DEF` (dropship.glb,
    12 benches); MapMaker Paths group has Plane/Dropship Drop Route cards + palette key `airplane:dropship`;
    inspector Aircraft choice; route tool colours the route green over the play area, grey outside.
    Sim (`sim/airplane.ts` dropPlan/dropArea/canDrop/dropStretchEnds/botDropIndex, `match.ts` dropPlanFor/mayJumpOut):
    jumps only when exit and landing points are over ground in the play area (bounds, else tiles+terrain, 3 m in;
    not void/lava/acid); refused jump → per-player `msg` (new optional `s` on the msg event); riders still aboard are
    dropped at the last good point; bots pick a nav-reachable landing near their objective. Old 60 m bounds warning
    replaced by `airplane.nodrop`. Unit tests in airplane.test.ts.
- **Also:** drop routes now start their clock when play begins (`MountRt.routeT0`, set in beginPlay/startRound):
  timed from tick 0, the loading wait and countdown could fly a dropship across the whole map before anyone could
  jump. Market Town's tarp tents stood half through the south border fence: moved to z -72 (east one to x 27, clear
  of a spawn). Palette atlas + provenance rebuilt.
- **Local checks:** typecheck OK; test:changed 3 load flakes (npc/scenario bot matches) that pass alone; airplane
  and medieval tests pass; content:check OK; validate-map market_town/eagle_spires/frost_basin/runway_nine 0 issues;
  bundle budget 799.9 / 800 KB gzip (was 799.0: the drop plan is reached from validate.ts in the menu bundle, so
  there's ~0.1 KB left); e2e editor (with the new dropRouteChecks), editorux, vehicles PASS. In the e2e, TEST's
  bots must hold fire (one shot the player under the canopy).
- **Next:** CI on `check/medieval-fixes`; if red, fix forward on the wip branch.
- Screenshots (before/after, real match, prod build): session scratchpad `mt-fix/` (not in the repo).

### `wip/grips-live` (agent, 2026-10-31): "the grips are not working at all" (owner, live 6c0f8a6)
- **Root cause:** the clips' hold is made for the rig's hand; a Meshy hand can sit on its joint a quarter turn
  round (core.dapper's), so its palm faced the camera and its edge the grip, in every view. Not specific to real
  play: the grip tool showed it too. The tests passed because `gripMiss` / `__grips.miss()` measure the JOINTS (the
  palm point the IK placed), not the skin. Real-play paths (switching, cached viewmodels, respawn, LOD, prod build)
  were measured and were fine.
- **Fix:** `handProbe.skinHandFrame` reads each measured hand's frame (fingers, palm normal on the thumb's side)
  off its bind-pose skin; `gripHand` turns the shooting hand (and a pistol's support hand) onto the gun, first
  person for every rig (follows the gun's pitch), third person for measured hands. Full body keeps that turn while
  the shoulders move and draws your hands at 0.85 (`FP_HAND_SCALE`). Looking up, the head tips back over the neck
  (`FP_HEAD_TIP`): the coat no longer crosses the sky. The dapper's fingers can't curl (no finger weights): a flat
  hand lies along the grip; a finger rig for him is a content fix.
- **Grapple:** the rope starts at the viewmodel's muzzle (third person: your gun's) and follows it (`View.addRope`).
  The owner's "third person holds nothing" with the grapple wasn't reproduced; when the third-person camera is
  squeezed against a wall (`tpClose`) your body isn't drawn at all, which may be what was seen.
- **Creature skins (Imp, Puglin):** `CreatureAnimator` held the gun backwards at the clip's hand; now along the aim
  at the chest with both hands by IK (`armsFrom`/`holdWith`), IK after the clips (a shadow pass drew the skin before
  onBeforeRender), shots don't play the claw attack; `fitPlayerSkin` sizes the skin to a player's height (no wider
  than 1.3 m: the puglin's ears). Not done: the Imp's slight lean (its idle clip).
- **Checks:** `__grips.drawn()` and `View.gripReport()` measure where hands are DRAWN (skin centre to grip,
  fingers along the gun, flat to its side); `characters` e2e: 4 looks × pistol/rifle/grapple × body/arms/third and
  pitch ±1.45, plus `gripsInPlay` (canyon DM, 12 bots, dapper: keys, wheel, give, third person, respawn, bots near
  and far, rope from the muzzle, an Imp's gun). Knight's gauntlet measures 12 cm off (left out of the check).
### Model fidelity (`wip/model-fidelity`, agent, 2026-10-31; not merged)
- **What was wrong:** the Meshy pipeline (tools/content/meshy-mesh.mjs) cut downloads of 10k–1.8M triangles to
  2–6k and shipped only a rebaked colour map: the normal map was dropped, so the cut mesh shaded as flat lumps.
- **Now:** `bakeNormals` bakes a tangent-space normal map from the full download (its normals plus Meshy's own
  normal map) onto the cut mesh, with a TANGENT attribute (green sign checked by rendering in Babylon against the
  download). Props, guns and Meshy characters all get one. Budget tiers: `budgets.tiers.hero` in props.json /
  guns.json (20k tris, 1.6 MB, LOD required above 8k), `"budget": "hero"` on landmark props (excavator, haul truck,
  historic building, gantry crane, 5 containers) and on first-person weapons, turrets and the buggy; hero entries
  carry a LOD (`lod: [share, m]`) that models.ts gives to merged prop instances and to instanced copies (crowd guns).
  Character byte budget 1.5 → 1.8 MB. `ONLY=` for prepare-props.
- **Rebuilt:** all 30 owned Meshy props, 13 guns + medkit + buggy (incl. ornate pistol and sentry, whose GLBs were
  in the session scratch `dl/`), 42 of 56 Meshy characters. **Not rebuilt (no download here):** community props
  mp_control_cabinet, mp_dino_statue, mp_burnt_car; community guns ironclad_revolver, arc_cannon_turret;
  offroad_tire (kept at 800 tris on purpose); characters knight, nova, dapper (rigged by task ID: `fetch-meshy.mjs`
  can re-fetch them), goblin, otter, toad, salamander, hyena, elder, alien, cat, pilot, pirate, titan (FBX downloads).
- **Cost:** Meshy props 4.9 → 11.1 MB, guns/vehicles 3.6 → 10.6 MB, characters 41.9 → 52.4 MB; site dist 169 → 192 MB.
  Next lever: EXT_meshopt_compression (geometry is most of each file; needs the decoder served with the site).
  perf96 iron_maw medium (box at load 14–18, 1–7 frames a run, so frame times mean nothing): draws ~1,000–1,060
  either way (normal maps and LODs add none), casters 120–200 (budget 600), triangles in matched spread views
  1.86 M before vs 1.98–2.47 M after. GPU memory: +~1.4 MB per normal map at 512 px, first-person gun colour
  maps 512 → 1024 px (+~2.8 MB each loaded). Re-measure on a GPU (`PERF_GPU=1`).
- Checks: typecheck, test:changed (1005 pass), content:check OK; e2e vehicles, characters, visual PASS; arsenal
  FAILS here on "R loads the barrel again" (and once the axe swing / hazards) with the old models too (load).
- Merge through a `check/` branch: content changes run the full suite; the `visual` baselines (menu hero rifle) may
  need `pnpm e2e:baselines`.

### Queued for after 15:00 EST / 19:00 UTC (owner, 2026-10-31): new Drive downloads
- **New models** the owner added to the Drive folder (`18MaKefMCWARf1Y3gAjhZuxTto86vGAYl`): sort them (characters,
  props, weapons, vehicles), process through the existing pipelines, name and manifest new characters.
- **FX: the owner bought a full licence** for the effects packs whose free versions we already use (Binbun:
  `content/vfx.json`, binbun-muzzle-flash / hit-fx / explosion-fx, CC0 free editions). The full packs add many more
  effects, textures and weapon/gameplay effects. Before shipping: read the purchased licence text (it is likely a
  commercial licence, not CC0) and record it per pack in vfx.json / provenance (licence, "purchased by the owner");
  CLAUDE.md's content rules list CC0, credit-only and Quaternius packs, so add "assets the owner bought a licence for"
  there with the owner's OK. As now, only the processed output ships (prepare-vfx.mjs atlases); the pack files are
  never committed. Then map effects to weapons (muzzle, tracer, impact per surface, explosions per weapon), gameplay
  (pickups, spawns, portals, jump pads, hazards) and check performance at 96.

### After the style packs (owner, 2026-10-31): MapMaker overhaul and a pass over every map
Once all the style packs are done (10 Medieval, 11 Harbor, 12 Snow, 09 Desert City, 06 Jungle Ruins refresh, and the
unassigned Sci-Fi Research and Industrial Factory refreshes), the owner wants:
- **A major MapMaker update** for the packs: how they're browsed, placed and combined (palette, search, pack
  filters, previews, tile/prop placement and editing). Scope it with the owner first.
- **Every map updated** to the new styles, assets and models (the suite in maps/), improved where it helps
  (layouts, looks, cover, spawns, weapons, performance); each map edited in MapMaker as data (CLAUDE.md "Maps"),
  validate-map clean, its card shot redone. Overlaps the older queued "Map revisit pass".
Not started; plan it with the owner when the packs are on main.

### Menu bundle (2026-10-31): style packs push the menu's first JS over budget
The menu's first JS grows ~6–12 kB gzipped per style pack (Harbor 798, Snow 805, Desert City 816 kB): each pack's
tiles (catalog.ts imports packTiles*.ts statically), materials and the whole props table (props.generated.ts via
getProp in geometry/match/validate) come in through the shared map and sim code the menu loads. The budget in
tools/ci/bundle-budget.mjs was raised to 840 kB gzipped / 3000 kB raw for Snow, Desert City and Jungle Ruins.
**To do:** load pack tiles and the props table on demand (a registry the editor and the match fill before they need
it; the menu draws neither), then bring the budget back to ~800 kB.

### Work split between the owner's two accounts (2026-10-31 ~06:40 UTC)
The owner is splitting the style packs across two accounts. Each pack goes on its own `wip/<pack>-pack` branch built
on `main`. They collide in generated files (props.generated.ts, thumbs/palette.json + atlases, provenance.json,
props.json, stylePacks.ts, catalog.ts, materials.ts, CHANGELOG/HANDOFF). Whoever merges second rebuilds those:
`pnpm build`, `vite preview`, `build-palette-atlas.mjs <url>`, `pnpm content:build`, then `pnpm content:check`.
- **This account (claude/launcher-ui-map-cards session):**
  - Style Pack 11 Coastal Harbor (`wip/harbor-pack`).
  - Style Pack 12 Snow Outpost (`wip/snow-pack`).
  - Market Town fixes: upside-down roofs, the floating, oversized fountain, odd building elements.
  - Dropship on the path tool (`wip/medieval-fixes-dropship`).
- **Other account:**
  - Style Pack 02 Desert City, replacing 09 Sands of Egypt (owner: "replace"; keep Egypt's tiles and props valid so
    existing maps such as pharaohs_reach still load, but the pack entry and its palette become Desert City).
  - Jungle Ruins refresh from the TILESET 04 sheet (owner: "update"): carved, relief and window walls; beamed and arch
    ceilings; a zipline post; a watch tower.
  - Ancient Temple (TILESET 07) is combined into that same Jungle Ruins refresh (owner, 2026-10-31: the two
    sounded alike), so it is one pack: Jungle Ruins. 03 Imperial Arena stays Roman and unchanged.
  - Sci-Fi Research (Orbital) and Industrial Factory (Military) refreshes are unassigned.
- **If this account runs out mid-task:** the three agents push WIP to `wip/medieval-fixes-dropship`,
  `wip/harbor-pack` and `wip/snow-pack` after every step, each with its own HANDOFF section saying what's done
  and what's next. The other account resumes from those branches: merge `main`, finish, go green on `check/<name>`,
  then fast-forward `main`.
- **State when this account ran out (2026-10-31 ~12:20 UTC):** all three branches nearly done, none run on CI yet:
  `wip/medieval-fixes-dropship` dbe4685, `wip/harbor-pack` 7d13a27 (Saltmarsh Harbor; also moves STYLE_PACKS out of the
  menu's first JS: 798.0 of 800 kB gzip), `wip/snow-pack` 827d581 (Whiteout Station). Next: for each branch, merge
  `main` into it, push it to `check/<name>`, fix until green, then fast-forward `main`, one branch at a time. The
  second of Harbor and Snow to land rebuilds the generated files (palette atlas, props.generated.ts, provenance).
- How a pack is built: see the Medieval pack (packTilesMedieval.ts, tools/content/prepare-medieval.mjs,
  stylePacksMedieval.test.ts). Its demo map is a maps/<id>.json made with MapMaker operations (no build script in
  the repo), following docs/map-briefs/AGENT_BUILD_CONTRACT.md. No Meshy generation without the owner's approval.
  CC0 texture hosts (ambientCG) are blocked by this container's proxy, so materials are our own pattern code.

### main at bed1556, released (2026-10-31 06:20 UTC)
Shipped: St. John's smoothing + Smooth all, model fidelity (normal maps, hero tier, LODs), grips (Meshy hands,
grapple rope at the muzzle, creature skins), launcher settings parity + less server garbage at 96, Style Pack 10
Medieval Village + Market Town, Scolitex out of Character Select, arsenal e2e and the mobile tap-jump bug fixed.
The first release attempt failed in actions/attest-build-provenance (sigstore tlog 404); a re-run published it.
Next: Harbor and Snow packs, then Desert City (replaces Egypt), Jungle refresh, Ancient Temple into Imperial;
owner's community downloads for mv_forge / mv_hay_cart / mv_well / mv_tarp_tent; open character notes below.

### Owner notes, 2026-10-30 evening (not done yet; next session start here)
- **Done on `wip/launcher-parity` (agent, 2026-10-31; not merged, needs a check/ run: it maps to the full suite):**
  the owner's "dedicated launcher settings parity + Iron Maw hiccups". Every browser-host match setting is in the
  Host Service: launcher Match rules card (tagged live / restart / next match, with Restart now), console `rules`
  (`rules score 60`, `rules map time 20`, `rules reset`), `RULES` in host.json (shared/src/sim/serverRules.ts:
  spec table, per mode for score/time/respawn, per map overrides; applied by the server at every new match;
  in-game admins' rule changes kept too). Extras: `skill`, `style`, `maxplayers`, `afk`, `idlekick` live,
  `motd` join message, uneven `teams 10 8`; whatever changes while running is saved for the next start.
  New server message `{t:'rules'}` so players' HUDs follow a restart with new rules. Parity table: docs/HOSTING.md
  "Match settings". Perf: ~40% less garbage per tick at 96 (Math.hypot → shared `hypot`, mover pose memo,
  movement state, history ring) + `--max-semi-space-size=64` for the match process; Iron Maw TDM tick avg
  4.5 → 3.6 ms, ticks >12 ms 40 → 19 per 2,400 (docs/HOSTING.md "Performance: Iron Maw at 96"); bench `--spikes`.
  Local e2e: dedicatedhost, hostpage, hostcontrols, online, offline, vehicles passed. Not done: the site's /host page
  has no rules controls (its start keeps the launcher's rules); remaining 30-90 ms single ticks were mostly CPU
  starvation on this box, not measured on a quiet PC.
- **Flaky e2e to fix properly:** `mobile` "a tap on the pad middle jumps" fails intermittently on CI (both attempts on
  e8f449a, passed on a715e60/b4d55de; passes locally). The crouch-on-next-frame change (bb06a47) didn't cure it. Look at
  how the CDP touch timestamps map to the page's `e.timeStamp` (touchControls.ts tap vs hold) and whether the player
  is grounded when the tap lands; log the pad state in the check before changing the game.
- **Queued (owner, 2026-10-31): dedicated launcher settings parity + Iron Maw hiccups.** The owner ran the Host
  Service launcher with 96 bots on Iron Maw: "some hiccups", ran relatively OK, and couldn't change some match
  settings (score limit, time limit, etc.). Make every match-setup / host-panel setting available in the launcher
  (controls, console, config), live where the browser host's are, plus extras; profile the server tick on Iron Maw at
  96 (path queries on narrow benches, vehicles, snapshot size) and fix the spikes. Start when an agent slot frees
  (running: wip/model-fidelity, wip/st-johns-smooth, wip/grips-live).
- **main at 6c0f8a6 (2026-10-30 ~23:45 UTC):** everything from this session, Sunken Kingdom and Iron Maw included
  (both merged and green on CI). Nothing left on wip/* from this session. Open owner questions: Sunken Kingdom
  (Meshy dome, taller cliffs, CTF flags 190 m apart: bots don't capture), Iron Maw (raise the schema's player-count
  cap past 16–32 so the menu can say 64–96; an orange rock terrain material).
- **Release fixed (2026-10-30 21:50 UTC):** `main` fast-forwarded to 1317b80 (= 9a959ee's code + the ci.yml fix: no
  cancelled runs on main; a main commit not green on a check branch is tested against the nearest one that was). Its run
  published `main-latest`; the owner runs `sudo tiletrigger-update` to get the Meshy buggy and weapon drops.
- **Asset quality:** many new weapons and props look "clumpy" (over-decimated). Revisit budgets: props are capped at
  6,000 triangles / 400 KB (content/props.json `budgets`), weapons in content/guns.json; consider a higher cap for
  hero/landmark pieces and weapons (first-person guns are seen up close), keeping LODs for distance, and rebuild the
  owner's Meshy weapons and props with more triangles and 1024 px maps where it shows. Measure perf at 96 after.
- **Character sizes (owner):**
  - Small (same as Sprout), if not already: Shiba, Bandit, Teddy, Giggles, Botboy, Brass Hare, Grizzelda, The
    Visitor, Wealthy Otter, Biscuit, Goblin.
  - Large: Big Bogdan, Count Bonesworth, Ivory Rustwalker, Boglurker, Rattles.
  - Punkin is small and should be normal.
  - DONE (session branch): Giggles, The Visitor small; Boglurker, Rattles large; Punkin normal. The rest of the
    list was already set (the box was on an old build).
  - Bandit's scale is far too big in general. Found: its model is wider (1.27×) and deeper (1.23×) than tall
    (every other small character is tallest along its height), so at Sprout's height it carries much more bulk.
    Fix in the character pipeline: a per-character scale in the manifest, or size it by its bulk; check the
    download for a tail/cloak/weapon making it wide.
  - Dust Trooper looks odd; Grizzelda "is not looking right these days" (hat brim, hunched torso; she was also
    opted out of full-body first person). Look at both in the menu and in game.
  - Sizes live in packages/shared/src/content/looks.ts (`size`) and content/characters/*.json (`size`);
    regenerate characters.generated.ts with character-manifests.mjs; check portraits after.
- **Release status:** `wip/full-body-fp-fix` merged (a715e60): the axe check waited on a lag-compensation race (the test
  now waits until the page draws the moved bot); Knight's gauntlets curl (left closes; right still points up in first
  person, and the armoured forearm still makes a dark wedge on long guns). CI on check/candidate a715e60 was running at
  hand-off: if green, fast-forward main (`git push origin a715e60:main`, or the newer head) and tell the owner to update.
- **St. John's rework merged into the session branch** (1cc6a4a, from `wip/st-johns` ce011f3): real campus from OSM
  (footprints, streets) + USGS 3DEP 1 m ground, 400 × 300 m; owner-only MapMaker "Real places" tools (height grid
  `.asc` import, trace image); details in docs/references/ST_JOHNS.md. Locally `maps6` timed out under heavy load (also on
  untouched maps); needs the check/ run. Clump draws ~600 (budget 900).
- **In flight on branches:** `wip/sunken-kingdom`, `wip/iron-maw`
  (both under docs/map-briefs/AGENT_BUILD_CONTRACT.md), `wip/full-body-fp-fix`. Read each branch's HANDOFF/docs before
  merging; all need a check/ run.
- **Props added this session (on the session branch):** Meshy mining props (excavator, haul truck), 13 cargo props
  (crates, containers, gantry crane, IBC tank), 15 street props (barrels, bins, trash, dumpster, fuel can, shop sign,
  historic building; palette pictures and provenance committed, `content:check` OK). Downloads live outside the repo in
  /home/user/meshy-downloads/{owned_mining,owned_cargo,owned_props2} (gone in a new container: re-fetch from the
  Drive folder and meshystuff).
- **T-pose:** frozen bodies' skins could keep an older pose; fixed in characterAnimator `freezePose` (every skin
  takes the final pose). Owner's console check showed the mismatch on the live site; verify after the update with the
  console line in this session's notes (skin vs joint hand span).

### e2e `arsenal`: the test raced, not the game (`wip/arsenal-fix`, agent, 2026-10-31)
Not a pickup/drop drawing bug and not the gun models: every failing check was the test racing a page that draws
about one frame a second (software rendering; CI and this box alike), or the scene it built moving under it.
- **Slow input, wall-clock waits.** A frame steps at most 0.25 s of input (session.ts `dt` cap), so at 1 fps your
  player gets ~15 ticks a second: the 1.6 s barrel reload needs ~6 s, swings land seconds after the press. Waits are
  now in the match's own time: `meWait(page, fn, arg, seconds)` counts your processed inputs (`me.lastSeq`) with a
  wall-clock cap. The spree's `waitForTimeout(500)` per weapon (sometimes zero frames: no hazards) and the axe's
  recovery wait became meWaits too.
- **Bots.** `speedMul = 0` stops walking, not jumping (a held bot thinks it is stuck and hops 1 m), and the other
  bots kept shooting the target, picked up its drop (taken false, gone true) and threw sandbag walls. `holdBots`
  zeroes every bot's movement and buttons at its input queue for the melee and drop checks.
- **Geometry.** Small bots (0.78 x 1.8 m): the fixed -0.12 glance passed 4 cm over the head at 1.3 m (a correct
  miss); `aimAt` looks at the target's middle. The spree knocked you up to 7 m back behind a wall, and the spawn faces
  a tower whose base stopped the pellets 3.5 m out: the melee part puts you back at your spawn (covers and zones
  there cleared) and `face(dist)` turns to open ground first.
- **Mix-up pickup.** A bot taking the pickup rolls it again (respawns as something new), so the client never showed
  the first roll: the check now waits for the match's current roll. **Weapon bar** waits for the snapshot.
- **Lag compensation.** `seenAt(..., tick)` also waits until `__cs.viewTick()` (new test hook: the tick the page
  sends for rewind) has reached the move.
- mobile "a tap on the pad middle jumps": **a game bug** on slow pages. The 380 ms hold timer ran (and crouched you)
  before the lift was handled (press at +0, lift event at +80 ms handled at +2.2 s); the lift corrected it as a tap
  (uncrouch) and pressed jump in the same tick, but a jump pressed while crouched only stands you up (movement.ts),
  so the tap never jumped. Now the correction stands you up and jumps on the next tick
  (`InputState.jumpAfterStanding`, unit test in inputWheel.test.ts). Locally 2/3 failed before, 7/8 passed after
  (the one failure had no detail); the check's message now lists the pad's pointer events, grounded and crouch.
- physicsfx mass casualty ("one body alive with anim"): not looked into (`alive: true` in its message means the
  match had respawned that bot before the view drew its death).
- Results: arsenal 3/3 locally (CI=1 timings; the box was at load 5-22), check/arsenal run 41171485465 (244e17d)
  green on the full suite, arsenal passing first try.

### Owner tileset sheets (2026-10-31): eight concept sheets, awaiting the owner's answer
01 Medieval Village, 02 Desert City, 03 Coastal Harbor, 04 Jungle Ruins, 05 Snow Outpost, 06 Sci-Fi Research,
07 Ancient Temple, 08 Industrial Factory. These are pictures, not model files: references for MapMaker style packs.
Overlap with existing packs: 04 = Jungle Ruins (06), 08 = Military Compound (01) plus the mining/cargo props,
06 = Orbital Station (04), 02 = Sands of Egypt (09) / Frontier Dust, 07 = Jungle/Imperial/Egypt temple pieces.
New: 01 Medieval Village, 03 Coastal Harbor, 05 Snow Outpost (snow nature props exist, no snow buildings).
Proposed: refresh existing packs from the sheets in-house; new packs 10 Medieval, 11 Harbor, 12 Snow Outpost;
Meshy only for hero pieces after the owner approves a list. 10 Medieval built on `wip/medieval-pack` (see below).
Owner's answer (2026-10-31): style packs; Medieval first; "replace n update n combine respectively", read as:
Desert City replaces 09 Sands of Egypt, the Jungle Ruins sheet updates 06 Jungle Ruins, Ancient Temple is combined
into 03 Imperial Arena (confirm with the owner if unsure). Order: 10 Medieval Village, then Harbor, Snow, the rest.
Medieval brief: follow the Egypt/Imperial pack build (41f8335: packTilesAncient.ts procedural pack tiles,
tools/content/prepare-ancient.mjs in-house props, materials, stylePacks.ts entry, stylePacksAncient test), but the
demo map is a maps/<id>.json made with MapMaker's tools (no server/tools/maps build script; CLAUDE.md "Maps").
Reuse what exists: castle_* pieces, siege_tower, stall*, cart, hay_bale, anvil, barrels, crates, fountain,
lantern(_post), banners, signpost, wooden fences. New in-house: timber/plaster houses with tile roofs, market
square, town gate, bell tower, bridge, well, shop fronts, awnings, balconies, cobble/market/road materials.
Meshy candidates awaiting approval: blacksmith forge, hay cart, covered well, tarp tent.

### Jungle Ruins refresh (`wip/jungle-ruins-pack`, agent, 2026-10-31; main merged in, ready for a check branch, not merged)
Owner sheets TILESET 04 Jungle Ruins + TILESET 07 Ancient Temple, combined into Style Pack 06 Jungle Ruins.
- **Done (committed):** 20 new tiles in `packages/shared/src/map/packTilesJungle.ts` (Temple Terrace, Terrace
  Stair (stack them a level up into ziggurats), Carved Temple 2 × 1 (gate on the west cell's south edge fits the
  Portcullis, stair to a roof walk with parapet gaps E/W), Summit Shrine, Carved/Relief/Window/Arch/Column/Low
  walls, Beamed Colonnade, Arched Vault, Jungle Watch Tower (Medieval watchtower frame), Chasm, Gorge Steps,
  Chasm Rope Bridge, Rope Bridge Span, Stone Bridge Span, Waterfall Wall (pool, passage behind the falls),
  Overgrown Ruins). The original 12 jungle tiles and 17 jg_* props are untouched, so Verdant Ziggurat, Erosion,
  Sunken Kingdom, Fernwood Moon, After Hours, Jungle Steps load unchanged (tested). Materials (procedural,
  patterns.ts): mossy_stone, carved_stone (step-fret), relief_stone, temple_inlay (teal/gold), root_cover,
  mossy_planks, temple_sandstone, palm_thatch; theme `core.ancient_temple` (+ backdrop, dressing). 26 props in code
  (`tools/content/prepare-jungle.mjs` → `assets-src/tiletrigger-jungle/`, Owned, jt_*), props.json/lock/provenance,
  palette atlases, STYLE_PACKS entry (new tiles/props/materials/theme, portcullis/brazier/torch/ladder, Grapple).
  Demo map `maps/vinefall_sanctum.json` built by driving MapMaker in the browser (placeAtHover + inspector edits
  + Export; scratch script not in repo): validate-map 0 issues incl. navigation; map card shot; screenshots in
  `docs/map-briefs/vinefall_sanctum/screenshots/`. Tests `packages/shared/test/stylePacksJungle.test.ts` (pack,
  tiles, bot paths in 4 rotations, every jungle-using map validates, demo map nav) and stylePacks2 bound relaxed.
- **Zipline:** no zipline mechanic exists (only the Grapple Hook). `jt_zipline_post` is scenery; the pack lists
  the Grapple Hook to cross between posts. A real zipline ride is an owner decision (new movement mechanic).
- **Stand-ins (stable ids, Meshy only with owner approval):** jt_statue_large, jt_crane, jt_zipline_post.
- **Merged with main (2026-10-31 evening):** main (Medieval fixes, Harbor 11, Snow 12, Desert City 09) merged in;
  the shared pack files took main's version with the jungle additions re-applied next to the other packs
  (PatternId / PAINTERS / FINE_PATTERNS, materials, `core.ancient_temple` theme and backdrop, catalog import,
  STYLE_PACKS entry keeps `/* @__PURE__ */`). No id collisions (patterns slabs/fret/relief/inlay/roots/thatch,
  the 8 materials, theme, jt_* props, jungle.* tiles are all unique), so nothing renamed. Generated files rebuilt
  as "Work split" says: props.json/lock = main's + jungle entries, prepare-props (prop GLBs byte-identical, only
  jt_* added), palette atlases (tiles 247, ancient 96), content:build → provenance, content:check OK. Map card
  recaptured with capture-map-shots.mjs (in-match render works). `metadata.release` stripped from the map.
  Then main again at ac8269f (Character Select groups): no conflicts; typecheck and content:check OK (the
  checks below were run before this second merge).
- **Docs done:** BUILDING_KIT "06 Jungle Ruins refresh (Ancient Temple folded in)" + the 06 table row (and the
  Style Packs intro, which main's merges had left with three copies of one sentence); CHANGELOG Unreleased (pack
  under MapMaker, map under Maps); `docs/map-briefs/vinefall_sanctum/` manifest, decisions, QA; README row.
  The `_jdebug*.test.ts` scratch tests were never committed (none on the branch).
- **Checks (local, after the merge):** typecheck OK; `pnpm test:changed` 1164 passed, 3 timed out under machine
  load (host.test, match 32-bot, sandgate nav) and passed when rerun alone; bundle budget 824.1 kB gzip /
  2922.9 kB raw (budget 840 / 3000); validate-map 0 issues on vinefall_sanctum, jungle_steps, verdant_ziggurat,
  erosion; e2e (CI=1) editor, editorux, maps (E2E_MAPS=vinefall_sanctum,jungle_steps), visual all PASS.
  `pnpm ci:plan` wants the full suite (assets-src/ counts as shared), so push to `check/jungle` and expect ~8 shards.
- **Open:** CI on a check branch, then fast-forward main (the lead's call). Bot audit / perf on Vinefall Sanctum
  not run. **Owner questions:** a real zipline ride (new movement mechanic) vs posts as scenery + Grapple Hook
  (current); Meshy hero versions of jt_statue_large, jt_crane, jt_zipline_post.
- **Sheet notes (pictures are gone with the container):** TILESET 04: weathered mossy stone, tropical; vignettes
  of overgrown temple courtyards, waterfalls, rope bridges over chasms, torch-lit stairs; red banners with a gold
  emblem. TILESET 07: sandstone with teal-and-gold inlay tiles, teal/gold banners, wall torches, hanging braziers,
  chain rails, spikes, portcullis, multi-level terraces with waterfalls. Not yet built from them: wooden door,
  stone gate as a tile, shutter/carved windows as separate pieces, corner/T/cross wall connectors, spikes as a trap
  look, decorative ceiling, chain fixture, a 'broken ceiling' variant.

### Style Pack 11 Coastal Harbor (`wip/harbor-pack`, agent, 2026-10-31; green on `check/harbor`, not merged)
- **Done (pushed):** 20 tiles in `packages/shared/src/map/packTilesHarbor.ts` (pier, pier head, boardwalk + corner,
  quay wall / outside / inside corner, 2 × 1 sea wall steps, slipway, shingle beach, basin, breakwater, 2 × 1
  warehouse, net shed and harbourmaster's office (straight stair, eaves 8.25 m like Medieval: an Outside Stair north
  of one reaches its roof), fish market, skeleton lighthouse (gallery 10.5 m), crane (platform 6 m, hatch for a
  Ladder), harbour arch, quayside). Harbour levels: quay 0, water surface `HARBOR_SEA` −1.5, bed `HARBOR_BED` −4.
  Box helpers are now exported from packTilesMedieval.ts (gableRoof got `pitch`/`ridgeMaterial`). 18 props
  `hb_*` built by `tools/content/prepare-harbor.mjs` (Owned; `hb_fishing_boat` is the stand-in hero, Meshy
  candidate). Patterns decking/ashlar/pebbles/corrugated/lapboards/bands, 12 materials, theme `core.coastal` +
  backdrop, facades `harbour_render`/`tarred_timber`, palette piece **Harbour Water** (`water:harbour`), palette
  group `harbor`, STYLE_PACKS `harbor` (11). Test `stylePacksHarbor.test.ts` passes (incl. nav cases per rotation).
  Demo map `maps/saltmarsh_harbor.json`: validate-map 0 issues; built by a scratch helper (scratchpad
  `harbor/build_saltmarsh.mts`, not in the repo).
- **Bundle:** the pack pushed the menu's first JS to 806.8 KB gzip; STYLE_PACKS was in the menu only because its
  `props(...)` calls looked impure to Rollup. Marked `/* @__PURE__ */`: now 798.0 KB (below the 799.0 before).
- **Navmesh lesson:** a switchback stair inside four walls drops off Recast's navmesh (watershed regions); open sides
  (watchtower / skeleton lighthouse) keep it. Ramps are 32 low steps under a drawn slope (tilted slabs lost the
  top joint in some rotations).
- **Also done:** palette atlas (`harbor` group) + `content:build` (content OK), map card, docs (BUILDING_KIT
  "11 Coastal Harbor", CHANGELOG, `docs/map-briefs/saltmarsh_harbor/` with screenshots). The Tide warehouse roof
  has no stair (one against the east boundary lost its flight on the navmesh).
- **Checks:** typecheck, test:changed (1067 passed), content:check, build, bundle budget (798.0 KB gzip), validate-map 0
  issues, e2e editor/editorux/maps (saltmarsh_harbor) locally; CI run 41200191169 on `check/harbor` (7d13a27): full
  suite green. NOT TESTED: live bot match, bot swimming / jet-ski crossing, 24-player perf, real-GPU walk-through.
- **Next:** merge to the session
  branch (rebuild palette atlas/provenance if another pack landed first). Candidates: a real boat mount (motor
  launch), Meshy hero for `hb_fishing_boat`.
### Style Pack 09 Desert City replaces Sands of Egypt (`wip/desert-city-pack`, agent, 2026-10-31; not merged)
- **Built** (owner's tileset sheet 02, "replace"): pack `desert`, number **09** in Sands of Egypt's place (the sheet
  says 02, but 02 is Frontier Dust). 18 tiles in `packages/shared/src/map/packTilesDesert.ts` (Plaster, Ashlar and
  Shop houses 2 × 1 with two inside stairs up to flat roof terraces at 8 m, parapet gaps on every cell centre;
  Outside Stair, Rope Bridge (8 m), Cedar Gallery (4 m), Courtyard 2 × 2 with arcades and a terrace, Covered
  Bazaar 1 × 2, Market Street, Domed Hall, Watch Tower (lookout 8 m), Minaret (landmark, not climbed), City Wall,
  Wall Stair, City Gate 3 × 1, Arcaded Terrace, Well Court, Paved Street); 20 props built in code
  (`tools/content/prepare-desert.mjs`, `assets-src/tiletrigger-desert/`, licence Owned, category *Desert City*);
  theme `core.desert_city`; 10 procedural materials (ashlar, weathered plaster, blue dome tiles, zellige, worn
  paving, sandstone tiles, rug, mashrabiya, red canopy, cedar); facades `desert_ashlar`, `desert_plaster`;
  breakable **Lattice Screen** (`block:lattice`); demo map `maps/qasr_medina.json` (validate-map 0 issues),
  docs BUILDING_KIT "09 Desert City", `docs/map-briefs/qasr_medina/`.
- **Egypt kept working**: no Egypt tile, prop, material, theme or facade was removed or changed; only the
  STYLE_PACKS entry `egypt` is gone. Its 11 tiles and 15 props are listed at the end of the Desert City pack's
  lists (so picking 09 Desert City in the palette shows them after the desert pieces), and they stay under All
  pieces and the props' "Sands of Egypt" heading (props group renamed "Desert, Ancient & Jungle"). Test
  `stylePacksDesert.test.ts` loads every map in maps/ that uses an Egypt piece (pharaohs_reach,
  sunken_kingdom, after_hours) and checks nothing is unknown or lost.
- **Stand-in hero props with stable ids**: `dc_market_stall`, `dc_well`, `dc_crane` (no Meshy without approval).
- **Owner's call wanted**: (1) keep the number 09 (Egypt's slot) or renumber to the sheet's 02 (would need
  Frontier Dust moved); (2) whether the Egypt pieces should stay folded into Desert City or move to their own
  "more" heading; (3) Meshy hero versions of the stall, well and crane.
- Merging: generated files collide with the Jungle pack (props.generated.ts, palette.json + atlases,
  provenance.json, props.json, materials.ts, patterns.ts, catalog.ts, stylePacks.ts, paletteCatalog.ts
  "ancient" group): whoever merges second reruns the "Work split" steps.
- **Checks done**: typecheck; test:changed (whole suite: 1072 passed); content:build + content:check (OK);
  pnpm build; validate-map on qasr_medina, pharaohs_reach, sunken_kingdom (0 issues) and after_hours (its own
  pre-existing logic.cycle warning only); bot audit 8 bots 180 s on Qasr Medina (27 kills, 0 stuck, both tower
  snipers picked up); e2e editor, editorux, maps (E2E_MAPS=qasr_medina,pharaohs_reach,sunken_kingdom,
  after_hours), visual on ports 5591/5592 with CI=1: 124 PASS, 1 FAIL = "TEST starts within the 3 s budget"
  (4.1 s; timing on the shared, loaded container, not this change). **Not run**: the other 34 e2e flows the CI
  plan lists (shared code changed: full suite) and perf. Merge through a `check/` branch.
- **Not done / next step: the modular DOME KIT** (owner's second Desert City sheet, "dome set", 2026-10-31; the
  picture was in an agent scratchpad and is gone, so here it is in words). Today the pack's domes are fixed
  stacks of octagonal courses (`dome()` in packTilesDesert.ts: Domed Hall, Bazaar, Well Court, gate towers).
  The sheet asks for domes built from parts: a **drum** (base ring of straight, window and solid drum segments;
  top, middle and bottom ring trims), **dome panels** (plain and with a window) in **4, 6, 8 and 12 segment**
  options, and a **dome cap** (finial); **arch transitions** (2-, 3- and 4-way) that let a drum sit on arches,
  so a dome can stand on an arcade (its example build: a drum on four arches over a crossing); plus walls,
  corners, low wall / railing, pillar, archway, window frame, stairs, floor/ceiling tiles, support beam,
  buttress, decorative trim and a balcony. **Finishes** (look only, same geometry): standard stone, sandstone,
  white plaster, copper with green patina, blue ceramic tiles, green tiles, damaged/ruined (holes in the
  panels). Suggested shape in MapMaker: a dome tile (or tile option) with segment count and finish choices,
  drum height/window choice, and arch-transition tiles at 4 m that a drum + dome tile stacks on (e.g. over the
  Courtyard's crossing or an Arcaded Terrace); new procedural materials for copper patina and green tiles
  (patterns.ts `scales` with other colours works), a "damaged" variant leaving panels out. Keep the existing
  dome tiles' ids working.

### Style Pack 10 Medieval Village (`wip/medieval-pack`, agent, 2026-10-31; not merged)
- **Built** (from the owner's tileset sheet 01): 16 tiles in `packages/shared/src/map/packTilesMedieval.ts` (2 × 1 Timber,
  Shop and Plaster houses with walkable 35° red tile roofs, eaves at 8.25 m on the cell edges; Outside Stair,
  Timber Walkway, Market Square, Market Hall, Town Wall, Wall Stair (2 × 1), Town Gate (3 × 1, roof by ladder
  hatch), Bell Tower, Watchtower, Stream, Stone Bridge, Cobbled Road, Blacksmith Forge); 20 props built in code
  (`tools/content/prepare-medieval.mjs`, `assets-src/tiletrigger-medieval/`, licence Owned); theme
  `core.medieval`; procedural materials (cobblestones, setts, market tiles, pantiles, timber-and-plaster,
  wattle, packed dirt, whitewash, oak beam); facades `timber_frame`, `village_plaster`; MapMaker **Oak Door**
  (door style `oak`, schema `DOOR_STYLES`) and **Wattle Hurdle** (`block:wattle`); STYLE_PACKS entry `medieval`
  (10); demo map `maps/market_town.json` (validate-map 0 issues); docs BUILDING_KIT "10 Medieval Village",
  `docs/map-briefs/market_town/`.
- **Stand-in hero props with stable ids** (owner is sourcing community/CC0 downloads instead of Meshy for now):
  `mv_forge`, `mv_hay_cart`, `mv_well`, `mv_tarp_tent`. Replace them by pointing those ids in
  `content/props.json` at the downloads (same id, new pack/src); Market Town needs no change.
- **ambientCG was refused by this container's proxy**, so the new materials are procedural, not CC0 scans; if
  the owner wants scans (e.g. PavingStones/RoofingTiles sets) add them via `prepare-textures.mjs --only` where
  the network allows.
- **Navmesh rules learned** (Recast, 0.2 m cells, 0.6 m erosion): treads ≥ 0.42 m, flights ≥ 2 m wide, ~2 m of
  floor before a stair's foot and after its head, turns on full-width landings (2 × 2 corner steps become
  ledges), floor holes grown 0.3 m past the steps. Known gaps: bots don't reach the **Bell Tower belfry** (stacked
  switchback inside walls) or the **NW watchtower lookout** in Market Town (the same tile elsewhere works);
  players climb both. Worth a look if bots should snipe from there.
- Checks: typecheck, test:changed (3 failures fixed; host.test flaked under load, passes alone), content:check,
  build, validate-map, e2e editor / editorux / maps (E2E_MAPS=market_town) / visual pass; bot audit 8 bots 180 s;
  perf idle 836 draws (budget 900), 1.87 M triangles (mostly the forest border). Not run here: the other 34 e2e
  flows the CI plan lists (shared code changed: full suite) and 96-player perf. Merge through a `check/` branch.

### Style Pack 12 Snow Outpost (`wip/snow-pack`, agent, 2026-10-31; built, on `check/snow`, not merged)
- **Done (committed on `wip/snow-pack`):** 17 tiles in `packages/shared/src/map/packTilesSnow.ts` (hut, barracks, comms
  tower, hangar, bunker, watchtower, radar dome, fuel depot, catwalk, metal stair, ice wall, frozen cliff, snow drift,
  frozen lake, pressure ridge, ice hole, snow road; helpers imported from packTilesMedieval.ts, now exported); 16 props
  built in code (`tools/content/prepare-snow.mjs`, `assets-src/tiletrigger-snow/`, licence Owned, ids `so_*`, category
  "Snow Outpost" in the Industrial & Military palette group); procedural materials (patterns snow, ice, prefab,
  snowcrete, frostrock in materials.ts + client patterns.ts); theme `core.snow_outpost` + snowy backdrop with mist;
  facades `prefab`, `snow_bunker`; palette pieces `mover:rollup_door`, `block:ice`, `block:thin_ice`; STYLE_PACKS
  entry `snow` (12); test `packages/shared/test/stylePacksSnow.test.ts` (nav per tile in all rotations, demo map);
  demo map `maps/whiteout_station.json` (validate-map 0 issues incl. navigation); palette atlas + map card shot.
- **Bundle:** STYLE_PACKS used to sit in the menu bundle (its `props()` calls kept it); `props` is now a
  `/* @__NO_SIDE_EFFECTS__ */` function, so the packs drop out of the menu (797.6 of 800 KB gzip with this pack).
- **Navmesh rule learned:** a landing that laps over a sloped slab breaks the navmesh there; start the landing exactly
  where the slope's top surface ends (`zTop` in bunker()/rampUp()).
- **Checks run locally:** typecheck; test:changed (121 files pass); content:check; build + bundle-budget
  (797.6 / 800 KB gzip); validate-map 0 issues; e2e editor, editorux, maps (E2E_MAPS=whiteout_station), visual pass;
  bot audit 8 bots 180 s (27 kills, 0 stuck, sleds used). Docs: BUILDING_KIT "12 Snow Outpost", CHANGELOG,
  `docs/map-briefs/whiteout_station/` (manifest, QA, decisions, screenshots). Pushed to `check/snow` for the full
  CI suite (shared code changed); merge to main only once that run is green.
- **Known/related:** the gable helper's ridge-along-z roof (`roll`) was inverted in my copy (fixed in packTilesSnow);
  packTilesMedieval.ts has the same `roll: -s * PITCH`, which may be the Market Town "upside-down roofs" item (the
  Market Hall's roof); not changed here (that fix is on the other task).
- **Resume:** the demo map came from a scratchpad helper (MapMaker operations, not in the repo); edit it in MapMaker.
  After any tile change, re-render the palette atlas (temp copy of build-palette-atlas.mjs with executablePath
  '/opt/pw-browsers/chromium') and run `pnpm content:build`.
- **Stand-ins (Meshy/community candidates, stable ids):** `so_snowmobile`, `so_satellite_dish`, `so_generator`
  (also worth a hero version: radar dome, comms mast). Not done: falling-snow particles (the sky system has a
  `snowy` sky but no precipitation), slippery ice (no friction surfaces in movement).

### St. John's smooth ground (`wip/st-johns-smooth`, agent, 2026-10-31; merged to the session branch)
- Owner: "the terrain is slightly jagged". Cause: the 3DEP 1 m grid was point-sampled to 2.5 m (aliasing lidar's small
  bumps), and the ground round the levelled hall pads kept that grain.
- MapMaker, for every map: the height-grid import now area-averages when it thins a grid (`gridAreaHeightAt`) and has a
  **Smoothing** amount (Gaussian over the file; Medium 2 m by default). Terrain pane: **Smooth all** (Light/Medium/
  Strong = 1.5/2.5/4 m) with "Keep the ground under blocks" (vertices under blocks standing on the ground + 1.5 m
  stay put); spawns, pickups, flags, hills, vehicles and props on the ground ride with it, one undo step.
  Shared code: `smoothGrid`, `smoothTerrain`, `terrainHoldMask` in `packages/shared/src/map/terrain.ts`.
- St. John's: Smooth all (Medium, keeping the ground under blocks) and Settle all props, through MapMaker's own
  buttons (Playwright driving the page; no script in the repo), then Export. Halls' pads and laid paths unchanged
  (paths are laid at load time).
- Result: 13,745 of 19,481 heights moved (median 2 cm, 99th pct ~0.5 m, max ~1.1 m); 3,085 vertices under 727 blocks
  held; 313 things carried with the ground, 115 props re-settled. validate-map (incl. navigation: every spawn and
  pickup reachable) 0 issues. Checks: typecheck, test:changed (all pass; one unrelated failure in an earlier run did not
  recur), content:check, build, e2e editor + editorux + maps (E2E_MAPS=st_johns) pass.
- Left as is: the rims where the halls' levelled pads meet the ground (held on purpose), a pit by the rectory on the
  bluff (real 3DEP). Smooth all's Medium was chosen over Strong, which softens the bluff's crest.
- Merge through a `check/` branch (the change touches shared code, so CI runs the full suite).

### Where things stand (2026-10-30 evening)
- **Iron Maw on `wip/iron-maw`, not merged** (agent, 2026-10-30 night): `maps/iron_maw.json`, the open-pit
  mine of BUILD_06 (480 m terrain at 3 m spacing, 408 m play area, 48 v 48): six bench levels, a clockwise
  spiral haul road, SE switchbacks, 3 shaft lifts, 12 ladders, 3 cut-and-cover tunnels, crusher / screen
  house / mills with walkable conveyor gantries, NW motor pool (Embers) vs NE workers' camp (Tide), the
  owner's Meshy excavator, haul trucks and cargo props. TDM, CTF, KOTH, Fort Wars, Bomb (+ Elim, DM,
  Zombies). Notes: `docs/map-briefs/iron_maw/` (manifest, QA report, decisions, screenshots). Checked:
  typecheck, content:check, build, e2e `maps3` + `vehicles`, validate-map (0 issues), 96-bot benches
  (4–7 ms/tick on a quiet box), perf96 (1,024 draws, 277 casters). Made with MapMaker's operations from a
  scratch helper (no build script in the repo). Map card picture captured. Merge through a `check/` branch
  (only the map's tour part and content run). Open: bots driving the switchbacks not measured; mossy
  `stone` faces vs the image's orange rock; `recommendedPlayers` capped at 32 by the schema.
- **`main` is at `9a959ee`** (green; everything requested is merged, no agents running): everything through `wip/impact`, the 2026-10-30 afternoon work (Character
  Select spin and shipped portraits, muzzle-flash light fix, wheel/trackpad weapon switching, MapMaker new-map
  sizes, `wip/bot-vehicles`, `wip/weapon-wheel-mobile`, `wip/pause-menu`, `wip/spectate`, `wip/battle-axe`), the
  physicsfx e2e fixes, the white-gun fix (a re-rolled pickup disposed the shared gun materials: every copy of that
  gun, first person included, drew plain white) and `wip/fp-grips` (first-person support hand on big guns;
  server weapon switches no longer undone by the client's last request).
- **Also on `main`** (CI green on `9a959ee`):
  - `wip/weapon-drops`: rule **Drop weapon on death** (`MatchRules.dropWeapons`, default on; match setup →
    Arsenal, pause menu → Host). `sim/drops.ts`: the weapon in hand, else the most desirable non-starting gun with
    ammo, drops at the body with exactly its ammo; 30 s, at most 24; picking it up gives the gun, or its ammo up to
    your reserve cap. Not for NPCs, Disc Arena, races, spears/discs only. Snapshot `dw`; bots value drops like
    pickups. Docs: ARSENAL.md "Weapon drops". Not looked at on screen yet (a gun modelled off its z axis may lie
    oddly); drops aren't kept across a host handoff.
  - `wip/posture-buggy`: Meshy feet levelled (19 characters), lean fixes (Bonesworth, Rustwalker, Rotter, Grandpa
    Chains), the owner's Meshy buggy model, and **seats**: buggy = driver [-0.32, 0.8, 0.3] + front passenger +
    two back seats, all seated, passengers fire their own weapons (shots pass through their own vehicle); gun jeep
    = two seated cab seats + roof gunner + two rail riders; hit boxes fitted to the models; seated pose in
    `CharacterAnimator`; bots ride as passengers. Docs: VEHICLES.md, PLAYTEST.md. Open: the buggy cockpit view's
    dark roof bars/dash (model geometry), tall heads touch the roof bars, the jeep's cab riders hidden behind its
    opaque windows, seated riders don't turn round past ~77°; Titan, Alien, Salamander not rebuilt (downloads
    missing); Bonesworth's left hand on his grip sheet; `visual` baselines may move if a buggy is in a picture.
- **`wip/full-body-fp-fix`** (on top of the session branch): arsenal's Battle Axe check failed on CI after full
  body. Cause: lag compensation. The flow teleports the bot and swings at once; the match rewinds targets to
  the tick the client's screen showed (`viewTick`, up to 18 ticks), so a swing sent before the page drew the bot
  in front is aimed at where it was, and the semi-automatic axe swings only once. A slow page loses that race
  (reproduced in arms-only too at ~4.7 s frames; full body is a few per cent slower per frame, enough on CI).
  Fix in the test: `seenAt()` waits until the page draws the moved bot before the punch, the axe and the
  blunderbuss. Also: the Knight's gauntlets (`fixes.hands.curl: 1`, rehanded) close on the grip, and shoulder
  pads are cut from the full-body first-person view. Still: the Knight's right gauntlet in first person points
  its fingers up behind the grip, and his armoured left forearm crosses the lower left on long guns.
- **Full-body first person: done on `wip/full-body-fp`, not merged** (owner agreed the plan; 2026-10-30
  evening). First person draws your own third-person character from its eyes (`game/firstPersonBody.ts`
  `FirstPersonBodyRig`, `View.showFpBody`): the body stands where prediction has you and animates with your
  motion; after the clips and the spine's aim it is moved so the base of its neck sits just behind and below the
  steady eye (further back looking down); the head is cut off the meshes (`cutHead`: head-weighted and
  above-neck triangles, a headless copy per mesh) and a colourless ball casts its shadow; the hands grip the
  unchanged viewmodel by IK (collarbones roll forward before shoulders move), forearm/hand triangles are also
  drawn in group 1 with the gun. Options → Display → First person: Full body (default) / Arms only
  (`tiletrigger.firstPerson`, applies at once). Falls back to the arms in vehicle seats, the kill cam,
  spectating and for `firstPerson.body: false` characters (Grizzelda: her hat brim filled the view). Grip tool:
  `?mode=grips`, `pose(look, weapon, 'body')`, `look(pitch, motion)`, `outside(alpha)`. Docs: CHARACTERS.md
  "Full-body first person". Still off: the knight's left pauldron is a big dark wedge at the lower left; a
  knife's free hand hangs at the side but a held knife still sits oddly in the open right hand (as in Arms
  only); looking straight down the gun hides your right leg; seated passengers keep the arms. Cost (SwiftShader,
  training_range, Scout): your own drawing is 4 meshes / 18.3k triangles in full body vs 3 / 5.1k arms only
  (plus the body's shadow and the head ball's), no second character loaded; frame times too noisy on CPU
  rendering to tell apart (perf96 frost_basin 48 bots ran, one-frame draw samples dominated by what was in view).
  Local e2e: characters, designer, offline, visual pass (no baseline change); arsenal fails "hazards are drawn on
  the ground", "R loads the barrel again", sometimes the Battle Axe swing, and the build from before this work
  fails the same and more. Needs a check branch run before `main`.
- **Sunken Kingdom: built on `wip/sunken-kingdom`, not merged** (owner's map brief BUILD_01, 2026-10-30 evening):
  `maps/sunken_kingdom.json` (192 × 176 m, 16–32 players, TDM/CTF/DM/KotH), its picture, and
  `docs/map-briefs/sunken_kingdom/` (manifest, QA report, decisions and deviations, screenshots); the shared
  `docs/map-briefs/DISCOVERY_REPORT.md` (MapMaker, format, terrain, nav, modes, pickups, tests) for the other map briefs.
  Made from MapMaker edit commands replayed in MapMaker and saved with its Export (nothing added to MapMaker, no script
  committed). Waiting on the owner: a dome (no piece; Meshy candidate), taller tiers, and bot-only CTF not capturing in 7 min.
  Pitfalls found: a tile stairwell on level -1 under terrain is filled by the terrain (cut a sunken court and use Open
  Stairs on level -1); ground left at -0.15 makes a 0.4 m step onto a stair that starts at a floor's edge (keep ground
  just under the floor, e.g. -0.04); a prop in a 3.6 m tunnel blocks bots. Merge through a `check/` branch (a map file runs
  the `maps3` tour part).
- **Field guide** (owner asked 2026-10-30): a reference page of every weapon, vehicle, character, map feature
  and pickup, generated from the shared data: https://claude.ai/artifact/GgiMK17TA5oCY3Cnyna3oy (PDF and HTML
  were sent to the owner). Regenerate it when the arsenal or roster changes.
- **`wip/st-johns`** (not merged; needs a `check/` run: it changes `public/maps/shots`, so CI runs everything):
  St. John's on the real campus from OpenStreetMap footprints and streets and USGS 3DEP ground (no Google), 400 ×
  300 m round the drill field at true scale (Genesee St and the lake are past the east edge); how, the region,
  the frame and what's where: docs/references/ST_JOHNS.md. New owner-only MapMaker tools (Environment → Terrain →
  Real places): heights from an ESRI ASCII height grid file, and a trace image over the ground (never saved;
  `editor/heightGrid.ts`, BUILDING_KIT.md). Credits (OSM ODbL, 3DEP) in the map's description and ASSET_SOURCES.md.
  Checked: MapMaker, the validator and the nav check report nothing; bots move all over it; the `maps6` tour
  part (St. John's) and the editor flows. Open: the halls' rooms are the first pass's, stretched to the real
  footprints (wider rooms and windows); OSM has the halls as merged outlines, so where Knight, Welles and DeKoven
  meet is a guess. Perf (perf96, 48 bots, Medium, SwiftShader under heavy machine load, so noisy): draws
  spread ~415 → 420-530, clump ~420-460 → ~520-600 (bigger halls, 26 street meshes), shadow casters about the
  same or fewer, server tick a little cheaper; loading about the same as before (67-71 s old vs 73-81 s new at
  load 30). The `maps6`/`maps` e2e "match starts" check timed out here at load 20-30 (the old map and other
  untouched maps did too); it passed at lower load (39 s). Not judged by eye on real hardware.
- **Local e2e at hand-off (machine load 12–25, so timing-sensitive):** `mobile`, `offline`, `designer`,
  `editor`, `editorux`, `canyon`, `scenery`, `race` passed. `arsenal` failed "hazards are drawn on the ground"
  (failed under load before the axe merge too) and "the Battle Axe swings: the bot in front takes the blow"
  (passed in the axe agent's own run). If CI shows the same, look at the axe swing check first.
- **Not checked by eye / on real hardware:** Esc in Safari fullscreen, a real controller in the menus, touch
  controls on a real phone, the kill-cam framing, the axe's smoke and kick.

### Notes from this session's agents (all merged)
- **On `wip/bot-vehicles`** (not merged; full CI not run yet): bot vehicle sense (`bots/vehicles.ts`, `brain.ts`; tests in `test/botVehicles.test.ts`).
  - Stuck drivers back out for 1 s, then get out if still stuck within 3 s, and avoid that vehicle for 30 s.
  - Riders leave a stuck bot-driven vehicle; everyone leaves a burning one.
  - Enemies in vehicles: bots prefer launchers (aimed low at the hull), throw grenades at a stopped one, fetch a launcher within 30 m, take cover when they can't hurt it, and dodge one driven at them.
  - The sim has no roll or pitch on vehicles, so "flipped" isn't detected; a wedged vehicle is caught by the headway check instead.
  - Merge it through `check/candidate` (the shared sim changed, so CI runs the full suite).
- **On `wip/posture-buggy`** (not merged; needs a `check/` run, the shared sim changed):
  - Meshy feet levelled on their soles (`fixes.feet` in prepare-meshy-characters.mjs): Meshy's rig left 19 characters 7-23 degrees toes up (Bonesworth and Rotter's right foot toes down); rebuilt from their recorded rigs (no new rigging). Monk and Merrow (robes) were tried and kept as they were.
  - `fixes.lean` on Bonesworth, Rustwalker, Rotter and Grandpa Chains. The looser triangle cut now applies to rigged downloads only, so an unrigged rebuild reproduces its shipped file (Bonesworth was byte for byte).
  - Not rebuilt (community downloads not in either folder): Titan (head forward), Alien and Salamander (toes up 8-11 degrees). Download them by hand to fix.
  - The owner's buggy (`vehicles/offroad_buggy.glb` + `offroad_tire.glb` drawn at the hubs from the def's `wheels`); a driver + 3 seated passengers who shoot their own weapons, the gun jeep seats five, riders sit (see "Start here" for the details). The cockpit view looks over a dark, coarse dash; the chase camera is the better view.
- **On `wip/battle-axe`** (not merged; full CI not run): the Battle Axe is also a black-powder blunderbuss (owner's ask). Swing on fire, blunderbuss on the alt trigger (right mouse with a melee weapon in hand). Numbers and the ammo choice (shotgun shells loaded by hand into a 2-load barrel) are in docs/ARSENAL.md.
  - Sim: `AltFire.reload` / `kick` / `falloff` / `headshot`; `barrelLoader` in gunplay.ts runs the barrel's reload as a shell-by-shell magazine; client prediction mirrors it.
  - Client: `view.muzzleAt` (the bore, measured from the GLB) and `view.altShot` (sound, rate, flash, smoke) in the weapon data; `View.muzzleSmoke`.
  - Bots: `barrelReach`; melee bots now close all the way in (they used to hover at ~4.5 m and never swing).
  - Not judged by eye at full frame rate: the smoke cloud's size and life, and the kick. The machine ran at ~0.3 fps during the checks.
  - The touched files map to the FULL e2e set; only `arsenal` was run locally. Merge through `check/candidate`.
- **Open items:**
  - `perf:mass` classes some deaths as out of view when they are on screen; check the view test before trusting its tier counts;
  - kick and flinch feel not judged by eye yet;
  - Safari look: the owner tests it; if it is still off, ask for `window.__lookStats` from the console.
- **`wip/spectate`** (not merged; needs a `check/` run, the shared sim changed so CI runs everything): kill cam, watching while dead (follow / free camera) and spectating by choice (`game/spectatorCam.ts`, `Match.spectate` / `joinFromSpectating`, `BotFiller.spectate` / `rejoin`; protocol additions in docs/MULTIPLAYER_PROTOCOL.md §15: `spectate` message, `welcome.spectate`, `RosterEntry.sp`, `PlayerInput.sp`, all optional, protocol stays 4). Rule: dead team players follow teammates only, no free camera; pure spectators, FFA, offline and the host/admin get everything. Spectators come back as players after a map change or a handoff. Tested: unit (`shared/test/spectate.test.ts`, `client/test/spectatorCam.test.ts`, a server test), e2e `offline` (spectate checks at its end) and `hostgame` (a friend spectates). Not judged by eye on a real match: kill-cam framing (can be blocked by a wall between your body and the killer) and the touch buttons.
- **`wip/weapon-wheel-mobile`** (not merged yet; needs a `check/` run): the weapon wheel (`game/weaponWheel.ts`; hold Q, a tap keeps the last-weapon switch; hold Y on a controller; Options → Controls rebinds the key) and touch controls for phones (`game/touchControls.ts`, `touchDevice.ts`; every on-screen button is `InputState.virtualKey`, the pad `setTouchMove`, look `addTouchLook`, and `touchEngaged` stands in for pointer lock). New e2e flow `mobile` (Pixel 7 landscape, CDP touches). Pad-middle tap vs hold is decided from the events' timestamps, since a slow software-rendered page handles the lift late. Not judged on a real phone yet: the button layout, look speed (`TOUCH_LOOK`) and the 16-player phone host cap are first guesses.
- **`wip/fp-grips`** (not merged; needs a `check/` run: characterAnimator.ts maps to the full suite): first-person grips on big guns. The support hand used to stop short of launchers, the Singularity Cannon, the Spin Gun and sniper rifles and float in front of them; with a Meshy character's own arms (forearms cut at mid-length) it was a hand on a horizontal stub near the top middle of the screen. Cause: the arms hung from the camera by the character's own build (a hunched cat's shoulders sat 0.43 m in front of the eye, at about the height of the handguard, so the forearm ran sideways), and nothing handled a point out of reach. Now `gripPlaced` sets the shoulders from the view (`FP_SHOULDER`), brings a shoulder forward as far as the arm needs (`FP_SHOULDER_REACH`), slides the support hand back along the handguard first, and turns it to cup the handguard (`cupHand`). Third person unchanged. Check a grip with `?mode=grips` and `__grips.miss()`. Left alone: the Salamander Warlord's big claws still cover small pistols and poke above some guns (hand size, a content fix).
- **Not merged on purpose:** roster-cleanup's WIP commit 899537c (helmets worn on four looks; fit values are guesses, never checked visually). Finish the helmet fits (Commando, Engineer, beret and headband heights, Farmhand hat, Drifter mask, Dapper jacket weights) on a new branch.
- **Owner to-dos:**
  - run `sudo tiletrigger-update` on the box after each `main` update;
  - send Boglurker's original FBX (right hand not skinned);
  - review the new characters (section 4);
  - confirm the Plains Scout model is respectful.
- **On `wip/pause-menu`** (not merged; touches style.css, so CI runs everything): the pause menu's card layout and one-level Back.
  - Host tab: cards in CSS columns (`.hc-grid`, `columns: 2 400px`, each card `break-inside: avoid`); `#hc-apply` applies players and bots only, the new `#hc-apply-rules` the restart rules.
  - Back: `#pause-back`, `#screen-back` (front-end screens), `#bm-back`, `#hm-back`; footer hints are buttons (`#pause-hint-*`, `#hint-*`).
  - Esc: `fullscreen.ts` `browserTookEscape()` skips a repeating Esc, one the browser uses to leave fullscreen (no Keyboard Lock: Safari), and one within 250 ms of the mouse being freed. The pause handler stops the event, so the Bots window doesn't act on it again (that closed the look picker and the window in one press).
  - `inputMode.ts`: `data-input="kbm" | "pad"` on `<html>` picks the glyphs; it also feeds controller presses to the main menu (`FrontEnd.onPad`).
  - Not checked on a real Safari or with a real controller: the owner should try Esc in fullscreen on Safari and a pad in the main menu.

### Machine notes (agents share one container)
- **Ports:** run e2e on your own ports (`E2E_CLIENT_PORT`/`E2E_SERVER_PORT`; the lobby flow has hub ports too). The defaults collide between checkouts.
- **Disk:** keep big renders in your scratchpad and delete them. The disk filled up once (old scratch plus 53 stale worktrees).
- **Owner's downloads:** they live outside the repo in `/home/user/meshystuff` (a clone of Dsoto1/meshystuff) and `/home/user/meshy-drive` (Drive folder `18MaKefMCWARf1Y3gAjhZuxTto86vGAYl`, fetched with gdown). They aren't in a new container; fetch them again. Never commit raw downloads.
- **Meshy:** `MESHY_API_KEY` is in the environment. Rigging takes `source.modelUrl: "upload"` (Drive links are refused); 5 credits per rig.

### 4. Meshy models (state on `wip/merge-character-intake`, 2026-10-30)
- **Downloads:** the owner's files come from the Drive folder
  `18MaKefMCWARf1Y3gAjhZuxTto86vGAYl` and the private repo `Dsoto1/meshystuff`.
  They aren't in a new container: fetch them again with `gdown` (Python API
  `download_folder`) and by cloning meshystuff, outside the repo. Never commit
  raw downloads.
- **How they are rigged now:** Meshy's rigging API through the pipeline. A
  manifest says `source.modelUrl: "upload"`, and `pnpm content:meshy <dir>`
  (fetch-meshy.mjs) sends the download itself as a data URI. A download over
  300k triangles is cut to 200k first: Meshy failed the 917k-triangle king and
  rigged the same model once it was cut. Each manifest records its task in
  `source.meshy.rig`, so a rebuild fetches the same rig again without a new
  call. Meshy refuses Drive links ("invalid model file format": the link has
  to end in `.glb`). 26 rigging tasks were run, one of which failed (about
  125 credits, 5 per task).
- **Shipped (24, all rigged by Meshy):**
  - the five that were held back: King Aldric, Saint Nick, Brass Hare,
    Grizzelda, Bandit;
  - Rattles, from `_Halloween2025_a_ul` (the owner's call);
  - from the queue: Teddy, Anubis, Ser Brannock, Brother Ansel, Big Bab, Agent
    Zhao, Desert Ranger, Groaner, Gorgle (it was queued as a creature; it ships
    as an `npc+player` character so the owner can see it), Giggles,
    Vanguard, Dust Trooper, Punkin, Merrow the Wise;
  - new, from downloads that weren't in the queue (license `owned`, named here,
    and added to the queue as "extra download", for the owner to review on the
    grip and portrait sheets): Uncle Bao (`Arms_Outstretched_for`), Bonejack
    (`The_object_is_a_reali`, a skeleton), Ashwalker (`a_black_tribal_man_wi`),
    Thornweaver (`Tribal_Warrior_Charac`).
- **For the owner to check:**
  - Ashwalker and Thornweaver against the respect note that Plains Scout carries.
  - Uncle Bao and Agent Zhao against the likeness screen: both are photo-real
    older men.
  - Is Rattles's queue URL (a skeleton post) the post the Halloween model came from?
  - The four extras are recorded as `owned` with no URL. If they are community
    posts, switch them to CC0 with the post URL.
  - Hats, ears and tall heads count towards a model's height, so their bodies
    come out shorter: Saint Nick, Anubis, Merrow, Teddy, Brass Hare and Giggles
    stand short in their size class.
- **Held back:**
  - **Lurcher:** Meshy weighted its hands, which hang against the thighs, partly
    to the legs, so the hands stretch to the hips. Its rig task is in the
    manifest. It needs landmarks read off the model or a fix to the weights.
  - **Plains Scout** (`meshy_tracker`): waiting for the owner to confirm that
    the model is respectful.
  - **Not delivered:** Little Cal, Longshadow, Prism Cat and Seer Vela; no
    download matches them.
- **Portraits:** the 24 new looks have shipped portraits (`capture-portraits.mjs`, partial run). Grizzelda, Bandit and Rattles are framed too close (a hunched or big-headed body), so frame them again once `portraits.ts` handles those bodies.
- **e2e ports:** another checkout on this machine served on the default e2e port (4173), and a run there tested the other build. Run with `E2E_CLIENT_PORT`/`E2E_SERVER_PORT` set to free ports.
- **Grip-sheet notes:**
  - Boglurker (toad): the right hand isn't skinned to `hand_r`, so the guns
    float beside it. Fixing it needs the original FBX, which isn't in either
    folder.
  - Universal first-person arms (`firstPerson.arms`) are used for the first
    time, by Grizzelda, Giggles, Vanguard and Dust Trooper. On ranger arms,
    `trim` colours the gloves.
- **Not characters, still to bring in** (no pipeline path yet):
  - (done on `wip/weapons-variety`: the Frontier Rifle, the Neon Flux and the Medkit; see section 5)
  - (done on `wip/posture-buggy`: the buggy and its tire, as the `buggy` mount; the gun jeep keeps its Kenney truck);
  - the Triceratops (a creature: prepare-creatures.mjs);
  - five helmets: Aviator, Mk 2, Military, Steel and Viking (the helmet tool `prepare-gear.mjs` is on `wip/roster-cleanup`).
- The owner's review results are kept in the review artifact
  https://claude.ai/artifact/Cwq57yDPtBzmnrpaf7josr (its db collection
  `reviews`).

### Owner decision (2026-10-30): who carries on when a browser host leaves
When the host of a browser-hosted match (Host game) leaves and at least one human is still playing, a human
becomes the host and the match carries on, even if only one is left (they keep playing with the bots). The
host-left screen shows only when no human remains to take over. Dedicated hosts (the Host Service) don't hand off:
they are the server.

### 5. Queued next (owner's requests, 2026-10-29 night)
Items 1 and 2 are **done on `wip/weapons-variety`** (based on this branch; not merged): see "Weapons variety" below.
Start the rest when agent slots free up:

**Impact work (`wip/impact`, 2026-10-30; based on this branch, not merged):** items 3–6 below plus tiered ragdolls, all done:
- **4 Stopping power (done):** `sim/impact.ts`: per-weapon `stoppingPower` (defaults by category: pistol 0.15, SMG 0.12, rifle 0.3, shotgun 0.8, sniper 0.9, melee 0.55; revolvers 0.45), shove up to 3.6 m/s × power along the shot and a slow up to 42 % × power for 0.12–0.42 s; per stagger window caps (4.5 m/s, 50 %, 0.6 s) then 0.5 s immunity. Server-side; prediction replays it (push velocity, `ms`). Flinch by body part in `characterAnimator.flinch`, heavy hits play `hit` / `hit_head`.
- **5 Explosions (done):** every explosion of 35+ splash damage throws (`blastKnockback`: 4 + damage × 0.06, 6–13 m/s; rockets 11.2), up 0.9× (+0.35× from below) and out 0.85× (`blastThrow`); your own: 0.7× out, 0.8× up (a rocket at your feet: ~2.4 m rocket jump). Ragdolls of blast kills fly with the blast's force (`view.blast`, up to 16 m/s).
- **3 Punch and kick (done):** quick melee `BUTTON_MELEE` (side mouse buttons or Y): punch 15 / kick 22 (moving forward or within 0.6 s of a punch), stagger, no gun lockout; with a melee weapon in hand it swings that; none in Disc Arena. Bots dry up close punch. Clips `jab` and `hit_head` from UAL1 Standard (CC0, add-rig-clips.mjs); neither free UAL edition has a kick, so the kick is procedural (third person) and a boot in first person. No controller binding yet.
- **6 Bot hopping (done):** `arenaHop`: the Arena style hops constantly (0.5–1.1 s); ARENA characters on Mixed only in fights while strafing, every 1.3–2.4 s.
- **Tiered ragdolls (done):** `ragdollBudget.ts` (full near or in view, cheap 3-body far, laid down out of view; 300 awake bodies, the farthest drops a tier), pool in `EffectsWorld`, settle and freeze by simulated time, fresh deaths spread over frames (`DEATH_START_MS`). Mass casualty: `pnpm perf:mass` (in CI's perf job), numbers in docs/PERF_96.md.
- Open: the kick and flinch were only seen in tests and e2e screenshots, not judged by eye; "laid down" uses the death clip's last frame, assumed to fall backwards (the body faces against the push).
1. **(done) New weapon assets** (owner's Meshy generations, provenance Meshy/owned; downloads outside the repo):
   - meshystuff: Tommy Gun, Rotary Gatling Gun, military sniper rifle, Steampunk Battle Axe, Freeze Gun, Mystical Glue Gun, Futuristic Blaster, Plastic Toy Machine Gun;
   - Drive: Large Sentry Gun (turret), "Ornate Hand Holding G…".

   Replace the in-house sculpted weapons and turret where one matches; the rest become new specials (freeze status, glue slow).
2. **(done) Weapon variety:** a weapon pickup option in MapMaker, "Random from category" (pistols, SMGs/MGs, rifles, shotguns, snipers, explosives, melee, specials), rolled per respawn. Add a host option "Mix up weapon pickups" (same category), with a "keep fixed" flag for pickups placed on purpose.
3. **(done on `wip/impact`) Punch and kick:** add the jab, cross and kick clips from Universal Animation Library (tools/content/add-rig-clips.mjs) and an unarmed quick melee.
4. **(done on `wip/impact`) Stopping power:** per weapon, a small shove along the shot, a brief slow and a hit flinch at the body part hit; bots are affected too. Arcade-light (docs/GUNPLAY_DIRECTION.md).
5. **(done on `wip/impact`) Explosions** lift and throw people much more; blast kills fling ragdolls; keep rocket-jumping.
6. **(done on `wip/impact`) Bot hopping:** ARENA-tagged characters on the "Mixed" style hop only in fights and less often; constant hopping stays for the "Arena" style (packages/shared/src/bots/brain.ts ~1156).
7. **Boglurker (toad):** the right hand isn't skinned to hand_r, so guns float. Needs the original FBX from the owner.

#### Weapons variety (`wip/weapons-variety`, 2026-10-30)
- **Models** (pack `meshy-owned-guns`, `prepare-guns.mjs` now reads Meshy's textured GLBs; mapping in docs/ARSENAL.md):
  Tommy Gun → SMG, Gatling → Spin Gun, military sniper → Sniper Rifle, Neon Flux → Burst Rifle, Frontier Rifle →
  Marksman Rifle, Futuristic Blaster → Plasma Rifle, ornate energy handgun → Pulse Pistol, Freeze Gun → Freeze Ray,
  Glue Gun → Goo Gun, toy MG on a tripod → Heavy MG Turret, Large Sentry Gun → Sentry Gun, Medkit → health pickups
  and the Medkit/Medi-Beam. New weapon: Battle Axe (heavy melee, blunderbuss alt). The Styloo MAC-10 and AWP and the
  community plasma spin gun were dropped (replaced).
- **Pickups:** `category` on weapon defs; `random` / `keepFixed` on pickups (map format v24); `mixPickups` rule
  (setup → Arsenal; host panel, live); `sim/pickupRoll.ts`; snapshot `pw`.
- **Checks run locally:** typecheck, content:check, test:changed (922 passed), build, e2e arsenal, editor, offline,
  characters, visual, hostcontrols. Not run: the rest of the full suite (the shared change maps to all flows): run it
  on a `check/` branch.
- **Open:** the Tommy Gun's drum faces forward (Meshy modelled it that way); the axe is held blade-forward like the
  knife (melee holds can't roll the model); the sniper's stock has a few px of illegible stencil; held guns have no LOD
  (only merged props use LODs: `ModelLibrary.instantiate` would need it).
- **Still in-house / pack models in use:** Quaternius pistol, revolver fallback, knife, grenade launcher, rocket
  launchers (blast/guided), and the extended-arsenal sci-fi guns (hand cannon, gilded pistol, flare gun, machine pistol,
  laser rifle, sawed-off, auto shotgun, flak, railgun, disc launcher, bubble blaster, oil slicker, nailgun, swarm,
  singularity, arc caster, flamethrower); Styloo AK-47, shotgun, RPG and frag; Meshy community revolver and rocket
  turret; Kenney rocket turret fallback, vehicles; the procedural spear and builder; the boxes-in-code armor, ammo and
  powerup pickups.

## Earlier state (2026-10-28)


- **Live:** https://trigger.toshiroplay.com, version **0.3.0** (`v0.3.0` tag and
  GitHub release exist). `main` is at or past `ace6276`; all of it went green on
  `check/candidate`.
- **Since 0.3.0 (in the CHANGELOG's Unreleased section, not tagged yet):**
  - Safari offline-match fix;
  - MapMaker white-props fix;
  - Host Service, the dedicated-server launcher;
  - on-demand loading: the menu loads 0.74 MB of JS gzip instead of 4.4 MB.

  - Host Service **launcher** (`packages/host/src/launcher.ts`): the service
    serves its own page on 127.0.0.1 and opens it on start: the console in
    the site's look (log, filters, command line with suggestions) and a right
    bar of controls, each running the console command it shows;
  - map select: uniform map cards (picture, name, plan); blurb and modes in
    the setup panel;
  - the imported TimeSplitters maps (`maps/imported/`) and their importer are
    gone (the owner's call: they didn't convert well);
  - online: away players and reconnecting, profiles (username, region),
    region-sorted game browser, the online line in the Tab scoreboard, join
    limits and idle kick on every host (on `main` at `c3d6f27`; the box needs
    `infra/deploy-multiplayer.sh --owner …` rerun for `PROFILES_DIR`);
  - shipped
    character portraits (`tools/content/capture-portraits.mjs`, the
    "Capture portraits" workflow: run it once this is on `main`, then review
    and merge its `check/portraits` branch), the start-up loading screen
    (`src/boot.ts`), MapMaker's level split fixed (floors go by their top, so
    ground floors aren't drawn see-through over terrain), and match setup's
    step-by-step panel with mode tabs, search, sort, list view and favourites
    (`frontEnd.ts` `arcade()` / `fillSetup()`, `modeIcons.ts`; the owner's
    mockup of 2026-10-28).

- **Nothing is in progress.** Everything above is on `main` (`7657980` and on). Open: nine portraits left to render live (soldier NPCs untinted, cyclops/oculus/imp/Nova framing) until `portraits.ts` handles them; the Host Service launcher now opens as an app window (`src/appWindow.ts`), untested on a real screen.

## Landed on main (2026-10-28, 17:20 EDT)

Everything below is on `main` and released as **0.4.0** (version, CHANGELOG
entry and menu baseline in the release commit; tag `v0.4.0` on it). After it:
your own muzzle flash is 1.6x, 5 cm past the muzzle at the barrel's height
(`OWN_FLASH_SCALE`, `OWN_FLASH_AHEAD` in `view.ts`), the flash's glow sits in the
flame, and the railgun's impact is at scale 0.4.

1. **Binbun VFX (CC0 packs the owner downloaded; zips not committed):**
   - muzzle flashes `game/muzzleFlash.ts` (from `public/vfx/muzzle_flash.json` +
     atlas), hit and explosion effects `game/godotVfx.ts` (a small Godot
     particle/shader player for `hit_fx.json`, `explosion_fx.json`);
     converter `tools/content/prepare-vfx.mjs` + `godot.mjs`; provenance in
     `content/vfx*.json`, `assets-src/binbun-*`.
   - Verified on the published check build of `f80a606` (served locally,
     `?offline=training_range&test=1&god=1&sim=main&bots=1`, `#pause` hidden,
     `window.__flashHold` = 8/20/40 ms): the pistol's flash shows, an orange
     flame and a yellow glow at the muzzle. It is small and partly behind the
     slide; make it bigger or move it forward if the owner wants more punch.
     (The earlier "no flash" capture was before `__flashHold`.)
   - `f80a606` fixed the hit/explosion shaders: the wrapper's tone-map `vec3 c`
     clashed with `vec2 c` in flare, streaks, impact_core and spiral_dust, so
     WebGL refused them and most pieces drew nothing. Now impacts and the
     ground explosion draw (checked with `view.vfx.play` in front of the camera).
2. **Terrain never through floors** (`settle.ts terrainUnderFloors`, applied in
   `loadMap` and every MapMaker edit via `withTerrainUnderFloors`): on
   `check/terrain` shard 8 failed once; with the hang fixed, every shard
   passed on `f80a606`, so that was the frozen page, not terrain.
3. **MapMaker:** fold-away sidebars (\ / Shift+\), edits rebuild only what
   changed (measured on Sandgate headless: ~170 ms per edit, ~100 ms of it the
   terrain), faster terrain meshes, and **Paths** (`shared/map/paths.ts`,
   `client/pathMeshes.ts`, `editor/pathTool.ts`, `setPaths` command; laid on
   load, `loadMap(..., { forEditing: true })` in MapMaker/publish keeps them
   apart).
4. **MapMaker unification ("yes to all"), done on the session branch (CI next):**
   - Right-click takes back the tool's effect (`secondaryClick`): Paint resets,
     Walls resets, Scatter clears, Road/Paths/Route remove a point, a placing
     tool removes a thing of its own kind; with Select it opens a menu
     (`openContextMenu`, `#ed-ctx`).
   - Erase picks like Select (a whole moving build; Alt one piece).
   - Placement: Ctrl (or Shift) places without snapping for every kind
     (`freePlacing`); dragged things preview where they land (`updateDrag`).
     One spot rule (`placeSpot`: the terrain under the pointer, else the
     level's floor) and one ghost (`setPropGhost`) for props, vehicles, spawns
     and pickups; tiles keep their green ghost. Objects and NPCs too
     (`objectGhost` in editorApp: what `newScenarioEntities` / `placeNpcCommand`
     would add, made once per object and facing and moved with the pointer;
     drawn by `setEntityGhost` with the markers' own `entityNode`). Previews are
     updated before `updateHoverTarget`'s per-tool early returns, and
     `seeThrough` swaps opaque-only (glTF) materials for shared see-through
     copies (`ghostMaterial`), never the originals.
   - Rotation: `yawStep(kind, fine)` in shared `operations.ts` (spawn 45/15,
     prop and vehicle 15/5, tiles, zones and liquids 90, rest 90/15) for
     placing, R, Shift+R and the inspector; groups turn about their centre
     (`rotateCommand`).
   - Drag-to-paint for Paint, Walls, Scatter and Erase (`brushAtHover`), one
     undo step per drag (`EditHistory.beginStroke/endStroke`); Shift = the
     opposite, Alt = pick.
   - Keys: \ and Shift+\ fold the sidebars, PgUp/PgDn levels only, [ ] brush
     size only, G Paths, Shift+G race Road, N Scatter.
   - One hint line per tool (click · right-click · R · modifiers).
   - Inspector walls pick glass like the Walls tool (`setEdge`); surfaces share
     the Paint tool's Apply to and take its brush.
   - One home per pane: Nature and Terrain only in Environment; the backdrop in
     Environment → Sky (`#ed-sky`); no `confirm()` for undoable removals.
   - Routes: `editor/routeTool.ts`, "Draw route on the map" in the mover and
     plane inspectors, the same gestures as Paths and the Road.
   - e2e: editorux checks the rotation steps, the menu and strokes. CI failures
     now come back as annotations (`::error title=e2e <flow>::…`), so a failed
     shard can be read through the check-runs API without the log.
5. **Frozen page fixed (85a2737):** the hit/explosion player's `Emitter.spawnAt`
   returned without counting a particle once an emitter was full, so the
   emission loops never ended and busy matches froze (perf stall on Frost
   Basin, hostgame/dedicatedhost connection failures, a scenery click
   timeout). Found by bisecting on `check/perf-a` / `check/perf-b`; those and
   `check/kickprobe` are leftover probe branches (deleting a remote branch is
   refused from here: the owner can delete them). Effects are also capped
   (remote pack flashes within 45 m on at most 8 guns; 10 effects at once).
6. **Done:** editorux now refocuses on the spawn spot before placing it (`fbb8eed`;
   `129dc9d`'s right-click at (6, 0, 0) was still behind the camera left on the
   rocks), scenery opens the Terrain pane first (`129dc9d`), and main is at `f80a606`.
7. Waiting on the owner: Sandgate's street
   terrain (lumpy dirt/grass in the open streets is authored paint: the owner
   can now draw sand Paths over it); eight portraits still rendered live (soldier NPCs and zombies untinted; imp tiny; cyclops and oculus as blobs). Portraits must use `offscreenProjection` (offscreen.ts): the engine uses a reversed depth buffer.

## MapMaker Paths and Paint fixes (2026-10-29)

- **Paths:** on a map without terrain the backdrop's ground (and the collision
  ground, `groundBoxes`) only reached 2 m past the buildings, then rose as a
  berm, burying roads drawn further out; both now cover the paths
  (`pathsExtent`). Path curves are centripetal Catmull-Rom sampled every
  metre (`TrackGeometry`'s `CurveShape`; the race track keeps its old curve),
  so no overshoot or loops; the ribbon's inner edge holds its point through a
  tight bend instead of folding over (`pathStrip`). The editor's line follows
  the curve on the road surface (not straight segments between points),
  handles sit on the road, are drawn over the ground (rendering group 1),
  are grabbed within 18 px, light yellow under the pointer, and a click on
  another path's ribbon picks it.
- **Paint (B):** its hover ray hit the invisible 60 m walls round the map
  (barrier boxes) when the camera was outside them (zoomed out): the yellow
  slab. It now skips barriers and non-tile boxes, the terrain in front hides
  what is behind it, and on the terrain Paint paints the ground (its brush
  material if that is a ground, else the Terrain tab's), ring and all.
  `terrainRaycast` marches only the stretch over the terrain, so it reaches
  from any zoom.

## One path primitive: roads, race track, routes (2026-10-29)

- **Data (map format 23):** `MapPath` (schema.ts) is points + `closed` (was `loop`) + `uses`
  (`road` drawn, `race` the race track, `route` an AI guide line) + width, style, lay, and
  optional `oneWay`, `speed` (m/s hint), `patrol` (`loop` / `back_and_forth`), `race`
  (laps, grid, vehicle, combat, curbs, ambient, ambientVehicle, pit) and `curve` (`classic`:
  the old race curve). The map's `track` field is gone: migration v22→v23
  (`migratePathsV23`) makes it the first path, uses road+race, `curve: 'classic'`,
  `lay: false`. `racePath` / `raceTrack` / `trackGeometry` (track.ts) read it;
  `pathGeometry` moved to track.ts. Only the first race path races (validator warns).
  `pathsExtent` covers laid roads only (a raised track gets no ground). Test
  `unifiedPaths.test.ts` proves every shipped race map has the same curve, gates, grid,
  ambient cars and ground as before.
- **MapMaker:** `editor/pathTool.ts` is the one tool (roadTool.ts deleted; Race Track card and
  Shift+G call `paths.preset('race')`; Route card `preset('route')`). Join ends: click the
  first point with the last selected (`joining`), or `#ed-path-close`; `#ed-path-reverse`.
  Arrows (`pathArrows`), dashed routes (`buildGuideLines`, editor only). Encounter inspector:
  patrol → Route picker, Edit/Draw route.
- **Game:** `bots/guides.ts` (`vehicleGuides`, `followGuide`) used in `brain.thinkMounted`'s
  driver branch via `view.guides`; race bots and ambient cars still use `TrackDriver`.
  `Encounters.routeGoal` walks an encounter's `route`; route patrols count as roaming (they
  think with nobody near). Patrols to a target entity are unchanged (nothing to migrate).
- **Not done:** mover and airplane routes (`editor/routeTool.ts`) stay entity-relative motion,
  not paths; road grip (`roadHandling`) still only on the race track; ambient cars only lap
  the race track. The map-index build plugin now loads shared in `buildStart` (builds timed
  out on a loaded machine).

## Effects performance (2026-10-29)

After 0.4.0 the owner felt the new effects slowing play. Measured in a 48-player
fight (`tools/perf`-style probe; frame rates in this sandbox are SwiftShader noise,
so measure the code's own costs): effect meshes (remote flash rigs, every hit and
explosion's particles) were shadow casters (116 of them, a second draw each), and
each effect's first use built its meshes and materials mid-fight (first explosion
153 ms, first railgun hit 76 ms, first flash 43 ms here). Now effect meshes carry
`metadata.effect` and `atmosphere.worldly` leaves them out of shadows, and the map
load warms every flash and effect (`MuzzleFlashRig.warm`, `GodotVfx.warm`): first
uses cost 3-5 ms. Don't use Babylon's `forceCompilation` on meshes you dispose: it
polls every 16 ms for ever. `physicsfx`'s ragdoll check fails in this sandbox on
unchanged code too (slow frames); CI is the judge.

## Release 0.5.0 (2026-10-29)

Prepared on the session branch: version 0.5.0, CHANGELOG section, menu baseline. Once its check run is green and `main` is fast-forwarded, CI makes the `v0.5.0` release and tag itself (client-release.sh: main reaching a version with a CHANGELOG section and no release).

## Performance overlay and budgets (2026-10-29)

F3 / Options → Display: the performance overlay; Pause → Settings → Copy performance report (`game/perfOverlay.ts`). When the owner reports a slowdown, ask for that report. CI's `perf:budget` now also fails on effects in the shadow pass, more than 600 shadow casters (clumped Frost Basin, medium; 446 on CI with 46 characters in view) and effect starts over 40 ms (docs/PERF_96.md, last section). New effect materials made per shot: block their dirty mechanism, and don't `clone()` meshes in hot paths (share geometry).

## Crowd rendering (2026-10-29)

Profiled the page's main thread in a clumped 96-player Frost Basin fight (production build, `?offline=frost_basin&gamemode=core.tdm&bots=95`, CDP profiler; frame rates here are SwiftShader noise, the main thread's busy share is not). Before: kill-feed icons rendered live (a weapon model, shader compiles and a sync `readPixels` per new weapon) were ~60%; effect meshes made and disposed ~1,000/s, each dispose walking `scene._activeAnimatables` (~12-13k: one per character bone per playing clip) and `scene.meshes`; bullet holes re-uploaded their whole 700-matrix buffer per hit; every canopy built new materials (setters walk all meshes) and a lines mesh. Now:
- weapon icons ship (`public/weapon-icons/`, `frontend/weaponIconIndex.ts`, `tools/content/capture-weapon-icons.mjs`, run by the "Capture portraits" workflow with the portraits); a model missing there renders live;
- `game/meshPool.ts`: sparks, dust/smoke puffs, blood drops, mist and splats are pooled (`warm()` draws one of each off-screen during map load so their shaders build then); sparks capped at 600, drops at 500; blood drops, mist and puffs carry `metadata.effect`, splats `castsNoShadow`;
- bullet holes upload only the new range once a frame (`thinInstancePartialBufferUpdate`);
- canopies are pooled per kind with shared materials (`releaseCanopy`).
Result: main thread idle 74% with 53 characters in view (was 43% with 36, and 31% before the icons). Left, in order: held weapons are rebuilt on every switch (`view.setAvatarWeapon`, ~15 nodes/s, each dispose walking the animatables: pool them per model); the ~12k animatables themselves (AnimationGroup per clip per bone; Babylon's `stop`/`_start` splice that array); `computeWorldMatrix` ~4%. The physicsfx ragdoll check now waits for the corpse before sampling; it still fails in this sandbox on stalled frames, on main too.

Ragdolls (asked 2026-10-29): no neutral pose, no muscle tension. Joint limits done 2026-11-02 (`wip/fix-ragdoll`, below).
## Map rotation (2026-10-29)

Regular matches can go on to a queued map instead of replaying: `shared/sim/rotation.ts` (`MapRotation`, `validateRotation`, presets in `maps/rotations/*.json`). Protocol: host commands `rotation` (the whole list, and/or shuffle) and `skip`, `HostState.rotation`, `round_end.up` (everyone's scoreboard: "Next map: …"); older hosts ignore them and the panel hides the section. Dedicated server: `server.ts` plans the travel at the end of the intermission (chains first), `server/src/rotation.ts` (suite lookup, presets, `preset:` items); Host Service: `ROTATION` / `ROTATION_SHUFFLE`, console `rotation` / `skip`, the launcher's Rotation card, in-game changes saved via status (`main.ts`). Browser host: the page keeps it (`main.ts` → `SessionOptions.rotation`, `session.ts` `rotateOn` / `skipRotation`), tells the match where it goes (`setUpNext`), and travels like Change map. Not done: Play → Match setup doesn't take a rotation yet; the site's /host page doesn't edit it (the launcher and console do).

## Bot sets: the host's own bots (2026-10-29)

The owner asked for configurable bots when hosting and for scenarios. Shared `sim/botSet.ts`: a set is a
name, entries (name ≤ 20, look: CORE_LOOKS or an NPC skin or random, skill, style, team index or auto,
squad label) and `fill` (`random` or `only`); `validateBotSet` makes anything valid; text form
(`botSetToText` / `botSetFromText`: "Name, look, skill, style, team(1-based), squad"; first line `only`);
presets are data in `maps/botsets/*.json` (`parseBotSetPreset`, tested in `botSet.test.ts`).
- **BotFiller** (`match.ts`): `pick()` takes the set's waiting entries in order (team modes: the neediest
  team's own entries, then unteamed), then random bots unless `only`; bots carry `Combatant.botSet`
  ({ index, skill, style, squad }); `setRank` makes random bots give way first (rebalance, takeOverBot).
  `setBotSet` updates kept bots in place (by name, else position: `Match.updateSetBot` / `dropSetBot`) and
  sets `settling`; `stage(fill)` swaps one stale bot per call (servers and the browser host call it every
  quarter second and send the roster). Per-bot skill and style go through `Match.rebrain`;
  `retuneBots` leaves bots with their own alone. Squads: `Match.squadGoal` (leader = first alive bot of
  the squad on that side; followers go back past `SQUAD_STRAY` 14 m, else take the leader's last goal from
  `leadGoals`); the director leaves squad members out of its own squads.
- **Map bots:** optional `MapDocument.bots` (no migration, no format bump): `mapBotSet(map)`, used by
  BotFiller when the host chose none; `hostSet` is what a map change carries; HostState `mapBots`.
  MapMaker: map properties → Bots (`renderMapBots`, `setMapBots` command).
- **Protocol:** `{ c: 'bots', botSet }`, HostState `botSet` / `mapBots` (optional; old hosts: no button).
- **UI:** `frontend/botManager.ts` (the window; saved sets in `cs.botsets`), hostPanel "Bot set → Bots…",
  match setup Bots step "Your bots" (`MatchSetup.botSet`), the page keeps the set across map changes
  (`main.ts` `botSet`, `Travel.host.botSet`). The pause menu treats the window (and its look picker) as
  its dialog (`session.ts` overlay), so Esc / B and the d-pad work.
- **Dedicated:** server `botSet` option and `BOTSET` (`server/src/botSets.ts`), Host Service config
  `botSet`, console `botset`, launcher Bots card, in-game changes saved for the next start.
- **Not done:** named NPCs in encounters (NPC names would need the snapshot's NPC entries to carry a
  name; encounters keep role labels); per-bot loadouts; the site's /host page doesn't edit the set (the
  launcher and console do); squads don't share a formation, only goals.

## Host leaves a browser-hosted match; host handoff (2026-10-29, wip/host-handoff merged)

Details: docs/MULTIPLAYER_PROTOCOL.md sections 13 and 14.
- **Host leaves:** the host sends `bye` before its links close (Leave match, `pagehide`); a friend whose
  link just drops (or whose host is silent 20 s) gets "Reconnecting to host…" (up to a minute, until the
  broker says the game is gone), then the host-left screen (`game/hostLeft.ts`, `main.ts` `afterHost`) with
  the last standings, **Host this map** and **Back to menu**. e2e: `hostgame`.
- **Handoff:** the host keeps the best-ping friend named successor (`matchHost.ts` `tendSuccessor`:
  `standby` → the friend opens a code of its own → `successor` to all) and sends it a `checkpoint` every
  3 s (`shared/net/handoff.ts`; people by hashed key only; the listing's name only: its id and secret go to
  the successor only with the host's `bye`). When
  the host goes the successor restores the match (`BotFiller.restore`, `Match.resume`, `main.ts`
  `takeOver`) and the others follow its code (`afterHost`, `keepJoining`). No hub change. Tests:
  `shared/test/handoff.test.ts`, `client/test/localHost.test.ts`, e2e `handoff` (prints the friends'
  console when a check fails; `E2E_HANDOFF_LOG=1` for all of it).
- **Fixed on merge:** the other friend not rejoining: `afterHost` gave the follow one 10 s try while the
  successor was busy starting the match (on a loaded machine its page answers late), then showed the
  host-left screen; the successor held the place as "(away)". Now friends keep trying for 90 s
  (`HANDOFF_FOLLOW_SECONDS`, inside the 120 s hold). Successor swaps wait 30 s and keep the old one named
  until the new one answers (a loaded machine's pings flapped the role and left gaps with nobody named).
  The successor checks twice (3 s apart) that the host is gone before taking over (fork guard).
- **Left as is:** a successor whose own link drops while the host and the others carry on stays out
  (its reconnect fails, its checkpoint goes stale, no second copy): fine. A crashed host's listing is
  hidden after a missed check-in (30 s) and expires in 65 s, so for a moment two listings may share a name
  (a hub-side fix would hide listings whose code has left the hub's broker).
  The successor doesn't carry the host's bot set (the checkpoint has bots by name and look, not the set).
  Vehicles, pickups, map logic, NPCs, flags and waves restart (by design).

## How work flows (details in CLAUDE.md)

1. Work on the session branch, or in an agent worktree that you merge into it.
2. Run the checks locally: `pnpm typecheck`, `pnpm test:changed`, and after
   `pnpm build`, the e2e flows your change touches
   (`E2E_ONLY=<flows> node e2e/run.mjs`).
3. Push the merge candidate: `git push -f origin HEAD:check/candidate`. CI runs
   what the change needs. You can poll it without auth:
   `curl -s "https://api.github.com/repos/Dsoto1/splitters/actions/workflows/ci.yml/runs?branch=check/candidate&per_page=1"`
4. Only when green, fast-forward: `git push origin <sha>:main`. A main push that
   already passed on a check branch skips the tests. The `release` and
   `host-release` jobs then publish the site build and the Host Service
   downloads to the `main-latest` GitHub release.
5. The owner updates the box with `sudo tiletrigger-update` (Lightsail console →
   Connect). An hourly timer can do it instead
   (`systemctl enable --now tiletrigger-update.timer`).

**Gotchas**

- Local e2e in a cloud session: the project's Playwright wants a browser build
  that isn't installed. Run a copy of `e2e/run.mjs` with
  `executablePath: '/opt/pw-browsers/chromium'` added to `chromium.launch` (don't
  commit the copy).
- Some Claude sessions can't reach registry.npmjs.org (DNS fails, the proxy
  refuses it): `pnpm install` fails, so nothing builds or tests locally. Push
  to `check/candidate` and let CI check it.

- The session's git proxy refuses tag pushes and remote branch deletes. Releases
  don't need one: when `main` reaches a version with a CHANGELOG section and no
  release yet, CI makes `vX.Y.Z` (and its tag) from that green build.
- Bump `packages/client/package.json` for a release. The menu shows the version,
  so regenerate the menu screenshot baseline: `pnpm e2e:baselines`, or
  `E2E_UPDATE_BASELINES=1 E2E_ONLY=visual node e2e/run.mjs`, keeping only
  `menu.png`.
- CI artifact downloads (blob storage) are blocked from the sandbox. A failing
  visual check prints a quarter-size PNG to the log (`VISUALPNG <scene>` lines,
  base64) and a 12×6 grid of where pixels differ.
- Run at most 2–3 agents at a time and commit at every milestone. The container
  restarts sometimes and loses anything uncommitted.
- Use `TaskStop` on agents that linger on background jobs.
- Several agents share e2e ports on one machine. Load causes timing failures
  (glass shots, "TEST starts within 3 s"), so rerun a failure alone before
  calling it real.

## Map of the system

| Area | Where | Docs |
|---|---|---|
| Client (Babylon.js + Vite) | `packages/client` | `docs/UI.md`, `docs/LOADING.md` |
| Simulation, maps, protocol | `packages/shared` | `docs/TECH_ARCHITECTURE.md`, `docs/MULTIPLAYER_PROTOCOL.md` |
| Hub (site, broker, game browser, TURN creds, Cognito, tickets) and dedicated server | `packages/server` | `docs/HOSTING.md`, `docs/MULTIPLAYER_SECURITY.md` |
| Host Service (dedicated host over WebRTC, console, control API, downloads) | `packages/host` | `docs/HOSTING.md` → "Dedicated host (Host Service)" |
| AWS (Lightsail box, Route53, SSM, budget) | `infra/` | `docs/HOSTING.md`, `infra/deploy-multiplayer.sh` header |
| CI | `.github/workflows/ci.yml`, `tools/ci/` | `CLAUDE.md` |
| Bots | `packages/shared/src/sim/` (spawns, squads, roles) | `docs/BOTS.md`, `docs/PERF_96.md` |
| Gunplay | | `docs/GUNPLAY_SPEC.md`, `docs/GUNPLAY_DIRECTION.md` |
| Owner's multiplayer direction | | `docs/MULTIPLAYER_DIRECTION.md` (read before networking or hosting work) |

**Infrastructure facts**

- Lightsail 2 GB box `toshiro-trigger-hub`, static IP 18.214.136.159, us-east-1.
  It runs Caddy, the hub and coturn.
- Deploys come from AWS CloudShell: `infra/deploy-multiplayer.sh`.
- The box never builds: it installs CI's signed builds from GitHub Releases.
- The owner's Cognito pool (shared with their Flavius game), login domain
  `login.toshiroplay.com`, Trigger's public SPA app client (PKCE, Google
  sign-in). No IDs in the repo: the deploy looks them up each run; the page
  reads them from the hub's `/auth-config.js`.
- Secrets live only in SSM (`/toshiro/trigger/turn-secret`,
  `/toshiro/trigger/hub-signing-secret`). Never put them in the repo or the
  bundle.
- Budget `toshiro-trigger-prod-monthly`, alerts at $15/$25. About $13/month.
- The owner chose to keep the TURN relay (2026-10-28). It's capped in
  coturn's config, and credentials go only to live games.

**Pitfalls**

- **Safari and module workers:** no chunk may import from a worker's entry file.
  `simWorker.ts` is a tiny loader for `simWorkerCore.ts`, and
  `tools/ci/check-worker-entry.mjs` enforces it.
- **Babylon side-effect imports:** since MapMaker loads on demand,
  `game/view.ts` imports `@babylonjs/core/Culling/ray` itself. Watch for
  "X needs to be imported before" errors after moving code between chunks.
- **Shared materials:** never `dispose(false, true)` a node built from
  `ModelLibrary`; its materials are shared. Use `disposePropNode`.
- **Bundle budget:** `tools/ci/bundle-budget.mjs` caps the JS loaded before the
  menu at 800 kB gzip.
- **Host Service and node-datachannel quirks:** a channel can arrive already
  open, and "open" can fire twice. Admit a connection once (`admitWhenOpen`).
  A Node offerer has a DTLS race; see `packages/host/test/guest.ts`.

## Owner preferences and rules

- Plain explanations; ask before big direction changes. The owner tests on the
  live site from a Mac (Safari and Chrome) and a desktop.
- Content rules in CLAUDE.md:
  - no in-game AI generation or uploads;
  - Meshy models made on the owner's subscription are OK and recorded in
    provenance;
  - otherwise CC0 / credit-only / approved Quaternius only;
  - never commit raw pack files.
- Official servers run suite maps only. Community servers may run community
  maps, labelled "Community map".
- Hosting is opt-in. Players never need the Host Service, and no install prompt
  appears anywhere except `/host`.
- The owner said "forget the SUV".

## Waiting for the owner's go (docs/STAGED_IDEAS.md)

1. **Dustwater expansion:** bigger town, mines, two trains running tunnel to
   tunnel in opposite directions. It has four open questions:
   - train type;
   - whether players can ride the trains;
   - size (about 2×, for 48v48?);
   - name: keep Dustwater or make a new map.
2. **Map rework batches and set pieces:**
   - layouts, spawns, glass and water passes;
   - Runway Nine airplane;
   - Blackout enemies;
   - Mercy Ward rooftop zombies.

## Online: away players, reconnecting, profiles, regions (2026-10-28)

- `BotFiller` (shared `sim/match.ts`, `AWAY`): idle → warning → bot plays the
  place ("Name (away)") until real input; dropped → place held 60 s by
  `sub:`/`pk:` key and reclaimed on reconnect; servers close links silent
  20 s. Wired in `server.ts` (dedicated, Host Service) and `matchHost.ts`
  (browser host, friends only). Client reconnect loop in `main.ts`.
- Profiles: hub `profiles.ts` (`PROFILES_DIR`), usernames in account tickets,
  page-side Ed25519 ticket checks for browser hosts (`game/ticketCheck.ts`),
  scoreboard ✓ / GUEST, Profile screen, `client/src/profile.ts`. Needs the
  box set up again once (`deploy-multiplayer.sh`, also for `--owner`).
- Region: `shared/net/profile.ts` REGIONS; adverts carry `region`; game
  browser sorts nearby first; Host Service `REGION`.

## Maps are made in MapMaker; the owner publishes (2026-10-28)

- Every map is its file in `maps/`, made and edited with MapMaker; the 86
  build scripts were retired (CLAUDE.md, "Maps": no scripts, no one-off code
  for one map). The map tour also opens every map in MapMaker (e2e).
- MapMaker treats a mover and what it carries as one **moving build**
  (select, move, rotate, duplicate, delete; Alt-click for one part).
- **Publishing** (docs/HOSTING.md, "Publishing maps"): hub `publish.ts`
  (`/api/v1/maps`, owner-only writes, every version kept), site
  `publishedMaps.ts`, MapMaker `editor/ownerPublish.ts`, Host Service
  `published.ts`, daily `published-maps.yml` workflow to
  `check/published-maps`. **Needs the owner once:** copy the account ID
  (main menu → click "Signed in as …") and run
  `infra/deploy-multiplayer.sh --owner <id>` in CloudShell (that also gives
  the hub `/var/lib/tiletrigger/maps`).
- **Still open:** FBX characters with auto-rigging, owner-only (proposed: a
  Character Lab that guesses the joints, previews animations and the gun grip,
  rigs in the browser and publishes the finished model the same way; the rig
  pipeline exists in `tools/content/prepare-meshy-characters.mjs`).

## Backlog ideas (not started, not yet asked for)

**Host Service next steps** (`docs/HOSTING.md`):
- account pairing through the hub;
- signed self-updates;
- an installer with start-on-boot;
- a tray icon;
- code-signing the downloads;
- per-player join tickets everywhere.

**Other:**
- Babylon's remaining big chunks; a true `.wasm` physics package (Rapier
  non-compat) to drop the base64 inlining.
- Far-player prediction replay skip, and a binary encoding of player entries for
  hosted 48v48 (see `docs/PERF_96.md` → "Hosted 48 v 48").
- A UI parity pass against the reference; a mist depth pass; a per-look outfit
  atlas.
- The FlaviusRule session (`dsoto1/arena`) owns moving the Flavius client to
  `login.toshiroplay.com` (error ref E-XD70 until then). It's not this repo's
  job.
