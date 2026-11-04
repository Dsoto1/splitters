# Characters

Players, Player Bots and NPCs are animated characters built from CC0 parts by
Quaternius, plus whole-body Meshy characters (see "Adding a Meshy character") (see [`ASSET_SOURCES.md`](ASSET_SOURCES.md)). Nothing is generated:
every mesh, texture and animation comes from a human-made pack, and players
express themselves by combining parts and colourways.

## The rig standard

- One 65-joint humanoid skeleton (Unreal-style names: `root`, `pelvis`,
  `spine_01..03`, `neck_01`, `Head`, `clavicle/upperarm/lowerarm/hand_l|r`,
  fingers, `thigh/calf/foot/ball_l|r`). The joint list is recorded in
  `content/characters.lock.json` (`rigJoints`).
- Two body types, `male` and `female`. Every part is rebound to its body's
  "Regular" bind pose, so any head, hair and outfit for that body share one
  skeleton.
- Models stand on their origin facing +Z, in metres.

## Parts (`packages/client/public/characters`)

Everything in the free editions of the four packs is used: both base bodies,
every outfit part, every hairstyle, every colourway and both mannequins.

| Files | Slot | Notes |
|---|---|---|
| `rig.glb` | — | Male mannequin and skeleton with 20 clips from Universal Animation Library 1 + 2. Also the male NPC body, tinted to the faction colour |
| `mannequin_f.glb` | — | Female mannequin (Animation Library 2), rebound to the rig; about half of each NPC squad uses it |
| `head_male`, `head_female` | head | Cut from the base bodies (including eyes and eyebrows) |
| `athlete_torso/legs/feet_m/f` | torso, legs, feet | The base bodies below the neck (sportswear), cut along the same regions so they mix with outfit parts. The torso includes the arms and hips |
| `ranger_arms/torso/legs/feet/hood/pauldron_m/f` | arms … pauldron | Ranger outfit parts |
| `peasant_arms/torso/legs/feet_m/f` | arms … feet | Peasant outfit parts |
| `hair_simpleparted`, `hair_buzzed`, `hair_beard` | hair | Male; a look can wear hair and a beard. The beard's file is no longer loaded: `gear.ts` (`BEARD`) builds a full beard on the face instead |
| `hair_long`, `hair_buns`, `hair_buzzedfemale` | hair | Female |
| `textures/*.jpg` | — | Shared base colour maps: `ranger`, `peasant`, `skin_m/f`, `athlete_m/f`, `hair_1/2`, and the colourways `ranger_moss`, `peasant_dusk`, `athlete_light_m/f` |

Gear (`GEAR` in `looks.ts`, built by `packages/client/src/content/gear.ts`) is fitted to the wearer: the head and
hair are measured in the bind pose into a map of how far the surface is from the skull's middle in every direction
(`headFit.ts`, `HeadMap`); caps, berets, beanies, the wide-brim hat, headband, mask and goggle strap are surfaces laid
over that map (with thickness), shades sit on the nose bridge and reach back to the ears, and hair a hat covers is cut
away. Helmets are textured models (`public/gear/`, `tools/content/prepare-gear.mjs`, `content/gear.json`) seated by
`fitModel`: the smallest size and lowest seat that keep the skull clear of the shell's inside, its rim over the eyes
at the brows (a deep shell is made a little shallower). Head gear and helmets hang on the Head joint, so full-body
first person's head cut hides them. Check a change by eye: `?mode=grips`, `__grips.pose(look, weapon, 'third')`
then `__grips.head(alpha, radius, beta?)`.

Parts carry no textures of their own: the game assigns the shared maps by
material name (`textureFor` in `looks.ts`), so a texture downloads once however
many parts use it.

Clips: `idle`, `aim_idle`, `walk`, `run`, `sprint`, `jump_start`, `jump_air`,
`jump_land`, `death`, `hit`, `shoot`, `reload`, `melee`, `melee_heavy`,
`interact`, `dance`, `knockback`, `throw`, `cheer`, `idle_arms`, `jab`,
`hit_head`. `jab` (Punch_Jab) and `hit_head` (Hit_Head) come from Universal
Animation Library 1 Standard (CC0), added with `node
tools/content/add-rig-clips.mjs <UAL2_Standard.glb> <UAL1_Standard.glb>`; the
cross is `melee` (Punch_Cross). Neither library's free edition has a kick, so
the unarmed kick is procedural (`characterAnimator`: the right thigh swings
up, the body leans back).

## Looks

A look (`packages/shared/src/content/looks.ts`) is made of:
- a body type and a head;
- outfit parts (at most one per slot; the first carries the skeleton);
- hair (any number);
- colourways;
- a skin tint and a hair tint, multiplied over the textures.

The part-built presets (the originals) wear these outfits; the Designer
offers every part, hairstyle and colourway, and a unit test keeps it that way:

| Preset | Made of |
|---|---|
| Ranger, Huntress | Full ranger outfit |
| Warden, Scout | Ranger in moss |
| Farmhand, Sprout, Medic | Peasant |
| Tracker, Pathfinder | Ranger top with peasant trousers |
| Drifter, Wayfarer | Peasant with a ranger hood |
| Brawler | Shirtless with peasant trousers and shoes |
| Bulwark, Commando, Frost, Operative, Sentinel | Ranger, dyed |
| Engineer | Peasant, dyed |

Retired presets (Champion, Desperado, Miller, Raider, Sprinter, Striker) resolve
to a kept look (`RETIRED_LOOKS` in looks.ts), so saved choices still load.

Players pick one on the main menu (remembered locally). It's sent in `hello`
and carried in the roster, so every client sees it. Bots get a spread of looks;
unknown IDs fall back to the default.

### Character Select's groups

Character Select sorts characters by what they are, not by how the look was
built. The groups are `CHARACTER_GROUPS` in looks.ts (section order and labels);
every built-in look names exactly one, and a unit test
(`packages/shared/test/lookGroups.test.ts`) keeps it that way:

| Group (`id`) | Who |
|---|---|
| Soldiers (`soldiers`) | Modern and sci-fi military, agents, pilots, hazmat, astronauts: Agent Zhao, Bulwark, Capt. Nova, Commando, Desert Ranger, Dust Trooper, Flt. Lt. Ember, Frost, Grunt '68, Hazmat, Medic, Operative, Scout, Sentinel, Sgt. Pruitt, Space Marine, Trooper (NPC skin), Vanguard, Warden |
| Knights & Legends (`legends`) | Medieval, royalty, monks, wizards, mythic and historical warriors: Anubis, Ashwalker, Brother Ansel, Elder Tomo, Grizzelda, Iron Knight, King Aldric, Lancer Mei, Linktifa, Merrow the Wise, Old King Halvard, Ser Brannock, Shade, Sir Galloway, Thornweaver |
| Everyday Folk (`folk`) | Ordinary people: Big Bogdan, Biker Gang Girl, Brawler, Cap'n Barnacle, Chef Basile, Dale, Drifter, Dusty Colt, Engineer, Farmhand, Grandpa Chains, Hector, Huntress, Pathfinder, Saint Nick, Sprout, The Dapper, Tracker, Uncle Bao, Wayfarer |
| Undead & Horror (`horror`) | Bonejack, Count Bonesworth, Fearsome Undead, Giggles, Gorgle, Groaner, Lurcher (queued), Punkin, Rattles, Rotter, Shambler, Spiked Skeleton Biker |
| Animals (`animals`) | Bandit, Barnaby Bruin (queued), Big Bab, Biscuit, Brass Hare, Croakley, Greyfang, Hyena Warrior, Scamp, Shiba, Teddy, Wealthy Otter |
| Creatures & Machines (`creatures`) | Aliens, goblins, reptiles, robots, monsters: Boglurker, Botboy, Emerald Robot, Goblin, Imp and Puglin (NPC skins), Ivory Rustwalker, Ricochet, Salamander Warlord, Snikkit, T-350, The Hollow Visitor, The Visitor |

