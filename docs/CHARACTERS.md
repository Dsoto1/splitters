# Characters

Players, Player Bots and NPCs are animated characters built from CC0 parts by
Quaternius (see [`ASSET_SOURCES.md`](ASSET_SOURCES.md)). Nothing is generated:
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
| `hair_simpleparted`, `hair_buzzed`, `hair_beard` | hair | Male; a look can wear hair and a beard |
| `hair_long`, `hair_buns`, `hair_buzzedfemale` | hair | Female |
| `textures/*.jpg` | — | Shared base colour maps: `ranger`, `peasant`, `skin_m/f`, `athlete_m/f`, `hair_1/2`, and the colourways `ranger_moss`, `peasant_dusk`, `athlete_light_m/f` |

Parts carry no textures of their own: the game assigns the shared maps by
material name (`textureFor` in `looks.ts`), so a texture downloads once however
many parts use it.

Clips: `idle`, `aim_idle`, `walk`, `run`, `sprint`, `jump_start`, `jump_air`,
`jump_land`, `death`, `hit`, `shoot`, `reload`, `melee`, `melee_heavy`,
`interact`, `dance`, `knockback`, `throw`, `cheer`, `idle_arms`.

## Looks

A look (`packages/shared/src/content/looks.ts`) is made of:
- a body type and a head;
- outfit parts (at most one per slot; the first carries the skeleton);
- hair (any number);
- colourways;
- a skin tint and a hair tint, multiplied over the textures.

Fourteen presets ship. Between them they use every part, hairstyle and
colourway, and a unit test keeps it that way:

| Preset | Made of |
|---|---|
| Ranger, Huntress | Full ranger outfit |
| Warden, Scout | Ranger in moss |
| Farmhand, Miller | Peasant, Miller in dusk |
| Tracker, Pathfinder | Ranger top with peasant trousers |
| Drifter, Wayfarer | Peasant with a ranger hood |
| Brawler | Shirtless with peasant trousers and shoes |
| Sprinter | Base body sportswear |
| Champion | Light sportswear, barefoot, with a ranger pauldron |
| Striker | Light sports top with ranger trousers, boots and pauldrons |

Players pick one on the main menu (remembered locally). It's sent in `hello`
and carried in the roster, so every client sees it. Bots get a spread of looks;
unknown IDs fall back to the default.

## Character Designer

Main menu → **Design…** next to the Character picker (or `?mode=designer`).
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
  opposite of the motion and plays the gait backwards.
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

## Holding weapons

Each weapon's `view.hold` (in `packages/shared/src/sim/weapons.ts`) gives a
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

### First-person arms

Your own view shows your look's arms holding the viewmodel:
- **Which arms:** the arms part of your look. Under a sportswear top it's `athlete_fparms_m/f`, bare arms cut from the base body for this view only.
- **Whole-body characters** (Iron Knight, Capt. Nova, The Dapper, the creature originals: Goblin, Wealthy Otter, Boglurker, Salamander Warlord, Hyena Warrior, and the community originals: Elder Tomo, The Visitor, Biscuit, Flt. Lt. Ember, Cap'n Barnacle, Big Bogdan) wear the universal arms in first person: a base-body arms part on the shared rig (so every gun's grip fits), with the sleeves dyed and the hands tinted to match the character (`whole.cloth`/`trim`/`skin` in `looks.ts`; a glove colour goes in `skin`). The bare-armed creatures wear the peasant arms with the sleeves dyed to their skin.
- **Placement:** they hang from the camera a little in front of the eyes. The shoulders are never in view, and long guns stay within reach.
- **Grip:** the gun keeps its tuned viewmodel placement, with bob, recoil and the reload dip. `gripExternal` IKs the palms onto its grip and support points with the same solver as third person.

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

## Portraits

Character Select, the player badge and the HUD show a portrait of each look,
rendered from the 3D character by `client/src/frontend/portraits.ts`: head
and shoulders, framed from the neck joint up to the top of the model and
centred on the head joint (any body shape), three-quarter from the front;
creatures whole. The built-in looks' portraits ship with the site
(`client/public/portraits/*.webp`, listed in `frontend/portraitIndex.ts`) so
the menu shows them at once. They're made by the **Capture portraits**
workflow (`tools/content/capture-portraits.mjs`, the same renderer), which
commits them to `check/portraits`; run it after adding characters or changing
the framing. A look without a shipped portrait (new since the last capture,
or a player's own design) is rendered live in the browser, as before.
