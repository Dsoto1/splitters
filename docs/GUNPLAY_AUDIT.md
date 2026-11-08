# Gunplay audit: report card (November 2026)

Measured, not tuned: every number below comes from the shared sim (`Match`, the code the server, client prediction
and bots run), driven by `pnpm gun-report` (`packages/server/src/tools/gun-report.ts`) on a flat deck with one shooter
and one standard target (100 health, standard look, no character stats). Machine-readable results:
[gunplay-audit.json](gunplay-audit.json). Judged against [GUNPLAY_DIRECTION.md](GUNPLAY_DIRECTION.md) (arcade
responsiveness + ballistic depth + modern polish; responsiveness > realism) and [GUNPLAY_SPEC.md](GUNPLAY_SPEC.md).
No weapon was changed. The October feel pass that set today's tuning is in git (78c11a0, cc5c673).

![Time to kill by distance for the benchmark seven](gunplay-ttk.svg)

**Reading the numbers.** TTK runs from the first round leaving the barrel to the kill: flight time, reloads and
burns count. *Ideal* puts every round where it is aimed (the gunplay cone off; a shotgun keeps its pattern), with
perfect tracking, full recoil counter and drop held over. *Hip* and *ADS* use the real cone (standing still), same
perfect tracking and counter, median of 8 seeds; "–" = no kill within 8 s in most seeds. Shots to kill (STK) are the
fewest rounds that kill. Armoured = full armour (100, takes two thirds of each hit). Distances in metres, times in
seconds unless marked.

## The benchmark seven

| | Service Pistol | Heavy Revolver | SMG | Assault Rifle | Shotgun | Precision Rifle | Rocket Launcher |
|---|---|---|---|---|---|---|---|
| Weapon | `core.pistol` | `core.revolver` | `core.smg` | `core.rifle` | `core.shotgun` | `core.sniper` | `core.rockets` |
| Body STK 10 / 25 / 50 / 100 | 5 / 5 / 7 / 7 | 2 / 2 / 2 / 2 | 10 / 15 / 17 / 17 | 6 / 6 / 7 / 8 | 3 / – / – / – | 2 / 2 / 2 / 2 | 1 / 1 / 1 / 1 |
| Body TTK ideal 10 / 25 / 50 / 100 | .67 / .70 / 1.10 / 1.23 | .67 / .72 / .80 / .97 | .60 / .97 / 1.17 / 1.28 | .50 / .52 / .65 / .80 | 1.50 / – / – / – | 1.25 / 1.27 / 1.28 / 1.33 | .28 / .78 / 1.62 / 3.28 |
| Head TTK 10 / 25 / 50 / 100 | .33 / .37 / .60 / .73 | 0 / .05 / .13 / .30 | .40 / .63 / .83 / .95 | .20 / .22 / .35 / .40 | 2.25 / – | 0 / .02 / .03 / .08 | as body |
| Armoured body 10 / 25 / 50 / 100 | 1.33 / 1.53 / 3.20 / 3.33 | 1.33 / 1.38 / 1.47 / 2.30 | 1.20 / 1.90 / 3.50 / 3.62 | 1.10 / 1.12 / 1.25 / 1.50 | 3.00 / – | 2.50 / 2.52 / 2.53 / 2.58 | 1.78 / 2.28 / 3.12 / 4.78 |
| Body TTK hip / ADS at 25 m | .70 / .70 | .72 / .72 | **3.50** / 1.93 | .52 / .52 | – / – | 3.14 / 1.27 | .78 / .78 |
| Body TTK hip / ADS at 50 m | 1.27 / 1.10 | 7.23 / .80 | **6.80** / 3.87 | .65 / .65 | – | – / 1.28 | 1.62 |
| First shot from idle | 0 ms | 0 | 0 | 0 | 0 | 0 | 0 |
| Draw (switch in to first shot) | 133 ms | 250 | 183 | 317 | 250 | 483 | 517 |
| Reload tactical / empty | .85 / 1.12 | 1.08 / 1.98 (rounds) | .92 / 1.22 | 1.42 / 1.82 | 1.35 / 2.25 (shells; 1st .55) | 1.52 / 1.85 | – / .92 |
| Reload cancel: fire / swap to Pistol | 0 / – | 0 / 133 ms | 0 / 133 | 0 / 133 | 0 / 133 | 0 / 133 | – / 133 |
| One round's kick, settles in | 12 mrad, 100 ms | 121, 767 ms | 3, 67 ms | 10, 150 ms | 60, 417 ms | 70, 467 ms | – |
| 10-round spray offset, settles in | – | – | 61 mrad, 150 ms | 87 mrad, 350 ms | – | – | – |
| Cone hip / ADS / running (mrad) | 2 / 1.2 / 8 | 0.5 / 0.3 / 12.5 | 6 / 4.8 / 10 (round 10: 32) | 1.5 / 0.6 / 9.5 (round 10: 8.7) | 75 pattern | 30 / 0 / 60 | 0 |
| Falloff (damage at 25 / 50 / 100 m) | 91 / 65 / 65 % | 100 / 76 / 70 % | 64 / 55 / 55 % | 100 / 91 / 75 % | 25 % past 22 m | 100 % | none |

