# Character limbs: knees, ankles and elbows

Measured (lane A, 2026-11-27; owner's report: in Character Select many characters' knees and ankles bow outward, most
at the ankles, and some elbows bend wrong, Grandpa Chains and Elder Tomo among them). Diagnosis only: no fix here.

## How it is measured

`tools/content/limb-audit.mjs` poses every pickable character as Character Select does (standing, holding the rifle,
the game's own animator and arm IK; client `?mode=grips`, `__grips.limbs()` in `tools/limbProbe.ts`) and scores it
with `tools/content/limbs.mjs` (unit test `tools/content/test/limbs.test.mjs`). All angles in degrees, left / right:

- **knee bow**: in the front view, the knee's angle off the hip-to-ankle line; + bow legs, − knock knees.
- **shin out**: in the front view, the shin's lean off straight down; + the ankle further out than the knee.
- **knee points**: seen from above, the way the bent knee points (0 ahead, + out); – when the leg is nearly straight.
- **foot yaw**: the foot (ankle to ball) off straight ahead, + toes out.
- **sole roll**: the drawn sole's tilt across (its skin's lowest points); + inner edge up, standing on the outer edge.
- **skin bow**: the drawn shin's lean (its skin) minus the bones' shin; + the drawn shin leans further out than its bones.
- **elbow**: round the shoulder-to-hand line, from straight down: 0 down, 90 out, 180 up, − in toward the chest.
  Wrong past 100 (up) or under −10 (in).
- **Legs** score: the worst of |knee bow|, |shin out|, |sole roll|, |skin bow| and |knee points|/3; **Elbows**: degrees past
  the wrong line.

```
pnpm build && pnpm --filter @tiletrigger/client exec vite preview --port 4860
node tools/content/limb-audit.mjs http://localhost:4860 /tmp/limbs          # the table below, /tmp/limbs/limbs.json
PICTURES=1 node tools/content/limb-audit.mjs http://localhost:4860 /tmp/limbs  # and front/side pictures per look
node tools/content/limb-sheet.mjs /tmp/limbs                                  # the contact sheet of the worst 20
```

## Finding (step 3, confirmed with the switches)

**Legs: the bow is the shared clips' standing pose, the same on every body; not a rest-pose roll.**

- (a) refuted as stated. Every pickable look (176, all whole-body Meshy builds) has its limb joints' rest rotations equal
  to the rig's: `node tools/content/limb-rest.mjs` finds 0.03° at most over all 215 Meshy body files (the only
  differences, 9.6° at `foot_l` and 11.3° at `clavicle_l`, are the 26 modular `_f`/`_m` part files, which no pickable
  look uses). `prepare-meshy-characters.mjs` keeps the rig's joint orientations, so there is no roll to correct.
- The joints' pose is the same on all 176 to within 2-4°: roster medians knee bow 5.7° / 9.9° (L/R, bow legs), left shin
  out 7.8°, right knee pointing 44° out, right toes 30° out. That is the clip's rifle stance, and it reads as bowed knees
  and splayed ankles on any body; wide hips and thin bare shins (Grandpa Chains, Elder Tomo) show it most, robes and
  wide trousers hide it.
- Switch: `LEGS_REST=1` (client `__grips.legsAtRest(true)`, the grip sheet's own switch, run after the clips are
  evaluated; the game's path is untouched) holds the legs at rest. Elder Tomo, Grandpa Chains and Space Marine: knee bow
  5.7/9.9 → 0/0, shin out 7.8/3.2 → 0/0, knee points 13.7/44.5 → 0/0, foot yaw 7.6/30.3 → 0/0, and the drawn legs stand
  straight (picture below). Their skin follows their bones (skin bow at rest: Tomo 1.0/0.2, Grandpa −3.2/−4.5); Space
  Marine's −16/−20 at rest is its own short, padded shin, not the pose.
- What sets the per-look ranks apart is the skin measures (sole roll, skin bow). They are rough: cloth weighted to a
  foot or calf (capes, robes, Sigrun's and Aurelio's hems) throws sole roll far off (Grandpa's 74.5° left sole roll is
  his slipper turned 30° by the clip; 3.5° at rest). Read the table's joint columns as the clip, the skin columns as
  the body, and check a high skin number on the sheet.

**Elbows: the arm IK's pole decides them, and with the default pole every body's elbows point out and down.**

- Left (support) elbow 10-22° from straight down, right (shooting) elbow 47-61° (straight out is 90°): none in or up,
  no spread with body width (narrow and broad bodies alike), so (b) as "wrong for narrow or broad bodies" is not borne
  out in Character Select's pose.
- Switch: the pole moved with the look's tune (`TUNE='{"elbowOut":-0.9,"elbowDown":-0.6}'`) turns the right elbow up and
  in: Tomo 58.9° → −139.4°, Grandpa 59.9° → −138.8°, Space Marine 60.7° → −136.4°; the left (its own fixed pole) stays.
  So the elbow is the pole's, and the default (`ELBOW_POLE_OUT` 0.45 out, `ELBOW_POLE_DOWN` 0.18 down, about 68° from
  down) holds the shooting elbow high and out, nearly level, on every body: if that is what reads as "Tomo's elbows bend
  wrong", it is the constant, not his rig. Not confirmed from the owner's screenshot; no look measured an in or up elbow.
- (A neutral tune, `elbowOut −0.45, elbowDown −0.18`, puts the pole on the shoulder and changes nothing: the solver
  keeps the previous bend.)

Pictures (scratchpad, not in the repo): `before_after.jpg` (rows Tomo, Grandpa, Space Marine; columns: legs as shipped,
legs at rest, elbows default, pole moved) and `limb-sheet.jpg` (the worst 20 and Elder Tomo, front, side, upper front
and support side), in `/tmp/claude-0/-home-user/99559628-4a1b-594f-bb6f-7638c8757e80/scratchpad/legs/`.

For the fix (lane B): the legs' stance in the standing armed clips (or a pass straightening the knees and squaring the
feet when standing still), not a per-rig correction; the elbow pole's out/down ratio if the owner wants it lower.

## After: the fix (lane B, 2026-11-27, `wip/limbs-fix-1127`)

