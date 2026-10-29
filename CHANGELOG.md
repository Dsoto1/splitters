# Changelog

Tile Trigger uses [semantic versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
Until the public launch (1.0.0), a minor bump marks a release with new features
and a patch bump a fix-only release. The version shows on the main menu
(`packages/client/package.json`). Each release is a git tag `vX.Y.Z` on `main`,
made only on a commit that passed CI on a check branch.

## Unreleased

**Performance**
- Kills no longer stall big fights: the kill feed's weapon pictures ship with the site instead of being drawn from each gun's 3D model the first time someone dies by it (each one built a model, compiled its shaders and read the picture back from the graphics card in the middle of the fight). In a 96-player brawl that was the biggest single cost on the page.
- Sparks, dust, smoke and blood are reused instead of made and thrown away for every hit (a brawl made about a thousand a second, and throwing one away searched all twelve thousand of the characters' running animations). Sparks in the air at once are capped at 600 and blood drops at 500, which look the same in a crowd.
- Bullet holes: a hit sends only the new hole to the graphics card, once a frame, instead of all 700 every hit.
- Parachutes and gliders are reused, with shared materials, instead of built for every player who drops in.
- Blood and dust cast no shadows (they are effects), and their shaders are built while the match loads, not at the first kill.
- Together, in a 96-player brawl with 53 characters in view, the page's main thread went from busy most of the time to idle about three quarters of it.
- Fewer draw calls in big fights (St. John's, 48 players): about 1,280 main and 130 shadow draws became 440 and 160 on Medium; on High 2,060 and 885 became 780 and 160.
  - Medium: a map's ground mist thickens the ordinary distance fog instead of drawing the whole scene a second time for depth (30 maps have mist).
  - High: the sun's light shafts are blocked by big things only (buildings, terrain, trees), not by every mesh in a second pass.
  - Shadows: each shadow map, and on High each of the three cascades, draws only what falls inside it and skips things smaller than a few of its pixels. The far cascade alone was drawing over a thousand props. High's shadows reach 120 m, not 160, and Medium's shadow area sits ahead of you instead of around you.
  - Wall-hit dust and blood mist draw as one batch each instead of one draw per puff.
- On a slow frame, effects age by the clock instead of living several times longer while new hits kept coming (which made slow frames slower). Dust, smoke and mist are capped.

**Bots**
- Your own bots: name them and pick each one's look (a portrait picker), skill, style, team and squad, in a small Bots window from Play → Match setup → Bots and from the pause menu (Bots…, live: changes swap in a bot at a time). Fill the rest with random bots or play only these. Built-in sets (Knights vs Space Crew, Zombie horde, Classic mix) and sets you save in your browser. Bots in a squad stick together and follow their leader.
- Dedicated hosts: `BOTSET` (a built-in set, a JSON file or a list), the console's `botset` and a Bots card in the Host Service launcher.
- Scenario maps can carry their own bots (MapMaker → map properties → Bots); they play unless the host picks a set.

**Matches**
- A match in the browser (offline or Host game) takes at most 48 players (24 v 24): every bot thinks and every character draws on that one computer. Dedicated hosts keep 96 (48 v 48). Bigger saved setups shrink to fit, and the "very big match" warning starts past 40.
- Bots driving a vehicle follow a road or route that runs their way: they keep to the right-hand side of two-way roads, never drive a one-way path backwards and keep to its speed limit.

**MapMaker**
- Paths: the road follows its line, corners join cleanly without kinks or folds, the handles sit on the road, are drawn over everything, light up under the pointer and are easy to grab at any zoom, and clicking another path selects it. Roads past the buildings get ground (and collision) under them.
- One Paths tool for roads, the race track and routes. A path can be a road (drawn), the race track, a route for the AI (dashed in MapMaker, never drawn in the game), or several at once. Join a path's ends into a loop by clicking its first point with the last selected (or Close loop); Open and Reverse direction in the pane; arrows show which way each path runs. Paths can be one-way and carry a speed limit for driving bots. The race track's settings (laps, grid, vehicle, curbs, combat, ambient cars, start line, pit lane) live in the same pane; the separate Road tool is gone (Vehicles → Race Track and Shift+G open Paths on the race track). An open race path is a point-to-point race.
- NPC squads can patrol a route: give them the patrol order and pick the route in the inspector (or draw a new one). They walk round a loop, or there and back along an open route.
- Maps are format 23: older maps' race tracks become race paths when they load, and race exactly as before.
- Paint works at any zoom: zoomed out, it hit the map's invisible boundary walls (the big yellow slab). It also paints terrain ground now, with a brush ring.
**Hosting**
- Map rotation for regular matches: whoever runs a match (offline, Host game, a dedicated server's admin) keeps a list of up to 20 maps of our suite, each in a mode, in pause menu → Match → **Rotation**: Add map… (the map picker), remove, move up and down, start from a preset, Shuffle, and **Skip to next**. When a match ends, after the scoreboard everyone goes on to the next map instead of replaying it, round and round; the panel says "Next up: <map> · <mode>". An empty rotation replays, as before; a co-op playlist still moves on only when a map is won.
- Everyone's end-of-match scoreboard says where the match goes next ("Next map: Diamond Park (Capture the Flag)"), guests and online players too.
- Five built-in rotations to start from (maps/rotations/): Deathmatch Classics, Team Deathmatch Tour, Flag Run, Objective Mix and Big Battles (shuffled).
- Dedicated hosts: `ROTATION` (environment or config file: `frost_basin:tdm,diamond_park:ctf`, or `preset:flag_run`) and `ROTATION_SHUFFLE`; maps that aren't ours and modes a map can't play are dropped with a log line. The console has `rotation` (add, remove, move, preset, shuffle, clear) and `skip`; the launcher has a Rotation card that edits the list (the next Start's while stopped); changes made in-game are kept for the next start.

## 0.5.0 (2026-10-29)

**Performance**
- Effects no longer slow fights: muzzle flashes, hits and explosions cast no shadows (they were most of a fight's shadow casters, each drawn twice), and each effect is built while the match loads instead of stalling the game the first time it appears (the first explosion of a match stalled for a moment).
- A performance overlay (F3, or Options → Display → Performance overlay): frame rate, how long frames take (average, slowest 5 %, worst), hitches over 50 ms in the last minute, where a frame's time goes (simulation, network, game, rendering), what it draws (draw calls, meshes, shadow casters, characters, effects) and your graphics card. Pause → Settings → **Copy performance report** puts the last minute of all that, with your browser, screen and settings, on the clipboard to send.
- Big fights stutter less: another player's first shot built their muzzle flash in tens of milliseconds with 96 players (each new material walked every mesh in the scene, and every piece was a deep copy); now under 3 ms. Hits and explosions start faster too.
- CI now also fails when an effect lands in the shadow pass, when a 96-player fight averages more than 600 shadow casters, or when starting any effect takes over 40 ms.

**Menus**
- Character portraits fixed: hats and helmets were drawn as see-through rings, hoods and hair as mosaics, and some faces were missing. The portrait renderer's camera didn't match the game's reversed depth buffer, so the farthest surface won (and characters had been turned round to hide it). All 40 shipped portraits were rendered again, Capt. Nova's included; MapMaker's piece pictures, drawn by the same kind of camera, were rendered again too.
- Character Select fits its space: the grid fills the room down to the character panel and scrolls (a fade shows there's more) instead of cutting a row in half, faces fill more of each tile, and the shipped portraits appear at once instead of waiting for the few drawn live.
- Options, redone: a wide panel with its sections down the side (General, Display, Controls, HUD, Online; Q / E step through them) instead of one long thin column. Every setting is a row: what it is and what it does on the left, its control on the right; on/off settings are switches; keyboard and controller bindings are listed apart, in two columns.

**Disc Arena**
- Discs are picked up like ammo: a disc no longer flies home by itself. It drops where its flight ends (after its bounces, or at the feet of whoever it hit), and anyone short of three picks it up by walking over it. A disc lost over the void, or left lying 15 s, goes back to its thrower; the player it just hit can't grab it for a moment. Bots fetch discs whenever their hand isn't full.

**MapMaker**
- Objects and NPCs preview where they'll go before you click, like props: doors, walls and lasers in the doorway they snap to, pads, traps, lights, movers with what they carry (a whole train), squads with their area. They turn with R.
- Placement previews of models (props, vehicles, a train's locomotive) are really see-through now, and every preview goes away when you switch to another tool.

## 0.4.0 (2026-10-28)

**Effects**
- Muzzle flashes from Binbun's Muzzle Flash VFX (CC0): each gun family has its own flash (short, wide, big, star), drawn on your own gun and on other players' within 45 m (on up to 8 guns at a time; the plain star beyond). Your own is in front of the muzzle at the barrel's height, so the gun never hides it.
- Hits and explosions from Binbun's Stylized Hit FX and Explosion FX (CC0), played by a small player for the packs' Godot particles and shaders: melee hits on bodies, where railgun rounds land, explosions and vehicles blowing up (at most 10 at once).

**Fixes**
- Busy matches no longer freeze: a full hit or explosion effect used to keep trying to add particles for ever (the page stalled, and hosted and dedicated games dropped their players).
- Terrain never shows through a floor: wherever a floor lies over the ground (or within 3 m above it), the ground is lowered just under it, on every map load and with every MapMaker edit of tiles, blocks or terrain (same undo step). Ground flush with a floor made streaks and patches; 16 maps had some.
- Switching to third person shows your character at once: your body stays loaded (hidden) while you play in first person, instead of being built again and standing in as a grey capsule meanwhile.
- The public site no longer makes your browser ask to "access other apps and services on this device" when you open Online: looking for servers on your own computer (LAN) now waits for **Scan**. Pages served from your computer or network still scan by themselves.
- MapMaker: ground floors no longer drawn see-through with the terrain showing through them (Sandgate's rooms looked mossy and streaked in MapMaker but not in play). Floors are put on a level by their top, not their bottom.
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

**Infrastructure**
- The cost budget counts only this project's costs by default (filtered on the `Project` cost allocation tag, or `AppName` with `--budget-tag`; `--budget-scope account` for the whole account). The instance carries both tags.
- No Cognito IDs in the repository: the deploy looks up the shared pool (from its login domain) and Trigger's app client (by name) each run; the hub hands the page its sign-in settings at `/auth-config.js`.
- Removed stray `*.orig` files and ignored them.

**Hosting**
- The Host Service's launcher opens in a window of its own (Edge or Chrome in app mode: no tabs or address bar) instead of a browser tab; a tab is the fallback (`--browser` or `HOST_APP_WINDOW=0` to always use one). Closing it leaves the server running; `launcher` opens it again.

**MapMaker**
- Paths: draw any number of roads, streets, dirt trails, cobbles, flagstones, gravel, sand and boardwalks (Terrain pane → Paths & Roads). Click points, drag them, Shift-click to insert, right-click or Del to remove; style, width, loop and "lay into the ground" per path. Laid paths level the ground along them (following the hills, smoothed), blend their edges and paint the ground under them when the map loads, so moving a path in MapMaker takes its dip with it. Every change is one undo step.
- The palette and the side panel fold away (tabs on their inner edges, \\ and Shift+\\).
- One way to work across tools. Right-click takes back what the tool does (Paint and Walls reset, Scatter clears, Paths, Road and routes remove a point, a placing tool removes a thing of its kind); with Select it opens a menu (Rotate, Duplicate, Focus, Delete…).
- Paint, Walls, Scatter and Erase work as you drag, and a drag undoes in one step. Shift does the opposite (reset, clear), Alt picks (a style, or one piece of a moving build), and Ctrl places without snapping for every placing tool.
- Placing shows a see-through preview of props, vehicles, spawns and pickups where they will land (on the terrain under the pointer, else the level's floor), and dragged things preview where they land.
- Rotation steps per kind everywhere (R, Shift+R for fine steps, the inspector): spawns 45°/15°, props and vehicles 15°/5°, tiles, zones and liquids 90°. Groups turn about their centre.
- Mover and plane routes are drawn on the map with the same hands as Paths.
- A key for every tool (G Paths, Shift+G race Road, N Scatter); Page Up/Down only change level and [ ] only the brush size. One hint line per tool says what click, right-click, R and the modifiers do.
- One home per pane: Nature and Terrain are only in Environment, the backdrop in Environment → Sky; inspector walls and surfaces use the Walls and Paint tools' own options. Undoable removals no longer ask for confirmation.
- Faster edits: an edit rebuilds only what it changed (no terrain rebuild for a moved prop: most of an edit's time on big maps), and terrain meshes build several times faster.

**Menus**
- Match setup, reorganised: the map list has a tab per game mode, a search box, sorting (Featured, A–Z, Size, Favourites), a grid or list view and a star to keep favourite maps (remembered in this browser). Every card is the same size: picture (Featured badge, star), name, a row of short mode tags and the plan. The setup panel goes step by step: Game mode (icon tiles) → Players & teams → Bots → Advanced rules; the step you're on is open, finished ones fold into a line with a check mark (click one to go back), and Start match and Host are always there. The header shows the players and how long the match runs.
- A start-up loading screen (the logo, a progress bar and what's loading) stays until the menu is really ready: the graphics, fonts, the menu scene with your character, the character portraits and the first map pictures. Nothing pops in after it goes; it never waits more than 12 s, and a match or MapMaker opened by a link takes over at once.
- Character Select loads at once: portraits of the built-in characters ship with the site as small pictures (rendered by the "Capture portraits" workflow with the menu's own renderer) instead of being built from each 3D character in your browser; your own designs are still drawn live.
- Portraits framed for any body: head and shoulders from the neck joint to the top of the model (the otter, the cat and big helmets no longer show an eye or a cheek; soldiers keep their heads), and creatures whole from a three-quarter view.
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