## What's strong

- **Responsiveness is where the direction wants it.** Every gun without a deliberate wind-up fires in the input the
  trigger arrives in (0 ms; the Railgun's charge 383 ms and the Spin Gun's spin-up 450 ms are their mechanics).
  Firing breaks a tactical or shell reload in the same input (0 ms), and a swap to the Pistol from any gun, mid-reload
  included, shoots in 133 ms: caught reloading the Spin Gun (3.5 s), the sidearm wins by 3.4 s (spec §19).
- **Draw times follow the spec's ladder:** Pistol 133 ms, SMG 183, Revolver/Shotgun 250, rifles 317, Precision 483,
  Rocket 517, Grenade Launcher 617, Railgun 833, Spin Gun 1233 (spin-up included).
- **Reload rhythm is part of identity:** 0.85 s (Pistol) to 3.5 s (Spin Gun); shells and revolver rounds load one at
  a time and each is usable at once (first shell 0.55 s); tactical faster than empty everywhere it matters.
- **Recoil is learnable and recovers predictably:** deterministic per round; one round settles in 67 ms (SMG) to
  767 ms (Revolver); a 10-round rifle spray climbs 87 mrad uncountered and is back in 350 ms.
- **The Heavy Revolver delivers its promise:** a head shot kills at any range, two body shots to 150 m, and it punishes
  fanning (hip at full cadence: no kill at 50 m in most seeds; paced or aimed: 0.80 s).
- **Ballistic depth is real:** flight time and drop are in every TTK (Rocket 0.28 s at 10 m → 3.28 s at 100 m; Pistol
  head TTK 0.33 → 0.73 s), falloff differs by family (SMG steep, rifle gradual, precision none).
- **ADS is optional for the hip-fire guns:** Pistol and Rifle hip TTK equals the ideal out to 25-100 m.

## What's weak against the direction

1. **The Assault Rifle out-classes the SMG at the SMG's own range.** Ideal body TTK 0.50 vs 0.60 s at 10 m, and the
   rifle's hip cone is a quarter of the SMG's (1.5 vs 6 mrad), so hip at 25 m is 0.52 vs 3.50 s. The SMG's only edges
   are draw (183 vs 317 ms) and reload (0.92 vs 1.42 s). The direction calls the SMG a hip-fire specialist that "should
   initially feel extremely controllable".
2. **The Assault Rifle is the best gun at every range from 20 m out,** hip or ADS, and the fastest body TTK of the
   seven from 20 to 150 m (0.80 s at 100 m against the Precision Rifle's 1.33). Its liability (87 mrad climb over 10
   rounds) only exists for a player who doesn't pull down.
3. **The shotgun family is weak at room range.** The pump gun kills in one shell only to ~5 m; at 10 m (a room) it
   takes 3 shells (1.5 s, three times the rifle), and at 20 m it can't kill in 8 s. The Sawed-Off needs 8 shells at 10
   m (5.1 s) and the Auto Shotgun 8 (2.1 s). "A shotgun should make the player want to close distance": it does, but
   the distance is 5 m.
4. **The Precision Rifle's body shot is slow:** 2 body shots at 48 rpm = 1.25-1.33 s at every range, slower than the
   Pistol out to 50 m and the Marksman (0.47-0.57 s) everywhere. Its whole case is the one-shot head.
5. **The Machine Pistol is dominated by the SMG:** 16 rounds at 10 m (0.75 s), 29 at 25 m (more than its 24-round
   magazine: 2.43 s).

