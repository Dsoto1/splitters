# Arsenal: weapons, ammo, throwables and destruction

All gameplay numbers live in `content/weapons/*.json`, `content/throwables.json`
(built into `packages/shared/src/content/weapons.generated.ts`; docs/CONTENT_PIPELINE.md,
"How to add a weapon") and `content/pickups.json` (pickups; "Pickups" there); nothing in the simulation names a specific weapon.

| Slot | Weapon | Ammo | Second trigger (right mouse) |
|---|---|---|---|
| 1 | Knife | — | — |
| 1 | Battle Axe (pickup) | Shells (12, for the barrel) | Blunderbuss: 9 wide pellets, 2 loads, each loaded by hand from the shells |
| 2 | Pistol | Light rounds | — |
| 3 | Assault Rifle | Rifle rounds | Underbarrel grenade (own ammo, 4 max) |
| 4 | Shotgun | Shells | Both barrels (2 shells, 16 pellets) |
| 5 | Sniper Rifle | Sniper rounds | Zoom |
| 6 | Grenade Launcher | Explosives | — |
| 7 | Submachine Gun | Light rounds | — |
| 8 | Rocket Launcher | Explosives | — (rockets fly straight, hit hard) |
| 9 | Plasma Rifle | Energy cells | Charged orb (8 cells, big splash) |

Right mouse fires a second trigger when the held weapon has one, otherwise it
zooms.

## Gunplay (GUNPLAY_SPEC.md; status in GUNPLAY_GAPS.md)

The gunplay model lives in `sim/gunplay.ts`, driven by each
`WeaponDefinition`: a `family` gives defaults and the weapon's own
`ballistic`, `accuracy`, `kick`, `reload`, `falloff`, `headshot` and
`legshot` override them. Server, client prediction and bots run the same
code.

- **Bullets fly.** Conventional guns fire ballistic bullets: the first 8 m
  are an instant ray, then the round flies at its muzzle velocity, drops
  under gravity and is integrated in two sub-steps a tick. Lag compensation
  rewinds targets for the near ray and for the ticks the shot spent reaching
  the server, then the bullet flies against the live world: you lead for
  travel, never for latency. Beams, the railgun, the gilded pistol and
  shotgun pellets stay hitscan; rockets, grenades and plasma are slow
  projectiles as before.
- **Recoil is mechanical and learnable.** Every round kicks the real aim by
  the weapon's deterministic pattern (with a small, bounded, deterministic
  sideways wobble). Let go and the aim settles back to where the spray
  started along the weapon's own curve. Pull down against it and the recoil
  is used up instead of turning your view, so it never overshoots. The
  camera shows it; the viewmodel kick and a light shake are visual only.
- **Spread** = base + movement + air + sustained fire after the first
  `tight` rounds, capped, then scaled by stance and the sights (accuracy
  blends in while the sights come up; firing is never blocked).
- **Reloads** are staged: magazine out (its rounds go back to reserve; a
  tactical reload keeps one chambered), new magazine in, then the bolt on an
  empty reload. Shotguns and the revolver load round by round and each round
  can be fired straight away. Firing (with a round ready), swapping, sprinting
  off and using something all stop a reload where it is. Tactical reloads are
  quicker than empty ones.
- **Damage** falls off with distance by family and body zones multiply by
  family (shotgun heads ×1.25, precision ×3). Lethality (arcade / standard /
  tactical) scales all of it; Ballistics (arcade / standard / advanced)
  scales velocity and drop.
- **Materials.** Free blocks, props and destructibles are glass, wood,
  drywall, brick, concrete, metal and so on; rounds go through thin cover
  with what energy they have left and come out weaker, and rarely glance off
  metal at a grazing angle. Tile structure counts as concrete.
- **Feedback.** Body hits draw a diamond, head hits a bigger red one with a
  ding, armor a blue square with a clank, kills a sharp X with a crunchy
  confirmation that climbs in pitch with each kill in a row. Tracers fly at
  real speed and only on tracer rounds (`tracerEvery`, plus the magazine's
  last rounds).

**Benchmark weapons** (spec §51 and the seven of GUNPLAY_DIRECTION.md; the
feel audit and the reasoning are in [GUNPLAY_AUDIT.md](GUNPLAY_AUDIT.md)):

| | Service Pistol | Heavy Revolver | SMG | Assault Rifle | Shotgun | Precision (Sniper Rifle) | Rocket Launcher |
|---|---|---|---|---|---|---|---|
| Weapon | `core.pistol` | `core.revolver` | `core.smg` | `core.rifle` | `core.shotgun` | `core.sniper` | `core.rockets` |
| Damage (body) | 24 | 90 (head kills at any range) | 11 | 18 | 10 pellets × 12 | 80 (head ×3) | 40 hit + 120 splash, 5 m |
| Rate | 360 rpm, semi | 90 rpm, semi | 900 rpm | 600 rpm | 80 rpm | 48 rpm | a rocket per 1.5 s |
| Magazine | 12 | 5 | 32 | 30 | 6 | 5 | 1 |
| Velocity | 375 m/s | 300 m/s | 400 m/s | 820 m/s | hitscan pellets | 950 m/s, 2.5 × gravity | 30 m/s |
| First kick | 0.012 rad | 0.12 rad | 0.003 rad, climbing to 0.011 | 0.010, then 0.0085 per round | 0.06 rad | 0.07 rad | — |
| Spread | true first shot | true first shot; 0.022 if fanned | tight 5 rounds, then +0.0065/round | tight 3, then +0.0012 | fixed 0.075 pattern | exact once settled; 0.03 no-scope | — |
| Reload tactical / empty | 0.83 / 1.1 s | round by round: 0.3 s + 0.3 s a round + 0.17 s | 0.9 / 1.2 s | 1.4 / 1.8 s | shell by shell | 1.5 / 1.83 s | 0.9 s |
| Equip | 0.15 s | 0.27 s | 0.2 s | 0.33 s | 0.27 s | 0.5 s | 0.53 s |
| Falloff | 18→45 m to 65% | 25→60 m to 70% | 12→35 m to 55% (steep) | 30→80 m to 75% | 6→22 m to 25% (steep) | 150→300 m to 90% | self-damage ×0.75 |

The **Heavy Revolver** (slot 2, pickup `core.weapon_revolver`) uses the Meshy community Revolver Rustique (CC0 per
the owner, `guns/revolver_rustique.glb`, since the weapons intake of 2026-11-06, below); it replaced the earlier Meshy
revolver (`guns/ironclad_revolver.glb`: the 2026-01-26 download, its lettering painted out; still built), and the
Quaternius revolver stays its fallback. Its holds are read
off the model's own grip (`grip` / `support` in the weapon's `content/weapons/<name>.json`); aiming down the sights
lines the top of the front and rear sights up under the eye.

**Training Range** (`maps/training_range.json`, built by
`maps/training_range.json`): the gunplay test arena
of GUNPLAY_DIRECTION.md, described in [GUNPLAY_AUDIT.md](GUNPLAY_AUDIT.md#gunplay-test-arena).

**Ammo boxes** (2026-11-13; `sim/resupply.ts`). A map's Ammo Box (`core.ammo`,
placed as a pickup in MapMaker) is a solid crate in play, the WWII Ammo Crate:
press Use beside it (within 1.5 m) to resupply, which fills every carried gun's
reserve and underbarrel rounds and tops your grenades up to their kind's most
(none carried: the weapon set's first kind; never sandbags, the airstrike flare or
another kit). Each crate holds 10 resupplies; each player waits 4 s between two.
Emptied or destroyed, it is gone until its pickup's respawn time (at least 20 s)
has passed, then back full. The **Ammo Box Kit** (`core.ammo_box_kit`, a
throwable carried like Sandbags, one at a time) sets one down where it lands: 10
resupplies for 2 minutes, one per player (setting down another takes the first
away). Shots and blasts hurt a box (80 health placed, 60 deployed); destroyed, it
**cooks off**: a round of small blasts round it over 2.6 s (16 at the centre, 3 at
the 2.4 m edge), from one for an empty box to eight for a full one, credited to
whoever destroyed it. Tanks refill their cannon pulled up beside a placed crate
(a use). Bots short of ammo walk to a box and press Use; a box being shot (under
60 % health) is off their list, and a cook-off is a hazard they wait out.
**Ammo pickups.** Typed boxes (Light, Rifle, Shells, Sniper, Explosives,
Energy Cells; told apart by their stripe colour) fill every weapon of that type
with a full pickup; Explosives also refill underbarrel grenades. (A random
pickup that rolls the general Ammo Box stays a walk-over pickup: half a pickup
to every weapon and one underbarrel grenade.)

