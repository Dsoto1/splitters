# Gunplay gap analysis (against GUNPLAY_SPEC.md)

Audit of the weapon system against every section of
[GUNPLAY_SPEC.md](GUNPLAY_SPEC.md), done October 2026, with the phased plan
mapped to the spec's G0–G6. **Before** is the state the audit found;
**Now** is after the G0 pass (and the parts of G1, G5 and G4 that came with
it). Status: ✅ exists, 🟡 partial, ❌ missing.

Where things live: weapon data in `packages/shared/src/sim/weapons.ts`, the
gunplay model in `sim/gunplay.ts`, firing and bullets in `sim/match.ts`
(`fire`, `fireBullets`, `stepBullets`), client prediction in
`packages/client/src/game/prediction.ts`, bot aim in `shared/src/bots/aim.ts`.

## What the audit found

The arsenal was large (34 weapons, a data-driven `WeaponDefinition`, typed
ammo, alt fires, heat, windup, pierce, chain, status effects, destructibles,
hit zones, lag compensation by rewind) but every conventional gun was an
instant **hitscan** ray, recoil was a **random client-side camera kick** that
the server never saw (it only widened a bloom cone), reloads were one
**uninterruptible timer** that filled the magazine at the very end, every
gun had the same head/leg multipliers and **no falloff**, and hit feedback was
one marker (red for heads) and one kill sound. Bots led only projectiles.

## Section by section

### §2 Combat pillars
| Item | Before | Now |
|---|---|---|
| Immediate input response (fire, swap) | ✅ | ✅ |
| Reload cancel by fire / swap / sprint / use | ❌ reload locked the gun | ✅ |
| Physical projectiles where they matter | ❌ bullets were hitscan | ✅ ballistic bullets |
| Extreme weapon identity | 🟡 numbers clustered | 🟡 benchmark four retuned to the poles; rest by family defaults |
| Learnable systems (deterministic recoil, predictable recovery) | ❌ random kick | ✅ |

### §3 Combat simulation model
| Item | Before | Now |
|---|---|---|
| Hitscan for beams / arcade weapons | ✅ | ✅ (beams, rail, laser, arc, gilded pistol, shotgun pellets) |
| Ballistic projectile (velocity, gravity, drag, energy, tracer frequency, lifetime) | ❌ | ✅ `BallisticSpec`; mass/caliber folded into `energy` |
| Slow projectiles (rockets, grenades, plasma) | ✅ | ✅ |

### §4 Hitscan vs projectile
| Item | Before | Now |
|---|---|---|
| Near range instant | n/a | ✅ first 8 m as a ray in the fire tick, plus that tick's flight |
| Velocity families table | ❌ | ✅ pistol 375, revolver 300, SMG 400, rifle 820, battle 880, marksman 900, precision 1000, LMG 760 m/s |

### §5 Gravity & drop
| Item | Before | Now |
|---|---|---|
| Subtle close, meaningful far | ❌ | ✅ 9.81 m/s² × `gravityScale` (rifle drops < 1 cm at 30 m, ~27 cm at 200 m; pistol ~70 cm at 150 m) |
| Ballistics rule Arcade / Standard / Advanced | ❌ | ✅ `rules.ballistics` (velocity ×1.6/1/0.8, gravity ×0.25/1/1.75; arcade also turns off penetration) |
| Scope holdover markings | ❌ | ❌ (G2) |

### §6 Leading
| Item | Before | Now |
|---|---|---|
| Velocity differences make lead weapon knowledge | ❌ | ✅ tested: a runner at 90 m is missed without lead, hit with travel-time lead |
| Training range with moving targets | ❌ | ✅ `training_range` |

