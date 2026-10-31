# Changelog

Tile Trigger uses [semantic versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
Until the public launch (1.0.0), a minor bump marks a release with new features
and a patch bump a fix-only release. The version shows on the main menu
(`packages/client/package.json`). Each release is a git tag `vX.Y.Z` on `main`,
made only on a commit that passed CI on a check branch.

## Unreleased

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

**Maps**
- New map: **Saltmarsh Harbor**, a working fishing harbour for 12–24 players (Deathmatch, Team Deathmatch, Capture the Flag, King of the Hill), the demo of Style Pack 11. The Embers hold the net sheds in the south-west of the town, the Tide the end of the east mole. Fight along the quay and through the fish market, out along the pier to the breakwater, over the boardwalk to the lighthouse, or straight across the harbour on a jet ski or swimming, and climb out by the sea wall steps, the slipway, the beach or a ladder. Snipe from the lighthouse gallery or the crane. Made in MapMaker.
- New map: **Market Town**, a walled medieval market town for 8–24 players (Deathmatch, Team Deathmatch, Capture the Flag, King of the Hill), the demo of Style Pack 10. The Embers camp outside the south wall, the Tide hold the churchyard round the bell tower. Through the gate (raise or drop its portcullis; a ladder to its roof) or the gaps at either end of the wall, over the stream by one of three stone bridges, up the high street to the market square and its hall. Fight room by room through half-timbered houses whose upper floors open into each other and onto a walkway over the street, climb outside stairs onto the red tile roofs, and hold the watchtowers or the bell tower over the whole high street. Made in MapMaker.
- New map: **Sunken Kingdom**, a partly flooded sandstone oasis city for 16–32 players (Team Deathmatch, Capture the Flag, Deathmatch, King of the Hill; Elimination, Fort Wars and Zombies too). A ruined palace round a circular arcaded courtyard sits in the low town; the western colonnade looks down from its cliff over the turquoise lagoon, the eastern gatehouse holds the road, and the market arcade, the north spring and gate and the stepped temple stand on the upper terraces, with falls pouring into the lower courts. Three loops on the surface (the northern terraces, the palace ring, the southern water courts) and the buried cistern underneath, from the west stair court to the east, with rockets in its flooded hall. Made in MapMaker from the owner's brief and reference picture.

**MapMaker**
- **Style Pack 11 Coastal Harbor** (from the owner's Coastal Harbor tileset sheet): 20 pieces (Timber Pier, Pier Head, Boardwalk and its corner, Quay Wall and its corners, Sea Wall Steps, Slipway, Shingle Beach, Harbour Basin, Breakwater, Harbour Warehouse, Net Shed, Harbourmaster's Office, Fish Market, Lighthouse, Harbour Crane, Harbour Arch, Quayside), 18 props of our own (bollard, capstan, lobster pots, buoys, net rack, fish stall and boxes, fishing boat, anchor, rope, lamp post, life ring, nets, gull, tide board, mooring dolphin, tyre fenders), a Coastal Harbor theme, new materials (pier decking, quay granite, harbour setts, shingle, sea bed, rusty and blue corrugated iron, tarred boards, harbour render, lighthouse bands, harbour paint, lamp glow), Harbour render and Tarred timber facades, and **Harbour Water** (deep enough to swim, 1.5 m under the quay).
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