Where a group comes from: a part-built preset has `group` on its entry in
`CORE_LOOKS`; a whole-body character has `group` in its manifest (below,
copied into characters.generated.ts); an NPC skin gets it from
`NPC_LOOK_GROUPS` in sim/npc.ts (creatures → Creatures & Machines, the zombie
→ Undead & Horror, the soldier roles → Soldiers). `lookGroup(id)` reads any of
them; a design of yours has none and goes under **Yours**. The screen is one
grid that scrolls through the sections in that order (each group with anyone
in it, its characters by name, then Yours with **Design new**), each under a
compact header with its count. The jump strip above lights the section in
view; a chip, or Q / E (LB / RB), scrolls to a section. Arrow keys and the
d-pad cross from one section into the next.

Picking: a click (tap, Enter, controller A) on a portrait **shows** that
character (the big model, bio, loadout); hovering only highlights it, so the
mouse is free to drag the model round. Only **Choose** (the button, Enter / A
again, or a double-click on the portrait) makes them yours; Back (Esc / B)
leaves your character as it was. Your current one wears a **Chosen** badge.
Character Select opens from Profile (the main menu's Profile entry → **Change
character**) or Online; Back and Choose return there.

## Character Designer

Character Select → **Design new** (D / controller X), or **Customise** on a part-built look (or `?mode=designer`).
Players choose:
- a body;
- one part per slot (top, arms, trousers, feet, hood, pauldrons);
- hair and beard, with a hair colour;
- colourways and a skin tone (swatches or any colour).

A live preview idles, runs or dances, holding a weapon of the player's choice. Each
change rebuilds it from the shared parts.

How custom looks are stored:
- **Saving:** looks are saved in the browser (up to 24) and listed under "Your characters" in the Character picker.
- **ID format:** a look travels as a 22-character ID (`encodeLook`): `c1-`, the body, then bitmasks of parts, hair and colourways in catalogue order, then the two colours.
- **Validation:** the server and every client decode the ID with the same `decodeLook`. Anything malformed or unwearable becomes the default look.
- **Catalogue:** `CHARACTER_PARTS`, `HAIR_STYLES`, `COLORWAYS`, `SKIN_TONES` and `HAIR_COLORS` in `looks.ts`. A test keeps `CHARACTER_PARTS` equal to the shipped parts.

Mixing rules (`lookProblems`; the designer shows them and won't save until they're met):
- The athlete torso includes bare arms, so it doesn't take an `arms` part.
- A look needs a top, trousers and feet, and arms unless the top is sportswear.
- Low-rise trousers (female peasant) show the sportswear waistband above them.
- Athlete feet are bare feet only (no shins), so they pair with athlete legs.

## Animation in game

`CharacterAnimator` (client) drives each character from interpolated snapshots:

- **Legs:** crossfaded loops chosen by speed and airtime (aim idle, the
  upright gait, crouch, prone, airborne). Moving starts above 0.6 m/s and
  stops below 0.45 m/s, so the legs don't flicker at the edge.
- **Gait (`gait.ts`):** walk, run and sprint are one blend. Walk turns into run
  by speed (all walk below 1.2 m/s, all run from 3.6 m/s), and the sprint fades
  in over the run while sprinting (or from 7.4 m/s). All three play at the one
  cycle rate that keeps the planted foot still for the speed and body size, and
  a loop joining the blend starts in step with the one already playing (left
  feet down together), so the feet never skip or swap. Each loop's
  planted-foot speed and left-touchdown point are measured from `rig.glb`
  (walk 0.95 m/s, run 5.9 m/s, sprint 9.0 m/s at speedRatio 1).
  `test/gait.test.ts` measures them again from the file, so re-exporting the
  rig with other clips fails the test until the numbers are updated. Running
  pace (5.2 m/s) plays the run at 0.88×, a sprint (7.8 m/s) the sprint at 0.87×.
  The old fixed guesses (run 4.2, sprint 6.5, walk 1.6 m/s) slid the planted
  foot about 40% of the ground speed (measured in the viewer).
- **Strafing and backpedalling:** there are no strafe clips, so the hips (and
  legs) turn toward the direction of travel, up to 77°, and the spine turns
  back by as much, keeping the shoulders and the gun on the aim. Moving more
  than 108° from facing (staying until under 94°) turns the hips toward the
  opposite of the motion and plays the gait backwards. Every turn after the
  clips is about a world axis (`worldTurn`): the glTF import mirrors the
  skeleton, and reading the up axis through a rotation-only inverse wound the
  spine the same way as the hips, so until 2026-11-02 a strafe turned the chest
  about 140° off the aim (the arms wrapped round to a gun still pointing ahead).
- **Third person, your own body:** the gun points at what the crosshair is on
  (`MotionState.aimYaw` and the aim's pitch from `thirdPersonAim`, where the
  host sends the rounds), not along the view beside it; the shoulders turn
  with it. Remote players and bots aim along their view.
- **Authored clip sets (`clips`):** a look can move with clips authored on a
  Meshy rig instead of the rig's gait while it holds a gun upright (below).
- **Upper body:** holds the aim pose while moving, so the weapon stays up.
  One-shots (shooting, melee, reloads) play over it through an upper-body mask.
- **After the clips:**
  - The spine is bent for aim pitch and twisted toward strafing.
  - The weapon is placed and the hands close on it (below).
- **Death:** plays once and holds until respawn. Intermission plays the dance.

Clips are retargeted from the rig onto each character's joints by name. The
hip track is offset per body type.

Remote characters move as smoothly as the snapshots allow (`interpolation.ts`):
the server clock is estimated from snapshot arrivals and each arrival only
nudges the estimate, so snapshots arriving unevenly (network, or the sim
worker running ticks in bursts) don't jerk them about. A late snapshot is
ridden out by carrying on along the last motion for up to 5 ticks, and drawing
never goes back in time. Their speed, and so the gait, comes from these drawn
positions. Crowd animation LOD (more than 24 remote characters) still steps
characters past 45 m every other frame and past 120 m every fourth; nearer
ones animate every frame.

Universal Animation Library 2 (Standard, checked 2026-10-27) has no jog, run,
sprint, strafe or locomotion transition clips (its 43 clips are carry, zombie,
slide, ninja jump, sword, farming and idle variants), so locomotion stays on
Library 1's walk, jog and sprint.

### Authored clip sets (clip retargeting)

A rigged Meshy "All Animations" download carries its own clips on Mixamo-named
joints (Walking, Running, Walk_Forward_While_Shooting, ...).
`tools/content/clip-set.mjs` retargets them onto the rig (`retarget.mjs`):

- **Rest pose compensated per bone:** each rig joint takes its source joint's
  world turn away from the source's rest pose, applied to the rig's T-pose
  re-posed onto that rest pose the way `prepare-meshy-characters.mjs` re-poses
  the mesh (arms, forearms, thighs, shins and feet turned onto the rig's
  directions). On the character the clips came from, every vertex moves as in
  the download; on any other character on the rig the pose reads the same.
- **Root motion stripped:** the hips' straight-line travel from the first frame
  to the last comes off (the game moves the body); their bob and sway stay,
  scaled from the source's legs to the rig's.
- **Measured:** each clip's natural ground speed (m/s at the rig's size) and
  direction from its planted foot, and where its left foot goes down, are kept
  in the file's top node extras; the game plays each at the rate that keeps the
  feet still and joins loops in step.