### §7 Ammunition families
| Item | Before | Now |
|---|---|---|
| Typed ammo pickups | ✅ | ✅ |
| Round families (ball, hollow, AP, magnum, subsonic, incendiary, explosive, flechette, slug, buckshot, tracer) as data | ❌ | 🟡 energy / velocity / tracer interval per weapon; no swappable ammo types (G6) |
| Exotic hooks (bounce, sticky, homing, status, zones) | ✅ projectiles | ✅ |

### §8 Material interaction
| Item | Before | Now |
|---|---|---|
| Material classes | ❌ | ✅ glass, thin wood, wood, drywall, stone, brick, concrete, thin metal, metal, armor, water, soil, energy, flesh |
| Per-material resistance, ricochet, destruction multiplier | ❌ | ✅ `MATERIAL_BALLISTICS` |
| Energy-based penetration with reduced exit | ❌ | ✅ thickness measured through the collider; velocity × √kept, damage × kept |
| Rare bounded ricochet | ❌ (only some projectiles bounce) | ✅ grazing (< 20°) on metal/stone, at most one, half damage |
| Impact effect / decal / sound set per material | 🟡 one hole + sparks + dust for everything | 🟡 penetration and ricochet points get impacts; per-material effects are G1 follow-up |
| Classification | n/a | free blocks and Style Pack pieces by library material, props by model name, destructibles by model, doors wood; tile structure stays structural concrete so existing maps keep their cover |

### §9 Environmental damage
| Item | Before | Now |
|---|---|---|
| Destructibles, breakable props, glass panes, chained explosions | ✅ | ✅ |
| Weapon signatures (shotgun great vs doors/glass, magnum breaks wood) | 🟡 same damage everywhere | 🟡 material destruction multipliers (glass ×3, wood ×1.2–1.5, concrete ×0.4) |
| MapMaker per-object Ballistic Damage / Minimum Penetration Class | ❌ | ❌ (G5) |

### §10 Damage model
| Item | Before | Now |
|---|---|---|
| Moderate TTK default | 🟡 | ✅ pistol 5 body shots, rifle 6, SMG 10, revolver 2 (or one head) |
| Lethality Arcade / Standard / Tactical as systemic multiplier | ❌ | ✅ `rules.lethality` (effective health ×1.4 / 1 / 0.72) |
| Custom health/damage multipliers | ❌ | ❌ (G5) |

### §11 Body damage
| Item | Before | Now |
|---|---|---|
| Head / torso / legs zones | ✅ (head ×2, legs ×0.75 for all) | ✅ per family: head 1.5–2 (precision 3), legs 0.8–0.9 |
| Arms zone | ❌ | ❌ (arms count as torso) |
| Shotgun reduced head multiplier | ❌ | ✅ ×1.25 |
| Explosives without headshots | ✅ | ✅ |

### §12 Recoil
| Item | Before | Now |
|---|---|---|
| Initial kick / sustained / horizontal / recovery / spread as separate parameters | ❌ | ✅ `KickSpec` + `AccuracySpec` |
| Predictable recovery toward pre-recoil aim | ❌ | ✅ exponential + linear curve per weapon after a delay |
| Player counter-control | 🟡 (camera only) | ✅ pulling down reduces the offset (`rc` in the input), no overshoot |
| Server-authoritative, prediction-exact | ❌ | ✅ counted in applied inputs; tested input for input |

### §13 Extreme profiles
| Item | Before | Now |
|---|---|---|
| Heavy revolver | 🟡 Hand Cannon | ✅ Heavy Revolver (new) |
| SMG / assault rifle / battle rifle / shotgun / LMG / precision | 🟡 | 🟡 benchmark SMG and rifle retuned; others by family (G2) |
| Machine pistol, lever action, burst rifle | 🟡 (no lever action) | 🟡 |

### §14 Spread
| Item | Before | Now |
|---|---|---|
| base / movement / air / sustained / max / recovery | 🟡 bloom only | ✅ |
| First shot to the reticle when settled | 🟡 | ✅ (cone ≤ 0.0015 rad) |
| SMG tight 3–5 rounds, then widening | ❌ | ✅ tight 4 |

