# Weapon sets (owner-approved, 2026-11-06)

## The owner's idea
In a bot match, nearly everyone ends up with a pistol. The fun weapons almost never turn up. The owner: "I have never
once seen the sheep weapon, hardly see swarm launcher or gravity weapon. … Weapon sets for map defaults … would allow
weapon style sets or a mixed bag, all depending on the map default and host setting."

## Why it happens today (main 02ec505a)
- **Spawn loadout:** Team Deathmatch, CTF, Deathmatch and most modes start everyone with `core.knife` and
  `core.pistol` (`startingWeapons`, `shared/src/sim/rules.ts`). Only co-op and zombies add a rifle.
- **Pickups:** every other gun comes from pickups. The 89 shipped maps place a **median of 11 weapon pickups**, for
  up to 48 players.
- **Exotics are barely placed:**
  - placed most: SMG 124, rifle 120, shotgun 120, sniper 82;
  - placed least: Swarm 0, Bubble Blaster 0, Arc Caster 0, Guided 0, Singularity (the gravity gun) 1, Flak 1, Pulse
    Pistol 1, the sheep 2, Freeze Ray 2, Goo Gun 2.
- **No variety tools in use:** no map uses "Random from category" pickups, and "Mix up weapon pickups" is off by
  default.
- **Knock-on effect:** the bots' sniper role only works while a bot carries a scoped gun (docs/BOTS.md, "Roles"), so it
  rarely switches on.

## The sets (owner: "set list is fine")
A set is data in `content/weapon-sets.json`. It decides:
- **the spawn loadout,** so nobody is stuck on a pistol;
- **what weapon pickups turn into:** a placed pickup rolls a weapon of the set in its own category, or the nearest
  category the set has (a sniper pickup in Sci-fi becomes the Railgun);
- **what drops** (only set weapons).

| Set | Spawn loadout | Weapons in the set | Grenades (owner, 2026-11-07) |
|---|---|---|---|
| **Standard** | knife, pistol (today's pickup hunt) | as placed on the map (today) | as placed; a frag at spawn |
| **Military** (owner: "pistol and a main gun") | knife, pistol, **assault rifle**; sniper-role bots a **marksman rifle** instead | rifle, burst rifle, SMG, machine pistol, LMG, shotgun, auto shotgun, sawed-off, sniper, marksman, grenade launcher, rockets, pistol, revolver, hand cannon | frag, mine, smoke |
| **Sci-fi** | knife, pulse pistol, **plasma rifle**; sniper-role bots the **railgun** | plasma, laser rifle, railgun, pulse pistol, arc caster, disc launcher, swarm, guided | sticky, vortex, smoke |
| **Medieval** | knife, **spear** | spear, battle axe, knife | incendiary, holy bomb |
| **Chaos** | knife, pistol, **one random oddball each life** | the sheep, swarm, singularity, freeze ray, goo gun, bubble blaster, oil slicker, flare gun, nailgun, flak, blast rockets, gilded pistol | sheep, holy bomb, cluster bomb (everyone spawns with the sheep) |
| **Mixed bag** | knife, pistol, **a random main gun each life** | every weapon a pickup can hold | every grenade |

- **The knife in every set** (owner, 2026-11-07: "for consistency"), Chaos and Mixed bag included.
- **Grenades** (owner, 2026-11-07): grenade pickups roll within the set's grenades, and everyone spawns with the set's
  first.
- **Throwables per set** (the weapons intake of 2026-11-06): the **Smoke Grenade** belongs to **Military** and
  **Sci-fi**. A throwable can look different in a set (`view.looks` in content/throwables.json, read by
  `throwableModel(kind, set)`): in Military the frag is the realistic 3DModelsCC0 frag, in Sci-fi the smoke grenade
  is the Meshy sci-fi canister. The match passes its set to it (session.ts).
- **Random spawn guns** (Chaos, Mixed bag) are rolled from the match seed, the slot and the life. A match replays the
  same, and every peer agrees.
- **Classes on:** class loadouts stay as they are. Pickups still roll within the set.
- **Roulette's signature loadouts** (docs/ROULETTE_MODE_PLAN.md): a signature weapon outside the set falls back to
  the set's main gun.
- **Mode-only weapons** (arena discs), tools (medkit, builder, grapple) and mounted guns are never in a set. Modes
  with fixed weapons (Disc Arena, Spear Fight) ignore the set.

## Map default and host choice
- **Each map's default set** is a map property, MapMaker → Map properties → Weapon set, saved in the map file. The
  default is Standard when a map doesn't say.
- **Official maps** get defaults by theme, set through MapMaker (CLAUDE.md, "Maps"). The agent proposes a table first
  (e.g. Shingle Point Military, Halcyon Station Sci-fi) and the owner confirms it.
- **The host chooses:** Match Setup → Weapons: Map default, or any set. The same choice is in the pause menu's Host
  tab. The setup shows what the map's default is. Saved setups and presets keep their choice.

## Bots
- Bots weigh every set weapon sensibly: range, splash, a projectile's flight, beams, heat.
- A bot match per set has every set weapon getting kills (a scorecard line: kills by weapon).
- Sniper-role bots spawn with the set's scoped gun where it has one (Military, Sci-fi), so the sniper role actually
  plays (docs/BOT_AI_PLAN.md, Phase B).

## Proof
- **Unit tests:** set data, rolls (deterministic, in category), loadouts per set, map default and host override, old
  saves and maps (Standard).
- **e2e:** Match Setup's Weapons choice; a Military match spawns with pistol and rifle; a Chaos match's spawn guns
  vary by life.
- **Scorecard:** kills by weapon per set on a few maps. Each set's weapons all appear.

## Order
- After the Match Setup follow-ups (they share Match Setup and the Host tab).
- It runs alongside Bot AI Phase B.

## As built (`wip/weapon-sets`, 2026-11-07)
- **Data and code:** the table above is `content/weapon-sets.json` (checked and built by
  `tools/content/weapon-sets.mjs`); the behaviour is `sim/weaponSets.ts` (docs/ARSENAL.md, "Weapon sets", has the
  rules: pickups by category with the nearest categories as fallback, kept-fixed pickups, drops, classes, modes
  without a set).
- **Map default:** the map's `weaponSet` (format v28), MapMaker → Map properties → Weapon set. **Host:** Match setup
  → Advanced rules → Weapons, pickups & vehicles → Weapon set ("Map default (…)" or any set), the Host tab (at once),
  a server's `set` rule.
- **Official maps** (the owner's OK of the proposed table, 2026-11-07; set in MapMaker's Map properties; retired maps
  left alone; Fogbound, No Man's Field, Starhaven and Dune Harbor since deleted, 2026-11-09): **Military** Sandgate, Atomic Court, Shingle Point, Bunker Cross, Midnight Keel,
  Rockfall Canyon, Crossroads, Riot Junction, Runway Nine, Capitol Mall, St. John's, Dockside Depot, Glasswork Office,
  Whiteout Station (and Iron Coast once Breakthrough builds it); **Sci-fi** Halcyon Station, Twin Spires,
  Void Yard, Neon Spire, Express Lobby, Undergate Transit, Serene City, Fernwood Moon, Coldwater Gulch,
  Frost Basin; **Medieval** Market Town, Sandfall Colosseum (Citadel and Gallows Yard stay Standard: their layouts
  are built round rockets and the railgun); **Chaos** Cinder Foundry, Pantry Raid, Flatpack Depot, Erosion; **Mixed
  bag** Neon Galleria, Grand Marquee, Primeval Park; **Standard** the rest.
- **Bots:** sniper-role bots spawn with the set's scoped gun (`Match.sniperGun`; re-armed at once when the role comes
  after the spawn). For the oddballs they never used: the sheep is thrown short along an open line to an enemy
  6-20 m off and walks the rest; a big blast with a long fuse (the holy bomb) is thrown half its blast away and the
  bot runs clear; the oil slicker's igniter lights the bot's own slicks (its bot value 0.3 → 0.45).
- **Random spawn guns** are dealt from a deck per player, shuffled from the match seed and the slot: every one of the
  set's main guns comes up once before any comes up again (Chaos's nine oddballs in nine lives), never the same twice
  running. A plain roll per life handed one player the goo gun four lives in six.
