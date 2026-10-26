# Roadmap v1 (from the "splittsv1" notes, Oct 24)

Everything from the notes, sorted into work streams and ordered into sprints.
Each item is tagged **[bug]**, **[feel]**, **[feature]**, **[content]** or
**[platform]**. Items marked ✅ partly exist already; the note says what's left.

Ground rules that still apply: no generative-AI assets, only CC0 / credit-only
human-made assets (plus the approved Quaternius packs), no ripped game assets.
Recreations of famous maps are layout homages built from our own kit, shipped
under our own names (as in `HOMAGES_FPS.md`).

---

## Sprint 1 — Bugs and feel (start here)

Things that make every playtest worse. Small, high value.

| # | Item | Notes |
|---|---|---|
| 1 | **[bug]** Crouching sinks players slightly into the floor | Capsule shrink isn't re-seated on the floor; fix in `physics.moveCharacter`. |
| 2 | **[bug]** Standing up from prone/crouch | Check the headroom/stand transition and the camera eye easing. |
| 3 | **[bug]** Seams flicker where building sections meet | Coplanar faces between neighbouring tiles; merge/shave shared faces at build time instead of the per-box nudge. |
| 4 | **[bug]** Tab away and back → frozen game with red blobs everywhere | Huge frame `dt` after a hidden tab: clamp `dt`, pause effects physics while hidden, cap blood/debris spawn per frame. |
| 5 | **[bug]** Safari mouse still very slow; no sensitivity setting | Safari reports smaller `movementX`; add a per-browser scale and a **mouse sensitivity slider** (+ invert Y) in Options/pause. |
| 6 | **[bug]** Crosshair setting shows the wrong thing in game | Wire the chosen crosshair through; add **hit-marker options** (incl. an Infinite-Warfare-style marker). |
| 7 | **[bug]** Map select jumps to the top of the page and you click the wrong map | Keep scroll position; confirm with a separate Play button. |
| 8 | **[bug]** Shooting upward, bullets look like discs | Streaks are billboarded flat; use a stretched, camera-facing ribbon along the travel direction. |
| 9 | **[bug]** Bots sway left/right while shooting at you | Aim drift + strafe both applied to the body; damp body yaw, keep drift on the aim only. |
| 10 | **[bug]** Some characters look like they shrink | Check LOD switch / per-look scale. |
| 11 | **[bug]** Boulders and some props block movement badly | Collision boxes too big or unclimbable; tighten boxes, allow stepping over low rocks. |
| 12 | **[bug]** NPCs travel in one clump then spread at once | Add separation between agents (players and NPCs can't share a spot) and staggered spawning. |
| 13 | **[bug]** Imported TS maps are mostly empty, one renders wrong (sky below / mirrored) | See Sprint 6; until then **hide the imported/original maps** from the map list, as you asked. |
| 14 | **[feel]** Bodies fling too much | Lower ragdoll impulse on death, more damping. |
| 15 | **[feel]** Damage direction indicator | Red edge flash/arc pointing at the attacker. |
| 16 | **[feel]** Railgun doesn't feel good | Charge sound, heavier kick, thicker beam, through-wall spark trail. |
| 17 | **[feel]** Knife: how it's held, the slash and its sound | New grip pose, swing arc, CC0 slash/hit sounds. |
| 18 | **[ux]** Team colour: own team in a calmer colour, enemies obvious | Setting for ally/enemy marker colours. |
| 19 | **[ux]** Pause shows map name; Tab scoreboard shows map, mode, time left, team scores | |
| 20 | **[ux]** Version number under the logo on the main menu | |
| 21 | **[ux]** MapMaker: the giant green box | That's the **map boundary** volume. Make it a thin outline unless the Boundary tool is active, and label it. |
| 22 | **[ux]** MapMaker: reset camera button / Home key; zoom can't pass through the map on a touchpad | Clamp zoom, add "frame map". |
| 23 | **[ux]** MapMaker: preview the piece under the cursor before placing | Ghost of the actual model (tiles already ghost; props/entities don't). |
| 24 | **[ux]** MapMaker: is ▶ Play the same as Test? | Merge into one clearly named button. |
| 25 | **[ux]** Vehicle with a gun needs a proper reticle | |

### Sprint 1 status (Oct 24)

Done: 1–9, 11–16, 18–25 (crouch/prone stand-up, seams, tab-away freeze, mouse sensitivity + Safari scaling,
crosshair styles + hit markers, map list scroll, upward bullets, bot hip-swing, climbable boulders,
squad spacing, imported maps hidden, calmer ragdolls, damage indicator, railgun, team markers,
pause/scoreboard info, version number, MapMaker boundary/preview/camera/Play Test, gunner's reticle).

Left for later: **10** characters that look like they shrink (needs a repro), **17** knife grip, slash and
sounds (needs new CC0 sounds and a grip pose).

## Sprint 2 — Gunplay, weapons and characters

| # | Item |
|---|---|
| 1 | ✅ **[feature]** Aim down sights on every gun (ADS pose, FOV zoom, lower spread); longer zoom levels on some scopes — RMB aims (V / middle mouse = alt fire), wheel steps scope zoom |
| 2 | 🟡 **[content]** Many more guns, with better firing/explosion FX — guided rocket, medkit, grapple and five specials added; more guns and an FX pass still to do |
| 3 | ✅ **[content]** Worms-style weapons: holy-grenade-style bomb, banana-style cluster, sheep-style walking bomb, airstrike, ninja rope (the grapple) |
| 4 | ✅ **[content]** Heavy weapons, including a **guided rocket** (Half-Life-style laser guided: the rocket follows your aim) |
| 5 | ✅ **[feature]** Grapple hook — fire at a surface within 32 m and get yanked toward it |
| 6 | ✅ **[feature]** Jetpack fuel (already uses fuel and recharges) — HUD gauge shows it |
| 7 | ✅ **[feature]** Medical tool: heal yourself and teammates (Medkit pickup: aim at a hurt teammate, or use on yourself) |
| 8 | ✅ **[feature]** Deployable cover: sandbags (throwable, lands as a waist-high wall that can be shot or blown apart) |
| 9 | ✅ **[feature]** Hit boxes scale with the character (big skins bigger, small "oddjob" types smaller) — Small / Standard / Large with speed and health trade-offs; arcade setting to turn off |
| 10 | ⏳ **[content]** More character variety: police, army, animal skins, tuxedo and Siamese cats (our monkey slot) — needs licensed human-made models (Quaternius / CC0); none in hand yet |
| 11 | ✅ **[feature]** NPC characters selectable as player skins — NPCs tab in Character Select (soldiers and creatures; looks only) |
| 12 | ✅ **[feature]** NPCs: custom health/attack values and scalable sizes in MapMaker — Health / Damage / Size % on each encounter |
| 13 | ✅ **[feature]** Clan tags on names (Options) |
| 14 | ✅ **[feature]** Emotes (dance etc.) and quick-message pop-ups, with a server setting to turn them off — B: messages, N: dance; arcade "Emotes & messages" |
| 15 | ✅ **[feature]** Squad/team support: UAV pickup; kill streaks (3 UAV, 5 Supply Pulse, 7 Counter-UAV, 9 Airstrike); pings (T); "Follow me!" / "Hold here!" order your team's bots; respawn beside a teammate out of the fight (arcade toggles for streaks and squad spawns) |

## Sprint 3 — AI

| # | Item |
|---|---|
| 1 | ✅ Cover, crouching, sniping, hanging back (shipped in the AI rework) — tune so **better bots use it more** — cover chance now scales steeply with skill (easy ≈ 60%, normal/hard always); crouching at range needs some skill; top tactical bots go prone on long scoped sightlines |
| 2 | ✅ **[feature]** Per-character stats/tendencies drive strategy and weapon choice — every preset character has its own bot profile (traits, style, favourite weapons); Character Select shows "As a bot: …" |
| 3 | ✅ **[feature]** Alternative bot "personalities": arena-style (Quake 3 feel: strafe-jump, item timing) and tactical (Counter-Strike feel: objectives, economy-free rush/hold) — arcade "Bot style": Mixed / Arena / Tactical |
| 4 | 🟡 **[feature]** NPC/dino/orc roamers for themed maps — new "roam" squad order + "Roaming Monsters" MapMaker preset (works with every NPC); dino/orc models still needed (Quaternius packs) |
| 5 | ✅ **[tune]** Audit pass (Oct 25, `packages/shared/test/botAudit.test.ts`, 8-bot TDM on 12 maps): bots give up on noises and chases they can't reach (stuck stands 47 → 2); with only a sidearm they fetch a gun within 30 m first (armed 14–35% → 37–78% of the time); they see and shoot hostile sentries (Canyon sentry deaths halved); they take a vehicle parked beside them for the push to the far side (Frost Basin 0 → 8 rides, St. John's 1 → 7) |

## Sprint 4 — Modes, matches and servers

| # | Item |
|---|---|
| 1 | ✅ **[feature]** 48 v 48 (96 players), and **players take over bots** in live matches — 96 slots, Arcade teams up to 48 (48v48 preset); joining players take over a bot where it stands (team that needs a person, same body, loadout and score, "X took over Y" in the feed) on dedicated servers, Host game and LAN; a bot takes a leaver's place back (`BOT_TAKEBACK`); interest management (far players at 15/7.5 Hz), bot think budget, crowd animation LOD and a ragdoll cap; `pnpm bench:96` (Frost Basin avg tick 9.3 → ~7.7–8.1 ms; HOSTING.md) |
| 2 | ✅ **[ux]** Team setup: host defines teams (count, size, name, colour, leader) instead of a long dropdown — ✅ Arcade: each team's name and colour beside its size (+/− teams, presets). ✅ Team leaders (More rules): first person leads (else a bot), gold star, team-wide Follow me / Hold here; Leader hunt variant scores for downing a leader |
| 3 | ✅ **[feature]** Friendly-fire toggle and many more match settings — friendly fire (off/half/full), gravity, fall damage, kill streaks, squad spawns, bot style, emotes, body sizes |
| 4 | ✅ **[feature]** Elimination: spectate remaining players or your corpse after you're out — out of an Elimination or Bomb round you watch a living teammate from over their shoulder; Space cycles |
| 5 | ✅ **[feature]** Fort-building mode like SourceForts (build phase then CTF) over any map — **Fort Wars** (`core.forts`, docs/GAME_MODES.md): build phase behind a midfield force field with the Builder (8 pieces on a 0.5 m grid, team build points, pick up to refund), then CTF; pieces break (explosives best); arcade build/combat time, cycles, budget; bots build a template fort then play CTF (navmesh rebuilt round the forts on maps up to ~150 m, they shoot enemy walls in the way); new map **Fort Meadow** |
| 6 | ✅ **[feature]** Ricochet-style mode (disc arenas) and a Team Fortress-style class mode — **Disc Arena** (`core.discs`): bouncing arena discs that come back, hits knock you about (no damage), a knock into the void scores for the thrower; power discs (fast, triple, splitting, freeze); demo map **Grid Rings**; bots lead throws, dodge discs, mind the edges. **Classes** (Arcade "Classes", any weapons mode): nine classes (Runner, Rocketeer, Torch, Breacher, Bulwark, Mechanic, Medic, Marksman, Shade) from the existing arsenal plus three variants; class screen (L, keys 1–9 or click) on join and when down; per-team limits; Mechanic sentry + dispenser, Medic beam + overcharge, Shade cloak + backstab; bots fill a balanced mix and use the abilities (docs/GAME_MODES.md) |
| 7 | ✅ **[feature]** Race mode + **road/track tool** in MapMaker (draw road, set laps); podracer-style race with shooters on the side — `core.race`: grid start in a vehicle, countdown, ordered checkpoints, laps, places, best lap, wrong-way warning, back at the last checkpoint when wrecked or stuck; clean or combat race (vehicle guns, sideline sentries); MapMaker Road tool (format v18 `track`: points, width, laps, grid, vehicle, lay into terrain); road ribbon with curbs and arches, better grip on the road; bots race with a reusable `TrackDriver`, which also drives optional ambient NPC cars in any mode; Sandsweep Circuit (docs/GAME_MODES.md) |
| 8 | ✅ **[feature]** Tribal spear mode: only throwable spears, hold one, one-hit impale, go fetch more — Arcade "Weapons: Spears only" (any mode); spears stick where they land or drop under whoever they hit, anyone out of spears picks one up; bots fetch them |
| 9 | ✅ **[feature]** Bomb and hostage modes — ✅ **Bomb**: rounds; attackers (first team) carry the bomb (drops on death), plant at a Bomb Site (E, hold still 3 s), 40 s fuse, defenders defuse (E at the bomb, hold still 5 s); new MapMaker "Bomb Site" (format v13); Sandgate has sites A and B; bots plant, defend and defuse. ✅ **Hostage Rescue**: rounds; rescuers (first team) press E beside a hostage and lead it (it follows along the navmesh) to a Rescue Zone; half the hostages wins; new MapMaker "Hostage" and "Rescue Zone" (format v14); Dockside Depot (cs_assault homage) has four hostages; bots fetch and escort them |
| 16 | ✅ **[feature]** Zombies: wave survival on any map (docs/GAME_MODES.md) — zombie NPC kind with UAL2 zombie clips |
| 10 | ✅ **[feature]** Co-op/scenario chains: link scenarios through a playlist or custom link — playlists in `maps/playlists/` (Night Shift: four co-op maps), Arcade → Playlist, `PLAYLIST=` on servers; MapMaker "Next map" action (suite maps only, checked by host and server); score and weapons carry over; servers change map CS-style (clients reconnect) |
| 11 | ✅ **[feature]** Easier LAN: show the join address on the host screen, auto-discover games on the LAN — servers print their LAN address and show it (Copy) in the pause menu; `GET /info` on the game port; Online → LAN lists servers (direct probe of known hosts, and a hub on the LAN broadcasts UDP for the browser); https pages only reach localhost (HOSTING.md §3) |
| 12 | 🟡 **[feature]** Custom maps on servers, CS-style: maps travel with the join (already true); cache them by content hash, "Save this map" to your MapMaker library (author's choice), server list shows map name + preview. **Maps only, built from our suite — no custom assets** ✅ Game browser for player-hosted games (community hub: broker + list, `pnpm dev:hub`, docs/HOSTING.md). Next: official servers in the list, map caching. |
| 13 | 🟡 **[tech]** Smaller snapshots (binary + delta) — ✅ dedicated server compresses its messages (~4× smaller snapshots). Still to do: binary + delta for player hosting (WebRTC) and bigger matches |
| 14 | 🟡 **[feature]** Player-hosted matches: ✅ "Host game" (pause menu) gives a 6-letter code + invite link; friends join by link or Online → Join by code and take bots' places (WebRTC data channels, PeerJS broker; `pnpm dev:peer` + `?peer=` for your own). ✅ TURN relay setting (Options → Relay; invite links carry it), clearer join errors, host re-registers its code after a network blip. Next: a built-in relay so nobody has to set one up, smaller snapshots (#13), host in a worker |
| 15 | **[tech]** Multi-match launcher: one process per match, a few per core, plus a lobby/server list for public dedicated servers |

## Sprint 5 — Vehicles

| # | Item |
|---|---|
| 1 | 🟡 **[feel]** Driving physics: suspension, weight, gravity, air time — ✅ momentum and drift (per-vehicle grip; hovercraft glide), handbrake powerslides (jump), speed-sensitive steering, ramps launch you, little air control, hard landings damage, weight softens crashes; drawn suspension (slope tilt, squat/dive, lean, landing bounce); ✅ vehicle-vs-vehicle ramming (damage by closing speed and weight, crash sound). Next: per-vehicle tuning pass in play |
| 2 | ✅ **[feature]** Damage states (smoke → fire → wreck) and **explosions with blast radius that hurt players** — smoke under 60%, black smoke and sparks under 35%, fire under 15% (burns down on its own, "bail out!" warning, credit to the last attacker); layered fireball, shockwave, debris and camera shake; blasts chain into other vehicles, barrels and explosive props; a charred wreck stays as solid cover for 20 s; lava ignites, deep water floods; Vehicle damage setting (normal / tough / off). See docs/VEHICLES.md |
| 3 | **[content]** New vehicles: military transport, cars, trucks, bus, Halo-style flyers (reference board: "24 vehicle lineup") — each lineup entry maps to a handling class we already simulate: **wheeled light** (Scrap Buggy, Gun Jeep, Golf Cart, Attack Trike, Scout Bike, Victorian Car, Ice Cream Truck, Forklift), **wheeled heavy** (Armored Rover, Halftrack, Desert War Rig, Steam Tractor, Pirate Landship), **tracked** (Mini Tank: slow, turns on the spot), **hover** (Hover Skiff, Hover Bike, Hover Tank, Snow Sled, Alien Saucer), **flyers** (Dropship, Gunship: new flight model needed), **walkers/mounts** (Walker Mech, Dinosaur Mount, Roman Chariot: legged animation, new). Needs human-made models (Kenney Car Kit / Quaternius packs) — no generated art |
| 4 | **[feature]** Gliders and parachutes; an airplane set piece you can spawn in and jump out of |
| 5 | **[feature]** Vehicle upgrades and cosmetic skins (from the reference board) — later |

## Sprint 6 — Maps

### 6a. System maps (fix what we have)
- Most system maps and the co-op scenario are **too small** — scale them up.
- **Size and spawn audit (Oct 24)** — playable area, smallest first:

  | Map | Size (m) | Spawns | Team bases | Modes | Action |
  |---|---|---|---|---|---|
  | Phase0 Arena | 27×27 | 8 | — | DM | ✅ Relabelled as a 2–4 player duel map (the right size for one) |
  | M3 Vault | 43×19 → ~51×35 | 8 → 14 | — | DM | ✅ South hall, west passage and north rooms loop round the heist route (unchanged) |
  | Creature Lab | 27×36 → 40×48 | 4 | — | Co-op | ✅ Deck, specimen bay and containment hall; one wave each |
  | M4 Outpost | 43×24 → 43×40 | 4 | — | Co-op | ✅ Flank routes with patrols, deeper siege rooms; gate and evac logic unchanged |
  | Citadel | 36×35 → ~50×50 | 10 → 16 | — | DM | ✅ Outer bailey of courtyards behind a curtain wall; the keep's corners are its gates |
  | Ridge Camp, Felicity Yard, Lantern Quarter, Silo Complex, Step Temple, Bottling, Skyward, Sky Islands | 44–91 per side | 8–13 | **none** | DM, TDM | Add team bases at opposite ends (the rotating spawns cover them until then) |
  | Gallows Yard, Twin Spires, Reactor, Dockside, Bunker Cross, Jungle Steps, Rail Stockyard, Sandgate | 60–90 per side | 10–28 | yes | TDM (+CTF/KOTH on some) | OK; check spawn counts against 16 players |
  | Backwoods, Canyon, Frost Basin, St. John's | 150–290 per side | 16–40 | yes | TDM (+ more) | Large; good for 24+ players and vehicles |

- **Size targets per mode** (playable floor, not the bounding box): duel 2–4 players ≈ 800–1,500 m²; deathmatch 8 ≈ 2,500–4,000 m²; TDM 16 ≈ 5,000–8,000 m² with a base per team 60–100 m apart; CTF symmetric, bases 80–140 m apart with three routes; KOTH 3–5 hill spots on contested ground; Elimination compact (≈3,000 m²) with three lanes.
- ✅ **TDM spawns on maps without team bases now rotate** (Oct 24): you spawn away from enemies, out of their sight, and near your teammates, so each side keeps a working area wherever the fight is. Teammates can also spawn beside a teammate who is out of the fight (Sprint 2 #15).
- Interiors: **thoughtful prop placement** (furniture against walls, rooms that read as kitchens/offices) instead of random scatter. Build an interior-dressing helper per room type.
- Crossfire homage: remake it from the original's layout reference.
- Map cards: show **one image** per map — a real aerial/player-camera screenshot — and let the user cycle to the grid layout.

### 6b. Imported TimeSplitters maps
- Hide them until each one is verified (your call).
- Work out what the decoded data is missing (props, textures, heights) using controlled test saves, then rebuild a few by hand to set the bar.

### 6c. New maps (all built in MapMaker format from our assets)
**Ten originals** mixing the tile kit and the terrain editor, including the largest maps. Plus these requested ones:

| Theme | Maps |
|---|---|
| Large outdoor / Tribes-like | Omaha-beach-style D-Day landing (huge), sniper elevation maps, Blood Gulch homage, pyramid "aggro crag" |
| Urban | City intersection (convenience store, gas station, restaurant, bar, mechanic) → **much larger city riot map** from it; cul-de-sac of 5 homes leading to a main street (Grove-Street style); Nakatomi-style tower |
| Arena shooters | The Edge (Q2) and The Longest Yard (Q3DM17) homages |
| Classic FPS homages | Nuketown-style, Kino-der-Toten-style, "office" (CS), assault_ship.ce, Half-Life Subtransit (with a monorail) |
| Real places (look-alikes) | National Mall, White House, history and science museum, stadium, Roman arena, IKEA-style store, St. John's Northwestern Military Academy campus (✅ first pass: `maps/st_johns.json`, built by `packages/server/src/tools/maps/st_johns.ts`), Lake Norman lake houses |
| Set pieces | Movie theater, 80s mall, airliner on the tarmac (one team starts on board), prison (one team starts in locked cells) |
| Fantasy / adventure | Helm's-Deep-style fortress with orc NPCs, Indiana-Jones-style jungle canyon with drawbridge and a temple, dino park with roaming dinos behind placeable park fences, forest |
| Single player / co-op | More challenges built from logic, NPCs and vehicles |

### 6d. Borders that blend in
City skyline blocks, huge mountains/cliff walls, park-style electric fences (also placeable as props).

## Sprint 7 — Asset library: MapMaker Style Packs, Set 1 "Foundation"

Eight mix-and-match packs (from the notes, pages 5–11). Every piece is shared
across packs where sensible. Sourcing per pack: CC0 kits first (Kenney,
Quaternius, Poly Pizza CC0, ambientCG textures), then pieces we model ourselves.

| Pack | Style | First pieces | Gameplay pieces |
|---|---|---|---|
| 01 Military Compound | Modern industrial | concrete walls, bunkers, barracks, guard towers, trenches (**modular**), sandbags, containers, catwalks | security/blast doors, mounted guns, destructible barriers |
| 02 Frontier Dust | Wild West | saloon, bank, jail, store, mine, train station, water tower, rail pieces | moving train, mine carts, dynamite, breakable wood |
| 03 Imperial Arena | Roman | arena walls/seating, columns, arches, forum, aqueduct, tunnels | gates, cages, spike traps, portcullis |
| 04 Orbital Station | Clean sci-fi | corridors, labs, hangars, airlocks, control rooms (partly covered by the new Quaternius sci-fi kit) | force fields, low gravity, auto doors |
| 05 Gothic Estate | Victorian horror | mansion rooms, library, crypt, cemetery, gardens | secret doors, moving bookshelves, breakable floors |
| 06 Jungle Ruins | Lost civilization | jungle terrain, cliffs, caves, waterfalls, temples, giant trees | rope bridges, climbable vines, falling rocks |
| 07 Neon Megacity | Futuristic city | streets, alleys, rooftops, neon signs, billboards, transit | elevators, transit, rooftop traversal |
| 08 Suburban Chaos | Everyday modern | houses, garages, rooms, pools, playground, store, gas station | garage doors, breakable fences, appliances |

Also requested: **Egypt** theme (builds on Imperial Arena + desert), **portals**, terrain-editor optimisation.

## Sprint 8 — Platform: hosting, accounts, browsers, admin

| # | Item |
|---|---|
| 1 | **[platform]** AWS hosting: a CloudShell-runnable script (and CI template) that deploys the server + client (e.g. ECS/Fargate or one EC2 + CloudFront/S3) |
| 2 | **[platform]** Google sign-in for accounts |
| 3 | **[platform]** Lobby browser (robust: filters, ping, players, mode) and **community map browser** per the reference board: featured **Top 25 playlist** you curate, then the user's favourites and own maps |
| 4 | **[platform]** User maps: start with 5 slots; delete own maps; share easily; submit 1 per month for the online collection (more with a paid tier) |
| 5 | **[platform]** Admin console: manage maps, characters, weapons, props; promote/demote into playlists; delete into a **trash** that purges after a set period |
| 6 | **[platform]** Monetization (later): premium skin packs, extra map storage |
| 7 | **[platform]** Validation that offers one-click fixes |

---

## Decisions (Oct 24)

1. **Imported/original maps are hidden** from the map list until the importer produces maps we're happy with.
2. **Bomb mode first**; hostage later.
3. **AWS: start with one EC2 instance** (behind CloudFront); move to Fargate when it needs to scale.
4. **Map storage**: measure the largest map first, then set per-user slot counts.
5. **Custom content on servers is maps only**: hosts build with our suite (tiles, props, textures, NPCs, logic); no uploaded models, textures or sounds.