### §15 Hip fire vs ADS
| Item | Before | Now |
|---|---|---|
| ADS improves precision; hip specialists | 🟡 one ADS factor for all | ✅ per-weapon ADS multiple (SMG 0.8, rifle 0.4, sniper 0.2) |
| Fire during ADS transition, accuracy interpolates | 🟡 instant | ✅ blends over `adsTicks` |

### §16 Animation priority & interrupts
| Item | Before | Now |
|---|---|---|
| Reload cancel by fire (ammo available), swap, melee (swap to knife), sprint, use | ❌ | ✅ |
| Magazine stages (out → in → chamber) drive ammo | ❌ | ✅ |
| Shell inserted exists immediately | ❌ | ✅ |

### §17–18 Reload rhythm and rules
| Item | Before | Now |
|---|---|---|
| Different reload identities | 🟡 durations only | ✅ pistol 0.83/1.1 s, SMG 0.9/1.2 s, rifle 1.4/1.8 s, revolver round by round (0.3 s + 0.27 s/round + 0.17 s), shotgun shell by shell, LMG 3.5 s |
| Tactical vs empty | ❌ | ✅ |
| Heat instead of reload | ✅ | ✅ |
| Hardcore magazine retention option | ❌ | ❌ (G5) |

### §19 Weapon switching
| Item | Before | Now |
|---|---|---|
| Per-weapon equip times | 🟡 15–40 ticks, not by role | ✅ pistol 0.15 s, SMG 0.2 s, revolver 0.27 s, rifle 0.37 s, launcher 0.63 s, rockets 0.7 s, LMG 0.8 s |
| Sidearm beats a heavy reload | ❌ | ✅ tested |

### §20 Aim assist
| Item | Before | Now |
|---|---|---|
| Controller slowdown / small rotation, configurable | 🟡 one on/off option | 🟡 unchanged (G3/G5: strength, policy) |

### §21–22 Hit feedback and kill confirmation
| Item | Before | Now |
|---|---|---|
| Hitmarker, impact sound, target reaction, material effect | ✅ | ✅ |
| Distinct normal / head / armor / kill by shape and sound | 🟡 head colour only | ✅ diamond / bigger red diamond + ding / blue square + clank / sharp X + crunch |
| Shield, critical weak point | ❌ | ❌ (no shields yet) |
| Crunchy kill sound, multi-kill rhythm | 🟡 one pluck + announcer | ✅ synthesised crunch that climbs a step per kill in a row; marker grows and glows |
| Damage numbers (optional) | ❌ | ❌ |

### §23–26 Impact reactions, death, death cam, slow motion
| Item | Before | Now |
|---|---|---|
| Hit reactions scaled by weapon | 🟡 push by damage | 🟡 + revolver knockback |
| Ragdoll / directional death | ✅ | ✅ |
| Death cam answering "what killed me" | 🟡 hurt arc | ❌ killcam (G3) |
| Final-kill slow motion | ❌ | ❌ (G6) |

### §27 Movement & shooting
| Item | Before | Now |
|---|---|---|
| Walk / crouch / prone / airborne accuracy | ✅ | ✅ per weapon |
| Sprint → ADS transition | 🟡 | 🟡 (no sprint-exit time yet; G2) |
| Per-weapon movement speed (`movementModifier`) | ❌ | ❌ (G2: needs prediction-parity work) |

### §28 Suppression
| Item | Before | Now |
|---|---|---|
| No aim disruption; audio/visual only | ✅ (bots take cover) | ✅ (bots also react to bullets landing late) |
| Near-miss snaps | ❌ | ❌ (G3 audio) |

### §29 Camera & weapon feedback
| Item | Before | Now |
|---|---|---|
| Split mechanical vs visual recoil | ❌ | ✅ camera carries the mechanical offset; viewmodel kick and a small shake carry `visual` |
| Camera shake bounded | ✅ | ✅ |