- **Measured** (`pnpm bot-report <maps> --mode=core.tdm --seeds=1,2 --seconds=180 --set=<set>`: each set on three maps
  of its theme at the maps' own team sizes, six matches; the bots' kills by weapon, most first):

  | Set (maps) | Kills | By weapon | None |
  |---|---|---|---|
  | **Military** (Shingle Point, Bunker Cross, Sandgate) | 359 | assault rifle 268, marksman rifle 20, rockets 11, frag 9, knife 8, sawed-off 7, grenade launcher 6, pistol 6, shotgun 6, burst rifle 5, machine pistol 3, spin gun (LMG) 3, auto shotgun 3, sniper rifle 1, heavy revolver 1 | SMG, hand cannon, mine |
  | **Sci-fi** (Halcyon Station, Twin Spires, Frost Basin) | 318 | plasma rifle 209, pulse pistol 27, sticky 23, railgun 20, laser rifle 13, knife 7, swarm 5, guided 3, disc launcher 2, arc caster 2 | vortex grenade |
  | **Medieval** (Market Town, Sandfall Colosseum, Gallows Yard) | 464 | spear 362, knife 36, incendiary 33, battle axe 33 | holy bomb |
  | **Chaos** (Cinder Foundry, Pantry Raid, Flatpack Depot) | 376 | swarm 113, pistol 54, blast rockets 47, nailgun 31, gilded pistol 23, oil slicker 23, singularity 19, sheep 16, flak 14, freeze ray 12, bubble blaster 8, goo gun 4, flare gun 3, holy bomb 1 | cluster bomb |
  | **Mixed bag** (Neon Galleria, Grand Marquee, Primeval Park) | 382 | 32 weapons: pistol 87, spin gun 32, sniper rifle 23, SMG 23, swarm 23, marksman 16, arc caster 16, rockets 16, … | the sidearms but the pistol, the spear and axe, every grenade but the frag |
  | **Standard** (Halcyon Station, Cinder Foundry, Market Town) | 413 | pistol 155, assault rifle 109, frag 27, marksman 20, hand cannon 20, burst rifle 18, SMG 18, grenade launcher 15, … | (as placed) |

  Sniper-role bots spawned with the scoped gun: Military 8 (17 kills, 15 scoped), Sci-fi 4 (15, 10 scoped). Military's
  and Sci-fi's spawn guns take most of their kills (75 % and 66 %): the set's other guns come from the map's pickups,
  so how many a map places decides how much of the set shows. Smoke never kills, so it isn't counted as missing.
