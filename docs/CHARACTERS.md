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
| Soldiers (`soldiers`) | Modern and sci-fi military, agents, pilots, hazmat, astronauts: Agent Zhao, Bulwark, Commando, Desert Ranger, Dust Trooper, Flt. Lt. Ember, Frost, Grunt '68, Hazmat, Medic, Operative, Scout, Sentinel, Sgt. Pruitt, Space Marine, Spacewalker, Starfarer, Tactical Soldier, Trooper (NPC skin), Vanguard, Warden (Capt. Nova retired 2026-11-06: its saved choices and bot sets play Spacewalker) |
| Knights & Legends (`legends`) | Medieval, royalty, monks, wizards, mythic and historical warriors: Anubis, Ashwalker, Brother Ansel, Elder Tomo, Frost Viking, Goblin Warlord, Grizzelda, Imperial Guard, Iron Knight, King Aldric, Lancer Mei, Linktifa, Merrow the Wise, Old King Halvard, Ser Brannock, Shade, Sir Galloway, Thornweaver |
| Everyday Folk (`folk`) | Ordinary people: Big Bogdan, Biker Gang Girl, Brawler, Cap'n Barnacle, Chef Basile, The Butcher, Dale, Drifter, Dusty Colt, Engineer, Farmhand, Grandpa Chains, Hector, Huntress, Old Timer, Pathfinder, Patches, Saint Nick, Sprout, The Dapper, Tracker, Umpire, Uncle Bao, Wayfarer |
| Undead & Horror (`horror`) | Bonejack, Count Bonesworth, Fearsome Undead, Giggles, Gorgle, Groaner, Lurcher (queued), The Masked Figure, Punkin, Rattles, Rotter, Shambler, Spiked Skeleton Biker |
| Animals (`animals`) | Bandit, Barnaby Bruin (queued), Big Bab, Biscuit, Brass Hare, Croakley, Greyfang, Hyena Warrior, Scamp, Shellback, Shiba, Teddy, Wealthy Otter (Bamboo retired 2026-11-06: its saved choices play Shellback) |
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
| `pistol` | Points along the aim, its `grip` in the right hand where the clip puts it (at the palm, by the middle of the hand's width) | Left palm IK'd to `support` |
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
- **A pistol's grip** (`style: pistol`): `grip` is the middle of the grip about
  2 cm below the trigger guard and about 3 cm behind the front strap (the hand's
  knuckles go 2 cm ahead of it in first person: just behind the front strap, so
  the fingers bend there and wrap round); `support` is 2 cm left of it, 1 cm
  lower and 1 cm ahead (every pistol-class gun the same: the support hand goes
  round the shooting hand); `rake` is the grip's lean back from upright in
  degrees, its foot further back (12 unless set: the Flare Gun's and Grapple's
  34, the Freeze Ray's handle 20). Read them off a side view of the model with a
  grid (the hold's points sat in the trigger guard on the Freeze Ray and at the
  end of the wire stock on the Machine Pistol until 2026-11-06).

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
- **A pistol in first person** (both views; `PISTOL` in characterAnimator.ts, owner 2026-11-05: "looks as if their
  fingers are just pinching the grip"): the grip sits deep in the shooting hand, the web of the thumb high on the
  backstrap, the fingers round the grip, the support hand round the shooting hand.
  - Each hand is turned about its palm so its knuckle line (index to little finger) runs down the grip at the gun's
    `rake` (the support hand's 18° further, canted forward), so the fingers close round the grip rather than up
    across it; the shooting palm faces in against the grip, the support palm in against the shooting fingers.
  - Each hand is set by its knuckles, not its palm point: the middle of the shooting hand's knuckle line goes 2 cm
    ahead of `grip` (a hand longer than 9 cm from wrist to knuckles goes further round, so its palm stays on the
    backstrap), the support hand's 1.5 cm ahead of and 1 cm below `support`, its palm 1.1 cm further in (first
    person only: `support` is third person's too). Set by the palm point, the knuckles stood 2-3 cm ahead of the
    front strap and the fingers closed round the trigger guard.
  - The fingers close until the middle fingertip is round on the grip's far side, no further (the shooting hand's
    past 2.2 cm left of the grip's middle, the support hand's past 1.5 cm right of it); a full close on
    top of the clips' bend folded them back into the palm.
  - The thumbs lie along the frame (each straightened most of the way, the support thumb forward along the left side).
  - Tune it live on the grip page: `__grips.pistol({ knuckles: [right, up, ahead], wrap, supportShift, ... })` (model
    m, the gun's axes; returns the whole tune), then `__grips.pose(...)`. Third person keeps the clips' hold.
  - Only a two-handed pistol grip (a `support` point) is held this way. A one-handed `pistol`-style hold, the Spear's
    shaft or the Medkit's and Medi-Beam's handle, keeps the close it had before (turned and closed as a raked grip,
    their fingers stood straight off the shaft and the handle; the grip audit's Spear and Spin Gun pass, 2026-11-06).

**Where hands are drawn:** `gripMiss` and `__grips.miss()` measure the joints. A Meshy hand needn't sit on its
joint as the rig's does (the dapper's lay a quarter turn round), so each measured hand's own frame is read off its
skin (`handProbe.skinHandFrame`) and the hand is turned onto the gun by it (`gripHand`). `__grips.drawn()` and, in a
match, `__cs.view.gripReport()` measure the drawn skin: model metres from each hand's skin to its point on the gun,
`aheadR` (fingers along the barrel), `sideR` (the shooting palm in against the grip's side: 1; its back there, the
palm facing out: -1) and `palmL` (the support palm up into a long gun's handguard, or up and in round a pistol's
shooting hand: 1; palm down or out: negative); the `characters` e2e checks them. `atR` / `atL` say where each drawn
hand's skin centre is from its point in the gun's axes (right, up, ahead) and `wrapR` the share of the shooting hand's
skin past the grip's middle on its far side (the fingers round the grip).

**Which side is the palm** (2026-11-05). A hand's flat (its thinnest way) has two sides; `skinHandFrame` takes the
palm's from the hand's joints, the first cue that speaks clearly:
1. **Handedness** (`knuckles`): fingers ahead, index knuckle on the thumb's side of the little finger's (ring or
   middle where there's no little finger), a right hand's palm is on one side of them and a left's on the other
   (worked in the mesh's own glTF space, which is right-handed; the import mirrors the world). On a download's own
   fingers these are its own knuckles; on re-fitted fingers they were placed by `hands.mjs` from its palm side.
2. **Curl** (`curl`): the finger joints bend toward the palm (only where they bend by more than about 6° a link).
3. **Thumb** (`thumb`): the thumb's tip sits on the palm's side of the flat.
4. **Measured** (`measured`): the import's palm side (`extras.hand.palmSide`).
Before, the sign came from the thumb's first joint against the wrist joint, nearly level with the flat on most hands:
on some (the Gnoll, Hyena Warrior's model) it picked the back, and the grip turn put the shooting palm out from the
grip and the support palm down (owner, 2026-11-05). `drawnHand` reads the drawn palm the same way (handedness from
the drawn knuckles), so the measures are signed. `__grips.palms()` lists each posed hand's cues (`by`, `votes`, and
`rig`: the rig's thumb-side reading in the drawn pose), `__grips.palmRule('old')` builds the next hands by the old
rule (a before/after), and the grip audit flags `palm` (`sideR` under 0.25 or `palmL` under 0, third or first
person; `PALMS=old` audits by the old rule).

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
- **Holding a gun** (a player or bot in a humanoid creature's skin): `holdWith` (characterAnimator.ts) closes its
  hands on the gun as for a look, and the creature's own `grip` in `CREATURE_SPECS` (packages/shared/src/sim/creatures.ts;
  a GripTune, as a look's `fixes.grip`: points moved, curl, roll, elbow) adjusts that creature alone. The Imp's left
  claw stood above the handguard with its claws up: `supportLong [0, -0.05, 0]`, `rollL -0.8`, `curlL 1.3` put it
  under the handguard round it. Check with `window.__grips.creature('imp', 'core.rifle')` on `?mode=grips`.
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

Whole-body characters are Meshy models: the owner's own (owned), or Meshy
community models under CC0. Models from the owner's Drive are Meshy Community
CC0 unless the owner says they made them (owner, 2026-11-06); only those, and
ones we generate through the Meshy API with the owner's approval, are owned. Each is one manifest,
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
| `source.license` | `owned` (the owner says they made it, or we generated it through the Meshy API with their approval; provenance pack `meshy-owned`) or `CC0` (a community model, which is what a model from the owner's Drive is unless the owner says they made it, 2026-11-06; pack `meshy-community-characters`, with `community.model` as named on its page or download). A licence changed in a manifest reaches the lock without the download: `node tools/content/prepare-meshy-characters.mjs <any empty dir>` gives every character it keeps its manifest's pack (content:check fails until it has). |
| `source.author`, `date`, `url` | Who made it, when (YYYY-MM-DD), and the community post or the owner's share link (`https://www.meshy.ai/s/…`), or `null`. |
| `source.meshy` | The owner's own models only: Meshy task IDs (`preview`, `refine`, `image`, `multiImage`, `remesh`, `retexture`, `rig`), which `fetch-meshy.mjs` downloads by. |
| `source.file` | A regular expression for the download's file name (a rigged `.glb`, or the textured `.fbx`), when it isn't saved as `<id>.glb`. |
| `finish` | The one material's metallic and roughness (0–1). `maps: true` keeps the download's metal-roughness map (G roughness, B metal; 512 px, painted into the new layout for a rebake) and the factors multiply it (give 1 and 1 for the download's own): Grinning Gus's black chrome skull, Dog Tag Doyle's glossy helmet. |
| `clipsFrom` | A rigged download's own clips to retarget onto the rig as this character's clip set (`<id>_clips.glb`): `{ "<clip>": "<the download's clip name>" }` for `clip_walk`, `clip_run` (both needed), `clip_shoot_fwd`, `clip_shoot_run`, `clip_shoot_back`. See "Authored clip sets". |
| `clips` | The clip set this look moves with while it holds a gun: left out, the default (`shooter`); a shared set's id (`content/clip-sets`) or a manifest with `clipsFrom`; `false` (with `clipsWhy`, the reason): the rig's own gait. |
| `clipsWhy` | With `clips: false` only: why this body keeps the rig's own gait. |
| `firstPerson.arms` | `own` (its own forearms and hands, `<id>_fparms.glb`), or a universal arms part with `skin`, `cloth` and `trim` dyes. |
| `firstPerson.body` | `false`: full-body first person shows this character's arms only (its hat brim, cape or hood would fill the view from its own eyes: Grizzelda). Left out: full body. |
| `fixes` | `triangles` (the body's budget; 11000 for an unrigged download, half the download's for a rigged one), `lean` (degrees back per spine joint for a hunched body), `cloth` (cloth below the hips follows the pelvis), `tail` (points from the hips), `feet` (turn the feet level: the foot bone pointed the rig's way, then each foot turned about its ankle until the lowest points of its heel and of its front are level; Meshy's rig left feet 7-23 degrees toes up without this), `centre` (true: the body moved over the origin by its hips; Meshy centres a download's box, so a long tail behind stood the body that far ahead of the origin the game moves and collides it by: the crocodile's hips 0.39 m ahead at 1.8 m, nearer Character Select's camera than everyone else with its head out of frame. As of 2026-11-06 Bandit 0.48 m, Scamp 0.35 and Greyfang 0.26 stand ahead too: candidates once their downloads are at hand), `seamWeld` (simplify across texture seams; the head and hands then get no share of their own), `surface` (`rebake`: the download cut to `triangles` with its texture seams closed, laid out afresh and its colour and normal maps painted from the full download; see "Rebaked characters"), `scrubBlue` (repaint blue badges: `#rrggbb` repaints every strongly blue texel; `{ "color": "#rrggbb", "within": [[u0, v0, u1, v1], …] }` only those inside boxes of the download's colour map (shares of its width and height, the download's own layout, so not with `surface: rebake`): the Spacewalker's mission patch went, the flag on its other shoulder stayed), `hands` (below), `armCloth` (cloth hanging off an arm goes with the body; see "Arm skin kept to the arms"), `skinClean` (weights cleaned in the download's own pose, contacts torn; see "Skin cleaned in the download's pose"), `handsShare` (the share of the triangle budget the hands keep in the cut, 0.04 unless set (0.08 in a rebake): more where cuffs the skinning left on the hands took it, as on King Aldric), `headShare` (the head's share, 0.12 unless set), `normalSize` (1024: a 1024 px normal map instead of 512), `lod` (the far copy's share of the body's triangles, 0.3 unless set; see "Level of detail"), `hold` (`{ forward, down, out }`, metres at a 1.8 m body: this look's long-gun hold against everyone's, along the barrel, square to it and out to the gun shoulder's side, in third person and Character Select; Bandit's broad build put the stock at his snout, Bamboo's big low head the rifle across its snout), `grip` (this look's own hands and arms on a gun, in third person and Character Select: `supportPistol` / `supportLong` / `gripLong` move the support hand's point on a pistol or handguard and the shooting palm's point on a long gun's grip (`[right, up, ahead]` in the gun's frame, m), `curlR` / `curlL` scale how far each hand closes, `rollR` / `rollL` turn a hand about its fingers (radians), `elbowOut` / `elbowDown` move where the long-gun shooting elbow bends toward (m); set per look from before/after shots and the grip audit, since a change to the shared hold moves every look; HANDOFF.md, "Grips round 3"; an offset set before 2026-11-05 was tuned while some palms were read back to front, so re-check it: in hands round 5 a pistol's `supportPistol` near `[-0.01, 0.03, -0.03]` put the support hand round the shooting hand where the old `[0, 0.04, -0.08]` held it back under the wrist, and `supportLong [0, 0.02, 0.03]` the long-gun support hand on the handguard. First person reads none of it), `skin` (this look's own skin weights: finger `tips`, `knuckle`, `joints`, `lanes`, `fingers`; body `hops`, `clamp`, `smooth`, `wrist`; see "A look's own skin weights")., `fingers` (`own`, the default: a rigged download whose finger chains are whole keeps its own finger joints and weights; `fit`: re-fitted from the mesh as before; see "The download's own fingers"). |
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

**The download's own fingers** (`fixes.fingers`, 2026-11-05). A Meshy rig with the Mixamo skeleton can carry finger
chains (`LeftHandThumb1`…`LeftHandPinky4`). Before, they were folded into the hand joint and `hands.mjs` re-fitted the
fingers from the mesh, so a re-rig improved only the body. Now, per side, when the download's chains are whole (thumb
and four fingers, three joints each; the `…4` end markers optional):
- the rig's finger joints go onto the download's (`thumb_01`…`pinky_04_leaf`, rig orientations kept, so the clips and
  the game's curl mean the same), and each finger joint's weights go to its rig joint (an end marker's onto `…_03`);
- `hands.mjs` measures the hand only (palm, frame, size, curl: `extras.hand`, `fingers: 'own'`); nothing is moved or
  re-weighted (`fixes.hands.scale` still applies, and moves the finger and thumb joints with the skin about the wrist;
  `fixes.skin`'s finger options don't);
- the first-person arms shrink the hand about its joint, and the finger joints with it;
- a check before the build falls back to the re-fit for a side where a finger mostly holds fewer than 6 vertices or a
  finger's chain runs back into the hand (the log says which);
- `rehand-built.mjs` keeps a hand built this way (measured only).
Falls back to the re-fit with no chains (a 24-joint rig: Dapper, CRT Robot, Frida, Alien Biker), part chains (thumb
and middle only: Old Timer, Imperial Guard, Zhao, Halvard; a frog without an index finger) or `fixes.fingers: fit`,
which a manifest sets where the grip audit scored the kept weights worse (HANDOFF.md, "Drive intake of 2026-11-05").
The lock records `fingers: own l r` on a build that kept them.

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

**A look's own skin weights** (`fixes.skin`, `tools/content/skinfix.mjs`; owner-approved 2026-11-04). For a
fault the shared weighting leaves on one look's hands or cloth, that look's manifest sets its own weighting; a look
without `fixes.skin` is weighted exactly as before. Set from before/after shots (rifle and pistol: 3/4, each hand
close, side, front) and the grip audit, and kept only where the shots are clearly better (HANDOFF.md, "Hands round
4"). The finger options go to `fitHands` (hands.mjs) and so are applied afresh on every build and rehand; each takes
both hands or one (`l` / `r`):
- `tips` (0–0.5): skin past the knuckle line that the hand's core measured out as a stray (a long fingertip) is
  weighted as its finger, up to this share of the hand's length past the fingertips. Zombie Soldier A's right
  middle fingertip stayed on the hand while the rest of the finger curled: a 40x "needle" (`tips: 0.3`).
- `knuckle` (0.02–0.3, default 0.1) and `joints` (0.02–0.3, default 0.08): how wide the blend from the hand to the
  fingers, and between a finger's joints, is (shares of the hand's and of the finger's length).
- `lanes` (0–1): skin within this share of a finger's width of the boundary between two split fingers is shared by
  both (half each on the boundary), so neighbouring fingers don't tear apart (the Iron Knight's gauntlet: `0.8`).
- `fingers: 'lanes'`: fused fingers (no gaps to find) split evenly across the hand into four.

The body options run after the hands, once (a file records them as `extras.skinFix` on its skin, and
`rehand-built.mjs` does not apply the same ones again; to change them, start from the file before them):
- `hops` (1–4): influences of joints further than this many steps along the skeleton from the vertex's own joint
  are dropped (a belly held by a thigh and a collarbone at once). Low values tear blended skin (a belly half on the
  spine, half on a thigh): Croakley at `hops: 2` stretched 120x; not used.
- `clamp` (0–0.3): influences under this weight are dropped.
- `smooth` (`{ joints: "<regex>", passes: 1–8 }`): the weights of vertices those joints hold most are evened with
  their neighbours' (texture seams joined). The Iron Knight's tabard flipped from one thigh to the other between
  neighbouring vertices and tore open between the legs: `{ "joints": "^(thigh|calf)_", "passes": 6 }`.
- `wrist` (`{ until, band }`, shares of the hand's length past the wrist joint): the skin up to `until` rides the
  forearm alone, easing back to the hand over `band` (a cuff or bracelet twisting with the hand).

`rehand-built.mjs` applies `fixes.skin` to a built file (`ONLY=<ids>`); `SIDES=r` (or `l`) refits only that hand,
the other kept as built (a refit from the built file measures a hand a little differently from the download, so a
fix for one hand needn't move the other: Zombie Soldier A).

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
hand into shards: Honest Abe's and Virtua Soldier's right hands), `together` (0–1, written on the hand for the game:
as the hand closes, its fingers come in toward the middle finger by that share of their spread, in every view; a
download's own fingers can be fanned wide, and closed as they lay they stood apart round the grip like a claw: Frost
Viking's 23 degrees from index to little finger, the Goblin Warlord's 20), for both hands or one (`l`, `r`). A rigid
gauntlet (`fingers: none`, curl 0) given a `curl` is skinned as a mitten that closes on the grip. The Iron Knight's
gauntlets (own fingers since its Iron Warden model) measure thick for their length, which caps the curl at 0.5; it has
`fixes.hands.curl: 1` (2026-11-06: they close round the grip in both views).

**Hand size against a gun.** A hand much bigger than a grip swallows it, worst in first person (Frost Viking's and the
Goblin Warlord's own hands were 24-28 cm long and 19-21 cm wide, splayed). `fixes.hands.scale` shrinks one at import
(prepare-meshy-characters.mjs, from the download; rehand-built leaves the scale out, as a built hand was scaled
already): about 20 cm long suits a 1.8 m body (Frost Viking 0.8; the Goblin Warlord right 0.75, left 0.85, its hands
were uneven). A hand with the download's own fingers keeps its finger and thumb joints in step: they are scaled about
the wrist with the skin (left where the download had them, the fingers curled about points past the shrunk knuckles,
a claw that folded its low-poly fingers into shards). A smaller hand closed fully can fold into shards too: soften it
with `curl` (Frost Viking's right 0.6, left 0.75).

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
head and shoulders, arms across the midline, stretched skin edges, which way
each drawn palm faces: the `palm` flag, see "Which side is the palm") and writes
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
- The aliens have no walk, attack or death clips of their own (procedural
  motion stands in).

## Hitboxes

Shots are tested against each look's own **hit shapes**, measured from its model (owner, 2026-11-04: exact per-look
hitboxes, no evening-out within a size class; small or thin looks are harder to hit). `packages/shared/src/sim/hitbox.ts`.

- **The shapes:** a head sphere; a torso capsule squashed across the body (`w`, half its width, against `r`, its
  depth, so a broad body is wider than deep); a round capsule for each thigh and each shin (with its foot), so the
  gap between the legs and a stride are not body; and an arm capsule only where an arm sticks out of the rest
  (mostly the forearms on the gun). Creatures get their own (an alien without legs or a head has none of those).
- **Margin** (owner, 2026-11-04: generous padding): every shape is tested `HITBOX_MARGIN` larger (constants.ts:
  `body` 0.18 m on the torso, legs and arms, `head` 0.12 m on the head sphere; metres at a 1.8 m body, scaled with its
  size), so players hit about as often as on the old 0.8 m capsule and TTK stays where it was (tuned on the duel,
  weapons, ballistics and bot-aim tests, which pass with main's thresholds). Each look keeps its own proportions: a
  standard chest is 0.68 × 0.62 m with the margin (0.32 × 0.26 measured), its head 0.50 m across (0.26).
- **Zones:** a round strikes the nearest padded surface; its zone is the shape whose own (unpadded) core the line
  passes deepest into or nearest to: head sphere = head (×`head`), thighs and shins = legs (×`legs`), torso and arms =
  body (1.0×). A shot at the face over a padded forearm is a head shot, one at the belt a body shot. No height bands
  (the old fixed 0.32 m head band was a third of a small look's height).
- **Stance and size:** standing, crouching and prone each have their own shapes, measured in the pose the game draws
  (below). They turn with the body's yaw and scale with its size (the size class, or a `size` stat). The game has
  no lean input; a hunched body's lean (`fixes.lean`, Hyena, Croakley) is in the model, so its shapes have it.
- **No animation per frame:** the host has no skeletons. The shapes are the clip's first frame, the same everywhere.
- **Lag compensation** records each body's feet, yaw, stance, scale and shapes; a rewound shot is tested against
  exactly what was there (`Match.targetsFor`). Bullets in flight rewind less each tick, as before.
- **Melee** keeps its forgiving reach capsule (`PLAYER.radius` at the body's size): a swing is a sweep. Thrown and
  launched projectiles (spears, rockets, grenades, discs) are `PROJECTILE_THICKNESS` (0.12 m) thick against bodies,
  on top of the margin; a sticky grenade sticks on the body (within 0.25 m of its middle), not out on the margin.
- **Not hittable** (owner, 2026-11-04): tails, capes' hems and hat brims (they are left out of the shapes). Crouched
  shapes may sit up to ~8 cm sideways of the drawn body (accepted).
  Medkit and ping aim keep their generous capsules.
- **Bots** aim at the real head (the head sphere's centre) and the middle of the real chest (`bots/aim.ts`); with
  the margin their aim error is as before and each difficulty hits as often as on main (botai.test.ts).
- **NPCs:** a creature is hit as drawn (its own shapes in its own metres); an NPC drawn as a character look uses that
  look's shapes at the role's scale; soldiers the male or female mannequin (as the client picks, by id); zombies the
  zombie body or the mannequin. A player in a creature skin uses the creature's shapes fitted to a player's height.
- **Movement collision is unchanged:** the player collider is still the 0.4 m capsule (physics.ts).

**How they are measured** (`tools/content/hitboxes.mjs` → `packages/shared/src/content/hitboxes.generated.ts`;
`pnpm content:check` fails while it is out of date, `pnpm content:rebuild` rewrites it). Each look's model (a whole
body, or a part-built look's head, parts and hair; custom designs use their body's mannequin) is posed in Node
(`tools/content/skinpose.mjs`) as the game draws it, holding a gun: standing `aim_idle`; crouching `crouch_idle`'s
hips and legs, the chest, neck and head three quarters of the way to the aim pose (`CROUCH_AIM`: the animator layers
the aim pose over the upper body and the hold lifts the gun to the eye) and the standing arms carried with the head;
prone `prone_idle`. Crouched, the drawn upper body also turns a little toward the gun, so crouched shapes can sit a
few centimetres off sideways. Its vertices are
grouped by the joint holding them (head, torso, thighs, shins, arms) and fitted: the head sphere holds 80% of the
head's vertices (ears, horns and brims stick out) and stands no higher than the head; the torso's axis follows its
own line, and vertices far from the spine (a tail, a cape's hem) are left out. Everything is in metres at a 1.8 m
body (the game fits every character's rest height to 1.8 m), creatures in their drawn metres.

**Overrides** in the look's manifest (`content/characters/<id>.json`), applied to every stance:

```json
"hitbox": { "head": { "r": 0.13, "dy": 0.02, "dz": 0.01 }, "torso": { "w": 0.24, "r": 0.15 }, "legs": { "r": 0.08 }, "arms": false }
```

`head.r`, `torso.w`/`r` and `legs.r` are absolute (m at 1.8 m), `dy`/`dz` move the head, `arms: false` drops them.
Then `node tools/content/hitboxes.mjs`. None are set yet.

**Seeing them:** Options → Display → **Show hitboxes** (only on a dev server, a test build or a page served from
this machine), or `?hitboxes=1`: every body's shapes over it in a match (head red, torso yellow, arms green, legs
blue), and a faint shell round each with the margin that shots are actually tested against. The character viewer (`?mode=characters`) has **Hitboxes** and **Stand / Crouch / Prone** buttons
(`&hitboxes=1`; `window.__charHitboxes(on, stance)`).

**The audit** (`tools/content/test/hitboxes.test.mjs`, in the unit tests): for every look and creature, posed
standing, the shapes' top within 0.1 m of the model's (a pointed hat may stand 0.12 m over the head), their bottom
within 0.12 m of its feet, the head sphere's centre within 0.1 m of the drawn head's middle, and at least 85% of
the model's vertices inside the shapes with 4 cm of slack (creatures 70%). `HITBOX_AUDIT=1` prints every look's
numbers. The same file checks shots at the drawn heads of a short, a tall and two hunched looks.

**Cost:** a shot against 96 bodies is about 8-12 µs (a bounding-sphere test rejects almost every body; the old
capsule test was 13-19 µs); `HITBOX_BENCH=1 npx vitest run packages/shared/test/hitboxPerf.test.ts`.

## Character stats

A look may set its own stats in its manifest (`stats`), each optional; one left out is its size class's value, so
nothing changes until a field is set (`packages/shared/src/sim/characterStats.ts`):

| Stat | Range | Without it | Wired into |
|---|---|---|---|
| `health` | 50–200 | size class: 85 / 100 / 115 | health on spawn, the most pickups give |
| `speed` | 0.8–1.25 | 1.06 / 1 / 0.94 | movement (and now client prediction) |
| `size` | 0.7–1.3 | 0.78 / 1 / 1.18 | body, collider, eyes and hit shapes (as the class scale) |
| `damage` | 0.75–1.3 | 1 | damage dealt by everything but melee |
| `stamina` | 0.5–2 | 1 | sprint stamina drains this many times slower |
| `jump` | 0.8–1.3 | 1 | jump speed (and a class's double jump) |
| `melee` | 0.5–2 | 1 | damage dealt by knives, axes, punches and kicks |
| `armor` | 0–0.4 | 0 | share of incoming damage shrugged off (before armor pickups) |

```json
"stats": { "health": 120, "speed": 0.95, "armor": 0.1 }
```

The match setting **Character stats** (On / Off; `MatchRules.characterStats`, setup `stats`, host rule `stats`)
off ignores every look's own stats: everyone plays their size class (owner, 2026-11-04: it doesn't touch size classes;
Character sizes: All equal makes everyone standard).
Character Select shows a look's stats as bars (each across its range, a mark at standard; green above, amber below)
while the match setup has stats on. The Workbench's **Characters** collection edits them. The manifests' checker
keeps its own copy of the ranges (`STAT_RANGES` in character-manifests.mjs; a test keeps them equal). Speed, jump
and stamina reach the predicting client in the private state (`bs`).

## Random characters

The match setting **Random characters** (Off by default on every map; `MatchRules.randomCharacters`, setup
`randomChars`, host rule `randomchars`): everyone, people and bots, plays a random look each life, any on the roster
(`CORE_LOOKS`: playable, not retired; never NPC-only bodies or NPC skins). The pick hashes the match seed, the slot
and the life (`sim/randomLooks.ts`: the same every replay, never the look just played); the look travels in the
`spawn` event (and the roster for anyone joining later), and its size, stats and hit shapes go with it. Off again,
each plays their own choice from their next life. It works with Character stats on or off.

## Character sizes

Every look is small, standard or large (`size` on the look; custom looks add
`-s` / `-l` to their ID, and the Character Designer has a Size choice on the
Body tab). Presets: Sprout is small, Bulwark is large, everyone else standard.

| Size | Body (height, width, eyes) | Speed | Health |
|---|---|---|---|
| Small | × 0.78 (1.40 m tall) | × 1.06 | 85 |
| Standard | 1.80 m | × 1 | 100 |
| Large | × 1.18 (2.12 m tall) | × 0.94 | 115 |

The body size scales the hit shapes (see Hitboxes) and the collision capsule, so small characters
are harder to hit and fit through gaps others must crouch for (a 1.6 m
ceiling, a low window), and large ones are easier to hit and must crouch
under openings a little over 2 m. A look's own `size` stat (Character stats) replaces its class's scale. Health pickups fill up to the size's
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
