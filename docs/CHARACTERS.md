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

- **Legs:** crossfaded loops chosen by speed and airtime (aim idle, walk, run,
  sprint, airborne). Playback rate matches ground speed; backpedalling plays
  the loop in reverse.
- **Upper body:** holds the aim pose while moving, so the weapon stays up.
  One-shots (shooting, melee, reloads) play over it through an upper-body mask.
- **After the clips:**
  - The spine is bent for aim pitch and twisted toward strafing.
  - The weapon is placed and the hands close on it (below).
- **Death:** plays once and holds until respawn. Intermission plays the dance.

Clips are retargeted from the rig onto each character's joints by name. The
hip track is offset per body type.

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
  the camera.
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
- In game, `content/creatures.ts` (`CreatureLibrary`) loads and instances
  them and `game/creatureAnimator.ts` drives them; `view.ts` uses them when an
  avatar's spec names a creature. No ragdoll: their death plays and the body
  is left as a corpse.
- `?mode=characters` shows the five creatures in a row in front of the
  characters, driven by the same buttons.

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