**Throwables (G).** One kind is carried at a time, with a count shown beside
the ammo. Frag grenades bounce and go off after 2.5 s (everyone spawns with
one; packs give two, up to four). Proximity mines stick where they land, arm
after 1.2 s and go off when an enemy comes within 2.2 m. Bots throw grenades
at targets 6–18 m away. Each throwable with a model (content/throwables.json
`view`) shows it in your hands while you line up the throw (G held: the gun goes away, both hands on it), in flight
and lying as a pickup (two of it on the ring); see "Weapons intake of 2026-11-06" below.

**Destruction.** Destructible entities: crate, explosive barrel, breakable
wall, window pane (one hit), board barricade, gas cylinder (explodes) and
generator (explodes). Panes and boards snap to doorways and windows. 84 props
are breakable too, and powder kegs, machines, valves and fire baskets explode.
Explosions chain into other destructibles in range.

## The Battle Rifle: fire modes, full-quality model, a real optic (2026-11-16)

The owner (2026-11-16): fire modes for the Battle Rifle, single and a 3-round burst; "can't you just use the same one
but not reduce quality?"; and a real 3-4x scope instead of the modelled one.

**Fire modes** (spec §36; shared `sim/fireModes.ts`). A weapon may list `fireModes` (content/weapons); the first is its
own trigger (`fireMode`, `fireIntervalTicks`, `burst`, `kick`), a later one overrides the interval, the burst and the
kick. **U** switches round them (B, the usual key, is the quick-message and order key: `FIRE_MODE_KEY`, reserved for the
weapon wheel), with a small click (the magazine's metal click, quieter and higher); the HUD shows the mode under the
weapon's name (pips: one round, the burst's count, a bar for auto; then its name and U). The mode wanted rides in
every input (`PlayerInput.fireMode`, an index; absent keeps the gun's), so the host applies it (`WeaponState.mode`) and
client prediction replays it input for input like the trigger itself; an older host ignores it (first mode). A burst
fired in one mode finishes on its own timer if the mode changes mid-burst. Weapons without a list read through the
same code with their one mode: the Burst Rifle (3 × 4 ticks, 24-tick cycle) and every semi-auto fire exactly as before
(`fireModes.test.ts` checks every weapon). Bots burst inside 22 m and fire single past it, with a 3 m band either way
(`bots/fireModePick.ts`).

| Battle Rifle | Single | Burst |
|---|---|---|
| Trigger | one round a press, at most every 12 ticks (300 rpm) | 3 rounds 5 ticks apart (720 rpm), next burst 33 ticks after the first round |
| Kick per round (pitch / yaw, mrad) | 26, 30, 34 up (the weapon's) | 7, 6 up; 15 right then 20 back left (the burst's own) |
| Body kill, perfect control | 0.60 s (4 rounds) | 0.55 s (a burst and a round) |
| Two heads, perfect control | 0.20 s | 0.083 s (in one burst) |
| No recoil control, chest aim (10 / 20 / 30 / 40 m) | 0.60 / 0.40 / 0.42 / 2.8 s | 0.55 / 0.17 / 0.57 s / no kill in 3 s |
| No recoil control, head aim (10 / 20 / 30 m) | 0.20 / 0.20 / 0.22 s | 0.083 / 0.55 / 0.57 s |

(The 0.17 s and 0.40 s at 20 m: the climb walks a chest-aimed round into the head, for both.) So the burst is the
close-quarters mode: the burst's second round jumps sideways too quickly to pull against, so two heads in one burst
only work inside about 12 m and past 35 m a burst mostly misses; Single owns range. The Battle Rifle's place is kept:
never the quickest body kill of the rifles on paper (the Assault Rifle's 0.5 s up close), its case the first shot, the
head and what's behind cover. The Battle Rifle was a 300 rpm automatic before; Single is now its trigger (the owner's
"single and triple").

**The model at full quality.** Same model, the Meshy Community Frontier Rifle (provenance kept: community CC0, its post
URL). What lost its quality: the 820,000-triangle download was cut to 14,000 triangles (1.7 %, at a 3 cm error) and
its colour repainted onto new charts at 1024 px with a 512 px normal map, the metal and roughness thrown away for a
matte finish, and there was no `held` copy: your own hands drew everyone's copy. Now (`content/guns.json`,
`heldTriangles`, a new option of `tools/content/prepare-guns.mjs`): your own hands draw a second cut of the same
download, 60,000 triangles at a 0.7 mm error, in exactly the world copy's frame (the holds, muzzle and optic numbers
carry over), with the download's own metal and roughness (`pbr`); Medium 1024 px colour, 512 normal, 256 metal/roughness
(2.5 MB download); High 2048 / 1024 / 512 (3.3 MB). Everyone else's copy stays 14,000 triangles with its 2,796-triangle
lower level of detail from 12 m, now with metal and roughness too (0.95 MB, was 0.98). Cost in your hands at High:
about 29 MB of video memory for the maps (as every held gun: docs above) and about 2 MB of geometry, one draw call;
the extra triangles are one mesh near the eye. The held copies have their own budget tier, `heldHero` (80,000
triangles, 9 MB).

| Copy | Triangles | Colour | Normal | Metal/roughness | File |
|---|---|---|---|---|---|
| Before: everyone's and yours | 13,988 (+2,796 LOD) | 1024 | 512 | none (matte) | 0.98 MB |
| Everyone's | 13,988 (+2,796 LOD) | 1024 | 512 | 256 | 0.95 MB |
| Yours, Medium | 60,000 | 1024 | 512 | 256 | 2.5 MB |
| Yours, High | 60,000 | 2048 | 1024 | 512 | 3.3 MB |

**A real 3.5x optic** (`view.optic`, client `game/opticView.ts`). The Frontier Rifle's own scope tube is straight and
level on the bore's line (side and rear views on a 1 cm grid): its eyepiece glass is at [0, 0.133, -0.262] on the
model, 14 mm clear radius. Aiming brings that eyepiece 12 cm in front of the eye (beyond the camera's 10 cm near
plane); once the sights are up the eye eases onto it (0.12 s): the camera narrows to 3.5 times the hip view (the
scene's own rendering, post-processing, fog and level of detail: no second render), while the gun is drawn at a field
of view of its own by squashing it across the view axis (a node between the camera and the gun), so the eyepiece's
glass fills 62 % of the screen's half-height. A depth-only disc on the glass, drawn first in the gun's rendering group,
keeps the tube's inside from covering the view; the HUD draws the reticle (since the optics pass a chevron between
three posts, its tip the aim, with the holdover ticks under it: spec §15, "Optics by gun") inside the glass and shades everything round it (the eyepiece's shadow), fading in over
the second half of the move. Scope sway and Shift to hold your breath work as on the scoped rifles; zoomed look speed
follows the zoom (spec §15). It is not a `zoomFov` scope to the sim: hip fire keeps the rifle's true first shot (no
no-scope penalty) and the sights tighten it like any rifle's (spec §15: ADS never mandatory). No glint or bright
moment (Reduce flashing unaffected).

## Gunplay pass 2 (2026-11-08): identities, readouts, the Battle Rifle

The owner-approved candidates 1-6 of docs/GUNPLAY_AUDIT.md (its "Pass 2" section has every number, before and after):
- **SMG vs Assault Rifle:** SMG 15 damage (falloff from 15 m): 0.40 s to 15 m. The rifle family falls off 25-70 m to
  60 %: it owns 20-50 m; the Precision Rifle is quickest from 100 m.
- **Shotguns:** pump 10 × 12 in 55 mrad, family falloff 8-28 m: one shell kills to 9 m. Sawed-Off 14 × 10 in 85 mrad
  (both barrels to 9 m), Auto Shotgun 8 × 8 in 65 mrad (three shells at 10 m).
- **Long guns:** Precision Rifle 90 damage, 50-tick bolt (two body shots in 0.83-0.97 s); Marksman 34 at 200 rpm
  (three to 60 m); the Pulse Pistol's beam falls off 15-45 m to 45 %.
