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

Mixing rules for the Character Designer:
- The athlete torso includes bare arms, so it doesn't take an `arms` part.
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
  - The weapon model follows the right hand.
- **Death:** plays once and holds until respawn. Intermission plays the dance.

Clips are retargeted from the rig onto each character's joints by name. The
hip track is offset per body type.

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

## Known gaps

- Triangle counts are high for a 32-player shooter: a full ranger is about 19k
  with head and hair. LODs, or a further simplification pass, come before large lobbies.
- No first-person arms yet; the viewmodel is still just the weapon.
- The Character Designer (mixing parts, colours and tints freely) and more
  outfits and era costumes on the same rig are the rest of M5. The free pack
  editions hold only the Ranger and Peasant outfits; the other ten are in the
  paid Source editions.
- NPCs use the plain mannequins in faction colours until faction outfits exist.
