# Changelog

Tile Trigger uses [semantic versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
Until the public launch (1.0.0), a minor bump marks a release with new features
and a patch bump a fix-only release. The version shows on the main menu
(`packages/client/package.json`). Each release is a git tag `vX.Y.Z` on `main`,
made only on a commit that passed CI on a check branch.

## Unreleased

**Rounds go through arches, windows and holes** (owner's report, 2026-11-06: bullet holes in empty air inside a stone
arch and a ruined wall's window on Fogbound, and under a giant root on Fernwood Moon, with puffs in the air by the trees)
- **Openings are open**: arches, windows, holes, doorways, gates, the space under tables, beds, bridges, stalls and
  balconies, the inside of tents and boats and the wide gaps in fences (0.5 m and up: bars closer than that still stop
  rounds) no longer stop rounds or players. 129 props now collide with
  boxes that follow their model in 3D (voxel collision: the Quaternius ruins' arches and walls, the dungeon arch, the
  giant root, the Wild West balconies, gallows and wagons, the sci-fi trusses and frames, the skytrain, the armoured
  truck, the gantry crane, the fence gates, the hedge gate, the drawbridge, tables, bunks, stalls, siege engines and
  more); their stone, wood and metal still stop
  rounds as before (same materials, same thickness for penetration), and cover behind their solid parts still works.
  Players walk through arches and doorways tall enough, and bots path through them.
- **Trees and poles collide where their trunk is**: their column stood in the middle of their footprint, which a
  crown or an arm to one side moves off the trunk (birches 1.5 m off, the broadleaf trees 0.6 m, street lights 0.9 m),
  so rounds stopped in the air beside the tree and you could walk through the trunk. The column now stands on the
  trunk, as thick as it, follows a palm's or a leaning trunk's curve, and stops where a broadleaf tree forks
  (47 trees and poles). This was the Fernwood Moon screenshot: its broadleaf trees and pines.
- **No walls of air over corner pieces**: corner and stair-corner pieces, round railings, sandbag nests, the pediment,
  the pyramidion and the burnt-out car no longer stand an invisible wall at their tallest height over their lower
  parts (26 props).
- **Breakable props with openings** (tents, fences, barriers, pipes, machines with windows) collide as their own
  shape too; a shot anywhere on one still damages it.
- Still filled, with the reason written down: under the long open stair flights (solid so they climb reliably), the
  airliner's and its boarding stairs' hand-built collision, the bucket-wheel excavator's lattice and one narrow gap
  under a city block. Glazed windows stop rounds on their glass, as before.
- Team tools: `collide: "voxel"` for props (docs/CONTENT_PIPELINE.md, "Prop collision"), with a box budget per prop;
  `pnpm content:check` now fails on a prop whose collision fills an opening without saying why
  (`tools/content/prop-openings.mjs`, which also lists the slack round props' outlines with `--slack`); a fixture test
  lists every prop whose collision changed.

**No flicker on props** (owner's report on Flatpack Depot, 2026-11-05: "significant flickering", "flicker when I look
around", on an Android phone; docs/LOOK.md, "No flicker: props")
- **Rugs, shelves, crates and boxes no longer fight the floor**: many props have flat faces in the floor's own plane
  (a rug whose cloth is its base, the double-sided bottoms of shelving, crates and freezers); the level is now drawn a
  hair behind whatever lies in its planes (a depth bias), so the prop always shows, at any range and on a phone. On
  every map: 4,915 such places over the 89 maps (298 on Flatpack Depot).
- **Props stacked flush on props** (a box on a crate, shelves back to back, rail lengths end over end: 754 places, 58
  on Flatpack Depot) are drawn a few millimetres apart, in the game and in MapMaker. Drawn only: collision is unchanged.
- **Glass no longer pops**: windows seen through other windows (the showroom over the warehouse) stayed hidden or
  showed depending on which glass was drawn first; glass now blends in any order.
- **Phones: speckled floors twinkle less when you turn** (terrazzo, gravel, carpet): at the phone's render scale each
  drawn pixel is shown 3-4 screen pixels wide, so the level's textures are taken a touch softer there (barely
  any on a desktop).
- Team tools: the z-fighting audit now checks props against the level and against each other on every map (none left);
  the props' contact faces are measured from the models (`tools/content/prop-contacts.mjs`, in `pnpm content:check`).

**Bigger pebbles, a red meadow flower, pictures in the Nature tab** (the owner's environment follow-ups, 2026-11-05)
- **Pebbles you can see**: our pebbles are now four rounded stones up to about half a metre across (1.2 m wide and
  0.3 m high at scale 1, near the Kenney stones they replaced; they were 0.8 × 0.13 m and vanished past a few metres),
  wherever the plants brush grows them and wherever they are placed. Still decoration: you walk through them.
- **Sunstone Crag**: its 36 pebble clusters (once Kenney stones) are grey again, as the stones were, so they stand out
  on the sand (set in MapMaker's inspector).
- **Red meadow flowers**: a red variant (a poppy) for our meadow flowers; Serene City's red flower is red again.
- **MapMaker**: grass, meadow flowers, fern, shrub, eelgrass and pebbles in Nature now show a picture like every
  other piece.

**Palms face the right way** (owner's report, 2026-11-05)
- **Hands no longer hold guns back to front**: on some characters the game read the back of the hand as the palm, so the shooting hand held the grip palm out and the support hand lay palm down on the handguard (the new Hyena Warrior, Honest Abe and others). Which side of a hand is the palm now comes from the hand's own joints (a right hand and a left hand are mirror images: the knuckles across the fingers say which side the palm is), in third person, first person, Character Select and on creatures.
- **Snikkit's hands** are three quarters of their old size (they were longer than his forearms) and sit deeper on the grip; the **Hyena Warrior's** left paw now closes round the handguard.
- Team tools: the grip audit flags palms facing the wrong way (`palm`), `__grips.palms()` shows how each palm was read, and the characters test checks that shooting palms face in and support palms face up.
**Performance round 2: big fights on a laptop** (the owner's second M1 Pro recording of Market Town, 2026-11-05;
docs/PERF_96.md, "Performance round 2")
- **Shadows cached**: the level, terrain and props are drawn into each shadow cascade only when that cascade moves
  (past a margin round the view, about every half second, or when they change); every other frame the cascade starts
  from that copy and only what moves (characters, guns, pickups) is drawn on top. Doors and gates join the cached part
  once they have stood still for a second. Shadow draws a frame about halved again. WebGL2; WebGPU as before.
- **Level drawn in a few draws**: on WebGL2 the level's and terrain's surfaces (one draw each, 34 meshes on Market
  Town) are merged into a few meshes over shared array textures, with each surface's texture, tint and shine kept per
  vertex: the same look, collision unchanged. On every map.
- **Far characters animate less often**: 20 Hz at 15-35 m (was 30), 12 Hz at 35-70 m (was 15), 8 Hz beyond (was 10);
  past 35 m the arms keep the last full grip's pose instead of being solved afresh. Creatures' clips now step by
  distance too (only their state machine did), and not at all out of view.
- **Cheaper bookkeeping**: stopping a clip and removing a mesh no longer search the scene's 8,000 running animations;
  each frame only the meshes switched on are looked at (about a third of a big match's 3,300); the level's and props'
  materials are frozen once settled.
**MapMaker: see where you can build** (the owner's request, 2026-11-05)
- **The grid follows you**: instead of a fixed patch round the centre of the map, the level grid covers the cells round where the camera looks, fades out at its edge and draws every 4th line stronger; it widens as you fly higher.
- **Two outlines, always shown**: the **playable boundary** (orange: the map's boundary, or its terrain's edge when it has none) and the **build limit** (white, dashed: 256 cells, about 2 km, from the centre and 16 levels up or down), where placement stops. Both show through hills and buildings.
- **The scenery zone**: between the two, a hatched band just outside the boundary and a label ("Scenery zone · building here is fine") mark it, since scenery there blends the map into the world round it. The status bar names the zone under the pointer.
- **Full grid** (top bar, next to Grid) shows the grid over the whole build area on demand.
- A piece refused at the edge now says it is **past the build limit**; the camera can fly out that far.

**MapMaker: floors over tall pieces** (the owner's report, 2026-11-05)
- **A floor or ceiling over a piece that stands two or more levels tall**: such a piece (Triumphal Arch, Hypostyle Hall, Temple Pylon, Tall Room, Arena Seating, City Wall…) holds its cell on its upper levels too, so nothing could be placed there. Now a **Platform** placed on that cell becomes the piece's own floor there, or select the piece and tick **Floor on Level N** under *Upper floors* in the inspector (its whole footprint). A full floor slab you can stand and build on; what rises through it (columns, arches) stays. Not on stairs, ramps and towers (their upper level is the way up) or model buildings. Map format v26 (`upperFloors` on tiles; older maps load as they were).
- **Refusals say what to do**: "Can't place" now names the piece and level in the way and what to do instead (a free cell, another level, move or delete it, or the floor above as above), instead of "overlaps another tile".

**Eleven new characters and a new tank** (Meshy models, 2026-11-05)
- **Ten new characters**: **Patches** (a hobo clown, Everyday Folk), **Tactical Soldier** (Soldiers), **Umpire** (Everyday Folk), **The Butcher** (Everyday Folk), **Old Timer** (Everyday Folk), **Bamboo** (a large panda, Animals), **Frost Viking** (large, Knights & Legends) **Imperial Guard** (an ancient Chinese soldier, Knights & Legends), **Goblin Warlord** (Knights & Legends) and **The Masked Figure** (Undead & Horror) join the roster, with their portraits: the shared clips, their own first-person arms, a far copy and their own hit shapes. Names are placeholders for the owner.
- **The Tank is a WWII tank now**: the owner's Meshy model replaces the Quaternius tank (kept as the fallback if it fails to load), 6.2 m long with a 1.2 m gun barrel, 19k triangles with a 5.6k far copy from 45 m and a baked normal map. Its turret turns and its barrel pitches with the cannon gunner's aim (the roof gun no longer moves it). Same collision box, health, handling and weapons; the driver now stands at the front left of the deck and both gunners on the turret roof.
- **Bill** (Everyday Folk) joins them: a grey-haired man in a patterned shirt and jeans ("T Pose on Green Screen", which is not the CRT Robot's model).
- **Goblins are small**: the Goblin Warlord is small now, as Goblin, Goblina and Snikkit already were (body, hit shapes, health and speed follow the size).
- **The Tank's collision box fits its hull**: 2.94 m wide instead of 4.2 m (shots and bodies no longer stop on air beside the tracks) and 6.12 m long; the seats, getting in and getting out are unchanged.
- **Characters keep Meshy's own finger rig where it's better** (`fixes.fingers`): a re-rigged download with whole finger chains now keeps its own finger joints and weights instead of having the fingers re-fitted from the mesh (the Tactical Soldier, Frost Viking and Goblin Warlord); a look the grip audit scored worse keeps the re-fit (The Butcher, Bill).
- **Licences**: this intake's new characters are recorded as Meshy Community models, CC0 per the owner (authors and post URLs to follow), instead of the owner's own.
- **New models for five characters** (names and ids kept, new portraits): the **Iron Knight** (now the dark "Iron Warden" armour), the **Hyena Warrior** (a gnoll warrior), **Barnaby Bruin** (a bear warrior), **Snikkit** (a mohawked goblin, still small) and **Giggles** (a tattered circus clown, still small); Giggles is back on the roster, since the old model's tearing at the waist is gone.
- **Re-rigged characters**: The Dapper, Croakley, the Field Medic Automaton, the Stealth Operative, the Beanie Alien, the Alien Biker, Customs Agent Zhao, Old King Halvard, King Aldric and the CRT Robot are rebuilt from Meshy's new rigs (the Beanie Alien holds its guns better; the others as well as before); Desert Ranger, Grandpa Chains, Grunt '68, Hazmat Joe, WWII Infantry, Big Bab and Freaky Frida keep their old builds, which held their guns better than the new rigs.
- **Briggs and Hollis leave the roster** (owner's call; files kept): a saved choice of either plays Grunt '68 or WWII Infantry.
- Vehicles now draw their far copy (a lower level of detail) past its distance; before, vehicle models stayed at full detail at any range.

**Our own pebbles, eelgrass and ferns everywhere** (the owner's answers on the procedural environment, 2026-11-05)
- **Pebbles and eelgrass of our own**: two new generated species, a cluster of small faceted stones (grey, and sandy on sand) and a clump of long swaying eelgrass ribbons (green and olive). The plants brush grows them on stony, gravel, snowy and sandy ground and in shallow water instead of Kenney's stones and the Meshy eelgrass, and the Rocks, Desert scrub and Water plants scatter brushes plant them.
- **Ferns hide you like the Kenney fern did**: our bracken fern now hides a player from bots as a bush does (crouch or lie down in one as tall as the old fern), so the Kenney fern and small bush leave MapMaker's palette; our fern and broadleaf shrub take their place there and in the Jungle, Undergrowth and Bushes brushes. Maps that place the old pieces still load them.
- **Maps updated**: the Kenney grass, ferns, flowers, low plants and stones placed by hand on nine maps are now our species, standing as tall as before (stones as pebbles of the same size): Backwoods Lodge (its teal tufts), Coldwater Gulch, Jungle Steps, Primeval Park, Serene City, Serpent Gorge, Shingle Point, St. John's and Sunstone Crag. Where a fern or low plant was, you can now hide from bots by crouching or lying in it.
- **MapMaker: Replace all**: select a prop and its inspector offers "Replace all N <prop>" with any prop or species (and variant), keeping each one's place, facing and height (or its scale), bedded into the ground; one undo step. A retired piece suggests the species that replaced it.

**Our own grass and flowers, more real rock** (the owner's review of the procedural environment)
- **Meadows grow our own plants, on every map**: wherever the terrain's plants brush is painted (every level, thin to thick grass), the ground now grows the generated grass clump, new meadow flowers (white daisies, yellow buttercups, purple clover, on stems with leaves) and a bracken fern, with the generated shrub for bushes, instead of Kenney's toy-like grass, tulips and spiky plants. The same places as before; the grass at the density reviewed in the preview (a clump is a few blades, so a little over twice as many clumps as Kenney patches); fewer triangles; they sway in the wind. Pebbles and water plants are unchanged.
- **MapMaker**: the generated grass, flowers and fern are in Nature → Plants & Flowers and the "Flowers & grass" scatter brush plants them; Kenney's grass, flowers and low plant leave the palette (maps that use them still show them).
- **Boulders look like rock**: more and cleaner fracture faces with crisp edges (their collision follows the new shape: still full cover, about the same size), bedding grooves and chipped corners, darker cavities and paler worn edges, moss that sits on top and in hollows, warm and cool colour patches. Rock surfaces (boulders and cliffs) get a new stone picture with joints, grain, pits and lichen, drawn from all three sides in world space on Medium and High, so no two boulders repeat the same patch and faces never stretch it. Cliff faces gain jointed blocks up close (their collision is unchanged) and no longer show colour seams between panels.
- **Procedural environment budget**: maps get a budget of their own for environment species (4,000 placed, 3,000 that collide, 120 cliff panels, 24 variants), apart from the 1,500-prop budget, so the environment showcase validates clean.

**Busy fights run smoother** (docs/PERF_96.md, "Market Town on an M1 Pro")
- **Far characters cost less, even when frames are slow**: characters past 15 m animate every 2nd frame, past 35 m every 3rd and past 70 m every 4th (on top of the 30 / 15 / 10 Hz steps they had), in every match rather than only big ones, so a busy 25-40 fps fight no longer animates every character every frame; past 15 m their fingers keep the grip of their last full close. Nearby characters are unchanged.
- **Shots and hits in a firefight are cheap**: another player's repeated shots and hit flinches restart their clip instead of rebuilding it on every joint; past 35 m their recoil twitch is left out.
- **Shadows draw a third as many things**: the level, placed props and the border cast their shadows through a few merged meshes per area instead of one per material in every shadow cascade; pickups and held guns cast only near you, as small clutter does. Shadows look the same.
- **High-quality water** only redraws what is in or round it for its soft shore, instead of the whole view a second time.
- **Fewer respawn hitches**: at most one new character is built after each frame, and a body that has sunk away is kept and reused for the next player of that look instead of building a new one. Blood splats draw in one go.

**No more texture flicker**
- **Map surfaces stop flickering**: where two pieces' faces lay in the same plane (a floor slab's edge under the wall over it, wall runs meeting at corners, trim and facades flush with walls, floors over floors, a block level with a tile, the joints of curved walls) they fought for the same pixels and shimmered at grazing angles and range. Maps are now built so only one face draws there, by a fixed priority (floors on top, walls over slab edges, trim and style-pack pieces over what they dress), and hidden faces are dropped. Nothing else about the look changes, except that floor slab edges no longer show as dark bands at random cells on outside walls. Collision is unchanged. A test checks every map in maps/ for overlaps left (none).
- **MapMaker**: a warning when a block's face lies in the same plane as another piece's in a different look (only one shows), and **Overlaps** in the top bar highlights those places.
- **WebGPU** (`?renderer=webgpu`) gets a float depth buffer with reverse depth, for precise depth at any range.

**Procedural environment, Phase 1 (preview, behind `?env=1`)**
- **Six generated species to review**: an oak, a tall pine, a broadleaf shrub, a grass clump, an angular boulder and a cliff face, each with a material variant (autumn oak and shrub, snow pine and cliff, mossy boulder, dry grass). They are generated in code from seeds by `pnpm content:environment` (owned; no downloads, no AI): branching trunks and limbs with root flare and leaf-cluster cards, whorled pines with needle sprays, fractured boulders with worn edges and strata, cliff panels that butt seamlessly; levels of detail and a two-card stand-in for the distance; one shared bark, rock and leaf picture set.
- **Collision that matches what you see**: a tree's trunk stops everything (heavy wood, full cover) and its thick limbs stop shots and sight overhead, but rounds pass through its crown; boulders collide as their own shape, cliffs as their face; shrubs hide you from bots as bushes do and stop nothing; grass is decoration only. Bots walk round trunks, boulders and cliffs, not through them, and straight through grass. The same colliders on every host and client.
- **A new renderer behind `?env=1`**: species drawn as thin instances in 64 m batches with distance levels of detail, wind (vertex shader, WebGL2 and WebGPU) and the terrain's painted grass grown as the generated clump. Without the flag the species still draw, as ordinary props. MapMaker with `?env=1`: an Environment (preview) group in Nature, procedural forest, shrub and boulder scatter brushes, and a Variant choice in the inspector.
- **`?envlab`**: every species at eye height next to the Kenney and Quaternius pieces it would replace, with level of detail, wireframe, collider, wind and tier toggles. `maps/env_showcase.json` (a 200 m forest made in MapMaker; retired, never offered) for play tests and performance runs. The owner reviews the slice before Phase 2.

**Surface types**
- **Trees, bushes and boulders shoot and look like what they are**: one shared list of surface types (content/surface-types.json) gives each surface its ballistic class and its impact, so the server and the client agree. Tree trunks, stumps and logs are bark: still full cover (a new heavy-wood class; no ricochet), now with splinters and a wood knock instead of stone dust. Bushes are foliage (pass-through, still hide you from bots), no longer "metal" (read from "bus"); `tree_plateau` no longer "metal" (from "plate"); boulders and cliffs are rock (stone) instead of concrete. Rounds now sound like what they hit (wood, metal, soft ground, glass). Props and library materials can name their surface; nothing else changed (a fixture test proves it).

**Hitboxes, character stats and random characters**
- **Every character is hit where it is drawn**: shots test each look's own head sphere, torso, thighs, shins and (where they stick out) arms, measured from its model standing, crouching and prone, instead of one 0.8 m-wide capsule for everyone. A head shot is the head sphere (no fixed 0.32 m head band, a third of a small character's height), legs are the leg shapes; small and thin characters are still a little harder to hit, broad ones easier. Every shape has a generous margin so overall hit rates and time to kill stay where they were. Lag compensation, bullets in flight, rockets, spears and sentries use the same shapes; melee keeps its forgiving reach. Bots aim at the real head and chest. Creatures are hit as drawn (no more player-sized capsule on a puglin or a scolitex). docs/CHARACTERS.md, "Hitboxes".
- **Show hitboxes** (Options → Display, on a dev server or a test build; or `?hitboxes=1`), and Hitboxes, Crouch and Prone buttons in the character viewer: every body's shapes over it, with the margin as a faint shell.
- **Character stats**: a character may have its own health, speed, size, damage, stamina, jump, melee strength and armor (`stats` in its manifest; the Workbench's new Characters collection). One without them plays its size, so nothing has changed yet. Character Select shows them as bars. New match setting **Character stats** (On / Off), in match setup and the host rules.
- **Random characters**: a new match setting (Off by default): everyone, players and bots, plays a random character from the roster each life.
- **Wealthy Otter and Shade leave the roster** (their source models weren't in a T-pose, so their hands can't be fixed): a saved choice of either plays Brass Hare or Lancer Mei; the otter NPC keeps its model.
**Look: less like a toy** (docs/LOOK.md)
- **A calmer, filmic grade for the world**: matches and MapMaker use ACES tone mapping at a lower exposure with firmer contrast and colour curves that take the edge off saturated paint, so whites stop glowing and candy colours settle; a little less sky fill and more sun, a darker ground bounce and tighter shadow bias, so shadows meet what casts them; stronger, tighter ambient occlusion on high. No cost on low or medium; the same on WebGPU and WebGL2. The menu, Character Select and the HUD keep their look.
- **Real surfaces on man-made Kenney props**: crates, furniture, shelving, machinery, castle walls, trains and street furniture now show wood grain, painted and bare metal, concrete, stone, fabric, plastic, cardboard and glass, with a little wear and grime, while keeping their colours. Natural pieces (trees, plants, rocks) are unchanged. Barrels, the powder keg, bottle, bucket, anvil, lantern, candles, shopping cart, oak barrel and fridge are closer to real-world size. On low graphics the surface detail is left off.
**Snowmobile**
- **The Snow Sled is a snowmobile now**: "Snowmobile" by roygbpjyt (Meshy Community, CC0) replaces the toy-like Kenney sled, 3.0 m long with skis, track, handlebars and windscreen (20k triangles, a 5k one from 40 m). The driver and passenger sit astride its saddle (new seat `straddle`), feet in the footwells; collision box and cockpit view refitted. Handling unchanged.

**Performance tools and big-match fixes**
- **The F3 overlay splits each frame by system**: rendering (main pass, shadow maps, post-processing), characters (animation, skinning), effects, ragdolls, prop flames, HUD and network, with how many characters were animated and skinned, ragdolls awake and lasting effects drawn. Copy performance report includes the same split.
- **Record performance** (Pause → Settings): records a whole match, each second's split plus a snapshot of every hitch (where you were, what was in view, your settings, the server's tick), and downloads it as a file when you stop. `tools/perf/compare.mjs` summarises one recording or compares two. Nothing is uploaded.
- **Capture 10 s trace** (same menu): marks every system's time for a Chrome DevTools Performance recording and downloads a trace file that ui.perfetto.dev opens. How to use all three: docs/PERF_TOOLS.md.
- **Host Service**: the tick split (bot think, perceive, path, aim; simulation; snapshot building), snapshot size per player and ticks over budget show on the /host page and the launcher; slow ticks are written to `logs/perf-spikes.log`.
- **Busy matches draw less**: only the nearest 12 characters in view cast shadows (and anyone within 10 m), small clutter (grass, wheat, flowers, small rocks) casts shadows only within 15 m, characters 15–35 m away animate at 30 Hz, and in crowds characters switch to their low-detail model at 12.6 m instead of 18 m. Nothing changes close to you.
- **No stall on the first sight of an effect or a character**: the loading screen now builds the shaders for every character in the match and every effect the map can play.

**Loading**
- **The menu's first download is about a fifth smaller** (837 to 649 kB gzipped): MapMaker's building pieces, the prop table and the map checks now load with the first map that is drawn, opened or played, not before the menu. The game, maps and MapMaker work as before.

**Maps**
- **MapMaker: the airliner and its cabin kit** (category Airliner Cabin): the widebody shell (doors open, walkable wings) and fuselage sections that snap together inside it: the nose and flight deck, door, straight, short, over-wing and tail sections; economy triple and pair seats, business suites, pilot seats, overhead bins, a galley, a lavatory, a cabin divider and boarding stairs.
- **Map reworks from the owner's review** (made in MapMaker):
  - **Runway Nine**: Flight 9 is a real widebody now, the owner's white airliner, standing at gate 9 with a full cabin you walk through. Board by the jet bridge from the gate lounge, by the stair trucks at the front right and rear left doors, or climb the ladders onto the wings and duck in at the over-wing exits. Inside: the flight deck behind its windscreen, business suites, two aisles of economy, a galley, lavatories and the rear galley. Cargo containers, crates and barriers give cover round the plane. The bomb sites are the flight deck door and the mid-cabin galley.
  - **Step Temple** is a stepped sun temple in carved stone: an inlaid court with cover, roofed galleries, and outside on each side a broad stair to a terrace with a shrine (armour) and an arch into the galleries. The owner's temple statues, fire bowls, banners and braziers; ammo matched to each wing's weapon; the spear for the laser rifle.
  - **Verdant Ziggurat**: the jungle closes in over ruined walls, and there is more mist. A stone bridge and stepping stones cross the river, a zipline runs from the giant tree to the temple, and a watch tower stands in the south-east. Mayan guardians stand at the gateway and Overgrown Ruins fill the side courts. Grapples at both ends.
  - **Dustwater** is a fuller frontier town in red-rock country. It gains a hotel, a gunsmith, a barber, an assay office, a graveyard and the gallows, and each building has its own boards, brick or plaster. A stagecoach, wagons and troughs give cover along the street. Red Rock Spires mesas, low rises and desert scrub fill the plain. Revolvers at each end of town.
  - **Bottling Plant** has roofs now: concrete over the corridors, corrugated steel over the tank hall, a glass skylight over the atrium. The black-and-yellow stripes are gone (steel, brick, painted steel). Chemical drums and an acid spill in the tank hall.
  - **Concrete Annex**: each part of the works has its own materials, so the hangars, hall, tunnels and corridors tell apart, and the hazard stripes are gone. The owner's shipping containers and crates fill the hangars, and a flame jet runs in the tunnels.
  - **Dune Harbor**: real domes instead of stacked slabs, the cantina and trading house in blue tiles; the market in the Desert City kit and the owner's stalls, well and raider buggies.
  - **Coldwater Gulch**: one family of mossy rock instead of five mismatched ones, bedded into the slopes.
  - **Fogbound**: no-man's land is shelled (craters, mud in the deepest), with knocked-out vehicles out in it, a ruined farm on each flank, more shattered trees and a stormy sky.
  - **Citadel**: a town under the castle. Through a new gate and down the hill are a market square with a fountain and stalls, houses, a smithy, a bell tower and a watchtower, with spawns and pickups down there.
  - **Eagle Spires**: ziplines from the four flank spires down into the valley, low walls for cover on the mesas and the summit, boulders across the valley floor, and snow-capped tops.
  - **Express Lobby**: a sky bridge across the atrium on every floor (alternating ends, glass rails). Cars, bins, benches and kiosks fill the street.
  - **Gallows Yard**: the gallows itself on the central platform, fire bowls for the crystal baskets, weeping angels, sarcophagi, a mistier night.
  - **Sandgate**: in the Desert City style. Ashlar and plaster fronts, roofs and domes, market dressing and a desert sky; same layout.
  - **Sandfall Colosseum**: a gladiator school by Embers' gate, a market by Tide's forum, cypress avenues, and broken columns on the arena sand.
  - **Capitol Mall** no longer feels strange: smooth domes (white on the capitol, copper green on the museum) instead of stacked slabs, Ionic columns on the memorial and the capitol porticos, broad oaks and birches for the blocky trees, a row of historic buildings along each side lawn, a security cordon round the obelisk (barriers, sandbags, a burnt-out car and an armoured truck on the drive), marble capitol chambers and a sunset sky.
  - **Capitol Mall, domes and roofs**: the capitol's white dome now stands on a drum ringed by a colonnade, with an attic and a lantern, and the museum's copper-green dome on a limestone drum with windows: no more skirt of stacked slabs round them, and from the rotunda below you see the dome's ceiling. The capitol roofs are marble (the four corner chambers' were black from above), the museum's travertine; proper pediments over the porticos and a pointed cap on the monument.
  - **Atomic Court**: the block-built bus, truck and cars are real vehicles now (a delivery truck, a burnt-out car, a pickup, a flatbed, family cars), and the yards are a suburb: picket fences, box hedges, swing sets, slides, trampolines, barbecues, mailboxes and hydrants to fight round. A little furniture inside, golden hour.
  - **Backwoods Lodge**: smooth dirt trails and a gravel road instead of stair-stepped painted ground; the attackers start from a camp (campfire, tents, torches, a pickup); rocks and logs along the creek, a cart and a woodpile in the yard.
  - **St. John's**: better paths. The dark flagstone walks are lighter, wider cobbled walks, and five new walks with lantern posts cross the two bases' lawns (to the flagpole, the roads, the barracks and the hall on the slope).
  - **Iron Compound**: a third way in, a barricaded breach in the west wall you shoot open; a container yard, a motor pool and a stores row inside; cover in front of the raiders' spawns and wrecks in no-man's land; deathmatch spawns inside the walls; burn barrels and a sunset.
- **New props: Capitol Dome, Copper Dome, Pediment** (MapMaker → Imperial Arena) **and Pyramidion** (→ Sands of Egypt): a capitol dome on a colonnaded drum, a weathered-copper dome on a windowed drum (both lined inside and open below, for a rotunda), a classical pediment for a portico and a gilded cap for an obelisk or monument.
- **MapMaker: paint a roof's top on its own.** A room with a roof (Ceiling: Roof, skylight or beams) has a **Roof** surface in the inspector, and the Paint tool paints it when you click the roof. Until it is painted it looks like the room's floor, as before, so a carpeted room no longer needs a carpet roof.
- **New prop: Burn Barrel** (MapMaker → Military): an oil drum burning scrap wood, with a real flame.
- **New props: Plaster Dome and Blue Tiled Dome** (MapMaker → Desert City): round roofs for desert houses, 5 m across, Scale for any size.
- **Five maps removed, three more retired** (owner's review of 3 Nov): After Hours, Clockwork, Fallout Lane, Ridge Camp and Stonewatch Keep are deleted with their pictures; Blackout, Cedar Lane and Glacier Line stay only as test fixtures (retired: no menu, playlist or host picker offers them).
- **Better automatic map pictures**: the capture tool now aims at the busy area (spawns, pickups, objectives) and can take a three-quarter aerial view framed to it, so Citadel, Silo Complex and Step Temple show their layout instead of a wall or empty ground; map plans crop tighter to what is built.

**Effects (the owner's purchased Binbun FX packs)**
- **Lightning looks like lightning.** The Arc Caster's chain, the Arc Turret's violet lock and electric fences now throw crackling bolts (Electric FX) along each jump with a burst where they land, instead of thin jagged lines; a shock trap going off crackles. The Arc Turret's wind-up is a ball of violet lightning over its orb (same size and timing as before). Damage, timing and range are unchanged.
- **Fire burns.** Burning patches (molotovs, the flamethrower, flares, lit oil), burning vehicles and smouldering wrecks, flares and flame traps carry stylised flames (Flame FX) in place of the orange cones and puffs.
- **Gas and smoke.** Toxic gas rolls as a glowing green cloud over its (now fainter) dome, and badly damaged, burning or wrecked vehicles trail a column of pack smoke (Poison VFX, Smoke VFX).
- **Fire props burn too.** Braziers, fire bowls, hanging braziers, temple altars, fire stands, the forge, wall torches, torch stands, campfires, wood fires, the writing desk's candle and the graveyard lantern now carry Flame FX flames in place of the models' simple flame shapes. Torches and candles use the pack's smaller candle flame; on maps full of torches only the nearest are drawn, after every fire that matters in a fight.
- Low graphics plays fewer of these at once (and thinner fires); far away, or when many are going, the old plain look stands in. On low graphics fire props keep their own flames.

**Pickups and props**
- **Large health has its own model**: a battered medical bag with a red cross, in place of the bigger copy of the small medkit. It heals the same as before (50, back in 25 s); small health keeps the medkit.
- **Rifle rounds have a model**: an olive ammo box instead of the striped block. The other ammo pickups (general ammo, light rounds, shells, sniper rounds, explosives, energy cells, fuel and chem canisters) keep the striped block in their colour.
- **New prop: WWII Ammo Crate** (MapMaker → Crates & Barrels, and the Military style pack): two stacked wooden ammo crates, 0.9 m tall. It blocks players and shots and breaks like the other crates.

**Characters**
- **Hands, look by look (skin weights)**: Zombie Soldier A's right hand no longer grows a long needle on a gun; the Iron Knight's tabard no longer tears open between his legs as he stands, runs or strafes, and his gauntlet's fingers no longer tear apart; the Hyena Warrior's right paw closes round the grip instead of hanging under it; bots in the Imp's skin hold a rifle's handguard from below with the left claw instead of holding it above, claws up.
- **Better grips, look by look** (owner's list of 3 Nov): the support hand now sits under the pistol and wraps the shooting hand instead of hanging open below it on 27 characters (Desert Ranger, Grunt '68, Luther Vanguard, Space Marine, Stealth Operative, Virtua Soldier, WWII Infantry, Anoobys, Honest Abe, Iron Knight, Shade, Customs Agent Zhao, Bonejack, Gorgle, Mummy Bot, Punkin, Shambler, Big Bab, Croakley, Greyfang, Hyena Warrior, Seetah, Wealthy Otter, Alien Biker, Beanie Alien, Botboy, Emerald Robot), and many hold the rifle's grip further back. Santa and Zombie Soldier A hold the rifle out at the shoulder instead of in front of the face. Each is its own manifest setting (`fixes.grip`); nothing shared changed.
- **Barnaby, Slugger and Rusty Mech rebuilt** with their correct surface detail (the cap's logo, the visor's lights and panel lines show as modelled).
- **Cleaner faces on fifteen characters** (Biker Gang Girl, Cal, WWII Infantry, Sgt. Mackie, Stealth Operative, Thornweaver, Lancer Mei, Rourke, Elder Tomo, Grandpa Chains, Dog Tag Doyle, Rattles, Count Bonesworth, Grinning Gus, Pemberton). Faces built from low-poly downloads shaded in flat facets (their smooth shading was read upside down), and the model cut laid triangles across the texture's seams, which drew dark and pale wedges over eyes and noses. Rattles' skull no longer follows his collarbones when he raises the gun.
- **Off the roster:** Vampire, The Hollow Visitor, Dust Trooper, Goblin, Rotter and Giggles (Rotter and Giggles tore open at the sides). A saved choice of one plays Count Bonesworth, The Visitor, Desert Ranger, Goblina, Shambler or Punkin. Goblin NPCs keep their look. The Imp and the Puglin are no longer offered in Character Select; they stay NPCs and bot looks.
- **Character Select shows each body at its size**: small characters (Goblina, the Space Marine and the rest) stand at 1.40 m and large ones at 2.12 m, as a match draws them, instead of everyone at 1.80 m. The Imp's portrait is framed on its head and shoulders like the others.
- **Honest Abe is large** (gameplay): 2.12 m tall, speed ×0.94, 115 health, and a bigger hit box, like the other large characters.
- **Goblina looks up**: her head no longer hangs down over the gun.
- **Shooting shoulder no longer tucked in** with a rifle: the body turns less side-on (0.22 rad, was 0.45), the stock sits 4 cm inside the shoulder (was 7) and the shooting elbow comes out to the side, so the right shoulder and arm stand out from the chest instead of running along it (owner's note on Santa and Zombie Soldier A; every character). Aim, recoil and hit boxes are unchanged.
- **Faces closer to their models**: Grinning Gus's skull is glossy black chrome and Dog Tag Doyle's helmet and skull smooth and glossy, as modelled (their builds kept one matte finish and dropped the model's metal/roughness map); Cal, Sgt. Mackie and Elder Tomo lose the dark wedges and lines across their faces (the rebuilt surface's shading was read upside down); Biker Gang Girl loses the pale wedge down her nose (her model is used uncut with its own shading map).

**Infrastructure**
- Faster CI: a commit whose code matches one already green on a check branch (only docs differ) isn't tested again; `tools/ci/train.mjs` lands several green branches as one candidate; a change to the match renderer or a content manifest runs only the browser tests that exercise it.
- CI rounds in about 9 minutes instead of 36: browser tests packed into up to 16 runners by measured time (refreshed by CI), the character checks in three parts, unit tests and perf checks side by side, and the browser tour of every map nightly only. Every change to shared, map or content code checks every map headless (loads, builds, 90 ticks with bots), and the new test map `test_coverage` (hidden from the map lists; MapMaker's Map properties: Test map) holds one of every tile, wall style, prop pack, pickup kind, vehicle, liquid, path, logic piece and mode marker.
- Pickups are data: health, armour, ammo, throwables, weapon pickups, powerups and the other pickup items (amounts, respawn times, bot value) and the pickup rules (armour cap and absorption, powerup multiples, pickup reach) live in `content/pickups.json` and show in the Workbench. Nothing plays differently.
- Surface materials are data: every library material (name, palette group, pattern or scanned texture, colours, tiling, shine, glow), the themes (each surface's default material and tint, the sky colour) and the tint swatches live in `content/materials.json` and show in the Workbench. Nothing looks different.
- The core building kit is data: every core tile (rooms, corridors, stairs, platforms, open ground, buildings, curves, the city and Orbital/Neon pieces: cells, ports, default walls and the parts each is built from) and every wall style (doorways, windows, half walls, railings, arches, fences, bars, shutters: what collides, the trim, the window openings) live in `content/tiles/` and show in the Workbench. Every map builds exactly as before.

## 0.7.0 (2026-11-03)

**Turrets, weapons and props**
- **New: the Arc Turret** (MapMaker → Vehicles → Turrets & Sentries). An auto-turret with a tell: when it sees an enemy within 22 m it winds up for 0.75 s (it glows brighter, a violet ball grows over the gun and you hear a warning), then locks an energy arc onto them that never misses (5 damage ten times a second) and jumps to one enemy next to them for half. Break its line of sight or get out of its reach and it lets go; the next lock needs the whole wind-up again. A lock lasts 2 s at most (100 damage), then it vents for 1.25 s. Slower to kill than the Sentry Gun (about 2.65 s in the open against 1.6 s), never in an instant. Bots shoot it like the Sentry Gun. It wears the Rocket Turret's cannon in its own energy colour. MapMaker warns when one stands within 12 m of a spawn it would shoot at. It isn't on any official map yet.
- **The Singularity Cannon has a new model**: a heavy plasma blaster with the cannon's purple glow in its panels and muzzle ring, held by its rear grip with the other hand under the front. It works exactly as before.
- **New prop: Mossy Rock Spire** (Rocks & Wood), a 2.4 m stack of mossy boulders. Like the other rocks it beds into the ground, leans with the slope and blocks players and shots.

**Bots**
- **Teammate bots stay in your vehicle when you drive off.** They used to get out about a second after you set off (a "parked" check that read any moving vehicle as parked). They now ride along, shooting from their seats, and get out when it's on fire or about to blow, or once you've parked a while. A bot driver going round in circles somewhere it can't drive out of gives up instead of taking its riders round and round.
- **Squads push.** Tactical squads with a team leader no longer stand at their spawn walking into a wall for a pickup they can't reach (a bot now gives up on such a pickup for a while), go back to the squad's goal after grabbing something instead of wandering off on their own, and keep heading for a far goal instead of swapping goals every half minute. On Shingle Point the assault side now stands about 12 % of the time out of a fight instead of 28 %.

**Maps**
- **Roads that overlap no longer flicker through each other in jagged patches.** Where two drawn paths cover the same ground (Iron Maw's pale concrete crusher apron laid over the brown rim haul road, a spur joining a road), the later path in the map's list now lies cleanly on top; before, both sat at the same height and the depth buffer picked a winner pixel by pixel, which read as hard-edged snow patches on dirt.
- Ceiling lights hang from the ceiling: a ceiling panel, strip light, hanging bulb or chandelier light placed a little under a ceiling is drawn fastened to it (the bulb's cord and the chandelier's chain reach up), and chandeliers and other hung props are drawn with their top against the ceiling over them. On St. John's every ceiling panel floated half a metre under its ceiling and the chapel's chandeliers a metre under the roof. Every map, in the game and in MapMaker.
- Props stay on the ground beside walks and roads: MapMaker beds props on the map's ground, and the game lays the paths into that ground when the map loads, so a bush or lamp post by a walk could end up sunk into it or standing off it. They now follow the ground as played (in MapMaker too).
- St. John's: a stray glowing panel off a fourth-floor window is gone, and the north-south hall's ground floor reaches its south wall (grass showed along its edge).
- **St. John's: the east-west hall is built to the top.** Its north wall rose to 16 m over a roof at 8 m, a two-storey screen with sky through its windows. The hall now has a 3rd and 4th storey like the north-south hall it joins: floors at 8 and 12 m, south and end walls with windows up to 16 m, the roof and its battlements on top. Stairs carry on up from the hall's own stairwell (turning back at each floor), and a doorway on each new floor leads onto the north-south hall's stair landings, so the floors connect both ways. Inside: bunks, dressers and long tables for cover, three ceiling lights a floor, rifle ammo on the 3rd, and on the 4th a marksman rifle by the window over the courtyard (the east side's answer to the one upstairs in Hazelwood) and a small health. The wide openings over the courtyard got sills.
- St. John's: the chapel's ten wall banners are cloth (Canvas, in their colours) instead of the glowing striped Light Panel.

**Ragdolls**
- **Bodies no longer fold in impossible ways.** A ragdoll's joints were free: knees and elbows bent backwards, thighs swung up behind the back, heads and arms twisted round, so corpses (whole-body characters and creatures most of all) came to rest with limbs pointing up or splayed and twisted. Every joint now moves like a body's: knees and elbows fold one way only, hips swing forward a long way and back a little, shoulders cover the arm's reach, the neck nods and turns but never round. The limits are worked out from each body's own pose at death, so they hold for every character, modular or whole-body, small or large, the rolling Baseball Robot included. No extra cost (bodies settle sooner).

**Characters**
- **Giggles, Dust Trooper, Goblina and Luther Vanguard look right in every pose.** Long strands and sheets ran from their hands and sleeves down to their hips (Giggles' and the Dust Trooper's "sleeve spikes", threads from Vanguard's fingertips, Goblina's hands smeared into flaps), and swung about whenever they held a gun or ran. Their models stood with their arms down and hands on their hips, and the skin there was tied to both the arm and the hip; it is now cleaned before the arms are raised, so hands are hands again (they also close round the gun better). Vanguard is rigged afresh with his shoulders and elbows set by hand.

**New characters**
- **Seetah J. Chloth** (Animals): the owner's cheetah/sloth hybrid. Fastest cat alive, for about four seconds a day; bots wearing him take cat names.
- **Biker Gang Girl** (Everyday Folk), **The Hollow Visitor** (Creatures & Machines; a grey alien in a worn sweater, not The Visitor) and **Fearsome Undead** (Undead & Horror): the three models the shared shooting clips came from, now playable themselves. They move on those clips like everyone else; bots wearing them take gangster, alien and undead names.
- **Emerald Robot** (Creatures & Machines), **Space Marine** (Soldiers; a short green alien in a red uniform, small) and **Spiked Skeleton Biker** (Undead & Horror): three more of the owner's rigged models, on the same shooting clips; bots wearing them take robot, soldier and undead names.

**Third person: shooting while moving**
- **Strafing no longer twists the body off the gun.** Strafing turns the hips and legs toward where you go and the shoulders back onto the aim; the shoulders were turned the wrong way, so a strafe (or a bot dodging while it fires) wound the chest about 140° away from the gun while the arms wrapped round to it. Now the chest stays square to the aim whichever way you move, for every character, players, bots and remote players alike. The fix (turns about world axes through the mirrored skeleton) also puts the hit flinch, the kick and the seated legs the way they were meant to go.
- **Aiming in third person: your gun points at what the crosshair is on.** Your rounds already went there (since 0.6.1), but the gun pointed along the view beside it, so aiming down the sights magnified the gap between the barrel and the target. Now the gun and shoulders turn onto the point the rounds go to. First person is unchanged.

**Everyone moves with authored clips while armed**
- **Every walking character now runs, strafes and backs up while shooting on authored animation clips** instead of the generated animation: modular characters, every whole-body character, Designer looks and characters added later, with nothing to set per character. Running while firing has its own upper body (a running shot), which takes over from the walking shot as the legs speed up; backing up uses a backward shooting walk with longer strides at full speed. Crouch, prone, jumps, seats, unarmed movement and first person are unchanged. The rolling Baseball Robot keeps its glide.
- The clips come from three rigged downloads (CC0 models the owner rigged and animated on Meshy; four were measured), each clip from whichever download fits the game's skeleton best, in one shared 103 KB file loaded once. WWII Infantry moves with the shared set too (it has a running shot his own download lacks).
- New: **clip retargeting** (tools/content/clip-set.mjs). Clips made on a Meshy auto-rig are turned into clips on the game's own skeleton (rest pose compensated bone by bone, root motion stripped, scaled to the rig's legs, each clip's walking speed measured from its planted foot). A character can name another clip set or opt out (`clips` in its manifest, with the reason).

## 0.6.1 (2026-11-01)

**New characters (batch 3)**
- Fifteen new characters: **Orange Suit Engineer** and **Coffee Brown** (Everyday Folk), **Gas Mask Engineer**, **Stealth Operative** and **WWII Infantry** (Soldiers), **Mummy Bot**, **Pharaoh Mummy Warrior** and **Vampire** (Undead & Horror), **CRT Robot**, **Field Medic Automaton** (a large one), **Alien Biker**, **Pink Mantis**, **Alien Encounter** and **Beanie Alien** (both small) and the **Baseball Robot** (Creatures & Machines).
- The Baseball Robot has no feet: he **rolls** on his ball. No walk cycle: he glides, leaning into his speed and into his turns, and still holds and fires every gun. (Any character can be made to roll: `locomotion: roll` in its manifest.)
- **The Dapper** is rebuilt from the owner's new model: a sharper face, a bowler hat, real hands on the gun. **Rusty Mech** keeps more of its shape (16k → 18k triangles).

**Gunplay**
- **Third person: your rounds go where the crosshair points.** The camera sits over your shoulder, above and behind your eyes; rounds used to leave your eyes along the view, so crouched behind low cover you could see a target over it while your rounds hit the cover (and up close they landed beside the crosshair). Now they go from your eyes to what the crosshair is on. They still start at your eyes, so cover in front of you stops them as before. First person is unchanged.

**Characters (the owner's Roster Board)**
- Fourteen of the original modular characters leave Character Select and the bot rotation (Huntress, Bulwark, Scout, Farmhand, Tracker, Pathfinder, Drifter, Wayfarer, Brawler, Commando, Frost, Operative, Medic, Sentinel), and Ivory Rustwalker with them. A saved profile, bot set or map that still names one plays its closest kept character.
- Renamed: Ashwalker is now **Shaka Mpande**, Dale is **Cal**, Hector is **Bill the Barbarian**, Saint Nick is **Santa**, T-350 is **T-TreeFitty** ("built to sweep floors for $3.50/hr") and Agent Zhao is **Customs Agent Zhao**.
- Moved: Bill the Barbarian, Santa and Cap'n Barnacle to Knights & Legends; Elder Tomo and Customs Agent Zhao to Everyday Folk.
- Second pass: Engineer and Warden leave too (a saved Engineer plays Cal, a Warden Grunt '68). Renamed: Brother Ansel is **Brother Silencio**, Cap'n Barnacle **Cap'n Rusty Barnacle**, Grizzelda **Goblina**, Sgt. Pruitt **Sgt. Mackie**, Anubis **Anoobys**, Dusty Colt **Dusty Ranger**, Hazmat **Hazmat Joe**, Vanguard **Luther Vanguard**, and the mannequin skin is **Dummy** (enemy troopers keep their name). Linktifa is "a general larper".
- Slugger-9 leaves the roster for now (owner): a saved Slugger-9 plays T-TreeFitty.

**Bots named after their characters**
- Every character is a kind of creature now, and its bots are named that way: the first bot playing Scamp is **Scamp**, the next monkeys are Coco Bean, Chitter, Mango…; soldiers are a rank and a surname (**Pvt. Haskett**, **Sgt. Dunmore**, **Capt. Lindqvist**). 23 name lists of at least 96 names each (soldiers, monkeys, bears, wolves, dogs, cats, raccoons, critters, frogs, pirates, knights, ninjas, wizards, barbarians, zombies, horrors, robots, aliens, goblins, cowboys, gangsters, townsfolk, gods & legends); no two in a match share a name, players' names and your bot set's included. Designs of yours take the general bot names.
- **Bot characters**: keep random bots to some characters, e.g. soldiers only for a D-Day map (any new soldier skin joins in). The map sets it (MapMaker → map properties → Bots → Bot characters: groups and/or name themes) and the host can change it: Play → Match setup → Bots → Bot characters (Map default, All, a group or a theme), the pause menu (live: bots out of it change where they stand), or a server's rules (`rules cast soldiers`). Your own bots (bot sets) keep their names and looks.

**MapMaker**
- Painting the ground with a style pack's swatch now paints the terrain that matches it: Packed Snow, Snow Drift and the ices paint snow, Shingle gravel, Root Cover dirt, and so on (it used to paint whatever ground the Terrain tab had, often dirt or grass). The status bar says what it paints, e.g. "paint Snow (Packed Snow)".

**The original characters' hats, glasses and beards**
- Head gear is now made to fit each character's own head (men's and women's heads differ) instead of sitting on it as bowls and rings. **Caps** have six seams up to a button and a curved peak; the **beret** has a leather band and badge and drapes down over the right ear; the **wide-brim hat** has a pinched crown, a band and a brim turned up at the sides; the **beanie** a ribbed, turned-up cuff; the **headband** lies over the hair and is knotted at the back; the **bandana mask** hangs in a point below the chin. Hair under a hat no longer pokes through it.
- **Sunglasses** sit on the nose with their arms back over the ears; **goggles** have cups against the face and a strap round the head.
- **Helmets are real models** (the owner's Meshy helmets), each seated on the head it's worn on: Engineer wears the brimmed helmet, and the combat helmet is the military model. The steel, aviator, brimmed and horned helmets are also in the Character Designer.
- **Beards** are full beards now, from the sideburns down the jaw with a moustache, in the hair colour (the old one read as a stuck-on moustache).

**Bots**
- 108 bot names (from 12): even a full 96-bot match gives every bot its own name instead of "Mildred 2", "Mildred 3"…
- **Bots stop shooting rocks.** A bot fired whenever its aim was on the target, even when the line from its eye (where every shot starts) ran into a boulder, a wall or a slope in between: on Shingle Point a quarter of bots' trigger pulls went into the world short of the target, the gully boulders worst of all. Now a bot holds fire when that line is blocked and fixes it: it brings a wandering aim back onto a target in the open, aims at the head and shoulders that show over low cover, or stands up from a crouch / steps aside. Over eight seeded two-minute Shingle Point matches (24 bots) shots into the world short of the target went from 28 % to 8 % of trigger pulls, rounds that hit someone from 8.8 % to 10.5 %, with about as many kills (206 → 201) from a quarter fewer rounds; trigger pulls aimed into the gully boulders: 190 → 7.
- Small and large characters' bots now see, aim and shoot from their own eye height (a small bot used to look over a wall its rounds then hit), and aim at the middle of a small or large body.
- Small and large characters join a match at their full health (85 / 115); their first life used to start on 100.
- Suppression fire (SUPPRESSOR bots) at the spot an enemy ducked out of sight is shorter (1.5 s) and only while the rounds reach that spot.

**Weapon wheel**
- Carrying a lot no longer crowds the wheel: up to nine weapons look as before; with more, the items shrink to fit the ring, the names move to the middle (which shows the one you point at), and past sixteen only the icons stay round the ring.

**Vehicles**
- The buggy's cockpit is built in-house and stays crisp up close: a roll cage of clean round tubes in dark powder coat, bucket seats with red five-point harnesses in all three rows, a floor pan and footwell, a dash with a sand cowl, toggle switches and dials, and a steering wheel that turns as you steer. The speedometer's needle reads your speed and the rev counter climbs through the gears. Only you see it, in first person; everyone else sees the buggy as before. The cropped Meshy interior it replaces is gone (3.6 MB less to download).

**Characters**
- **Five new characters** in Character Select, all the owner's own Meshy models: **Barnaby Bruin** (Animals), a bear in a striped red coat and top hat; **Slugger-9** (Creatures & Machines, large), a robot ballplayer; **Rusty Mech** (Creatures & Machines, large), a white war machine gone to rust; **Freaky Frida** and **Scary Larry** (Undead & Horror), wide-eyed and grinning. Each holds every weapon with its own hands, in third and first person.
- Characters whose textures are cut into thousands of small pieces (Barnaby's coat, Slugger's plating, the Mech's armour) now get a fresh texture layout painted from the full model, so they fit the character budget with their colours where they belong.
- **Nine more new characters**, all the owner's own Meshy models: **Honest Abe** (Knights & Legends), stovepipe hat and frock coat; five soldiers, **Virtua Soldier** (low-poly, in blue camouflage), **Hollis**, **Briggs**, **Pemberton** and **Kenji**; and three undead ones (Undead & Horror): **Zombie Soldier A**, a skeleton paratrooper, **Grinning Gus** and **Dog Tag Doyle**.
- **Characters look right from a distance.** Past 18 m every character switches to a lighter copy of itself, and that copy used to scramble its colours (Saint Nick wore white streaks over his red coat, Croakley went grey, Big Bab's shirt turned to noise). The far copies are now cut so each piece of the texture stays where it belongs, and Saint Nick's has half again the detail. Through a scope, characters keep their full detail as far out as the scope magnifies (a sniper scope: about 70 m).
- **Sharper faces and hands** on King Aldric, Bandit, Desert Ranger, Dust Trooper, Grizzelda, Thornweaver, Lancer Mei, Sgt. Pruitt, Rotter and Saint Nick: rebuilt with more detail where it shows (head and hands) and finer surface detail.
- **Bandit** holds his rifle lower and out beside his snout instead of across his face.
- **Character portraits** reframed for Bandit, Boglurker, Croakley, Sir Galloway, Grizzelda, Lancer Mei, Rattles, Rotter, Shade and Saint Nick: the face in the middle of the picture, nothing cut off.

## 0.6.0 (2026-11-01)

**Main menu**
- **Characters** is back on the main menu (Character Select), beside the Profile entry top right.

**Weapons**
- The Spear is now a carved wooden spear with an iron head (the owner's pick, a Meshy community model), about as long as a person is tall: in your hands in first person, in other players' hands, lying as a pickup, in flight and stuck where it lands.
- A thrown spear points the way it flies and stays at that slant where it sticks (it used to fly and land facing one fixed direction).

**Effects**
- **Fuller hit and explosion effects** (Binbun's Stylized Hit FX and Explosion FX, the full editions the owner bought, CC0): rockets, grenades, barrels, traps, the bomb, plasma and orb launchers, flares, discs and vehicles each blow up their own way, and a blast with nothing under it is an air burst.
- **Rounds land differently on each surface**: metal throws sparks with a hot glint, wood and earth puff their own dust and no sparks, stone a grey puff; hits on bodies get a small flash with the blood. Muzzle flashes stay matched to each weapon class.
- **Moments of play have effects**: picking something up (by kind: health, weapon, power-up, the rest), spawning, stepping through a portal (both ends), being thrown by a jump pad, a trap going off (shock traps crackle) and grabbing a zipline.
- Which effect plays where is data (content/vfx.json `map`), and a match fetches only the effects it uses (about 9 kB each, gzipped); quick effects give way when a big fight has many playing, so explosions always show.

**New props (the owner's Meshy models)**
- **Military**: Concrete Barrier (hazard stripes), Hazard Block Barrier, Plastic Road Barrier, and two parked vehicles: **Raider Buggy** and **Armoured 8x8 Truck** (also under Vehicles).
- **Medieval Village**: Smithy Workbench (anvil and tools) and a Tiled Well. **Jungle Ruins**: a Ruined Stone Stair you can climb.

**New character**
- **Rourke** (Folk): a rugged drifter in a leather coat. A robot batter, Slugger-9, is ready but waits for a lighter build, like Barnaby.

**Ziplines (map format v25)**
- Real **ziplines**: press **E** under either post (or anywhere under the cable) to grab one, hang below it and ride to the far end. The trolley holds the line's speed (uphill too) and runs faster downhill; **Space or E** lets go and keeps your momentum; the far end drops you off onto the ground or platform there; a hard hit knocks you off. One hand holds the trolley: **sidearms and blades** fire while you ride, two-handed guns wait until you let go. Predicted like any movement; the view banks with the ride; a trolley over every rider and its whirr.
- **MapMaker → Zipline** (Platforms & Climbing; also in the Jungle Ruins pack): place the start post, then **Place ends on the map** puts the far post where you click (drag either end). Inspector: far end, post height, speed, both ways, team only, droop. The validator checks length and slope, that the cable and a hanging rider clear the level all along, and that both ends can be reached and landed on.
- **Bots** ride ziplines when it's the shorter way (each line is a one-way link in their navigation; a two-way line goes both ways; team lines only for that team).
- **Vinefall Sanctum** has two gorge ziplines, one from each team's terrace down across the gorge to the far bank.

**Vehicles**
- **The buggy drives like a Warthog** (and the gun jeep like its firmer cousin): each wheel has its own spring, so the body bounces over bumps, leans out of turns, squats when you floor it and dives when you brake, tips its nose a little in the air off a jump and lands bouncing. The tires roll with your speed, the front ones steer and each one rides its spring (the gun jeep's own wheels too). Both are loose at speed: a hard turn flat out powerslides. In the cockpit view your head follows the bounce gently, so it reads in the dash rather than your stomach. Tank and armored rover stay heavy; hovercraft and flyers are unchanged.
- **Look to steer** (Options → Controls → Vehicle steering): the vehicle turns toward where you look, Warthog style, and the view stays where you point it; A and D still steer. Classic A/D steering stays the default.
- Driving no longer shakes: the body's lean, squat and dive come from the vehicle's real speed and turn rate instead of from frame-to-frame movement of its drawn position, and that position no longer jumps with the few ms each update arrives early or late. Most noticeable in the buggy's cockpit view.
- The buggy's cockpit is drawn in far more detail while you drive it in first person (seats, wheel, dash and roll cage at about twice the geometry, with a sharper surface map); everyone else still sees the lighter model.

**Hands on guns (grip pass 2)**
- Support hands hold a long gun's handguard: the hand cups it over the base of its fingers and closes all the way round it (it used to sit under the gun, palm up with its fingers standing open: King Aldric, Dusty Colt, the Dapper, Shade, Ricochet and others).
- Mitten-like hands (most Meshy hands, whose fingers can't be told apart) curl along the whole finger instead of folding once at the knuckles like a paddle; long fingers (Croakley, Scamp, Old King Halvard) curl further.
- King Aldric has real hands: his fur cuffs had been taken for his hands (their fingers curled into flaps) and his model's hands were cut to a few dozen triangles; he is re-cut from his Meshy rig with more detail kept for the hands.
- Capt. Nova no longer holds her rifle against her helmet: a long gun's barrel keeps clear of every character's head.
- Biscuit is rebuilt from his T-pose model (a cleaner body and paws); his paws stay firm on the grip in every view.
- Teddy's round paws no longer tear when they close on a gun, and the Hyena Warrior's claw sits round the grip.

**New characters and sharper ones**
- Six new characters from the owner's Meshy T-pose models: **Croakley** (a frog in suspenders), **Scamp** (a small monkey) and **Greyfang** (a wolf) in Animals, **Snikkit** (a goblin) in Creatures & Machines, **Old King Halvard** in Knights & Legends and **Sgt. Pruitt** (a police officer) in Soldiers. A seventh, Barnaby Bruin (a gentleman bear), waits for a lighter build.
- The Visitor, Elder Tomo, Flt. Lt. Ember and Merrow the Wise are rebuilt from fresh downloads of the same models: sharper faces and hands, and hands fitted to the T-pose so they close on the grip. Merrow's hands come out of his sleeves.
- Bandit (the raccoon) is built from his Meshy rig again (a later rebuild had fallen back to a fit that fused his legs and turned his head).

**Main menu: Profile**
- The character card top right is now your **Profile**: your character's portrait and name, your player name and whether you're signed in (Guest, ✓ Signed in, Pick a username). It opens the Profile panel (also P, or Y on a controller): your character with **Change character**, your name, **Sign in** / **Sign out** and your username, your region and the privacy link. The separate Characters item is gone from the menu.
- **Sign in** is no longer a small link in the bottom bar: signed out, an orange Sign in button sits under the Profile card and in the Profile panel. (Same Google sign-in as before.)
- The bottom bar is tidier: key hints in three groups (getting about, the screen's actions with the main one in cyan, Fullscreen), the same size everywhere; the news shows on the main menu only, and the turn keys moved next to the turn buttons. Phones show no bottom bar off the main menu.

**Character Select**
- Characters are grouped by what they are: **Soldiers**, **Knights & Legends**, **Everyday Folk**, **Undead & Horror**, **Animals** and **Creatures & Machines** (plus Yours), instead of by how the look was built (Originals, Ranger, Peasant, Sportswear, NPCs).
- One scrolling grid instead of a long row of tabs: each group under a compact header with its count, and a strip of section chips above that lights the section you're looking at. Click a chip, or press Q / E (LB / RB), to glide to a section; the wheel, trackpad and touch scroll straight through, and arrow keys and the d-pad move across section ends. It opens on your character. Back and Choose return to where you opened it (Profile or Online).
- Clicking a character shows them; **Choose** (or Enter / A again, or a double-click) makes them yours, and Back keeps the one you had. Hovering no longer swaps the preview, so you can drag the model round with the mouse. Your current character wears a **Chosen** badge.

**Props: the owner's Meshy models**
- Twelve new hero props made by the owner with Meshy, each with a baked normal map and a lighter version for distance: market stalls for Desert City, Medieval Village and a rustic one for the harbour, frontier and desert sets; a wishing well; a crawler crane (10 m); a Mayan guardian, a fire-dragon statue, a spear guardian and a seated monk for Jungle Ruins and Desert City; a tiered plaza fountain, a lion-head wall fountain and an eagle stone fountain for Medieval Village, Desert City and Coastal Harbor.
- They replace the simple stand-ins under the same names, so maps that place them update on their own: Desert City's market stall, well and crane, Medieval Village's well and Jungle Ruins' large temple guardian (Qasr Medina, Market Town, Vinefall Sanctum).
- Market Town's square has the new tiered fountain on its plinth.
- You can walk under the crane's boom: only its tracks and cab are solid.

**MapMaker: drop routes**
- The **Dropship** can fly a drop route: Paths has **Plane Drop Route** and **Dropship Drop Route**, and the inspector an **Aircraft** choice. Routes can be drawn in and out of the map's boundary (green over the play area, grey outside).
- Players and bots can only jump out over the map, above ground they can land on (not off the map, over the void, lava or acid); a jump elsewhere says "Not over the drop zone", and anyone still aboard when the craft leaves the map is dropped at the last good point. Bots pick a jump point near their objective that lands them somewhere they can walk from. Same rules for the transport plane.

**Market Town and Style Pack 10 Medieval Village**
- The Market Hall's roof was upside down (a V); it's an A now, on every map that uses it.
- The square's fountain is sized to its plinth and stands on it (it was 9 m across, overhanging and floating).
- Building details: no more flickering bands along the tops of house fronts and the balcony edge or on the hall's floor; the shop awning slopes on brackets instead of hanging posts; the shop shelves no longer block the side door; the stone plinth stops at doorways; the watchtower has cross-beams instead of a board through its lookout; the bell tower's belfry floor no longer flickers; the tarp tent's canvas meets its ridge pole, the hay cart's shafts rest on the ground and the shop sign hangs clear of its bracket.

**Graphics**
- Models made with Meshy keep their shape: props, weapons and several characters were cut down from the downloads so hard that they turned lumpy and flat-shaded. Each now carries a normal map baked from the full download (its fine shape and Meshy's own surface detail), so a cut mesh shades like the original.
- More detail where it shows: the first-person weapons, turrets and the buggy carry 10,000–14,000 triangles (from 4,000–6,000) with a sharper 1024 px colour map, the big landmark props (excavator, haul truck, historic building, gantry crane, shipping containers) 7,000–14,000, small props 4,500. Copies far away (a crowd's guns past 12 m, landmark props past 40 m) draw a lighter version.

**Host Service (dedicated host)**
- Every match setting a browser host has is now in the launcher, the console and the settings: score and time limits, respawn, friendly fire, mixed-up pickups, weapon drops, team leaders, spawn on teammates, kill streaks, character sizes, gravity, fall damage, lethality, ballistics, emotes, spears or discs only, classes, vehicle damage, the number of teams, team names and colours, team balance, and the Fort Wars, CTF, King of the Hill and race settings. A new **Match rules** card in the launcher; `rules` in the console; `RULES` in host.json. They apply as on a browser host (live, at the restart, or at the next match, and the launcher says which), for every match the server plays, with score, time and respawn kept per mode and any rule settable for one map only.
- Bot skill and style, people at most and the idle limits change live from the launcher (Players card) and the console (`skill`, `style`, `maxplayers`, `afk`, `idlekick`); uneven teams from the console (`teams 10 8`); a join message each player gets (`motd`, the launcher's Game browser card, `MOTD`).
- Whatever is changed while the server runs (from the launcher, the console or an in-game admin) is kept for the next start.
- Players' games follow a restart with new rules (the score limit on the HUD).
- Smoother big matches: the server makes about 40% less garbage a tick at 96 players (half as many garbage collections in a tick on Iron Maw), and the match process runs with a bigger young generation, so the hiccups from collections are rarer and shorter.

**Characters**
- Hands on guns, fixed for the Meshy characters (the Dapper and others): their hands were turned a quarter round on the grip, palm to the camera and fingers spread beside the gun, in first person (Full body and Arms only) and third person. Each hand is now turned onto the gun by its own shape; in Full body your hands are drawn a little smaller and the shooting hand follows the gun when you look up or down.
- Full body first person: looking up no longer shows a strip of your own coat across the sky.
- The Grapple Hook's rope leaves the launcher's muzzle (it seemed to come out of your chest) and stays on it while you're pulled in.
- Imp and Puglin players hold their guns forward at the chest with both hands (the gun hung backwards at the hip), and stand about a player's height (the Imp was half one). Looks only: the hitbox is unchanged.
- Scolitex is no longer a playable character (owner's call); it stays an enemy and a saved choice of it still loads.
- Body sizes (owner's call): Giggles and The Visitor are small, Boglurker and Rattles large, and Punkin back to normal.
- Every character's hands close round the gun: many Meshy characters held it on flat, open palms or with their fingers bent back off the grip (Big Bogdan, Shade, Hector, Grunt '68, the Dapper, Saint Nick, Sir Galloway and others). Relaxed hands that were taken for fists now bend, hands turned on their wrists are read the right way round, and fingers always close onto the gun.
- Sharper faces and hands on the most cut-down characters (Lancer Mei, Sir Galloway, Dale, Brother Ansel, Merrow the Wise, King Aldric): the head and the hands now keep their share of the model's detail.
- Character Select shows your character three-quarter on, so you see how it holds its gun (the rifle used to point straight at you).

**Maps**
- New map: **Vinefall Sanctum**, an overgrown temple city split by a river gorge for 8–24 players (Deathmatch, Team Deathmatch, Capture the Flag, King of the Hill), the demo of the refreshed Style Pack 06 Jungle Ruins. The Embers hold the south sanctum, the Tide the north; each side has a stepped ziggurat crowned by a shrine (a sniper rifle at its altar), two carved temples with portcullis gates and roofs you can run along, waterfalls with a way through behind the falls and a timber watch tower at each end. Cross the gorge by three rope bridges, by the high rope and stone bridges between the terraces, or wade the river below for the dynamite and heavy armour, then climb out by the gorge steps or the vines. Made in MapMaker.
- New map: **Saltmarsh Harbor**, a working fishing harbour for 12–24 players (Deathmatch, Team Deathmatch, Capture the Flag, King of the Hill), the demo of Style Pack 11. The Embers hold the net sheds in the south-west of the town, the Tide the end of the east mole. Fight along the quay and through the fish market, out along the pier to the breakwater, over the boardwalk to the lighthouse, or straight across the harbour on a jet ski or swimming, and climb out by the sea wall steps, the slipway, the beach or a ladder. Snipe from the lighthouse gallery or the crane. Made in MapMaker.
- New map: **Whiteout Station**, an arctic research outpost on a frozen lake for 8–24 players (Deathmatch, Team Deathmatch, Capture the Flag, King of the Hill), the demo of Style Pack 12. The Embers hold the vehicle hangar and barracks on the south shore, the Tide the radar dome, comms mast and barracks on the north. Cross the lake between pressure ridges (thin ice gives way over the holes), take the frozen ridge in the west up its snow drifts, or push up the east past the bunkers, along the pipe catwalk and the snow road where the snowmobiles run. Climb hut and barracks roofs by their outside stairs; roll the hangar door down from the button inside. Made in MapMaker.
- New map: **Qasr Medina**, a walled desert medina for 8–24 players (Deathmatch, Team Deathmatch, Capture the Flag, King of the Hill), the demo of Style Pack 09 Desert City. The Embers camp outside the south wall, the Tide come in from the palms by the domed hall and the minaret. Through the gate (a portcullis) or the gaps at either end of the wall, up the high street under rope bridges and cedar galleries, past market stalls and a well court to the covered bazaar and the courtyard of arcades. Climb the houses' stairs or the outside stairs onto rows of flat roof terraces joined by rope bridges, hold the courtyard's terrace or one of the watch towers. Made in MapMaker.
- New map: **Market Town**, a walled medieval market town for 8–24 players (Deathmatch, Team Deathmatch, Capture the Flag, King of the Hill), the demo of Style Pack 10. The Embers camp outside the south wall, the Tide hold the churchyard round the bell tower. Through the gate (raise or drop its portcullis; a ladder to its roof) or the gaps at either end of the wall, over the stream by one of three stone bridges, up the high street to the market square and its hall. Fight room by room through half-timbered houses whose upper floors open into each other and onto a walkway over the street, climb outside stairs onto the red tile roofs, and hold the watchtowers or the bell tower over the whole high street. Made in MapMaker.
- New map: **Sunken Kingdom**, a partly flooded sandstone oasis city for 16–32 players (Team Deathmatch, Capture the Flag, Deathmatch, King of the Hill; Elimination, Fort Wars and Zombies too). A ruined palace round a circular arcaded courtyard sits in the low town; the western colonnade looks down from its cliff over the turquoise lagoon, the eastern gatehouse holds the road, and the market arcade, the north spring and gate and the stepped temple stand on the upper terraces, with falls pouring into the lower courts. Three loops on the surface (the northern terraces, the palace ring, the southern water courts) and the buried cistern underneath, from the west stair court to the east, with rockets in its flooded hall. Made in MapMaker from the owner's brief and reference picture.

**MapMaker**
- **Style Pack 06 Jungle Ruins, refreshed** (from the owner's Jungle Ruins and Ancient Temple tileset sheets, folded into one pack): 20 new pieces (Temple Terrace and Terrace Stair that stack into ziggurats, Carved Temple with a portcullis gate and a roof walk, Summit Shrine, Carved, Relief, Window, Arch, Column and Low temple walls, Beamed Colonnade, Arched Vault, Jungle Watch Tower, Chasm, Gorge Steps, Chasm Rope Bridge, Rope and Stone Bridge Spans, Waterfall Wall with a passage behind the falls, Overgrown Ruins), 26 props of our own (zipline post, crane and pulley, wooden platform, temple guardians, obelisk, spire, fire bowl, hanging brazier, wall torch, teal and red banners, tree root arch, mossy trunk, plant cluster, planter, pottery, rubble, collapsed and broken columns, sarcophagus, spike row, chain and rope rails, altar, overgrown beam), an Ancient Temple theme and new materials (mossy stone slabs, carved temple stone, relief carving, teal-and-gold inlay tiles, root cover, mossy planks, temple sandstone, palm thatch). The pack now lists the portcullis, braziers, wall torches, ladders and the Grapple Hook (for crossing between zipline posts: there is no zipline ride yet). Every earlier Jungle Ruins piece is still there and the maps built with them load as before.
- **Style Pack 11 Coastal Harbor** (from the owner's Coastal Harbor tileset sheet): 20 pieces (Timber Pier, Pier Head, Boardwalk and its corner, Quay Wall and its corners, Sea Wall Steps, Slipway, Shingle Beach, Harbour Basin, Breakwater, Harbour Warehouse, Net Shed, Harbourmaster's Office, Fish Market, Lighthouse, Harbour Crane, Harbour Arch, Quayside), 18 props of our own (bollard, capstan, lobster pots, buoys, net rack, fish stall and boxes, fishing boat, anchor, rope, lamp post, life ring, nets, gull, tide board, mooring dolphin, tyre fenders), a Coastal Harbor theme, new materials (pier decking, quay granite, harbour setts, shingle, sea bed, rusty and blue corrugated iron, tarred boards, harbour render, lighthouse bands, harbour paint, lamp glow), Harbour render and Tarred timber facades, and **Harbour Water** (deep enough to swim, 1.5 m under the quay).
- **Style Pack 12 Snow Outpost** (from the owner's Snow Outpost tileset sheet): 17 pieces (Prefab Hut, Barracks and Comms Tower with snow roofs you climb onto by outside steel stairs, Vehicle Hangar with a mezzanine, Snow Bunker with a drift up onto its roof, Steel Watchtower, Radar Dome, Fuel Depot, Steel Catwalk, Metal Stair, Ice Wall, Frozen Cliff, Snow Drift, Frozen Lake, Pressure Ridge, Ice Hole, Snow Road), 16 props of our own (satellite dish, antenna mast, diesel heater, generator, snowmobile, crates under a tarp, lamp post, flagpole, chain-link and snow fences, pipe run, oil drums, radio console, ski rack, supply sled, snow pile), a Snow Outpost theme with a snowy, misty backdrop, new materials (packed snow, snow drift, lake and glacier ice, red and white prefab panels, snowy concrete, frozen rock, steel grating, red beacon), Prefab panels and Snowy concrete facades, and three gameplay pieces: a **Roll-up Door** for hangars, a breakable **Ice Block** and **Thin Ice** that gives way under you.
- **Style Pack 09 Desert City** replaces 09 Sands of Egypt (from the owner's Desert City tileset sheet): 18 pieces (Plaster, Ashlar and Shop houses two storeys high with stairs up to flat roof terraces, Outside Stair, Rope Bridge, Cedar Gallery, Courtyard, Covered Bazaar, Market Street, Domed Hall, Watch Tower, Minaret, City Wall, Wall Stair, City Gate, Arcaded Terrace, Well Court, Paved Street), 20 props of our own (market stall and canopy, banner, hanging lantern, palm planter, water well, vase, jars, rug, timber crane, cloth line, scaffold, awning, lattice and shuttered windows, spice baskets, floor cushions, rug rack, column, ornate arch), a Desert City theme, new materials (sandstone ashlar, weathered plaster, blue dome tiles, zellige, worn paving, sandstone tiles, market rug, mashrabiya lattice, red canopy, cedar beam), Desert ashlar and Desert plaster facades and a breakable **Lattice Screen**. Every Sands of Egypt piece is still there (maps that use them load as before) and comes with the Desert City pack in the picker.
- **Style Pack 10 Medieval Village** (from the owner's Medieval Village tileset sheet): 16 pieces (Timber, Shop and Plaster houses two storeys high with walkable red tile roofs, Outside Stair, Timber Walkway, Market Square, Market Hall, Town Wall, Wall Stair, Town Gate, Bell Tower, Watchtower, Stream, Stone Bridge, Cobbled Road, Blacksmith Forge), 20 props of our own (well, awning, pavilion, shop sign, hay cart, forge, workbench, planter, tarpaulined crates, tarp tent, chimney, wattle and spiked fences, church bell, market cross, stocks, oak post, grain sacks, bay window, shutters), a Medieval Village theme, new materials (cobblestones, granite setts, market tiles, red roof tiles, timber and plaster, wattle, packed dirt, whitewash, oak beam), Half-timbered and Village whitewash facades, an **Oak Door** look and a breakable **Wattle Hurdle**.
- Fifteen more props made with Meshy: wooden, blue, yellow hazard and three rusty barrels (they break when shot), two trash cans, a wheelie bin, two trash piles, a dumpster, a fuel can, a hanging shop sign and a historic city building.
- Thirteen new props made with Meshy: an army crate, three wooden crates, a crate stack and a sci-fi cargo crate (Crates & Barrels); five shipping containers (old and rusty with its doors open, rusty blue, rusty red, long red and white), a yellow gantry crane and an IBC tank (Industrial).
- Two new props in Mines & Caves, made with Meshy for Iron Maw: a Bucket-Wheel Excavator (29 m long, 16 m tall) and a Mining Haul Truck (12 m long, 7.4 m tall). Both are solid scenery you can take cover behind.
- The top bar fits itself: whenever its buttons don't fit (Safari draws them wider than Chrome), it shortens labels and tucks away the less-used ones until they do, so PLAY TEST is always on screen.
- Paths laid into the ground no longer paint a staircase of squares along their edges: only ground wholly under the road takes its material (the road covers it), and plants clear just along it.
- Terrain → Main ground: change the material the terrain is mostly made of in one step (what you painted by hand stays).
- Terrain → **Smooth all** (Light, Medium, Strong): smooths the whole ground in one undo step. Small bumps and pits go; slopes, banks and hills keep their shape. The ground under blocks standing on it (and 1.5 m round) stays as it is, so buildings and walls neither float nor sink, and spawns, pickups, flags, vehicles and props on the ground move with it.
- Real places: **Heights from a height grid file** gives smooth ground. A grid thinned to fit now averages the heights round each point instead of taking the one under it (lidar's kerbs, hedges and building edges no longer alias into a jagged surface), and a new **Smoothing** amount (Off, Light, Medium, Strong; Medium by default) smooths the file before it becomes the terrain.

**Maps**
- New map: **Iron Maw**, the biggest yet (480 m of ground, a 408 m play area, built for 48 v 48): a gigantic open-pit mine. Six benches of rock spiral down round the excavation to the pit floor, where the bucket-wheel excavator works among haul trucks. Drive the spiral haul road from the crusher to the floor or the steep switchbacks on the south-east face; climb the ladder at every bench end, ride the headframe and shaft lifts, or cut through the rock tunnels on the south rim and the west and deep benches. Embers hold the motor pool on the north-west rim, Tide the workers' barracks on the north-east, with the ore crusher, screen house and mills between them joined by walkable conveyor gantries, a 300 m overland conveyor to the stockpile yard and a rail loadout in the south-east. Team Deathmatch, Capture the Flag, King of the Hill (five hills), Fort Wars, Bomb, Elimination, Deathmatch and Zombies; buggies, gun jeeps, armoured rovers, tanks and hover bikes at both camps and more on the benches.
- St. John's: the ground is smooth. The jagged little bumps left over from the survey are gone; the terrace, the church knoll and the bluff to the Bark River flats keep their shape, and the halls still stand on their levelled ground.
- St. John's is laid out on the real campus: every hall stands on its OpenStreetMap footprint at its real place and size (Hazelwood and Scott Johnston along Exeter Street, the Knight block, the Argonne Gate, Welles with its clock tower and DeKoven's long wing, Memorial Hall, the Victory Memorial Chapel, Smythe Hall, the Farrand gym, the old red church in its churchyard, Mouso Hall), the streets and walks are the real ones, and the ground is the real ground from USGS 3DEP elevation: the halls on their terrace, the church on its knoll and the bluff falling 8 m to the Bark River flats in the south-east. The map covers 400 × 300 m round the drill field (the real campus and Lake Nagawicka run on past it), with trees along the streets. The castle halls keep their towers, battlements and rooms, stretched to the real footprints; the team bases, pickups, vehicles and modes are as before. Map data © OpenStreetMap contributors (ODbL); elevation: USGS 3DEP (public domain).
- MapMaker, for the game's owner (like Publish): Environment → Terrain → **Real places**. **Heights from a height grid file** turns an ESRI ASCII grid (`.asc`, heights in metres laid out in map metres) into the terrain in one undo step, thinned to fit 161 × 161 heights (so up to 400 m at 2.5 m), with the height you type (or the one at the centre) at ground level; **Trace image** lays a plan or map of the place over the ground while you build, see-through, at the edges you type. Neither file is kept in the map.

**Characters and vehicles**
- Full-body first person: look down and you see your own character, its legs and feet walking, running, crouching and jumping with you, and its own hands on the gun (no more torn-off forearm swinging into view on long guns). The gun handles exactly as before (bob, recoil, aiming down the sights, reloads, switches). Options → Display → First person: Full body (the default) or Arms only (the old view). In a vehicle seat the view keeps the arms.
- The Iron Knight holds his guns: his gauntlets close round the grip and the handguard (they used to float open beside the gun), in third person and first; in full-body first person his pauldrons no longer fill the view.
- Characters stand flat on their feet: 19 of the new characters (King Aldric, Uncle Bao, Thornweaver, Desert Ranger, Ashwalker, Agent Zhao, Vanguard and others) stood with their toes up, 7 to 23 degrees (and Bonesworth and Rotter on their toes). Their feet are now levelled on their soles when they are built.
- Count Bonesworth no longer hunches over his rifle; Ivory Rustwalker, Rotter and Grandpa Chains stand a little straighter too.
- The Buggy is now the owner's own Tactical Off-Road Beast: a long tube-frame buggy on big off-road tires. It seats a driver and three passengers on the model's two rows, and every passenger shoots their own weapon, all round (no more roof gunner). Its hit box now matches the body.
- Riders sit in the buggy's and the gun jeep's seats instead of standing in them (and through the roof): legs over the seat and down to the floor, hips facing the way the seat faces while the shoulders follow the aim. A seated passenger's rounds leave through the vehicle they ride in instead of hitting it, and shooting from a moving vehicle spreads like shooting on the run.
- The Gun Jeep takes five: besides the driver, the roof gunner and the cab passenger, two more ride sitting on the bed's side rails, legs over the side. Its hit box now matches the truck.

**Menus and look**
- Pause menu, laid out again: the Host tab is a set of cards in two balanced columns (Online; Teams & bots with its own Apply; Rules with "Apply on restart" right under them; Match, where Restart and End match sit apart in red under Change map; Rotation; Players). "Live" and "⟳ On restart" are said once per card instead of on every row, labels and controls line up, and Settings is three cards side by side. The menu scrolls inside only when it doesn't fit the window.
- Back, always one level: Esc, controller B and a new Back button at the top left of every menu screen, the pause menu and its windows (Bots…, Change map…, Add map…) go back one step: a text box first, then a window, then a tab, then the game. A held Esc no longer runs through several levels, and an Esc the browser uses to leave fullscreen or to free the mouse (Safari, or Chrome without Keyboard Lock) does nothing more in the menu. Fullscreen is one click away in the pause menu's and the main menu's footer (or F11).
- The key hints at the bottom of the menus are buttons: click "Esc Back", "Q E Tabs", "Start", "Fullscreen"… to do it. They show keyboard keys, and controller buttons (B, LB RB, A) only after you use a controller; a controller now also drives the main menu (d-pad, A, B, LB / RB, X / Y).
- Character Select: drag over the character (mouse or touch) to turn them round and see the whole look; a flick keeps them turning. The turn buttons (or , and .) do it too; leaving the screen faces them forward again.
- Character Select opens much faster: every built-in character now ships its portrait (18 Meshy characters and the 8 NPC skins were drawn in the browser, and each one froze the page while it was read back), a design of yours is drawn only after the grid is up, and the sounds no longer all synthesise at once on the first click.
- Your own designs get their portrait as soon as you save them, kept in your browser, so Character Select never draws them again.
- Character Select lists one mannequin (Trooper) instead of five that looked the same, and no longer the cyclops and oculus blobs. They're still enemies in the game, and a saved choice of one still loads.
- Scrolling through weapons is smooth: one weapon per wheel notch (a trackpad or smooth-scrolling mouse used to skip through several at once), and guns you've held are kept ready, so switching back no longer hitches.
- MapMaker: a new map starts on 160 m of open ground; New offers Skirmish (96 m), Medium, Large (240 m), Huge (320 m) or a sky map with no terrain (Environment → Terrain still adds or removes it). A map with nothing to stand on says so, and that terrain counts, not "no structural tiles".
- First person: your support hand holds big guns properly. On launchers, the Singularity Cannon, the Spin Gun, sniper rifles and other long guns it used to stop short and float in front of the gun (with a character's own arms, a hand on a stub of forearm near the middle of the screen); now both hands are on the gun for every character, the forearms rise from the bottom of the screen, the support hand cups the handguard from below, and on a gun too long to reach it slides back along the handguard.
- Weapon switching: after you had switched weapons by hand, the game kept asking for that weapon, so picking up a better gun no longer brought it up (or brought it up for a moment); the game's own switches stick again.
- Muzzle flashes no longer light up every wall on the map (each shot brightened the whole scene's ambient light, which flickered across buildings, indoors and out, with automatic weapons).

**Weapon wheel**
- Hold Q to open a wheel of the weapons you carry (each with its icon, name and ammo; empty ones dimmed), point at one with the mouse and let go to switch (a click picks too). A quick tap of Q still goes back to your last weapon; number keys and the mouse wheel work as before. Rebind it in Options → Controls. On a controller hold Y (a tap is still the next weapon) and point with the right stick. While the wheel is open you keep moving but don't fire, and the view holds still. It is only an overlay: no slow motion, the match keeps running.

**Phones and tablets**
- Touch controls, held sideways: a movement pad on the left (its middle jumps on a tap and crouches on a hold; push past its rim to sprint), drag on the right half to look, and Fire (drag it to aim while firing), Aim, Melee, Reload, Use, Throw and Weapons (the wheel) buttons, with a pause button top left. They feed the same input as the keyboard and mouse. Held upright, the game asks you to turn the phone sideways. No pointer lock: Resume starts play (fullscreen where the phone allows).
- Phones start on Low graphics and the Performance render scale (Options can raise them), and a match hosted on a phone holds at most 16 players.
- Menus by touch: bigger tap targets, (i) help opens on a tap, the home screen fits a phone's height, key hints are hidden.

**Spectating**
- Kill cam: when someone kills you, the view turns to them and follows them from just behind your body for a few seconds (or until you respawn), with a banner naming them, their weapon and the health they have left. If they're out of view it looks where the shot came from. Click or Space skips it.
- Watching while dead: follow players over the shoulder (click or → for the next, right click or ← for the previous; RB / LB on a controller) or fly a free camera (Space or Y; WASD, E/Q up and down, Shift faster) inside the map. In team modes online a dead player watches only their own team, with no free camera; free-for-all, offline matches, the host and pure spectators can watch anyone and fly. Touch players get ◀ Camera ▶ buttons.
- Spectate by choice: pause menu → Spectate takes you out of the match (a bot plays in your place; your slot and score wait for you) to follow players or fly the free camera; Join game (or J) puts you back. The scoreboard lists who is spectating.
- Watching counts as being there: turning, picking whom to watch or flying the camera keeps the away and idle rules off you (a spectator who touches nothing for the idle-kick time is removed, as before).

**Battle Axe**
- The Battle Axe is a black-powder blunderbuss as well as an axe: left mouse (or quick melee) swings it as before, right mouse fires the gun in its stock, a wide short-range blast of nine pellets with a heavy kick, a big flash and a cloud of smoke from the barrel. It holds two loads, loaded one at a time by hand from shotgun shells (R, or right mouse on an empty barrel; a swing stops loading at once). Up close blast and swing kill together; at range it falls off much faster than the Shotgun. The HUD shows its loads and shells.
- Bots with the axe close in to swing, fire the blunderbuss a few steps out, and load it again when clear. Bots with a knife or the axe now close all the way in rather than hovering just out of reach.

**Combat feel**
- Stopping power: a round that hits someone shoves them a little along the shot and slows them for a moment. A pistol barely does it; a shotgun or a sniper rifle noticeably (each weapon has its own value, defaults by category). It never stun-locks: within a fraction of a second the shove and the slow stop adding up, and then there is half a second's immunity. Bots feel it too, so suppressing fire slows a push.
- Hit flinch: a body reacts where it was hit: the head snaps back, the shoulders twist away from the round, a leg hit buckles it a little; heavy hits play the hit reaction.
- Explosions throw people up and out, much harder than before (every real explosion now does, grenades and rockets included), and they land again. Rocket jumps still work: your own rocket at your feet lifts you about 2.4 m. Blast kills fling the body with the explosion's force.
- Punch and kick: the quick-melee key (a side mouse button, or Y) punches with whatever gun you hold (jab and cross in turn), or kicks when you're moving forward or straight after a punch: a little damage and a stagger, no wait before you can shoot again. With a melee weapon in hand it swings that. Bots out of ammo up close punch too.
- Every death is physical: near you or in view a full ragdoll, far away a cheaper one, out of view the body is laid on the ground along the hit. Ragdolls come to rest sooner and then cost nothing; a blast that kills twenty doesn't stall the frame.

**Bots**
- Arena characters on the Mixed bot style (Pathfinder and the like) only hop in a fight, and less often; constant bunny-hopping is the Arena style's.
- Bots at the wheel no longer sit stuck: a vehicle that stops getting anywhere (wedged, or grinding along a wall) is backed out for a second, and if it is still stuck right after, the bot gets out and goes on foot, and leaves that vehicle alone for a while. Riders get out of a vehicle a bot driver has got stuck, and everyone gets out of one that is on fire.
- Bots fight enemies in vehicles: they switch to a rocket or grenade launcher (aimed at the hull), lob a grenade under one that has stopped, go and fetch a launcher lying close by, take cover from a vehicle they can't hurt, and step out of the way of one driven at them. Easier bots often don't see it coming and react later.

**Weapons**
- New models for many weapons, made by the owner with Meshy: the Submachine Gun is a Tommy Gun, the Spin Gun a rotary Gatling gun, the Sniper Rifle a scoped military rifle with a bipod, the Burst Rifle the Neon Flux, the Marksman Rifle the Frontier Rifle, the Plasma Rifle a futuristic blaster, the Pulse Pistol an energy handgun, the Freeze Ray a frosted freeze gun and the Goo Gun a glue gun. The Heavy MG Turret is a machine gun on a tripod, the Sentry Gun a big armoured sentry, and health pickups and the Medkit are a first-aid case. Each gun is held by its own grip, handguard and stock, in first and third person.
- New weapon: the Battle Axe (slot 1, a pickup). A slow, heavy swing (85 damage) that shoves whoever it hits.
- Weapons now have a category (pistols, SMGs and machine guns, rifles, shotguns, snipers, explosives, melee, specials).

**Pickups**
- Random weapon pickups (MapMaker → a weapon pickup → Weapon: "Random from category"): the pickup holds a random weapon of that category, and a new one each time it comes back. Host and players always see the same weapon.
- "Mix up weapon pickups" (Play → Match setup → Arsenal, and the pause menu's Host tab, where it applies at once): every weapon pickup holds a random weapon of the same category as the one placed there. A pickup marked "Keep fixed" in MapMaker stays as placed. Off by default.
- Drop weapon on death (on by default; Play → Match setup → Arsenal, and the pause menu's Host tab, where it applies at once): when a player or bot dies, their primary with ammo left (the gun in hand, else their best one; never the starting knife and pistol or a class's own loadout, tools or mounted guns) lies on the ground at the body for 30 s with exactly the ammo it had. Walk over it to take it; if you already have that gun you take its ammo up to your reserve and the rest stays. The rest of what they carried is recycled. At most 24 lie at once (the oldest goes first); none in Disc Arena, races or spears/discs only. Bots go for them like weapon pickups.

**Characters**
- Meshy characters hold their weapons with their own hands: each hand is measured from the model (palm, length, width, thickness), the palm that goes on the grip is the character's real palm, big hands wrap the grip instead of sinking into it or hovering beside it, and open hands close their fingers round it (hands that are already a fist or a gauntlet stay as they are).
- Every Meshy character shows its own forearms and hands in first person, instead of borrowed universal arms.
- 18 new characters: Ivory Rustwalker, T-350, Lancer Mei, Grunt '68, Sir Galloway, Hector, Count Bonesworth, Ricochet, Shambler, Rotter, Dale, Grandpa Chains, Hazmat, Shade, Botboy, Chef Basile, Dusty Colt and Shiba.
- 24 more characters, rigged by Meshy: King Aldric, Saint Nick, Brass Hare, Grizzelda, Bandit, Rattles, Teddy, Anubis, Ser Brannock, Brother Ansel, Big Bab, Agent Zhao, Desert Ranger, Groaner, Gorgle, Giggles, Vanguard, Dust Trooper, Punkin, Merrow the Wise, Uncle Bao, Bonejack, Ashwalker and Thornweaver.
- Lancer Mei, Count Bonesworth and Rotter have hands of the right size again (their arms were found too short, so a "hand" took in half the forearm), and Dusty Colt's fingers close round the grip.
- Unrigged models are rigged automatically: the joints are found from the model's shape (T- or A-pose), or Meshy rigs it when the API key is set. Meshy gets the download itself (`source.modelUrl: "upload"`, cut to 200k triangles when it's denser, since Meshy fails very dense models); it refuses links that don't end in `.glb`, so Drive links don't work.
- Adding a Meshy character is one manifest (`content/characters/<id>.json`) and one command (`pnpm content:meshy <downloads>`); community models are downloaded by hand, the owner's own are fetched through the Meshy API. A grip sheet (`tools/content/grip-sheet.mjs`) shows each character holding a pistol, rifle, shotgun and knife in third and first person (docs/CHARACTERS.md, "Adding a Meshy character").

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
- Bots take ladders up to roofs: a ladder up a wall with a window beside it no longer looks to them like a way through the window (they never path through intact glass), so snipers take the tower roofs instead of setting off across the map for far ledges they rarely reached.

**Matches**
- A match in the browser (offline or Host game) takes at most 48 players (24 v 24): every bot thinks and every character draws on that one computer. Dedicated hosts keep 96 (48 v 48). Bigger saved setups shrink to fit, and the "very big match" warning starts past 40.
- Bots driving a vehicle follow a road or route that runs their way: they keep to the right-hand side of two-way roads, never drive a one-way path backwards and keep to its speed limit.

**Controls**
- Mouse look in Safari: movement Safari merges between frames is added up again (it used to report only part of a fast move, so the faster you turned the more was lost); the jump right after the pointer locks and lone wild spikes are dropped; and look turns once per frame from everything that arrived. The flat "Safari ×2" now applies only to Safari versions that can't report the merged moves.
- Zoom sensitivity: aiming down the sights and scopes now slow the look by the zoom itself, so the view moves on screen as much per inch of mouse as in hip fire (it used to slow by the plain angle ratio, which made scopes feel faster than the hip). A new **Zoom sensitivity** setting (Options → Controls and pause menu → Settings, 0.2–3×, default 1×) adjusts it.

**Menus**
- The pause menu uses wide screens: up to 1400 px wide, with the Host tab in two columns (Online and teams & bots | rules, Apply, Change map / Restart / End, rotation) and Settings in groups side by side. Below 1000 px wide it's one column as before.

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

**Online**
- When the browser hosting your game leaves, you're no longer dropped to the menu with a bare error: you see the last scoreboard, "The host left", and **Host this map** (one click hosts the same map, mode and rules with about as many players, listed in the game browser so the others can find it) or **Back to menu**. A host leaving on purpose (Leave match, closing the tab) now says goodbye first; when the connection just drops, you get a few seconds of "Reconnecting to host…" before the game is called over.
- Games hosted in a browser survive their host leaving: the host picks the friend with the best connection as its successor in advance (everyone is told who) and keeps them up to date every few seconds. When the host leaves or drops, that friend's browser carries the match on (players, teams, scores, the clock, where everyone stood, health and weapons) and the others reconnect to it by themselves (they keep trying for a minute and a half while that browser starts the match), back in their own places with their scores ("The host left: Ann is taking over…"). The listing in the game browser moves to the new host. What starts fresh: shots in flight, pickups, vehicles, doors and map logic, NPCs, flags, Zombies waves and race progress. If the handoff can't happen, you get the host-left screen.

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