**Every look on the rig moves with a clip set by default.** `DEFAULT_CLIP_SET`
(`shooter`, packages/shared/src/content/looks.ts; `clipSetOf(look)`) applies to
every look that doesn't say otherwise: the modular looks, Designer looks and
every whole-body manifest, including ones rigged later, with nothing to add to
their manifests. A manifest can name another set (`"clips": "<set id>"`) or opt
out with a reason (`"clips": false, "clipsWhy": "..."`: the rig's own gait). A
rolling body (`locomotion: roll`) has no set. The set's file
(`characters/shooter_clips.glb`, 103 KB) is loaded once, with the first
character that needs it (never with the menu's code), and shared by all.

**Shared sets** (`content/clip-sets/<id>.json`) take each clip from whichever
download does it best: `sources` records each download (model, licence, who
rigged it, its file name pattern), `clips` which clip comes from which.
`node tools/content/clip-set.mjs --build <downloads dir> [<id>]` writes the set
and `content/clip-sets.lock.json`; `pnpm content:build` records its
provenance. A manifest can still carry `clipsFrom` to build a set of its own
download with the character (`prepare-meshy-characters.mjs`, lock role
`meshy-clips`). `node tools/content/clip-set.mjs <download.glb>` lists what a
download's clips would give (speeds, directions).

The `shooter` set (2026-11-02), each clip from the download that retargets
closest to the four downloads' consensus (mean world bone direction against
the others at 24 phases, per region):

| Clip | What it does in game | From | Measured |
|---|---|---|---|
| `clip_walk` | legs, below running pace | WWII Infantry, Walking | 1.53 m/s; legs 2.0° from consensus (others 2.4-3.4) |
| `clip_run` | legs, running | The Hollow Visitor, Running | 4.98 m/s; legs 3.5° (Fearsome Undead 7.5) |
| `clip_shoot_fwd` | upper body with the walk's share | Biker Gang Girl, Walk_Forward_While_Shooting | 0.31 m/s; upper body 2.0° (2.4-2.6) |
| `clip_shoot_run` | upper body with the run's share | The Hollow Visitor, Run_and_Shoot | 2.02 m/s, 0.67 s; upper body 2.4° (3.2-3.4) |
| `clip_shoot_back` | whole body, backing up | Biker Gang Girl, Walk_Backward_While_Shooting_inplace | 0.83 m/s; 3.1° (3.3-3.8) |

Side_Shot (in the three newer downloads) isn't used: it is a 4 s kneeling shot
in place (hips 0.45-0.56 m against 1.01 m standing), no help to an upright
strafe, which already turns the hips toward the motion and the shoulders onto
the aim. Run_and_Shoot is a crouched run (hips 0.87 m) whose legs take short
2 m/s steps, so only its upper body is used, over the Running legs; its loop
(0.67 s) is one stride like Running's (0.63 s), so it plays at about its own
pace at game speeds.

In game (`CharacterAnimator`, armed, upright, on the ground): forward and
strafing (hips turned toward the motion as with the rig's gait), the set's walk
and run play on the legs, blended by speed between their own speeds at one
cycle rate; the upper body plays the shooting walk with the walk's share and
the running shot with the run's (`clipUpperWeights`, in step with the legs: at
the game's 3.9 m/s aiming and 5.2 m/s it is nearly all the running shot);
backing up, the backward shooting walk plays on the whole body, and past twice
its own cadence its stride lengthens (thighs and knees swing up to 2.2× as far
about the clip's middle pose: `strideWarp`) rather than stepping faster. The
arms still go to the gun by IK and the aim, recoil and grips are unchanged;
crouch, prone, jumps, seats, unarmed movement and first person are the rig's.

The downloads' shooting walks are slow combat steps (forward 0.3 m/s, back
0.85 m/s, measured), far below the game's 3.9-5.2 m/s, which is why the legs
come from Walking (1.5 m/s) and Running (5.0 m/s) and the shooting clips hold
the upper body (forward) or are stride-warped (back).

Not on clips: the rolling Baseball Robot (no legs); creature skins (Imp,
Puglin: their own rigs, CreatureAnimator); the NPC soldier mannequins (NPC
roles, `spec.npc`), which keep the rig's gait. No manifest opts out: every
walking look was checked on contact sheets (strafing, backing up and running
while firing, ADS strafing; over the shoulder and from the side, 2026-11-02),
small and large bodies, creatures, animals with tails and the modular looks
alike, and none looked wrong on the clips. A body that does gets `"clips":
false` and its reason in `clipsWhy`.

## Holding weapons

Each weapon's `view.hold` (in its `content/weapons/<name>.json`) gives a
style and points on the model, in model space (+Z barrel, +Y up):

| Style | Weapon placement | Hands |
|---|---|---|
| `pistol` | Points along the aim, its `grip` in the right palm where the clip puts it | Left palm IK'd to `support` |
| `long` | Points along the aim, its `shoulder` point (the butt) in the right shoulder pocket; the shoulders turn into the stock | Right palm IK'd to `grip`, left to `support` |
| `melee` | Carried in the right hand | — |

How the hands close on the weapon:
- Two-bone arm IK runs in the skeleton's own space, because the glTF import
  mirrors the scene above it.
- The hands keep their animated orientation, and the fingers curl toward the
  palm.
- During reloads, melee, throws and hits, the IK fades out and the weapon rides
  in the right hand; it fades back in afterwards.
- The finger joints keep their animation tracks in the clips that hold things.
- **Measured hands** (Meshy characters): the file carries each hand's
  measurements on its hand joint (`extras.hand`, see "Adding a Meshy
  character" below). The palm that goes on the grip is the measured palm
  centre, not the rig's (the middle knuckle x 0.6), and it rests from the grip's
  centre line by half the grip plus half the hand's thickness, so a big hand
  wraps the grip instead of sinking into it or hovering beside it. The fingers
  close as far as the hand allows (`curl`: 0 for a fist or gauntlet that is
  already closed).

### Full-body first person (default)

Options → Display → **First person: Full body / Arms only** (`tiletrigger.firstPerson`, `graphicsSettings.ts`;
applies at once in a match). Full body draws your own third-person character (the avatar the view already keeps
loaded for third person, `hiddenSelf`) from its eyes, `FirstPersonBodyRig` in `game/firstPersonBody.ts`:
- **Placement:** the body stands where prediction has you, animated by your own motion (walk, run, sprint,
  crouch, jump; `View.showFpBody`). After the clips and the spine's aim (the spine bends by only a quarter of
  the pitch, `FP_BODY_PITCH`) the whole body is moved so the base of its neck sits `FP_NECK_BACK` behind and
  `FP_NECK_DROP` below the steady (unshaken) eye; looking down, the neck goes further back, as a tipping head
  carries the eyes out over the chest, so you see your chest, legs and feet, never down the collar.
- **Head:** the neck joint is scaled to nothing each frame (head, hair, hats and anything skinned to them go
  with it), meshes wholly on the head aren't drawn, and a colourless ball where the head would be casts its
  shadow.
- **Hands:** the gun is the same viewmodel as before (bob, recoil, ADS, reload dip, switch timings untouched);
  the body's hands grip it by IK (`gripExternal`), each shoulder starting from its own place on the body and
  coming forward only as far as the arm needs. Copies of the forearm, hand and finger triangles (same skeleton
  and material) are drawn in rendering group 1 with the gun, so the hands never clip into a wall the gun is
  drawn over; the rest of the body is in the world (group 0). A free hand (knife, axe) hangs at your side.
- **Head cut:** besides the shrunk neck, `cutHead` hides the meshes wholly on the head and draws a copy of
  each mesh partly on it without the triangles on the head or (bind pose) above the base of the neck: a Meshy
  character is one mesh, its hat and collar included. A character whose model still fills the view (Grizzelda's
  hat brim) opts out in its manifest, `firstPerson.body: false`, and keeps the arms.
  Shoulder pads (skin on the clavicle or upper arm well out from the upper arm's bone, near the shoulder: the
  Knight's pauldrons) are cut the same way; the arm stays.
- **Shoulders:** a shoulder that must come forward to reach the gun first rolls its collarbone (up to
  `FP_CLAVICLE_MAX`), then the joint moves the rest (which stretches skin, and that's in view looking down).
- **When:** only while the camera is your own eyes. In a vehicle seat, the kill cam, spectating, third person
  or before your character has loaded it falls back to the arms below (built only when needed); scoped, the
  body is hidden with the gun.
- **Check:** `?mode=grips`, `__grips.pose(look, weapon, 'body')`, then `__grips.look(pitch, { speed, stance,
  drop })` (game pitch: + looks up) and `__grips.miss()`; the `characters` e2e flow checks palms in this view.

### First-person arms (Arms only, and full body's fallback)

Your own view shows your look's arms holding the viewmodel:
- **Which arms:** the arms part of your look. Under a sportswear top it's `athlete_fparms_m/f`, bare arms cut from the base body for this view only.
- **Whole-body characters** (the Meshy characters, `content/characters`) wear their own forearms and hands in first person: `<id>_fparms.glb`, cut from the same model (the elbow half of each forearm dropped, sleeves pulled in towards the bone, hands a little smaller so a gauntlet doesn't fill the view), on the character's own fitted skeleton. A manifest can choose a universal arms part instead (`firstPerson: { arms: "ranger_arms_m", skin, cloth, trim }`): a base-body arms part on the shared rig, sleeves dyed and hands tinted to match.
- **Placement:** they hang from the camera at the character's own size, the body a little behind the eyes. While a gun is held, the shoulder joints are set from the view, not from the character's build (a hunched cat's would sit in front of the eyes): beside and below the eye (`FP_SHOULDER` in characterAnimator.ts), so the forearms rise from the bottom of the screen. A shoulder comes forward toward its point on the gun as far as the arm needs to keep a natural bend (only the off-screen shoulder region stretches); the support hand first slides back along the handguard (no nearer the grip than 12 cm) before the shoulder comes further. A hand with nothing to hold (a knife) hangs out of view.
- **Grip:** the gun keeps its tuned viewmodel placement, with bob, recoil and the reload dip. `gripExternal` IKs the palms onto its grip and support points with the same solver as third person; on a long gun the support hand is turned to cup the handguard from below (palm up, fingers round its far side). `window.__grips.miss()` in `?mode=grips` says how far each palm ended from its point (the `characters` e2e flow checks large guns).

**Where hands are drawn:** `gripMiss` and `__grips.miss()` measure the joints. A Meshy hand needn't sit on its
joint as the rig's does (the dapper's lay a quarter turn round), so each measured hand's own frame is read off its
skin (`handProbe.skinHandFrame`) and the hand is turned onto the gun by it (`gripHand`). `__grips.drawn()` and, in a
match, `__cs.view.gripReport()` measure the drawn skin: model metres from each hand's skin to its point on the gun,
`aheadR` (fingers along the barrel) and `sideR` (flat against the grip's side); the `characters` e2e checks both.

To fit a new weapon, read the grip, support and butt positions off a side view
of the model, then check them in `?mode=characters`.

## Level of detail

Every character file except the first-person arms carries a low-detail copy of
each mesh (`<name>_lod`, about 30% of the triangles, same skin and materials). It's
added by `prepare-characters.mjs` and recorded as `lodTriangles` in the lock
file. The game registers each copy as a Babylon LOD level of its mesh and draws
it beyond 18 m (`LOD_DISTANCE`). In the viewer from 30 m, 253k triangles drop to
90k. The copies live in the same file because separate low-detail files loaded
in the background were seen to stall in the browser.

**Whole-body (Meshy) characters' far copy** (`tools/content/character-lod.mjs`): 30% of
the body's triangles (`fixes.lod` sets another share, 0.15-0.6), cut with the texture
coordinates weighed in, so a seam collapses only where the colour layout agrees on both
sides. The old sloppy cut joined triangles across the texture's charts: Saint Nick's far
copy wore white streaks over his red coat (half its triangles spanned a seam; now 5 of
4,800). A mesh that cut can't bring near its share is cut on its shape alone with its
seams welded, each corner taking back the copy in the chart its triangle shares.
`prepare-meshy-characters.mjs` adds it; `node tools/content/relod-built.mjs`
(`ONLY=<ids>`, `OUT=<dir>` for a trial) remakes it in the built files without the
downloads and updates the lock. **Through a scope** the switch moves out with the zoom
(`setCharacterLodZoom`, from the view's FOV against the game's: a sniper scope's 0.4 rad
keeps full detail to about 71 m), so a scope never shows the far copy filling the view.

**Meshy characters' normal maps.** A Meshy body is cut from hundreds of
thousands of triangles to about 11,000, which alone shades as lumpy facets.
`prepare-meshy-characters.mjs` bakes a 512 px (`fixes.normalSize`: 1024) tangent-space normal map from the
surface before the cut (and Meshy's own normal map) into the download's texture
layout (`bakeNormals` in `tools/content/meshy-mesh.mjs`, with a TANGENT
attribute), for the body, its low-detail copy (same material) and the
first-person arms. Characters not rebuilt since (their download or rig task
not at hand) keep the plain cut until they are; HANDOFF.md lists which.

## Tools

- `?mode=characters`: viewer with every look and the male and female NPC
  trooper and heavy in two rows, with buttons for each motion, one-shot and
  weapon, and an aim-pitch slider. `&alpha=`, `&dist=`, `&x=` and `&z=` set
  the camera; `&looks=core.goblin,core.otter` shows just those looks and
  `&creatures=0` hides the creature row.
- `node tools/content/prepare-characters.mjs <downloads dir>` rebuilds the parts
  from the original pack downloads (the free "Standard" editions; about 500 MB,
  so they are not in the repo). The script records every change made to them.
- `pnpm content:check` verifies the shipped files against
  `content/characters.lock.json` (hashes, triangle and size budgets, licences)
  and lists them in `content/provenance.json`.

## Creatures

Creature NPCs (imp, puglin, cyclops, oculus, scolitex; see SCENARIO.md) are
kept apart from the character parts: `packages/client/public/creatures/<id>.glb`,
built by `node tools/content/prepare-creatures.mjs <downloads dir>` from the
Quaternius Bestiary – Dungeon Monsters kit (imp, puglin) and the Modular SciFi
MegaKit's aliens, and checked against `content/creatures.lock.json`.

- **Imp and puglin** share our rig's joint names (minus the pinkies) but ship
  without clips. The script retargets our rig clips onto them: each joint keeps
  its own rest pose and takes the rig's rotation relative to the rig's rest
  pose, and the hips' motion is scaled by leg length. Clips: `idle`, `walk`,
  `run`, `attack` (the imp's is the heavy swing, the puglin's the punch),
  `hit`, `death`.
- **Aliens** keep their own spine-chain skeletons and their one `idle` clip.
  The game leans them into their motion, speeds the idle up as they move,
  lunges them forward to attack, jolts them on hits, and drops and rolls them
  over when they die.
- **The zombie body** (Quaternius' Zombie, CC0) is an FBX with its own
  Mixamo-style rig and clips. `tools/content/fbx.mjs` (`fbxRiggedToGlb`)
  converts it with three.js' FBXLoader and GLTFExporter, renames its clips to
  ours (`idle`, `walk`, `run`, and the first 1.8 s of the bite as `attack`),
  drops still tracks and stands it 1.8 m tall; its palette is embedded as it
  is. It has no hit or death clip: hits jolt it and death drops and rolls it,
  as for the aliens. Its spec's `gait` gives its own clips' ground speeds
  (a 0.3 m/s shamble, a 3 m/s run from 1.4 m/s up). The `zombie` NPC role is
  not a creature role: `zombieHasCreatureBody` puts two in three zombies (in
  Zombies and in co-op squads) in this body, the rest shamble on the
  soldiers' rig with their zombie clips.
- **The creature originals** (goblin, otter, toad, salamander, hyena: models the
  owner generated on their Meshy subscription and downloaded as textured FBX,
  unrigged) are not creature-library bodies: `prepare-meshy-characters.mjs`
  rigs them onto our rig (joints placed by hand from front and side views,
  tails on the hips), so they are
  whole-body looks with every rig clip, and the NPC roles `goblin`, `otter`,
  `boglurker`, `warlord` and `hyena` draw them through their spec's `look`,
  holding the role's weapon like a soldier. Goblins rush in with blades, the
  otter snipes, the boglurker soaks fire with a shotgun, the warlord shells
  you with a grenade launcher, hyenas run you down with SMGs. They have no
  `npc:` skin of their own (players pick the look). `SKIN_DEBUG=<dir>` on the
  script writes each rest mesh coloured by joint to check the weights.
- **The community originals** (Meshy community T-pose downloads, CC0 per the
  owner; see ASSET_SOURCES.md) go through the same in-house rig. Modelled in a
  T-pose, their arm joints sit on one level line, read off slab profiles of
  each limb. Looks: Elder Tomo (robed monk, the robe skinned as cloth), The
  Visitor (grey alien), Biscuit (a tabby cat on its hind legs: tail on the
  hips, digitigrade legs on their centre line; `size: 'small'`), Flt. Lt.
  Ember (flight suit), Cap'n Barnacle (pirate with a peg leg; no foot turn,
  so the peg stays straight) and Big Bogdan (circus strongman;
  `size: 'large'`). NPC roles (appended to `NPC_ROLES`): `alien` (Visitor,
  laser rifle), `pirate` (sawed-off) and `titan` (Strongman, spin gun, 300
  health). The cat's hips sit at 60% of the rig's height, so a body whose hip
  height differs from the rig's by more than 10% has its hip track scaled,
  not shifted (`retarget` in `characters.ts`): with a plain offset its death
  pose lay 0.8 m under the floor.
- **Their skin weights** (`tools/content/autoskin.mjs`) are bone heat: each
  vertex is tied to the nearest bone it can see (the line to it stays inside a
  voxel fill of the body, and the bone is the nearest along the surface too, so
  a hand resting on a thigh stays the hand's), and the weights diffuse over the
  surface from there, at most four per vertex. Rules on top: cloth hanging
  below the hips (aprons, rags, loincloths: `cloth: true`) follows the pelvis,
  with a little of the nearer thigh towards the hem; the clavicles keep only
  the top of the shoulder and the upper arms keep off the chest, so the chest
  stays rigid when the arms move; a head hung low over the chest keeps off it.
- **Stance:** hunched bodies (goblin, boglurker) lean back per spine joint when
  re-posed (`lean`), the head keeping the way it faced, so the shared clips
  stand them up. The hyena's digitigrade legs have their joints on the leg's
  centre line (hock as the ankle, paw as the foot), so straightening them
  turns the thigh and shin only a little. The goblin's rags are hundreds of
  small texture islands: its simplification collapses across seams only where
  the texture matches on both sides (and between them), 19.7k to 11.7k triangles.
- **Normal maps (2026-11-03).** A download's own map is read as its renderer draws it (no TANGENT attribute: each
  triangle's own texture directions); a map we baked (a rebake's) in our own green (`hiGreen`; read as a download's,
  every rebaked face was lit upside down: Cal's cheek line, Sgt. Mackie's wedge); the map we ship is the inverse of the
  shader's interpolated frame (Babylon's vTBN). A download kept uncut (a low-poly one within its budget: Biker Gang
  Girl, Kenji) ships its own map, untouched, with no TANGENT attribute, and its texture's gutters are filled before it is
  shrunk (`padCharts`).
- **Rebaked characters (`surface: rebake`):** some downloads cut their texture
  into thousands of small islands (Barnaby Bruin's coat, Slugger-9's plating, the
  Rusty Mech's baked map): every cut that keeps the texture coordinates stops over
  the 20k budget, and even the careful cut scrambles them in places. These are
  cut on the download itself, before rigging and posing (rebakeDownload in
  prepare-meshy-characters.mjs): the copies of a vertex on either side of a seam
  become one, the full mesh is cut to `triangles` (head 12%, hands 8%, never past
  0.8% of the model's size), laid out afresh in charts grown across shared edges
  while each triangle faces within 60 degrees of the chart's first and never
  overlaps it (meshy-mesh.mjs rebake `grow`; the props' six-axis charts broke a body
  into thousands of slivers), and its 1024 px colour and normal maps are painted
  from the full download (rays along the cut surface's normal, 1.2% of the
  model's size each way). Both maps are in the new layout, so they hold through
  the posing (the normal map is in tangent space). The cut only removes
  vertices, so a rigged download's vertices keep Meshy's skin weights; an
  unrigged one is rigged from the cut mesh as usual. Known limit: where cloth sits
  close over the body (Barnaby's coat tails) the two are cut separately and the
  body shows through in a few small patches.
- **Long guns on deep or short-armed bodies:** the stock's clearance also counts
  the chest straight ahead of the shoulder (a deep chest turned across the
  aim), the support hand slides back along the handguard when the arms can't
  reach, and a stock the arms still can't hold clear tucks out past the
  shoulder (the otter, the warlord) instead of into the chest.
- In game, `content/creatures.ts` (`CreatureLibrary`) loads and instances
  them and `game/creatureAnimator.ts` drives them; `view.ts` uses them when an
  avatar's spec names a creature. No ragdoll: their death plays and the body
  is left as a corpse.
- `?mode=characters` shows the five creatures and the zombie body in a row in front of the
  characters, driven by the same buttons.

- **Not every creature download can be rigged.** The Meshy community "Spiky
  Dinosaur" (a carnotaur-like theropod) is a biped, but its body is level with
  a tail as long again and tiny arms: on the shared humanoid rig the clips
  would stand it up like a person, it couldn't hold a weapon, and the
  player-sized hit capsule would cover a fraction of its 5.8 m length. It
  ships as a stone statue prop instead (`mp_dino_statue`, Jungle Ruins).

## Adding a Meshy character

Whole-body characters are Meshy models: made on the owner's Meshy account
(owned), or Meshy community models under CC0. Each is one manifest,
`content/characters/<id>.json`, and nothing else: the tools read every
manifest, so adding a character needs no code. Raw downloads never enter the
repo; they live in a downloads dir outside it.

### 1. The manifest

```json
{
  "id": "meshy_galloway",
  "kind": "character",
  "use": "player",
  "order": 15,
  "name": "Sir Galloway",
  "look": "core.galloway",
  "group": "legends",
  "nameTheme": "knight",
  "bio": "One line for character select.",
  "body": "male",
  "size": "large",
  "notes": "Anything the next person should know about this model.",
  "source": {
    "license": "CC0",
    "author": "Meshy community (author not recorded; CC0 per the owner)",
    "date": "2026-10-29",
    "url": "https://www.meshy.ai/posts/019fb494-…",
    "community": { "model": "T-pose knight" },
    "file": "^Meshy_AI_T_Pose_Knight_.*_texture\\.fbx$"
  },
  "finish": { "metallic": 0.3, "roughness": 0.5 },
  "firstPerson": { "arms": "own" },
  "fixes": { "triangles": 11000, "feet": true, "hands": { "curl": 0.8 } },
  "landmarks": { "spine": [[0, 0.5, 0], …7 points], "L": […10 points], "R": […10 points] }
}
```

| Field | Meaning |
|---|---|
| `id` | File names: `<id>.json`, `<id>.glb`, `<id>_fparms.glb`. Lower case, `meshy_…`. |
| `kind`, `use` | `character` (rides our rig) or `creature` (not built here: creatures keep their own rigs); `player`, `npc` or `player+npc`. An NPC-only character gets a look (`WHOLE_BODY_NPC_LOOKS`) but isn't on the roster; NPC roles name looks in `NPC_ROLE_SPECS` by hand. |
| `status` | `queued` for a stub that isn't ready: it is checked only for the queue's fields and not built. Drop it once the rest is filled in. |
| `order` | Roster position among the whole-body characters (unique). |
| `group` | What the character is, for Character Select's tabs: `soldiers`, `legends`, `folk`, `horror`, `animals` or `creatures` (see Looks, Character Select's groups). Needed on a player look; the checker's list (`GROUPS`) matches `CHARACTER_GROUPS`. |
| `nameTheme` | What kind of creature it is, for its bots' names (`shared/content/botNames.ts`): `soldier`, `monkey`, `bear`, `wolf`, `dog`, `cat`, `raccoon`, `critter`, `frog`, `pirate`, `knight`, `ninja`, `wizard`, `barbarian`, `undead`, `spooky`, `robot`, `alien`, `goblin`, `cowboy`, `gangster`, `townsfolk` or `myth`. The first bot wearing the character takes its `name`, the rest the theme's names ("Sgt. Dunmore"). Left out: its group's (soldiers → soldier, legends → knight, folk → townsfolk, horror → spooky; animals and creatures → the general names). Every character on the roster has one (a test checks); the checker's list (`NAME_THEMES`) matches botNames.ts. |
| `name`, `look`, `bio` | The look's display name, its ID (`core.<name>`, never changed once shipped: saved looks and bots use it) and its one-line bio. |
| `body`, `size` | `male` or `female` proportions (clips and hip height); `small` / `large` body size, or left out. |
| `source.license` | `owned` (made on the owner's Meshy account; provenance pack `meshy-owned`) or `CC0` (a community model; pack `meshy-community-characters`, with `community.model` as named on its page). |
| `source.author`, `date`, `url` | Who made it, when (YYYY-MM-DD), and the community post or the owner's share link (`https://www.meshy.ai/s/…`), or `null`. |
| `source.meshy` | The owner's own models only: Meshy task IDs (`preview`, `refine`, `image`, `multiImage`, `remesh`, `retexture`, `rig`), which `fetch-meshy.mjs` downloads by. |
| `source.file` | A regular expression for the download's file name (a rigged `.glb`, or the textured `.fbx`), when it isn't saved as `<id>.glb`. |
| `finish` | The one material's metallic and roughness (0–1). `maps: true` keeps the download's metal-roughness map (G roughness, B metal; 512 px, painted into the new layout for a rebake) and the factors multiply it (give 1 and 1 for the download's own): Grinning Gus's black chrome skull, Dog Tag Doyle's glossy helmet. |
| `clipsFrom` | A rigged download's own clips to retarget onto the rig as this character's clip set (`<id>_clips.glb`): `{ "<clip>": "<the download's clip name>" }` for `clip_walk`, `clip_run` (both needed), `clip_shoot_fwd`, `clip_shoot_run`, `clip_shoot_back`. See "Authored clip sets". |
| `clips` | The clip set this look moves with while it holds a gun: left out, the default (`shooter`); a shared set's id (`content/clip-sets`) or a manifest with `clipsFrom`; `false` (with `clipsWhy`, the reason): the rig's own gait. |
| `clipsWhy` | With `clips: false` only: why this body keeps the rig's own gait. |
| `firstPerson.arms` | `own` (its own forearms and hands, `<id>_fparms.glb`), or a universal arms part with `skin`, `cloth` and `trim` dyes. |
| `firstPerson.body` | `false`: full-body first person shows this character's arms only (its hat brim, cape or hood would fill the view from its own eyes: Grizzelda). Left out: full body. |
| `fixes` | `triangles` (the body's budget; 11000 for an unrigged download, half the download's for a rigged one), `lean` (degrees back per spine joint for a hunched body), `cloth` (cloth below the hips follows the pelvis), `tail` (points from the hips), `feet` (turn the feet level: the foot bone pointed the rig's way, then each foot turned about its ankle until the lowest points of its heel and of its front are level; Meshy's rig left feet 7-23 degrees toes up without this), `seamWeld` (simplify across texture seams; the head and hands then get no share of their own), `surface` (`rebake`: the download cut to `triangles` with its texture seams closed, laid out afresh and its colour and normal maps painted from the full download; see "Rebaked characters"), `scrubBlue` (repaint blue badges), `hands` (below), `armCloth` (cloth hanging off an arm goes with the body; see "Arm skin kept to the arms"), `skinClean` (weights cleaned in the download's own pose, contacts torn; see "Skin cleaned in the download's pose"), `handsShare` (the share of the triangle budget the hands keep in the cut, 0.04 unless set (0.08 in a rebake): more where cuffs the skinning left on the hands took it, as on King Aldric), `headShare` (the head's share, 0.12 unless set), `normalSize` (1024: a 1024 px normal map instead of 512), `lod` (the far copy's share of the body's triangles, 0.3 unless set; see "Level of detail"), `hold` (`{ forward, down }`, metres at a 1.8 m body: this look's long-gun hold against everyone's, along the barrel and square to it, in third person and Character Select; Bandit's broad build put the stock at his snout). |
| `source.modelUrl` | For Meshy's rigging API: `"upload"` (the unrigged download in the downloads dir, sent as a data URI; the usual choice), or a public link to a `.glb` file. Meshy refuses a link whose path doesn't end in `.glb` ("invalid model file format"), so Google Drive download links don't work. |
| `landmarks` | Optional, for an unrigged download: found from the mesh when left out (see "Rigging an unrigged download"). The joints in units of the model's height, feet at y = 0, +x the character's left, +z its front. `spine`: hips, three spine joints, neck, head, top of the head. `L`/`R`: clavicle, shoulder, elbow, wrist, hand tip, hip, knee, ankle, ball, toe tip. Read them off front and side views. |

`content/intake/meshy-queue.json` lists models the owner picked.
`node tools/content/character-manifests.mjs --stubs [ids…]` writes a queued
stub for each queued character or creature that has no manifest yet; fill it
in, drop `status`, and remove the entry from the queue once it ships.

### 2. Get the download

The downloads dir is anywhere outside the repo (say `~/meshy-downloads`). The
importer finds a character's download there by its manifest id or its
`source.file` pattern:
- `<id>.glb`: a rigged GLB (Meshy's auto-rig output: its joints are mapped
  onto ours, no landmarks needed), or one matched by `source.file`. Meshy's
  "All Animations" export names the joints the Mixamo way (`mixamorig:Hips`,
  `Spine`, `Spine1`, `Spine2`, `Neck`, `HeadTop_End`, ...): they are read as
  Meshy's own (its clips are not used; the rig's are);
- an unrigged textured GLB (Meshy's "texture" download, no skin), matched by
  `source.file`: rigged here (below);
- a textured FBX folder (the `.fbx` with its `.png` beside it), anywhere under
  the dir, matched by `source.file` or named `<id>_texture.fbx`: rigged here.

Record which download a manifest takes in its `source.file` pattern (one
download per pattern; the importer says when none matches).

A fresh download of a model already shipped (the owner's T-pose uploads of
2026-11-01: The Visitor, Elder Tomo, Flt. Lt. Ember and Biscuit came back as
textured GLBs of the FBX models they were built from; Biscuit's rebuild waits
on his paws, see HANDOFF.md) is the same character:
widen `source.file` to take it (`…_texture\.(glb|fbx)$`), keep the look ID,
licence and landmarks (they are in units of the model's height, so they fit
the GLB too: check with front and side views), and rebuild with `ONLY=<id>`.
Look before matching by name: the same uploads' Frog in Suspenders, Goblin
and Monkey were different models from Boglurker, the Goblin and Big Bab, so
they became new characters (a pattern that would match both, like Big Bab's
`T_Pose_Monkey_`, is narrowed to its own download).

**Community (CC0) models are downloaded by hand.** Meshy's API only serves
tasks in the key holder's own account; it has no endpoint for community posts.
Download the model from its page (the rigged GLB if it has one, otherwise the
textured FBX) and save it as above.

**The owner's own models** (their `meshy.ai/s/…` share links) are fetched by
task ID: put the IDs in `source.meshy` and run

    MESHY_API_KEY=… node tools/content/fetch-meshy.mjs ~/meshy-downloads [ids…]

It reads each task through the Meshy API (`api.meshy.ai`; the rig task gives
the rigged GLB, otherwise the latest textured stage gives the FBX and its
base colour map) and downloads the files from `assets.meshy.ai`, saving
`<id>.glb` or `<id>/<id>_texture.fbx` and `.png`. Without a key, when Meshy
can't be reached, or for a task that hasn't finished, it says so and why.

### Rigging an unrigged download

Two ways, the first preferred when it's available:
1. **Meshy's rigging API**, with `MESHY_API_KEY` set and the manifest's
   `source.modelUrl`: `fetch-meshy.mjs` (and so `pnpm content:meshy`) sends the
   model to `POST /openapi/v1/rigging` (`model_url`, `height_meters`), waits for
   the task, and saves the rigged GLB as `<id>.glb`, which then goes through the
   rigged path (Meshy's joints mapped onto ours). It prints the task ID: put it
   in `source.meshy.rig` to fetch the same result again later. Meshy rigs
   textured humanoids only; a request it refuses comes back with its message.
   With `modelUrl: "upload"` the download goes up as a data URI; one over 300k
   triangles is cut to 200k first (Meshy failed a 917k-triangle king and rigged
   the same model cut to 150k). A rigging task costs 5 credits.
2. **In-house** (no key, or no `modelUrl`): `prepare-meshy-characters.mjs` cuts
   the mesh to 40k triangles first (meshopt, looser and then sloppy for
   million-triangle downloads), finds the joints from the mesh
   (`tools/content/landmarks.mjs`), and skins it with `autoskin.mjs`:
   - the mesh is drawn into a front view (coverage and depth per pixel);
   - the neck is the narrowest row of the body's middle below the head (kept
     between 0.80 and 0.88 of the height), the crotch the highest row with the
     gap between the legs showing (a coat or robe that hides it: 0.44);
   - each arm is the direction from the shoulder (level for a T-pose, down to
     75° for an A-pose) that stays in the mesh furthest, followed to the hand's
     tip; elbow and wrist at 38% and 74% of its length; the shoulder line is
     lowered until it meets the arm when a collar or cape hides it;
   - knees and ankles are the middle of each leg's run at the usual heights; the
     foot runs from the heel to the furthest toe near the ground.
   `LANDMARK_DEBUG=<dir>` draws what it found over front and side views
   (`<id>.landmarks.png`); `LANDMARK_PRINT=1` prints the landmarks in manifest
   form. When they're wrong, paste them into the manifest's `landmarks`, fix the
   bad points, and build again: the manifest's landmarks replace the found ones.
   Tails, hunched spines (`fixes.lean`) and cloth (`fixes.cloth`) are not found:
   set them in the manifest.

### 3. Build it

    MESHY_API_KEY=… pnpm content:meshy ~/meshy-downloads

builds every manifest not built yet (or `ONLY=<ids>`): it fetches what it can,
then runs `prepare-meshy-characters.mjs` for those characters only (everything
else is kept as built), writes the looks and refreshes `content/provenance.json`.
The steps on their own:
- `ONLY=<ids> node tools/content/prepare-meshy-characters.mjs ~/meshy-downloads`
  builds `packages/client/public/characters/<id>.glb` (body and low-detail
  copy) and `<id>_fparms.glb` (first-person arms), recorded in
  `content/meshy.lock.json`. `SKIN_DEBUG=<dir>` writes the weights to look at.
- `node tools/content/character-manifests.mjs` writes
  `packages/shared/src/content/characters.generated.ts`, the looks and bios
  `looks.ts` reads (`pnpm content:check` fails while it is out of date, a
  manifest is unbuilt or a built file has no manifest).
- `pnpm content:build` refreshes the provenance ledger.

**Hands.** At import every hand is measured and fitted (`tools/content/hands.mjs`):
- measured in the hand joint's space: finger direction, palm centre, length
  from the wrist joint to the fingertips, width and thickness;
- the rig's finger joints moved onto it (knuckles on the knuckle line, the
  thumb scaled from the rig's), keeping the rig's joint orientations;
- the fingers weighted to the rig's finger chains: split into index, middle,
  ring and pinky where the gaps between the fingers show, blended at the
  knuckles and along each finger; a mitten, claw or fused hand curls as one
  wide finger along the middle finger's three joints (it was bent once at the
  knuckle line, which stood the fingers out flat under a handguard); long
  fingers (a frog's, a monkey's) curl further, by their length against the
  rig's, up to 1.5 times; left rigid only when the hand is a
  compact block already closed (a fist: thicker than half its length and less
  than 1.5 times as long as wide, or thicker than 0.65 of its length). A
  relaxed Meshy hand, its fingers a little bent, measures 0.3 to 0.45 thick for
  its length and still bends (it was taken for a fist and left flat on the gun);
- a cuff the skinning left on the hand (a ring at the wrist end, round in
  section and three times as dense as the hand past it: King Aldric's fur
  cuffs, Brass Hare's) is measured out and stays on the hand joint: it had
  held the knuckle line inside itself and curled into flaps;
- vertices far from the hand's core (straps, a cape's edge left on the hand:
  past 1.6 times the 80th percentile of their distance from its centre) are
  left out of the measure and keep their weights;
- the palm side is the rig's (palm down in the T-pose) unless the hand's own
  flat (its thinnest way) disagrees: a hand turned a quarter on its joint (the
  dapper's, the Knight's) takes its flat, facing the body's front;
- the measurements written on the hand joints (`extras.hand`) for the game.

In the game a long gun's support hand cups the handguard over the base of its
fingers (its palm centre sits back from the handguard by 0.22 of the hand's
length, `CUP_BACK`) and closes all the way round it; a pistol's support hand
closes part way round the shooting hand. A long gun's barrel line keeps
`HEAD_CLEAR` (0.15 m) from the head's joint: the stock drops (up to 5 cm) where
a big helmet or a short neck put the head by the gun (Capt. Nova).

In the game a hand closes onto the point of the gun it holds (`closeHand`):
the fingers curl whichever way brings their tips toward it, so a hand whose
palm side came out reversed still wraps the gun instead of bending its fingers
up off it.

**Arm skin kept to the arms** (`tools/content/armweights.mjs`, opt-in with
`fixes.armCloth: true`): a vertex an arm holds that hangs well below it (past
2.2 limb radii from its bones, clear of the shoulder) is cloth, eased from the
arm's weights to the body's by its share of the way from the arm to the body
ALONG THE SURFACE (eased between 0.3 and 0.8 of the way), taking the weights of
the body vertex nearest along the surface. A coat's side joined to the body
under the arm goes with the body; a wide sleeve, joined to the body only round
the shoulder, stays on the arm. (The first rule, 2026-10-31, took the nearest
body vertex in a straight line: wide sleeves by the hips went to the hips and
grew wings from the arms, Giggles' and the Dust Trooper's.) As of 2026-11-01 no
character needs it: the audit's spikes are in the legs (a tabard or coat
between them: the Iron Knight, Ser Brannock), the armpits (Big Bogdan, the
Dapper) and low-detail fingers, which it does not touch. The audit reports
spikes by joint (`stretch.by`).

**Skin cleaned in the download's pose** (`tools/content/skinclean.mjs`, opt-in
with `fixes.skinClean: true`; rigged and unrigged downloads alike, in
prepare-meshy-characters.mjs `pose()`). Most Meshy downloads stand with their
arms down, hands on the hips and wide sleeves against the body, and their
weights leak across those contacts (hand vertices partly on the hips or a
thigh, a sleeve's inside partly on the spine). Turning the arms out to the
T-pose dragged those vertices part of the way between arm and hip: long sheets
and strands from the hands to the hips, already in the built bind pose (so the
grip audit's stretch test, which compares the hold with the bind pose, never
saw them). The pass, before the turn: whose skin each arm-held vertex is (skin
faces away from its own bone: a sleeve's inside faces the body; the body's side
under a hanging arm faces the arm, when that patch is joined mostly to the
body; else the nearer bone); only joints within two of its anchor on the rig's
skeleton keep a share (a hand never keeps the hips). After the turn, triangles
reaching a forearm or a hand that stretched past 3x their length (a fingertip
fused to a thigh, a cuff to the hip) are torn out and each hole closed with a
flat fan; the upper arm's skin to the body (armpits) is never torn. Used by
Giggles, the Dust Trooper, Goblina and Luther Vanguard. Not on by default: on
Freaky Frida it pulled pigtails hanging by her shoulders into strands, and it
put a flap on Kenji's vest side (both already fixed by hand-set landmarks and
`armCloth`). Check a character in its download pose with the weight pictures
(any rest mesh coloured by limb) before turning it on.

**Head and hands keep their detail** (`cutKeeping` in `tools/content/meshy-mesh.mjs`):
both cuts (an unrigged download's work cut to 40k triangles, and the final
cut) keep at least 12% of the budget for the head and 4% for the hands, cut
apart from the body (never sloppily) with the vertices on their edges locked.
A realistic body cut by error alone from a million triangles had kept a face
of 133 triangles and hands of a few dozen (Lancer Mei, Merrow the Wise).

The log prints each hand's size and what it got (`split`, `mitten`, `none`).
For an odd model, `fixes.hands` overrides: `palm` (`[x, y, z]` in the hand
joint's space, metres), `curl` (0–1.5, how far the fingers close; 0 for paws
that can't close, as Teddy's balls), `scale` (shrink or grow the hand about the
wrist), `wrist` (true: the skin past the wrist joint rides the hand alone, none
of it eased into the forearm; Biscuit's stubby paws folded at the wrist when the
hand turned hard onto a gun pointed at the ground), `mitten` (true: the fingers bend
together even where gaps were found; a thumb or fold read as a gap crumpled a split
hand into shards: Honest Abe's and Virtua Soldier's right hands), for both hands or one (`l`, `r`). A rigid gauntlet
(`fingers: none`, curl 0) given a `curl` is skinned as a mitten that closes on the grip: the Knight has
`fixes.hands.curl: 1` (rehanded with rehand-built.mjs).

`node tools/content/rehand-built.mjs` (`ONLY=<ids>`) does the same to
characters already built, from their shipped files, when the downloads
aren't at hand: it re-skins the hand region in place (and, with
`fixes.armCloth`, eases arm cloth to the body: armweights.mjs), cuts first-person arms from the body for a character
without them, and updates the lock (then run `pnpm content:build`). Running it
again changes nothing. `OUT=<dir>` writes the files there instead (a trial;
the lock is left alone).

### 4. Check the grip sheet and the grip audit

    pnpm build && pnpm --filter @tiletrigger/client exec vite preview --port 4860
    node tools/content/grip-audit.mjs http://localhost:4860 <out dir outside the repo>

The **grip audit** renders every player character holding the rifle, the pistol,
the Spin Gun, the shotgun and the Spear in the Character Select pose, from the side and the front,
measures each hold as drawn (`__grips.audit()`, `tools/gripAudit.ts`: finger
weights per hand, fingertips against the grip with the hands open and closed
(the curl test), elbow bend against the arm's own skin, the gun against the
head and shoulders, arms across the midline, stretched skin edges) and writes
`audit.json`, a ranked `summary.md` and contact sheets (`sheet-<n>.png`,
`<id>.png`). Judge a gun "at the face" from the side: front views foreshorten
a rifle pointed at the camera. `ONLY=<ids>`, `NO_SHOTS=1`, `NO_FP=1`,
`RESUME=1` (it saves after every character) and `RESCORE=1` (flags again after
changing a threshold); `WEAPONS_ONLY=rifle,pistol,shotgun,spear` measures only
those (a run of every weapon takes about 75 s a character on a busy machine) and
`AUDIT_PX=400` renders a smaller page (software GL is pixel-bound). `summary.md`
ends with each character's flags per weapon. `window.__grips.closeUp(joint,
alpha, beta, radius)` frames one joint (a support hand) after a third-person pose.

The per-character sheet:

    pnpm build && pnpm --filter @tiletrigger/client exec vite preview --port 4860
    ONLY=<ids> node tools/content/grip-sheet.mjs http://localhost:4860 ~/grip-sheets

writes `~/grip-sheets/<id>.png` (outside the repo): the character holding a
pistol, a rifle, a shotgun and a knife, in third person framed on the hands
and in first person as the game draws it (`?mode=grips`, the game's own
renderer). Look for palms on the grips, fingers round them (not through the
gun or splayed in the air), the support hand on the handguard, and in first
person, sleeves that don't cover the sights. Fix a bad hand with
`fixes.hands` and build again. For posture, the same page frames the whole body
after a pose: `window.__grips.body('side' | 'front' | 'feet')` (side-on is
where a hunched back or toes-up feet show), and `window.__grips.joints()`
gives the posed joints' positions. A hunched body gets `fixes.lean`
(Bonesworth: 4, 6, 6 and 16 degrees on Spine02, Spine01, Spine and neck). `?mode=characters&looks=<look>` shows the
character with every clip.

### 5. Ship it

- Commit the manifest, the built files, `content/meshy.lock.json`,
  `content/provenance.json` and `characters.generated.ts` (never the
  downloads). For a community model, add it to the licence file's list
  (`assets-src/meshy-community-characters/License.txt`).
- Run `pnpm content:check`, `pnpm typecheck`, `pnpm test:changed` and the
  `characters` and `designer` e2e flows.
- Capture its portrait (the **Capture portraits** workflow) once it's on `main`.

## Known gaps

- The ranger boots barely simplify (their texture seams stop the simplifier),
  so a distant full ranger is still about 7.5k triangles.
- More outfits and era costumes on the same rig. The free pack editions hold
  only the Ranger and Peasant outfits; the other ten are in the paid Source
  editions.
- NPCs use the plain mannequins in faction colours until faction outfits exist.
- Creatures use the player-sized hit capsule, so shots just over a puglin or
  at the top of a scolitex hit or miss as if they were player-sized.
- The aliens have no walk, attack or death clips of their own (procedural
  motion stands in).

## Character sizes

Every look is small, standard or large (`size` on the look; custom looks add
`-s` / `-l` to their ID, and the Character Designer has a Size choice on the
Body tab). Presets: Sprout is small, Bulwark is large, everyone else standard.

| Size | Body (height, width, eyes) | Speed | Health |
|---|---|---|---|
| Small | × 0.78 (1.40 m tall) | × 1.06 | 85 |
| Standard | 1.80 m | × 1 | 100 |
| Large | × 1.18 (2.12 m tall) | × 0.94 | 115 |

The body size is the hit box and the collision capsule, so small characters
are harder to hit and fit through gaps others must crouch for (a 1.6 m
ceiling, a low window), and large ones are easier to hit and must crouch
under openings a little over 2 m. Health pickups fill up to the size's
health. The match setting **Character sizes: Matter / All equal**
(`MatchRules.bodySizes`) makes everyone play and look standard.
Character Select and the Character Designer draw each look at its size too (a small look at 1.40 m, a large one at
2.12 m), as a match does.

## Portraits

Character Select, the player badge and the HUD show a portrait of each look,
rendered from the 3D character by `client/src/frontend/portraits.ts`: head
and shoulders, framed from the neck joint up to the top of the model and
centred on the head joint (any body shape), three-quarter from the front;
creatures whole. The built-in looks' portraits ship with the site
(`client/public/portraits/*.webp`, listed in `frontend/portraitIndex.ts`) so
the menu shows them at once. A look whose face the default framing hides or
leaves off centre gets its own view in `PORTRAIT_VIEWS` (portraits.ts): `from`
(where the camera sits from the face), `aim` (a nudge of the aim point) and
`zoom` (the frame's size against the default); `__front.portraits.renderLive(look,
view)` tries one without a rebuild. They're made by the **Capture portraits**
workflow (`tools/content/capture-portraits.mjs`, the same renderer), which
commits them to `check/portraits`; run it after adding characters or changing
the framing. A look without a shipped portrait (new since the last capture,
or a player's own design) is rendered live in the browser, as before.
