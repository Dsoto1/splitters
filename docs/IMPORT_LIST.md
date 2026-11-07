# Import list: the owner's new models (started 2026-11-06)

The owner said on 2026-11-06: "I'll be trying to generate brand new ones going forward and we can just begin working on
a new import list." This file is that list. Earlier intakes are in HANDOFF: "Drive intake of 2026-11-05", "Intake
step 2" and "Intake of 2026-11-06".

## How it works
- **Where the files are.** The owner puts models in their Drive folder (`18MaKefMCWARf1Y3gAjhZuxTto86vGAYl`, shared by
  link). Download them with gdown into `/home/user/meshy-drive/<batch>/`. Never commit raw downloads.
- **Licence** (CLAUDE.md, "Content rules"):
  - A model is **Meshy, owned** only when the owner says they made it.
  - Every other Drive model is **Meshy Community CC0**.
  - CC BY 4.0 posts must be credited.
  - The owner plans to generate new ones themselves from now on, so expect "owned" to be the usual case. Still take it
    from what the owner says, per model.
- **One agent per batch, when a slot is free.** It follows the steps the 11-06 intake used (session scratchpad
  `briefs/intake-1106.md`; docs/CHARACTERS.md; docs/CONTENT_PIPELINE.md, characters and Meshy):
  - a manifest in `content/characters/`;
  - `prepare-meshy-characters.mjs`;
  - a rebake to the usual budgets: about 10–14k triangles, a baked normal map, an LOD;
  - size class and group, which also set bot names and themes;
  - the grip audit, with `fixes.hands` and `fixes.grip` where needed;
  - a portrait;
  - provenance;
  - `pnpm content:rebuild`.
- **Names.** Use the owner's name when they give one. Otherwise use the file's name as a placeholder and say so.
- **Keeping the list current.** Add each new model here when the owner mentions it. Move it to "Done" when it lands on
  main.

## Batch 1: queued after the work in flight (owner, 2026-11-06: "for after all of this work")
"The work in flight" is:
- Bot AI Phase A;
- the map retirement;
- set pieces part 2;
- the Match Setup follow-ups;
- the intake follow-up;
- the prop slack pass.

Batch 1 can run beside Bot AI Phase B.

Both models are already downloaded to `/home/user/meshy-drive/intake-2026-11-06b/`. Re-download them if the container
was replaced.

### Cool Hands Rex
- **File:** `Meshy_AI_Cool_TRex_10k_20261106_animated_mixamo_All_animation.glb`, Drive id
  `1divaI19ZlfSTFOIKMuGdtrcNKPIRkaYO`.
- **What it is:** a T-rex.
- **Licence:** Meshy, owned. The owner said "i made him in meshy".
- **Name:** "Cool Hands Rex", from the owner.
- **Measured:**
  - 10.4k triangles in one skinned mesh: in budget already.
  - Two 4096² textures: bake them down.
  - A Mixamo rig with 70 joints. On top of the Mixamo set: `Bone_015`–`Bone_020` (probably the tail) and
    `Bone_034`–`Bone_039` plus `headfront` (probably the jaw and head).
  - Each hand has a thumb, middle, ring and pinky. **There is no index finger.**
  - Mesh extent 2.37 × 2.00 × 1.79 (x, y, z), before the pipeline's scaling.
  - The download carries Running and Walking clips. The game's own clips replace them.
- **To check:**
  - **Size class.** Large by build seems likely; decide by eye, as for the tortoise.
  - **The tail.** The game's clips don't drive the extra bones. Check the tail sits well when running and doesn't
    clip the ground. Also check the hitbox fits it, or deliberately leaves it out.
  - **Grip.** A grip needs an index finger on the trigger. Map the nearest finger, or use `fixes.fingers`, and show
    the audit numbers.

### Fishy Fred
- **File:** `Meshy_AI_Fishy_Fred_20261106_animated_mixamo_All_animation.glb`, Drive id
  `1B0ssiBuvghCSbT0zDi2DQcHaVbOupnEQ`.
- **What it is:** a fish.
- **Licence:** Meshy Community CC0. The owner confirmed on 2026-11-06: "I did not make fishy fred, community."
- **Name:** "Fishy Fred", the file's name, until the owner names it.
- **Measured:**
  - 5.0k triangles.
  - One 2048² texture.
  - A Mixamo rig with 50 joints.
  - Each hand has a thumb, middle and pinky. **There is no index finger and no ring finger.**
  - Mesh extent 1.42 × 1.28 × 1.12, before the pipeline's scaling.
  - The download carries Running and Walking clips.
- **To check:**
  - **Size class.** Small by build seems likely; decide by eye.
  - **Grip.** Same check as for the Rex: a grip needs an index finger on the trigger.

## Batch 2: weapons and grenades (owner, 2026-11-06). Queued after Bot AI Phase B takes its slot
**The owner:**
- "Added a bunch of new weapons, all Meshy community."
- On the 3DModelsCC0 kit: "Replace our tommy gun with the 3DModelsCC0 one, and bring in those others to replace any
  one-off originals … not sure we need the nuclear bomb or flare gun."