For every character at once; no per-look `tune` was needed (the leftovers in the table are the skin measures' cloth:
capes, robes, spurs and clown shoes, checked on the sheet).

- **Legs, standing still** (`packages/client/src/game/standLegs.ts`, run by CharacterAnimator.pose after the clips): each
  leg re-solved as a two-bone chain while the standing loops (aim_idle, idle) hold the body, by their weight (so it eases
  in as the feet plant and out as a walk, run, crouch, jump or dance takes over; none seated, rolling, dodging or lying,
  nor far off at coarse detail). The hip stays where the clip put it; the ankle keeps the clip's height and place along
  the body but comes in to at most `STANCE_LEAN` 3° out from under the hip (85 % of the way); the knee bends toward the
  toes (`KNEE_OUT` 6° out from ahead); the foot keeps the clip's pitch and roll on the ground and is turned about the
  vertical to `TOE_OUT` 7° out. The clip's knee flex is kept. Unit test `packages/client/test/standLegs.test.ts`.
- **Elbows:** the shooting elbow's pole drops further (`ELBOW_POLE_DOWN` 0.18 → 0.30, its reach out, `ELBOW_POLE_OUT`
  0.45, kept): never in toward the body (the owner's Grandpa Chains note).
- **Support wrist under a handguard** (first and third person, long guns): the forearm rolls about its own line by
  `FOREARM_TWIST_SHARE` 40 % of the hand's twist off rest, the hand turned back by as much (it stays on the gun; in the
  joints' own frames, so mirroring doesn't matter). `shareWristTwist`, unit test `packages/client/test/wristTwist.test.ts`.
- Before/after switch: `__grips.limbFix(false)` (`FIX=0` in limb-audit.mjs) turns all three off; `WRISTS=<guns>` measures
  the wrists (`__grips.wrists()`: each hand's bend and twist on its forearm, the forearm's roll, degrees off rest).

All 176 pickable looks, roster medians (L / R), before → after:

| measure | before | after |
|---|---|---|
| knee bow | 5.7 / 9.9 | 3.1 / 2.2 |
| shin out | 7.8 / 3.2 | 2.6 / 2.6 |
| knee points | 13.7 / 44.3 | 5.5 / 7.2 |
| foot yaw | 7.6 / 30.3 | 7 / 7 |
| sole roll | 2.1 / 1.3 | 2.9 / 2.6 |
| skin bow | -1.9 / -3.2 | -2 / -2.1 |
| elbow (support / shooting) | 16.3 / 57.5 (shooting 47-61) | 16.3 / 46.7 (shooting 38-52) |
| elbows wrong (in or up) | 0 | 0 |
| leg score, median | 14.8 | 8.7 |

Worst five by leg score, before: Sigrun Frostmane 85.7, Grandpa Chains 74.5, Aurelio Dawnmantle 70.8, Patches 56.3, Silas
Coilwhisper 51.5; after: Sigrun Frostmane 89, Dex Calloway 60.5, Patches 56.6, Space Marine 53.2, Silas Coilwhisper 50.5
(all the skin measures: Sigrun's cape, Dex's spurs, Patches' shoes, Space Marine's padded shins, Silas' fringes; their
joints read as the roster's and they stand straight on the sheet). Grandpa Chains 74.5 → 13.1 (his slipper, turned 30°
by the clip, now points ahead), Elder Tomo 14.8 → 4.5.

Support wrist, Grandpa Chains (degrees off rest, the hand on its forearm, bend / twist, and the forearm's roll):

| gun, view | before | after |
|---|---|---|
| Auto Shotgun, first person (arms) | 31 / −129, forearm −39 | 31 / −77, forearm −91 |
| Auto Shotgun, full body | 28 / −132, −47 | 28 / −79, −100 |
| Rifle, first person | 34 / −131, −39 | 34 / −78, −92 |
| SMG, first person | 34 / −130, −39 | 34 / −78, −92 |
| Rifle, third person | 33 / −127, −45 | 33 / −76, −96 |

The bend is the cup's own (the hand palm up, fingers round the handguard's far side) and is unchanged.

## Table, worst first (after the fix)