## Outliers

| Gun | What the sim says | Kind |
|---|---|---|
| Submachine Gun | slower than the Assault Rifle at every distance; hip 3.5 s at 25 m | dominated by the rifle |
| Machine Pistol | 29 rounds to kill at 25 m, 2.4 s (falloff to 50 % by 25 m) | dominated by the SMG |
| Sawed-Off, Auto Shotgun | 8 shells at 10 m (5.1 s, 2.1 s); 2-3 at 5 m | TTK too slow for the class past 6 m |
| Pistol vs Pulse Pistol | Pulse: 5 shots at every range (beam: no travel, no drop, no falloff), 0.60 s at 100 m; Pistol 1.23 s. Both in the Standard set | Pistol dominated at range |
| Marksman vs Precision Rifle | Marksman 3 shots in 0.47-0.57 s at 10-100 m, ADS 0.3 mrad; the Precision Rifle's body kill is 1.25-1.33 s | Precision dominated for body shots |
| Railgun, Gilded Pistol | one shot kills at any range (Railgun 100 damage after a 383 ms charge; Gilded 999) | power weapons: fine where placed as such (§32) |
| Spin Gun | 1.23 s from switch to first round, 3.5 s reload, then the fastest sustained gun (0.55 s at 10 m, 0.87 at 100 m) | the slowest handling of any gun; watch, not a fault |
| Flamethrower | reach ~9 m (17 m/s for 0.55 s): no kill at 10 m | short by design; botRange 0-8 matches |
| Plasma, Nailgun, Goo, launchers | no head multiplier (projectiles); Plasma 5 hits everywhere but 2.25 s at 100 m from 55 m/s travel | by design |

Armour roughly doubles every TTK (it takes two thirds of each hit until 150 damage are spent: 200 effective health);
the Pistol needs 13-14 rounds through armour at 50-100 m (more than a magazine).

## Candidate improvements (ranked; none implemented)