### §30 Audio
| Item | Before | Now |
|---|---|---|
| Per-weapon synthesised layers, impacts, reload, empty click | ✅ | ✅ (+ revolver report) |
| Environment tails (interior / exterior / tunnel) | ❌ | ❌ (G3 audio) |

### §31 Muzzle & projectile readability
| Item | Before | Now |
|---|---|---|
| Short flash | ✅ | ✅ |
| Tracers at real speed, configurable intervals, final rounds | ❌ every round drawn at 260 m/s | ✅ `tracerEvery` / `tracerFinal` (SMG every 3rd + last 5), pooled streaks at muzzle velocity |
| Faction-tinted tracers | ❌ | ❌ |

### §32–33 Power weapons, pickups
| Item | Before | Now |
|---|---|---|
| Rare power weapons, slow respawns | ✅ | ✅ |
| MapMaker pickup value visualisation | ❌ | ❌ (G5) |

### §34 Archetype matrix
Before: 16 of 23 archetypes (no lever action, bow, thrown knife, semi-auto
shotgun distinct, anti-material, battle rifle distinct). Now: + heavy
revolver. Families exist for battle rifle and machine pistol.

### §35 Weapon data model
| Item | Before | Now |
|---|---|---|
| identity, fire, ammo | ✅ | ✅ + `family` |
| handling (equip, ADS, sprint exit, movement) | 🟡 raise only | 🟡 raise + `adsTicks`; sprint exit and movement G2 |
| projectile (type, velocity, gravity, drag, penetration, ricochet) | 🟡 slow projectiles only | ✅ `ballistic` |
| accuracy | 🟡 | ✅ `accuracy` |
| recoil | 🟡 | ✅ `kick` |
| reload (type, tactical, empty, stages) | ❌ | ✅ `reload` |
| damage (head, limb, falloff) | 🟡 head only | ✅ `headshot`, `legshot`, `falloff` |
| feedback (camera / visual kick, muzzle, audio) | 🟡 | 🟡 `kick.visual`, sound; controller impulse G3 |

### §36 Fire modes
Semi / auto / burst / charge (windup) / spin-up / alt fire ✅ before and now;
pump-cycle and hold-release ❌ (G2).

### §37 Damage falloff
| Item | Before | Now |
|---|---|---|
| Per-family profiles | ❌ | ✅ SMG steep 12→35 m to 55%, pistol 18→45 m to 65%, revolver 25→60 m to 70%, rifle 30→80 m to 75%, precision 150→300 m to 90%, shotgun pellets 8→25 m to 30% |

### §38 Network
| Item | Before | Now |
|---|---|---|
| Server authority for fire, hits, damage, kills | ✅ | ✅ + penetration, ricochet |
| Client predicts flash, recoil, tracer, audio | 🟡 recoil random | ✅ recoil exact |
| Lag compensation designed with travel | 🟡 rewind for rays | ✅ see below |

**Lag compensation with travel (the choice).** A bullet's first 8 m are
resolved as a ray in the fire tick against targets rewound to the shooter's
view tick. The bullet then *catches up* the ticks its input spent reaching
the server, one tick of flight per recorded tick, each against that tick's
rewound positions; after that it flies against the live world. So a
shooter leads only for travel time, never for latency (tested: a lead
computed from what the shooter saw 12 ticks ago hits with rewind and misses
without), and no victim is ever rewound more than `MAX_REWIND_TICKS` (300
ms). Rewinding the whole flight was rejected: long flights would hit players
already behind cover for as long as the flight lasted. Bots and NPCs have
no latency and fly against the live world from the start.

### §39 Browser performance
| Item | Before | Now |
|---|---|---|
| Pooled representations | ❌ one mesh per round | ✅ pooled tracer instances; untracered rounds draw nothing |
| Server-efficient integration | n/a | ✅ bullets are plain objects (never in snapshots), 2 sub-steps per tick, a cheap box reject before capsule tests |
| Interest management / simplified distant projectiles | ❌ | ❌ (G3) |

