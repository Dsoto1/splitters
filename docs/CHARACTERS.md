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

| File | Role | Notes |
|---|---|---|
| `rig.glb` | Animation source | Mannequin and skeleton with 20 clips from Universal Animation Library 1 + 2. The mannequin is also the NPC body, tinted to the faction colour |
| `head_male.glb`, `head_female.glb` | Heads | Cut from the base bodies (the triangles skinned to the neck and head) |
| `outfit_ranger_m/f.glb`, `outfit_peasant_m/f.glb` | Outfits | The full body below the head; each carries the skeleton |
| `hair_*.glb` | Hair and beards | Simple parted, buzzed and beard (male); long and buns (female) |
| `textures/*.jpg` | Colourways | The packs' alternative base colour textures, swapped in at runtime |

Clips: `idle`, `aim_idle`, `walk`, `run`, `sprint`, `jump_start`, `jump_air`,
`jump_land`, `death`, `hit`, `shoot`, `reload`, `melee`, `melee_heavy`,
`interact`, `dance`, `knockback`, `throw`, `cheer`, `idle_arms`.

## Looks

A look (`packages/shared/src/content/looks.ts`) is a body, head, outfit,
optional hair and optional colourway. Six presets ship: Ranger, Huntress,
Warden, Scout, Farmhand and Miller. Players pick one on the main menu
(remembered locally). It's sent in `hello` and carried in the roster, so every
client sees it. Bots get a spread of looks; unknown IDs fall back to the
default.

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

- `?mode=characters`: viewer with every look and the NPC trooper and heavy, plus
  buttons for each motion, one-shot and weapon, and an aim-pitch slider.
  `&alpha=`, `&dist=` and `&x=` set the camera.
- `node tools/content/prepare-characters.mjs <downloads dir>` rebuilds the parts
  from the original pack downloads (the free "Standard" editions; about 500 MB,
  so they are not in the repo). The script records every change made to them.
- `pnpm content:check` verifies the shipped files against
  `content/characters.lock.json` (hashes, triangle and size budgets, licences)
  and lists them in `content/provenance.json`.

## Known gaps

- Triangle counts are high for a 32-player shooter: Ranger is about 23k with head
  and hair. LODs, or a further simplification pass, come before large lobbies.
- No first-person arms yet; the viewmodel is still just the weapon.
- The Character Designer (mixing parts and colours freely), more outfits and
  era costumes on the same rig, and twelve presets are the rest of M5.
- NPCs use the plain mannequin in faction colours until faction outfits exist.