| # | Area | What | Expected effect | Size |
|---|---|---|---|---|
| 1 | Feel: identity | SMG vs Assault Rifle: give the SMG the close-range crown (e.g. damage 11 → 13, or rifle falloff starting closer and its hip cone wider than the SMG's) | SMG wins inside ~12 m, rifle owns mid range; the two stop overlapping | small (data + benchmarks.test) |
| 2 | Feel: identity | Shotguns: one-shell kill to ~7 m and two to ~12 m (tighter pattern or slower falloff); Sawed-Off a true two-barrel ambush, Auto Shotgun a clear middle | closing distance pays off in rooms | small (data) |
| 3 | Hit feedback | Optional damage numbers (spec §21 "only if enabled", §44 range readout): a HUD setting, on by default in the Training Range | players and the owner read TTK, falloff and armour by eye | medium (client HUD + option) |
| 4 | Feel: recoil | Precision Rifle body case (e.g. 2-shot kill with a faster bolt, or 100 body at range) and the Pulse/Marksman dominance checked per weapon set | each long gun answers "why pick me" | small (data) |
| 5 | Feel: reload / switch | Melee doesn't break a reload (spec §16 lists it); auto-reload when a magazine runs dry without a trigger pull; Spin Gun draw (1.23 s) | fewer moments where input feels ignored | small (sim + prediction test) |
| 6 | Feel: recoil | Recoil wall readout: draw each spray's pattern on the range's recoil wall (impact decals already there) and print the settle time | recoil patterns become learnable by sight | medium |
| 7 | Network (G3) | An 8-client harness: latency 50-150 ms, jitter, 1-5 % loss, checking prediction vs host, hit registration and kill validation (today: one client at 100 ms, no loss, prediction.test.ts:13) | proves "lead for travel, never for latency" under real conditions | medium-large |
| 8 | Bots (G4) | Weapon choice and ranges from measured TTK (`gun-report` JSON) instead of hand-set `botRange` (e.g. Machine Pistol 0-14 m while it needs 16 rounds at 10 m); a bot-report line of hits/shots by weapon | bots pick and fight with each gun where it is good | medium |

## Appendix A: spec checklist (phases G0-G6, spec §50)

✅ done, 🟡 partial, ❌ missing. Paths under `packages/`; line numbers at main 3d45636.

| Phase · item | | Evidence |
|---|---|---|
| **G0** test room | ✅ | `maps/training_range.json` (boards 5-200 m, movers, penetration walls, duel room, medium lane) |
| G0 pistol, revolver, SMG, rifle | ✅ | `content/weapons/{pistol,revolver,smg,rifle}.json`; families `content/weapons/families.json` |
| G0 immediate firing | ✅ | fire in the input it arrives in: `shared/src/sim/match.ts:2929` (`fireDown && ready`); gun-report: 0 ms |
| G0 projectile travel | ✅ | first 8 m a ray (`shared/src/sim/gunplay.ts:36`, `match.ts:3672`), then `stepBullets` `match.ts:3707` |
| G0 gravity | ✅ | `gunplay.ts:213` `bulletPhysics`, `gunplay.ts:511` `flyBullet`; test `shared/test/ballistics.test.ts:115,149` |
| G0 leading | ✅ | `ballistics.test.ts:172` (runner hit only with travel-time lead) |
| G0 recoil and recovery | ✅ | `gunplay.ts:268` `recoilShot`, `:284` counter, `:309` `recoilIdle`; `shared/test/recoil.test.ts:87,110,141` |
| G0 reload interruption | ✅ | fire `match.ts:2905-2910`, sprint/use `:2900`, swap `:3003`; stages `gunplay.ts:444`; `shared/test/reload.test.ts:127,142,170,215` |
| G0 hit feedback | 🟡 | body / head / armour markers `client/src/game/hud.ts:805`; no damage numbers, no shield or weak-point marker |
| G0 kill confirmation | ✅ | X marker growing per kill in a row `hud.ts:819`; climbing crunch `client/src/game/sessionAudio.ts:357` |
| **G1** glass | ✅ | breakable panes `shared/src/sim/scenario.ts:497` `shootGlass`; `shared/test/glass.test.ts` |
| G1 wood, concrete, metal (+ 13 classes) | ✅ | `gunplay.ts:584` `MATERIAL_BALLISTICS`; surface types `content/surface-types.json` |
| G1 penetration | ✅ | energy-based `gunplay.ts:656`, in flight `match.ts:3847`, water `:3797`; `ballistics.test.ts:272,286` |
| G1 ricochet | ✅ | `gunplay.ts:665`, `match.ts:3831` (grazing, at most one); `ballistics.test.ts:302` |
| G1 destructible props | 🟡 | `scenario.ts:207` destructibles take material multiples; no per-object "minimum penetration class" or ballistic-damage toggle in MapMaker (spec §9) |
| **G2** shotgun | ✅ | pump, shell reload `content/weapons/shotgun.json`; pattern `gunplay.ts:365` `shotCone` (weak past 5 m: see above) |
| G2 precision rifle | ✅ | `content/weapons/sniper.json` (precision family: 950 m/s, 2.5× gravity) |
| G2 LMG | ✅ | `content/weapons/lmg.json` (Spin Gun: spin-up 28 ticks, 120 rounds, 3.5 s reload) |
| G2 rocket launcher | ✅ | `content/weapons/rockets.json` (30 m/s, splash, self-damage) |
| G2 burst rifle | ✅ | `match.ts:2937` burst trigger; `content/weapons/burst_rifle.json` |
| G2 lever action | ❌ | no weapon, no family (the `battle_rifle` family, `families.json:158`, has no weapon either) |
| G2 handling extras | ❌ | no sprint-exit time, per-weapon movement speed or scope holdover marks (spec §35, §5) |
| **G3** server authority, kill validation | ✅ | hits and damage only on the host: `match.ts:5305` `damage`, `kill` after it |
| G3 latency simulation | 🟡 | one client at ~100 ms, prediction exact: `client/test/prediction.test.ts:13`; rewind bounded at 18 ticks `match.ts:112` |
| G3 projectile reconciliation | 🟡 | bullets catch up the shooter's latency then fly live: `ballistics.test.ts:197` |
| G3 8 players, packet loss, scaling 16/24/32 | ❌ | no multi-client hit-registration test under loss or jitter (perf tools measure load and bandwidth, not hits) |
| **G4** leading, drop | ✅ | `shared/src/bots/aim.ts:289` (lead by flight × skill), `:296` (drop comp) |
| G4 recoil control | ✅ | bots counter by skill: `match.ts:2257-2260` |
| G4 burst discipline | ✅ | `aim.ts:345-349` |
| G4 reload decisions | ✅ | empty, or topping up out of sight / in cover: `shared/src/bots/brain.ts:2158-2161` |
| G4 weapon selection, effective range | 🟡 | `brain.ts:4413` `weaponScore`, `:1274` `preferredRange` by hand-set `botRange` / `botDesirability`, not the measured ranges |
| **G5** lethality, ballistics, friendly fire | 🟡 | `shared/src/sim/rules.ts:188,193,124`, host's match setup (`client/src/frontend/frontEnd.ts:1279`), not per map in MapMaker |
| G5 headshots, ammo, reload, penetration, destruction, killcam policy, aim-assist policy, global scales | ❌ | none in `MatchRules` |
| **G6** exotic arsenal | 🟡 | many exotics already ship (Chaos set: bubble, goo, oil, singularity, freeze, flare, nailgun, flak); swappable ammo families and a slow-motion final kill ❌. The spec puts G6 after the foundation is excellent |

## Appendix B: every gun

Body STK and ideal body TTK at 10 / 25 / 50 / 100 m (unarmoured), head and armoured body ideal TTK, hip and ADS body
TTK, first shot, draw, reload (tactical / empty, or heat cool-down), one round's settle time, cone hip / ADS / running
(mrad). Full data, including every armoured and head cell: [gunplay-audit.json](gunplay-audit.json).

| Gun | Class | Trigger · mag | Body STK | Body TTK | Head TTK | Armoured body | Hip body | ADS body | 1st shot ms | Draw ms | Reload ms | Settle ms | Cone |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pistol | pistol | semi 360 · 12 | 5/5/7/7 | .67 / .70 / 1.10 / 1.23 | .33 / .37 / .60 / .73 | 1.33 / 1.53 / 3.20 / 3.33 | .67 / .70 / 1.27 / 3.75 | .67 / .70 / 1.10 / 2.62 | 0 | 133 | 850 / 1117 | 100 | 2 / 1.2 / 8 |
| Heavy Revolver | pistol | semi 90 · 5 | 2/2/2/2 | .67 / .72 / .80 / .97 | 0 / .05 / .13 / .30 | 1.33 / 1.38 / 1.47 / 2.30 | .67 / .72 / 7.23 / – | .67 / .72 / .80 / – | 0 | 250 | 1083 / 1983 | 767 | 0.5 / 0.3 / 12.5 |
| Hand Cannon | pistol | semi 120 · 6 | 2/2/3/3 | .50 / .55 / 1.13 / 1.30 | 0 / .05 / .63 / .80 | 1.50 / 1.55 / 2.13 / 2.30 | .50 / .55 / 6.05 / – | .50 / .55 / 2.97 / 4.97 | 0 | 350 | 1683 / 1683 | 767 | 0.5 / 0.3 / 12.5 |
| Pulse Pistol | pistol | semi 400 · 15 | 5/5/5/5 | .60 / .60 / .60 / .60 | .30 / .30 / .30 / .30 | 1.20 / 1.20 / 1.20 / 1.20 | .60 / .60 / .60 / .53 | .60 / .60 / .60 / .60 | 0 | 183 | 933 / 933 | 150 | 4 / 2.2 / 18 |
| Submachine Gun | smg | auto 900 · 32 | 10/15/17/17 | .60 / .97 / 1.17 / 1.28 | .40 / .63 / .83 / .95 | 1.20 / 1.90 / 3.50 / 3.62 | .60 / 3.50 / 6.80 / – | .60 / 1.93 / 3.87 / 7.02 | 0 | 183 | 917 / 1217 | 67 | 6 / 4.8 / 10 |
| Machine Pistol | smg | auto 1200 · 24 | 16/29/29/– | .75 / 2.43 / 2.50 / – | .50 / .98 / 1.05 / – | 2.50 / 4.88 / 4.95 / – | .93 / – / – / – | .88 / – / – / – | 0 | 183 | 1017 / 1017 | 67 | 12 / 10.2 / 18 |
| Spin Gun | smg | auto 1200 · 120 | 12/12/13/16 | .55 / .57 / .65 / .87 | .35 / .37 / .45 / .62 | 1.10 / 1.12 / 1.25 / 1.67 | .55 / .57 / 2.15 / – | .55 / .57 / .65 / – | 450 | 1233 | 3517 / 3517 | 117 | 12 / 8.4 / 42 |
| Nailgun | smg | auto 720 · 50 | 10/10/10/10 | .85 / 1.05 / 1.38 / 2.05 | .87 / 1.07 / 1.40 / 2.07 | 1.60 / 1.80 / 2.13 / 2.80 | .85 / 1.07 / 1.94 / 5.34 | .85 / 1.05 / 1.40 / 3.11 | 0 | 283 | 1350 / 1350 | – | 20 / 11 / 34 |
| Assault Rifle | rifle | auto 600 · 30 | 6/6/7/8 | .50 / .52 / .65 / .80 | .20 / .22 / .35 / .40 | 1.10 / 1.12 / 1.25 / 1.50 | .50 / .52 / .65 / .80 | .50 / .52 / .65 / .80 | 0 | 317 | 1417 / 1817 | 150 | 1.5 / 0.6 / 9.5 |
| Burst Rifle | rifle | burst 150 · 24 | 6/6/7/9 | .53 / .55 / .85 / .97 | .13 / .15 / .45 / .50 | 1.33 / 1.35 / 1.65 / 2.10 | .53 / .55 / .85 / 1.17 | .53 / .55 / .85 / .97 | 0 | 317 | 1433 / 1433 | 350 | 1.5 / 0.6 / 9.5 |
| Plasma Rifle | rifle | auto 514 · 40 | 5/5/5/5 | .62 / .88 / 1.35 / 2.25 | as body | 1.20 / 1.47 / 1.93 / 2.83 | .62 / .88 / 1.35 / 2.67 | .62 / .88 / 1.35 / 2.27 | 0 | 317 | 1517 / 1517 | – | 10 / 5.5 / 24 |
| Laser Rifle | rifle | auto 1800 · heat | 25/25/25/– | .80 / .80 / .80 / – | .40 / .40 / .40 / – | 1.67 / 1.67 / 1.67 / – | .80 / .80 / .80 / – | .80 / .80 / .80 / – | 0 | 317 | cool 1667 | – | 0 / 0 / 14 |
| Marksman Rifle | sniper | semi 257 · 10 | 3/3/3/3 | .47 / .48 / .50 / .57 | .23 / .25 / .27 / .33 | 1.17 / 1.18 / 1.20 / 1.27 | .47 / .48 / 1.08 / – | .47 / .48 / .50 / .57 | 0 | 350 | 1517 / 1517 | 283 | 13 / 0.3 / 38 |
| Sniper Rifle | sniper | bolt 48 · 5 | 2/2/2/2 | 1.25 / 1.27 / 1.28 / 1.33 | 0 / .02 / .03 / .08 | 2.50 / 2.52 / 2.53 / 2.58 | 1.25 / 3.14 / – / – | 1.25 / 1.27 / 1.28 / 1.33 | 0 | 483 | 1517 / 1850 | 467 | 30 / 0 / 60 |
| Railgun | sniper | charge 90 · 4 | 1/1/1/1 | 0 / 0 / 0 / 0 | 0 | .67 / .67 / .67 / .67 | 0 / 0 / .33 / – | 0 / 0 / 0 / 0 | 383 | 833 | 1850 / 1850 | 333 | 12 / 0 / 26 |
| Shotgun | shotgun | pump 80 · 6 | 3/–/–/– | 1.50 / – | 2.25 / – | 3.00 / – | 1.50 / – | 1.50 / – | 0 | 250 | 1350 / 2250 | 417 | 75 pattern |
| Sawed-Off | shotgun | semi 257 · 2 | 8/–/–/– | 5.13 / – | 5.83 / – | – | 4.90 / – | 4.90 / – | 0 | 217 | 1183 / 1183 | 417 | 150 pattern |
| Auto Shotgun | shotgun | auto 200 · 8 | 8/–/–/– | 2.10 / – | 4.67 / – | 6.02 / – | 2.10 / – | 2.10 / – | 0 | 350 | 1683 / 1683 | 417 | 90 pattern |
| Flak Cannon | shotgun | auto 72 · 4 | 2/6/–/– | 1.02 / 6.32 / – | 1.84 / 7.08 / – | 2.26 / – | 1.02 / 5.87 / – | 1.00 / 2.17 / 7.61 / – | 0 | 383 | 1600 / 1600 | – | 80 / 44 / 85 |
| Grenade Launcher | explosive | auto 65 · 4 | 2/2/2/– | 1.25 / 1.83 / 3.08 / – | as body | 2.17 / 2.75 / 4.00 / – | as ideal | as ideal | 0 | 617 | 1683 / 1683 | – | 0 |
| Rocket Launcher | explosive | auto 100 · 1 | 1/1/1/1 | .28 / .78 / 1.62 / 3.28 | as body | 1.78 / 2.28 / 3.12 / 4.78 | as ideal | as ideal | 0 | 517 | – / 917 | – | 0 |
| Blast Rockets | explosive | auto 75 · 4 | 2/2/2/2 | 1.13 / 1.70 / 2.67 / 4.58 | as body | 1.93 / 2.50 / 3.47 / 5.38 | as ideal | as ideal | 0 | 450 | 1850 / 1850 | – | 0 |
| Swarm Launcher | explosive | auto 51 · 4 | 1/1/1/– | .45 / 1.20 / 2.45 / – | as body | 1.60 / 2.35 / 3.60 / – | as ideal | as ideal | 0 | 483 | 1683 / 1683 | – | 140 / 77 |
| Guided Rocket | explosive | semi 48 · 1 | 1/1/1/1 | .50 / 1.38 / 2.85 / 5.80 | as body | 3.25 / 4.13 / 5.60 / – | as ideal | as ideal | 0 | 517 | – / 1517 | – | 0 |
| Disc Launcher | explosive | auto 72 · 3 | 2/2/2/2 | 1.08 / 1.52 / 2.25 / 3.73 | as body | 1.92 / 2.35 / 3.08 / 4.57 | as ideal | as ideal | 0 | 417 | 1517 / 1517 | – | 0 |
| Gilded Pistol | special | semi 80 · 1 | 1/1/1/1 | 0 | 0 | 0 | 0 | 0 | 0 | 400 | – / 1433 | 267 | 0 |
| Flare Gun | special | semi 90 · 1 | 1/1/1/1 (burn) | 3.60 / 4.10 / 4.98 / 6.33 | as body | 6.28 / 6.50 / 6.53 / – | as ideal | as ideal | 0 | 233 | – / 850 | – | 0 |
| Arc Caster | special | auto 400 · heat | 7/7/–/– | .90 / .90 / – | .45 / .45 / – | 1.95 / 1.95 / – | .90 / .90 / – | .90 / .90 / – | 0 | 317 | cool 1867 | – | 10 / 5.5 / 24 |
| Freeze Ray | special | auto 1200 · heat | 34/34/–/– | 1.65 / 1.65 / – | .80 / .80 / – | 3.30 / 3.30 / – | as ideal | as ideal | 0 | 317 | never overheats | – | 0 |
| Flamethrower | special | auto 1200 · 100 | 9 at 5 m, – past ~9 m | – | – | – | – | – | 0 | 383 | 1850 / 1850 | – | 50 / 27.5 / 64 |
| Goo Gun | special | auto 300 · 20 | 7/7/–/– | 1.58 / 2.33 / – | as body | 2.78 / 3.53 / – | as ideal | as ideal | 0 | 283 | 1267 / 1267 | – | 0 |
| Bubble Blaster | special | auto 164 · 6 | 3/–/–/– | 2.75 / – | 2.80 / – | 5.55 / – | as ideal | as ideal | 0 | 317 | 1350 / 1350 | – | 0 |
| Singularity Cannon | special | semi 40 · 1 | 2/–/–/– | 6.40 / – | as body | – | as ideal | as ideal | 0 | 550 | – / 1850 | – | 0 |
| Oil Slicker | special | auto 360 · 12 | no damage (a slick) | – | – | – | – | – | 0 | 283 | 1183 / 1183 | – | 0 |

## Appendix C: Training Range, checked in the built game

Opened in the built client (`?offline=training_range&test=1&god=1&sim=main`) and in MapMaker. What a tester has:
boards at every marked distance, walking / sprinting / approaching boards, penetration walls, a recoil wall,
destructibles, patrolling range troopers and the lobby's bots as moving humanoid targets.

### Gunplay test arena

`maps/training_range.json` (Deathmatch, 1-8 players; the firing line is x 0, downrange is +x):

| Band (z) | What | Tests |
|---|---|---|
| +38 | Boards on concrete towers: 25 m (3 m up), 50 m (6 m), 100 m (10 m), 150 m (14 m) | elevated shots, drop on an incline |
| +31 | Boards driving toward you and away: 15 ↔ 75 m at running pace, 100 ↔ 180 m sprinting | approaching / receding targets |
| +22 | Boards sliding 8 m side to side at sprinting pace at 25, 50, 100, 200 m | lead |
| +12 | The same at walking pace at 25, 50, 100 m | lead |
| 0 | Long lane: static boards at 5, 10, 25, 50, 100, 200 m, a sign over each; floor markers across the range | drop, travel, falloff, first-shot accuracy |
| -8 to -34 | Penetration walls at 15 m with a board behind each: glass, drywall, planks, heavy wood, sheet metal, steel plate, brick, concrete, dirt, a water tank, bulletproof glass | material penetration |
| -38 | Concrete recoil wall at 20 m; destructibles row at 28-44 m | recoil patterns, environmental damage |
| -48 to -64 | Medium combat lane 0-70 m with cover; three range troopers patrol, strafe and take cover | moving bots, medium-range fights |
| x -36 to -20 | Close duel room with a shotgun and a revolver | point-blank duels |
| x -2 | Front rack: the benchmark seven plus Marksman, Burst Rifle and Spin Gun, typed ammo behind | the benchmark guns |
| x -12, -15 | Back racks (new): every other gun of the arsenal | everything else |

**Added (in MapMaker, through its own palette and inspector):** the 24 guns the range didn't offer now lie on two racks
behind the firing line (x -12 and -15, z -22 to 22, every 4 m, respawning in 5 s like the front rack): Hand Cannon,
Machine Pistol, Sawed-Off, Auto Shotgun, Grenade Launcher, Railgun, Plasma Rifle, Pulse Pistol, Laser Rifle, Nailgun,
Flak Cannon, Guided Rocket; Swarm Launcher, Blast Rockets, Disc Launcher, Arc Caster, Freeze Ray, Flamethrower, Goo
Gun, Bubble Blaster, Oil Slicker, Singularity Cannon, Flare Gun, Gilded Pistol. Every gun of the arsenal is now within
a few steps of the spawns. The map description says so. `validate-map`: 0 issues.

**Still missing (larger; listed, not done):**
- **Damage readout on hit** (spec §21, §44): the range shows only the hit marker; the boards report nothing. A HUD
  option (candidate 3).
- **Humanoid strafing dummies that don't shoot back** (spec §44 "moving lateral targets", "armor targets"): boards
  strafe, but the humanoid targets (troopers, lobby bots) fight. A MapMaker "target dummy" piece (a still or patrolling
  body with optional armour, no weapon) would need adding to MapMaker.
- **Armoured targets** to see armour absorb (the armour pickup is only for yourself).
- **Velocity / drop visualisation toggle** and side-by-side build comparison (spec §44-45): `gun-report` gives the
  numbers; no in-game view.

## Appendix D: method and caveats

- `pnpm gun-report [--weapons=a,b] [--trials=8] [--json=…] [--svg=…]` (about 3 minutes for all 34 guns);
  `--from=docs/gunplay-audit.json --svg=…` redraws the chart.
- The shooter is perfect: it tracks the target's middle (torso or head shape, as measured for its look), counters all
  recoil, holds over for drop and lobs launchers on the low arc. Hip and ADS cells add only the real spread. Real
  players fall between the hip/ADS cells and the uncountered recoil figures; automatics gain most from the perfect
  counter.
- The target stands still, facing the shooter, held in place (stopping power doesn't move it). Spawn protection off,
  lethality and ballistics Standard, Character stats and sizes off.
- Semi and burst triggers are clicked at full cadence (released the tick after each round), which is why the revolvers
  fail when hip-fired at range: their spray only settles after about a second.

### Benchmark weapons (for `shared/test/benchmarks.test.ts`)

| Benchmark | Weapon |
|---|---|
| Service Pistol | `core.pistol` |
| Heavy Revolver | `core.revolver` (the Hand Cannon stays an exotic sidearm) |
| SMG | `core.smg` (the Machine Pistol is the sidearm spray) |
| Assault Rifle | `core.rifle` |
| Shotgun | `core.shotgun` (Sawed-Off and Auto Shotgun are variants) |
| Precision Rifle | `core.sniper` (the Marksman and Railgun are other poles) |
| Rocket Launcher | `core.rockets` (Blast Rockets, Guided and Swarm are variants) |