<!-- limb-table -->
| # | Look | Legs (off median) | worst | Elbows | knee bow L/R | shin out L/R | knee points L/R | foot yaw L/R | sole roll L/R | skin bow L/R | elbow L/R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | **roster median** (176) | | | | 3.1 / 2.2 | 2.6 / 2.6 | 5.5 / 7.2 | 7 / 7 | 2.9 / 2.6 | -2 / -2.1 | 16.3 / 46.7 |
| 1 | Sigrun Frostmane (`core.frostvalkyrie`) | 91.9 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | -89 / -75.8 | 10.8 / 2.6 | 16.6 / 49.3 |
| 2 | Patches (`core.hoboclown`) | 59.5 | footRoll L | 0 | 3.1 / 2 | 3 / 2.8 | 5.6 / 7.3 | 7 / 7 | -56.6 / 9.3 | -3.5 / -10 | 15.3 / 41.4 |
| 3 | Dex Calloway (`core.crewgunslinger`) | 57.6 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 60.5 / 36.1 | -5.3 / -6.8 | 17.1 / 48.9 |
| 4 | Silas Coilwhisper (`core.snakeshaman`) | 53.4 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | -50.5 / 4.3 | -7.9 / -5.6 | 15.4 / 46.2 |
| 5 | Space Marine (`core.spacemarine`) | 51.1 | skinBow R | 0 | 3.2 / 2.4 | 2.4 / 2.4 | 5.4 / 7.1 | 7 / 7 | 5.2 / 0.4 | -28 / -53.2 | 21.2 / 51.2 |
| 6 | King Waddleston (`core.penguinking`) | 46.8 | skinBow R | 0 | 3.3 / 2.6 | 2.2 / 2.3 | 5.4 / 7 | 7 / 7 | -2.6 / -0.3 | – / 44.7 | 18.9 / 44.1 |
| 7 | Napsworth (`core.koala`) | 37.8 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | -0.5 / -0.1 | 24.5 / -39.9 | 14.9 / 41.8 |
| 8 | Sarge Tobias Crane (`core.veterancrew`) | 34.3 | footRoll L | 0 | 3.1 / 2.2 | 2.8 / 2.7 | 5.5 / 7.2 | 7 / 7 | 37.2 / 25.9 | -5.4 / -1.9 | 16.2 / 42.6 |
| 9 | Dredge Marrow (`core.abyssalhunter`) | 31.7 | footRoll R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 11 / 34.3 | -6.7 / -8.8 | 15.9 / 50.6 |
| 10 | Teddy (`core.teddy`) | 30.7 | skinBow L | 0 | 3.2 / 2.4 | 2.4 / 2.4 | 5.4 / 7.1 | 7 / 7 | 2.4 / 0.6 | 28.7 / -7.9 | 19 / 45.9 |
| 11 | Duke Dashwood (`core.cheetah`) | 28.8 | skinBow L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 11.1 / 20.5 | -30.8 / -14.2 | 16.6 / 44.1 |
| 12 | Vesper Quill (`core.crewalchemist`) | 27.8 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 30.7 / 8.3 | -3.5 / -2.3 | 14 / 48.9 |
| 13 | Rourke (`core.rourke`) | 27 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.5 | 5.5 / 7.1 | 7 / 7 | 0.3 / -4.4 | -26.2 / -29.1 | 15.6 / 47 |
| 14 | Capt. Elias Harrowgate (`core.unionofficer`) | 25.9 | footRoll R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 14.8 / 28.5 | -12.4 / -7.6 | 16.8 / 47.2 |
| 15 | Lien Vo (`core.vcscout`) | 25.3 | skinBow L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | -4.7 / 11.2 | 23.3 / -0.4 | 16.6 / 48.1 |
| 16 | Master Bodhi (`core.zencapybara`) | 24.1 | skinBow R | 0 | 3.2 / 2.4 | 2.4 / 2.4 | 5.4 / 7.1 | 7 / 7 | -0.4 / 3.2 | -11.8 / 22 | 14 / 43.1 |
| 17 | Axel Gainz (`core.axolotl`) | 23.7 | skinBow R | 0 | 3.1 / 2.3 | 2.5 / 2.6 | 5.5 / 7.1 | 7 / 7 | -3 / – | -2.1 / 21.6 | 9.8 / 51.7 |
| 18 | Dr. Hugo Hue (`core.chameleon`) | 21.7 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 6.4 / 8.1 | -8.7 / -23.8 | 15.5 / 42.6 |
| 19 | Jolly Springjack (`core.jackinthebox`) | 21.5 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | -18.6 / -1.6 | 9.3 / -6.1 | 14.5 / 46.8 |
| 20 | Chef Basile (`core.basile`) | 21.3 | footRoll R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 19.5 / 23.9 | -4.2 / -11.5 | 16.9 / 46.6 |
| 21 | Col. Josiah Beaumont (`core.rebelcommander`) | 21.3 | skinBow R | 0 | 3.1 / 2.3 | 2.5 / 2.6 | 5.5 / 7.1 | 7 / 7 | -0.4 / 0.3 | -10.5 / -23.4 | 16.5 / 46.9 |
| 22 | Brother Silencio (`core.ansel`) | 20.7 | skinBow L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 1.4 / -0.7 | -22.7 / 1.7 | 16.7 / 47.8 |
| 23 | Goblina (`core.grizzelda`) | 18.7 | footRoll R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 11.8 / 21.3 | -5.5 / -7.5 | 13.7 / 42.4 |
| 24 | The Butcher (`core.butcher`) | 17.2 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 7.2 / 3.5 | -14.8 / -19.3 | 17.2 / 47 |
| 25 | Tetl Stonewarden (`core.basaltguardian`) | 17.2 | footRoll R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 11.4 / 19.8 | -0.9 / -2.1 | 16.5 / 47.4 |
| 26 | Tik Winderly (`core.windupbot`) | 17.2 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 5 / 5.5 | 5.8 / -19.3 | 16 / 44.2 |
| 27 | Dusty Ranger (`core.dustycolt`) | 16.7 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 6.8 / -3.2 | -18.5 / -18.8 | 16.7 / 45.1 |
| 28 | Cutter McCrae (`core.outlawranger`) | 16.7 | footRoll R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 16.1 / 19.3 | -6.9 / -5 | 16 / 48.3 |
| 29 | Rio Neonwing (`core.flamingo`) | 16.1 | skinBow L | 0 | 3.1 / 2.2 | 2.8 / 2.7 | 5.5 / 7.2 | 7 / 7 | 10.8 / 11.2 | 14.1 / -2.1 | 16.8 / 49.3 |
| 30 | Pfc. Danny Okerlund (`core.vietnamsoldier`) | 15.7 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 1.6 / 3.8 | 8.1 / 13.6 | 16.8 / 46.6 |
| 31 | Ottis Crema (`core.baristaotter`) | 15.2 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | -3.7 / 1.8 | 3 / -17.3 | 15 / 43.4 |
| 32 | Bricksby (`core.brickman`) | 15.1 | footRoll R | 0 | 3.1 / 2.3 | 2.5 / 2.6 | 5.5 / 7.1 | 7 / 7 | 16.1 / -12.5 | -10.9 / -16.6 | 16.3 / 46.7 |
| 33 | Grimspire (`core.gargoyle`) | 15.1 | skinBow R | 0 | 3.1 / 2.3 | 2.5 / 2.6 | 5.4 / 7.1 | 7 / 7 | 0.6 / 1.6 | -16.2 / -17.2 | 17.7 / 47.9 |
| 34 | Gears Okafor (`core.crewmechanic`) | 14.5 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 17.4 / 15.6 | -8.1 / -11.5 | 16.2 / 41 |
| 35 | Blix Orrin (`core.crewalien`) | 14.5 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 17.4 / 0.4 | -2.8 / -0.4 | 15.4 / 47.6 |
| 36 | Hazel Hexley (`core.witch`) | 14.1 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 1.7 / 0.7 | 7.5 / 12 | 13.7 / 48.9 |
| 37 | Ulf Ravenshield (`core.vikingm`) | 14 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 5.7 / 6.4 | 10.2 / 11.9 | 16.5 / 48.4 |
| 38 | Dusty Orebeck (`core.spaceminer`) | 14 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 16.9 / -0.3 | -2.6 / -6.6 | 15.5 / 48 |
| 39 | Poor Richard (`core.franklin`) | 13.8 | skinBow L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 3.7 / 3 | -15.8 / -15.5 | 17.2 / 48.9 |
| 40 | Pvt. Hank Dowling (`core.usgrunt`) | 13.8 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 2.1 / 1.3 | 5 / 11.7 | 16.7 / 48.1 |
| 41 | Jingle Tinsel (`core.elf`) | 13.8 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | -4.8 / 6.6 | 11.7 / 11.7 | 17.1 / 48.8 |
| 42 | Sgt. Mickey Callahan (`core.paratrooper`) | 13.7 | footRoll L | 0 | 3.1 / 2.2 | 2.6 / 2.6 | 5.5 / 7.2 | 7 / 7 | -10.8 / 3 | -0.8 / 2.6 | 15.3 / 45.1 |
| 43 | Hazmat Joe (`core.hazmat`) | 13.3 | skinBow R | 0 | 3.1 / 2.2 | 2.6 / 2.6 | 5.5 / 7.2 | 7 / 7 | 12.4 / 13.2 | -8.5 / -15.4 | 16.6 / 43.2 |
| 44 | Greyfang (`core.greyfang`) | 13.1 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 16 / 6.3 | -0.3 / -1.8 | 15.7 / 42.1 |
| 45 | Rascal McGraw (`core.bandit`) | 12.8 | skinBow R | 0 | 3.2 / 2.4 | 2.4 / 2.5 | 5.4 / 7.1 | 7 / 7 | 13.4 / 8.6 | 1.5 / -14.9 | 15.9 / 43.8 |
| 46 | Emerald Robot (`core.emeraldrobot`) | 12.7 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 15.6 / 7.3 | -1.8 / 0.8 | 17.8 / 48.5 |
| 47 | Chilly Flakesworth (`core.snowman`) | 12.7 | kneePoint R | 0 | 5.5 / 10 | 7.9 / 3 | 13.3 / 45.2 | 7.1 / 30.9 | – / – | – / – | 13.8 / 41.6 |
| 48 | Cleo Groovestone (`core.afropi`) | 12.5 | skinBow L | 0 | 3.1 / 2.1 | 2.8 / 2.7 | 5.6 / 7.2 | 7 / 7 | -2.1 / -0.9 | -14.5 / -9.6 | 15.5 / 48.7 |
| 49 | The Veiled Vanguard (`core.vanguard`) | 12.4 | kneePoint R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.4 | 7.7 / 30.3 | – / – | – / – | 17.8 / 47.9 |
| 50 | Cpl. Tinwhistle (`core.toysoldier`) | 12.4 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.5 | 5.5 / 7.1 | 7 / 7 | -9.5 / 6.2 | -6.9 / -10.3 | 15.1 / 44.5 |
| 51 | Mujina (`core.facelessspirit`) | 12.4 | kneePoint R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | -5.5 / 5.3 | -14.2 / -9.5 | 14.8 / 48.2 |
| 52 | Baseball Robot (`core.rollerbot`) | 12.3 | kneePoint R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.1 | 7.6 / 30.3 | – / – | – / – | 14.3 / 46.7 |
| 53 | Sgt. Mackie (`core.pruitt`) | 12.2 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 15.1 / 6.3 | -10.4 / -8.8 | 16.9 / 46.1 |
| 54 | Rocket Nutley (`core.acesquirrel`) | 12.2 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | -2.9 / 4.6 | -11 / -14.3 | 16.5 / 46.8 |
| 55 | Madame Zephyrine (`core.mystic`) | 12.1 | skinBow L | 0 | 3.2 / 2.4 | 2.4 / 2.5 | 5.4 / 7.1 | 7 / 7 | 4.4 / 4.8 | -14.1 / -11.1 | 15.6 / 48.6 |
| 56 | Khan of the Steppes (`core.khan`) | 11.6 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | -3 / 7 | -12 / -13.7 | 14 / 42.9 |
| 57 | Rowdy Gnashwell (`core.tasmaniandevil`) | 11.4 | skinBow R | 0 | 3.2 / 2.3 | 2.5 / 2.5 | 5.4 / 7.1 | 7 / 7 | 4.8 / 4 | 6.7 / 9.3 | 21.6 / 44.1 |
| 58 | Cool Hands Rex (`core.trex`) | 11.2 | skinBow R | 0 | 3.3 / 2.6 | 2.2 / 2.3 | 5.4 / 7 | 7 / 7 | 3.8 / 3.8 | -10.4 / -13.3 | 15.1 / 46.6 |
| 59 | Rollo Splitworth (`core.hyena`) | 11 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 1.1 / 4 | -4.6 / -13.1 | 17.5 / 42.8 |
| 60 | Grandpa Chains (`core.grandpachains`) | 11 | skinBow R | 0 | 3.1 / 2.2 | 2.6 / 2.6 | 5.5 / 7.2 | 7 / 7 | 2.9 / 9.8 | -7.1 / -13.1 | 15.8 / 49.3 |
| 61 | Themba Ironspear (`core.zuluwarrior`) | 11 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | -5.2 / 4.1 | 3.8 / 8.9 | 18.6 / 46.2 |
| 62 | Ignatius Slagg (`core.magmajuggernaut`) | 10.7 | footRoll L | 0 | 3.1 / 2.1 | 2.8 / 2.7 | 5.6 / 7.2 | 7 / 7 | -7.8 / – | -0.2 / -3.7 | 15.5 / 45.5 |
| 63 | Balam Nightclaw (`core.aztecjaguar`) | 10.7 | footRoll R | 0 | 3.1 / 2.1 | 2.8 / 2.7 | 5.6 / 7.2 | 7 / 7 | -2 / -8.1 | -0.5 / -2.8 | 17.3 / 46.1 |
| 64 | Boogie Tuskworth (`core.warthog`) | 10.7 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 2.9 / 1.7 | -6.6 / -12.8 | 19.1 / 43.3 |
| 65 | Sgt. Samir Haddad (`core.repguard`) | 10.4 | skinBow R | 0 | 3.2 / 2.4 | 2.5 / 2.5 | 5.4 / 7.1 | 7 / 7 | 2.4 / 2.6 | 1.5 / 8.3 | 17.2 / 45.4 |
| 66 | Dez Kickley (`core.hoodieguy`) | 10.3 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 7.1 / 3.2 | -4.2 / -12.4 | 16.3 / 48.6 |
| 67 | Barnaby Bruin (`core.barnaby`) | 10.1 | skinBow L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 0.7 / 2.1 | -12.1 / -10.7 | 14.1 / 41.6 |
| 68 | Iron Knight (`core.knight`) | 9.9 | footRoll L | 0 | 3.3 / 2.6 | 2.4 / 2.4 | 5.4 / 7 | 7 / 7 | 12.8 / -0.2 | -1.9 / -7 | 10.6 / 37.6 |
| 69 | El Zarpazo (`core.whitetiger`) | 9.9 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 12.8 / 1.8 | -2 / -2.5 | 16.5 / 45.5 |
| 70 | Nebka the Unwrapped (`core.ankhmummy`) | 9.9 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | -4.3 / -4.2 | -1 / 7.8 | 14.5 / 47.1 |
| 71 | Bronzer (`core.bronzer`) | 9.8 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | -0.7 / -0.6 | 4 / 7.7 | 14.8 / 45.9 |
| 72 | Valeria Sandstorm (`core.gladiatrix`) | 9.8 | footRoll L | 0 | 3.1 / 2.2 | 2.8 / 2.7 | 5.5 / 7.2 | 7 / 7 | -6.9 / -2.7 | 1.2 / 0 | 15.9 / 47.9 |
| 73 | Orange Suit Engineer (`core.orangeengineer`) | 9.6 | skinBow R | 0 | 3.1 / 2.2 | 2.6 / 2.6 | 5.5 / 7.2 | 7 / 7 | 1.6 / 0.1 | -5.4 / -11.7 | 16.3 / 45.1 |
| 74 | Corvin Blackquill (`core.ravennoir`) | 9.5 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | -6.6 / 2.4 | -1.8 / 0 | 16.3 / 49 |
| 75 | Doc Seraphine Vale (`core.crewmedic`) | 9.1 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | -6.2 / 5.5 | -9.5 / -3.6 | 14.2 / 45.6 |
| 76 | Pvt. Pete Plastic (`core.greenarmy`) | 9.1 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 12 / -0.6 | -3.8 / -2.8 | 17.5 / 47.3 |
| 77 | Cal (`core.dale`) | 9 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | -6.1 / -2.3 | -3.9 / -10.4 | 17 / 47 |
| 78 | Tag Malone (`core.graffitiraccoon`) | 9 | footRoll L | 0 | 3.2 / 2.3 | 2.5 / 2.5 | 5.4 / 7.1 | 7 / 7 | 11.9 / 3.9 | -9.9 / 1.9 | 18.5 / 42.9 |
| 79 | Chompers McFinn (`core.wackyshark`) | 8.9 | footRoll R | 0 | 3.1 / 2.2 | 2.6 / 2.6 | 5.5 / 7.2 | 7 / 7 | -1.4 / -6.3 | -4.4 / -6.9 | 20.5 / 44.2 |
| 80 | Rufus Boomtown (`core.baboon`) | 8.9 | footRoll L | 0 | 3.1 / 2.1 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 11.8 / 1.9 | 1.1 / 0.9 | 16.4 / 42.8 |
| 81 | Shaka Mpande (`core.shaka`) | 8.9 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 1.4 / 1.1 | -2 / 6.8 | 17.6 / 44.8 |
| 82 | Prof. Quanta (`core.einstein`) | 8.9 | skinBow L | 0 | 3.1 / 2.4 | 2.5 / 2.5 | 5.4 / 7.1 | 7 / 7 | 4 / 1.5 | 6.9 / -1.8 | 16.7 / 48.6 |
| 83 | Shiba (`core.shiba`) | 8.6 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 3.1 / 2.2 | -8.3 / -10.7 | 15.3 / 47.7 |
| 84 | Gobbles Plymouth (`core.turkeypilgrim`) | 8.6 | skinBow L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 2.3 / 1 | 6.6 / 2.2 | 14 / 47.1 |
| 85 | Pharaoh Mummy Warrior (`core.pharaoh`) | 8.5 | skinBow L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | -0.8 / 0.7 | -10.5 / 5.9 | 11.6 / 40.7 |
| 86 | Deuce Droopwell (`core.blobfish`) | 8.5 | skinBow R | 0 | 3.2 / 2.4 | 2.5 / 2.6 | 5.5 / 7.1 | 7 / 7 | 2.3 / -0.5 | -6.7 / -10.6 | 15.6 / 42.4 |
| 87 | Inspector Bigotes (`core.inspector`) | 8.3 | skinBow R | 0 | 3.1 / 2.1 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | -2.1 / 0.8 | -6.5 / -10.4 | 12 / 41.1 |
| 88 | Emir Tariq Falconsword (`core.emir`) | 8.3 | skinBow L | 0 | 3.2 / 2.4 | 2.5 / 2.5 | 5.4 / 7.1 | 7 / 7 | 3.7 / 2.4 | -10.3 / -4.9 | 16.3 / 47.7 |
| 89 | Det. Drake Montego (`core.detectiveduck`) | 8.1 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 1.8 / 6.6 | -3.1 / -10.2 | 16.8 / 45 |
| 90 | Flicker (`core.crewphase`) | 8 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 10.9 / 6.3 | 0.1 / 1.1 | 15.3 / 49.7 |
| 91 | Thornweaver (`core.thornweaver`) | 7.7 | skinBow L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 2.4 / 2.6 | 5.7 / 3.8 | 15.3 / 47.6 |
| 92 | Gorilla G (`core.gorillag`) | 7.7 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 10.6 / 0.7 | -2.3 / 5.5 | 18.3 / 44.2 |
| 93 | Kesi Tallgrass (`core.lionsuit`) | 7.6 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 4.7 / 4.1 | 0.4 / 5.5 | 15.5 / 46.1 |
| 94 | Nova Kade (`core.crewcyborg`) | 7.6 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 9.5 / 9.2 | 2.7 / 5.5 | 14.5 / 48.1 |
| 95 | Maximus Cluckworth (`core.gladiatorrooster`) | 7.6 | skinBow R | 0 | 3.2 / 2.5 | 2.3 / 2.4 | 5.4 / 7 | 7 / 7 | -1.7 / 4.4 | 0.9 / 5.5 | 17 / 45.7 |
| 96 | Talon Skycrest (`core.eagleclan`) | 7.6 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 10.5 / 4.3 | -1.6 / 1.4 | 17.4 / 49.6 |
| 97 | Elder Tomo (`core.elder`) | 7.4 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | -4.5 / 3.2 | 0 / 4.3 | 16.6 / 48.5 |
| 98 | Octo Buddy (`core.octobuddy`) | 7.4 | skinBow L | 0 | 3.2 / 2.4 | 2.5 / 2.5 | 5.4 / 7.1 | 7 / 7 | 5.8 / 3.6 | 5.4 / -8.7 | 22.2 / 45.1 |
| 99 | Ace Featherstone (`core.eagleace`) | 7.2 | skinBow R | 0 | 3.1 / 2.2 | 2.6 / 2.6 | 5.5 / 7.2 | 7 / 7 | 3.6 / 2.5 | 0.5 / 5.1 | 17.1 / 43.8 |
| 100 | The Dapper (`core.dapper`) | 7.1 | footRoll R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 0.4 / -4.5 | -3.4 / -2.3 | 14.9 / 45.5 |
| 101 | Seetah J. Chloth (`core.seetah`) | 7.1 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | -4.2 / -1.1 | -0.3 / -4 | 15.1 / 46.6 |
| 102 | Imperial Guard (`core.imperialguard`) | 7 | footRoll R | 0 | 3.2 / 2.4 | 2.4 / 2.5 | 5.4 / 7.1 | 7 / 7 | 4.7 / 9.6 | 4.3 / -4.7 | 17.4 / 49.5 |
| 103 | Pip Quickfoot (`core.harecourier`) | 6.8 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 9.6 / 2.3 | 2.3 / 4.7 | 13.5 / 44.8 |
| 104 | Fuse Hollister (`core.crewdemolitions`) | 6.7 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 9.6 / 9.2 | -1.9 / -1.6 | 16.6 / 47 |
| 105 | Punkin (`core.punkin`) | 6.6 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 6 / 4.6 | 1.4 / -8.7 | 15.6 / 48.5 |
| 106 | Kaiser Ironhelm (`core.gothickaiser`) | 6.6 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 1.5 / 1.2 | 1.3 / 4.5 | 16.2 / 47.7 |
| 107 | Biker Gang Girl (`core.bikergirl`) | 6.4 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 1.5 / 2.4 | 0.1 / 4.3 | 15.2 / 46.8 |
| 108 | Hopsworth Eggleton (`core.easterbunny`) | 6.3 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 5.1 / 4.4 | 0.7 / 4.2 | 13.6 / 47.6 |
| 109 | Botboy (`core.botboy`) | 6.2 | footRoll R | 0 | 3.1 / 2.1 | 2.8 / 2.7 | 5.5 / 7.2 | 7 / 7 | 0.9 / -3.6 | -3.8 / -7.5 | 17.1 / 48.6 |
| 110 | Fishy Fred (`core.fishyfred`) | 6.2 | skinBow R | 0 | 3.1 / 2.1 | 2.8 / 2.7 | 5.5 / 7.2 | 7 / 7 | 4.8 / 1.8 | 0.2 / -8.3 | 14.7 / 44.9 |
| 111 | Ser Aurelian Dawnshield (`core.paladin`) | 6.2 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 9.1 / 4.6 | -2.2 / 4 | 16.4 / 47.9 |
| 112 | Ricochet (`core.ricochet`) | 6.1 | footRoll R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 0.7 / -3.5 | -5 / -5 | 10.9 / 46.4 |
| 113 | Cap'n Ezra Blackwake (`core.piratecaptain`) | 6.1 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 4 / 1.8 | 0.3 / 4 | 15.9 / 44.7 |
| 114 | Dog Tag Doyle (`core.undeadsoldier`) | 6 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 8.9 / 4.4 | -1.7 / -1.9 | 14.7 / 46.1 |
| 115 | The Pale Stranger (`core.stranger`) | 6 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 2.9 / 5.2 | -3.8 / -8.1 | 16.6 / 48.3 |
| 116 | Zorp Gleebix (`core.abnormalalien`) | 6 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 3.2 / 1.9 | 0.8 / 3.9 | 16 / 48.9 |
| 117 | Boglurker (`core.boglurker`) | 5.9 | footRoll R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | – / -3.3 | -4.1 / -5 | 16.1 / 44.9 |
| 118 | Freaky Frida (`core.frida`) | 5.9 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 3.7 / 4 | 2.7 / 3.8 | 14 / 47.7 |
| 119 | Anoobys (`core.anubis`) | 5.8 | footRoll L | 0 | 3.1 / 2.2 | 2.6 / 2.6 | 5.5 / 7.2 | 7 / 7 | -2.9 / 3.9 | -4.6 / -3.1 | 16.8 / 45.2 |
| 120 | Kenji (`core.resolvesoldier`) | 5.8 | footRoll R | 0 | 3.1 / 2.2 | 2.6 / 2.6 | 5.5 / 7.2 | 7 / 7 | 3.5 / 8.4 | -4.1 / -0.9 | 14.5 / 42.6 |
| 121 | Mr. Gideon Tarr (`core.firstmate`) | 5.8 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 8.7 / 4.7 | -3.2 / -5.6 | 17.4 / 45.5 |
| 122 | Ellis Velvetrope (`core.elephantwarrior`) | 5.6 | skinBow R | 0 | 3.2 / 2.3 | 2.5 / 2.5 | 5.4 / 7.1 | 7 / 7 | 4.6 / 1.4 | -6.2 / -7.7 | 19.3 / 43.5 |
| 123 | Croakley (`core.croakley`) | 5.4 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 2.5 / 2.2 | 1.1 / 3.3 | 17.3 / 44.3 |
| 124 | Wren Halloway (`core.crewrecon`) | 5.4 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 6.2 / 3.6 | -2.5 / 3.3 | 16.1 / 47.4 |
| 125 | Mags Petrov (`core.crewquartermaster`) | 5.4 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 2.6 / 1.1 | 0.1 / 3.3 | 15.8 / 47.1 |
| 126 | Buster Haymaker (`core.boxerbunny`) | 5.4 | skinBow R | 0 | 3.2 / 2.4 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 3.6 / -0.4 | -4.2 / -7.5 | 17.2 / 43.2 |
| 127 | Ryo Snapclaw (`core.mantisshrimp`) | 5.3 | skinBow R | 0 | 3.2 / 2.4 | 2.4 / 2.5 | 5.4 / 7.1 | 7 / 7 | 0.2 / 2.6 | 2 / 3.2 | 15.3 / 46.3 |
| 128 | Sterling Purrcival (`core.tuxedocat`) | 5.3 | skinBow R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 5 / 3.5 | -5.9 / -7.4 | 16.8 / 45.6 |
| 129 | Azure Sentinel (`core.azuresentinel`) | 5.2 | footRoll L | 0 | 3.2 / 2.4 | 2.5 / 2.5 | 5.4 / 7.1 | 7 / 7 | -2.3 / 5.6 | -3.8 / -3 | 14.5 / 46.3 |
| 130 | Rad Rootley (`core.radishman`) | 5.2 | skinBow R | 0 | 3.1 / 2.2 | 2.8 / 2.7 | 5.5 / 7.2 | 7 / 7 | 3.7 / 2.6 | -6.9 / -7.3 | 12 / 48.8 |
| 131 | Pink Mantis (`core.pinkalien`) | 5 | footRoll R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | -0.5 / -2.4 | -0.4 / -1.5 | 16.5 / 48.6 |
| 132 | Rocco Tickwell (`core.crewk9`) | 5 | skinBow R | 0 | 3.1 / 2.3 | 2.5 / 2.6 | 5.5 / 7.1 | 7 / 7 | 1.7 / 0 | -0.5 / -7.1 | 16.5 / 47.6 |
| 133 | Barnaby Burrows (`core.badgeragent`) | 4.9 | skinBow R | 0 | 3.2 / 2.4 | 2.4 / 2.5 | 5.4 / 7.1 | 7 / 7 | 0.6 / 4 | -1.2 / 2.8 | 17.2 / 47.5 |
| 134 | DJ Volta Coilwave (`core.synthwaveeel`) | 4.9 | skinBow R | 0 | 3.1 / 2.1 | 2.8 / 2.7 | 5.6 / 7.2 | 7 / 7 | 4.4 / 6.5 | -3.3 / 2.8 | 20.8 / 39.3 |
| 135 | Gorgle (`core.gorgle`) | 4.8 | skinBow R | 0 | 3.1 / 2.1 | 2.8 / 2.7 | 5.6 / 7.2 | 7 / 7 | 0.5 / -1.9 | 0.3 / 2.7 | 17.2 / 48.7 |
| 136 | Starfarer (`core.darkastronaut`) | 4.8 | footRoll R | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 4.8 / -2.2 | -2.2 / -0.5 | 15.5 / 43.5 |
| 137 | Spacewalker (`core.astronaut`) | 4.7 | skinBow L | 0 | 3.1 / 2.1 | 2.8 / 2.7 | 5.5 / 7.2 | 7 / 7 | 6 / 6.9 | 2.7 / 2 | 16.7 / 46.7 |
| 138 | Aurelio Dawnmantle (`core.sunpriest`) | 4.7 | footRoll R | 0 | 3.1 / 2.1 | 2.8 / 2.7 | 5.5 / 7.2 | 7 / 7 | 1.5 / -2.1 | -4.8 / -2.9 | 15.2 / 42.7 |
| 139 | Count Bonesworth (`core.bonesworth`) | 4.6 | footRoll R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 1.7 / 7.2 | -1.4 / -1.4 | 16.3 / 49 |
| 140 | Honest Abe (`core.abe`) | 4.5 | skinBow L | 0 | 3.1 / 2.3 | 2.5 / 2.6 | 5.5 / 7.1 | 7 / 7 | 3.5 / 4.2 | 2.5 / -0.6 | 17 / 47.9 |
| 141 | Clangers (`core.cymbalmonkey`) | 4.5 | skinBow L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 6.2 / 4.9 | 2.5 / -1 | 15.1 / 48.2 |
| 142 | Coach Hank Shelton (`core.coachtortoise`) | 4.4 | footRoll L | 0 | 3.1 / 2.2 | 2.6 / 2.6 | 5.5 / 7.2 | 7 / 7 | 7.3 / 2.3 | -2.3 / -4 | 17.5 / 43.8 |
| 143 | Clio Everwhen (`core.timetraveler`) | 4.2 | footRoll R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | -0.9 / 6.8 | -0.8 / -1.5 | 14.8 / 46.9 |
| 144 | Ser Godric Vale (`core.templar`) | 4.2 | skinBow R | 0 | 3.2 / 2.5 | 2.3 / 2.4 | 5.4 / 7.1 | 7 / 7 | 0.1 / 0.7 | -0.2 / -6.3 | 16.8 / 47.9 |
| 145 | Stealth Operative (`core.stealthop`) | 4.1 | skinBow L | 0 | 3.1 / 2.2 | 2.6 / 2.6 | 5.5 / 7.2 | 7 / 7 | 0.3 / 2.5 | 2.1 / 0.4 | 9.6 / 39.1 |
| 146 | T-TreeFitty (`core.t350`) | 4 | footRoll R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | -0.1 / -1.4 | -1.6 / -0.9 | 15.7 / 47.4 |
| 147 | Kato Emberline (`core.kato`) | 3.9 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | -1 / -0.6 | -4.9 / -4.7 | 17 / 48.1 |
| 148 | Juno Hartwell (`core.crewpilot`) | 3.9 | footRoll R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 5.5 / 6.5 | -4 / -4.6 | 13.6 / 48.9 |
| 149 | The Visitor (`core.visitor`) | 3.8 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | -0.9 / 6.3 | -2.1 / 0 | 14.7 / 47.1 |
| 150 | General Cherrytree (`core.washington`) | 3.8 | skinBow L | 0 | 3.1 / 2.2 | 2.6 / 2.6 | 5.5 / 7.2 | 7 / 7 | 2.5 / 1.9 | -5.8 / -3.9 | 17.4 / 47.6 |
| 151 | Ryker Voss (`core.merc`) | 3.8 | skinBow L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 3.7 / 3.3 | 1.8 / 1.2 | 16.4 / 45.3 |
| 152 | Lancer Mei (`core.mei`) | 3.7 | skinBow L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 0.7 / 2.1 | -5.7 / -2.4 | 15.6 / 48.7 |
| 153 | Imperator Laurel (`core.caesar`) | 3.7 | skinBow L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 3.4 / 0.3 | 1.7 / -2.1 | 17.2 / 49.7 |
| 154 | Kris Kringleton (`core.santa`) | 3.7 | skinBow L | 0 | 3.2 / 2.4 | 2.4 / 2.5 | 5.4 / 7.1 | 7 / 7 | 2.6 / 2 | 1.7 / -0.5 | 17.6 / 46.9 |
| 155 | Uncle Spangle (`core.unclesam`) | 3.7 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 1.4 / 3.6 | -1.4 / 1.6 | 16.2 / 47.7 |
| 156 | The Rough Rider (`core.roosevelt`) | 3.5 | skinBow R | 0 | 3.1 / 2.2 | 2.8 / 2.7 | 5.5 / 7.2 | 7 / 7 | 2.1 / 4.5 | -4.9 / 1.4 | 17 / 48 |
| 157 | Ollie Hootman (`core.owlsniper`) | 3.1 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 1 / 0 | -3.8 / -5.2 | 16.5 / 48.7 |
| 158 | Scarlet Brinewell (`core.femalepirate`) | 3.1 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 6 / 4.7 | -0.4 / -4.3 | 14.9 / 47 |
| 159 | Old Timer (`core.oldtimer`) | 2.9 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 0 / 3.2 | -4.2 / -0.5 | 15.2 / 49.9 |
| 160 | Field Medic Automaton (`core.medicautomaton`) | 2.8 | skinBow L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 1.9 / 2.7 | 0.8 / -0.4 | 16.2 / 44.7 |
| 161 | The Mechanic (`core.mechanic`) | 2.8 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 5.7 / 4.7 | -1 / -3.3 | 13.6 / 41.3 |
| 162 | Lyra Vantis (`core.crewchronomage`) | 2.7 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 3.7 / 0.9 | -2.4 / 0.6 | 15.1 / 46.1 |
| 163 | Ziggy Bananas (`core.chimp`) | 2.7 | footRoll R | 0 | 3.1 / 2.4 | 2.5 / 2.5 | 5.5 / 7.1 | 7 / 7 | 5.5 / -0.1 | 0.2 / -1.1 | 17 / 49 |
| 164 | Mummy Bot (`core.mummybot`) | 2.6 | footRoll L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 5.5 / 0.8 | -2.6 / -0.5 | 14.4 / 46.6 |
| 165 | Chad Croakley (`core.gymfrog`) | 2.6 | skinBow L | 0 | 3.1 / 2.2 | 2.8 / 2.7 | 5.5 / 7.2 | 7 / 7 | 0.4 / 2.3 | 0.6 / -0.3 | 19 / 45.8 |
| 166 | Fenn Dustwhirl (`core.fennec`) | 2.6 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 4.3 / 0.2 | -1.5 / 0.5 | 17.4 / 44.5 |
| 167 | Ser Aldous Lionmane (`core.lionheart`) | 2.5 | skinBow L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 1.9 / 4.3 | 0.5 / -1.2 | 17.1 / 47.1 |
| 168 | Astrid Stormbrand (`core.vikingf`) | 2.4 | skinBow L | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 4.9 / 1.1 | 0.4 / -1.8 | 15.9 / 47.4 |
| 169 | Cyber Lion (`core.cyberlion`) | 2.1 | skinBow L | 0 | 3.1 / 2.2 | 2.8 / 2.7 | 5.5 / 7.2 | 7 / 7 | 1.3 / 1.9 | 0.1 / -4.2 | 17.4 / 43 |
| 170 | Ser Castor Brightmoor (`core.celestialknight`) | 2.1 | footRoll R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 3.4 / 4.7 | -3.9 / -4.2 | 16.4 / 49.8 |
| 171 | Flt. Lt. Ember (`core.ember`) | 1.9 | skinBow R | 0 | 3.1 / 2.2 | 2.7 / 2.7 | 5.5 / 7.2 | 7 / 7 | 2.1 / 2.4 | -0.3 / -0.2 | 12.4 / 39.8 |
| 172 | CRT Robot (`core.crtrobot`) | 1.9 | footRoll L | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 4.8 / 2 | -0.1 / -1.5 | 12 / 38.6 |
| 173 | Puddles Backspin (`core.boxduck`) | 1.5 | skinBow L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 2.5 / 3 | -0.5 / -1.6 | 17.1 / 42 |
| 174 | Astor Moonvale (`core.ts2wizard`) | 1.5 | footRoll L | 0 | 3.2 / 2.4 | 2.4 / 2.5 | 5.4 / 7.1 | 7 / 7 | 1.4 / 3.4 | -2.7 / -1.5 | 15.4 / 45.3 |
| 175 | Gefr. Otto Brandt (`core.germanpara`) | 1.3 | footRoll R | 0 | 3.1 / 2.3 | 2.6 / 2.6 | 5.5 / 7.1 | 7 / 7 | 2.3 / 3.9 | -2.3 / -1.2 | 16.4 / 46.6 |
| 176 | Newt Calloway (`core.warlord`) | 1 | skinBow L | 0 | 3.1 / 2.2 | 2.7 / 2.6 | 5.5 / 7.2 | 7 / 7 | 3.6 / 2.2 | -1 / -1.1 | 17.3 / 45.8 |
<!-- /limb-table -->
