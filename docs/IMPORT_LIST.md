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
- **Batch 1, Cool Hands Rex and Fishy Fred** (2026-11-07, `wip/intake-rex-fred`; HANDOFF, "Import list batch 1"). Both
  downloads (Drive ids `1divaI19ZlfSTFOIKMuGdtrcNKPIRkaYO`, `1B0ssiBuvghCSbT0zDi2DQcHaVbOupnEQ`) are in
  `/home/user/meshy-drive/intake-2026-11-06b/`.
  - **Cool Hands Rex** (`meshy_trex`, `core.trex`; Meshy, owned: "i made him in meshy"): the whole 10.4k-triangle
    download, its two 4096 px maps baked to a 1024 px colour and normal map; large, Creatures & Machines, gangster bot
    names. No index finger: the fingers are re-fitted from the mesh, a claw on the trigger; grip audit 0. The tail rides
    the hips (`fixes.centre` stands the body over its origin): clear of the ground walking, running and crouching,
    through it only when he lies dead (as the crocodile's); left out of the hit shapes on purpose, as every tail.
  - **Fishy Fred** (`meshy_fishyfred`, `core.fishyfred`; Meshy Community CC0, author and post URL pending): the whole
    5k-triangle download; small, Animals, critter bot names. The download's rig had the face on a collarbone: the fish
    rides the chest and its face the head (`fixes.skin.rigid`), so head shots are the face. Mitten hands scaled 0.7, grip
    tuned; grip audit 5 -> 0.
  - **For the owner:** Fred's name (the download's is a placeholder) and his post URL.
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
