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
- **Licence:** Meshy Community CC0, unless the owner says they made it.
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

## Done
Nothing yet.
