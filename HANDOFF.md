# Handoff: where Tile Trigger stands (2026-10-29, evening)

A briefing for the next Claude session or agent picking up this repo. Read
`CLAUDE.md` first (workflow and rules), then this file. Keep this file current.

## Start here (session of 2026-10-30, handed off to a new account)

**Read CLAUDE.md first.** Workflow: session branch → `check/candidate` → when green, fast-forward `main`.
The session branch is **`claude/launcher-ui-map-cards`**. Poll CI without auth:
`curl -s "https://api.github.com/repos/Dsoto1/splitters/actions/workflows/ci.yml/runs?branch=check/candidate&per_page=1"`.

### Where things stand
- **On `main`** (green on CI):
  - the perf96 drawn-frame fix and the hostcontrols End-match double click;
  - `wip/bot-manager`;
  - High graphics no longer blurry (the sun-ray pass at full size);
  - bodies without a ragdoll fall under gravity;
  - `wip/character-intake` (24 new Meshy characters and hand fixes);
  - `wip/host-handoff` (the second friend rejoins the successor);
  - universal first-person arms for Brass Hare, Teddy and Saint Nick.
- **Also on `main`** (`d6ecee1`, green):
  - `wip/weapons-variety`: the owner's weapon and turret models, the Battle Axe, random pickups and "Mix up weapon pickups";
  - `wip/roster-cleanup`'s first two commits;
  - the ladder path fix.
- **Also on `main`** (`4176d3d`, green): `wip/pause-safari` (wider pause menu, Safari look filter, zoom sensitivity).
- **Also on `main`** (`384ffe7`, green): `wip/impact` (batch 2): stopping power, bigger explosion knockback, tiered ragdolls (full, cheap, posed; a body pool; a budget of awake bodies; `pnpm perf:mass`), unarmed punch and kick (Universal Animation Library clips), and Arena-tagged bots hopping only in fights on the "Mixed" style. **No agents are running; every requested branch is merged.**
- **On `wip/bot-vehicles`** (not merged; full CI not run yet): bot vehicle sense (`bots/vehicles.ts`, `brain.ts`; tests in `test/botVehicles.test.ts`).
  - Stuck drivers back out for 1 s, then get out if still stuck within 3 s, and avoid that vehicle for 30 s.
  - Riders leave a stuck bot-driven vehicle; everyone leaves a burning one.
  - Enemies in vehicles: bots prefer launchers (aimed low at the hull), throw grenades at a stopped one, fetch a launcher within 30 m, take cover when they can't hurt it, and dodge one driven at them.
  - The sim has no roll or pitch on vehicles, so "flipped" isn't detected; a wedged vehicle is caught by the headway check instead.
  - Merge it through `check/candidate` (the shared sim changed, so CI runs the full suite).
- **Open items:**
  - `perf:mass` classes some deaths as out of view when they are on screen; check the view test before trusting its tier counts;
  - kick and flinch feel not judged by eye yet;
  - Safari look: the owner tests it; if it is still off, ask for `window.__lookStats` from the console.
- **`wip/weapon-wheel-mobile`** (not merged yet; needs a `check/` run): the weapon wheel (`game/weaponWheel.ts`; hold Q, a tap keeps the last-weapon switch; hold Y on a controller; Options → Controls rebinds the key) and touch controls for phones (`game/touchControls.ts`, `touchDevice.ts`; every on-screen button is `InputState.virtualKey`, the pad `setTouchMove`, look `addTouchLook`, and `touchEngaged` stands in for pointer lock). New e2e flow `mobile` (Pixel 7 landscape, CDP touches). Pad-middle tap vs hold is decided from the events' timestamps, since a slow software-rendered page handles the lift late. Not judged on a real phone yet: the button layout, look speed (`TOUCH_LOOK`) and the 16-player phone host cap are first guesses.
- **`wip/fp-grips`** (not merged; needs a `check/` run: characterAnimator.ts maps to the full suite): first-person grips on big guns. The support hand used to stop short of launchers, the Singularity Cannon, the Spin Gun and sniper rifles and float in front of them; with a Meshy character's own arms (forearms cut at mid-length) it was a hand on a horizontal stub near the top middle of the screen. Cause: the arms hung from the camera by the character's own build (a hunched cat's shoulders sat 0.43 m in front of the eye, at about the height of the handguard, so the forearm ran sideways), and nothing handled a point out of reach. Now `gripPlaced` sets the shoulders from the view (`FP_SHOULDER`), brings a shoulder forward as far as the arm needs (`FP_SHOULDER_REACH`), slides the support hand back along the handguard first, and turns it to cup the handguard (`cupHand`). Third person unchanged. Check a grip with `?mode=grips` and `__grips.miss()`. Left alone: the Salamander Warlord's big claws still cover small pistols and poke above some guns (hand size, a content fix).
- **Not merged on purpose:** roster-cleanup's WIP commit 899537c (helmets worn on four looks; fit values are guesses, never checked visually). Finish the helmet fits (Commando, Engineer, beret and headband heights, Farmhand hat, Drifter mask, Dapper jacket weights) on a new branch.
- **Owner to-dos:**
  - run `sudo tiletrigger-update` on the box after each `main` update;
  - send Boglurker's original FBX (right hand not skinned);
  - review the new characters (section 4);
  - confirm the Plains Scout model is respectful.

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
  - the buggy (`Tactical_Off_Road_Bea`) and its wheel (`Rugged_Off_Road_Tire`), to replace the jeep;
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
  and the Medkit/Medi-Beam. New weapon: Battle Axe (heavy melee, haft-barrel alt). The Styloo MAC-10 and AWP and the
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

Ragdolls (asked 2026-10-29): no neutral pose, no soft joint limits, no muscle tension. `game/ragdoll.ts` uses Rapier spherical joints with no limits or motors, and damping only (linear 0.6, angular 1.6, `shared/sim/effectsPhysics.ts`). Not started.
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
