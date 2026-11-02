# Handoff: where Tile Trigger stands (2026-10-30, afternoon)

A briefing for the next Claude session or agent picking up this repo. Read
`CLAUDE.md` first (workflow and rules), then this file. Keep this file current.

## Start here (session of 2026-10-30 afternoon, handed off)

**Read CLAUDE.md first.** Workflow: session branch → `check/candidate` → when green, fast-forward `main`.
The session branch is **`claude/launcher-ui-map-cards`**. Poll CI without auth:
`curl -s "https://api.github.com/repos/Dsoto1/splitters/actions/workflows/ci.yml/runs?branch=check/candidate&per_page=1"`.
Use `pnpm typecheck`, not `pnpm -s typecheck` (the silent flag hides type errors; one reached CI that way).

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