- **Reloads:** a quick-melee press breaks a reload (host and prediction); auto-reload (Options → Controls, on by
  default, `BUTTON_AUTO_RELOAD`); Spin Gun draw 0.93 s (was 1.23).
- **Readouts** (Options → HUD, both off by default): damage numbers over what you hit (bodies, and on boards, crates
  and barrels what the round would do to a body) and a spray-pattern panel (`game/combatReadouts.ts`).
- **The Battle Rifle** (`core.battle_rifle`, code 49, slot 3, rifle ammo, the `battle_rifle` family's first weapon;
  spec gap G2): model the Meshy Community Frontier Rifle (built 2026-10-29, CC0 per the owner, provenance already
  recorded; unused since 2026-11-06). Pickup `core.weapon_battle_rifle` (20 s); in the Military set and on the Training
  Range's front rack (x -2, z 20, placed in MapMaker). Sound `fire.heavy`. Holds read off a 5 cm grid and checked on
  the grip sheet. The 3DModelsCC0 pack has no FAL, M14, G3 or SCAR (its 19 models are listed in IMPORT_LIST.md), and
  the Drive's newest Meshy downloads (2026-11-08) are vehicles: TNR, Cyber Fang and an unnamed one rendered as bikes
  and a buggy, and Sky Cruiser, Dust Runner and Recon Trike by name (not downloaded).
- **Lever action: not made.** The Frontier Rifle is a scoped modern rifle, not a lever gun, and no lever-action model
  is in the repo or the Drive.

## Weapon replacements of 2026-11-28 (batch 2)

Twelve more of the owner's own Meshy models (Meshy, owned; docs/WEAPONS_INTAKE_1127.md, the "Replace" rows), built by
`tools/content/prepare-guns.mjs` in the same pack as batch 1 (`meshy-owned-drive-1127`). Every weapon keeps its rules,
numbers, sounds and sets; its model, held copies, hold and muzzle changed. Each everyone-copy has a lower level of
detail from 12 m; your own hands get a finer cut (`heldTriangles`, `heldMaxError` 0.004) at 1024/2048 px with its own
metal and roughness. None has glowing parts. The models they replaced are no longer built (the kit models stay the
fallbacks).