- "Retain the fidelity of the texture best we can: sharper, clearer, better resolution."

**Meshy Community CC0, 11 downloads** (raw files in `/home/user/meshy-drive/intake-2026-11-06c/`):
- **Guns:** BK-220, Plasma Defender, Revolver Rustique, Scrapfire Assault Blaster, a sci-fi fire suppressor, and an
  unnamed long gun.
- **Grenades:** "just a grenade", Sunburst, Globe, Toxic Splash, Countdown Sphere.
- They are 5k to 1.5M triangles, with 2048–4096 textures.

**The 3DModelsCC0 Guns & Explosives pack:**
- The tommy gun replaces `core.smg`'s model.
- The rest replace weaker originals; skip the nuclear bomb and the flare gun.
- **Waiting on the owner** to put `Guns&Explosives.rar` in the Drive. itch.io can't be reached from the dev container.

**Grenades: the owner's picks** (2026-11-06; picture `nadeview/grenades-sheet.jpg` in the session scratchpad):
- Countdown Sphere → sticky;
- Globe → frag (the 3DModelsCC0 frag as the realistic alternative);
- "just a grenade" (blue swirl) → vortex;
- Sunburst → cluster bomb;
- Toxic Splash → gas;
- **the 3DModelsCC0 smoke grenade → a new Smoke grenade**, with the sci-fi canister as its Sci-fi set look. The smoke
  blocks sight for players and bots; bots use it when they push.

**No flashbang** (owner: "I don't want to give people seizures").

**Sharper textures:**
- The weapon in your hands gets 2048 / 1024 / 512 colour maps by graphics setting, instead of today's 512 for
  everything.
- Other copies (other players' weapons, drops, pickups) stay small.
- Measured for download and video memory.

The brief is `briefs/weapons-intake.md` in the session scratchpad.

## Wanted: grenade and throwable models (owner, 2026-11-06: "do we have better grenade models?")
**Since batch 2** (above): the frag, sticky, gas, incendiary, vortex and cluster bomb have models, and the new Smoke
Grenade. Still wanted: the holy bomb, airstrike flare, dynamite, sheep and sandbags (drawn in code).
**Today:**
- Only the **frag** (Styloo's low-poly grenade, `guns/frag.glb`, about 530 triangles) and the **proximity mine**
  (3DModelsCC0's anti-tank mine) are real models.
- The rest are shapes built in code (`client/src/game/arsenalVisuals.ts`).
- Grenade pickups on the ground are coloured balls (`pickupVisuals.ts`).

**Two sources:**
- **The 3DModelsCC0 Guns & Explosives pack** (CC0, 19 realistic guns and explosives). It was imported on
  2026-10-28, but only its mine was used: the rest looked too realistic for the game then. We don't keep the raw
  download, and itch.io can't be reached from the dev container. If the owner puts `Guns&Explosives.rar` in the Drive,
  check it for grenades.
- **The owner's own Meshy generations** (Meshy, owned).

**Wanted:**
- frag;
- sticky grenade (a light on it);
- incendiary (a bottle with a rag);
- gas canister;
- dynamite (a stick or a bundle with a fuse);
- holy bomb (a gold orb with a cross);
- cluster bomb;
- airstrike flare (a smoke flare);
- vortex grenade (sci-fi).

**Budget:** each about 3,000 triangles or fewer, one material, real size (a frag is about 10 cm).
The same model is used in the hand, in flight, and as the pickup on the ground.

## Done
- **Batch 2, weapons and grenades** (2026-11-07, `wip/weapons-1106`): every model rendered and given a role or set
  aside; ARSENAL.md, "Weapons intake of 2026-11-06", has the table and HANDOFF the pictures. The pack arrived in the
  Drive on 2026-11-06 (`Guns&Explosives.rar`).
  - **Used:** Suomi KP (SMG), AK-47 (rifle), M4A1 (burst rifle), Makarov (pistol), Grease Gun (machine pistol),
    Shotgun, Sniper (marksman rifle), smoke grenade (the new Smoke Grenade), Molotov (incendiary), frag (the frag's
    Military look); BK 220 (hand cannon), Revolver Rustique (heavy revolver), the unnamed gilded flintlock (gilded
    pistol), Plasma Defender (pulse pistol), Scrapfire (nailgun); the Globe, Countdown Sphere, "just a grenade",
    Sunburst and Toxic Splash grenades as the owner picked; the sci-fi canister (the smoke's Sci-fi look).
  - **Spare** (no place yet; each is a quick build from the same download): the Luger (a second pistol look, e.g. for
    a WWII set), C4 (a Military sticky look), the claymore (a proximity mine look; the AT mine reads fine), the pipe
    bomb and the M24 (neither reads as Frontier dynamite).
  - **Not imported:** the nuclear bomb and the flare gun (the owner), the flashbang (dropped over seizure risk).
  - **For the owner:** the Flare Gun weapon (`core.flare_gun`) is the one sidearm still on its flat kit model; the
    pack's flare gun (modelled broken open for loading) is there if you want it after all.