### §40–41 AI weapon handling, NPCs
| Item | Before | Now |
|---|---|---|
| Bots obey travel and recoil | ❌ (bullets were instant; recoil client-only) | ✅ same rules as players |
| Skill: lead, drop, recoil compensation, burst discipline | 🟡 projectile lead only | ✅ `leadSkill`, `dropComp`, `recoilComp`, `discipline` per difficulty |
| Weak bot with a sniper misses runners far off | ❌ | ✅ tested |
| NPC archetype accuracy | ✅ roles | ✅ |

### §42 Accessibility
Crosshair and hitmarker styles, sensitivity, invert, aim assist toggle ✅;
camera-shake / flash reduction, toggle ADS, vibration ❌ (G5).

### §43 MapMaker combat settings
| Item | Before | Now |
|---|---|---|
| Lethality, Ballistics | ❌ | ✅ in Arcade "more rules" (and `MatchRules`) |
| Friendly fire | ✅ | ✅ |
| Headshots, ammo, reload, pickups, power weapons, penetration, destruction, killcam, aim assist policy, global scales | ❌ | ❌ (G5) |

### §44–45 Training range, tuning tools
| Item | Before | Now |
|---|---|---|
| Range: static targets at marked distances, moving targets, penetration materials, recoil wall | ❌ | ✅ `maps/training_range.json` |
| Armor targets, damage readout, trajectory toggle | ❌ | ❌ (G2) |
| Tuning UI (recoil path, cones, damage over distance, side by side) | ❌ | 🟡 the data and pure functions (`kickOf`, `spreadOf`, `falloffAt`, `flightTo`, `settleTicks`) are there for it; no UI |

### §46–49 Feel validation, default character, extra systems, don'ts
Chambered round ✅ (`unchambered` after an interrupted empty reload); heat
✅; charge ✅; no random jams ✅; akimbo and underbarrel emitters 🟡
(underbarrel grenade alt fire only); mounted weapons still hitscan/heat 🟡.
Don'ts: long uninterruptible reloads, random recoil, bots ignoring
ballistics and latency masquerading as lead are now all fixed.

## Phased plan (spec §50)

| Phase | Scope | Status |
|---|---|---|
| **G0** feel prototype | ballistic bullets with near-range instant, drop, lead; split deterministic recoil with recovery and counter; spread model; staged and per-shell reloads with interrupts; equip times; falloff and body multipliers; distinct hit and kill feedback; Heavy Revolver; benchmark retune; training range | ✅ done |
| **G1** material ballistics | material classes, energy penetration, bounded ricochet | ✅ core done. Left: per-material impact effects, decals and sound sets; MapMaker "material type" on props; destructible props reacting by weapon class |
| **G2** archetype expansion | retune shotgun (slug, semi-auto), precision rifle, LMG handling, rocket launcher, burst rifle timing, lever action; sprint-exit time, per-weapon movement speed, pump/hold-release fire modes, scope holdover marks, range damage readout and trajectory toggle | ❌ |
| **G3** network validation | 8+ players under latency/loss with projectile reconciliation; killcam; interest management for bullets; near-miss snaps; environment audio tails; controller impulse | ❌ |
| **G4** AI | weapon-selection by effective range and falloff, reload decisions, per-NPC-archetype ballistics tuning | 🟡 lead / drop / recoil / burst discipline done |
| **G5** creator controls | headshots, ammo, reload, pickups, power weapons, penetration, destruction, killcam, aim-assist policy, custom lethality and global scales with clamps; MapMaker per-object ballistic settings | 🟡 lethality and ballistics done |
| **G6** exotic arsenal | swappable ammo families, exotic rounds on standard hooks, slow-motion final kill | ❌ |
