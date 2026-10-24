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
| 1 | **[feature]** Aim down sights on every gun (ADS pose, FOV zoom, lower spread); longer zoom levels on some scopes |
| 2 | **[content]** Many more guns, with better firing/explosion FX |
| 3 | **[content]** Worms-style weapons: holy-grenade-style bomb, banana-style cluster, sheep-style walking bomb, airstrike, ninja rope |
| 4 | **[content]** Heavy weapons, including a **guided rocket** (Half-Life-style laser guided) |
| 5 | **[feature]** Grapple hook |
| 6 | ✅ **[feature]** Jetpack fuel (already uses fuel and recharges) — add a visible fuel gauge |
| 7 | **[feature]** Medical tool: heal yourself and teammates |
| 8 | **[feature]** Deployable cover: sandbags, barriers |
| 9 | **[feature]** Hit boxes scale with the character (big skins bigger, small "oddjob" types smaller) |
| 10 | **[content]** More character variety: police, army, animal skins, tuxedo and Siamese cats (our monkey slot) |
| 11 | **[feature]** NPC characters selectable as player skins |
| 12 | **[feature]** NPCs: custom health/attack values and scalable sizes in MapMaker |
| 13 | **[feature]** Clan tags on names |
| 14 | **[feature]** Emotes (dance etc.) and quick-message pop-ups, with a server setting to turn them off |
| 15 | **[feature]** Squad/team support: UAV scan and similar team abilities |

## Sprint 3 — AI

| # | Item |
|---|---|
| 1 | ✅ Cover, crouching, sniping, hanging back (shipped in the AI rework) — tune so **better bots use it more** |
| 2 | **[feature]** Per-character stats/tendencies drive strategy and weapon choice (profiles exist; expose and widen them per character) |
| 3 | **[feature]** Alternative bot "personalities": arena-style (Quake 3 feel: strafe-jump, item timing) and tactical (Counter-Strike feel: objectives, economy-free rush/hold) |
| 4 | **[feature]** NPC/dino/orc roamers for themed maps |

## Sprint 4 — Modes, matches and servers

| # | Item |
|---|---|
| 1 | **[feature]** 48 v 48 (96 players), and **players take over bots** in live matches |
| 2 | **[ux]** Team setup: host defines teams (count, size, name, colour, leader) instead of a long dropdown |
| 3 | **[feature]** Friendly-fire toggle and many more match settings |
| 4 | **[feature]** Elimination: spectate remaining players or your corpse after you're out |
| 5 | **[feature]** Fort-building mode like SourceForts (build phase then CTF) over any map |
| 6 | **[feature]** Ricochet-style mode (disc arenas) and a Team Fortress-style class mode |
| 7 | **[feature]** Race mode + **road/track tool** in MapMaker (draw road, set laps); podracer-style race with shooters on the side |
| 8 | **[feature]** Tribal spear mode: only throwable spears, hold one, one-hit impale, go fetch more |
| 9 | **[question]** Bomb and hostage modes — worth adding for the CS-style maps (recommend yes, bomb first) |
| 10 | **[feature]** Co-op/scenario chains: link scenarios through a playlist or custom link |
| 11 | **[feature]** Easier LAN: show the join address on the host screen, auto-discover games on the LAN |

## Sprint 5 — Vehicles

| # | Item |
|---|---|
| 1 | **[feel]** Driving physics: suspension, weight, gravity, air time (currently flat) |
| 2 | **[feature]** Damage states (smoke → fire → wreck) and **explosions with blast radius that hurt players** |
| 3 | **[content]** New vehicles: military transport, cars, trucks, bus, Halo-style flyers (reference board: "24 vehicle lineup") |
| 4 | **[feature]** Gliders and parachutes; an airplane set piece you can spawn in and jump out of |
| 5 | **[feature]** Vehicle upgrades and cosmetic skins (from the reference board) — later |

## Sprint 6 — Maps

### 6a. System maps (fix what we have)
- Most system maps and the co-op scenario are **too small** — scale them up.
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
