# Changelog

Tile Trigger uses [semantic versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
Until the public launch (1.0.0), a minor bump marks a release with new features
and a patch bump a fix-only release. The version shows on the main menu
(`packages/client/package.json`). Each release is a git tag `vX.Y.Z` on `main`,
made only on a commit that passed CI on a check branch.

## Unreleased

**Fixes**
- Safari: offline and MapMaker TEST matches no longer fail with "undefined is not an object (evaluating 'o.rawintegrationparameters_new')". The match worker's entry is now a small loader, so Safari no longer loads a second, never-started copy of the physics engine; CI checks no chunk imports from it.

**Online play**
- Away players: idle for 90 s (after a warning), a bot plays your place as "Name (away)" until you move again. A dropped connection (a phone that went to sleep) keeps your place for a minute, a bot playing it, and the game reconnects you by itself ("Reconnecting…") with your body, team and score. Silent connections are noticed within 20 s. Hosts can change the idle time (`AFK_SECONDS`, 0 off).
- Profiles: signed in, pick a username (unique) and a region in Profile. Your username is your name in every match, marked ✓ as a verified account; other players show GUEST. Your Google name is no longer shown anywhere.
- The game browser lists games in your region first and shows each game's region.
- Protections on every host: players idle for 10 minutes are removed (`IDLE_KICK_MINUTES`); at most 10 joins a minute from one network (60 in all), 4 players from one network at once, one place per browser; connections that never say hello are capped. (MULTIPLAYER_SECURITY.md)
- Hosting online: the status line (listed or code only, players, join code) moved from over the score and clock into the Tab scoreboard.
- Hosting from a phone warns that the match stops if the screen turns off.

**Maps**
- The owner publishes maps from MapMaker: signed in as the owner, official maps open as they are (not as a remix) and **Publish** puts the new version live for everyone (the map list, new matches, MapMaker, Host Services), or adds a new official map. The hub checks every map itself and keeps every earlier version (Restore, or back to the built-in one). Only the owner's account can publish; players still upload nothing. A daily workflow copies published maps into the repository on a check branch.
- Your account ID: click **Signed in as …** in the main menu to copy it.
- Removed the maps imported from TimeSplitters MapMaker saves (and the `?imported` list): they didn't convert well. The importer and its tools went with them. Our own homage maps are unchanged.

**Menus**
- Map select: every map card is the same size (picture on top, then the name beside the top-down plan); the map's description and modes moved to the setup panel beside the list. Cards no longer stretch with the number of modes or show their picture off-centre.

**MapMaker**
- Moving builds: a mover and the blocks and props it carries are selected, moved, rotated (about the mover, route included), duplicated (the copy carries its own blocks) and deleted as one piece; Alt-click picks a single part. The *Carries* list always shows every carried block. Duplicating a portal pair links the copies to each other.
- Every map, our own included, is now its map file, made and edited in MapMaker: the official maps' build scripts are retired, so an edit made in MapMaker is never overwritten.
- Fixed: placed props drew white (untextured) once you moved on to placing a different prop: the placement preview disposed the materials and textures every copy of its model shares.

**Hosting**
- Tile Trigger Host Service (`packages/host`): a dedicated host on your own computer that people join from trigger.toshiroplay.com (game browser or join code) with no port forwarding, certificates or browser tab. It registers on the hub's broker like a browser host, connects players over WebRTC (node-datachannel), takes TURN credentials from the hub, lists itself as a **Dedicated host**, reconnects after losing the hub (players in the match carry on), and runs the match in a supervised process (restart after a crash or hang, crash-loop protection).
- One download per OS (Windows, macOS, Linux: Node runtime + service + maps, no install) built and attested by CI; double-click opens a server console (live log, `help`, `players`, `kick`, `ban`, `map`, `bots`, `say`, `visibility`, `stop`…), logs rotate in `logs/`. `pnpm host` runs it from the repository.
- `/host` page (Online → Host a dedicated server): hosting in the browser (nothing to install) or the optional Host Service; the download is offered only there, and the page looks for a Host Service on this computer only when opened. Paired with the service (key in the link its window shows), it starts, stops and restarts the server and kicks or bans players. Its control API listens on 127.0.0.1 only, for the official site's pages.
- Kick and ban for dedicated servers, Host Services and Host game hosts (pause menu → Match → Players). Bans hold signed-in players by account (hub-signed account tickets; the host never sees a sign-in token) and guests by browser key and address (weak).
- Listings can't pass for official: names claiming "Official", "ToshiroPlay" or "Tile Trigger" are refused.
- The Host Service launcher: starting the Host Service opens its own page in your browser (on this computer only, in the site's look) with the server console (live log with filters, a command line with suggestions, Tab completion and history) and a right bar of controls: start, stop, restart or end the match; map with its picture and modes; players and bots, team size, people at most; game browser name and visibility; the people playing (kick, ban); a message to everyone; the admin token and bans. Each control runs the console command it shows, and the console window keeps working alongside (`launcher` opens the page again; `--no-open` skips it).

**Loading**
- The first visit shows the main menu much sooner: it downloads about 0.75 MB of JavaScript (gzipped) instead of 4.4 MB. Maps load one at a time when played, opened or drawn (the menu reads a build-time index); the match, MapMaker and Character Designer load when first opened, and the match code and the map Play opens on are fetched while the menu sits idle. Physics starts with the match, WebGPU's engine only when asked for, glTF extensions only when a model uses one. The match worker reuses the page's physics download (docs/LOADING.md).
- CI checks a budget for the JavaScript loaded before the menu (`tools/ci/bundle-budget.mjs`); `tools/perf/first-load.mjs` measures time to the menu and Play → in match on a throttled network.

## 0.3.0 (2026-10-27)

**Bots**
- Safer spawns: spawn points scored on enemy distance, occupancy, recent use and sightlines; big matches spawn in waves and add extra navmesh spawn points when a side has too few.
- Squads of 3–6 with a leader and their own route; each side explores the map's regions; roles: campers, snipers (scoped, long sightlines, relocate after a kill) and lone wolves.

**Multiplayer**
- Browser-hosted 48v48 with friends is playable: friends merge a snapshot backlog instead of falling behind, snapshots send only what changed (about half the upload), compression runs in the match worker, and far players move smoothly between updates.
- Network protocol 4 (delta snapshots): 0.2.0 clients can't join 0.3.0 hosts or servers.
- Privacy page (/privacy).

**Hosting**
- The Lightsail box no longer builds the site. CI packages each green build (reproducible tarball, build.json, SHA-256 sums), attests it with Sigstore build provenance and publishes it to GitHub Releases (`main-latest`, `vX.Y.Z`, `check-builds`); `sudo tiletrigger-update` downloads the build for the exact commit, verifies it, switches to it in seconds and rolls back on a failed health check (`--rollback`, `--release`, `--status`; optional hourly timer). `--build-here` is the only way to build on the box.
- The hub restarts only when its own code changes; a site-only update is served at once. It runs as one Node process with production dependencies only.
- The hub only serves files inside the site folder (a sibling folder whose name starts the same is no longer reachable).

## 0.2.0 (2026-10-27)

**Gunplay**
- Arcade feel pass on the seven benchmark weapons (pistol, heavy revolver, SMG, rifle, shotgun, precision rifle, rockets); shotgun pellet fix; lighter movement spread; bullets slowed by water.
- The Training Range is now the gunplay test arena.

**Big matches (up to 48v48)**
- The match runs in a Web Worker; bot AI is cheaper in clumps.
- Characters draw as 2 meshes; destructibles, pickups, props and foliage are batched; far characters animate at a lower rate and cast no shadows in crowds.
- Snapshot catch-up merging and non-blocking texture reads cut warm-up stalls.

**Look and feel**
- Smoother running and strafing (planted feet, blended gaits), smooth remote movement, even frame pacing.
- Glass that reflects, cracks and shatters (breakable and bulletproof); new water with waves, shoreline foam and splashes.
- Menu rifle grip and first-load flicker fixes.

**Content**
- Match setup screen: 2–8 teams of any size, saved setups, Host button.
- Map pictures and plans for every map; Set thumbnail in MapMaker.
- MapMaker palette: colour-coded tabs, picture atlases, search, favourites.
- Wild West, dungeon and fence packs; fence and wall borders; Mercy Ward and Dustwater redressed.
- New characters: Goblin, Wealthy Otter, Boglurker, Salamander Warlord, Hyena Warrior, Elder Tomo, The Visitor, Biscuit, Flt. Lt. Ember, Cap'n Barnacle, Big Bogdan.
- New models: Ironclad revolver, Spin Gun, arc-cannon turret; oak, birch, fir, banana plant, shrub, fern, eelgrass, rock spires, rock pile, control cabinet, burnt-out car, dinosaur statue.
- Map review: 10 maps removed, 9 retired.

**Online**
- Multiplayer direction, review, security and protocol docs; CloudFormation template and CloudShell deploy script for the Lightsail hub and relay.

## 0.1.0

Everything before versioning started.
