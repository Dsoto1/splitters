# 96-player frame budget (offline and browser-hosted matches)

Owner report: 48 v 48 bot matches get choppy, worst when the bots bunch up.
The browser's own match (offline play, MapMaker TEST, Host game) used to run
`Match.step()` on the page's thread, in a `setTimeout` loop next to Babylon's
render loop. At 96 players a tick costs 5–9 ms spread out and 9–18 ms in a
clump (measured below), so at 60 Hz the simulation alone wanted 30–100 % of
the core that also renders, and a slow frame made the next one slower.

## What changed

- **The match runs in a module Web Worker** (`game/simWorker.ts`, driving
  `game/matchHost.ts`). `LocalTransport` keeps its interface: snapshots,
  events, rosters, notices and host replies come back as messages; inputs,
  ready, host commands, friends' link traffic (Host game, Go online) and the
  tab's visibility go to it. What the page reads synchronously (host state,
  live rules, carry-over for chains) is mirrored as `facts` the worker sends
  when they change (checked every 30 ticks and after every host command).
- **Fallback**: no `Worker`, a worker that fails to load before the welcome,
  `?sim=main` or `localStorage['tiletrigger.sim'] = 'main'` run the same
  `MatchHost` on the page's thread with the same messages. Browser tests that
  poke `window.__match` synchronously use that mode; everything else reaches
  the match through `window.__sim.eval(src, arg)` (both modes).
- **No catch-up spiral**: a wake runs at most `MAX_CATCH_UP_TICKS` (4) ticks,
  then drops the backlog (reported as `lateTicks` in stats); a hidden tab may
  run up to 150 a wake so the match keeps real time while nothing renders.
- **Browser hosts hold 24 players with friends in**
  (`BROWSER_HOST_MAX_PLAYERS`): the host's browser runs every bot and encodes
  every friend's snapshots next to its own rendering. Bots are cut to 24 when
  the first friend joins (feed line), host controls stop at 24 until the last
  friend leaves, listings advertise 24 at most. Offline with bots alone still
  allows 96, with a note in the Arcade setup above 24. See HOSTING.md.

## Measuring

`pnpm build && node tools/perf/perf96.mjs [map ...]` plays a map offline with
96 players in headless Chromium, keeps the player alive, and measures two
scenarios for `PERF_SECONDS` each: bots spread over the map as they play, and
everyone teleported into one 40 m square every 2 s. Per rendered frame it
splits the page thread into sim (ticks run on the page), message handling,
the game frame's JS, `scene.render()` and the rest; per tick (`simProfile`,
wherever the match runs) bots / physics / rest; and the sim loop's wakes,
largest batch and dropped ticks. `PERF_SIM=main|worker` picks the thread.

## Results (26 Oct 2026)

Headless Chromium with SwiftShader (CPU rendering), graphics low, 96 players
TDM. **Caveat**: the 4-core box was shared with several other agents' builds
and browser runs (load average 20–35 throughout), and SwiftShader renders on
the same cores, so frame rates here (0.1–0.4 fps) say nothing about a real
GPU; read the page-thread sim share and the per-tick sim costs, and rerun on
a quiet desktop with `PERF_GPU=1` for frame times.

"Before" is the same build with `PERF_SIM=main` (the old architecture: the
match on the page's thread; the old loop also capped catch-up, at 5 ticks a
wake, then dropped the backlog after 10 ticks behind).

| Map, scenario | Sim on the page thread before (main) | after (worker) | Sim tick ms before / after* | Bots / physics ms a tick (after) | Loop: largest batch, ticks dropped (after) |
|---|---|---|---|---|---|
| Frost Basin, spread | 105 ms/s (55 ticks/s) | **0 ms/s** | 5.0 / 17.2* | 6.1 / 9.2 | 4, 1,064 in 33 s |
| Frost Basin, clumped | 9 ms/s (2.6 ticks/s: starved) | **0 ms/s** | 8.7 / 8.9 | 3.2 / 4.8 | 4, 516 |
| Norman Shores, spread | 234 ms/s (55 ticks/s) | — | 6.3 | 2.2 / 4.0 (before) | 4, 50 |
| Norman Shores, clumped | 2 ms/s (3 ticks/s: starved) | — | 17.6 | 7.3 / 10.0 (before) | 4, 1,163 |

\* Wall-clock per tick on a box at load 20–35: the after/spread run landed in a
busier minute (load 23.5); compare within a row only loosely.

What the numbers show:

- **The page thread no longer runs the simulation**: 105–234 ms of every
  second spread out (10–23 % of the page's core before rendering anything)
  goes to zero; in the worker run the page spends its time on messages
  (snapshots, 49–154 ms/s), its own frame JS and rendering.
- **Clumped, the old layout starves the match**: with the sim on the page,
  a clump made each frame so slow that the match ran at 2.6–3 ticks a second
  (everything else was dropped catch-up). In the worker the match kept
  ticking on its own core whatever the page did (1,910 ticks counted in the
  clumped window against 50–63 with the match on the page; its own drops
  came from the box's load).
- **No spiral**: the largest batch per wake stayed at the cap (4) in every
  run; backlog beyond that is dropped and counted, never chased.
- Per tick, physics (character moves) outweighs bot thinking at 96 players,
  spread or clumped; bot thinking roughly doubles in a clump. The bot-side
  cuts are in MAP_BUDGETS.md ("Clumped 48 v 48").

## Not covered

- Snapshot handling on the page (`msg`) is now the largest sim-related cost
  there; structured-cloned objects from the worker could become transferable
  buffers if it shows up on real hardware.
- Friends' snapshots are still encoded in the host's worker and relayed by
  the page (data channels live on the page).