| Download | Now the model of | Build (everyone / held) | Sight |
|---|---|---|---|
| AK-47 Modular Assault Rifle | Assault Rifle | 12k / 50k, 0.88 m | its irons (a rear leaf and a hooded front post) on a railed cover: irons, red dot, holographic, 2x as before |
| MP5K Style PDW | Submachine Gun | 10k / 40k, 0.37 m | flip-up nubs at the ends of its top rail: irons and the same choice; no stock, so held a little ahead of the shoulder, the left hand on its front grip; its sight picture is no longer drawn larger (the rear sight is already near the eye) |
| Glock 19 Modular Sidearm | Pistol | 9k / 40k, 0.20 m | two nubs on a slide-top rail: irons (a hand correction: the tool read the front nub low), red dot |
| Vietnam Tactical Breaching Shotgun | Shotgun | 12k / 50k, 1.0 m | a bead and a receiver rail: irons; its under-barrel launcher is looks only |
| Desert Storm Assault Rifle | Burst Rifle | 12k / 50k, 0.86 m | low flip-up sights on a flat top, level with its stock, so aimed down them the butt fills the bottom of the view: a red dot on the rail by default now (same zoom), irons, holographic and 2x to choose (the old model's front sight stood in a red dot's window; this one's is clear) |
| Western Buffalo Break-Action Cannon | Sawed-Off (owner: sawed-off style) | 10k / 40k, 0.80 m | a bare top rail with a front bead: the red dot on the rail, as before |
| Mesoamerican Obsidian Pump Shotgun | Auto Shotgun | 12k / 50k, 0.98 m | a leaning front post and a rear hump: irons (a hand correction on the front post) |
| Western Classic 6-Shot Revolver | Heavy Revolver | 9k / 40k, 0.34 m | its notch and blade: irons; grip raked 26° (a curved grip) |
| Desert Eagle Modular Hand Cannon | Hand Cannon | 9k / 40k, 0.27 m | irons on its slide rail |
| Modular Machine Pistol | Machine Pistol | 10k / 40k, 0.32 m | irons; no stock, the left hand on the magazine |
| Gold Walther PPK | Gilded Pistol | 9k / 40k, 0.18 m | now on its own irons with a red dot offered (the flintlock's cock stood in the line, so it had no sights) |
| Tactical Rotary Minigun | Spin Gun | 14k / 60k, 1.0 m | none, as before (fired from the hip) |

**Not done in this batch:** the scoped guns whose new models carry no scope (the Battle Rifle's SCAR, the Marksman's DMR, the
Sniper's Steyr, the Lever-Action's Civil War repeater, the Crossbow's arbalest: each aims through a scope today, the
Battle Rifle through its model's own tube) wait on the owner's call on how they aim; the launchers, the specials, melee,
grenades and projectiles are left for a later batch (HANDOFF).

**Pictures** (lane B's scratchpad `weapons2/`): the raw downloads (`raw/`), gridded side and top views of the built models
(`grid/`), before/after inspect views and first person (`before/`, `after/`), the after side views on one sheet
(`sheet.png`) and the grip sheets (`grips-before/`, `grips-after/`).

## Weapon replacements of 2026-11-27 (batch 1)

The owner's own Meshy models (Meshy, owned; docs/WEAPONS_INTAKE_1127.md, the "Replace" rows), built by
`tools/content/prepare-guns.mjs` (pack `meshy-owned-drive-1127`). Each weapon keeps its rules, numbers, sounds and sets;
only the model, its holds and its muzzle changed, the old model kept as the fallback.

| Download | Now the model of | Build | Sight |
|---|---|---|---|
| Singularity Cannon | Singularity Cannon | 14k triangles (2.8k from 12 m) for everyone; your own hands a finer cut, 60k (`heldTriangles`, `heldMaxError` 0.004) at 1024/2048 px; its purple core lit (`glow`, now on the held tiers too) | top rail with flush nubs, no sight of its own (`hasSight` false): a red dot by default, holographic allowed, on the rail (`mount` set by hand: the tool's pick was the stock) |
| Modular Classic RPG | Blast Rockets, Guided Rocket | 12k / 2.4k; held 50k | its leaf sights are not fitted: launchers still aim over the tube (content/optics.json `none`) |
| Steampunk Claw Grapple Gun, Loaded and Unloaded; Deployed Grapple Hook | Grapple Hook (now held as a long gun) | 10k / 2k; held 30k, both poses; the claw 4k | none (a tool) |
| Tactical Combat Medkit | Medkit, Medi-Beam, small health pickup | 7.4k, 1024 px; red crosses recoloured green (owner, 2026-11-03) | — |
| Weapons Ammo Cache | the Ammo Box pickup (the general one) | 7.5k, its stencilled lettering painted out | — |

**The grapple's two poses.** The loaded gun (claw in) is `view.model`; from a shot until the grapple can fire again
(its fire interval) your own first-person gun shows the unloaded one (`view.spent`, built in the loaded one's frame:
`frameOf` and `align`, CONTENT_PIPELINE "The weapons intake's options"), and the fired claw (`view.hookModel`) is
drawn where the rope bites, its tip in the surface and its cable trailing back along the rope, gone with the rope.
Other players' guns keep the loaded look.

**Untextured copies.** `pickups/ammo_cache_plain.glb` and `pickups/medkit_plain.glb` (`flat`: one light grey, the
normal map kept) ship for tinting (team colours, ammo types, themes); nothing draws them yet.

**Pictures** (lane B's scratchpad `weapons1/`): the raw downloads (`raw/`), gridded side and top views of the built
models (`grid/`), before/after inspect views, first person on High (hip and aimed) and the grip sheets (`batch/`,
`singularity/`).

## Weapons intake of 2026-11-18: thirteen new guns, four new models

The owner's Drive folder `weapons and stuff` (24 Meshy models, 2026-11-18; QUEUE "Weapons intake 11-18"). All Meshy
community CC0 (owner, 2026-11-18) but the Futuristic Baseball Bat (the owner's own: Meshy, owned). This first batch is
the guns; the melee weapons, the Space Shield, the Heart Taser and its slime, the grenade and the spear's poke and throw
come in a second batch (`wip/weapons-1118b`, below). Built by `tools/content/prepare-guns.mjs` (pack `meshy-community-drive-1118`
in content/guns.json: 8-12k triangles, a fifth of that from 12 m, the download's own metal and roughness, `held` copies
for your own hands at Medium and High), holds read off gridded side and top views of each built model and checked on
the grip sheet (`tools/content/grip-sheet.mjs`) on three characters; sight fits and optics as below. No sounds came
with the folder: each gun uses one of ours (content/sounds.json), named in its file.

GUNPLAY_DIRECTION's rule against statistically similar guns shaped what became a weapon: five of the downloads became
the models of weapons that were still on kit or code models (each keeps the old one as its fallback, and fires as
before); the other thirteen are new weapons, each with a reason to pick it up.

| Download | Weapon | Slot · set | Why pick it up |
|---|---|---|---|
| Desert M4 Carbine | **Desert Carbine** (`core.desert_carbine`) | 3 · Military | Moves and leaves a sprint like an SMG, 720 rpm, 6 to a body (0.42 s), but half damage by 45 m |
| Scoped Tactical Rifle | **Twin-Shot Rifle** (`core.twin_rifle`) | 3 · Military | Every pull a double tap (2 rounds, 3 ticks apart, the second jumps): two pulls and a round kill (0.6 s) to 50 m |
| Compact Tactical Carbine | **Compact Carbine** (`core.compact_carbine`) | 7 · Military | The SMG that reaches: 40 rounds, full damage to 22 m, U switches to a low-kick Single |
| Wooden SMG Design | **Woodland SMG** (`core.woodland_smg`) | 7 · Military | The heavy SMG: 514 rpm, 22 a round (5 to a body, 0.47 s), each round kicking higher |
| Amarillo Carbine | **Amarillo** (`core.amarillo`) | 7 · Military | The bullet hose: 1,800 rpm, no climb, 40 rounds gone in 1.3 s, a quick reload; fades past 10 m |
| Nova 6 Scoped Carbine | **Nova 6** (`core.nova6`) | 3 · Sci-fi | Energy marksman: quick semi-auto (4 to a body, 2 to the head), no drop, no lead; a 2.4x scope |
| Scoped Lever-Action Rifle | **Lever-Action** (`core.lever_action`) | 5 · Military | Spec §13's Lever Action: 60 a round (two to a body, one to the head), the lever between shots, loaded round by round |
| Runebreaker Revolver | **Runebreaker** (`core.runebreaker`) | 4 · Chaos | A six-shot revolving shotgun: a lighter blast than the pump (no one-shot kill) that comes again in a quarter second |
| Ornate Flintlock Pistol | **Flintlock Pistol** (`core.flintlock_pistol`) | 2 · Medieval | One slow lead ball (210 m/s, falls fast): a body kill inside 8 m, always to the head, a shove; then 1.6 s to reload |
| Break-Action Crossbow | **Crossbow** (`core.crossbow`) | 5 · Medieval | A bolt you watch fly (75 m/s, drops): 100 on a hit, no flash or tracer line; a 2.3x scope |
| Blaster X-42 | **Blaster X-42** (`core.blaster_x42`) | 9 · Sci-fi | Orange bolts at 600 rpm (5 to a body, 0.4 s), fast (110 m/s) but not instant, no splash |
| Laser Blaster Gun | **Laser Blaster** (`core.laser_blaster`) | 2 · Sci-fi | A sidearm that never reloads: instant blue shots, 5 to a body; nine quick ones overheat it |
| Hornet Carbine | **Hornet** (`core.hornet`) | 2 · Chaos | Stingers that turn toward the nearest enemy ahead (22 m): easy hits, a short poison, slow kills |
| Neon Pulse Rifle | the Laser Rifle's model; its beam cyan to match (was red) | 3 | — |
| Arcstorm Carbine | the Arc Caster's model | 9 | — |
| Coppercoil Sentinel | the Railgun's model | 5 | — |
| Rustworn Pulse Carbine | the Flak Cannon's model | 4 | — |

Times are body kills at 10 m, Standard, ideal aim (`pnpm gun-report`). Each new gun has a weapon pickup
(content/pickups.json, at the end: earlier rolls unmoved) and lies in its sets (content/weapon-sets.json): Medieval
now rolls a crossbow for a rifle or sniper pickup and a flintlock pistol for a pistol, and its one main gun (what a
mode's own gun falls back to) is the Crossbow. New projectile looks drawn in code (`PROJECTILE_VISUALS`, added last):
`arrow` (the Crossbow's bolt), `blasterBolt` (a steady orange streak) and `stinger` (the Hornet's dart); none of them
flickers, so Reduce flashing needs nothing new (no new kind of bright moment: the Laser Blaster's and Nova 6's beams are
the Laser Rifle's kind, drawn by the same code and calmed the same way). A weapon's `view.muzzle` may be `none` (the
Crossbow: no flash).

**Sights.** `tools/content/sight-fit.mjs` fitted the iron sights of the Amarillo, Compact Carbine, Flintlock Pistol,
Laser Blaster and Runebreaker; the Nova 6, Lever-Action and Crossbow aim through a scope (`view.zoomFov`, the 2-3x kind);
five keep the plain aim over the top of the gun until the sights pass fits them, each with its reason in
content/sight-fit.json and content/optics.json: the Desert Carbine and Twin-Shot Rifle (their own holographic and red-dot
sights are not on the bore), the Blaster X-42 (its own scope, no sights under it), the Woodland SMG (its rear block stands
in the line) and the Hornet (no line along its top). The Laser Rifle, Arc Caster and Flak Cannon keep their red dot or
holographic sight, mounted on the new models by `tools/content/optics.mjs`.

**Batch 2 (`wip/weapons-1118b`): melee, the shield, the Heart Taser, the grenade, the spear.**

| Download | Weapon | Slot · set | Why pick it up |
|---|---|---|---|
| Dragon Katana 3D | **Katana** (`core.katana`) | 1 · Medieval | The long blade: 70 a cut (two to a body) at 2.6 m reach, a cut every 0.57 s |
| Scimitar Sword | **Scimitar** (`core.scimitar`) | 1 · Medieval | The quick blade: 36 every 0.27 s (three to a body, 0.53 s), and you run a little faster (1.05) |
| futuristic baseball bat (the owner's own: Meshy, owned) | **Baseball Bat** (`core.baseball_bat`) | 1 · Chaos | The home run: 45 and a 14 m/s shove along the swing, off ledges and into hazards |
| space shield stylize | **Space Shield** (`core.space_shield`) | 1 · Sci-fi | Held up, it takes 60 % of hits from attackers within 60° of where you face (`guard`); a bash for 30 that shoves; you move at 0.92 |
| Heart Taser, and slime | **Heart Taser** (`core.heart_taser`) | 2 · (pickups) | A support sidearm: its slime turns toward the nearest hurt teammate ahead (25 m) and heals them 25; it passes through enemies and never hurts anyone (`projectile.heal`). Bots don't carry it |
| "A stylized PBR 3D gam…" (a pinecone-shaped grenade with glowing green seams) | the Gas Grenade's model (Toxic Splash is its fallback) | — | — |

**The Spear's two attacks** (owner, 2026-11-18). Fire is a poke: a plain melee strike (60, two to a body, 2.9 m reach)
and the spear stays in your hands. Right mouse throws it (as before: one hit kills, it sticks where it lands). A thrown
spear leaves nothing to poke with (`inHand` in sim/weapons.ts: a melee weapon you carry one of; the first-person view
shows empty hands) until you walk over it, or any lying spear, which puts it back in your hands ready to poke or throw.
Bots poke within reach and throw at a target a few steps beyond it, up to 22 m (they lead and lift for the drop).

**Pictures** (lane B's scratchpad `weapons1118/shots/`): the raw downloads, gridded views of every built model, the
grip sheets (Ranger, Iron Knight; third and first person) and the contact sheet.

## Weapons intake of 2026-11-06: new models, sharper textures, smoke

The owner: "Added a bunch of new weapons, all Meshy community"; the 3DModelsCC0 kit "has good ones too, not sure we
need the nuclear bomb or flare gun though"; "We can replace our tommy gun with the 3DModelsCC0 one, and bring in those
others to replace any one-off originals we have"; and "we want these weapons to look a little sharper, clearer, better
resolution". Every model below was rendered and checked by eye first. Each weapon's `view.fallback` stays the model
built from the repo (always there), as earlier swaps did; the downloads that were replaced stay built in the repo
(content/guns.json), so going back is a one-line change. Built by `tools/content/prepare-guns.mjs`
(content/guns.json: the pack's own PBR maps, `held` copies, `pbr`); holds read off gridded side views of each built
model (CHARACTERS.md, "Holding weapons").

| New model | Source | Weapon | Replaced |
|---|---|---|---|
| Suomi KP (`guns/suomi_kp.glb`) | 3DModelsCC0 | Submachine Gun (`core.smg`) | Meshy Tommy Gun |
| AK-47 (`guns/ak47_cc0.glb`) | 3DModelsCC0 | Assault Rifle (`core.rifle`) | Styloo AK-47 |
| M4A1 (`guns/m4a1.glb`) | 3DModelsCC0 | Burst Rifle | Meshy Neon Flux |
| Makarov (`guns/makarov.glb`; its magazine, laid out beside it in the download, put back in the grip) | 3DModelsCC0 | Pistol (`core.pistol`) | flat kit pistol |
| Grease Gun (`guns/grease_gun.glb`; held as a compact long gun) | 3DModelsCC0 | Machine Pistol | flat kit machine pistol |
| Shotgun (`guns/shotgun_cc0.glb`) | 3DModelsCC0 | Shotgun | Styloo shotgun |
| Sniper (`guns/scoped_rifle.glb`: posed nose-up in the download, built levelled, magazine seated) | 3DModelsCC0 | Marksman Rifle | Meshy Frontier Rifle |
| BK 220 (`guns/bk220.glb`) | Meshy Community | Hand Cannon (a heavy semi-automatic: the Heavy Revolver is the revolver) | flat kit revolver |
| Revolver Rustique (`guns/revolver_rustique.glb`) | Meshy Community | Heavy Revolver | Meshy revolver (2026-01-26) |
| gilded flintlock (unnamed download, `guns/flintlock.glb`) | Meshy Community | Gilded Pistol (one shot, one kill) | flat kit pistol |
| Plasma Defender (`guns/plasma_defender.glb`) | Meshy Community | Pulse Pistol | Meshy ornate handgun |
| Scrapfire Assault Blaster (`guns/scrapfire.glb`) | Meshy Community | Nailgun (a drum-fed scrap gun) | flat kit nailgun |

Grenades (the owner's picks, 2026-11-06), one model each in the hand, in flight and on the pickup:

| Model | Throwable | Replaced |
|---|---|---|
| Globe Grenade (`guns/globe_grenade.glb`) | Frag; the 3DModelsCC0 frag (`guns/frag_m67.glb`) is its look in the Military weapon set | Styloo frag (the fallback) |
| Countdown Sphere (`guns/countdown_sphere.glb`; the blinking light kept on top) | Sticky | shapes in code |
| "just a grenade" (`guns/vortex_grenade.glb`, its own projectile look `vortexNade`: the Singularity Cannon keeps `vortex`) | Gravity Grenade (id `vortex`) | shapes in code |
| Emergency Flare (`guns/dynamite.glb`; Meshy Community CC0, Drive file `Meshy_AI_Emergency_Flare_1110164645_texture.glb`, 2026-11-10; red stick with a fuse) | Dynamite (hand, flight and pickup; mechanics unchanged) | shapes in code |
| Gold and silver toned orb (`guns/holy_bomb.glb`; Meshy Community CC0, Drive file `Meshy_AI__Gold_Silver_Toned_Hi_1110164632_texture.glb`, 2026-11-10; an ornate gold grenade with a cross gem) | Holy Bomb (hand, flight and pickup; mechanics unchanged) | shapes in code |
| mur de sacs 12 (`guns/sandbags.glb` small, for hand, flight and pickup; `guns/sandbag_wall.glb` the deployed 1.9 x 0.64 x 1 m wall; Meshy Community CC0, Drive file `Meshy_AI_mur_de_sacs_12_1110164725_texture.glb`, 2026-11-10) | Sandbags (`view.cover` is the wall's model, `CoverState`) | stacked capsules in code |
| Sheep (`guns/sheep.glb`, rigged and animated; Meshy Community CC0, Drive file `sheep_walking.glb` with the walk clip `Armature|Unreal Take|baselayer`, 2026-11-10; `view.fit` 0.7 m tall) | Sheep (flight and walking: the clip plays while it moves, paused while it is still; mechanics unchanged) | a bobbing shape in code |
| Sunburst Grenade (`guns/sunburst_grenade.glb`) | Cluster Bomb (its bomblets stay small shapes) | shapes in code |
| Toxic Splash (`guns/toxic_splash.glb`) | Gas | shapes in code |
| 3DModelsCC0 Molotov (`guns/molotov.glb`) | Incendiary | shapes in code |
| 3DModelsCC0 smoke grenade (`guns/smoke_m18.glb`) | **Smoke Grenade** (new, below); the Meshy sci-fi canister (`guns/smoke_scifi.glb`) is its Sci-fi set look | — |
| 3DModelsCC0 anti-tank mine (as before) | Proximity Mine (now also its pickup) | coloured discs on the pickup |

Still drawn in code (no model fits yet): the airstrike flare. Spare, kept out of the game: the pack's Luger, C4, claymore,
pipe bomb and M24 (docs/IMPORT_LIST.md). Not imported: the nuclear bomb and the flare gun (the owner), the flashbang
(dropped over seizure risk: nothing in the game flashes the whole screen white).

**Texture tiers.** The weapon in your own hands draws a sharper copy of its model by graphics setting; everyone else's
copy (other players' hands, drops, pickups, Low) stays small:

| Copy | Colour map | Normal map | Metal/roughness | Loaded |
|---|---|---|---|---|
| everyone's (`guns/<name>.glb`, with its lower level of detail) | 512 px | 512 | 256 | with the match, for every gun it can hold |
| Medium, in your hands (`guns/<name>.medium.glb`) | 1024 | 512 | 256 | only for the guns you hold |
| High, in your hands (`guns/<name>.high.glb`) | 2048 | 1024 | 512 | only for the guns you hold |

- The held copy is the same mesh (same holds, muzzle and sights), named in the weapon's `view.held`. Your gun shows
  everyone's copy at once and the sharper one is swapped in when it has loaded (`View.sharpenViewmodel`); a gun you no
  longer carry frees its held copy's video memory (`View.trimViewmodels`, `ModelLibrary.release`). The swap takes the
  old copy's own on/off switch (`takeOverViewmodel`), never `isEnabled()` (which asks its parents): a copy that came in
  while you were scoped or in third person (the view's root off) stayed hidden, and the gun vanished from your hands
  when the scope came down (owner, 2026-11-07).
- **Measured** (five guns held: pistol, rifle, SMG, shotgun, hand cannon; textures counted at 4 bytes a texel with
  mipmaps): **High +140 MB** (28 MB a gun: its 2048 px colour map 22.4, normal 5.6, metal/roughness 1.4), **Medium
  +35 MB** (7 MB a gun), **Low +0** (everyone's copies are already loaded with the match). For scale, the whole scene's
  textures at High were 292 MB before (the level, characters, shadow maps). Over 1024 px metal/roughness maps at High
  measured +160 MB and showed nothing more, so they ship at half the normal map's size.
- Downloads: see the table in HANDOFF ("Weapons intake of 2026-11-06"): a held High copy is 0.2-1.5 MB, fetched once
  per gun you pick up.
- **GPU-compressed textures (KTX2 / Basis):** not used. Babylon 9.32 reads them through its KTX2 decoder, whose wasm
  transcoders it serves only from cdn.babylonjs.com (the npm package holds just the 24 KB decoder); the game must not
  load code from a third-party CDN (offline and LAN play, the site's policy), and this environment can't reach it to
  vendor them. The encoder side is workable (`ktx2-encoder` on npm, 3.3 MB wasm). With the transcoders vendored, a
  2048 px colour map would take about 5.6 MB of video memory instead of 22 (UASTC to BC7/ASTC).

**Kept metal and roughness.** The new models keep their source's metal and roughness (`pbr` in content/guns.json)
instead of a forced matte finish. The game's scenes have no environment map (bare metal drew black), so a weapon's
metal materials reflect a soft gradient in the map's own light (`game/weaponFinish.ts`): dim at night, a bright band
above, blurred by roughness.

**Smoke Grenade** (`smoke`, code 12, pickup `core.smoke_grenades`; owner, 2026-11-06). Thrown like a frag; after 1.5 s
a cloud billows out where it lies to 5 m across its radius over 2.5 s (`SMOKE`, `smokeRadius` in `sim/weapons.ts`),
sits, and thins over its last 3 s: 18 s in all. It is only sight:
- **Bots and the match** (`Match.sees`, `smokeBlocks`): a sight line crossing 1.6 m or more of a cloud is blocked:
  bots don't see (or shoot at) whoever is behind it, sentries and arc turrets don't lock through it, homing missiles
  don't steer to someone behind it, and a spawn point behind it counts as unseen. Someone a metre off inside the cloud
  is still seen.
- **Players:** the cloud is soft grey puffs (`ZoneVisuals`, a steady mid grey scaled by the map's light, never white);
  with your eye in it, the scene's fog eases to a mid grey you see 2-3 m through (`View.updateSmokeFog`, eased in and
  out over about two thirds of a second: no flash, no white-out, no flicker), and the sky, which draws without fog,
  fades to the same grey (else the skyline, and anyone against it, showed through); an enemy's marker behind smoke
  isn't drawn. Left as it is: at High the screen-space shading still picks out faint, low-contrast shapes of the
  scenery past the cloud. A map without haze (the space maps: Halcyon Station, Twin Spires and Void Yard,
  all Sci-fi, where the set hands smoke out, and the retired Creature Lab, Obsidian Orb and Skyward) draws with the
  scene's fog on at density 0 (`BackdropVisuals.build`), so a cloud, or water, only changes its colour and thickness.
  With the fog off there, the first step into smoke switched it on, and every material in view was built again with
  Babylon's FOG define in that frame: on Halcyon Station at Medium, 31 and 38 programs (22 and 31 of them materials
  already in view), 8.0 and 12.4 s inside WebGL's compile and link calls on the agents' software renderer, and the
  frames stepping in 4.8 s longer than inside the cloud; at High 45 programs (36), 12.3 s and 6.1 s. With the fog
  on at nothing: no program, and 0.35 s (Medium) and 0.12 s (High) (`ws/stall3.mjs` in the weapon sets session's
  scratchpad).
- **Shots, blasts and movement go through it** (they use the physics' own lines).
- **Bots use it:** a hurt bot caught in the open by an enemy 10-45 m off throws one a few metres toward it, so the
  cloud stands between them while it moves on; bounding cover to cover (Phase B), the moving half sends one ahead
  before it crosses open ground (`considerSmoke`, `BotBrain.smokeScreen`; docs/BOTS.md, "Smoke").
- **Weapon sets:** among Military's and Sci-fi's grenades (after the frag and the sticky, which everyone spawns with;
  their grenade pickups roll it, so a bot there that picks one up has smoke; docs/WEAPON_SETS_PLAN.md). The match's
  set picks each grenade's look in your hands, in flight and on its pickups (`throwableModel(kind, set)`: the Meshy
  canister in Sci-fi, the pack's frag in Military), and the loading screen fetches those.

## Extended arsenal (32 weapons)

Several weapons now share each slot: a number key picks the slot and pressing
it again cycles through what you carry there (the weapon bar shows a pip per
extra weapon). Weapons are keyed by a small code on the wire (`weaponCode`).
Models are Quaternius Modular Sci Fi Guns (CC0; each energy weapon gets its
own accent colour on the kit's orange trim, and its hold points are placed on
the model's own grip, handguard and stock) and Quaternius Ultimate Gun Pack
guns (CC0). Since the weapons intake of 2026-11-06 (above) most of these have newer models. The assault rifle, shotgun, rocket launcher and frag grenade use
Styloo's Guns Asset Pack (CC0: AK-47, pump shotgun, RPG, frag;
`content/guns.json`), each keeping its Quaternius model as `view.fallback` in
case the pack's file is missing. No weapon stats changed with these models.

**Meshy models from the owner's Drive** (Meshy Community CC0 per the owner's rule of 2026-11-06, recorded as owned
before; pack `meshy-community-arsenal` in `content/guns.json`, built from the textured GLB downloads by
`prepare-guns.mjs`, 3–6k triangles, a 512 px rebaked colour map each). Each
falls back (`view.fallback`) to a model built from the repo (the Quaternius or
Kenney one, the knife, or the medkit built in code), and its holds are read off
its own grip, handguard and stock:

| Model | Weapon or turret | Replaced |
|---|---|---|
| Tommy Gun | Submachine Gun (`core.smg`) until 2026-11-06, replaced by the Suomi KP (still built) | Styloo MAC-10 |
| Rotary Gatling Gun | Spin Gun (`core.lmg`) | Meshy community plasma spin gun |
| Military sniper rifle | Sniper Rifle (`core.sniper`) | Styloo AWP |
| Neon Flux | Burst Rifle until 2026-11-06, replaced by the M4A1 (still built) | Quaternius rifle |
| Frontier Rifle | Marksman Rifle until 2026-11-06, replaced by the scoped rifle; the Battle Rifle (`core.battle_rifle`) since 2026-11-08 | Quaternius rifle |
| Futuristic Blaster | Plasma Rifle | Quaternius sci-fi rifle |
| Ornate energy handgun | Pulse Pistol until 2026-11-06, replaced by the Plasma Defender (still built) | Quaternius sci-fi pistol |
| Freeze Gun | Freeze Ray | Quaternius sci-fi gun |
| Mystical Glue Gun | Goo Gun | Quaternius sci-fi gun |
| Steampunk Battle Axe | Battle Axe (new) | — (the knife as the fallback) |
| Plastic toy machine gun on a tripod | Heavy MG Turret (`turret_mg`, `core.mount_mg`) | Kenney twin turret |
| Large Sentry Gun | Sentry Gun (`sentry`, `core.sentry_gun`) | Kenney turret |
| Medkit | health pickups, Medkit and Medi-Beam | boxes built in code |

Also Meshy community models (CC0 per the owner, pack `meshy-community-weapons`):
the carved spear (download "T Pose Figure") is the Spear's (`core.spear`; held, pickup,
thrown and stuck), replacing the spear built in code, which stays as its fallback; and the
Plasma Blaster (download of 2026-11-02) is the Singularity Cannon's (`guns/plasma_blaster.glb`,
0.66 m, 13.7k triangles plus a LOD, 1024 px colour map), replacing the Quaternius sci-fi sniper
(`weapons/singularity.glb`, the fallback). Its orange glowing panels and muzzle ring are recoloured
to the cannon's purple (`#b07aff`) with an emissive map of them (`glow` in guns.json,
prepare-guns.mjs). Holds: grip on the rear handle with the fingers through the guard, support
under the front shroud, shoulder at the back, muzzle at the front ring; checked with
`grip-sheet.mjs` (WEAPONS=core.singularity) and `grip-audit.mjs` (WEAPONS_ADD=singularity:core.singularity:
no flag the rifle doesn't raise on the same characters). Its behaviour is unchanged.

The Freeze Gun, Glue Gun, Futuristic Blaster and toy machine gun became the
models of the Freeze Ray, Goo Gun, Plasma Rifle and Heavy MG Turret rather than
new weapons: each already does what the model shows, and a second freeze or
glue gun would be one of the "statistically similar" weapons
GUNPLAY_DIRECTION.md warns against. Sounds come from our own synthesiser
recipes.

| Slot | Weapon | How it fires |
|---|---|---|
| 2 | Pulse Pistol | Semi-auto energy bolts (cells) |
| 2 | Hand Cannon | Semi-auto, 58 damage, heavy recoil, pushes the target |
| 2 | Heavy Revolver | Six rounds, 70 damage, savage kick, loaded round by round |
| 2 | Gilded Pistol | One shot, one kill; slow reload, rare pickup |
| 2 | Flare Gun | Arcing flare that sticks to what it hits, burns and lights oil |
| 2 | Machine Pistol | Very fast, blooms wide |
| 3 | Burst Rifle | Three-round bursts per trigger pull |
| 3 | Laser Rifle | Continuous beam, no ammo: overheats, then locks until cool |
| 3 | Marksman Rifle | Semi-auto, 0.7 zoom |
| 3 | Battle Rifle | Heavy rifle (25 damage, 20 rounds), Single (300 rpm) or a 3-round Burst (U), a real 3.5x optic: a true first shot, two head hits kill (2026-11-08; modes and optic 2026-11-16) |
| 4 | Sawed-Off | Two barrels, 14 pellets, knockback |
| 4 | Auto Shotgun | Automatic, big recoil |
| 4 | Flak Cannon | Seven shards that ricochet twice |
| 5 | Railgun | Charges for 0.4 s, then pierces up to four players; one body hit kills an unarmoured player |
| 6 | Disc Launcher | Fast disc, big knockback (disc-jumping works) |
| 6 | Bubble Blaster | Slow, floating toxic bubbles that bounce off walls up to 7 times, then burst into a poison cloud |
| 6 | Goo Gun | Lobbed goo that slows and leaves a sticky puddle |
| 6 | Oil Slicker | Oil puddles you slide on; right mouse fires an igniter that sets them alight |
| 7 | Spin Gun | Spins up before firing, 120-round belt |
| 7 | Nailgun | Fast ricocheting nails |
| 8 | Swarm Launcher | Four homing mini-missiles per shot |
| 8 | Singularity Cannon | A field that drags players in for 2.4 s, then collapses with a blast |
| 9 | Arc Caster | Lightning that jumps to three more enemies; heat instead of ammo |
| 9 | Flamethrower | Short-range flame stream: sets players burning, lights oil |
| 9 | Freeze Ray | Beam that chills; enough chill freezes the target solid for 1.4 s. Second trigger, **freeze blast** (owner, 2026-11-24): a slow cold ball (14 m/s) that holds whoever it hits in a block of ice for 3 s (can't move or act, 5 HP/s, every other hit in full; the block a force field: solid to others, never to shots; melts at the end, shatters if they die); 60 % of the heat bar and its own 6 s cooldown (AltFire `ammo: heat`, `cooldownTicks`), the beam free meanwhile |

**Battle Axe** (`core.battle_axe`, slot 1, pickup `core.weapon_battle_axe`,
category melee). The model is a flintlock blunderbuss with an axe blade under
its muzzle, so it is both:

- **Swing** (left mouse, and the quick-melee key): 85 damage, one swing per
  0.8 s, 2.7 m reach, a 6 m/s shove along the swing. Spends nothing.
- **Blunderbuss** (right mouse with the axe in hand, or middle mouse / V like
  every second trigger): 9 pellets of 11 (99 at most) in a wide 0.12 rad cone,
  24 m reach, steep falloff (full to 4 m, down to a fifth at 16 m), head ×1.25.
  Measured on a still target: 99 at 2 m, ~85 at 4 m, ~43 at 6 m, ~26 at 8 m,
  ~16 at 10 m, ~6 at 14 m (the Shotgun kills to about 6 m and still does ~40
  at 10 m). Shots 0.6 s apart; a heavy kick (0.1 rad up, settling over about
  a second), a big flash and a cloud of black-powder smoke from the barrel's
  mouth (`view.muzzleAt`, first and third person), the Shotgun's report
  pitched down.
- **Ammo**: the barrel holds 2 loads (`alt.max`; HUD: loads big, shells small,
  "RMB Blunderbuss"). Loads come from a reserve of **shotgun shells** (12 at
  most, 4 from a pickup, filled by shell boxes and the general ammo box), one
  at a time: R, or the alt trigger on an empty barrel, loads them (0.27 s
  open, 1.1 s a load, 0.23 s close: 1.6 s for one, 2.7 s for two). A swing
  stops loading at once (loads already in stay); the alt trigger fires as
  soon as one is in. Shells rather than an ammo type of its own: shell boxes
  already lie on the maps and a shotgun's shot is what it fires; a "powder
  and shot" type would need its own boxes everywhere for one weapon.
- **Bots** value it at 0.45 for 0–2.5 m, and out to ~7 m while the barrel is
  loaded (`barrelReach`): they close in to swing, fire the barrel at a target a
  few steps beyond the blade, and load it again when nobody is near.

It answers "why pick this up?" with a two-hit kill up close that throws people
off ledges, and a blast for the step just out of reach (blast and swing kill
together).

## Armory (2026-11-27)

The main menu's **Armory** (owner, 2026-11-27: "a weapons page like Character Select") lists every weapon a player can
hold and shows one at a time in the menu scene. Client `frontend/armory.ts` (the page), `frontend/armoryData.ts` (what
it lists and the numbers), `frontend/armory.css`: their own chunk, loaded when the page opens. The menu's first JS
carries only the entry hook in `frontEnd.ts` (the screen id, the nav entry, handing it keys and controller buttons) and
`MenuScene`'s `hideHero` / `setShot('armory')`: about 0.4 kB gzipped.

- **What's listed** (`inArmory`): weapons in a hand (slot > 0: no mounted guns or vehicles' guns), not hidden (the
  Weapon Manager's hide), with a pickup category or swung (melee and tools); a mode-only weapon with neither (the arena
  disc) is left out. Sections are the weapon wheel's eight categories (`game/wheelCategories.ts`, the same rule), each
  by name.
- **The layout is Character Select's** (its classes and phone layouts in style.css; armory.css only for the tiles'
  weapon pictures, the sights and the phone sheet's order): the jump strip (a chip, or Q / E, LB / RB, scrolls to a
  category; it lights the one in view), search, Favourites only (the star on a tile, `tiletrigger.armoryFavs` in this
  browser; controller Y stars the one shown), the arrow keys or d-pad over the tiles, and on a phone the details sheet
  (down: the name and Try it; up: Try it and Fire sound first, then the stats and sights).
- **The weapon on show**: its held high copy where it has one (`view.held.high`, else the shared model, then its
  fallbacks), framed by projection into the free space beside the panels (the turn zone) whatever the window's shape,
  side-on with the muzzle to the right, the optic it carries built on it (`attachOptic`). Every hero is hidden meanwhile
  (`MenuScene.hideHero`: the heroes stand under one `menuStage` node). Drag (or the turn buttons, `,` `.`) turns it; a
  flick keeps it turning. Its file comes through Character Select's `FileFetcher`: resting on a tile fetches it (`soon`)
  and its neighbours (`later`); a pick takes the bytes. Leaving frees it.
- **The panel**: name, role (by family, else from its category and data: `armoryRole`), its description
  (`notes.description`, written in the Weapon Manager; none are written yet) and range note (`notes.range`), tags, and
  stat bars from the weapon tuning page's numbers (`tools/weaponTuningData.ts` weaponStats, on `arsenalMax`'s scale):
  damage, fire rate, range (where its falloff ends), handling (sights up), mobility, magazine, reload; longer is better
  on every bar. **Sights**: its own, or a choice of those content/optics.json allows, kept for your loadout (the same
  setting as Profile → Favourite loadout → Optics). **▶ Fire sound** plays its fire sound (controller X).
- **Try it in the range** (the button, Enter or controller A on the one shown): the Practice range alone, as Quick
  Play's link opens it, with the weapon in hand now and at every spawn (`playRange('practice_range', weapon)`, host
  option `hand`, shared `Match.holdOnSpawn`). Leaving the range comes back to the Armory, that weapon shown.
- Tests: `client/test/armoryData.test.ts`, `shared/test/holdOnSpawn.test.ts`, e2e `armory`.

## Weapon categories and random pickups

Every weapon a pickup can hold has a `category` (`WEAPON_CATEGORIES` in
`sim/weapons.ts`): pistols, SMGs and machine guns, rifles, shotguns, snipers,
explosives, melee, specials. Tools (medkit, medi-beam, grapple, builder),
mode-only weapons (arena disc) and mounted guns have none and never roll.

- **Random from category** (MapMaker: select a weapon pickup → Weapon →
  "Random from category: …"; map field `random` on the pickup, format v24):
  the pickup holds a weapon of that category, rolled again each time it is
  taken (so it comes back as something new; with more than one in the
  category it never repeats the last). MapMaker shows a weapon of the category.
- **Mix up weapon pickups** (`MatchRules.mixPickups`: match setup → Advanced
  rules → Weapons, pickups & vehicles; the pause menu's Host tab, where Apply
  now applies it at once): every weapon pickup not
  marked **Keep fixed** (`keepFixed`) rolls within the category of the weapon
  placed there. Off by default.
- Rolls are `rollPickup(seed, pickup id, roll number)` (`sim/pickupRoll.ts`),
  so a match replays the same; the snapshot's `pw` lists the pickups that hold
  something other than what was placed, and clients draw that. Bots read what
  lies there now. Validation warns when a random pickup shows a weapon of
  another category (`pickup.random_item`).

## Weapon sets

A **weapon set** (docs/WEAPON_SETS_PLAN.md; data `content/weapon-sets.json`, built by
`tools/content/weapon-sets.mjs`; behaviour `sim/weaponSets.ts`) decides what a match spawns with, what its weapon and
grenade pickups hold and what drops. Each map has a default (MapMaker → Map properties → **Weapon set**, map field
`weaponSet`, format v28; absent: Standard); the host picks another in Match setup → Advanced rules → Weapons (a
**Weapon set** row, "Map default (…)" naming the map's own), the pause menu's Host tab (applies at once) or a
server's `set` rule (`MatchRules.weaponSet`).

| Set | Spawn (the last held) | Grenade at spawn | The set's weapons | Its grenades |
|---|---|---|---|---|
| **Standard** | the mode's own (knife, pistol; co-op, Zombies, Bomb and Hostage add a rifle) | frag | as placed on the map | as placed |
| **Military** | knife, pistol, assault rifle; sniper-role bots a marksman rifle instead | frag | rifle, burst rifle, SMG, machine pistol, spin gun, shotgun, auto shotgun, sawed-off, sniper, marksman, grenade launcher, rockets, pistol, revolver, hand cannon | frag, mine, smoke |
| **Sci-fi** | knife, pulse pistol, plasma rifle; sniper-role bots the railgun instead | sticky | plasma, laser rifle, railgun, pulse pistol, arc caster, disc launcher, swarm, guided | sticky, gravity, smoke |
| **Medieval** | knife, spear | incendiary | spear, battle axe, knife | incendiary, holy bomb |
| **Chaos** | knife, pistol, a random oddball each life | sheep | swarm, singularity, freeze ray, goo gun, bubble blaster, oil slicker, flare gun, nailgun, flak, blast rockets, gilded pistol | sheep, holy bomb, cluster bomb |
| **Mixed bag** | knife, pistol, a random main gun each life | frag | every weapon a pickup can hold | every grenade |

- **Random spawn guns** (Chaos, Mixed bag): one of the set's main guns (slots 3-9 with a pickup) each life, dealt
  from a deck of them shuffled from the match seed and the slot (`randomGunFor`): every one comes up once before any
  comes up again (Chaos's nine oddballs in nine lives), never the same twice running, and a match replays the same.
- **Pickups:** a weapon pickup holds a weapon of the set of its own category (its `random` category, else its
  weapon's), else of the nearest categories the set has (`nearCategories`: ties together; a sniper pickup in Sci-fi
  is the railgun, a battle axe in Military a shotgun, everything in Medieval a spear or a battle axe), rolled again
  each time it comes back. One marked **Keep fixed** stays as placed when its weapon is of the set. A grenade pickup
  holds one of the set's grenades the same way. Health, armor, ammo, tools, powerups and the rest stay as placed;
  Standard keeps the old rules ("Random from category", "Mix up weapon pickups"), which the other sets make moot.
- **Drops:** only the set's weapons, never what everyone spawns with (a Chaos or Mixed bag life's random gun does
  drop: it's that player's own).
- **Never in a set:** tools, mode-only weapons and mounted guns (no category). **Classes** keep their loadouts
  (pickups still roll within the set). **Spears or discs only** and **Disc Arena** play no set.
- **Bots:** they weigh every set weapon as they weigh any (range, splash, flight, beams, heat: `weaponScore`). For the
  sets they also throw the sheep (thrown short along an open line to an enemy 6-20 m off, it walks the rest), throw a
  big blast with a long fuse (the holy bomb) half its blast away and run clear, and light their oil slicks with the oil
  slicker's igniter. Sniper-role bots spawn with the set's scoped gun (`Match.sniperGun`).
- **Scorecard:** `pnpm bot-report … --set=military,scifi,…` plays each match in each set, and every report (and the
  nightly scorecard) lists kills by weapon per set, with the set's weapons and grenades that got none.

## Weapon drops

**Drop weapon on death** (`MatchRules.dropWeapons`, default on: match setup →
Advanced rules → Weapons, pickups & vehicles; the pause menu's Host tab, where
Apply now applies it at once and off clears the drops lying about): when a player or bot dies (not NPCs), `chooseDrop`
(`sim/drops.ts`) picks the weapon in hand, else the most desirable one, that
has a pickup item and a category (not a tool, mode-only weapon or mounted gun),
isn't a fetched-back throw (spear), isn't in the starting loadout (weapon set or
rules, and class), is one of the weapon set's and has ammo (magazine + reserve; heat weapons always count, plain melee
never). It lies on the ground straight below the body (a raycast; none over
the void) for `DROP_LIE_SECONDS` (30), at most `MAX_DROPS` (24, oldest first),
carrying exactly that ammo (and second-trigger rounds). Everything else is
discarded. A pickup (same radius as map pickups) gives the weapon whole to
someone without it (coming up like a map pickup's), or tops up the reserve of
someone with it (`takeDropAmmo`), the rest staying on the ground. Never in
Disc Arena or spears/discs only (`dropsInPlay`). The snapshot's `dw`
lists the drops lying ([id, item, x, y, z, yaw]; repeated fields, sent when
they change); clients draw the pickup's weapon on its side on a small ring.
Bots see drops as weapon pickups.

**Variants for Classes and Disc Arena** (added last, so older weapon codes
are unchanged; each has a pickup like every weapon):

| Slot | Weapon | Variant of | How it fires |
|---|---|---|---|
| 6 | Arena Disc | Disc Launcher | Three discs that bounce and drop where they stop, picked up again like ammo; a hit shoves, never hurts (Disc Arena) |
| 8 | Blast Rockets | Rocket Launcher | Four-rocket drum, smaller blast, knockback: rocket-jump (Rocketeer) |
| 1 | Medi-Beam | Medkit | Heals the teammate in your sights 6 HP five times a second, 9 m (Medic) |

**Grenades (G):** frag, proximity mine, sticky (rides on whoever it hits),
incendiary (a pool of fire), gas (a toxic cloud), the Gravity Grenade (id `vortex`: a small
singularity) and dynamite (Style Pack 02 Frontier Dust: a 3 s fuse, a 6 m
blast that throws people about; pickup `core.dynamite`). And the Smoke Grenade (a cloud that hides whoever is
behind it, 18 s; pickup `core.smoke_grenades`): see "Weapons intake of 2026-11-06".

**Mechanics** (all data on `WeaponDefinition` / `ProjectileSpec`):

- **Triggers.** `fireMode` is auto, semi or burst. `windupTicks` adds spin-up
  or charge (`windupResets` charges every shot). `heat` replaces ammo.
  `recoil` (weapons without a gunplay family) is a deterministic camera climb
  plus spread bloom on the server; family weapons use `kick` and `accuracy`.
- **Hitscan.** `pierce`, `chain` (jumps, range, falloff), `status` and
  `knockback`.
- **Projectiles.** `pellets` (several projectiles per shot), `bounce` and
  `maxBounces`, `sticky` (to the world, or riding on players), `homing`,
  `drag`, `knockback`, `status`, `zone` (a hazard left where it bursts) and
  `ignites`.
- **Status effects.** Burn (12 dps) and poison (9 dps) do damage over time,
  credited to whoever caused them. Slow is 55% speed. Chill builds up, then
  freezes the target solid: no moving or firing.
- **Hazards.** Zones live on the server and go out in snapshots (`zn`):
  - fire: burns you and does damage while you stand in it;
  - toxic: poisons;
  - goo: slows;
  - oil: slick ground, where running feeds a slide;
  - singularity: pulls players in, then implodes.
  Flames, flares and explosions set oil alight, and fire spreads along it.
- **Movement.** `MoveState.vx/vz` is a push velocity (knockback, pulls,
  slides) that dies away on the ground. Client prediction replays it with the
  server's status speed and the oil under your feet.

## Jetpack

Not a weapon but a pickup (`core.jetpack`): hold jump in the air to fly, with fuel that refills while you are not thrusting. See [SET_PIECES.md](SET_PIECES.md).
