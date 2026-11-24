# Changelog

Tile Trigger uses [semantic versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
Until the public launch (1.0.0), a minor bump marks a release with new features
and a patch bump a fix-only release. The version shows on the main menu
(`packages/client/package.json`). Each release is a git tag `vX.Y.Z` on `main`,
made only on a commit that passed CI on a check branch.

## Unreleased
- **St. John's is now St. Jasper's Military Academy**, a fictional school: its name in every map list, Featured, Quick Play and MapMaker, and its description (the map's id stays `st_johns`).
- **Roofs and windows: no light through the seams.** A sloped timber roof over thin walls no longer shows sky along the wall tops (St. John's library annex and every roof of that kind), and the library's glass windows no longer show a slit of light up their sides and along their heads.
- **St. John's dorm rooms: a mirror cabinet over every sink, a black footlocker at the foot of every bunk, and the two desks side by side in the corner by the window** (in every dorm piece in MapMaker; no extra props a room).
- **MapMaker: New map asks theme, modes, players and boundary on its one screen**, all pre-filled (Create straight away as before) and changeable later in Map properties; players suggest a size, and a boundary picked there is fitted round the new map from the start. A Start from layout keeps its own settings and shows them.
- **Match Setup: map categories.** Over the map grid, All dimensions and the six categories (Temporal, Dimensional, Environmental, Fictional, Anomalous, Custom), each with its count; a category's sub-tags (Medieval, Desert, Classic remake…) narrow it further. Retired maps and the Training Range are on no tab. Custom holds your own MapMaker maps and community maps, labelled "Community map".
- **MapMaker: Map properties → Categories**, a tick per sub-tag, so a map lists where it belongs in Match Setup (map format v50).
- **St. John's is Featured and in Quick Play Deathmatch**, in Citadel's place: Featured is Sandgate, Canyon and St. John's.
- **Match Setup: lighter map cards.** Each card's picture is a small copy of the map's in-game shot, fetched as the card comes into view: opening Match Setup fetches 0.6 MB of pictures instead of 1.8 MB.
- **Match Setup: one team size control.** The size chips and Teams / Per team set the teams; the team boxes show who plays (players and bots), and get their own sizes only with Even teams off.
- **Match Setup: glow only on the map you picked and Start match**, steady, and dimmer with Reduce flashing on.
- **Match Setup with a controller.** The d-pad or left stick moves a focus ring over the map cards and into the settings (held, it repeats); A picks, Menu starts the match, Y stars a map, LB / RB change category, LT / RT the settings tab, the right stick scrolls, and the hints show the controller's buttons.
- **Match Setup on phones: the map grid first**, the settings a sheet that slides up from a strip along the bottom (the map, the setup and Start).
- **St. John's: Memorial Hall's pass.** Its four corners are rounded, the roofs following (a rounded spire and a rounded hip end); its windows are real glass you see through, and a shot breaks a pane open; one spiral stair (the south one); more bookcases, taller; a bench along the upper floor's court wall to stand on and look and shoot out over the court; the small gabled annex moved over onto the middle of the hall's north end, and you go in at its red door and on into the library.
- **St. John's: Welles's end bay by the clock tower.** Its 2nd and 3rd floors are washrooms (toilet stalls, showers, sinks with mirrors); its ground floor, reachable only from the lane, is closed up.
- **Roofs: no more see-through edges.** A gabled roof's verge is closed by a barge board, so the slit along its edge where you could see into and through the roof is gone (St. John's library and its annex, and every roof of that kind).
- **MapMaker: rounded hall pieces, glass windows and washrooms.** New tiles Hall Bay (two storeys) and Rounded Hall End (plain, doorway, spiral stair); props Rounded Spire, Rounded Hip End and taller bookcases; a Gable Annex set piece; the library pieces' Plan, Annex door and Window bench options; the Dorm Bay End's Room option (dorm, washroom, closed).
- **Fewer draws for furniture and props.** A prop's flat colours share one material per pack, and still props standing together are drawn as one where they share it (a dorm room's sink, desk, bunk and door): far fewer draw calls on St. John's and other furnished maps, the look unchanged.
- **Citadel is retired, and the Training Range is for testing only.** Neither is in the map list, votes or rotations any more; Profile → Favourite loadout → **Test weapons** opens the Training Range alone with your class and optics, no score or clock, and Back returns to the loadout (docs/FEATURES.md).
- **Big matches draw a little cheaper.** Doors and buttons of one kind are drawn together (Flavius Rule's views about 30 % fewer draw calls), and the lights and shadows check less every frame; nothing looks different (docs/PERF_DRAWS_2026-11-23.md).
- **The Mounted MG and the Machine Pistol no longer stutter.** They fire short cuts of their reports (0.39 s and 0.29 s), so at 15 and 20 shots a second each shot rings out instead of the one before being cut off; the other guns on those sounds are unchanged.
- **Slow guns ring out.** Snipers, shotguns, revolvers and the Hand Cannon, the lever and flintlock guns, launchers and rockets, the railgun, vortex and disc now let their report ring for up to 1.5 s instead of stopping short (and the tank cannon sound no longer has extra shots in it); full-auto guns are unchanged.
- **Controller: lean, prone.** While aiming (LT) the d-pad left and right lean (held; otherwise they switch weapons as before), and holding B goes prone (a tap is still crouch); a controller the browser doesn't report a standard layout for now gets a one-time message instead of being silently ignored; the use prompt and in-game hints show the controller's buttons (RB to get in) after a controller press; Menu opens the pause menu and View shows the scoreboard; the stick has its own Stick look, Stick aim and Stick dead zone settings (the Mouse slider no longer moves the stick); the next-map vote takes the d-pad or stick and A.
- **Remap every control; Q and E lean.** Options → Controls lists every keyboard and mouse action by group (click, press a key or mouse button; clash warning with Swap; Reset to defaults), saved with your account when signed in. New defaults: Q / E lean, F use and doors, X last weapon, hold Tab the weapon wheel, a tap of Tab the scoreboard; keys you had moved stay yours, and every hint shows your keys (docs/CONTROLS.md).
- **Red dots and holographic sights sit at a sensible size.** On long guns the eye comes to the glass instead of the whole gun being drawn up to three times larger, so the housing no longer fills the middle of the screen and the gun's rear no longer blocks the bottom (the Woodland SMG and every rifle, SMG and shotgun that takes one); the red dot's mount is slimmer.
- **Roof parapets are solid.** The coping, merlons and pinnacles along a roof edge (St. John's halls and every other stone, concrete or adobe building) stop players and bullets; you can lie behind a merlon, and nobody walks or shoots through the battlement.
- **The Laser Blaster fires a recorded laser blast** (the Laser Rifle keeps its synthesised beam); the announcer no longer says "That guy just blew up a dog".
- **Recorded sci-fi guns and a fuller sound picker.** The plasma, pulse, railgun, arc, vortex, disc, goo, nail, grenade launcher and rocket sounds are recorded now, and the Weapon Manager's picker offers 56 more named gun, reload, sci-fi, energy and launcher sounds (and the old synthesised ones), loaded only when used (docs/AUDIO.md).
- **Crossbow bolts (and nails, stingers, spears, rockets) no longer leave the gun sideways:** they were drawn across the shot for their first moments, and are now hidden until they point along their flight.
- **Hands on guns cost less.** Fitting your own first-person hands and other players' hands onto their guns takes a fraction of the time it did, and they look exactly as before (big matches: about 6% of a frame back).
- **Station, industrial and bunker walls are real cover; lights no longer stop bullets.** White Orbital Station and Industrial panels shoot like sheet metal and Bunker Concrete like concrete (both were see-through as glass), light strips and glow trim let rounds through, neon tubes are glass, and temple, lighthouse and sandstone walls are stone (GUNPLAY_SPEC §8).
- **St. John's: the clock tower is Welles's stair now.** It stands one cell back, in Welles's west end, where Welles's own switchback stair was; its winding stair lands on Welles's 2nd and 3rd floor halls, and the court is open where the tower stood. The halls end in a dorm room beside it, and the ground floor there has a side door onto the lane. The Carriageway is walled on the tower's side.
- **MapMaker: the Clock Tower's Stair option "Hall floors"** (landings level with a building's 2nd and 3rd floors, the hall's way in at its corner), a **Dorm Bay End** (a dorm hall's last cell beside a tower), and a **Carriageway** that can be walled on its east side.
- **Footsteps sound like what you walk on.** Concrete, metal, wood, grass, dirt, gravel and snow each have their own recorded steps, yours and other players'; bullets hitting a painted floor or wall sound like its material too.
- **The pump shotgun pumps.** A recorded pump follows each shot, done before the next one can come; you hear other players' too.
- **The recorded guns hit harder.** Pistols, rifles, SMGs and shotguns are about 4 dB louder and more compressed, the heavy guns a little louder; still under explosions, and none of them clip.
- **Four new Experimental characters and three new models.** Ignatius Slagg (a magma juggernaut), Sterling Purrcival (a tuxedo cat), Rufus Boomwell (a baboon) and Chester Knuckleby (a chimpanzee) join; Shiba, the Salamander Warlord and Bandit wear new models (Zero Ringtail's raccoon is Bandit now).
- **Weapon wheel by category; number keys by category.** The wheel is eight slices (Pistols, SMGs, Rifles, Shotguns, Snipers, Heavy, Energy, Melee & gadgets) whose weapons open on an outer arc with names, each slice remembering your last pick; keys 1-8 pick the same categories (again: the next in it), rebindable in Options → Controls, and no longer land only on the Pistol or the AK.
- **St. John's: the mess hall furnished as the owner remembers it.** You step down half a metre into Welles's mess hall, under a dark timber beam ceiling on stone piers: four rows of long tables with a cross aisle, stone arches down the street side with small tables behind them, the fireplace and drink stations at the clock tower end, a lectern and bell, chandeliers and flags, and the serving line and kitchen at the DeKoven end.
- **St. John's: the corner's last answers.** Welles's 2nd floor is dorm rooms end to end, and every hall's stairs have black metal railings.
- **MapMaker: a room's facade now dresses the wall round a Round arch or Twin arches**, as it does round windows, so a doorway no longer shows a bare panel in a stone front.
- **Recorded sound effects.** Pistols, rifles, SMGs, shotguns, snipers and heavy guns, reloads, melee swings, explosions, bullet impacts, breaking glass, walls and crates, doors, footsteps, falls, rain and wind now use studio recordings (the Sonniss GDC bundles); bullets whizz past your head and jump pads sound their launch, and the Weapon Manager offers two other recordings for each gun.
- **The Flare Gun has its picture again** in the kill feed, the loadout, the weapon wheel and the Weapon Manager (it showed none after it got its new model).
- **St. John's wall crest no longer shimmers.** Its gold border lay on the board's face and flickered as you moved; every layer of the crest now stands clear of the one under it.
- **Emblems and titles.** Pick an emblem (16 shapes, 12 colours) and a title your career has earned on Profile; your emblem shows by your name on the scoreboard, in the kill feed and on your card.
- **Other players' cards.** Click a player on the pause menu's Match tab or the end-of-match board to see their card: emblem, title, character, this match, and a signed-in player's career.
- **Match history and stats by mode and weapon.** Profile's Career has Modes, Weapons and History tabs: your last 20 matches, and your record in each mode and with each weapon.
- **Host-counted stats.** When you play in someone else's online game signed in, their game tells the server how your match went; Profile and your card show what other hosts counted.
- **Pick the optic on your guns.** Profile → Favourite loadout → Optics (or Pause → Settings → Optic for the gun in hand): many guns can carry their own sights, a red dot, a holographic sight or a new 2× optic; others see the optic you picked on your gun, and snipers keep their scopes.
- **The new guns aim true.** The Woodland SMG's iron sights line up (and it comes with a red dot), the Desert Carbine, Twin-Shot Rifle and Blaster X-42 aim through their own sights with a red dot, the Flintlock Pistol's hands no longer cover the aim, and the Blaster X-42 fires orange energy bolts.
- **Toggle aim lets go when you sprint.** With Aim set to Toggle, Shift (L3 on a controller, Sprint on touch) drops the sights and sprints; with a scope or optic in hand Shift still holds your breath, and a reload keeps your aim.
- **Camera shake covers the zipline too.** Off / Reduced now also calms the view's roll and sway on a zipline, like the lean's.
- **The pause menu has an Accessibility group:** Reduce flashing, Camera shake, Aim and controller Vibration together, as in Options.
- **Controller vibration in more browsers:** where a browser only has the older single-motor haptics, the controller pulses instead.
- **Long melee weapons show your hands in first person.** The Katana, Scimitar, Baseball Bat, Battle Axe and Spear are held in both hands where you can see them, raised at the ready (the Spear level), with a cut across the view (the Spear a thrust) and a draw up from the shoulder; third person is unchanged.
- **Weapon Manager (for the owner).** The weapon tuning page (`?mode=weapons`) has a Manage tab: rename, hide or unhide, pick sounds from the game's library, edit sets, stats and descriptions with the comparisons live, and leave notes; Send changes makes a change file a session applies in the repo (docs/FEATURES.md, "Weapon Manager").
- **Slide.** Sprint, then crouch: a short slide that keeps your speed, slows over about three quarters of a second and ends crouched. It costs stamina like a sprint (none in the air, a short cooldown, a little longer downhill); bots slide into cover too.
- **Peek (lean).** Hold ` or Left Alt (rebind in Options → Controls; Q and E were taken) to lean round a corner: your head, gun and where you can be hit move out together, lag compensation included. Everyone sees the lean, in first and third person; bots peek from cover with it.
- **The Gas Mask Engineer is retired.** He's gone from Character Select, random characters and the bots; a saved choice or bot set that named him plays Grunt '68.
- **MapMaker: Terrain → Resize…** Grow or shrink the terrain at any edge (or all of them) without removing it: sculpting, paint and plants stay where they are, new ground continues the edge, and what's on cut-off ground is listed first.
- **MapMaker: the level you're editing has a green grid.** The other levels with something on them show a fainter blue grid, and the level list highlights the working level in the same green.
- **Jump pads look alive.** Their chevrons glide over the plate the way the pad throws you and soft rings rise off it, at a steady brightness (slower with Reduce flashing on).
- **Switch team during a match.** Pause menu → Switch team, a team's Join on the scoreboard, or O: you move at your next respawn (the next round in Elimination, Bomb and Hostage), with no death counted; refused if it would leave the teams uneven, unless a bot can move the other way.
- **Maps can be 3 MB** (2 MB before). Hosts, the hub, joiners and publishing all take a map file up to 3 MB, so a map of 8,192 things placed by hand fits as MapMaker saves it.
- **39 new characters under Experimental** (the owner's own Meshy models, and Juice from the Meshy Community), each with a name of their own, among them a new **Chrono Crew** section in Character Select (Vesper Quill, Nova Kade, Fuse Hollister, Dex Calloway, Gears Okafor, Doc Seraphine Vale, Flicker, Wren Halloway, Sarge Tobias Crane, Mags Petrov, Lyra Vantis) and twelve more animals (Brutus Hornbeck, Duke Dashwood and friends); Goblina and Dusty Ranger have new models, and Santa moves to Legends. Bots, random picks and Roulette leave the experimental ones alone until they join the roster.
- **The Spear pokes and throws.** Fire pokes (you keep the spear); right mouse throws it; walk over a thrown or dropped spear to have it back in your hands.
- **Katana, Scimitar, Baseball Bat and Space Shield.** A long two-hit blade, a quick three-hit blade you run faster with, a bat that knocks people flying, and a shield that takes most of a hit from the front.
- **Heart Taser.** A sidearm whose slime flies to the nearest hurt teammate and heals them 25; it never hurts anyone.
- **The Gas Grenade has a new model**, a pinecone-shaped grenade.
- **Thirteen new guns.** Desert Carbine, Twin-Shot Rifle (a double tap every pull), Compact Carbine, Woodland SMG, Amarillo (1,800 rpm), Nova 6 (energy marksman), Lever-Action, Runebreaker (a six-shot revolving shotgun), Flintlock Pistol, Crossbow (a bolt you watch fly), Blaster X-42, Laser Blaster (never reloads, overheats) and Hornet (homing stingers): each has a pickup and lies in its weapon sets (Military, Sci-fi, Medieval, Chaos); docs/ARSENAL.md, "Weapons intake of 2026-11-18".
- **New looks for four weapons.** The Laser Rifle (its beam now cyan), Arc Caster, Railgun and Flak Cannon have new models; they fire as before.
- **Medieval weapon set: crossbows and flintlock pistols.** Its rifle and sniper pickups roll a crossbow, its pistol pickups a flintlock pistol.
- **St. John's: the corner where DeKoven meets Welles, corrected from the owner's photos.** The main entrance is now a stone porch with a pointed arch on DeKoven's side of the corner (Welles's wall has its windows back); DeKoven's 2nd and 3rd floor corridors carry on round the corner into Welles's dorm halls; the mess hall has a door beside the clock tower; DeKoven's court entrance is a gate tower front with a crenellated landing reached by two mirrored outside stairs and a door into the 2nd floor; the dorm stairwells have black metal railings. MapMaker gains the pieces behind it: Entrance Porch (pointed arch), Gate Tower Front (twin stairs), a Stair Railing prop, and new choices on the Stair End Bays (stair rails, a lobby side door, a top-floor door), the Dorm Entry Bay and the Admin Entry Bay (way in).
- **MapMaker: pieces for a mess hall.** The Refectory Bay can have its floor sunk half a metre with a step at every doorway, a dark timber beam ceiling, a side aisle behind a row of stone arches, rows of mess tables with chairs, chandeliers with pale bowls, hanging flags, a lectern and bell, and an end wall with a fireplace, a picture, panelling and tall windows, or drink stations. New pieces: the Refectory Serving Bay (a serving line), the Refectory Kitchen, the Sunk Room tile, and thirteen props (Props: Mess Table, Serving Line, Drink Station, Lectern, Bell on a Stand, Chandelier with Bowl, Hanging Flags, Stone Arcade, Stone Fireplace with Picture, Panelled Wall Bay, Timber Ceiling Bay, Walk-in Cooler Door). Not yet on St. John's.
- **St. John's: Memorial Hall, the library, rebuilt as it really looks.** Two storeys under a tall faceted spire and a lower shingle roof: fieldstone below, tile-hung above with a band of wide leaded windows under the eave, a big pale stone arch in its wall at the end of the brick walk with a panelled porch behind it, a small stucco wing with a red door up a few steps. Inside, bookcase alcoves with benches and reading ledges, a globe, worn red rugs and hanging lanterns on the ground floor; upstairs, rows of bookcases either side of a red runner under an open timber roof, with the school crest on a truss. Two spiral stairs join the floors. MapMaker gains the pieces: a faceted hall end, a spire and roofs, bookcases, leaded windows, a stone arch, a globe, rugs, a lantern, a bronze bird.
- **MapMaker: 120 different prop models a map** (80 before). MapMaker's Models row and the map check count to 120; the Draws estimate keeps its own limit, so a map packed with different models still shows amber there.
- **St. John's: DeKoven Hall rebuilt and joined to Welles.** The old block hall is gone; the new one stands on the corner with Welles: a stair from its upper floors down into a lobby at the mess hall's door, a reception with the school crest off the court, offices, a dorm floor, basement offices and a roof walk reached by the north stair between two round turrets (the roof gun and sniper rifle are back up there). MapMaker gains the pieces behind it: a stair bay that reaches the roof, a bay with a stair down to a basement, an Admin Bay with an entrance, and basement room and stairwell tiles that dig only their own cell.
- **St. John's: a main entrance into the mess hall.** Two round arches on a stone pier open Welles Hall's mess hall onto the court, beside the corner where DeKoven meets it. MapMaker gains the wall style behind it, Twin arches, and the Refectory Bay a "Main entrance" choice for either long wall (map format 49).
- **Dual wielding.** Pick up a second Machine Pistol, Pulse Pistol, Sawed-Off or Pistol to hold one in each hand: each gun fires and reloads on its own trigger, and everyone sees both guns, their flashes and tracers; a host can turn it off in Match Setup.
- **St. John's dorm room doors are a little wider.** The slim room doors and their doorways are 1.5 m instead of 1.2 m, in every dorm hall and the stair-end upper door; bots still walk through them.
- **Characters hold long guns properly in third person and Character Select.** The support hand sits on the handguard instead of behind the magazine or under the gun, the stock comes in to the shoulder, and fingers close round the gun without folding into the palm.
- **A Pistol pickup in MapMaker.** Maps can place a Pistol (palette, Weapons); it lies only where it is placed (random pickups never roll it); walking over it with your own Pistol makes a pair.
- **Grenades going off right in front of you no longer flicker with Reduce flashing on.** A blast close to the camera is drawn smaller as well as dimmer, so you see the fireball in front of you instead of standing inside it.
- **Freaky Frida's shoulders hold together.** She is rebuilt from the owner's own rigged Meshy model, and her vest no longer lifts or opens at the back of her shoulders when she holds a gun.
- **The sniper glint is exact.** A scope glints only while its owner is really looking through it (aim held, gun ready), not on a guess from how they stand.
- **Freaky Frida's shoulders hold together.** She is rebuilt from the owner's own rigged Meshy model, and her vest no longer lifts or opens at the back of her shoulders when she holds a gun.
- **A door standing ajar is cover too.** Its leaf is solid at its angle, beside the doorway it still closes.
- **Scope feel.** Inside a scope the picture darkens toward the edge and a shadow slides in as you turn, sway or take a kick, settling when you hold your breath (Shift; the controller's sprint button too) with an "Out of breath" cue when it's spent. A sniper looking your way shows a small, soft glint on the scope (steady, dimmer and slower under Reduce flashing). Entering a scope no longer flashes bright for a frame. Sway, breath and zoom steps are unchanged in size and are now data.
- **Real optics by gun.** Guns with no sights of their own now carry one: a red dot on the Laser Rifle, Bubble Blaster and Sawed-Off; a holographic sight on the Arc Caster, Flak Cannon, Disc Launcher, Arena Disc and Plasma Rifle. The dot and ring are drawn on the glass and stay on your aim; iron sights show no dot and are drawn larger on long guns; the Battle Rifle and Marksman get a chevron, the Sniper Rifle and Railgun a fine crosshair. No gun's zoom has changed.
- **After the countdown, straight into the fight.** No pause menu or Tab board pops up when a match starts; if the game doesn't have the mouse yet, one small "Click to fight" line shows instead (Tap on a phone). Esc still pauses.
- **Esc always closes the Bots window over the pause menu.** If the game took the mouse late after Resume, opening the Bots window now lets it go, and the first Esc closes the window.
- **MapMaker warns about stairs too low to walk standing.** As you build, a stair or ramp with less room over it than the tallest character needs (2.62 m over steps, a little over 2.1 m on a ramp) shows a warning naming the piece, its clear height and what is over it.
- **Flavius Rule: walk down the gate stairs standing.** The two stair wells beside each corner's Gladiator Gate, down to the hypogeum, have a room's height (3.7 m) over every step; the ground over their lower half came down to 2.5 m, so a large character had to crouch on the way down.
- **Building trim you can stand against.** Buttresses, pilasters, plinths and other facade pieces that stand out at least 10 cm from a wall (St. John's halls, Flavius Rule, Step Temple and every map with a stone, Roman, temple or brick facade) are solid now: no walking through them, and they stop rounds as cover. Thin trim and the roofline stay as they were.
- **Open doors are cover.** An open room door (St. John's dorms and halls, any map's Oak or Painted Door standing open) is solid now: you can't walk through its leaf and it stops you like cover (wood, so heavy rounds still go through); the doorway beside it stays open, and bots still walk into the rooms.
- **Nobody gets stuck outside the map.** A crouched or prone player (a small character most easily) could squeeze between the posts of a fence at the map's edge, as on Atomic Court, and then teammates spawned beside them out there. Fences and bars at a map's edge now stop every body (shots and sight still pass), teammates never spawn beside someone outside the play area, and anyone who ends up outside it is told and, after a few seconds, put back inside. Atomic Court's boundary now runs along its fence.
- **Iron sights that line up.** Aiming down sights now puts your eye behind each gun's own drawn sights, measured from the model: 13 guns (pistols, SMGs, the Assault and Burst Rifles, the shotguns and more), each within 0.1° of where the shot goes. Guns with no sights drawn keep their old aim; nothing about how a gun shoots has changed.
- **MapMaker: building below ground.** On Basement the ground turns to glass with a clear circle at the pointer and the tunnels' roofs come off when seen from above, so a tunnel's layout shows and can be edited; its open ends and joints are marked, and the plan view shows the basement. A buried tunnel's unbuilt end is closed with a face of its own rock, brick or concrete (no more looking out at the sky) until a portal or a Dead End goes there.
- **MapMaker: picking things inside others.** Spawns, pickups, lights and logic show through walls and set pieces as icons and are picked through them; a click again at the same spot steps through everything there (a small list says what); the move gizmo's handle drags a thing out from inside something.
- **Less memory churn in solo and local matches:** the match's snapshots reach the game as one compact binary message (about a twelfth of the garbage they made at 64 players). Online play is unchanged.
- **Simpler Match Setup pickers.** Bots & AI: a tick-box for each of the eight bot types (the long "Named as" list folded into them), then Ranks & badges and Themed names as plain switches. Teams & players: Teams and Per team steppers over one row of layouts (1v1 to 32v32, FFA) in place of the More layouts list. Saved setups keep loading.
- **MapMaker: a campus kit (for St. John's next halls, and any map).** New set pieces: **Admin Bay** (offices off a wainscoted corridor, trophies and portraits, or our own crest in the floor), **Library Bay** and **Library Porch** (a round porch under a tall red cone), **Chapel Nave Bay** (tall stained-glass windows, side aisles, pews), **Chapel Chancel** (altar, rose window, organ), **Chapel Narthex** (two spiral stone stairs up to a gallery), **Gym Bay** and **Gym Entrance** (a barrel vault on steel trusses, bleachers, a hoop, a balcony), **Pool Hall** (a four-lane pool you can swim in). New tiles: **Spiral Stair**, **Tall Hall** (no column), **Round Porch**; new props: pews, bleachers, stained glass and rose windows, altar, pipe organ, trophy case, honours board, crest roundel and shield, court lines, wall hoop, pool lanes.
- **Ranks & badges, for everyone, as a setting.** A new switch in Options (and the pause menu), off by default: off, names are plain and heads carry the old arrows (the soldiers' badges too); on, every player and bot wears a rank title and a badge in their group's style (Army ranks, the Agency ring, a skull, a star, a gear, a crown, a paw, a chevron) in the kill feed, on the scoreboards and over heads. Ranks rise quietly with points and kills and carry from match to match, yours with your career; a rank-up makes the badge swell and glow for a second (calmer with Reduce flashing). Details in docs/CHARACTERS.md.
- **Our own trees and rocks on ten more maps.** Eagle Spires, Step Temple, Primeval Park, Coldwater Gulch, Norman Shores, Fernwood Moon, Sunstone Crag, Sandgate, Citadel and Backwoods swap their bought trees, bushes, logs and rocks for our generated ones, in the same spots and sizes (bushes still hide you, rocks still stop bullets); a new Dead Tree joins MapMaker. MapMaker's Environment pane gains **Swap natural props for ours** to do the same on any map in one undo step.
- **Our own trees and rocks on thirteen more maps:** Frost Basin, Iron Maw, Glacier Line, Jungle Steps, Apex Ring, Gallows Yard, Sandsweep, Hollowmere Manor, Sunken Kingdom, Atomic Court, Dustwater, Fort Meadow and Serpent Gorge (sandstone boulders on the desert ones).
- **…and on nineteen more:** Diamond Park, Maple Court, Dockside Depot, Crossroads, Dead Reel, Blackout, Glasswork Office, Jade Sanctum, Verdant Ziggurat, Cinder Foundry, Market Town, Vinefall Sanctum, Capitol Mall, Rail Stockyard, Sky Islands, Reactor, Underdrain, Pharaoh's Reach and Ravenscroft Hall.
- **…and the last of them.** New **Sandstone Spires** (red or tan) stand where the red rock spires stood on Dustwater, Sunken Kingdom and Iron Maw; tall rocks on sandy ground are sandstone now (Sandsweep); Backwoods and two more maps get our fallen logs; St. John's grounds get our oaks, maples, birches and shrubs. The swap button also handles the Kenney Nature Kit's trees, logs and stumps. The old bought nature pack is gone from the download; older maps that use it still open, with our trees in its place.
- **St. John's clock tower: room to stand all the way up.** The tower's stair now winds round its core on all four sides with a landing in each corner, so there is a room's height (3.7 m) over every step and inside the door, which is wider; the belfry gallery is where it was.
- **Deathmatch spawns spread out.** Players and bots no longer start or respawn on top of each other: everyone gets a spawn point of their own (all of a map's points in free-for-all when the shared ones run short), and with more players than points they start beside one, clear of everyone.
- **St. John's: Welles Hall and its clock tower.** The old block Welles south-east of the court is rebuilt as a three-storey Collegiate hall: a long mess hall on the ground floor (arched windows, stone piers, long tables and benches under chandeliers, a fireplace, doors to the court and Exeter Street), classrooms above it joined to the bridge, dorm rooms on top, stairs at both ends. Beside the bridge stands a new 24 m clock tower with four clock faces (the hands don't move) and a belfry you can climb to, a perch over the court. MapMaker: new Clock Tower tile and set piece, Refectory Bay set piece and Clock Face prop.
- **Your automatic fire sounds whole in big matches.** In a crowded match the bots' gunfire cut your own shots' sound short after a few hundredths of a second, so full-auto stuttered; your own sounds are never cut for the world's now (distant sounds give way to near ones), and shots fired within one slow frame keep their even rhythm.
- **Shots no longer lag with sprint held.** Holding Shift (or the pad's sprint) while tapping the trigger made every shot wait the gun's sprint-exit time, and a quick click with a rifle fired nothing; now only the first shot out of a real sprint waits (briefly, as before), every tap after it fires at once, and a click while the gun comes up fires as soon as it's up.
- **A new Bucket-Wheel Excavator in MapMaker, with a deck you can stand on.** Mines & Caves gets the **Bucket-Wheel Excavator (Walkable Deck)**: a cel-shaded 30 m bucket-wheel machine (the owner's own model) whose roof is a flat deck 9.2 m up, railed round, that players can stand and fight on; its tracks, house and booms block shots and players. Lighter than the older excavator (9,000 triangles, 4,000 from 60 m). Iron Maw gets it when the map is refreshed.
- **A lighter start and smoother frames.** The main menu loads about 150 kB less script on a first visit; pickups, the spawn shield's shimmer and your own movement corrections cost less each frame (details in docs/PERF_96.md).
- **Return visits download almost nothing.** Models, textures and sounds you already have are checked instead of downloaded again after an hour away (~0.1 MB instead of ~24 MB); the server side gains a CDN, a hard monthly spend cap and nightly backups of profiles and published maps (docs/HOSTING.md, "Cost guard, CDN and backups").
- **Starting a match looks right.** Start match shows the map's card (picture, name, mode) and a progress bar from the click, with no grey frame; partway through, the match's goal and the Tab board (teams, players and bots) join it, then it fades into the countdown, which shows the map, mode and goal under the number ("Sandgate · Team Deathmatch", "First team to 50 kills"). The pause menu no longer pops up over the loading screen or the countdown.
- **A grenade of every kind.** In a weapon set with its own grenades (Military, Sci-fi, Medieval, Chaos, Mixed Bag) each life starts with the next from a shuffled deck of the set's grenades, every kind before a repeat; grenade pickups cycle through them the same way.
- **The announcer follows your spree.** Streak calls at 3, 5, 7, 10, 12, 15, 20 and 25 kills without dying, each once a life; Double and Triple Kill at most once a life, then a quick chain is called only when it beats your best that life; more hype lines between, never two in a row. A death starts it all again.
- **Shot-out sash windows are clear.** When a sash window's glass breaks, its centre bars and inner frame go with it (the outer frame stays), and they come back with the glass.
- **MapMaker's Test starts sooner on slow machines.** The game no longer draws an empty scene before the map has arrived.
- **Blood by character.** Every character bleeds what it is: red for people, green or blue for aliens, black oil and sparks for robots and machines, bone dust for skeletons, stone dust for Bronzer, and a soft white-grey spectral wisp for The Hollow Pilgrim (no stains for those three). Characters without their own (the classic presets, your designs) still bleed the map's blood colour; the map's amount and your Blood switch still rule. With Reduce flashing on the sparks and wisps are smaller, dimmer and come at most once a second.
- **Hands on guns fitted automatically; bullets from the gun.** In first person (Arms only) every character now holds every gun with the same arms, gloves and sleeves tinted to the character. In third person each character's grip is fitted from its own hands and checked by an audit, so far fewer need hand tuning. Your shots in third person now leave your character's gun and flash on it, and everyone's tracers start at the muzzle as drawn.
- **Jungle plants in MapMaker.** The Environment group gains the Jungle Tree (lianas hanging from its limbs), the Tree Fern and the Elephant Ear, and the Jungle preset paints them.
- **Alpine woods read lighter.** The Mountain Pine is brighter with a bare trunk under its branches, the Spruce has a lighter Alpine look, and the Alpine preset paints fewer, lighter spruces among more pines and larches.
- **MapMaker: a season for the whole map.** Environment brush → **Season (whole map)**: Autumn, Snow-dusted, Dry season or Summer, then **Apply to map** turns every placed tree, plant and rock to its look for that season in one undo step (looks you picked on purpose, like moss or flower colours, stay).
- **Mixed woods draw faster.** A species' looks (summer and autumn, green and dry) now draw together, so a wood of many looks costs fewer draw calls; small plants' far shadows are dropped on High.
- **Bigger maps: a map now holds up to 8,192 things** (blocks, props, lights and the rest, set pieces' parts included; 4,096 before). MapMaker's Entities counter goes to 8,192; the 2 MB map size limit and the prop, block and light budgets are unchanged. (Map format v48: an older game refuses a v48 map.)
- **St. John's: Stangeland / Cord is a real school building.** The old open-walled block hall south of the court is rebuilt as a three-storey school in warm fieldstone with battlements: a hall down the middle of each floor and classrooms either side, each with a wall of tall sash windows, twelve desks facing a chalkboard and a pull-down screen, and the teacher's desk. Stairs at both ends; the east end meets the bridge (the archway beside it) on the ground and the first floor, so you can cross from the bridge's room straight into the school. New in MapMaker for everyone: the **Classroom Bay** set piece (it can close the end of a floor), the **Classroom windows** wall style, the **Collegiate fieldstone** facade, and props: **Chalkboard** (green, black or white board), **Projector Screen**, **Notice Board** (outdoor, under a little shingle roof) and **School Desks** (a row of four with chairs). Both ends of the school are three storeys, with stairs to every floor; the court has its own door into the school, under a round stone arch; a few classrooms have strings of pennants in the school's purple, white and red. MapMaker also gets the **Classroom Entry Bay**, a **Pennants** choice on the Classroom Bay (off unless you pick a classroom), a **First-floor door** choice on the three-floor Stair End Bay (where a bridge meets it), and the **Pennant String** prop.
- **Soldiers wear their rank.** A soldier's rank badge (chevrons for privates to staff sergeants, bars for lieutenants and captains, stars for majors and colonels; a ring-and-dot Agency mark for spies) shows before their name in the kill feed and on the scoreboard, and is their marker over the head: in your ally colour over teammates, red over enemies when enemy markers are on. Everyone else keeps the arrow. Shingle Point's bots are Army only, and the Operatives join Agency.
- **Music and an announcer of our own.** The main menu, Match Setup and lobbies play their own music, MapMaker its own (shuffled, crossfading, faded out when a match starts), and a new announcer calls the match: the countdown, the last minute, flags and bombs, round wins by side, your multi-kills, streaks, headshots and other special kills. **Music** and **Announcer** volumes in Options (the Announcer in the pause menu too); 0 turns either off.
- **Soldiers wear their rank.** A soldier's rank badge (chevrons for privates to staff sergeants, bars for lieutenants and captains, stars for majors and colonels; a ring-and-dot Agency mark for spies) shows before their name in the kill feed and on the scoreboard, and is their marker over the head: in your ally colour over teammates, red over enemies when enemy markers are on. Everyone else keeps the arrow. Shingle Point's bots are Army only, and the Operatives join Agency.
- **Player profiles: your career and favourite class.** Profile now keeps your career (matches, wins, kills, deaths, K/D, accuracy, headshot kills, best streak, time played and favourite weapon), in this browser as a guest or on your ToshiroPlay account when signed in (a guest career moves onto your account at your first sign-in), and a favourite class that is picked for you in matches with classes; your profile card shows under the Tab scoreboard and the end-of-match board.

- **More trees, plants, rocks and cliffs in MapMaker.** Seventeen new kinds in the Environment group, each in two or three looks: Silver Birch, Olive, Mountain Pine, Larch and Italian Cypress; Creeping Juniper and Sagebrush; Tall Grass and Tussock; Alpine Flowers and Desert Marigold; Barrel Cactus and Agave; a tall Shard Boulder and a Sandstone Boulder; a layered Sandstone Cliff and a tall Mountain Crag. The brush's presets paint them too (Temperate adds birches and tall grass, Jungle tall grass and agave, Alpine mountain pines, larches, juniper, tussock, alpine flowers and shard boulders, Arid barrel cacti, agave, sagebrush, desert marigold, sandstone boulders, olives and cypresses). Maps already made look exactly as before.
- **MapMaker: save and name your own looks.** Select a set piece, paint it or pick its materials, then **Save as my look…** in its inspector: the look as it shows gets a name and goes into **My looks** (Set pieces tab), kept in this browser. Put other pieces in it from My looks (**Apply**) or from any piece's **Look**, now grouped This map's themes, My looks and All looks; rename, update or delete your looks; select several set pieces to give them one look. A map carries the looks its pieces wear, so it plays and looks the same anywhere. Saving never changes how the piece looks; your paint still sits on top of the look, and a theme change keeps both. (Map format v47.)
- **St. John's: Stangeland / Cord is a real school building.** The old open-walled block hall south of the court is rebuilt as a three-storey school in warm fieldstone with battlements: a hall down the middle of each floor and classrooms either side, each with a wall of tall sash windows, twelve desks facing a chalkboard and a pull-down screen, and the teacher's desk. Stairs at both ends; the east end meets the bridge (the archway beside it) on the ground and the first floor, so you can cross from the bridge's room straight into the school. New in MapMaker for everyone: the **Classroom Bay** set piece (it can close the end of a floor), the **Classroom windows** wall style, the **Collegiate fieldstone** facade, and props: **Chalkboard** (green, black or white board), **Projector Screen**, **Notice Board** (outdoor, under a little shingle roof) and **School Desks** (a row of four with chairs).

- **Guns handle differently.** What you carry sets how fast you run with it: sidearms and SMGs at full speed, rifles and shotguns 97 %, battle and marksman rifles 95 %, the sniper rifle 93 %, rocket launchers 92 % and the LMG 90 %. A sprint is as fast with every weapon. Coming out of a sprint the gun comes up before it fires: 50 ms for a pistol, about 0.1 s for an SMG, 0.13 s for a rifle, 0.2 s for the sniper rifle and launchers, 0.22 s for the LMG (a knife at once). Hold the trigger as you stop and it fires the moment the gun is up. Bots play by the same rules, and online play predicts it exactly.
- **Holdover marks in scopes.** The sniper's scope and the Battle Rifle's optic carry short marks down the crosshair at 200, 300, 400 m and on (labelled in hundreds of metres): put the mark for the distance on your target and the round lands there. They follow the match's ballistics setting and the second zoom.
- **Weapon tuning page (team tool).** `?mode=weapons` compares up to three weapons side by side: stat bars on one scale across the arsenal, the recoil path over a magazine, the spread cones at 25 m against a body, damage and time to kill over distance, and bullet drop with holdover.
- **MapMaker: Tile View.** Select a room, a set piece or a group and press **Enter** (or double-click it, in the view or on the minimap): the dock shows it from straight above, with everything standing in it. Click a prop, block, light or door to pick it, drag it to move it on a fine snap (1, 5, 10 or 50 cm; hold Ctrl or Shift for none), nudge it with the arrow keys, turn it with R, or type its X, Z, height and facing, in the room's own coordinates (turned with the room) or the map's. Click a wall side to make it a door, a window or any other style, on every side of a big room. A set piece's insides are shown read-only. Each move is one undo step; Esc steps back to the room, then to the minimap.

- **MapMaker: keyboard, window sizes and remembered settings.** Tile View and the minimap work from the keyboard: Tab into either; in Tile View **]** and **[** step through the things and wall sides, **Enter** goes to the picked thing's fields, **+**, **−**, **Home** and **Alt+arrows** zoom, fit and pan; the minimap zooms and pans the same way and **Enter** opens Tile View. The `?` list has a new Tile View and minimap section. The right dock follows the window: narrowed under 900 px it folds to the minimap card and comes back when the window grows; a width you dragged fits a smaller window and returns on a bigger one; its edge also takes Home and End. On small windows the tool bar shows icons only and keeps clear of the minimap card. **View → Grid**, **Full grid** and **Snap** are remembered for your next visit (in this browser, never in the map). Tile View no longer redraws while the pointer moves over it (it now costs nothing until you change something), and every map in the game is checked to open and save in MapMaker with nothing lost.

## 0.10.0 (2026-11-17)

**Highlights:** MapMaker painting made clear (Structure and Ground painters, the Ground theme, themes first in the palette) and a live minimap; the tunnel kit (brick, mine, cave and 7 m road tunnels, joins between them; Iron Maw's tunnels rebuilt through the rock); the Troop Buggy as a real physics body; the Battle Rifle, punchier hits and the Heavy Revolver's short range; much less memory and cheaper shadows and far looks; St. John's dorm halls, entrance, grounds and school colours; phone layouts for map cards, touch controls and Character Select; the Dropship's riders on their seats, its whole deck and calmer team paint on every vehicle.

- **Vehicles keep their own colours in team paint, and the Dropship's deck is whole.** Every vehicle now takes its team's colour (or a paint skin) at half strength, as the Dropship already did: the full colour turned most of them several times darker, near black on the darker models, so a team's vehicles read as their own models with the team colour over them. Seen from above, the ground no longer shows through triangular gaps in the Dropship's deck between the benches and the aisle: the model's floor had holes there, now covered by a deck plate in the floor's colour.
- **Character Select: Horrors & Creatures, Soldiers & Spies.** Creatures joined Horrors as **Horrors & Creatures**, and Agents & Spies joined Soldiers as **Soldiers & Spies**, where each character is **Army** or **Agency** (shown on its card). Bot characters (Match Setup, the pause menu, MapMaker's Map properties and the server's `cast` rule) can pick Army or Agency alone, so a map of a real battle can field soldiers only; a saved choice of Agents & Spies or Creatures still works. Steel Guardian moved to Machines, Shadow Enforcer to Outer Space, and Teddy, The Hollow Pilgrim and Scary Larry to Horrors & Creatures; the astronauts now sit together in Outer Space.
- **Warrior Sentinel's shoulders and Rattles' posture.** Warrior Sentinel's support shoulder no longer sinks into his vest when he holds a gun (his shoulder joints sat outside his body). Rattles stands up straight, his head over his shoulders instead of hung over the gun.
- **Phones: pick a map from cards.** On a phone (and any window under 900 px wide) Match Setup's map is a button with the map's name; it opens the full map list over the screen: pictures, mode tags, the tabs (All, Featured, Recent, Favourites), Filter maps, search and sort, and a tap on a card picks it. Quick Play has a third card, **Pick a map**, that goes straight there. A phone held upright no longer shows the featured map over the main menu's buttons.
- **Phones: touch layout options.** Options → Controls → Touch: **Button size** (Small, Medium, Large; Large stays a little smaller on short screens), **Button opacity** (30-100 %; a pressed button shows in full) and **Left-handed** (the pad on the right, the buttons on the left, look on the left half; the minimap, health, kill feed and ammo panel swap sides with them). **Aim** is there too, the same setting as Accessibility → Aim: the touch Aim button now follows it (Hold aims while your finger is down; Toggle, a phone's default, as before), and a toggled aim now lets go on a weapon change, in a vehicle or on death, as it does with a mouse.
- **Character Select on phones, with search and favourites.** On a phone the portraits take the height and the details are a sheet along the bottom: a strip with the name and Choose, pulled up by a tap on a portrait (or its handle) to show the bio, stats, loadout and Customise. Held upright the grid takes the width and the sheet shows the portrait. On every screen the section strip gains a search box and a ★ Favourites-only switch, and each portrait a star to keep it; on a touch screen the strip's ends are arrows instead of Q / E keys.
- **St. John's: spruces and a curved stone wall at Scott Johnston / Hazelwood.** Two spruces now stand either side of the hall's arched entrance, with a banner lamp post each side of the path to it in the school's royal purple, white and red (a new Royal purple look for the Lamp Post with Banner in MapMaker, for any map), and a low curved sandstone wall with a stone pier runs along the walk to the west, as in the campus photos. They were held back until shadows from small things got cheaper; with that change the hall's front costs less to draw than before they were added.
- **A broken prop's shadow goes with it.** Some breakable props (a crate, a barrel placed only a few times on a map) left their shadow on the ground after they broke, until the map's shadows were rebuilt. Now the shadow goes the moment the prop breaks, and comes back with it at a new round.
- **Far props look like themselves.** Shop shelves, shop stands, bookcases, tables, chairs, sofas, cabinets, beds and appliances no longer turn into plain coloured blocks in the distance: their lighter far looks are now made from the full model, so a shelf keeps its rows of goods in their colours, a bookcase its books and a table its legs, and the change as you walk up is hard to see. The same goes for every other generated prop: crates, drums, containers, walls, machines, pipes, street furniture, signs and domes (a drum keeps its bands, a stone wall its stones, an arch its openings). Same number of draws; a few more triangles.
- **Fewer hitches when players respawn in big matches.** A match of more than 32 players keeps up to 32 spare character bodies (16 before), so about half of all respawns take one back at once instead of building a new body: on Flavius Rule with 64 bots, body builds fell from 24 to 13 a minute for about 13 MB more memory.
- **Iron Maw: its three tunnels go through the rock.** The south rim road tunnel, the West Bench Tunnel and the Deep Drift are real tunnels bored through the quarry's rock now (a road tunnel and two concrete tunnels), not trenches under a lid of rock slabs, with the same ways in and out, their lights, and the King of the Hill hills inside. Built tunnels on a quarry's terraces no longer heap a ramp of earth down onto the bench below.
- **Caves and transitions (Tileset 04, fifth part).** Every tunnel piece now also comes as a **Cave**: raw broken rock lining the passage, rubble along the walls, a dirt floor, stalactites in the chamber, and no lamps (light it yourself). A **Cave Mouth** opens the hill with tumbled rock and boulders instead of a headwall. **Joints** take a run from one family to another in one piece: concrete, brick or a mine into a cave (a cast collar, a brick ring or a heavy timber set with rock breaking over it), brick or a mine into concrete (a cast frame with a grate), a mine into brick, and a mine's **Bay to Road** into the 7 m road bore under a roll-up door.
- **Road tunnels (Tileset 04, fourth part).** A 7 m bore for vehicles: **Wide** straights, curves, T-junctions, four-ways, dead ends (a roll-up door) and portals, a **Wide Ramp** that climbs a level over two cells at a slope vehicles drive, and a **Reducer** down to the 3.6 m passage. They come as a **Road Tunnel** (asphalt with lane lines, raised walkways and a guardrail along the walls, strip lights) and in concrete or brick. MapMaker warns where a wide bore meets a narrow passage, and Add a portal and Close open ends put the right size. Road points laid in MapMaker sit on a tunnel's cutting and floor, and a road through a tunnel leaves the hill over it alone. Also: the mine track now follows its curves and turns out of a T, and the brick and mine chambers hang lanterns.
- **A broken prop's shadow goes with it.** Some breakable props (a crate, a barrel placed only a few times on a map) left their shadow on the ground after they broke, until the map's shadows were rebuilt. Now the shadow goes the moment the prop breaks, and comes back with it at a new round.
- **Trees, low walls and lamp posts cost less in the sun's shadows.** Trees, shrubs and rocks now cast their shadows from shadow-only copies that never change as you walk: a still or slowly turning view no longer draws them into the shadow map every frame (they are kept with the rest of the static shadows), and the far shadow cascade on High uses a lighter tree. Props with a near and a far look (low walls, piers, lamp posts, benches) cast their full-detail shadow through the map's merged shadows instead of one draw each per frame. Shadows no longer change shape when a tree or prop switches to its far look, and small clutter now casts within 20 m (was 15) and stops only past 24 m, so its shadow no longer blinks at the line. Options → Graphics is unchanged; this makes room for St. John's spruces and curved limestone wall (docs/PERF_SHADOW_CASTERS_2026-11-17.md).
- **Far props look like themselves.** Shop shelves, shop stands, bookcases, tables, chairs, sofas, cabinets, beds and appliances no longer turn into plain coloured blocks in the distance: their lighter far looks are now made from the full model, so a shelf keeps its rows of goods in their colours, a bookcase its books and a table its legs, and the change as you walk up is hard to see. Same number of draws; a few more triangles.
- **Fewer hitches when players respawn in big matches.** A match of more than 32 players keeps up to 32 spare character bodies (16 before), so about half of all respawns take one back at once instead of building a new body: on Flavius Rule with 64 bots, body builds fell from 24 to 13 a minute for about 13 MB more memory.
- **Combat accessibility.** Options → Accessibility (and the pause menu's Settings) has three new settings. **Aim**: Hold, as before, or Toggle: press the aim button once to aim down the sights or scope and again to stop (changing weapons, getting in a vehicle or dying lets go; it works with every scope and the Battle Rifle's optic). **Camera shake**: Full, Reduced or Off, for the view's own shaking: the jolt of a heavy shot, the kick when you are hit, blasts and crashes near you (your weapon's recoil still climbs, as it is where your rounds go; Reduce flashing keeps its calmer kick on top). **Controller vibration** and its strength: a controller rumbles when you fire, take a hit or a blast goes off near you, where the browser can (Chrome and Edge; hidden where it can't).
- **Arms are their own hit zone.** A round that clips an arm without reaching the chest does 0.9× (the chest 1×, legs 0.8-0.9×, the head more), so rifles, SMGs, the Spin Gun and the Marksman Rifle take one round more on the arms (the Machine Pistol two); the pistols, revolvers and the Precision Rifle are unchanged. A round through a forearm into the chest still counts as the chest. Ranges are unchanged.
- **A shield hit marker.** Hitting someone still under spawn protection shows a gold ring and a thin ping instead of the usual marker: the shield took it, no damage.
- **A team's Dropship keeps its colours.** On a team-owned Dropship (Shingle Point's, and any given a team in MapMaker) the team colour was laid over the whole model at full strength, so its olive and white came out as a near-black and blue box. It now takes the team colour, or a paint skin, at half strength: still olive and white, with the team's colour over it. Its open deck and benches are the model's own.
- **Riders sit properly in their seats.** A rider looking along the vehicle or back over its shoulder was drawn with its legs swung off the seat, into the backrest, so in the Dropship (and any vehicle with seats) some riders looked as if they were standing. A seated rider now turns only as far as a waist turns, so its legs stay on the seat. The drop route's dropship spreads its twelve riders evenly along the benches (the two at each end sat half off them).
- **The Wall Shelf is a wall shelf.** The Wall Shelf on 14 maps (Flatpack Depot, Riot Junction, Maple Court and others) was a standing shelf unit shrunk to 40 cm, a tiny bookcase stuck on the wall. It is now a plank on two brackets with books, jars or a plant, in the same place. The shelf unit is back at its real size as the Open Shelf Unit.
- **Shelves and furniture keep their look as you walk up.** Shop shelves no longer turn their goods into flat coloured blocks a few metres away, and nothing flickers between its near and far look at that distance: props keep their full look until they are small on screen (at least 20 m), and switch only once past the line.
- **Flame, goo, bubble, plasma and oil streams leave the gun.** They came out of where your eyes were a tenth of a second earlier and trailed behind the gun while you moved; now they leave the muzzle, yours and other players', and ease into their real path.
- **Tunnels: brick sewers and mines (Tileset 04, third part).** Every tunnel piece now also comes as a **Brick Sewer** (old brick under a round arch, a water channel between walkways with grates, a lantern) and a **Mine** (rough rock held by timber sets, lagging, a narrow-gauge track, a lantern): pick it with Family in the Tunnel box, for one piece or the whole run. A new **Outfall** is a portal barred with iron (water, light and shots pass, people don't). Set pieces take a Family too (the Lit Tunnel Run, Shaft and Riser), a **Lit Tunnel Chamber** has a real light in each corner, and **Close open ends** puts a Dead End on every end that leads nowhere. The shaft's hatch lid now has a handle, hinges and a hazard edge.
- **Bots no longer all react as one when you go down.** When the one player a crowd of bots was shooting at died, every one of them dropped them on the same tick and paused, crouched and faced where they fell. Now each takes it in after a beat of its own (a fifth of a second to just over one, quicker for harder bots), forgets the dead player's spot, and goes its own way: after another enemy it knows of, on with its goal, searching on past where you fell, back to a teammate, or holding and watching a direction of its own.
- **Big matches use far less memory, with less garbage collection.** On Flavius Rule with 64 bots the page held about 1.1 GB after the garbage collector ran; it now holds about 650 MB, and the collector spends a fraction of the time it did. Three copies of data nothing reads were dropped or halved: Babylon's per-vertex picking points on every character's meshes, the shadow stand-ins' triangles once they are on the graphics card, and the merged level's vertex data, now kept as 32-bit floats. Each respawn also no longer builds a fresh shape for the status aura, and snapshots are filed with less garbage. In a crowd, characters beyond the nearest eight animate a little less often (never anyone within about 8 m, each still smoothed): 13-24 % fewer animation updates in an arena. Nothing looks different up close.
- **The Troop Buggy is a real physics body.** Its body is now simulated by the physics engine, with its own springs and tyres pushing it (they keep their grip, slides, drift and climbing as before): it no longer stutters or catches on invisible edges, rocks and walls stop it or throw it as they really would, and a jump lands the way you took it (no hidden levelling in the air: W/S and A/D still steer it in flight). Hard landings sink into a progressive bump rubber and then the body itself instead of hitting a hard stop. Your own buggy is still predicted on your machine and stays within a few millimetres of the host at 150 ms. `?drive=own` drives it the previous way, for comparison.
- **St. John's: the main gate, a Cadet Post, visitor parking and a volleyball court.** The stone gateway with its black arch now stands where the campus plan has it, over St. John's Road at the map's east edge, with a small stone guard post (the Cadet Post) just inside it; Church Street's east end is open road. Beside the visitor drive a strip of painted parking bays with three parked cars leads to the gym, and west of Scott Johnston / Hazelwood Hall there is a sand volleyball court with its net. MapMaker gains the pieces: **Guard Post**, **Volleyball Net** (bots see and shoot through it) and **Sand Court** in the Props palette.
- **Punchier hits.** A hit shoves harder: most from shotguns, the Precision and Marksman rifles, the Heavy Revolver and Hand Cannon, and the Battle Rifle (a shotgun blast moves someone about half a metre, was a third); a little more from rifles; SMGs and pistols stay light. Someone in the air takes half as much again and carries it until they land. The flinch you see on the one you hit is bigger, heavy hits play the hit animation, and when you are hit your view kicks a little, up and away from the round (smaller and eased in with Reduce flashing). No stun-lock: a hit still slows you at most half, for at most 0.6 s, then you are free for half a second.
- **Damage by impact speed, and clearer ranges.** Under Standard and Advanced ballistics a bullet hits by how fast it is still going: each gun keeps the kill distances it had at Standard, Advanced rounds fade sooner, Arcade is unchanged. Close-range guns now reach less far and fade lower: the Pistol 110 m (40 % far out), the SMG 100 m (35 %), the Pulse Pistol 90 m (30 %), the Hand Cannon and the Heavy Revolver 110 m (40 %; the revolver's head shot now kills to about 45 m instead of at any range), the Machine Pistol 60 m (35 %); rifles, the Spin Gun, the Battle Rifle and the snipers stay long. Bots fight the close guns closer.
- **MapMaker: a live minimap.** The right dock's top panel now has two tabs, **Minimap** and **Outliner**, and the compact dock (Shift+\\) is the minimap. It shows the level you are editing from above: the ground, floors, walls, blocks and props, tile outlines, spawns, flags, objectives and pickups, where your camera is and what it sees, and what you have selected (dashed when it is on another level). Click something on it to select and frame it, as in the Outliner (Shift adds, Alt picks one part); click open ground to fly the camera there. The wheel or + / − zoom, a drag pans once zoomed, ⌂ fits the level. It follows the level strip and View → Map layers, and redraws a moment after you stop editing, so edits on big maps are no slower. The tab you chose and the zoom are kept in this browser, not in the map.
- **The Battle Rifle: Single or a 3-round Burst, a sharper model and a real 3.5x scope.** Press U to switch its fire mode (a click, and the HUD shows Single or Burst under the weapon's name); the burst fires three rounds in a sixth of a second for close quarters, Single owns range, and bots pick between them. The rifle in your own hands is now a far finer copy of the same model (60,000 triangles instead of 14,000, sharper maps, real metal and roughness). Aiming brings its own scope to your eye: you look through the eyepiece at a 3.5x view with a reticle, with the scope's sway and Shift to hold your breath.
- **MapMaker: tall wall styles no longer go through the floors above.** The Grand arch, Gate arch, High wall and Towering wall reach more than one storey, so one on an inside wall with rooms over it went straight through the next level's floor (and out of the roof). MapMaker now refuses one there, and the card under the pointer says so before you click ("would rise through Level 3's floor here: use it under an open storey, or a one-storey style"); an outside wall may still rise past the storey above or a roof, as a high perimeter wall or a parapet does. A map that already has one gets a warning in its validation list. And the thick-walled arches (Grand arch, Gate arch, Embrasure) now dress their own inside face: their voussoirs and frames were buried inside the 0.8-1.2 m wall, so the curve showed as a staircase of blocks.
- **MapMaker: the Arid brush says where it paints.** Picking a preset also picks the grounds it suits (Arid: sand, dirt, gravel and stone), so on a grass map a stroke used to paint nothing and say nothing. The brush panel now says "Paints only on sand, dirt, gravel or stone" with a "Paint on any ground" button, the pointer says so over grass before you click, and a stroke that paints nothing says why. Its acacias, laurels and grass come out in their dry colours.
- **MapMaker: the Paint list fits its panel again.** Structure paint's materials (and Ground paint's) laid out four columns that a long name such as "Prototype Orange" pushed past the Assets panel's edge, so the last column (Grey Stone, Crate, Floor grate, Hex tiles, Light panels…) was cut off with no way to reach it. The lists now take as many columns as the panel fits, a long name ends in "…" (the card under the pointer gives it whole), and every tab of the panel was checked at 1100, 1440 and 2000 px.
- **Long matches no longer pile up characters' materials.** Every character that left play (past the bodies kept for reuse: deaths, new rounds, look changes) left its own copies of its materials and texture objects behind for the rest of the match: on Flavius Rule with 65 players, about 3 materials and 3.4 textures a second (318 → 1,083 textures in 200 s). The pictures on the graphics card were shared, so video memory stayed flat, but each copy cost script memory and the engine's per-frame lists. A body now frees exactly the copies it made, and nothing shared.
- **Beams stay on the gun.** The freeze ray's beam, lasers, the Pulse Pistol, the railgun's rail and the Arc Caster's lightning now leave the muzzle and stay on it every frame while you strafe, turn or jump, in first person and third person, and on other players' guns; their far end stays on what they hit. Before, a beam stayed where the gun had been when it fired, so it glided half a metre to a metre behind while you moved.
- **MapMaker: a Ground theme, and every ground paints as itself.** Map settings now have a **Ground theme** under the Structure theme (and a chip beside it in the top bar): the base ground every terrain cell you haven't painted shows, from ten themes (Meadow, Woodland, Rocky, Desert, Quarry, Snowfield, Moorland, Urban, Volcanic, Coastal). Changing it asks first, with how many square metres follow it and how many you painted (they stay), and offers Keep current look; changing the Structure theme offers its matching Ground theme as a tick box. Ground paint offers all 21 grounds (Packed Snow, Lake Ice, Shingle, Asphalt, Lava…) and draws each as itself, with no look-alike swapped in, plus a Base chip (or Shift+drag) that puts cells back to following the theme. A new terrain starts as its Ground theme's base. Maps saved before load as they were, cell for cell (map format v45; a test checks every shipped map looks exactly the same), and their export versions are kept.
- **MapMaker: the Paint list fits its panel again.** Structure paint's materials (and Ground paint's) laid out four columns that a long name such as "Prototype Orange" pushed past the Assets panel's edge, so the last column (Grey Stone, Crate, Floor grate, Hex tiles, Light panels…) was cut off with no way to reach it. The lists now take as many columns as the panel fits, a long name ends in "…" (the card under the pointer gives it whole), and every tab of the panel was checked at 1100, 1440 and 2000 px.
- **MapMaker: typed positions move things as a drag does, and the panels stay in step.** Typing X, Height or Z in the inspector now gives exactly what a drag or the arrow keys give: the position is rounded to the millimetre and a prop resting on a slope settles onto the ground where it lands (before, it kept its old height, half buried or floating). On a moving build selected whole, X, Z, Facing and the quick facings move or turn the mover with its blocks and props (before, only the mover moved and the lift stayed behind). Esc in a number field puts the value back, and an empty field no longer sets 0. Clicking a moving build's part in the outliner selects the whole build, as in the view (Alt-click: the part alone), and selecting something in the view scrolls the outliner to its row.
- **MapMaker's palette follows your map's theme.** The asset browser opens on "This map's themes": the tiles, props, set pieces and gameplay pieces of the Style Packs made for the map's theme come first in each group, marked with a small dot, and everything else follows; "All pieces" is one click away. Structure paint lists the theme's own materials, its packs' materials and what you painted lately, with every material under All; Ground paint lists the grounds your map already uses first. The top bar's theme picker is now a Structure theme chip that opens Map settings, so the theme changes in one place, with its warning.
- **St. John's: the entrance and the grounds.** The skybridge between DeKoven and Smythe is gone; in its place the drive splits round a kerbed flower bed with a tall fieldstone cairn (an arched niche near its top), fieldstone gate piers with caged globe lamps and low fieldstone walls stand at the drive's mouth, and King of the Hill's Church Street hill is now round the cairn. Scott Johnston / Hazelwood's north walk now curves round the hall's forward block instead of running into it, with a flagstone path to the arched entrance. A red brick walk crosses the lawn from the court to the library past stone benches and black lamp posts with banners; the chapel lawn has a dark marker stone, one of the flagpole's cannons and shrubs along the chapel's foot. New in MapMaker: the cairn, the island bed, gate piers (plain or with a lamp), low fieldstone walls (4 m and 2 m, fieldstone or limestone), the banner lamp post, the marker stone, a stone bench, and a Brick walk path style.
- **Dorm rooms cost fewer pieces.** Each room's two desks and their chairs are now one piece, and its two closet fronts another (they look and collide as before), so a room is 5 pieces instead of 9 and big halls fit in a map's budget: St. John's went from 4,068 of its 4,096 things to 3,748 before the grounds were added. The dorm pieces' new Room furniture option keeps the separate pieces for anyone who wants them.
- **The Hollow Pilgrim holds its guns properly.** Its support hand now reaches a rifle's handguard and a shotgun's slide instead of hanging back under the receiver, both hands meet round a pistol, and the shooting hand's fingers no longer tear into shards when they close. Its shoulders had been set out at the robe's wide shoulder seam, leaving its arms too short to reach.
- **MapMaker's palette follows your map's theme.** The asset browser opens on "This map's themes": the tiles, props, set pieces and gameplay pieces of the Style Packs made for the map's theme come first in each group, marked with a small dot, and everything else follows; "All pieces" is one click away. Structure paint lists the theme's own materials, its packs' materials and what you painted lately, with every material under All; Ground paint lists the grounds your map already uses first. The top bar's theme picker is now a Structure theme chip that opens Map settings, so the theme changes in one place, with its warning.
- **St. John's: Scott Johnston / Hazelwood Hall rebuilt, and slimmer dorm room doors.** The long dormitory along the parade ground's south is now a real three-floor hall in the same rubble stone as Smythe, with red sandstone trim: stairs at both ends, dorm rooms down a hall on every floor (about half of one side's rooms shut on some bays), and in the middle a block standing forward with a round-arched entrance, a stair to every floor and open landings. Round turrets stand either side of the entrance (battlements) and at the back corner (a red shingle cone). Every dorm room door, in Smythe Hall too, is now a 1.2 m oak door in a doorway brought in by the wall either side, instead of a 2 m door filling the whole opening; bots walk through them. In MapMaker the dorm set pieces have a Room doors choice (Wide or Slim) in the inspector, the new Round Corner Turret a Top choice (battlements, slate cone or red cone), and Collegiate stone comes with red trim too.
- **The Troop Buggy, after the owner's first drive.** Bots now hear a vehicle being driven and come for it, and for its driver once out (before, a buggy behind them went unnoticed until you fired). It drives up stairs, carries its speed up steep slopes (the faster you hit one, the higher you get before it slides back), no longer gets stuck still with its wheels spinning, and is lighter: more air off jumps, livelier springs, quicker to tip in the air.
- **MapMaker's issues list catches up sooner after an edit.** Its navigation check no longer builds the bots' navigation twice (once for the check, once more to fly the jump pads): on Iron Maw a check takes about 4 s instead of 7, and a map without jump pads skips the flights. Pressing Test stops a check still running, so it no longer competes with the Test's own start; it runs again when you are back in MapMaker. Edits also make fewer page elements (the outliner, the level strip and the hover card change only what changed).
- **The next match on the same map starts sooner.** The bots' navigation built for a map is kept: a server keeps it while it runs, and when you host in the browser it is kept in the browser's storage too, so playing or hosting the same map again (even after a reload) skips building it (Iron Maw: seconds less before the match). Any change to the map, or a new version of the game, builds it again.
- **Character Select's new categories.** The roster is now sorted the way the owner laid it out on the Roster Board: Soldiers, Everyday Folk, Outer Space, Agents & Spies, Legends, Creatures, Animalia, Machines and Horrors (Knights & Legends became Legends, Creatures & Machines split into Creatures and Machines, Animals is Animalia, Undead & Horror is Horrors). About fifty characters moved, among them the astronauts and aliens into Outer Space, the robots into Machines, the knights and kings into Everyday Folk or Legends as the board asked, and Santa, Kenji, Zhao, the Stealth Operative and the Dummy into Agents & Spies. Uncle Bao and the Rusty Mech are off the roster: a saved choice of either plays the Old Timer or T-TreeFitty. The section strip's chips are a little tighter so all ten fit.
- **Long MapMaker sessions no longer wear the tab down.** Every Test left the ended match in memory under MapMaker (about 200 MB on Iron Maw with 15 bots), and the textures of models still loading when a Test or match ended stayed on the graphics card for the rest of the tab's life (about 36 MB a short Test on Iron Maw, more with every map, character and gun seen). Both are freed now: ten Tests in a row and ten matches in a row leave the page where it was. This is the likeliest cause of the slow, then crashed ("Aw, Snap!") tab after a long MapMaker session.
- **A reload takes you back to MapMaker.** Reloading the tab (or Chrome's Reload after "Aw, Snap!") while in MapMaker or one of its Tests now opens MapMaker on the map you were making, its unsaved changes included, instead of the main menu. A new tab or the menu still start fresh.
- **Memory in the performance overlay, and a note when the tab slows.** The overlay (F3) and match recordings now show the page's memory each second (script memory, what the engine holds, textures on the graphics card, the page's elements) and the time each frame loses outside the game's own work; recordings note the moments a MapMaker Test starts and ends. When that lost time stays high for 30 s in a tab that ran smoothly earlier, the match says once, quietly, that the tab is slowing and a reload helps. MapMaker shows the memory figure in its status bar with `?memory=1`.
- **MapMaker's Test starts sooner and smoother.** When the map hasn't changed since MapMaker last checked its navigation, Test reuses the bots' navigation it already built instead of building it again (seconds on a big map: on the owner's Iron Maw Remix about 4 s of the 10 s start), and the match plays exactly as it would have. The first moments of loading no longer freeze while every effect warms up (it now happens a few at a time), and the screen's hurt edge no longer waits for the graphics card at the start.
- **MapMaker asks before a theme change, and the paint cursor shows where a look comes from.** Changing the Structure theme (Map settings, the top bar or the palette's "Use theme") now opens a warning with real counts: the surfaces that follow the theme and will change, the set pieces that will change, the surfaces you painted and the set pieces with a look of their own that stay, and whether the sky follows. Choose Change, Keep current look (the theme changes for new pieces and the palette, and everything built keeps today's look as your paint) or Cancel; each is one undo step. Structure paint's card by the cursor names the surface and shows its layers, Structure theme → set piece look → your paint, with the one you see ticked and what a click will do; Ground paint names the ground under it and whether it is the map's main ground or painted.
- **A map rebuilt in the game wins over an older published copy.** When one of our maps has changed in the game since the version it records as published, or the published copy is an older revision of it, the map list, matches, MapMaker and Host Services use the game's version until the owner publishes again, and the nightly sync no longer writes the older published copy back over it (it skips it and says why). Publish in MapMaker now stamps the map's release (the next revision), so the published file and the game agree on which version is newer; its dialog, and opening the official map, say when the game's version is newer than the last publish.
- **The Troop Buggy drives like a real buggy.** It is now a body on its springs: it pitches over crests, leans and can roll over off a kerb or a bad landing, lands jumps on its springs with its momentum, and its tyres have a limit, so it slides back down slopes too steep to grip (about 46°), drifts in hard turns at speed, and the handbrake swings the tail. In the air the nose follows the arc; W, S, A and D tip it from how you took off. On its side or roof, press Space to flip it back (the prompt says so); an empty one rights itself. Your own buggy answers your keys at once online too: it is predicted on your machine and corrected smoothly. Other vehicles drive as before.
- **Flavius Rule is an octagon.** The sand's corners are cut off: the arena is now a near-regular octagon, with angled stands on the four diagonals as tall and deep as the straight ones, galleries running round every corner, and the gates moved to the middle of the diagonals. Each gate keeps its portcullis, winch and chain; short stairs up the podium either side of it stay open when it drops, and stair wells off its passage lead down into the hypogeum. A gatehouse tower stands over each gate's outer end, with arrow slits and a string course, stairs to every tier and a lookout 32 m up. The corner courts and their stair towers are gone; each team spawns along its two gate passages and in the courts outside them. Same 4 m squares, 12 v 12, modes and village; the map's description no longer mentions the lift cages, beast lift, aqueduct or portal it lost earlier.
- **Flavius Rule: stairs up into the middle gallery.** Each corner now has a stair either side of its diagonal from the ground gallery (through an arch in its back wall) up into the middle gallery ring behind the seats, which had no way in; a parapet guards the stair's opening in the gallery floor. Bots use them.
- **MapMaker: two painters, and every part of a set piece paintable.** Structure paint (B) paints rooms, blocks, bars, thin walls and set pieces, and never the ground: over bare ground it does nothing and says to use Ground paint (Shift+B), the Terrain tool's ground brush, which paints only the ground and passes under buildings. No more silent swaps (Marble Checker no longer turns into Gravel). Ground materials go on floors and roofs, never on walls. On a set piece a click paints that material across the piece (all its stone, say), or "This surface only" paints one part, the bars included, without Explode; it stays through a theme change. **Bars and barred gates are iron** (a Cage Block's bars no longer turn brick with the theme, in any look): their own Metal surface, paintable. Bars on Cinder Foundry, Hollowmere Manor, Iron Tide, Ironhold Prison, Norman Shores, Obsidian Orb, Pump Tower and Flavius Rule are iron now, and the Loading Dock's metal on Blackout, Crossroads and Iron Maw; railings and fences look as before. Map format v41.
- **Breakable props are cheaper to draw while they stand.** Props that can break (every solid prop on a map where everything breaks, such as Breakyard, crates and furniture the catalogue makes breakable, and logs given health) now draw in the same batches as the other props until they break; a broken one leaves its batch at once and comes back at the next round. Their shadows go with them when they break. MapMaker's budget bar now counts breakable props under Destructibles as the map check does.
- **Hold E to resupply, hold to heal, and a clear low-health warning.** Restocking at a Supply Buggy's back or an Ammo Box now takes holding E for 1.5 s (a ring round the crosshair fills, "Resupplying"), and the Medkit heals on a held trigger over 2.5 s (50 health, on the teammate you aim at or yourself); letting go, walking off, firing, switching weapons or taking a hit stops it, and the HUD says why. Bots stand and wait it out. Below 35 % health the screen's edges darken, the world greys, a slow heartbeat plays, the health bar pulses gently and a marker points to the nearest health pack, all growing as health falls; nothing in it flashes (Reduce flashing eases it in more slowly).
- **Less work per frame for the graphics driver.** The game no longer sends the graphics card settings it already has: the sun's shadow settings on every draw, the same position for every batch of trees and props, and the scene's extra targets switched off and on around each draw. On St. John's (High) the main view sends about 45 % fewer commands a frame (some 4,000 to 2,200 at a spawn) and the shadows about a fifth fewer, looking the same. Also less garbage each frame: map pieces that never animate are no longer walked every frame, and a character's chest is measured once per look instead of once per new body.
- **St. John's: Smythe Hall in rubble stone.** The hall's outside walls and its corner tower are now irregular rubble stone (Roman Rubblework toned to a grey buff, under the pale dressed-stone plinth, string courses and window hoods) instead of the grey block pattern. The stones run on unbroken round the corners and buttresses, and the walls in shade still read as stone. Only Smythe Hall (the one hall built from the new pieces) changes; the other halls follow as they are rebuilt.
- **MapMaker: an exploded Arena Corner mirrors.** Mirror… (Shift+M) and M's flip now take an Arena Corner exploded to its storey tiles, placing each storey turned, so the result is exactly the set piece mirrored: the same stands, trim, lights and (on the gate) portcullis, in one undo step. Before, it refused the corner's tiles.
- **MapMaker: "Sky Cruiser" finds the Gunship.** The vehicle palette's search now reads each vehicle's description too, and the Gunship's says it is the Sky Cruiser (its model since 2026-11-12).
- **MapMaker: the Arena Corner's gate and gatehouse** (Flavius Rule's octagon, phase 3). A new set piece, Arena Corner (Gate): a Gladiator Gate on the corner's diagonal, its passage running from the sand out under the stand and through the facade, with a 45° portcullis in its mouth; a stair well either side of the passage down to the level below (for a hypogeum); a short stair up the podium wall either side of the gate, so the sand has ways out with the portcullis down; and a gatehouse tower over the gate's outer end, turned 45°, with switchback stairs to a landing every 4 m (the arcades at 8 and 16 m, the attic walk and its roof) and a lookout at 32 m. In the tile inspector, the corner's ground and attic storeys have a new Gate checkbox; the tower is its own tile under Vertical. The corner's ground storey no longer has hidden walls from the sand's Courtyard tiles poking up through its podium. No map uses it yet.
- **MapMaker's new layout.** Map settings open in the right-hand dock from the map's title or the new left rail's Map button, grouped as General, Gameplay, Presentation and Advanced, with the 3D view still live beside them. With nothing selected, Properties is one line ("Nothing selected · Map settings…"). The right dock has three states, expanded, compact and hidden, cycled with Shift+\ and kept in this browser; it starts compact under 900 px wide. Each tab has its own tool bar (Paint, Terrain and the plant brush are on Environment's), and its ⋯ menu lists every tool. Grid, Full grid, Overlaps, the plan view and the map layers are in a new View menu; Bot test is on the Test tab's bar; the problems pill is in a shorter status bar, which also says how much of the selection is on other levels. The top bar no longer cuts off the map name, Snap or the bots' skill at 1440 px.
- **Fewer hitches when bodies go.** In a crowded match past its body limit, and when a new round clears every body, the bodies are now put away over the next few frames instead of all in one (St. John's: a new round's frame of 30-50 ms on a slow machine is now about 5 ms).
- **Map format v39.** Race mode's leftover track settings (laps, start grid, race vehicle, combat) are dropped from maps as they load and no longer written; a track keeps its curbs, NPC cars and pit lane.
- **Fewer shadows to draw indoors.** Furniture and other props under a roof, a ceiling or the floor above no longer go into the sun's shadow map on any map (the roof's own shadow already covers them): about a quarter to a third fewer shadow casters where buildings are full of furniture (Flatpack Depot, St. John's dorms), with the same look inside and out.
- **St. John's: Smythe Hall rebuilt.** The L-shaped dorm hall is now a real two-storey stone hall: a hall down the middle of each floor with dorm rooms both sides (oak doors between built-in closets, desks with hutches, bunks, sash windows with glass), a lounge with a fireplace and a washroom where the hall turns the corner, half-turn stairs at both ends, a round-arched door at the far end and a side entrance on the west face, and a square corner tower with firing slits and a ladder to a battlemented lookout. Half the rooms on two of its bays are shut. The railgun and its cells are still upstairs; the skybridge still joins it to DeKoven until the entrance is built. Made in MapMaker from five new set pieces (Dorm Corner Bay, Dorm Entry Bay, two Stair End Bay doors, Square Corner Tower).
- **Fixes from the flaky-test sweep.** A player kicked or refused by a dedicated host is told why even on a congested link (the host waits for them to leave, 5 s at most, before closing the link). A dedicated host started on a busy machine recognises signed-in players from the start (it asked for the hub's keys while it was still building the map, and waited 30 s to ask again). Damage numbers show at least once on a very slow page. A character who stood up while out of view no longer comes back into view crouched (Hyena Warrior).
- **Options and Match Setup on phones.** Options is one column on a phone: the sections are chips along the top, the panel takes the whole height, and every setting is one line, its name and control side by side, with what it does behind an (i). Match Setup's header, which stays put while the setup scrolls, names the mode too, and the steppers' − and + are 40 px squares.
- **Calmer terrazzo.** The speckled terrazzo floors (Flatpack Depot, the labs and offices) have finer, softer specks that no longer read as noise on a phone.
- **Sun Warrior holds his guns properly**: his fingers close round the grip and his hands sit on the grip and the handguard, in first and third person. The Hollow Pilgrim's shooting hand sits on the grip.
- **Status auras read in daylight.** A burning, poisoned or gooed character past the three nearest (which wear the full effect) now has a steady glowing outline in the status' colour instead of a see-through slab, and poisoned and gooed characters keep that outline under their bubbles, so they show in sunlight with Reduce flashing on.
- **No square of path ground past a path's end** (St. John's, most visible on Low graphics).
- **Twelve new characters** (Meshy Community, CC0; the owner moved them from Experimental to the roster the same day): Velvet Vance, Warrior Sentinel, Armored Sentinel, Rosa Rivets, Spike Scavenger, Azure Sentinel (navy coat, amber lenses), Sun Warrior, Spud Marshal (olive armour, grey-green skin), Mister Lanky, Reef Wanderer, Bronzer (a living bronze statue) and The Hollow Pilgrim, who glides on its robe instead of walking. They sit in their own Character Select sections, and bots, random picks and Roulette can wear them.
- **MapMaker: the Arena Corner** (Flavius Rule's octagon, phase 2). A new set piece in the Arena stands family, and its four storey tiles under Vertical: a 45° corner of an arena's stands that meets the straight Arena Bays flush on both sides. The podium and three tiers of seats turn the corner with an aisle up each mitre and up the middle, a vomitorium on the upper tier, the galleries behind the seats at levels 0, 2 and 4 run right round, and the facade's arcades and attic follow. Its new arches collide plainly (piers and lintel). Mirrored, it is the same corner turned. No map uses it yet.
- **Big maps draw far less each frame, looking the same.** St. John's on High went from about 1,500 draw calls a frame to about 550 (Norman Shores 2,200 to 1,060, Backwoods 1,690 to 850, Capitol Mall 970 to 530): the sun's shafts draw only what can hide the sun (they redrew most of the map every frame), far trees and furniture share batches over wider squares, each shadow cascade draws only the batches it reaches, and a door's parts and the paths are merged.
- **MapMaker's kit: pieces at any angle** (Flavius Rule's octagon, phase 1). Kit tiles can now turn any group of parts (stairs, vaults, columns, rails) to any angle, and build any wall style (wall, Round arch, Grand arch, window) along any line, with a plainer collision for the new arches (their piers and one lintel; they look the same). A door turned off the grid now blocks bots, the navmesh and spawns by its own slab, not the square round it. No map or piece changes yet: the octagon's corner pieces come next.
- **Twelve new characters under Experimental** (Meshy Community, CC0): Velvet Vance, Warrior Sentinel, Armored Sentinel, Rosa Rivets, Spike Scavenger, Azure Sentinel (navy coat, amber lenses), Sun Warrior, Spud Marshal (olive armour, grey-green skin), Mister Lanky, Reef Wanderer, Bronzer (a living bronze statue) and The Hollow Pilgrim, who glides on its robe instead of walking. Pick them in Character Select's Experimental section; bots, random picks and Roulette leave them alone until they join the roster.
- **No hitch when a match starts.** Characters now settle into their aim and come into view over a few frames instead of all in the same one: a big match on St. John's had one frame of about 185 ms some 5 s in (157 ms of it fitting rifle stocks to every nearby character at once).
- **Effects fixes.** Pantry Raid's mouse holes are real ways through: the skirting board stops at each hole, so every body size and the bots get through, and the holes show a dark painted swirl (MapMaker: a portal's new Swirl option, Pack effect or Painted). Pickups' floor rings get a thin dark outline, so they read on sand, snow and white tile. On Low graphics, effects you can't see no longer take the places of the pads, portals and pickup glows in front of you. Guns waiting to be picked up are drawn bigger (1.4x), clear of walls.
- **The Heavy MG Turret sits at the hip.** It is drawn 2.1 times its model's size (2.4 before): its receiver's top is 1.35 m up, a quarter of a metre under your eye, so the ground shows from about 26 degrees under the crosshair where the gun hid everything within about 6; standing behind it, characters hold it at hip height, not at the belly. Its box is a little smaller (cover to 1.34 m) and the gunner stands 1.5 m behind the pintle.
- **MapMaker: vehicle pictures with their tires.** The palette pictures of the Troop, Gun and Supply Buggy, the Troop Truck and the Armored Rover now show their tires (they showed the bodies alone).
- **The Spillway: the long stair has cheeks.** Concrete slabs flush with the steps now run up either side of the long stair to the crest, so it reads 8 m wide; the 2 m ledges beside each flight, dead ends where bots got stuck, are gone (stuck recoveries about 80 a match before, about 50 after). Built in MapMaker.
- **Steampunk Warrior's hands** no longer fold into shards on a rifle's handguard: his fingers are skinned more smoothly and his support hand closes less.
- **MapMaker: selecting and editing a prop is quicker.** The inspector's two long lists (Model, and Replace all's With: about 1,500 and 1,900 entries) are filled when you open them, not on every selection and edit; selecting a prop on a big map costs less than half the page work it did. The route tool (drop routes, movers, ziplines) no longer rebuilds its markers on every step.
- **Twelve characters join the roster** (Meshy Community, CC0; they were under Experimental): Neon Guardian, Star Voyager, Neon Shadow Ninja, The Mechanic, The Prospector, Warrior of the Skies, Astronaut Explorer, The Racer, Botney Mullz, Cyber Lion, Lion in a Suit and Gorilla G. They now sit in their own Character Select sections, and bots, random picks and Roulette can wear them. Gorilla G holds a rifle with both hands on it.
- **The Vortex Grenade is now the Gravity Grenade.** Only the name changes: the grenade, its pickup (Gravity Grenades) and the maps that place it are as before.
- **More for Style Pack 14.** Two new tiles: a **fire escape** (a steel switchback stair on a building's face, stackable by storey; its landing meets the west part of the wall, so use an Arch there) and a **scaffold bay** (two plank decks on tube frames with a stair). A **bus stop sign** in four looks, now on the bus shelter. The **bandstand** is rebuilt as one: an octagonal plank stage with steps, posts, picket rails and a pitched roof. The set pieces' tab reads "Town pieces".
- **For map makers and agents:** `PERF_STILL=1` makes `tools/perf/client-perf.mjs` measure from fixed cameras with no bots, so two runs on an unchanged map agree (`docs/PERF_TOOLS.md`).
- **MapMaker is quicker on big maps** (from the owner's recording): dragging or hovering a point in the Paths tool no longer freezes (a step that took about 180 ms takes about 10); the Map properties panel no longer rebuilds on every edit (its plan and quality-gates line catch up half a second after you stop); selecting something redraws only the changed rows of the outliner; and finding what is under the pointer costs half as much.
- Ammo Boxes: map ammo boxes are solid crates you resupply at (10 uses), a throwable Ammo Box Kit sets one down, and a shot-up box cooks off.
- **Ammo boxes you can shoot.** Every Ammo Box on the maps is now a solid crate: press Use beside it to resupply (full reserves for every gun you carry, underbarrel rounds and grenades). Each holds ten resupplies, and you wait a few seconds between two. Shoot one or blow it up and it cooks off in a round of small blasts and pops that hurt anyone close, a bigger round the fuller it was. Emptied or destroyed, it comes back after a while. Tanks refill beside one.
- **The Ammo Box Kit.** A new pickup: carry it like Sandbags and throw it to set down an ammo box of your own (ten resupplies, two minutes, one at a time).
- **MapMaker: Fit ground, the owner's answers.** A lone platform (a slab with nothing built on it) now stands on the ground: Fit brings the ground up to its underside, while a foundation with walls or pieces on it keeps the ground flush with its top. Props standing on the ground a Fit moves are set back on it in the same step, so one undo takes back both.
- **A new parachute.** The canopy is a round dome of sixteen fabric panels with a scalloped edge and a vent, on lines that run to four risers behind your neck (it was a flat red disc on lines from your feet). Eight colour schemes, one per player for the whole match: Sunset, Harbour, Field, Hazard, Lagoon, Regal, Plain and Kite. It sways slowly, more gently with Reduce flashing on, and costs half the triangles of the old one. The glider is unchanged.
- **Urban set pieces** for Style Pack 14, built in MapMaker: a porch, a bus shelter, a parking deck bay and its ramp (vehicles drive up it), a bare concrete frame of one and two storeys, a bandstand, and a shop unit with the shopfront, awning and painted door. They are under the Urban tab of the set pieces. No map uses them yet.
- **The arched window is neater:** thin pale stones round the arch, a small keystone and a slim sill, where it had dark, chunky blocks. Its opening, glass and collision are unchanged.
- Vehicles: the Supply Buggy (resupply at its tailgate, bots use it too), the six-seat Troop Buggy, the three-seat Gun Buggy, and a seven-place Armored Rover with its rear gunner at the gun; the old Buggy becomes the Troop Buggy on every map.
- **Troop Buggy and Supply Buggy.** The Buggy is now two vehicles. The **Troop Buggy** (the Tactical Off-Road Beast, the long sand-coloured one with a roof gun) seats six: a driver, a front passenger, two seated behind and two standing in the back row, their shoulders out of the roof. Every Buggy on the official maps is a Troop Buggy now. The **Supply Buggy** (the dark sci-fi buggy) seats two, and players on foot at its tailgate press Use to resupply (full reserves for every gun you carry, underbarrel rounds, grenades topped up). It holds ten resupplies, each player waits a few seconds between two, and it comes back full when it respawns.
- **The Gun Jeep is the Gun Buggy** and seats three: the driver and a passenger in the cab and a gunner standing at the roof gun.
- **The Armored Rover seats seven:** the driver and a passenger in front, two on the bench behind them, one rider hanging on each side, and the rear gunner on the roof. The front gun is gone.
- **Paths join roads cleanly.** Where a footpath, trail or boardwalk meets a road, the road's surface is drawn on top, so the path ends under it instead of lying over the lane markings; streets also go over the wider concrete and gravel ways that cross them. In the game and in MapMaker.
- **The Spillway: walk off the crest's east end.** The ground beside the dam's east end was up to 8 m below the crest; it is raised to meet it now (in MapMaker), so the east abutment is walked onto from the dam like the west end.
- **The Spillway: the crest's edges close up and the hillside stair gets legs.** The south parapet now returns to the two tower bridges and the long stair's head, with a rail on each side of the three short slabs over the slot between tower and dam; the north parapet runs on into the west hillside; and the open stair up to the east bench stands on eight concrete legs. Built in MapMaker from solid blocks.
- **Style Pack 14: Urban & Civilian.** A pack for streets, shops, houses, car parks, yards and squares, made mostly of pieces the game already had (44 tiles, 85 props, 24 materials, 7 facades listed by reference), with an `urban` look for 16 set pieces. New with it: two wall styles for any room, a **shopfront** (a low riser and one wide pane) and an **arched window**, both of which take glass; four materials (parking bay markings, tactile paving, graffiti on brick, damaged plaster); painted doors (red, blue, white, a glazed shop door) and a striped shop awning; and street pieces: bollards, a bike rack you can shoot through, a mailbox, a newspaper box, cable spools and chain-link fences (panel, gate, a site panel on feet). No map uses the pack yet.
- **Map format 38** (the two wall styles). Older maps load unchanged; a map that uses a new style needs this build or later.
- Retired plant props no longer appear in five style packs' lists.
- MapMaker: editing big maps is two to three times quicker (moving, undoing, selecting); select an existing path or road to edit it; fit the ground to a build.
- **MapMaker: fit the ground to a build.** Select a building, a set piece, blocks or props and press **Fit ground to this** (the inspector's Ground section, or right-click): the ground rises or drops to meet its base and eases back into the ground about, so foundations no longer hang over a slope. **Settle onto the ground** does the reverse and moves the build onto the ground instead. A path has both in the Paths pane. One undo step each.
- **MapMaker: click a road to edit it.** With the Select tool, a road, trail, track or route lights up under the pointer and a click opens it in Paths, its points ready to drag, add and remove. The Paths pane sets its length by number and adds points at either end.
- **MapMaker is quicker on big maps.** Moving, placing or undoing a piece on a map of thousands of blocks no longer rebuilds the whole level: on St. John's an edit takes between a third and a half of the time on the page it did, and the map's checks run in the background.
- Tunnels: stairs, slopes, shafts with ladders, risers and chambers for every tunnel family; in MapMaker, click the ground over a buried piece to select it.
- **MapMaker and `validate-map` fly every jump pad.** A player's body is flown off each pad; a pad that lands more than 2.5 m from where it says it will (a roof or beam over the arc, a slide off the landing) shows as a warning in MapMaker's Problems list and in `validate-map`.
- **For map makers and agents:** `pnpm bot-report <map> --base=origin/main` compares a map's pace (kills a minute, time to the first fight) before and after a change and warns on a big drop. Check branches now report every failing unit and e2e shard in one run, and a change to characters alone runs the character flows, not the whole suite.
- **Tunnels under hills (Tileset 04, first part).** A tunnel can now run under the ground with the hill left on top: MapMaker cuts the ground only where it crosses the passage, opens it at the mouths and brings the earth to the walls by itself, so nothing is carved by hand and a tunnel that moves takes its mouth with it. The vaulted tunnels get an **Under ground** option and a **Tunnel Portal**. A new **Tunnels** group has the concrete tunnel kit: straight, curve, T-junction, four-way, dead end and portal, all the same 3.6 m passage. In the tile inspector's **Tunnel** box, **Family** changes a piece or its whole connected run to another material family (concrete, and a brick preview until the sewer family is built), and **Add a portal at the open end** puts a mouth on any end that leads nowhere. A run placed a level down under flat ground leaves the surface flat and each portal digs its own ramp down to it; on ground level it is an earth mound. Buried passages show as dashes on the minimap, the map plan and in MapMaker. The **Lit Tunnel Run** set piece is three modules with real lights. The validator warns of a buried end with no portal and of water reaching into a tunnel. Map format v37 (a placed tile's `family`); older maps load unchanged.
- **Tunnels that climb, drop and open out (Tileset 04, second part).** Six more pieces in the Tunnels group, in every family: **Stairs** and **Slope** take a buried passage up one level with the earth kept over them; **Surface Stairs** are the way down from flat ground into a tunnel a level under it; **Shaft** is a hatch to the surface and **Riser** a well between two tunnel levels (the **Tunnel Shaft** and **Tunnel Riser** set pieces come with their ladders, which bots climb); **Chamber** is a 14 m room on four columns with a passage on each side. In MapMaker, a click on the ground over a buried tunnel now selects it, and a selected buried set piece offers **Add a portal** on its open ends. The tunnel's pipe is thicker and eight-sided, so it reads as a pipe.
- **The Spillway: parapets on the crest and legs under the long stair.** A 1 m concrete parapet runs along both edges of the dam's crest, open where the two tower bridges and the long stair come up, and the long stair stands on pairs of concrete legs. Built in MapMaker from solid blocks.
- **The Spillway seats 64.** Eight more spawns a side, placed in MapMaker: Embers between their two rows on the dam's crest, Tide beside theirs in the valley.
- **The dome kit's parts read in the palette.** The cap, panels, broken panels and drum quarters fill their palette pictures now (they were small slivers framed by the whole dome's size).
- **Status auras.** A burning character is wrapped in twisting flame streaks, a poisoned one in green haze and bubbles, a slowed one in pink goo wisps and a chilled one in pale ice crystals (the Binbun Status FX pack), on the nearest three characters within 40 m; others keep the plain coloured shell. Nothing changes in damage or timing, and you see no aura on yourself. With Reduce flashing on the auras move at half speed, dimmer, and the plain shell no longer pulses.
- **Portals swirl and jump pads rise.** A portal's frame holds a moving swirl in its pair's colour (the Binbun Portal pack), and a jump pad stands in a column of rising light (Magic Area pack) with its plate, ring and chevrons still showing. Portals and pads are drawn ahead of loot glows when effects run short. With Reduce flashing on both are held still, dimmer and eased in.
- **Zombies are your zombies.** Every zombie in Zombies mode (and in co-op squads) now wears one of the roster's six zombie characters: the Groaner, Lurcher, Rotter, Shambler and the two Zombie Soldiers. Two in three used to wear a stock zombie body that had no ragdoll, so it tipped over flat like a box when it died; now every zombie falls as a ragdoll, thrown by the shot or blast that killed it, the same as a player.
- **Guns show on their pickups again.** Fifteen of the older gun models (the Auto Shotgun, Sawed-Off, SMG, LMG, Revolver, Hand Cannon, Marksman and Sniper rifles, Burst Rifle, Machine Pistol and more) drew nothing on a pickup or when dropped: only the glowing ring showed. They were stored in a form the pickup's drawing code dropped. Every gun now shows on its pickup and on the ground.
- **The Auto Shotgun has a proper model:** a textured steel-and-wood shotgun in place of the thin near-black shape.
- **Sandgate's doorways are clear.** A facade's plinth ran straight across its doorway, a low bar sticking out of the floor in the entrance. The plinth now stops at each side of a door, on all twelve facade styles.
- **Calmer Desert City plaster.** The plaster walls had hard, dark-rimmed patches of bare stone. It is now worn thin in a few small, soft places.
- **Sandfall Colosseum is now Flavius Rule,** after the owner's board game of the same theme and layout.
- **One switch for random bodies.** The Rules tab's "Random characters" row is gone: it did the same as the Roulette Bodies variant, which now only gives everyone a random character each life (turn on Character stats in Rules if the bodies' stats should count).
- **Pickups glow.** Weapons, health, armor and ammo sit in a soft ground glow from the Binbun Loot pack, coloured by kind (weapon gold, health green, armor blue, ammo pale), on the nearest pickups within 28 m. Steady and eased in; with Reduce flashing on it is dimmer, held still and has no sparkles.
- **Fix:** an effect asked for late in a slow frame no longer restarts each frame.
- **Sandgate's roofs wear the new domes.** Its seven small roof domes are kit domes now, placed in MapMaker: white plaster, and blue tile on the west hall. They are closed domes on solid drums with blind arches, solid as the old ones were.
- **Closed domes in the dome kit:** whole one-cell domes with 8 or 12 segments on a solid drum with blind arches, in the kit's six looks, for roofs where nobody should get inside.
- **Dormitory pieces, the first step of St. John's rework.** New in MapMaker: tall sash windows with real glass (wall styles Sash window and Twin sash windows: a painted sash with a meeting rail and glazing bars, a stone sill), the Room doorway (2 m wide in an oak frame), and the Oak Door as a still prop that fits it: shut, ajar or standing open, with plank, half-glazed, diamond-panelled and dark leaves, iron strap hinges and a ring handle. A desk with a shelf hutch, a slim closet, a closet front to set in a wall and a navy-blanket bunk join the furniture. Under Set pieces, the Academy family builds a dormitory floor in bays: the Dorm Bay (a hall with two furnished rooms each side: closets built into the entry wall, two desks, a sink, a bunk), the same with two rooms shut, the Stair End Bay for two or three floors, and the Dorm Office Bay (a straight stair, an office behind a half-glazed door, bathrooms). Place bays end to end and the hall runs through them. St. John's itself is not changed yet.
- **The Go-Kart and the Ice Cream Truck are retired** (owner, 2026-11-12). They are gone from MapMaker's palette. A map that placed a Go-Kart has a Hover Bike there (also one seat and no gun), and one that placed an Ice Cream Truck has a Buggy (also no mounted gun, its riders shooting their own weapons); a track whose NPC cars were karts laps Hover Bikes. Old, saved and community maps that still name the two load and play that way, with nothing about the file changed; MapMaker shows what each plays as and replaces them all with one button (Replace all, in the vehicle's inspector or the track's pane). Changed that way in MapMaker: Apex Ring (its twelve lapping karts are Hover Bikes, about half as fast again), Diamond Park, Flatpack Depot, Neon Galleria, Capitol Mall, Runway Nine, Cedar Lane and Sandsweep; the test map lost its two.
- **The Transport Plane is a giant Hauler.** The air-drop craft is the Hauler's model at 2.35 times its size: a 16 m armoured hover freighter with six engines, in place of the plain grey cargo plane. Its 24 riders are in the hold and jump out behind it as before; the route, the air drop and the parachutes are unchanged.
- **The Heavy MG Turret is full size.** It was knee high; it is now twice the size: 3 m long, its receiver chest high to the gunner standing behind it. Its box is a little larger (cover up to 1.3 m) and the gunner stands 35 cm further back.
- **You see the gun you are manning.** On the Heavy MG Turret and the Rocket Turret your own gun was hidden while you manned it; it is drawn now, in front of you, turning with your view.
- **Dormitory pieces, the first step of St. John's rework.** New in MapMaker: tall sash windows with real glass (wall styles Sash window and Twin sash windows: a painted sash with a meeting rail and glazing bars, a stone sill), the Room doorway (2 m wide in an oak frame), and the Oak Door as a still prop that fits it: shut, ajar or standing open, with plank, half-glazed, diamond-panelled and dark leaves, iron strap hinges and a ring handle. A desk with a shelf hutch, a slim closet and a navy-blanket bunk join the furniture. Under Set pieces, the Academy family builds a dormitory floor in bays: the Dorm Bay (a hall with two furnished rooms each side), the same with two rooms shut, the Stair End Bay for two or three floors, and the Dorm Office Bay (a straight stair, an office behind a half-glazed door, bathrooms). Place bays end to end and the hall runs through them. St. John's itself is not changed yet.
- **The Go-Kart and the Ice Cream Truck are retired** (owner, 2026-11-12). They are gone from MapMaker's palette, and their models from the game. A map that placed a Go-Kart has a Hover Bike there (also one seat and no gun), and one that placed an Ice Cream Truck has a Buggy (also no mounted gun, its riders shooting their own weapons); a track whose NPC cars were karts laps Hover Bikes. Old, saved and community maps that still name the two load and play that way, with nothing about the file changed; MapMaker shows what each plays as and replaces them all with one button (Replace all, in the vehicle's inspector or the track's pane). Changed that way in MapMaker: Apex Ring (its twelve lapping karts are Hover Bikes, about half as fast again), Diamond Park, Flatpack Depot, Neon Galleria, Capitol Mall, Runway Nine, Cedar Lane and Sandsweep; the test map lost its two.
- **The Transport Plane is the Drop Carrier, a giant Hauler.** The air-drop craft has a new name and a new shape: the Hauler's model at 2.35 times its size, a 16 m armoured hover freighter with six engines, in place of the plain grey cargo plane. MapMaker calls it Drop Carrier too (the Carrier Drop Route card, the Aircraft list, its checks). Its 24 riders are in the hold and jump out behind it as before; the route, the air drop and the parachutes are unchanged.
- **The Heavy MG Turret is full size.** It was knee high; it is now 2.4 times the size: 3.6 m long, its receiver chest high to the gunner standing behind it. Its box is larger (cover up to 1.5 m) and the gunner stands 55 cm further back.
- **You see the gun you are manning.** On the Heavy MG Turret and the Rocket Turret your own gun was hidden while you manned it; it is drawn now, in front of you, turning with your view (ducked behind it, it is left out so you can see).
- **Sandgate's roofs wear the new domes.** Its seven small roof domes are kit domes now, placed in MapMaker: white plaster, and blue tile on the west hall. They stand on arched drums you can step into from the roof.
- **The Desert City dome kit.** Domes you build from parts in MapMaker, from the owner's dome set sheet: a cap, dome panels for 4, 6, 8 and 12 segments (plain, with a window, broken), drum quarters with arched doorways, windows or solid wall, three ring trims, and 4-, 3- and 2-way arch transitions a drum stands on. Every part shares the dome's centre, so you drop them on one point and turn each by its step. Whole domes too: one-cell domes and 15 m hall domes with 8 or 12 segments, and three ruins. Six looks: stone, sandstone, white plaster, copper, blue tile and green tile. You can stand inside under a dome; doorways, windows and breaks are open.
- **Our own anvil and station pipes** (kit-prop generators, Phase 6 part 11): an anvil on a timber block, a coolant pipe and a pipe junction, four looks each, replace the last Kenney anvil and space-kit pipes in the palette and on ten maps (15 placements, swapped with MapMaker's Replace all). The anvil is metal to shots now (it was concrete).
- **Our own factory machines, hoppers, pipes, workbench and traffic cones** (kit-prop generators, Phase 6 part 10): heavy machines and machines with a guarded chamber, round and tall hoppers, pistons, scanner gates, levers, cogs, glass pipes, pipe risers, workbenches and two traffic cones, each in four or five looks, replace the Kenney pieces in MapMaker's palette and on 30 maps (200 placements, swapped with MapMaker's Replace all). Cover is where it was. Two changes: the hoppers and the pipe riser are closed to the rim (the old ones were pits you could drop into), and the workbench is wood and the lever thin metal to shots.
- **Wheels that turn properly on the Buggy, Gun Jeep, Troop Truck and Armored Rover.** All four now ride on the separate off-road tire, one at each hub, sized to the vehicle (the truck's six are the biggest): each spins about its own axle, the front pair steers, and each rides its spring. Before, their tires were pieces cut from the body that took bits of fender with them and wobbled off-centre, and the Armored Rover's never turned at all. The rover gained springs for this; its speed, turning and grip are as they were.
- **Style Pack 13: Industrial Factory, with its demo map Ironworks.** Seven tiles in MapMaker's Style Pack palette on a new soot-and-steel theme: a factory hall, a pipe rack, a catwalk crossing, a conveyor line, a loading bay, a silo and a control room. The loading dock, power core, reactor, server vault, catwalk bridges, skybridges and stair towers take the pack's look when it is chosen. Ironworks (Deathmatch and Team Deathmatch, experimental) is a walled factory lot built from them in MapMaker: the hall in the middle, the loading bay and the silo at the two ends, pipe racks and conveyors between.
- **Orbital Station grows a research wing.** Eight more tiles in the Orbital pack: a lab module, an airlock tube, a landing pad, a comms array, a greenhouse, a sky tube, a rover bay and a hab dome.
- **Our own market fittings, control consoles and pipe valves** (kit-prop generators, Phase 6 part 9): wire shopping carts, bakery and produce stands, checkouts with a till, chest freezers, bottle-return machines, factory control consoles and flanged pipe valves with a hand wheel, several looks each. They replace the Kenney toy pieces at the same size and with the same finer collision; 181 placements on 32 maps were swapped with MapMaker's Replace all. The stands and checkout now take rounds as wood, the freezer, bottle return and console as thin metal.
- **Zombies: a bigger horde, zombie skins only, and the dead stay.** Waves are larger and grow with the squad, bots included (a bot counts as half a person, it was a third), with up to 64 zombies up at once (it was 32). A Zombies match takes 16 players at the most for now. Every zombie wears a zombie body or one of the zombie characters' skins (a third of them used to be plain mannequins tinted green), and bodies stay where they fall for the whole match, up to 96 of them, whatever the Bodies setting.
- **Ten new characters** (Meshy Community, CC0), under Experimental in Character Select until they have been looked over in game: Octo Buddy, Sugar Skull, Inspector Bigotes, Steel Guardian, Shadow Enforcer, Steampunk Warrior, Sentinel in Green, Goblin Gunslinger, The Purple Comet and Elephant Warrior.
- **Rockfall Canyon, refreshed.** Its 81 Kenney rocks, logs, bushes and trees are now our generated ones: rounded and angular boulders, slabs to hop onto, tall outcrops, fallen logs, shrubs, pines, spruce, maple and oak. The layout is unchanged; the logs can no longer be shot apart.
- **Fallen logs break only if you say so.** A generated fallen log is solid cover. Give a placed log Health in its inspector and it can be shot apart (wood debris, back next round); "Everything breaks" on a map leaves logs alone. Breakyard has one of each.
- **The Spillway: the long stair.** A third way up the dam: six open flights in one line on its face, from the toe terrace to the crest, between the powerhouse and the east tower. Faster than the stair towers and exposed all the way.
- **More generated rocks, and a fallen log.** Beside the angular boulder, MapMaker's Nature palette now has a rounded boulder, a flat slab to hop onto, a tall outcrop (its notches stay open to shots) and a fallen log, each bare or mossy. The log is cover you can't break, for now.
- **Our own shipping crates, warning signs, conveyors and shop freezers** (kit-prop generators, Phase 6 part 8): big shipping crates with a saddle across the top, long crates, free-standing warning signs (striped panels, a wet-floor frame, a post marker), belt conveyors with rollers and guard rails, and banks of upright shop freezers stocked behind glass doors. They replace the Kenney toy pieces at the same size and collision; 195 placements on 25 maps were swapped with MapMaker's Replace all. The warning sign and the freezers now take rounds as thin metal (they stopped them like concrete); the conveyor still plays as concrete.
- **The Gunship is the Sky Cruiser** (Meshy Community, CC0): a red and white hover craft with a door open on each side. The pilot sits in the cab and each door gunner sits in their doorway, feet on the step board; handling, health and the guns are as before.
- **The Hauler is the Ironbound Voyager** (Meshy Community, CC0): an armoured hover freighter with six engines. The pilot sits in the nose, the rocket gunner stands on the deck and the four passengers sit along its edges; handling, health and the rockets are as before.
- **The Troop Truck is on Iron Maw and Sunstone Crag:** one for each team at its base.
- **The Tank's turret turns all the way round** for a gunner in the cannon seat, at its own pace (a half turn in about two and a half seconds); the cannon fires as the barrel reaches where you are looking, so a shell always goes where you aim. A driver alone still fires only ahead (about 34 degrees either side).
- **Duck down in standing places.** Riding where you stand (the Troop Truck's flatbed, the roof guns of the Gun Jeep and the Armored Rover, the Hauler and Dropship places, a turret), crouch ducks you down: a lower eye and a smaller target, as on foot. Not at the wheel, where crouch is "down". Bots riding there duck when rounds come in and come up to shoot.
- **A hit keeps your hands on your gun** in first person (they hung off it for half a second each time you were shot).
- **Our own pieces everywhere the Kenney ones were named.** Set pieces (the fort, the casemate, the loading dock, the plaza and six more), MapMaker's Dress room, the Style Packs and the scenery belt past a map's edge now use our own kit pieces directly. With a Style Pack picked, the palette shows the kit pieces (it hid them all). Rooms dress exactly as before; the set pieces' palette pictures show the new pieces.
- **Our own office chairs, beds and corner sofas** (kit-prop generators, Phase 6 part 6): swivel office chairs, round and six-sided pedestal tables, double beds, bunk beds with a ladder and corner sofas, five looks each. They replace the Kenney toy pieces at the same size and with the same finer collision (you still shoot between the bunks and under a table top); 223 placements on 30 maps were swapped with MapMaker's Replace all. Beds, bunk beds and the corner sofa now take rounds as wood (they stopped them like concrete).
- **The Spillway: one team in the valley, the other up on the dam.** Embers now start on the dam's crest and Tide in the valley below; Embers' flag stands on the west abutment and the crest's hill moved to the east bench.
- **Core and experimental characters.** A character's tier is set in its content file (the owner's Workbench has the field). Experimental characters are listed under their own "Experimental" heading in Character Select and are never drawn for bots, random characters or Roulette; a person can still pick one. `pnpm quality-gates` now checks characters too: triangle budget, a far copy, measured hands, a complete clip set, a measured hitbox and a portrait must pass for a core character and are only reported for an experimental one. Every character today is core.
- **Hands stay on the pistol when you move.** In first person the shooting hand jumped about 10 cm off the grip for a frame, several times a second, while walking or running (never standing still). The walk and run animations leave the fingers alone, and the grip was reading its own last pose back; the fingers are now put back as the hold left them before each frame's grip.
- **Riders sit where the vehicle has a seat.** The Kart's driver sits inside its pod, the Hover Bike's and the Speeder's riders sit astride their saddles, the Skyfighter's pilot sits in the cockpit, the Ice Cream Truck's four sit inside (their heads no longer come out through the roof) and the Tank's crew ride in their hatches, head and shoulders out. The Buggy's four deck riders sit on the edges of the deck facing out instead of standing.
- **Roulette: who you hit.** A bot keeps one name for the whole match, so its score is easy to follow; the name over the health bar of whoever you hit now adds the character they are wearing this life ("Mildred · The Dapper").
- **Vehicle fit fixes.** The Gun Jeep and the Buggy now collide where their tires are drawn (both are 2.9 m wide to walls, rounds and other vehicles; their tires used to pass 0.3-0.4 m through things). The Armored Rover has a proper cab in the cockpit view (doors, pillars, a dash with gauges, the wheel, seats) in place of loose shards of its body, and its driver and two passengers sit instead of standing up through the roof. The Buggy's four deck riders stand nearer its middle.
- **Our own soft seats, cabinets and appliances** (kit-prop generators, Phase 6 part 5): cushioned chairs, armchairs and two-seat sofas (some with a throw or a cushion), kitchen and TV cabinets, fridges, stoves and washing machines, each in several looks. They replace the Kenney toy pieces at the same size (286 placements on 23 maps, swapped with MapMaker's Replace all). Sofas and cabinets now take rounds as wood, and the fridge, stove and washer as thin metal (they stopped them like concrete; the cabinets like thin metal).
- **MapMaker: Everything breaks.** A map can turn on destruction in Map properties: every solid prop can then be shot apart, not only crates, barrels and the like (natural rocks, walls, floors, terrain and doors stay). Any prop can be marked Unbreakable or given its own Health in its inspector. Broken pieces come back at the next round. No official map uses it yet. A broken piece's debris and sound follow what it is made of. **Breakyard**, a small experimental map, is built for trying it: a walled yard of containers, stone walls, crates and fences that all come apart.
- **New map: The Spillway** (experimental; MAP 02, rebuilt in MapMaker after the owner's review): a 28 m concrete dam across a mountain gorge, the lake behind it and the river running out below, for big team battles (24 v 24). Two stair towers climb the dam's face from the powerhouse terrace to the crest, a hillside stair reaches the east bench, and woods cover the valley's sides. Team Deathmatch, Capture the Flag and King of the Hill; the Military weapon set. Listed under Experimental until the owner promotes it.
- **New vehicle: the Troop Truck** (Meshy Community, CC0), in MapMaker's Vehicles palette: a six-wheeled army truck for six. A driver and a passenger sit in the cab, four ride standing on the flatbed, and every rider shoots their own weapon. Wheeled heavy: a little quicker than the Armored Rover, slower than the Gun Jeep, 700 health; its six tires spin, steer and bounce.
- **Core and experimental maps.** A map's tier is set in MapMaker's Map properties and saved in its file. Experimental maps are listed under their own "Experimental maps" heading and are never Quick Play's pick, the featured map or on the next-map ballot; a host can still put one in a rotation. Every map offered today is core; a new map starts experimental and goes to core only when its quality gates pass (spawn points for its players, budgets, a card shot that isn't a wall; `pnpm quality-gates` adds the navigation audit and a bots-only match). Map format v35.
- **Our own furniture and shop pieces** (kit-prop generators, Phase 6 part 4): tables (one with a runner), desks with a drawer pedestal, side tables, chairs (slatted, ladder-back, cushioned), benches, bookcases and wide cabinets full of books, shop shelving stocked with boxes, bags, tins or bottles, market stalls under striped canopies, market counters and waste bins, each in several looks. They replace the Kenney toy pieces at the same size, so collision is as it was. Desks, benches, bookcases, stalls and counters now take rounds as wood (they stopped them like concrete), and bins as thin metal. All 1,184 placements on 43 maps were swapped with MapMaker's Replace all.
- **Our own fences, walls, barriers and containers** (kit-prop generators, Phase 6 parts 2 and 3): wooden fences (post and rail, boards, pickets), a palisade, a town fence, iron railings (whole and broken), drystone walls (whole and crumbling), concrete road barriers (plain, striped, hazard, worn) and a corrugated shipping container in six paints replace the Kenney pieces. See-through pieces stay see-through: a rail fence collides as its posts and rails, railings as their kerb, posts, rails and bars (the gaps differ a little from the old pieces'). The official maps name them (MapMaker's Replace all: 247 placements on 14 maps), and Replace all now offers a family's other looks.
- **Thrown sheep show again.** The sheep's model was drawn about 7 mm tall (and pure white), so a thrown sheep looked like nothing; it is now its 0.7 m woolly self, and a throwable whose model loads at a size no throwable has keeps its plain shapes instead.
- **The Buggy seats six and has a new model** (Meshy Community, CC0): a sci-fi tube-frame buggy. A driver and a front passenger sit in the cage; four more stand on the open deck behind it, and all five riders shoot their own weapons. Its tires spin, steer and bounce, and the driver's cockpit (wheel, gauges, cage) is refitted to it. Handling, health and the rest unchanged.
- **Four vehicles get new models** (Meshy Community, CC0): the Gun Jeep is a Warthog-style buggy with a pintle gun (its own tires spin, steer and bounce), the Hover Bike a winged one-seater, the Speeder a heavy armoured hover bike and the Armored Rover a closed off-roader. Seats sit on the new models; handling, guns and health are unchanged.
- Throwables: the sheep walks with its own model and walk; the Flare Gun has a real model, and the airstrike marker is fired from it as a fizzing, smoking flare.

- **Painted ground blends.** A painted path or patch fades into the ground beside it instead of ending in hard square edges (Medium and High graphics). Nothing changes underfoot.
- **The team leader's gold marker no longer stays over their body** after they die.
- **MapMaker: Show all levels** is a button at the top of the level list (it was a small checkbox under it), lit when on, and stays as you left it. H still switches it.
- **The official maps name our own crates, drums and cartons** (MapMaker's Replace all: 722 placements on 57 maps). Nothing changes in play: they already drew them.
- **Iron Coast loads again.** Every mode on it fell back to the menu ("local match failed: Maximum call stack size exceeded"): its fine terrain grid has 78,385 heights, more than the browser takes in one call.
- **Roulette: bots have general names.** A bot named after the character it first wore (Biscuit, the cat) kept the name while every life dealt it another look, so the name over the old man read Biscuit.
- **Smoother big matches, step 2.** Characters out of view (and spare bodies) no longer keep their paused animations on the engine's running list, which every animation change had to search; glow colours are set only when they change.
- **Smoother big Roulette matches (St. John's, step 1).** Hidden spare characters no longer pile up (at most 16 kept), a replaced character is cleared away in one pass, and the spawn-shield fade is skipped out of view. More to come.
- Dynamite now wears the Emergency Flare model (Meshy Community CC0): a red stick with a fuse, in hand, in flight and on its pickup. Mechanics unchanged.
- The Sandbags wear the owner's mur de sacs model (Meshy Community CC0), and the deployed wall is drawn from it too. Mechanics unchanged.
- The Holy Bomb now wears a gold orb model (Meshy Community CC0), in hand, in flight and on its pickup. Mechanics unchanged.

**Our own crates, drums and cartons** (kit-prop generators, Phase 6 part 1; owner-approved 2026-11-05):
- **The Kenney toy crates, barrels and cardboard boxes are replaced by ones we generate in code:** board crates in a
  batten frame with a diagonal or X brace, long crates on skids, open cargo bins between tall corner posts, steel-framed
  crates, steel drums with rolled hoops, worn paint and rust (closed, or open with something inside), and taped
  cartons. Each comes in several looks (pine, weathered, dark, military green; red, blue, olive, rusty or yellow drums;
  plain, labelled or cross-taped cartons) and draws lighter versions of itself further away.
- **Every map picks them up by itself**, saved maps and old files too: the old pieces now play and draw as the new
  ones, with the same size, the same cover, the same health when shot apart and the same effect on rounds, so nothing
  about the fight changes. MapMaker's palette offers only the new ones (Crates & Barrels), the prop inspector picks a
  look (Variant), Randomise rolls one, and Replace all suggests the new piece for an old one.
**Fireteams: CTF squad roles, squad points kept when the host leaves** (Fireteams follow-ups, docs/FIRETEAMS_PLAN.md):
- Capture the Flag with Fireteams: with 4 or more squads a side the smallest squad defends its flag (holds by its
  base, returns it when dropped) and the rest attack; with 3 or fewer every squad attacks. A bot-led squad defends rather than
  yours when sizes tie, and your squad does what you order: the role is only its default until you give one.
- Your squad's line on the HUD says its role: "Squad · Attack · Follow me", until you give your squad an order.
- When the host leaves and a friend takes over, every squad keeps its points and every player theirs (they started
  from zero before).
- `pnpm bot-report`: a squad-score line (each squad's points, Best Squad, the MVP) and CTF defence numbers.

**Bots remember, call out, and keep watch like players** (Bot AI Phase D):
- Bots remember where they saw enemies, where shots came from and what teammates called out, and watch and pre-aim
  those spots; a teammate's sighting reaches the bots nearby.
- A bot holding a spot scans its angles one at a time and peeks past cover instead of sweeping back and forth.
- Easy, normal and hard differ in more than aim: reaction (slower when surprised, quicker where they expected you),
  memory, how fast they turn to fire from an unseen shooter, and how often they make the second-best choice.
- Bots use the map's bot hints from MapMaker (sniper and camp spots, staging spots, chokepoints, jump links).
- `?botdebug=1` (offline and when hosting): every bot's route, state, goal, scores and why it stopped, and where routes
  failed.
**Phones: the dark block on lit walls, and a clearer HUD** (owner-picked mobile audit proposals 1, 5, 6, 10 and 12, docs/MOBILE_AUDIT.md):
- **Map lamps on phones:** on Low (a phone's default) lamps glow but no longer light rooms; instead, under a roof the
  sky light rises, easing in over about a second. This removes the lamp mask behind the dark block and halves the cost
  of lamps. On Medium and High a phone keeps the lamps, 4 to a mask layer instead of 8. Each tile's sum then stays
  exact in a lower-precision float target. The mask is sized to the map's lamp count and the device's texture limit,
  so no map can overflow it (the earlier one-lamp-a-layer try put every lamp on Flatpack Depot out).
- **Room lights** (Options → Display, and the pause menu's Settings): on by default. Off, lamps glow but light nothing,
  to check whether the dark block goes with them. Also `?roomlights=0`; `?lampbatch=1` or `?lampbatch=8` try other mask
  layouts, and `?lamps=1` keeps the lamps on Low.
- **Ammo by the fire buttons** on touch: the panel sits above Reload and Throw, clearing the lower centre.
- **Tap the scorebar** on touch to show the scoreboard, and tap again to hide it (before, only the pause menu showed
  scores).
- **Touch text is at least 12 px:** button labels, the mode label, the scorebar's names, the kill feed, the pad's
  "hold: crouch" (about 6.5 px before) and Match Setup's mode tiles, variants, size chips and field names.
- **The kill feed keeps 3 lines** on a phone sideways (5 elsewhere), so it never reaches the Weapons button or the ammo.
- Desktop looks the same.

**Community maps: save as many maps as you like, host them, and Community Picks** (owner-approved plan, docs/COMMUNITY_MAPS.md):
- **Unlimited local saving:** MapMaker's saved maps live in your browser's IndexedDB (as many as your disk allows; a
  few MB of localStorage held about 15 before). Maps you saved before move over by themselves. Open… adds
  **Duplicate** and **Rename** beside Delete; Export and Import move maps between browsers as files.
- **Host your own map:** your saved maps are in Match setup under **Your maps**. Host one online and the game browser
  lists it as a **Community map**, with its name and its creator (the signed-in player who first shared it, ✓). The
  game browser has a map filter: All maps, Our maps, Community maps.
- **Community Picks:** the hub counts plays of each map version (signed-in players only, each once; no bots, not the
  creator's own plays, one match an hour from each host). A map with 25+ players from 5+ hosts over 3+ days, under 30 %
  early quits and under 3 reports per 100 players, that passes the hub's own check (it loads and validates, spawns
  reachable, no logic loops), becomes a Community Pick: the hub keeps its file, and it has its own tab in the map
  list, playable while its creator is offline.
- **Safety:** a word filter on listing names, map names and a map's own text; a **Report** button on every community
  map (signed in); a map hides itself past a report threshold until the owner looks. Creators withdraw their own maps
  from Profile → Community maps.
- **For the owner:** Profile → Community maps shows the week's summary (new picks, hidden maps, the most played) with
  **Make Official** (published as an official map), **Take down** and **Restore**; also
  `GET /api/v1/community/summary?format=text` and `pnpm --filter @tiletrigger/server community-summary` on the box.

**Bots walk round parked vehicles** (Bot AI Phase C, part 3):
- **Bots on foot no longer walk into parked vehicles, wrecks and turrets.** These aren't part of the map bots plan
  their routes on, so a bot walked into a parked jeep or a landed dropship until it gave up and stepped aside, six
  seconds or more. Now it goes round by the nearer end, keeping clear of walls the vehicle is parked against. On the
  vehicle maps, stuck moments by a parked vehicle fell by a fifth, and long stands (10 s or more) almost halved.
- **Bots taking a side way to an objective keep to it further.** A bot sent the left or right way now follows one of
  the map's own side routes, where there is one on that side, instead of re-joining the main way halfway.
**Fireteams, part 3: squad scores, the squad MVP and a party preset** (owner-approved, 2026-11-10):
- **Squad scores:** a kill 10, an assist 5, an objective 30 (captures, plants, defuses, rescues, zones), and a point a
  second on the hill in King of the Hill. The scoreboard groups each team by squad (your squad first) with each
  squad's points and a Pts column.
- **Squad MVP:** at the end of the match, Best Squad and your squad's MVP join the awards, and every squad's MVP is
  named on its line of the scoreboard, above the vote on the next map.
- **Fireteams party preset:** one click in Match setup for Team Deathmatch with Fireteams, squads sized to the map's
  teams; on a map too small for squads it moves to one that suits. Friends who follow your invite link land on your
  side and each lead a squad.

**Phones: bulky guns sit lower, Character Select shows your characters, a tidier HUD** (owner's mobile audit, 2026-11-09)
- **First-person guns**: the big sci-fi guns (Flak Cannon, Laser Rifle, Singularity Cannon, Blast Rockets, Guided
  Rocket, Swarm Launcher, Oil Slicker, Grenade Launcher) sit lower in your hands; none covers more than about a tenth
  of the screen (the Flak Cannon 14 % → 10 %).
- **Character Select on a phone held sideways**: the info strip is half as tall, so you see two rows of characters
  with their names (one cut-off row before; none on smaller phones).
- **HUD on narrow phones**: the kill feed no longer runs over the score bar, "Weapons" fits its button, and your
  health stays clear of the move pad.
- **Pause menu on a phone**: no keyboard keys shown on its buttons.
- The audit and what's next for phones: docs/MOBILE_AUDIT.md.

**MapMaker: a first-time tour** (MapMaker overhaul Phase 6): the first visit walks you through a tiny map with the real
tools: place a room, a spawn and a pickup, then play it. Each step moves on when you do it; Skip or Esc ends it, and it
won't show again. Take it again from the tool bar's Help button or the `?` key list.

**Bot vehicle routing and getting out by a wall** (bugs found on Whiteout Station and Riot Junction):
- **Bots no longer drive vehicles into doorways they only fit square on.** A bot checked the route for a vehicle's
  width only every 2 m, so a door a little wider than the vehicle passed, and the vehicle stalled in it (Whiteout
  Station's Snow Sleds in the hangar's doors). Bots now sweep the vehicle's whole footprint along the route, turning
  with it at corners. A route it doesn't fit through is kept off, or the bot goes on foot. On the old Whiteout layout
  (sleds on the garage apron, King of the Hill, seeds 1-4) sled stalls fell from 10 to 0.
- **Getting out of a vehicle parked against a wall puts you on your side of it.** The step-out spot was checked only
  for headroom, so beside Riot Junction's east wall a Buggy put its rider beyond the wall. The rider fell 4 m under the
  street and couldn't get out. The spot now needs nothing solid between it and the vehicle and ground under it (else
  the next side, or the roof).
**Map line-up** (owner, 2026-11-09):
- **Six maps retired:** Fogbound, Bottling Plant, Dune Harbor, No Man's Field, Overhang and Starhaven are gone from
  the game (menus, Quick Play, the map vote, rotations). In the rotations Pump Tower and Razor Edge take their places
  in Deathmatch Classics, Midnight Keel and Runway Nine in Objective Mix (Bomb), Market Town in Flag Run.
- **Three maps renamed:** Iron Tide is now **Midnight Keel**, Ironhold Prison **Cormorant Isle** and Jungle Steps
  **Cradle of Idols** (same maps, same places).
- **Iron Maw** is for 16-64 players (was 16-32).
**MapMaker: modes, folding panels and an outliner** (MapMaker overhaul Phase 2):
- **Seven mode tabs:** Build, Props, Gameplay, Logic, Environment, Paths and Test, each with its own palette tabs and its
  own part of the side panel. Roads, the track and the drop routes have their own Paths mode; Test gathers Play test,
  Play from here, the bot test and the plan view.
- **An outliner:** everything in the map in one list, searchable, grouped by kind and level. Click to select and frame;
  hide or lock things while you work (MapMaker only, kept per map in your browser, never in the map). Quick with 4,096
  things.
- **Folding panels:** the Outliner, Inspector and Validation fold from their headings and stay as you left them.
- **Favourites and recent follow the mode:** the mode's own pieces first, or only them.
- Under the hood, MapMaker's 6,500-line controller is split into 16 modules, with no change in behaviour.

**Iron Coast, part 3: natural cliffs and banks, the beach goes on** (owner, 2026-11-08/09; all in MapMaker)
- **Finer ground**: the terrain is on a 1.25 m grid (Terrain → Change grid, Smooth), so slopes are drawn smoothly.
- **The cliff** leans back over 6-10 m of rock with a rounded lip and scree at its foot along the stretches clear of
  the stairs, casemates and cave; it is still too steep to climb, so the seven ways up are still the only ones.
- **No more sheer drops inland**: the bank behind the crest (12 m to 16 m, beside the trenches and bunkers), the bank
  by the east bunker, the west plateau's banks, the knoll's west side and the grand stair's plaza walls are grassy
  slopes you can walk.
- **The coast carries on**: east and west, the sand and shallows run on past the edge of the map with low headlands
  and dunes, the woods only inland; the playable area is the same.
- **Balance**: the beach's two zones take 45 s to capture (were 20): in bot matches the beach now falls in 84-109 s
  (was 52-69 s at 16 v 16 and 56-83 s at 24 v 24).
**Far characters** (`wip/far-copies`):
- Far-off characters are drawn in the same pose as up close: 74 characters' low-detail copies moved onto their body's
  skeleton (Hyena Warrior was drawn 15-30% short at a distance, Honest Abe 15%).
- Far characters' hands stay on their guns: a far character's first animation step drew its hands 10-25 cm off the
  gun until the next one.
**Gunplay pass 3: the network check and bots' weapon ranges** (owner-approved audit candidates 7 and 8):
- **Fewer snap-backs and lost shots on a lossy connection.** When a packet was lost and resent, the inputs behind it
  reached the host together, and the host dropped the oldest past 16. You snapped back (up to 1.4 m) and rounds you
  saw leave were never fired. The host now holds 32 inputs. At 150 ms and 5 % loss, snap-backs fell from 2.7 to 0.3
  a minute; at 250 ms, inputs dropped fell from 717 to 7 in 25 s.
- **Bots draw the gun that wins at the distance, as measured.** Which gun a bot holds now comes from each gun's time
  to kill measured in the game's own simulation (`pnpm gun-report`), not a hand-set range. A shotgun comes out at arm's
  length, a Precision Rifle far off, and bots' hit rates rose for most guns. How far bots stand is unchanged.
- **`pnpm net-report`** (for developers): a real host with 8 players over links with latency, jitter and packet loss.
  It measures hit registration, lag-compensation error, time to the hit marker, rubber-banding and bandwidth
  (docs/GUNPLAY_AUDIT.md, "G3").
- **`pnpm bot-report`** lists each weapon's rounds, hit rate and hit distance, and how evenly bots use their guns.
**MapMaker fixes** (the owner's answers, 2026-11-09, and bugs found building The Spillway):
- **Paste into a map of another theme:** the pieces take the new map's theme and keep their own paint; the toast says
  so.
- **Mirror half the map** brings its bot hints, and team hints (a staging spot, a camp) swap sides like spawns. A new
  **Terrain and paths too** box mirrors the terrain (heights, ground paint and plant cover) and copies the paths on
  that half.
- **Plants on a fine terrain grid** (finer than 2 m, Terrain → Change grid) grow as many to the square metre as a
  2.5 m grid.
- **The Scatter Brush sets are retired** (Pine forest, Leafy woods and the rest): the Environment brush and its
  presets replace them, and N now takes up the Environment brush. Plants already placed stay as they are.
- **The bot test runs up to 64 bots.**
- **The inspector keeps the first edit after a placement** (it was lost when the inspector redrew a frame later), and
  a field you are typing in survives any redraw.
- **Stairs from the ground:** the ground at the foot of a flight (or any step) comes up to just under its first step,
  worked out as the map loads and in MapMaker (the map file keeps its own ground), so bots and players climb it as a
  step, not a 0.4 m lip. Bot test (Sunken Kingdom, Glacier Line and Fogbound, TDM, 2 seeds of 120 s): stuck recoveries
  42 → 25 a match (Glacier Line 75 → 27).
- **Cut ground to floors** (the selection menu): lowers the ground under the selected floors however deep, one undo
  step, for a tunnel's cut or a sunken yard. The automatic lowering still stops 3 m above a floor (deeper, it would
  open Sandfall's hypogeum rooms and the tops of flights cut into terraces on shipped maps; docs/BUILDING_KIT.md).
- **The top bar** fits Export, Import and Publish again at 1400 px.

**Time of day and weather** (MapMaker overhaul Phase 5; map format v34):
- **Time of day:** Map properties → Time of day sets the hour (a slider, or Dawn, Morning, Noon, Afternoon, Dusk,
  Night). The sun crosses the sky (east at dawn, high in the south at noon, west at dusk; the moon by night), and its
  light, the haze and the sky picture blend between the sky presets: night, dusk, sunrise, the map's own sky by day,
  sunset. The slider previews live; the time is fixed for the match. Maps without a time look exactly as before.
- **Weather:** rain or snow (how hard), wind and fog banks, with rain and wind sounds (our own synthesiser). Fog is
  its one effect on play: everyone sees less far. Under a roof the rain fades out and is heard on it. Low graphics
  (phones) draw no rain or snow, only the fog. No lightning, nothing that flashes; the flicker check has heavy rain
  and a blizzard at night among its moments.
- **The host may play another weather** (Match setup's Advanced rules, the pause menu's Host tab: Clear, Rain, Heavy
  rain, Snow, Blizzard, Fog); from the Host tab it plays from the next match.
- MapMaker: the boulder and cliff face species show their pictures in the palette, not text cards.

**Whiteout Station, the owner's follow-ups** (2026-11-09, in MapMaker): King of the Hill on three hills (the yard, the
radar ridge and the ice cave); three snow sleds to drive at the south road's west end (the two
parked snowmobiles on the garage apron are gone); Tide's spawns a cell nearer the yard, so Team Deathmatch comes out even.

**Fireteams, part 2** (owner-approved 2026-11-08):
- **Bot squads play the objective first.** A bot-led squad goes for the flag, the hill or the bomb site together, on
  one route and push of the team's plan, rather than trailing its leader; when its leader falls, the next best member
  leads on, and whoever carries the flag leads the squad home. Kills are back to the variant-off levels in Team
  Deathmatch and the hill is held as long; CTF captures are partly back (docs/FIRETEAMS_PLAN.md, "Part 2").
- **Your squad forms up round you:** single file through corridors and doorways, a wedge, spread out on open ground;
  Hold here, Go there and Defend the objective put them on a ring round the place.
- **Spread out / Stay tight** on the order wheel (its seventh entry).
- **Bounding:** in a fight on the move, half the squad covers (firing where the enemy ducked) while the other half
  moves up cover to cover.
- **The squad HUD:** your squadmates' portraits with their health and the squad's order, your squad on the minimap
  (and where you sent it), and your squad's orange marker over their heads. On a phone it sits beside your health.
**MapMaker follow-ups** (the owner's answers, 2026-11-08):
- **The measure tool's jump hint looks at the ground along the line**, not only at its two ends: a slope you can walk
  up reads walkable, a ledge reads a step (with its height), and a pit you couldn't climb out of reads a gap (with its
  width, jumpable or too far). A ditch you can climb out of is a drop and a step.
- **Nothing is placed over nothing:** spawns, pickups, props, vehicles and NPCs with no floor, ground or water under
  them are refused; the ghost goes red and says why, and the click does nothing. Spawns, pickups, vehicles and NPCs
  outside the playable boundary are refused the same way. Props outside it are scenery, as before.
- **The budget bar sits in the bottom status bar**, compact: its colour, its word and the budget it names; the name
  still selects what it counts and the arrow still lists every budget.

**MapMaker: bot hints** (map format v33; MapMaker overhaul Phase 4 item 3, Bot AI Phase D item 5): mark chokepoints,
sniper, camp and staging spots and jump links for bots (the Bot hints tool, Y; the Entities tab). Pins with their
radius, facing and jump arcs in the 3D view and the plan view, edited in the inspector, one undo step each; warnings for
a hint outside the boundary or off the navmesh, a jump a player couldn't make and duplicates. "What bots know" shows
the bots' own computed spots (vantage spots, parkour links), read-only. Bots don't use the hints yet (the data is
documented in docs/BOTS.md, "Bot hints (map data)").

**MapMaker: a bot test run and spawn exposure** (MapMaker overhaul Phase 4, items 1 and 2):
- **Bot test** in the top bar opens the Test panel. **Run bots** plays a bot match on the map you're editing in the
  background (pick the mode, bots a team or in all, and 30 seconds to 5 minutes), with progress and Cancel; you can
  keep building meanwhile.
- **Afterwards, heatmaps** over the map, in 3D and in the plan view, each on its own switch: where bots went, where
  they got stuck, where they died and where their routes failed. A short summary says the kills, stuck recoveries,
  failed route searches and when the objective's moments first happened.
- **Check spawns** labels every spawn with how much of the map can see it and from how far, draws its longest lines
  of sight and the map's long sightlines (50 m and more), and warns about spawns half the map can see in the list of
  problems (until the map changes).
- Nothing is saved in the map.

**MapMaker says track / NPC traffic:** the Race Track card, the Paths pane, the key list (Shift+G) and the Vehicles
  tab call it the track (NPC traffic). The track's pane keeps its NPC cars, their vehicle, the curbs, where the cars
  start and the pit lane, and no longer shows Laps, Start grid, Vehicle or Combat (nothing reads them now). Map
  properties no longer offers Race as a mode, and a map that still lists it gets a **Drop Race** button (undo brings
  it back); picking a main mode drops it too.

**MapMaker: paint our trees and plants (Environment Phase 3):**
- **The Nature tab opens on Environment:** our species by Trees, Plants, Ground cover, Rocks, Boulders and Cliffs.
  Click one to place it like a prop (it lands on what's under the pointer, R turns it, Randomise varies it).
- **The Environment brush** paints or erases a mix in strokes (one undo step each): Temperate, Jungle, Alpine and
  Arid presets (mix any species you like), density, brush size, seed (the same seed repaints the same plants), size
  and turn variation, a weight and variant per species, and where it grows: slope, height and ground material, never
  inside buildings.
- **Keeps play clear:** trees, boulders, cliffs, hedges and the bushes you hide in stay off spawns, routes,
  objectives, vehicles and pickups unless you say otherwise; placing one there by hand asks first. **Show what
  blocks** draws what stops movement, shots and sight.
- The brush stops at the map's environment budget, and painted plants export and import exactly as placed.

**Fireteams, part 2** (owner-approved 2026-11-08):
- **Bot squads play the objective first.** A bot-led squad goes for the flag, the hill or the bomb site together, on
  one route and push of the team's plan, rather than trailing its leader; when its leader falls, the next best member
  leads on, and whoever carries the flag leads the squad home. Kills are back to the variant-off levels in Team
  Deathmatch and the hill is held as long; CTF captures are partly back (docs/FIRETEAMS_PLAN.md, "Part 2").
- **Your squad forms up round you:** single file through corridors and doorways, a wedge, spread out on open ground;
  Hold here, Go there and Defend the objective put them on a ring round the place.
- **Spread out / Stay tight** on the order wheel (its seventh entry).
- **Bounding:** in a fight on the move, half the squad covers (firing where the enemy ducked) while the other half
  moves up cover to cover.
- **The squad HUD:** your squadmates' portraits with their health and the squad's order, your squad on the minimap
  (and where you sent it), and your squad's orange marker over their heads. On a phone it sits beside your health.
**Set pieces, part 6: swapping the old big pieces** (docs/SET_PIECES_PLAN.md, "As built: part 6"):
- **Replace all with a set piece…** in every tile's inspector in MapMaker: every placement of a tile becomes a set piece
  where it stands, one undo step.
- **Town Wall Gatehouse**, a new set piece: Market Town's gate is now one (the walks through its guard room, its roof up
  a ladder).
- **Bunker**, a new set piece the size of the Bunker tile: Iron Maw and Shingle Point's bunkers are now Bunkers, their
  warehouses Loading Docks; Neon Spire, Riot Junction and Underdrain's 4 × 4 crossroads are the Crossroads Plaza.
- **City Wall Gatehouse** and **Temple Pylon**, new set pieces: Qasr Medina's gate is now the gatehouse, Pharaoh's
  Reach and Sunken Kingdom's pylons the Temple Pylon set piece; Blackout and Crossroads' warehouses are Loading Docks,
  their bunkers Bunkers.
- Shingle Point's card picture is taken from a few metres further back, so the cliff-top buildings show.

**Sandfall Colosseum, rebuilt** (the owner's Flavius Rule board, built in MapMaker; docs/map-briefs/sandfall_colosseum/):
- **The arena** is the board at 4 m a square: 52 m of sand (7 × 7 cells) with its twelve pillars, five medallions
  (King of the Hill's hills), four hatches down to the hypogeum and the beast pit's spikes and fire jets in the middle.
- **The stands** rise seven storeys on all four sides (28 bays of podium, two upper tiers with vomitoria, the
  arcaded facade and the attic walk at 28 m); the **emperor's box** is back at the centre of the north side, facing
  the main entrance; **gates 1-4** at the corners; a stair tower in each corner court climbs to the top.
- **The hypogeum** runs round under the podium: hatch halls, beast cages north, south and east, the gladiators'
  cells west, and stairs up into the corner courts and out to the village on all four sides.
- **The Roman village** round it: sixteen insulae and the main square (triumphal arch, forum, temple, colonnades)
  leading north to the arena; a volcano smokes far off behind the emperor's box.
- Team Deathmatch, Capture the Flag (gates 3/4 against gates 1/2) and King of the Hill; 12 v 12; the Medieval set.

**Sandfall Colosseum, the owner's follow-ups** (2026-11-09, in MapMaker):
- **Lighter to load:** the arcades under the tiers (all four sides; the gate passages kept) and the east and west
  stands' outer arcades are gone, solid limestone in their place: 31,724 collision boxes → 22,240. From the sand
  it looks the same: the podium, the tiers, the vomitoria and the attic walk are all there.
- **The portcullis gates are back:** each of gates 1-4 has a portcullis in its opening onto the sand, worked by a
  winch in the passage and a chain on the sand (press either to raise or drop it, with the buzzer). They start raised.
- **Deathmatch** is offered again, beside Team Deathmatch, Capture the Flag and King of the Hill.
- The vaulted tunnels at the four ways out have side walls (below), so the ground beside them meets masonry.
- The hatch ladders now let you off onto the sand at the top (they let you off over the open hatch, and bots fell
  back in): bots no longer queue at them.

**MapMaker: tunnels with side walls.** Select a Vaulted Tunnel (or its Bend, Junction or Crossing; one or several) and
tick **Side walls** in the inspector's Options: its masonry rises to a kerb at ground level and the ground round it
stays up there, instead of banking down to the passage as earth. One undo step; paint and walls are kept.

**Backdrop: Hills and a volcano** (Map properties → Environment → Sky → Scenery): dry hills round the map and a lone
volcano far to the north, a steady ember glow in its crater and a still plume of smoke. Nothing in it moves or
flickers, so it is the same with Reduce flashing on.

**MapMaker:** exploding or deleting the last placement of a map's own set piece (one saved from a selection) takes its
definition out of the map too; it stays in your library, and one undo brings both back.

**Whiteout Station rebuilt (MAP 03 Frostbite Station, made in MapMaker)**:
- A compact arctic research station in a snowbound hollow, for 8-16 players: an offset central yard with a tunnel
  under it, the two-storey main lab and its server vault, a two-storey lab wing round a glowing core, the comms
  annex under its mast, the snow vehicle garage, the fuel tanks, the radar shelter up on its ridge (the long look over
  the station) and an ice cave in the rocks; three outdoor flanks and a sunken service trench.
- Deathmatch and Team Deathmatch (Elimination with it); the old map's flags and hills are gone. Military weapons.

**Tests**:
- The e2e `teams` flow's friendly fire and team kill checks no longer fail at random: every bot holds fire while your
  rounds are tested, the teammate's spawn shield is cleared, and its damage is counted by who dealt it.
**Small fixes (owner, 2026-11-08)**:
- Bots no longer queue 10-20 s for Fernwood Moon's north rope lift: they hop down off the north deck onto its ramp
  when the lift is away (the navmesh had lost that 0.7 m hop).
- The armour pickup's sparkle, armour breaking, heavy hits and kill-streak bursts read across a room: seen from
  further than 3 m they keep the size they have 3 m off (an armour pickup 7 m off was a speck).
- The tutorial shows no Deathmatch score bar (You / Leader).
- capture-map-shots can write pictures outside the build (SHOT_OUT, SHOT_SUFFIX, SHOT_QUALITY, SHOT_TEST,
  SHOT_RENDERED).
**Race mode removed** (owner, 2026-11-08: "steer away from racing and focus on battles and maps"):
- **No more Race** in Match Setup, Quick Play, the next-map vote, rotations, playlists, the host panel or the server
  rules (`laps`, `racevehicle`, `racecombat` are gone). The race HUD (lap, place, running order, countdown), the race
  scoring and the start grid are gone too.
- **Tracks stay, as map spice:** a map's track still carries its NPC cars in every mode. On Apex Ring twelve karts lap
  the Grand Prix circuit while the teams fight; they run anyone over and can be shot up or taken over, as before.
  Roads still grip better on a track map.
- **Old maps** that list Race load and simply don't offer it; MapMaker's checks say to drop it from the modes. The map
  format is unchanged.
- **Apex Ring** and **Sandsweep Circuit** no longer list Race (MapMaker, Map properties): Apex Ring plays Deathmatch,
  Team Deathmatch, CTF and King of the Hill with its karts lapping; Sandsweep plays Deathmatch.
**MapMaker: a finer terrain grid, Change grid, and the coast border** (map format v32; the editor half of the Iron
Coast job):
- **A finer grid:** a terrain can be up to 321 vertices a side (was 161), so a 380 m map can be 1.25 m apart. New
  terrains are made as before; finer is a choice. The map file writes the terrain a grid row to a line (a 1.25 m
  Iron Coast is 1.1 MB, where one value a line it would have been over the 2 MB budget).
- **Terrain → Change grid…:** resample the terrain finer or coarser (1-4 m), heights, ground paint and plants, one
  undo step, with a preview of the vertices, triangles and file size against the budget first. Heights where the
  grids meet are kept exactly; Smooth curves rolling ground between them and keeps cliffs sharp, Exact keeps the
  surface as it is.
- **Coast border side** (Sky → Border → Per side): for a side a shoreline runs out through. Sand and shallow water
  carry on past the boundary along the shore, cliffs ease to low headlands and dunes, forest grows only inland.
  Scenery only: nothing to bump into.
**Parties and the next-map vote, part 2** (owner-approved follow-ups, 2026-11-08):
- **Host handoff keeps the party together:** when a browser host leaves and a friend takes over, everyone keeps their
  party and side, and a vote on the next map that was open goes on with the new host (the same maps, votes and time
  left; one that had just closed keeps its winner).
- **Free-for-all parties:** friends who came together see each other's names in a friendly colour (kill feed,
  messages, scoreboard) with the ally marker over their heads, and tend to spawn near each other (never at the cost of
  a safe spawn). They can still shoot each other: damage and scoring are unchanged.
- **The /host page** gets "Vote on the next map" and every Match setup rule (score, time, respawn, friendly fire,
  weapon set, teams and the rest under More rules), each tagged with when it applies. Stopped, they go with Start;
  running, a change reaches the match at once. The Host Service launcher's Rotation card gets the vote box too, and
  the console `rotation vote on|off`.
- **The menu's first download** is 32 kB smaller (746 → 714 kB gzip): the hit-shape table loads with the match, not
  the menu. The budget goes back to 800 kB.

**Set pieces, part 5: the brainstorm list, retired tiles, MAP 21's sea wall** (docs/SET_PIECES_PLAN.md, "As built: part 5"):
- **Twelve new set pieces** in MapMaker's Set pieces tab, each in its own group: Power Core Hall, Catwalk Bridge (three
  lengths), Twin-Stair Overlook, Atrium Tower, Loading Dock, Sunken Arena, Reactor Room, Bunker Cluster, Courtyard
  Gate, Server Vault, Crossroads Plaza and Ramp Junction, themed by the looks they suit. New kit tiles: Arena Pit,
  Arena Tiers and Arena Tiers (Corner) (a pit 2 m down that carves the terrain).
- **Retired tiles:** the Catwalk Gantry leaves the Tiles tab for the Catwalk Bridge (Up). Maps that place it still
  load and play it as the bridge; its inspector in MapMaker offers **Replace all** (one undo step).
- **Sea Wall** and **Sea Wall (Breached)** for MAP 21 (Iron Coast): a bay of concrete sea wall with a wave lip and a
  fire step, and the same bay blown open with a rubble ramp through the gap.
**Our own trees, bushes and hedges everywhere; no more Kenney foliage** (Environment Phase 2, owner-approved
2026-11-08: "I don't want to see those"):
- **Nine new generated species**, grounded and natural rather than toy-like: Field Maple (summer, autumn), Umbrella
  Acacia (green, dry), Spruce (summer, snow), Coconut Palm and Leaning Palm (green, dry), Saguaro (green, dry), Laurel
  Bush (green, dry), Privet Hedge and Yew Hedge. Each has levels of detail and a far stand-in, sways in the wind, and
  plays like the piece it replaces: trunks, palms and cacti stop people and rounds, hedges are solid walls of cover,
  bushes hide you as before.
- **34 maps moved over** in MapMaker with Replace all: 1,482 Kenney trees, bushes, hedges and cacti (Norman Shores 267,
  Primeval Park 209, St Johns 136, Eagle Spires 126, Backwoods 92 and 29 more). Fernwood Moon: one pine moved off a
  spawn its trunk now reached.
- **The forest border and the scenery** past every map are our trees too (they were Quaternius models and low-poly
  cones): undergrowth, a wall of pines, spruces, oaks and maples (snowy pines on snow, palms, acacias and saguaros on
  sand), and the far forest round the map.
- **MapMaker:** Nature → Trees offers our oak, maple, acacia, pines, spruce, palms and saguaro; Plants & Flowers the
  laurel and the hedges. Every Kenney tree, bush, hedge, cactus and plant is retired from the palette (maps that place
  them still load them), and Replace all suggests each one's species. The scatter brushes plant our species.
- **Drawn faster:** in matches, our species are drawn in batches with levels of detail by default (`?env=0` turns that
  off).

**Gunplay pass 2** (docs/GUNPLAY_AUDIT.md, "Pass 2"; the audit's candidates 1-6, owner-approved):
- **Every gun owns its range.** The SMG wins up close (0.40 s to a kill to 15 m, the Assault Rifle 0.50; hip fire at
  25 m 0.77 s, was 3.4); the Assault Rifle owns 20-50 m and loses damage from 25 m; the Precision Rifle kills a body in two shots in under a second at every range (was 1.25-1.38 s) and owns
  100 m and beyond; the Marksman is the mid-range one (three rounds to 60 m, 200 rpm); the Pulse Pistol's beam now
  fades past 15 m.
- **Shotguns kill across a room:** the pump gun's shell kills to 9 m (was 5), the Sawed-Off's two barrels to 9 m, the
  Auto Shotgun in three shells at 10 m (was eight).
- **Reloads:** auto-reload (Options → Controls, on by default): an empty magazine reloads by itself; a quick melee
  breaks a reload on your screen too (it already did in the match); the Spin Gun comes up 0.3 s quicker.
- **New HUD options** (Options → HUD, off by default): **damage numbers** over what you hit (gold for the head, cyan
  through armour, on the Training Range's boards what that round would do to a body) and a **spray pattern** panel
  that plots your last burst and how long your aim took to settle.
- **New weapon: the Battle Rifle** (slot 3): heavy, accurate, 300 rounds a minute, 20 to a magazine; four rounds kill
  to 40 m, two to the head anywhere, and it climbs hard held down. In the Military set, as a pickup, and on the
  Training Range's front rack.
**MapMaker: groups, copy and paste, templates, mirror, note pins** (MapMaker overhaul Phase 3, items 3-7):
- **Groups** (Ctrl+G, or the inspector's Group): keep things together. A click on any of a group picks it all (Alt-click
  just that one), so it moves, turns, mirrors (M flips it east ↔ west over its middle), duplicates and deletes as
  one; a duplicate is a group of its own. Name it in the inspector; Ctrl+Shift+G ungroups. Groups belong to their map.
- **Copy and paste between maps** (Ctrl+C, Ctrl+V; the right-click menu): the copy is kept in this browser and pasted
  with new ids where the pointer is, on the level being edited, in this map or another one (its groups and its own
  set pieces come too). A map on another grid or in another theme refuses it, saying why.
- **Templates:** New map → start from a layout: Arena, Symmetric CTF, Assault (Breakthrough) or Open terrain. Each
  becomes a map of your own; the layouts never show in map lists.
- **Mirror…** (Shift+M, the inspector, the right-click menu): the selection or half the map, across an east–west or
  north–south line or through a point, as one undo step. In a mirrored copy, team things swap sides: spawns, flag
  bases, team-only zones, doors and buttons, team vehicles. Tiles mirror as their own mirror image (a corridor's cover
  goes to the other side, stairs climb the other way); a tile that has none is refused across a line, saying which.
- **Note pins** (J, or Map properties → Pin a note): notes for the map's makers pinned on the map. Click to pin one, click a
  pin to edit or delete it, drag it to move it; Map properties lists them all. They show in MapMaker only, never in
  play. Groups and notes are stored in the map (format v31; older maps load as they were).
**Maps: no more spots you can't get out of** (owner's "Fix all", 2026-11-08; all in MapMaker):
- Skyward: the two spawn points on the one-way gun towers are on the central deck now.
- Sky Islands: a jump pad on the sky platform drops you back onto the west arm.
- Grand Marquee: a gap at the back of each side panel on the marquee top; drop down to the street.
- Obsidian Orb: the reactor shaft is bottomless again (the core isn't solid, its floor is gone): a fall is a fall, not
  a pit. The glowing trims along the shaft walls are gone, so nothing lands on a ledge.
- Reactor: railings beside the roof's stair head and along the stairs' open side; no more drop into the outer yard.
- Serpent Gorge: climbing vines up from the gorge floor beside the river.
- Erosion: the corner pad pillars meet the lower deck along an edge, so bots walk onto them too.
- Outpost Siege: a smaller dais in the uplink room and the north room's low cover set back from the walls; bots get
  round to the armour and the north rooms.
- Iron Compound: the gantry MG turret sits in the gantry's end corner, out of the walkway.
**Friends stay with the party after a vote**: a friend in your hosted game follows you to the next map (the vote's
winner, the rotation, Change map) until your match there lets them in, instead of giving up after one early try while
your browser was still loading it.

**Flaky e2e checks fixed at the cause** (tests only): mobile (bots knocking the player into the air before the jump
tap), physicsfx (bodies dropped and blasts set off by cover, a race with bots respawning, range bots in front of the glass), characters3 (a weapon key pressed while only the view
lagged) and weaponsets (a respawn picking up last life's dropped gun).
**Team kills show as team kills, and reward nothing** (owner's bug report, 2026-11-08: "Teamkills should not count
towards a kill streak (should end one) or show anything rewarding. It should actually show in the upper right that it
was a TK."):
- **The kill feed marks it.** With friendly fire on, downing a teammate shows in the kill feed (upper right) with a
  **TK** tag and a warning-yellow edge, for everyone who sees the feed.
- **Nothing rewarding.** No kill or points for you or your side, no kill marker or kill-confirm sound, no multi-kill
  call, no headshot mark, no "kills in a row" or streak burst, no streak reward (UAV and the rest), no revenge or
  nemesis callout, nothing toward the end-of-match awards (Longest Streak, Nemesis, Most Revenge), no Roulette credit
  (bonuses, rerolls, kills toward a streak pick) and no mode credit. It still counts as your teammate's death.
- **It ends your streak.** A team kill sets your kill streak back to nothing (and Roulette's kills toward a streak pick).
- **Every way it can happen:** rounds, rocket and other blasts, grenades, running a teammate over, turrets, burns and
  a barrel you set off; by players and bots; in every team mode. Running a teammate over now needs friendly fire on and
  then hurts like any other friendly fire (it never did before). Your own deaths are unchanged.

**Breakthrough Range is a test map again** (owner, 2026-11-08): hidden from every list (Play, Match setup, Quick
Play, rotations, the host's picker, the vote). Breakthrough is played on Iron Coast.

**MapMaker: Play from here, the plan view, the card shot** (MapMaker overhaul Phase 3, items 1, 2 and 8):
- **Play from here** (Shift+F5, or ▶ Here beside PLAY TEST): a test match with you standing on the floor or ground
  below the camera, facing where it looks (the nearest spot with room to stand, within 4 m). Where there's nowhere to
  stand (nothing below, no room, too steep, outside the boundary) it says why instead. Esc (or the pause menu's Back to
  MapMaker) brings you back to the same view, with the selection and undo as they were.
- **The plan view** (K, or Plan in the top bar): the level being edited from straight above, cut a little above its
  floor so rooms show inside, with the tiles outlined (the level below faint) and icons for spawns (in their team's
  colour), objectives, flags, hills and pickups. The level selector picks the level; select and move things as usual;
  the wheel zooms, a right drag or WASD pans, Home fits the map. **Export PNG** saves the plan with a key.
- **The card shot** (Map properties → Card shot): set the menu card's shot from the view, at eye level (1.7 m over the
  ground or floor under the camera) unless you untick it, seen through the card's own 16:9 frame and lens; Preview
  shows it again. It is stored in the map as a camera (map format v30, `metadata.cardCamera`; older maps load as they
  were), and the card picture is rendered from it by the capture tool.
**Fixes**
- Debris from a vehicle or turret blowing up no longer falls through the ground: its chunks start above it, and any
  that get under the world anyway are cleared away.

**Bots:** large bots crouch through a short low roof (a dugout's stair top, a low doorway) when the way round is long,
and go round a long one (docs/BOT_AI_PLAN.md, "The moderate price"; in 0.9.0 they went round however far). Measured on
48 CTF matches and a Team Deathmatch sample: the same stuck recoveries and captures; Diamond Park's large bots crouch
through its dugout steps, about 10 s a match.

**MapMaker: feedback while building** (MapMaker overhaul Phase 1, part A; docs/MAPMAKER_OVERHAUL_PLAN.md):
- **The ghost says why.** Beside the pointer, before you click, a refused tile or set piece says why in a few words
  ("Overlaps the Corridor on Ground", "Past the build limit (16 levels up or down)"; the status line has the whole
  reason). Spawns, pickups, props, vehicles and NPCs over nothing say "No floor under it", outside the boundary say so,
  and the scenery zone is a note ("Outside the playable area: scenery zone"), never a refusal.
- **A live budget bar** beside the level strip: green **OK**, amber **Near** (80 %), red **Over**, naming the budget
  nearest its limit (entities, props, prop models, a draw estimate, lights, destructibles, vehicles, the environment
  species budgets, the file's size). Click the name to select what it counts; the arrow lists every budget. Counted
  from each edit, not a full check every frame.
- **`?` lists every key** MapMaker binds, grouped (also the tool bar's **Keys** button); Esc or `?` closes it. The
  keys, the fly camera and the list all come from one table, so it can't go stale. `/` still searches the palette.

- **You in the driver's seat** (owner's bug report, 2026-11-08). In a vehicle's chase view your own character now
  sits in your seat (driver, gunner or passenger, in every vehicle with seats, the planes' chase view included),
  posed and turned like every other rider; the seat no longer looks empty. The cockpit and seat views look out from
  your own eyes and still leave your body out, as first person on foot does.


## 0.9.0 (2026-11-08)

**MapMaker: measure, props on surfaces, Randomise** (MapMaker overhaul Phase 1, items 3 and 4):
- **Measure tool** (U, or Measure in the tool bar): click two points for the distance, the height difference and the
  slope (degrees and percent); a third click chains a path and shows its total. It snaps to the grid, to surfaces and
  to objects' tops (Ctrl or Alt: no snap) and says whether a player could walk, jump or not make the step and the gap
  (from the real movement numbers). Right-click takes a point back; the line and its numbers stay until the next
  measure or Esc. Editor-only: nothing goes in the map.
- **Props land on what's under the pointer:** a tabletop, a roof, a ledge or the ground (bedded into it), as the
  see-through preview shows; against a wall, at its foot.
- **Randomise** (Props tab, off by default): each placement gets a random turn (any way, or within ±90°, ±45°, ±15°),
  size (±5 to ±30 %, within the prop's allowed scale) and variant where the prop has them. The preview shows the
  next one, so what you see is what you place.

**MapMaker: turning by mouse** (MapMaker overhaul Phase 3, item 9; owner, 2026-11-07):
- **A rotate ring** round the selection's gizmo: drag it to turn the selection about its centre. It snaps by the
  selected thing's own step, as R does (props and vehicles 15°, spawns 45°, the rest 90°; Shift: the finer step);
  tiles, set pieces, zones and water keep to quarter turns. The angle shows by the pointer while you drag, Esc cancels,
  and one drag is one undo step.
- **Quick facings** in the inspector: 0°, 90°, 180°, 270° in one click, for anything with a facing (tiles and set
  pieces too).
- Fixed: turning tiles or set pieces the other way (a negative quarter turn) could give them a rotation out of range.

**Fireteams, part 1** (owner-approved, 2026-11-08; docs/FIRETEAMS_PLAN.md):
- A new **variant** for Team Deathmatch, Capture the Flag, King of the Hill, Bomb, Hostage and Breakthrough (Match
  setup's Variants row; servers `rules fireteams 5`). The host picks the **squad size**: 4, 5 or 6, you included.
- **You lead your own squad of bots.** Nobody joins another player's squad; bot-led squads of the same size fill the
  rest of each team. A friend joining mid-match takes over a bot-led squad (its leader steps down; nobody respawns);
  when a player leaves, a bot leads their squad.
- **The order wheel:** hold **B** (a quick tap still opens the quick messages), hold a controller's **d-pad up** (a tap
  still pings), or tap **Orders** on a phone. Follow me, Hold here, Go there (where you ping or aim), Attack that (the
  enemy you aim at or ping), Defend the objective, Regroup. A squadmate answers in the chat ("Holding here!"), and the
  HUD shows your squad's order. The orders are checked by the match.
- **Your squad respawns near you** when it's safe there, else at your team's spawn. While you're down your squad holds
  its ground and fights; when you're back it forms up on you.
- Bot-led squads play the team brain's pushes as squads. `pnpm bot-report` measures squads (distance to the leader,
  members alive, orders carried out; `--fireteams=5 --orders`), and `pnpm bench --fireteams=5`.

**Passengers ride with the vehicle** (owner's bug report, 2026-11-08):
- **Riders stay in their seats at speed.** Driver and passengers, bots and people, are drawn on their seats of the
  vehicle as you see it this frame (bumps and tilt included), in every vehicle, online and offline, whoever is
  watching. Before, they were drawn where their own, slightly older, position had them: at full speed a passenger
  slid 2-3 m out of the back of a Buggy and slid back in as it slowed. Getting in and out still eases into and out of
  the seat.
- **No footsteps from a seat.** Riders, you included, no longer make footsteps (or a landing) as the vehicle carries
  them.
- **Engines.** A vehicle anyone rides runs its engine, pitched up with speed (lower for the Tank, higher for
  hovercraft and flyers): yours as you ride, and the two nearest others from where they are. A placeholder until the
  sound pass's recorded engine loops.
**Play on with friends: vote on the next map, parties** (owner, 2026-11-08):
- **Vote on the next map.** When a match ends, the scoreboard (and its awards) shares the screen with two or three of
  our maps that fit the players and the mode, the rotation's next first. Press 1-3, click or tap; change your mind
  until the vote closes (12 s). The winner shows for 3 s and everyone goes there: the next match starts about 20 s
  after the last, no trip to the menu. Bots don't vote; a tie goes to the host's vote, else the first on the ballot.
  Browser hosts, dedicated servers and offline alike. Pause menu → Host → Rotation → **Vote on the next map** turns it
  off (plain rotation); dedicated servers `MAP_VOTE=0`.
- **Parties.** Invite links carry your party: friends who follow yours play on your side in team modes (taking bots'
  places there) and stay together into the next map. Players who joined by code get an invite link of their own in
  the pause menu; the scoreboard marks your party. Online → Join a friend's game takes a pasted invite link and offers
  **Rejoin your last friend's game**.
- **Player caps hold for people too:** a join past the map's most for the mode is turned away ("match full").

**New players** (owner-approved, 2026-11-08):
- **Quick Play** heads the main menu: pick Team Deathmatch or Deathmatch and you're in a match against normal bots,
  on one of our well-tested maps for that mode (not the one you played last), with as many players as the map
  recommends for the mode (fewer on a phone). It remembers your last choice. "Choose map and rules…" opens Match setup.
- **Tutorial** on the Training Range, about two minutes: look, move, sprint, crouch, shoot, aim down the sights,
  reload, switch weapon, throw a grenade, drive the buggy. Each step finishes when you do it; a card shows what to
  press (keyboard and mouse, or the touch controls on a phone) and how far you are; Skip is always there (and in the
  pause menu). It's offered once on your first visit (never forced), and is in Quick Play and Options → General.
  The Training Range gained a buggy and Frag Grenades by each group of spawns (MapMaker).
- **First-time tips**: a short hint the first time you run low on ammo, have a vehicle in reach, see a pickup, pick up
  armour, spawn protected or die. Each shows once, one at a time, below the crosshair. Options → HUD turns them off
  or shows them all again.

**Gunplay audit, measured** (owner-approved; no weapon changed): `pnpm gun-report` drives the shared sim and measures
every gun: time to kill at 10/25/50/100 m on an unarmoured and an armoured player (body and head; ideal, hip and
aimed), shots to kill, first shot, draw, reloads and reload cancels, recoil recovery, hip/aimed/running spread and
falloff. docs/GUNPLAY_AUDIT.md is the report card (strengths, weaknesses against the direction doc, outliers, a ranked
list of candidate improvements, the spec's G0-G6 checklist), with the numbers (docs/gunplay-audit.json) and a TTK
chart (docs/gunplay-ttk.svg). The **Training Range** now has every gun of the arsenal on two racks behind the firing
line (placed in MapMaker).

**Deathmatch and Team Deathmatch play better** (owner, 2026-11-08):
- **Safer spawns.** Every spawn point is scored for its distance to the nearest enemy, enemy sight lines to it and
  fresh deaths near it, and one is picked at random among the safest few, the same for people and bots. Team modes
  favour points near teammates who aren't in a fight; on shared spawns each side keeps its own end of the map, so the
  sides don't swap ends; spawning beside a teammate picks one no enemy can see.
- **Spawn protection.** Every respawn in Deathmatch and Team Deathmatch is shielded for 3 s (Roulette 2 s): nobody
  else's damage gets through until it runs out or you fire. A faint shimmer shows it (a steady glow with Reduce
  flashing on), and a line under your crosshair. Bots hold fire for most of it and mostly leave shielded enemies be.
- **Player caps.** Every map has a recommended and a most player count for each mode, worked out from its size and
  spawn points unless set in MapMaker (Map properties, Players by mode). Match Setup shows them; map changes and the
  rotation keep matches within them.
- **Awards in every mode:** Most Accurate, Longest Streak, Nemesis and Most Revenge Kills on the scoreboard at the end
  (with Roulette's own in Roulette), and **revenge and nemesis callouts**.
- **New effects:** a blue burst for armour pickups, sparks when armour breaks, a low flame at the feet while a
  powerup is on, a heavy hit's impact (and your screen's edges darkening when it's you), and a burst over a player on
  a kill streak. All respect Reduce flashing.
- bot-report measures the pace of play: spawn deaths, time between fights, engagement distance and how evenly kills
  spread over the map.

**Empty vehicles stop; bots park out of the way** (follow-up to the hovercraft fix): a vehicle nobody drives now brakes
to a stop within a few metres (`vehicle.idleBrake` in its data) instead of gliding on; bots slow under 3 m/s before
getting out (unless it is burning or about to blow), and don't jump out over water; bot drivers keep off routes their vehicle doesn't fit
(`vehicle.routeFit`, the tanks' route check for every ground vehicle and hovercraft), so they no longer drive a Hauler
into Iron Tide's 3 m doors, or a tank up its centre stairs under a beam, and leave them plugging the way. Driven vehicles handle exactly as before.
**Hovercraft no longer get stuck under structures** (owner, 2026-11-07: a Hauler stuck under Iron Tide's platforms):
a vehicle squeezed into a gap narrower than itself (Iron Tide's door at the top of the stairs) used to rise up it into
the lintel and the roof and stay there; it now stops at floor height and backs out. Hovercraft (and other ground
vehicles) also go under decks, beams and lintels their hull fits under (Iron Tide's decks, Dune Harbor's arcade), where
the invisible collision shape over the hull used to catch. Over open ground they drive exactly as before.
**Tanks play properly** (owner, 2026-11-07): the crew is sealed in (no bullet, blast or blade from outside reaches
them) and dies with the tank; its armour takes a tenth of bullet damage and 1.25 times blasts (about 6 rockets or 5
shells kill it); the cannon carries 10 shells, shown in the HUD, one back every 15 s and all at an ammo pickup; alone at
the wheel you fire the cannon yourself; it turns on the spot. Bots drive tanks, fight from them at a stand-off, keep
shells for targets worth one, refill at ammo pickups and get out under a quarter of its health. All in the tank's
vehicle data (Workbench).

**Tanks can be beaten** (owner, 2026-11-08): rockets do twice their damage to vehicles (never to players), so 3 or 4
Rocket Launcher hits destroy a tank instead of about 6 (the Guided Rocket, Swarm Launcher, Blast Rockets and Mounted
Rockets too; light vehicles go down quicker as well). Bots with nothing that hurts a tank go further for a launcher
when one is about, draw a launcher they carry and aim it at the hull. The cannon now refills only from the general
Ammo Box (Light, Rifle, Shells and Sniper rounds don't), and tank drivers out of shells drive to one. Rockets'
`vehicleDamage` and the seat's `ammo.pickups` are data.

**Ammo Boxes by the tank routes** (owner, 2026-11-08): every map with a tank has an Ammo Box where its tank drives
(placed in MapMaker): Iron Tide on the hangar deck, Iron Maw on each side's haul road, Coldwater Gulch on each side's
tank lane, Frost Basin on the road down from each tank, Glacier Line mid-field, Shingle Point on the garrison's bluff
road. Bot tank drivers now go for one when the cannon is low (3 of 10 or fewer, out of a fight, up to 70 m off) as
well as when it is empty (120 m), also for the gunner beside them, and stop treating their own crewmate as a target.

**Iron Coast, part 2: the coast looks like a coast** (owner, 2026-11-07/08; all in MapMaker)
- **Terrain**: the jagged mountains round the map are gone (the sea's shoreline to the south, woods round the other
  sides); the cliff's foot is cleaned of the spikes and pits the cuts left, with a scree apron, a shingle band and
  stone on the steep faces; the crest's inland terrace banks are softened; shell craters on the beach. The cliff stays
  as steep as before, so the seven ways up are still the only ones.
- **Plants**: long grass and scrub along the crest, scrub on the bluffs, lush ground round the village, none on the
  sand; 114 bushes along the crest and the routes' heads (cover that hides you, from bots too), 24 trees and four
  hedgerows on the flanks, out of the main sightlines.
- **The beach**: hedgehogs in ragged bands, Belgian gates in the surf (a new piece in MapMaker's Military props), tank
  traps by the cliff, two cold wrecks and two burning wrecks with smoke (the new **Burning Landing Craft Wreck**; it
  never flashes); golden-hour haze and a low sea mist.
- **Balance**: the beach's defenders are posted forward: sandbag positions in front of A1 and A2, and half the beach
  sector's defenders spawn on the cliff top over them. In bot matches at 24 v 24 (the Map's pick) the beach now holds 57-81 s (was 39-60); at 16 v 16 it still falls in 38-52 s (was 42-51).
- **Stairs**: bots no longer jam on the far-west steps (route 1) and the wooden stair under B3 (route 5): rock cheeks
  close the gaps beside the flights where they got stuck. Stuck recoveries per match fell from 95-1405 to 75-297.

**Iron Coast (MAP 21), part 1: the beach assault and Breakthrough's showcase** (MapMaker only, from the owner's reference)
- **A new map, Iron Coast** (`iron_coast`): 380 × 320 m of coast for 24-32 a side (24 v 24 is the Map's pick; 16 to 64
  players). Landing craft beached on the sand, an irregular cliff (8 m at the grand stair's
  gatehouse, 12 m west and centre, 16 m on the east headland), seven ways up it, four gun casemates at their own
  heights, trenches and terraces on the crest, and the village with its round fort. It plays **Breakthrough**: take the
  beach (the two cliff-foot strongpoints), destroy two of the four guns, hold the fort's command room; and **Team
  Deathmatch** over the whole map. Military weapons.
- **MapMaker**: a terrain can be oblong (width and depth, 2.5 m apart past 320 m: up to 400 m each way); the Flatten
  brush levels to a height you type ("Flatten to (m)"); Map properties' **Also offered** lists the modes a map offers
  besides its main one; Import and the drafts open an unfinished map (no spawn point yet), listing what's left to fix
  (it exported, but wouldn't import back).
- **Breakthrough**: when a sector fell, its defenders could be sent for one moment to a post the next sector doesn't
  have (a goal with no place); they now get their next sector's duties at once.

**Friendly fire works** (owner, 2026-11-07: turned on, shots still didn't hurt teammates): with it on (Half or Full,
Match setup or the Host tab), your rounds, pellets, rockets, blades and fire hit a teammate in the way and hurt them
(half as much on Half), and burns and poison stick; blasts already did. Off (the default), shots pass through
teammates as before. A team kill still earns nothing.

**Frozen characters fixed** (owner, 2026-11-07: big bot matches showed figures standing mid-run, some in the air):
these were the dead. A character that died some 15 m or more away, where its animation is smoothed between steps
(performance round 4), kept the smoothing after its death, so its body was drawn in its last living pose where it
died instead of as its ragdoll; it stayed so until the body sank. Bodies now fall and lie as they should at any
distance, and a body kept for the next player of its look stands up fresh.

- Reduce flashing no longer turns blast smoke black: a dimmed blast scaled every piece's colour, so the toon smoke (drawn over the scene, not added to it) came out black near the camera; now only added light is scaled, and the rest have their bright parts capped.
- The sheep walks on its legs: its body stood half sunk in the ground, so it slid along like a worm (the sim keeps a walking sheep's position on the ground; the model now stands on it).

**New mode: Roulette** (docs/ROULETTE_MODE_PLAN.md; docs/GAME_MODES.md, "Roulette")
- **A new character every life**, dealt from your own shuffled deck of the roster (no quick repeats), with that
  character's stats (size, health, speed). A spawn card tells you who you are ("You are Big Bab · Large: tougher,
  slower") and a moment of spawn protection covers you until you fire. Free-for-all; plays on every Deathmatch or Team
  Deathmatch map.
- **On unless you switch them off:** signature loadouts (the knight spawns with a spear, a soldier a rifle, an alien a
  ray gun; outside the weapon set, its main gun), jackpot rolls (a gold glow, a better weapon and armour; now and then a
  tiny body), the Giant Slayer bonus (a small character downing a large one), and the streak pick (3 kills in one life:
  choose your next character from three).
- **Variants in Match Setup:** Earned rerolls (a token per 2 kills, R on the death screen), Swap on kill (become your
  victim), Variety bonus, Teams (Team Deathmatch with strong team-colour outlines), and Lunar, which now brings its
  extras wherever its low gravity is on: a point for an air kill, blasts that throw players about, floaty ragdolls,
  stronger jump pads and a gravity storm every minute (3-second warning).
- **Awards** at the end: Shapeshifter, Giant Slayer, Moonwalker, Unluckiest Roll.
- The **Lunar Roulette** party preset now plays the Roulette mode with Lunar on.
- Bots take picks and reroll tokens sensibly and play to their body: small ones flank, large ones push.
- Nothing in it flashes: the jackpot glow and the storm's warning ease in and hold, dimmer with Reduce flashing on.
- The spawn card stays up for 2 s of play even when the game hitches as your new body loads, and goes when you go
  down or the round ends.
- `pnpm bot-report <maps> --mode=core.roulette [--roulette=lunar,rerolls,swap,variety]` reports kills by character and
  body size, picks and rerolls.

**Bot AI Phase C follow-up, part 1** (docs/BOT_AI_PLAN.md, "Phase C follow-up"): a bot standing on a ledge outside a
wall, where the walkable ground nearest it was the room behind the wall (Capitol Mall's office sills), now steps off
toward ground it can walk to instead of pushing into the wall; bots following their group's corridor are counted on
it, so the team spreads its groups by them. Measured on 48 CTF matches: as before.
(Large bots ducking wherever there's no room to stand was held back: fewer stuck bots, but fewer captures; part 2 below
went in instead.)

**Bot AI Phase C follow-up, part 2** (docs/BOT_AI_PLAN.md, "Part 2"):
large bots go round roofs too low for them to stand under (a dugout's stair top, a low doorway) instead of walking into
them and sticking there, and crouch through one only where nothing else gets them where they're going. Small and
standard bots keep their routes. Measured on 48 CTF matches: about 15 % fewer stuck recoveries, no ducking, but fewer captures
on Diamond Park (its large defenders are back in play).

**Bot AI Phase C, items 1-4** (docs/BOT_AI_PLAN.md, "Phase C items 1-4, measured"; docs/BOTS.md):
- Bots drop off ledges, jump gaps and jump up onto ledges as players do: links found at load and each checked by
  playing it through the real movement code; flankers, scouts, snipers and Arena bots use them most, and snipers look
  for spots on roofs and ledges only a jump reaches.
- Routes keep off a bridge that has crumbled, a trapdoor that has opened, a drawbridge that is up, and come back when
  the ground does.
- Teammates meeting head-on in a doorway, a tunnel or on stairs pass each other on the right.
- A squad's bots keep to their own lane all the way to the objective; route searches are spread over ticks in big
  matches.
- `pnpm bot-report`: parkour moves, routes along a lane, searches put off, sniper spots only parkour reaches.

**Two new characters: Cool Hands Rex and Fishy Fred** (the owner's import list, batch 1; docs/IMPORT_LIST.md)
- **Cool Hands Rex**, a T-rex in a bomber jacket and shades, the owner's own Meshy model ("i made him in meshy"). Large
  (2.12 m, 115 health), under Creatures & Machines; his bots take gangster names. His tail rides his hips: it stays off
  the ground walking, running and crouching, and, like every tail, it can't be shot.
- **Fishy Fred**, a big fish on striped legs in red sneakers (Meshy Community, CC0). Small (1.40 m, 85 health), under
  Animals; his bots take the river-critter names. "Fishy Fred" is the download's own name until the owner names him.
  His head shots are on his face, not the whole fish: the fish counts as his body.
- Both close their hands round rifle and pistol grips in third and first person (grip audit 0 for both), and have their
  own portraits.

**Bot AI Phase C, item 0** (docs/BOT_AI_PLAN.md, "Phase C item 0, measured"):
- Fixed: a Breakthrough match could stop with an error when a defender sent to fall back to the next sector was on the
  last one.
- `pnpm bot-report`: Breakthrough's sectors, when each fell, how the round ended and the reinforcements left; `--compare`
  shows the share of time bots spend retreating.
- Hurt bots keep retreating from what they see, as before: seven ways of cutting the retreat short all made
  Breakthrough's attackers worse (measured; the table is in the plan).

**Small fixes from the owner's play, 2026-11-07**
- **The Breakthrough Range is an ordinary map**: it was marked as a test map, so no list showed it (and the test hook
  that added it works only on test builds). Now it is in Play and Match Setup (Breakthrough its mode), rotations and
  the host's map list, with its own map picture. Unmarked in MapMaker's Map properties; its id stays
  `test_breakthrough`.
- **The gun no longer vanishes from your hands after the scope** (the owner saw it on Count Bonesworth after a sniper on
  a St. John's roof; it could happen to anyone). On Medium and High a gun you pick up fetches a sharper copy for your
  own hands; when that copy came in while the gun was put away (looking through a scope, or in third person) it took
  "hidden" from the scope and kept it, so when the scope came down the hands held nothing (until you switched guns).
  The sharper copy now takes over shown or hidden as the gun itself was.
- **The use prompt reads on any background**: white words and a light green key on a dark cap, with a soft dark
  outline (the key's letter was the dark ink of the menu's keys, on a dark cap: nearly invisible). Refusals ("Locked",
  "The Dropship is full") stay light red.
- **A Dropship can no longer wedge on Shingle Point's beach**, and bots stop going back and forth to one they can't
  use. A bot had flown one into a landing craft wreck's hull and left it turned across it: its nose and tail poked out
  past its enter radius and its sides were inside the hull, so nobody could get in (E did nothing), and bots kept
  walking up to it, giving up and coming back. Now flyers driven into something they can't pass climb over it on their
  own and settle back to their height after; you can get into any vehicle from within 1.6 m of its hull, not only
  within its enter radius of its centre (long hulls: the Dropship, the Gunship, the tank); a vehicle in reach with every
  seat taken says "The … is full"; a vehicle driven and going nowhere for 3 s is marked wedged and bots leave it for
  something else until it is got out; and a bot that presses E and still isn't in (twice), or can't reach the seat,
  gives up on that one, for longer each time (30 s, then 60, 120, 240). Iron Tide, Dune Harbor and the other beach maps
  had the same wreck, hedgehogs and landing craft: the same fixes apply there.
**Performance round 4: crowds, 32 v 32 in a browser, 64 v 64 on a dedicated host** (owner, 2026-11-06: "32v32 would be
max I want to shoot for without dedicated host … push dedicated hosts to 64v64 if at all possible"; docs/PERF_96.md,
"Performance round 4")
- **Far runners don't stutter any more.** Characters further off were animated 8-20 times a second and held each pose
  in between, so a running foot stood still for two to four frames and then jumped. Now the frames in between are drawn
  part way from one pose to the next (the gun with them), and the rate goes by how big a character is on screen (a
  scope brings far ones back to full rate): every frame to about 15 m, then 30, 20, 15, 10 and 5 times a second out to
  150 m and beyond, each at least as often as before to 150 m, and smooth.
- **A crowd's animation costs about a fifth less** (56 characters running and strafing, 5-60 m): the arm and hand
  fitting on far guns starts at 25 m (was 35), and clips leaving a crossfade are kept a moment instead of stopped and
  started again (a strafing crowd started some 50 a second).
- **32 v 32 in a browser** (was 24 v 24): Match Setup's Max is 32v32; past 48 players its check says it takes a recent
  desktop or a fast laptop. Phones stay at 16. **64 v 64 on a dedicated host** (was 48 v 48; protocol 5, so older
  clients are told the server speaks another protocol).
- **Hitches:** effects physics (ragdolls, casings, debris) no longer walks every level collider after each step (a
  third of each step and half a megabyte of garbage on Shingle Point); joints are turned in place (less garbage for the
  long collections); the loading screen waits for the looks and guns the match needs before it starts counting the
  shader warm-up, so a first visit after an update no longer builds the spawn wave's shaders in the first seconds.
- **Tests:** the host handoff flow runs each of its three pages in a browser of its own (sharing one GPU process, a
  joining friend's page waited up to a minute on its shader builds behind the other two pages' frames); `pnpm bench
  … --wire` reports what each player is sent.

**Reduce flashing: a seizure-safety setting, on by default** (owner, 2026-11-06, after dropping the flashbang: "I
don't want to give people seizures"; docs/LOOK.md, "Reduce flashing")
- **Options → Accessibility → Reduce flashing**, also in the pause menu's Settings; on unless you switch it off.
- With it on, lightning (the Arc Caster, arc turrets, electric fences) holds a steady glow instead of crackling bolts,
  fence wires and an arc turret's charge stop flickering, blasts near you are dimmer and fade in instead of whiting
  out the screen, muzzle flashes are smaller and dimmer, blinking map lights and indicators pulse gently at most once
  a second, a light's "Flash" flares less and eases, the haze of water you dive into eases in, and taking damage
  tints the screen edge a duller red that eases in and holds instead of flashing red with every hit.
- **A flicker check in CI** (e2e flow `flashing`): the brightest moments (an arc fight up close, the fence, grenade
  blasts in front of you, a machine gun in a dark room, a red alarm light) are recorded frame by frame and held to
  WCAG 2.3.1's flash and red-flash thresholds with the setting on; with it off they are measured and reported.

**Breakthrough: a new asymmetric mode** (owner-approved for Iron Coast, MAP 21; docs/GAME_MODES.md, "Breakthrough")
- The attackers push through a map's sectors in order; the defenders hold each line in turn. A sector falls when its
  **capture zones** are taken (attackers alone in a zone capture it, faster with more; a defender inside contests it)
  and enough of its **targets** are destroyed (plant a charge with E and hold still, 20 s fuse; defenders defuse it the
  same way; a sector can ask for "two of three"). The last sector's **final hold** ends the round.
- When a sector falls both sides' spawns move on, the next sector's objectives switch on and its time goes on the
  clock; defenders left behind the new line get a 10 s fall-back warning, then it hurts. The attackers have a pool of
  reinforcements (topped up for each sector taken); the defenders respawn without end, a little slower. Out of time
  or reinforcements, the defenders win. An optional second round swaps the sides; more sectors, then more time left,
  wins.
- The HUD: your side, the sector strip, the pool, each objective's state (capture %, contested, a charge's fuse),
  markers and minimap labels on the objectives, the fall-back warning, and announcer lines for both sides.
- Match Setup offers it on maps with sectors, with its settings in "what wins": reinforcements, sector time (both
  follow the match's size) and the second round; the host panel has them too. Team setups now go to 48 a side.
- MapMaker: new pieces in Entities → Spawns & Objectives: **Sector** (its order, name, targets to destroy, time),
  **Capture Zone**, **Destroy Target**, **Final Hold**, **Attackers' Spawn**, **Defenders' Spawn** (each in a sector's
  group), with inspectors and checks in the issues list. A game mode's pieces now show whatever Style Pack the
  palette is narrowed to. Map properties has a **Map ID** field (the file name an official or test map is saved as).
- Bots play it by Breakthrough's playbook: the attackers take the least defended objective first, spreading over the
  sector's ways in groups that move up cover to cover (with smoke, to screen the open ground they cross) and gather
  to push a held one, and guard their charges; the
  defenders man the guns, hold the trenches and sandbags, snipe from high ground over the objectives and hold the
  objectives, some falling back early to the next line, and rush to defuse. A bot at a target holds still, crouched,
  to plant or defuse (they used to fight on the move and seldom planted), and one caught behind the line runs for it.
  Map format v29 (after the weapon sets' v28): older maps load unchanged, and a map stamped for release keeps its
  version (a format change alone isn't a change to the map).
- **The Breakthrough Range** (test map, made in MapMaker): three sectors to try it on.

**Iron Coast's fort and gatehouse** (docs/SET_PIECES_PLAN.md, "As built: part 4")
- **Command Bunker**: a round fort 31.6 m across with three gates in a thick wall with firing slits, round a keep: the
  command room (big enough for a final hold), the radio room and a roof terrace over it, a stair to the roof.
  Military Compound, Coastal Harbor and Snow Outpost looks.
- **Grand Cliff Stair (Gatehouse)**: the grand stair with a twin arched gate between its flights, high flanking walls
  and piers.
- New kit for any map: the **Fort Ring** and **Fort Ring Gate** tiles (quarters of a round fort's wall) and the
  **Gate arch** wall style.

**Weapon sets: Standard, Military, Sci-fi, Medieval, Chaos and Mixed bag** (owner, 2026-11-06: "I have never once
seen the sheep weapon, hardly see swarm launcher or gravity weapon … weapon sets for map defaults"; docs/WEAPON_SETS_PLAN.md,
docs/ARSENAL.md "Weapon sets")
- **A set decides what you spawn with, what the pickups hold and what drops.** Military: a knife, a pistol and an
  assault rifle, real-world guns only. Sci-fi: a knife, a pulse pistol and a plasma rifle, energy weapons only.
  Medieval: a knife and a throwing spear, every weapon pickup a spear or a battle axe. Chaos: a knife, a pistol and a
  random oddball every life, a sheep to throw. Mixed bag: a knife, a pistol and a random main gun every life, any
  weapon in any pickup. Standard: as before.
- **Pickups roll within the set:** a weapon pickup holds one of the set's weapons of its own kind, else of the nearest
  kind it has (a sniper rifle pickup in Sci-fi is the railgun), a new one each time it comes back; grenade pickups hold
  the set's grenades (Military frag, mine and smoke, Sci-fi sticky, vortex and smoke, Medieval incendiary and holy
  bomb, Chaos sheep, holy bomb and cluster bomb); in Military the frag looks like the realistic frag, in Sci-fi the
  smoke grenade is the sci-fi canister.
- **Each map has a default set** (MapMaker → Map properties → Weapon set; maps without one play Standard), and the host
  can pick another: Match setup → Advanced rules → Weapons ("Map default" names the map's own, and the setup's facts
  show the set in play), the pause menu's Host tab (it applies at once), or a server's `set` rule.
- **Bots** use the sets' weapons: sniper-role bots spawn with Military's marksman rifle or Sci-fi's railgun, bots throw
  the sheep (short, so it waddles the rest of the way) and the holy bomb (then run clear of it), and light their oil
  slicks with the oil slicker's igniter. `bot-report --set=…` and the scorecard list kills by weapon per set.
- **The official maps' defaults:** Military on 16 maps (Sandgate, Shingle Point, Fogbound, Rockfall Canyon, Bunker
  Cross, Atomic Court …), Sci-fi on 12 (Halcyon Station, Starhaven, Twin Spires, Void Yard, Neon Spire, Frost Basin,
  Fernwood Moon …), Medieval on Market Town and Sandfall Colosseum, Chaos on Cinder Foundry, Pantry Raid, Flatpack
  Depot and Erosion, Mixed bag on Neon Galleria, Grand Marquee and Primeval Park; every other map stays Standard.
- Map format v28 (the map's `weaponSet`); older maps load unchanged and play Standard. Saved setups keep their choice.
- **Fixed:** on the space maps (no haze), the first step into a smoke cloud, or into water, no longer freezes the game
  while every material in view is rebuilt: the fog is on there at nothing, so smoke only thickens it.

**New weapon and grenade models, sharper textures for the gun in your hands, and a Smoke Grenade** (owner,
2026-11-06: "replace our tommy gun with the 3DModelsCC0 one, and bring in those others to replace any one-off
originals"; "we want these weapons to look a little sharper, clearer, better resolution"; docs/ARSENAL.md, "Weapons
intake of 2026-11-06")
- **Guns:** the Submachine Gun is a Suomi KP, the Assault Rifle an AK-47, the Burst Rifle an M4A1, the Pistol a
  Makarov, the Machine Pistol a Grease Gun, the Shotgun a pump shotgun and the Marksman Rifle a scoped hunting rifle
  (the CC0 Guns & Explosives pack); the Hand Cannon is the BK 220, the Heavy Revolver the Revolver Rustique, the Gilded
  Pistol a gilded flintlock, the Pulse Pistol the Plasma Defender and the Nailgun the Scrapfire Assault Blaster (Meshy
  Community). Each is held by points read off its own grip, handguard and stock, and still falls back to its model
  built from the repo if its own fails to load.
- **Grenades have models:** in your hands while you line up a throw (the gun goes away, both hands on it), in flight,
  and as the pickup (two of it, not coloured balls): the frag is the Globe Grenade, the sticky the Countdown Sphere,
  the vortex "just a grenade", the cluster bomb the Sunburst, the gas grenade the Toxic Splash, the incendiary a
  Molotov; the mine's pickup is the AT mine. The holy bomb, sheep, airstrike flare, sandbags and dynamite stay as they
  were.
- **Sharper:** the gun in your own hands draws a copy with a 1024 px (Medium) or 2048 px (High) colour map and a
  512 / 1024 px normal map, fetched only for the guns you carry and freed when you drop one; everyone else's copy
  stays at 512 px. The new models keep their own metal and roughness (no flat matte finish), and steel reflects a soft
  gradient in the map's own light.
- **Smoke Grenade** (new, pickup "Smoke Grenades"): a grey cloud about 5 m across its middle for 18 s. Bots, turrets
  and homing missiles can't see through it; you can't either (inside it, a grey haze you see 2-3 m through), and an
  enemy's marker behind it isn't drawn. Bullets still go through. A hurt bot caught in the open throws one between
  itself and its enemy, and a bot bounding cover to cover sends one ahead before it crosses open ground. No flash,
  no white-out: there is still no flashbang.

**Bots: snipers, cover to cover, playbooks per mode** (docs/BOT_AI_PLAN.md Phase B, part 2; docs/BOTS.md, "Snipers",
"Cover-to-cover advance", "Team brain and route variety")
- **Snipers play like snipers**: a sniper-role bot goes for a scoped gun first, then takes a high, tucked-away spot
  with a wall behind it that looks down the ways the enemy comes, sees through the scope out to its gun's reach, takes
  calculated shots (the aim lined up, the target still, unaware or lined up a while, never sprinting across), and moves
  to another spot after two or three shots, when it's spotted, or after a kill.
- **Cover to cover**: on their way to an objective, Tactical bots (and Mixed ones in a fight at range) move up in
  bounds, half covering while half move; bots stay in cover while reloading or hurt; Tactical and Mixed routes keep out
  of open ground. Arena bots keep the rush. Time in cover in a fight: Tactical 24 → 40 %, Mixed 18 → 28 %, Arena as
  before.
- **Playbooks per mode**, as data (bots/playbooks.ts): Capture the Flag's roles and the team brain's numbers per mode,
  and Breakthrough's (attackers spread over the ways and bounding up the beach, defenders on the guns, in the trenches
  and on the crest, some falling back early) for its mode to read.
- Flankers take 45 % of the attackers after the recon pair (were 30 %): on the long CTF maps every team trip uses two
  ways or more.

**Bots: scored choices, a team brain, ways of their own** (docs/BOT_AI_PLAN.md Phase B, part 1; docs/BOTS.md, "Scored
choices", "Team brain and route variety")
- **Bots choose by score**: with nobody in sight, a bot weighs its goal, cover, a pickup it needs, an enemy that slipped
  away and a noise by its personality, health, ammo and distance, and keeps its choice unless another is clearly better.
  CTF defenders now stay by their flag instead of chasing gunfire across the map; a bot on the hill stays on it; a
  person's order holds a bot; a carrier never leaves its run; a hurt bot lets a noise go by.
- **Different ways to the objective**: the two or three genuinely different ways between each mode's places (base to
  flag, spawn to hill, spawn to site) are worked out at match start. On the long Capture the Flag maps (Fernwood Moon
  and longer) a team splits its attackers into a main push, flankers and a recon pair, each on its own way; a push on a
  flag at its base gathers out of the flag's sight and goes in together. Loose bots and squads heading for the enemy
  take the way that is least crowded and where fewest teammates died lately.
- Measured on a sample of every mode (33 matches, against before): King of the Hill's hill held 26 → 49 % of the time,
  Bomb plants 0.5 → 1.5 a match, a hostage rescued (none before), Elimination's round 120 → 70 s, Team Deathmatch's
  busiest way 54 → 43 % of a team's bots; Capture the Flag a few more captures (20 → 23) from fewer flag takes (176 →
  127): the defenders hold their flags now, so a take is a real attack.

**MapMaker gives the ground back when a floor moves** (owner: "fix the ground bug")
- MapMaker used to write the ground it lowers under floors into the map: every edit lowered the terrain under every
  floor and nothing ever raised it back, so a floor moved across a field left a dip at each place it passed and a
  deleted floor left its pad (props on the ground there were left floating). Now the map keeps the ground you sculpted,
  and the ground kept under the floors is worked out from it, after every edit and when the map loads, the same way
  for both: move, turn or delete a floor and the ground where it stood comes back; an edit and its undo leave the
  terrain exactly as it was; opening a map and exporting it changes nothing; the map plays as MapMaker shows it. No
  change to the map format: existing maps load as before.
- Props bedded on the ground beside a floor are played bedded on the ground kept under it, as MapMaker draws them: on
  Blackout and Dockside Depot (their files have ground 5 cm through a floor's edge) 18 props, mostly trees and lamp
  posts, sit 1–5 cm lower.
- Step Temple: the 2.2 m slot the old behaviour cut beside the west terrace stair is filled again (in MapMaker). No
  other shipped map had ground lowered where no floor stands now.

**Furniture at human size** (owner: "Can we scale the props to the normal human character size? Some of them are
tiny, like chairs and such"; docs/CONTENT_PIPELINE.md, "Real-world sizes")
- Every furniture and everyday prop was measured by what it is for (a chair's seat, a table's top, a basin's rim)
  against real-world sizes beside the 1.8 m character. 13 that were more than 10 % off are the right size now: the
  Kenney bench (its seat was 0.22 m off the floor) and office chair, the graveyard bench, the dungeon chair, the four
  Quaternius sofas and armchairs, the metro platform seats, and the household toilet, desk and wash basin come up or
  down to their seats and tops; the Quaternius dresser comes down to 0.8 m.
- The maps follow, edited in MapMaker: benches that were scaled up by hand to look right (×2.5 in Ironhold Prison,
  Diamond Park and Neon Galleria) and St John's shrunken dressers are back at ×1, monitors and lamps sit on the lower
  desk tops, and sofas, armchairs and benches that would now reach into the wall behind them moved clear of it.
- New tools: a lineup sheet per prop pack (its furniture beside small, standard and large characters and a ruler,
  from a player's eye and from the side) and a size table measured from the models.

**Props collide as what you see: the slack pass** (owner's bug report, Capitol Mall: "These pillars are blocking my
bullets"; docs/CONTENT_PIPELINE.md, "Prop collision")
- **Columns**: the white Ionic column collided as one box as wide as its plinth and capital all the way up, so rounds
  aimed just past its round shaft stopped in the air (0.37 m beside it along the colonnade, 0.73 m at 45°, at Capitol
  Mall's size). It collides as its shaft now, and so do 27 more columns, pillars, obelisks and posts (the papyrus,
  round ruin, sci-fi, sandstone, dungeon and Kenney columns among them).
- **The slack audit**: a prop's collision is measured against its model along x, z and both diagonals. Air 0.15 m or
  wider beside the model over 30 % or more of its height is slack; `pnpm content:check` fails a box prop that carries
  it unless it says why. 363 more props (statues, vehicles, furniture, machines, fences) collide as their shape now;
  18 round or thin ones keep their box, which is already their best fit.
- In play: rounds beside a column fly on, rounds at it stop on the stone, players stand right against it and cover
  behind it still holds (tested in the sim at the column's two sizes). Prop collision boxes on the maps in play went
  from 31,682 to 58,638 (Iron Maw, the busiest, 3,281); map load and shot costs stayed within the noise.

**Bots: a navigation audit, no standing still on a failed route, a scorecard** (docs/BOT_AI_PLAN.md Phase A;
docs/BOTS.md, "Navigation audit", "Never standing still on a failed route", "Scorecard")
- **Navigation audit** of every map, from every polygon of the bots' navmesh: traps (places bots fall or jump-pad into
  and can't walk out of), spawn points, objectives and pickups cut off, with a picture per map (`pnpm nav-audit`).
  Errors on the official maps, warnings in MapMaker. No official map has an error left: the 15 findings left on 9 maps
  are listed for the owner with why and what would fix each (Skyward's and Sky Islands' pad perches, Grand Marquee's
  marquee top, Obsidian Orb's reactor core, Reactor's yard, Serpent Gorge's gorge floor, Erosion's lower deck, M4
  Outpost's uplink room).
- **Bots get down off ledges**: one-way drop links off ledges, roofs, scaffolds and cliff shelves that have no other
  way down, generated at load (within fall damage: with it on, only drops that cost at most about 30 health).
- **Bots get up out of pits**: a bot cut off from where it is going hops across to ground that routes there, up a
  ledge of up to 1.4 m with its legs tucked up as players do (Undergate Transit's track beds, St John's court), and
  over a step or gap the navmesh is too cautious for (M4 Outpost's uplink dais).
- **Fixed in the navmesh's generation**: floors Recast found inside solid boxes (Eagle Spires' spires had one in every
  rock block) are left out; jump pads land on crumbling and breakable blocks as players do. The navmesh still keeps
  0.8 m from walls: 0.6 broke the tiles' narrow stairs and wasn't better for bots.
- **No bot stands still on a failed route**: a goal no route reaches is swapped for the nearest place a route does
  (a flag on a ledge, a pickup on a crate: the last step straight to it), a bot knocked off the navmesh walks back
  onto it, long searches walk the part they found, and bots pick only goals they can get to. Buttons on cooldown
  aren't pressed again and again (Primeval Park: a bot stood 218 s at one), and a bot at a console's button looks up
  at it and presses (they stood under Serene City's thaw console looking level). A bot gives up on a pickup it
  stands at and doesn't get (five bots stood round a dropped spear they already had on Sandfall Colosseum), and
  nobody spawns beside a teammate stuck where nobody walks (Dune Harbor: under a street floor).
- **Shingle Point** (owner's playtest): bots no longer push each other off the seawall ladders or back and forth in
  the MG nest by hill 1 (teammates steer each other aside, never back, and not at all at a ladder).
- **Spawn points inside something solid moved out of it** in MapMaker on 25 maps, and are now an error on the
  official maps. Dune Harbor's consoles are 1.2 m shorter, so the aisle between them opens wide enough for bots.
- **Scorecard**: `pnpm bot-report` over every mode (`--suite=all`), with limits in a checked-in file; `--check` runs
  in CI when the bots, navigation, the sim or a map it plays change, and the full scorecard runs nightly with its
  report and every map's nav picture.

**Four maps retired** (owner, 2026-11-06): Obsidian Orb, Reactor, Serpent Gorge and Iron Compound are out of the menus, playlists, rotations and the host's map picker (their files stay for tests).

**Hosting: a friend whose game freezes for a moment keeps their place.** A friend on a slow machine can freeze for up
to half a minute while joining. While that happens, their connection is still up. The host used to drop them after 20 s
of silence. Now it checks the connection itself, and gives a friend whose connection is up 60 s. A dead link still goes
after 20 s.

**Score and time follow the match's size** (owner, 2026-11-06: "24v24 in a 40 pt match means on average 1 kill per
[player]. 24v24 plays ok with 500 points, but also 15–20 min"): Match setup suggests the score and time for the
players and bots, and they follow every size change until you set them yourself. Yours then stay, marked **Custom**,
with **Back to suggested** one click away. The suggestions are fitted to how fast bots score on real maps
(`pnpm bot-report`, which now prints each match's team scores and its top bot's kills; checked again with the Phase A
bots), so a match is usually won near its time limit, not in two minutes (docs/BOTS.md, "Score and time"):
- **Team Deathmatch**: a point for each player on a team per minute of the time limit, which is 10 minutes up to 6 a
  side, 15 up to 16 and 20 above: 4v4 40 points in 10 minutes, 8v8 120 in 15, 12v12 180 in 15, 24v24 500 in 20.
- **Deathmatch**: the leader's kills grow gently with the players (12 × √players), in 10 minutes: 15 for 2 players,
  35 for 8, 50 for 16, 70 for 32.
- **Capture the Flag** keeps 3 captures, with 10, 15 or 20 minutes by team size; **King of the Hill**'s hill seconds
  go with the time (12 a minute: 120 in 10 minutes, 180 in 15, 240 in 20).
- Rounds modes, co-op and Zombies are as before.

Saved setups keep working: a score or time you set stays; the old defaults (40 points, 10 minutes) follow the size.
Scores can now go up to 5,000 (they stopped at 1,000).

**Host online means the same everywhere** (owner, 2026-11-06): Match setup's Host online now starts the match online
**and listed** in the game browser, as the pause menu's does (with a community hub; without one, a join code). The
join code still shows. Spectate follows the switch: offline you watch the bots, online you watch while friends play.

**Save for next match** (owner, 2026-11-06): in the pause menu's Host tab, when you change a rule that needs a new
match (score, time, respawn, friendly fire), choose **Restart now** or **Next match** beside Apply. Next match keeps
the rules for the next match (after this one's scoreboard, or Restart, Change map or the rotation) and this one
carries on; the foot says which will happen. The Host tab also shows the suggested score and time for the players
being set, with **Use suggested**.

**Co-op sizes stop at the map's size** (owner, 2026-11-06): co-op and Zombies' size presets go up to what the map is
made for (its team layout, or its recommended most), not a Big squad of 24 or Max of 48 beyond it.

**Signing in doesn't flash a red line** (owner, 2026-11-06): after Google sign-in the menu no longer shows "Signed in" in the red status line bottom left (the profile corner top right shows it); sign-in problems still show there.

**Match setup, redesigned** (the owner's report and the approved design, 2026-11-06)
- **What matters most is always on top**, with no steps to go through: the game mode, its variants, what wins (score
  and time) and the mode's own key setting (flag return, the hill timer, laps, Fort Wars' build and combat phases).
- **Presets that scale with the map:** Duel, Small, Map's pick (the map's own layout), Big battle and Max, worked out
  from the map's size, its spawn points, the mode and what this computer (or phone) runs. Any change makes it Custom.
  The fixed shapes are still there under More layouts.
- **Party presets**, one click each: **Lunar Roulette** (low gravity, a new random character every life, stats and
  all; Team Deathmatch on a map with teams) and **Spear Fight**.
- **Variants:** on/off chips under the modes: Lunar, Roulette bodies, Classes, Spears only, Discs only (greyed, with
  the reason, where they can't be used). A variant shows as on however its settings were set.
- **People apart from bots:** "You + 47 bots · 24v24", and each team reads "You + 23 bots". Adding a bot grows its
  team (a team of 10 takes an eleventh instead of snapping back), **Even teams** keeps them matched, and a limit says
  whose it is ("24 per team is this computer's limit").
- **One fit indicator** instead of the yellow notes: Fits, Crowded or Problem. Click it for the spawn points, the map's
  recommended size and performance, with buttons that act ("Use 12v12"). A real problem stays in view, in red.
- **Advanced rules in one line** ("9 changed · Low gravity · Tactical bots +7"), its chips and Reset inside it.
- **A foot that never scrolls away:** Offline / Host online beside **Start match** (Enter does what the switch says),
  saved setups in a small menu, and **Spectate**.
- Small screens and phones open one section at a time; a desktop as many as you like. It fits from a phone sideways
  (900 × 415) to 2560 wide. A setup saved on a computer and opened on a phone plays what the phone runs, and says so.

**Spectate before the start works** (owner's report, 2026-11-06): a spectator who has loaded counts for the start, so
a match only spectators watch (bots against bots) begins at once instead of waiting out the 30 s for a player who
isn't there. Match setup's new **Spectate** starts a match that way, straight into the spectator camera.

**The pause menu's Host tab, made like Match setup:** what wins, players and teams (presets for the map, Even teams,
people apart from bots, the fit indicator), bots and rules, every setting that needs a restart marked. One foot:
**Resume** (Esc too), **Apply** named by what it does (Apply now, or Apply & restart), what it changes, the
Offline / Host online switch and **Leave match**. The join code, invite link, listing, players and kicks, rotation and
Change map are all still there.

**Set pieces, part 2: MapMaker** (owner-approved, docs/SET_PIECES_PLAN.md; how to use it: docs/BUILDING_KIT.md, "Set
pieces")
- **A Set pieces tab** (Build): every set piece with its picture, grouped by family, found by search, narrowed to the
  Style Pack you pick.
- **Place a whole piece in one click:** a see-through ghost of it follows the pointer in its real materials, green
  where it fits and red where it doesn't, and it says why. R turns it, M mirrors it (a piece that can't be mirrored
  says why). Its look follows the map's theme, the Style Pack you pick, or any look you choose.
- **One piece, one click:** clicking any part of a placed piece selects all of it; it moves, turns, mirrors,
  duplicates and deletes as one, with undo. The inspector shows its look, mirror and place, its doors and openings,
  and changes a material or leaves a part out for that piece alone.
- **Doors and openings shown:** the ghost and the selected piece mark where they connect, in red where a wall is in
  the way, with a warning that says which wall.
- **Explode to tiles** turns a piece into ordinary tiles, blocks and props to edit one by one; one undo brings it back.
- **Make your own:** drag a box over tiles, blocks and props to select them, then **Save as set piece**. Your pieces
  are kept in this browser next to your maps, place in any map (the map carries them), and export and import as
  files. The owner can export one to ship with the game.
- **St. John's gets two set pieces, placed in MapMaker:** the Argonne Gate is now a two-storey castellated carriageway
  (St. John's stone, Collegiate stone facade, the shallow vault) from Exeter Street to the drill field, with a door
  into Knight on one side and, on the other, a new two-storey east tower against Welles with its own door onto the
  drill field and a window on the street; and a covered skybridge on the first floor joins DeKoven and Smythe over
  Church Street, battlements and all, its floor high enough that nobody inside it holds the Church Street hill in King
  of the Hill. Spawns and objectives are where they were.
- A set piece's own parts no longer count in MapMaker's overlaps warning (only your pieces against it do); placing a
  set piece lowers the ground under its floors at once (a sunk trench's slot), as loading the map does, so an
  exported map loads exactly as it was saved; the Collegiate and Gothic stone plinth stops at doorways instead of
  running across them.
- The coverage test map has one of every set piece.

**Set pieces, part 3: pieces for the beach assault and the colosseum** (owner-approved, docs/SET_PIECES_PLAN.md)
- **For MAP 21 (Military Compound look):** the Gun Casemate and the Cliff Casemate (a gun port to the sea, and rooms
  in a loop: two ways in, no dead ends); trench runs sunk into the ground (straight, bend, junction, end, and a jog
  round a traverse; fire steps, duckboards, timber or sandbag walls; crouch in the trench and you're hidden); the
  Grand Cliff Stair and the Cliff Stair Tower; a landing craft beached with its ramp down, which never moves: cover to
  fight from, up the ramp and into its well.
- **For the Sandfall Colosseum rebuild (Imperial Arena look):** arena bays (podium, upper tier, vomitorium), the
  Grand Arcade and the attic, stacking six storeys high; hypogeum tunnels with hatches and ladders up to the sand;
  cage blocks with barred gates and a lift-cage riser; three insulae with shops and flats; stair towers of 4, 6 and 8
  levels.
- **New building pieces for every map:** the Round arch, Grand arch (two storeys), Embrasure and Barred gate wall
  styles; Sunken Trench tiles that carve their own slot in the ground; the Grand Flight (two cells wide), Seating Tier
  and Vomitorium, Vaulted Tunnel, Grand Gallery and Corner Hatch; a Sandbags material; the Landing Craft (Beached)
  prop (Meshy community, CC0), in the Military Compound and Coastal Harbor packs.

**Astronauts, a crocodile and a tortoise** (the owner's models of 2026-11-06)
- **Capt. Nova** got the light-blue astronaut (a slender spacesuit in pale blue over a black bodysuit, with a dark
  visor and a backpack), then was retired the same day (below).
- **Boglurker** is a crocodile now, in iron pauldrons, bracers and greaves, with a long tail. Still large, still a
  creature, and still the Boglurker the NPC squads bring.
- **New:** **Spacewalker**, a white spacesuit with a gold visor (Soldiers), **Starfarer**, a dark teal and violet suit
  with glowing magenta strips (Soldiers), and **Shellback**, a humanoid tortoise (Animals). The owner kept the names.
- **Bamboo is retired:** a saved choice of Bamboo, or a bot set naming it, plays Shellback.
- The crocodile's and the tortoise's claws close round the grips; every new hand is tuned on the rifle, the pistol and
  the shotgun. The crocodile stands over its own feet (its long tail had put its body 0.4 m ahead of them).
- **Licences:** Meshy models from the owner's Drive are recorded as Meshy Community CC0 unless the owner made them
  (owner, 2026-11-06). The provenance audit that day moved the Drive models recorded as owned (characters, weapons and
  turrets, props, helmets) to community CC0; only the mining machines stay owned (below). Nothing in the game changes.

**The owner's answers on the new characters** (2026-11-06)
- **Capt. Nova is retired:** a saved choice of her, or a bot set naming her, plays Spacewalker, the nearest astronaut.
  The Knights vs Space Crew bot set's Capt. Orion is a Spacewalker now.
- **Shellback is standard size** ("should be smaller, not that big at all"): 1.80 m tall, 100 health and normal
  speed (it came in large: 2.12 m, 115 health, 0.94 speed). Its hit shapes and Character Select's model shrink with it.
- **Starfarer's back pack keeps its shape:** the pack and the tank on top are held whole by the chest. Before, they
  bent with the head, arms and spine. The tank tipped when Starfarer looked up or down or ran, the box sheared with the
  arms, and its bottom flared into a skirt round the waist when crouching.
- **Licences:** the airliner shell, the buggy and its tire, and the Alien Biker are Meshy Community CC0 too. The owner:
  "I did not make any, they are Meshy community." The mining machines stay owned, because we generated them through
  the Meshy API with the owner's approval. Nothing in the game changes.

## 0.8.0 (2026-11-06)

Highlights:
- **Bots play the objective.** CTF bots go for the flag: captures over the 44-map CTF suite went from 21 to 145, and
  bots no longer stand about.
- **Shots pass through arches, windows and holes.** 207 props got collision built from their real shape.
- **Smoother big matches.** On an M1 Pro, Shingle Point went from 21.8 to 17.3 ms a frame and Market Town from 22.1
  to 17.6 ms. Every body in a mass blast is thrown.
- **Looks right.** No texture or prop flicker, far enemies are drawn whole, and a less toy-like world: our own grass,
  flowers, rocks, pebbles and ferns.
- **Characters.** Eleven new characters and a WWII tank, pistols held deep in the hand, re-tuned hands, and a HUD
  portrait that follows Random characters.
- **Maps and MapMaker.**
  - Shingle Point has new assets.
  - Set pieces arrive: a Collegiate Gothic carriageway and an enclosed skybridge.
  - MapMaker shows where you can build, and lets you put floors over tall pieces.

**Hands round 5: support hands, big hands, the Knight's gauntlets, the Spear** (owner-approved, 2026-11-06)
- **The Spear, the Medkit and the Medi-Beam in first person**: the hand closes round the shaft and the handle again.
  The new pistol hold (below) had turned and closed them as a raked pistol grip, their fingers sticking straight out
  over the shaft and splayed in the air above the Medkit's handle; it now holds only two-handed pistol grips.
- **Support hands** on 14 looks (Pharaoh, Gorgle, Luther Vanguard, Croakley, Big Bab, Desert Ranger, Stealth
  Operative, Tactical Soldier, The Masked Figure, Anoobys, Greyfang, Kenji, Seetah, WWII Infantry): their own grip
  settings were tuned before the palms were read the right way round (2026-11-05). On a pistol the support hand now
  wraps round the shooting hand instead of hanging back under the wrist; on a rifle it holds the handguard; where a
  shooting hand hung off a rifle's grip it sits on it. Gorgle's shooting hand closes on the grip (it was measured a
  fist and left rigid, an open claw).
- **Frost Viking and the Goblin Warlord**: hands about 20 cm long (they were 24-28 cm and fanned like claws), their
  fingers brought together as they close, so a pistol grip shows between them in first person and their fists sit on
  the grips. **Bamboo** holds a rifle at its chest, not across its snout.
- **The Iron Knight's gauntlets** close round the grip (they were measured thick and closed only half way) and its
  fist sits on a rifle's grip.
- Team tools: `fixes.hands.together` (a fanned hand's fingers come in toward the middle finger as it closes, every
  view); a hand scaled at import with the download's own fingers takes its finger joints with it; the grip audit
  curl-tests a rifle's support hand against the handguard's line (`CURL=points`: as before).

**The HUD portrait follows your body** (owner's report, 2026-11-06: playing the hooded figure with Random characters on, the portrait bottom left still showed the panda picked in the menu): with Random characters, each new life's character now shows in the HUD portrait.

**Set pieces, part 1: placed as one, made of the ordinary pieces** (owner-approved plan, docs/SET_PIECES_PLAN.md)
- **Maps can hold set pieces** (map format 27, `setPieces`): a carriageway or a skybridge placed as one, turned and
  mirrored, themed by a role pack. It is stored as one entry and becomes its parts (ordinary tiles, blocks, doors and
  lights) when the map loads, so play, the server, bots, collision and the flicker clipping see ordinary pieces. Older
  maps load as they were. MapMaker's Set pieces tab, placing and Explode come in part 2.
- **First pieces:** the Carriageway (one cell wide) and the Wide Carriageway (two, on a central column), a vaulted
  passage under a building with a shallow segmental stone arch at each end, a door into the building on each side and
  a room over the arch; the Skybridge in 2, 3 and 4 cells, enclosed, with windows down both sides, between two
  buildings' upper floors and nothing underneath. Shots, players and bots go through every arch and doorway.
- **New building pieces for every map:** the Segmental arch wall style and the Vaulted ceiling room option (a shallow
  barrel vault with stone ribs).
- **Collegiate Gothic** look for St. John's (grey lannonstone, dressed limestone trim, granite setts, oak, slate), and
  a look for each Style Pack.
- Team tools: `content/setpieces/` (pieces and role packs) with `node tools/content/setpieces.mjs` in
  `pnpm content:check` and `pnpm content:rebuild`; the shared commands MapMaker will use (place, move, turn, mirror,
  delete, explode, save a selection as a piece).

**Pistols sit deep in the hand** (owner's report, 2026-11-05: "Looks as if their fingers are just pinching the grip")
- **First person, every pistol-class gun, every character** (full body and arms only): the shooting hand takes the
  grip deep in the palm, the web of the thumb high on the backstrap, the fingers wrapped round to the grip's far side
  and the index finger at the trigger; the support hand wraps round the shooting hand's fingers, its thumb forward
  along the frame. Before, each hand's palm went on the middle of the grip, so the knuckles stood 2-3 cm ahead of the
  front strap and the fingers closed round the trigger guard, and the support hand lay beside the grip, thumb up.
- **Guns held by the wrong spot**: the Machine Pistol was held by the end of its wire stock, 11 cm behind its grip, and
  the Freeze Ray inside its trigger guard; the Hand Cannon by its grip's front edge, the Flare Gun and the Grapple by
  the foot of their raked grips. Each is now held on its own grip, in first and third person (the Gilded and Pulse
  Pistols' points re-read too; the Machine Pistol sits 4 cm nearer the eye, so the hands are where the other
  pistols' are).
- **Third person**: a pistol sits by the middle of the hand's width (a Meshy hand's palm point can sit well toward a
  finger).
- Team tools: `view.hold.rake` (a pistol grip's lean, which the hands' knuckles follow); `__grips.pistol(...)` tunes the
  first-person hold live on the grip page; `__grips.drawn()` also says where each hand sits on the gun (`atR`, `atL`)
  and how far the shooting fingers wrap round the grip (`wrapR`).

**Far enemies drawn whole again** (owner's report, 2026-11-06: "I see enemy in distance not fully there, only feet")
- **Characters no longer lose their upper body**: after a fight, a character that left your view and came back (in a
  big match characters out of view sleep and wake when seen again) or a body reused for a respawn could be drawn as
  legs only, mostly far off and running. The shot and hit clips a fight keeps ready (paused, at no weight) were
  started again on waking; the engine's clip blending then divided zero by zero for the upper body's joints, and a
  far character, animated only every few frames, kept that pose (and the aim measurement it spoiled kept a running
  body's upper half gone until it next stood still). Waking now restarts only what sleep paused, a clip at no weight
  never joins a blend, and the animator never keeps a measurement that isn't a number.
- Team tools: a unit test of the blend, and the characters test now checks, in a 27-player match after a fight and a
  turn away and back, that every character past its low-detail switch draws each part's low-detail mesh and its whole
  body (drawn bounds near its full height, every vertex a number).

**Performance round 3: big open maps** (the owner's Shingle Point recording on an M1 Pro, 2026-11-05;
docs/PERF_96.md, "Performance round 3")
- **Big maps draw about half as much**: in a 49-player fight on Shingle Point's beach the frame now makes about 490 draws
  and looks at about 470 meshes (from 1,030 and 1,310); Market Town looks at about 300 meshes (from 510).
- **Props drawn in batches**: on maps with many copies of a prop (Shingle Point's trees, grass, flowers, crates), a
  model's copies are drawn in batches per 128 m square instead of one by one, with the same tints, levels of detail
  and shadows. Props that break or ride a mover are drawn as before; collision is unchanged.
- **Ladders, jump pads and bomb sites** are merged per square (Shingle Point's six ladders were 86 draws a frame).
- **Fog no longer draws the view twice**: on high graphics it reads the depth the ambient occlusion already writes
  (about 400 draws a frame fewer on Shingle Point).
- **Shadows kept while you look around**: the shadow cascades now stay put as you turn (they are centred on you) and
  are drawn again only after you have walked a few metres (a full turn drew them again 30 times in 24 frames; now 3).
- **Big matches**: a held gun and a pickup's model are one mesh each (they were three to five), team markers are drawn
  together per colour, blood splats as one batch.
- **No shader builds mid-match**: the guns and characters of the match are drawn once in view while the loading screen
  is up (out of sight if the game starts first), so every pass that will draw them builds its shaders then; so are
  your own first-person copy of each gun, a shot's tracer, parachutes and gliders, and water's splash drops (the
  owner's 55 s hitch on Shingle Point built 8 shader programs mid-fight).
- **HUD**: the minimap draws only the part of the map around you, from a ready image, and only when something on it
  moved (Shingle Point's minimap was most of the HUD's 0.7 ms).
- **Mass casualties**: a big blast's bodies start a few per frame (nearest first), small far bodies get the light
  ragdoll and bodies that have landed stop being simulated sooner. **Every body a blast kills flies with it**: when
  the starts were spread over several frames on a slow frame rate, the last bodies lost the blast's push and dropped
  where they stood (23 of 30 in a test on a slow machine; now none).
- Team tools: `?perfoff=propbatch,fogprepass` for comparisons; the physics test checks that every body a blast kills in
  view is thrown out and up (with screenshots before and after); unit tests for props keeping their flush and hung
  lifts in batches and for the one-mesh copies.

**Shingle Point: new assets, same battle** (owner, 2026-11-05: an asset refresh, layout and gameplay kept)
- **Landing craft, wrecks and hedgehogs** are real pieces now instead of grey blocks: four landing craft at the
  waterline, six rusted wrecks sunk in the sand and 46 Czech hedgehogs of riveted steel angles. The craft and wrecks
  block exactly what their blocks did (to the centimetre); a hedgehog blocks as its three beams, so a crouching
  player finds a little more cover on the beach.
- **Our own nature and props**: the beach's logs are squared obstacle timbers, the rowing boats wooden dories, the
  bluff's barriers sandbag stacks, the village's hay bales straw bales and its woodpiles timbers (they now stop
  rounds); trees are our oaks, bushes our shrubs (they hide you as before), wildflowers and wheat our meadow flowers
  and dry grass, rocks our boulders, rubble our pebbles; tall hedges, crates, lamp posts, carts and the crumbling
  walls come from our in-house, owned and CC0 packs. Breakable pieces stay breakable. The furniture indoors stays for
  now (it breaks; ours doesn't yet).
- The bunkers wear the Military Compound look (no more hazard stripes) and the machine-gun nests' walls burlap.
- **No more draws**: the new pieces, the box hedge and the hay cart are one material each (their colours painted on),
  so all copies of one share a draw call and each is one instance; over ten views of the map 3 % fewer draw calls and
  16 % fewer meshes than before.
- MapMaker's **Replace all** can keep a piece's length (rows of hedges stay closed) and turn the new pieces a quarter.

**CTF bots go for the flag; no bots standing about** (owner's reports, 2026-11-05/06: "no bots are actually going
for the flag, most just hang out and do little"; Diamond Park, "most of the team hung out in the tunnel/dugout
area"; Fernwood Moon, "why would some bots not be moving at all?"; docs/BOTS.md, "Capture the Flag" and "Standing
still")
- **Roles as the owner set them**: 2 defenders a team (3 on teams of 12 or more), everyone else attacks; the
  attackers nearest a carrier escort it home; anyone near their own flag when it's taken or dropped goes after it.
- **Attackers keep to the flag**: they no longer run off after noises or enemies that slipped away (unless within
  12 m), take cover only when hurt, fight on the move, sprint to the flag and spread over the map's routes. Carriers
  sprint home and shoot back at anyone close, and keep watch round their base while their own flag is away. A bot
  with only a pistol grabs a gun on its way. Out of the transport plane, bots come down where their role sends them
  (defenders by their own flag), open the canopy straight away and steer it in (Eagle Spires' attackers landed on the
  cliffs under the enemy flag).
- **A flag dropped into lava goes home at once**, as one lost over the void does (rule change, for players too:
  Cinder Foundry's lay in its lava pit all match, taken and dropped by one carrier after another).
- **Nobody stuck where they can't get out**: Diamond Park's dugouts (three spawn points a side; bots that spawned
  there never left: the roofs were too low over the steps at the dugout ends, so the dugouts were cut off from the
  bots' navmesh; raised 0.4 m in MapMaker), Capitol Mall's reflecting pool, a goal on a ledge, Fernwood Moon's
  Garrison spawning in its bunker with only the enemy's door on its way, doors that a crowd of bots opened and shut
  again, a vehicle parked in the way, a ladder left halfway up, a queue at a lift.
- **Holding a spot looks alive**: defenders, escorts and bots told to hold walk between places round their spot,
  watch the way the enemy comes, glance about and crouch; campers shift and peek; bots waiting for a lift look about.
- **Iron Compound's main gate opens again** (its buttons opened and shut it in the same press, for players too;
  fixed in MapMaker). **Fernwood Moon**: the bunker's reactor core moved half a metre so the Garrison can leave by
  its rear door. **Sandfall Colosseum**: a spawn point inside the stand's steps moved out of them. MapMaker and
  validate-map warn about rules on one event that undo each other, and about spawn points inside something solid.
- Team tools: `pnpm bot-report` (what every bot did and why it stood still, per map; before/after compare).
- Measured over every CTF map (44 maps, two five-minute matches each): captures 21 → 145, matches with a capture
  17 → 55 of 88, maps with a capture 13 → 31, flag takes 77 → 906; bots standing still out of a fight 17.9 → 5.6 %
  of their time, idle spells of 10 s and more 19 → 2.7 a match. Diamond Park: 0.5 → 1.5 captures and 2.5 → 19.5
  flag takes a match, idle 32.9 → 3.1 %. Team Deathmatch on Fernwood Moon: idle 23.0 → 7.6 %. Bot thinking at 96
  bots stays within its 2.5 ms a tick.

**Rounds go through arches, windows and holes** (owner's report, 2026-11-06: bullet holes in empty air inside a stone
arch and a ruined wall's window on Fogbound, and under a giant root on Fernwood Moon, with puffs in the air by the trees)
- **Openings are open**: arches, windows, holes, doorways, gates, the space under tables, beds, bridges, stalls and
  balconies, the inside of tents and boats and the wide gaps in fences (0.5 m and up: bars closer than that still stop
  rounds) no longer stop rounds or players. 134 props now collide with
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
  (47 trees and poles). This was the Fernwood Moon screenshot: its broadleaf trees and pines, and the boxes round
  its mossy stumps and logs (up to 1.2 m off the stump), which now follow their shape too.
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
