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

## Table, worst first

<!-- limb-table -->
| # | Look | Legs (off median) | worst | Elbows | knee bow L/R | shin out L/R | knee points L/R | foot yaw L/R | sole roll L/R | skin bow L/R | elbow L/R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | **roster median** (176) | | | | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.6 / 30.3 | 2.1 / 1.3 | -1.9 / -3.2 | 16.3 / 57.5 |
| 1 | Sigrun Frostmane (`core.frostvalkyrie`) | 87.8 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | -85.7 / 19 | 14.1 / 5.9 | 16.6 / 59.6 |
| 2 | Grandpa Chains (`core.grandpachains`) | 72.4 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.6 / 30.3 | 74.5 / 5 | -6.7 / -16.4 | 15.8 / 59.9 |
| 3 | Aurelio Dawnmantle (`core.sunpriest`) | 68.7 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.6 | 7.6 / 30.3 | 70.8 / -1.4 | -4.6 / -2.3 | 15.2 / 53.2 |
| 4 | Patches (`core.hoboclown`) | 58.4 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 14.1 / 44.9 | 7.7 / 30.3 | -56.3 / 10 | -4.2 / -10.4 | 15.3 / 52.7 |
| 5 | Silas Coilwhisper (`core.snakeshaman`) | 53.6 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | -51.5 / 44 | -7.7 / -6.1 | 15.4 / 57.2 |
| 6 | Space Marine (`core.spacemarine`) | 47.8 | skinBow R | 0 | 5.4 / 10 | 7.9 / 3 | 12.7 / 44.7 | 6.9 / 31 | 2.4 / -1.1 | -29.4 / -51 | 21.2 / 60.7 |
| 7 | King Waddleston (`core.penguinking`) | 46.8 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.2 / 43.9 | 7.6 / 30.3 | -2.1 / 0.1 | – / 43.6 | 18.9 / 55.4 |
| 8 | Dredge Marrow (`core.abyssalhunter`) | 37.9 | footRoll R | 0 | 5.6 / 9.9 | 7.8 / 3.2 | 13.5 / 44.4 | 7.5 / 30.4 | 11 / 39.2 | -6.4 / -8.8 | 15.9 / 60.8 |
| 9 | Greyfang (`core.greyfang`) | 37.6 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.2 | 7.6 / 30.3 | -35.5 / 3.2 | -0.7 / -3.9 | 15.7 / 52.9 |
| 10 | Napsworth (`core.koala`) | 36 | skinBow R | 0 | 5.8 / 9.8 | 7.8 / 3.3 | 14 / 44.2 | 8 / 30 | -1 / -0.4 | 21.4 / -39.2 | 14.9 / 52.8 |
| 11 | Dex Calloway (`core.crewgunslinger`) | 33.4 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | 35.5 / 14.2 | -5.4 / -7.4 | 17.1 / 60 |
| 12 | Sarge Tobias Crane (`core.veterancrew`) | 30.4 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.7 / 30.3 | 32.5 / 3.8 | -5.3 / -2.1 | 16.2 / 53.8 |
| 13 | Duke Dashwood (`core.cheetah`) | 28.3 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.3 | 13.8 / 44.2 | 7.8 / 30.2 | 10 / 6.1 | -30.2 / -12.3 | 16.6 / 54.4 |
| 14 | Teddy (`core.teddy`) | 27.9 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.4 / 44 | 7.6 / 30.3 | 1.4 / -2.5 | 26 / -12 | 19 / 56.5 |
| 15 | Blix Orrin (`core.crewalien`) | 26 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 28.1 / 0.2 | -2.7 / -1.4 | 15.4 / 58.4 |
| 16 | Rourke (`core.rourke`) | 25.9 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.2 | 7.6 / 30.3 | 1.2 / -2.7 | -25.7 / -29.1 | 15.6 / 57.5 |
| 17 | Axel Gainz (`core.axolotl`) | 25.8 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.6 / 30.3 | -4.5 / – | -2.6 / 22.6 | 9.8 / 60.5 |
| 18 | Lien Vo (`core.vcscout`) | 23.3 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | -4.9 / 8 | 21.4 / -2.8 | 16.6 / 59.4 |
| 19 | Jolly Springjack (`core.jackinthebox`) | 22.7 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | -20.6 / -2.8 | 11.3 / -5.3 | 14.5 / 57.4 |
| 20 | Master Bodhi (`core.zencapybara`) | 22.2 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.4 / 44.1 | 7.6 / 30.4 | -0.4 / -3.3 | -12.7 / 19 | 14 / 54.1 |
| 21 | Col. Josiah Beaumont (`core.rebelcommander`) | 20.4 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.6 / 30.3 | 0.4 / 0 | -10.9 / -23.6 | 16.5 / 58 |
| 22 | Brother Silencio (`core.ansel`) | 19.8 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.2 | 7.6 / 30.3 | 1.5 / -1.5 | -21.7 / 1.9 | 16.7 / 58.7 |
| 23 | Ignatius Slagg (`core.magmajuggernaut`) | 18.8 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.9 / 44.6 | 7.7 / 30.3 | -16.7 / – | -0.7 / -5.7 | 15.5 / 55.4 |
| 24 | Chef Basile (`core.basile`) | 18.2 | footRoll R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 18.4 / 19.5 | -4.2 / -12.9 | 16.9 / 57.8 |
| 25 | The Butcher (`core.butcher`) | 17.6 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.6 / 30.3 | 7.8 / -0.7 | -15.4 / -20.8 | 17.2 / 58.1 |
| 26 | Capt. Elias Harrowgate (`core.unionofficer`) | 16.9 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | 19 / 0.9 | -12.5 / -6.7 | 16.8 / 57.7 |
| 27 | Pfc. Danny Okerlund (`core.vietnamsoldier`) | 16.9 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.4 | 2.1 / 1.2 | 8.5 / 13.7 | 16.8 / 56.9 |
| 28 | Grimspire (`core.gargoyle`) | 16.8 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.7 / 30.3 | -1.6 / -3.8 | -16 / -20 | 17.7 / 58.7 |
| 29 | Dusty Ranger (`core.dustycolt`) | 16.2 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.4 | 7.6 / 30.4 | 7.3 / -4.3 | -18.1 / -18.5 | 16.7 / 53.7 |
| 30 | Rio Neonwing (`core.flamingo`) | 16.1 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.9 / 44.5 | 7.7 / 30.3 | 9.2 / 1.7 | 14.2 / -0.4 | 16.8 / 60.5 |
| 31 | Hazel Hexley (`core.witch`) | 15.8 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.4 | 7.7 / 30.3 | 0.8 / 0 | 8.2 / 12.6 | 13.7 / 59.8 |
| 32 | Jingle Tinsel (`core.elf`) | 15.6 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | -3.8 / 3 | 11.5 / 12.4 | 17.1 / 59.5 |
| 33 | Dr. Hugo Hue (`core.chameleon`) | 15 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.6 / 30.4 | 5.4 / 1.2 | -10.3 / -18.2 | 15.5 / 54.7 |
| 34 | Poor Richard (`core.franklin`) | 14.7 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.7 / 30.3 | 1.6 / 0.7 | -16.2 / -17.9 | 17.2 / 59.8 |
| 35 | Tik Winderly (`core.windupbot`) | 14.5 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.2 | 7.6 / 30.4 | 2.8 / 2.6 | 5.6 / -17.7 | 16 / 55.1 |
| 36 | Sgt. Mackie (`core.pruitt`) | 14.2 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.6 / 30.3 | 16.3 / 3.8 | -11.1 / -11.3 | 16.9 / 57.1 |
| 37 | Pvt. Hank Dowling (`core.usgrunt`) | 14.2 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 1.7 / -0.2 | 5.6 / 11 | 16.7 / 59.1 |
| 38 | Rascal McGraw (`core.bandit`) | 14 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.4 / 44 | 7.7 / 30.3 | 12.7 / 3.1 | 3.2 / -17.2 | 15.9 / 53.4 |
| 39 | Emerald Robot (`core.emeraldrobot`) | 13.9 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.4 | 7.7 / 30.3 | 16 / 7.4 | -1.6 / -0.2 | 17.8 / 58.4 |
| 40 | Hazmat Joe (`core.hazmat`) | 13.8 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 12.6 / 7 | -9.4 / -17 | 16.6 / 55.1 |
| 41 | Cutter McCrae (`core.outlawranger`) | 13.4 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.7 / 30.3 | 15.5 / 10.3 | -6.6 / -4.5 | 16 / 59.1 |
| 42 | Ulf Ravenshield (`core.vikingm`) | 12.9 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | 4.8 / 4.7 | 10.5 / 9.7 | 16.5 / 58.9 |
| 43 | Balam Nightclaw (`core.aztecjaguar`) | 12.6 | footRoll R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.6 | 7.6 / 30.4 | -2.5 / -11.3 | -1 / -3.2 | 17.3 / 56.9 |
| 44 | Bricksby (`core.brickman`) | 12.5 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.3 | 7.6 / 30.3 | 12.1 / -9.8 | -11.2 / -15.7 | 16.3 / 57.3 |
| 45 | Cleo Groovestone (`core.afropi`) | 12.4 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.6 | 7.6 / 30.4 | 1.2 / -0.8 | -14.3 / -9.1 | 15.5 / 59.3 |
| 46 | Rocket Nutley (`core.acesquirrel`) | 12.4 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.4 | 0 / -0.6 | -10.9 / -15.6 | 16.5 / 57.4 |
| 47 | Mujina (`core.facelessspirit`) | 12.3 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | -5.5 / 5.3 | -14.2 / -9.5 | 14.8 / 58.9 |
| 48 | Rowdy Gnashwell (`core.tasmaniandevil`) | 12 | skinBow R | 0 | 5.6 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.6 / 30.4 | 4.9 / 0.4 | 7.4 / 8.8 | 21.6 / 53.8 |
| 49 | Cool Hands Rex (`core.trex`) | 11.7 | skinBow R | 0 | 5.8 / 9.8 | 7.8 / 3.3 | 13.5 / 43.6 | 7.9 / 30.1 | 3.3 / 1.5 | -11.2 / -14.9 | 15.1 / 58.3 |
| 50 | Madame Zephyrine (`core.mystic`) | 11.7 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44 | 7.7 / 30.3 | 2.6 / 4.2 | -13.6 / -13 | 15.6 / 59.4 |
| 51 | Doc Seraphine Vale (`core.crewmedic`) | 11.7 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.4 | -9.6 / 1.8 | -9.4 / -4.5 | 14.2 / 55.9 |
| 52 | Themba Ironspear (`core.zuluwarrior`) | 11.6 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | -3.5 / 2.2 | 4.2 / 8.4 | 18.6 / 56.7 |
| 53 | Bronzer (`core.bronzer`) | 11.5 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | -0.6 / -0.7 | 4.8 / 8.3 | 14.8 / 57 |
| 54 | Fuse Hollister (`core.crewdemolitions`) | 11.5 | footRoll R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 4.2 / 12.8 | -1.8 / -2.7 | 16.6 / 57.5 |
| 55 | Khan of the Steppes (`core.khan`) | 11.3 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.6 / 30.3 | 2.2 / 2.8 | -12.4 / -14.5 | 14 / 54.3 |
| 56 | Cal (`core.dale`) | 11.2 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.2 | 7.7 / 30.3 | -9.1 / -0.1 | -4.7 / -14.1 | 17 / 57.9 |
| 57 | Dez Kickley (`core.hoodieguy`) | 11.1 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.6 / 30.3 | 9.4 / 1.9 | -4.8 / -14.3 | 16.3 / 59.3 |
| 58 | Dusty Orebeck (`core.spaceminer`) | 11.1 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.7 / 30.3 | 13.2 / 0.2 | -2.5 / -8.1 | 15.5 / 58.7 |
| 59 | Pvt. Pete Plastic (`core.greenarmy`) | 10.7 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.7 / 30.3 | 12.8 / 0.6 | -4.2 / -4.7 | 17.5 / 58.6 |
| 60 | Tag Malone (`core.graffitiraccoon`) | 10.5 | footRoll R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.6 / 30.4 | 11.2 / -9.2 | -9.5 / 3.1 | 18.5 / 52.6 |
| 61 | Rollo Splitworth (`core.hyena`) | 10.4 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | -0.3 / 3.5 | -5.2 / -13.6 | 17.5 / 53.8 |
| 62 | Barnaby Bruin (`core.barnaby`) | 10.1 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | -0.5 / 2.1 | -12 / -11.2 | 14.1 / 53 |
| 63 | Valeria Sandstorm (`core.gladiatrix`) | 9.9 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.7 / 30.3 | -7.8 / -2.6 | 1.2 / -0.5 | 15.9 / 58.8 |
| 64 | Gears Okafor (`core.crewmechanic`) | 9.8 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | 11.8 / 4 | -8.8 / -13 | 16.2 / 51.9 |
| 65 | Ottis Crema (`core.baristaotter`) | 9.8 | skinBow R | 0 | 5.9 / 9.8 | 7.8 / 3.4 | 14.2 / 43.7 | 8.2 / 29.8 | -3.7 / 1.5 | 2.3 / -13 | 15 / 55 |
| 66 | Nebka the Unwrapped (`core.ankhmummy`) | 9.8 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | -4.8 / -2.4 | -1.1 / 6.6 | 14.5 / 58.7 |
| 67 | Cpl. Tinwhistle (`core.toysoldier`) | 9.6 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.6 / 30.4 | -5.1 / 5.2 | -7.3 / -12.8 | 15.1 / 55.1 |
| 68 | El Zarpazo (`core.whitetiger`) | 9.5 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.7 / 30.3 | 11.6 / 1.4 | -2.3 / -3.8 | 16.5 / 56.4 |
| 69 | Orange Suit Engineer (`core.orangeengineer`) | 9.4 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.7 / 30.3 | 2.1 / -3.3 | -5.6 / -12.6 | 16.3 / 55.9 |
| 70 | Kesi Tallgrass (`core.lionsuit`) | 9.4 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.2 | 7.6 / 30.3 | 5.5 / 2.2 | 0.9 / 6.2 | 15.5 / 57.3 |
| 71 | Sgt. Samir Haddad (`core.repguard`) | 9.3 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.1 | 7.7 / 30.3 | 2.2 / 1.4 | 2 / 6.1 | 17.2 / 56.4 |
| 72 | Deuce Droopwell (`core.blobfish`) | 9 | skinBow R | 0 | 6.7 / 9.3 | 7.7 / 4.2 | 16.4 / 41.3 | 10.6 / 27.4 | 0.6 / -1.3 | -7.8 / -12.2 | 15.6 / 53.5 |
| 73 | Shaka Mpande (`core.shaka`) | 9 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | 1.7 / 0.4 | -1.4 / 5.8 | 17.6 / 55.8 |
| 74 | Prof. Quanta (`core.einstein`) | 9 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.1 | 7.6 / 30.3 | 4 / 0.5 | 7.1 / -4.2 | 16.7 / 59.7 |
| 75 | Gorilla G (`core.gorillag`) | 8.9 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | 7.6 / 2.7 | -1.5 / 5.7 | 18.3 / 55.1 |
| 76 | Boogie Tuskworth (`core.warthog`) | 8.9 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 5.2 / 0.9 | -6.5 / -12.1 | 19.1 / 54.4 |
| 77 | Emir Tariq Falconsword (`core.emir`) | 8.9 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.1 | 7.6 / 30.3 | 1.4 / 2.2 | -10.8 / -7.1 | 16.3 / 58.2 |
| 78 | Nova Kade (`core.crewcyborg`) | 8.8 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 9.4 / 4.6 | 3.7 / 5.6 | 14.5 / 58.8 |
| 79 | Gobbles Plymouth (`core.turkeypilgrim`) | 8.7 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.2 | 7.6 / 30.3 | 1.1 / 0.2 | 6.8 / 2.1 | 14 / 59.4 |
| 80 | Pharaoh Mummy Warrior (`core.pharaoh`) | 8.6 | skinBow L | 0 | 5.6 / 9.9 | 7.8 / 3.2 | 13.6 / 44.4 | 7.6 / 30.4 | -1.5 / -0.7 | -10.5 / 5.1 | 11.6 / 52.5 |
| 81 | Corvin Blackquill (`core.ravennoir`) | 8.4 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.6 / 30.3 | -6.3 / 1.5 | -2.1 / -1.4 | 16.3 / 60 |
| 82 | The Pale Stranger (`core.stranger`) | 8.3 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.2 | 7.7 / 30.3 | 0.7 / 3.1 | -4.6 / -11.5 | 16.6 / 59.3 |
| 83 | Pip Quickfoot (`core.harecourier`) | 8.2 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 9.4 / 1 | 2.7 / 5 | 13.5 / 55.4 |
| 84 | Det. Drake Montego (`core.detectiveduck`) | 8.2 | skinBow R | 0 | 5.8 / 9.8 | 7.8 / 3.4 | 14 / 43.9 | 8 / 29.9 | 4.8 / 3.7 | -3.5 / -11.4 | 16.8 / 56.4 |
| 85 | Shiba (`core.shiba`) | 8.1 | skinBow R | 0 | 6.1 / 9.6 | 7.8 / 3.7 | 15 / 42.9 | 9 / 29 | 2.8 / 2 | -9 / -11.3 | 15.3 / 59.1 |
| 86 | Inspector Bigotes (`core.inspector`) | 8.1 | skinBow R | 0 | 5.1 / 10.2 | 7.9 / 2.7 | 12.2 / 46 | 6.1 / 31.9 | -1.8 / 3.6 | -6.9 / -11.3 | 12 / 52.5 |
| 87 | Elder Tomo (`core.elder`) | 8 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.5 | 7.6 / 30.3 | -5.9 / 2 | -0.2 / 4 | 16.6 / 58.9 |
| 88 | Goblina (`core.grizzelda`) | 7.8 | footRoll R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 6 / 9.1 | -5.8 / -9.4 | 13.7 / 48.9 |
| 89 | Sgt. Mickey Callahan (`core.paratrooper`) | 7.8 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.6 / 30.3 | -5.7 / 1.6 | -1.1 / 2.4 | 15.3 / 55.8 |
| 90 | Ace Featherstone (`core.eagleace`) | 7.6 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.7 / 30.3 | 2.1 / 1.6 | 0.9 / 4.4 | 17.1 / 54.6 |
| 91 | Tetl Stonewarden (`core.basaltguardian`) | 7.5 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.4 | 7.7 / 30.3 | 9.6 / 0.7 | -1 / -4 | 16.5 / 58.5 |
| 92 | Thornweaver (`core.thornweaver`) | 7.4 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.6 / 30.3 | 2 / -0.1 | 5.5 / 3.1 | 15.3 / 58.8 |
| 93 | Talon Skycrest (`core.eagleclan`) | 7.4 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.7 / 30.3 | 9.5 / 0.6 | -1.7 / 1.1 | 17.4 / 60.3 |
| 94 | Barnaby Burrows (`core.badgeragent`) | 7.3 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.4 / 44.1 | 7.6 / 30.4 | 2 / 1.6 | -1.2 / 4.1 | 17.2 / 58.4 |
| 95 | Ser Godric Vale (`core.templar`) | 7.3 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.3 / 43.9 | 7.6 / 30.3 | -0.3 / 1.6 | -0.6 / -10.5 | 16.8 / 58.1 |
| 96 | Croakley (`core.croakley`) | 7.2 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.4 | 1.2 / 1 | 1.5 / 4 | 17.3 / 55.2 |
| 97 | Freaky Frida (`core.frida`) | 7 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 3.2 / 3.7 | 3.4 / 3.8 | 14 / 59.3 |
| 98 | Seetah J. Chloth (`core.seetah`) | 7 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.4 | -4.9 / -1.9 | -0.1 / -4.6 | 15.1 / 57.7 |
| 99 | Octo Buddy (`core.octobuddy`) | 7 | skinBow R | 0 | 5.6 / 10 | 7.9 / 3.1 | 13.2 / 44.4 | 7.4 / 30.6 | 5.5 / 1.7 | 4.5 / -10.2 | 22.2 / 55.5 |
| 100 | Mr. Gideon Tarr (`core.firstmate`) | 6.7 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | 8.8 / 1.9 | -4.1 / -5.2 | 17.4 / 56.9 |
| 101 | Mags Petrov (`core.crewquartermaster`) | 6.6 | skinBow R | 0 | 5.6 / 9.9 | 7.8 / 3.2 | 13.7 / 44.5 | 7.6 / 30.4 | 2.5 / 1.4 | 0.7 / 3.4 | 15.8 / 57 |
| 102 | Cap'n Ezra Blackwake (`core.piratecaptain`) | 6.6 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.3 | 13.7 / 44.1 | 7.8 / 30.2 | 3.6 / 0 | 0.6 / 3.4 | 15.9 / 54.8 |
| 103 | Zorp Gleebix (`core.abnormalalien`) | 6.5 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.7 / 30.3 | 3.3 / 0.8 | 0.8 / 3.3 | 16 / 59.6 |
| 104 | Biker Gang Girl (`core.bikergirl`) | 6.4 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 0.9 / 0.6 | 0.3 / 3.2 | 15.2 / 57.1 |
| 105 | Imperial Guard (`core.imperialguard`) | 6.4 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.4 / 44.1 | 7.7 / 30.3 | 1.4 / 2.6 | 4.5 / -6.8 | 17.4 / 59.8 |
| 106 | Wren Halloway (`core.crewrecon`) | 6.4 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 6.6 / 1.8 | -2.3 / 3.2 | 16.1 / 58.2 |
| 107 | Maximus Cluckworth (`core.gladiatorrooster`) | 6.2 | skinBow R | 0 | 5.8 / 9.8 | 7.8 / 3.3 | 13.6 / 43.6 | 7.9 / 30.1 | -0.7 / 3.3 | 1.1 / 3 | 17 / 56 |
| 108 | Gorgle (`core.gorgle`) | 5.8 | skinBow R | 0 | 5.6 / 9.9 | 7.8 / 3.2 | 13.8 / 44.6 | 7.6 / 30.4 | 0.3 / -1.1 | 0.4 / 2.6 | 17.2 / 59.5 |
| 109 | Dog Tag Doyle (`core.undeadsoldier`) | 5.8 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.4 | 7.7 / 30.3 | 7.9 / 1.2 | -1.7 / -2.5 | 14.7 / 57 |
| 110 | Vesper Quill (`core.crewalchemist`) | 5.8 | footRoll R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.7 / 30.3 | – / 7.1 | -3.4 / -3 | 14 / 59.5 |
| 111 | DJ Volta Coilwave (`core.synthwaveeel`) | 5.8 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.9 / 44.6 | 7.6 / 30.3 | 4 / 6.5 | -3.4 / 2.6 | 20.8 / 47.1 |
| 112 | Hopsworth Eggleton (`core.easterbunny`) | 5.8 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.6 / 30.3 | 4.9 / 3.3 | 0.6 / 2.6 | 13.6 / 58.3 |
| 113 | Sterling Purrcival (`core.tuxedocat`) | 5.7 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | 4.5 / 3.6 | -6.5 / -8.9 | 16.8 / 56.7 |
| 114 | Fishy Fred (`core.fishyfred`) | 5.6 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.3 | 14 / 44.4 | 7.8 / 30.2 | 2.7 / 0.5 | 0.3 / -8.8 | 14.7 / 54.6 |
| 115 | The Rough Rider (`core.roosevelt`) | 5.6 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.6 / 30.3 | 1.4 / 1 | -4.9 / 2.4 | 17 / 58.9 |
| 116 | Puddles Backspin (`core.boxduck`) | 5.5 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.3 | 13.8 / 44.2 | 7.8 / 30.2 | 2.1 / 0.8 | -4.5 / -8.7 | 17.1 / 53.2 |
| 117 | Kaiser Ironhelm (`core.gothickaiser`) | 5.5 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | -0.5 / 0.2 | 1.4 / 2.3 | 16.2 / 58.6 |
| 118 | Botboy (`core.botboy`) | 5.4 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.6 | 7.6 / 30.4 | 1.3 / -1.9 | -3.9 / -8.6 | 17.1 / 58.8 |
| 119 | Chompers McFinn (`core.wackyshark`) | 5.4 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | -0.4 / -3.2 | -4.7 / -8.6 | 20.5 / 55 |
| 120 | Ser Aurelian Dawnshield (`core.paladin`) | 5.3 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.6 / 30.3 | 6.3 / 0.3 | -2.3 / 2.1 | 16.4 / 58.4 |
| 121 | Spacewalker (`core.astronaut`) | 5.2 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.9 / 44.5 | 7.7 / 30.3 | 5 / 1.9 | 3.3 / 1 | 16.7 / 57.9 |
| 122 | Rad Rootley (`core.radishman`) | 5.2 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.6 / 30.4 | 2.6 / 1.3 | -7.1 / -7.7 | 12 / 59.2 |
| 123 | Uncle Spangle (`core.unclesam`) | 5.2 | skinBow R | 0 | 5.6 / 9.9 | 7.8 / 3.2 | 13.6 / 44.5 | 7.6 / 30.4 | 0.1 / 1.6 | -1.1 / 2 | 16.2 / 58.7 |
| 124 | Rufus Boomtown (`core.baboon`) | 5.1 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.7 / 30.3 | 7.2 / 1.7 | 0.9 / 0.2 | 16.4 / 53.6 |
| 125 | Buster Haymaker (`core.boxerbunny`) | 4.8 | skinBow R | 0 | 6.4 / 9.5 | 7.8 / 3.9 | 15.6 / 42.2 | 9.7 / 28.3 | 2.1 / 2.1 | -4.2 / -8 | 17.2 / 53.9 |
| 126 | Ellis Velvetrope (`core.elephantwarrior`) | 4.7 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.6 / 30.3 | 3.4 / 0.9 | -6.6 / -7.2 | 19.3 / 54.7 |
| 127 | Rocco Tickwell (`core.crewk9`) | 4.7 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.6 / 30.3 | 0.3 / -0.3 | -0.8 / -7.9 | 16.5 / 58.4 |
| 128 | The Dapper (`core.dapper`) | 4.4 | footRoll R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 1.3 / -3.1 | -6.2 / -5.6 | 14.9 / 56.6 |
| 129 | Punkin (`core.punkin`) | 4.3 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.2 | 7.6 / 30.3 | 5.9 / 1.6 | 0.7 / -7.5 | 15.6 / 58.8 |
| 130 | Coach Hank Shelton (`core.coachtortoise`) | 4.3 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | 6.4 / 0.5 | -2.7 / -5.2 | 17.5 / 55.8 |
| 131 | Kato Emberline (`core.kato`) | 4.2 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.7 / 30.3 | -2.1 / -1.1 | -2.7 / -4.5 | 17 / 58.7 |
| 132 | Honest Abe (`core.abe`) | 4.2 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.2 | 7.6 / 30.3 | 2 / 1.4 | 2.3 / -2.2 | 17 / 58.6 |
| 133 | Ricochet (`core.ricochet`) | 4.1 | footRoll R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 0.2 / -2.8 | -4.7 / -2.9 | 10.9 / 57.5 |
| 134 | Field Medic Automaton (`core.medicautomaton`) | 4.1 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.6 / 30.3 | -2 / 0.4 | 0.9 / -3.9 | 16.2 / 55.3 |
| 135 | General Cherrytree (`core.washington`) | 4 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.6 / 30.3 | 1.2 / 0.3 | -5.9 / -4.8 | 17.4 / 58.6 |
| 136 | The Mechanic (`core.mechanic`) | 3.9 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | 6 / 2.6 | -1.1 / -3.7 | 13.6 / 52.3 |
| 137 | Pink Mantis (`core.pinkalien`) | 3.8 | footRoll R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.2 | 7.7 / 30.3 | -0.7 / -2.5 | -0.7 / -2.4 | 16.5 / 59.6 |
| 138 | Ryker Voss (`core.merc`) | 3.8 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 3.4 / 0.9 | 1.9 / 0.3 | 16.4 / 56 |
| 139 | Lancer Mei (`core.mei`) | 3.7 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | -0.8 / 0.2 | -5.6 / -2.9 | 15.6 / 59.6 |
| 140 | Stealth Operative (`core.stealthop`) | 3.7 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.7 / 30.3 | 1.2 / 1.1 | 1.8 / 0.4 | 9.6 / 50.1 |
| 141 | Clangers (`core.cymbalmonkey`) | 3.7 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.6 / 30.3 | 3.6 / -0.3 | 1.8 / -1.3 | 15.1 / 58.6 |
| 142 | Kenji (`core.resolvesoldier`) | 3.6 | footRoll R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | 2.3 / 4.9 | -4 / -2.3 | 14.5 / 54.1 |
| 143 | Flicker (`core.crewphase`) | 3.5 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.7 / 30.3 | 5.6 / 2.2 | 0.2 / 0.1 | 15.3 / 60.7 |
| 144 | Kris Kringleton (`core.santa`) | 3.5 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.4 / 44.1 | 7.6 / 30.3 | 0.8 / 1.2 | 1.6 / -3.1 | 17.6 / 58.4 |
| 145 | Iron Knight (`core.knight`) | 3.4 | skinBow R | 0 | 7 / 9.2 | 7.7 / 4.4 | 17.1 / 40.3 | 11.3 / 26.7 | 4 / -1.7 | -2.1 / -6.6 | 10.6 / 49.4 |
| 146 | Anoobys (`core.anubis`) | 3.4 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | -1.3 / 2.8 | -4.7 / -2.7 | 16.8 / 55.8 |
| 147 | Ollie Hootman (`core.owlsniper`) | 3.4 | skinBow R | 0 | 5.3 / 10.1 | 7.9 / 2.9 | 12.6 / 45.5 | 6.5 / 31.5 | 0.8 / 0.2 | -3.7 / -6.6 | 16.5 / 60.1 |
| 148 | Fenn Dustwhirl (`core.fennec`) | 3.4 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.7 / 30.3 | 4.4 / 1.3 | -1.6 / 0.2 | 17.4 / 55.2 |
| 149 | Imperator Laurel (`core.caesar`) | 3.4 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.7 / 30.3 | 3.2 / -0.1 | 1.5 / -2.7 | 17.2 / 60 |
| 150 | Ser Castor Brightmoor (`core.celestialknight`) | 3.3 | footRoll R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.7 / 30.3 | 2.8 / 4.6 | -3.9 / -5.4 | 16.4 / 59.9 |
| 151 | Ziggy Bananas (`core.chimp`) | 3.3 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.1 | 7.6 / 30.3 | 5.4 / 0.6 | 0.7 / -3.5 | 17 / 60 |
| 152 | T-TreeFitty (`core.t350`) | 3.2 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.6 / 30.3 | -1.1 / -1.4 | -1.7 / -1.1 | 15.7 / 57.7 |
| 153 | Lyra Vantis (`core.crewchronomage`) | 3.2 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.6 / 30.3 | 2.5 / 0.6 | -2.2 / 0 | 15.1 / 55.8 |
| 154 | Ryo Snapclaw (`core.mantisshrimp`) | 3.2 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.3 | 13.5 / 44 | 7.8 / 30.2 | -0.7 / 0.6 | 1.3 / -0.1 | 15.3 / 56.2 |
| 155 | Azure Sentinel (`core.azuresentinel`) | 3.1 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.1 | 7.6 / 30.3 | -1 / 3.5 | -4.2 / -3.9 | 14.5 / 58.1 |
| 156 | Mummy Bot (`core.mummybot`) | 3 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.3 | 7.7 / 30.3 | 5.1 / -1 | -2.5 / -1 | 14.4 / 58.4 |
| 157 | The Visitor (`core.visitor`) | 2.8 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.2 | 7.6 / 30.3 | -0.7 / 3 | -1.6 / -0.8 | 14.7 / 58 |
| 158 | Chad Croakley (`core.gymfrog`) | 2.8 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.6 / 30.3 | 0.4 / 2.1 | 0.9 / -1.2 | 19 / 57.2 |
| 159 | Ser Aldous Lionmane (`core.lionheart`) | 2.8 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.2 | 7.7 / 30.3 | 1.9 / 2.1 | 0.9 / -3.5 | 17.1 / 57.5 |
| 160 | Astrid Stormbrand (`core.vikingf`) | 2.8 | skinBow L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.7 / 30.3 | 4.8 / 0 | 0.9 / -2.2 | 15.9 / 57.9 |
| 161 | Boglurker (`core.boglurker`) | 2.7 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.4 | – / -1.1 | -4.4 / -5.9 | 16.1 / 55.7 |
| 162 | Count Bonesworth (`core.bonesworth`) | 2.7 | footRoll R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 0.5 / 4 | -1.3 / -1.3 | 16.3 / 59.1 |
| 163 | CRT Robot (`core.crtrobot`) | 2.5 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.6 / 30.3 | 4.6 / 1.7 | -0.1 / -2.4 | 12 / 48.7 |
| 164 | Old Timer (`core.oldtimer`) | 2.5 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 0.3 / 2.1 | -4.2 / -0.7 | 15.2 / 60.7 |
| 165 | Flt. Lt. Ember (`core.ember`) | 2.3 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 1.8 / 2.5 | -0.1 / -0.9 | 12.4 / 51.1 |
| 166 | Clio Everwhen (`core.timetraveler`) | 2.2 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.5 | 7.6 / 30.3 | -0.1 / 3 | -0.6 / -1.4 | 14.8 / 57.7 |
| 167 | Juno Hartwell (`core.crewpilot`) | 2.2 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.7 / 30.3 | 3.1 / 0 | -4.1 / -5.4 | 13.6 / 60.6 |
| 168 | Scarlet Brinewell (`core.femalepirate`) | 2.2 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.7 / 30.3 | 4.3 / 2.1 | -0.4 / -5.2 | 14.9 / 58 |
| 169 | Cyber Lion (`core.cyberlion`) | 2.1 | footRoll L | 0 | 5.6 / 9.9 | 7.8 / 3.2 | 13.7 / 44.5 | 7.6 / 30.4 | 0 / 0.9 | -0.3 / -5 | 17.4 / 53.8 |
| 170 | Newt Calloway (`core.warlord`) | 2 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.4 | 7.6 / 30.4 | 3 / 1.1 | -1 / -1.2 | 17.3 / 56.6 |
| 171 | Astor Moonvale (`core.ts2wizard`) | 1.9 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.4 / 44 | 7.6 / 30.3 | 0.2 / 1.5 | -2.7 / -3 | 15.4 / 56.5 |
| 172 | Gefr. Otto Brandt (`core.germanpara`) | 1.3 | skinBow R | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.6 / 44.3 | 7.7 / 30.3 | 0.9 / 1.7 | -2.4 / -1.9 | 16.4 / 57.6 |
| 173 | Starfarer (`core.darkastronaut`) | 1.2 | footRoll L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.7 / 44.4 | 7.6 / 30.3 | 0.9 / 0.9 | -1.9 / -2 | 15.5 / 54 |
| 174 | Chilly Flakesworth (`core.snowman`) | 0.3 | kneePoint R | 0 | 5.5 / 10 | 7.9 / 3 | 13.3 / 45.2 | 7.1 / 30.9 | – / – | – / – | 13.8 / 54.5 |
| 175 | Baseball Robot (`core.rollerbot`) | 0.1 | kneePoint L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.5 / 44.1 | 7.6 / 30.3 | – / – | – / – | 14.3 / 58.3 |
| 176 | The Veiled Vanguard (`core.vanguard`) | 0 | kneePoint L | 0 | 5.7 / 9.9 | 7.8 / 3.2 | 13.8 / 44.4 | 7.7 / 30.3 | – / – | – / – | 17.8 / 58.8 |
<!-- /limb-table -->
